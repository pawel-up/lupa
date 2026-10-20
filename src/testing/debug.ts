/**
 * Lightweight browser-safe debug logger that checks localStorage or sessionStorage
 * without external dependencies or importing `./env.js`.
 */
export function createBrowserDebug(namespace: string) {
  return (...args: unknown[]): void => {
    try {
      if (typeof window === 'undefined') return
      const debugVar = window.localStorage?.getItem('DEBUG') || window.sessionStorage?.getItem('DEBUG') || ''
      if (!debugVar) return
      if (
        debugVar === '*' ||
        debugVar.includes(namespace) ||
        (debugVar.endsWith('*') && namespace.startsWith(debugVar.slice(0, -1)))
      ) {
        // eslint-disable-next-line no-console
        console.debug(`%c${namespace}`, 'color: #00bcd4; font-weight: bold', ...args)
      }
    } catch {
      // Ignore storage access errors in restricted iframe/browser environments
    }
  }
}

export default createBrowserDebug('lupa:testing')
