import { AssertionError } from 'assertion-error'
import type { CapturedRequest } from './types.js'
import type { NetworkInterceptor } from './network_interceptor.js'

function waitFor(condition: () => void, timeout = 500, interval = 25): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      try {
        condition()
        resolve()
      } catch (err) {
        if (Date.now() - start > timeout) {
          reject(err)
        } else {
          setTimeout(check, interval)
        }
      }
    }
    check()
  })
}

/**
 * A class that provides assertion APIs for network requests.
 */
export class NetworkAssert {
  /**
   * The interceptor that this assertion class is attached to.
   */
  protected interceptor: NetworkInterceptor

  constructor(interceptor: NetworkInterceptor) {
    this.interceptor = interceptor
  }

  /**
   * Asserts the mock intercepted at least one request.
   *
   * @example
   * ```ts
   * await button.click()
   * await mock.assert.called()
   * ```
   *
   * @useWhen You need to verify that a network call occurred, but the exact number of times
   *          or the specific payload does not matter.
   * @avoidWhen You expect the network call to happen exactly once. Use `calledOnce()`
   *            instead to prevent false positives from duplicate requests.
   */
  async called(message?: string) {
    await waitFor(() => {
      if (this.interceptor.requests.length === 0) {
        throw new AssertionError(message || 'Expected mock to be called at least once, but it was not called.')
      }
    })
  }

  /**
   * Asserts the mock intercepted exactly zero requests.
   *
   * Note: This method polls for 500ms to ensure no delayed or background requests
   * arrive shortly after the assertion is called.
   *
   * @example
   * ```ts
   * await mock.assert.notCalled()
   * ```
   *
   * @useWhen Ensuring that an action did NOT trigger a network request
   *          (e.g. validating frontend cache hits or form validation failures).
   */
  async notCalled(message?: string) {
    await waitFor(() => {
      if (this.interceptor.requests.length > 0) {
        throw new AssertionError(
          message || `Expected mock to not be called, but it was called ${this.interceptor.requests.length} times.`
        )
      }
    }, 500)
  }

  /**
   * Asserts the mock intercepted exactly one request.
   *
   * @example
   * ```ts
   * await mock.assert.calledOnce()
   * ```
   *
   * @useWhen You want to verify that an event triggers exactly one network request,
   *          preventing bugs where components accidentally fire requests twice.
   */
  async calledOnce(message?: string) {
    await waitFor(() => {
      if (this.interceptor.requests.length !== 1) {
        throw new AssertionError(
          message ||
            `Expected mock to be called exactly once, but it was called ${this.interceptor.requests.length} times.`
        )
      }
    })
  }

  /**
   * Asserts the mock intercepted exactly two requests.
   *
   * @example
   * ```ts
   * await mock.assert.calledTwice()
   * ```
   *
   * @useWhen Verifying retry logic, duplicate submissions, or flows that intentionally trigger the same endpoint twice.
   */
  async calledTwice(message?: string) {
    await waitFor(() => {
      if (this.interceptor.requests.length !== 2) {
        throw new AssertionError(
          message ||
            `Expected mock to be called exactly twice, but it was called ${this.interceptor.requests.length} times.`
        )
      }
    })
  }

  /**
   * Asserts the mock intercepted exactly `n` requests.
   *
   * @param n The exact number of times the mock should have been called.
   *
   * @example
   * ```ts
   * await mock.assert.callCount(3)
   * ```
   *
   * @useWhen You expect a specific, dynamic number of network requests (e.g., polling, batch processing, or looping).
   */
  async callCount(n: number, message?: string) {
    await waitFor(() => {
      if (this.interceptor.requests.length !== n) {
        throw new AssertionError(
          message ||
            `Expected mock to be called exactly ${n} times, but it was called ${this.interceptor.requests.length} times.`
        )
      }
    })
  }

  /**
   * Asserts the mock intercepted at least one request matching the provided partial request object.
   *
   * @param match A partial `CapturedRequest` describing the fields to match (e.g., `method`, `body`,
   *              `headers`, `query`).
   *
   * @example
   * ```ts
   * await mock.assert.calledWith({
   *   method: 'POST',
   *   body: '{"username":"alice"}'
   * })
   * ```
   *
   * @useWhen Verifying that the application sends the correct payload, HTTP method, or authentication
   *          headers during a network request.
   */
  async calledWith(match: Partial<CapturedRequest>, message?: string) {
    await waitFor(() => {
      const hasMatch = this.interceptor.requests.some((req) => this.#partialMatch(req, match))
      if (!hasMatch) {
        throw new AssertionError(
          message || `Expected mock to be called with ${JSON.stringify(match)}, but no matching request was found.`
        )
      }
    })
  }

  /**
   * Asserts the mock did not intercept any requests matching the provided partial request object.
   *
   * Note: This method polls for 500ms to ensure no delayed or background requests
   * match the criteria shortly after the assertion is called.
   *
   * @param match A partial `CapturedRequest` describing the fields that should NOT be present in any request.
   *
   * @example
   * ```ts
   * await mock.assert.notCalledWith({ method: 'DELETE' })
   * ```
   *
   * @useWhen Validating that sensitive data is not sent, or ensuring that specific unwanted operations
   *          are not triggered.
   */
  async notCalledWith(match: Partial<CapturedRequest>, message?: string) {
    await waitFor(() => {
      const hasMatch = this.interceptor.requests.some((req) => this.#partialMatch(req, match))
      if (hasMatch) {
        throw new AssertionError(
          message || `Expected mock to not be called with ${JSON.stringify(match)}, but a matching request was found.`
        )
      }
    }, 500)
  }

  /**
   * Asserts the mock intercepted exactly one request matching the provided partial request object.
   *
   * @param match The partial request object describing the fields to match.
   *
   * @example
   * ```ts
   * await mock.assert.calledOnceWith({
   *   method: 'PUT',
   *   query: { id: '123' }
   * })
   * ```
   *
   * @useWhen You want strict validation that a specific request happened exactly once with a specific payload,
   *          preventing duplicate submissions.
   */
  async calledOnceWith(match: Partial<CapturedRequest>, message?: string) {
    await waitFor(() => {
      const matchingCount = this.interceptor.requests.filter((req) => this.#partialMatch(req, match)).length
      if (matchingCount !== 1) {
        throw new AssertionError(
          message ||
            `Expected mock to be called exactly once with ${JSON.stringify(match)}, but found ${matchingCount} matches.`
        )
      }
    })
  }

  /**
   * Checks if a request matches the given partial request object.
   * @param req The request to match against.
   * @param match The partial request object to match against.
   */
  #partialMatch(req: CapturedRequest, match: Partial<CapturedRequest>): boolean {
    if (match.method && req.method.toUpperCase() !== match.method.toUpperCase()) return false
    if (match.url && !req.url.includes(match.url)) return false
    if (match.body && req.body !== match.body) return false

    if (match.headers) {
      for (const [k, v] of Object.entries(match.headers)) {
        if (req.headers[k.toLowerCase()] !== v) return false
      }
    }

    if (match.query) {
      for (const [k, v] of Object.entries(match.query)) {
        if (req.query[k] !== v) return false
      }
    }

    return true
  }
}
