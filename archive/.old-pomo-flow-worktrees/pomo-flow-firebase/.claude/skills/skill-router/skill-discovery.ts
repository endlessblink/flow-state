/**
 * Automatic Skill Discovery and Integration System
 * Scans for new skills, generates routing patterns, and integrates them automatically
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { execSync } from 'child_process'

// Types
interface SkillMetadata {
  name: string
  description: string
  keywords?: string[]
  category?: string
  priority?: number
  patterns?: string[]
  path: string
  folderName: string
  lastModified: Date
}

interface GeneratedPattern {
  pattern: string
  confidence: number
  source: 'name' | 'description' | 'keywords' | 'category'
  reason: string
}

interface DiscoveredSkill {
  metadata: SkillMetadata
  generatedPatterns: GeneratedPattern[]
  suggestedCategory: string
  suggestedPriority: number
  conflicts: string[]
}

interface DiscoveryResult {
  newSkills: DiscoveredSkill[]
  updatedSkills: DiscoveredSkill[]
  removedSkills: string[]
  conflicts: Array<{
    skill1: string
    skill2: string
    conflictingPatterns: string[]
  }>
  summary: {
    totalSkills: number
    newSkillsCount: number
    updatedSkillsCount: number
    removedSkillsCount: number
    conflictsCount: number
  }
}

class SkillDiscoveryEngine {
  private skillsPath: string
  private configPath: string
  private backupPath: string
  private knownSkills: Map<string, SkillMetadata> = new Map()
  private categoryMap: Map<string, string[]> = new Map()

  constructor(skillsPath: string = join(__dirname, '..'), configPath?: string) {
    this.skillsPath = skillsPath
    this.configPath = configPath || join(skillsPath, 'skill-router', 'routing-config.json')
    this.backupPath = join(skillsPath, 'skill-router', 'backups')
    this.initializeCategoryMap()
    this.loadKnownSkills()
  }

  /**
   * Initialize category mapping for skill classification
   */
  private initializeCategoryMap(): void {
    this.categoryMap.set('testing', [
      'test', 'testing', 'verify', 'validation', 'check', 'assert', 'spec', 'e2e'
    ])

    this.categoryMap.set('debugging', [
      'debug', 'fix', 'bug', 'error', 'issue', 'problem', 'broken', 'troubleshoot'
    ])

    this.categoryMap.set('development', [
      'create', 'build', 'implement', 'add', 'develop', 'code', 'component', 'feature'
    ])

    this.categoryMap.set('performance', [
      'performance', 'optimize', 'speed', 'slow', 'fast', 'lag', 'improve', 'enhance'
    ])

    this.categoryMap.set('ui', [
      'ui', 'ux', 'interface', 'design', 'style', 'theme', 'visual', 'layout'
    ])

    this.categoryMap.set('state', [
      'state', 'store', 'data', 'persist', 'save', 'load', 'storage', 'database'
    ])

    this.categoryMap.set('integration', [
      'integration', 'connect', 'link', 'bridge', 'api', 'endpoint', 'service'
    ])

    this.categoryMap.set('planning', [
      'plan', 'architecture', 'design', 'structure', 'organize', 'refactor'
    ])
  }

  /**
   * Load existing known skills from config
   */
  private loadKnownSkills(): void {
    try {
      const configData = readFileSync(this.configPath, 'utf-8')
      const config = JSON.parse(configData)

      // Extract skills from existing routing patterns
      Object.entries(config.routingPatterns || {}).forEach(([key, pattern]: [string, any]) => {
        this.knownSkills.set(pattern.skill, {
          name: pattern.skill,
          description: pattern.description || '',
          path: '',
          folderName: pattern.skill,
          lastModified: new Date(),
          priority: pattern.priority || 5,
          category: this.inferCategory(pattern.skill, pattern.description || '')
        })
      })
    } catch (error) {
      console.log('No existing config found, starting fresh')
    }
  }

  /**
   * Discover all skills in the skills directory
   */
  public async discoverSkills(): Promise<DiscoveryResult> {
    console.log('🔍 Starting skill discovery...')

    const currentSkills = await this.scanSkillsDirectory()
    const newSkills = this.identifyNewSkills(currentSkills)
    const updatedSkills = this.identifyUpdatedSkills(currentSkills)
    const removedSkills = this.identifyRemovedSkills(currentSkills)
    const conflicts = this.detectConflicts([...newSkills, ...updatedSkills])

    const result: DiscoveryResult = {
      newSkills,
      updatedSkills,
      removedSkills,
      conflicts,
      summary: {
        totalSkills: currentSkills.length,
        newSkillsCount: newSkills.length,
        updatedSkillsCount: updatedSkills.length,
        removedSkillsCount: removedSkills.length,
        conflictsCount: conflicts.length
      }
    }

    console.log(`✅ Discovery complete: ${result.summary.newSkillsCount} new, ${result.summary.updatedSkillsCount} updated, ${result.summary.removedSkillsCount} removed`)
    return result
  }

  /**
   * Scan the skills directory for SKILL.md files
   */
  private async scanSkillsDirectory(): Promise<DiscoveredSkill[]> {
    const skills: DiscoveredSkill[] = []

    if (!existsSync(this.skillsPath)) {
      console.log(`Skills directory not found: ${this.skillsPath}`)
      return skills
    }

    const items = readdirSync(this.skillsPath, { withFileTypes: true })

    for (const item of items) {
      if (item.isDirectory() && item.name !== 'skill-router') {
        const skillPath = join(this.skillsPath, item.name)
        const skillMdPath = join(skillPath, 'SKILL.md')

        if (existsSync(skillMdPath)) {
          try {
            const metadata = await this.parseSkillMetadata(skillMdPath, item.name)
            const generatedPatterns = this.generatePatterns(metadata)
            const suggestedCategory = this.inferCategory(metadata.name, metadata.description)
            const suggestedPriority = this.suggestPriority(metadata, suggestedCategory)

            const discoveredSkill: DiscoveredSkill = {
              metadata,
              generatedPatterns,
              suggestedCategory,
              suggestedPriority,
              conflicts: []
            }

            skills.push(discoveredSkill)
          } catch (error) {
            console.warn(`Failed to parse skill ${item.name}:`, error)
          }
        }
      }
    }

    return skills
  }

  /**
   * Parse skill metadata from SKILL.md file
   */
  private async parseSkillMetadata(skillMdPath: string, folderName: string): Promise<SkillMetadata> {
    const content = readFileSync(skillMdPath, 'utf-8')
    const stats = statSync(skillMdPath)

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let name = folderName
    let description = ''
    let keywords: string[] = []
    let category: string | undefined
    let priority: number | undefined

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]

      // Parse YAML-like frontmatter
      const nameMatch = frontmatter.match(/name:\s*(.+)/)
      if (nameMatch) name = nameMatch[1].trim()

      const descMatch = frontmatter.match(/description:\s*(.+)/)
      if (descMatch) description = descMatch[1].trim()

      const keywordsMatch = frontmatter.match(/keywords:\s*\[(.+)\]/)
      if (keywordsMatch) {
        keywords = keywordsMatch[1].split(',').map(k => k.trim().replace(/['"]/g, ''))
      }

      const categoryMatch = frontmatter.match(/category:\s*(.+)/)
      if (categoryMatch) category = categoryMatch[1].trim()

      const priorityMatch = frontmatter.match(/priority:\s*(\d+)/)
      if (priorityMatch) priority = parseInt(priorityMatch[1])
    }

    return {
      name,
      description,
      keywords,
      category,
      priority,
      path: skillMdPath,
      folderName,
      lastModified: stats.mtime
    }
  }

  /**
   * Generate routing patterns for a skill
   */
  private generatePatterns(metadata: SkillMetadata): GeneratedPattern[] {
    const patterns: GeneratedPattern[] = []

    // Generate patterns from skill name
    patterns.push(...this.generateNamePatterns(metadata.name))

    // Generate patterns from description
    if (metadata.description) {
      patterns.push(...this.generateDescriptionPatterns(metadata.description))
    }

    // Generate patterns from keywords
    if (metadata.keywords && metadata.keywords.length > 0) {
      patterns.push(...this.generateKeywordPatterns(metadata.keywords))
    }

    // Generate patterns from category
    if (metadata.category) {
      patterns.push(...this.generateCategoryPatterns(metadata.category))
    }

    // Sort by confidence and remove duplicates
    const uniquePatterns = patterns.filter((pattern, index, arr) =>
      arr.findIndex(p => p.pattern === pattern.pattern) === index
    )

    return uniquePatterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10)
  }

  /**
   * Generate patterns from skill name
   */
  private generateNamePatterns(name: string): GeneratedPattern[] {
    const patterns: GeneratedPattern[] = []
    const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
    const words = normalized.split(/\s+/).filter(w => w.length > 2)

    if (words.length === 0) return patterns

    // Direct name match
    patterns.push({
      pattern: `${normalized.replace(/\s+/g, '.*')}.*`,
      confidence: 0.9,
      source: 'name',
      reason: `Direct skill name match: "${name}"`
    })

    // Individual word patterns
    words.forEach(word => {
      patterns.push({
        pattern: `${word}.*`,
        confidence: 0.6,
        source: 'name',
        reason: `Keyword from skill name: "${word}"`
      })
    })

    // Word combinations
    if (words.length >= 2) {
      for (let i = 0; i < words.length - 1; i++) {
        patterns.push({
          pattern: `${words[i]}.*${words[i + 1]}.*`,
          confidence: 0.8,
          source: 'name',
          reason: `Word combination from skill name: "${words[i]} ${words[i + 1]}"`
        })
      }
    }

    return patterns
  }

  /**
   * Generate patterns from description
   */
  private generateDescriptionPatterns(description: string): GeneratedPattern[] {
    const patterns: GeneratedPattern[] = []
    const normalized = description.toLowerCase()

    // Extract action verbs and key terms
    const actionWords = ['create', 'build', 'fix', 'debug', 'test', 'optimize', 'implement', 'add', 'update', 'refactor']
    const techWords = ['component', 'service', 'api', 'store', 'state', 'timer', 'canvas', 'drag', 'drop', 'vue', 'react', 'javascript', 'typescript']

    actionWords.forEach(action => {
      if (normalized.includes(action)) {
        patterns.push({
          pattern: `${action}.*`,
          confidence: 0.7,
          source: 'description',
          reason: `Action word from description: "${action}"`
        })
      }
    })

    techWords.forEach(tech => {
      if (normalized.includes(tech)) {
        patterns.push({
          pattern: `${tech}.*`,
          confidence: 0.6,
          source: 'description',
          reason: `Technical term from description: "${tech}"`
        })
      }
    })

    // Extract significant phrases (3+ word combinations)
    const words = normalized.split(/\s+/).filter(w => w.length > 3)
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]}.*${words[i + 1]}.*${words[i + 2]}.*`
      patterns.push({
        pattern: phrase,
        confidence: 0.5,
        source: 'description',
        reason: `Phrase from description: "${words[i]} ${words[i + 1]} ${words[i + 2]}"`
      })
    }

    return patterns
  }

  /**
   * Generate patterns from keywords
   */
  private generateKeywordPatterns(keywords: string[]): GeneratedPattern[] {
    return keywords.map(keyword => ({
      pattern: `${keyword.toLowerCase()}.*`,
      confidence: 0.8,
      source: 'keywords',
      reason: `Explicit keyword: "${keyword}"`
    }))
  }

  /**
   * Generate patterns from category
   */
  private generateCategoryPatterns(category: string): GeneratedPattern[] {
    const categoryLower = category.toLowerCase()
    return [{
      pattern: `${categoryLower}.*`,
      confidence: 0.4,
      source: 'category',
      reason: `Category match: "${category}"`
    }]
  }

  /**
   * Infer skill category from name and description
   */
  private inferCategory(name: string, description: string): string {
    const combined = `${name} ${description}`.toLowerCase()

    let bestCategory = 'development'
    let bestScore = 0

    for (const [category, keywords] of this.categoryMap.entries()) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (combined.includes(keyword) ? 1 : 0)
      }, 0)

      if (score > bestScore) {
        bestScore = score
        bestCategory = category
      }
    }

    return bestCategory
  }

  /**
   * Suggest priority for skill
   */
  private suggestPriority(metadata: SkillMetadata, category: string): number {
    // Base priority by category
    const categoryPriorities: Record<string, number> = {
      'testing': 10,
      'debugging': 9,
      'performance': 8,
      'development': 7,
      'state': 6,
      'ui': 5,
      'integration': 4,
      'planning': 3
    }

    let priority = categoryPriorities[category] || 5

    // Adjust based on explicit priority
    if (metadata.priority) {
      priority = metadata.priority
    }

    // Boost for critical keywords
    const criticalKeywords = ['timer', 'security', 'deployment', 'production', 'critical']
    const hasCritical = criticalKeywords.some(keyword =>
      metadata.name.toLowerCase().includes(keyword) ||
      metadata.description.toLowerCase().includes(keyword)
    )

    if (hasCritical) {
      priority = Math.min(priority + 2, 10)
    }

    return priority
  }

  /**
   * Identify new skills
   */
  private identifyNewSkills(currentSkills: DiscoveredSkill[]): DiscoveredSkill[] {
    return currentSkills.filter(skill =>
      !this.knownSkills.has(skill.metadata.name)
    )
  }

  /**
   * Identify updated skills
   */
  private identifyUpdatedSkills(currentSkills: DiscoveredSkill[]): DiscoveredSkill[] {
    return currentSkills.filter(skill => {
      const known = this.knownSkills.get(skill.metadata.name)
      return known && known.lastModified < skill.metadata.lastModified
    })
  }

  /**
   * Identify removed skills
   */
  private identifyRemovedSkills(currentSkills: DiscoveredSkill[]): string[] {
    const currentNames = new Set(currentSkills.map(s => s.metadata.name))
    return Array.from(this.knownSkills.keys()).filter(name => !currentNames.has(name))
  }

  /**
   * Detect pattern conflicts
   */
  private detectConflicts(skills: DiscoveredSkill[]): Array<{
    skill1: string
    skill2: string
    conflictingPatterns: string[]
  }> {
    const conflicts: Array<{
      skill1: string
      skill2: string
      conflictingPatterns: string[]
    }> = []

    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const skill1 = skills[i]
        const skill2 = skills[j]

        const conflictingPatterns = skill1.generatedPatterns
          .filter(p1 =>
            skill2.generatedPatterns.some(p2 =>
              p1.pattern === p2.pattern && p1.confidence > 0.7 && p2.confidence > 0.7
            )
          )
          .map(p => p.pattern)

        if (conflictingPatterns.length > 0) {
          conflicts.push({
            skill1: skill1.metadata.name,
            skill2: skill2.metadata.name,
            conflictingPatterns
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Create backup of current config
   */
  private createBackup(): string {
    if (!existsSync(this.backupPath)) {
      mkdirSync(this.backupPath, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = join(this.backupPath, `routing-config-${timestamp}.json`)

    if (existsSync(this.configPath)) {
      const configData = readFileSync(this.configPath, 'utf-8')
      writeFileSync(backupFile, configData)
      console.log(`📋 Backup created: ${backupFile}`)
    }

    return backupFile
  }

  /**
   * Update routing configuration with discovered skills
   */
  public async updateRoutingConfig(discoveryResult: DiscoveryResult): Promise<void> {
    if (discoveryResult.summary.newSkillsCount === 0 &&
        discoveryResult.summary.updatedSkillsCount === 0 &&
        discoveryResult.summary.removedSkillsCount === 0) {
      console.log('ℹ️ No changes to routing configuration needed')
      return
    }

    // Create backup
    this.createBackup()

    // Load current config
    let config: any = { routingPatterns: {} }
    if (existsSync(this.configPath)) {
      const configData = readFileSync(this.configPath, 'utf-8')
      config = JSON.parse(configData)
    }

    // Add new skills
    discoveryResult.newSkills.forEach(skill => {
      const routingPattern = this.createRoutingPattern(skill)
      config.routingPatterns[skill.metadata.folderName] = routingPattern
      console.log(`➕ Added skill: ${skill.metadata.name}`)
    })

    // Update existing skills
    discoveryResult.updatedSkills.forEach(skill => {
      const routingPattern = this.createRoutingPattern(skill)
      config.routingPatterns[skill.metadata.folderName] = routingPattern
      console.log(`🔄 Updated skill: ${skill.metadata.name}`)
    })

    // Remove deleted skills
    discoveryResult.removedSkills.forEach(skillName => {
      const patternKey = Array.from(Object.keys(config.routingPatterns))
        .find(key => config.routingPatterns[key].skill === skillName)

      if (patternKey) {
        delete config.routingPatterns[patternKey]
        console.log(`➖ Removed skill: ${skillName}`)
      }
    })

    // Save updated config
    writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    console.log(`✅ Routing configuration updated successfully`)

    // Update known skills
    this.loadKnownSkills()
  }

  /**
   * Create routing pattern from discovered skill
   */
  private createRoutingPattern(skill: DiscoveredSkill): any {
    const topPatterns = skill.generatedPatterns
      .slice(0, 5)
      .map(p => p.pattern)

    return {
      patterns: topPatterns,
      skill: skill.metadata.name,
      priority: skill.suggestedPriority,
      description: skill.metadata.description,
      category: skill.suggestedCategory,
      autoGenerated: true,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Generate discovery report
   */
  public generateReport(discoveryResult: DiscoveryResult): string {
    let report = '# Skill Discovery Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`

    // Summary
    report += '## Summary\n\n'
    report += `- Total Skills: ${discoveryResult.summary.totalSkills}\n`
    report += `- New Skills: ${discoveryResult.summary.newSkillsCount}\n`
    report += `- Updated Skills: ${discoveryResult.summary.updatedSkillsCount}\n`
    report += `- Removed Skills: ${discoveryResult.summary.removedSkillsCount}\n`
    report += `- Conflicts: ${discoveryResult.summary.conflictsCount}\n\n`

    // New Skills
    if (discoveryResult.newSkills.length > 0) {
      report += '## New Skills\n\n'
      discoveryResult.newSkills.forEach(skill => {
        report += `### ${skill.metadata.name}\n`
        report += `- **Category**: ${skill.suggestedCategory}\n`
        report += `- **Priority**: ${skill.suggestedPriority}\n`
        report += `- **Description**: ${skill.metadata.description}\n`
        report += `- **Generated Patterns**: ${skill.generatedPatterns.length}\n`
        report += `- **Top Patterns**:\n`
        skill.generatedPatterns.slice(0, 3).forEach(p => {
          report += `  - \`${p.pattern}\` (${(p.confidence * 100).toFixed(1)}% - ${p.reason})\n`
        })
        report += '\n'
      })
    }

    // Updated Skills
    if (discoveryResult.updatedSkills.length > 0) {
      report += '## Updated Skills\n\n'
      discoveryResult.updatedSkills.forEach(skill => {
        report += `### ${skill.metadata.name}\n`
        report += `- **Last Modified**: ${skill.metadata.lastModified}\n`
        report += `- **New Patterns**: ${skill.generatedPatterns.length}\n`
        report += '\n'
      })
    }

    // Conflicts
    if (discoveryResult.conflicts.length > 0) {
      report += '## Conflicts\n\n'
      discoveryResult.conflicts.forEach(conflict => {
        report += `### ${conflict.skill1} ↔ ${conflict.skill2}\n`
        report += `- **Conflicting Patterns**: ${conflict.conflictingPatterns.join(', ')}\n\n`
      })
    }

    return report
  }
}

export { SkillDiscoveryEngine, DiscoveryResult, DiscoveredSkill, SkillMetadata, GeneratedPattern }