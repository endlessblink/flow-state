/**
 * Skill Router - Intelligent Skill Selection System
 * Automatically routes to appropriate skills based on user intent and context
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Types
interface RoutingPattern {
  patterns: string[]
  skill: string
  priority: number
  description: string
}

interface MandatoryGate {
  triggers: string[]
  requiredSkills: string[]
  description: string
}

interface ContextualRouting {
  fileBased: Record<string, {
    defaultSkill: string
    additionalContext: string[]
  }>
  viewBased: Record<string, {
    defaultSkill: string
    context: string[]
  }>
}

interface SkillChain {
  [key: string]: string[]
}

interface RoutingConfig {
  version: string
  project: string
  routingPatterns: Record<string, RoutingPattern>
  mandatoryGates: Record<string, MandatoryGate>
  contextualRouting: ContextualRouting
  userOverride: {
    allowExplicitSelection: boolean
    overrideSyntax: {
      explicit: string
      force: string
      skipGates: string
    }
    rememberPreferences: boolean
    learningEnabled: boolean
  }
  routingOptions: {
    caseSensitive: boolean
    fuzzyMatching: boolean
    confidenceThreshold: number
    maxSuggestions: number
    debugMode: boolean
  }
  skillChains: SkillChain
  fallbackBehavior: {
    noMatch: string
    lowConfidence: string
    multipleMatches: string
    gateFailure: string
  }
}

interface RoutingResult {
  selectedSkill: string
  confidence: number
  reasoning: string[]
  mandatoryGates: string[]
  alternativeSkills: Array<{
    skill: string
    confidence: number
    reason: string
  }>
  userOverride: boolean
}

interface RequestContext {
  userInput: string
  currentFile?: string
  currentView?: string
  recentChanges?: string[]
  userPreferences?: Record<string, any>
}

class SkillRouter {
  private config: RoutingConfig
  private userPreferences: Record<string, any> = {}

  constructor(configPath: string = join(__dirname, 'routing-config.json')) {
    this.loadConfig(configPath)
  }

  private loadConfig(configPath: string): void {
    try {
      const configData = readFileSync(configPath, 'utf-8')
      this.config = JSON.parse(configData)
    } catch (error) {
      throw new Error(`Failed to load routing configuration: ${error}`)
    }
  }

  /**
   * Main routing method - selects appropriate skill based on user input and context
   */
  public routeToSkill(context: RequestContext): RoutingResult {
    const { userInput, currentFile, currentView, recentChanges } = context

    // Check for explicit user override first
    const overrideResult = this.checkUserOverride(userInput)
    if (overrideResult) {
      return overrideResult
    }

    // Analyze user intent and match patterns
    const patternMatches = this.matchPatterns(userInput)

    // Apply context-aware routing
    const contextEnhanced = this.applyContextualRouting(patternMatches, context)

    // Check for mandatory quality gates
    const mandatoryGates = this.checkMandatoryGates(userInput)

    // Determine best skill match
    const selectedSkill = this.selectBestSkill(contextEnhanced, mandatoryGates)

    // Generate alternative suggestions
    const alternatives = this.generateAlternatives(contextEnhanced, selectedSkill.skill)

    return {
      ...selectedSkill,
      mandatoryGates: mandatoryGates.requiredSkills,
      alternativeSkills: alternatives,
      userOverride: false
    }
  }

  /**
   * Check for explicit user override commands
   */
  private checkUserOverride(userInput: string): RoutingResult | null {
    const { overrideSyntax } = this.config.userOverride

    // Check for explicit skill selection
    const explicitMatch = userInput.match(new RegExp(`${overrideSyntax.explicit.replace('{skill-name}', '(.+?)')}`, 'i'))
    if (explicitMatch) {
      const skillName = explicitMatch[1]
      return {
        selectedSkill: skillName,
        confidence: 1.0,
        reasoning: [`Explicit user override: ${skillName}`],
        mandatoryGates: [],
        alternativeSkills: [],
        userOverride: true
      }
    }

    // Check for force skill selection (bypasses some checks)
    const forceMatch = userInput.match(new RegExp(`${overrideSyntax.force.replace('{skill-name}', '(.+?)')}`, 'i'))
    if (forceMatch) {
      const skillName = forceMatch[1]
      return {
        selectedSkill: skillName,
        confidence: 1.0,
        reasoning: [`Forced skill selection: ${skillName}`],
        mandatoryGates: [], // Skip gates when forced
        alternativeSkills: [],
        userOverride: true
      }
    }

    return null
  }

  /**
   * Match user input against routing patterns
   */
  private matchPatterns(userInput: string): Array<{skill: string, confidence: number, pattern: string, reason: string}> {
    const matches: Array<{skill: string, confidence: number, pattern: string, reason: string}> = []
    const normalizedInput = this.config.routingOptions.caseSensitive ? userInput : userInput.toLowerCase()

    Object.entries(this.config.routingPatterns).forEach(([category, pattern]) => {
      pattern.patterns.forEach(regexPattern => {
        const regex = new RegExp(regexPattern, this.config.routingOptions.caseSensitive ? 'g' : 'gi')
        if (regex.test(normalizedInput)) {
          const confidence = this.calculateConfidence(normalizedInput, regexPattern, pattern.priority)
          matches.push({
            skill: pattern.skill,
            confidence,
            pattern: regexPattern,
            reason: `Matched pattern '${regexPattern}' in ${category}`
          })
        }
      })
    })

    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate confidence score for pattern matching
   */
  private calculateConfidence(input: string, pattern: string, priority: number): number {
    let confidence = 0.5 // Base confidence

    // Higher priority patterns get higher confidence
    confidence += (priority / 10) * 0.3

    // More specific patterns get higher confidence
    const specificity = pattern.split('.').length
    confidence += (specificity / 5) * 0.2

    // Exact matches get higher confidence
    if (input.includes(pattern.replace('.*', '').replace('\\b', '').trim())) {
      confidence += 0.2
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Apply context-aware routing based on files and views
   */
  private applyContextualRouting(
    patternMatches: Array<{skill: string, confidence: number, pattern: string, reason: string}>,
    context: RequestContext
  ): Array<{skill: string, confidence: number, pattern: string, reason: string, contextReason?: string}> {
    const { currentFile, currentView, recentChanges } = context

    // If we have high-confidence matches, don't override with context
    const topMatch = patternMatches[0]
    if (topMatch && topMatch.confidence > 0.8) {
      return patternMatches.map(m => ({ ...m, contextReason: undefined }))
    }

    const enhancedMatches = [...patternMatches]

    // File-based context routing
    if (currentFile) {
      Object.entries(this.config.contextualRouting.fileBased).forEach(([filePattern, routing]) => {
        if (this.matchesFilePattern(currentFile, filePattern)) {
          const contextBoost = 0.3
          const existingMatch = enhancedMatches.find(m => m.skill === routing.defaultSkill)

          if (existingMatch) {
            existingMatch.confidence = Math.min(existingMatch.confidence + contextBoost, 1.0)
            existingMatch.contextReason = `File context: ${currentFile} matches ${filePattern}`
          } else {
            enhancedMatches.push({
              skill: routing.defaultSkill,
              confidence: 0.4 + contextBoost,
              pattern: filePattern,
              reason: `Default skill for ${filePattern}`,
              contextReason: `File context match`
            })
          }
        }
      })
    }

    // View-based context routing
    if (currentView) {
      Object.entries(this.config.contextualRouting.viewBased).forEach(([view, routing]) => {
        if (currentView.includes(view)) {
          const contextBoost = 0.25
          const existingMatch = enhancedMatches.find(m => m.skill === routing.defaultSkill)

          if (existingMatch) {
            existingMatch.confidence = Math.min(existingMatch.confidence + contextBoost, 1.0)
            existingMatch.contextReason = `View context: ${currentView}`
          } else {
            enhancedMatches.push({
              skill: routing.defaultSkill,
              confidence: 0.3 + contextBoost,
              pattern: view,
              reason: `Default skill for ${view}`,
              contextReason: `View context match`
            })
          }
        }
      })
    }

    return enhancedMatches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Check if file matches pattern
   */
  private matchesFilePattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(filePath)
  }

  /**
   * Check for mandatory quality gates
   */
  private checkMandatoryGates(userInput: string): MandatoryGate & { triggered: boolean } {
    const normalizedInput = userInput.toLowerCase()

    for (const [gateName, gate] of Object.entries(this.config.mandatoryGates)) {
      for (const trigger of gate.triggers) {
        const regex = new RegExp(trigger, 'i')
        if (regex.test(normalizedInput)) {
          return {
            ...gate,
            triggered: true
          }
        }
      }
    }

    return {
      triggers: [],
      requiredSkills: [],
      description: '',
      triggered: false
    }
  }

  /**
   * Select the best skill based on matches and gates
   */
  private selectBestSkill(
    matches: Array<{skill: string, confidence: number, pattern: string, reason: string, contextReason?: string}>,
    gates: MandatoryGate & { triggered: boolean }
  ): { selectedSkill: string, confidence: number, reasoning: string[] } {
    const threshold = this.config.routingOptions.confidenceThreshold

    // Check if we have a confident match
    if (matches.length > 0 && matches[0].confidence >= threshold) {
      const bestMatch = matches[0]
      const reasoning = [bestMatch.reason]

      if (bestMatch.contextReason) {
        reasoning.push(bestMatch.contextReason)
      }

      if (gates.triggered) {
        reasoning.push(`Mandatory quality gates triggered: ${gates.requiredSkills.join(', ')}`)
      }

      return {
        selectedSkill: bestMatch.skill,
        confidence: bestMatch.confidence,
        reasoning
      }
    }

    // No confident match - use fallback behavior
    const fallbackSkill = this.config.fallbackBehavior.noMatch
    return {
      selectedSkill: fallbackSkill,
      confidence: 0.3,
      reasoning: [
        `No confident pattern match found (threshold: ${threshold})`,
        `Using fallback skill: ${fallbackSkill}`,
        gates.triggered ? `Quality gates triggered: ${gates.requiredSkills.join(', ')}` : ''
      ].filter(Boolean)
    }
  }

  /**
   * Generate alternative skill suggestions
   */
  private generateAlternatives(
    matches: Array<{skill: string, confidence: number, pattern: string, reason: string}>,
    selectedSkill: string
  ): Array<{skill: string, confidence: number, reason: string}> {
    const maxSuggestions = this.config.routingOptions.maxSuggestions

    return matches
      .filter(m => m.skill !== selectedSkill && m.confidence > 0.3)
      .slice(0, maxSuggestions)
      .map(m => ({
        skill: m.skill,
        confidence: m.confidence,
        reason: m.reason
      }))
  }

  /**
   * Get skill chain for workflow automation
   */
  public getSkillChain(chainName: string): string[] | null {
    return this.config.skillChains[chainName] || null
  }

  /**
   * Update user preferences based on user behavior
   */
  public updateUserPreferences(skill: string, context: RequestContext, feedback: 'positive' | 'negative'): void {
    if (!this.config.userOverride.learningEnabled) return

    const key = `${context.userInput.substring(0, 50)}_${skill}`
    this.userPreferences[key] = {
      skill,
      feedback,
      timestamp: Date.now(),
      context: {
        file: context.currentFile,
        view: context.currentView
      }
    }
  }

  /**
   * Enable/disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.config.routingOptions.debugMode = enabled
  }

  /**
   * Get router statistics and diagnostics
   */
  public getDiagnostics(): {
    version: string
    totalPatterns: number
    totalGates: number
    debugMode: boolean
    userPreferences: number
  } {
    return {
      version: this.config.version,
      totalPatterns: Object.keys(this.config.routingPatterns).length,
      totalGates: Object.keys(this.config.mandatoryGates).length,
      debugMode: this.config.routingOptions.debugMode,
      userPreferences: Object.keys(this.userPreferences).length
    }
  }
}

// Export for use in skill system
export { SkillRouter, RoutingResult, RequestContext }

// Example usage
if (require.main === module) {
  const router = new SkillRouter()

  // Test examples
  const examples = [
    "I need to fix a bug in the timer",
    "Add drag and drop to the canvas",
    "Test the new feature I just built",
    "The app is running slow",
    "Deploy the application"
  ]

  examples.forEach(example => {
    console.log(`\nInput: "${example}"`)
    const result = router.routeToSkill({ userInput: example })
    console.log(`Selected Skill: ${result.selectedSkill} (${(result.confidence * 100).toFixed(1)}%)`)
    console.log(`Reasoning: ${result.reasoning.join(', ')}`)
    if (result.mandatoryGates.length > 0) {
      console.log(`Mandatory Gates: ${result.mandatoryGates.join(', ')}`)
    }
    if (result.alternativeSkills.length > 0) {
      console.log(`Alternatives: ${result.alternativeSkills.map(a => a.skill).join(', ')}`)
    }
  })
}