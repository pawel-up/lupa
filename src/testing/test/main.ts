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
import { type Group } from '../group/main.js'
import { type Emitter } from '../emitter.js'
import { type Refiner } from '../../refiner/main.js'
import { DummyRunner, TestRunner } from './runner.js'
import type { TestContext } from '../test_context.js'
import type {
  TestHooks,
  DataSetNode,
  TestEndNode,
  TestOptions,
  TestExecutor,
  TestHooksHandler,
  TestHooksCleanupHandler,
  RunnerListTestNode,
} from '../../types.js'

/**
 * Test class exposes a self contained API to configure and run
 * tests along with its hooks.
 *
 * @example
 * const test = new Test('2 + 2 = 4', emitter, refiner)
 *
 * test.run(async ({ assert }) => {
 *   assert.equal(2 + 2 , 4)
 * })
 */
export class Test<TestData extends DataSetNode = undefined> extends Macroable {
  /**
   * Methods to call before the test callback is executed
   */
  static executingCallbacks: ((test: Test) => void)[] = []

  /**
   * Methods to call after the test callback is executed
   */
  static executedCallbacks: ((test: Test, hasError: boolean, errors: TestEndNode['errors']) => void)[] = []

  /**
   * Define a synchronous function to call before running
   * the test executor callback
   *
   * Do note: Async methods are not allowed
   *
   * @param callback - The function to call before running the test executor callback
   */
  static executing(callback: (test: Test) => void): void {
    this.executingCallbacks.push(callback)
  }

  /**
   * Define a synchronous function to call after running
   * the test executor callback
   *
   * Do note: Async methods are not allowed
   *
   * @param callback - The function to call after running the test executor callback
   */
  static executed(callback: (test: Test, hasError: boolean, errors: TestEndNode['errors']) => void): void {
    this.executedCallbacks.push(callback)
  }

  #refiner: Refiner
  #emitter: Emitter

  /**
   * Reference to the active runner running the
   * test
   */
  #activeRunner?: TestRunner

  /**
   * Check if the test has been executed
   */
  #executed = false
  #failed = false

  /**
   * Debugging Error is used to point the errors to the source of
   * the test.
   *
   * Since tests are executed after they are created, the errors thrown
   * by the internals of Japa will never point to the original test.
   * Therefore, this debuggingError property is used to retain
   * the source of the test callback.
   */
  #debuggingError: Error | null = null

  /**
   * Reference to registered hooks
   */
  #hooks = new Hooks<TestHooks>()

  /**
   * The function for creating the test context
   */
  #contextAccumulator?: (test: this) => TestContext | Promise<TestContext>

  /**
   * The function for computing if test should
   * be skipped or not
   */
  #skipAccumulator?: () => Promise<boolean> | boolean

  /**
   * The function that returns the test data set
   */
  #datasetAccumulator?: () => Promise<any[]> | any[]

  /**
   * Know if the test has been executed. Skipped and
   * todo tests are also considered executed.
   */
  get executed(): boolean {
    return this.#executed
  }

  /**
   * Know if the test has failed.
   */
  get failed(): boolean {
    return this.#failed
  }

  /**
   * Test options
   */
  options: TestOptions

  /**
   * Reference to the test dataset
   */
  dataset?: any[]

  /**
   * Reference to the test context. Available at the time
   * of running the test
   */
  context!: TestContext

  /**
   * Find if the test is pinned
   */
  get isPinned() {
    return this.#refiner.isPinned(this)
  }

  constructor(
    public title: string,
    context: TestContext | ((test: Test<TestData>) => TestContext | Promise<TestContext>),
    emitter: Emitter,
    refiner: Refiner,
    public parent?: Group
  ) {
    super()

    this.#emitter = emitter
    this.#refiner = refiner
    this.options = {
      title: this.title,
      tags: [],
      timeout: 2000,
      meta: {
        file: '',
        suite: '',
      },
    }

    /**
     * Make sure the instantiated class has its own property "executingCallbacks"
     * and "executedCallbacks"
     */
    if (!Object.prototype.hasOwnProperty.call(this.constructor, 'executingCallbacks')) {
      throw new Error(`Define static property "executingCallbacks = []" on ${this.constructor.name} class`)
    }
    if (!Object.prototype.hasOwnProperty.call(this.constructor, 'executedCallbacks')) {
      throw new Error(`Define static property "executedCallbacks = []" on ${this.constructor.name} class`)
    }

    if (typeof context === 'function') {
      this.#contextAccumulator = context as (test: Test<TestData>) => TestContext | Promise<TestContext>
    } else {
      this.context = context
    }
  }

