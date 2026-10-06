# Network Mocking

Lupa provides powerful, native network interception out of the box. Because Lupa executes your tests within a real browser via **Playwright**, there is no "magic" involved—no monkey-patching of `fetch` or overriding `XMLHttpRequest`. The interception happens at the browser's network layer. This means any request made by your component, a third-party script, or an iframe can be seamlessly intercepted.

## Basic Mocking

You can mock network traffic by accessing the `network` fixture within your test context. The `network.mock()` method takes a URL pattern and a response payload, and instructs the browser to fulfill any matching requests with that payload.

Here is a basic example of mocking a successful `200 OK` response:

```ts
import { test, fixture, html } from '@pawel-up/lupa/testing'

test('loads and displays user data', async ({ assert, network }) => {
  // 1. Setup the network mock
  await network.mock('/api/users/1', {
    status: 200,
    body: JSON.stringify({ id: 1, name: 'Alice', role: 'admin' }),
    headers: { 'Content-Type': 'application/json' }
  })

  // 2. Mount the component that fires the request
  await fixture(html`<user-profile user-id="1"></user-profile>`)

  // 3. Assert on the DOM
  assert.dom.hasText(document.querySelector('.user-name'), 'Alice')
})
```

### Mocking Network Errors

Because Lupa controls the underlying browser network layer, you can simulate hard network failures by passing the `error` property. This property accepts standard Playwright error strings (e.g., `'internetdisconnected'`, `'connectionrefused'`, `'timedout'`, `'aborted'`). The `network.error` enum provides a convenient way to access these error strings. This is invaluable for testing your application's offline or error-boundary states:

```ts
import { test, fixture, html } from '@pawel-up/lupa/testing'

test('displays offline fallback when network drops', async ({ assert, network }) => {
  // Mock a hard network failure
  await network.mock('/api/users/1', {
    error: network.error.ConnectionFailed
  })

  await fixture(html`<user-profile user-id="1"></user-profile>`)

  assert.dom.isVisible(document.querySelector('.offline-banner'))
})
```

## Bypassing CORS

When writing integration tests that mock cross-origin requests (e.g., testing SDKs or UI components that talk to remote APIs), you may encounter browser-level **Cross-Origin Resource Sharing (CORS)** errors. Even if you mock the API endpoint using `network.mock()`, the browser may still block the request or hide custom response headers if the mock does not explicitly include the proper CORS headers.

To solve this, Lupa provides the `network.ignoreCors()` method. This instructs the network interceptor to automatically bypass CORS enforcement for the duration of the test.

```ts
test('ignores CORS and reads custom headers', async ({ network, assert }) => {
  // 1. Enable CORS bypass for this test
  await network.ignoreCors()

  // 2. Mock a cross-origin API
  await network.mock('https://example.com/api/data', {
    status: 200,
    headers: { 'x-custom-id': '123' },
    body: JSON.stringify({ success: true })
  })

  // 3. Fetch from a different origin
  const res = await fetch('https://example.com/api/data')
  
  // Custom headers are fully exposed to the client!
  assert.equal(res.headers.get('x-custom-id'), '123')
})
```

### How it works

When you call `network.ignoreCors()`, Lupa applies two automatic behaviors at the browser's network layer:

1. **Preflight Interception**: All HTTP `OPTIONS` requests are automatically intercepted and fulfilled with a `204 No Content` status and permissive `Access-Control` headers.
2. **Response Header Injection**: All responses fulfilled by your network mocks automatically receive `Access-Control-Allow-Origin: *` and `Access-Control-Expose-Headers: *` headers. This ensures the browser allows your application code to read both the body and any custom headers from the mocked response.

Like all network settings in Lupa, the CORS bypass is **strictly isolated** to the current test. When the test completes, the CORS bypass state is automatically reset, preventing any configuration leakage into subsequent tests.

## Asserting on Network Traffic

Lupa provides a suite of assertions to verify that your mocks were hit exactly as expected. Because network requests originate in the browser but your tests run in Node.js, Lupa has to ferry this data across an asynchronous boundary.

To handle this, Lupa's network assertions automatically **poll** the browser until the condition is met (or until a timeout occurs). The available assertions are:
- `await mock.assert.calledOnce()`
- `await mock.assert.calledTimes(n)`
- `await mock.assert.notCalled()`

### The Golden Rule: Action ➔ Await Assert ➔ Read Snapshot

Once you verify the request happened, you often want to inspect *what* was sent (the body, headers, or query parameters). You can do this using synchronous getters like `mock.lastRequest()`. 

However, because these getters return an immediate, synchronous snapshot of the current state, **you must always `await` an assertion before reading the request**. If you try to read it immediately after mounting a component, the request likely hasn't finished crossing the browser-to-Node RPC boundary yet, resulting in missing or stale data.

