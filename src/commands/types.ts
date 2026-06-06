/**
 * Type representing viewport command payload.
 */
export interface Viewport {
  /**
   * Width of the viewport.
   */
  width: number

  /**
   * Height of the viewport.
   */
  height: number
}

/**
 * Type representing emulateMedia command payload.
 */
export interface Media {
  /**
   * Color scheme of the media.
   */
  colorScheme?: 'light' | 'dark' | 'no-preference'

  /**
   * Reduced motion of the media.
   */
  reducedMotion?: 'reduce' | 'no-preference'

  /**
   * Media type.
   */
  media?: 'print' | 'screen'

  /**
   * Forced colors of the media.
   */
  forcedColors?: 'active' | 'none'
}

/**
 * Type representing sendKeys command payload.
 */
export interface TypePayload {
  /**
   * String to type.
   */
  type: string
}

/**
 * Type representing sendKeys command payload.
 */
export interface PressPayload {
  /**
   * Key to press.
   */
  press: string
}

/**
 * Type representing sendKeys command payload.
 */
export interface DownPayload {
  /**
   * Key to press.
   */
  down: string
}

/**
 * Type representing sendKeys command payload.
 */
export interface UpPayload {
  /**
   * Key to release.
   */
  up: string
}

/**
 * Type representing sendKeys command payload.
 */
export type SendKeysPayload = TypePayload | PressPayload | DownPayload | UpPayload

/**
 * Type representing sendMouse command payload.
 */
export interface SendMousePayload {
  /**
   * Mouse event type.
   */
  type: 'move' | 'click' | 'down' | 'up'

  /**
   * Mouse position.
   */
  position?: [number, number]

  /**
   * Mouse button.
   */
  button?: 'left' | 'middle' | 'right'

  /**
   * Number of clicks.
   */
  clickCount?: number
}

/**
 * Type representing selectOption command payload.
 */
export interface SelectOptionPayload {
  /**
   * A CSS selector to select the option.
   */
  selector: string

  /**
   * Value of the option to select.
   */
  value: string | string[]
}

/**
 * Type representing all available commands.
 */
export type CommandNames =
  | 'setViewport'
  | 'emulateMedia'
  | 'sendKeys'
  | 'sendMouse'
  | 'resetMouse'
  | 'selectOption'
  | 'locator'
  | 'network:mock:enable'
  | 'network:mock:disable'
  | 'network:mock:register'
  | 'network:mock:unregister'
  | 'network:mock:ignoreCors'
  | 'module:mock:register'
  | 'module:mock:clear'
  | 'mouse'
