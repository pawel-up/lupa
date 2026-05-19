import { test, describe, beforeEach } from 'node:test'
import * as assert from 'node:assert'
import { RouteStore } from '../../../src/network/route_store.js'
import type { RouteDefinition } from '../../../src/network/types.js'

describe('RouteStore', () => {
  let store: RouteStore

  beforeEach(() => {
    store = new RouteStore()
  })

  function createMockRoute(
    id: number,
    overrides: Partial<Omit<RouteDefinition, 'id' | 'usageCount'>> = {}
  ): RouteDefinition {
    return {
      id,
      usageCount: 0,
      pattern: new URLPattern({ pathname: '/api/users' }),
      ...overrides,
    }
  }

  test('adds routes and evaluates them in LIFO order', () => {
    const route1 = createMockRoute(1)
    const route2 = createMockRoute(2)

    store.add(route1)
    store.add(route2) // Added last, should be evaluated first

    const matches = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0].route.id, 2)
    assert.strictEqual(matches[1].route.id, 1)
  })

  test('matches URL pattern correctly', () => {
    store.add(createMockRoute(1))

    const validMatch = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(validMatch.length, 1)

    const invalidMatch = Array.from(store.findMatches('https://example.com/api/posts', 'GET', {}))
    assert.strictEqual(invalidMatch.length, 0)
  })

  test('matches HTTP methods correctly', () => {
    store.add(createMockRoute(1, { methods: ['POST', 'PUT'] }))

    const validMatch = Array.from(store.findMatches('https://example.com/api/users', 'POST', {}))
    assert.strictEqual(validMatch.length, 1)

    const invalidMatch = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(invalidMatch.length, 0)
  })

  test('matches headers correctly (case insensitive)', () => {
    store.add(createMockRoute(1, { headers: { 'authorization': 'Bearer token', 'x-custom': 'foo' } }))

    const validMatch = Array.from(
      store.findMatches('https://example.com/api/users', 'GET', {
        'Authorization': 'Bearer token',
        'X-Custom': 'foo',
        'Other-Header': 'bar',
      })
    )
    assert.strictEqual(validMatch.length, 1)

    const invalidMatch1 = Array.from(
      store.findMatches('https://example.com/api/users', 'GET', {
        Authorization: 'Bearer token', // Missing X-Custom
      })
    )
    assert.strictEqual(invalidMatch1.length, 0)

    const invalidMatch2 = Array.from(
      store.findMatches('https://example.com/api/users', 'GET', {
        'Authorization': 'Wrong token',
        'X-Custom': 'foo',
      })
    )
    assert.strictEqual(invalidMatch2.length, 0)
  })

  test('handles routes without a URL pattern (header/method only)', () => {
    store.add(createMockRoute(1, { pattern: undefined, headers: { auth: 'yes' } }))

    // Should match ANY url as long as headers match
    const validMatch = Array.from(store.findMatches('https://any.com/foo/bar', 'GET', { auth: 'yes' }))
    assert.strictEqual(validMatch.length, 1)

    const invalidMatch = Array.from(store.findMatches('https://any.com/foo/bar', 'GET', { auth: 'no' }))
    assert.strictEqual(invalidMatch.length, 0)
  })

  test('respects lifetime (times) and expires correctly', () => {
    const route = createMockRoute(1, { lifetime: 2 })
    store.add(route)

    // First call - matches and increments usage
    const match1 = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(match1.length, 1)
    assert.strictEqual(route.usageCount, 1)

    // Second call - matches, increments usage, and removes route
    const match2 = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(match2.length, 1)
    assert.strictEqual(route.usageCount, 2)

    // Third call - route is gone
    const match3 = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(match3.length, 0)
  })

  test('cleans up pre-expired routes during evaluation', () => {
    const route = createMockRoute(1, { lifetime: 1 })
    store.add(route)

    // Manually push usageCount past lifetime
    route.usageCount = 1

    const match = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(match.length, 0)
  })

  test('removeById removes the correct route', () => {
    store.add(createMockRoute(1))
    store.add(createMockRoute(2))

    store.removeById(1)

    const matches = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(matches.length, 1)
    assert.strictEqual(matches[0].route.id, 2)
  })

  test('reset clears all routes', () => {
    store.add(createMockRoute(1))
    store.add(createMockRoute(2))

    store.reset()

    const matches = Array.from(store.findMatches('https://example.com/api/users', 'GET', {}))
    assert.strictEqual(matches.length, 0)
  })
})
