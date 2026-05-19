import { test } from 'node:test'
import assert from 'node:assert'
import path from 'node:path'
import { boot } from '../../../src/testing/harness.js'
import { getActiveRunner, getActiveEmitter } from '../../../src/testing/api.js'

test('Browser Harness', async (t) => {
  let runnerEnded = false

  t.beforeEach(() => {
    runnerEnded = false
    global.window = {
      location: {
        search: '',
      } as unknown as Location,
      __lupa_testing_mode__: true,
      __lupa__: {
        config: {
          timeout: 1000,
          retries: 2,
        },
        suites: [],
        testPlugins: [],
      },
      __lupa_runner_end__: async () => {
        runnerEnded = true
      },
      addEventListener: () => {
        // ...
      },
      removeEventListener: () => {
        // ...
      },
    } as any
  })

  await t.test('boot() correctly sets up plugins and invokes runner end', async () => {
    // Use a mock plugin
    const pluginPath = path.join(process.cwd(), 'tests', 'fixtures', 'mock-plugin.js')

    global.window.__lupa__.testPlugins = [[pluginPath, { option1: true }]]

    await boot()

    assert.strictEqual((globalThis as any).MOCK_PLUGIN_EXECUTED, true)
    assert.deepStrictEqual((globalThis as any).MOCK_PLUGIN_OPTIONS, { option1: true })
    assert.strictEqual(runnerEnded, true)

    // Cleanup
    delete (globalThis as any).MOCK_PLUGIN_EXECUTED
    delete (globalThis as any).MOCK_PLUGIN_OPTIONS
  })

  await t.test('boot() configures suites and dynamically imports files', async () => {
    // Use a mock test file
    const testFilePath = path.join(process.cwd(), 'tests', 'fixtures', 'mock-test-file.js')

    global.window.__lupa__.suites = [
      {
        name: 'test-suite',
        timeout: 500,
        retries: 1,
        files: [testFilePath],
      },
    ]

    await boot()

    assert.strictEqual((globalThis as any).MOCK_TEST_EXECUTED, true)
    assert.strictEqual(runnerEnded, true)

    // Cleanup
    delete (globalThis as any).MOCK_TEST_EXECUTED
  })

  await t.test('boot() emits runner:import_error when test file fails to load', async () => {
    global.window.__lupa__.suites = [
      {
        name: 'test-suite-failure',
        timeout: 500,
        retries: 1,
        files: ['/non-existent-test-file.js'],
      },
    ]

    const bootPromise = boot()

    // setActiveInstances is called synchronously, so we can attach our listener before imports resolve
    let importErrorEvent: any = null
    getActiveEmitter()?.on('runner:import_error', (data) => {
      importErrorEvent = data
    })

    await bootPromise

    const runner = getActiveRunner()
    assert.strictEqual(runnerEnded, true)
    assert.strictEqual(runner?.failed, true)
    assert.strictEqual(runner?.suites[0].stack.length, 0)
    assert.strictEqual(importErrorEvent?.file, '/non-existent-test-file.js')
  })
})
