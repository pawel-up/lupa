import { bypass } from './constants.js'
import type { CapturedRequest, NetworkMockOptions, NetworkRespondPayload, NetworkEvaluateResult } from './types.js'
import { NetworkInterceptor } from './network_interceptor.js'

let mockIdCounter = 0

/**
 * Internal representation of an active mock within the registry.
 * Associates the user's mock options with its live interceptor instance and tracks remaining calls.
 */
interface RegisteredMock {
  /** The unique numeric ID assigned to this mock during registration. */
  id: number
  /** The options provided by the user (match criteria, response payload, times). */
  options: NetworkMockOptions
  /** The live interceptor instance collecting requests for this mock. */
  interceptor: NetworkInterceptor
  /**
   * Decrementing counter for transient mocks.
   * If this reaches 0, the mock will no longer intercept requests.
   */
  timesLeft?: number
}

/**
 * Central manager for all active network mocks within the Lupa browser environment.
 * Responsible for evaluating incoming RPC requests from the Playwright Node context against registered mocks.
 */
class NetworkRegistry {
  /**
   * Internal list of all registered mocks, sorted newest first so that recently registered mocks take precedence.
   */
  private mocks: RegisteredMock[] = []

  /**
   * Registers a new mock and returns an interceptor.
   * If this is the first mock registered, it triggers an RPC command to enable interception in Playwright.
   *
   * @param options The criteria and response definition for the mock.
   * @returns A `NetworkInterceptor` that tracks requests matching this mock.
   */
  async register(options: NetworkMockOptions): Promise<NetworkInterceptor> {
    const id = ++mockIdCounter
    const interceptor = new NetworkInterceptor(id, this)

    this.mocks.unshift({
      id,
      options,
      interceptor,
      timesLeft: options.times,
    })

    if (this.mocks.length === 1) {
      // First mock registered, enable network interception
      await window.__lupa_command__?.('network:mock:enable')
    }

    return interceptor
  }

  /**
   * Unregisters an active mock by its unique ID.
   * If this was the last active mock, it triggers an RPC command to disable network interception,
   * restoring standard browser network behavior.
   *
   * @param id The unique identifier of the mock to remove.
   */
  async unregister(id: number) {
    this.mocks = this.mocks.filter((m) => m.id !== id)
    if (this.mocks.length === 0) {
      await window.__lupa_command__?.('network:mock:disable')
    }
  }

  /**
   * Core evaluation loop called by Playwright (via `__lupa_evaluate_network_mock`) for every network request.
   * Iterates through active mocks (newest first) to find a match, evaluates dynamic closures, and returns the payload.
   *
   * @param req The raw request payload captured by Playwright.
   * @returns An evaluation result instructing Playwright to either fulfill the request with a mock, or continue.
   */
  async evaluate(req: CapturedRequest): Promise<NetworkEvaluateResult> {
    // Decode base64 postData to string body automatically for convenience
    if (req.postData) {
      req.body = atob(req.postData)
    }

    // find first matching mock
    for (const mock of this.mocks) {
      if (this.matches(mock.options.match, req)) {
        if (mock.timesLeft !== undefined) {
          if (mock.timesLeft <= 0) continue
          mock.timesLeft--
        }

        mock.interceptor.recordRequest(req)

        const respond = mock.options.respond
        let responsePayload: NetworkRespondPayload | symbol | null | undefined

        if (typeof respond === 'function') {
          responsePayload = await respond(req)
        } else {
          responsePayload = respond
        }

        if (responsePayload === bypass) {
          continue // fall through to next mock or network
        }

        const payload = (responsePayload || {}) as NetworkRespondPayload

        return {
          action: 'fulfill',
          status: payload.status || 200,
          headers: payload.headers || {},
          body: this.serializeBody(payload.body),
          isBase64: payload.body instanceof ArrayBuffer,
          delay: payload.delay,
          error: payload.error,
        }
      }
    }

    return { action: 'continue' }
  }

  /**
   * Determines if a given request matches the criteria of a specific mock.
   *
   * @param match The user-defined match criteria (string, RegExp, or RequestMatchOptions).
   * @param req The incoming request payload.
   * @returns `true` if the request satisfies the criteria, `false` otherwise.
   */
  private matches(match: NetworkMockOptions['match'], req: CapturedRequest): boolean {
    if (typeof match === 'string') {
      return this.matchUrl(match, req.url)
    }
    if (match instanceof RegExp) {
      return match.test(req.url)
    }
    if (match && typeof match === 'object') {
      if (match.method && match.method.toUpperCase() !== req.method.toUpperCase()) {
        return false
      }
      return this.matchUrl(match.uri, req.url)
    }
    return false
  }

  /**
   * Matches a URL against a pattern containing placeholders.
   * Converts Express-like parameters (e.g. `:id`) and wildcards (`*`) to regex expressions.
   *
   * @param pattern The pattern provided by the user.
   * @param url The actual URL of the intercepted request.
   */
  private matchUrl(pattern: string, url: string): boolean {
    // Very simple matcher that converts `:param` to `([^/]+)` and `*` to `.*`
    let regexStr = pattern.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')
    regexStr = regexStr.replace(/\*/g, '.*')
    try {
      const re = new RegExp(regexStr)
      return re.test(url)
    } catch {
      return url.includes(pattern)
    }
  }

  /**
   * Safely serializes the user-provided response body into a format the Playwright CDP bridge can accept.
   * Handles strings, nulls, and translates `ArrayBuffer` into base64.
   *
   * @param body The raw body provided in the mock response.
   */
  private serializeBody(body: any): string | null {
    if (body === null || body === undefined) return null
    if (body instanceof ArrayBuffer) {
      return this.arrayBufferToBase64(body)
    }
    if (typeof body === 'string') return body
    // If user passed an object even though we said not to, stringify it
    return JSON.stringify(body)
  }

  /**
   * Converts an `ArrayBuffer` to a base64 encoded string.
   * Required for transporting binary data (like images or PDF mocks) over the CDP RPC bridge.
   *
   * @param buffer The binary buffer to encode.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

/**
 * The global, singleton instance of the NetworkRegistry for the current browser context.
 */
export const registry = new NetworkRegistry()

declare global {
  interface Window {
    __lupa_evaluate_network_mock: (req: CapturedRequest) => Promise<NetworkEvaluateResult>
  }
}

// Expose to Playwright
window.__lupa_evaluate_network_mock = async (req: CapturedRequest) => {
  return registry.evaluate(req)
}
