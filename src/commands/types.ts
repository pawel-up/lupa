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
 * Shape of a cookie matching Playwright's format.
 *
 * @use-when
 * Use when adding cookies via `cookies.add` or retrieving them via `cookies.getAll`.
 *
 * @dont-use-when
 * Do not use for other storage mechanisms such as LocalStorage or SessionStorage.
 */
export interface Cookie {
  /**
   * The name of the cookie.
   */
  name: string

  /**
   * The value of the cookie.
   */
  value: string

  /**
   * The URL associated with the cookie. Either url or both domain and path must be specified.
   */
  url?: string

  /**
   * The domain of the cookie. Either url or both domain and path must be specified.
   */
  domain?: string

  /**
   * The path of the cookie. Either url or both domain and path must be specified.
   */
  path?: string

  /**
   * Unix time in seconds representing the cookie's expiration.
   */
  expires?: number

  /**
   * Whether the cookie is HTTP-only.
   */
  httpOnly?: boolean

  /**
   * Whether the cookie is secure (HTTPS-only).
   */
  secure?: boolean

  /**
   * SameSite attribute value.
   */
  sameSite?: 'Lax' | 'Strict' | 'None'
}

/**
 * Options for clearing cookies. Filter which cookies should be deleted from the browser context.
 *
 * @use-when
 * Use when calling `cookies.clear()` with filters to remove specific cookies.
 *
 * @dont-use-when
 * Do not use if you want to clear all cookies (call `cookies.clear()` with no arguments instead).
 */
export interface ClearCookiesOptions {
  /**
   * Filter to clear cookies with this specific name.
   */
  name?: string

  /**
   * Filter to clear cookies belonging to this specific domain.
   */
  domain?: string

  /**
   * Filter to clear cookies matching this specific path.
   */
  path?: string
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
  | 'keyboard'
  | 'screenshot'
  | 'emulate'
  | 'network:setOffline'
  | 'cookies:add'
  | 'cookies:getAll'
  | 'cookies:clear'
