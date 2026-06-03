import { type WebPluginFn } from '../testing/web_plugin.js'
import { TestContext } from '../testing/test_context.js'
import { toRegistryKey } from './utils.js'

declare global {
  interface Window {
    // testId → rootRelativePath → exportName → value
    __LUPA_MOCKS__?: Record<string, Record<string, Record<string, unknown>>>
  }
}

/**
 * Developer-facing API for ESM module mocking.
 * Available in browser tests via the `module` fixture on `TestContext`.
 */
export class ModuleMock {
  readonly #mockId = crypto.randomUUID()
  readonly #context: TestContext
  #cleanupScheduled = false

  constructor(context: TestContext) {
    this.#context = context
  }

  /**
   * Register a mock for the given module path.
   *
   * `importMetaUrl` must be `import.meta.url` from your test file so that the
   * relative path resolves correctly against your project, not Lupa's internals.
   *
   * Accepts either a plain object or a factory function that receives the real
   * module. Both forms are merged on top of the real module — exports you do not
   * override are preserved from the original implementation.
   *
   * Must be called before `module.import()` in your test.
   *
   * @example
   * // Object form
   * await module.mock('../src/sdk.js', import.meta.url, {
   *   currentUser: { name: 'Alice' },
   * })
   *
   * // Factory form — receives the real module, return only what you want to override
   * await module.mock('../src/auth.js', import.meta.url, (real) => ({
   *   authenticate: (token) => token.startsWith('test-') || real.authenticate(token),
   * }))
   */
  async mock(
    path: string,
    importMetaUrl: string,
    factoryOrObject:
      | Record<string, unknown>
      | ((real: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>)
  ): Promise<void> {
    const rootPath = toRegistryKey(new URL(path, importMetaUrl).pathname)

    // Use a throwaway mock-id so resolveId maps .js → .ts, but since this id
    // is never registered, load falls through and serves the real file.
    const realUrl = new URL(path, importMetaUrl)
    realUrl.searchParams.set('lupa-mock-id', '__real__')
    const real = (await import(/* @vite-ignore */ realUrl.href)) as Record<string, unknown>

    const overrides = typeof factoryOrObject === 'function' ? await factoryOrObject(real) : factoryOrObject
    const merged = { ...real, ...overrides }

    window.__LUPA_MOCKS__ ??= {}
    window.__LUPA_MOCKS__[this.#mockId] ??= {}
    window.__LUPA_MOCKS__[this.#mockId][rootPath] = merged

    await window.__lupa_command__?.('module:mock:register', { testId: this.#mockId, path: rootPath })

    this.#scheduleCleanup()
  }

  /**
   * Dynamically import a module with cache-busting so the mock registry is consulted.
   * All transitive imports in the module tree will also be cache-busted.
   *
   * `importMetaUrl` must be `import.meta.url` from your test file so that the
   * relative path resolves correctly against your project, not Lupa's internals.
   *
   * @example
   * await module.import('../src/ui-dashboard.js', import.meta.url)
   */
  async import<T = Record<string, unknown>>(path: string, importMetaUrl: string): Promise<T> {
    const url = new URL(path, importMetaUrl)
    url.searchParams.set('lupa-mock-id', this.#mockId)
    return import(/* @vite-ignore */ url.href)
  }

  #scheduleCleanup(): void {
    if (this.#cleanupScheduled) return
    this.#cleanupScheduled = true

    this.#context.cleanup(async () => {
      delete window.__LUPA_MOCKS__?.[this.#mockId]
      await window.__lupa_command__?.('module:mock:clear', { testId: this.#mockId })
    })
  }
}

/**
 * Browser test plugin that installs the `module` fixture on `TestContext`.
 *
 * Registered automatically when you add `moduleMocking()` to your `lupa.config.ts`.
 */
const setup: WebPluginFn = () => {
  TestContext.getter(
    'module',
    function (this: TestContext) {
      return new ModuleMock(this)
    },
    true
  )
}

declare module '../testing/test_context.js' {
  interface TestContext {
    module: ModuleMock
  }
}

export default setup
