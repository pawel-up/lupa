import { test, describe, beforeEach } from 'node:test'
import * as assert from 'node:assert'
import { events, KeyCode } from '../../../src/commands/events.js'

describe('Events (Synthetic Events)', () => {
  let target: EventTarget
  let dispatchedEvents: Event[]

  beforeEach(() => {
    dispatchedEvents = []
    target = new EventTarget()
    target.addEventListener('keydown', (e) => dispatchedEvents.push(e))
    target.addEventListener('keyup', (e) => dispatchedEvents.push(e))
  })

  describe('KeyboardEvents', () => {
    test('down dispatches keydown event with correct properties', () => {
      const evt = events(target).keyboard.down(KeyCode.KeyA)

      assert.strictEqual(evt.type, 'keydown')
      assert.strictEqual(evt.key, 'a')
      assert.strictEqual(evt.code, 'KeyA')
      assert.strictEqual(evt.bubbles, true)
      assert.strictEqual(evt.cancelable, true)
      assert.strictEqual(evt.shiftKey, false)
      assert.strictEqual(dispatchedEvents.length, 1)
      assert.strictEqual(dispatchedEvents[0], evt)
    })

    test('down resolves shifted characters and explicit shift key modifier', () => {
      const evt = events(target).keyboard.down('A')

      assert.strictEqual(evt.type, 'keydown')
      assert.strictEqual(evt.key, 'A')
      assert.strictEqual(evt.code, 'KeyA')
      assert.strictEqual(evt.shiftKey, true)
    })

    test('up dispatches keyup event', () => {
      const evt = events(target).keyboard.up(KeyCode.Enter)

      assert.strictEqual(evt.type, 'keyup')
      assert.strictEqual(evt.key, 'Enter')
      assert.strictEqual(evt.code, 'Enter')
      assert.strictEqual(dispatchedEvents.length, 1)
      assert.strictEqual(dispatchedEvents[0], evt)
    })

    test('press dispatches keydown and keyup sequentially', async () => {
      const result = await events(target).keyboard.press(KeyCode.Backspace)

      assert.strictEqual(result.keydown.type, 'keydown')
      assert.strictEqual(result.keyup.type, 'keyup')
      assert.strictEqual(dispatchedEvents.length, 2)
      assert.strictEqual(dispatchedEvents[0], result.keydown)
      assert.strictEqual(dispatchedEvents[1], result.keyup)
    })

    test('press supports modifier shortcut combinations like Control+A', async () => {
      const result = await events(target).keyboard.press('Control+A')

      const keydown = result.keydown as KeyboardEvent
      assert.strictEqual(keydown.type, 'keydown')
      assert.strictEqual(keydown.ctrlKey, true)
      assert.strictEqual(keydown.key, 'A')
      assert.strictEqual(keydown.code, 'KeyA')
      assert.strictEqual(keydown.shiftKey, true)
    })

    test('press supports ControlOrMeta+Shift shortcut combinations', async () => {
      const result = await events(target).keyboard.press('ControlOrMeta+Shift+Z')

      const keydown = result.keydown as KeyboardEvent
      assert.strictEqual(keydown.shiftKey, true)
      assert.strictEqual(keydown.key, 'Z')
      assert.strictEqual(keydown.code, 'KeyZ')
      assert.strictEqual(keydown.ctrlKey || keydown.metaKey, true)
    })

    test('press supports shortcut with plus key like Control++', async () => {
      const result = await events(target).keyboard.press('Control++')

      const keydown = result.keydown as KeyboardEvent
      assert.strictEqual(keydown.ctrlKey, true)
      assert.strictEqual(keydown.key, '+')
      assert.strictEqual(keydown.code, 'NumpadAdd')
    })

    test('press respects delay option', async () => {
      const start = Date.now()
      await events(target).keyboard.press(KeyCode.KeyA, { delay: 50 })
      const elapsed = Date.now() - start

      assert.strictEqual(dispatchedEvents.length, 2)
      assert.ok(elapsed >= 45, `Expected delay of ~50ms, elapsed was ${elapsed}ms`)
    })

    test('type dispatches keydown and keyup for each character in string', async () => {
      const results = await events(target).keyboard.type('Hi!')

      assert.strictEqual(results.length, 3)
      assert.strictEqual(dispatchedEvents.length, 6)

      assert.strictEqual(results[0].keydown.key, 'H')
      assert.strictEqual(results[0].keydown.shiftKey, true)

      assert.strictEqual(results[1].keydown.key, 'i')
      assert.strictEqual(results[1].keydown.shiftKey, false)

      assert.strictEqual(results[2].keydown.key, '!')
      assert.strictEqual(results[2].keydown.code, 'Digit1')
      assert.strictEqual(results[2].keydown.shiftKey, true)
    })

    test('type respects delay option between characters', async () => {
      const start = Date.now()
      await events(target).keyboard.type('AB', { delay: 50 })
      const elapsed = Date.now() - start

      assert.strictEqual(dispatchedEvents.length, 4)
      assert.ok(elapsed >= 45, `Expected delay of ~50ms, elapsed was ${elapsed}ms`)
    })

    test('throws when passing invalid/unknown key code or character', () => {
      assert.throws(() => {
        events(target).keyboard.down('UnknownKey')
      }, /Unknown key code or character: UnknownKey/)
    })
  })

  describe('MouseEvents', () => {
    let mouseTarget: EventTarget
    let mouseEventsList: Event[]

    beforeEach(() => {
      mouseEventsList = []
      mouseTarget = new EventTarget()
      const listener = (e: Event) => mouseEventsList.push(e)
      mouseTarget.addEventListener('mousedown', listener)
      mouseTarget.addEventListener('mouseup', listener)
      mouseTarget.addEventListener('click', listener)
      mouseTarget.addEventListener('dblclick', listener)
      mouseTarget.addEventListener('contextmenu', listener)
      mouseTarget.addEventListener('mousemove', listener)
      mouseTarget.addEventListener('mouseover', listener)
      mouseTarget.addEventListener('mouseenter', listener)
      mouseTarget.addEventListener('mouseout', listener)
      mouseTarget.addEventListener('mouseleave', listener)
    })

    test('click dispatches mousedown, mouseup, click in sequence', () => {
      const res = events(mouseTarget).mouse.click()

      assert.strictEqual(res.mousedown.type, 'mousedown')
      assert.strictEqual(res.mouseup.type, 'mouseup')
      assert.strictEqual(res.click.type, 'click')

      assert.strictEqual(mouseEventsList.length, 3)
      assert.strictEqual(mouseEventsList[0].type, 'mousedown')
      assert.strictEqual(mouseEventsList[1].type, 'mouseup')
      assert.strictEqual(mouseEventsList[2].type, 'click')
    })

    test('dblclick dispatches double-click sequence including dblclick event', () => {
      const res = events(mouseTarget).mouse.dblclick()

      assert.strictEqual(res.dblclick.type, 'dblclick')
      assert.strictEqual(mouseEventsList.length, 7)
      assert.strictEqual(mouseEventsList[6].type, 'dblclick')
    })

    test('contextMenu dispatches contextmenu event with right button flags', () => {
      const evt = events(mouseTarget).mouse.contextMenu()

      assert.strictEqual(evt.type, 'contextmenu')
      assert.strictEqual(evt.button, 2)
      assert.strictEqual(mouseEventsList.length, 1)
    })

    test('hover and leave dispatch mouseover/mouseenter and mouseout/mouseleave', () => {
      const hoverRes = events(mouseTarget).mouse.hover()
      assert.strictEqual(hoverRes.mouseover.type, 'mouseover')
      assert.strictEqual(hoverRes.mouseenter.type, 'mouseenter')

      const leaveRes = events(mouseTarget).mouse.leave()
      assert.strictEqual(leaveRes.mouseout.type, 'mouseout')
      assert.strictEqual(leaveRes.mouseleave.type, 'mouseleave')
    })
  })

  describe('InputEvents', () => {
    let mockElement: { value: string; checked: boolean; addEventListener: any; dispatchEvent: any }

    beforeEach(() => {
      const targetNode = new EventTarget()
      mockElement = {
        value: '',
        checked: false,
        addEventListener: targetNode.addEventListener.bind(targetNode),
        dispatchEvent: targetNode.dispatchEvent.bind(targetNode),
      }
    })

    test('fill updates value property and dispatches input and change events', () => {
      const inputEventsList: Event[] = []
      mockElement.addEventListener('input', (e: Event) => inputEventsList.push(e))
      mockElement.addEventListener('change', (e: Event) => inputEventsList.push(e))

      const res = events(mockElement as unknown as EventTarget).input.fill('Hello World')

      assert.strictEqual(mockElement.value, 'Hello World')
      assert.strictEqual(res.inputEvent.type, 'input')
      assert.strictEqual(res.changeEvent.type, 'change')
      assert.strictEqual(inputEventsList.length, 2)
    })

    test('check, uncheck, and toggle update checked property and dispatch events', () => {
      const inputEventsList: Event[] = []
      mockElement.addEventListener('input', (e: Event) => inputEventsList.push(e))
      mockElement.addEventListener('change', (e: Event) => inputEventsList.push(e))

      events(mockElement as unknown as EventTarget).input.check()
      assert.strictEqual(mockElement.checked, true)

      events(mockElement as unknown as EventTarget).input.uncheck()
      assert.strictEqual(mockElement.checked, false)

      events(mockElement as unknown as EventTarget).input.toggle()
      assert.strictEqual(mockElement.checked, true)
    })

    test('selectOption updates value and dispatches change event', () => {
      const changeEventsList: Event[] = []
      mockElement.addEventListener('change', (e: Event) => changeEventsList.push(e))

      const evt = events(mockElement as unknown as EventTarget).input.selectOption('option-2')

      assert.strictEqual(mockElement.value, 'option-2')
      assert.strictEqual(evt.type, 'change')
      assert.strictEqual(changeEventsList.length, 1)
    })
  })

  describe('ClipboardEvents', () => {
    let clipboardTarget: EventTarget

    beforeEach(() => {
      clipboardTarget = new EventTarget()
    })

    test('paste dispatches paste ClipboardEvent populated with DataTransfer text payload', () => {
      let dispatched: Event | undefined
      clipboardTarget.addEventListener('paste', (e) => {
        dispatched = e
      })

      const evt = events(clipboardTarget).clipboard.paste('Pasted Text Payload')

      assert.strictEqual(evt.type, 'paste')
      assert.strictEqual(dispatched, evt)

      const clipboardData = (evt as unknown as { clipboardData: DataTransfer }).clipboardData
      assert.ok(clipboardData)
      assert.strictEqual(clipboardData.getData('text/plain'), 'Pasted Text Payload')
    })

    test('paste supports MIME type dictionary in DataTransfer payload', () => {
      const evt = events(clipboardTarget).clipboard.paste({
        'text/plain': 'Plain Text',
        'text/html': '<b>HTML Text</b>',
      })

      const clipboardData = (evt as unknown as { clipboardData: DataTransfer }).clipboardData
      assert.strictEqual(clipboardData.getData('text/plain'), 'Plain Text')
      assert.strictEqual(clipboardData.getData('text/html'), '<b>HTML Text</b>')
    })

    test('copy and cut dispatch copy/cut events with optional payload', () => {
      const copyEvt = events(clipboardTarget).clipboard.copy('Copied Data')
      assert.strictEqual(copyEvt.type, 'copy')
      const copyData = (copyEvt as unknown as { clipboardData: DataTransfer }).clipboardData
      assert.strictEqual(copyData.getData('text/plain'), 'Copied Data')

      const cutEvt = events(clipboardTarget).clipboard.cut('Cut Data')
      assert.strictEqual(cutEvt.type, 'cut')
      const cutData = (cutEvt as unknown as { clipboardData: DataTransfer }).clipboardData
      assert.strictEqual(cutData.getData('text/plain'), 'Cut Data')
    })
  })

  describe('FocusEvents', () => {
    let focusTarget: { focus: () => void; blur: () => void; addEventListener: any; dispatchEvent: any }
    let focusedState: boolean

    beforeEach(() => {
      focusedState = false
      const targetNode = new EventTarget()
      focusTarget = {
        focus: () => {
          focusedState = true
        },
        blur: () => {
          focusedState = false
        },
        addEventListener: targetNode.addEventListener.bind(targetNode),
        dispatchEvent: targetNode.dispatchEvent.bind(targetNode),
      }
    })

    test('in and focus trigger native .focus() and dispatch focus and focusin events', () => {
      const dispatchedList: Event[] = []
      focusTarget.addEventListener('focus', (e: Event) => dispatchedList.push(e))
      focusTarget.addEventListener('focusin', (e: Event) => dispatchedList.push(e))

      const res = events(focusTarget as unknown as EventTarget).focus.in()

      assert.strictEqual(focusedState, true)
      assert.strictEqual(res.focus.type, 'focus')
      assert.strictEqual(res.focusin.type, 'focusin')
      assert.strictEqual(dispatchedList.length, 2)
      assert.strictEqual(dispatchedList[0].type, 'focus')
      assert.strictEqual(dispatchedList[1].type, 'focusin')
    })

    test('out and blur trigger native .blur() and dispatch blur and focusout events', () => {
      focusedState = true
      const dispatchedList: Event[] = []
      focusTarget.addEventListener('blur', (e: Event) => dispatchedList.push(e))
      focusTarget.addEventListener('focusout', (e: Event) => dispatchedList.push(e))

      const res = events(focusTarget as unknown as EventTarget).focus.out()

      assert.strictEqual(focusedState, false)
      assert.strictEqual(res.blur.type, 'blur')
      assert.strictEqual(res.focusout.type, 'focusout')
      assert.strictEqual(dispatchedList.length, 2)
      assert.strictEqual(dispatchedList[0].type, 'blur')
      assert.strictEqual(dispatchedList[1].type, 'focusout')
    })

    test('aliases focus() and blur() call in() and out() respectively', () => {
      focusedState = false
      events(focusTarget as unknown as EventTarget).focus.focus()
      assert.strictEqual(focusedState, true)

      events(focusTarget as unknown as EventTarget).focus.blur()
      assert.strictEqual(focusedState, false)
    })
  })

  describe('Edge cases and helpers', () => {
    test('parseShortcut falls back to full key string and throws if key is unknown', () => {
      assert.throws(() => {
        events(target).keyboard.down('InvalidMod+A')
      }, /Unknown key code or character: InvalidMod\+A/)
    })

    test('createMockDataTransfer supports setData, getData, and clearData', () => {
      const evt = events(target).clipboard.copy('Initial Data')
      const dataTransfer = (evt as unknown as { clipboardData: DataTransfer }).clipboardData
      assert.ok(dataTransfer)

      dataTransfer.setData('text/plain', 'Dynamic Data')
      assert.strictEqual(dataTransfer.getData('text/plain'), 'Dynamic Data')
      assert.deepEqual(dataTransfer.types, ['text/plain'])

      dataTransfer.clearData('text/plain')
      assert.strictEqual(dataTransfer.getData('text/plain'), '')
    })

    test('MouseEvents low-level down, up, and move methods work independently', () => {
      const mouseTarget = new EventTarget()
      const mouseEventsList: Event[] = []
      const listener = (e: Event) => mouseEventsList.push(e)
      mouseTarget.addEventListener('mousedown', listener)
      mouseTarget.addEventListener('mouseup', listener)
      mouseTarget.addEventListener('mousemove', listener)

      events(mouseTarget).mouse.down()
      events(mouseTarget).mouse.move()
      events(mouseTarget).mouse.up()

      assert.strictEqual(mouseEventsList.length, 3)
      assert.strictEqual(mouseEventsList[0].type, 'mousedown')
      assert.strictEqual(mouseEventsList[1].type, 'mousemove')
      assert.strictEqual(mouseEventsList[2].type, 'mouseup')
    })
  })
})
