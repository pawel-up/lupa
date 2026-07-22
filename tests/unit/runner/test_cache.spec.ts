import test from 'node:test'
import assert from 'node:assert/strict'
import { TestCache } from '../../../src/runner/test_cache.js'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('TestCache', async (t) => {
  const tempFile = join(tmpdir(), `test-cache-spec-${Date.now()}.spec.ts`)
  writeFileSync(tempFile, 'console.log("hello test")')

  t.after(() => {
    try {
      unlinkSync(tempFile)
    } catch {
      // ignore cleanup errors
    }
  })

  await t.test('computes file hash based on content', () => {
    const cache = new TestCache()
    const hash1 = cache.computeFileHash(tempFile)
    assert.ok(hash1)

    // Modifying content changes hash
    writeFileSync(tempFile, 'console.log("hello test updated")')
    const hash2 = cache.computeFileHash(tempFile)
    assert.ok(hash2)
    assert.notEqual(hash1, hash2)
  })

  await t.test('records and validates passing test results', () => {
    const cache = new TestCache()
    const hash = cache.computeFileHash(tempFile)

    assert.equal(cache.hasValidPass(tempFile, hash), false)

    cache.recordResult(tempFile, hash, 'pass', [{ eventName: 'test:end', data: {} }])
    assert.equal(cache.hasValidPass(tempFile, hash), true)

    // Different hash invalidates pass
    assert.equal(cache.hasValidPass(tempFile, 'different-hash'), false)

    // Record failure invalidates pass
    cache.recordResult(tempFile, hash, 'fail', [])
    assert.equal(cache.hasValidPass(tempFile, hash), false)
  })

  await t.test('invalidates and clears cache entries', () => {
    const cache = new TestCache()
    const hash = cache.computeFileHash(tempFile)

    cache.recordResult(tempFile, hash, 'pass', [])
    assert.equal(cache.hasValidPass(tempFile, hash), true)

    cache.invalidate(tempFile)
    assert.equal(cache.hasValidPass(tempFile, hash), false)

    cache.recordResult(tempFile, hash, 'pass', [])
    cache.clear()
    assert.equal(cache.hasValidPass(tempFile, hash), false)
  })
})