  /**
   * Find if test should be skipped
   */
  async #computeShouldSkip() {
    if (this.#skipAccumulator) {
      this.options.isSkipped = await this.#skipAccumulator()
    }
  }

  /**
   * Find if test is a todo
   */
  #computeIsTodo() {
    this.options.isTodo = !this.options.executor
  }

  /**
   * Returns the dataset array or undefined
   */
  async #computeDataset(): Promise<any[] | undefined> {
    if (typeof this.#datasetAccumulator === 'function') {
      this.dataset = await this.#datasetAccumulator()
    }

    return this.dataset
  }

  /**
   * Get context instance for the test
   */
  async #computeContext(): Promise<TestContext> {
    if (typeof this.#contextAccumulator === 'function') {
      this.context = await this.#contextAccumulator(this)
    }

    return this.context
  }

  /**
   * Skip the test conditionally
   *
   * @param skip - Whether to skip the test, can be a function that returns true
   * @param skipReason - The reason to skip the test
   */
  skip(skip: boolean | (() => Promise<boolean> | boolean) = true, skipReason?: string): this {
    if (typeof skip === 'function') {
      this.#skipAccumulator = skip
    } else {
      this.options.isSkipped = skip
    }

    this.options.skipReason = skipReason
    return this
  }

  /**
   * Expect the test to fail. Helpful in creating test cases
   * to showcase bugs
   *
   * @param failReason - The reason the test is expected to fail
   */
  fails(failReason?: string): this {
    this.options.isFailing = true
    this.options.failReason = failReason
    return this
  }

  /**
   * Define custom timeout for the test
   *
   * @param timeout - The timeout in milliseconds
   */
  timeout(timeout: number): this {
    this.options.timeout = timeout
    return this
  }

  /**
   * Disable test timeout. It is same as calling `test.timeout(0)`
   */
  disableTimeout(): this {
    return this.timeout(0)
  }

  /**
   * Reset the timeout from within the test callback.
   *
   * @param duration - The timeout duration in milliseconds
   */
  resetTimeout(duration?: number): this {
    if (this.#activeRunner) {
      this.#activeRunner.resetTimeout(duration)
    } else {
      if (duration) {
        this.timeout(duration)
      } else {
        this.disableTimeout()
      }
    }

    return this
  }

  /**
   * Assign tags to the test. Later you can use the tags to run
   * specific tests
   *
   * @param tags - The tags to assign to the test
   * @param strategy - The strategy to use when assigning the tags
   */
  tags(tags: string[], strategy: 'replace' | 'append' | 'prepend' = 'replace'): this {
    if (strategy === 'replace') {
      this.options.tags = tags
      return this
    }

    if (strategy === 'prepend') {
      this.options.tags = tags.concat(this.options.tags)
      return this
    }

    this.options.tags = this.options.tags.concat(tags)
    return this
  }

  /**
   * Configure the number of times this test should be retried
   * when failing.
   *
   * @param retries - The number of times to retry the test
   */
  retry(retries: number): this {
    this.options.retries = retries
    return this
  }

  /**
   * Wait for the test executor to call done method
   */
  waitForDone(): this {
    this.options.waitsForDone = true
    return this
  }

  /**
   * Pin current test. Pinning a test will only run the
   * pinned tests.
   */
  pin(): this {
    this.#refiner.pinTest(this)
    return this
  }

  /**
   * Define the dataset for the test. The test executor will be invoked
   * for all the items inside the dataset array
   *
   * @param dataset - The dataset to use for the test
   * @returns The test with the dataset configured
   */
  with<Dataset extends DataSetNode>(dataset: Dataset): Test<Dataset> {
    if (Array.isArray(dataset)) {
      this.dataset = dataset
      return this as unknown as Test<Dataset>
    }

    if (typeof dataset === 'function') {
      this.#datasetAccumulator = dataset
      return this as unknown as Test<Dataset>
    }

    throw new Error('dataset must be an array or a function that returns an array')
  }

  /**
   * Define the test executor function
   *
   * @param executor - The function to execute
   * @param debuggingError - The error to use when debugging
   */
  run(executor: TestExecutor<TestData>, debuggingError?: Error): this {
    this.#debuggingError = debuggingError || new Error()
    this.options.executor = executor
    return this
  }

  /**
   * Register a test setup function
   *
   * @param handler - The function to call before running the test executor callback
   */
  setup(handler: TestHooksHandler): this {
    debug('registering "%s" test setup hook %s', this.title, handler)
    this.#hooks.add('setup', handler)
    return this
  }

  /**
   * Register a test teardown function
   *
   * @param handler - The function to call after running the test executor callback
   */
  teardown(handler: TestHooksHandler): this {
    debug('registering "%s" test teardown hook %s', this.title, handler)
    this.#hooks.add('teardown', handler)
    return this
  }

  /**
   * Register a cleanup hook from within the test
   *
   * @param handler - The function to call after running the test executor callback
   */
  cleanup(handler: TestHooksCleanupHandler): this {
    debug('registering "%s" test cleanup function %s', this.title, handler)
    this.#hooks.add('cleanup', handler)
    return this
  }

  /**
   * Execute test
   */
  async exec(): Promise<void> {
    const self = this.constructor as typeof Test

    /**
     * Return early, if there are pinned test and the current test is not
     * pinned.
     *
     * However, the pinned test check is only applied when there
     * is no filter on the test title.
     */
    if (!this.#refiner.allows(this)) {
      debug('test "%s" skipped by refiner', this.title)
      return
    }

    /**
     * Avoid re-running the same test multiple times
     */
    if (this.#executed) {
      return
    }

    this.#executed = true

    /**
     * Do not run tests without executor function
     */
    this.#computeIsTodo()
    if (this.options.isTodo) {
      debug('skipping todo test "%s"', this.title)
      new DummyRunner(this, this.#emitter).run()
      return
    }

    /**
     * Do not run test meant to be skipped
     */
    await this.#computeShouldSkip()
    if (this.options.isSkipped) {
      debug('skipping test "%s", reason (%s)', this.title, this.options.skipReason || 'Skipped using .skip method')
      new DummyRunner(this, this.#emitter).run()
      return
    }

    /**
     * Compute dataset by calling the with method
     */
    await this.#computeDataset()

    /**
     * Run for each row inside dataset
     */
    if (Array.isArray(this.dataset) && this.dataset.length) {
      let index = 0

      for (const _ of this.dataset) {
        await this.#computeContext()

        this.#activeRunner = new TestRunner(
          this,
          this.#hooks,
          this.#emitter,
          {
            executing: self.executingCallbacks,
            executed: self.executedCallbacks,
          },
          this.#debuggingError,
          index
        )

        await this.#activeRunner.run()

        /**
         * Mark test as failed when it is not already been
         * marked as failed and the current iteration
         * fails.
         */
        if (!this.#failed && this.#activeRunner.failed) {
          this.#failed = true
        }

        index++
      }

      this.#activeRunner = undefined
      return
    }

    /**
     * Run when no dataset is used
     */
    await this.#computeContext()

    this.#activeRunner = new TestRunner(
      this,
      this.#hooks,
      this.#emitter,
      {
        executing: self.executingCallbacks,
        executed: self.executedCallbacks,
      },
      this.#debuggingError
    )

    await this.#activeRunner.run()
    this.#failed = this.#activeRunner.failed
    this.#activeRunner = undefined
  }

  /**
   * Return JSON representation of the test
   */
  toJSON(): RunnerListTestNode {
    return {
      title: this.title,
      tags: this.options.tags || [],
      timeout: this.options.timeout,
      retries: this.options.retries,
      isSkipped: !!this.options.isSkipped,
      isTodo: !!this.options.isTodo,
      meta: this.options.meta,
      isPinned: this.isPinned,
    }
  }
}
