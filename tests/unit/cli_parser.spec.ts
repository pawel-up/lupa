import { test } from 'node:test'
import assert from 'node:assert'
import { CliParser } from '../../src/runner/cli_parser.js'

test('CliParser', async (t) => {
  await t.test('parses boolean flags', () => {
    const parser = new CliParser()
    const args = parser.parse(['--watch', '--verbose', '--help'])
    assert.strictEqual(args.watch, true)
    assert.strictEqual(args.verbose, true)
    assert.strictEqual(args.help, true)
  })

  await t.test('parses string flags', () => {
    const parser = new CliParser()
    const args = parser.parse(['--browser', 'chromium', '--timeout', '5000', '--vite-config', 'custom.vite.config.ts'])
    assert.strictEqual(args.browser, 'chromium')
    assert.strictEqual(args.timeout, '5000')
    assert.strictEqual(args.viteConfig, 'custom.vite.config.ts')
  })

  await t.test('parses array arguments', () => {
    const parser = new CliParser()
    const args = parser.parse(['--tags', '@fast', '--tags', '@slow'])
    assert.deepStrictEqual(args.tags, ['@fast', '@slow'])
  })

  await t.test('returns help string', () => {
    const parser = new CliParser()
    const help = parser.getHelp()
    assert.ok(help.includes('--tests'))
    assert.ok(help.includes('--browser'))
    assert.ok(help.includes('@pawel-up/lupa'))
  })
})
