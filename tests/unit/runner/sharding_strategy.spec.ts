import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { ShardingStrategy } from '../../../src/runner/sharding_strategy.js'
import type { PlannedTestSuite } from '../../../src/types.js'

test('ShardingStrategy resolves concurrency auto and numeric values', () => {
  const strategy = new ShardingStrategy()

  const expectedAuto = Math.max(1, Math.floor(os.cpus().length / 2))
  assert.strictEqual(strategy.resolveConcurrency('auto'), expectedAuto)
  assert.strictEqual(strategy.resolveConcurrency(4), 4)
  assert.strictEqual(strategy.resolveConcurrency(0), 1)
  assert.strictEqual(strategy.resolveConcurrency(undefined), 1)
})

test('ShardingStrategy scales auto concurrency per browser for multi-browser configurations', () => {
  const strategy = new ShardingStrategy()
  const expectedAuto = Math.max(1, Math.floor(os.cpus().length / 2))
  const expectedScaled3 = Math.max(1, Math.floor(expectedAuto / 3))

  assert.strictEqual(strategy.resolveConcurrency('auto', 3), expectedScaled3)
  assert.strictEqual(strategy.resolveConcurrency('auto', 1), expectedAuto)
})

test('ShardingStrategy partitions files round-robin across browser chunks', () => {
  const strategy = new ShardingStrategy()
  const suites: PlannedTestSuite[] = [
    {
      name: 'suite-a',
      files: [],
      filesURLs: [pathToFileURL('/file1.spec.ts'), pathToFileURL('/file2.spec.ts'), pathToFileURL('/file3.spec.ts')],
    },
  ]

  const chunks = strategy.shard(suites, 100, ['chromium'], 2)

  assert.strictEqual(chunks.length, 2)
  assert.strictEqual(chunks[0].id, 'chromium-t100-0')
  assert.strictEqual(chunks[1].id, 'chromium-t100-1')

  const chunk0Files = chunks[0].suites[0].filesURLs
  const chunk1Files = chunks[1].suites[0].filesURLs

  assert.strictEqual(chunk0Files.length, 2)
  assert.strictEqual(chunk1Files.length, 1)
})

test('ShardingStrategy scales worker pool per browser with auto concurrency', () => {
  const strategy = new ShardingStrategy()
  const suites: PlannedTestSuite[] = [
    {
      name: 'suite-multi',
      files: [],
      filesURLs: Array.from({ length: 20 }, (_, i) => pathToFileURL(`/file${i}.spec.ts`)),
    },
  ]

  const browsers = ['chromium', 'firefox', 'webkit']
  const chunks = strategy.shard(suites, 100, browsers, 'auto')

  const expectedAuto = Math.max(1, Math.floor(os.cpus().length / 2))
  const expectedPerBrowser = Math.max(1, Math.floor(expectedAuto / browsers.length))

  const chromiumChunks = chunks.filter((c) => c.browserName === 'chromium')
  const firefoxChunks = chunks.filter((c) => c.browserName === 'firefox')
  const webkitChunks = chunks.filter((c) => c.browserName === 'webkit')

  assert.strictEqual(chromiumChunks.length, expectedPerBrowser)
  assert.strictEqual(firefoxChunks.length, expectedPerBrowser)
  assert.strictEqual(webkitChunks.length, expectedPerBrowser)
})
