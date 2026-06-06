import { test } from '../../../src/testing/api.js'
import {
  setViewport,
  emulateMedia,
  sendKeys,
  sendMouse,
  resetMouse,
  selectOption,
  mouse,
} from '../../../src/commands/index.js'

test.group('Browser Commands', (group) => {
  group.setup(() => {
    document.body.innerHTML = `
      <div id="test-container" style="padding: 20px;">
        <input type="text" id="test-input" />
        <select id="test-select">
          <option value="1">One</option>
          <option value="2">Two</option>
          <option value="3">Three</option>
        </select>
        <button id="test-button">Click Me</button>
        <div id="mouse-target" style="width: 100px; height: 100px; background: red;"></div>
      </div>
    `
    return () => {
      document.body.innerHTML = ''
    }
  })

  test('setViewport changes the window dimensions', async ({ assert }) => {
    await setViewport({ width: 800, height: 600 })
    assert.equal(window.innerWidth, 800)
    assert.equal(window.innerHeight, 600)

    // Reset viewport
    await setViewport({ width: 1024, height: 768 })
    assert.equal(window.innerWidth, 1024)
    assert.equal(window.innerHeight, 768)
  })

  test('emulateMedia changes the media features', async ({ assert }) => {
    await emulateMedia({ colorScheme: 'dark' })
    assert.isTrue(window.matchMedia('(prefers-color-scheme: dark)').matches)

    await emulateMedia({ colorScheme: 'light' })
    assert.isTrue(window.matchMedia('(prefers-color-scheme: light)').matches)
  })

  test('sendKeys types text into the focused element', async ({ assert }) => {
    const input = document.getElementById('test-input') as HTMLInputElement
    input.focus()

    await sendKeys({ type: 'Hello' })
    assert.equal(input.value, 'Hello')

    // Test backspace using press
    await sendKeys({ press: 'Backspace' })
    assert.equal(input.value, 'Hell')
  })

  test('sendMouse triggers click events on target', async ({ assert }) => {
    let clickCount = 0
    const btn = document.getElementById('test-button') as HTMLButtonElement
    btn.addEventListener('click', () => clickCount++)

    const rect = btn.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    // Move to button and click
    await sendMouse({ type: 'move', position: [x, y] })
    await sendMouse({ type: 'click', position: [x, y], button: 'left' })

    assert.equal(clickCount, 1)

    // Clean up
    await resetMouse()
  })

  test('mouse class triggers events on target', async ({ assert }) => {
    let clickCount = 0
    let lastEvent: MouseEvent | null = null
    const target = document.getElementById('mouse-target') as HTMLDivElement
    target.addEventListener('mousedown', (e) => {
      lastEvent = e
    })
    target.addEventListener('click', () => clickCount++)

    const rect = target.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    // Set position and click using mouse object
    await mouse.setPosition({ x, y })
    await mouse.click({ x, y })

    assert.equal(clickCount, 1)
    assert.isNotNull(lastEvent)
    assert.equal(lastEvent!.button, 0) // left click

    // Shift click using press
    lastEvent = null
    await mouse.press({ x, y }, { button: 'left', key: 'Shift' })
    assert.isNotNull(lastEvent)
    assert.isTrue(lastEvent!.shiftKey)

    // Reset mouse
    await mouse.reset()
  })

  test('selectOption selects an option in a select element', async ({ assert }) => {
    const select = document.getElementById('test-select') as HTMLSelectElement

    await selectOption({ selector: '#test-select', value: '2' })
    assert.equal(select.value, '2')

    await selectOption({ selector: '#test-select', value: '3' })
    assert.equal(select.value, '3')
  })
})
