import supportsColor from 'supports-color'
import useColors from '@poppinss/colors'
import readPackageJson from './package_info.js'

const colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()

/**
 * Renders an error and exits process with 1
 * Error with code and message displayed as 'Error (<code>): <message>'
 * @param code Error code to display
 * @param message Error message to display
 * @param err Optional error object to display
 */
export function renderCriticalError(code: string, message: string, err?: any): never {
  const packageJson = readPackageJson()
  const msg = `lupa v${packageJson.version} — Error (${code}): ${message}`
  console.error(colors.red(msg))

  if (err) {
    console.error(err)
    if (err.stack) {
      console.error(`Please report this bug: ${colors.cyan(createBugReportUrl(err))}\n`)
    }
  }

  process.exit(1)
}

/**
 * Creates a bug report URL for a given error.
 * @param error Error object to create a bug report URL for
 * @returns URL to create a bug report for the given error
 */
function createBugReportUrl(error: Error): string {
  const packageJson = readPackageJson()
  const title = `[${error.name}] ${error.message}`
  const body = `Version: ${packageJson.version}\n\nError:\n${error.stack}`

  return `https://github.com/pawel-up/lupa/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

/**
 * Renders a cancelled message and exits process with 0
 * @param message Message to display
 */
export function renderCancelled(message = 'Operation cancelled.'): never {
  console.log(colors.dim(message))
  process.exit(0)
}
