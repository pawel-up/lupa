import { test, describe, beforeEach } from 'node:test'
import * as assert from 'node:assert'
import { CommandsHandler } from '../../../src/commands/rpc_handler.js'
import type { Page } from 'playwright'

describe('CommandsHandler - locator', () => {
  let mockLocator: any
  let mockPage: any
  let exposedFn: (...args: any[]) => any

  beforeEach(() => {
    mockLocator = {
      blur: async () => {},
      clear: async () => {},
      check: async () => {},
      click: async () => {},
      fill: async () => {},
      dblclick: async () => {},
      hover: async () => {},
      press: async () => {},
      tap: async () => {},
      uncheck: async () => {},
      dragTo: async () => {},
      selectOption: async () => {},
      screenshot: async () => {},
    }

    mockPage = {
      exposeFunction: async (name: string, fn: (...args: any[]) => any) => {
        if (name === '__lupa_command__') {
          exposedFn = fn
        }
        return { dispose: async () => {} }
      },
      getByRole: () => mockLocator,
      getByText: () => mockLocator,
      getByLabel: () => mockLocator,
      getByPlaceholder: () => mockLocator,
      getByAltText: () => mockLocator,
      getByTitle: () => mockLocator,
      getByTestId: () => mockLocator,
      locator: () => mockLocator,
    }
  })

  test('resolves query by role', async () => {
    let resolvedRole = ''
    mockPage.getByRole = (role: string) => {
      resolvedRole = role
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { role: 'button' } })
    assert.strictEqual(resolvedRole, 'button')
  })

  test('resolves query by text', async () => {
    let resolvedText = ''
    mockPage.getByText = (text: string) => {
      resolvedText = text
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { text: 'submit' } })
    assert.strictEqual(resolvedText, 'submit')
  })

  test('resolves query by label', async () => {
    let resolvedLabel = ''
    mockPage.getByLabel = (label: string) => {
      resolvedLabel = label
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { label: 'email' } })
    assert.strictEqual(resolvedLabel, 'email')
  })

  test('resolves query by placeholder', async () => {
    let resolvedPlaceholder = ''
    mockPage.getByPlaceholder = (placeholder: string) => {
      resolvedPlaceholder = placeholder
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { placeholder: 'password' } })
    assert.strictEqual(resolvedPlaceholder, 'password')
  })

  test('resolves query by altText', async () => {
    let resolvedAltText = ''
    mockPage.getByAltText = (altText: string) => {
      resolvedAltText = altText
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { altText: 'logo' } })
    assert.strictEqual(resolvedAltText, 'logo')
  })

  test('resolves query by title', async () => {
    let resolvedTitle = ''
    mockPage.getByTitle = (title: string) => {
      resolvedTitle = title
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { title: 'close' } })
    assert.strictEqual(resolvedTitle, 'close')
  })

  test('resolves query by testId', async () => {
    let resolvedTestId = ''
    mockPage.getByTestId = (testId: string) => {
      resolvedTestId = testId
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { testId: 'submit-btn' } })
    assert.strictEqual(resolvedTestId, 'submit-btn')
  })

  test('resolves query by css', async () => {
    let resolvedCss = ''
    mockPage.locator = (selector: string) => {
      resolvedCss = selector
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { css: '.my-class' } })
    assert.strictEqual(resolvedCss, 'css=.my-class')
  })

  test('resolves query by xpath', async () => {
    let resolvedXPath = ''
    mockPage.locator = (selector: string) => {
      resolvedXPath = selector
      return mockLocator
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', { action: 'blur', query: { xpath: '//div' } })
    assert.strictEqual(resolvedXPath, 'xpath=//div')
  })

  test('calls fill with text and options', async () => {
    let calledArgs: any[] = []
    mockLocator.fill = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'fill',
      query: { text: 'input' },
      args: { text: 'admin', options: { timeout: 100 } },
    })

    assert.strictEqual(calledArgs.length, 2)
    assert.strictEqual(calledArgs[0], 'admin')
    assert.deepStrictEqual(calledArgs[1], { timeout: 100 })
  })

  test('calls press with key and options', async () => {
    let calledArgs: any[] = []
    mockLocator.press = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'press',
      query: { text: 'input' },
      args: { key: 'Enter', options: { delay: 50 } },
    })

    assert.strictEqual(calledArgs.length, 2)
    assert.strictEqual(calledArgs[0], 'Enter')
    assert.deepStrictEqual(calledArgs[1], { delay: 50 })
  })

  test('calls click with options', async () => {
    let calledArgs: any[] = []
    mockLocator.click = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'click',
      query: { text: 'input' },
      args: { clickCount: 2 },
    })

    assert.strictEqual(calledArgs.length, 1)
    assert.deepStrictEqual(calledArgs[0], { clickCount: 2 })
  })

  test('calls dragTo with target and options', async () => {
    let calledArgs: any[] = []
    mockLocator.dragTo = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'dragTo',
      query: { text: 'draggable' },
      args: {
        targetQuery: { text: 'droppable' },
        options: { timeout: 300 },
      },
    })

    assert.strictEqual(calledArgs.length, 2)
    assert.strictEqual(calledArgs[0], mockLocator)
    assert.deepStrictEqual(calledArgs[1], { timeout: 300 })
  })

  test('calls selectOption and returns the result', async () => {
    let calledArgs: any[] = []
    mockLocator.selectOption = async (...args: any[]) => {
      calledArgs = args
      return ['val1', 'val2']
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    const result = await exposedFn('locator', {
      action: 'selectOption',
      query: { text: 'select' },
      args: {
        values: ['val1', 'val2'],
        options: { force: true },
      },
    })

    assert.strictEqual(calledArgs.length, 2)
    assert.deepStrictEqual(calledArgs[0], ['val1', 'val2'])
    assert.deepStrictEqual(calledArgs[1], { force: true })
    assert.deepStrictEqual(result, ['val1', 'val2'])
  })

  test('calls pressSequentially', async () => {
    let calledArgs: any[] = []
    mockLocator.pressSequentially = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'pressSequentially',
      query: { text: 'input' },
      args: {
        text: 'hello',
        options: { delay: 10 },
      },
    })

    assert.strictEqual(calledArgs.length, 2)
    assert.strictEqual(calledArgs[0], 'hello')
    assert.deepStrictEqual(calledArgs[1], { delay: 10 })
  })

  test('calls screenshot', async () => {
    let calledArgs: any[] = []
    mockLocator.screenshot = async (...args: any[]) => {
      calledArgs = args
    }
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('locator', {
      action: 'screenshot',
      query: { text: 'button' },
      args: { path: 'el.png', type: 'png' },
    })

    assert.strictEqual(calledArgs.length, 1)
    assert.deepStrictEqual(calledArgs[0], { path: 'el.png', type: 'png' })
  })
})

