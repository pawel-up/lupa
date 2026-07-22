import { test } from 'node:test'
import assert from 'node:assert'
import { Test } from '../../src/testing/test/main.js'
import { Emitter } from '../../src/testing/emitter.js'
import { Refiner } from '../../src/refiner/main.js'
import type { TestContext } from '../../src/testing/test_context.js'

test('Test', async (t) => {
  // Ensure we define the static callbacks since Test throws an error if they are missing
  Test.executingCallbacks = []
  Test.executedCallbacks = []

  await t.test('configures properties via chainable methods', () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    const t1 = new Test('T1', context, emitter, refiner)

    t1.skip(true, 'WIP')
    t1.fails('Should fail')
    t1.timeout(1234)
    t1.tags(['@slow'])
    t1.retry(3)
    t1.waitForDone()

    assert.strictEqual(t1.options.isSkipped, true)
    assert.strictEqual(t1.options.skipReason, 'WIP')
    assert.strictEqual(t1.options.isFailing, true)
    assert.strictEqual(t1.options.failReason, 'Should fail')
    assert.strictEqual(t1.options.timeout, 1234)
    assert.deepStrictEqual(t1.options.tags, ['@slow'])
    assert.strictEqual(t1.options.retries, 3)
    assert.strictEqual(t1.options.waitsForDone, true)
  })

  await t.test('executes global static callbacks', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    let executingCalled = false
    let executedCalled = false

    Test.executing(() => {
      executingCalled = true
    })
    Test.executed(() => {
      executedCalled = true
    })

    const t1 = new Test('T1', context, emitter, refiner)
    t1.run(() => {
      // ...
    })

    await t1.exec()

    assert.strictEqual(executingCalled, true)
    assert.strictEqual(executedCalled, true)

    // reset callbacks
    Test.executingCallbacks = []
    Test.executedCallbacks = []
  })

  await t.test('skips execution if refiner disables it', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner({ tests: ['XYZ'] })
    const context = {} as TestContext

    let executed = false
    const t1 = new Test('T1', context, emitter, refiner)
    t1.run(() => {
      executed = true
    })

    await t1.exec()

    assert.strictEqual(executed, false)
  })

  await t.test('skips execution if marked as skipped or todo', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    let executed = false
    const t1 = new Test('T1', context, emitter, refiner)
    t1.skip(true)
    t1.run(() => {
      executed = true
    })

    await t1.exec()
    assert.strictEqual(executed, false)

    const t2 = new Test('T2', context, emitter, refiner)
    // missing .run() makes it a todo
    await t2.exec()
    assert.strictEqual(t2.options.isTodo, true)
  })

  await t.test('runs test with dataset', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    const t1 = new Test('T1', context, emitter, refiner)
    const dataset = [1, 2, 3]
    const executedItems: number[] = []

    t1.with(dataset).run((_ctx, data) => {
      executedItems.push(data)
    })

    await t1.exec()

    assert.deepStrictEqual(executedItems, [1, 2, 3])
  })

  await t.test('runs setup, teardown and cleanup hooks', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    const t1 = new Test('T1', context, emitter, refiner)
    const calls: string[] = []

    t1.setup(() => {
      calls.push('setup')
    })
    t1.teardown(() => {
      calls.push('teardown')
    })

    t1.run(() => {
      calls.push('run')
      t1.cleanup(() => {
        calls.push('cleanup')
      })
    })

    await t1.exec()

    assert.deepStrictEqual(calls, ['setup', 'run', 'cleanup', 'teardown'])
  })

  await t.test('executes retries with custom delay callback', async () => {
    let attempts = 0
    const delays: number[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    const t1 = new Test('retry with custom delay', context, emitter, refiner)
    t1.retry(2, (attempt) => {
      delays.push(attempt)
      return 10
    })

    t1.run(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('failed attempt')
      }
    })

    await t1.exec()

    assert.equal(attempts, 3)
    assert.deepStrictEqual(delays, [1, 2])
  })

  await t.test('executes retries with factor backoff options', async () => {
    let attempts = 0
    const emitter = new Emitter()
    const refiner = new Refiner()
    const context = {} as TestContext

    const t1 = new Test('retry with factor', context, emitter, refiner)
    t1.retry(2, { factor: 2, minTimeout: 10 })

    t1.run(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('failed attempt')
      }
    })

    await t1.exec()

    assert.equal(attempts, 3)
  })
})
