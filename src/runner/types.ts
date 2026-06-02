import type { Refiner } from '../refiner/main.js'
import type { Emitter } from '../testing/emitter.js'
import { Runner } from './runner.js'
import type { FilteringOptions, NamedReporterContract, RunnerEvents } from '../types.js'
import type { InlineConfig } from 'vite'

/**
 * Parsed command-line arguments
 */
export type CLIArgs = {
  /**
   * Unparsed arguments
   */
  _?: string[]
  /**
   * Test suites to filter by
   */
  suites?: string | string[]
  /**
   * Test tags to filter by
   */
  tags?: string | string[]
  /**
   * Test files to filter by
   */
  files?: string | string[]
  /**
   * Test names to filter by
   */
  tests?: string | string[]
  /**
   * Test groups to filter by
   */
  groups?: string | string[]
  /**
   * Test timeout
   */
  timeout?: string
  /**
   * Number of retries
   */
  retries?: string
  /**
   * Reporters to use
   */
  reporters?: string | string[]
  /**
   * Whether to run only failed tests
   */
  failed?: boolean
  /**
   * Whether to show help
   */
  help?: boolean
  /**
   * Whether to match all tests
   */
  matchAll?: boolean
  /**
   * Whether to list pinned tests
   */
  listPinned?: boolean
  /**
   * Whether to bail
   */
  bail?: boolean
  /**
   * Bail layer
   */
  bailLayer?: string
  /**
   * Whether to enable verbose mode
   */
  verbose?: boolean
  /**
   * Browser(s) to run tests in
   */
  browser?: string | string[]
  /**
   * Path to Vite configuration file
   */
  viteConfig?: string
  /**
   * Whether to enable code coverage
   */
  coverage?: boolean
  /**
   * List of coverage reporters to generate
   */
  coverageReporters?: string | string[]
  /**
   * Directory where coverage reports are written
   */
  coverageDir?: string
  /**
   * Whether to disable parallel execution
   */
  parallel?: boolean
  /**
   * Concurrency level
   */
  concurrency?: string | number
  /**
   * Whether to output the list of suites and tests
   */
  list?: boolean
} & Record<string, string | string[] | boolean | number>

/**
 * Set of filters you can apply to run only specific tests
 */
export type Filters = FilteringOptions & {
  /**
   * Test files to filter by
   */
  files?: string[]
  /**
   * Test suites to filter by
   */
  suites?: string[]
}

/**
 * Enforces JSON-serializable values at the type level.
 * Functions, symbols, undefined, and class instances are rejected.
 */
export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable }

/**
 * A test plugin entry for browser-side plugins. Can be:
 * - A bare module specifier string (no options)
 * - A tuple of [specifier, options] where options must be JSON-serializable
 */
export type TestPluginEntry = string | [specifier: string, options: JsonSerializable]

/**
 * Return type for lifecycle hooks that might return a teardown function.
 */
export type PluginLifecycleResult =
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  void | Promise<void> | (() => void | Promise<void>) | Promise<() => void | Promise<void>>

/**
 * Context provided to plugins during the planning phase
 */
export interface PluginPlanContext {
  config: NormalizedConfig
  cliArgs: CLIArgs
}

/**
 * Context provided to plugins during the boot phase
 */
export interface PluginBootContext {
  config: NormalizedConfig
  cliArgs: CLIArgs
}

/**
 * Context provided to plugins during the execution phase
 */
export interface PluginExecuteContext {
  config: NormalizedConfig
  cliArgs: CLIArgs
  runner: Runner
  emitter: Emitter<RunnerEvents>
}

/**
 * Context provided to plugins during the shutdown phase
 */
export interface PluginShutdownContext {
  config: NormalizedConfig
  cliArgs: CLIArgs
  exitCode: number
}

/**
 * Lupa runner plugin. Hooks into the test orchestrator lifecycle.
 */
export interface LupaPlugin {
  /**
   * Name of the plugin
   */
  name: string

  /**
   * Executed before suites are resolved and the orchestrator boots.
   * Useful for modifying the configuration dynamically or resolving dynamic test files.
   * Returns an optional teardown function executed during shutdown.
   *
   * @useWhen
   * - Dynamically injecting test files or suites based on external conditions.
   * - Overriding CLI arguments or configuration defaults (e.g., forcing `--bail` on CI).
   * @never Use this hook to start services that should be available during test execution.
   */
  plan?: (context: PluginPlanContext) => PluginLifecycleResult

