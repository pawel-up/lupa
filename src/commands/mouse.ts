import { executeCommand } from './execute_command.js'

/**
 * Represents a point in 2D space, compatible with DOMPoint and DOMPointInit.
 */
export interface Point {
  /**
   * The X coordinate.
   */
  x: number

  /**
   * The Y coordinate.
   */
  y: number
}

/**
 * Options for moving the mouse.
 */
export interface MouseMoveOptions {
  /**
   * The mouse button pressed during movement.
   * If specified, the button is pressed down before moving and released after (i.e. dragging).
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * Number of intermediate steps to emit.
   */
  steps?: number
}

/**
 * Options for clicking a mouse button.
 */
export interface MouseClickOptions {
  /**
   * The button to click. Defaults to `left`.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * The number of clicks to perform. Defaults to 1.
   */
  clickCount?: number

  /**
   * Time to wait between mousedown and mouseup in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for double-clicking a mouse button.
 */
export interface MouseDblClickOptions {
  /**
   * The button to click. Defaults to `left`.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * Time to wait between mousedown and mouseup in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for pressing and holding a mouse button.
 */
export interface MousePressOptions {
  /**
   * The mouse button to press. Defaults to `left`.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * Optional keyboard key modifier to press down (e.g. 'Shift', 'Control', 'Alt', 'Meta') during the operation.
   */
  key?: string

  /**
   * Duration in milliseconds to hold the mouse button down before releasing. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for holding a mouse button down.
 */
export interface MouseDownOptions {
  /**
   * The button to press down. Defaults to `left`.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * The number of clicks. Defaults to 1.
   */
  clickCount?: number
}

/**
 * Options for releasing a mouse button.
 */
export interface MouseUpOptions {
  /**
   * The button to release. Defaults to `left`.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * The number of clicks. Defaults to 1.
   */
  clickCount?: number
}

/**
 * Controls mouse movements and button actions.
 * It uses RPC calls to interact with Playwright's Mouse object.
 *
 * @use when
 * - Simulating precise coordinate-based mouse interactions such as drawing, custom dragging,
 *   or triggering pointer events at specific offsets.
 *
 * @dont use when
 * - Interacting with standard DOM elements. Instead, use locators (e.g., `query().click()`, `query().hover()`)
 *   which automatically handle actionability checks, scrolling, and are much less brittle.
 */
export class Mouse {
  /**
   * Resets the mouse position to (0, 0) and releases all pressed mouse buttons.
   *
   * @example
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.reset()
   * ```
   *
   * @returns A promise that resolves when the reset action is completed.
   */
  async reset(): Promise<void> {
    await executeCommand('mouse', { action: 'reset' })
  }

  /**
   * Immediately sets the mouse position to the specified coordinates without emitting steps or transition events.
   *
   * @example
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.setPosition({ x: 100, y: 150 })
   * ```
   *
   * @param point - Point object specifying coordinates.
   * @returns A promise that resolves when the mouse position is set.
   */
  async setPosition(point: Point): Promise<void> {
    await executeCommand('mouse', { action: 'move', x: point.x, y: point.y, options: { steps: 1 } })
  }

  /**
   * Moves the mouse to a specific point, or from a starting point to a destination.
   *
   * @example Move mouse to coordinate (100, 200)
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.move({ x: 100, y: 200 }, { steps: 5 })
   * ```
   *
   * @example Drag from (100, 100) to (200, 200) holding the left mouse button
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.move({ x: 100, y: 100 }, { x: 200, y: 200 }, { button: 'left', steps: 10 })
   * ```
   */
  async move(point: Point, options?: MouseMoveOptions): Promise<void>
  async move(from: Point, to: Point, options?: MouseMoveOptions): Promise<void>
  async move(arg1: Point, arg2?: Point | MouseMoveOptions, arg3?: MouseMoveOptions): Promise<void> {
    if (arg2 && 'x' in arg2 && 'y' in arg2) {
      const from = arg1
      const to = arg2 as Point
      const options = arg3
      await executeCommand('mouse', {
        action: 'moveBetween',
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        options,
      })
    } else {
      const point = arg1
      const options = arg2 as MouseMoveOptions | undefined
      await executeCommand('mouse', {
        action: 'move',
        x: point.x,
        y: point.y,
        options,
      })
    }
  }

  /**
   * Presses a mouse button down.
   *
   * @example Pressing left mouse button down
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.down()
   * ```
   */
  async down(options?: MouseDownOptions): Promise<void> {
    await executeCommand('mouse', { action: 'down', options })
  }

  /**
   * Releases a mouse button.
   *
   * @example Releasing left mouse button
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.up()
   * ```
   */
  async up(options?: MouseUpOptions): Promise<void> {
    await executeCommand('mouse', { action: 'up', options })
  }

  /**
   * Clicks at the specified coordinates.
   *
   * @example Left-clicking at (100, 150)
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.click({ x: 100, y: 150 })
   * ```
   */
  async click(point: Point, options?: MouseClickOptions): Promise<void> {
    await executeCommand('mouse', { action: 'click', x: point.x, y: point.y, options })
  }

  /**
   * Double-clicks at the specified coordinates.
   *
   * @example Double-clicking at (200, 250)
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.dblclick({ x: 200, y: 250 })
   * ```
   */
  async dblclick(point: Point, options?: MouseDblClickOptions): Promise<void> {
    await executeCommand('mouse', { action: 'dblclick', x: point.x, y: point.y, options })
  }

  /**
   * Presses on specific coordinates, optionally holding down a keyboard modifier key and/or holding down the button
   * for a specific duration.
   *
   * @example Pressing and holding left click at (150, 150) for 500ms
   * ```typescript
   * import { mouse } from '@pawel-up/lupa/commands'
   *
   * await mouse.press({ x: 150, y: 150 }, { button: 'left', delay: 500 })
   * ```
   */
  async press(point: Point, options?: MousePressOptions): Promise<void> {
    await executeCommand('mouse', { action: 'press', x: point.x, y: point.y, options })
  }
}

export const mouse = new Mouse()
