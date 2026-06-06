import type { Locator, Page, Disposable, FileChooser } from 'playwright'
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
  SelectOptionValues,
  SelectOptionOptions,
  PressSequentiallyOptions,
  ElementScreenshotOptions,
  SetInputFilesOptions,
} from './locator.js'
import type { PageScreenshotOptions } from './screenshot.js'
import type { Geolocation, GrantPermissionsOptions } from './emulation.js'
import type { FileChooserSetFilesOptions } from './file_chooser.js'
import debuglog from '../runner/debug.js'
import { NetworkCommand } from '../network/network_command.js'
import { registry } from '../module-mock/registry.js'

export interface EmulatePayload {
  action: 'setViewport' | 'emulateMedia' | 'setGeolocation' | 'grantPermissions' | 'clearPermissions' | 'setOffline'
  viewport?: Viewport
  media?: Media
  geolocation?: Geolocation
  permissions?: string[]
  permissionOptions?: GrantPermissionsOptions
  offline?: boolean
}

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

interface KeyboardActionPayload {
  action: 'down' | 'insertText' | 'press' | 'type' | 'up'
  key?: string
  text?: string
  options?: { delay?: number }
}

/**
 * A class that handles the RPC calls from the browser to the runner.
 */
export class CommandsHandler {
  protected page: Page
  private closeHandler?: Disposable
  private network: NetworkCommand
  private activeFileChoosers = new Map<string, FileChooser>()

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
          case 'mouse':
            await this.handleMouse(payload)
            break
          case 'keyboard':
            await this.handleKeyboard(payload as KeyboardActionPayload)
            break
          case 'screenshot':
            await this.handleScreenshot(payload)
            break
          case 'emulate':
            await this.handleEmulate(payload as EmulatePayload)
            break

