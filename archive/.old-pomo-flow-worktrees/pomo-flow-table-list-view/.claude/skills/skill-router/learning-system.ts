/**
 * Pattern Optimization and Learning System
 * Learns from routing success/failure to improve pattern generation and routing accuracy
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { GeneratedPattern, SkillMetadata } from './skill-discovery'

// Types
interface RoutingEvent {
  id: string
  timestamp: Date
  userInput: string
  selectedSkill: string
  alternativeSkills: string[]
  confidence: number
  matchedPattern?: string
  userFeedback?: 'positive' | 'negative' | 'neutral'
  context: {
    currentFile?: string
    currentView?: string
    sessionDuration: number
  }
  success: boolean
  responseTime: number
}

interface PatternPerformance {
  pattern: string
  skill: string
  totalUses: number
  successfulUses: number
  averageConfidence: number
  averageResponseTime: number
  lastUsed: Date
  successRate: number
  userFeedbackScore: number
}

interface LearningConfig {
  enabled: boolean
  feedbackWeight: number
  performanceWeight: number
  minDataPoints: number
  learningRate: number
  decayRate: number
  maxHistorySize: number
  autoOptimize: boolean
  optimizeThreshold: number
}

interface OptimizationResult {
  optimized: boolean
  patternsModified: number
  performanceImprovement: number
  changes: Array<{
    skill: string
    oldPattern: string
    newPattern: string
    reason: string
    improvement: number
  }>
  errors: string[]
}

class PatternLearningSystem {
  private configPath: string
  private historyPath: string
  private performancePath: string
  private config: LearningConfig
  private routingHistory: RoutingEvent[] = []
  private patternPerformance: Map<string, PatternPerformance> = new Map()

  constructor(
    configPath: string,
    config: Partial<LearningConfig> = {}
  ) {
    this.configPath = configPath
    this.historyPath = join(dirname(configPath), 'learning', 'routing-history.json')
    this.performancePath = join(dirname(configPath), 'learning', 'pattern-performance.json')

    this.config = {
      enabled: true,
      feedbackWeight: 0.6,
      performanceWeight: 0.4,
      minDataPoints: 5,
      learningRate: 0.1,
      decayRate: 0.95,
      maxHistorySize: 10000,
      autoOptimize: true,
      optimizeThreshold: 0.1,
      ...config
    }

    this.loadData()
  }

  /**
   * Load learning data from files
   */
  private loadData(): void {
    try {
      // Load routing history
      if (existsSync(this.historyPath)) {
        const historyData = readFileSync(this.historyPath, 'utf-8')
        this.routingHistory = JSON.parse(historyData)
      }

      // Load pattern performance
      if (existsSync(this.performancePath)) {
        const performanceData = readFileSync(this.performancePath, 'utf-8')
        const performanceArray = JSON.parse(performanceData)
        this.patternPerformance = new Map(
          performanceArray.map((p: any) => [`${p.skill}:${p.pattern}`, p])
        )
      }

      console.log(`📚 Loaded ${this.routingHistory.length} routing events and ${this.patternPerformance.size} pattern performance records`)

    } catch (error) {
      console.log('ℹ️ No existing learning data found, starting fresh')
      this.routingHistory = []
      this.patternPerformance = new Map()
    }
  }

  /**
   * Save learning data to files
   */
  private saveData(): void {
    try {
      // Ensure directory exists
      const learningDir = dirname(this.historyPath)
      if (!existsSync(learningDir)) {
        mkdirSync(learningDir, { recursive: true })
      }

      // Save routing history (with size limit)
      const limitedHistory = this.routingHistory.slice(-this.config.maxHistorySize)
      writeFileSync(this.historyPath, JSON.stringify(limitedHistory, null, 2))

      // Save pattern performance
      const performanceArray = Array.from(this.patternPerformance.values())
      writeFileSync(this.performancePath, JSON.stringify(performanceArray, null, 2))

    } catch (error) {
      console.error('❌ Failed to save learning data:', error)
    }
  }

  /**
   * Record a routing event for learning
   */
  public recordRoutingEvent(event: Omit<RoutingEvent, 'id' | 'timestamp'>): void {
    if (!this.config.enabled) return

    const routingEvent: RoutingEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    }

    this.routingHistory.push(routingEvent)
    this.updatePatternPerformance(routingEvent)
    this.cleanupOldData()

    // Save periodically
    if (this.routingHistory.length % 10 === 0) {
      this.saveData()
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update pattern performance based on routing event
   */
  private updatePatternPerformance(event: RoutingEvent): void {
    if (!event.matchedPattern) return

    const key = `${event.selectedSkill}:${event.matchedPattern}`
    let performance = this.patternPerformance.get(key)

    if (!performance) {
      performance = {
        pattern: event.matchedPattern,
        skill: event.selectedSkill,
        totalUses: 0,
        successfulUses: 0,
        averageConfidence: 0,
        averageResponseTime: 0,
        lastUsed: new Date(),
        successRate: 0,
        userFeedbackScore: 0
      }
      this.patternPerformance.set(key, performance)
    }

    // Update metrics with exponential moving average
    const alpha = this.config.learningRate

    performance.totalUses++
    performance.lastUsed = event.timestamp

    if (event.success) {
      performance.successfulUses++
    }

    performance.successRate = performance.successfulUses / performance.totalUses

    // Update average confidence
    performance.averageConfidence = alpha * event.confidence + (1 - alpha) * performance.averageConfidence

    // Update average response time
    performance.averageResponseTime = alpha * event.responseTime + (1 - alpha) * performance.averageResponseTime

    // Update user feedback score
    if (event.userFeedback) {
      const feedbackScore = event.userFeedback === 'positive' ? 1 : event.userFeedback === 'negative' ? -1 : 0
      performance.userFeedbackScore = alpha * feedbackScore + (1 - alpha) * performance.userFeedbackScore
    }
  }

  /**
   * Clean up old data to prevent memory issues
   */
  private cleanupOldData(): void {
    // Limit routing history size
    if (this.routingHistory.length > this.config.maxHistorySize) {
      this.routingHistory = this.routingHistory.slice(-this.config.maxHistorySize)
    }

    // Remove old pattern performance data
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days
    for (const [key, performance] of this.patternPerformance.entries()) {
      if (performance.lastUsed < cutoffDate && performance.totalUses < this.config.minDataPoints) {
        this.patternPerformance.delete(key)
      }
    }
  }

  /**
   * Get pattern suggestions based on learning
   */
  public getPatternSuggestions(skill: string, userInput: string): Array<{
    pattern: string
    confidence: number
    reason: string
    historicalSuccessRate: number
    averageConfidence: number
  }> {
    const suggestions: Array<{
      pattern: string
      confidence: number
      reason: string
      historicalSuccessRate: number
      averageConfidence: number
    }> = []

    // Find patterns for this skill
    const skillPatterns = Array.from(this.patternPerformance.values())
      .filter(p => p.skill === skill && p.totalUses >= this.config.minDataPoints)

    // Sort by performance score
    const performanceScore = (p: PatternPerformance) => {
      const successWeight = this.config.performanceWeight * p.successRate
      const feedbackWeight = this.config.feedbackWeight * Math.max(0, p.userFeedbackScore)
      const confidenceWeight = p.averageConfidence * 0.2
      return successWeight + feedbackWeight + confidenceWeight
    }

    skillPatterns.sort((a, b) => performanceScore(b) - performanceScore(a))

    // Generate suggestions
    skillPatterns.slice(0, 5).forEach(performance => {
      const score = performanceScore(performance)
      suggestions.push({
        pattern: performance.pattern,
        confidence: Math.min(score, 1.0),
        reason: `Historical success rate: ${(performance.successRate * 100).toFixed(1)}% (${performance.totalUses} uses)`,
        historicalSuccessRate: performance.successRate,
        averageConfidence: performance.averageConfidence
      })
    })

    return suggestions
  }

  /**
   * Analyze routing patterns to identify optimization opportunities
   */
  public analyzePatterns(): {
    underperforming: Array<{ skill: string; pattern: string; issues: string[]; suggestion: string }>
    overperforming: Array<{ skill: string; pattern: string; strength: string; opportunity: string }>
    conflicts: Array<{ skill1: string; skill2: string; pattern: string; suggestion: string }>
  } {
    const underperforming: Array<{ skill: string; pattern: string; issues: string[]; suggestion: string }> = []
    const overperforming: Array<{ skill: string; pattern: string; strength: string; opportunity: string }> = []
    const conflicts: Array<{ skill1: string; skill2: string; pattern: string; suggestion: string }> = []

    // Analyze each pattern
    for (const [key, performance] of this.patternPerformance.entries()) {
      if (performance.totalUses < this.config.minDataPoints) continue

      // Check for underperforming patterns
      if (performance.successRate < 0.6) {
        const issues: string[] = []
        if (performance.successRate < 0.4) issues.push('Low success rate')
        if (performance.userFeedbackScore < -0.3) issues.push('Negative user feedback')
        if (performance.averageConfidence < 0.5) issues.push('Low confidence scores')

        underperforming.push({
          skill: performance.skill,
          pattern: performance.pattern,
          issues,
          suggestion: this.generateOptimizationSuggestion(performance)
        })
      }

      // Check for overperforming patterns
      if (performance.successRate > 0.9 && performance.userFeedbackScore > 0.5) {
        overperforming.push({
          skill: performance.skill,
          pattern: performance.pattern,
          strength: performance.successRate > 0.95 ? 'Exceptional success rate' : 'High success rate',
          opportunity: 'Consider increasing priority or creating similar patterns'
        })
      }
    }

    // Find conflicting patterns
    const patternGroups = new Map<string, PatternPerformance[]>()
    for (const performance of this.patternPerformance.values()) {
      if (!patternGroups.has(performance.pattern)) {
        patternGroups.set(performance.pattern, [])
      }
      patternGroups.get(performance.pattern)!.push(performance)
    }

    for (const [pattern, performances] of patternGroups.entries()) {
      if (performances.length > 1) {
        const sorted = performances.sort((a, b) => b.successRate - a.successRate)
        if (sorted[0].successRate - sorted[1].successRate > 0.3) {
          conflicts.push({
            skill1: sorted[0].skill,
            skill2: sorted[1].skill,
            pattern,
            suggestion: `Consider specializing pattern for ${sorted[0].skill} or removing from ${sorted[1].skill}`
          })
        }
      }
    }

    return { underperforming, overperforming, conflicts }
  }

  /**
   * Generate optimization suggestion for a pattern
   */
  private generateOptimizationSuggestion(performance: PatternPerformance): string {
    if (performance.successRate < 0.4) {
      return 'Pattern is too broad - consider making it more specific'
    }

    if (performance.userFeedbackScore < -0.3) {
      return 'Users find this pattern unhelpful - consider removing or refining'
    }

    if (performance.averageConfidence < 0.5) {
      return 'Low confidence suggests poor pattern matching - review regex'
    }

    return 'Consider reviewing pattern effectiveness and user feedback'
  }

  /**
   * Optimize patterns based on learning data
   */
  public optimizePatterns(currentPatterns: Array<{ skill: string; patterns: string[] }>): OptimizationResult {
    const result: OptimizationResult = {
      optimized: false,
      patternsModified: 0,
      performanceImprovement: 0,
      changes: [],
      errors: []
    }

    if (!this.config.autoOptimize) {
      result.errors.push('Auto-optimization is disabled')
      return result
    }

    try {
      const analysis = this.analyzePatterns()
      let totalImprovement = 0

      // Optimize underperforming patterns
      for (const underperforming of analysis.underperforming) {
        const optimizedPattern = this.optimizePattern(underperforming.pattern, underperforming.issues)

        if (optimizedPattern !== underperforming.pattern) {
          result.changes.push({
            skill: underperforming.skill,
            oldPattern: underperforming.pattern,
            newPattern: optimizedPattern,
            reason: underperforming.issues.join(', '),
            improvement: 0.1 // Estimated improvement
          })

          totalImprovement += 0.1
          result.patternsModified++
        }
      }

      // Handle conflicts
      for (const conflict of analysis.conflicts) {
        const resolution = this.resolveConflict(conflict.skill1, conflict.skill2, conflict.pattern)

        if (resolution) {
          result.changes.push({
            skill: conflict.skill1,
            oldPattern: conflict.pattern,
            newPattern: resolution.pattern1,
            reason: `Resolved conflict with ${conflict.skill2}`,
            improvement: 0.05
          })

          if (resolution.pattern2) {
            result.changes.push({
              skill: conflict.skill2,
              oldPattern: conflict.pattern,
              newPattern: resolution.pattern2,
              reason: `Resolved conflict with ${conflict.skill1}`,
              improvement: 0.05
            })
          }

          totalImprovement += 0.1
          result.patternsModified++
        }
      }

      result.optimized = result.patternsModified > 0
      result.performanceImprovement = totalImprovement

      if (result.optimized) {
        console.log(`🔧 Optimized ${result.patternsModified} patterns with estimated ${(totalImprovement * 100).toFixed(1)}% performance improvement`)
      }

    } catch (error) {
      result.errors.push(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Optimize a single pattern
   */
  private optimizePattern(pattern: string, issues: string[]): string {
    let optimized = pattern

    // Make pattern more specific if too broad
    if (issues.includes('Low success rate')) {
      // Add word boundaries or make more specific
      if (!optimized.includes('\\b')) {
        optimized = optimized.replace(/\*/g, '\\w*')
      }
    }

    // Improve regex quality
    try {
      // Test the regex
      new RegExp(optimized)
    } catch {
      // Fallback to simpler pattern if regex is invalid
      optimized = optimized.replace(/[^a-zA-Z0-9.*\s]/g, '')
    }

    return optimized
  }

  /**
   * Resolve pattern conflict between two skills
   */
  private resolveConflict(skill1: string, skill2: string, pattern: string): { pattern1: string; pattern2?: string } | null {
    const perf1 = this.patternPerformance.get(`${skill1}:${pattern}`)
    const perf2 = this.patternPerformance.get(`${skill2}:${pattern}`)

    if (!perf1 || !perf2) return null

    // If one has significantly better performance, let it keep the pattern
    if (perf1.successRate - perf2.successRate > 0.3) {
      // Modify pattern for skill2 to be more specific
      const moreSpecific = this.makePatternMoreSpecific(pattern, skill2)
      return { pattern1: pattern, pattern2: moreSpecific }
    } else if (perf2.successRate - perf1.successRate > 0.3) {
      // Modify pattern for skill1 to be more specific
      const moreSpecific = this.makePatternMoreSpecific(pattern, skill1)
      return { pattern1: moreSpecific, pattern2: pattern }
    }

    // If performance is similar, specialize both patterns
    const specific1 = this.makePatternMoreSpecific(pattern, skill1)
    const specific2 = this.makePatternMoreSpecific(pattern, skill2)

    return { pattern1: specific1, pattern2: specific2 }
  }

  /**
   * Make pattern more specific for a skill
   */
  private makePatternMoreSpecific(pattern: string, skill: string): string {
    const skillKeywords = skill.toLowerCase().split(/[\s_-]+/).filter(w => w.length > 2)

    if (skillKeywords.length > 0) {
      const keyword = skillKeywords[0]
      if (!pattern.includes(keyword)) {
        return `${keyword}.*${pattern}`
      }
    }

    // Add word boundary for specificity
    if (!pattern.includes('\\b')) {
      return `\\b${pattern}\\b`
    }

    return pattern
  }

  /**
   * Record user feedback for a routing decision
   */
  public recordUserFeedback(eventId: string, feedback: 'positive' | 'negative' | 'neutral'): void {
    const event = this.routingHistory.find(e => e.id === eventId)
    if (event) {
      event.userFeedback = feedback
      this.updatePatternPerformance(event)
      this.saveData()
      console.log(`📝 Recorded user feedback: ${feedback} for event ${eventId}`)
    }
  }

  /**
   * Get learning statistics
   */
  public getStatistics(): {
    totalEvents: number
    totalPatterns: number
    averageSuccessRate: number
    averageConfidence: number
    topPerformingPatterns: Array<{ skill: string; pattern: string; successRate: number; uses: number }>
    recentActivity: Array<{ date: string; events: number; successRate: number }>
  } {
    const totalEvents = this.routingHistory.length
    const totalPatterns = this.patternPerformance.size

    const performances = Array.from(this.patternPerformance.values())
    const averageSuccessRate = performances.length > 0 ?
      performances.reduce((sum, p) => sum + p.successRate, 0) / performances.length : 0

    const averageConfidence = performances.length > 0 ?
      performances.reduce((sum, p) => sum + p.averageConfidence, 0) / performances.length : 0

    const topPerformingPatterns = performances
      .filter(p => p.totalUses >= this.config.minDataPoints)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)
      .map(p => ({
        skill: p.skill,
        pattern: p.pattern,
        successRate: p.successRate,
        uses: p.totalUses
      }))

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentEvents = this.routingHistory.filter(e => e.timestamp > sevenDaysAgo)

    const activityByDate = new Map<string, { events: number; successes: number }>()
    recentEvents.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0]
      if (!activityByDate.has(dateKey)) {
        activityByDate.set(dateKey, { events: 0, successes: 0 })
      }
      const activity = activityByDate.get(dateKey)!
      activity.events++
      if (event.success) activity.successes++
    })

    const recentActivity = Array.from(activityByDate.entries())
      .map(([date, activity]) => ({
        date,
        events: activity.events,
        successRate: activity.events > 0 ? activity.successes / activity.events : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalEvents,
      totalPatterns,
      averageSuccessRate,
      averageConfidence,
      topPerformingPatterns,
      recentActivity
    }
  }

  /**
   * Export learning data
   */
  public exportLearningData(): {
    routingHistory: RoutingEvent[]
    patternPerformance: PatternPerformance[]
    statistics: any
    config: LearningConfig
  } {
    return {
      routingHistory: this.routingHistory,
      patternPerformance: Array.from(this.patternPerformance.values()),
      statistics: this.getStatistics(),
      config: this.config
    }
  }

  /**
   * Import learning data
   */
  public importLearningData(data: {
    routingHistory?: RoutingEvent[]
    patternPerformance?: PatternPerformance[]
    config?: Partial<LearningConfig>
  }): void {
    if (data.routingHistory) {
      this.routingHistory = [...this.routingHistory, ...data.routingHistory]
    }

    if (data.patternPerformance) {
      data.patternPerformance.forEach(performance => {
        const key = `${performance.skill}:${performance.pattern}`
        this.patternPerformance.set(key, performance)
      })
    }

    if (data.config) {
      this.config = { ...this.config, ...data.config }
    }

    this.saveData()
    console.log('📚 Learning data imported successfully')
  }

  /**
   * Reset learning data
   */
  public resetLearningData(): void {
    this.routingHistory = []
    this.patternPerformance.clear()
    this.saveData()
    console.log('🗑️ Learning data reset')
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.saveData()
    console.log('🧹 Learning system cleaned up')
  }
}

export { PatternLearningSystem, RoutingEvent, PatternPerformance, LearningConfig, OptimizationResult }