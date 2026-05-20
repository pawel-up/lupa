import { validateActivatedReporters, validateSuitesFilter, validateSuitesForUniqueness } from './validator.js'
import { FilesManager } from './files_manager.js'
import type { NormalizedConfig, TestFiles } from './types.js'
import type { NamedReporterContract, PlannedTestSuite } from '../types.js'

import { dot, github, ndjson, progress, json } from '../reporters/index.js'

const DEFAULT_REPORTERS: Record<string, () => NamedReporterContract> = {
  dot,
  github,
  ndjson,
  progress,
  json,
}

/**
 * The tests planner is used to plan the tests by doing all
 * the heavy lifting of executing plugins, registering
 * reporters, filtering tests and so on.
 */
export class Planner {
  #config: NormalizedConfig
  #fileManager = new FilesManager()

  constructor(config: NormalizedConfig) {
    validateActivatedReporters(config)
    validateSuitesFilter(config)
    validateSuitesForUniqueness(config)
    this.#config = config
  }

  /**
   * Creates a plan for running the tests
   */
  async plan() {
    const suites = await this.#getSuites()
    const reporters = this.#getActivatedReporters()
    const refinerFilters = this.#getRefinerFilters()
    return {
      reporters,
      suites,
      refinerFilters,
      config: this.#config,
    }
  }

  /**
   * Returns a list of reporters based upon the activated
   * reporters list.
   */
  #getActivatedReporters(): NamedReporterContract[] {
    return this.#config.reporters.activated.map((activated) => {
      const registered = this.#config.reporters.list.find(({ name }) => activated === name)
      if (registered) {
        return registered as NamedReporterContract
      }

      if (activated in DEFAULT_REPORTERS) {
        return DEFAULT_REPORTERS[activated]()
      }

      throw new Error(`Reporter not found: ${activated}`)
    })
  }

  /**
   * A generic method to collect files from the user defined
   * files glob and apply the files filter
   */
  async #collectFiles(files: TestFiles) {
    let filesURLs = await this.#fileManager.getFiles(this.#config.cwd, files, this.#config.exclude)
    if (this.#config.filters.files && this.#config.filters.files.length) {
      filesURLs = this.#fileManager.grep(filesURLs, this.#config.filters.files)
    }

    return filesURLs
  }

  /**
   * Returns a collection of suites and their associated
   * test files by applying all the filters
   */
  async #getSuites(): Promise<PlannedTestSuite[]> {
    const suites: PlannedTestSuite[] = []
    const suitesFilters = this.#config.filters.suites || []

    if ('files' in this.#config) {
      suites.push({
        name: 'default',
        files: this.#config.files,
        timeout: this.#config.timeout,
        retries: this.#config.retries,
        filesURLs: await this.#collectFiles(this.#config.files),
      })
    }

    if ('suites' in this.#config) {
      for (const suite of this.#config.suites) {
        if (!suitesFilters.length || suitesFilters.includes(suite.name)) {
          suites.push({
            ...suite,
            filesURLs: await this.#collectFiles(suite.files),
          })
        }
      }
    }

    return suites
  }

  /**
   * Returns a list of filters to the passed to the refiner
   */
  #getRefinerFilters() {
    return Object.keys(this.#config.filters).reduce(
      (result, layer) => {
        if (layer === 'tests' || layer === 'tags' || layer === 'groups') {
          result.push({ layer, filters: this.#config.filters[layer] as string[] })
        }
        return result
      },
      [] as { layer: 'tags' | 'tests' | 'groups'; filters: string[] }[]
    )
  }
}
