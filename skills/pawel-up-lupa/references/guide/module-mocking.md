# Module Mocking

Lupa provides an opt-in ES Module mocking engine that runs natively inside the Playwright browser. Unlike traditional Node.js testing tools, Lupa does not rely on JSDOM. Instead, it uses a high-performance Vite plugin to seamlessly rewrite the module graph on the fly, guaranteeing total test isolation and no memory leaks.

## Enabling Module Mocking

Because the Vite AST parser adds a small overhead, module mocking is an opt-in feature. A single call to `moduleMocking()` in your `plugins` array is all that's needed — it automatically registers both the Node-side Vite plugin and the browser-side `module` fixture.

You also need to extend `TestContext` so TypeScript knows about the `module` property in your tests:

```ts
import { defineConfig } from '@pawel-up/lupa/runner'
import { moduleMocking } from '@pawel-up/lupa/module-mock'
import type { ModuleMock } from '@pawel-up/lupa/module-mock'

export default defineConfig({
  plugins: [
    moduleMocking()
  ]
})

declare module '@pawel-up/lupa/testing' {
  interface TestContext {
    module: ModuleMock
  }
}
```

## The Golden Rule: Dynamic Imports

Browsers heavily cache ES Modules. If you statically `import` a component at the top of your test file, the browser locks in its real dependency tree before any test code runs — mocks registered afterward have no effect.

```ts
// ❌ Wrong — the browser resolves this before your test starts.
//    module.mock() will be ignored.
import '../src/ui-dashboard.js'

test('greets Alice', async ({ module }) => {
  await module.mock('../src/sdk.js', import.meta.url, { currentUser: { name: 'Alice' } })
  // ...
})
```

To inject mocks, you **must use `module.import()`** inside your test block. Lupa appends a unique test ID to the URL, bypassing the browser cache and routing the entire dependency tree through the mock registry.

```ts
// ✅ Correct — import happens after mocks are registered.
test('greets Alice', async ({ module }) => {
  await module.mock('../src/sdk.js', import.meta.url, { currentUser: { name: 'Alice' } })
  await module.import<typeof import('../src/ui-dashboard.js')>(
    '../src/ui-dashboard.js',
    import.meta.url
  )
  // ...
})
```

Only the **entry point** needs `module.import()`. All transitive dependencies (`ui-dashboard.js` → `sdk.js` → ...) are automatically cache-busted and intercepted by the Vite plugin.

### Why `import.meta.url`?

Relative paths like `'../src/sdk.js'` must be resolved against your test file, not Lupa's own internals. Passing `import.meta.url` gives Lupa the correct base URL to resolve from. This is the same pattern used by Node's `import()` and other ESM-native tools.

## Basic Mocking

Pass a plain object as the third argument to `module.mock()` to override specific exports. Any exports you do **not** list are transparently preserved from the real module.

```ts
import { test, fixture, html } from '@pawel-up/lupa/testing'

test('mocks the deeply nested authentication SDK', async ({ module, assert }) => {
  // Only `currentUser` and `default` are overridden.
  // All other exports of sdk.js keep their real implementations.
  await module.mock('../src/sdk.js', import.meta.url, {
    currentUser: { name: 'Alice' },
    default: () => console.log('Mock SDK Initialized'),
  })

  const { default: UiDashboard } = await module.import<typeof import('../src/ui-dashboard.js')>(
    '../src/ui-dashboard.js',
    import.meta.url
  )

  const el = await fixture(html`<ui-dashboard></ui-dashboard>`)
  assert.dom.hasText(el.shadowRoot.querySelector('.greeting'), 'Hello, Alice')
})
```

## Partial Mocking (The Factory Pattern)

When you need to **wrap** a real export — for example, to call through to the original implementation conditionally, or to extend a class — pass a factory callback as the third argument. The factory receives the real module so you can derive from it.

```ts
test('wraps the real authenticate function', async ({ module }) => {
  await module.mock('../src/auth.js', import.meta.url, (real) => ({
    // Allow test tokens locally; fall through to the real implementation otherwise
    authenticate: (token) =>
      token.startsWith('test-') ? true : real.authenticate(token),

    // validateToken is not listed — the real implementation is kept automatically
  }))

  await module.import<typeof import('../src/my-component.js')>(
    '../src/my-component.js',
    import.meta.url
  )
})
```

The factory's return value is merged on top of the real module, so any export you omit is preserved as-is.

## Limitation: Web Components and `customElements.define`

If the module you want to import **registers a custom element** as a side effect (`customElements.define('my-button', ...)`), `module.import()` will fail on the second test that imports the same tag name. The browser's `CustomElementRegistry` does not support re-registration — calling `customElements.define` for an already-registered tag throws a `DOMException`.

There is currently no built-in solution for this case. `module.mock()` only intercepts modules that are fetched via `module.import()` — it has no effect on modules that were already statically imported and cached by the browser. This means you cannot mock a web component's static dependencies (its own `import` statements) without re-importing the component itself.

The practical workarounds are:

- **Test the component's dependencies separately**, not through the component's render output.
- **Design components to read dependencies lazily** — from a mutable global, a context API, or a dynamic `import()` inside a method — so the value is read at call time rather than captured at module evaluation time.
- **Use network mocking** (via `network.mock()`) when the dependency boundary is an HTTP request rather than a module import.

This is a fundamental constraint of the browser's immutable module map. A future version of Lupa may address this via the [Scoped Custom Element Registries](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Scoped-Custom-Element-Registries.md) proposal, which allows per-test element registries once browser support is broad enough.

## Test Isolation and Teardown

Lupa guarantees strict per-test isolation.

1. A mock registered inside a `test()` block applies **only to that test**.
2. Different tests in the same file can mock the same module entirely differently without bleeding into each other.
3. When the test finishes, Lupa automatically clears both the Vite mock registry and the browser-side mock store, preventing memory leaks and state leakage across test runs.
