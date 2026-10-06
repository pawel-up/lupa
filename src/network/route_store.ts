import type { RouteDefinition, MatchedRoute } from './types.js'
import { extractQueryParameters } from './route_matcher.js'

/**
 * LIFO stack for storing route definitions in the Node Playwright process.
 * Evaluates route patterns, HTTP methods, headers, and query parameters.
 */
export class RouteStore {
  private routes: RouteDefinition[] = []

  /**
   * Total number of active routes currently in the store.
   */
  get count(): number {
    return this.routes.length
  }

  /**
   * Returns true if there is at least one active route registered.
   */
  hasRoutes(): boolean {
    return this.routes.length > 0
  }

  /**
   * Adds a route to the top of the stack (LIFO).
   *
   * @param route The RouteDefinition to register.
   */
  add(route: RouteDefinition): void {
    this.routes.unshift(route)
  }

  /**
   * Yields all matching routes for a request, allowing fallback support.
   *
   * @param url The full URL of the intercepted request.
   * @param method The HTTP method of the request.
   * @param headers Request headers dictionary.
   * @returns Generator yielding matched routes alongside their URLPattern match results.
   */
  *findMatches(url: string, method: string, headers: Record<string, string>): Generator<MatchedRoute> {
    let requestQuery: Record<string, string | string[]> | undefined

    for (let i = 0; i < this.routes.length; i++) {
      const route = this.routes[i]

      // Check if route has expired
      if (route.lifetime !== undefined && route.usageCount >= route.lifetime) {
        this.routes.splice(i, 1)
        i--
        continue
      }

      let urlMatch: URLPatternResult | undefined = undefined

      // Match URL pattern
      if (route.pattern) {
        urlMatch = route.pattern.exec(url) || undefined
        if (!urlMatch) continue
      }

      // Match method
      if (route.methods && route.methods.length > 0 && !route.methods.includes(method.toUpperCase())) {
        continue
      }

      // Match headers
      if (route.headers && !this.headersMatch(headers, route.headers)) {
        continue
      }

      // Match query parameters
      if (route.query) {
        if (requestQuery === undefined) {
          requestQuery = extractQueryParameters(url)
        }
        if (!this.queryMatches(requestQuery, route.query)) {
          continue
        }
      }

      // Found a match - increment usage
      route.usageCount++

      // If it reached lifetime, remove it now so future checks don't see it
      if (route.lifetime !== undefined && route.usageCount >= route.lifetime) {
        this.routes.splice(i, 1)
        i--
      }

      yield { route, urlMatch }
    }
  }

  /**
   * Removes a route by its ID.
   *
   * @param id The unique identifier of the route to remove.
   */
  removeById(id: number): void {
    this.routes = this.routes.filter((route) => route.id !== id)
  }

  /**
   * Clears all routes from the store.
   */
  reset(): void {
    this.routes = []
  }

  /**
   * Checks if request headers match required headers.
   */
  private headersMatch(requestHeaders: Record<string, string>, requiredHeaders: Record<string, string>): boolean {
    const normalizedReqHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(requestHeaders)) {
      normalizedReqHeaders[key.toLowerCase()] = value
    }

    for (const [key, value] of Object.entries(requiredHeaders)) {
      if (normalizedReqHeaders[key.toLowerCase()] !== value) {
        return false
      }
    }
    return true
  }

  /**
   * Verifies if request query parameters satisfy required route query criteria.
   *
   * Scalar expected values act as subset filters allowing extra query parameters on the request URL.
   * Array expected values enforce exact set equality for that key across all values.
   */
  private queryMatches(
    requestQuery: Record<string, string | string[]>,
    requiredQuery: Record<string, string | string[]>
  ): boolean {
    for (const [key, expectedVal] of Object.entries(requiredQuery)) {
      const actualVal = requestQuery[key]
      if (actualVal === undefined) {
        return false
      }

      if (Array.isArray(expectedVal)) {
        const stringExpected = expectedVal.map((v) => String(v))
        if (Array.isArray(actualVal)) {
          if (stringExpected.length !== actualVal.length) {
            return false
          }
          const sortedExpected = [...stringExpected].sort()
          const sortedActual = [...actualVal].sort()
          if (!sortedExpected.every((v, i) => v === sortedActual[i])) {
            return false
          }
        } else {
          if (stringExpected.length === 1 && stringExpected[0] === actualVal) {
            continue
          }
          return false
        }
      } else {
        const stringExpected = String(expectedVal)
        if (Array.isArray(actualVal)) {
          if (actualVal.length === 1 && actualVal[0] === stringExpected) {
            continue
          }
          return false
        } else if (actualVal !== stringExpected) {
          return false
        }
      }
    }
    return true
  }
}
