import os from 'node:os'
import type { PlannedTestSuite } from '../types.js'
import type { TestChunk } from './test_pool_manager.js'

/**
 * Internal helper responsible for calculating concurrency and distributing
 * test files round-robin across Playwright browser page slots.
 */
export class ShardingStrategy {
  /**
   * Resolves numeric concurrency from setting or 'auto' CPU count.
   * Dynamically calculates default concurrency based on system resources (cpus / 2)
   * and scales worker pools across multiple configured browsers.
   *
   * @param value Setting value (number, 'auto', or undefined).
   * @param browserCount Number of target browsers (default: 1).
   * @returns Resolved positive concurrency integer.
   *
   * @example
   * ```ts
   * const concurrency = strategy.resolveConcurrency('auto', 3)
   * ```
   */
  resolveConcurrency(value: number | 'auto' | undefined, browserCount = 1): number {
    if (value === 'auto') {
      const defaultConcurrency = Math.max(1, Math.floor(os.cpus().length / 2))
      if (browserCount > 1) {
        return Math.max(1, Math.floor(defaultConcurrency / browserCount))
      }
      return defaultConcurrency
    }
    return Math.max(1, Number(value) || 1)
  }

  /**
   * Partitions tiered suites across concurrency slots for each specified browser.
   *
   * @param tieredSuites Array of suites belonging to the priority tier.
   * @param priority Priority tier number.
   * @param browserNames Array of target browser names (e.g. ['chromium']).
   * @param globalConcurrency Configured global concurrency setting.
   * @returns List of non-empty TestChunk objects.
   */
  shard(
    tieredSuites: PlannedTestSuite[],
    priority: number,
    browserNames: string[],
    globalConcurrency: number | 'auto' | undefined
  ): TestChunk[] {
    const browserCount = browserNames.length
    const resolvedGlobalConcurrency = this.resolveConcurrency(globalConcurrency, browserCount)

    const maxTierConcurrency = Math.max(
      ...tieredSuites.map((s) =>
        s.concurrency !== undefined ? this.resolveConcurrency(s.concurrency, browserCount) : resolvedGlobalConcurrency
      )
    )

    const totalFilesCount = tieredSuites.reduce((sum, s) => sum + s.filesURLs.length, 0)
    const actualConcurrency = Math.max(1, Math.min(maxTierConcurrency, totalFilesCount || 1))

    const resultChunks: TestChunk[] = []

    for (const browserName of browserNames) {
      let tierFileIndex = 0
      const browserChunks: TestChunk[] = Array.from({ length: actualConcurrency }).map((_, i) => ({
        id: `${browserName}-t${priority}-${i}`,
        browserName,
        pageIndex: i,
        priority,
        suites: [],
      }))

      for (const suite of tieredSuites) {
        const effectiveConcurrency =
          suite.concurrency !== undefined
            ? this.resolveConcurrency(suite.concurrency, browserCount)
            : resolvedGlobalConcurrency

        suite.filesURLs.forEach((fileURL) => {
          const pageIndex = tierFileIndex++ % effectiveConcurrency
          const chunk = browserChunks[pageIndex]
          let suiteChunk = chunk.suites.find((s) => s.name === suite.name)
          if (!suiteChunk) {
            suiteChunk = {
              name: suite.name,
              timeout: suite.timeout,
              retries: suite.retries,
              priority: suite.priority,
              disableInWatchMode: suite.disableInWatchMode,
              excludeFromReporting: suite.excludeFromReporting,
              concurrency: suite.concurrency,
              filesURLs: [],
            }
            chunk.suites.push(suiteChunk)
          }
          suiteChunk.filesURLs.push(fileURL)
        })
      }

      for (const chunk of browserChunks) {
        if (chunk.suites.some((s) => s.filesURLs.length > 0)) {
          resultChunks.push(chunk)
        }
      }
    }

    return resultChunks
  }
}
