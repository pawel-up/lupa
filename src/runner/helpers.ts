/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import timekeeper from 'timekeeper'
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
export function printPinnedTests(pinnedTests: string[]) {
  if (pinnedTests.length) {
    console.log(colors.bgYellow().black(` ${pinnedTests.length} pinned test(s) found `))
    pinnedTests.forEach((row) => console.log(row))
    console.log('')
  }
}

export const dateTimeDoubles = {
  reset() {
    timekeeper.reset()
  },
  travelTo(durationOrDate: string | number | Date) {
    if (durationOrDate instanceof Date) {
      timekeeper.travel(durationOrDate)
    } else {
      const travelToDate = new Date()
      travelToDate.setMilliseconds(travelToDate.getMilliseconds() + string.milliseconds.parse(durationOrDate))
      timekeeper.travel(travelToDate)
    }
  },
  freeze(date?: Date) {
    timekeeper.freeze(date)
  },
}
