import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import { createRequire } from 'node:module'
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

  await t.test('handles configuration with include patterns', () => {
    const mgr = new CoverageManager({ enabled: true, include: ['src/**'] })
    assert.ok(mgr.isEnabled)
  })

  await t.test('filters out non-executable TS lines in v8-to-istanbul', async () => {
    const tempFile = `${os.tmpdir()}/lupa_mock_coverage_test.ts`
    const tempFileContent = [
      '// A single line comment',
      '/*',
      '  A multi-line comment',
      '*/',
      'import { something } from "somewhere"',
      '',
      'export interface TestInterface {',
      '  name: string',
      '  value: number',
      '}',
      '',
      'export type TestType = {',
      '  active: boolean',
      '}',
      '',
      'export class MockClass {',
      '  static staticField: string',
      '  protected instanceField: number',
      '  public initializedField = 42',
      '',
      '  constructor() {',
      '    console.log("hello")',
      '  }',
      '',
      '  myMethod(foo: string): void {',
      '    const x = foo.trim()',
      '  }',
      '}',
    ].join('\n')

    fs.writeFileSync(tempFile, tempFileContent, 'utf8')

    try {
      const requireModule = createRequire(import.meta.url)
      const v8toIstanbul = requireModule('v8-to-istanbul')
      // Create converter
      const converter = v8toIstanbul(tempFile, 0, {
        source: tempFileContent,
      })

      // Load it
      await converter.load()

      // Verify the ignore property on internal line objects of converter
      const lines = converter.covSources[0].source.lines
      assert.ok(lines && lines.length > 0)

      // 0: '// A single line comment' -> ignore = true
      assert.strictEqual(lines[0].ignore, true, 'comment line 1 ignored')
      // 1: '/*' -> ignore = true
      assert.strictEqual(lines[1].ignore, true, 'comment line 2 ignored')
      // 2: '  A multi-line comment' -> ignore = true
      assert.strictEqual(lines[2].ignore, true, 'comment line 3 ignored')
      // 3: '*/' -> ignore = true
      assert.strictEqual(lines[3].ignore, true, 'comment line 4 ignored')
      // 4: 'import { something } from "somewhere"' -> ignore = true
      assert.strictEqual(lines[4].ignore, true, 'import line ignored')

      // 6: 'export interface TestInterface {' -> ignore = true
      assert.strictEqual(lines[6].ignore, true, 'interface header ignored')
      // 7: '  name: string' -> ignore = true
      assert.strictEqual(lines[7].ignore, true, 'interface field ignored')
      // 8: '  value: number' -> ignore = true
      assert.strictEqual(lines[8].ignore, true, 'interface field ignored')
      // 9: '}' -> ignore = true
      assert.strictEqual(lines[9].ignore, true, 'interface close ignored')

      // 11: 'export type TestType = {' -> ignore = true
      assert.strictEqual(lines[11].ignore, true, 'type header ignored')

      // 15: 'export class MockClass {' -> ignore = false (or undefined)
      assert.ok(!lines[15]?.ignore, 'class declaration not ignored')
      // 16: '  static staticField: string' -> ignore = true
      assert.strictEqual(lines[16].ignore, true, 'static property ignored')
      // 17: '  protected instanceField: number' -> ignore = true
      assert.strictEqual(lines[17].ignore, true, 'instance property ignored')
      // 18: '  public initializedField = 42' -> ignore = false
      assert.ok(!lines[18]?.ignore, 'initialized field not ignored')

      // 20: '  constructor() {' -> ignore = true
      assert.strictEqual(lines[20].ignore, true, 'constructor header ignored')
      // 21: '    console.log("hello")' -> ignore = false
      assert.ok(!lines[21]?.ignore, 'constructor statement not ignored')

      // 24: '  myMethod(foo: string): void {' -> ignore = true
      assert.strictEqual(lines[24].ignore, true, 'method header ignored')
      // 25: '    const x = foo.trim()' -> ignore = false
      assert.ok(!lines[25]?.ignore, 'method statement not ignored')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })
})
