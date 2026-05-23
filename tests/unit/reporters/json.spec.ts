import { test } from 'node:test'
import assert from 'node:assert'
import { JSONReporter } from '../../../src/reporters/json.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { Runner, TestEndNode, RunnerEvents, WithCorrelation, RunnerListNode } from '../../../src/types.js'

test('JSONReporter', async (t) => {
  let logs: string[] = []
  // eslint-disable-next-line no-console
  const originalLog = console.log

  t.beforeEach(() => {
    logs = []
    // eslint-disable-next-line no-console
    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
    }
  })

  t.afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = originalLog
  })

  await t.test('aggregates execution results and prints them at the end', async () => {
    const reporter = new JSONReporter()
    const emitter = new Emitter<RunnerEvents>()

    const mockRunner = {
      getSummary: () => ({
        hasError: true,
        aggregates: { total: 1, passed: 0, failed: 1, skipped: 0 },
        duration: 12.34,
      }),
    } as unknown as Runner

    reporter.boot(mockRunner, emitter, {} as any)

    const payload: WithCorrelation<TestEndNode> = {
      title: { expanded: 'test 1', original: 'test 1' },
      isTodo: false,
      hasError: true,
      isSkipped: false,
      isFailing: false,
      isPinned: false,
      duration: 12.34,
      errors: [{ phase: 'test', error: new Error('assertion failed') }],
      retryAttempt: 1,
    } as any

    await emitter.emit('test:end', payload)

    // Output shouldn't happen yet
    assert.strictEqual(logs.length, 0)

    // Simulate runner end
    await (reporter as any).end()

    assert.strictEqual(logs.length, 1)
    const data = JSON.parse(logs[0])

    assert.strictEqual(data.success, false)
    assert.deepStrictEqual(data.summary, {
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      durationMs: 12.34,
    })

    assert.strictEqual(data.failures.length, 1)
    assert.strictEqual(data.failures[0].title, 'test 1')
    assert.strictEqual(data.failures[0].errors[0].phase, 'test')
    assert.strictEqual(data.failures[0].errors[0].error.message, 'assertion failed')
  })

  await t.test('aggregates list payload and prints it at the end', async () => {
    const reporter = new JSONReporter()
    const emitter = new Emitter<RunnerEvents>()

    // No getSummary needed for list payload
    const mockRunner = {} as Runner
    reporter.boot(mockRunner, emitter, {} as any)

    const payload: RunnerListNode = {
      suites: [
        {
          name: 'Suite 1',
          groups: [],
          tests: [],
          files: ['abc'],
        },
      ],
    }

    await emitter.emit('runner:list', payload as any)

    assert.strictEqual(logs.length, 0)

    await (reporter as any).end()

    assert.strictEqual(logs.length, 1)
    const data = JSON.parse(logs[0])

    assert.strictEqual(data.success, true)
    assert.strictEqual(data.list.suites.length, 1)
    assert.strictEqual(data.list.suites[0].name, 'Suite 1')
  })

  await t.test('does not print to console if isProgrammatic is true', async () => {
    const reporter = new JSONReporter()
    reporter.isProgrammatic = true

    const emitter = new Emitter<RunnerEvents>()

    const mockRunner = {
      getSummary: () => ({
        hasError: false,
        aggregates: { total: 0, passed: 0, failed: 0, skipped: 0 },
        duration: 0,
      }),
    } as unknown as Runner

    reporter.boot(mockRunner, emitter, {} as any)

    await (reporter as any).end()

    assert.strictEqual(logs.length, 0)
    assert.ok(reporter.result)
    assert.strictEqual(reporter.result.success, true)
  })
})
