/**
 * Built-in test reporters for Lupa (spec, dot, ndjson, github) and a way to register custom reporters.
 *
 * @packageDocumentation
 * @module @jarrodek/lupa/reporters
 */

import { DotReporter } from './dot.js'
import { NdJSONReporter } from './ndjson.js'
import { GithubReporter } from './github.js'
import { JSONReporter } from './json.js'
import type { BaseReporterOptions, NamedReporterContract } from '../types.js'

import { ProgressReporter } from './progress.js'

export { BaseReporterOptions, NamedReporterContract }

/**
 * Built-in reporter names.
 */
export const reporterNames = ['dot', 'ndjson', 'github', 'progress', 'json'] as const

/**
 * Create an instance of the progress reporter
 */
export const progress: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'progress',
    usesCLI: true,
    handler: (...args) => new ProgressReporter(options).boot(...args),
  }
}

/**
 * Create an instance of the dot reporter
 */
export const dot: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'dot',
    usesCLI: true,
    handler: (...args) => new DotReporter(options).boot(...args),
  }
}

/**
 * Create an instance of the ndjson reporter
 */
export const ndjson: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'ndjson',
    handler: (...args) => new NdJSONReporter(options).boot(...args),
  }
}

/**
 * Create an instance of the github reporter
 */
export const github: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'github',
    handler: (...args) => new GithubReporter(options).boot(...args),
  }
}

/**
 * Create an instance of the json reporter
 */
export const json: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'json',
    handler: (...args) => new JSONReporter(options).boot(...args),
  }
}
