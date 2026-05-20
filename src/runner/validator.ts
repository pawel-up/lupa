import { type NormalizedConfig } from './types.js'
import { reporterNames } from '../reporters/index.js'

/**
 * Ensures the lupa is configured. Otherwise raises an exception
 */
export function ensureIsConfigured(config?: NormalizedConfig): asserts config is NormalizedConfig {
  if (!config) {
    throw new Error(`Cannot run tests. Make sure to call "configure" method before the "run" method`)
  }
}

/**
 * Ensures the lupa is in planning phase
 */
export function ensureIsInPlanningPhase(phase: 'idle' | 'planning' | 'executing') {
  if (phase !== 'planning') {
    throw new Error(`Cannot import lupa test file directly. It must be imported by calling "lupa.run()" method`)
  }
}

/**
 * Ensures the suites filter uses a subset of the user configured suites.
 */
export function validateSuitesFilter(config: NormalizedConfig) {
  /**
   * Do not perform any validation if no filters are applied
   * in the first place
   */
  if (!config.filters.suites || !config.filters.suites.length) {
    return
  }

  /**
   * Notify user they have applied the suites filter but forgot to define
   * suites
   */
  if (!('suites' in config) || !config.suites.length) {
    throw new Error(`Cannot apply suites filter. You have not configured any test suites`)
  }

  const suites = config.suites.map(({ name }) => name)

  /**
   * Find unknown suites and report the error
   */
  const unknownSuites = config.filters.suites.filter((suite) => !suites.includes(suite))
  if (unknownSuites.length) {
    throw new Error(`Cannot apply suites filter. "${unknownSuites[0]}" suite is not configured`)
  }
}

/**
 * Ensure there are unique suites
 */
export function validateSuitesForUniqueness(config: NormalizedConfig) {
  if (!('suites' in config)) {
    return
  }

  const suites = new Set<string>()
  config.suites.forEach(({ name }) => {
    if (suites.has(name)) {
      throw new Error(`Duplicate suite "${name}"`)
    }
    suites.add(name)
  })

  suites.clear()
}

/**
 * Ensure the activated reporters are in the list of defined
 * reporters or are one of the core default reporters
 */
export function validateActivatedReporters(config: NormalizedConfig) {
  const reportersList = config.reporters.list.map(({ name }) => name)
  const unknownReporters = config.reporters.activated.filter(
    (name) => !reportersList.includes(name) && !reporterNames.includes(name as (typeof reporterNames)[number])
  )

  if (unknownReporters.length) {
    throw new Error(
      `Invalid reporter "${unknownReporters[0]}". Make sure to register it first inside the "reporters.list" array`
    )
  }
}
