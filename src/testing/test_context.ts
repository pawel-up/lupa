import Macroable from '@poppinss/macroable'
import type { TestHooksCleanupHandler } from '../types.js'
import type { Test } from './test/main.js'
import { renderFixture, type TemplateTypes, type FixtureRenderOptions } from './fixture.js'

/**
 * A fresh copy of test context is shared with all the tests.
 * Note, this runs in the browser context.
 */
export class TestContext extends Macroable {
  cleanup: (cleanupCallback: TestHooksCleanupHandler) => void

  /**
   * Renders a HTML string or a Lit template into a dedicated fixture container and mounts it to the DOM.
   * Bound explicitly to this test context instance for auto-cleanup.
   *
   * @param template - A string of HTML or a `lit-html` template.
   * @param options - Render options.
   * @returns A promise resolving to the rendered DOM element.
   *
   * @category DOM
   * @useWhen Rendering HTML templates or Custom Elements into the DOM in a test.
   *
   * @example
   * ```ts
   * test('renders lit template', async ({ fixture, assert }) => {
   *   const el = await fixture<HTMLButtonElement>(html`<button>Click me</button>`)
   *   assert.equal(el.textContent, 'Click me')
   * })
   * ```
   */
  fixture: <T extends Element = Element>(template: TemplateTypes, options?: FixtureRenderOptions) => Promise<T>

  constructor(public test: Test) {
    super()
    this.cleanup = (cleanupCallback: TestHooksCleanupHandler) => {
      test.cleanup(cleanupCallback)
    }
    this.fixture = <T extends Element = Element>(
      template: TemplateTypes,
      options?: FixtureRenderOptions
    ): Promise<T> => {
      return renderFixture<T>(template, options, this)
    }
  }

  /**
   * The name of the browser in which the current test is executing.
   *
   * Automatically resolves from Lupa orchestrator context configuration, or falls back to
   * basic user-agent analysis if window.__lupa__ configuration is missing.
   *
   * @returns {'chromium' | 'firefox' | 'webkit'}
   */
  get browserName(): 'chromium' | 'firefox' | 'webkit' {
    if (typeof window !== 'undefined' && window.__lupa__?.browserName) {
      return window.__lupa__.browserName as 'chromium' | 'firefox' | 'webkit'
    }
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      if (ua.includes('firefox')) {
        return 'firefox'
      }
      if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) {
        return 'webkit'
      }
    }
    return 'chromium'
  }
}
