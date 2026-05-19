import type { RouteDefinition, SerializedMatch } from './types.js'

/**
 * Creates a RouteDefinition from a serialized matcher and options.
 *
 * Note: Lupa includes convenience handling for glob-like URIs starting with `*\/` or `**`.
 * In standard URLPattern, a prefix like `*\/foo` expects at least one character before `/foo`.
 * To mimic traditional glob matching (e.g. matching any domain), Lupa strips the leading `*`
 * from `*\/foo` and evaluates it as the pathname `/foo`, which correctly matches requests
 * regardless of their origin.
 */
export function createRouteDefinition(
  id: number,
  matcher: SerializedMatch,
  options: { lifetime?: number }
): RouteDefinition {
  let pattern: URLPattern | undefined

  if (matcher.uri) {
    const uri = matcher.uri
    try {
      // We assume the URI is just a pathname if it starts with /, or a full URL.
      if (uri.startsWith('/')) {
        pattern = new URLPattern({ pathname: uri })
      } else if (uri.startsWith('http')) {
        pattern = new URLPattern(uri)
      } else if (uri.startsWith('*/')) {
        pattern = new URLPattern({ pathname: uri.substring(1) })
      } else if (uri === '**' || uri === '*') {
        pattern = new URLPattern({ pathname: '/*' })
      } else {
        pattern = new URLPattern({ pathname: '/' + uri })
      }
    } catch {
      // Provide a generic fallback URLPattern if invalid
      pattern = new URLPattern({ pathname: uri.startsWith('*/') ? uri.substring(1) : uri })
    }
  }

  const methods = (matcher.methods || []).map((m) => m.toUpperCase())

  // Normalize headers (lowercase keys)
  const headers: Record<string, string> = {}
  if (matcher.headers) {
    for (const [k, v] of Object.entries(matcher.headers)) {
      headers[k.toLowerCase()] = v
    }
  }

  return {
    id,
    pattern,
    methods,
    headers,
    lifetime: options.lifetime,
    usageCount: 0,
  }
}

/**
 * Extracts route parameters from a URLPattern match.
 */
export function extractParams(urlMatch?: any): Record<string, string> {
  const params: Record<string, string> = {}

  if (urlMatch && urlMatch.pathname && urlMatch.pathname.groups) {
    Object.assign(params, urlMatch.pathname.groups)
  }

  return params
}

/**
 * Extracts query parameters from a URL.
 */
export function extractQueryParameters(url: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}

  try {
    const urlObj = new URL(url)
    for (const [key, value] of urlObj.searchParams.entries()) {
      const existing = params[key]
      if (existing !== undefined) {
        if (Array.isArray(existing)) {
          existing.push(value)
        } else {
          params[key] = [existing as string, value]
        }
      } else {
        params[key] = value
      }
    }
  } catch {
    // Handle relative URLs or parsing errors
  }

  return params
}
