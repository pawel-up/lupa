import { test } from 'node:test'
import assert from 'node:assert'
import { BrowserReporter } from '../../../src/testing/browser_reporter.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type {
  BrowserTelemetryEvents,
  SuiteStartNode,
  GroupStartNode,
  TestEndNode,
  WithCorrelation,
  GroupEndNode,
  SuiteEndNode,
} from '../../../src/types.js'

test('BrowserReporter', async (t) => {
  let logs: { method: string; args: any[] }[] = []

  // eslint-disable-next-line no-console
  const originalLog = console.log
  // eslint-disable-next-line no-console
  const originalGroup = console.group
  // eslint-disable-next-line no-console
  const originalGroupEnd = console.groupEnd
  // eslint-disable-next-line no-console
  const originalError = console.error

  t.beforeEach(() => {
    logs = []
    // eslint-disable-next-line no-console
    console.log = (...args: any[]) => logs.push({ method: 'log', args })
    // eslint-disable-next-line no-console
    console.group = (...args: any[]) => logs.push({ method: 'group', args })
    // eslint-disable-next-line no-console
    console.groupEnd = (...args: any[]) => logs.push({ method: 'groupEnd', args })
    // eslint-disable-next-line no-console
    console.error = (...args: any[]) => logs.push({ method: 'error', args })
  })

  t.afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = originalLog
    // eslint-disable-next-line no-console
    console.group = originalGroup
    // eslint-disable-next-line no-console
    console.groupEnd = originalGroupEnd
    // eslint-disable-next-line no-console
    console.error = originalError
  })

  await t.test('prints suite start and end', async () => {
    const reporter = new BrowserReporter()
    const emitter = new Emitter<BrowserTelemetryEvents>()
    reporter.boot(emitter)

    const payloadStart: WithCorrelation<SuiteStartNode> = { name: 'Suite 1', file: 'abc', browserId: '1' }
    const payloadEnd: WithCorrelation<SuiteEndNode> = {
      name: 'Suite 1',
      file: 'abc',
      browserId: '1',
      errors: [],
      hasError: false,
    }
    await emitter.emit('suite:start', payloadStart)
    await emitter.emit('suite:end', payloadEnd)

    assert.strictEqual(logs.length, 2)
    assert.strictEqual(logs[0].method, 'group')
    assert.strictEqual(logs[0].args[0], '%cSuite: Suite 1')
    assert.strictEqual(logs[1].method, 'groupEnd')
  })

  await t.test('prints group start and end', async () => {
    const reporter = new BrowserReporter()
    const emitter = new Emitter<BrowserTelemetryEvents>()
    reporter.boot(emitter)

    const payloadStart: WithCorrelation<GroupStartNode> = {
      title: 'Group 1',
      file: 'abc',
      browserId: '1',
      meta: {},
    }
    const payloadEnd: WithCorrelation<GroupEndNode> = {
      title: 'Group 1',
      file: 'abc',
      browserId: '1',
      meta: {},
      errors: [],
      hasError: false,
    }
    await emitter.emit('group:start', payloadStart)
    await emitter.emit('group:end', payloadEnd)

    assert.strictEqual(logs.length, 2)
    assert.strictEqual(logs[0].method, 'group')
    assert.strictEqual(logs[0].args[0], '%cGroup: Group 1')
    assert.strictEqual(logs[1].method, 'groupEnd')
  })

  await t.test('prints passing test', async () => {
    const reporter = new BrowserReporter()
    const emitter = new Emitter<BrowserTelemetryEvents>()
    reporter.boot(emitter)

    const payload: TestEndNode = {
      title: { expanded: 'test 1', original: 'test 1' },
      hasError: false,
      isSkipped: false,
      isTodo: false,
      isFailing: false,
      isPinned: false,
      errors: [],
      duration: 12,
      retryAttempt: 1,
      tags: [],
      meta: {},
      timeout: 1,
    }
    await emitter.emit('test:end', payload as any)

    assert.strictEqual(logs.length, 1)
    assert.strictEqual(logs[0].method, 'log')
    assert.strictEqual(logs[0].args[0], '%c✔ test 1')
  })

  await t.test('prints failing test with errors', async () => {
    const reporter = new BrowserReporter()
    const emitter = new Emitter<BrowserTelemetryEvents>()
    reporter.boot(emitter)

    const errorObj = new Error('boom')
    const payload: WithCorrelation<TestEndNode> = {
      title: { expanded: 'test 1', original: 'test 1' },
      hasError: true,
      isSkipped: false,
      isTodo: false,
      isFailing: false,
      isPinned: false,
      errors: [{ phase: 'test', error: errorObj as any }],
      duration: 12,
      retryAttempt: 1,
      tags: [],
      meta: {},
      timeout: 1,
      browserId: '1',
      file: '',
    }
    await emitter.emit('test:end', payload)

    assert.strictEqual(logs.length, 3)
    assert.strictEqual(logs[0].method, 'group')
    assert.strictEqual(logs[0].args[0], '%c✖ test 1')
    assert.strictEqual(logs[1].method, 'error')
    assert.strictEqual(logs[1].args[0], errorObj)
    assert.strictEqual(logs[2].method, 'groupEnd')
  })
})
