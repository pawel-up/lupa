import { fileURLToPath } from 'node:url'
import { moduleMockVitePlugin } from './plugin.js'
import type { LupaPlugin } from '../runner/types.js'

const fixturePath = fileURLToPath(new URL('./fixture.js', import.meta.url))

export type { ModuleMock } from './fixture.js'

/**
 * Opt-in Lupa plugin that enables native ESM module mocking in browser tests.
 *
 * Adds the `module` fixture to `TestContext`, allowing tests to mock ES module
 * exports with full isolation — each test gets its own mock scope that is
 * automatically torn down when the test finishes.
 *
 * @example
 * ```ts
 * // lupa.config.ts
 * import { defineConfig } from '@pawel-up/lupa/runner'
 * import { moduleMocking } from '@pawel-up/lupa/module-mock'
 *
 * export default defineConfig({
 *   plugins: [moduleMocking()]
 * })
 * ```
 */
export function moduleMocking(): LupaPlugin {
  return {
    name: 'lupa:module-mock',

    plan({ config }) {
      // Register the Vite plugin (runs in the Node/Vite server process)
      config.vite ??= {}
      config.vite.plugins ??= []
      ;(config.vite.plugins as unknown[]).push(moduleMockVitePlugin())

      // Register the browser-side fixture plugin
      config.testPlugins ??= []
      config.testPlugins.push(fixturePath)
    },
  }
}
