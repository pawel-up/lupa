import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ViteDevServer } from 'vite'
import debug from './debug.js'

export interface CachedTestFileResult {
  hash: string
  status: 'pass' | 'fail'
  events: { eventName: string; data: any }[]
}

/**
 * Caches test file outcomes and dependency tree hashes for instant feedback in watch mode.
 */
export class TestCache {
  #cache = new Map<string, CachedTestFileResult>()

  /**
   * Computes a combined SHA-256 hash of a test file and its imported dependency graph.
   *
   * @param filePath - Absolute path to the test file.
   * @param viteServer - Optional Vite development server to inspect the module dependency graph.
   */
  public computeFileHash(filePath: string, viteServer?: ViteDevServer): string {
    const hash = createHash('sha256')

    try {
      const content = readFileSync(filePath, 'utf-8')
      hash.update(content)
    } catch {
      hash.update(filePath)
    }

    if (viteServer?.moduleGraph) {
      const mods = viteServer.moduleGraph.getModulesByFile(filePath)
      if (mods && mods.size > 0) {
        const visited = new Set<string>()
        const queue = Array.from(mods)

        while (queue.length > 0) {
          const mod = queue.shift()
          if (!mod || !mod.file || visited.has(mod.file)) continue
          visited.add(mod.file)

          if (mod.file !== filePath) {
            try {
              const depContent = readFileSync(mod.file, 'utf-8')
              hash.update(mod.file)
              hash.update(depContent)
            } catch {
              hash.update(mod.file)
            }
          }

          if (mod.importedModules) {
            for (const importedMod of mod.importedModules) {
              queue.push(importedMod)
            }
          }
        }
      }
    }

    return hash.digest('hex')
  }

  /**
   * Checks if a test file has a valid, passing cached result matching the current hash.
   *
   * @param filePath - Absolute path to the test file.
   * @param currentHash - Current computed hash of the test file and its dependencies.
   */
  public hasValidPass(filePath: string, currentHash: string): boolean {
    const entry = this.#cache.get(filePath)
    if (!entry) return false
    return entry.status === 'pass' && entry.hash === currentHash
  }

  /**
   * Retrieves the cached entry for a test file.
   *
   * @param filePath - Absolute path to the test file.
   */
  public get(filePath: string): CachedTestFileResult | undefined {
    return this.#cache.get(filePath)
  }

  /**
   * Records or updates the test result cache for a file.
   *
   * @param filePath - Absolute path to the test file.
   * @param hash - Computed hash for the test file and dependencies.
   * @param status - Overall status ('pass' or 'fail').
   * @param events - Stream of events captured for this test file.
   */
  public recordResult(
    filePath: string,
    hash: string,
    status: 'pass' | 'fail',
    events: { eventName: string; data: any }[]
  ): void {
    debug('recording test cache for %s (status: %s)', filePath, status)
    this.#cache.set(filePath, { hash, status, events })
  }

  /**
   * Invalidates cache entry for a specific test file.
   *
   * @param filePath - Absolute path to the test file.
   */
  public invalidate(filePath: string): void {
    this.#cache.delete(filePath)
  }

  /**
   * Clears all cached test results.
   */
  public clear(): void {
    this.#cache.clear()
  }
}
