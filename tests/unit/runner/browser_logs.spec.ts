/* eslint-disable no-console */
import { test } from 'node:test'
import assert from 'node:assert'
import { BrowserLogs } from '../../../src/runner/browser_logs.js'

test('BrowserLogs', async (t) => {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  const originalDir = console.dir
  const originalTable = console.table

  t.afterEach(() => {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
    console.dir = originalDir
    console.table = originalTable
  })

  await t.test('filters messages if verbose is false', async () => {
    const logs: any[][] = []

    let consoleHandler: any
    const dummyPage = {
      on: (event: string, handler: any) => {
        if (event === 'console') consoleHandler = handler
      },
    }

    const dummyEmitter = {
      emit: (_event: string, payload: any) => logs.push([payload.file, payload.type, payload.messages]),
    }
    const browserLogs = new BrowserLogs(dummyPage as any, false, dummyEmitter as any)
    browserLogs.boot()

    const dummyMessage = {
      type: () => 'log',
      text: () => 'Hello',
      args: () => [],
    }

    await consoleHandler(dummyMessage)

    assert.strictEqual(logs.length, 0)
  })

  await t.test('emits simple text message when there are no args', async () => {
    const logs: any[][] = []

    let consoleHandler: any
    const dummyPage = {
      on: (event: string, handler: any) => {
        if (event === 'console') consoleHandler = handler
      },
    }

    const dummyEmitter = {
      emit: (_event: string, payload: any) => logs.push([payload.file, payload.type, payload.messages]),
    }
    const browserLogs = new BrowserLogs(dummyPage as any, true, dummyEmitter as any)
    browserLogs.boot()

    const dummyMessage = {
      type: () => 'log',
      text: () => 'Hello world',
      args: () => [],
    }

    await consoleHandler(dummyMessage)

    assert.strictEqual(logs.length, 1)
    assert.deepStrictEqual(logs[0], ['unknown', 'log', ['Hello world']])
  })

  await t.test('emits multiline messages', async () => {
    const logs: any[][] = []

    let consoleHandler: any
    const dummyPage = {
      on: (event: string, handler: any) => {
        if (event === 'console') consoleHandler = handler
      },
    }

    const dummyEmitter = {
      emit: (_event: string, payload: any) => logs.push([payload.file, payload.type, payload.messages]),
    }
    const browserLogs = new BrowserLogs(dummyPage as any, true, dummyEmitter as any)
    browserLogs.boot()

    const dummyMessage = {
      type: () => 'log',
      text: () => 'line1\nline2',
      args: () => [
        {
          evaluate: async () => ({ __lupa_type: 'json', value: 'line1\nline2' }),
        },
      ],
    }

    await consoleHandler(dummyMessage)

    assert.strictEqual(logs.length, 1)
    assert.deepStrictEqual(logs[0], ['unknown', 'log', ['line1\nline2']])
  })

  await t.test('evaluates node and element correctly', async () => {
    const logs: any[][] = []

    let consoleHandler: any
    const dummyPage = {
      on: (event: string, handler: any) => {
        if (event === 'console') consoleHandler = handler
      },
    }

    const dummyEmitter = {
      emit: (_event: string, payload: any) => logs.push([payload.file, payload.type, payload.messages]),
    }
    const browserLogs = new BrowserLogs(dummyPage as any, true, dummyEmitter as any)
    browserLogs.boot()

    const dummyMessage = {
      type: () => 'log',
      text: () => 'DOM elements',
      args: () => [
        {
          evaluate: async () => ({ __lupa_type: 'element', value: '<div id="test"></div>' }),
        },
        {
          evaluate: async () => ({ __lupa_type: 'node', value: '#text' }),
        },
      ],
    }

    await consoleHandler(dummyMessage)

    assert.strictEqual(logs.length, 1)
    assert.deepStrictEqual(logs[0], ['unknown', 'log', ['<div id="test"></div>', '#text']])
  })

  await t.test('emits different types of logs correctly', async () => {
    const logs: any[][] = []

    let consoleHandler: any
    const dummyPage = {
      on: (event: string, handler: any) => {
        if (event === 'console') consoleHandler = handler
      },
    }

    const dummyEmitter = {
      emit: (_event: string, payload: any) => logs.push([payload.file, payload.type, payload.messages]),
    }
    const browserLogs = new BrowserLogs(dummyPage as any, true, dummyEmitter as any)
    browserLogs.boot()

    const dummyMessage = {
      type: () => 'error',
      text: () => 'Oh no!',
      args: () => [
        {
          evaluate: async () => ({ __lupa_type: 'json', value: 'Oh no!' }),
        },
      ],
    }

    await consoleHandler(dummyMessage)

    assert.strictEqual(logs.length, 1)
    assert.deepStrictEqual(logs[0], ['unknown', 'error', ['Oh no!']])
  })
})
