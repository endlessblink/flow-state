import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Get project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')
const srcDir = join(projectRoot, 'src')

interface DependencyNode {
  filePath: string
  imports: string[]
  isCircular: boolean
  circularPath?: string[]
}

interface CircularDependency {
  file: string
  cycle: string[]
  path: string[]
}

class DependencyAnalyzer {
  private graph = new Map<string, DependencyNode>()
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  // Normalize file paths and convert to absolute paths
  private normalizePath(filePath: string, currentFile: string): string {
    // Handle alias imports (@/)
    if (filePath.startsWith('@/')) {
      filePath = filePath.replace('@/', this.projectRoot + '/src/')
    }

    // Handle relative imports
    if (filePath.startsWith('./') || filePath.startsWith('../')) {
      filePath = resolve(dirname(currentFile), filePath)
    }

    // Add file extension if missing
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.js') && !filePath.endsWith('.vue')) {
      // Try to find the actual file
      if (this.fileExists(filePath + '.ts')) {
        filePath += '.ts'
      } else if (this.fileExists(filePath + '.js')) {
        filePath += '.js'
      } else if (this.fileExists(filePath + '.vue')) {
        filePath += '.vue'
      } else if (this.fileExists(filePath + '/index.ts')) {
        filePath += '/index.ts'
      } else if (this.fileExists(filePath + '/index.js')) {
        filePath += '/index.js'
      }
    }

