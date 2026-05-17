import axe from 'axe-core'
import type { Assert } from './assert.js'

/**
 * Asserts that a given DOM element or NodeList has no accessibility violations
 * according to axe-core.
 *
 * @remarks
 * This function integrates axe-core to run accessibility checks on a specified context.
 * The `element` parameter can be a CSS selector string, a single DOM element, or a NodeList.
 * When a string is provided, axe-core will query the document for matching elements.
 * Any violations found will be formatted into a readable error message and trigger an assertion failure.
 *
 * @example
 * import { assert } from '@pawel-up/lupa/assert'
 * await assert.isAccessible('#my-element')
 * await assert.isAccessible(document.querySelector('main'))
 *
 * @param assertInstance The main Assert instance to track assertions and evaluate
 * @param element The DOM element(s) to test
 * @param options axe-core run options
 *
 * @returns A Promise that resolves when the assertion has been evaluated.
 */
export async function assertIsAccessible(
  assertInstance: Assert,
  element: Element | NodeList | string,
  options?: axe.RunOptions
): Promise<void> {
  let context: axe.ElementContext
  if (typeof element === 'string') {
    context = element
  } else if (element instanceof NodeList) {
    // axe-core allows NodeList as ContextObject
    context = element as unknown as axe.ElementContext
  } else {
    context = element as axe.ElementContext
  }

  // Ensure axe runs
  const results = await axe.run(context, options ?? {})

  const hasViolations = results.violations.length > 0

  if (!hasViolations) {
    assertInstance.evaluate(true, 'expected element to be accessible', {
      actual: 'accessible',
      expected: 'accessible',
      operator: 'isAccessible',
      showDiff: false,
    })
    return
  }

  // Format the violations into a readable string
  const formatViolation = (violation: axe.Result) => {
    const nodes = violation.nodes.map((node) => {
      const target = node.target.join(', ')
      return `  - Element: ${target}\n    Failure Summary: ${node.failureSummary}`
    })

    return `Rule: ${violation.id}\nDescription: ${violation.description}\nHelp: ${violation.help} (${violation.helpUrl})\nImpact: ${violation.impact}\nViolating Nodes:\n${nodes.join('\n')}`
  }

  const errorMessage = `Accessibility violations found:\n\n${results.violations.map(formatViolation).join('\n\n')}`

  assertInstance.evaluate(false, errorMessage, {
    actual: `${results.violations.length} violations`,
    expected: '0 violations',
    operator: 'isAccessible',
    showDiff: false,
  })
}
