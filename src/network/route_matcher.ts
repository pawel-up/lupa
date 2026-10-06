import type { RouteDefinition, SerializedMatch } from './types.js'

/**
 * Compiles a URLPattern from a SerializedMatch definition.
 *
 * Handles relative URIs by splitting query parameters on `?`, ensuring that
 * RFC 3986 / WHATWG URLPattern constraints are respected and query wildcards
 * are preserved by default.
 *
 * @param matcher The serialized matcher configuration.
 * @returns Compiled URLPattern instance, or undefined if no path/URI criteria are defined.
 */
function compileUrlPattern(matcher: SerializedMatch): URLPattern | undefined {
  if (matcher.pathname !== undefined || matcher.search !== undefined) {
    let pathname = matcher.pathname
    let search = matcher.search

    if (pathname !== undefined) {
      const qIndex = pathname.indexOf('?')
      if (qIndex !== -1) {
        if (search === undefined) {
          search = pathname.slice(qIndex + 1) || '*'
        }
        pathname = pathname.slice(0, qIndex)
      }
      if (pathname.startsWith('*/')) {
        pathname = pathname.substring(1)
      } else if (!pathname.startsWith('/')) {
        pathname = '/' + pathname
      }
    } else if (matcher.uri) {
      if (matcher.uri.startsWith('http')) {
        const urlObj = new URL(matcher.uri)
        pathname = urlObj.pathname
        if (search === undefined) {
          search = urlObj.search ? urlObj.search.slice(1) : '*'
        }
      } else {
        const cleanUri = matcher.uri.startsWith('*/')
          ? matcher.uri.substring(1)
          : matcher.uri.startsWith('/')
            ? matcher.uri
            : '/' + matcher.uri
        const qIndex = cleanUri.indexOf('?')
        if (qIndex !== -1) {
          pathname = cleanUri.slice(0, qIndex)
          if (search === undefined) {
            search = cleanUri.slice(qIndex + 1) || '*'
          }
        } else {
          pathname = cleanUri
          if (search === undefined) {
            search = '*'
          }
        }
      }
    }

    if (search === undefined) {
      search = '*'
    }

    return new URLPattern({
      ...(pathname !== undefined ? { pathname } : {}),
      search,
    })
  }

  if (!matcher.uri) {
    return undefined
  }

  const uri = matcher.uri

  if (uri.startsWith('http')) {
    return new URLPattern(uri)
  }

  if (uri === '**' || uri === '*') {
    return new URLPattern({ pathname: '/*', search: '*' })
  }

  const cleanUri = uri.startsWith('*/') ? uri.substring(1) : uri.startsWith('/') ? uri : '/' + uri
  const qIndex = cleanUri.indexOf('?')

  if (qIndex !== -1) {
    const pathname = cleanUri.slice(0, qIndex)
    const search = cleanUri.slice(qIndex + 1) || '*'
    return new URLPattern({ pathname, search })
  }

  return new URLPattern({ pathname: cleanUri, search: '*' })
}

/**
 * Builds a URLPattern safely with clear error messaging if pattern syntax is invalid.
 *
 * @param matcher The serialized route matcher.
 * @returns The compiled URLPattern or undefined.
 */
function buildPattern(matcher: SerializedMatch): URLPattern | undefined {
  try {
    return compileUrlPattern(matcher)
  } catch (error) {
    const target = matcher.uri ?? matcher.pathname ?? ''
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to construct URLPattern for route "${target}": ${msg}`, { cause: error })
  }
}

/**
 * Normalizes HTTP methods to uppercase.
 *
 * @param rawMethods Raw method strings.
 * @returns Uppercase HTTP method array.
 */
function normalizeMethods(rawMethods?: string[]): string[] {
  return (rawMethods || []).map((m) => m.toUpperCase())
}

/**
 * Normalizes request headers to lowercase keys.
 *
 * @param rawHeaders Raw headers dictionary.
 * @returns Lowercase headers dictionary.
 */
function normalizeHeaders(rawHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {}
  if (rawHeaders) {
    for (const [k, v] of Object.entries(rawHeaders)) {
      headers[k.toLowerCase()] = v
    }
  }
  return headers
}

/**
 * Creates a RouteDefinition from a serialized matcher and options.
 *
 * Note: Lupa includes convenience handling for glob-like URIs starting with `*\/` or `**`.
 * In standard URLPattern, a prefix like `*\/foo` expects at least one character before `/foo`.
 * To mimic traditional glob matching (e.g. matching any domain), Lupa strips the leading `*`
 * from `*\/foo` and evaluates it as the pathname `/foo`, which correctly matches requests
 * regardless of their origin.
 *
 * @param id Unique route identifier.
 * @param matcher Serialized matching options.
 * @param options Additional options such as lifetime.
 * @returns A compiled RouteDefinition ready for registration.
 *
 * @example
 * ```ts
 * const route = createRouteDefinition(1, { type: 'options', uri: '/api/data?*' }, { lifetime: 1 })
 * ```
 */
export function createRouteDefinition(
  id: number,
  matcher: SerializedMatch,
  options: { lifetime?: number }
): RouteDefinition {
  const pattern = buildPattern(matcher)
  const methods = normalizeMethods(matcher.methods)
  const headers = normalizeHeaders(matcher.headers)

  return {
    id,
    pattern,
    methods,
    headers,
    query: matcher.query,
    lifetime: options.lifetime,
    usageCount: 0,
  }
}

/**
 * Extracts route parameters from a URLPattern match, including pathname and search parameter groups.
 *
 * @param urlMatch Result returned by URLPattern.exec()
 * @returns Dictionary of extracted named route parameters.
 *
 * @example
 * ```ts
 * const params = extractParams(pattern.exec(url))
 * ```
 */
export function extractParams(urlMatch?: URLPatternResult): Record<string, string> {
  const params: Record<string, string> = {}

  const collectNamedGroups = (groups?: Record<string, string | undefined>): void => {
    if (!groups) return
    for (const [key, value] of Object.entries(groups)) {
      if (value !== undefined && !/^\d+$/.test(key)) {
        params[key] = value
      }
    }
  }

  collectNamedGroups(urlMatch?.pathname?.groups)
  collectNamedGroups(urlMatch?.search?.groups)

  return params
}

/**
 * Extracts query parameters from a URL.
 *
 * @param url Full or relative URL to parse.
 * @returns Key-value mapping of query parameters, with repeated keys mapped to arrays.
 *
 * @example
 * ```ts
 * const params = extractQueryParameters('https://example.com/api?tag=a&tag=b')
 * // { tag: ['a', 'b'] }
 * ```
 */
export function extractQueryParameters(url: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}

  try {
    const urlObj = new URL(url, 'http://localhost')
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
    // Handle parsing errors
  }

  return params
}
