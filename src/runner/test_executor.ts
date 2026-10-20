import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { Runner } from './runner.js'
import debug from './debug.js'
import type { Orchestrator } from './orchestrator.js'
import type { TestPoolManager } from './test_pool_manager.js'

const DEFAULT_GLOBAL_TIMEOUT = 120_000

/**
 * Handles test suite execution cycles, reporter registration, tag/title filtering,
 * execution timeouts, and wave-based browser test dispatching.
 */
export class TestExecutor {
  #orchestrator: Orchestrator
  #runnerEnded = false

  public isRunning = false
  public activeNodeRunner?: Runner
  public activeNodeEmitter?: Emitter<RunnerEvents>
  public globalTimeout?: ReturnType<typeof setTimeout>

  constructor(orchestrator: Orchestrator) {
    this.#orchestrator = orchestrator
  }

  /**
   * Clears active global timeout timer if pending.
   */
  public clearGlobalTimeout(): void {
    if (this.globalTimeout) {
      clearTimeout(this.globalTimeout)
      this.globalTimeout = undefined
    }
  }

  /**
   * Ends active node runner gracefully during shutdown.
   */
  public async cleanupActiveRunner(): Promise<void> {
    if (this.activeNodeRunner && this.isRunning) {
      if (!this.#runnerEnded) {
        try {
          this.#runnerEnded = true
          await this.activeNodeRunner.end()
        } catch (error) {
          debug('error ending runner: %O', error)
        }
      }
      this.isRunning = false
    }
  }

  /**
   * Executes the configured test suites.
   */
  public async execute(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    const { config, cliArgs, poolManager, cli, reporters, refinerFilters, exceptionsManager } = this.#orchestrator

    const isFocusedMode = cli.isFocused
    const isFocusedRunning = cli.isFocusedRunning(config.filters?.files)

    if (this.#orchestrator.isWatchMode) {
      if (isFocusedRunning) {
        console.clear()
      }
      cli.clearEventBufferFor(config.filters?.files)
    }

    this.#runnerEnded = false
    this.activeNodeEmitter = new Emitter<RunnerEvents>()

    if (!poolManager) {
      throw new Error('Cannot execute tests: Orchestrator is not booted.')
    }
    this.activeNodeRunner = new Runner(this.activeNodeEmitter, config, poolManager)

    const executeTeardowns: (() => void | Promise<void>)[] = []

    if (config.runnerPlugins) {
      for (const plugin of config.runnerPlugins) {
        if (plugin.execute) {
          try {
            const teardown = await plugin.execute({
              config,
              cliArgs,
              runner: this.activeNodeRunner,
              emitter: this.activeNodeEmitter,
            })
            if (typeof teardown === 'function') {
              executeTeardowns.push(teardown)
            }
          } catch (error) {
            debug('error executing plugin execute hook: %O', error)
            exceptionsManager.notifyException(error as Error)
          }
        }
      }
    }

    if (executeTeardowns.length > 0) {
      let ran = false
      this.activeNodeEmitter.on('runner:end', async () => {
        if (ran) return
        ran = true
        for (const teardown of executeTeardowns) {
          try {
            await teardown()
          } catch (error) {
            debug('error executing plugin run teardown: %O', error)
            exceptionsManager.notifyException(error as Error)
          }
        }
      })
    }

    this.activeNodeRunner.reporterEmitter = cli.createFilteredEmitter(this.activeNodeEmitter)

    this.activeNodeEmitter.on('test:end', (payload: any) => {
      const filePath = payload.file || payload.meta?.file || payload.meta?.fileName
      if (filePath) {
        const hash = this.#orchestrator.testCache.computeFileHash(filePath, this.#orchestrator.vite)
        const status = payload.hasError ? 'fail' : 'pass'
        this.#orchestrator.testCache.recordResult(filePath, hash, status, [])
      }
    })

    reporters.forEach((reporter) => {
      debug('registering "%s" reporter', reporter.name)
      this.activeNodeRunner?.registerReporter(reporter)
    })

    refinerFilters.forEach((filter) => {
      debug('apply %s filters "%O" ', filter.layer, filter.filters)
      config.refiner.add(filter.layer, filter.filters)
    })

    config.refiner.matchAllTags(cliArgs.matchAll ?? false)

    const estimatedTotalFiles = this.#computeEstimatedTotalFiles(poolManager, isFocusedRunning)

    await this.activeNodeRunner.start({ estimatedTotalFiles, isFocused: isFocusedMode })

    if (this.#orchestrator.isWatchMode && !isFocusedMode && config.filters?.files && config.filters.files.length > 0) {
      await cli.replayCachedEventsForUnchangedFiles(this.activeNodeEmitter, config.filters.files)
    }

    if (!this.#orchestrator.isWatchMode) {
      this.globalTimeout = setTimeout(async () => {
        console.error('\n\nGlobal timeout reached. The test run took too long and was forcefully terminated.')
        console.error('Consider increasing the timeout or checking for infinite loops in your tests.\n')

        this.#orchestrator.resolveCompletion(1)
        await this.#orchestrator.shutdown(1)
      }, DEFAULT_GLOBAL_TIMEOUT)
      this.globalTimeout?.unref()
    }

    if (this.#orchestrator.isWatchMode) {
      try {
        await this.#runWaves()
      } catch (err) {
        exceptionsManager.notifyException(err)
      }
    } else {
      this.#runWaves().catch((err) => exceptionsManager.notifyException(err))
    }
  }

