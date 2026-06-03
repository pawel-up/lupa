import { chromium, firefox, webkit, type Browser, type Page } from 'playwright'
import { BrowserLogs } from './browser_logs.js'
import { CommandsHandler } from '../commands/rpc_handler.js'
import type { CoverageManager } from './coverage_manager.js'
import type { TestPoolManager } from './test_pool_manager.js'
import debug from './debug.js'
import type { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { colors } from './helpers.js'

export type BrowserName = 'chromium' | 'firefox' | 'webkit'

export class BrowserManager {
  #browsers = new Map<BrowserName, Browser>()
  #pages = new Map<string, Page>() // keyed by chunkId
  #browserNames: BrowserName[]
  #verboseLogs: boolean
  #emitter: Emitter<RunnerEvents>
  #configPath?: string

  // The set of chunk IDs expected to finish in the current wave,
  // and the resolve function for the current wave's completion promise.
  #currentWaveChunkIds = new Set<string>()
  #currentWaveFinished = new Set<string>()
  #resolveWave?: () => void

  constructor(browserNames: BrowserName[], verboseLogs: boolean, emitter: Emitter<RunnerEvents>, configPath?: string) {
    this.#browserNames = browserNames
    this.#verboseLogs = verboseLogs
    this.#emitter = emitter
    this.#configPath = configPath
  }

  async boot(testPoolManager: TestPoolManager, coverageManager?: CoverageManager) {
    for (const name of this.#browserNames) {
      if (name !== 'chromium' && coverageManager?.isEnabled) {
        console.warn(
          `\n⚠️  ${colors.yellow('Warning:')} Code coverage is only supported on Chromium-based browsers. Coverage collection will be skipped for ${name}.`
        )
      }

      debug('launching browser: %s', name)
      let browser: Browser
      if (name === 'firefox') browser = await firefox.launch()
      else if (name === 'webkit') browser = await webkit.launch()
      else browser = await chromium.launch()

      this.#browsers.set(name, browser)

      const chunkIds = testPoolManager.getChunkIdsForBrowser(name)

      for (const chunkId of chunkIds) {
        const page = await browser.newPage()
        this.#pages.set(chunkId, page)

        if (name === 'chromium' && coverageManager) {
          await coverageManager.startCoverage(page, name)
        }

        const logs = new BrowserLogs(page, this.#verboseLogs, this.#emitter, this.#configPath)
        logs.boot()

        const commandsHandler = new CommandsHandler(page)
        await commandsHandler.boot()

        // Capture chunkId in the closure so each page knows its own identity.
        const id = chunkId
        await page.exposeFunction('__lupa_runner_end__', () => {
          if (this.#currentWaveChunkIds.has(id)) {
            this.#currentWaveFinished.add(id)
            if (this.#currentWaveFinished.size >= this.#currentWaveChunkIds.size) {
              this.#resolveWave?.()
            }
          }
        })
      }
    }
  }

  /**
   * Navigates a specific subset of pages (identified by chunkIds) to the runner URL
   * and waits for all of them to signal completion before resolving.
   *
   * Called once per priority wave by the Orchestrator.
   */
  async navigateAndWait(urlBase: string, chunkIds: string[]): Promise<void> {
    const targetIds = chunkIds.filter((id) => this.#pages.has(id))
    if (targetIds.length === 0) return

    this.#currentWaveChunkIds = new Set(targetIds)
    this.#currentWaveFinished = new Set()

    const waveComplete = new Promise<void>((resolve) => {
      this.#resolveWave = resolve
    })

    await Promise.all(
      targetIds.map((chunkId) => {
        const page = this.#pages.get(chunkId)
        if (!page) {
          throw new Error(`Page for chunk ${chunkId} not found`)
        }
        const url = new URL(urlBase)
        url.searchParams.set('chunkId', chunkId)
        return page.goto(url.href)
      })
    )

    await waveComplete
  }

  async extractCoverage(coverageManager: CoverageManager) {
    for (const [chunkId, page] of this.#pages.entries()) {
      try {
        debug('extracting coverage for chunk %s', chunkId)
        const browserName = page.context().browser()?.browserType().name() || 'chromium'
        await coverageManager.collectPageCoverage(page, browserName)
      } catch (err) {
        console.error(`Failed to extract coverage for chunk ${chunkId}:`, err)
      }
    }
  }

  async close() {
    for (const [name, browser] of this.#browsers.entries()) {
      try {
        debug('closing browser %s', name)
        await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 1000))])
      } catch (error) {
        debug('error closing browser %s: %O', name, error)
      }
    }
    this.#browsers.clear()
    this.#pages.clear()
  }
}
