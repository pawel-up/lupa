import { type ViteDevServer } from 'vite'
import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { BrowserManager } from './browser_manager.js'
import { ServerManager } from './server_manager.js'
import { TestPoolManager } from './test_pool_manager.js'
import debug from './debug.js'
import type { Orchestrator } from './orchestrator.js'

/**
 * Options for shutdown operations.
 */
export interface ShutdownOptions {
  /**
   * Set to true to prevent terminating the Node process.
   */
  preventExit?: boolean
}

/**
 * Manages the environment lifecycle (boot, server startup, browser management,
 * plugin hooks, coverage reporting, and graceful process shutdown).
 */
export class LifecycleManager {
  #orchestrator: Orchestrator
  #pluginTeardowns: (() => void | Promise<void>)[] = []
  #shutdownPromise: Promise<void> | null = null
  #preventExit = false

  public vite?: ViteDevServer
  public serverManager?: ServerManager
  public browserManager?: BrowserManager
  public poolManager?: TestPoolManager
  public browserEmitter!: Emitter<RunnerEvents>
  public serverUrl?: string

  constructor(orchestrator: Orchestrator) {
    this.#orchestrator = orchestrator
  }

  /**
   * Registers teardown callbacks from plugin plan and boot phases.
   *
   * @param teardowns - Teardown functions to register.
   */
  public registerTeardowns(teardowns: (() => void | Promise<void>)[]): void {
    this.#pluginTeardowns.push(...teardowns)
  }

  /**
   * Boots the test environment: exception monitoring, plugins, pool manager,
   * Vite dev server, and Playwright browser instances.
   */
  public async boot(): Promise<void> {
    const { config, cliArgs, exceptionsManager, browserNames, suites } = this.#orchestrator

    exceptionsManager.monitor()

    if (config.runnerPlugins) {
      for (const plugin of config.runnerPlugins) {
        if (plugin.boot) {
          try {
            const teardown = await plugin.boot({ config, cliArgs })
            if (typeof teardown === 'function') {
              this.#pluginTeardowns.push(teardown)
            }
          } catch (error) {
            debug('error executing plugin boot hook: %O', error)
            exceptionsManager.notifyException(error as Error)
          }
        }
      }
    }

    this.poolManager = new TestPoolManager(config, browserNames, suites)
    this.#orchestrator.cli.setExcludedFilePaths(this.poolManager.getExcludedFilePaths())

    if (!this.serverManager) {
      this.serverManager = new ServerManager(this.#orchestrator, {
        cwd: config.cwd || process.cwd(),
        config,
        poolManager: this.poolManager,
      })
    }

    if (!this.serverUrl) {
      this.serverUrl = await this.serverManager.boot()
    }
    this.vite = this.serverManager.vite

    this.browserEmitter = new Emitter<RunnerEvents>()
    this.browserEmitter.on('browser:log', async (payload) => {
      if (this.#orchestrator.executor?.activeNodeEmitter) {
        await this.#orchestrator.executor.activeNodeEmitter.emit('browser:log', payload)
      }
    })

    if (!this.browserManager) {
      this.browserManager = new BrowserManager(browserNames, !!cliArgs.verbose, this.browserEmitter, config.configPath)
    }

    await this.browserManager.boot(this.poolManager, this.serverManager.coverageManager)
  }

  /**
   * Shuts down the entire test environment in an orderly sequence.
   *
   * @param exitCode - The exit code to terminate with.
   * @param options - Additional options, e.g. to prevent terminating the Node process.
   */
  public async shutdown(exitCode: number, options: ShutdownOptions = {}): Promise<void> {
    if (options.preventExit) {
      this.#preventExit = true
    }

    if (this.#shutdownPromise) {
      return this.#shutdownPromise
    }

    this.#shutdownPromise = (async () => {
      this.#orchestrator.isShuttingDown = true
      debug('shutting down (exit code: %d)', exitCode)

      const { config, cliArgs, exceptionsManager, executor, cli } = this.#orchestrator

      if (config.runnerPlugins) {
        for (const plugin of config.runnerPlugins) {
          if (plugin.shutdown) {
            try {
              await plugin.shutdown({ config, cliArgs, exitCode })
            } catch (error) {
              debug('error executing plugin shutdown hook: %O', error)
              exceptionsManager.notifyException(error as Error)
            }
          }
        }
      }

      for (const teardown of this.#pluginTeardowns) {
        try {
          await teardown()
        } catch (error) {
          debug('error executing plugin teardown hook: %O', error)
          exceptionsManager.notifyException(error as Error)
        }
      }

      if (executor) {
        executor.clearGlobalTimeout()
        await executor.cleanupActiveRunner()
      }

      await exceptionsManager.report()

      try {
        if (cli.debugBrowser) {
          debug('closing debug browser')
          await Promise.race([cli.debugBrowser.close(), new Promise((r) => setTimeout(r, 1000))])
          cli.debugBrowser = undefined
        }
      } catch (error) {
        debug('error closing debug browser: %O', error)
      }

      try {
        if (this.browserManager && this.serverManager?.coverageManager) {
          await this.browserManager.extractCoverage(this.serverManager.coverageManager)
          await this.serverManager.coverageManager.generateReport(exceptionsManager)
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

      if (exceptionsManager.hasErrors) {
        exitCode = 1
      }

      if (!this.#preventExit) {
        process.exit(exitCode)
      }
    })()

    return this.#shutdownPromise
  }
}
