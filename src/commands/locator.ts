import { executeCommand } from './execute_command.js'

/**
 * The role locator reflects how users and assistive technology perceive the page,
 * for example whether some element is a button or a checkbox.
 * When locating by role, you should usually pass the accessible name as well,
 * so that the locator pinpoints the exact element.
 */
export interface QueryByRole {
  /**
   * The role to use to locate the element. Only values from the [WAI-ARIA
   * Roles list](https://www.w3.org/TR/wai-aria-1.2/#roles) are allowed.
   */
  role: string
}

/**
 * Most form controls usually have dedicated labels that could be conveniently used
 * to interact with the form. In this case, you can locate the control by its associated label
 * using the `label` locator strategy.
 */
export interface QueryByLabel {
  /**
   * The accessible name to use to locate the element. This should be the text content of the label.
   */
  label: string
}

/**
 * Inputs may have a placeholder attribute to hint to the user what value should be entered.
 * You can locate such an input using the `placeholder` locator strategy.
 */
export interface QueryByPlaceholder {
  /**
   * The placeholder text to use to locate the element. This should be the text content of the placeholder.
   */
  placeholder: string
}

/**
 * Find an element by the text it contains. You can match by a substring,
 * exact string, or a regular expression when using the `text` locator strategy.
 */
export interface QueryByText {
  /**
   * The text to use to locate the element.
   */
  text: string
}

/**
 * All images should have an alt attribute that describes the image.
 * You can locate an image based on the text alternative using the `altText` locator strategy.
 */
export interface QueryByAltText {
  /**
   * The alt text to use to locate the element. This should be the text content of the alt attribute.
   */
  altText: string
}

/**
 * Locate an element with a matching title attribute using the `title` locator strategy.
 */
export interface QueryByTitle {
  /**
   * The title text to use to locate the element. This should be the text content of the title attribute.
   */
  title: string
}

/**
 * Use this locator to find elements by their data-testid attribute.
 */
export interface QueryByTestId {
  /**
   * The test id to use to locate the element. This should be the text content of the test id attribute.
   */
  testId: string
}

/**
 * Use this locator to find elements by their CSS selector.
 */
export interface QueryByCss {
  /**
   * The CSS selector to use to locate the element.
   */
  css: string
}

/**
 * Use this locator to find elements by their XPath.
 */
export interface QueryByXPath {
  /**
   * The XPath to use to locate the element.
   */
  xpath: string
}

/**
 * Set of supported locator queries.
 */
export type LocatorQuery =
  | QueryByRole
  | QueryByText
  | QueryByLabel
  | QueryByPlaceholder
  | QueryByText
  | QueryByAltText
  | QueryByTitle
  | QueryByTestId
  | QueryByCss
  | QueryByXPath

/**
 * Set of supported locator actions.
 */
export type SupportedLocatorAction =
  | 'blur'
  | 'clear'
  | 'check'
  | 'click'
  | 'dblclick'
  | 'fill'
  | 'hover'
  | 'press'
  | 'tap'
  | 'uncheck'
  | 'dragTo'
  | 'selectOption'

/**
 * Payload for locator actions.
 * Used internally by the runner to execute locator actions.
 */
export interface LocatorActionPayload {
  /**
   * The action to perform on the element.
   */
  action: SupportedLocatorAction
  /**
   * The query to use to locate the element.
   */
  query: LocatorQuery
  /**
   * Additional arguments for the action.
   */
  args?: unknown
}

/**
 * Options that can be passed to locator actions.
 */
export interface TimeoutOption {
  /**
   * Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout`
   * option in the config, or by using the
   * [browserContext.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-default-timeout)
   * or [page.setDefaultTimeout(timeout)](https://playwright.dev/docs/api/class-page#page-set-default-timeout) methods.
   */
  timeout?: number
}

/**
 * Options that can be passed to locator actions.
 */
export interface ForceOption {
  /**
   * Whether to bypass the [actionability](https://playwright.dev/docs/actionability) checks. Defaults to `false`.
   */
  force?: boolean
}

/**
 * Options that can be passed to locator actions.
 */
export interface StrictOption {
  /**
   * When true, the call requires selector to resolve to a single element. If given selector resolves to more than one
   * element, the call throws an exception.
   */
  strict?: boolean
}

/**
 * Options that can be passed to locator actions.
 */
export interface TrialOption {
  /**
   * When set, this method only performs the [actionability](https://playwright.dev/docs/actionability) checks and skips the action. Defaults
   * to `false`. Useful to wait until the element is ready for the action without performing it.
   */
  trial?: boolean
}

/**
 * Options that can be passed to locator actions.
 */
export interface ModifiersOption {
  /**
   * Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores
   * current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to
   * "Control" on Windows and Linux and to "Meta" on macOS.
   */
  modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[]
}

/**
 * Options that can be passed to locator actions.
 */
export interface PositionOption {
  /**
   * A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of
   * the element.
   */
  position?: {
    /**
     * X coordinate
     */
    x: number

    /**
     * Y coordinate
     */
    y: number
  }
}

