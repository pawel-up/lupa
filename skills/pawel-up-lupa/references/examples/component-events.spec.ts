import { fixture, html, test, nextFrame } from '@pawel-up/lupa/testing'
import { query } from '@pawel-up/lupa/commands'
import sinon from 'sinon'
// The location of the component that we want to test.
import 'my-button/my-button.js'
import type { MyButtonElement } from 'my-button/my-button.js'

// It is OK to use groups to group test logically
test.group('Basic tests', () => {
  async function basicFixture(): Promise<MyButtonElement> {
    return fixture(html`<my-button type="button" role="button">Label</my-button>`)
  }

  test('It should render', async ({ assert }) => {
    const el = await basicFixture()
    assert.isNotNull(el)
  }).tags(['@button', '@basic'])
})

test.group('Form integration tests', () => {
  async function formFixture(): Promise<HTMLFormElement> {
    return fixture(
      html`<form id="form">
        <input name="text" value="abc" />
        <my-button name="test" type="submit" role="button">Label</my-button>
      </form>`
    )
  }

  test('triggers submit when clicked', async ({ assert }) => {
    const form = await formFixture()
    const spy = sinon.stub()

    form.addEventListener('submit', spy)

    // Query uses playwright's actions, but for a simple example like this
    // it would be more useful to just query for the button in the form and just `.click()` it.
    // That would be faster as it's synchronous. However, `query()` is much more powerful.
    // form.querySelector('my-button')?.click()
    await query({ role: 'button' }).click()

    assert.isTrue(spy.called)
    assert.isTrue(spy.calledWith('submit'))
  }).tags(['@button', '@form'])

  test('does not trigger submit when disabled', async ({ assert }) => {
    const form = await formFixture()
    const spy = sinon.stub()

    form.addEventListener('submit', spy)

    const button = form.querySelector('my-button')!
    button.disabled = true
    await nextFrame()
    button.click()

    assert.isFalse(spy.called)
  }).tags(['@button', '@form'])
})
