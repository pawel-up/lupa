import { Refiner } from '../refiner/main.js'
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
    group?: Group
    suite?: Suite
    file?: string
    timeout?: number
    retries?: number
  }
) {
  const testInstance = new Test(title, contextBuilder, emitter, refiner, options.group)
  testInstance.options.meta.suite = options.suite?.name
  testInstance.options.meta.group = options.group?.title
  testInstance.options.meta.fileName = options.file
  testInstance.options.meta.abort = (message: string) => {
    debuggingError.message = message
    throw debuggingError
  }

  if (options.timeout !== undefined) {
    testInstance.timeout(options.timeout)
  }
  if (options.retries !== undefined) {
    testInstance.retry(options.retries)
  }

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
    suite?: Suite
    file?: string
    timeout?: number
    retries?: number
  }
): Group {
  if (options.group) {
    throw new Error('Nested groups are not supported by Lupa')
  }

  const group = new Group(title, emitter, refiner)
  group.options.meta.suite = options.suite?.name
  group.options.meta.fileName = options.file

  if (options.suite) {
    options.suite.add(group)
  }

  return group
}
