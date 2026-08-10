import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const sourceExtensions = new Set(['.ts', '.vue'])

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return sourceExtensions.has(extname(entry.name)) ? [path] : []
  })
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

describe('cardinal task consistency renderer authority', () => {
  it('exposes the canonical task ID on the completion control', () => {
    const source = readFileSync(join(sourceRoot, 'components/tasks/HierarchicalTaskRowContent.vue'), 'utf8')

    expect(source).toContain('data-testid="task-completion-toggle"')
    expect(source).toContain(':data-task-id="task.id"')
  })

  it('never resolves an authoritative task identity from the filtered view projection', () => {
    const violations = sourceFiles(sourceRoot).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      const filteredIdentityLookup = /\b[\w$]*(?:task|Task)[\w$]*Store\s*\.\s*tasks(?:\s*\.\s*value)?\s*\.\s*find\s*\(/g
      const directViolations = [...source.matchAll(filteredIdentityLookup)].map(match => {
        return `${relative(process.cwd(), path)}:${lineNumber(source, match.index)}`
      })

      const aliases = [
        ...source.matchAll(
          /\b(?:const|let|var)\s+([\w$]+)\s*=\s*[\w$]*(?:task|Task)[\w$]*Store\s*\.\s*tasks(?:\s*\.\s*value)?/g,
        ),
        ...source.matchAll(
          /\b(?:const|let|var)\s*\{\s*tasks\s*:\s*([\w$]+)\s*\}\s*=\s*[\w$]*(?:task|Task)[\w$]*Store/g,
        ),
      ].map(match => match[1])

      const aliasViolations = aliases.flatMap(alias => {
        const aliasLookup = new RegExp(`\\b${alias}\\s*\\.\\s*find\\s*\\(`, 'g')
        return [...source.matchAll(aliasLookup)].map(match => (
          `${relative(process.cwd(), path)}:${lineNumber(source, match.index)}`
        ))
      })

      return [...directViolations, ...aliasViolations]
    })

    expect(violations).toEqual([])
  })
})
