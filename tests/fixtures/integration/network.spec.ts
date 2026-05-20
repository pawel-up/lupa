import { NetworkError } from '../../../src/network/index.js'
import { test } from '../../../src/testing/index.js'

test.group('Network Interception', () => {
  test('mocks a simple JSON response', async ({ network, assert }) => {
    const userMock = await network.mock({
      match: '/api/user',
      respond: {
        body: JSON.stringify({ id: 1, name: 'Alice' }),
        headers: { 'Content-Type': 'application/json' },
      },
    })

    const res = await fetch('/api/user')
    const json = await res.json()

    assert.equal(res.status, 200)
    assert.deepEqual(json, { id: 1, name: 'Alice' })

    await userMock.assert.calledOnce()
  })

  test('mocks using a dynamic closure and url params', async ({ network, assert }) => {
    let callCount = 0

    const mock = await network.mock({
      match: '/api/users/:id',
      respond: (req) => {
        callCount++
        return {
          body: JSON.stringify({
            userId: req.url.split('/').pop(),
            calls: callCount,
          }),
        }
      },
    })

    const res1 = await fetch('/api/users/123')
    const json1 = await res1.json()

    const res2 = await fetch('/api/users/456')
    const json2 = await res2.json()

    assert.deepEqual(json1, { userId: '123', calls: 1 })
    assert.deepEqual(json2, { userId: '456', calls: 2 })

    await mock.assert.calledTwice()
  })

  test('respects the transient mock "times" option', async ({ network, assert }) => {
    // This will bypass since we're matching the same route but falling through
    // For this test, we expect the 3rd request to fail if there's no real backend,
    // or we can catch it with another mock.

    await network.mock({
      match: '/api/transient',
      respond: { status: 404 }, // Fallback mock
    })

    const transientMock = await network.mock({
      match: '/api/transient',
      times: 2,
      respond: {
        status: 200,
        body: 'Success',
      },
    })

    const res1 = await fetch('/api/transient')
    assert.equal(res1.status, 200)

    const res2 = await fetch('/api/transient')
    assert.equal(res2.status, 200)

    // Third call should fall through to the 404 mock
    const res3 = await fetch('/api/transient')
    assert.equal(res3.status, 404)

    await transientMock.assert.calledTwice()
  })

  test('supports explicit bypass', async ({ network, assert }) => {
    const fallbackMock = await network.mock({
      match: '/api/bypass',
      respond: { status: 200, body: 'Fallback' },
    })

    const bypassMock = await network.mock({
      match: '/api/bypass',
      respond: () => network.bypass,
    })

    const res = await fetch('/api/bypass')
    const text = await res.text()

    assert.equal(text, 'Fallback')

    await bypassMock.assert.calledOnce()
    await fallbackMock.assert.calledOnce()
  })

  test('properly records requests for assertions', async ({ network, assert }) => {
    const mock = await network.mock({
      match: '/api/submit',
      respond: { status: 201 },
    })

    await fetch('/api/submit?foo=bar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'test',
      },
      body: JSON.stringify({ a: 1 }),
    })

    await mock.assert.calledOnceWith({
      method: 'POST',
    })

    // Check manual request extraction
    const req = mock.lastRequest()!
    assert.equal(req.method, 'POST')
    assert.equal(req.body, '{"a":1}')
    assert.equal(req.headers['x-custom'], 'test')
  })

  test('supports simplified two-argument signature', async ({ network, assert }) => {
    const mockString = await network.mock('/api/dual/string', {
      status: 201,
      body: 'string match',
    })

    const mockObject = await network.mock(
      { uri: '/api/dual/object', methods: ['POST'] },
      {
        status: 202,
        body: 'object match',
      }
    )

    const res1 = await fetch('/api/dual/string')
    assert.equal(res1.status, 201)
    assert.equal(await res1.text(), 'string match')

    const res2 = await fetch('/api/dual/object', { method: 'POST' })
    assert.equal(res2.status, 202)
    assert.equal(await res2.text(), 'object match')

    await mockString.assert.calledOnce()
    await mockObject.assert.calledOnce()
  })

  test('supports bypassing CORS and reading custom headers', async ({ network, assert }) => {
    await network.ignoreCors()

    const mock = await network.mock({
      match: 'http://different-domain.com/api/data',
      respond: {
        status: 200,
        headers: { 'x-test': 'custom-value' },
        body: JSON.stringify({ success: true }),
      },
    })

    const res = await fetch('http://different-domain.com/api/data', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const json = await res.json()

    assert.equal(res.status, 200)
    assert.deepEqual(json, { success: true })
    assert.equal(res.headers.get('x-test'), 'custom-value')

    await mock.assert.calledOnce()
  })

  test('simulates network error: {$self}')
    .with(Object.values(NetworkError))
    .run(async ({ network, assert }, error) => {
      const mock = await network.mock('/api/error', { error })
      await assert.rejects(async () => await fetch('/api/error'), TypeError, 'Failed to fetch')
      await mock.assert.calledOnce()
    })
})
