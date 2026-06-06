import { test } from 'node:test'
import assert from 'node:assert'
import { ProgressReporter } from '../../../src/reporters/progress.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { Runner, RunnerEvents, FileStartNode, FileEndNode, WithCorrelation } from '../../../src/types.js'
import { colors } from '../../../src/runner/helpers.js'

test('ProgressReporter', async (t) => {
  let logs: string[] = []
  // eslint-disable-next-line no-console
  const originalLog = console.log
  const originalDateNow = Date.now
  let mockTime = 0

  t.beforeEach(() => {
    logs = []
    mockTime = 0
    // eslint-disable-next-line no-console
    console.log = (...args: unknown[]): void => {
      logs.push(args.join(' '))
    }
    Date.now = (): number => {
      const current = mockTime
      mockTime += 3000
      return current
    }
  })

  t.afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = originalLog
    Date.now = originalDateNow
  })

  await t.test(
    'renders secondary progress for started files and primary progress for completed files (single browser)',
    async () => {
      const reporter = new ProgressReporter()
      const emitter = new Emitter<RunnerEvents>()
      const mockRunner = {
        getSummary: (): any => ({
          hasError: false,
          duration: 100,
          aggregates: { total: 0, passed: 0, failed: 0, todo: 0, skipped: 0 },
          failureTree: [],
          failedTestsTitles: [],
          importErrors: [],
        }),
        config: {},
        poolManager: {
          browserNames: ['chromium'],
          getChunk: (): any => undefined,
        },
      } as unknown as Runner

      reporter.boot(mockRunner, emitter, {} as any)

      // 1. Start the runner with 5 files
      await emitter.emit('runner:start', { estimatedTotalFiles: 5 } as any)
      assert.strictEqual(logs.length, 1)

      // Prefix should be "chromium: "
      const expectedPrefix = 'chromium: '
      const initialBar = `${expectedPrefix}|${' '.repeat(30)}|`
      assert.ok(logs[0].includes(initialBar))

      // 2. Start two files (a.ts and b.ts)
      await emitter.emit('file:start', { file: 'a.ts', browserId: 'chromium-0' } as WithCorrelation<FileStartNode>)
      await emitter.emit('file:start', { file: 'b.ts', browserId: 'chromium-0' } as WithCorrelation<FileStartNode>)

      // 2 files started out of 5 = 40% = 12 blocks out of 30.
      // They should be grey blocks.
      const expectedGrayBarSegment = colors.gray('█'.repeat(12))
      const expectedRemainingSpaces1 = ' '.repeat(18)
      const expectedBarAfterStart = `${expectedPrefix}|${expectedGrayBarSegment}${expectedRemainingSpaces1}|`

      assert.ok(logs[logs.length - 1].includes(expectedBarAfterStart))

      // 3. Complete a.ts
      await emitter.emit('file:end', { file: 'a.ts', browserId: 'chromium-0' } as WithCorrelation<FileEndNode>)

      // 1 completed file = 20% = 6 white blocks.
      // 2 started files (1 incomplete) = 40% total started = 12 blocks total (6 white, 6 grey).
      const expectedWhiteBarSegment = colors.white('█'.repeat(6))
      const expectedGrayBarSegment2 = colors.gray('█'.repeat(6))
      const expectedRemainingSpaces2 = ' '.repeat(18)
      const expectedBarAfterEnd = `${expectedPrefix}|${expectedWhiteBarSegment}${expectedGrayBarSegment2}${expectedRemainingSpaces2}|`

      assert.ok(logs[logs.length - 1].includes(expectedBarAfterEnd))

      // 4. Import error on c.ts (counts as completed/failed to run)
      await emitter.emit('runner:import_error', {
        file: 'c.ts',
        error: new Error('Cannot import'),
        browserId: 'chromium-0',
      } as any)

      // c.ts also counts as started and completed/executed.
      // So 2 completed (a.ts and c.ts) = 40% = 12 white blocks.
      // 3 started total (a.ts, b.ts, c.ts) = 60% = 18 blocks total (12 white, 6 grey).
      const expectedWhiteBarSegment3 = colors.white('█'.repeat(12))
      const expectedGrayBarSegment3 = colors.gray('█'.repeat(6))
      const expectedRemainingSpaces3 = ' '.repeat(12)
      const expectedBarAfterImportError = `${expectedPrefix}|${expectedWhiteBarSegment3}${expectedGrayBarSegment3}${expectedRemainingSpaces3}|`

      assert.ok(logs[logs.length - 1].includes(expectedBarAfterImportError))
    }
  )

  await t.test('renders multiple aligned progress bars in a multi-browser setup', async () => {
    const reporter = new ProgressReporter()
    const emitter = new Emitter<RunnerEvents>()

    const mockPoolManager = {
      browserNames: ['chromium', 'firefox'],
      getChunk: (chunkId: string): any => {
        if (chunkId.startsWith('chromium')) return { browserName: 'chromium' }
        if (chunkId.startsWith('firefox')) return { browserName: 'firefox' }
        return undefined
      },
    }

    const mockRunner = {
      getSummary: (): any => ({
        hasError: false,
        duration: 100,
        aggregates: { total: 0, passed: 0, failed: 0, todo: 0, skipped: 0 },
        failureTree: [],
        failedTestsTitles: [],
        importErrors: [],
      }),
      config: {},
      poolManager: mockPoolManager,
    } as unknown as Runner

    reporter.boot(mockRunner, emitter, {} as any)

    // Start the runner with 5 files
    await emitter.emit('runner:start', { estimatedTotalFiles: 5 } as any)

    // Check that we have progress bars for both browsers, aligned by the longest browser name ("chromium" vs "firefox")
    // Longest is "chromium: ", length 10. "firefox: " gets padded to "firefox:  " (length 10).
    const chromiumPrefix = 'chromium: '
    const firefoxPrefix = 'firefox:  '

    const lastLog = logs[logs.length - 1]
    assert.ok(lastLog.includes(`${chromiumPrefix}|${' '.repeat(30)}|`))
    assert.ok(lastLog.includes(`${firefoxPrefix}|${' '.repeat(30)}|`))

    // Start file on chromium
    await emitter.emit('file:start', { file: 'a.ts', browserId: 'chromium-t100-0' } as WithCorrelation<FileStartNode>)
    // Start and end file on firefox
    await emitter.emit('file:start', { file: 'b.ts', browserId: 'firefox-t100-0' } as WithCorrelation<FileStartNode>)
    await emitter.emit('file:end', { file: 'b.ts', browserId: 'firefox-t100-0' } as WithCorrelation<FileEndNode>)

    const updatedLog = logs[logs.length - 1]

    // Chromium: 1 started file (6 gray blocks)
    const expectedChromiumGray = colors.gray('█'.repeat(6))
    assert.ok(updatedLog.includes(`${chromiumPrefix}|${expectedChromiumGray}${' '.repeat(24)}|`))

    // Firefox: 1 completed file (6 white blocks)
    const expectedFirefoxWhite = colors.white('█'.repeat(6))
    assert.ok(updatedLog.includes(`${firefoxPrefix}|${expectedFirefoxWhite}${' '.repeat(24)}|`))
  })
})
