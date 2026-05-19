import os from 'node:os'
import { fileURLToPath } from 'node:url'
import type { NormalizedConfig, TestSuite } from './types.js'
import { PlannedTestSuite } from '../types.js'

/**
 * Represents a discrete chunk of tests assigned to a specific browser page slot.
 * A chunk contains a subset of the total test files, grouped by their originating
 * suites to maintain suite-specific configurations like timeout and retries.
 */
export interface TestChunk {
  /**
   * The unique identifier for this chunk (e.g., "chromium-0").
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
   * The list of test suites assigned to this chunk, along with their associated
   * configuration options and resolved file URLs.
   */
  suites: Omit<PlannedTestSuite, 'files'>[]
}

/**
 * Manages the partitioning (sharding) of test suites and files across multiple
 * browser instances and parallel pages.
 *
 * The `TestPoolManager` calculates the desired concurrency level and evenly
 * distributes the test workload into isolated `TestChunk` objects. Each chunk
 * is assigned a unique ID mapping to a specific Playwright page instance, enabling
 * isolated, parallel test execution.
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

    const allFiles: { suite: TestSuite; fileURL: URL }[] = []
    for (const suite of this.suites) {
      for (const fileURL of suite.filesURLs) {
        allFiles.push({ suite, fileURL })
      }
    }

    const actualConcurrency = Math.max(1, Math.min(concurrency, allFiles.length || 1))

    for (const browserName of this.browserNames) {
      const browserChunks: TestChunk[] = Array.from({ length: actualConcurrency }).map((_, i) => ({
        id: `${browserName}-${i}`,
        browserName,
        pageIndex: i,
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

  /**
   * Retrieves a specific test chunk by its unique identifier.
   * Used by the Vite harness middleware to serve the correct subset of test files
   * to a connecting browser page.
   *
   * @param chunkId - The unique ID of the chunk (e.g., "chromium-0").
   * @returns The corresponding TestChunk or undefined if not found.
   */
  getChunk(chunkId: string): TestChunk | undefined {
    return this.#chunks.get(chunkId)
  }

  /**
   * Retrieves all chunk IDs assigned to a specific browser.
   * Used by the BrowserManager to boot the correct number of pages per browser.
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
   * Finds the chunk ID that contains a given file path for the specified browser.
   * Falls back to `<browserName>-0` when no chunk contains the file.
   *
   * @param browserName - The name of the browser (e.g., "chromium").
   * @param filePath - An absolute path or path suffix to look for.
   * @returns The matching chunk ID, or the default first chunk for that browser.
   */
  getChunkIdForFile(browserName: string, filePath: string): string {
    const defaultChunkId = `${browserName}-0`
    return (
      this.getChunkIdsForBrowser(browserName).find((id) => {
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
   * Returns the total number of test files across all chunks and browsers.
   * This represents the exact number of files that will be processed.
   *
   * @returns Total number of test files
   */
  getFilesCount(): number {
    const fileFilters = this.config.filters?.files

    return Array.from(this.#chunks.values()).reduce((acc, chunk) => {
      return (
        acc +
        chunk.suites.reduce((sum, s) => {
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
}
