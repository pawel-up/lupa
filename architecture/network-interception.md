# Network Interception Architecture

This document describes the architecture and API design for Lupa's Network Interception module. 

## 1. Architectural Strategy: The Bridge

Because Lupa executes tests **inside the browser context**, we face a unique challenge:
1. Playwright's robust `page.route()` API executes in the **Node.js context**.
2. Developers want to write dynamic mock responses using **Browser context closures** (e.g., accessing variables defined inside their test).
3. Service Worker libraries (like MSW or `amw`) execute in the browser, but introduce massive friction (requiring physical `sw.js` files, HTTPS, and complex caching lifecycles).

### The Solution: Node-to-Browser RPC Routing

To provide the DX of closures without the friction of Service Workers, Lupa will use a bidirectional RPC bridge:

1. **Registration (Browser ➡️ Node):** 
   When `network.mock({ match: '/api/data' })` is called, the browser stores the handler function in a local registry and sends an RPC command to Node to register a `page.route('/api/data')`.
2. **Evaluation (Node ➡️ Browser ➡️ Node):**
   When the browser makes a request, Playwright intercepts it in Node. Node pauses the request and uses `page.evaluate()` to send the request data back into the browser. 
3. **Execution:**
   The browser executes the user's dynamic `body: (req) => ...` closure, increments assertion counters, and returns the response payload back to Node (encoding binary data as Base64).
4. **Fulfillment:**
   Node receives the payload and calls `route.fulfill()`.

This guarantees **zero setup** for the developer, perfect **CORS bypassing**, and full support for **local closures**.

---

## 2. The API Design

The API focuses on predictability and ergonomics. It is exposed via the `network` fixture.

### Basic Mocking

```typescript
test('should mock a network request', async ({ network }) => {
  const mock = await network.mock({
    match: '/api/users/:id', // Natively supports params and globs
    respond: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '123', name: 'John Doe' }) // Must explicitly serialize to string
    }
  })

  // The mock is active until the end of the test.
})
```

### Dynamic Responses & Closures

All response properties can be functions that resolve dynamically. Because of the bridge architecture, these functions have full access to your test's closure scope:

```typescript
test('should mock dynamically', async ({ network, assert }) => {
  let counter = 0;
  
  await network.mock({
    match: { uri: '/api/counter', method: 'POST' },
    respond: async (req) => {
      counter++;
      return {
        status: 201,
        body: JSON.stringify({ count: counter, token: req.headers.authorization })
      }
    }
  })

  await fetch('/api/counter', { method: 'POST' });
  assert.equal(counter, 1);
})
```

### Transient Mocks (Lifetimes)

Limit how many times a handler can be used before falling back to the network or a lower-priority mock:

```typescript
test('transient mocks', async ({ network }) => {
  await network.mock({
    match: '/api/data',
    respond: { status: 500 },
    times: 1 // Only applies to the first request
  })

  await fetch('/api/data'); // 500
  await fetch('/api/data'); // Goes to real network (or next matching mock)
})
```

### Simulating Network Errors

```typescript
test('simulates offline/timeout', async ({ network }) => {
  await network.mock({
    match: '/api/timeout',
    respond: { error: 'timeout' } // 'timeout', 'offline', 'aborted'
  });

  await fetch('/api/timeout'); // Throws TypeError: Failed to fetch
})
```

### Network Delays (Testing Loading States)

Simulate slow network conditions to test loading spinners or skeleton loaders:

```typescript
test('simulates slow network', async ({ network }) => {
  await network.mock({
    match: '/api/data',
    respond: {
      delay: 2000, // Delays the response by 2000ms
      status: 200,
      body: '{"status": "ok"}'
    }
  });
})
```

### Bypassing & GraphQL Support

Sometimes you want to intercept a route (like a single `/graphql` endpoint) but only mock *specific* queries, letting others pass through to the real network. 

To explicitly bypass a mock and fall through to the real network (or the next registered mock), return the special `network.bypass` symbol. Returning `undefined` for the body simply means "respond with an empty body", whereas `network.bypass` aborts the mock entirely.

