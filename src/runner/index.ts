/**
 * Primary orchestrator and CLI configuration API for Lupa tests.
 *
 * @packageDocumentation
 * @module @pawel-up/lupa/runner
 */
import type { Config, NormalizedConfig, CLIArgs } from './types.js'
export type * from './types.js'
import { ConfigManager } from './config_manager.js'
import debug from './debug.js'
import { ensureIsConfigured } from './validator.js'
import { Planner } from './planner.js'
import { Orchestrator } from './orchestrator.js'
import type { ProgrammaticReporterContract } from '../types.js'
export { SummaryBuilder } from './summary_builder.js'
export { loadLupaConfig } from './config_loader.js'
export type { Config, NormalizedConfig, CLIArgs, JsonSerializable } from './types.js'

/**
 * Hydrated config
 */
let runnerConfig: NormalizedConfig | undefined

let cliArgs: CLIArgs = {}

/**
 * Define Lupa configuration.
 *
 * This is an identity function that provides TypeScript autocomplete and type-checking
 * for your `lupa.config.ts` file. It does not mutate state or hydrate the configuration.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@pawel-up/lupa/runner'
 *
 * export default defineConfig({
 *   files: ['tests/**\/*.spec.ts'],
 *   testPlugins: ['@pawel-up/lupa/assert']
 * })
 * ```
 *
 * @param config Lupa configuration object
 * @returns Unmodified Lupa configuration object
 */
export function defineConfig(config: Config): Config {
  return config
}

/**
 * Configure the Lupa test runner.
 *
 * This function hydrates the provided configuration options and merges them with parsed CLI arguments.
 *
 * **Note:** If you are using the standard `npx lupa test` CLI, you do not need to call this manually.
 * The CLI automatically loads your `lupa.config.ts` and calls `configure()` for you.
 * This function is exposed primarily for advanced users building custom integrations or programmatic runners.
 *
 * You must call this function before calling {@link run}.
 *
 * @category Configuration
 * @useWhen Building a programmatic test runner or custom CLI integration.
 * @avoidWhen You are already inside a running test or suite.
 *
 * @param options - The configuration object. You must provide either a top-level `files` array
 *                  or a `suites` array to define your test files.
 * @param args - Optional CLI arguments to override configuration.
 *
 * @example
 * **Basic Configuration**
 * ```ts
 * import { configure, run } from '@pawel-up/lupa/runner'
 *
 * configure({
 *   files: ['tests/**\/*.spec.ts'],
 *   testPlugins: ['@pawel-up/lupa/assert']
 * })
 *
 * run()
 * ```
 *
 * @example
 * **Using Test Suites**
 * ```ts
 * import { configure, run } from '@pawel-up/lupa/runner'
 *
 * configure({
 *   suites: [
 *     { name: 'components', files: ['tests/components/**\/*.spec.ts'] },
 *     { name: 'e2e', files: ['tests/e2e/**\/*.spec.ts'] }
 *   ],
 *   timeout: 5000,
 * })
 *
 * run()
 * ```
 */
export function configure(options: Config, args?: CLIArgs) {
  if (args) {
    cliArgs = args
  }
  runnerConfig = new ConfigManager(options, cliArgs).hydrate()
}

/**
 * Run the test suite.
 *
 * This is the primary entry point for running your tests. It uses the configuration
 * provided by {@link configure}.
 *
 * @returns A Promise that resolves when the test run is complete,
 *          or rejects if the test run encounters an error (e.g., uncaught exceptions).
 *
 * @category Execution
 * @never NEVER call this inside a test suite or hook. Fix: Call it only once at the end of your execution script.
 * @throws {Error} Throws if configuration is missing or invalid.
 *
 * @example
 * ```ts
 * import { configure, run } from '@pawel-up/lupa/runner'
 *
 * configure({
 *   files: ['tests/**\/*.spec.ts'],
 * })
 *
 * run()
 * ```
 */
