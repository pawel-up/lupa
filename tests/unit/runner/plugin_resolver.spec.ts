import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PluginResolver } from '../../../src/runner/plugin_resolver.js'

test('PluginResolver returns empty array when plugins array is empty or undefined', async () => {
  const resolver = new PluginResolver()
  const result1 = await resolver.resolve(undefined, process.cwd())
  const result2 = await resolver.resolve([], process.cwd())

  assert.deepEqual(result1, [])
  assert.deepEqual(result2, [])
})

test('PluginResolver resolves string plugin specifier and preserves options tuple', async () => {
  const resolver = new PluginResolver()
  const plugins = ['@pawel-up/lupa', ['@pawel-up/lupa', { option: 1 }]] as any

  const resolved = await resolver.resolve(plugins, process.cwd())

  assert.strictEqual(resolved.length, 2)
  assert.ok(typeof resolved[0][0] === 'string')
  assert.strictEqual(resolved[0][1], undefined)
  assert.ok(typeof resolved[1][0] === 'string')
  assert.deepEqual(resolved[1][1], { option: 1 })
})