describe('CommandsHandler - mouse', () => {
  let mockPage: any
  let exposedFn: (...args: any[]) => any
  let mouseCalls: { method: string; args: any[] }[]
  let keyboardCalls: { method: string; args: any[] }[]

  beforeEach(() => {
    mouseCalls = []
    keyboardCalls = []

    mockPage = {
      exposeFunction: async (name: string, fn: (...args: any[]) => any) => {
        if (name === '__lupa_command__') {
          exposedFn = fn
        }
        return { dispose: async () => {} }
      },
      mouse: {
        move: async (...args: any[]) => {
          mouseCalls.push({ method: 'move', args })
        },
        down: async (...args: any[]) => {
          mouseCalls.push({ method: 'down', args })
        },
        up: async (...args: any[]) => {
          mouseCalls.push({ method: 'up', args })
        },
        click: async (...args: any[]) => {
          mouseCalls.push({ method: 'click', args })
        },
        dblclick: async (...args: any[]) => {
          mouseCalls.push({ method: 'dblclick', args })
        },
      },
      keyboard: {
        down: async (...args: any[]) => {
          keyboardCalls.push({ method: 'down', args })
        },
        up: async (...args: any[]) => {
          keyboardCalls.push({ method: 'up', args })
        },
      },
    }
  })

  test('calls mouse reset', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'reset' })
    assert.deepStrictEqual(mouseCalls, [
      { method: 'move', args: [0, 0] },
      { method: 'up', args: [] },
    ])
  })

  test('calls mouse move without dragging', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'move', x: 100, y: 200, options: { steps: 5 } })
    assert.deepStrictEqual(mouseCalls, [{ method: 'move', args: [100, 200, { steps: 5 }] }])
  })

  test('calls mouse move with dragging', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'move', x: 100, y: 200, options: { button: 'left', steps: 5 } })
    assert.deepStrictEqual(mouseCalls, [
      { method: 'down', args: [{ button: 'left' }] },
      { method: 'move', args: [100, 200, { steps: 5 }] },
      { method: 'up', args: [{ button: 'left' }] },
    ])
  })

  test('calls mouse moveBetween without dragging', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', {
      action: 'moveBetween',
      fromX: 10,
      fromY: 20,
      toX: 30,
      toY: 40,
      options: { steps: 2 },
    })
    assert.deepStrictEqual(mouseCalls, [
      { method: 'move', args: [10, 20] },
      { method: 'move', args: [30, 40, { steps: 2 }] },
    ])
  })

  test('calls mouse moveBetween with dragging', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', {
      action: 'moveBetween',
      fromX: 10,
      fromY: 20,
      toX: 30,
      toY: 40,
      options: { button: 'right', steps: 2 },
    })
    assert.deepStrictEqual(mouseCalls, [
      { method: 'move', args: [10, 20] },
      { method: 'down', args: [{ button: 'right' }] },
      { method: 'move', args: [30, 40, { steps: 2 }] },
      { method: 'up', args: [{ button: 'right' }] },
    ])
  })

  test('calls mouse down and up', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'down', options: { button: 'middle', clickCount: 2 } })
    await exposedFn('mouse', { action: 'up', options: { button: 'middle', clickCount: 2 } })

    assert.deepStrictEqual(mouseCalls, [
      { method: 'down', args: [{ button: 'middle', clickCount: 2 }] },
      { method: 'up', args: [{ button: 'middle', clickCount: 2 }] },
    ])
  })

  test('calls mouse click', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'click', x: 50, y: 60, options: { button: 'left', delay: 10 } })
    assert.deepStrictEqual(mouseCalls, [
      { method: 'click', args: [50, 60, { button: 'left', clickCount: undefined, delay: 10 }] },
    ])
  })

  test('calls mouse dblclick', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', { action: 'dblclick', x: 70, y: 80, options: { button: 'right', delay: 20 } })
    assert.deepStrictEqual(mouseCalls, [{ method: 'dblclick', args: [70, 80, { button: 'right', delay: 20 }] }])
  })

  test('calls mouse press with key modifiers', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('mouse', {
      action: 'press',
      x: 100,
      y: 110,
      options: { button: 'left', key: 'Shift+Control', delay: 5 },
    })

    assert.deepStrictEqual(keyboardCalls, [
      { method: 'down', args: ['Shift'] },
      { method: 'down', args: ['Control'] },
      { method: 'up', args: ['Control'] },
      { method: 'up', args: ['Shift'] },
    ])
    assert.deepStrictEqual(mouseCalls, [
      { method: 'move', args: [100, 110] },
      { method: 'down', args: [{ button: 'left' }] },
      { method: 'up', args: [{ button: 'left' }] },
    ])
  })
})

