/*
 * @japa/core
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Hooks } from '../../hooks/main.js'
import Macroable from '@poppinss/macroable'

import debug from '../debug.js'
import { Test } from '../test/main.js'
import { type Emitter } from '../emitter.js'
import { type Refiner } from '../../refiner/main.js'
import { Group } from '../group/main.js'
import { SuiteRunner } from './runner.js'
import type { SuiteHooks, SuiteHooksHandler, RunnerListSuiteNode } from '../../types.js'

/**
 * The Suite class exposes the API to run a group of tests
 * or independent tests together as part of a suite.
 *
 * You can think of suites as
 *   - unit tests suite
 *   - e2e tests suites
 *   - and so on
 *
 * @example
 * const suite = new Suite('unit', emitter)
 * const group = new Group('addition', emitter, refiner)
 * const test = new Test('2 + 2 = 4', emitter, refiner)
 *
 * suite.add(group)
 * group.add(test)
 *
 * // Runs all the tests inside the registered group
 * await suite.exec()
 */
export class Suite extends Macroable {
  #refiner: Refiner
  #emitter: Emitter
  #failed = false
  #bail?: boolean

  /**
   * Reference to registered hooks
   */
  #hooks = new Hooks<SuiteHooks>()

  /**
   * Callbacks to invoke on each test and group
   */
  #configureTestCallbacks: ((test: Test<any>) => void)[] = []
  #configureGroupCallbacks: ((group: Group) => void)[] = []

  /**
   * A collection of tests and groups both
   */
  stack: (Test<any> | Group)[] = []

  /**
   * Number of files in the suite
   */
  filesCount = 0

  /**
   * Know if one or more groups or tests within this suite
   * has failed.
   */
  get failed(): boolean {
    return this.#failed
  }

  constructor(
    public name: string,
    emitter: Emitter,
    refiner: Refiner
  ) {
    super()
    this.#emitter = emitter
    this.#refiner = refiner
  }

  /**
   * Add a test or a group to the execution stack
   *
   * @param testOrGroup - The test or group to add to the execution stack
   */
  add(testOrGroup: Test<any> | Group): this {
    if (testOrGroup instanceof Group) {
      this.#configureGroupCallbacks.forEach((callback) => callback(testOrGroup))
    }

    if (testOrGroup instanceof Test) {
      this.#configureTestCallbacks.forEach((callback) => callback(testOrGroup))
    }

    this.stack.push(testOrGroup)
    return this
  }

  /**
   * Tap into each test and configure it
   *
   * @param callback - The function to call before running the test executor callback
   */
  onTest(callback: (test: Test<any>) => void): this {
    this.stack.forEach((testOrGroup) => {
      if (testOrGroup instanceof Test) {
        callback(testOrGroup)
      }
    })

    this.#configureTestCallbacks.push(callback)
    return this
  }

  /**
   * Tap into each group and configure it
   *
   * @param callback - The function to call before running the test executor callback
   */
  onGroup(callback: (group: Group) => void): this {
    this.stack.forEach((testOrGroup) => {
      if (testOrGroup instanceof Group) {
        callback(testOrGroup)
      }
    })

    this.#configureGroupCallbacks.push(callback)
    return this
  }

  /**
   * Enable/disable the bail mode. In bail mode, all
   * upcoming tests/group will be skipped when the current
   * test fails
   *
   * @param toggle - Whether to enable or disable the bail mode
   * @returns The suite with the bail mode enabled or disabled
   */
  bail(toggle = true): this {
    if (this.#bail === undefined) {
      this.#bail = toggle
      this.onGroup((group) => group.bail(toggle))
    }
    return this
  }

  /**
   * Register a test setup function
   *
   * @param handler - The function to call before running the test executor callback
   */
  setup(handler: SuiteHooksHandler): this {
    debug('registering suite setup hook %s', handler)
    this.#hooks.add('setup', handler)
    return this
  }

  /**
   * Register a test teardown function
   *
   * @param handler - The function to call after running the test executor callback
   */
  teardown(handler: SuiteHooksHandler): this {
    debug('registering suite teardown hook %s', handler)
    this.#hooks.add('teardown', handler)
    return this
  }

  /**
   * Execute suite groups, tests and hooks
   */
  async exec(): Promise<void> {
    /**
     * By default a suite is not allowed to be executed. However, we go
     * through all the tests/ groups within the suite  and if one
     * or more tests/groups are allowed to run, then we will
     * allow the suite to run as well.
     *
     * Basically, we are checking the children to find if the suite
     * should run or not.
     */
    let allowSuite = false
    for (const item of this.stack) {
      allowSuite = this.#refiner.allows(item)
      if (allowSuite) {
        break
      }
    }

    if (!allowSuite) {
      debug('suite disabled by refiner %s', this.name)
      return
    }

    const runner = new SuiteRunner(this, this.#hooks, this.#emitter, {
      bail: this.#bail ?? false,
    })
    await runner.run()
    this.#failed = runner.failed
  }

  /**
   * Return JSON representation of the suite
   */
  toJSON(): RunnerListSuiteNode {
    const tests = []
    const groups = []

    for (const item of this.stack) {
      if (!this.#refiner.allows(item as any)) {
        continue
      }

      if (item instanceof Group) {
        const groupJSON = item.toJSON()
        if (groupJSON.tests.length > 0) {
          groups.push(groupJSON)
        }
      } else {
        tests.push((item as Test<any>).toJSON())
      }
    }

    return {
      name: this.name,
      groups,
      tests,
    }
  }
}
