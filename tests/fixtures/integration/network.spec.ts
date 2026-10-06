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

  test('handles basic network request matching', async ({ network, assert }) => {
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
    .run(async ({ network, assert, browserName }, error) => {
      assert.equal(assert.getBrowserName(), browserName)
      const mock = await network.mock('/api/error', { error })
      await assert.rejectsNetworkError(async () => await fetch('/api/error'))
      await mock.assert.calledOnce()
    })

  test('uses custom assertion messages on failure', async ({ network, assert }) => {
    const mock = await network.mock('/api/custom-msg', { status: 200 })
    // Should fail because it wasn't called
    const calledError = await assert.rejects(async () => {
      await mock.assert.called('Custom called message', { timeout: 10 })
    })
    assert.include(calledError.message, 'Custom called message')

    // Should fail because it wasn't called once
    const calledOnceError = await assert.rejects(async () => {
      await mock.assert.calledOnce('Custom calledOnce message', { timeout: 10 })
    })
    assert.include(calledOnceError.message, 'Custom calledOnce message')

    await fetch('/api/custom-msg')

    // Should fail because it was called, not 'notCalled'
    const notCalledError = await assert.rejects(async () => {
      await mock.assert.notCalled('Custom notCalled message', { timeout: 10 })
    })
    assert.include(notCalledError.message, 'Custom notCalled message')
    // Should fail because it was called once, not twice
    const calledTwiceError = await assert.rejects(async () => {
      await mock.assert.calledTwice('Custom calledTwice message', { timeout: 10 })
    })
    assert.include(calledTwiceError.message, 'Custom calledTwice message')
  }).timeout(5000)

  test('simulates offline behavior using network.setOffline', async ({ network, assert }) => {
    await network.setOffline(true)
    await assert.rejectsNetworkError(async () => {
      await fetch('/api/user')
    })
  })

  test('matches relative URI with query string without URLPattern construction errors', async ({ network, assert }) => {
    const historyMock = await network.mock('/api/history?*', {
      status: 200,
      body: JSON.stringify({ items: [1, 2, 3] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const resWithQuery = await fetch('/api/history?limit=10')
    const jsonWithQuery = await resWithQuery.json()
    assert.equal(resWithQuery.status, 200)
    assert.deepEqual(jsonWithQuery, { items: [1, 2, 3] })

    const resWithoutQuery = await fetch('/api/history')
    const jsonWithoutQuery = await resWithoutQuery.json()
    assert.equal(resWithoutQuery.status, 200)
    assert.deepEqual(jsonWithoutQuery, { items: [1, 2, 3] })

    await historyMock.assert.calledTwice()
  })

  test('matches relative URI with specific query parameter and bypasses non-matching', async ({ network, assert }) => {
    const fallbackMock = await network.mock('/api/users?*', {
      status: 404,
      body: 'Not Found',
    })
    const activeMock = await network.mock('/api/users?status=active', {
      status: 200,
      body: JSON.stringify({ active: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const activeRes = await fetch('/api/users?status=active')
    assert.equal(activeRes.status, 200)
    assert.deepEqual(await activeRes.json(), { active: true })

    const inactiveRes = await fetch('/api/users?status=inactive')
    assert.equal(inactiveRes.status, 404)

    await activeMock.assert.calledOnce()
    await fallbackMock.assert.calledOnce()
  })

  test('matches plain relative URI with and without query parameters by default', async ({ network, assert }) => {
    const mock = await network.mock('/api/data', {
      status: 200,
      body: 'matched',
    })

    const res1 = await fetch('/api/data')
    assert.equal(await res1.text(), 'matched')

    const res2 = await fetch('/api/data?foo=bar')
    assert.equal(await res2.text(), 'matched')

    await mock.assert.calledTwice()
  })

  test('supports declarative search wildcard match', async ({ network, assert }) => {
    const mock = await network.mock(
      { uri: '/api/declarative-search', search: '*' },
      {
        status: 200,
        body: 'wildcard match',
      }
    )

    const res1 = await fetch('/api/declarative-search')
    assert.equal(await res1.text(), 'wildcard match')

    const res2 = await fetch('/api/declarative-search?page=2&sort=desc')
    assert.equal(await res2.text(), 'wildcard match')

    await mock.assert.calledTwice()
  })

  test('supports declarative query parameter matching', async ({ network, assert }) => {
    const fallbackMock = await network.mock('/api/declarative-query?*', {
      status: 403,
      body: 'Forbidden',
    })
    const adminMock = await network.mock(
      { uri: '/api/declarative-query', query: { role: 'admin' } },
      {
        status: 200,
        body: JSON.stringify({ access: 'granted' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const adminRes = await fetch('/api/declarative-query?role=admin&session=123')
    assert.equal(adminRes.status, 200)
    assert.deepEqual(await adminRes.json(), { access: 'granted' })

    const userRes = await fetch('/api/declarative-query?role=user')
    assert.equal(userRes.status, 403)

    await adminMock.assert.calledOnce()
    await fallbackMock.assert.calledOnce()
  })
})
