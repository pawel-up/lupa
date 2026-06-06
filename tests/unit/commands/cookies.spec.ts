import { test, describe, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { cookies } from '../../../src/commands/cookies.js'

describe('Cookies client', () => {
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

  test('add cookie - single', async () => {
    await cookies.add({ name: 'foo', value: 'bar' })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:add',
      payload: {
        cookies: [{ name: 'foo', value: 'bar' }],
      },
    })
  })

  test('add cookies - array', async () => {
    await cookies.add([
      { name: 'foo', value: 'bar' },
      { name: 'baz', value: 'qux' },
    ])
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:add',
      payload: {
        cookies: [
          { name: 'foo', value: 'bar' },
          { name: 'baz', value: 'qux' },
        ],
      },
    })
  })

  test('getAll cookies - no filter', async () => {
    returnPayload = [{ name: 'foo', value: 'bar' }]
    const result = await cookies.getAll()
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:getAll',
      payload: { urls: undefined },
    })
    assert.deepStrictEqual(result, [{ name: 'foo', value: 'bar' }])
  })

  test('getAll cookies - with filter url', async () => {
    await cookies.getAll('https://example.com')
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:getAll',
      payload: { urls: ['https://example.com'] },
    })
  })

  test('getAll cookies - with array filter urls', async () => {
    await cookies.getAll(['https://example.com', 'https://foo.com'])
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:getAll',
      payload: { urls: ['https://example.com', 'https://foo.com'] },
    })
  })

  test('clear cookies - no options', async () => {
    await cookies.clear()
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:clear',
      payload: { options: undefined },
    })
  })

  test('clear cookies - with options', async () => {
    await cookies.clear({ name: 'foo', domain: 'example.com' })
    assert.strictEqual(rpcCalls.length, 1)
    assert.deepStrictEqual(rpcCalls[0], {
      command: 'cookies:clear',
      payload: { options: { name: 'foo', domain: 'example.com' } },
    })
  })
})
