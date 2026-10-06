import { RouteStore } from './route_store.js'
import * as RouteMatcher from './route_matcher.js'
import type { Page, Route } from 'playwright'
import type {
  CapturedRequest,
  NetworkEvaluateResult,
  NetworkRegisterPayload,
  NetworkUnregisterPayload,
  UnmatchedRequest,
} from './types.js'
import debuglog from '../runner/debug.js'

interface RouteFulfillOptions {
  status: number
  headers: Record<string, string>
  body?: string | Buffer
}

/**
 * Handles network mock commands in the Node Playwright process.
 * Manages active route interception, CORS options, and unmatched request observability.
 */
export class NetworkCommand {
  private routeStore = new RouteStore()
  private ignoreCors = false
  private isNetworkMockingEnabled = false
  private unmatchedRequests: UnmatchedRequest[] = []
  private readonly maxUnmatchedRequests = 20

  /**
   * @param page Playwright page to register on
   */
  constructor(private page: Page) {
    this.onRoute = this.onRoute.bind(this)
  }

  /**
   * Whether network mocking is currently active or enabled.
   */
  public get isMockingEnabled(): boolean {
    return this.isNetworkMockingEnabled || this.routeStore.hasRoutes()
  }

  /**
   * Sets whether network mocking is enabled.
   *
   * @param enabled Boolean indicating active mocking status.
   */
  public setMockingEnabled(enabled: boolean): void {
    this.isNetworkMockingEnabled = enabled
  }

  /**
   * Returns a copy of recent unmatched intercepted requests for diagnostics.
   */
  public getUnmatchedRequests(): readonly UnmatchedRequest[] {
    return this.unmatchedRequests
  }

  /**
   * Clears the in-memory ring buffer of unmatched requests for the active test.
   */
  public clearUnmatchedRequests(): void {
    this.unmatchedRequests = []
  }

  /**
   * Handle network:mock:register command
   */
  public async register(payload: NetworkRegisterPayload): Promise<void> {
    this.isNetworkMockingEnabled = true
    const routeDef = RouteMatcher.createRouteDefinition(payload.id, payload.matcher, { lifetime: payload.times })
    this.routeStore.add(routeDef)
  }

  /**
   * Handle network:mock:unregister command
   */
  public async unregister(payload: NetworkUnregisterPayload): Promise<void> {
    this.routeStore.removeById(payload.id)
    if (!this.routeStore.hasRoutes()) {
      this.isNetworkMockingEnabled = false
    }
  }

  /**
   * Set the ignoreCors flag.
   */
  public setIgnoreCors(ignore: boolean): void {
    this.ignoreCors = ignore
  }

  /**
   * Reset the network command state.
   */
  public reset(): void {
    this.routeStore.reset()
    this.unmatchedRequests = []
    this.ignoreCors = false
    this.isNetworkMockingEnabled = false
  }

  /**
   * Records an unmatched request into the fixed-size ring buffer.
   */
  private recordUnmatchedRequest(method: string, url: string, headers: Record<string, string>): void {
    this.unmatchedRequests.push({ method, url, headers })
    if (this.unmatchedRequests.length > this.maxUnmatchedRequests) {
      this.unmatchedRequests.shift()
    }
  }

  /**
   * The actual interceptor that bounces the request down to the browser context
   * for evaluation of any active mocks.
   */
  public async onRoute(route: Route): Promise<void> {
    const request = route.request()
    // We only want to intercept fetch/XHR requests from the tests
    if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
      await route.continue()
      return
    }

    const url = request.url()
    const method = request.method()

    if (this.ignoreCors && method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Expose-Headers': '*',
        },
      })
      return
    }

    const headers = request.headers()
    let body: string | null | undefined = undefined
    let query: Record<string, string | string[]> | undefined = undefined
    let hasFulfilled = false

    for (const { route: matchedRoute, urlMatch } of this.routeStore.findMatches(url, method, headers)) {
      if (body === undefined) {
        body = request.postData()
      }
      if (query === undefined) {
        query = RouteMatcher.extractQueryParameters(url)
      }

      const params = RouteMatcher.extractParams(urlMatch)

      const reqPayload: CapturedRequest = {
        url,
        method,
        headers,
        query,
        params,
        body,
      }

      try {
        const response: NetworkEvaluateResult = await this.page.evaluate(
          (data) => {
            return window.__lupa_evaluate_network_mock_by_id(data.id, data.req)
          },
          { id: matchedRoute.id, req: reqPayload }
        )

        if (response && response.action === 'fulfill') {
          hasFulfilled = true

          if (response.delay) {
            await new Promise((r) => setTimeout(r, response.delay))
          }

          if (response.error) {
            await route.abort(response.error)
            return
          }

          const fulfillPayload: RouteFulfillOptions = {
            status: response.status || 200,
            headers: response.headers || {},
          }

          if (this.ignoreCors) {
            fulfillPayload.headers['Access-Control-Allow-Origin'] = '*'
            fulfillPayload.headers['Access-Control-Expose-Headers'] = '*'
          }

          if (response.body !== undefined && response.body !== null) {
            if (response.isBase64) {
              fulfillPayload.body = Buffer.from(response.body, 'base64')
            } else {
              fulfillPayload.body = response.body
            }
          }

          await route.fulfill(fulfillPayload)
          return
        }
      } catch (err) {
        debuglog('Error evaluating network mock: %O', err)
      }
    }

    if (!hasFulfilled) {
      debuglog('[lupa:network] Unmatched %s request: %s', method, url)
      this.recordUnmatchedRequest(method, url, headers)
    }

    // Fallback if browser says continue or error occurred
    await route.continue()
  }
}
