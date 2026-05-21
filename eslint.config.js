/* eslint-disable no-undef */
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import noOnlyTests from 'eslint-plugin-no-only-tests'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

/**
 * List of files that must be ignored globally
 */
export const GLOBAL_IGNORE_LIST = [
  '.github/',
  '.husky/',
  '.vscode/*',
  'dist/*',
  'coverage/*',
  'node_modules',
  'scripts/*',
  '*.min.*',
  '*.d.ts',
  'CHANGELOG.md',
  'LICENSE*',
  'coverage/**',
  'package-lock.json',
  'examples/',
  '.agents',
  'skills/pawel-up-lupa/references/examples',
]

const commonRules = {
  'max-len': [
    'error',
    {
      code: 120,
      comments: 120,
      ignoreUrls: true,
      ignoreTemplateLiterals: true,
    },
  ],
  'no-unreachable': ['error'],
  'no-multi-spaces': ['error'],
  'no-console': ['error'],
  'no-redeclare': ['error'],
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/no-explicit-any': 'off', // for now...
  '@typescript-eslint/prefer-literal-enum-member': [
    'error',
    {
      allowBitwiseExpressions: true,
    },
  ],
}

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  // eslintConfigPrettier,
  eslintPluginPrettierRecommended,
  includeIgnoreFile(gitignorePath),
  // browser + node files + general
  {
    files: ['**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      ...commonRules,
    },
  },
  // browser related files.
  {
    files: ['src/testing/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      sourceType: 'module',
    },
    rules: {
      'no-restricted-globals': [
        'error',
        ...Object.keys(globals.node).filter(
          // Disallow Node-specific globals (unless they are shared)
          (g) => !Object.prototype.hasOwnProperty.call(globals.browser, g)
        ),
      ],
      ...commonRules,
    },
  },
  // node only files.
  {
    files: ['src/reporters/*.ts', 'src/runner/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    rules: {
      'no-restricted-globals': [
        'error',
        ...Object.keys(globals.browser).filter(
          // Disallow Node-specific globals (unless they are shared)
          (g) => !Object.prototype.hasOwnProperty.call(globals.node, g)
        ),
      ],
      ...commonRules,
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    plugins: {
      'no-only-tests': noOnlyTests,
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-only-tests/no-only-tests': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    files: ['demo/**/*.ts', 'bin/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: GLOBAL_IGNORE_LIST,
  },
]
