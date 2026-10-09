import { test } from 'node:test'
import assert from 'node:assert'
import { moduleMockVitePlugin } from '../../src/module-mock/plugin.js'

test('moduleMockVitePlugin', async (t) => {
  await t.test('transforms static, dynamic imports and star re-exports with mock id', async () => {
    const plugin = moduleMockVitePlugin()
    const transformHook = plugin.transform as any

    const code = [
      "import { add } from './math.js'",
      "export * from './calculator.js'",
      "export { version } from './version.js'",
      "const dyn = import('./dynamic.js')",
      "import 'lodash'",
    ].join('\n')

    const id = '/workspace/src/consumer.js?lupa-mock-id=test-abc'
    const result = await transformHook.call({}, code, id)

    assert.ok(result)
    assert.match(result.code, /import { add } from '\.\/math\.js\?lupa-mock-id=test-abc'/)
    assert.match(result.code, /export \* from '\.\/calculator\.js\?lupa-mock-id=test-abc'/)
    assert.match(result.code, /export { version } from '\.\/version\.js\?lupa-mock-id=test-abc'/)
    assert.match(result.code, /import\('\.\/dynamic\.js\?lupa-mock-id=test-abc'\)/)
    assert.match(result.code, /import 'lodash'/)
  })

  await t.test('returns null when id does not contain mock id param', async () => {
    const plugin = moduleMockVitePlugin()
    const transformHook = plugin.transform as any

    const code = "import { add } from './math.js'"
    const id = '/workspace/src/consumer.js'
    const result = await transformHook.call({}, code, id)

    assert.strictEqual(result, null)
  })
})
