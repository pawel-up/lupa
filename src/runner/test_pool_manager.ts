import os from 'node:os'
import { fileURLToPath } from 'node:url'
import type { NormalizedConfig, TestSuite } from './types.js'
import { PlannedTestSuite } from '../types.js'

const DEFAULT_PRIORITY = 100

/**
 * Represents a discrete chunk of tests assigned to a specific browser page slot.
 * A chunk contains a subset of the total test files, grouped by their originating
 * suites to maintain suite-specific configurations like timeout and retries.
 */
export interface TestChunk {
  /**
   * The unique identifier for this chunk (e.g., "chromium-t100-0").
   */
  id: string

  /**
   * The name of the browser environment this chunk runs in (e.g., "chromium", "firefox").
   */
  browserName: string

  /**
   * The index of the parallel Playwright page executing this chunk.
   */
  pageIndex: number

  /**
   * The priority tier this chunk belongs to.
   */
  priority: number

  /**
   * The list of test suites assigned to this chunk, along with their associated
   * configuration options and resolved file URLs.
   */
  suites: Omit<PlannedTestSuite, 'files'>[]
}

/**
 * Manages the partitioning (sharding) of test suites and files across multiple
 * browser instances and parallel pages.
 *
 * Suites are grouped into priority tiers and executed tier-by-tier in descending
 * priority order. Within each tier the workload is distributed round-robin across
 * concurrency slots, exactly as before.
 */
export class TestPoolManager {
  #chunks = new Map<string, TestChunk>()

  /**
   * Creates a new TestPoolManager and immediately computes the workload chunks.
   *
   * @param config - The normalized configuration containing concurrency settings.
   * @param browserNames - An array of browser names to generate chunks for.
   * @param suites - The fully expanded list of test suites and their resolved file URLs.
   */
  constructor(
    private config: NormalizedConfig,
    private browserNames: string[],
    private suites: PlannedTestSuite[]
  ) {
    this.#computeChunks()
  }

  #computeChunks() {
    let concurrency = this.config.concurrency
    if (concurrency === 'auto') {
      concurrency = Math.max(1, os.cpus().length - 1)
    } else {
      concurrency = Number(concurrency) || 1
    }

    // Group suites by priority tier.
    const tierMap = new Map<number, PlannedTestSuite[]>()
    for (const suite of this.suites) {
      const priority = suite.priority ?? DEFAULT_PRIORITY
      const bucket = tierMap.get(priority)
      if (bucket) {
        bucket.push(suite)
      } else {
        tierMap.set(priority, [suite])
      }
    }