#### ❌ The Wrong Way (Race Condition)

```ts
test('submits form', async ({ assert, network }) => {
  const mock = await network.mock('/api/submit', { status: 200 })
  
  // 1. Action
  await fixture(html`<my-form></my-form>`)
  
  // 2. Read (DANGER! The request might not have settled yet)
  const req = mock.lastRequest() // Likely returns undefined!
  
  // 3. Assert
  assert.equal(req?.body, '{"name":"Alice"}') 
})
```

#### ✅ The Right Way

```ts
test('submits form', async ({ assert, network }) => {
  const mock = await network.mock('/api/submit', { status: 200 })
  
  // 1. Action
  await fixture(html`<my-form></my-form>`)
  
  // 2. Await Assert (Guarantees the network layer has settled)
  await mock.assert.calledOnce()
  
  // 3. Read Snapshot (Now 100% safe to read)
  const req = mock.lastRequest()
  
  assert.equal(req?.method, 'POST')
  assert.deepEqual(JSON.parse(req?.body as string), { name: 'Alice' })
})
```

When you read the captured request using `lastRequest()`, `firstRequest()`, or `getRequests()`, you receive a `CapturedRequest` object. It's important to understand its shape:
- `body`: Returned as a raw `string` or `ArrayBuffer` (Lupa does *not* auto-deserialize JSON payloads, so you must call `JSON.parse(req.body)` yourself if it's a JSON request).
- `query`: A parsed JavaScript object (`Record<string, string | string[]>`) representing the URL query parameters. Multiple parameters with the same name (e.g., `?filter=a&filter=b`) are grouped into an array.
- `params`: A parsed JavaScript object (`Record<string, string>`) containing any path variables extracted via `URLPattern` (e.g., `:id`).
- `headers`: A parsed JavaScript object (`Record<string, string>`) of all request headers.

## Request Matching

Lupa gives you flexible ways to define which network requests your mock should intercept. You can pass a plain string (with glob support or URLPattern path variables), or an explicit configuration object.

> [!NOTE]
> **Mock Precedence:** If multiple active mocks match the same request (e.g., `/api/*/users` vs `/api/v1/users`), the **most recently registered mock** takes precedence and will handle the request.

### Substring & Glob Matching
By default, passing a string will match any request URL that contains that substring. It also supports standard Playwright glob wildcards (like `*` for single path segments or `**` for deep globbing). Note that wildcard captures cannot be extracted as variables later; they simply allow the request to match.

> [!NOTE]
> **URI Matching Caveat**: Lupa uses the standard `URLPattern` API under the hood. In `URLPattern`, a wildcard prefix like `/*/foo` expects *at least one character* before `/foo`. For convenience and to mimic traditional glob behavior (e.g. ignoring the domain), Lupa will automatically strip a leading `*` from paths that start with `*/`. Thus, `match: '*/api/users/:id'` behaves identically to `match: '/api/users/:id'`, effectively intercepting requests to that path regardless of the domain or origin. Furthermore, `**` or `*` alone are automatically translated to `/*` to match any path.

```ts
// Matches /api/v1/users, /api/v2/users, etc.
await network.mock('/api/*/users', { status: 200 })
```

### Strict Method Matching
If you need to mock a specific HTTP method (e.g., distinguishing a `GET` from a `POST` to the exact same endpoint), you can pass a configuration object instead of a string:

```ts
await network.mock(
  { uri: '/api/submit', method: 'POST' },
  { status: 201 }
)
```

### URLPattern & Path Variables
For dynamic endpoints, Lupa uses standard `URLPattern` matching under the hood. This means you can use path variables (like `:id`) directly in your mock string! The matched variables will be automatically extracted and made available on the `req.params` object:

```ts
// Matches /api/users/123, /api/users/999
await network.mock('/api/users/:id', async (req) => {
  return { 
    status: 200, 
    body: JSON.stringify({ userId: req.params?.id }) 
  }
})
```

### Query Strings & Relative URIs
You can include query strings directly in your relative mock paths:

- **Omitted queries match any**: Paths without query parameters (e.g. `'/api/data'`) match requests with or without query strings (`/api/data` and `/api/data?foo=bar`).
- **Exact queries**: Paths with specific query parameters (e.g. `'/api/users?status=active'`) only intercept matching requests, letting non-matching requests fall through.
- **Wildcard queries**: Use wildcard patterns like `'/api/history?*'` to explicitly match any query parameters.

```ts
// Matches both /api/items and /api/items?sort=desc
await network.mock('/api/items', { status: 200, body: '[]' })

// Matches /api/history with any query parameter
await network.mock('/api/history?*', { status: 200, body: '[]' })

// Matches specifically ?status=active
await network.mock('/api/users?status=active', { 
  status: 200, 
  body: JSON.stringify([{ id: 1, name: 'Active User' }]) 
})
```

### Declarative Match Options
In addition to string URIs, `network.mock()` accepts a declarative `RequestMatchOptions` object for fine-grained control:

```ts
export interface RequestMatchOptions {
  /** The URI or pathname pattern to match. */
  uri?: string
  /** Explicit pathname pattern. */
  pathname?: string
  /** Explicit search query pattern (e.g. '*' or 'sort=:sort'). */
  search?: string
  /** Declarative query parameter key-value pairs to match against parsed URL parameters. */
  query?: Record<string, string | string[]>
  /** HTTP methods to match (e.g. ['GET', 'POST']). */
  methods?: HttpMethod[]
  /** Required headers to match. */
  headers?: Record<string, string>
}
```

This allows you to match query parameters without manual string concatenation or regex formatting:

```ts
// Match using declarative query key-value pairs
await network.mock(
  {
    uri: '/api/users',
    query: { role: 'admin', active: 'true' },
    methods: ['GET'],
  },
  {
    status: 200,
    body: JSON.stringify([{ id: 1, role: 'admin' }]),
  }
)

// Match with explicit search wildcard
await network.mock(
  { pathname: '/api/search', search: '*' },
  { status: 200, body: JSON.stringify({ results: [] }) }
)
```

> [!NOTE]
> **Query Parameter Matching Semantics**
> - **Subset matching**: Single key-value pairs (e.g. `{ role: 'admin' }`) act as subset filters; additional query parameters on the request URL (e.g. `?role=admin&page=1`) do not invalidate the match.
> - **Multi-value parameters**: When an array is provided (e.g. `{ tags: ['admin', 'staff'] }`), Lupa enforces exact set equality across all values for that key.

## Teardown & Lifecycle

### Automatic Test Isolation
One of the core design principles of Lupa is **strict test isolation**. You do **not** need to manually clean up your network mocks at the end of a test.

When a test finishes (whether it passes or fails), Lupa's test runner automatically intercepts the teardown phase, clears all active mocks, and restores the browser's network layer to its default state for the next test.

### Manual Restoration
If you need to test a complex scenario—such as an API endpoint suddenly becoming unavailable mid-session—you can manually disable a specific mock at any time:

```ts
test('handles intermittent API failure', async ({ network }) => {
  const mock = await network.mock('/api/data', { status: 200 })
  
  // Triggers successful fetch
  await fixture(html`<data-loader></data-loader>`) 

  // Restore the original network behavior (removes the mock)
  await mock.restore()

  // Triggers actual network call (or a different mock)
  await document.querySelector('data-loader').refetch()
})
```

### The `times` Parameter
Sometimes you only want to mock an endpoint for the first few requests, allowing subsequent requests to fall through to the real network (or be caught by a different mock). You can achieve this using the `times` configuration option:

```ts
// Only mock the FIRST request to /api/data.
// The second request will bypass this mock.
await network.mock('/api/data', { status: 200 }, { times: 1 })
```

### Explicit Bypass
If your mock handler needs to dynamically decide whether to mock a request or let it fall through to the next available mock (or the real network), you can explicitly return `network.bypass` from your handler function. This is especially useful for selectively mocking requests based on headers, body content, or query parameters:

```ts
test('handles intermittent API failure', async ({ network }) => {
  await network.mock('/api/users', async ({ query }) => {
    // Only mock requests that ask for the admin user
    if (query?.role === 'admin') {
      return { status: 200, body: '{"name":"Admin"}' }
    }
    
    // Let everything else fall through to the real network
    return network.bypass
  })
})
```

## Debugging & Observability

Network tests can sometimes time out or fail when requests do not match any configured mocks. Lupa provides built-in observability to eliminate guesswork and make debugging straightforward.

### Diagnostic Logging
Lupa emits diagnostic logs for intercepted network activity. To inspect unmatched requests in real-time, run your tests with the `DEBUG` environment variable set:

```bash
DEBUG="lupa:network" npx lupa test
```

When an intercepted request falls through without matching an active mock, Lupa outputs:
```text
[lupa:network] Unmatched GET request: /api/users?status=pending
```

### Unmatched Requests in Test Failure Output
When a test times out and network mocking was active, Lupa automatically inspects its in-memory ring buffer of unhandled requests for that test. If any unmatched requests were captured, Lupa appends them directly to the test error message:

```text
Error: Test timed out after 5000ms.

Recent unmatched network requests (2):
  • GET /api/users?status=pending
  • POST /api/analytics
```

This immediately pinpoints whether a component fired a request with unexpected query parameters, headers, or paths, allowing you to update your mocks without digging through verbose network traces.
