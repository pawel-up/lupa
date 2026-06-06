import { executeCommand } from './execute_command.js'
import type { Media, SelectOptionPayload, SendKeysPayload, SendMousePayload, Viewport } from './types.js'

export { Media, SelectOptionPayload, SendKeysPayload, SendMousePayload, Viewport }

export {
  query,
  type BlurOptions,
  type ClearOptions,
  type ClickOptions,
  type CheckOptions,
  type FillOptions,
  type TypeOptions,
  type PressSequentiallyOptions,
  type DoubleClickOptions,
  type HoverOptions,
  type PressOptions,
  type TapOptions,
  type UncheckOptions,
  type DragToOptions,
  type LocatorQuery,
  type SelectOptionValue,
  type SelectOptionValues,
  type SelectOptionOptions,
  type ElementScreenshotOptions,
  type SetInputFilesOptions,
} from './locator.js'

/**
 * Sets the viewport size of the browser.
 *
 * @example
 * ```ts
 *    await setViewport({
 *        width: 1024,
 *        height: 768,
 *    })
 * ```
 *
 * @param viewport - The viewport size.
 * @returns A promise that resolves when the viewport size is set.
 * @deprecated Use the `emulation` instance instead (e.g., `await emulation.setViewport(...)`).
 */
export function setViewport(viewport: Viewport): Promise<void> {
  return executeCommand('setViewport', viewport)
}

/**
 * Emulates browser media, such as screen/print or color scheme, to be used in
 * CSS media queries.
 *
 * Note that the `forcedColors` option does not work in WebKit.
 *
 * @example
 * ```ts
 *    await emulateMedia({
 *        colorScheme: 'dark',
 *        reducedMotion: 'reduce',
 *    })
 * ```
 *
 * @example
 * ```ts
 *    await emulateMedia({
 *        media: 'print',
 *    })
 * ```
 *
 * @example
 * ```ts
 *    await emulateMedia({
 *        forcedColors: 'active',
 *    })
 * ```
 *
 * @param media - The media features to emulate.
 * @returns A promise that resolves when the media features are emulated.
 * @deprecated Use the `emulation` instance instead (e.g., `await emulation.emulateMedia(...)`).
 */
export function emulateMedia(media: Media): Promise<void> {
  return executeCommand('emulateMedia', media)
}

/**
 * Sends a string of keys for the browser to press (all at once, as with single keys
 * or shortcuts; e.g. `{press: 'Tab'}` or `{press: 'Shift+a'}` or
 * `{press: 'Option+ArrowUp}`) or type (in sequence, e.g. `{type: 'Your name'}`) natively.
 *
 * For specific documentation of the strings to leverage here, see the Playwright documentation:
 *
 * - `press`: https://playwright.dev/docs/api/class-keyboard#keyboardpresskey-options
 * - `type`: https://playwright.dev/docs/api/class-keyboard#keyboardtypetext-options
 *
 * @param payload An object including a `press` or `type` property an the associated string
 *     for the browser runner to apply via that input method.
 *
 * @example
 * ```ts
 *    await sendKeys({
 *        press: 'Tab',
 *    })
 * ```
 *
 * @example
 * ```ts
 *    await sendKeys({
 *        type: 'Your address',
 *    })
 * ```
 *
 * @param payload - The keys to send.
 * @returns A promise that resolves when the keys are sent.
 * @deprecated Use the `keyboard` instance instead (e.g., `await keyboard.type(...)`).
 */
export function sendKeys(payload: SendKeysPayload): Promise<void> {
  return executeCommand('sendKeys', payload)
}

export { keyboard, Keyboard, type KeyboardPressOptions, type KeyboardTypeOptions } from './keyboard.js'

export { screenshot, Screenshot, type PageScreenshotOptions } from './screenshot.js'
export { emulation, Emulation, type Geolocation, type GrantPermissionsOptions } from './emulation.js'
export { cookies, Cookies } from './cookies.js'
export { type Cookie, type ClearCookiesOptions } from './types.js'
export { fileChooser, FileChooser, type FileChooserSetFilesOptions } from './file_chooser.js'

export {
  mouse,
  Mouse,
  type Point,
  type MouseMoveOptions,
  type MouseClickOptions,
  type MouseDblClickOptions,
  type MousePressOptions,
  type MouseDownOptions,
  type MouseUpOptions,
} from './mouse.js'

/**
 * Sends an action for the mouse to move it to a specific position or click a mouse button (left, middle, or right).
 *
 * WARNING: When moving the mouse or holding down a mouse button, the mouse stays in this state as long as
 * you do not explicitly move it to another position or release the button. For this reason, it is recommended
 * to reset the mouse state with the `resetMouse` command after each test case manipulating the mouse to avoid
 * unexpected side effects.
 *
 * @param payload An object representing a mouse action specified by the `type` property (move, click, down, up)
 *     and including some properties to configure this action.
 *
 * @example
 * ```ts
 *    await sendMouse({
 *        type: 'move',
 *        position: [100, 100]
 *    })
 * ```
 *
 * @example
 * ```ts
 *    await sendMouse({
 *        type: 'click',
 *        position: [100, 100],
 *        button: 'right'
 *    })
 * ```
 *
 * @example
 * ```ts
 *    await sendMouse({
 *        type: 'down'
 *    })
 * ```
 *
 * @param payload - The mouse events to send.
 * @returns A promise that resolves when the mouse events are sent.
 * @deprecated Use the `mouse` instance instead (e.g., `await mouse.move(...)`).
 */
export function sendMouse(payload: SendMousePayload): Promise<void> {
  return executeCommand('sendMouse', payload)
}

/**
 * Resets the mouse position to (0, 0) and releases mouse buttons.
 *
 * Use this command to reset the mouse state after mouse manipulations by the `sendMouse` command.
 *
 * @example
 * ```
 * it('does something with the mouse', () => {
 *   await sendMouse({ type: 'move', position: [150, 150] })
 *   await sendMouse({ type: 'down', button: 'middle' })
 * })
 *
 * afterEach(() => {
 *   await resetMouse()
 * })
 * ```
 *
 * @returns A promise that resolves when the mouse state is reset.
 * @deprecated Use the `mouse` instance instead (`await mouse.reset()`).
 */
export function resetMouse(): Promise<void> {
  return executeCommand('resetMouse')
}

/**
 * Selects an option in a <select> element by value or label
 *
 * @example
 * ```
 * it('natively selects an option by value', async () => {
 *  const valueToSelect = 'first'
 *  const select = document.querySelector('#testSelect')
 *
 *  await selectOption({ selector: '#testSelect', value: valueToSelect })
 *
 *  expect(select.value).to.equal(valueToSelect)
 *})
 *```
 *
 * @param payload - The option to select.
 * @returns A promise that resolves when the option is selected.
 * @deprecated Use `query(...).selectOption(...)` instead.
 */
export function selectOption(payload: SelectOptionPayload): Promise<void> {
  return executeCommand('selectOption', payload)
}
