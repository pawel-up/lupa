import { executeCommand } from './execute_command.js'
import type { Viewport, Media } from './types.js'

/**
 * Geolocation coordinates to emulate.
 */
export interface Geolocation {
  /**
   * Latitude between -90 and 90.
   */
  latitude: number

  /**
   * Longitude between -180 and 180.
   */
  longitude: number

  /**
   * Non-negative accuracy value.
   */
  accuracy?: number
}

/**
 * Options for granting permissions dynamically.
 */
export interface GrantPermissionsOptions {
  /**
   * Origin to grant permissions for. If not specified, permissions are granted to all origins.
   */
  origin?: string
}

/**
 * Class to emulate different environment features like viewport size, media,
 * geolocation, permissions, and offline mode.
 *
 * @use when
 * - Overriding device settings dynamically during a test (e.g. testing responsive layout
 *   breakpoint transitions, dark mode switching, geolocation updates, or offline network behaviors).
 *
 * @dont use when
 * - Setting static configuration options that are best configured via the main Lupa config file.
 */
export class Emulation {
  /**
   * Changes the size of the viewport.
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.setViewport({ width: 375, height: 667 })
   * ```
   */
  async setViewport(viewport: Viewport): Promise<void> {
    await executeCommand('emulate', { action: 'setViewport', viewport })
  }

  /**
   * Emulates media features.
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.emulateMedia({ colorScheme: 'dark' })
   * ```
   */
  async emulateMedia(media: Media): Promise<void> {
    await executeCommand('emulate', { action: 'emulateMedia', media })
  }

  /**
   * Sets the geolocation for the browser context dynamically.
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.setGeolocation({ latitude: 48.8584, longitude: 2.2944 })
   * ```
   */
  async setGeolocation(geolocation?: Geolocation): Promise<void> {
    await executeCommand('emulate', { action: 'setGeolocation', geolocation })
  }

  /**
   * Grants permissions to the browser context dynamically.
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.grantPermissions(['geolocation'])
   * ```
   */
  async grantPermissions(permissions: string[], options?: GrantPermissionsOptions): Promise<void> {
    await executeCommand('emulate', { action: 'grantPermissions', permissions, permissionOptions: options })
  }

  /**
   * Clears all permissions granted dynamically.
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.clearPermissions()
   * ```
   */
  async clearPermissions(): Promise<void> {
    await executeCommand('emulate', { action: 'clearPermissions' })
  }

  /**
   * Toggles the offline state of the browser context.
   *
   * > [!IMPORTANT]
   * > **Persistence Notice**: Unlike `network.setOffline(...)`, this method changes the global context state.
   * > The context will remain offline until it is explicitly set back to online (i.e. it does not
   * > automatically revert at the end of the test).
   *
   * @example
   * ```typescript
   * import { emulation } from '@pawel-up/lupa/commands'
   *
   * await emulation.setOffline(true)
   * ```
   */
  async setOffline(offline: boolean): Promise<void> {
    await executeCommand('emulate', { action: 'setOffline', offline })
  }
}

export const emulation = new Emulation()
