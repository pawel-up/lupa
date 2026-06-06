import type { Locator, Page, Disposable } from 'playwright'
import type {
  CommandNames,
  DownPayload,
  Media,
  PressPayload,
  SelectOptionPayload,
  SendKeysPayload,
  SendMousePayload,
  TypePayload,
  UpPayload,
  Viewport,
} from './types.js'
import type {
  BlurOptions,
  CheckOptions,
  ClearOptions,
  ClickOptions,
  DoubleClickOptions,
  FillOptions,
  HoverOptions,
  LocatorActionPayload,
  LocatorQuery,
  PressOptions,
  QueryByAltText,
  QueryByCss,
  QueryByLabel,
  QueryByPlaceholder,
  QueryByRole,
  QueryByTestId,
  QueryByText,
  QueryByTitle,
  QueryByXPath,
  TapOptions,
  UncheckOptions,
  DragToOptions,
} from './locator.js'
import debuglog from '../runner/debug.js'
import { NetworkCommand } from '../network/network_command.js'
import { registry } from '../module-mock/registry.js'

function isTypePayload(payload: SendKeysPayload): payload is TypePayload {
  return 'type' in payload
}

function isPressPayload(payload: SendKeysPayload): payload is PressPayload {
  return 'press' in payload
}

function isDownPayload(payload: SendKeysPayload): payload is DownPayload {
  return 'down' in payload
}

function isUpPayload(payload: SendKeysPayload): payload is UpPayload {
  return 'up' in payload
}

/**
 * A class that handles the RPC calls from the browser to the runner.
 */
export class CommandsHandler {
  protected page: Page
  private closeHandler?: Disposable
  private network: NetworkCommand

  constructor(page: Page) {
    this.page = page
    this.network = new NetworkCommand(page)
  }

  /**
   * Expose the RPC handler to the browser.
   */
  async boot() {
    if (this.closeHandler) {
      throw new Error('Commands handler is already booted')
    }
    debuglog('booting commands handler')

    this.closeHandler = await this.page.exposeFunction(
      '__lupa_command__',
      async (command: CommandNames, payload: any) => {
        debuglog('received command: %s', command)
        switch (command) {
          case 'setViewport':
            await this.handleSetViewport(payload)
            break
          case 'emulateMedia':
            await this.handleEmulateMedia(payload)
            break
          case 'sendKeys':
            await this.handleSendKeys(payload)
            break
          case 'sendMouse':
            await this.handleSendMouse(payload)
            break
          case 'resetMouse':
            await this.handleResetMouse()
            break
          case 'selectOption':
            await this.handleSelectOption(payload)
            break
          case 'locator':
            await this.handleLocator(payload)
            break
          case 'network:mock:enable':
            await this.handleNetworkEnable()
            break
          case 'network:mock:disable':
            await this.handleNetworkDisable()
            break
          case 'network:mock:register':
            await this.network.register(payload)
            break
          case 'network:mock:unregister':
            await this.network.unregister(payload)
            break
          case 'network:mock:ignoreCors':
            this.network.setIgnoreCors(payload)
            break
          case 'module:mock:register':
            registry.register(payload.testId, payload.path)
            break
          case 'module:mock:clear':
            registry.clear(payload.testId)
            break
          default:
            throw new Error(`Unknown lupa command: ${command}`)
        }
      }
    )
  }

  async teardown() {
    debuglog('tearing down commands handler')
    if (this.closeHandler) {
      await this.closeHandler.dispose()
      this.closeHandler = undefined
    }
    this.network.reset()
  }

  /**
   * Handle network:mock:enable command
   */
  protected async handleNetworkEnable() {
    await this.page.route('**/*', this.network.onRoute)
  }

  /**
   * Handle network:mock:disable command
   */
  protected async handleNetworkDisable() {
    await this.page.unroute('**/*', this.network.onRoute)
  }

  /**
   * Handle setViewport command.
   */
  protected async handleSetViewport(payload: Viewport) {
    await this.page.setViewportSize(payload)
  }

  /**
   * Handle emulateMedia command.
   */
  protected async handleEmulateMedia(payload: Media) {
    await this.page.emulateMedia(payload)
  }

  /**
   * Handle sendKeys command.
   */
  protected async handleSendKeys(payload: SendKeysPayload) {
    if (isTypePayload(payload)) {
      await this.page.keyboard.type(payload.type)
    }
    if (isPressPayload(payload)) {
      await this.page.keyboard.press(payload.press)
    }
    if (isDownPayload(payload)) {
      await this.page.keyboard.down(payload.down)
    }
    if (isUpPayload(payload)) {
      await this.page.keyboard.up(payload.up)
    }
  }

