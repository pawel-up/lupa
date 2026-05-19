import type { CapturedRequest } from './types.js'
import { NetworkAssert } from './network_assert.js'

/**
 * An active network interception object.
 * Provides APIs to assert against captured traffic and manage the mock's lifecycle.
 */
export class NetworkInterceptor {
  /**
   * The complete chronological list of requests captured by this specific interceptor.
   * This is the raw array used internally by `assert` methods.
   *
   * @example
   * ```ts
   * const requests = mock.requests
   * console.log(`Intercepted ${requests.length} requests`)
   * ```
   */
  public requests: CapturedRequest[] = []

  /**
   * Creates a new instance of the NetworkInterceptor.
   *
   * @param id The unique identifier of the interceptor.
   * @param registry The registry that manages the interceptors.
   */
  constructor(
    private id: number,
    private registry: any
  ) {}

  /**
   * Records a captured request.
   *
   * @internal This method is called automatically by the `NetworkRegistry` when a
   * request matches this mock's criteria. You should not call this manually.
   *
   * @param req The captured request to record.
   */
  recordRequest(req: CapturedRequest): void {
    this.requests.push(req)
  }

  /**
   * Retrieves a shallow copy of all tracked requests captured by this interceptor.
   *
   * @warning This is a strictly synchronous method. If called immediately after a UI interaction
   *          that triggers a background network request, it may return an incomplete array.
   *          Always `await` a network assertion (e.g. `mock.assert.called()`) to allow the network
   *          to settle before calling this method.
   *
   * @returns An array of `CapturedRequest` objects in the order they were intercepted.
   *
   * @example
   * ```ts
   * await locator('button').click()
   * await mock.assert.calledOnce() // 1. Wait for request to settle
   *
   * const requests = mock.getRequests() // 2. Safely read snapshot
   * assert.equal(requests[0].method, 'GET')
   * ```
   *
   * @useWhen You need to perform complex manual iterations or custom assertions across the entire request history.
   */
  getRequests(): CapturedRequest[] {
    return [...this.requests]
  }

  /**
   * Retrieves the most recently captured request.
   *
   * @warning This is a strictly synchronous method. If called immediately after a UI interaction,
   *          it may return `undefined` because the background request hasn't been processed yet.
   *          Always `await` a network assertion first.
   *
   * @returns The last `CapturedRequest`, or `undefined` if no requests have been intercepted.
   *
   * @example
   * ```ts
   * await locator('button[type="submit"]').click()
   * await mock.assert.calledOnce() // 1. Wait for request to settle
   *
   * const req = mock.lastRequest() // 2. Safely read snapshot
   * assert.deepEqual(JSON.parse(req!.body as string), { username: 'alice' })
   * ```
   *
   * @useWhen You want to manually assert specific, deeply nested properties of a payload after a sequence of events.
   */
  lastRequest(): CapturedRequest | undefined {
    return this.requests[this.requests.length - 1]
  }

  /**
   * Retrieves the very first captured request.
   *
   * @warning This is a strictly synchronous method. Make sure to `await` a network assertion
   *          first to ensure the network state has settled before reading this value.
   *
   * @returns The first `CapturedRequest`, or `undefined` if no requests have been intercepted.
   *
   * @example
   * ```ts
   * await locator('.load-app').click()
   * await mock.assert.called() // Wait for network
   *
   * const initialLoadReq = mock.firstRequest()
   * assert.equal(initialLoadReq?.query.page, '1')
   * ```
   *
   * @useWhen Inspecting initial load behaviors, such as the first polling request
   *          or an application configuration fetch.
   */
  firstRequest(): CapturedRequest | undefined {
    return this.requests[0]
  }

  /**
   * Manually unregisters this mock, preventing it from intercepting future requests.
   *
   * Note: Mocks are automatically restored at the end of each test by the runner's cleanup hooks.
   * You only need to call this if you want to unregister a mock mid-test.
   *
   * @example
   * ```ts
   * const mock = await network.mock({ match: '/api/user', respond: { status: 500 } })
   * await mock.assert.calledOnce()
   *
   * // Stop simulating the 500 error for the rest of the test
   * await mock.restore()
   * ```
   *
   * @useWhen You need to test fault recovery (e.g. failing a request once, restoring the mock,
   *          and verifying the retry succeeds).
   */
  async restore(): Promise<void> {
    await this.registry.unregister(this.id)
  }

  /**
   * The dedicated assertion API for this network mock.
   * Contains robust, built-in polling methods to prevent flakiness during asynchronous UI updates.
   *
   * @example
   * ```ts
   * await mock.assert.calledOnceWith({ method: 'POST' })
   * ```
   */
  assert = new NetworkAssert(this)
}
