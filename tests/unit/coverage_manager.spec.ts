import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import type { InlineConfig } from 'vite'
import { CoverageManager } from '../../src/runner/coverage_manager.js'
import { ExceptionsManager } from '../../src/runner/exceptions_manager.js'

test('CoverageManager', async (t) => {
  await t.test('determines isEnabled correctly', () => {
    const mgr1 = new CoverageManager(undefined)
    assert.strictEqual(mgr1.isEnabled, false)

    const mgr2 = new CoverageManager(false)
    assert.strictEqual(mgr2.isEnabled, false)

    const mgr3 = new CoverageManager(true)
    assert.strictEqual(mgr3.isEnabled, true)

    const mgr4 = new CoverageManager({ reporters: ['text'] })
    assert.strictEqual(mgr4.isEnabled, true)
  })

  await t.test('lazily creates temp directory under OS tmpdir', () => {
    const mgr = new CoverageManager(true)
    assert.strictEqual(mgr.isEnabled, true)

    const tempDir = mgr.getTempDir()
    assert.ok(fs.existsSync(tempDir))
    assert.ok(tempDir.includes(os.tmpdir()))

    // Cleanup manually since we are not running report generator
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  await t.test('instruments Vite config for source maps', async () => {
    const mgr = new CoverageManager(true)
    const viteConfig: InlineConfig = {}
    await mgr.instrumentViteConfig(viteConfig)

    assert.strictEqual(viteConfig.css?.devSourcemap, true)
    assert.strictEqual(viteConfig.build?.sourcemap, true)
  })

  await t.test('validates threshold coverage limits', async () => {
    const mgr = new CoverageManager({
      thresholds: {
        lines: 90,
        statements: 90,
      },
    })

    const exceptions = new ExceptionsManager()
    // Triggering generateReport with empty/no temp directory shouldn't fail
    await mgr.generateReport(exceptions)
    assert.strictEqual(exceptions.hasErrors, false)
  })
})
