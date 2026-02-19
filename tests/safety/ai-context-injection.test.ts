/**
 * AI Context Injection Safety Test (TASK-1350)
 *
 * Ensures that getAIUserContext() is ONLY called from routerFactory.ts
 * (the ContextAwareRouter wrapper). Composables must NOT call it directly —
 * they get context automatically via getSharedRouter().
 *
 * If this test fails, a composable is bypassing the router-level injection.
 * Fix: Remove the direct getAIUserContext() call and let the router handle it.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = process.cwd()

function collectTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectTsFiles(full, files)
    } else if (/\.(ts|vue)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

describe('AI Context Injection Architecture', () => {
  it('getAIUserContext should only be imported in routerFactory.ts and userContext.ts', () => {
    const srcDir = join(projectRoot, 'src')
    const files = collectTsFiles(srcDir)

    // Allowed files that can reference getAIUserContext
    const allowedFiles = [
      'src/services/ai/userContext.ts',   // Definition
      'src/services/ai/routerFactory.ts', // Single consumer (ContextAwareRouter)
    ]

    const violations: string[] = []

    for (const file of files) {
      const relativePath = file.replace(projectRoot + '/', '')

      // Skip allowed files
      if (allowedFiles.some(allowed => relativePath.endsWith(allowed))) continue

      const content = readFileSync(file, 'utf-8')

      // Check for import of getAIUserContext
      if (content.includes('getAIUserContext')) {
        violations.push(relativePath)
      }
    }

    expect(
      violations,
      `These files import getAIUserContext directly — they should use getSharedRouter() instead (TASK-1350 rule #14):\n${violations.join('\n')}`
    ).toEqual([])
  })

  it('composables using AI should go through getSharedRouter, not createAIRouter', () => {
    const composablesDir = join(projectRoot, 'src', 'composables')
    const files = collectTsFiles(composablesDir)

    // These composables are allowed to use createAIRouter directly
    // (they have their own context or don't need user context)
    const exemptions: string[] = [
      // No exemptions — all AI composables must use getSharedRouter for context injection
    ]

    const violations: string[] = []

    for (const file of files) {
      const filename = file.split('/').pop() || ''
      if (exemptions.includes(filename)) continue

      const content = readFileSync(file, 'utf-8')

      // Only check files that do AI work (import from ai/ services)
      if (!content.includes("from '@/services/ai")) continue

      // Check if it uses createAIRouter directly instead of getSharedRouter
      if (content.includes('createAIRouter') && !content.includes('getSharedRouter')) {
        violations.push(file.replace(projectRoot + '/', ''))
      }
    }

    expect(
      violations,
      `These composables use createAIRouter directly — they should use getSharedRouter() for automatic user context injection:\n${violations.join('\n')}`
    ).toEqual([])
  })
})
