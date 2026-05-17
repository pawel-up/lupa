import type { JsonSerializable } from '../runner/types.js'
import type { WebRunner } from './web_runner.js'
import type { Emitter } from './emitter.js'

/**
 * Context provided to browser-side test plugins.
 */
export interface WebPluginContext {
  /** The browser-side test runner */
  runner: WebRunner
  /** The event emitter (shared with the Node orchestrator via HMR) */
  emitter: Emitter
  /** The serialized test configuration */
  config: {
    timeout?: number
    retries?: number
    filters?: any
  }
}

/**
 * The default export contract for a browser test plugin module.
 *
 * @example
 * ```typescript
 * import type { WebPluginFn } from '@pawel-up/lupa/testing'
 *
 * const setup: WebPluginFn = ({ runner, emitter }) => {
 *   TestContext.getter('assert', () => new Assert(), true)
 * }
 * export default setup
 * ```
 */
export type WebPluginFn<Options extends JsonSerializable = JsonSerializable> = (
  context: WebPluginContext,
  options?: Options
) => void | Promise<void>
