import { resolve, dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer, createLogger, mergeConfig, type ViteDevServer, type InlineConfig } from 'vite'

import type { NormalizedConfig, JsonSerializable } from './types.js'
import type { TestPoolManager } from './test_pool_manager.js'
import type { RunnerEvents } from '../types.js'
import { CoverageManager } from './coverage_manager.js'
import { ExceptionsManager } from './exceptions_manager.js'
import { transformBrowserStack } from './stack_transformer.js'
import { formatPinnedTest, printPinnedTests, colors } from './helpers.js'
import lupaHarnessPlugin from './plugins/harness.js'
import type { Orchestrator } from './orchestrator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const harnessTs = resolve(__dirname, '../testing/harness.ts')
const harnessPath = existsSync(harnessTs) ? harnessTs : resolve(__dirname, '../testing/harness.js')

export type TelemetryPayload = {
  [K in keyof RunnerEvents]: { event: K; data: RunnerEvents[K] }
}[keyof RunnerEvents]

export interface ServerManagerOptions {
  cwd: string
  config: NormalizedConfig
  testPoolManager: TestPoolManager
  exceptionsManager: ExceptionsManager
}

/**
 * A contract that defines the telemetry API exposed by the runner server.
 * Must be implemented by any runner type that wants to use the server manager.
 */
export interface ServerTelemetryContract {
  /**
   * Handle compilation errors.
   * @param error The error to handle.
   * @param bail Whether to bail out of the test run.
   */
  handleCompilationError(error: Error, bail: boolean): Promise<void>

  /**
   * Handle telemetry events.
   * @param event The telemetry event name to handle.
   * @param data The telemetry event data.
   */
  handleTelemetry<K extends keyof RunnerEvents>(event: K, data: RunnerEvents[K]): Promise<void>
}

/**
 * Manages the Vite development server lifecycle and WebSocket telemetry.
 */
export class ServerManager {
  #orchestrator: Orchestrator
  #vite?: ViteDevServer
  #options: ServerManagerOptions
  #telemetryQueue: Promise<void> = Promise.resolve()
  #coverageManager?: CoverageManager

  constructor(orchestrator: Orchestrator, options: ServerManagerOptions) {
    this.#orchestrator = orchestrator
    this.#options = options
  }

  /**
   * Boots the Vite server and returns the local server URL.
   */
  async boot(): Promise<string> {
    const { cwd, config, testPoolManager, exceptionsManager } = this.#options

    const logger = createLogger('silent')
    const _error = logger.error
    logger.error = (msg, options) => {
      console.error(`\n${colors.red('[Vite Compilation Error]')} ${msg}`)
      if (options?.error) {
        console.error(options.error)
      }
      _error.call(logger, msg, options)
      const err = (options?.error || new Error(msg)) as Error
      this.#orchestrator.handleCompilationError(err, !config.watch)
    }

    const resolvedPlugins: (JsonSerializable | undefined)[][] = await Promise.all(
      (config.testPlugins || []).map(async (plugin) => {
        const [specifier, options] = Array.isArray(plugin) ? plugin : [plugin, undefined]
        let url = specifier as string
        try {
          const resolved = import.meta.resolve(url, pathToFileURL(cwd + '/').href)
          if (resolved.startsWith('file://')) {
            url = '/@fs' + fileURLToPath(resolved)
          } else {
            url = resolved
          }
        } catch {
          // Leave as is, let the browser fail and report it
        }
        return [url, options]
      })
    )

    const baseViteConfig: InlineConfig = {
      root: cwd,
      configFile: config.viteConfig,
      customLogger: logger,
      server: {
        host: true,
        port: 0, // Force dynamic port to avoid conflicts
        fs: {
          allow: [process.cwd(), join(__dirname, '../')],
        },
      },
      optimizeDeps: {
        include: ['axe-core', 'lit-html', 'lit'],
        exclude: ['@pawel-up/lupa'],
      },
      plugins: [lupaHarnessPlugin(testPoolManager, resolvedPlugins, config, harnessPath)],
    }

    const finalViteConfig = config.vite ? mergeConfig(baseViteConfig, config.vite) : baseViteConfig

    this.#coverageManager = new CoverageManager(config.coverage, config.exclude)
    await this.#coverageManager.instrumentViteConfig(finalViteConfig)

    if (finalViteConfig.server?.middlewareMode) {
      throw new Error('Lupa cannot run with server.middlewareMode enabled in your Vite configuration.')
    }

    // Start Vite Server
    this.#vite = await createServer(finalViteConfig)

    // Intercept full-reload events to detect optimizeDeps invalidations.
    // Note: We override ws.send() instead of using ws.on('full-reload') because
    // 'full-reload' is an OUTGOING message sent by Vite to the browser. Vite
    // does not emit a server-side event for this, so patching send() is the
    // only way to intercept it.
    const originalWsSend = this.#vite.ws.send
    this.#vite.ws.send = function (payload: any, ...rest: any[]) {
      if (payload.type === 'full-reload') {
        if (!config.watch) {
          console.warn(
            `\n${colors.yellow('⚠️ Vite discovered new dependencies mid-run. This will cause a 504 error in headless mode.')}`
          )
          console.warn(`${colors.yellow('Please add these explicitly to optimizeDeps.include in lupa.config.ts.')}\n`)
        }
      }
      originalWsSend.call(this, payload, ...rest)
    }

