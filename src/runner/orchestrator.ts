import { type ViteDevServer } from 'vite'
import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { Runner } from './runner.js'
import { ExceptionsManager } from './exceptions_manager.js'
import { BrowserManager, type BrowserName } from './browser_manager.js'
import { ServerManager, type ServerTelemetryContract } from './server_manager.js'
import { TestPoolManager } from './test_pool_manager.js'
import debug from './debug.js'
import { Cli } from './cli.js'
import type { NormalizedConfig, CLIArgs } from './types.js'
import type { NamedReporterContract } from '../types.js'

const DEFAULT_GLOBAL_TIMEOUT = 120_000

/**
 * The `Orchestrator` is the central component of the Lupa test framework.
 * It manages the entire lifecycle of a test execution run, including:
 * - Bootstrapping the Vite server for bundling test assets
 * - Launching and managing browser instances via Playwright
 * - Managing the test file pool and chunks
 * - Handling global errors and unhandled exceptions
 * - Emitting runner lifecycle events and telemetry logs
 * - Running tests in watch mode and providing a CLI for dynamic interaction
 */
export class Orchestrator implements ServerTelemetryContract {
  /** The underlying Vite development server instance. */
  public vite?: ViteDevServer

  /** Timer used to forcefully terminate the runner if execution takes too long. */
  public globalTimeout?: ReturnType<typeof setTimeout>

  /** Indicates if the orchestrator is currently in the process of shutting down. */
  public isShuttingDown = false

  /** Manager responsible for browser instances and Playwright contexts. */
  public browserManager?: BrowserManager

  /** Tracks global exceptions and unhandled promise rejections. */
  public exceptionsManager: ExceptionsManager

  /** Manager responsible for splitting test files into executable chunks. */
  public testPoolManager?: TestPoolManager

  /** Manager for the Vite server and RPC endpoints. */
  public serverManager?: ServerManager

  /** Indicates if a test execution run is currently in progress. */
  public isRunning = false

  /** The telemetry runner instance active during the current execution cycle. */
  public activeNodeRunner?: Runner

  /** The event emitter active for the current execution cycle, distributing runner events. */
  public activeNodeEmitter?: Emitter<RunnerEvents>

  /** A persistent event emitter specifically for handling browser log events. */
  public browserEmitter!: Emitter<RunnerEvents>

  /** The fully qualified URL of the local Vite development server. */
  public serverUrl?: string

  /** An array of browser names (e.g., 'chromium', 'firefox', 'webkit') to run tests in. */
  public browserNames: BrowserName[]

  /** The interactive CLI interface for watch mode. */
  public cli: Cli

  /** Teardowns collected from plan and boot plugin phases */
  #pluginTeardowns: (() => void | Promise<void>)[] = []

  /**
   * Constructs a new Orchestrator instance.
   *
   * @param config - The normalized configuration object for the runner.
   * @param cliArgs - Command-line arguments passed to the runner.
   * @param reporters - An array of reporter instances to handle test outputs.
   * @param suites - An array of configured test suites to be executed.
   * @param refinerFilters - An array of tag/title filters to restrict test execution.
   */
  constructor(
    public config: NormalizedConfig,
    public cliArgs: CLIArgs,
    public reporters: NamedReporterContract[],
    public suites: any[],
    public refinerFilters: any[]
  ) {
    const rawBrowsers = cliArgs.browser || ['chromium']
    this.browserNames = (Array.isArray(rawBrowsers) ? rawBrowsers : [rawBrowsers]) as BrowserName[]
    this.exceptionsManager = new ExceptionsManager()

    this.cli = new Cli(this)
  }

  /**
   * Register teardown functions from plugins (e.g. from the plan phase)
   */
  registerTeardowns(teardowns: (() => void | Promise<void>)[]) {
    this.#pluginTeardowns.push(...teardowns)
  }

  /**
   * Indicates if the orchestrator is running in watch mode, meaning it will
   * keep the process alive and re-run tests on file changes.
   */
  get isWatchMode() {
    return this.cliArgs.watch === true
  }

  /**
   * Gets the primary/default browser type selected for the current run.
   * Useful for debugging and default assignments.
   */
  get defaultBrowserType() {
    return this.browserNames[0]
  }

  #completionPromise?: Promise<number>
  #resolveCompletion?: (code: number) => void
  #rejectCompletion?: (error: any) => void
  #runnerEnded = false

