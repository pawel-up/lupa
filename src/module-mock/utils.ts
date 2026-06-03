/**
 * Normalize a path to the canonical registry key used by both fixture.ts (browser)
 * and plugin.ts (Node/Vite load hook).
 *
 * The browser's `new URL(path, import.meta.url).pathname` on a `/@fs/…` base URL
 * produces the absolute FS path (e.g. `/Users/…/src/calculator.js`).
 * The Vite load hook receives the resolved absolute FS path (e.g. `/Users/…/src/calculator.ts`).
 * Both sides normalize .ts/.tsx → .js so they always agree.
 *
 * Note, this function has to be separated from the `./plugin.ts` file since we cannot
 * load `./plugin.ts` in the browser.
 */
export function toRegistryKey(filePath: string): string {
  // Strip /@fs only if it appears as a URL prefix before an absolute path —
  // the browser pathname already includes it in some Vite setups.
  const withoutFs = filePath.startsWith('/@fs/') ? filePath.slice(4) : filePath
  return withoutFs.replace(/\.tsx?$/, '.js')
}
