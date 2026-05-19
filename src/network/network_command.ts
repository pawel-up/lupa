import { RouteStore } from './route_store.js'
import * as RouteMatcher from './route_matcher.js'
import type { Page, Route } from 'playwright'
import type {
  CapturedRequest,
  NetworkEvaluateResult,
  NetworkRegisterPayload,
  NetworkUnregisterPayload,
} from './types.js'
import debuglog from '../runner/debug.js'

/**
 * Handles network mock commands.
 */
export class NetworkCommand {
  private routeStore = new RouteStore()

  /**
   * @param page Playwright page to register on
   */
  constructor(private page: Page) {
    this.onRoute = this.onRoute.bind(this)
  }

  /**
   * Handle network:mock:register command
   */
  public async register(payload: NetworkRegisterPayload): Promise<void> {
    const routeDef = RouteMatcher.createRouteDefinition(payload.id, payload.matcher, { lifetime: payload.times })
    this.routeStore.add(routeDef)
  }

  /**
   * Handle network:mock:unregister command
   */
  public async unregister(payload: NetworkUnregisterPayload): Promise<void> {
    this.routeStore.removeById(payload.id)
  }

  /**
   * Reset the network command.
   */
  public reset() {
    this.routeStore.reset()
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
    const headers = request.headers()
    let body: string | null | undefined = undefined
    let query: Record<string, string | string[]> | undefined = undefined

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
          if (response.delay) {
            await new Promise((r) => setTimeout(r, response.delay))
          }

          if (response.error) {
            await route.abort(response.error)
            return
          }

          const fulfillPayload: any = {
            status: response.status || 200,
            headers: response.headers || {},
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

    // Fallback if browser says continue or error occurred
    await route.continue()
  }
}