  /**
   * Handle sendMouse command.
   */
  protected async handleSendMouse(payload: SendMousePayload) {
    switch (payload.type) {
      case 'move':
        if (payload.position) {
          await this.page.mouse.move(payload.position[0], payload.position[1])
        }
        break
      case 'down':
        await this.page.mouse.down({ button: payload.button, clickCount: payload.clickCount })
        break
      case 'up':
        await this.page.mouse.up({ button: payload.button, clickCount: payload.clickCount })
        break
      case 'click':
        if (payload.position) {
          await this.page.mouse.click(payload.position[0], payload.position[1], {
            button: payload.button,
            clickCount: payload.clickCount,
          })
        }
        break
      default:
        throw new Error(`Unknown sendMouse type: ${payload.type}`)
    }
  }

  /**
   * Handle resetMouse command.
   */
  protected async handleResetMouse() {
    await this.page.mouse.move(0, 0)
    await this.page.mouse.up()
  }

  /**
   * Handle selectOption command.
   */
  protected async handleSelectOption(payload: SelectOptionPayload) {
    await this.page.selectOption(payload.selector, payload.value)
  }

  protected async handleLocator(payload: LocatorActionPayload) {
    const { action, query, args } = payload
    // before performing any action, we need to obtain the locator.
    const locator = this.getLocator(query)
    switch (action) {
      case 'blur':
        await locator.blur(args as BlurOptions)
        break
      case 'clear':
        await locator.clear(args as ClearOptions)
        break
      case 'check':
        await locator.check(args as CheckOptions)
        break
      case 'click':
        await locator.click(args as ClickOptions)
        break
      case 'fill':
        {
          const payload = args as { text: string; options?: FillOptions }
          await locator.fill(payload.text, payload.options as FillOptions)
        }
        break
      case 'dblclick':
        await locator.dblclick(args as DoubleClickOptions)
        break
      case 'hover':
        await locator.hover(args as HoverOptions)
        break
      case 'press':
        {
          const payload = args as { key: string; options?: PressOptions }
          await locator.press(payload.key, payload.options as PressOptions)
        }
        break
      case 'tap':
        await locator.tap(args as TapOptions)
        break
      case 'uncheck':
        await locator.uncheck(args as UncheckOptions)
        break
      case 'dragTo':
        {
          const payload = args as { targetQuery: LocatorQuery; options?: DragToOptions }
          const targetLocator = this.getLocator(payload.targetQuery)
          await locator.dragTo(targetLocator, payload.options)
        }
        break
      default:
        throw new Error(`Unknown locator action: ${action}`)
    }
  }

  private getLocator(query: LocatorQuery): Locator {
    if (isQueryByRole(query)) {
      return this.page.getByRole(query.role as any)
    }
    if (isQueryByText(query)) {
      return this.page.getByText(query.text)
    }
    if (isQueryByLabel(query)) {
      return this.page.getByLabel(query.label)
    }
    if (isQueryByPlaceholder(query)) {
      return this.page.getByPlaceholder(query.placeholder)
    }
    if (isQueryByAltText(query)) {
      return this.page.getByAltText(query.altText)
    }
    if (isQueryByTitle(query)) {
      return this.page.getByTitle(query.title)
    }
    if (isQueryByTestId(query)) {
      return this.page.getByTestId(query.testId)
    }
    if (isQueryByCss(query)) {
      return this.page.locator('css=' + query.css)
    }
    if (isQueryByXPath(query)) {
      return this.page.locator('xpath=' + query.xpath)
    }

    throw new Error(`Unknown locator query: ${JSON.stringify(query)}`)
  }
}

function isQueryByRole(query: LocatorQuery): query is QueryByRole {
  return 'role' in query
}

function isQueryByText(query: LocatorQuery): query is QueryByText {
  return 'text' in query
}

function isQueryByLabel(query: LocatorQuery): query is QueryByLabel {
  return 'label' in query
}

function isQueryByPlaceholder(query: LocatorQuery): query is QueryByPlaceholder {
  return 'placeholder' in query
}

function isQueryByAltText(query: LocatorQuery): query is QueryByAltText {
  return 'altText' in query
}

function isQueryByTitle(query: LocatorQuery): query is QueryByTitle {
  return 'title' in query
}

function isQueryByTestId(query: LocatorQuery): query is QueryByTestId {
  return 'testId' in query
}

function isQueryByCss(query: LocatorQuery): query is QueryByCss {
  return 'css' in query
}

function isQueryByXPath(query: LocatorQuery): query is QueryByXPath {
  return 'xpath' in query
}