describe('CommandsHandler - keyboard', () => {
  let mockPage: any
  let exposedFn: (...args: any[]) => any
  let keyboardCalls: { method: string; args: any[] }[]

  beforeEach(() => {
    keyboardCalls = []

    mockPage = {
      exposeFunction: async (name: string, fn: (...args: any[]) => any) => {
        if (name === '__lupa_command__') {
          exposedFn = fn
        }
        return { dispose: async () => {} }
      },
      keyboard: {
        down: async (...args: any[]) => {
          keyboardCalls.push({ method: 'down', args })
        },
        up: async (...args: any[]) => {
          keyboardCalls.push({ method: 'up', args })
        },
        insertText: async (...args: any[]) => {
          keyboardCalls.push({ method: 'insertText', args })
        },
        press: async (...args: any[]) => {
          keyboardCalls.push({ method: 'press', args })
        },
        type: async (...args: any[]) => {
          keyboardCalls.push({ method: 'type', args })
        },
      },
    }
  })

  test('calls keyboard down and up', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('keyboard', { action: 'down', key: 'Shift' })
    await exposedFn('keyboard', { action: 'up', key: 'Shift' })

    assert.deepStrictEqual(keyboardCalls, [
      { method: 'down', args: ['Shift'] },
      { method: 'up', args: ['Shift'] },
    ])
  })

  test('calls keyboard insertText', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('keyboard', { action: 'insertText', text: '嗨' })
    assert.deepStrictEqual(keyboardCalls, [{ method: 'insertText', args: ['嗨'] }])
  })

  test('calls keyboard press', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('keyboard', { action: 'press', key: 'Control+A', options: { delay: 100 } })
    assert.deepStrictEqual(keyboardCalls, [{ method: 'press', args: ['Control+A', { delay: 100 }] }])
  })

  test('calls keyboard type', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('keyboard', { action: 'type', text: 'Hello', options: { delay: 50 } })
    assert.deepStrictEqual(keyboardCalls, [{ method: 'type', args: ['Hello', { delay: 50 }] }])
  })
})