  async #runWaves(): Promise<void> {
    const { poolManager, browserManager, browserNames, serverUrl, isWatchMode, cli, telemetry, exceptionsManager } =
      this.#orchestrator

    if (!poolManager || !browserManager || !this.activeNodeRunner) {
      this.isRunning = false
      return
    }

    const tiers = poolManager.getChunkIdsByTier(browserNames[0])

    if (tiers.size === 0) {
      if (this.activeNodeRunner && !this.#runnerEnded) {
        this.#runnerEnded = true
        await this.activeNodeRunner.end()
      }
      this.isRunning = false
      if (!isWatchMode) {
        await this.#orchestrator.shutdown(0)
      } else {
        cli.printWaitingMessage()
      }
      return
    }

    try {
      const excludedOnlyPriorities = poolManager.getExcludedOnlyPriorities()

      for (const [priority] of tiers) {
        if (this.#orchestrator.isShuttingDown) {
          break
        }
        const allBrowserChunkIds = browserNames.flatMap((b) => poolManager.getChunkIdsByTier(b).get(priority) ?? [])
        const activeChunkIds = allBrowserChunkIds.filter((id) =>
          poolManager.hasFilesForChunk(id, this.#orchestrator.config.filters?.files)
        )
        if (activeChunkIds.length === 0) continue

        await browserManager.navigateAndWait(`${serverUrl}__lupa__/runner.html`, activeChunkIds)

        if (this.#orchestrator.isShuttingDown) {
          break
        }

        if (!excludedOnlyPriorities.has(priority)) {
          const remainingTiers = [...tiers.keys()].filter((p) => p < priority)
          const hasMoreReportingTiers = remainingTiers.some((p) => !excludedOnlyPriorities.has(p))
          if (!hasMoreReportingTiers && !this.#runnerEnded) {
            await telemetry.drainTelemetry()
            this.#runnerEnded = true
            await this.activeNodeRunner.end()
          }
        }
      }

      this.clearGlobalTimeout()

      await telemetry.drainTelemetry()

      if (this.activeNodeRunner && !this.#runnerEnded) {
        this.#runnerEnded = true
        await this.activeNodeRunner.end()
      }

      try {
        if (browserManager && this.#orchestrator.serverManager?.coverageManager) {
          await browserManager.extractCoverage(this.#orchestrator.serverManager.coverageManager)
          await this.#orchestrator.serverManager.coverageManager.generateReport(exceptionsManager)
        }
      } catch (err) {
        console.error('Failed to extract coverage:', err)
      }

      const exitCode = (this.activeNodeRunner && this.activeNodeRunner.failed) || exceptionsManager.hasErrors ? 1 : 0

      this.#orchestrator.resolveCompletion(exitCode)

      if (!isWatchMode) {
        await this.#orchestrator.shutdown(exitCode)
      } else {
        if (cli.isFocusedRunning(this.#orchestrator.config.filters?.files)) {
          cli.printWaitingMessage()
        }
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Computes the estimated total number of test files for the current execution cycle.
   */
  #computeEstimatedTotalFiles(poolManager: TestPoolManager, isFocusedRunning: boolean): number {
    const { isWatchMode, cli } = this.#orchestrator

    if (cli.isFocused) {
      return isFocusedRunning ? 1 : poolManager.getFilesCount()
    }

    if (isWatchMode) {
      return cli.originalFilesFilter?.length ?? poolManager.getFilesCount(true)
    }

    return poolManager.getFilesCount()
  }
}