    // Process each tier independently with the same round-robin distribution.
    for (const [priority, tieredSuites] of tierMap) {
      const allFiles: { suite: TestSuite; fileURL: URL }[] = []
      for (const suite of tieredSuites) {
        for (const fileURL of suite.filesURLs) {
          allFiles.push({ suite, fileURL })
        }
      }

      const actualConcurrency = Math.max(1, Math.min(concurrency, allFiles.length || 1))

      for (const browserName of this.browserNames) {
        const browserChunks: TestChunk[] = Array.from({ length: actualConcurrency }).map((_, i) => ({
          id: `${browserName}-t${priority}-${i}`,
          browserName,
          pageIndex: i,
          priority,
          suites: [],
        }))

        allFiles.forEach((fileObj, index) => {
          const chunk = browserChunks[index % actualConcurrency]
          let suiteChunk = chunk.suites.find((s) => s.name === fileObj.suite.name)
          if (!suiteChunk) {
            suiteChunk = {
              name: fileObj.suite.name,
              timeout: fileObj.suite.timeout,
              retries: fileObj.suite.retries,
              priority: fileObj.suite.priority,
              disableInWatchMode: fileObj.suite.disableInWatchMode,
              excludeFromReporting: fileObj.suite.excludeFromReporting,
              filesURLs: [],
            }
            chunk.suites.push(suiteChunk)
          }
          suiteChunk.filesURLs.push(fileObj.fileURL)
        })

        for (const chunk of browserChunks) {
          this.#chunks.set(chunk.id, chunk)
        }
      }
    }
  }

  /**
   * Retrieves a specific test chunk by its unique identifier.
   *
   * @param chunkId - The unique ID of the chunk (e.g., "chromium-t100-0").
   * @returns The corresponding TestChunk or undefined if not found.
   */
  getChunk(chunkId: string): TestChunk | undefined {
    return this.#chunks.get(chunkId)
  }

  /**
   * Retrieves all chunk IDs assigned to a specific browser, across all priority tiers.
   * Used by BrowserManager during boot to create the right number of pages.
   *
   * @param browserName - The name of the browser (e.g., "chromium").
   * @returns An array of chunk IDs.
   */
  getChunkIdsForBrowser(browserName: string): string[] {
    return Array.from(this.#chunks.values())
      .filter((c) => c.browserName === browserName)
      .map((c) => c.id)
  }

  /**
   * Returns chunk IDs for a given browser, grouped by priority tier and sorted
   * in descending priority order (highest first).
   *
   * Used by the Orchestrator to drive sequential wave execution.
   *
   * @param browserName - The name of the browser (e.g., "chromium").
   * @returns A Map of priority → chunk ID array, iterated in descending priority order.
   */
  getChunkIdsByTier(browserName: string): Map<number, string[]> {
    const result = new Map<number, string[]>()
    const chunks = Array.from(this.#chunks.values()).filter((c) => c.browserName === browserName)

    // Collect unique priorities sorted descending.
    const priorities = [...new Set(chunks.map((c) => c.priority))].sort((a, b) => b - a)

    for (const priority of priorities) {
      result.set(
        priority,
        chunks.filter((c) => c.priority === priority).map((c) => c.id)
      )
    }

    return result
  }

  /**
   * Finds the chunk ID that contains a given file path for the specified browser.
   * Falls back to the first chunk for that browser when no chunk contains the file.
   *
   * @param browserName - The name of the browser (e.g., "chromium").
   * @param filePath - An absolute path or path suffix to look for.
   * @returns The matching chunk ID, or the default first chunk for that browser.
   */
  getChunkIdForFile(browserName: string, filePath: string): string {
    const allIds = this.getChunkIdsForBrowser(browserName)
    const defaultChunkId = allIds[0] ?? `${browserName}-t${DEFAULT_PRIORITY}-0`
    return (
      allIds.find((id) => {
        const chunk = this.#chunks.get(id)
        return chunk?.suites.some((s) =>
          s.filesURLs.some((u) => {
            const p = u.pathname
            return p === filePath || p.endsWith(filePath) || filePath.endsWith(p)
          })
        )
      }) ?? defaultChunkId
    )
  }

  /**
   * Returns the total number of test files across all chunks and browsers,
   * excluding files that belong to suites marked with `excludeFromReporting`.
   *
   * @returns Total number of reportable test files
   */
  getFilesCount(): number {
    const fileFilters = this.config.filters?.files

    return Array.from(this.#chunks.values()).reduce((acc, chunk) => {
      return (
        acc +
        chunk.suites.reduce((sum, s) => {
          if (s.excludeFromReporting) return sum
          if (fileFilters && fileFilters.length > 0) {
            const count = s.filesURLs.filter((u) => {
              const path = fileURLToPath(u)
              return fileFilters.some((allowed) => path.endsWith(allowed))
            }).length
            return sum + count
          }
          return sum + s.filesURLs.length
        }, 0)
      )
    }, 0)
  }

  /**
   * Returns the set of file pathnames (as strings) belonging to suites marked
   * with `excludeFromReporting`. Used by the Cli to suppress `file:start` /
   * `file:end` events for those files from reaching reporters.
   *
   * Only considers the first browser's chunks to avoid duplicates.
   */
  getExcludedFilePaths(): Set<string> {
    const firstBrowser = this.browserNames[0]
    const paths = new Set<string>()

    for (const chunk of this.#chunks.values()) {
      if (chunk.browserName !== firstBrowser) continue
      for (const suite of chunk.suites) {
        if (suite.excludeFromReporting) {
          for (const url of suite.filesURLs) {
            paths.add(url.pathname)
          }
        }
      }
    }

    return paths
  }

  /**
   * Returns the set of priority values whose chunks contain *only* suites marked
   * with `excludeFromReporting`. The orchestrator uses this to know which waves
   * should run after `runner:end` is emitted (i.e. after the reporter summary prints).
   */
  getExcludedOnlyPriorities(): Set<number> {
    const result = new Set<number>()
    const firstBrowser = this.browserNames[0]

    const tierMap = new Map<number, { allExcluded: boolean }>()

    for (const chunk of this.#chunks.values()) {
      if (chunk.browserName !== firstBrowser) continue
      const current = tierMap.get(chunk.priority) ?? { allExcluded: true }
      for (const suite of chunk.suites) {
        if (!suite.excludeFromReporting) {
          current.allExcluded = false
        }
      }
      tierMap.set(chunk.priority, current)
    }

    for (const [priority, { allExcluded }] of tierMap) {
      if (allExcluded) result.add(priority)
    }

    return result
  }
}
