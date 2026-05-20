import { bypass } from './constants.js'
import type {
  CapturedRequest,
  NetworkMockOptions,
  NetworkRespondPayload,
  NetworkEvaluateResult,
  SerializedMatch,
} from './types.js'
import { NetworkInterceptor } from './network_interceptor.js'

let mockIdCounter = 0

/**
 * Internal representation of an active mock within the registry.
 */
interface RegisteredMock {
  id: number
  options: NetworkMockOptions
  interceptor: NetworkInterceptor
}

/**
 * Central manager for all active network mocks within the Lupa browser environment.
 * Responsible for generating responses for requests matched by the Node layer.
 */
class NetworkRegistry {
  private mocks: RegisteredMock[] = []

  async register(options: NetworkMockOptions): Promise<NetworkInterceptor> {
    const id = ++mockIdCounter
    const interceptor = new NetworkInterceptor(id, this)

    this.mocks.unshift({
      id,
      options,
      interceptor,
    })

    if (this.mocks.length === 1) {
      // First mock registered, enable network interception
      await window.__lupa_command__?.('network:mock:enable')
    }

    // Serialize matcher for Node RouteStore
    let serializedMatch: SerializedMatch = { type: 'string', uri: '' }
    if (typeof options.match === 'string') {
      serializedMatch = { type: 'string', uri: options.match }
    } else if (typeof options.match === 'object') {
      serializedMatch = {
        type: 'options',
        uri: options.match.uri,
        methods: options.match.methods ?? [],
      }
    }

    await window.__lupa_command__?.('network:mock:register', {
      id,
      matcher: serializedMatch,
      times: options.times,
    })

    return interceptor
  }

  async unregister(id: number) {
    this.mocks = this.mocks.filter((m) => m.id !== id)

    await window.__lupa_command__?.('network:mock:unregister', { id })

    if (this.mocks.length === 0) {
      await window.__lupa_command__?.('network:mock:disable')
    }
  }

  /**
   * Evaluates the specific mock identified by Node's RouteStore.
   */
  async evaluateById(id: number, req: CapturedRequest): Promise<NetworkEvaluateResult> {
    const mock = this.mocks.find((m) => m.id === id)
    if (!mock) {
      return { action: 'continue' }
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
      return { action: 'continue' } // fall through to network
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

  private serializeBody(body: any): string | null {
    if (body === null || body === undefined) return null
    if (body instanceof ArrayBuffer) {
      return this.arrayBufferToBase64(body)
    }
    if (typeof body === 'string') return body
    return JSON.stringify(body)
  }

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

export const registry = new NetworkRegistry()

declare global {
  interface Window {
    __lupa_evaluate_network_mock_by_id: (id: number, req: CapturedRequest) => Promise<NetworkEvaluateResult>
  }
}

// Expose to Playwright
window.__lupa_evaluate_network_mock_by_id = async (id: number, req: CapturedRequest) => {
  return registry.evaluateById(id, req)
}
