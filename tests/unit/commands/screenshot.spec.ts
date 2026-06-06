import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { screenshot } from '../../../src/commands/screenshot.js'

describe('Screenshot', () => {
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

  test('take page screenshot', async () => {
    await screenshot.take({ path: 'page.png', fullPage: true })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'screenshot',
      payload: {
        action: 'take',
        options: { path: 'page.png', fullPage: true },
      },
    })
  })

  test('take page screenshot throws error without path', async () => {
    // @ts-expect-error - testing missing path
    await assert.rejects(() => screenshot.take({}), /Screenshot path is required/)
    assert.strictEqual(rpcCalls.length, 0)
  })

  test('takeOf element screenshot delegates to locator', async () => {
    await screenshot.takeOf({ css: '.my-el' }, { path: 'element.png' })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'screenshot',
        query: { css: '.my-el' },
        args: { path: 'element.png' },
      },
    })
  })

  test('takeOf element screenshot throws error without path', async () => {
    // @ts-expect-error - testing missing path
    await assert.rejects(() => screenshot.takeOf({ css: '.my-el' }, {}), /Screenshot path is required/)
    assert.strictEqual(rpcCalls.length, 0)
  })
})