  /**
   * Executed once when the Orchestrator boots.
   * Useful for starting global services (like a database or proxy).
   * Returns an optional teardown function executed during shutdown.
   *
   * @useWhen
   * - One-time global setup tasks (e.g., starting an external database daemon).
   * - Starting an external proxy server that must persist across watch-mode reruns.
   *
   * @never Use this hook to reset state between test runs (use `execute` instead).
   */
  boot?: (context: PluginBootContext) => PluginLifecycleResult

  /**
   * Executed before every test run. In watch mode, this runs multiple times.
   * Useful for per-run telemetry or state resets.
   * Returns an optional teardown function executed at the end of the run (runner:end).
   *
   * @useWhen
   * - Attaching custom reporters or telemetry loggers to the `emitter`.
   * - Resetting external state (e.g., clearing a database) before a specific run starts.
   *
   * @never Use this hook to start services that persist across watch-mode runs (use `boot` instead).
   */
  execute?: (context: PluginExecuteContext) => PluginLifecycleResult

  /**
   * Executed once when the Orchestrator shuts down.
   *
   * @useWhen
   * - Tearing down the global database daemon or proxy server started in `boot()`.
   * - Finalizing custom reports (e.g., sending test run metadata to a dashboard).
   */
  shutdown?: (context: PluginShutdownContext) => void | Promise<void>
}

/**
 * Configuration options for the browser test harness HTML
 */
export interface HarnessConfig {
  /**
   * Optional custom HTML template.
   * It can be a function that receives the required scripts and stylesheets and returns the full HTML string.
   * Alternatively, it can be an HTML string containing the
   * `<!-- lupa-scripts -->` and `<!-- lupa-stylesheets -->` placeholders.
   */
  template?: string | ((context: { scripts: string; stylesheets: string }) => string)

  /**
   * Optional list of absolute or relative CSS file paths to include in the harness.
   */
  stylesheets?: string[]
}

/**
 * Base configuration options
 */
export interface BaseConfig {
  /**
   * Current working directory. It is required to search for
   * the test files
   */
  cwd?: string

  /**
   * Whether to run tests in watch mode
   */
  watch?: boolean

  /**
   * The timeout to apply on all the tests, unless overwritten explicitly
   */
  timeout?: number

  /**
   * The retries to apply on all the tests, unless overwritten explicitly
   */
  retries?: number

  /**
   * Test filters to apply
   */
  filters?: Filters

  /**
   * A hook to configure suites. The callback will be called for each
   * suite before it gets executed.
   */
  reporters?: {
    activated: string[]
    list?: NamedReporterContract[]
  }

  /**
   * Browser-side test plugins. Module specifiers that export a default
   * setup function conforming to WebPluginFn. Executed in the browser
   * before test files load. Plugins receive the WebRunner, Emitter,
   * and config.
   *
   * @example
   * testPlugins: ['@pawel-up/lupa/assert']
   * testPlugins: [['@pawel-up/lupa/assert', { openApi: false }]]
   */
  testPlugins?: TestPluginEntry[]

  /**
   * Node-side runner plugins. Can hook into the orchestrator lifecycle
   * to start proxy servers, perform planning, or collect metrics.
   */
  runnerPlugins?: LupaPlugin[]

  /**
   * Overwrite tests refiner. Check documentation for refiner
   * usage
   */
  refiner?: Refiner

  /**
   * An array of directories to exclude when searching
   * for test files.
   *
   * For example, if you search for test files inside the entire
   * project, you might want to exclude "node_modules"
   */
  exclude?: string[]

  /**
   * Path to the Vite configuration file.
   * Do not use together with 'vite'.
   */
  viteConfig?: string

  /**
   * Inline Vite configuration to merge with Lupa's defaults.
   * Do not use together with 'viteConfig'.
   */
  vite?: InlineConfig

  /**
   * Whether to enable code coverage reporting using istanbul,
   * or specific options to configure the coverage instrumentation.
   */
  coverage?: boolean | CoverageOptions

  /**
   * Customize the HTML harness environment
   */
  harness?: HarnessConfig

  /**
   * Whether to run tests in parallel across browsers and pages
   */
  parallel?: boolean

  /**
   * Number of concurrent pages to run per browser.
   * Can be 'auto' or a specific number.
   */
  concurrency?: number | 'auto'

  /**
   * Whether to output the list of suites and tests
   */
  list?: boolean
}

/**
 * Options for configuring code coverage instrumentation
 */
