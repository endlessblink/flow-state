import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Vue composition API functions that commonly need imports
const VUE_COMPOSITION_API = [
  'ref', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted',
  'onUnmounted', 'onUpdated', 'nextTick', 'toRefs', 'toRef', 'unref',
  'isRef', 'shallowRef', 'shallowReactive', 'triggerRef', 'customRef',
  'readonly', 'isProxy', 'isReactive', 'markRaw', 'toRaw',
  'provide', 'inject', 'getCurrentInstance'
]

// Get project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')
const srcDir = join(projectRoot, 'src')

describe('Vue Component Import Validation', () => {
  // Recursively find all Vue files
  function findVueFiles(dir: string, files: string[] = []): string[] {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        findVueFiles(fullPath, files)
      } else if (item.endsWith('.vue')) {
        files.push(fullPath)
      }
    }

    return files
  }

  // Extract imports from Vue file content
  function extractImports(content: string): string[] {
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]vue['"]/g
    const imports: string[] = []
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
  function extractUsedVueFunctions(content: string): string[] {
    const scriptMatch = content.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) return []

    const scriptContent = scriptMatch[1]
    const usedFunctions: string[] = []

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

  const vueFiles = findVueFiles(srcDir)

  it('should have all Vue composition API functions properly imported', () => {
    const errors: string[] = []

    for (const filePath of vueFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')

        // Skip files that don't use script setup
        if (!content.includes('<script setup')) {
          continue
        }

        const importedFunctions = extractImports(content)
        const usedFunctions = extractUsedVueFunctions(content)

        // Check for used functions that aren't imported
        for (const usedFunc of usedFunctions) {
          if (!importedFunctions.includes(usedFunc)) {
            errors.push(
              `${relativePath}: Uses '${usedFunc}' but doesn't import it from 'vue'. ` +
              `Add '${usedFunc}' to the import statement.`
            )
          }
        }

        // Check for imported functions that aren't used (optional warning)
        const unusedImports = importedFunctions.filter(imp =>
          imp !== 'default' && // Skip default imports
          VUE_COMPOSITION_API.includes(imp) &&
          !usedFunctions.includes(imp)
        )

        if (unusedImports.length > 0) {
          console.warn(
            `${relativePath}: Potentially unused imports: ${unusedImports.join(', ')}`
          )
        }

      } catch (error) {
        errors.push(`${filePath}: Failed to read or parse file: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.error('\n🚨 Vue Import Validation Errors:')
      errors.forEach(error => console.error(`  ❌ ${error}`))
      console.error('\n')
    }

    expect(errors).toHaveLength(0)
  })

  it('should not have undefined variables in templates', () => {
    const errors: string[] = []

    for (const filePath of vueFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')

        // Extract template content
        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/)
        if (!templateMatch) continue

        const templateContent = templateMatch[1]

        // Extract script setup content
        const scriptMatch = content.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/)
        if (!scriptMatch) continue

        const scriptContent = scriptMatch[1]

        // Find variable declarations in script
        const declaredVars = new Set<string>()

        // Find const/let declarations
        const constLetRegex = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        let match
        while ((match = constLetRegex.exec(scriptContent)) !== null) {
          declaredVars.add(match[1])
        }

        // Find function declarations
        const functionRegex = /\b(?:function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g
        while ((match = functionRegex.exec(scriptContent)) !== null) {
          declaredVars.add(match[1])
        }

        // Find imports
        const importRegex = /import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?\s*\n(?:\s*\/\/.*\n)*\s*(?:\w+\s+as\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        while ((match = importRegex.exec(scriptContent)) !== null) {
          if (match[1]) declaredVars.add(match[1])
        }

        // Simple template variable detection (basic heuristic)
        const templateVarRegex = /\{\{([^}]+)\}\}/g
        const usedVars = new Set<string>()

        while ((match = templateVarRegex.exec(templateContent)) !== null) {
          const varExpression = match[1].trim()
          // Extract the main variable (simple heuristic)
          const mainVar = varExpression.split(/[.\[\(]/)[0].trim()
          if (mainVar && !mainVar.includes(' ') && !mainVar.includes('$')) {
            usedVars.add(mainVar)
          }
        }

        // Check for used variables that aren't declared
        for (const usedVar of usedVars) {
          if (!declaredVars.has(usedVar) &&
              !['true', 'false', 'null', 'undefined'].includes(usedVar) &&
              !usedVar.startsWith('$') && // Skip built-in Vue refs
              !usedVar.match(/^[A-Z]/)) { // Skip component names (PascalCase)
            errors.push(
              `${relativePath}: Template uses undefined variable '${usedVar}'. ` +
              `Make sure it's declared in the script setup.`
            )
          }
        }

      } catch (error) {
        errors.push(`${filePath}: Failed to analyze template variables: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.error('\n🚨 Template Variable Validation Errors:')
      errors.forEach(error => console.error(`  ❌ ${error}`))
      console.error('\n')
    }

    expect(errors).toHaveLength(0)
  })

  it('should have consistent import ordering', () => {
    const errors: string[] = []

    for (const filePath of vueFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')

        // Skip files that don't use script setup
        if (!content.includes('<script setup')) {
          continue
        }

        // Extract import section
        const scriptMatch = content.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/)
        if (!scriptMatch) continue

        const scriptContent = scriptMatch[1]

        // Find all imports
        const importLines: string[] = []
        const lines = scriptContent.split('\n')
        let inImportSection = true

        for (const line of lines) {
          const trimmedLine = line.trim()

          // Stop collecting imports when we hit non-import content
          if (inImportSection && trimmedLine && !trimmedLine.startsWith('import') && !trimmedLine.startsWith('//')) {
            inImportSection = false
          }

          if (inImportSection && trimmedLine.startsWith('import')) {
            importLines.push(trimmedLine)
          }
        }

        // Check if Vue imports come first (convention)
        const vueImportIndex = importLines.findIndex(line => line.includes("from 'vue'"))
        const otherImportIndex = importLines.findIndex(line =>
          line.startsWith('import') && !line.includes("from 'vue'")
        )

        if (vueImportIndex > 0 && otherImportIndex >= 0 && vueImportIndex > otherImportIndex) {
          console.warn(
            `${relativePath}: Vue imports should come before other imports for consistency`
          )
        }

      } catch (error) {
        errors.push(`${filePath}: Failed to analyze import ordering: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.error('\n🚨 Import Ordering Validation Errors:')
      errors.forEach(error => console.error(`  ❌ ${error}`))
      console.error('\n')
    }

    expect(errors).toHaveLength(0)
  })
})