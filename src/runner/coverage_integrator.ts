import type { InlineConfig } from 'vite'
import { CoverageManager } from './coverage_manager.js'
import type { NormalizedConfig } from './types.js'

/**
 * Internal helper responsible for instantiating CoverageManager
 * and applying code coverage instrumentation to Vite configuration.
 */
export class CoverageIntegrator {
  #coverageManager?: CoverageManager

  /**
   * Returns the underlying CoverageManager instance if initialized.
   */
  get coverageManager(): CoverageManager | undefined {
    return this.#coverageManager
  }

  /**
   * Initializes CoverageManager and instruments the ViteInlineConfig.
   *
   * @param config The normalized framework configuration.
   * @param viteConfig The target Vite inline configuration.
   */
  async instrument(config: NormalizedConfig, viteConfig: InlineConfig): Promise<CoverageManager> {
    this.#coverageManager = new CoverageManager(config.coverage, config.exclude)
    await this.#coverageManager.instrumentViteConfig(viteConfig)
    return this.#coverageManager
  }
}
