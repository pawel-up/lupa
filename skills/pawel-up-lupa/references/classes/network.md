# Classes

## network

### `Network`
The developer-facing API for network interception and mocking.
Available in browser tests via the `network` fixture on the `TestContext`.
```ts
constructor(context: TestContext): Network
```
**Methods:**
- `ignoreCors(ignore: boolean): Promise<void>` — Tells the network interceptor to automatically bypass CORS rules by intercepting
preflight OPTIONS requests and injecting `Access-Control-Allow-Origin: *` headers
into any fulfilled network mock.

This setting automatically reverts at the end of the test.
- `mock(match: NetworkMatch, respond: NetworkRespondPayload | NetworkRespondDynamic): Promise<NetworkInterceptor>` — Registers a new network mock to intercept requests matching the provided criteria.
Intercepted requests can be bypassed, stubbed with static payloads, or handled by dynamic closures.

Note: All mocks created during a test are automatically restored when the test finishes.
