import { test } from 'node:test'
import assert from 'node:assert'
import { fork } from 'node:child_process'
import path from 'node:path'

const BROWSER_TESTS_COUNT = 79
const BROWSER_PASSED_TESTS_COUNT = 78
const BROWSER_SKIPPED_TESTS_COUNT = 1

function forkSanitized(modulePath: string, args: string[], options: any = {}) {
  const env = { ...process.env, ...options.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_TEST_WORKER_ID
  delete env.NODE_OPTIONS
  return fork(modulePath, args, {
    ...options,
    env,
  })
}

test('Integration: Lupa Framework End-to-End', async (t) => {
  // Give it a longer timeout since it boots Vite and Playwright
  const TIMEOUT = 25_000

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
        const child = forkSanitized(runnerPath, ['test'], {
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
        child.stdout?.on('data', (data) => {
          out += data
          process.stdout.write(data)
        })
        child.stderr?.on('data', (data) => {
          err += data
          process.stderr.write(data)
        })

        child.on('close', (code) => {
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
      const child = forkSanitized(runnerPath, ['list'], {
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

      child.on('close', (code) => {
        resolve({ exitCode: code, stdout: out, stderr: err })
      })

      child.on('error', reject)
    })

    const output = stdout + '\n' + stderr

    assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
    assert.ok(output.includes('Total tests: 63'), `Expected list output to show 63 tests. Actual output: ${output}`)
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
        const child = forkSanitized(runnerPath, [], {
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

        child.on('close', (code) => {
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
    'executes programmatic test run and safely rejects the promise on Vite compilation errors',
    { timeout: TIMEOUT },
    async () => {
      const runnerPath = path.join(process.cwd(), 'tests', 'integration', 'run-programmatic-compilation-error.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject) => {
        const child = forkSanitized(runnerPath, [], {
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

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 1, `Expected runner to exit with code 1. Output:\n${output}`)

      const errorMarker = '___PROGRAMMATIC_ERROR_CAUGHT___'
      const lineWithError = stderr.split('\n').find((line) => line.includes(errorMarker))

      assert.ok(
        lineWithError,
        `Could not find the programmatic error marker in stderr. The promise might not have rejected.\nStdout:\n${stdout}\nStderr:\n${stderr}`
      )
      assert.ok(
        lineWithError.includes('Simulated Vite Compilation Error Boom'),
        'The rejected error does not match the simulated exception'
      )
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
        const child = forkSanitized(runnerPath, ['list', '--groups', 'Dummy Group'], {
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

        child.on('close', (code) => {
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
        const child = forkSanitized(runnerPath, ['list', '--tags', '@dummy-tag'], {
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

        child.on('close', (code) => {
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
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(runnerPath, ['list', '--files', 'dummy2.spec.ts'], {
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

        child.on('close', (code) => {
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

  await t.test(
    'executes list command with --files-only and correctly outputs files list',
    { timeout: TIMEOUT },
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(runnerPath, ['list', '--files-only'], {
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

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(output.includes('dummy.spec.ts'), `Expected output to include dummy.spec.ts. Output:\n${output}`)
      assert.ok(output.includes('dummy2.spec.ts'), `Expected output to include dummy2.spec.ts. Output:\n${output}`)
      assert.ok(output.includes('Total files:'), `Expected output to include Total files count. Output:\n${output}`)
    }
  )

  await t.test(
    'executes list command with --search-files and correctly filters files list with multiple queries',
    { timeout: TIMEOUT },
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(runnerPath, ['list', '--search-files', 'dummy2', 'assert-dom'], {
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

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(output.includes('dummy2.spec.ts'), `Expected output to include dummy2.spec.ts. Output:\n${output}`)
      assert.ok(
        output.includes('assert-dom.spec.ts'),
        `Expected output to include assert-dom.spec.ts. Output:\n${output}`
      )
      assert.ok(!output.includes('dummy.spec.ts'), `Expected output to NOT include dummy.spec.ts. Output:\n${output}`)
      assert.ok(output.includes('Total files: 2'), `Expected output to show Total files: 2. Output:\n${output}`)
    }
  )

  await t.test(
    'executes list command with --search-tests and correctly filters test list with multiple queries',
    { timeout: TIMEOUT },
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(runnerPath, ['list', '--search-tests', 'should pass', 'add two numbers'], {
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

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('this test should pass'),
        `Expected output to include 'this test should pass'. Output:\n${output}`
      )
      assert.ok(output.includes('add two numbers'), `Expected output to include 'add two numbers'. Output:\n${output}`)
      assert.ok(output.includes('Total tests: 2'), `Expected output to show Total tests: 2. Output:\n${output}`)
    }
  )

  await t.test(
    'executes list command with positional arguments to filter suites',
    { timeout: TIMEOUT },
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(runnerPath, ['list', 'Unit Tests', '--config', 'lupa.suites.config.ts'], {
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

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('unit 1 - no suite'),
        `Expected output to include 'unit 1 - no suite'. Output:\n${output}`
      )
      assert.ok(output.includes('Total tests: 1'), `Expected output to show Total tests: 1. Output:\n${output}`)
    }
  )

  await t.test(
    'executes list command with --suites option to filter suites',
    { timeout: TIMEOUT },
    async (): Promise<void> => {
      const runnerPath = path.join(process.cwd(), 'bin', 'lupa.ts')

      const { exitCode, stdout, stderr } = await new Promise<{
        exitCode: number | null
        stdout: string
        stderr: string
      }>((resolve, reject): void => {
        const child = forkSanitized(
          runnerPath,
          ['list', '--suites', 'Unit Tests', '--config', 'lupa.suites.config.ts'],
          {
            execArgv: ['--import', 'tsx'],
            cwd: process.cwd(),
            env: {
              ...process.env,
              FORCE_COLOR: '0',
              CI: '1',
            },
            stdio: 'pipe',
          }
        )

        let out = ''
        let err = ''

        child.stdout?.on('data', (data) => (out += data))
        child.stderr?.on('data', (data) => (err += data))

        child.on('close', (code) => {
          resolve({ exitCode: code, stdout: out, stderr: err })
        })

        child.on('error', reject)
      })

      const output = stdout + '\n' + stderr

      assert.strictEqual(exitCode, 0, `Expected runner to exit with code 0. Output:\n${output}`)
      assert.ok(
        output.includes('unit 1 - no suite'),
        `Expected output to include 'unit 1 - no suite'. Output:\n${output}`
      )
      assert.ok(output.includes('Total tests: 1'), `Expected output to show Total tests: 1. Output:\n${output}`)
    }
  )
})
