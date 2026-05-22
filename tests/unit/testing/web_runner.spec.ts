import { test } from 'node:test'
import assert from 'node:assert'
import { WebRunner } from '../../../src/testing/web_runner.js'
import { Emitter } from '../../../src/testing/emitter.js'
import { Suite } from '../../../src/testing/suite/main.js'
import { Refiner } from '../../../src/refiner/main.js'
import { Test } from '../../../src/testing/test/main.js'
import { Group } from '../../../src/testing/group/main.js'

test('WebRunner', async (t) => {
  await t.test('add() registers suite and runs configure callbacks', () => {
    const runner = new WebRunner(new Emitter())
    const suite = new Suite('test suite', [], new Emitter(), new Refiner())

    let callbackExecuted = false
    runner.onSuite((s) => {
      assert.strictEqual(s, suite)
      callbackExecuted = true
    })

    runner.add(suite)

    assert.strictEqual(callbackExecuted, true)
    assert.strictEqual(runner.suites.length, 1)
  })

  await t.test('start() emits runner:start', async () => {
    const emitter = new Emitter()
    const runner = new WebRunner(emitter)

    let eventData: any
    emitter.on('runner:start', (data) => {
      eventData = data
    })

    await runner.start()
    assert.ok(eventData)
  })

  await t.test('end() emits runner:end with failed status', async () => {
    const emitter = new Emitter()
    const runner = new WebRunner(emitter)

    let eventData: any
    emitter.on('runner:end', (data) => {
      eventData = data
    })

    await runner.end()
    assert.ok(eventData)
    assert.strictEqual(eventData.hasError, false)
  })

  await t.test('exec() executes suites and correctly handles failed state', async () => {
    const emitter = new Emitter()
    const runner = new WebRunner(emitter)

    const suite1 = new Suite('s1', [], emitter, new Refiner())
    const suite2 = new Suite('s2', [], emitter, new Refiner())

    runner.add(suite1)
    runner.add(suite2)

    // Fake a failure in suite1
    Object.defineProperty(suite1, 'failed', { value: true, configurable: true })

    await runner.exec()
    assert.strictEqual(runner.failed, true)
  })

  await t.test('bail() propagates skip to all upcoming tests if failed is true', async () => {
    const emitter = new Emitter()
    const runner = new WebRunner(emitter)

    const suite1 = new Suite('s1', [], emitter, new Refiner())
    const suite2 = new Suite('s2', [], emitter, new Refiner())

    Object.defineProperty(suite1, 'failed', { value: true, configurable: true })

    const testInstance = new Test('test 1', {} as any, emitter, new Refiner())
    const groupInstance = new Group('group 1', emitter, new Refiner())

    let testSkipped = false
    let groupTestSkipped = false

    // Stub the skip methods
    testInstance.skip = function (condition, message) {
      if (condition) {
        testSkipped = true
        assert.strictEqual(message, 'Skipped due to bail mode')
      }
      return this
    }

    groupInstance.tap = function (cb) {
      const mockTest = {
        skip(condition: boolean, message: string) {
          if (condition) {
            groupTestSkipped = true
            assert.strictEqual(message, 'Skipped due to bail mode')
          }
        },
      } as any
      cb(mockTest)
      return this
    }

    suite2.stack.push(testInstance)
    suite2.stack.push(groupInstance)

    runner.add(suite1)
    runner.add(suite2)

    // Enable bail
    runner.bail(true)

    await runner.exec()
    assert.strictEqual(testSkipped, true)
    assert.strictEqual(groupTestSkipped, true)
  })
})
