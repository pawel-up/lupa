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
})
