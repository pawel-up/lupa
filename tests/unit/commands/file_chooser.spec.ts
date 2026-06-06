import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { fileChooser, FileChooser } from '../../../src/commands/file_chooser.js'

describe('FileChooser client', () => {
  let rpcCalls: { command: string; payload: any }[] = []
  let originalWindow: any
  let returnPayload: any = null

  beforeEach(() => {
    rpcCalls = []
    returnPayload = null
    originalWindow = globalThis.window

    globalThis.window = {
      __lupa_command__: async (command: string, payload: any) => {
        rpcCalls.push({ command, payload })
        return returnPayload
      },
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  test('waitForEvent sends rpc and returns FileChooser instance', async () => {
    returnPayload = { id: 'abc-123', isMultiple: true }
    const fc = await fileChooser.waitForEvent({ timeout: 5000 })

    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'fileChooser:waitForEvent',
      payload: { timeout: 5000 },
    })
    assert.ok(fc instanceof FileChooser)
    assert.strictEqual(fc.id, 'abc-123')
    assert.strictEqual(fc.isMultiple, true)
  })

  test('FileChooser.setFiles sends rpc to set files', async () => {
    const fc = new FileChooser('test-id', false)
    await fc.setFiles('test.txt', { timeout: 1000 })

    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'fileChooser:setFiles',
      payload: {
        id: 'test-id',
        files: 'test.txt',
        options: { timeout: 1000 },
      },
    })
  })
})
