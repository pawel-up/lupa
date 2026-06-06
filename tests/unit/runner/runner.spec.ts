import { test } from 'node:test'
import assert from 'node:assert'
import { Runner } from '../../../src/runner/runner.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { RunnerEvents } from '../../../src/types.js'

test('Runner', async (t) => {
  const dummyPool = {} as any

  await t.test('boot initializes tracker and listens to events', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)

    let reporterCalled = false
    runner.registerReporter(async () => {
      reporterCalled = true
    })

    await runner.start()
    assert.strictEqual(reporterCalled, true)
    assert.strictEqual(runner.failed, false)

    // Emit start events so Tracker doesn't throw when finding nodes
    await emitter.emit('suite:start', { name: 'S1', browserId: 'chromium', file: 'test.ts', meta: {} } as any)
    await emitter.emit('test:start', {
      title: 'T1',
      isFailing: false,
      browserId: 'chromium',
      file: 'test.ts',
      meta: { suite: 'S1' },
    } as any)
    // Test failure tracking - emitting test:end with hasError
    await emitter.emit('test:end', {
      title: { expanded: 'T1', original: 'T1' },
      hasError: true,
      errors: [],
      browserId: 'chromium',
      file: 'test.ts',
      meta: { suite: 'S1' },
    } as any)
    assert.strictEqual(runner.failed, true)

    // Test summary
    const summary = runner.getSummary()
    assert.ok(summary)
    assert.strictEqual(summary.hasError, true)
  })

  await t.test('suite:end also flags runner as failed', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)
    await runner.start()

    await emitter.emit('suite:start', { name: 'S1', browserId: 'chromium', file: 'test.ts', meta: {} } as any)
    await emitter.emit('suite:end', {
      name: 'S1',
      hasError: true,
      errors: [],
      browserId: 'chromium',
      file: 'test.ts',
      meta: {},
    } as any)
    assert.strictEqual(runner.failed, true)
  })

  await t.test('group:end also flags runner as failed', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)
    await runner.start()

    await emitter.emit('suite:start', { name: 'S1', browserId: 'chromium', file: 'test.ts', meta: {} } as any)
    await emitter.emit('group:start', {
      title: 'G1',
      browserId: 'chromium',
      file: 'test.ts',
      meta: { suite: 'S1' },
    } as any)
    await emitter.emit('group:end', {
      title: 'G1',
      hasError: true,
      errors: [],
      browserId: 'chromium',
      file: 'test.ts',
      meta: { suite: 'S1' },
    } as any)
    assert.strictEqual(runner.failed, true)
  })

  await t.test('calls object-based reporters handler', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)

    let reporterCalled = false
    const reporter = {
      name: 'object-reporter',
      handler: async () => {
        reporterCalled = true
      },
    }

    runner.registerReporter(reporter as any)
    await runner.start()

    assert.strictEqual(reporterCalled, true)
  })

  await t.test('getSummary throws if not booted', () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)

    assert.throws(() => {
      runner.getSummary()
    }, /Invalid state: Tracker not initialized/)
  })

  await t.test('end method works without throwing', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const runner = new Runner(emitter, {} as any, dummyPool)
    await runner.end()
    assert.ok(true)
  })
})
