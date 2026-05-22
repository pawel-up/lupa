/*
 * @japa/core
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Macroable from '@poppinss/macroable'

import debug from './debug.js'
import { type Emitter } from '../testing/emitter.js'
import type { RunnerEvents, RunnerStartNode } from '../types.js'
import { Tracker } from './tracker.js'
import type { ReporterContract, RunnerSummary } from '../types.js'
import type { NormalizedConfig } from './types.js'
import { SummaryBuilder } from './summary_builder.js'

/**
 * The Runner class exposes the API to manage the node process telemetry
 * and reporters for Lupa tests running in the browser.
 */
export class Runner extends Macroable {
  #emitter: Emitter<RunnerEvents>
  #config: NormalizedConfig
  #failed = false

  /**
   * Reference to tests tracker
   */
  #tracker?: Tracker

  /**
   * Summary builder is used to create the tests summary reported by
   * multiple reporters. Each report contains a key-value pair
   */
  summaryBuilder = new SummaryBuilder()

  /**
   * Registered tests reporter
   */
  reporters = new Set<ReporterContract>()

  constructor(emitter: Emitter<RunnerEvents>, config: NormalizedConfig) {
    super()
    this.#emitter = emitter
    this.#config = config
  }

  #getTrackerOrThrow() {
    if (!this.#tracker) {
      throw new Error('Invalid state: Tracker not initialized')
    }
    return this.#tracker
  }

  /**
   * Boot the runner
   */
  #boot() {
    this.#tracker = new Tracker()

    const trackerEmitter = this.reporterEmitter || this.#emitter

    trackerEmitter.on('runner:start', (payload) => this.#tracker?.processEvent('runner:start', payload))
    trackerEmitter.on('runner:end', (payload) => this.#tracker?.processEvent('runner:end', payload))
    trackerEmitter.on('runner:import_error', (payload) => {
      this.#failed = true
      this.#tracker?.processEvent('runner:import_error', payload)
    })
    trackerEmitter.on('suite:start', (payload) => this.#tracker?.processEvent('suite:start', payload))
    trackerEmitter.on('suite:end', (payload) => {
      if (payload.hasError) {
        this.#failed = true
      }
      this.#tracker?.processEvent('suite:end', payload)
    })
    trackerEmitter.on('group:start', (payload) => this.#tracker?.processEvent('group:start', payload))
    trackerEmitter.on('group:end', (payload) => {
      if (payload.hasError) {
        this.#failed = true
      }
      this.#tracker?.processEvent('group:end', payload)
    })
    trackerEmitter.on('test:start', (payload) => this.#tracker?.processEvent('test:start', payload))
    trackerEmitter.on('test:end', (payload) => {
      if (payload.hasError) {
        this.#failed = true
      }
      this.#tracker?.processEvent('test:end', payload)
    })
    trackerEmitter.on('file:start', (payload) => this.#tracker?.processEvent('file:start', payload))
    trackerEmitter.on('file:end', (payload) => this.#tracker?.processEvent('file:end', payload))
  }

  /**
   * Know if one or more suites have failed
   */
  get failed(): boolean {
    return this.#failed
  }

  /**
   * Register a tests reporter
   *
   * @param reporter - Reporter to register
   * @returns This runner instance
   */
  registerReporter(reporter: ReporterContract): this {
    if (typeof reporter === 'object' && reporter.usesCLI) {
      for (const existingReporter of this.reporters) {
        if (typeof existingReporter === 'object' && existingReporter.usesCLI) {
          throw new Error(
            `Cannot register reporter "${reporter.name}". The "${existingReporter.name}" reporter is already registered and taking exclusive control of the CLI.`
          )
        }
      }
    }

    this.reporters.add(reporter)
    return this
  }

  /**
   * Get tests summary
   *
   * @returns Tests summary or throws error when runner is not booted
   */
  getSummary(): RunnerSummary {
    return this.#getTrackerOrThrow().getSummary()
  }

  /**
   * Optional emitter to use for reporters. If not set, the main emitter is used.
   * Useful for watch mode filtering.
   */
  reporterEmitter?: Emitter<RunnerEvents>

  /**
   * Start the test runner process
   *
   * @returns Promise that resolves when the runner starts
   */
  async start(node: RunnerStartNode = { estimatedTotalFiles: 0 }): Promise<void> {
    this.#boot()
    debug('starting node reporters')

    const emitterToUse = this.reporterEmitter || this.#emitter

    for (const reporter of this.reporters) {
      if (typeof reporter === 'function') {
        await reporter(this, emitterToUse, this.#config)
      } else {
        await reporter.handler(this, emitterToUse, this.#config)
      }
    }

    await this.#emitter.emit('runner:start', node)
  }

  /**
   * End the runner process
   *
   * @returns Promise that resolves when the runner finishes
   */
  async end(): Promise<void> {
    debug('node runner ended')
    await this.#emitter.emit('runner:end', {
      hasError: this.#failed,
    })
  }
}
