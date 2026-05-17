import { loadConfigFromFile } from 'vite'
import type { Config } from './types.js'

/**
 * Loads the Lupa configuration from a local file (e.g. lupa.config.ts)
 */
export async function loadLupaConfig(root: string, configPath?: string): Promise<Config | null> {
  // We use vite.loadConfigFromFile to easily transpile and load TS config files
  const result = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configPath, root)

  if (!result) {
    return null
  }

  return result.config as Config
}