export interface CoverageOptions {
  /**
   * Whether to enable code coverage collection.
   * Defaults to `false`.
   */
  enabled?: boolean

  /**
   * Array of glob patterns to include in coverage reports.
   * Files matching these patterns will be included in the coverage mapping.
   */
  include?: string[]

  /**
   * Array of glob patterns to exclude from coverage reports.
   * Files matching these patterns will be skipped during coverage mapping.
   */
  exclude?: string[]

  /**
   * Array of file extensions to process (e.g., ['.js', '.ts', '.jsx', '.tsx', '.vue']).
   * Only files with these extensions will be included in the coverage report.
   */
  extension?: string[]

  /**
   * List of coverage reporters to run simultaneously (e.g., ['text', 'html', 'lcov']).
   * Defaults to `['text', 'html']` if not specified.
   */
  reporters?: string[]

  /**
   * The output directory where the coverage reports will be written.
   * Defaults to './coverage'.
   */
  reportsDirectory?: string

  /**
   * Coverage threshold gates. If the coverage percentages fall below
   * these thresholds, the test run will fail with an exit code of 1.
   */
  thresholds?: {
    lines?: number
    functions?: number
    branches?: number
    statements?: number
  }
}

/**
 * A collection of test files defined as a glob or a callback
 * function that returns an array of URLs
 */
export type TestFiles = string | string[] | (() => URL[] | Promise<URL[]>)

/**
 * A test suite to register tests under a named suite
 */
export interface TestSuite {
  /**
   * A unique name for the suite
   */
  name: string

  /**
   * Collection of files associated with the suite. Files should be
   * defined as a glob or a callback function that returns an array of URLs
   */
  files: TestFiles

  /**
   * The timeout to apply on all the tests in this suite, unless overwritten explicitly
   */
  timeout?: number

  /**
   * The retries to apply on all the tests in this suite, unless overwritten explicitly
   */
  retries?: number

  /**
   * Execution priority. Suites are executed in descending order — higher values run first.
   * Defaults to `100`. Use a lower value (e.g. `50`) to ensure this suite runs after all
   * higher-priority suites have fully completed.
   *
   * @default 100
   */
  priority?: number

  /**
   * When `true`, this suite is skipped entirely during watch mode.
   * Useful for long-running suites (e.g. benchmarks) that should only run in CI
   * or on an explicit full run.
   *
   * @default false
   */
  disableInWatchMode?: boolean

  /**
   * When `true`, files in this suite are excluded from reporter progress tracking.
   * The suite still executes normally, but `file:start` and `file:end` events are
   * suppressed from reporters, and the files are not counted toward the progress total.
   *
   * Useful for non-test suites (e.g. benchmarks) that run alongside tests but should
   * not affect the test summary output.
   *
   * @default false
   */
  excludeFromReporting?: boolean
}

/**
 * BaseConfig after normalized by the config manager
 */
export type NormalizedBaseConfig = Required<
  Omit<BaseConfig, 'reporters' | 'viteConfig' | 'vite' | 'coverage' | 'harness'>
> & {
  /**
   * Activated reporters
   */
  reporters: {
    /**
     * Activated reporter names
     */
    activated: string[]
    /**
     * List of registered reporters
     */
    list: NamedReporterContract[]
  }
  /**
   * Path to Vite configuration file
   */
  viteConfig?: string
  /**
   * Inline Vite configuration
   */
  vite?: InlineConfig
  /**
   * Code coverage options
   */
  coverage?: boolean | CoverageOptions
  /**
   * Customize the HTML harness environment
   */
  harness?: HarnessConfig

  /**
   * Whether to run tests in parallel
   */
  parallel: boolean

  /**
   * Whether to run tests in watch mode
   */
  watch: boolean

  /**
   * Number of concurrent pages per browser
   */
  concurrency: number | 'auto'

  /**
   * Whether to output the list of suites and tests
   */
  list: boolean
}

/**
 * Configuration options
 */
export type Config = BaseConfig &
  (
    | {
        /**
         * Collection of test files
         */
        files: TestFiles
      }
    | {
        /**
         * Collection of test suites
         */
        suites: TestSuite[]
      }
  )

/**
 * Config after normalized by the config manager
 */
export type NormalizedConfig = NormalizedBaseConfig &
  (
    | {
        /**
         * Collection of test files
         */
        files: TestFiles
      }
    | {
        /**
         * Collection of test suites
         */
        suites: Required<TestSuite>[]
      }
  )
