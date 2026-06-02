import debug from './debug.js'
import type { CLIArgs, Config, CoverageOptions, Filters, NormalizedBaseConfig, NormalizedConfig } from './types.js'
import { dot, github, ndjson, progress, json } from '../reporters/index.js'
import { Refiner } from '../refiner/main.js'

export const NOOP = () => {
  // ..
}

/**
 * Defaults to use for configuration
 */
const DEFAULTS = {
  files: [],
  timeout: 2000,
  retries: 0,
  testPlugins: [],
  runnerPlugins: [],
  get reporters() {
    return {
      activated:
        !process.stdout.isTTY || process.env.CI === 'true'
          ? ['dot'].concat(process.env.GITHUB_ACTIONS === 'true' ? ['github'] : [])
          : ['progress'],
      list: [ndjson(), dot(), github(), progress(), json()],
    }
  },
} satisfies Config

/**
 * Config manager is used to hydrate the configuration by merging
 * the defaults with the user defined config and the command line
 * flags.
 *
 * The command line flags have the upmost priority
 */
export class ConfigManager {
  #config: Config
  #cliArgs: CLIArgs

  constructor(config: Config, cliArgs: CLIArgs) {
    this.#config = config
    this.#cliArgs = cliArgs
  }

  /**
   * Processes a CLI argument and converts it to an
   * array of strings
   */
  #processAsArray(value: string | string[], splitByComma: boolean): string[] {
    const arr = Array.isArray(value) ? value : [value]
    if (!splitByComma) return arr
    return arr.flatMap((item) => item.split(',').map((i: string) => i.trim()))
  }

  /**
   * Returns a copy of filters based upon the CLI
   * arguments.
   */
  #getCLIFilters(): Filters {
    const filters: Filters = {}

    if (this.#cliArgs.tags) {
      filters.tags = this.#processAsArray(this.#cliArgs.tags, true)
    }
    if (this.#cliArgs.tests) {
      filters.tests = this.#processAsArray(this.#cliArgs.tests, false)
    }
    if (this.#cliArgs.files) {
      filters.files = this.#processAsArray(this.#cliArgs.files, true)
    }
    if (this.#cliArgs.groups) {
      filters.groups = this.#processAsArray(this.#cliArgs.groups, false)
    }
    if (this.#cliArgs.suites) {
      filters.suites = this.#processAsArray(this.#cliArgs.suites, true)
    } else if (this.#cliArgs._ && this.#cliArgs._.length) {
      filters.suites = this.#processAsArray(this.#cliArgs._, true)
    }

    return filters
  }

  /**
   * Returns the timeout from the CLI args
   */
  #getCLITimeout(): number | undefined {
    if (this.#cliArgs.timeout) {
      const value = Number(this.#cliArgs.timeout)
      if (!Number.isNaN(value)) {
        return value
      }
    }
  }

  /**
   * Returns the retries from the CLI args
   */
  #getCLIRetries(): number | undefined {
    if (this.#cliArgs.retries) {
      const value = Number(this.#cliArgs.retries)
      if (!Number.isNaN(value)) {
        return value
      }
    }
  }

  /**
   * Returns reporters selected using the commandline
   * --reporter flag
   */
  #getCLIReporters(): string[] | undefined {
    if (this.#cliArgs.reporters) {
      return this.#processAsArray(this.#cliArgs.reporters, true)
    }
  }

  /**
   * Hydrates the config with user defined options and the
   * command-line flags.
   */
  hydrate(): NormalizedConfig {
    const cliFilters = this.#getCLIFilters()
    const cliRetries = this.#getCLIRetries()
    const cliTimeout = this.#getCLITimeout()
    const cliReporters = this.#getCLIReporters()

    const cliViteConfig = typeof this.#cliArgs.viteConfig === 'string' ? this.#cliArgs.viteConfig : undefined
    const finalViteConfig = cliViteConfig ?? this.#config.viteConfig

    if (finalViteConfig && this.#config.vite) {
      throw new Error('Cannot specify both a vite config file and an inline vite config. Please use only one.')
    }

    debug('filters applied using CLI flags %O', cliFilters)

    let parallel = this.#config.parallel ?? true
    if (this.#cliArgs.parallel === false) {
      parallel = false
    }

    let concurrency = this.#config.concurrency ?? 'auto'
    if (this.#cliArgs.concurrency !== undefined) {
      const parsed = parseInt(this.#cliArgs.concurrency as string, 10)
      if (!isNaN(parsed)) {
        concurrency = parsed
      }
    }

    if (!parallel) {
      concurrency = 1
    }

    let resolvedCoverage: boolean | CoverageOptions

    const isCoverageRequested =
      this.#cliArgs.coverage === true ||
      this.#cliArgs.coverageReporters !== undefined ||
      this.#cliArgs.coverageDir !== undefined

    const configCoverage = this.#config.coverage

    if (isCoverageRequested) {
      resolvedCoverage = typeof configCoverage === 'object' ? { ...configCoverage, enabled: true } : { enabled: true }
    } else if (this.#cliArgs.coverage === false) {
      resolvedCoverage = false
    } else if (typeof configCoverage === 'object' && configCoverage.enabled === true) {
      resolvedCoverage = { ...configCoverage }
    } else if (configCoverage === true) {
      resolvedCoverage = { enabled: true }
    } else {
      resolvedCoverage = false
    }

    if (typeof resolvedCoverage === 'object') {
      if (this.#cliArgs.coverageReporters !== undefined) {
        resolvedCoverage.reporters = this.#processAsArray(this.#cliArgs.coverageReporters, true)
      }
      if (this.#cliArgs.coverageDir !== undefined) {
        resolvedCoverage.reportsDirectory = this.#cliArgs.coverageDir as string
      }
    }

    const baseConfig: NormalizedBaseConfig = {
      cwd: this.#config.cwd ?? process.cwd(),
      exclude: this.#config.exclude || ['node_modules/**', '.git/**', 'coverage/**'],
      filters: Object.assign({}, this.#config.filters ?? {}, cliFilters),
      refiner: this.#config.refiner ?? new Refiner(),
      retries: cliRetries ?? this.#config.retries ?? DEFAULTS.retries,
      timeout: cliTimeout ?? this.#config.timeout ?? DEFAULTS.timeout,
      testPlugins: this.#config.testPlugins ?? DEFAULTS.testPlugins,
      runnerPlugins: this.#config.runnerPlugins ?? DEFAULTS.runnerPlugins,
      reporters: this.#config.reporters
        ? {
            activated: this.#config.reporters.activated,
            list: this.#config.reporters.list || DEFAULTS.reporters.list,
          }
        : DEFAULTS.reporters,
      viteConfig: finalViteConfig,
      vite: this.#config.vite,
      coverage: resolvedCoverage,
      harness: this.#config.harness,
      parallel,
      concurrency,
      watch: this.#config.watch ?? this.#cliArgs.watch === true,
      list: this.#config.list ?? this.#cliArgs.list === true,
    }

    /**
     * Overwrite activated reporters when defined using CLI
     * flag
     */
    if (cliReporters) {
      baseConfig.reporters.activated = cliReporters
    }

    if ('files' in this.#config) {
      return {
        files: this.#config.files,
        ...baseConfig,
      }
    }

    return {
      suites: this.#config.suites.map((suite) => {
        return {
          name: suite.name,
          files: suite.files,
          timeout: cliTimeout ?? suite.timeout ?? baseConfig.timeout,
          retries: cliRetries ?? suite.retries ?? baseConfig.retries,
          priority: suite.priority ?? 100,
          disableInWatchMode: suite.disableInWatchMode ?? false,
          excludeFromReporting: suite.excludeFromReporting ?? false,
        }
      }),
      ...baseConfig,
    }
  }
}
