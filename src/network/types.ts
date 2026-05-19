/**
 * Supported HTTP methods for network request matching.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'ANY'

/**
 * Represents a network request captured by the browser interceptor.
 * This structure is passed to dynamic response closures and used for assertions.
 */
export interface CapturedRequest {
  /** The full URL of the captured request. */
  url: string
  /** The HTTP method used for the request (e.g., GET, POST). */
  method: string
  /** A dictionary of all HTTP headers sent with the request. */
  headers: Record<string, string>
  /** A dictionary of the parsed query string parameters. */
  query: Record<string, string>
  /** The parsed request body (decoded from base64 if it was postData). */
  body: string | ArrayBuffer | null
  /** The raw base64-encoded postData directly from Playwright (if applicable). */
  postData?: string | null
}

/**
 * Options to strictly match a request by its URI and optionally its HTTP method.
 */
export interface RequestMatchOptions {
  /** The URI to match. Supports plain strings or patterns with `:` and `*` wildcards. */
  uri: string
  /** Optional HTTP method to strictly enforce when matching. */
  method?: HttpMethod
}

/**
 * Criteria used to determine if a mock should intercept a given request.
 * Can be a plain string (substring match or pattern), a RegExp, or strict RequestMatchOptions.
 */
export type NetworkMatch = string | RegExp | RequestMatchOptions

/**
 * The static payload definition used to fulfill an intercepted request.
 */
export interface NetworkRespondPayload {
  /** HTTP status code to return (e.g., 200, 404). Default is 200. */
  status?: number
  /** HTTP headers to send back with the response. */
  headers?: Record<string, string>
  /** The response body. Can be a string, an ArrayBuffer (for binary data), or null. */
  body?: string | ArrayBuffer | null
  /** Milliseconds to delay the response fulfillment. Useful for simulating latency. */
  delay?: number
  /** Triggers a network-level error matching the specified Playwright error string. */
  error?:
    | 'aborted'
    | 'accessdenied'
    | 'addressunreachable'
    | 'blockedbyclient'
    | 'blockedbyresponse'
    | 'connectionaborted'
    | 'connectionclosed'
    | 'connectionfailed'
    | 'connectionrefused'
    | 'connectionreset'
    | 'internetdisconnected'
    | 'namenotresolved'
    | 'timedout'
    | 'failed'
}

/**
 * A closure function that executes dynamically when a matching request is intercepted.
 * It receives the `CapturedRequest` and must return either a response payload, a promise of a payload,
 * or the `bypass` symbol to explicitly skip mocking and fall through to the real network.
 */
export type NetworkRespondDynamic = (
  req: CapturedRequest
) => NetworkRespondPayload | Promise<NetworkRespondPayload> | symbol | null | undefined

/**
 * The configuration object used to register a new network mock.
 */
export interface NetworkMockOptions {
  /** The criteria used to match requests against this mock. */
  match: NetworkMatch
  /** The static payload or dynamic closure used to fulfill the matched request. */
  respond: NetworkRespondPayload | NetworkRespondDynamic
  /**
   * The number of times this mock should intercept a request before expiring.
   * If omitted, the mock persists for the lifetime of the test unless explicitly restored.
   */
  times?: number
}

/**
 * The serialized result returned from the Node environment to the Browser environment
 * after evaluating all active network mocks against an intercepted request.
 */
export type NetworkEvaluateResult =
  | { action: 'continue' }
  | {
      action: 'fulfill'
      status: number
      headers: Record<string, string>
      body: string | null
      isBase64: boolean
      delay?: number
      error?: string
    }