    // Set up WebSocket telemetry interception
    this.#vite.ws.on('lupa:telemetry', ({ event, data }: TelemetryPayload) => {
      this.#telemetryQueue = this.#telemetryQueue.then(async () => {
        // Helper to reconstruct Error objects with source-mapped stacks
        const deserializeError = async (errPayload: any) => {
          if (!errPayload || typeof errPayload !== 'object' || !errPayload.message || errPayload instanceof Error) {
            return errPayload
          }

          const cleanViteStr = (str: string) => {
            if (typeof str !== 'string') return str
            return str
              .replace(/https?:\/\/[^/]+\/@fs\//g, '/')
              .replace(/https?:\/\/[^/]+\//g, '/')
              .replace(/\?import(?::undefined:undefined)?/g, '')
          }

          const err = new Error(cleanViteStr(errPayload.message))
          Object.assign(err, errPayload)
          err.name = errPayload.name || 'Error'
          err.message = cleanViteStr(err.message)

          if (errPayload.stack && this.#vite) {
            err.stack = await transformBrowserStack(this.#vite, cwd, errPayload.stack)
            err.stack = cleanViteStr(err.stack)
            // Rewrite the redundant import error stack frame to omit the duplicate message
            // and inject dummy line:col to prevent Japa printing ":undefined:undefined"
            err.stack = err.stack
              .replace(/at TypeError: Failed to fetch dynamically imported module: \/ \(([^)]+)\)/g, 'at ($1:1:1)')
              .replace(/\(fstests\//g, '(tests/')
          } else {
            err.stack = cleanViteStr(errPayload.stack)
          }
          return err
        }

        try {
          if (event === 'group:end' || event === 'suite:end' || event === 'test:end') {
            if (data.errors && data.errors.length) {
              for (const e of data.errors) {
                e.error = await deserializeError(e.error)
              }
            }
          } else if (event === 'uncaught:exception') {
            if (data && data.error) {
              data.error = await deserializeError(data.error)
              exceptionsManager.handleBrowserException(data.error as Error, data.type || 'error')
              return
            }
          } else if (event === 'runner:import_error') {
            if (data && data.error) {
              data.error = await deserializeError(data.error)
            }
          } else if (event === 'runner:pinned_tests') {
            if (data && data.tests) {
              const formatted = await Promise.all(
                data.tests.map(async (t: { title: string; stack: string }) => {
                  const transformed = this.#vite ? await transformBrowserStack(this.#vite, cwd, t.stack) : t.stack
                  return formatPinnedTest(t.title, transformed)
                })
              )
              printPinnedTests(formatted)
              return
            }
          }

          // Delegate remaining events to the orchestrator callback
          await this.#orchestrator.handleTelemetry(event, data)
        } catch (queueErr) {
          console.error('Lupa Telemetry parsing error:', queueErr)
        }
      })
    })

    await this.#vite.listen()
    return this.#vite.resolvedUrls?.local[0] || `http://localhost:${this.#vite.config.server.port}`
  }

  get vite() {
    return this.#vite
  }

  get coverageManager() {
    return this.#coverageManager
  }

  /**
   * Resolves when all queued telemetry events have been processed.
   * Must be awaited before ending the runner to ensure no events are lost.
   */
  drainTelemetry(): Promise<void> {
    return this.#telemetryQueue
  }

  /**
   * Closes the Vite server if running.
   */
  async close() {
    if (this.#vite) {
      await this.#vite.close()
      this.#vite = undefined
    }
  }
}
