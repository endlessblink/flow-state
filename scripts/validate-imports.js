#!/usr/bin/env node

/**
 * Standalone import validation script
 * Can be run independently or as part of CI/CD pipeline
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Vue composition API functions that commonly need imports
const VUE_COMPOSITION_API = [
  'ref', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted',
  'onUnmounted', 'onUpdated', 'nextTick', 'toRefs', 'toRef', 'unref',
  'isRef', 'shallowRef', 'shallowReactive', 'triggerRef', 'customRef',
  'readonly', 'isProxy', 'isReactive', 'markRaw', 'toRaw',
  'provide', 'inject', 'getCurrentInstance'
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
const srcDir = join(projectRoot, 'src')

class ImportValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  // Recursively find all Vue files
  findVueFiles(dir, files = []) {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        this.findVueFiles(fullPath, files)
      } else if (item.endsWith('.vue')) {
        files.push(fullPath)
      }
    }

    return files
  }

  // Extract imports from Vue file content
  extractImports(content) {
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]vue['"]/g
    const imports = []
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const importedItems = match[1]
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0)
      imports.push(...importedItems)
    }

    return imports
  }

  // Extract used Vue composition API functions from script section
  extractUsedVueFunctions(content) {
    const scriptMatch = content.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) return []

    const scriptContent = scriptMatch[1]
    const usedFunctions = []

    // Find all occurrences of Vue composition API functions
    for (const func of VUE_COMPOSITION_API) {
      // Look for function calls, declarations, or destructuring
      const patterns = [
        `\\b${func}\\s*\\(`,           // function call: ref(
        `\\bconst\\s+.*\\s*=\\s*${func}\\s*\\(`, // const x = ref(
        `\\blet\\s+.*\\s*=\\s*${func}\\s*\\(`,     // let x = ref(
        `\\b${func}\\s*<`,               // generic: ref<
        `\\{[^}]*\\b${func}\\b`,         // destructuring: { ref }
      ]

      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'g')
        if (regex.test(scriptContent)) {
          usedFunctions.push(func)
          break
        }
      }
    }

    return [...new Set(usedFunctions)] // Remove duplicates
  }

  validate() {
    const vueFiles = this.findVueFiles(srcDir)

    console.log(`🔍 Analyzing ${vueFiles.length} Vue files for import issues...\n`)

    for (const filePath of vueFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')

        // Skip files that don't use script setup
        if (!content.includes('<script setup')) {
          continue
        }

        const importedFunctions = this.extractImports(content)
        const usedFunctions = this.extractUsedVueFunctions(content)

        // Check for used functions that aren't imported
        for (const usedFunc of usedFunctions) {
          if (!importedFunctions.includes(usedFunc)) {
            this.errors.push({
              file: relativePath,
              issue: `Uses '${usedFunc}' but doesn't import it from 'vue'`,
              suggestion: `Add '${usedFunc}' to the import statement`
            })
          }
        }

        // Check for imported functions that aren't used (optional warning)
        const unusedImports = importedFunctions.filter(imp =>
          imp !== 'default' && // Skip default imports
          VUE_COMPOSITION_API.includes(imp) &&
          !usedFunctions.includes(imp)
        )

        if (unusedImports.length > 0) {
          this.warnings.push({
            file: relativePath,
            issue: `Potentially unused imports: ${unusedImports.join(', ')}`,
            suggestion: 'Consider removing unused imports'
          })
        }

      } catch (error) {
        this.errors.push({
          file: filePath.replace(projectRoot, ''),
          issue: `Failed to read or parse file: ${error.message}`,
          suggestion: 'Check if file is accessible and has correct syntax'
        })
      }
    }

    return this.errors.length === 0
  }

  printResults() {
    if (this.errors.length > 0) {
      console.error('🚨 Import Validation Errors:')
      this.errors.forEach((error, index) => {
        console.error(`\n${index + 1}. ${error.file}`)
        console.error(`   Issue: ${error.issue}`)
        console.error(`   Suggestion: ${error.suggestion}`)
      })
      console.error('\n')
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️  Import Validation Warnings:')
      this.warnings.forEach((warning, index) => {
        console.warn(`\n${index + 1}. ${warning.file}`)
        console.warn(`   Issue: ${warning.issue}`)
        console.warn(`   Suggestion: ${warning.suggestion}`)
      })
      console.warn('\n')
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All Vue imports are valid!')
    }

    console.log(`📊 Results: ${this.errors.length} errors, ${this.warnings.length} warnings`)
  }
}

// Main execution
function main() {
  const validator = new ImportValidator()
  const isValid = validator.validate()
  validator.printResults()

  // Exit with error code if validation failed
  process.exit(isValid ? 0 : 1)
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { ImportValidator }