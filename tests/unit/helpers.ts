import { ErrorsPrinter } from '@japa/errors-printer'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import glob from 'fast-glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const testsDir = path.resolve(__dirname, '..')

/**
 * Helper function that wraps assertions and prints errors using ErrorsPrinter
 * This is original Japa helper.
 *
 * @param fn Function that contains assertions
 */
export async function wrapAssertions(fn: () => void | Promise<void>) {
  try {
    await fn()
  } catch (error) {
    await new ErrorsPrinter().printError(error)
    throw new Error('Assertion failure', { cause: error })
  }
}

let cachedTestFiles: string[] | undefined

/**
 * Returns list of all test files in the tests directory.
 *
 * The files have relative paths to the tests directory:
 *
 * @example
 * ```
 * ["unit/config_manager.spec.ts"]
 * ```
 *
 * @returns Array of test file paths
 */
export async function listAllTestFiles(): Promise<string[]> {
  if (cachedTestFiles) {
    return cachedTestFiles
  }

  cachedTestFiles = await glob('**/*.spec.ts', {
    cwd: testsDir,
  })

  // The same as FileManager
  cachedTestFiles.sort((current, next) => {
    return current.localeCompare(next, undefined, { numeric: true, sensitivity: 'base' })
  })

  return cachedTestFiles
}
