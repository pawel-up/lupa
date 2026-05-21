import { test } from 'node:test'
import assert from 'node:assert'
import { fork } from 'node:child_process'
import path from 'node:path'

const BROWSER_TESTS_COUNT = 73
const BROWSER_PASSED_TESTS_COUNT = 72
const BROWSER_SKIPPED_TESTS_COUNT = 1

test('Integration: Lupa Framework End-to-End', async (t) => {
  // Give it a longer timeout since it boots Vite and Playwright
  const TIMEOUT = 30000

  await t.test(
    'executes browser tests, reports telemetry, and exits with correct code',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = fork(runnerPath, ['test'], {
          execArgv: ['--import', 'tsx'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            CI: '1',
          },
          stdio: 'pipe',
        })

        let out = ''
        let err = ''
        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('exit', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      // Verify exit code
      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)

      assert.ok(
        output.includes(
          `Tests  ${BROWSER_PASSED_TESTS_COUNT} passed, ${BROWSER_SKIPPED_TESTS_COUNT} skipped (${BROWSER_TESTS_COUNT})`
        ),
        `Summary should report ${BROWSER_PASSED_TESTS_COUNT} passed and ${BROWSER_SKIPPED_TESTS_COUNT} skipped. Actual output: ${output}`
      )
    }
  )

  await t.test('executes list command and correctly outputs test table', { timeout: TIMEOUT }, async () => {
    const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

    const { exitCode, stdout, stderr } = await new Promise<{
      exitCode: number | null
      stdout: string
      stderr: string
    }>((resolve, reject) => {
      const child = fork(runnerPath, ['list'], {
        execArgv: ['--import', 'tsx'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          CI: '1',
        },
        stdio: 'pipe',
      })

      let out = ''
      let err = ''
      child.stdout?.on('data', (data) => (out += data))
      child.stderr?.on('data', (data) => (err += data))

      child.on('exit', (code) => {
        resolve({ exitCode: code, stdout: out, stderr: err })
      })

      child.on('error', reject)
    })

    const output = stdout + '\n' + stderr

    assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
    assert.ok(output.includes('Total tests: 57'), `Expected list output to show 57 tests. Actual output: ${output}`)
    assert.ok(output.includes('Suite'), 'Expected list output to contain a table with Suite column.')
  })

  await t.test(
    'executes programmatic test run and returns strictly typed JSON reporter payload',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'tests', 'integration', 'run-programmatic.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = fork(runnerPath, [], {
          execArgv: ['--import', 'tsx'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            CI: '1',
          },
          stdio: 'pipe',
        })

        let out = ''
        let err = ''
        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('exit', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)

      const resultMarker = '___PROGRAMMATIC_RESULT___'
      const lineWithResult = stdout.split('\n').find((line) => line.startsWith(resultMarker))

      assert.ok(lineWithResult, 'Could not find the programmatic result in stdout')

      const rawJson = lineWithResult.replace(resultMarker, '')
      const payload = JSON.parse(rawJson)

      assert.strictEqual(payload.success, true)
      assert.strictEqual(payload.summary.total, 7) // 7 tests in dummy.spec.ts
      assert.strictEqual(payload.summary.passed, 7)
      assert.strictEqual(payload.failures.length, 0)
    }
  )

  await t.test(
    'executes list command with filters and correctly outputs filtered test table',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = fork(runnerPath, ['list', '--groups', 'Dummy Group'], {
          execArgv: ['--import', 'tsx'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            CI: '1',
          },
          stdio: 'pipe',
        })

        let out = ''
        let err = ''

        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('exit', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('Total tests: 4'),
        `Expected list output to show 4 tests for Dummy Group. Actual output: ${output}`
      )
      assert.ok(output.includes('Suite'), 'Expected list output to contain a table with Suite column.')
    }
  )

  await t.test(
    'executes list command with tag filter and correctly outputs filtered test table',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = fork(runnerPath, ['list', '--tags', '@dummy-tag'], {
          execArgv: ['--import', 'tsx'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            CI: '1',
          },
          stdio: 'pipe',
        })

        let out = ''
        let err = ''

        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('exit', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('Total tests: 1'),
        `Expected list output to show 1 test for @dummy-tag. Actual output: ${output}`
      )
      assert.ok(
        output.includes('this test should pass'),
        `Expected output to include the matching test name. Actual output: ${output}`
      )
    }
  )

  await t.test(
    'executes list command with files filter and correctly outputs filtered test table',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = fork(runnerPath, ['list', '--files', 'dummy2.spec.ts'], {
          execArgv: ['--import', 'tsx'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            CI: '1',
          },
          stdio: 'pipe',
        })

        let out = ''
        let err = ''

        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('exit', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('Total tests: 4'),
        `Expected list output to show 4 tests for dummy2.spec.ts. Actual output: ${output}`
      )
      assert.ok(
        output.includes('Math Operations Group'),
        `Expected output to include the correct group. Actual output: ${output}`
      )
    }
  )
})
