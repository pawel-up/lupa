import Macroable from '@poppinss/macroable'
import type { TestHooksCleanupHandler } from '../types.js'
import type { Test } from './test/main.js'

/**
 * A fresh copy of test context is shared with all the tests.
 * Note, this runs in the browser context.
 */
export class TestContext extends Macroable {
  cleanup: (cleanupCallback: TestHooksCleanupHandler) => void

  constructor(public test: Test) {
    super()
    this.cleanup = (cleanupCallback: TestHooksCleanupHandler) => {
      test.cleanup(cleanupCallback)
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
