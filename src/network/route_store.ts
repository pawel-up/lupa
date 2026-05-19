import type { RouteDefinition, MatchedRoute } from './types.js'

/**
 * LIFO stack for storing route definitions in the Node Playwright process.
 * Adapted from AMW RouteStore.
 */
export class RouteStore {
  private routes: RouteDefinition[] = []

  /**
   * Adds a route to the top of the stack (LIFO).
   */
  add(route: RouteDefinition): void {
    this.routes.unshift(route)
  }

  /**
   * Yields all matching routes for a request, allowing fallback support.
   */
  *findMatches(url: string, method: string, headers: Record<string, string>): Generator<MatchedRoute> {
    for (let i = 0; i < this.routes.length; i++) {
      const route = this.routes[i]

      // Check if route has expired
      if (route.lifetime !== undefined && route.usageCount >= route.lifetime) {
        this.routes.splice(i, 1)
        i--
        continue
      }

      let urlMatch: any = undefined

      // Match URL pattern
      if (route.pattern) {
        urlMatch = route.pattern.exec(url)
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
   */
  removeById(id: number): void {
    this.routes = this.routes.filter((route) => route.id !== id)
  }

  /**
   * Clears all routes.
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
}
