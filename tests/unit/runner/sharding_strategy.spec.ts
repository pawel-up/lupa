import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { ShardingStrategy } from '../../../src/runner/sharding_strategy.js'
import type { PlannedTestSuite } from '../../../src/types.js'

test('ShardingStrategy resolves concurrency auto and numeric values', () => {
  const strategy = new ShardingStrategy()

  assert.ok(strategy.resolveConcurrency('auto') >= 1)
  assert.strictEqual(strategy.resolveConcurrency(4), 4)
  assert.strictEqual(strategy.resolveConcurrency(0), 1)
  assert.strictEqual(strategy.resolveConcurrency(undefined), 1)
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