```typescript
test('mocks specific graphql query', async ({ network }) => {
  await network.mock({
    match: { uri: '/graphql', method: 'POST' },
    respond: async (req) => {
      // Parse the GraphQL request body
      const body = JSON.parse(req.body as string);
      
      if (body.operationName !== 'GetUsers') {
        // Explicitly bypass this mock and fall back to the real network
        return network.bypass;
      }
      
      return {
        status: 200,
        body: JSON.stringify({ data: { users: [] } })
      }
    }
  })
})
```

### Binary Data Support

Return binary data natively. The bridge will transparently Base64 encode it for Node, and Node will decode it to a Buffer for Playwright.

```typescript
await network.mock({
  match: '/download/file.pdf',
  respond: {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
    body: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer
  }
});
```

---

## 3. The Interceptor API & Assertions

The `network.mock()` method returns an `Interceptor` object. It exposes methods to inspect captured requests and a dedicated `assert` namespace for synchronous, reliable assertions.

```typescript
test('network assertions', async ({ network, assert: testAssert }) => {
  const usersMock = await network.mock({
    match: '/api/users',
    respond: { status: 200 }
  })

  // Triggers request
  await fetch('/api/users?sort=asc', { method: 'POST', body: '{"name": "foo"}' })

  // 1. Assertions namespace (awaited to prevent flakiness!)
  await usersMock.assert.called()
  await usersMock.assert.calledOnce()
  await usersMock.assert.callCount(1)

  // Deep matching for requests (checks if at least one call matched)
  await usersMock.assert.calledWith({
    method: 'POST',
    query: { sort: 'asc' },
    body: '{"name": "foo"}' // Matches exact string
  })

  // 2. Manual inspection for edge cases
  const req = usersMock.lastRequest()
  testAssert.deepEqual(JSON.parse(req.body), { name: 'foo' })
})
```

### Full Interceptor API

The `Interceptor` instance exposes the following interface:

#### Request Inspection
Sometimes built-in assertions aren't enough (e.g. asserting JSON payload equality without strict string matching). You can manually inspect the captured requests:
- `getRequests(): CapturedRequest[]` - Returns all requests captured by this mock.
- `lastRequest(): CapturedRequest | undefined` - Returns the most recent captured request.
- `firstRequest(): CapturedRequest | undefined` - Returns the first captured request.
- `restore(): Promise<void>` - Manually removes the mock.

*A `CapturedRequest` object contains `url`, `method`, `headers`, `query`, and `body` (as `string | ArrayBuffer | null`).*

#### The `assert` Namespace
To prevent flakiness when network requests are triggered asynchronously (e.g. by a button click), all assertion methods are **asynchronous and will poll** for a short duration (e.g. 2000ms) until the condition is met, before throwing a Chai `AssertionError`.

**Call Counts:**
- `assert.called(): Promise<void>` - Asserts the mock was called at least once.
- `assert.notCalled(): Promise<void>` - Asserts the mock was never called.
- `assert.calledOnce(): Promise<void>` - Asserts the mock was called exactly once.
- `assert.calledTwice(): Promise<void>` - Asserts the mock was called exactly twice.
- `assert.callCount(n: number): Promise<void>` - Asserts the mock was called exactly `n` times.

**Call Matching:**
Matches against a partial request object containing `method`, `headers`, `query`, and/or `body`.
- `assert.calledWith(match): Promise<void>` - Asserts at least one call matched the provided partial request.
- `assert.notCalledWith(match): Promise<void>` - Asserts no calls matched the provided partial request.
- `assert.calledOnceWith(match): Promise<void>` - Asserts exactly one call matched the provided partial request.

## 4. Teardown & Lifecycle

Mocks created inside a `test()` are automatically restored when the test finishes. 
Mocks created inside `group.setup()` apply to the entire group and are restored in `group.teardown()`.

Manual teardown is also supported:
```typescript
const mock = await network.mock(...)
await mock.restore()
```
