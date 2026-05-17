import type { HookHandler } from '../hooks/types.js'
import type { Refiner } from '../refiner/main.js'
import type { Emitter } from '../testing/emitter.js'
import { Runner } from './runner.js'
import type { FilteringOptions, NamedReporterContract } from '../types.js'
import type { InlineConfig } from 'vite'

/**
 * Global setup hook state
 */
export type SetupHookState = [[runner: Runner], [error: Error | null, runner: Runner]]
/**
 * Global setup hook handler
 */
export type SetupHookHandler = HookHandler<SetupHookState[0], SetupHookState[1]>

/**
 * Global teardown hook state
 */
export type TeardownHookState = [[runner: Runner], [error: Error | null, runner: Runner]]
/**
 * Global teardown hook handler
 */
export type TeardownHookHandler = HookHandler<TeardownHookState[0], TeardownHookState[1]>

/**
 * Global set of available hooks
 */
export interface HooksEvents {
  /**
   * Global setup hook
   */
  setup: SetupHookState
  /**
   * Global teardown hook
   */
  teardown: TeardownHookState
}

/**
 * Parsed command-line arguments
 */
export type CLIArgs = {
  /**
   * Unparsed arguments
   */
  _?: string[]
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
   * Whether to force exit
   */
  forceExit?: boolean
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
 * Runner plugin function. Receives the Node runner, emitter, and config.
 * Executed in the Node.js orchestrator process.
 */
export type RunnerPluginFn = (context: {
  /**
   * Normalized runner configuration
   */
  config: NormalizedConfig
  /**
   * Parsed command-line arguments
   */
  cliArgs: CLIArgs
  /**
   * Runner instance
   */
  runner: Runner
  /**
   * Event emitter
   */
  emitter: Emitter
}) => void | Promise<void>

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
   * A collection of registered reporters. Reporters are not activated by
   * default. Either you have to activate them using the commandline,
   * or using the `activated` property.
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
   * Node-side runner plugins. Functions executed in the Node.js
   * orchestrator. Receive the Node Runner, Emitter, and config.
   */
  runnerPlugins?: RunnerPluginFn[]

  /**
   * A custom implementation to import test files.
   */
  importer?: (filePath: URL) => void | Promise<void>

  /**
   * Overwrite tests refiner. Check documentation for refiner
   * usage
   */
  refiner?: Refiner

  /**
   * Enable/disable force exiting.
   */
  forceExit?: boolean

  /**
   * Global hooks to execute before importing
   * the test files
   */
  setup?: SetupHookHandler[]

  /**
   * Global hooks to execute on teardown
   */
  teardown?: TeardownHookHandler[]

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
   * Array of glob patterns to include in coverage
   */
  include?: string[]
  /**
   * Array of glob patterns to exclude from coverage
   */
  exclude?: string[]
  /**
   * Array of file extensions to instrument
   */
  extension?: string[]
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
