import { Command } from 'commander'
import { confirm } from '@inquirer/prompts'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import supportsColor from 'supports-color'
import useColors from '@poppinss/colors'
import { renderCancelled, renderCriticalError } from '../errors.js'

const colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '../../../../')

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

export const skillsCommand = new Command('skills')
  .description("Initializes lupa's agent skills directory in the current project.")
  .option('-y, --yes', 'Overwrite existing skills directory without prompting')
  .action(async (options) => {
    const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    const targetDir = path.join(process.cwd(), '.agents', 'skills', 'lupa-testing')
    const sourceDir = path.join(pkgRoot, 'skills', 'pawel-up-lupa')

    if (!existsSync(sourceDir)) {
      renderCriticalError('E_SKILLS_PKG_MISSING', `Could not find skills directory in the package at ${sourceDir}`)
    }

    if (existsSync(targetDir)) {
      if (options.yes) {
        console.log(colors.yellow(`Directory ${targetDir} already exists. Overwriting...`))
        await fs.rm(targetDir, { recursive: true, force: true })
      } else {
        if (!isInteractive) {
          renderCriticalError(
            'E_SKILLS_EXISTS',
            `Directory ${targetDir} already exists. Run with --yes to overwrite in non-interactive mode.`
          )
        }

        const shouldOverwrite = await confirm({
          message: `Directory .agents/skills/lupa-testing already exists. Do you want to overwrite it?`,
          default: false,
        })

        if (!shouldOverwrite) {
          renderCancelled()
        }
        await fs.rm(targetDir, { recursive: true, force: true })
      }
    }

    try {
      console.log(colors.dim('Copying skills from package...'))
      await copyDir(sourceDir, targetDir)
      console.log(colors.green(`\n✓ Successfully copied skills to ${targetDir}`))
    } catch (err) {
      renderCriticalError('E_SKILLS_COPY_FAILED', 'Failed to copy skills directory.', err)
    }
  })
