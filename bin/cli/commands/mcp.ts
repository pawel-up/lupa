import { Command } from 'commander'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

interface LupaArgs {
  files?: string[]
  suites?: string[]
  tags?: string[]
  tests?: string[]
}

class LupaMcpServer {
  #server: McpServer
  #testCommand: string

  constructor(testCommand: string) {
    this.#server = new McpServer({ name: 'lupa-mcp', version: '1.0.0' })
    this.#testCommand = testCommand
  }

  async #executeLupa(args: LupaArgs, isList: boolean) {
    const { files, suites, tags, tests } = args

    // Construct CLI args for Lupa runner
    const runnerArgs = ['--reporters=json']
    if (isList) runnerArgs.push('--list')

    if (Array.isArray(files) && files.length > 0) runnerArgs.push(`--files=${files.join(',')}`)
    if (Array.isArray(suites) && suites.length > 0) runnerArgs.push(`--groups=${suites.join(',')}`)
    if (Array.isArray(tags) && tags.length > 0) runnerArgs.push(`--tags=${tags.join(',')}`)
    if (Array.isArray(tests) && tests.length > 0) runnerArgs.push(`--tests=${tests.join(',')}`)

    // Prepare the command
    // If it's an npm script, we append -- to pass arguments down to the actual node script
    const isNpm =
      this.#testCommand.startsWith('npm ') ||
      this.#testCommand.startsWith('pnpm ') ||
      this.#testCommand.startsWith('yarn ')
    const cmdArgs = isNpm ? ['--', ...runnerArgs] : runnerArgs

    const fullCmd = `${this.#testCommand} ${cmdArgs.join(' ')}`

    try {
      // We don't care if it exits with code 1 (tests failed), we just want the stdout
      const { stdout, stderr } = await execAsync(fullCmd, { maxBuffer: 1024 * 1024 * 10 }).catch((e) => ({
        stdout: e.stdout,
        stderr: e.stderr,
      }))

      // Extract the JSON block
      const match = stdout.match(/\{\s*"success":[\s\S]*\}\s*$/)

      if (match) {
        try {
          // Verify it's valid JSON
          JSON.parse(match[0])
          return {
            content: [
              {
                type: 'text' as const,
                text: match[0],
              },
            ],
          }
        } catch {
          // Ignore parse errors and fallback to raw output below
        }
      }

      // If no JSON found, fallback to raw output
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to parse test results. Raw Output:\n${stdout}\n${stderr}`,
          },
        ],
        isError: true,
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Execution failed: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  }

  #registerTools() {
    const commonSchema = {
      files: z.array(z.string()).optional().describe('Filter tests by file name'),
      suites: z.array(z.string()).optional().describe('Filter tests by suite/group name'),
      tags: z.array(z.string()).optional().describe('Filter tests by tag'),
    }

    this.#server.registerTool(
      'lupa_run_tests',
      {
        description: 'Run Lupa tests and return structured JSON results. Use this to identify failing tests.',
        inputSchema: {
          ...commonSchema,
          tests: z.array(z.string()).optional().describe('Filter tests by test title'),
        },
      },
      async (args) => this.#executeLupa(args, false)
    )

    this.#server.registerTool(
      'lupa_list_tests',
      {
        description:
          'List all available test files, suites, and tests without running them. Optionally filter the list.',
        inputSchema: commonSchema,
      },
      async (args) => this.#executeLupa(args, true)
    )
  }

  async start() {
    this.#registerTools()
    const transport = new StdioServerTransport()
    await this.#server.connect(transport)
  }
}

export const mcpCommand = new Command('mcp')
  .description('Starts the Lupa MCP server.')
  .option('-c, --test-command <cmd>', 'The command used to run tests (e.g. "npm test")', 'npm test')
  .action(async (options) => {
    const server = new LupaMcpServer(options.testCommand)
    await server.start()
  })