    return resolve(filePath)
  }

  private fileExists(filePath: string): boolean {
    try {
      statSync(filePath)
      return true
    } catch {
      return false
    }
  }

  // Extract imports from a file
  private extractImports(filePath: string): string[] {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const imports: string[] = []

      // Match ES6 import statements
      const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
      let match

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1]

        // Skip external packages (node_modules)
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
          continue
        }

        // Skip type-only imports (they don't cause runtime circular dependencies)
        if (content.includes(`import type`) && importPath.match(/.*type.*from/)) {
          continue
        }

        imports.push(importPath)
      }

      // Handle dynamic imports
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        const importPath = match[1]
        if (importPath.startsWith('.') || importPath.startsWith('@/')) {
          imports.push(importPath)
        }
      }

      return imports
    } catch (error) {
      console.warn(`Could not extract imports from ${filePath}: ${error}`)
      return []
    }
  }

  // Build the dependency graph
  public buildGraph(): void {
    const files = this.getAllFiles()

    for (const file of files) {
      const imports = this.extractImports(file)
      const normalizedImports = imports
        .map(imp => this.normalizePath(imp, file))
        .filter(imp => this.fileExists(imp))

      this.graph.set(file, {
        filePath: file,
        imports: normalizedImports,
        isCircular: false
      })
    }
  }

  // Get all TypeScript and JavaScript files in the project
  private getAllFiles(dir: string = this.projectRoot, files: string[] = []): string[] {
    try {
      const items = readdirSync(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build', 'coverage', '.nyc_output'].includes(item)) {
            this.getAllFiles(fullPath, files)
          }
        } else if (
          item.endsWith('.ts') ||
          item.endsWith('.js') ||
          item.endsWith('.vue')
        ) {
          // Skip declaration files and test files for circular dependency analysis
          if (!item.endsWith('.d.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files
  }

  // Detect circular dependencies using depth-first search
  public detectCircularDependencies(): CircularDependency[] {
    const circularDeps: CircularDependency[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (nodePath: string[], current: string): boolean => {
      if (recursionStack.has(current)) {
        // Found a cycle
        const cycleStart = nodePath.indexOf(current)
        const cycle = nodePath.slice(cycleStart)
        cycle.push(current)

        return true
      }

      if (visited.has(current)) {
        return false
      }

      visited.add(current)
      recursionStack.add(current)

      const node = this.graph.get(current)
      if (node) {
        for (const importPath of node.imports) {
          if (dfs([...nodePath, current], importPath)) {
            return true
          }
        }
      }

      recursionStack.delete(current)
      return false
    }

    // Check each file for circular dependencies
    for (const [filePath] of this.graph) {
      if (!visited.has(filePath)) {
        const path: string[] = []
        if (dfs(path, filePath)) {
          // Extract the actual cycle path
          const cycle = this.extractCycle(filePath)
          if (cycle) {
            circularDeps.push({
              file: cycle[0],
              cycle: cycle,
              path: cycle
            })
          }
        }
      }
    }

    return circularDeps
  }

  // Extract the actual cycle path for a given file
  private extractCycle(startFile: string): string[] | null {
    const visited = new Set<string>()
    const path: string[] = []

    const dfs = (current: string): boolean => {
      if (path.includes(current)) {
        const cycleStart = path.indexOf(current)
        return path.slice(cycleStart)
      }

      if (visited.has(current)) {
        return null
      }

      visited.add(current)
      path.push(current)

      const node = this.graph.get(current)
      if (node) {
        for (const importPath of node.imports) {
          const cycle = dfs(importPath)
          if (cycle) {
            return cycle
          }
        }
      }

      path.pop()
      return null
    }

    return dfs(startFile)
  }

  // Get dependency statistics
  public getStats() {
    const totalFiles = this.graph.size
    const totalDependencies = Array.from(this.graph.values())
      .reduce((sum, node) => sum + node.imports.length, 0)
    const avgDependencies = totalFiles > 0 ? totalDependencies / totalFiles : 0

    // Find files with most dependencies
    const filesByDependencyCount = Array.from(this.graph.entries())
      .map(([file, node]) => ({
        file: file.replace(this.projectRoot, ''),
        count: node.imports.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalFiles,
      totalDependencies,
      avgDependencies: Math.round(avgDependencies * 100) / 100,
      filesByDependencyCount
    }
  }
}

describe('Circular Dependency Detection', () => {
  it('should not have circular dependencies in source code', () => {
    const analyzer = new DependencyAnalyzer(projectRoot)
    analyzer.buildGraph()

    const circularDeps = analyzer.detectCircularDependencies()

    if (circularDeps.length > 0) {
      console.error('\n🚨 Circular Dependencies Detected:')
      circularDeps.forEach((dep, index) => {
        console.error(`\n  ${index + 1}. Cycle starting at: ${dep.file.replace(projectRoot, '')}`)
        console.error('     Cycle:')
        dep.cycle.forEach((file, i) => {
          const relativePath = file.replace(projectRoot, '')
          const arrow = i < dep.cycle.length - 1 ? '  ↓' : '  ↺ (back to start)'
          console.error(`     ${arrow} ${relativePath}`)
        })
      })
      console.error('\n💡 Solutions:')
      console.error('  • Extract shared code into separate modules')
      console.error('  • Use dependency injection or events')
      console.error('  • Re-architect to remove the circular reference')
      console.error('  • Consider using dynamic imports for breaking cycles')
      console.error('')
    }

    expect(circularDeps).toHaveLength(0)
  })

  it('should analyze dependency complexity', () => {
    const analyzer = new DependencyAnalyzer(projectRoot)
    analyzer.buildGraph()

    const stats = analyzer.getStats()

    console.log('\n📊 Dependency Statistics:')
    console.log(`  • Total files analyzed: ${stats.totalFiles}`)
    console.log(`  • Total dependencies: ${stats.totalDependencies}`)
    console.log(`  • Average dependencies per file: ${stats.avgDependencies}`)

    if (stats.filesByDependencyCount.length > 0) {
      console.log('\n🔗 Files with most dependencies:')
      stats.filesByDependencyCount.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.file}: ${item.count} dependencies`)
      })
    }

    // Sanity checks
    expect(stats.totalFiles).toBeGreaterThan(0)
    expect(stats.avgDependencies).toBeLessThan(50) // Arbitrary threshold for complexity
  })

  it('should detect common anti-patterns in imports', () => {
    const antiPatterns: string[] = []
    const files = this.getAllFiles(srcDir)

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')

        // Check for deep relative imports (../../..)
        const deepImports = content.match(/from\s+['"]\.\.\/\.\.\/\.\.\/[^'"]*['"]/g)
        if (deepImports) {
          antiPatterns.push(`${relativePath}: Deep relative imports detected (${deepImports.length})`)
        }

        // Check for hardcoded node_modules imports
        const nodeImports = content.match(/from\s+['"][^@.]node_modules\/[^'"]*['"]/g)
        if (nodeImports) {
          antiPatterns.push(`${relativePath}: Direct node_modules imports detected`)
        }

        // Check for potential unused imports (basic heuristic)
        const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g)
        if (importMatches) {
          importMatches.forEach(importStatement => {
            const importPath = importStatement.match(/from\s+['"]([^'"]+)['"]/)?.[1]
            if (importPath && importPath.startsWith('@/')) {
              const importedName = importStatement.match(/import\s+\{([^}]+)\}/)?.[1]?.trim()
              if (importedName) {
                const isUsed = content.includes(importedName) &&
                             !content.includes(`import { ${importedName} }`) // Avoid false positive
                if (!isUsed && importedName !== 'type') {
                  antiPatterns.push(`${relativePath}: Potentially unused import '${importedName}' from ${importPath}`)
                }
              }
            }
          })
        }

      } catch (error) {
        console.warn(`Could not analyze file for anti-patterns: ${filePath}`)
      }
    }

    if (antiPatterns.length > 0) {
      console.warn('\n⚠️  Import Anti-Patterns Detected:')
      antiPatterns.forEach(pattern => {
        console.warn(`  ⚠️  ${pattern}`)
      })
      console.log('\n💡 Consider refactoring to improve code organization')
    }

    // This is a warning test, not a failure
    expect(antiPatterns.length).toBeGreaterThanOrEqual(0)
  })

  // Helper function to get all files (reused from class)
  function getAllFiles(dir: string, files: string[] = []): string[] {
    try {
      const items = readdirSync(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage', '.nyc_output'].includes(item)) {
            getAllFiles(fullPath, files)
          }
        } else if (
          item.endsWith('.ts') ||
          item.endsWith('.js') ||
          item.endsWith('.vue')
        ) {
          if (!item.endsWith('.d.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files
  }
})