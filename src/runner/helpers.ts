/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/string'
import useColors from '@poppinss/colors'
import supportsColor from 'supports-color'
import { parse } from 'error-stack-parser-es'
import { type Colors } from '@poppinss/colors/types'
import { fileURLToPath } from 'node:url'

// import { Group } from '../testing/group/main.js'
// import type { Runner } from '../runner/runner.js'

export const colors: Colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()

/**
 * A collection of platform specific icons
 */
export const icons =
  process.platform === 'win32' && !process.env.WT_SESSION
    ? {
        tick: '√',
        cross: '×',
        bullet: '*',
        nodejs: '♦',
        pointer: '>',
        info: 'i',
        warning: '‼',
        branch: ' -',
        squareSmallFilled: '[█]',
        browserLog: '🚧',
      }
    : {
        tick: '✔',
        cross: '✖',
        bullet: '●',
        nodejs: '⬢',
        pointer: '❯',
        info: 'ℹ',
        warning: '⚠',
        branch: '└──',
        squareSmallFilled: '◼',
        browserLog: '🚧',
      }

/**
 * Returns a formatted string to print the information about
 * a pinned test using a transformed stack trace
 */
export function formatPinnedTest(title: string, transformedStack: string) {
  let fileName = ''
  let line = 0
  let column = 0

  const frame = parse({ stack: transformedStack } as Error).find(
    (f) =>
      f.fileName &&
      f.lineNumber !== undefined &&
      f.columnNumber !== undefined &&
      !f.fileName.includes('node:') &&
      !f.fileName.includes('ext:') &&
      !f.fileName.includes('node_modules/')
  )

  if (frame && frame.fileName) {
    fileName = frame.fileName.startsWith('file:')
      ? string.toUnixSlash(fileURLToPath(frame.fileName))
      : string.toUnixSlash(frame.fileName)

    line = frame.lineNumber ?? 0
    column = frame.columnNumber ?? 0
  }

  return `${colors.yellow(` ⁃ ${title}`)}\n${colors.dim(`   ${fileName}:${line}:${column}`)}`
}

/**
 * Prints a summary of all the pinned tests
 */
export function printPinnedTests(pinnedTests: string[]): void {
  if (pinnedTests.length) {
    console.log(colors.bgYellow().black(` ${pinnedTests.length} pinned test(s) found `))
    pinnedTests.forEach((row) => console.log(row))
    console.log('')
  }
}

/**
 * Determines whether two file paths refer to the same file or whether one
 * path is a suffix of the other matching on a directory boundary.
 *
 * Prevents false-positive substring collisions between files like
 * `file.spec.ts` and `superfile.spec.ts`.
 *
 * @param pathA - First path to compare (absolute or relative)
 * @param pathB - Second path to compare (absolute or relative)
 * @returns `true` if the paths match exactly or at a directory boundary; otherwise `false`
 */
export function matchesPath(pathA: string, pathB: string): boolean {
  if (!pathA || !pathB) {
    return false
  }

  const a = string.toUnixSlash(pathA)
  const b = string.toUnixSlash(pathB)

  if (a === b) {
    return true
  }

  const normA = a.startsWith('/') ? a.slice(1) : a
  const normB = b.startsWith('/') ? b.slice(1) : b

  if (!normA || !normB) {
    return false
  }

  if (a.endsWith('/' + normB) || b.endsWith('/' + normA)) {
    return true
  }

  return false
}
