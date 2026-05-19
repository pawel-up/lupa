import { resolve, dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer, createLogger, mergeConfig, type ViteDevServer, type InlineConfig } from 'vite'

import type { NormalizedConfig, JsonSerializable } from './types.js'
import type { BrowserTelemetryEvents } from '../types.js'
import { CoverageManager } from './coverage_manager.js'
import { ExceptionsManager } from './exceptions_manager.js'
import { transformBrowserStack } from './stack_transformer.js'
import { formatPinnedTest, printPinnedTests } from './helpers.js'
import lupaHarnessPlugin from './plugins/harness.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const harnessTs = resolve(__dirname, '../testing/harness.ts')
const harnessPath = existsSync(harnessTs) ? harnessTs : resolve(__dirname, '../testing/harness.js')

export type TelemetryPayload = {
  [K in keyof BrowserTelemetryEvents]: { event: K; data: BrowserTelemetryEvents[K] }
}[keyof BrowserTelemetryEvents]

import type { TestPoolManager } from './test_pool_manager.js'

export interface ServerManagerOptions {
  cwd: string
  config: NormalizedConfig
  testPoolManager: TestPoolManager
  exceptionsManager: ExceptionsManager
  /**
   * Callback invoked sequentially whenever a telemetry event is received.
   */
  onTelemetry: (event: keyof BrowserTelemetryEvents, data: any) => Promise<void>
}

/**
 * Manages the Vite development server lifecycle and WebSocket telemetry.
 */
export class ServerManager {
  #vite?: ViteDevServer
  #options: ServerManagerOptions
  #telemetryQueue: Promise<void> = Promise.resolve()
  #coverageManager?: CoverageManager

  constructor(options: ServerManagerOptions) {
    this.#options = options
  }

  /**
   * Boots the Vite server and returns the local server URL.
   */
  async boot(): Promise<string> {
    const { cwd, config, testPoolManager, exceptionsManager, onTelemetry } = this.#options

    const logger = createLogger('silent')

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
                data.tests.map(async (t) => {
                  const transformed = this.#vite ? await transformBrowserStack(this.#vite, cwd, t.stack) : t.stack
                  return formatPinnedTest(t.title, transformed)
                })
              )
              printPinnedTests(formatted)
              return
            }
          }

          // Delegate remaining events to the orchestrator callback
          await onTelemetry(event, data)
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
   * Closes the Vite server if running.
   */
  async close() {
    if (this.#vite) {
      await this.#vite.close()
      this.#vite = undefined
    }
  }
}