describe('CommandsHandler - page screenshot', () => {
  let mockPage: any
  let exposedFn: (...args: any[]) => any
  let screenshotCalls: any[] = []

  beforeEach(() => {
    screenshotCalls = []
    mockPage = {
      exposeFunction: async (name: string, fn: (...args: any[]) => any) => {
        if (name === '__lupa_command__') {
          exposedFn = fn
        }
        return { dispose: async () => {} }
      },
      screenshot: async (options: any) => {
        screenshotCalls.push(options)
      },
    }
  })

  test('calls page.screenshot', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    await exposedFn('screenshot', { action: 'take', options: { path: 'page.png', fullPage: true } })
    assert.strictEqual(screenshotCalls.length, 1)
    assert.deepStrictEqual(screenshotCalls[0], { path: 'page.png', fullPage: true })
  })
})

describe('CommandsHandler - cookies', () => {
  let mockPage: any
  let exposedFn: (...args: any[]) => any
  let contextCalls: { method: string; args: any[] }[] = []
  const dummyCookies = [{ name: 'foo', value: 'bar' }]

  beforeEach(() => {
    contextCalls = []
    mockPage = {
      exposeFunction: async (name: string, fn: (...args: any[]) => any) => {
        if (name === '__lupa_command__') {
          exposedFn = fn
        }
        return { dispose: async () => {} }
      },
      context: () => ({
        addCookies: async (...args: any[]) => {
          contextCalls.push({ method: 'addCookies', args })
        },
        cookies: async (...args: any[]) => {
          contextCalls.push({ method: 'cookies', args })
          return dummyCookies
        },
        clearCookies: async (...args: any[]) => {
          contextCalls.push({ method: 'clearCookies', args })
        },
      }),
    }
  })

  test('calls context.addCookies', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    const cookiesList = [{ name: 'auth', value: 'secret' }]
    await exposedFn('cookies:add', { cookies: cookiesList })

    assert.strictEqual(contextCalls.length, 1)
    assert.deepStrictEqual(contextCalls[0], {
      method: 'addCookies',
      args: [cookiesList],
    })
  })

  test('calls context.cookies', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    const result = await exposedFn('cookies:getAll', { urls: ['https://example.com'] })

    assert.strictEqual(contextCalls.length, 1)
    assert.deepStrictEqual(contextCalls[0], {
      method: 'cookies',
      args: [['https://example.com']],
    })
    assert.deepStrictEqual(result, dummyCookies)
  })

  test('calls context.clearCookies', async () => {
    const handler = new CommandsHandler(mockPage as Page)
    await handler.boot()

    const clearOptions = { name: 'auth' }
    await exposedFn('cookies:clear', { options: clearOptions })

    assert.strictEqual(contextCalls.length, 1)
    assert.deepStrictEqual(contextCalls[0], {
      method: 'clearCookies',
      args: [clearOptions],
    })
  })
})
