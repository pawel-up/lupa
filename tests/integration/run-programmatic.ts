/* eslint-disable no-console */
import { configure, runProgrammatic } from '../../src/runner/index.js'
import { json } from '../../src/reporters/index.js'
import path from 'node:path'

configure({
  files: ['tests/fixtures/integration/dummy.spec.ts'],
  testPlugins: [path.join(process.cwd(), 'src/assert/index.ts')],
  reporters: { activated: [], list: [] },
})

runProgrammatic(json())
  .then((result) => {
    // Prefix it so we can safely extract it from stdout
    console.log('___PROGRAMMATIC_RESULT___' + JSON.stringify(result))
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
