/**
 * The built-in assertion library for Lupa. It uses the Japa Assert library under the hood.
 *
 * @packageDocumentation
 * @module @pawel-up/lupa/assert
 */

/*
 * @japa/assert
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { WebPluginFn } from '../testing/web_plugin.js'
import { Test } from '../testing/test/main.js'
import { TestContext } from '../testing/test_context.js'

import { Assert } from './assert.js'

declare module '../testing/test_context.js' {
  interface TestContext {
    assert: Assert
  }
}

/**
 * Browser test plugin for assertion support.
 *
 * Usage in config:
 * ```typescript
 * testPlugins: ['@pawel-up/lupa/assert']
 * ```
 */
const setup: WebPluginFn = () => {
  TestContext.getter('assert', () => new Assert(), true)
  Test.executed(function (test: Test<any>, hasError) {
    /**
     * Do not evaluate assertions counts for regression tests.
     */
    if (test.options.isFailing) {
      return
    }

    if (!hasError) {
      test.context?.assert.assertions.validate()
    }
  })
}

export default setup
export { Assert }
export { AssertDom } from './dom.js'
export type * from './types.js'
export { AssertionError } from 'assertion-error'
