import { executeCommand } from './execute_command.js'

/**
 * Options for pressing a keyboard key.
 */
export interface KeyboardPressOptions {
  /**
   * Time to wait between keydown and keyup in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for typing text.
 */
export interface KeyboardTypeOptions {
  /**
   * Time to wait between key presses in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Controls keyboard interactions natively within the browser context.
 * It uses RPC calls to interact with Playwright's Keyboard object.
 *
 * @use when
 * - Testing complex keyboard-driven user flows, native shortcuts, input events,
 *   or modifier-key combinations (e.g. Shift, Control, Alt).
 *
 * @dont use when
 * - Filling simple forms or text fields. Instead, use locators (e.g., `query().type(...)` or `query().fill(...)`)
 *   which are much more resilient and perform auto-actionability checks.
 *
 * Keyboard provides an api for managing a virtual keyboard. The high level api is `keyboard.type()`,
 * which takes raw characters and generates proper keydown, keypress/input, and keyup events on your page.
 *
 * For finer control, you can use `keyboard.down()`, `keyboard.up()`, and `keyboard.insertText()`
 * to manually fire events as if they were generated from a real keyboard.
 *
 * An example of holding down Shift in order to select and delete some text:
 * @example
 * ```typescript
 * import { keyboard } from '@pawel-up/lupa/commands'
 *
 * await keyboard.type('Hello World!');
 * await keyboard.press('ArrowLeft');
 *
 * await keyboard.down('Shift');
 * for (let i = 0; i < ' World'.length; i++) {
 *  await keyboard.press('ArrowLeft');
 * }
 * await keyboard.up('Shift')
 * await keyboard.press('Backspace')
 * // Result text will end up saying 'Hello!'
 * ```
 *
 * An example of pressing uppercase 'A' key:
 * @example
 * ```typescript
 * import { keyboard } from '@pawel-up/lupa/commands'
 *
 * await keyboard.press('Shift+KeyA');
 * // or
 * await keyboard.press('Shift+A');
 * ```
 *
 * An example to trigger select-all with the keyboard:
 * @example
 * ```typescript
 * import { keyboard } from '@pawel-up/lupa/commands'
 *
 * await keyboard.press('ControlOrMeta+A')
 * ```
 */
export class Keyboard {
  /**
   * Dispatches a `keydown` event.
   *
   * The `key` parameter can specify the intended [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)
   * value or a single character to generate the text for. A superset of the key values can be found
   * [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values).
   *
   * Examples of the keys are: `F1` - `F12`, `Digit0` - `Digit9`, `KeyA` - `KeyZ`, `Backquote`, `Minus`, `Equal`,
   * `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`,
   * `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.
   *
   * Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`,
   * `ControlOrMeta`. `ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.
   *
   * Holding down `Shift` will type the text that corresponds to the key in the upper case.
   *
   * If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different
   * respective texts.
   *
   * If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent
   * with that modifier active. To release the modifier key, use `keyboard.up()`.
   *
   * After the key is pressed once, subsequent calls to `keyboard.down()` will have `repeat` set to `true`.
   * To release the key, use `keyboard.up()`.
   *
   * @example
   * ```typescript
   * import { keyboard } from '@pawel-up/lupa/commands'
   *
   * await keyboard.down('Shift')
   * ```
   *
   * @param key - Name of the key to press down, such as `Control` or `ArrowLeft`.
   * @returns A promise that resolves when the keydown event is dispatched.
   */
  async down(key: string): Promise<void> {
    await executeCommand('keyboard', { action: 'down', key })
  }

  /**
   * Dispatches only an `input` event, without emitting `keydown`, `keypress` or `keyup` events.
   *
   * @example
   * ```typescript
   * import { keyboard } from '@pawel-up/lupa/commands'
   *
   * await keyboard.insertText('嗨')
   * ```
   *
   * @param text - The text to insert.
   * @returns A promise that resolves when the text is inserted.
   */
  async insertText(text: string): Promise<void> {
    await executeCommand('keyboard', { action: 'insertText', text })
  }

  /**
   * Dispatches `keydown`, `keyup`, and `keypress/input` events for a single key or modifier shortcut.
   *
   * `key` can specify the intended `keyboardEvent.key` value or a single character to generate the text
   * for. A superset of the key values can be found at
   * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
   *
   * Examples of the keys are: `F1` - `F12`, `Digit0` - `Digit9`, `KeyA` - `KeyZ`, `Backquote`, `Minus`, `Equal`,
   * `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`,
   * `PageUp`, `ArrowRight`, `ArrowUp`, etc.
   *
   * Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`,
   * `ControlOrMeta`. `ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.
   *
   * Holding down `Shift` will type the text that corresponds to the key in the upper case.
   *
   * If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate
   * different respective texts.
   *
   * Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as
   * well. When specified with the modifier, modifier is pressed and being held while the subsequent key
   * is being pressed.
   *
   * @example
   * ```typescript
   * import { keyboard } from '@pawel-up/lupa/commands'
   *
   * await keyboard.press('Backspace')
   * await keyboard.press('Control+A')
   * ```
   *
   * @remarks Shortcut for `keyboard.down()` and `keyboard.up()`.
   *
   * @param key - Name of the key or shortcut to press, such as `ArrowDown` or `Shift+a`.
   * @param options - Additional settings to control the key press.
   * @returns A promise that resolves when the key press is completed.
   */
  async press(key: string, options?: KeyboardPressOptions): Promise<void> {
    await executeCommand('keyboard', { action: 'press', key, options })
  }

  /**
   * Types the text into the focused element, emitting `keydown`, `keypress/input`, and `keyup` events
   * for each character.
   *
   * @remarks
   * In most cases, you should use `query(...).fill()` instead. You only need to press keys one by one if
   * there is special keyboard handling on the page - in this case use `query(...).pressSequentially()`.
   *
   * Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not type the text in upper
   * case.
   *
   * For characters that are not on a US keyboard, only an `input` event will be sent.
   *
   * @example
   * ```typescript
   * import { keyboard } from '@pawel-up/lupa/commands'
   *
   * await keyboard.type('Hello World', { delay: 50 })
   * ```
   *
   * @param text - The text to type.
   * @param options - Additional settings to control the typing speed.
   * @returns A promise that resolves when typing is completed.
   */
  async type(text: string, options?: KeyboardTypeOptions): Promise<void> {
    await executeCommand('keyboard', { action: 'type', text, options })
  }

  /**
   * Dispatches a keyup event.
   *
   * @example
   * ```typescript
   * import { keyboard } from '@pawel-up/lupa/commands'
   *
   * await keyboard.up('Shift')
   * ```
   *
   * @param key - Name of the key to release, such as `Shift` or `Control`.
   * @returns A promise that resolves when the keyup event is dispatched.
   */
  async up(key: string): Promise<void> {
    await executeCommand('keyboard', { action: 'up', key })
  }
}

export const keyboard = new Keyboard()
