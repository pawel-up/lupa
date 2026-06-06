import path from 'node:path'
import { defineConfig } from './src/runner/index.js'

export default defineConfig({
  files: ['tests/fixtures/pinned.spec.ts'],
  testPlugins: [path.join(process.cwd(), 'src/assert/index.ts')],
})
