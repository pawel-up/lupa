import { test, describe, beforeEach } from 'node:test'
import * as assert from 'node:assert'
import { NetworkCommand } from '../../../src/network/network_command.js'
import type { Page, Route, Request } from 'playwright'

describe('NetworkCommand', () => {
  let mockPage: Page
  let networkCommand: NetworkCommand

  beforeEach(() => {
    mockPage = {
      evaluate: async () => ({ action: 'continue' }),
    } as unknown as Page
    networkCommand = new NetworkCommand(mockPage)
  })

  function createMockRoute(
    overrides: {
      resourceType?: string
      url?: string
      method?: string
      headers?: Record<string, string>
      postData?: string | null
    } = {}
  ): {
    route: Route
    continued: boolean
    fulfilled: boolean
    fulfillPayload?: unknown
  } {
    const tracker = {
      continued: false,
      fulfilled: false,
      fulfillPayload: undefined as unknown,
    }

    const mockRequest: Partial<Request> = {
      resourceType: () => overrides.resourceType ?? 'fetch',
      url: () => overrides.url ?? 'https://example.com/api/test',
      method: () => overrides.method ?? 'GET',
      headers: () => overrides.headers ?? {},
      postData: () => overrides.postData ?? null,
    }

    const mockRoute: Partial<Route> = {
      request: () => mockRequest as Request,
      continue: async () => {
        tracker.continued = true
      },
      fulfill: async (payload) => {
        tracker.fulfilled = true
        tracker.fulfillPayload = payload
      },
    }

    return {
      route: mockRoute as Route,
      get continued() {
        return tracker.continued
      },
      get fulfilled() {
        return tracker.fulfilled
      },
      get fulfillPayload() {
        return tracker.fulfillPayload
      },
    }
  }

  test('ignores non-fetch and non-xhr requests', async () => {
    const mock = createMockRoute({ resourceType: 'document', url: 'https://example.com/index.html' })
    await networkCommand.onRoute(mock.route)

    assert.strictEqual(mock.continued, true)
    assert.strictEqual(networkCommand.getUnmatchedRequests().length, 0)
  })

  test('fulfills OPTIONS requests when ignoreCors is set', async () => {
    networkCommand.setIgnoreCors(true)
    const mock = createMockRoute({ method: 'OPTIONS' })
    await networkCommand.onRoute(mock.route)

    assert.strictEqual(mock.fulfilled, true)
    assert.strictEqual(networkCommand.getUnmatchedRequests().length, 0)
  })

  test('records unmatched fetch requests in ring buffer', async () => {
    const mock = createMockRoute({
      method: 'POST',
      url: 'https://example.com/api/users',
      headers: { 'content-type': 'application/json' },
    })

    await networkCommand.onRoute(mock.route)

    assert.strictEqual(mock.continued, true)
    const unmatched = networkCommand.getUnmatchedRequests()
    assert.strictEqual(unmatched.length, 1)
    assert.strictEqual(unmatched[0].method, 'POST')
    assert.strictEqual(unmatched[0].url, 'https://example.com/api/users')
    assert.deepStrictEqual(unmatched[0].headers, { 'content-type': 'application/json' })
  })

  test('records unfulfilled or bypassed request even if route matched in store', async () => {
    await networkCommand.register({
      id: 1,
      matcher: { type: 'string', uri: '/api/data' },
    })

    const mock = createMockRoute({ url: 'https://example.com/api/data' })
    await networkCommand.onRoute(mock.route)

    assert.strictEqual(mock.continued, true)
    const unmatched = networkCommand.getUnmatchedRequests()
    assert.strictEqual(unmatched.length, 1)
    assert.strictEqual(unmatched[0].url, 'https://example.com/api/data')
  })

  test('caps ring buffer at 20 unmatched requests', async () => {
    for (let i = 0; i < 25; i++) {
      const mock = createMockRoute({ url: `https://example.com/api/item/${i}` })
      await networkCommand.onRoute(mock.route)
    }

    const unmatched = networkCommand.getUnmatchedRequests()
    assert.strictEqual(unmatched.length, 20)
    // First 5 (0..4) should have been evicted; buffer starts from 5
    assert.strictEqual(unmatched[0].url, 'https://example.com/api/item/5')
    assert.strictEqual(unmatched[19].url, 'https://example.com/api/item/24')
  })

  test('clearUnmatchedRequests resets the ring buffer', async () => {
    const mock = createMockRoute({ url: 'https://example.com/api/item' })
    await networkCommand.onRoute(mock.route)
    assert.strictEqual(networkCommand.getUnmatchedRequests().length, 1)

    networkCommand.clearUnmatchedRequests()
    assert.strictEqual(networkCommand.getUnmatchedRequests().length, 0)
  })

  test('tracks isMockingEnabled properly across lifecycle', async () => {
    assert.strictEqual(networkCommand.isMockingEnabled, false)

    await networkCommand.register({
      id: 1,
      matcher: { type: 'string', uri: '/api/data' },
    })
    assert.strictEqual(networkCommand.isMockingEnabled, true)

    await networkCommand.unregister({ id: 1 })
    assert.strictEqual(networkCommand.isMockingEnabled, false)

    networkCommand.setMockingEnabled(true)
    assert.strictEqual(networkCommand.isMockingEnabled, true)

    networkCommand.reset()
    assert.strictEqual(networkCommand.isMockingEnabled, false)
    assert.strictEqual(networkCommand.getUnmatchedRequests().length, 0)
  })
})