          case 'selectOption':
            await this.handleSelectOption(payload)
            break
          case 'locator':
            return await this.handleLocator(payload)
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
          case 'network:setOffline':
            await this.page.context().setOffline(payload)
            break
          case 'cookies:add':
            await this.page.context().addCookies(payload.cookies)
            break
          case 'cookies:getAll':
            return await this.page.context().cookies(payload.urls)
          case 'cookies:clear':
            await this.page.context().clearCookies(payload.options)
            break
          case 'fileChooser:waitForEvent':
            return await this.handleFileChooserWaitForEvent(payload)
          case 'fileChooser:setFiles':
            await this.handleFileChooserSetFiles(payload)
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
    this.activeFileChoosers.clear()
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
   * Handle emulate command.
   */
  protected async handleEmulate(payload: EmulatePayload) {
    switch (payload.action) {
      case 'setViewport':
        if (payload.viewport) {
          await this.page.setViewportSize(payload.viewport)
        }
        break
      case 'emulateMedia':
        if (payload.media) {
          await this.page.emulateMedia(payload.media)
        }
        break
      case 'setGeolocation':
        if (payload.geolocation) {
          await this.page.context().setGeolocation(payload.geolocation)
        } else {
          await this.page.context().setGeolocation(null)
        }
        break
      case 'grantPermissions':
        if (payload.permissions) {
          await this.page.context().grantPermissions(payload.permissions, payload.permissionOptions)
        }
        break
      case 'clearPermissions':
        await this.page.context().clearPermissions()
        break
      case 'setOffline':
        if (payload.offline !== undefined) {
          await this.page.context().setOffline(payload.offline)
        }
        break
      default:
        throw new Error(`Unknown emulation action: ${(payload as any).action}`)
    }
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
   * Handle mouse command gestures.
   */
  protected async handleMouse(payload: any) {
    const action = payload.action
    const options = payload.options

    switch (action) {
      case 'reset':
        await this.page.mouse.move(0, 0)
        await this.page.mouse.up()
        break

      case 'move':
        if (options?.button) {
          await this.page.mouse.down({ button: options.button })
        }
        await this.page.mouse.move(payload.x, payload.y, { steps: options?.steps })
        if (options?.button) {
          await this.page.mouse.up({ button: options.button })
        }
        break

      case 'moveBetween':
        await this.page.mouse.move(payload.fromX, payload.fromY)
        if (options?.button) {
          await this.page.mouse.down({ button: options.button })
        }
        await this.page.mouse.move(payload.toX, payload.toY, { steps: options?.steps })
        if (options?.button) {
          await this.page.mouse.up({ button: options.button })
        }
        break

      case 'down':
        await this.page.mouse.down({ button: options?.button, clickCount: options?.clickCount })
        break

      case 'up':
        await this.page.mouse.up({ button: options?.button, clickCount: options?.clickCount })
        break

      case 'click':
        await this.page.mouse.click(payload.x, payload.y, {
          button: options?.button,
          clickCount: options?.clickCount,
          delay: options?.delay,
        })
        break

      case 'dblclick':
        await this.page.mouse.dblclick(payload.x, payload.y, {
          button: options?.button,
          delay: options?.delay,
        })
        break

      case 'press': {
        const keys = options?.key ? options.key.split('+') : []
        for (const k of keys) {
          await this.page.keyboard.down(k)
        }
        await this.page.mouse.move(payload.x, payload.y)
        await this.page.mouse.down({ button: options?.button })
        if (options?.delay && options.delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, options.delay))
        }
        await this.page.mouse.up({ button: options?.button })
        for (const k of [...keys].reverse()) {
          await this.page.keyboard.up(k)
        }
        break
      }

      default:
        throw new Error(`Unknown mouse action: ${action}`)
    }
  }

  /**
   * Handle keyboard command.
   */
  protected async handleKeyboard(payload: KeyboardActionPayload): Promise<void> {
    const { action, key, text, options } = payload
    switch (action) {
      case 'down':
        if (key) {
          await this.page.keyboard.down(key)
        }
        break
      case 'insertText':
        if (text) {
          await this.page.keyboard.insertText(text)
        }
        break
      case 'press':
        if (key) {
          await this.page.keyboard.press(key, options)
        }
        break
      case 'type':
        if (text) {
          await this.page.keyboard.type(text, options)
        }
        break
      case 'up':
        if (key) {
          await this.page.keyboard.up(key)
        }
        break
      default:
        throw new Error(`Unsupported keyboard action: ${action}`)
    }
  }

  /**
   * Handle screenshot command.
   */
  protected async handleScreenshot(payload: { action: 'take'; options: PageScreenshotOptions }): Promise<void> {
    const { action, options } = payload
    if (action === 'take') {
      await this.page.screenshot(options)
    } else {
      throw new Error(`Unsupported screenshot action: ${action}`)
    }
  }

  /**
   * Handle selectOption command.
   */
  protected async handleSelectOption(payload: SelectOptionPayload): Promise<void> {
    await this.page.selectOption(payload.selector, payload.value)
  }

  protected async handleLocator(payload: LocatorActionPayload): Promise<unknown> {
    const { action, query, args } = payload
    // before performing any action, we need to obtain the locator.
    const locator = this.getLocator(query)
    switch (action) {
      case 'blur':
        return await locator.blur(args as BlurOptions)
      case 'clear':
        return await locator.clear(args as ClearOptions)
      case 'check':
        return await locator.check(args as CheckOptions)
      case 'click':
        return await locator.click(args as ClickOptions)
      case 'fill': {
        const payload = args as { text: string; options?: FillOptions }
        return await locator.fill(payload.text, payload.options as FillOptions)
      }
      case 'dblclick':
        return await locator.dblclick(args as DoubleClickOptions)
      case 'hover':
        return await locator.hover(args as HoverOptions)
      case 'press': {
        const payload = args as { key: string; options?: PressOptions }
        return await locator.press(payload.key, payload.options as PressOptions)
      }
      case 'pressSequentially': {
        const payload = args as { text: string; options?: PressSequentiallyOptions }
        return await locator.pressSequentially(payload.text, payload.options)
      }
      case 'tap':
        return await locator.tap(args as TapOptions)
      case 'uncheck':
        return await locator.uncheck(args as UncheckOptions)
      case 'dragTo': {
        const payload = args as { targetQuery: LocatorQuery; options?: DragToOptions }
        const targetLocator = this.getLocator(payload.targetQuery)
        return await locator.dragTo(targetLocator, payload.options)
      }
      case 'selectOption': {
        const selectPayload = args as { values: SelectOptionValues; options?: SelectOptionOptions }
        return await locator.selectOption(
          selectPayload.values as Parameters<typeof locator.selectOption>[0],
          selectPayload.options
        )
      }
      case 'screenshot': {
        await locator.screenshot(args as ElementScreenshotOptions)
        return
      }
      case 'setInputFiles': {
        const payload = args as { files: string | string[]; options?: SetInputFilesOptions }
        return await locator.setInputFiles(payload.files, payload.options)
      }
      default:
        throw new Error(`Unknown lupa command: ${action}`)
    }
  }

  /**
   * Handle fileChooser:waitForEvent command.
   */
  protected async handleFileChooserWaitForEvent(options?: {
    timeout?: number
  }): Promise<{ id: string; isMultiple: boolean }> {
    const fileChooser = await this.page.waitForEvent('filechooser', options)
    const id = Math.random().toString(36).substring(2)
    this.activeFileChoosers.set(id, fileChooser)
    return {
      id,
      isMultiple: fileChooser.isMultiple(),
    }
  }

  /**
   * Handle fileChooser:setFiles command.
   */
  protected async handleFileChooserSetFiles(payload: {
    id: string
    files: string | string[]
    options?: FileChooserSetFilesOptions
  }): Promise<void> {
    const fileChooser = this.activeFileChoosers.get(payload.id)
    if (!fileChooser) {
      throw new Error(`No active file chooser found with ID: ${payload.id}`)
    }
    this.activeFileChoosers.delete(payload.id)
    await fileChooser.setFiles(payload.files, payload.options)
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
