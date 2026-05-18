import { loadConfigFromFile } from 'vite'
import type { Config } from './types.js'

/**
 * Loads the Lupa configuration from a local file (e.g. lupa.config.ts).
 *
 * @category Configuration
 * @useWhen You need to programmatically load and parse the Lupa configuration from a file.
 *
 * @param root - The root directory to search for the configuration file.
 * @param configPath - Optional path to the configuration file.
 * @returns A Promise that resolves to the loaded configuration object, or null if not found.
 *
 * @example
 * ```ts
 * import { loadLupaConfig, Config } from '@pawel-up/lupa/runner'
 *
 * const config = await loadLupaConfig('/path/to/root')
 * ```
 */
export async function loadLupaConfig(root: string, configPath?: string): Promise<Config | null> {
  // We use vite.loadConfigFromFile to easily transpile and load TS config files
  const result = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configPath, root)

  if (!result) {
    return null
  }

  return result.config as Config
}
