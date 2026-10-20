import { test } from 'node:test'
import assert from 'node:assert'
import { formatPinnedTest, matchesPath } from '../../../src/runner/helpers.js'

test('Helpers', async (t) => {
  await t.test('formatPinnedTest captures location and formats pinned test string', () => {
    // Generate a raw stack trace to simulate what error.stack gives
    const fakeError = new Error('Finding pinned test location')

    // Check that it contains the test title
    const formatted = formatPinnedTest('My Pinned Test', fakeError.stack || '')

    assert.match(formatted, /My Pinned Test/)

    // Check that it resolved the stack trace. Because we generated the error synchronously in the test,
    // the top non-node stack frame is actually helpers.spec.ts itself.
    assert.match(formatted, /helpers\.spec\.ts/)
  })

  await t.test('matchesPath handles exact and directory boundary matches', () => {
    // Exact match
    assert.equal(matchesPath('/app/tests/a.spec.ts', '/app/tests/a.spec.ts'), true)
    assert.equal(matchesPath('a.spec.ts', 'a.spec.ts'), true)

    // Absolute vs relative match (at directory boundary)
    assert.equal(matchesPath('/app/tests/a.spec.ts', 'a.spec.ts'), true)
    assert.equal(matchesPath('a.spec.ts', '/app/tests/a.spec.ts'), true)
    assert.equal(matchesPath('/app/tests/a.spec.ts', 'tests/a.spec.ts'), true)
    assert.equal(matchesPath('tests/a.spec.ts', '/app/tests/a.spec.ts'), true)

    // With leading slash in relative filter
    assert.equal(matchesPath('/app/tests/a.spec.ts', '/tests/a.spec.ts'), true)

    // Windows backslash normalization
    assert.equal(matchesPath('C:\\app\\tests\\a.spec.ts', 'tests/a.spec.ts'), true)
    assert.equal(matchesPath('tests\\a.spec.ts', '/app/tests/a.spec.ts'), true)
  })

  await t.test('matchesPath prevents false substring collisions', () => {
    // Suffix without directory separator should NOT match
    assert.equal(matchesPath('/app/tests/superfile.spec.ts', 'file.spec.ts'), false)
    assert.equal(matchesPath('file.spec.ts', '/app/tests/superfile.spec.ts'), false)
    assert.equal(matchesPath('/app/tests/superfile.spec.ts', '/app/tests/file.spec.ts'), false)

    // Different parent directory prefix collision
    assert.equal(matchesPath('/app/my-tests/a.spec.ts', 'tests/a.spec.ts'), false)
  })

  await t.test('matchesPath returns false for empty or invalid paths', () => {
    assert.equal(matchesPath('', '/app/test.spec.ts'), false)
    assert.equal(matchesPath('/app/test.spec.ts', ''), false)
    assert.equal(matchesPath(null as unknown as string, '/app/test.spec.ts'), false)
    assert.equal(matchesPath('/app/test.spec.ts', undefined as unknown as string), false)
  })
})
