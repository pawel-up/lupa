#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './cli/commands/init.js'
import { skillsCommand } from './cli/commands/skills.js'
import { testCommand } from './cli/commands/test.js'
import readPackageJson from './cli/package_info.js'

import useColors from '@poppinss/colors'
import supportsColor from 'supports-color'
import { renderCriticalError } from './cli/errors.js'

const packageJson = readPackageJson()
const colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()

if (parseInt(process.versions.node) < 22) {
  console.error(
    colors.red(`lupa v${packageJson.version} requires Node.js 22 or higher. You are using v${process.version}`)
  )
  process.exit(1)
}

process.on('SIGINT', () => {
  console.log('\nOperation cancelled.')
  process.exit(0)
})

const program = new Command()

program.name('lupa').description(packageJson.description).version(packageJson.version)

program.addCommand(initCommand)
program.addCommand(skillsCommand)
program.addCommand(testCommand)

program.parseAsync(process.argv).catch((err) => {
  const e = err as Error
  if (e.name === 'ExitPromptError') {
    process.exit(0)
  }

  renderCriticalError('E_UNEXPECTED', 'An unexpected error occurred.', err)
})
