import { test } from 'node:test'
import assert from 'node:assert'
import { Suite } from '../../src/testing/suite/main.js'
import { Group } from '../../src/testing/group/main.js'
import { Test } from '../../src/testing/test/main.js'
import { Emitter } from '../../src/testing/emitter.js'
import { Refiner } from '../../src/refiner/main.js'

function createTest(title: string, emitter: Emitter, refiner: Refiner) {
  const context = {} as any
  const t = new Test(title, context, emitter, refiner)
  t.run(() => {
    // ...
  })
  return t
}

test('Suite', async (t) => {
  await t.test('adds tests and groups to the stack', () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    const testItem = createTest('T1', emitter, refiner)
    const group = new Group('Math', emitter, refiner)

    suite.add(testItem)
    suite.add(group)

    assert.strictEqual(suite.stack.length, 2)
  })

  await t.test('taps into tests via onTest', () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    const testItem = createTest('T1', emitter, refiner)
    suite.add(testItem)

    let testConfigured = false
    suite.onTest((testInstance) => {
      if (testInstance === testItem) testConfigured = true
    })

    const testItem2 = createTest('T2', emitter, refiner)
    suite.add(testItem2)

    assert.strictEqual(testConfigured, true)
  })

  await t.test('taps into groups via onGroup', () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    const group = new Group('Math', emitter, refiner)
    suite.add(group)

    let groupConfigured = false
    suite.onGroup((g) => {
      if (g === group) groupConfigured = true
    })

    assert.strictEqual(groupConfigured, true)
  })

  await t.test('enables bail mode recursively', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    const group = new Group('Math', emitter, refiner)
    suite.add(group)

    suite.bail(true)

    // Group bail toggles are internal, but we can test behavior or see if group fails early
    const t1 = createTest('T1', emitter, refiner)
    t1.run(() => {
      throw new Error('Failed')
    })
    const t2 = createTest('T2', emitter, refiner)
    let t2Executed = false
    t2.run(() => {
      t2Executed = true
    })

    group.add(t1)
    group.add(t2)

    await suite.exec()

    assert.strictEqual(t1.failed, true)
    assert.strictEqual(t2Executed, false)
  })

  await t.test('executes setup and teardown hooks', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    const calls: string[] = []
    suite.setup(() => {
      calls.push('setup')
    })
    suite.teardown(() => {
      calls.push('teardown')
    })

    const testItem = createTest('T1', emitter, refiner)
    suite.add(testItem)

    await suite.exec()

    assert.deepStrictEqual(calls, ['setup', 'teardown'])
  })

  await t.test('skips suite if refiner disables it', async () => {
    const emitter = new Emitter()
    const refiner = new Refiner({ tests: ['T2'] })
    const suite = new Suite('Unit Suite', [], emitter, refiner)

    let setupCalled = false
    suite.setup(() => {
      setupCalled = true
    })

    const testItem = createTest('T1', emitter, refiner)
    suite.add(testItem)

    await suite.exec()

    assert.strictEqual(setupCalled, false)
  })
})
