import { html as litHtml } from 'lit-html'
import { Test } from './test/main.js'
import { Group } from './group/main.js'
import { Suite } from './suite/main.js'
import { WebRunner } from './web_runner.js'
import { Emitter } from './emitter.js'
import { Refiner } from '../refiner/main.js'
import { createTest, createTestGroup } from './create_test.js'
import { TestExecutor } from '../types.js'

export { fixture } from './fixture.js'

// We will initialize these from harness.ts when booting
export let activeRunner: WebRunner | undefined
export let activeSuite: Suite | undefined
export let activeGroup: Group | undefined
export let activeEmitter: Emitter | undefined
export let activeRefiner: Refiner | undefined

/**
 * Retrieves the currently active test runner instance.
 * Useful for inspecting the runner state, such as checking if any tests have failed.
 *
 * @returns The active WebRunner instance, or undefined if no runner is currently active.
 */
export function getActiveRunner() {
  return activeRunner
}

/**
 * Retrieves the currently active event emitter instance.
 * Useful for listening to or emitting custom framework events programmatically.
 *
 * @returns The active Emitter instance, or undefined if no emitter is currently active.
 */
export function getActiveEmitter() {
  return activeEmitter
}

/**
 * Utility type that removes the first argument from a function's parameter list.
 */
export type OmitFirstArg<F> = F extends [_: any, ...args: infer R] ? R : never

/**
 * The current active test
 */
let activeTest: Test | undefined

/**
 * The current executing group (during setup hooks)
 */
let activeExecutingGroup: Group | undefined

/**
 * The current test file being imported
 */
let activeFile: string | undefined

/**
 * Set the active test runner, suite, emitter, and refiner instances.
 * This is called by the Lupa harness during boot and should not be used directly.
 * @internal
 */
export function setActiveInstances(runner: WebRunner, suite: Suite, emitter: Emitter, refiner: Refiner) {
  activeRunner = runner
  activeSuite = suite
  activeEmitter = emitter
  activeRefiner = refiner
}

/**
 * Set the current file being imported. Called by the harness
 * before importing each test file.
 * @internal
 */
export function setActiveFile(file: string | undefined) {
  activeFile = file
}

/**
 * Define a new test.
 *
 * The test callback receives a {@link TestContext} which provides
 * access to assertions, fixtures, and other test utilities.
 *
 * @param title - The name of the test.
 * @param callback - The function containing the test logic. Can be synchronous or asynchronous.
 *
 * @example
 * ```ts
 * test('math works', ({ assert }) => {
 *   assert.equal(1 + 1, 2)
 * })
 * ```
 */
export function test(title: string, callback?: TestExecutor<undefined>) {
  if (!activeEmitter || !activeRefiner || !activeSuite) {
    throw new Error('Test API is not initialized. Ensure tests are executed via Lupa harness.')
  }

  const debuggingError = new Error()

  const testInstance = createTest(title, activeEmitter, activeRefiner, debuggingError, {
    group: activeGroup,
    suite: activeSuite,
    file: activeFile,
  })

  testInstance.setup((t) => {
    activeTest = t
    return () => {
      activeTest = undefined
    }
  })

  // IMPORTANT: The `testInstance` MUST be added to the group/suite AFTER the
  // internal setup hook above. `group.add()` maps `group.each.setup` hooks
  // onto the test. By adding the test to the group here, we guarantee that
  // `activeTest` is defined before the user's `group.each.setup` logic executes.
  if (activeGroup) {
    activeGroup.add(testInstance)
  } else if (activeSuite) {
    activeSuite.add(testInstance)
  }

  if (callback) {
    testInstance.run(callback, debuggingError)
  }

  return testInstance
}

/**
 * Group multiple tests together.
 *
 * Groups allow you to define shared setup/teardown hooks and configure
 * timeouts or retries for all tests within the group.
 *
 * @param title - The name of the group.
 * @param callback - A function where you define tests using the `test` method.
 *
 * @example
 * ```ts
 * test.group('Math operations', (group) => {
 *   group.setup(() => {
 *     // Runs once before all tests in this group
 *   })
 *
 *   test('addition', ({ assert }) => {
 *     assert.equal(1 + 1, 2)
 *   })
 * })
 * ```
 */
test.group = function (title: string, callback: (group: Group) => void) {
  if (!activeEmitter || !activeRefiner || !activeSuite) {
    throw new Error('Test API is not initialized. Ensure tests are executed via Lupa harness.')
  }

  const groupInstance = createTestGroup(title, activeEmitter, activeRefiner, {
    group: activeGroup,
    suite: activeSuite,
    file: activeFile,
  })

  groupInstance.setup((g) => {
    activeExecutingGroup = g
    return () => {
      activeExecutingGroup = undefined
    }
  })

  // set active group so tests defined inside the callback are attached to it
  const previousGroup = activeGroup
  activeGroup = groupInstance

  callback(groupInstance)

  activeGroup = previousGroup
}

/**
 * Create a test macro.
 *
 * Macros are reusable test logic blocks. Within the macro, you can access the
 * currently executing test to read its context values or define cleanup hooks.
 *
 * @param callback - The macro implementation function. The first argument will
 *                   automatically be the active test instance.
 * @returns A wrapped function that can be called inside your tests without needing to pass the test instance manually.
 *
 * @example
 * ```ts
 * const loginUser = test.macro(async (t, role: string) => {
 *   const user = await db.createUser({ role })
 *   t.cleanup(() => user.delete())
 *   return user
 * })
 * ```
 */
test.macro = function <T extends (test: Test<any>, ...args: any[]) => any>(
  callback: T
): (...args: OmitFirstArg<Parameters<T>>) => ReturnType<T> {
  return (...args) => {
    if (!activeTest) {
      throw new Error('Cannot invoke macro outside of the test callback')
    }
    return callback(activeTest, ...args)
  }
}

/**
 * `html` template tag from `lit-html`.
 * Used for creating DOM templates to be rendered by {@link fixture}.
 */
export const html = litHtml

/**
 * Returns the currently executing Test instance, or `undefined` if called outside of a test execution context.
 */
export function getActiveTest() {
  return activeTest
}

/**
 * Returns the currently executing Group instance, or `undefined` if called outside of a group setup execution context.
 */
export function getActiveExecutingGroup() {
  return activeExecutingGroup
}

/**
 * Returns the currently executing Test instance. Throws an error if called outside of a test execution context.
 *
 * @category Execution
 * @throws {Error} Throws if called outside of an active test execution context
 */
export function getActiveTestOrFail() {
  if (!activeTest) throw new Error('Cannot access active test outside of a test callback')
  return activeTest
}
