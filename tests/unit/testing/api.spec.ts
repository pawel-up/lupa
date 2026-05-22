import { test as nodeTest } from 'node:test'
import assert from 'node:assert'
import {
  test,
  setActiveInstances,
  setActiveFile,
  getActiveTest,
  getActiveTestOrFail,
} from '../../../src/testing/api.js'
import { WebRunner } from '../../../src/testing/web_runner.js'
import { Emitter } from '../../../src/testing/emitter.js'
import { Suite } from '../../../src/testing/suite/main.js'
import { Refiner } from '../../../src/refiner/main.js'

nodeTest('Testing API (api.ts)', async (t) => {
  let emitter: Emitter
  let refiner: Refiner
  let suite: Suite
  let runner: WebRunner

  t.beforeEach(() => {
    emitter = new Emitter()
    refiner = new Refiner({})
    runner = new WebRunner(emitter)
    suite = new Suite('default', [], emitter, refiner)
    setActiveInstances(runner, suite, emitter, refiner)
    setActiveFile('test.spec.ts')
  })

  await t.test('test() registers a test inside the active suite', () => {
    const instance = test('my test', () => {
      // ...
    })
    assert.strictEqual(instance.title, 'my test')
    assert.strictEqual(instance.options.meta.file, 'test.spec.ts')

    // Test should be pushed to the suite
    assert.strictEqual(suite.stack.length, 1)
    assert.strictEqual(suite.stack[0], instance)
  })

  await t.test('test() throws if instances are not active', () => {
    // @ts-expect-error - clear instances to test failure
    setActiveInstances(undefined, undefined, undefined, undefined)
    assert.throws(
      () =>
        test('should fail', () => {
          // ...
        }),
      /Test API is not initialized/
    )
  })

  await t.test('test.group() registers a group and attaches nested tests to it', () => {
    test.group('my group', (group) => {
      assert.strictEqual(group.title, 'my group')
      assert.strictEqual(group.options.meta.file, 'test.spec.ts')

      // Nested test should be attached to the group, not the suite stack directly
      const childTest = test('child test', () => {
        // ...
      })
      assert.strictEqual(group.tests.length, 1)
      assert.strictEqual(group.tests[0], childTest)
    })

    // Group should be pushed to the suite
    assert.strictEqual(suite.stack.length, 1)
    assert.strictEqual(suite.stack[0].title, 'my group')
  })

  await t.test('test.macro() binds a macro to the active test context', async () => {
    const myMacro = test.macro((activeTestInstance, arg1: string) => {
      return activeTestInstance.title + ' ' + arg1
    })

    let macroResult = ''

    let myTest: any
    // eslint-disable-next-line prefer-const
    myTest = test('macro test', () => {
      assert.strictEqual(getActiveTest(), myTest)
      assert.strictEqual(getActiveTestOrFail(), myTest)

      // Execute macro inside test
      macroResult = myMacro('called')
    })

    // Need to execute the test to trigger the macro
    await myTest.exec()

    assert.strictEqual(macroResult, 'macro test called')
  })

  await t.test('test.macro() throws if called outside a test callback', () => {
    const myMacro = test.macro((_activeTestInstance) => {
      // ...
    })
    assert.throws(() => myMacro(), /Cannot invoke macro outside of the test callback/)
  })

  await t.test('getActiveTestOrFail() throws if no active test', () => {
    assert.throws(() => getActiveTestOrFail(), /Cannot access active test outside of a test callback/)
  })
})
