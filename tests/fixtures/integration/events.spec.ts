import { test } from '../../../src/testing/api.js'
import { events, KeyCode } from '../../../src/commands/index.js'

test.group('Synthetic Events Integration', (group) => {
  group.setup(() => {
    document.body.innerHTML = `
      <div id="test-container" style="padding: 20px;">
        <input type="text" id="test-input" />
        <input type="checkbox" id="test-checkbox" />
        <select id="test-select">
          <option value="opt-1">Option 1</option>
          <option value="opt-2">Option 2</option>
        </select>
        <button id="test-button">Click Me</button>
        <textarea id="test-textarea"></textarea>
      </div>
    `
    return () => {
      document.body.innerHTML = ''
    }
  })

  test('events.keyboard synchronously dispatches keydown, keyup, press, and type', async ({ assert }) => {
    const input = document.getElementById('test-input') as HTMLInputElement
    const eventsLogged: string[] = []

    input.addEventListener('keydown', (e) => eventsLogged.push(`down:${e.key}`))
    input.addEventListener('keyup', (e) => eventsLogged.push(`up:${e.key}`))

    events(input).keyboard.down(KeyCode.KeyA)
    events(input).keyboard.up(KeyCode.KeyA)

    assert.deepEqual(eventsLogged, ['down:a', 'up:a'])

    eventsLogged.length = 0
    await events(input).keyboard.type('Hi')
    assert.deepEqual(eventsLogged, ['down:H', 'up:H', 'down:i', 'up:i'])
  })

  test('events.mouse dispatches click, dblclick, contextmenu, hover, and leave', ({ assert }) => {
    const button = document.getElementById('test-button') as HTMLButtonElement
    const eventsLogged: string[] = []

    button.addEventListener('mousedown', () => eventsLogged.push('mousedown'))
    button.addEventListener('mouseup', () => eventsLogged.push('mouseup'))
    button.addEventListener('click', () => eventsLogged.push('click'))
    button.addEventListener('contextmenu', () => eventsLogged.push('contextmenu'))

    events(button).mouse.click()
    assert.deepEqual(eventsLogged, ['mousedown', 'mouseup', 'click'])

    eventsLogged.length = 0
    events(button).mouse.contextMenu()
    assert.deepEqual(eventsLogged, ['contextmenu'])
  })

  test('events.input fills inputs, checks checkboxes, and selects options', ({ assert }) => {
    const input = document.getElementById('test-input') as HTMLInputElement
    const checkbox = document.getElementById('test-checkbox') as HTMLInputElement
    const select = document.getElementById('test-select') as HTMLSelectElement

    let inputFired = false
    let changeFired = false
    input.addEventListener('input', () => {
      inputFired = true
    })
    input.addEventListener('change', () => {
      changeFired = true
    })

    events(input).input.fill('Synthetic Value')
    assert.equal(input.value, 'Synthetic Value')
    assert.isTrue(inputFired)
    assert.isTrue(changeFired)

    events(checkbox).input.check()
    assert.isTrue(checkbox.checked)

    events(select).input.selectOption('opt-2')
    assert.equal(select.value, 'opt-2')
  })

  test('events.clipboard dispatches paste event with DataTransfer payload', ({ assert }) => {
    const textarea = document.getElementById('test-textarea') as HTMLTextAreaElement
    let pastedText = ''

    textarea.addEventListener('paste', (e: Event) => {
      const clipboardEvent = e as ClipboardEvent
      pastedText = clipboardEvent.clipboardData?.getData('text/plain') || ''
    })

    events(textarea).clipboard.paste('Clipboard Data Payload')
    assert.equal(pastedText, 'Clipboard Data Payload')
  })

  test('events.focus triggers focus and blur with focusin/focusout events', ({ assert }) => {
    const input = document.getElementById('test-input') as HTMLInputElement
    const eventsLogged: string[] = []

    input.addEventListener('focus', () => eventsLogged.push('focus'))
    input.addEventListener('focusin', () => eventsLogged.push('focusin'))
    input.addEventListener('blur', () => eventsLogged.push('blur'))
    input.addEventListener('focusout', () => eventsLogged.push('focusout'))

    events(input).focus.in()
    assert.deepEqual(eventsLogged, ['focus', 'focusin'])

    eventsLogged.length = 0
    events(input).focus.out()
    assert.deepEqual(eventsLogged, ['blur', 'focusout'])
  })
})
