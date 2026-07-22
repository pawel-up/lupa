import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CoverageIntegrator } from '../../../src/runner/coverage_integrator.js'
import type { NormalizedConfig } from '../../../src/runner/types.js'
import type { InlineConfig } from 'vite'

test('CoverageIntegrator initializes coverageManager and instruments vite config', async () => {
  const integrator = new CoverageIntegrator()
  assert.strictEqual(integrator.coverageManager, undefined)

  const mockConfig = {
    coverage: { enabled: true, provider: 'v8' },
    exclude: ['**/node_modules/**'],
  } as unknown as NormalizedConfig

  const viteConfig: InlineConfig = {}

  const manager = await integrator.instrument(mockConfig, viteConfig)

  assert.ok(manager)
  assert.strictEqual(integrator.coverageManager, manager)
})
