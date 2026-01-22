# ESLint Watch Mode Implementation Guide

This guide documents how to implement a real-time ESLint watcher for Vue 3 + TypeScript projects using ESLint's flat config system.

## Overview

The lint watcher provides:
- Real-time linting on file save
- Colored console output with clear error/warning display
- Debounced execution to prevent excessive runs
- Initial full-project lint on startup
- Support for `.ts`, `.tsx`, and `.vue` files

## Prerequisites

- Node.js >= 20.x
- ESLint >= 8.57.0 (required for `loadESLint` API)
- Project must use `"type": "module"` in package.json (ESM)
- chokidar for file watching

## Installation

### 1. Install Dependencies

```bash
npm install --save-dev eslint chokidar
npm install --save-dev @eslint/js typescript-eslint eslint-plugin-vue vue-eslint-parser
```

### 2. Create the Watch Script

Create `scripts/lint-watch.js`:

```javascript
#!/usr/bin/env node
import { watch } from 'chokidar'
import path from 'path'
import { fileURLToPath } from 'url'

// Use loadESLint to get the FlatESLint class for flat config (ESLint v8.57.0+)
import { loadESLint } from 'eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Load FlatESLint for flat config support
const ESLint = await loadESLint({ useFlatConfig: true })
const eslint = new ESLint({
  cwd: projectRoot
})

let debounceTimer = null

// Lint all files and show summary
async function lintAll() {
  console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')
  console.log('\x1b[90mRunning initial lint...\x1b[0m\n')

  try {
    const results = await eslint.lintFiles([path.join(projectRoot, 'src/**/*.{ts,tsx,vue}')])

    let totalErrors = 0
    let totalWarnings = 0
    const filesWithIssues = []

    for (const result of results) {
      if (result.messages.length > 0) {
        const relativePath = path.relative(projectRoot, result.filePath)
        filesWithIssues.push({ path: relativePath, messages: result.messages })
        totalErrors += result.errorCount
        totalWarnings += result.warningCount
      }
    }

    // Don't clear on initial lint so output is visible
    console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')

    if (filesWithIssues.length > 0) {
      for (const file of filesWithIssues) {
        console.log(`\x1b[33m${file.path}\x1b[0m`)
        file.messages.forEach(msg => {
          const icon = msg.severity === 2 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'
          console.log(`  ${icon} ${msg.line}:${msg.column}  ${msg.message}  \x1b[90m${msg.ruleId || 'unknown'}\x1b[0m`)
        })
        console.log('')
      }
      console.log(`\x1b[31m${totalErrors} error(s), ${totalWarnings} warning(s) in ${filesWithIssues.length} file(s)\x1b[0m\n`)
    } else {
      console.log(`\x1b[32m✓\x1b[0m All files pass - No issues\n`)
    }

    console.log('\x1b[90mWaiting for file changes... (Ctrl+C to stop)\x1b[0m\n')
  } catch (error) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`)
  }
}

// Lint a single file on change
async function lintFile(filePath) {
  // Only lint .ts, .tsx, and .vue files
  if (!filePath.match(/\.(ts|tsx|vue)$/)) {
    return
  }

  try {
    const results = await eslint.lintFiles([filePath])
    const relativePath = path.relative(projectRoot, filePath)

    // Clear console for fresh output
    console.clear()
    console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')

    if (results.length > 0 && results[0].messages.length > 0) {
      console.log(`\x1b[33m${relativePath}\x1b[0m\n`)
      results[0].messages.forEach(msg => {
        const icon = msg.severity === 2 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'
        console.log(`  ${icon} ${msg.line}:${msg.column}  ${msg.message}`)
        console.log(`    \x1b[90m${msg.ruleId || 'unknown'}\x1b[0m\n`)
      })
      console.log(`\x1b[31m${results[0].errorCount} error(s), ${results[0].warningCount} warning(s)\x1b[0m`)
    } else {
      console.log(`\x1b[32m✓\x1b[0m ${relativePath} - No issues`)
    }

    console.log('\n\x1b[90mWaiting for file changes...\x1b[0m')
  } catch (error) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`)
  }
}

function debouncedLint(filePath) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => lintFile(filePath), 300)
}

// Run initial lint
await lintAll()

// Start watching for changes
const watcher = watch(path.join(projectRoot, 'src'), {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
})
  .on('add', debouncedLint)
  .on('change', debouncedLint)

process.on('SIGINT', async () => {
  console.log('\n\x1b[90mStopping watcher...\x1b[0m')
  await watcher.close()
  process.exit(0)
})
```

### 3. Create ESLint Flat Config

Create `eslint.config.js` at project root:

```javascript
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import * as parserVue from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Global settings
  {
    languageOptions: {
      parser: parserVue,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tseslint.parser,
        project: './tsconfig.json',
        extraFileExtensions: ['.vue']
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    }
  },

  // Vue specific rules
  {
    files: ['**/*.vue'],
    rules: {
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-unused-components': 'warn',
      'vue/no-unused-vars': 'off',
      'vue/require-default-prop': 'error',
      'vue/require-explicit-emits': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        disallowTypeAnnotations: false
      }]
    }
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'prefer-const': 'error'
    }
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.d.ts',
      'vite.config.*',
      'vitest.config.*',
      'eslint.config.*'
    ]
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    }
  }
]
```

### 4. Add npm Scripts

Add to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "lint": "eslint src --max-warnings 0",
    "lint:fix": "eslint src --fix",
    "lint:watch": "node scripts/lint-watch.js"
  }
}
```

## Usage

```bash
# Run linter once
npm run lint

# Auto-fix issues
npm run lint:fix

# Start watch mode (real-time linting)
npm run lint:watch
```

## Output Examples

### Initial Full Lint (with issues)
```
👀 ESLint watching src/**/*.{ts,vue}...

src/components/MyComponent.vue
  ✖ 15:3  'unusedVar' is defined but never used  @typescript-eslint/no-unused-vars
  ⚠ 23:10  Unexpected any  @typescript-eslint/no-explicit-any

src/stores/myStore.ts
  ✖ 8:7  Missing return type on function  @typescript-eslint/explicit-function-return-type

2 error(s), 1 warning(s) in 2 file(s)

Waiting for file changes... (Ctrl+C to stop)
```

### Single File Change (clean)
```
👀 ESLint watching src/**/*.{ts,vue}...

✓ src/components/MyComponent.vue - No issues

Waiting for file changes...
```

## Key Implementation Details

### Why loadESLint?

ESLint v8.57.0+ provides `loadESLint()` which returns the appropriate ESLint class based on config type:
- With `useFlatConfig: true`, it returns `FlatESLint` for the new flat config format
- This is required when using `eslint.config.js` instead of `.eslintrc.*`

### Debouncing

The 300ms debounce prevents multiple rapid lints when editors auto-save or format on save:

```javascript
function debouncedLint(filePath) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => lintFile(filePath), 300)
}
```

### Console Colors

ANSI escape codes provide colored output:
- `\x1b[31m` - Red (errors)
- `\x1b[33m` - Yellow (warnings, filenames)
- `\x1b[32m` - Green (success)
- `\x1b[36m` - Cyan (info)
- `\x1b[90m` - Gray (metadata)
- `\x1b[0m` - Reset

### Graceful Shutdown

The SIGINT handler ensures clean exit:

```javascript
process.on('SIGINT', async () => {
  console.log('\n\x1b[90mStopping watcher...\x1b[0m')
  await watcher.close()
  process.exit(0)
})
```

## Customization

### Change Watch Directory

Modify the chokidar watch path:

```javascript
const watcher = watch(path.join(projectRoot, 'src'), {  // Change 'src' to your dir
```

### Change File Extensions

Update the regex filter in `lintFile()`:

```javascript
if (!filePath.match(/\.(ts|tsx|vue|js|jsx)$/)) {  // Add extensions as needed
```

### Disable Console Clear

Remove `console.clear()` from `lintFile()` to keep full history.

### Add Sound Notification

```javascript
// After error detection
if (totalErrors > 0) {
  process.stdout.write('\x07')  // System bell
}
```

## Troubleshooting

### "Cannot find module 'eslint'"
```bash
npm install eslint --save-dev
```

### "loadESLint is not a function"
Update ESLint to v8.57.0+:
```bash
npm install eslint@latest --save-dev
```

### "parserOptions.project" errors
Ensure tsconfig.json includes all linted files:
```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

### Flat config not detected
Ensure `eslint.config.js` is at project root and `"type": "module"` is in package.json.

## Integration with IDE

The watch mode works alongside IDE ESLint extensions. For best results:
1. Configure your IDE to use the project's ESLint
2. Enable "lint on save" in your IDE
3. Run `npm run lint:watch` in a terminal for real-time feedback during development
