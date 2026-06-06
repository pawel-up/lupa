import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { query } from '../../../src/commands/locator.js'

describe('Locator', () => {
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

  test('blur', async () => {
    const loc = query({ text: 'test' })
    await loc.blur({ timeout: 1000 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'blur',
        query: { text: 'test' },
        args: { timeout: 1000 },
      },
    })
  })

  test('clear', async () => {
    const loc = query({ css: '.my-class' })
    await loc.clear({ force: true })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'clear',
        query: { css: '.my-class' },
        args: { force: true },
      },
    })
  })

  test('check', async () => {
    const loc = query({ role: 'checkbox' })
    await loc.check({ force: true })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'check',
        query: { role: 'checkbox' },
        args: { force: true },
      },
    })
  })

  test('click', async () => {
    const loc = query({ testId: 'submit-btn' })
    await loc.click({ clickCount: 2 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'click',
        query: { testId: 'submit-btn' },
        args: { clickCount: 2 },
      },
    })
  })

  test('fill', async () => {
    const loc = query({ placeholder: 'username' })
    await loc.fill('admin', { timeout: 500 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'fill',
        query: { placeholder: 'username' },
        args: { text: 'admin', options: { timeout: 500 } },
      },
    })
  })

  test('dblclick', async () => {
    const loc = query({ label: 'agree' })
    await loc.dblclick({ delay: 100 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'dblclick',
        query: { label: 'agree' },
        args: { delay: 100 },
      },
    })
  })

  test('hover', async () => {
    const loc = query({ title: 'help' })
    await loc.hover({ modifiers: ['Shift'] })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'hover',
        query: { title: 'help' },
        args: { modifiers: ['Shift'] },
      },
    })
  })

  test('press', async () => {
    const loc = query({ altText: 'image' })
    await loc.press('Enter', { delay: 50 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'press',
        query: { altText: 'image' },
        args: { key: 'Enter', options: { delay: 50 } },
      },
    })
  })

  test('pressSequentially', async () => {
    const loc = query({ css: 'input' })
    await loc.pressSequentially('hello', { delay: 10 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'pressSequentially',
        query: { css: 'input' },
        args: { text: 'hello', options: { delay: 10 } },
      },
    })
  })

  test('tap', async () => {
    const loc = query({ xpath: '//div' })
    await loc.tap({ position: { x: 10, y: 20 } })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'tap',
        query: { xpath: '//div' },
        args: { position: { x: 10, y: 20 } },
      },
    })
  })

  test('uncheck', async () => {
    const loc = query({ role: 'checkbox' })
    await loc.uncheck({ timeout: 200 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'uncheck',
        query: { role: 'checkbox' },
        args: { timeout: 200 },
      },
    })
  })

  test('dragTo with locator', async () => {
    const loc = query({ testId: 'draggable' })
    const target = query({ testId: 'droppable' })
    await loc.dragTo(target, { timeout: 300 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'dragTo',
        query: { testId: 'draggable' },
        args: {
          targetQuery: { testId: 'droppable' },
          options: { timeout: 300 },
        },
      },
    })
  })

  test('dragTo with query', async () => {
    const loc = query({ testId: 'draggable' })
    await loc.dragTo({ testId: 'droppable' }, { timeout: 300 })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'dragTo',
        query: { testId: 'draggable' },
        args: {
          targetQuery: { testId: 'droppable' },
          options: { timeout: 300 },
        },
      },
    })
  })

  test('selectOption', async () => {
    globalThis.window.__lupa_command__ = (async <R = void>(command: string, payload?: unknown): Promise<R> => {
      rpcCalls.push({ command, payload })
      return ['value1', 'value2'] as unknown as R
    }) as typeof globalThis.window.__lupa_command__

    const loc = query({ css: '#test-select' })
    const result = await loc.selectOption(['value1', 'value2'], { force: true })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'selectOption',
        query: { css: '#test-select' },
        args: {
          values: ['value1', 'value2'],
          options: { force: true },
        },
      },
    })
    assert.deepStrictEqual(result, ['value1', 'value2'])
  })

  test('screenshot with path', async () => {
    const loc = query({ css: '#target' })
    await loc.screenshot({ path: 'test.png', type: 'png' })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'locator',
      payload: {
        action: 'screenshot',
        query: { css: '#target' },
        args: { path: 'test.png', type: 'png' },
      },
    })
  })

  test('screenshot throws error without path', async () => {
    const loc = query({ css: '#target' })
    // @ts-expect-error - testing missing path
    await assert.rejects(() => loc.screenshot({}), /Screenshot path is required/)
    assert.strictEqual(rpcCalls.length, 0)
  })
})
