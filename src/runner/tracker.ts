/*
 * @japa/core
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { timeSpan, type TimeEndFunction } from '../lib/main.js'
import type { RunnerEvents, RunnerSummary, FailureTreeGroupNode, FailureTreeSuiteNode } from '../types.js'

/**
 * Tracks the tests events to generate a summary report. Failing tests are further tracked
 * for complete hierarchy
 */
export class Tracker {
  /**
   * Time tracker to find runner duration
   */
  #timeTracker?: TimeEndFunction

  /**
   * Active suites tracked by execution correlation ID
   */
  #activeSuites = new Map<string, FailureTreeSuiteNode>()

  /**
   * Active groups tracked by execution correlation ID
   */
  #activeGroups = new Map<string, FailureTreeGroupNode>()

  #aggregates: RunnerSummary['aggregates'] = {
    total: 0,
    failed: 0,
    passed: 0,
    regression: 0,
    skipped: 0,
    todo: 0,
  }

  #duration = 0

  /**
   * A tree of suites/groups and tests that have failed. They are always nested inside
   * other unless the test groups where used, then suites contains a list of tests
   * directly.
   */
  #failureTree: FailureTreeSuiteNode[] = []
  #failedTestsTitles: string[] = []
  #importErrors: { file: string; error: Error }[] = []

  #getSuiteKey(payload: { browserId: string; name: string }) {
    return `${payload.browserId}:${payload.name}`
  }

  #getGroupKey(payload: { browserId: string; file: string; title: string }) {
    return `${payload.browserId}:${payload.file}:${payload.title}`
  }

  /**
   * Set reference for the current suite
   */
  #onSuiteStart(payload: RunnerEvents['suite:start']) {
    this.#activeSuites.set(this.#getSuiteKey(payload), {
      name: payload.name,
      type: 'suite',
      errors: [],
      children: [],
    })
  }

  /**
   * Move suite to the failure tree when the suite
   * has errors
   */
  #onSuiteEnd(payload: RunnerEvents['suite:end']) {
    const key = this.#getSuiteKey(payload)
    const suite = this.#activeSuites.get(key)
    if (!suite) {
      throw new Error('Suite not found')
    }
    if (payload.hasError) {
      suite.errors = payload.errors
    }

    if (suite.errors.length > 0 || suite.children.length > 0) {
      this.#failureTree.push(suite)
    }
    this.#activeSuites.delete(key)
  }

  /**
   * Set reference for the current group
   */
  #onGroupStart(payload: RunnerEvents['group:start']) {
    this.#activeGroups.set(this.#getGroupKey(payload), {
      name: payload.title,
      type: 'group',
      errors: [],
      children: [],
    })
  }

  /**
   * Move group to the suite children when the group
   * has errors or children
   */
  #onGroupEnd(payload: RunnerEvents['group:end']) {
    const key = this.#getGroupKey(payload)
    const group = this.#activeGroups.get(key)
    if (!group) {
      throw new Error('Group not found')
    }
    if (payload.hasError) {
      group.errors = payload.errors
    }

    if (group.errors.length > 0 || group.children.length > 0) {
      const suiteKey = payload.meta.suite
        ? this.#getSuiteKey({ browserId: payload.browserId, name: payload.meta.suite })
        : null
      const suite = suiteKey ? this.#activeSuites.get(suiteKey) : null
      if (suite) {
        suite.children.push(group)
      }
    }
    this.#activeGroups.delete(key)
  }

  /**
   * In case of failure, track the test inside the current group
   * or the current suite.
   */
  #onTestEnd(payload: RunnerEvents['test:end']) {
    /**
     * Bumping aggregates
     */
    this.#aggregates.total++

    /**
     * Test was skipped
     */
    if (payload.isSkipped) {
      this.#aggregates.skipped++
      return
    }

    /**
     * Test was a todo
     */
    if (payload.isTodo) {
      this.#aggregates.todo++
      return
    }

    /**
     * Test completed successfully
     */
    if (!payload.hasError) {
      if (payload.isFailing) {
        this.#aggregates.regression++
      } else {
        this.#aggregates.passed++
      }
      return
    }

    this.#markTestAsFailed(payload)
  }

  /**
   * Mark test as failed
   */
  #markTestAsFailed(payload: RunnerEvents['test:end']) {
    /**
     * Bump failed count
     */
    this.#aggregates.failed++

    /**
     * Test payload
     */
    const testPayload = {
      type: 'test' as const,
      title: payload.title.expanded,
      errors: payload.errors,
    }

    /**
     * Track test inside the current group or suite
     */
    const groupKey = payload.meta.group
      ? this.#getGroupKey({ browserId: payload.browserId, file: payload.file, title: payload.meta.group })
      : null
    const group = groupKey ? this.#activeGroups.get(groupKey) : null

    if (group) {
      group.children.push(testPayload)
    } else {
      const suiteKey = payload.meta.suite
        ? this.#getSuiteKey({ browserId: payload.browserId, name: payload.meta.suite })
        : null
      const suite = suiteKey ? this.#activeSuites.get(suiteKey) : null

      if (suite) {
        suite.children.push(testPayload)
      }
    }

    /**
     * Push title to the failedTestsTitles array
     */
    this.#failedTestsTitles.push(payload.title.original)
  }

  /**
   * Process the tests events
   */
  processEvent<Event extends keyof RunnerEvents>(event: keyof RunnerEvents, payload: RunnerEvents[Event]) {
    switch (event) {
      case 'runner:import_error':
        this.#importErrors.push(payload as RunnerEvents['runner:import_error'])
        break
      case 'suite:start':
        this.#onSuiteStart(payload as RunnerEvents['suite:start'])
        break
      case 'suite:end':
        this.#onSuiteEnd(payload as RunnerEvents['suite:end'])
        break
      case 'group:start':
        this.#onGroupStart(payload as RunnerEvents['group:start'])
        break
      case 'group:end':
        this.#onGroupEnd(payload as RunnerEvents['group:end'])
        break
      case 'test:end':
        this.#onTestEnd(payload as RunnerEvents['test:end'])
        break
      case 'runner:start':
        this.#timeTracker = timeSpan()
        break
      case 'runner:end':
        this.#duration = this.#timeTracker?.rounded() ?? 0
        break
    }
  }

  /**
   * Returns the tests runner summary
   */
  getSummary(): RunnerSummary {
    return {
      aggregates: this.#aggregates,
      hasError: this.#aggregates.failed > 0 || this.#failureTree.length > 0 || this.#importErrors.length > 0,
      duration: this.#duration,
      failureTree: this.#failureTree,
      failedTestsTitles: this.#failedTestsTitles,
      importErrors: this.#importErrors,
    }
  }
}
