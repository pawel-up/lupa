import { Refiner } from '../refiner/main.js'
import type { GroupMetadata, TestMetadata } from '../types.js'
import { Emitter } from './emitter.js'
import { Group } from './group/main.js'
import { Suite } from './suite/main.js'
import { Test } from './test/main.js'
import { TestContext } from './test_context.js'

/**
 * Function to create the test context for the test
 */
const contextBuilder = (testInstance: Test) => new TestContext(testInstance)

/**
 * Create a new instance of the Test
 */
export function createTest(
  title: string,
  emitter: Emitter,
  refiner: Refiner,
  debuggingError: Error,
  options: {
    // It is safe to require a suite here as even when not using test suites, a "default" suite
    // is created to hold all tests.
    suite: Suite
    group?: Group
    file: string
  }
) {
  const testInstance = new Test(title, contextBuilder, emitter, refiner, options.group)
  const meta: TestMetadata = {
    file: options.file,
    suite: options.suite.name,
    abort: (message: string) => {
      debuggingError.message = message
      throw debuggingError
    },
  }
  if (options.group) {
    meta.group = options.group.title
  }
  Object.assign(testInstance.options.meta, meta)

  // The timeout and retries is set up in the harness
  // for each suite abd taps into each test/group.

  // Registration to group/suite is now handled by the caller (api.ts)
  // to ensure internal lifecycle hooks are added before group hooks.

  return testInstance
}

/**
 * Create a new instance of the Group
 */
export function createTestGroup(
  title: string,
  emitter: Emitter,
  refiner: Refiner,
  options: {
    group?: Group
    // It is safe to require a suite here as even when not using test suites, a "default" suite
    // is created to hold all tests.
    suite: Suite
    file: string
  }
): Group {
  if (options.group) {
    throw new Error('Nested groups are not supported by Lupa')
  }

  const group = new Group(title, emitter, refiner)
  const meta: GroupMetadata = {
    file: options.file,
    suite: options.suite.name,
  }
  Object.assign(group.options.meta, meta)

  // The timeout and retries is set up in the harness
  // for each suite abd taps into each test/group.

  if (options.suite) {
    options.suite.add(group)
  }

  return group
}
