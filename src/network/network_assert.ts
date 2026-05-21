import { AssertionError } from 'assertion-error'
import type { CapturedRequest } from './types.js'
import type { NetworkInterceptor } from './network_interceptor.js'

/**
 * Options for network polling.
 */
export interface NetworkPollingOptions {
  /**
   * The maximum time to wait for the condition to be true.
   * Default is 500ms.
   */
  timeout?: number
  /**
   * The time to wait between checks.
   * Default is 25ms.
   */
  interval?: number
}

function waitFor(condition: () => void, signal: AbortSignal, interval = 25): Promise<void> {
  const callerError = new Error()

  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        condition()
        resolve()
      } catch (err) {
        if (signal.aborted) {
          if (err instanceof Error && callerError.stack) {
            // Remove the first line of the caller stack (Error\n)
            let callerTrace = callerError.stack.substring(callerError.stack.indexOf('\n') + 1)

            // Remove all lines related to the waitFor function
            callerTrace = callerTrace.replace(/.*at waitFor.*\n/g, '')

            // Remove one more line for the Assert function called this function
            callerTrace = callerTrace.substring(callerTrace.indexOf('\n') + 1)

            // Replace the async timeout stack with the original caller stack
            err.stack = `${err.name}: ${err.message}\n${callerTrace}`
          }
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
   * Creates an AbortController and sets a timeout, so that the `waitFor` method
   * does not wait indefinitely.
   * @param options Polling options, if undefined, default timeout of 500ms will be used.
   */
  #createAbortController(options?: NetworkPollingOptions) {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), options?.timeout || 500)
    return controller
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
  async called(message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        if (this.interceptor.requests.length === 0) {
          throw new AssertionError(message || 'Expected mock to be called at least once, but it was not called.')
        }
        ctrl.abort()
      },
      ctrl.signal,
      options?.interval
    )
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
  async notCalled(message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        if (this.interceptor.requests.length > 0) {
          const err = new AssertionError(
            message || `Expected mock to not be called, but it was called ${this.interceptor.requests.length} times.`
          )
          ctrl.abort()
          throw err
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async calledOnce(message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        if (this.interceptor.requests.length !== 1) {
          const err = new AssertionError(
            message ||
              `Expected mock to be called exactly once, but it was called ${this.interceptor.requests.length} times.`
          )
          if (this.interceptor.requests.length > 1) {
            ctrl.abort()
          }
          throw err
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async calledTwice(message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        if (this.interceptor.requests.length !== 2) {
          const err = new AssertionError(
            message ||
              `Expected mock to be called exactly twice, but it was called ${this.interceptor.requests.length} times.`
          )
          if (this.interceptor.requests.length > 2) {
            ctrl.abort()
          }
          throw err
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async callCount(n: number, message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        if (this.interceptor.requests.length !== n) {
          const err = new AssertionError(
            message ||
              `Expected mock to be called exactly ${n} times, but it was called ${this.interceptor.requests.length} times.`
          )
          if (this.interceptor.requests.length > n) {
            ctrl.abort()
          }
          throw err
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async calledWith(match: Partial<CapturedRequest>, message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        const hasMatch = this.interceptor.requests.some((req) => this.#partialMatch(req, match))
        if (!hasMatch) {
          const actual =
            this.interceptor.requests.length === 1 ? this.interceptor.requests[0] : this.interceptor.requests
          this.#failMatch(actual, match, 'Expected request to match properties', message)
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async notCalledWith(match: Partial<CapturedRequest>, message?: string, options?: NetworkPollingOptions) {
    const ctrl = this.#createAbortController(options)
    await waitFor(
      () => {
        const matchingRequests = this.interceptor.requests.filter((req) => this.#partialMatch(req, match))
        if (matchingRequests.length > 0) {
          ctrl.abort()
          const actual = matchingRequests.length === 1 ? matchingRequests[0] : matchingRequests
          this.#failMatch(
            actual,
            match,
            'Expected request not to match properties, but a matching request was found',
            message
          )
        }
      },
      ctrl.signal,
      options?.interval
    )
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
  async calledOnceWith(match: Partial<CapturedRequest>, message?: string, options?: NetworkPollingOptions) {
    const ctrl = new AbortController()
    let request: CapturedRequest | undefined

    await waitFor(
      () => {
        // step 1: check call count
        if (this.interceptor.requests.length !== 1) {
          const base = `Expected mock to be called exactly once, but it was called ${this.interceptor.requests.length} times.`
          const err = new AssertionError(message ? `${message}: ${base}` : base)
          if (this.interceptor.requests.length > 1) {
            ctrl.abort()
          }
          throw err
        }
        // It is to return from the `waitFor` so it won't repeat the check,
        // after we fail (or pass) the second step.
        request = this.interceptor.requests[0]
      },
      ctrl.signal,
      options?.interval
    )

    // step 2: check if the request matches the provided partial request object
    // here the request MUST be set because the above condition is met
    if (!this.#partialMatch(request as CapturedRequest, match)) {
      this.#failMatch(request as CapturedRequest, match, 'Expected request to match properties', message)
    }
  }

  /**
   * Throws an AssertionError configured to show a rich diff between the expected
   * partial request and the actual intercepted request(s).
   */
  #failMatch(
    actual: CapturedRequest | CapturedRequest[],
    expected: Partial<CapturedRequest>,
    defaultMessage: string,
    userMessage?: string
  ): never {
    const message = userMessage ? `${userMessage}: ${defaultMessage}` : defaultMessage
    const err = new AssertionError(message, {
      actual,
      expected,
      showDiff: true,
    })
    throw err
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
