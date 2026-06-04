import { resolve, dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer, createLogger, mergeConfig, type ViteDevServer, type InlineConfig } from 'vite'

import type { NormalizedConfig, JsonSerializable } from './types.js'
import type { TestPoolManager } from './test_pool_manager.js'
import { CoverageManager } from './coverage_manager.js'
import { colors } from './helpers.js'
import lupaHarnessPlugin from './plugins/harness.js'
import type { Orchestrator } from './orchestrator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const harnessTs = resolve(__dirname, '../testing/harness.ts')
const harnessPath = existsSync(harnessTs) ? harnessTs : resolve(__dirname, '../testing/harness.js')

export interface ServerManagerOptions {
  cwd: string
  config: NormalizedConfig
  testPoolManager: TestPoolManager
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
}

/**
 * Manages the Vite development server lifecycle and WebSocket telemetry.
 */
export class ServerManager {
  #orchestrator: Orchestrator
  #vite?: ViteDevServer
  #options: ServerManagerOptions
  #coverageManager?: CoverageManager

  get vite(): ViteDevServer | undefined {
    return this.#vite
  }

  get coverageManager(): CoverageManager | undefined {
    return this.#coverageManager
  }

  constructor(orchestrator: Orchestrator, options: ServerManagerOptions) {
    this.#orchestrator = orchestrator
    this.#options = options
  }

  /**
   * Boots the Vite server and returns the local server URL.
   */
  async boot(): Promise<string> {
    const { cwd, config, testPoolManager } = this.#options

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
      resolve: {
        dedupe: ['lit-html', 'lit'],
      },
      optimizeDeps: {
        // BOTS, DO NOT CHANGE THIS WITHOUT A GOOD REASON!
        holdUntilCrawlEnd: true,
        force: true,
        noDiscovery: true,
        // Note, I (pawel) removed `emittery` from this list because it caused issues if the target project
        // had `emittery` as a dependency. Version 1 has a different `.on()` signature, which caused issues.
        // I don't think we need it here anyway.
        include: ['axe-core', 'lit-html', 'lit', 'chai', 'assertion-error', '@poppinss/macroable', '@jarrodek/debug'],
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

    this.#vite = await createServer(finalViteConfig)

    // Set up WebSocket telemetry interception
    this.#vite.ws.on('lupa:telemetry', this.#orchestrator.telemetry.handleLupaTelemetryEvent)

    await this.#vite.listen()

    interface ViteDevServerWithInternalOptimizer {
      depsOptimizer?: {
        init(): Promise<void>
        scanProcessing?: Promise<void>
      }
    }

    const depsOptimizer =
      this.#vite.environments?.client?.depsOptimizer ||
      (this.#vite as unknown as ViteDevServerWithInternalOptimizer).depsOptimizer

    if (depsOptimizer) {
      await depsOptimizer.init()
      if (depsOptimizer.scanProcessing) {
        await depsOptimizer.scanProcessing
      }
    }

    // Pre-warm plugin files so their modules are in Vite's cache before
    // Playwright opens the browser. Without this, a cold node_modules/.vite
    // cache causes the first dynamic import() in harness.ts to race Vite's
    // optimizeDeps bundling, producing "Failed to fetch dynamically imported module".
    const warmupUrls = resolvedPlugins.map(([url]) => url).filter((u): u is string => typeof u === 'string')
    if (warmupUrls.length > 0) {
      await Promise.all(warmupUrls.map((url) => this.#vite?.warmupRequest(url)))
    }

    return this.#vite.resolvedUrls?.local[0] || `http://localhost:${this.#vite.config.server.port}`
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