/**
 * Options for the blur action.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BlurOptions extends TimeoutOption {}

/**
 * Options for the clear action.
 */
export interface ClearOptions extends TimeoutOption, ForceOption {}

export interface ClickOptions
  extends TimeoutOption, ForceOption, StrictOption, TrialOption, ModifiersOption, PositionOption {
  /**
   * Defaults to `left`.
   */
  button?: 'left' | 'right' | 'middle'

  /**
   * defaults to 1. See [UIEvent.detail].
   */
  clickCount?: number

  /**
   * Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for the check action.
 */
export interface CheckOptions extends TimeoutOption, ForceOption, StrictOption, TrialOption, PositionOption {}

/**
 * Options for the fill action.
 */
export interface FillOptions extends TimeoutOption, ForceOption, StrictOption {}

/**
 * Options for the type action.
 */
export interface TypeOptions extends TimeoutOption, ForceOption, ModifiersOption {
  /**
   * Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for the double click action.
 */
export interface DoubleClickOptions extends TimeoutOption, ForceOption, TrialOption, ModifiersOption, PositionOption {
  /**
   * Defaults to `left`.
   */
  button?: 'left' | 'right' | 'middle'

  /**
   * Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
   */
  delay?: number

  /**
   * Defaults to 1. Sends `n` interpolated `mousemove` events to represent travel between Playwright's current cursor
   * position and the provided destination. When set to 1, emits a single `mousemove` event at the destination location.
   */
  steps?: number
}

/**
 * Options for the hover action.
 */
export interface HoverOptions extends TimeoutOption, ForceOption, TrialOption, ModifiersOption, PositionOption {}

/**
 * Options for the press action.
 */
export interface PressOptions extends TimeoutOption {
  /**
   * Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for the tap action.
 */
export interface TapOptions extends TimeoutOption, ForceOption, TrialOption, ModifiersOption, PositionOption {}

/**
 * Options for the uncheck action.
 */
export interface UncheckOptions extends TimeoutOption, ForceOption, TrialOption, PositionOption {}

/**
 * Options for the dragTo action.
 */
export interface DragToOptions extends TimeoutOption, ForceOption, TrialOption {
  /**
   * Actions that perform navigations are waiting for the navigations to happen and for the pages to start loading. You
   * can opt out of waiting via setting this option to `true`. You would only need this option in the exceptional cases
   * such as navigating to inaccessible pages. Defaults to `false`.
   */
  noWaitAfter?: boolean

  /**
   * A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of
   * the element.
   */
  sourcePosition?: {
    /**
     * X coordinate
     */
    x: number

    /**
     * Y coordinate
     */
    y: number
  }

  /**
   * A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of
   * the element.
   */
  targetPosition?: {
    /**
     * X coordinate
     */
    x: number

    /**
     * Y coordinate
     */
    y: number
  }
}

/**
 * Representation of option selection values for matching options.
 */
export type SelectOptionValue = string | { value?: string; label?: string; index?: number }

/**
 * Values to select in the element. Can be a single value, an array of values, or null.
 */
export type SelectOptionValues = SelectOptionValue | SelectOptionValue[] | null

/**
 * Options for the selectOption action.
 */
export interface SelectOptionOptions extends TimeoutOption, ForceOption {
  /**
   * Deprecated. Playwright has deprecated this option and it has no effect.
   */
  noWaitAfter?: boolean
}

/**
 * Creates a locator that can execute multiple actions like click, type, etc.
 * It interacts with the Playwright's Page object, but via RPC calls.
 *
 * @example Clicking on a button with text "Submit".
 * ```typescript
 * import { query } from '@pawel-up/lupa/commands'
 *
 * await query({ text: 'Submit' }).click()
 * ```
 *
 * @example Checking a checkbox with label "Subscribe".
 * ```typescript
 * import { query } from '@pawel-up/lupa/commands'
 *
 * await query({ label: 'Subscribe' }).check()
 * ```
 *
 * @example Filling a text input with "admin" username.
 * ```typescript
 * import { query } from '@pawel-up/lupa/commands'
 *
 * await query({ placeholder: 'Username' }).fill('admin')
 * ```
 *
 * @param query - The query to use to locate the element.
 * @returns A locator.
 */
export function query(query: LocatorQuery): Locator {
  return new Locator(query)
}

/**
 * A bridge to Playwright's Locator object, used to locate elements on the page
 * and execute actions on them. It uses RPC calls to interact with the Playwright's Page object.
 *
 * Not all Playwright's Locator actions are supported. Only actions that are relevant to testing
 * are implemented.
 */
export class Locator {
  /**
   * Creates a locator.
   *
   * @param query - The query to use to locate the element.
   * @returns A locator.
   */
  constructor(protected query: LocatorQuery) {}

  protected async executeAction<R = void>(action: SupportedLocatorAction, args?: unknown): Promise<R> {
    return await executeCommand<R>('locator', { action, query: this.query, args })
  }

  /**
   * Calls blur on the element.
   *
   * @example Calling blur on the focused element.
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Focus me' }).blur()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the blur action is completed.
   */
  async blur(options?: BlurOptions): Promise<void> {
    await this.executeAction('blur', options)
  }

  /**
   * Clear the input field.
   *
   * @example Clearing the input field.
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ label: 'Email' }).clear()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the clear action is completed.
   */
  async clear(options?: ClearOptions): Promise<void> {
    await this.executeAction('clear', options)
  }

  /**
   * Ensure that checkbox or radio element is checked.
   *
   * @example Checking a checkbox.
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ label: 'Subscribe' }).check()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the check action is completed.
   */
  async check(options?: CheckOptions): Promise<void> {
    await this.executeAction('check', options)
  }

  /**
   * Clicks on the element.
   *
   * @example Clicking on a button with text "Submit".
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Submit' }).click()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the click action is completed.
   */
  async click(options?: ClickOptions): Promise<void> {
    await this.executeAction('click', options)
  }

  /**
   * Fills the input field.
   *
   * @example Filling a text input with "admin" username.
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ placeholder: 'Username' }).fill('admin')
   * ```
   *
   * @param text - Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the fill action is completed.
   */
  async fill(text: string, options?: FillOptions): Promise<void> {
    await this.executeAction('fill', { text, options })
  }

  /**
   * Double clicks the element.
   *
   * @example Double clicking on a button with text "Submit".
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Submit' }).dblclick()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the double click action is completed.
   */
  async dblclick(options?: DoubleClickOptions): Promise<void> {
    await this.executeAction('dblclick', options)
  }

  /**
   * Hovers over the element.
   *
   * @example Hovering over an element with text "Submit".
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Submit' }).hover()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the hover action is completed.
   */
  async hover(options?: HoverOptions): Promise<void> {
    await this.executeAction('hover', options)
  }

  /**
   * Presses the given key.
   *
   * @example Pressing the "Enter" key.
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Submit' }).press('Enter')
   * ```
   *
   * @param key - The key to press.
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the press action is completed.
   */
  async press(key: string, options?: PressOptions): Promise<void> {
    await this.executeAction('press', { key, options })
  }

  /**
   * Taps the element.
   *
   * @example Tapping on an element with text "Submit".
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Submit' }).tap()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the tap action is completed.
   */
  async tap(options?: TapOptions): Promise<void> {
    await this.executeAction('tap', options)
  }

  /**
   * Ensure that checkbox or radio element is unchecked.
   *
   * @example Unchecking an element with text "Subscribe".
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ text: 'Subscribe' }).uncheck()
   * ```
   *
   * @param options - Optional settings to modify the action.
   * @returns A promise that resolves when the uncheck action is completed.
   */
  async uncheck(options?: UncheckOptions): Promise<void> {
    await this.executeAction('uncheck', options)
  }

  /**
   * Drags the element to another target element or locator query.
   *
   * @use when
   * - Performing a drag and drop interaction between two elements on the page (e.g., drag an item
   *   into a dropzone/trash bin).
   *
   * @dont use when
   * - You want to simulate file drag events from the operating system. In those cases, use browser-side
   *   helpers like `createFileDragEvent`.
   *
   * @example
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * await query({ testId: 'draggable-item' }).dragTo(query({ testId: 'trash-bin' }))
   * ```
   *
   * @param target - The target locator or locator query to drag to.
   * @param options - Optional settings to customize the drag-and-drop interaction.
   * @returns A promise that resolves when the drag action is completed.
   */
  async dragTo(target: Locator | LocatorQuery, options?: DragToOptions): Promise<void> {
    const targetQuery = target instanceof Locator ? target.query : target
    await this.executeAction('dragTo', { targetQuery, options })
  }

  /**
   * Selects one or multiple options in a `<select>` element.
   *
   * @use when
   * - Interacting with standard `<select>` dropdown controls in the UI.
   * - Setting selection on a single or multi-select HTML `<select>` element.
   *
   * @dont use when
   * - Interacting with custom UI select/dropdown component libraries (e.g. Material Select,
   *   custom divs/buttons dropdowns) that do not use native `<select>` and `<option>` elements.
   *   For those, click on the dropdown button and select options via standard click.
   *
   * @example Selecting single option by value
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * const selected = await query({ css: '#test-select' }).selectOption('2')
   * ```
   *
   * @example Selecting single option by label
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * const selected = await query({ css: '#test-select' }).selectOption({ label: 'Two' })
   * ```
   *
   * @example Selecting multiple options in a `<select multiple>` dropdown
   * ```typescript
   * import { query } from '@pawel-up/lupa/commands'
   *
   * const selected = await query({ css: '#multi-select' }).selectOption(['1', '3'])
   * ```
   *
   * @param values - Single value/object or array of values/objects to select.
   * @param options - Optional settings to control actionability checks or timeouts.
   * @returns A promise that resolves to an array of option values that were successfully selected.
   */
  async selectOption(values: SelectOptionValues, options?: SelectOptionOptions): Promise<string[]> {
    return await this.executeAction<string[]>('selectOption', { values, options })
  }
}
