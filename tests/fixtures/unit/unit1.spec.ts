import { test } from '../../../src/testing/index.js'

test('unit 1 - no suite', ({ assert }) => {
  // eslint-disable-next-line no-console
  console.log('Running dummy test in the browser!')
  const el = document.createElement('div')
  el.textContent = 'Hello'
  document.body.appendChild(el)

  assert.include(document.body.innerHTML, 'Hello')
})
