import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { keyboard } from '../../../src/commands/keyboard.js'

describe('Keyboard', () => {
  let rpcCalls: { command: string; payload: any }[] = []
  let originalWindow: any

  beforeEach(() => {
    rpcCalls = []
    originalWindow = globalThis.window

    globalThis.window = {
      // @ts-expect-error - Mocking global window
      __lupa_command__: async (command: string, payload: any) => {
        rpcCalls.push({ command, payload })
      },
    }
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  test('down', async () => {
    await keyboard.down('Shift')
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'keyboard',
      payload: { action: 'down', key: 'Shift' },
    })
  })

  test('insertText', async () => {
    await keyboard.insertText('嗨')
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'keyboard',
      payload: { action: 'insertText', text: '嗨' },
    })
  })

  test('press', async () => {
    await keyboard.press('Control+A', { delay: 100 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'keyboard',
      payload: { action: 'press', key: 'Control+A', options: { delay: 100 } },
    })
  })

  test('type', async () => {
    await keyboard.type('Hello', { delay: 50 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'keyboard',
      payload: { action: 'type', text: 'Hello', options: { delay: 50 } },
    })
  })

  test('up', async () => {
    await keyboard.up('Shift')
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'keyboard',
      payload: { action: 'up', key: 'Shift' },
    })
  })
})
