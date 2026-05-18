import { test, fixture, html } from '../../../src/testing/index.js'
// import { failingFunction } from '../browser/failing_function.js'

test.group('Dummy Group', () => {
  test('this is a dummy test', ({ assert }) => {
    // eslint-disable-next-line no-console
    console.log('Running dummy test in the browser!')
    const el = document.createElement('div')
    el.textContent = 'Hello'
    document.body.appendChild(el)

    assert.include(document.body.innerHTML, 'Hello')
  })

  test('this test should pass', ({ assert }) => {
    assert.ok(true)
  }).tags(['@dummy-tag'])

  test('this test uses fixture', async ({ assert }) => {
    const el = await fixture(html`<span>lit html works</span>`)
    assert.include(el.innerHTML, 'lit html works')
  })

  test('add two numbers ({a} + {b} = {expected})')
    .with([
      { a: 1, b: 2, expected: 3 },
      { a: -1, b: 1, expected: 0 },
      { a: 0, b: 0, expected: 0 },
      { a: 100, b: 200, expected: 300 },
    ])
    .run(({ assert }, { a, b, expected }) => {
      assert.equal(a + b, expected)
    })
})