export async function run() {
  /**
   * Display help when help flag is used
   */
  if (cliArgs.help) {
    // Help is now handled by commander, so this might not be reached, but just in case
    return
  }

  ensureIsConfigured(runnerConfig)

  const pluginTeardowns: (() => void | Promise<void>)[] = []

  if (runnerConfig.runnerPlugins) {
    for (const plugin of runnerConfig.runnerPlugins) {
      if (plugin.plan) {
        const teardown = await plugin.plan({ config: runnerConfig, cliArgs })
        if (typeof teardown === 'function') {
          pluginTeardowns.push(teardown)
        }
      }
    }
  }

  const { config, reporters, suites, refinerFilters } = await new Planner(runnerConfig).plan()

  const orchestrator = new Orchestrator(config, cliArgs, reporters, suites, refinerFilters)
  // We need to give orchestrator the plan teardowns so it can run them during shutdown
  orchestrator.registerTeardowns(pluginTeardowns)

  /**
   * Signal handlers for clean shutdown on Ctrl+C / kill
   */
  const onSignal = async (signal: string) => {
    debug('received %s signal', signal)
    console.log() // clear the ^C line
    await orchestrator.shutdown(1)
  }

  process.once('SIGINT', () => onSignal('SIGINT'))
  process.once('SIGTERM', () => onSignal('SIGTERM'))

  try {
    await orchestrator.boot()

    if (orchestrator.isWatchMode) {
      orchestrator.cli.start()
    }

    // Initial execution
    await orchestrator.executeTests()
  } catch (error) {
    if (!orchestrator.isShuttingDown) {
      orchestrator.exceptionsManager.notifyException(error)
    }
    await orchestrator.shutdown(1)
  }
}

/**
 * Run Lupa programmatically and return the typed output of the given programmatic reporter.
 * This execution path does not intercept standard process signals and avoids `process.exit()`.
 *
 * @example
 * ```ts
 * import { runProgrammatic } from '@pawel-up/lupa/runner'
 * import { json } from '@pawel-up/lupa/reporters'
 *
 * const result = await runProgrammatic(json())
 * ```
 */
export async function runProgrammatic<T>(
  reporter: ProgrammaticReporterContract<T>,
  options: Partial<Config> = {}
): Promise<T> {
  ensureIsConfigured(runnerConfig)

  reporter.isProgrammatic = true

  // Merge runtime options
  const programmaticConfig: any = {
    ...runnerConfig,
    ...options,
    reporters: {
      activated: [reporter.name],
      list: [reporter],
    },
  }

  const pluginTeardowns: (() => void | Promise<void>)[] = []

  if (programmaticConfig.runnerPlugins) {
    for (const plugin of programmaticConfig.runnerPlugins) {
      if (plugin.plan) {
        const teardown = await plugin.plan({ config: programmaticConfig, cliArgs })
        if (typeof teardown === 'function') {
          pluginTeardowns.push(teardown)
        }
      }
    }
  }

  const { config, reporters, suites, refinerFilters } = await new Planner(programmaticConfig).plan()

  const orchestrator = new Orchestrator(config, cliArgs, reporters, suites, refinerFilters)
  orchestrator.registerTeardowns(pluginTeardowns)

  try {
    // We explicitly call waitForCompletion to set up the promise before booting
    const completionPromise = orchestrator.waitForCompletion()

    const bootAndRun = (async (): Promise<number> => {
      await orchestrator.boot()
      await orchestrator.executeTests()
      return completionPromise
    })()

    // Catch any error on bootAndRun to prevent unhandled promise rejections if completionPromise rejects first
    bootAndRun.catch(() => undefined)

    // Wait for either the completion/rejection or the boot/execution sequence
    const exitCode = await Promise.race([completionPromise, bootAndRun])

    // Shut down gracefully without calling process.exit()
    await orchestrator.shutdown(exitCode, { preventExit: true })

    // Return the result from the programmatic reporter
    return await reporter.getResult()
  } catch (error) {
    orchestrator.exceptionsManager.notifyException(error)
    await orchestrator.shutdown(1, { preventExit: true })
    throw error
  }
}
