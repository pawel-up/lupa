import { fixture, html, test, waitUntil, nextFrame, aTimeout } from '@pawel-up/lupa/testing'

test('eventually renders the content', async () => {
  const element = await fixture(html`<my-element></my-element>`)!
  // It shows loading state for 1 second
  await waitUntil(() => element.textContent.includes('content'), 'Content not rendered after 1 second');
})

// alternatively we can search for a child element
test('eventually renders the content', async () => {
  const element = await fixture(html`<my-element></my-element>`)!
  await waitUntil(
    () => element.shadowRoot?.querySelector('my-child-element'),
    'Element did not render children',
  );
})

// in case we timeout too quickly we can increase the timeout or interval
test('eventually renders the content', async () => {
  const element = await fixture(html`<my-element></my-element>`)!
  await waitUntil(
    () => element.shadowRoot?.querySelector('my-child-element'),
    'Element did not render children',
    { timeout: 5000, interval: 100 }
  )
}).timeout(6000)

test('renders content after property change', async ({ assert }) => {
  const el = await fixture<MyElement>(html`<my-element></my-element>`)!
  el.value = 'new value'
  await nextFrame()
  assert.dom.shadowEqual(el, '<div>new value</div>')
})

test('updates after a long task', async ({ assert }) => {
  const element = await fixture(html`<my-element></my-element>`)!
  element.doLongTask()
  await aTimeout(10)
  assert.dom.shadowEqual(element, '<div>done</div>')
})
