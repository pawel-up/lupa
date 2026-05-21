import { test, fixture, html } from '@pawel-up/lupa/testing'
import sdk from 'my-sdk'
import 'user-profile/user-profile.js'

const API_BASE = 'https://api.my-app.com/v1'

test('loads and displays user data', async ({ assert, network }) => {
  // Optional: enable CORS bypass for this test if in another domain.
  await network.ignoreCors()

  // Setup the network mock
  const mock = await network.mock(`${API_BASE}/users/1`, {
    status: 200,
    body: JSON.stringify({ id: 1, name: 'Alice', role: 'admin' }),
    headers: { 'Content-Type': 'application/json' },
  })

  // Mount the component that fires the request
  await fixture(html`<user-profile user-id="1"></user-profile>`)

  // Assert on the DOM
  assert.dom.hasText(document.querySelector('.user-name'), 'Alice')

  // Await Assert (Guarantees the network layer has settled)
  await mock.assert.calledOnce('The user profile was called once')
  // you can assert properties of the call, only the properties you provide are checked
  await mock.assert.calledWith({
    method: 'GET',
    url: `${API_BASE}/users/1`,
  })
}).tags(['@user-profile', '@network', '@e2e'])

test('displays offline fallback when network drops', async ({ assert, network }) => {
  // Mock a hard network failure
  await network.mock(`${API_BASE}/users/1`, {
    error: network.error.ConnectionFailed,
  })

  await fixture(html`<user-profile user-id="1"></user-profile>`)

  assert.dom.isVisible(document.querySelector('.offline-banner'))
}).tags(['@user-profile', '@network', '@e2e'])

test('detects failures via the SDK', async ({ assert, network }) => {
  // Mock a hard network failure
  await network.mock(`${API_BASE}/users/1`, {
    status: 400,
    body: JSON.stringify({ error: 'User 1 not found' }),
  })

  const instance = new sdk({ baseUrl: API_BASE })
  // It asserts the exception type and message. It returns the caught error.
  const error = await assert.rejects<Error>(async () => await instance.users.get('1'), Error, 'User 1 not found')
  // The `error` is casted to the Error type, so we can assert on its properties.
  assert.equal(error.message, 'User 1 not found')
}).tags(['@sdk', '@network', '@user'])
