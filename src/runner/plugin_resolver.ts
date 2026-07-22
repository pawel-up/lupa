import { fileURLToPath, pathToFileURL } from 'node:url'
import type { JsonSerializable } from './types.js'

/**
 * Internal helper responsible for resolving test plugin specifiers
 * and mapping local file URLs to browser-accessible /@fs paths for Vite.
 */
export class PluginResolver {
  /**
   * Resolves test plugin specifiers relative to the specified root directory.
   *
   * @param plugins List of plugin specifiers or [specifier, options] tuples.
   * @param cwd Working directory root path.
   * @returns Array of resolved plugin tuples `[resolvedUrl, options]`.
   */
  async resolve(
    plugins: (JsonSerializable | undefined)[] | undefined,
    cwd: string
  ): Promise<(JsonSerializable | undefined)[][]> {
    if (!plugins || plugins.length === 0) {
      return []
    }

    const baseHref = pathToFileURL(cwd.endsWith('/') ? cwd : `${cwd}/`).href

    return Promise.all(
      plugins.map(async (plugin) => {
        const [specifier, options] = Array.isArray(plugin) ? plugin : [plugin, undefined]
        let url = specifier as string
        try {
          const resolved = import.meta.resolve(url, baseHref)
          if (resolved.startsWith('file://')) {
            url = '/@fs' + fileURLToPath(resolved)
          } else {
            url = resolved
          }
        } catch {
          // Leave specifier as-is to allow browser runner reporting
        }
        return [url, options]
      })
    )
  }
}
