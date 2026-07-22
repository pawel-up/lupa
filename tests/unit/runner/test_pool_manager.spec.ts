import test from 'node:test'
import assert from 'node:assert/strict'
import { TestPoolManager } from '../../../src/runner/test_pool_manager.js'
import type { NormalizedConfig } from '../../../src/runner/types.js'
import type { PlannedTestSuite } from '../../../src/types.js'
import { pathToFileURL } from 'node:url'

test('TestPoolManager', async (t) => {
  const mockConfig = {
    concurrency: 2,
    filters: {},
  } as unknown as NormalizedConfig

  const suites: PlannedTestSuite[] = [
    {
      name: 'unit',
      files: [],
      filesURLs: [
        pathToFileURL('/absolute/path/to/test1.spec.ts'),
        pathToFileURL('/absolute/path/to/test2.spec.ts'),
        pathToFileURL('/absolute/path/to/test3.spec.ts'),
      ],
    },
    {
      name: 'e2e',
      files: [],
      filesURLs: [pathToFileURL('/absolute/path/to/test4.spec.ts')],
    },
  ]

  const browsers = ['chromium', 'firefox']

  await t.test('computes chunks across browsers and concurrency', () => {
    const manager = new TestPoolManager(mockConfig, browsers, suites)

    const chromiumChunks = manager.getChunkIdsForBrowser('chromium')
    assert.equal(chromiumChunks.length, 2)
    assert.equal(chromiumChunks[0], 'chromium-t100-0')
    assert.equal(chromiumChunks[1], 'chromium-t100-1')

    const firefoxChunks = manager.getChunkIdsForBrowser('firefox')
    assert.equal(firefoxChunks.length, 2)

    const chunk0 = manager.getChunk('chromium-t100-0')
    assert.ok(chunk0)
    assert.equal(chunk0.browserName, 'chromium')
    assert.equal(chunk0.pageIndex, 0)

    // Total files = 4. Concurrency = 2.
    // test1 (0) -> chunk 0
    // test2 (1) -> chunk 1
    // test3 (2) -> chunk 0
    // test4 (3) -> chunk 1
    assert.equal(chunk0.suites.length, 1)
    assert.equal(chunk0.suites[0].name, 'unit')
    assert.equal(chunk0.suites[0].filesURLs.length, 2)

    const chunk1 = manager.getChunk('chromium-t100-1')
    assert.ok(chunk1)
    assert.equal(chunk1.suites.length, 2) // unit and e2e
    assert.equal(chunk1.suites[0].name, 'unit')
    assert.equal(chunk1.suites[1].name, 'e2e')
  })

  await t.test('getFilesCount returns total files for a single browser', () => {
    const manager = new TestPoolManager(mockConfig, browsers, suites)
    // 4 files per browser
    assert.equal(manager.getFilesCount(), 4)
  })

  await t.test('getFilesCount respects config.filters.files with exact match or endsWith', () => {
    const configWithFilter = {
      concurrency: 2,
      filters: {
        files: ['test1.spec.ts', '/path/to/test4.spec.ts'],
      },
    } as unknown as NormalizedConfig

    const manager = new TestPoolManager(configWithFilter, browsers, suites)

    // test1 matches (1)
    // test4 matches (1)
    // Total should be 2
    assert.equal(manager.getFilesCount(), 2)
  })

  await t.test('getFilesCount returns 0 when no files match', () => {
    const configWithFilter = {
      concurrency: 2,
      filters: {
        files: ['doesnotexist.ts'],
      },
    } as unknown as NormalizedConfig

    const manager = new TestPoolManager(configWithFilter, browsers, suites)
    assert.equal(manager.getFilesCount(), 0)
  })

  await t.test('getChunkIdForFile returns the chunk that owns the file', () => {
    const manager = new TestPoolManager(mockConfig, browsers, suites)

    // concurrency=2, round-robin: test1->0, test2->1, test3->0, test4->1
    // test2 lives in chromium-t100-1, not chromium-t100-0 (the regression case)
    assert.equal(manager.getChunkIdForFile('chromium', '/absolute/path/to/test2.spec.ts'), 'chromium-t100-1')
  })

  await t.test('getChunkIdForFile matches by path suffix', () => {
    const manager = new TestPoolManager(mockConfig, browsers, suites)

    assert.equal(manager.getChunkIdForFile('chromium', 'test3.spec.ts'), 'chromium-t100-0')
  })

  await t.test('getChunkIdForFile falls back to first chunk when file not found', () => {
    const manager = new TestPoolManager(mockConfig, browsers, suites)

    assert.equal(manager.getChunkIdForFile('chromium', 'unknown.spec.ts'), 'chromium-t100-0')
  })

  await t.test('getChunkIdsByTier returns chunks grouped by priority, descending', () => {
    const highPrioritySuite: PlannedTestSuite = {
      name: 'unit',
      files: [],
      priority: 100,
      filesURLs: [pathToFileURL('/absolute/path/to/test1.spec.ts')],
    }
    const lowPrioritySuite: PlannedTestSuite = {
      name: 'benchmarks',
      files: [],
      priority: 50,
      filesURLs: [pathToFileURL('/absolute/path/to/bench1.benchmark.ts')],
    }

    const manager = new TestPoolManager(mockConfig, ['chromium'], [highPrioritySuite, lowPrioritySuite])
    const tiers = manager.getChunkIdsByTier('chromium')

    const priorities = [...tiers.keys()]
    assert.equal(priorities[0], 100)
    assert.equal(priorities[1], 50)

    assert.ok(tiers.get(100)?.every((id) => id.includes('-t100-')))
    assert.ok(tiers.get(50)?.every((id) => id.includes('-t50-')))
  })

  await t.test('respects per-suite concurrency override', () => {
    const customSuites: PlannedTestSuite[] = [
      {
        name: 'serial-e2e',
        files: [],
        concurrency: 1, // Must be forced to 1 page slot
        filesURLs: [
          pathToFileURL('/absolute/path/to/e2e1.spec.ts'),
          pathToFileURL('/absolute/path/to/e2e2.spec.ts'),
          pathToFileURL('/absolute/path/to/e2e3.spec.ts'),
        ],
      },
      {
        name: 'parallel-unit',
        files: [],
        concurrency: 4, // Distributed across up to 4 page slots
        filesURLs: [
          pathToFileURL('/absolute/path/to/u1.spec.ts'),
          pathToFileURL('/absolute/path/to/u2.spec.ts'),
          pathToFileURL('/absolute/path/to/u3.spec.ts'),
          pathToFileURL('/absolute/path/to/u4.spec.ts'),
        ],
      },
    ]

    const manager = new TestPoolManager(mockConfig, ['chromium'], customSuites)
    const chromiumChunks = manager.getChunkIdsForBrowser('chromium')

    // Concurrency max is 4 (from parallel-unit)
    assert.equal(chromiumChunks.length, 4)

    // serial-e2e has concurrency: 1, so all 3 files MUST be in chunk 0 (chromium-t100-0)
    const chunk0 = manager.getChunk('chromium-t100-0')!
    const serialSuiteInChunk0 = chunk0.suites.find((s) => s.name === 'serial-e2e')
    assert.ok(serialSuiteInChunk0)
    assert.equal(serialSuiteInChunk0.filesURLs.length, 3)

    // Chunks 1, 2, 3 must NOT contain any files from serial-e2e
    for (let i = 1; i < 4; i++) {
      const chunk = manager.getChunk(`chromium-t100-${i}`)!
      const serialSuite = chunk.suites.find((s) => s.name === 'serial-e2e')
      assert.equal(serialSuite, undefined)
    }
  })
})
