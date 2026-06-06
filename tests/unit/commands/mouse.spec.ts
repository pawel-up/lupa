import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { mouse } from '../../../src/commands/mouse.js'

describe('Mouse', () => {
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

  test('reset', async () => {
    await mouse.reset()
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: { action: 'reset' },
    })
  })

  test('setPosition', async () => {
    await mouse.setPosition({ x: 100, y: 150 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'move',
        x: 100,
        y: 150,
        options: { steps: 1 },
      },
    })
  })

  test('move to coordinates', async () => {
    await mouse.move({ x: 200, y: 250 }, { button: 'left', steps: 10 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'move',
        x: 200,
        y: 250,
        options: { button: 'left', steps: 10 },
      },
    })
  })

  test('move between coordinates', async () => {
    await mouse.move({ x: 10, y: 20 }, { x: 30, y: 40 }, { steps: 5 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'moveBetween',
        fromX: 10,
        fromY: 20,
        toX: 30,
        toY: 40,
        options: { steps: 5 },
      },
    })
  })

  test('down', async () => {
    await mouse.down({ button: 'right', clickCount: 2 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'down',
        options: { button: 'right', clickCount: 2 },
      },
    })
  })

  test('up', async () => {
    await mouse.up({ button: 'middle' })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'up',
        options: { button: 'middle' },
      },
    })
  })

  test('click', async () => {
    await mouse.click({ x: 150, y: 160 }, { button: 'right', delay: 100 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'click',
        x: 150,
        y: 160,
        options: { button: 'right', delay: 100 },
      },
    })
  })

  test('dblclick', async () => {
    await mouse.dblclick({ x: 50, y: 60 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'dblclick',
        x: 50,
        y: 60,
        options: undefined,
      },
    })
  })

  test('press', async () => {
    await mouse.press({ x: 300, y: 400 }, { key: 'Shift+Control', delay: 200 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'mouse',
      payload: {
        action: 'press',
        x: 300,
        y: 400,
        options: { key: 'Shift+Control', delay: 200 },
      },
    })
  })
})
