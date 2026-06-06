import { executeCommand } from './execute_command.js'
import { query as createLocator, type ElementScreenshotOptions, type LocatorQuery } from './locator.js'

/**
 * Options for taking a page screenshot.
 */
export interface PageScreenshotOptions {
  /**
   * The file path to save the screenshot to.
   */
  path: string

  /**
   * The image format. Defaults to 'png'.
   */
  type?: 'png' | 'jpeg'

  /**
   * The quality of the image, between 0-100. Only for jpeg.
   */
  quality?: number

  /**
   * When true, takes a screenshot of the full scrollable page, instead of the visible viewport.
   */
  fullPage?: boolean

  /**
   * Hides default white background and allows capturing screenshots with transparency.
   */
  omitBackground?: boolean

  /**
   * Maximum time in milliseconds. Defaults to 30000.
   */
  timeout?: number
}

/**
 * Handles capturing screenshots of the page or specific elements.
 *
 * @use when
 * - Capturing visual state of the application for visual regression testing or automated UI verification.
 *
 * @dont use when
 * - Running tests where visual assets are not needed, as capturing screenshots adds execution overhead.
 */
export class Screenshot {
  /**
   * Takes a screenshot of the entire page.
   *
   * @example
   * ```typescript
   * import { screenshot } from '@pawel-up/lupa/commands'
   *
   * await screenshot.take({ path: 'screenshots/home-page.png' })
   * ```
   *
   * @param options - Options for the screenshot, requires `path`.
   * @returns A promise that resolves when the screenshot is saved.
   */
  async take(options: PageScreenshotOptions): Promise<void> {
    if (!options || !options.path) {
      throw new Error('Screenshot path is required')
    }
    await executeCommand('screenshot', { action: 'take', options })
  }

  /**
   * Takes a screenshot of a specific element using a locator query.
   *
   * @example
   * ```typescript
   * import { screenshot } from '@pawel-up/lupa/commands'
   *
   * await screenshot.takeOf({ css: '#my-chart' }, { path: 'screenshots/chart.png' })
   * ```
   *
   * @param query - The query matching the target element.
   * @param options - Options for the screenshot, requires `path`.
   * @returns A promise that resolves when the screenshot is saved.
   */
  async takeOf(query: LocatorQuery, options: ElementScreenshotOptions): Promise<void> {
    if (!options || !options.path) {
      throw new Error('Screenshot path is required')
    }
    const loc = createLocator(query)
    await loc.screenshot(options)
  }
}

export const screenshot = new Screenshot()
