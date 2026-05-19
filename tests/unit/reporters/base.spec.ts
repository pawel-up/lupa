import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BaseReporter } from '../../../src/reporters/base.js'
import { SummaryBuilder } from '../../../src/runner/summary_builder.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { RunnerEvents, RunnerSummary } from '../../../src/types.js'
import type { Runner } from '../../../src/runner/runner.js'

class DummyReporter extends BaseReporter {
  public testPrintAggregates(summary: RunnerSummary) {
    this.printAggregates(summary)
  }

  public testAggregateErrors(summary: RunnerSummary) {
    return this.aggregateErrors(summary)
  }

  public async testPrintSummary(summary: RunnerSummary) {
    await this.printSummary(summary)
  }
}

test('BaseReporter', async (t) => {
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

  await t.test('throws when runner is not initialized', () => {
    const reporter = new DummyReporter()
    assert.throws(() => {
      reporter.testPrintAggregates({ aggregates: {} } as any)
    }, /Invalid state: Runner not initialized/)
  })

  await t.test('prints aggregates', () => {
    const reporter = new DummyReporter()
    const summaryBuilder = new SummaryBuilder()
    const runner = { summaryBuilder } as unknown as Runner
    const emitter = new Emitter<RunnerEvents>()
    reporter.boot(runner, emitter, {} as any)

    const summary: RunnerSummary = {
      aggregates: {
        total: 10,
        passed: 5,
        failed: 2,
        todo: 1,
        skipped: 1,
        regression: 1,
      },
      duration: 120,
      hasError: true,
      failureTree: [],
      failedTestsTitles: [],
      importErrors: [],
    }

    reporter.testPrintAggregates(summary)

    // We expect SummaryBuilder to have output something
    assert.ok(logs.length > 0)
    const output = logs.join('\n')
    assert.match(output, /5 passed/)
    assert.match(output, /2 failed/)
    assert.match(output, /1 todo/)
    assert.match(output, /1 skipped/)
    assert.match(output, /1 regression/)
    assert.match(output, /\(10\)/) // total
  })

  await t.test('aggregates errors from failure tree', () => {
    const reporter = new DummyReporter()

    const summary: RunnerSummary = {
      aggregates: { total: 0, passed: 0, failed: 0, todo: 0, skipped: 0, regression: 0 },
      duration: 0,
      hasError: true,
      failedTestsTitles: [],
      importErrors: [],
      failureTree: [
        {
          name: 'Suite 1',
          type: 'suite',
          errors: [{ phase: 'setup', error: new Error('suite error') }],
          children: [
            {
              type: 'test',
              title: 'Test 1',
              errors: [{ phase: 'test', error: new Error('test 1 error') }],
            },
            {
              type: 'group',
              name: 'Group 1',
              errors: [{ phase: 'setup', error: new Error('group error') }],
              children: [
                {
                  type: 'test',
                  title: 'Test 2',
                  errors: [{ phase: 'test', error: new Error('test 2 error') }],
                },
              ],
            },
          ] as any,
        },
      ],
    }

    const errors = reporter.testAggregateErrors(summary)
    assert.strictEqual(errors.length, 4)
    assert.strictEqual(errors[0].title, 'Suite 1')
    assert.strictEqual(errors[1].title, 'Suite 1 / Test 1')
    assert.strictEqual(errors[2].title, 'Group 1')
    assert.strictEqual(errors[3].title, 'Group 1 / Test 2')
  })

  await t.test('prints NO TESTS EXECUTED when total is 0', async () => {
    const reporter = new DummyReporter()
    const summaryBuilder = new SummaryBuilder()
    const runner = { summaryBuilder } as unknown as Runner
    const emitter = new Emitter<RunnerEvents>()
    reporter.boot(runner, emitter, {} as any)

    const summary: RunnerSummary = {
      aggregates: { total: 0, passed: 0, failed: 0, todo: 0, skipped: 0, regression: 0 },
      duration: 0,
      hasError: false,
      failedTestsTitles: [],
      importErrors: [],
      failureTree: [],
    }

    await reporter.testPrintSummary(summary)
    assert.match(logs.join('\n'), /NO TESTS EXECUTED/)
  })
})
