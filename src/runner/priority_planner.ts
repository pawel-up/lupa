import type { PlannedTestSuite } from '../types.js'

export const DEFAULT_PRIORITY = 100

/**
 * Internal helper responsible for grouping test suites into priority buckets.
 */
export class PriorityPlanner {
  /**
   * Groups planned test suites by their priority integer.
   * Suites without an explicit priority fall back to DEFAULT_PRIORITY (100).
   *
   * @param suites The array of planned test suites.
   * @returns A Map mapping priority number to the array of suites in that tier.
   */
  groupByPriority(suites: PlannedTestSuite[]): Map<number, PlannedTestSuite[]> {
    const tierMap = new Map<number, PlannedTestSuite[]>()
    for (const suite of suites) {
      const priority = suite.priority ?? DEFAULT_PRIORITY
      const bucket = tierMap.get(priority)
      if (bucket) {
        bucket.push(suite)
      } else {
        tierMap.set(priority, [suite])
      }
    }
    return tierMap
  }
}
