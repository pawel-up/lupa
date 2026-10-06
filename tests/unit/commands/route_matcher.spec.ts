import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import { createRouteDefinition, extractParams, extractQueryParameters } from '../../../src/network/route_matcher.js'

describe('RouteMatcher', () => {
  describe('createRouteDefinition', () => {
    test('creates pattern for absolute paths', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
      assert.ok(def.pattern.test('https://example.com/api/users?foo=bar'))
    })

    test('creates pattern for full URLs', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: 'https://example.com/api/users' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
      assert.strictEqual(def.pattern.test('https://other.com/api/users'), false)
    })

    test('creates pattern for relative string paths', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: 'api/users' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
      assert.ok(def.pattern.test('https://example.com/api/users?foo=bar'))
    })

    test('creates pattern for glob paths starting with */', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '*/api/users' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
      assert.ok(def.pattern.test('http://localhost/api/users'))
      assert.strictEqual(def.pattern.test('http://localhost/other/api/users'), false)
    })

    test('creates pattern for glob paths like ** or *', () => {
      const def1 = createRouteDefinition(1, { type: 'string', uri: '**' }, {})
      assert.ok(def1.pattern)
      assert.ok(def1.pattern.test('https://example.com/api/users'))

      const def2 = createRouteDefinition(1, { type: 'string', uri: '*' }, {})
      assert.ok(def2.pattern)
      assert.ok(def2.pattern.test('http://localhost/something'))
    })

    test('splits relative URI with wildcard query correctly', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/history?*' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/history?limit=10'))
      assert.ok(def.pattern.test('https://example.com/api/history'))
      assert.strictEqual(def.pattern.test('https://example.com/api/other'), false)
    })

    test('splits relative URI with exact query parameter', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users?status=active' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users?status=active'))
      assert.strictEqual(def.pattern.test('https://example.com/api/users?status=inactive'), false)
      assert.strictEqual(def.pattern.test('https://example.com/api/users'), false)
    })

    test('handles relative URI ending with ? by defaulting search to *', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/history?' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/history?limit=10'))
      assert.ok(def.pattern.test('https://example.com/api/history'))
    })

    test('handles glob path with query string', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '*/api/history?*' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/history?limit=10'))
      assert.ok(def.pattern.test('http://localhost:3000/api/history'))
    })

    test('handles relative path without leading slash containing query string', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: 'api/history?sort=:sort' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/history?sort=asc'))
      assert.strictEqual(def.pattern.test('https://example.com/api/history?other=1'), false)
    })

    test('supports declarative pathname and search options', () => {
      const def = createRouteDefinition(
        1,
        {
          type: 'options',
          pathname: '/api/data',
          search: 'role=admin',
        },
        {}
      )
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/data?role=admin'))
      assert.strictEqual(def.pattern.test('https://example.com/api/data?role=user'), false)
      assert.strictEqual(def.pattern.test('https://example.com/api/other?role=admin'), false)
    })

    test('normalizes pathname without leading slash', () => {
      const def = createRouteDefinition(
        1,
        {
          type: 'options',
          pathname: 'api/users',
          search: '*',
        },
        {}
      )
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
      assert.ok(def.pattern.test('https://example.com/api/users?status=active'))
      assert.strictEqual(def.pattern.test('https://example.com/api/other'), false)
    })

    test('supports declarative search override with uri', () => {
      const def = createRouteDefinition(
        1,
        {
          type: 'options',
          uri: '/api/data',
          search: '*',
        },
        {}
      )
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/data'))
      assert.ok(def.pattern.test('https://example.com/api/data?foo=bar&baz=qux'))
    })

    test('stores declarative query on RouteDefinition', () => {
      const def = createRouteDefinition(
        1,
        {
          type: 'options',
          uri: '/api/data',
          query: { role: 'admin' },
        },
        {}
      )
      assert.deepStrictEqual(def.query, { role: 'admin' })
    })

    test('ignores pattern if uri and pathname and search are not provided', () => {
      const def = createRouteDefinition(1, { type: 'options', headers: { Auth: 'token' } }, {})
      assert.strictEqual(def.pattern, undefined)
      assert.deepStrictEqual(def.headers, { auth: 'token' })
    })

    test('normalizes methods and headers', () => {
      const def = createRouteDefinition(
        1,
        { type: 'options', uri: '/api', methods: ['get', 'POST'], headers: { 'X-Auth': 'Token' } },
        { lifetime: 5 }
      )
      assert.deepStrictEqual(def.methods, ['GET', 'POST'])
      assert.deepStrictEqual(def.headers, { 'x-auth': 'Token' })
      assert.strictEqual(def.lifetime, 5)
    })
  })

  describe('extractParams', () => {
    test('extracts path parameters using URLPattern', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users/:id/posts/:postId' }, {})
      const match = def.pattern ? def.pattern.exec('https://example.com/api/users/123/posts/456') : null
      const params = extractParams(match ?? undefined)
      assert.deepStrictEqual(params, { id: '123', postId: '456' })
    })

    test('extracts search parameters from query pattern groups', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/history?limit=:limit' }, {})
      const match = def.pattern ? def.pattern.exec('https://example.com/api/history?limit=25') : null
      const params = extractParams(match ?? undefined)
      assert.deepStrictEqual(params, { limit: '25' })
    })

    test('combines pathname and search parameter groups', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users/:id?filter=:filter' }, {})
      const match = def.pattern ? def.pattern.exec('https://example.com/api/users/99?filter=active') : null
      const params = extractParams(match ?? undefined)
      assert.deepStrictEqual(params, { id: '99', filter: 'active' })
    })

    test('returns empty object if no parameters', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users' }, {})
      const match = def.pattern ? def.pattern.exec('https://example.com/api/users') : null
      const params = extractParams(match ?? undefined)
      assert.deepStrictEqual(params, {})
    })

    test('returns empty object if no pattern exists', () => {
      const params = extractParams(undefined)
      assert.deepStrictEqual(params, {})
    })
  })

  describe('extractQueryParameters', () => {
    test('extracts query parameters correctly', () => {
      const params = extractQueryParameters('https://example.com/api?foo=bar&baz=123')
      assert.deepStrictEqual(params, { foo: 'bar', baz: '123' })
    })

    test('handles multiple query parameters with the same name', () => {
      const params = extractQueryParameters('https://example.com/api?foo=bar&foo=baz&foo=qux')
      assert.deepStrictEqual(params, { foo: ['bar', 'baz', 'qux'] })
    })

    test('handles empty query parameters', () => {
      const params = extractQueryParameters('https://example.com/api')
      assert.deepStrictEqual(params, {})
    })

    test('extracts query parameters from relative URLs correctly', () => {
      const params = extractQueryParameters('/relative/path?foo=bar&tag=1')
      assert.deepStrictEqual(params, { foo: 'bar', tag: '1' })
    })

    test('handles parsing errors gracefully', () => {
      const params = extractQueryParameters('http://[invalid-url')
      assert.deepStrictEqual(params, {})
    })
  })
})
