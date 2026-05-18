import { test } from 'node:test'
import assert from 'node:assert'
import { formatPinnedTest } from '../../../src/runner/helpers.js'

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
})
