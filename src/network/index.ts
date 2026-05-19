import { type WebPluginFn } from '../testing/web_plugin.js'
import { TestContext } from '../testing/test_context.js'
import { registry } from './registry.js'
import type { NetworkMockOptions } from './types.js'
import type { NetworkInterceptor } from './network_interceptor.js'

export type { NetworkMockOptions, CapturedRequest, NetworkRespondPayload } from './types.js'
export { bypass } from './constants.js'
export type { NetworkInterceptor }

/**
 * The developer-facing API for network interception and mocking.
 * Available in browser tests via the `network` fixture on the `TestContext`.
 */
export class Network {
  /**
   * Registers a new network mock to intercept requests matching the provided criteria.
   * Intercepted requests can be bypassed, stubbed with static payloads, or handled by dynamic closures.
   *
   * Note: All mocks created during a test are automatically restored when the test finishes.
   *
   * @param options The configuration defining the matching criteria and response behavior.
   * @returns A `NetworkInterceptor` to manage the mock and assert against captured requests.
   *
   * @example
   * ```ts
   * test('handles 500 error', async ({ network }) => {
   *   const mock = await network.mock({
   *     match: '/api/users',
   *     respond: { status: 500, body: { error: 'Internal Server Error' } }
   *   })
   *
   *   button.click()
   *   await mock.assert.calledOnce()
   * })
   * ```
   */
  async mock(options: NetworkMockOptions): Promise<NetworkInterceptor> {
    const interceptor = await registry.register(options)

    // Auto-restore logic

    const context = (this as any).__context as TestContext
    if (context && context.test) {
      context.cleanup(() => interceptor.restore())
    }

    return interceptor
  }
}

/**
 * Browser test plugin for network mocking support.
 *
 * Usage in config:
 * ```typescript
 * testPlugins: ['@pawel-up/lupa/network']
 * ```
 */
const setup: WebPluginFn = () => {
  TestContext.getter(
    'network',
    function (this: TestContext) {
      const fixture = new Network()

      ;(fixture as any).__context = this
      return fixture
    },
    true
  )
}

declare module '../testing/test_context.js' {
  interface TestContext {
    network: Network
  }
}

export default setup