  /**
   * Returns a promise that resolves with the exit code when the test run completes.
   */
  async waitForCompletion(): Promise<number> {
    if (!this.#completionPromise) {
      this.#completionPromise = new Promise((resolve, reject) => {
        this.#resolveCompletion = resolve
        this.#rejectCompletion = reject
      })
    }
    return this.#completionPromise
  }

  /**
   * Boots the test environment.
   * Initializes the exceptions monitor, server, browser instances, and test pools.
   * This method sets up the environment to be ready for `executeTests()`.
   */
  async boot() {
    this.exceptionsManager.monitor()

    if (this.config.runnerPlugins) {
      for (const plugin of this.config.runnerPlugins) {
        if (plugin.boot) {
          const teardown = await plugin.boot({ config: this.config, cliArgs: this.cliArgs })
          if (typeof teardown === 'function') {
            this.#pluginTeardowns.push(teardown)
          }
        }
      }
    }

    this.testPoolManager = new TestPoolManager(this.config, this.browserNames, this.suites)
    this.cli.setExcludedFilePaths(this.testPoolManager.getExcludedFilePaths())

    this.serverManager = new ServerManager(this, {
      cwd: this.config.cwd || process.cwd(),
      config: this.config,
      testPoolManager: this.testPoolManager,
      exceptionsManager: this.exceptionsManager,
    })

    this.serverUrl = await this.serverManager.boot()
    this.vite = this.serverManager.vite

    this.browserEmitter = new Emitter<RunnerEvents>()
    this.browserEmitter.on('browser:log', async (payload) => {
      if (this.activeNodeEmitter) {
        await this.activeNodeEmitter.emit('browser:log', payload)
      }
    })

    this.browserManager = new BrowserManager(this.browserNames, !!this.cliArgs.verbose, this.browserEmitter)

    await this.browserManager.boot(this.testPoolManager, this.serverManager?.coverageManager)
  }

  /**
   * Shuts down the entire test environment.
   * Clears timeouts, reports global exceptions, generates code coverage, and terminates
   * all browser instances and the Vite server before exiting the process.
   *
   * @param exitCode - The process exit code to terminate with (0 for success, 1 for failure).
   * @param options - Additional options, e.g., to prevent terminating the Node process.
   */
  async shutdown(exitCode: number, options: { preventExit?: boolean } = {}) {
    if (this.isShuttingDown) return
    this.isShuttingDown = true
    debug('shutting down (exit code: %d)', exitCode)

    if (this.config.runnerPlugins) {
      for (const plugin of this.config.runnerPlugins) {
        if (plugin.shutdown) {
          try {
            await plugin.shutdown({ config: this.config, cliArgs: this.cliArgs, exitCode })
          } catch (error) {
            debug('error executing plugin shutdown hook: %O', error)
          }
        }
      }
    }

    for (const teardown of this.#pluginTeardowns) {
      try {
        await teardown()
      } catch (error) {
        debug('error executing plugin teardown hook: %O', error)
      }
    }

    if (this.globalTimeout) {
      clearTimeout(this.globalTimeout)
      this.globalTimeout = undefined
    }

    if (this.activeNodeRunner && this.isRunning) {
      try {
        await this.activeNodeRunner.end()
      } catch (error) {
        debug('error ending runner: %O', error)
      } finally {
        this.isRunning = false
      }
    }

    await this.exceptionsManager.report()

    try {
      if (this.cli?.debugBrowser) {
        debug('closing debug browser')
        await Promise.race([this.cli.debugBrowser.close(), new Promise((r) => setTimeout(r, 1000))])
        this.cli.debugBrowser = undefined
      }
    } catch (error) {
      debug('error closing debug browser: %O', error)
    }

    try {
      if (this.browserManager && this.serverManager?.coverageManager) {
        await this.browserManager.extractCoverage(this.serverManager.coverageManager)
        await this.serverManager.coverageManager.generateReport(this.exceptionsManager)
      }
    } catch (err) {
      console.error('Failed to extract coverage:', err)
    }

    try {
      if (this.browserManager) {
        debug('closing browser manager')
        await this.browserManager.close()
        this.browserManager = undefined
      }
    } catch (error) {
      debug('error closing browser manager: %O', error)
    }

    try {
      if (this.vite) {
        debug('closing Vite server')
        await this.vite.close()
        this.vite = undefined
      }
    } catch (error) {
      debug('error closing Vite: %O', error)
    }

    if (this.exceptionsManager.hasErrors) {
      exitCode = 1
    }

    if (!options.preventExit) {
      process.exit(exitCode)
    }
  }

  /**
   * Executes the test suites.
   * Initializes the current runner cycle, applies tag filters, wires up reporters,
   * starts the global timeout monitor, and commands browsers to navigate to the test runner URL.
   */
  async executeTests() {
    if (this.isRunning) return
    this.isRunning = true

    if (this.isWatchMode) {
      console.clear()
      this.cli.clearEventBufferFor(this.config.filters?.files)
    }

    this.#runnerEnded = false
    this.activeNodeEmitter = new Emitter<RunnerEvents>()
    this.activeNodeRunner = new Runner(this.activeNodeEmitter, this.config)

    const executeTeardowns: (() => void | Promise<void>)[] = []

    if (this.config.runnerPlugins) {
      for (const plugin of this.config.runnerPlugins) {
        if (plugin.execute) {
          const teardown = await plugin.execute({
            config: this.config,
            cliArgs: this.cliArgs,
            runner: this.activeNodeRunner,
            emitter: this.activeNodeEmitter,
          })
          if (typeof teardown === 'function') {
            executeTeardowns.push(teardown)
          }
        }
      }
    }

    if (executeTeardowns.length > 0) {
      this.activeNodeEmitter.on('runner:end', async () => {
        for (const teardown of executeTeardowns) {
          try {
            await teardown()
          } catch (error) {
            debug('error executing plugin run teardown: %O', error)
          }
        }
      })
    }

    // Set reporterEmitter to filtered output so reporters don't see non-focused events
    this.activeNodeRunner.reporterEmitter = this.cli.createFilteredEmitter(this.activeNodeEmitter)

    this.reporters.forEach((reporter) => {
      debug('registering "%s" reporter', reporter.name)
      this.activeNodeRunner?.registerReporter(reporter)
    })

    this.refinerFilters.forEach((filter) => {
      debug('apply %s filters "%O" ', filter.layer, filter.filters)
      this.config.refiner.add(filter.layer, filter.filters)
    })

    this.config.refiner.matchAllTags(this.cliArgs.matchAll ?? false)

    const estimatedTotalFiles = this.testPoolManager?.getFilesCount() || 0

    await this.activeNodeRunner.start({ estimatedTotalFiles })

    if (!this.isWatchMode) {
      this.globalTimeout = setTimeout(async () => {
        console.error('\n\nGlobal timeout reached. The test run took too long and was forcefully terminated.')
        console.error('Consider increasing the timeout or checking for infinite loops in your tests.\n')

        if (this.#resolveCompletion) {
          this.#resolveCompletion(1)
        }
        await this.shutdown(1)
      }, DEFAULT_GLOBAL_TIMEOUT)
      this.globalTimeout?.unref()
    }

    // Execute each priority tier sequentially, highest priority first.
    // This runs as a detached promise so executeTests() returns immediately —
    // matching the original behaviour where goto() returned before tests ran.
    this.#runWaves().catch((err) => this.exceptionsManager.notifyException(err))
  }

  async #runWaves() {
    if (!this.testPoolManager || !this.browserManager || !this.activeNodeRunner) {
      return
    }
    const { testPoolManager, browserManager } = this
    const tiers = testPoolManager.getChunkIdsByTier(this.browserNames[0])

    if (tiers.size === 0) {
      // No files to run — the test harness will signal runner end via the browser.
      // Nothing to do here; completion is driven by the existing runner:end event path.
      return
    }

    const excludedOnlyPriorities = testPoolManager.getExcludedOnlyPriorities()

    for (const [priority] of tiers) {
      const allBrowserChunkIds = this.browserNames.flatMap(
        (b) => testPoolManager.getChunkIdsByTier(b).get(priority) ?? []
      )
      await browserManager.navigateAndWait(`${this.serverUrl}__lupa__/runner.html`, allBrowserChunkIds)

      // After the last reporting wave completes, drain telemetry and end the runner
      // so the reporter prints its summary before any excluded (e.g. benchmark) waves run.
      if (!excludedOnlyPriorities.has(priority)) {
        const remainingTiers = [...tiers.keys()].filter((p) => p < priority)
        const hasMoreReportingTiers = remainingTiers.some((p) => !excludedOnlyPriorities.has(p))
        if (!hasMoreReportingTiers && !this.#runnerEnded) {
          await this.serverManager?.drainTelemetry()
          this.#runnerEnded = true
          await this.activeNodeRunner.end()
        }
      }
    }

    if (this.globalTimeout) {
      clearTimeout(this.globalTimeout)
      this.globalTimeout = undefined
    }

    // Final drain + end in case all tiers were excluded-only (no reporting waves).
    await this.serverManager?.drainTelemetry()

    if (this.activeNodeRunner && !this.#runnerEnded) {
      this.#runnerEnded = true
      await this.activeNodeRunner.end()
    }

    try {
      if (this.browserManager && this.serverManager?.coverageManager) {
        await this.browserManager.extractCoverage(this.serverManager.coverageManager)
        await this.serverManager.coverageManager.generateReport(this.exceptionsManager)
      }
    } catch (err) {
      console.error('Failed to extract coverage:', err)
    }

    this.isRunning = false

    const exitCode = (this.activeNodeRunner && this.activeNodeRunner.failed) || this.exceptionsManager.hasErrors ? 1 : 0

    if (this.#resolveCompletion) {
      this.#resolveCompletion(exitCode)
    }

    if (!this.isWatchMode) {
      await this.shutdown(exitCode)
    } else {
      this.cli.printWaitingMessage()
    }
  }

  async handleCompilationError(error: Error, bail: boolean): Promise<void> {
    this.exceptionsManager.notifyException(error)
    if (bail) {
      if (this.#rejectCompletion) {
        this.#rejectCompletion(error)
      } else {
        await this.shutdown(1)
      }
    }
  }

  async handleTelemetry<K extends keyof RunnerEvents>(event: K, data: RunnerEvents[K]): Promise<void> {
    if (this.activeNodeEmitter) {
      await this.activeNodeEmitter.emit(event, data)
    }
  }
}
