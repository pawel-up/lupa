import { executeCommand } from './execute_command.js'
import type { Cookie, ClearCookiesOptions } from './types.js'

/**
 * Class to manipulate browser context cookies.
 *
 * @use when
 * - Authenticating your tests by injecting session cookies dynamically.
 *   (e.g., bypass login flows by adding a predefined authentication cookie).
 * - Verifying cookie behavior under different scenarios (e.g., verifying that a cookie gets
 *   correctly cleared or set by client-side operations).
 *
 * @dont use when
 * - Mocking HTTP requests or response headers; use the `network` fixture instead.
 */
export class Cookies {
  /**
   * Adds cookies to the browser context.
   *
   * @example
   * ```typescript
   * import { cookies } from '@pawel-up/lupa/commands'
   *
   * await cookies.add({
   *   name: 'session_id',
   *   value: 'abc123xyz',
   *   domain: 'localhost',
   *   path: '/'
   * })
   * ```
   */
  async add(cookies: Cookie | Cookie[]): Promise<void> {
    const list = Array.isArray(cookies) ? cookies : [cookies]
    await executeCommand('cookies:add', { cookies: list })
  }

  /**
   * Gets all cookies from the browser context. Optionally filters by URLs.
   *
   * @example
   * ```typescript
   * import { cookies } from '@pawel-up/lupa/commands'
   *
   * const allCookies = await cookies.getAll()
   * const siteCookies = await cookies.getAll('https://example.com')
   * ```
   */
  async getAll(urls?: string | string[]): Promise<Cookie[]> {
    const filterUrls = urls ? (Array.isArray(urls) ? urls : [urls]) : undefined
    return (await executeCommand('cookies:getAll', { urls: filterUrls })) as Cookie[]
  }

  /**
   * Clears cookies matching the options. If no options are specified, clears all cookies.
   *
   * @example
   * ```typescript
   * import { cookies } from '@pawel-up/lupa/commands'
   *
   * // Clear all cookies
   * await cookies.clear()
   *
   * // Clear a specific cookie by name
   * await cookies.clear({ name: 'session_id' })
   * ```
   */
  async clear(options?: ClearCookiesOptions): Promise<void> {
    await executeCommand('cookies:clear', { options })
  }
}

export const cookies = new Cookies()
