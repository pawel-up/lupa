import { test } from 'node:test'
import assert from 'node:assert'
import { GithubReporter } from '../../../src/reporters/github.js'
import type { RunnerSummary } from '../../../src/types.js'

class DummyGithubReporter extends GithubReporter {
  public testEscapeMessage(val: string) {
    return this.escapeMessage(val)
  }
  public testEscapeProperty(val: string) {
    return this.escapeProperty(val)
  }
  public testFormatMessage(args: any) {
    return this.formatMessage(args)
  }
  public async testEnd(summary: RunnerSummary) {
    this.runner = { getSummary: () => summary } as any
    await this.end()
  }
}

test('GithubReporter', async (t) => {
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

  await t.test('escapes message correctly', () => {
    const reporter = new DummyGithubReporter()
    assert.strictEqual(reporter.testEscapeMessage('hello%world\r\n'), 'hello%25world%0D%0A')
  })

  await t.test('escapes property correctly', () => {
    const reporter = new DummyGithubReporter()
    assert.strictEqual(reporter.testEscapeProperty('hello:world,test%'), 'hello%3Aworld%2Ctest%25')
  })

  await t.test('formats message string', () => {
    const reporter = new DummyGithubReporter()
    const msg = reporter.testFormatMessage({
      command: 'error',
      properties: { file: 'app.js', line: '10' },
      message: 'test error',
    })
    assert.strictEqual(msg, '::error file=app.js,line=10::test error')
  })

  await t.test('prints error annotations on end', async () => {
    const reporter = new DummyGithubReporter()
    const error = new Error('Test failed')

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
          errors: [],
          children: [
            {
              type: 'test',
              title: 'Test 1',
              errors: [{ phase: 'test', error }],
            },
          ] as any,
        },
      ],
    }

    await reporter.testEnd(summary)
    const output = logs.join('\n')
    assert.match(output, /::error file=.*github\.spec\.ts,title=Suite 1 \/ Test 1,line=\d+,column=\d+::Test failed/)
  })
})
