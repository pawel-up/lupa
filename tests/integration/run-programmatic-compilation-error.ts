/* eslint-disable no-console */
import { configure, runProgrammatic } from '../../src/runner/index.js'
import { json } from '../../src/reporters/index.js'
import path from 'node:path'

configure({
  files: ['tests/fixtures/integration/dummy.spec.ts'],
  testPlugins: [path.join(process.cwd(), 'src/assert/index.ts')],
  reporters: { activated: [], list: [] },
  vite: {
    plugins: [
      {
        name: 'crash-plugin',
        configureServer(server: any) {
          setTimeout(() => {
            // Simulate Vite catching an esbuild/transform error mid-run
            server.config.logger.error('Fake compilation error', {
              error: new Error('Simulated Vite Compilation Error Boom'),
            })
          }, 500)
        },
      },
    ],
  },
})

runProgrammatic(json())
  .then((result) => {
    console.log('___PROGRAMMATIC_RESULT___' + JSON.stringify(result))
  })
  .catch((e) => {
    // If it gracefully rejects, we can log it so the test can assert it
    console.error('___PROGRAMMATIC_ERROR_CAUGHT___' + String(e))
    process.exit(1)
  })
