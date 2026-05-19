import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import { createRouteDefinition, extractParams, extractQueryParameters } from '../../../src/network/route_matcher.js'

describe('RouteMatcher', () => {
  describe('createRouteDefinition', () => {
    test('creates pattern for absolute paths', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users' }, {})
      assert.ok(def.pattern)
      assert.ok(def.pattern.test('https://example.com/api/users'))
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
    })

    test('ignores pattern if uri is not provided', () => {
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
      const match = def.pattern!.exec('https://example.com/api/users/123/posts/456')
      const params = extractParams(match)
      assert.deepStrictEqual(params, { id: '123', postId: '456' })
    })

    test('returns empty object if no parameters', () => {
      const def = createRouteDefinition(1, { type: 'string', uri: '/api/users' }, {})
      const match = def.pattern!.exec('https://example.com/api/users')
      const params = extractParams(match)
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

    test('handles parsing errors gracefully', () => {
      const params = extractQueryParameters('/relative/path?foo=bar')
      assert.deepStrictEqual(params, {})
    })
  })
})
