/*
 * @japa/core
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Hooks } from '../../hooks/main.js'
import { type Runner } from '../../hooks/types.js'

import debug from '../debug.js'
import { type Suite } from './main.js'
import { type Emitter } from '../emitter.js'
import type { SuiteEndNode, SuiteHooks, SuiteHooksData, SuiteStartNode } from '../../types.js'
import { Group } from '../group/main.js'

/**
 * Run all groups or tests inside the suite stack
 */
export class SuiteRunner {
  #emitter: Emitter
  #options: {
    bail: boolean
  }

  /**
   * Parent suite reference
   */
  #suite: Suite

  /**
   * Reference to the startup runner
   */
  #setupRunner: Runner<SuiteHooksData[0], SuiteHooksData[1]>

  /**
   * Reference to the cleanup runner
   */
  #teardownRunner: Runner<SuiteHooksData[0], SuiteHooksData[1]>

  /**
   * Test errors
   */
  #errors: {
    phase: 'setup' | 'setup:cleanup' | 'teardown' | 'teardown:cleanup'
    error: Error
  }[] = []

  /**
   * Track if test has any errors
   */
  #hasError = false

  /**
   * Know if any of the tests/hooks have failed
   */
  get failed(): boolean {
    return this.#hasError
  }

  constructor(
    suite: Suite,
    hooks: Hooks<SuiteHooks>,
    emitter: Emitter,
    options: {
      bail: boolean
    }
  ) {
    this.#suite = suite
    this.#emitter = emitter
    this.#options = options

    this.#setupRunner = hooks.runner('setup')
    this.#teardownRunner = hooks.runner('teardown')
  }

  /**
   * Notify the reporter about the suite start
   */
  #notifyStart() {
    const startOptions: SuiteStartNode = {
      name: this.#suite.name,
      filesCount: this.#suite.filesCount,
      files: this.#suite.files,
    }
    this.#emitter.emit('suite:start', startOptions)
  }

  /**
   * Notify the reporter about the suite end
   */
  #notifyEnd() {
    const endOptions: SuiteEndNode = {
      name: this.#suite.name,
      hasError: this.#hasError,
      errors: this.#errors,
      filesCount: this.#suite.filesCount,
      files: this.#suite.files,
    }

    this.#emitter.emit('suite:end', endOptions)
  }

  #notifyFileStart(file: string, info: FilesTracker) {
    this.#emitter.emit('file:start', { file, groups: info.expectedGroups, tests: info.expectedTests })
  }

  #notifyFileEnd(file: string, info: FilesTracker) {
    this.#emitter.emit('file:end', { file, groups: info.expectedGroups, tests: info.expectedTests })
  }

  /**
   * Running setup hooks
   */
  async #runSetupHooks() {
    debug('running "%s" suite setup hooks', this.#suite.name)
    try {
      await this.#setupRunner.run(this.#suite)
    } catch (error) {
      debug('suite setup hooks failed, suite: %s, error: %O', this.#suite.name, error)
      this.#hasError = true
      this.#errors.push({ phase: 'setup', error: error as Error })
    }
  }

  /**
   * Running teardown hooks
   */
  async #runTeardownHooks() {
    debug('running "%s" suite teardown hooks', this.#suite.name)
    try {
      await this.#teardownRunner.run(this.#suite)
    } catch (error) {
      debug('suite teardown hooks failed, suite: %s, error: %O', this.#suite.name, error)
      this.#hasError = true
      this.#errors.push({ phase: 'teardown', error: error as Error })
    }
  }

  /**
   * Running setup cleanup functions
   */
  async #runSetupCleanupFunctions() {
    debug('running "%s" suite setup cleanup functions', this.#suite.name)
    try {
      await this.#setupRunner.cleanup(this.#hasError, this.#suite)
    } catch (error) {
      debug('suite setup cleanup functions failed, suite: %s, error: %O', this.#suite.name, error)
      this.#hasError = true
      this.#errors.push({ phase: 'setup:cleanup', error: error as Error })
    }
  }

  /**
   * Running teardown cleanup functions
   */
  async #runTeardownCleanupFunctions() {
    debug('running "%s" suite teardown cleanup functions', this.#suite.name)
    try {
      await this.#teardownRunner.cleanup(this.#hasError, this.#suite)
    } catch (error) {
      debug('suite teardown cleanup functions failed, suite: %s, error: %O', this.#suite.name, error)
      this.#hasError = true
      this.#errors.push({ phase: 'teardown:cleanup', error: error as Error })
    }
  }

  /**
   * Run the test
   */
  async run() {
    debug('starting to run "%s" suite', this.#suite.name)
    this.#notifyStart()

    /**
     * Run setup hooks and exit early when one of the hooks
     * fails
     */
    await this.#runSetupHooks()
    if (this.#hasError) {
      await this.#runSetupCleanupFunctions()
      this.#notifyEnd()
      return
    }

    /**
     * To report which file is staring and which has ended, we need to track the files seen during the test execution.
     * This is required since a test file have multiple groups and tests, so we can't rely on the test/group start
     * and end events to report file start and end.
     */
    const seenFiles = new Map<string, FilesTracker>()
    for (const groupOrTest of this.#suite.stack) {
      const file = groupOrTest.options.meta.file
      let info = seenFiles.get(file)
      if (!info) {
        info = {
          expectedGroups: 0,
          expectedTests: 0,
          seenGroups: 0,
          seenTests: 0,
          notified: false,
        }
        seenFiles.set(file, info)
      }
      if (groupOrTest instanceof Group) {
        info.expectedGroups++
      } else {
        info.expectedTests++
      }
    }

    /**
     * Run the test executor
     */
    for (const groupOrTest of this.#suite.stack) {
      const file = groupOrTest.options.meta.file
      const tracker = seenFiles.get(file) as FilesTracker

      /**
       * Skip tests in bail mode when there is an error
       */
      if (this.#options.bail && this.#hasError) {
        if (groupOrTest instanceof Group) {
          groupOrTest.tap((t) => t.skip(true, 'Skipped due to bail mode'))
        } else {
          groupOrTest.skip(true, 'Skipped due to bail mode')
        }
      }

      if (tracker.notified === false) {
        this.#notifyFileStart(file, tracker)
        tracker.notified = true
      }

      await groupOrTest.exec()

      if (!this.#hasError && groupOrTest.failed) {
        this.#hasError = true
      }

      if (groupOrTest instanceof Group) {
        tracker.seenGroups++
      } else {
        tracker.seenTests++
      }

      if (tracker.expectedGroups === tracker.seenGroups && tracker.expectedTests === tracker.seenTests) {
        this.#notifyFileEnd(file, tracker)
      }
    }

    /**
     * Cleanup setup hooks
     */
    await this.#runSetupCleanupFunctions()

    /**
     * Run + cleanup teardown hooks
     */
    await this.#runTeardownHooks()
    await this.#runTeardownCleanupFunctions()

    /**
     * Notify test end
     */
    this.#notifyEnd()
  }
}

interface FilesTracker {
  notified: boolean
  expectedGroups: number
  expectedTests: number
  seenGroups: number
  seenTests: number
}
