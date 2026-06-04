/* eslint-disable no-console */
import { test } from 'node:test'
import assert from 'node:assert'
import { chromium } from 'playwright'
import { BrowserManager } from '../../../src/runner/browser_manager.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { RunnerEvents } from '../../../src/types.js'

test('BrowserManager - Dependency reload and warning handling', async (t) => {
  let originalLaunch: any
  t.before(() => {
    originalLaunch = chromium.launch
  })
  t.after(() => {
    chromium.launch = originalLaunch
  })

  await t.test('performs page reload on initial 504 Vite dependency errors', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const manager = new BrowserManager(['chromium'], false, emitter)

    let responseHandler: any
    let reloadCalled = 0
    const urlCalled = 'http://localhost/__lupa__/runner.html?chunkId=chunk-1'

    const mockPage = {
      on: (event: string, handler: any) => {
        if (event === 'response') responseHandler = handler
      },
      exposeFunction: async () => {},
      goto: async () => {},
      reload: async () => {
        reloadCalled++
      },
      url: () => urlCalled,
    }

    chromium.launch = (async () => ({
      newPage: async () => mockPage,
    })) as any

    const mockTestPoolManager = {
      getChunkIdsForBrowser: () => ['chunk-1'],
    }

    await manager.boot(mockTestPoolManager as any)

    assert.ok(responseHandler, 'response listener should be registered')

    // Simulate a 504 response on Vite deps directory
    const mock504Response = {
      status: () => 504,
      url: () => 'http://localhost/node_modules/.vite/deps/chunk-ABC.js',
    }

    await responseHandler(mock504Response)
    assert.strictEqual(reloadCalled, 1, 'page.reload should be called')
  })

  await t.test('does not reload page if tests already started on the page', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const manager = new BrowserManager(['chromium'], false, emitter)

    let responseHandler: any
    let reloadCalled = 0
    const consoleErrorCalled: string[] = []
    const originalConsoleError = console.error
    console.error = (msg: string) => {
      consoleErrorCalled.push(msg)
    }

    const mockPage = {
      on: (event: string, handler: any) => {
        if (event === 'response') responseHandler = handler
      },
      exposeFunction: async () => {},
      goto: async () => {},
      reload: async () => {
        reloadCalled++
      },
      url: () => 'http://localhost/__lupa__/runner.html?chunkId=chunk-1',
    }

    chromium.launch = (async () => ({
      newPage: async () => mockPage,
    })) as any

    const mockTestPoolManager = {
      getChunkIdsForBrowser: () => ['chunk-1'],
    }

    await manager.boot(mockTestPoolManager as any)

    // Mark test suite as started
    manager.markChunkAsStarted('chunk-1')

    // Simulate a 504 response on Vite deps directory
    const mock504Response = {
      status: () => 504,
      url: () => 'http://localhost/node_modules/.vite/deps/packageName.js',
    }

    await responseHandler(mock504Response)
    assert.strictEqual(reloadCalled, 0, 'page.reload should NOT be called after tests start')
    assert.ok(consoleErrorCalled.length > 0, 'should output warning console message')
    assert.match(consoleErrorCalled[0], /packageName/, 'should mention library name')

    console.error = originalConsoleError
  })

  await t.test('limits consecutive reload attempts to 3', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const manager = new BrowserManager(['chromium'], false, emitter)

    let responseHandler: any
    let reloadCalled = 0

    const mockPage = {
      on: (event: string, handler: any) => {
        if (event === 'response') responseHandler = handler
      },
      exposeFunction: async () => {},
      goto: async () => {},
      reload: async () => {
        reloadCalled++
      },
      url: () => 'http://localhost/__lupa__/runner.html?chunkId=chunk-1',
    }

    chromium.launch = (async () => ({
      newPage: async () => mockPage,
    })) as any

    const mockTestPoolManager = {
      getChunkIdsForBrowser: () => ['chunk-1'],
    }

    await manager.boot(mockTestPoolManager as any)

    const mock504Response = {
      status: () => 504,
      url: () => 'http://localhost/node_modules/.vite/deps/chunk-ABC.js',
    }

    // Trigger 5 times
    for (let i = 0; i < 5; i++) {
      await responseHandler(mock504Response)
    }

    assert.strictEqual(reloadCalled, 3, 'page.reload should be capped at 3')
  })

  await t.test('resets reload counters on navigateAndWait', async () => {
    const emitter = new Emitter<RunnerEvents>()
    const manager = new BrowserManager(['chromium'], false, emitter)

    let responseHandler: any
    let reloadCalled = 0
    let exposeEndFn: any

    const mockPage = {
      on: (event: string, handler: any) => {
        if (event === 'response') responseHandler = handler
      },
      exposeFunction: async (name: string, fn: any) => {
        if (name === '__lupa_runner_end__') {
          exposeEndFn = fn
        }
      },
      goto: async () => {
        // Trigger __lupa_runner_end__ to resolve navigateAndWait promise
        process.nextTick(() => {
          exposeEndFn?.()
        })
      },
      reload: async () => {
        reloadCalled++
      },
      url: () => 'http://localhost/__lupa__/runner.html?chunkId=chunk-1',
    }

    chromium.launch = (async () => ({
      newPage: async () => mockPage,
      context: () => ({
        browser: () => ({
          browserType: () => ({
            name: () => 'chromium',
          }),
        }),
      }),
    })) as any

    const mockTestPoolManager = {
      getChunkIdsForBrowser: () => ['chunk-1'],
    }

    await manager.boot(mockTestPoolManager as any)

    const mock504Response = {
      status: () => 504,
      url: () => 'http://localhost/node_modules/.vite/deps/chunk-ABC.js',
    }

    // Trigger 3 times to exhaust the limit
    for (let i = 0; i < 3; i++) {
      await responseHandler(mock504Response)
    }
    assert.strictEqual(reloadCalled, 3)

    // Run navigateAndWait
    await manager.navigateAndWait('http://localhost/__lupa__/runner.html', ['chunk-1'])

    // Trigger again, reload should execute
    await responseHandler(mock504Response)
    assert.strictEqual(reloadCalled, 4, 'reload count should be reset')
  })
})
