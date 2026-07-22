import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PriorityPlanner, DEFAULT_PRIORITY } from '../../../src/runner/priority_planner.js'
import type { PlannedTestSuite } from '../../../src/types.js'

test('PriorityPlanner groups suites by numeric priority with default fallback', () => {
  const planner = new PriorityPlanner()
  const suites: PlannedTestSuite[] = [
    { name: 'unit', files: [], filesURLs: [], priority: 200 },
    { name: 'default1', files: [], filesURLs: [] },
    { name: 'default2', files: [], filesURLs: [] },
    { name: 'e2e', files: [], filesURLs: [], priority: 50 },
  ]

  const tierMap = planner.groupByPriority(suites)

  assert.strictEqual(tierMap.size, 3)
  assert.strictEqual(tierMap.get(200)?.length, 1)
  assert.strictEqual(tierMap.get(200)?.[0].name, 'unit')

  assert.strictEqual(tierMap.get(DEFAULT_PRIORITY)?.length, 2)
  assert.strictEqual(tierMap.get(50)?.length, 1)
  assert.strictEqual(tierMap.get(50)?.[0].name, 'e2e')
})
