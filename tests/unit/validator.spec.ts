import { test } from 'node:test'
import assert from 'node:assert'
import {
  ensureIsConfigured,
  ensureIsInPlanningPhase,
  validateSuitesFilter,
  validateSuitesForUniqueness,
  validateActivatedReporters,
} from '../../src/runner/validator.js'
import type { NormalizedConfig } from '../../src/runner/types.js'

test('Validators', async (t) => {
  await t.test('ensureIsConfigured', () => {
    assert.throws(() => ensureIsConfigured(), /Cannot run tests/)
    assert.doesNotThrow(() => ensureIsConfigured({} as NormalizedConfig))
  })

  await t.test('ensureIsInPlanningPhase', () => {
    assert.throws(() => ensureIsInPlanningPhase('idle'), /Cannot import lupa test file directly/)
    assert.throws(() => ensureIsInPlanningPhase('executing'), /Cannot import lupa test file directly/)
    assert.doesNotThrow(() => ensureIsInPlanningPhase('planning'))
  })

  await t.test('validateSuitesFilter', () => {
    const validConfig = {
      filters: { suites: ['unit'] },
      suites: [{ name: 'unit', files: '' }],
    } as unknown as NormalizedConfig
    assert.doesNotThrow(() => validateSuitesFilter(validConfig))

    const noFiltersConfig = { filters: {} } as NormalizedConfig
    assert.doesNotThrow(() => validateSuitesFilter(noFiltersConfig))

    const filterNoSuitesConfig = { filters: { suites: ['unit'] } } as NormalizedConfig
    assert.throws(() => validateSuitesFilter(filterNoSuitesConfig), /You have not configured any test suites/)

    const unknownSuiteConfig = {
      filters: { suites: ['e2e'] },
      suites: [{ name: 'unit', files: '' }],
    } as unknown as NormalizedConfig
    assert.throws(() => validateSuitesFilter(unknownSuiteConfig), /"e2e" suite is not configured/)
  })

  await t.test('validateSuitesForUniqueness', () => {
    const noSuites = {} as NormalizedConfig
    assert.doesNotThrow(() => validateSuitesForUniqueness(noSuites))

    const uniqueSuites = {
      suites: [{ name: 'unit' }, { name: 'e2e' }],
    } as NormalizedConfig
    assert.doesNotThrow(() => validateSuitesForUniqueness(uniqueSuites))

    const duplicateSuites = {
      suites: [{ name: 'unit' }, { name: 'unit' }],
    } as NormalizedConfig
    assert.throws(() => validateSuitesForUniqueness(duplicateSuites), /Duplicate suite "unit"/)
  })

  await t.test('validateActivatedReporters', () => {
    const validReporters = {
      reporters: { activated: ['progress'], list: [{ name: 'progress' }] },
    } as unknown as NormalizedConfig
    assert.doesNotThrow(() => validateActivatedReporters(validReporters))

    const unknownReporters = {
      reporters: { activated: ['progress', 'unknown_reporter'], list: [{ name: 'progress' }] },
    } as unknown as NormalizedConfig
    assert.throws(() => validateActivatedReporters(unknownReporters), /Invalid reporter "unknown_reporter"/)

    const validBuiltinReporters = {
      reporters: { activated: ['ndjson', 'dot'], list: [{ name: 'progress' }] },
    } as unknown as NormalizedConfig
    assert.doesNotThrow(() => validateActivatedReporters(validBuiltinReporters))
  })
})
