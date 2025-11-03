# User Override System

## Overview

The User Override System provides flexibility for experienced users to explicitly select skills while maintaining the quality gate protections that ensure reliable development workflows.

## Override Commands

### 1. Explicit Skill Selection

**Syntax:** `/skill:{skill-name}`

**Description:** Directly route to a specific skill, bypassing pattern matching but respecting quality gates.

**Examples:**
```
/skill:comprehensive-testing I need to test the timer
/skill:vue-development Create a new component for the sidebar
/skill:optimize-performance The app is running slow
```

**Behavior:**
- ✅ Bypasses pattern matching
- ✅ Respects mandatory quality gates
- ✅ Provides immediate skill execution
- ✅ Logs user preference for learning

### 2. Forced Skill Selection

**Syntax:** `/force-skill:{skill-name}`

**Description:** Force route to a specific skill, bypassing most checks including some quality gates (development only).

**Examples:**
```
/force-skill:vue-development Just need to add a simple button
/force-skill:comprehensive-debugging Quick debugging session
```

**Behavior:**
- ✅ Bypasses pattern matching
- ⚠️ Bypasses non-critical quality gates
- ❌ Cannot bypass critical deployment gates
- ✅ Logs override for compliance tracking

### 3. Skip Quality Gates (Emergency)

**Syntax:** `/skip-gates`

**Description:** Emergency override to skip all quality gates (development environment only).

**Examples:**
```
/skip-gates Deploy this hotfix immediately
/skip-gates Quick test without full verification
```

**Behavior:**
- ⚠️ Development environment only
- ⚠️ Bypasses all quality gates
- 🚨 Logs emergency bypass
- 📝 Requires compliance review

## Override Implementation

### Command Parser

```typescript
interface OverrideCommand {
  type: 'explicit' | 'forced' | 'skip-gates'
  skillName?: string
  originalInput: string
  cleanedInput: string
}

class OverrideParser {
  public parseOverride(input: string): OverrideCommand | null {
    const explicitMatch = input.match(/^\/skill:(\w+)(.*)$/i)
    if (explicitMatch) {
      return {
        type: 'explicit',
        skillName: explicitMatch[1],
        originalInput: input,
        cleanedInput: explicitMatch[2].trim()
      }
    }

    const forcedMatch = input.match(/^\/force-skill:(\w+)(.*)$/i)
    if (forcedMatch) {
      return {
        type: 'forced',
        skillName: forcedMatch[1],
        originalInput: input,
        cleanedInput: forcedMatch[2].trim()
      }
    }

    const skipMatch = input.match(/^\/skip-gates(.*)$/i)
    if (skipMatch) {
      return {
        type: 'skip-gates',
        originalInput: input,
        cleanedInput: skipMatch[1].trim()
      }
    }

    return null
  }
}
```

### Override Handler

```typescript
class OverrideHandler {
  constructor(
    private router: SkillRouter,
    private gateManager: QualityGateManager,
    private complianceTracker: ComplianceTracker
  ) {}

  public async handleOverride(
    override: OverrideCommand,
    context: RequestContext
  ): Promise<RoutingResult> {
    // Log all overrides for compliance
    this.complianceTracker.logOverride(override, context)

    switch (override.type) {
      case 'explicit':
        return this.handleExplicitOverride(override, context)

      case 'forced':
        return this.handleForcedOverride(override, context)

      case 'skip-gates':
        return this.handleSkipGates(override, context)

      default:
        throw new Error(`Unknown override type: ${override.type}`)
    }
  }

  private async handleExplicitOverride(
    override: OverrideCommand,
    context: RequestContext
  ): Promise<RoutingResult> {
    const skillName = override.skillName!

    // Validate skill exists
    if (!this.isValidSkill(skillName)) {
      throw new Error(`Unknown skill: ${skillName}`)
    }

    // Check for quality gates
    const gates = this.gateManager.checkQualityGates(override.cleanedInput)

    const result: RoutingResult = {
      selectedSkill: skillName,
      confidence: 1.0,
      reasoning: [`Explicit user override: ${skillName}`],
      mandatoryGates: gates.triggered ? gates.requiredSkills : [],
      alternativeSkills: [],
      userOverride: true
    }

    // Update user preferences
    this.router.updateUserPreferences(skillName, context, 'positive')

    return result
  }

  private async handleForcedOverride(
    override: OverrideCommand,
    context: RequestContext
  ): Promise<RoutingResult> {
    const skillName = override.skillName!

    // Check for critical gates that cannot be bypassed
    const criticalGates = this.gateManager.getCriticalGates(override.cleanedInput)
    if (criticalGates.length > 0) {
      throw new Error(
        `Cannot force override critical quality gates: ${criticalGates.join(', ')}`
      )
    }

    console.log(`⚠️ Forced skill override: ${skillName}`)

    return {
      selectedSkill: skillName,
      confidence: 1.0,
      reasoning: [`Forced skill selection: ${skillName}`, `Non-critical gates bypassed`],
      mandatoryGates: [], // Bypass non-critical gates
      alternativeSkills: [],
      userOverride: true
    }
  }

  private async handleSkipGates(
    override: OverrideCommand,
    context: RequestContext
  ): Promise<RoutingResult> {
    // Verify development environment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot skip quality gates in production environment')
    }

    console.log(`🚨 EMERGENCY GATE BYPASS ACTIVATED`)
    console.log(`⚠️ This action will be logged for compliance review`)

    // Log emergency bypass
    this.complianceTracker.logEmergencyBypass(override, context)

    // Route to appropriate skill based on remaining input
    const normalRouting = this.router.routeToSkill({
      ...context,
      userInput: override.cleanedInput
    })

    return {
      ...normalRouting,
      reasoning: [
        '🚨 Emergency gate bypass activated',
        ...normalRouting.reasoning
      ],
      mandatoryGates: [], // All gates bypassed
      userOverride: true
    }
  }

  private isValidSkill(skillName: string): boolean {
    const availableSkills = [
      'comprehensive-testing',
      'verify-before-claiming',
      'comprehensive-debugging',
      'vue-development',
      'pinia-state-management',
      'optimize-performance',
      'calendar-canvas-integration',
      'audit-ui-ux-consistency',
      'pomoflow-undo-redo-unification',
      'fix-timer-bugs',
      'fix-task-store',
      'fix-keyboard-shortcuts',
      'port-manager',
      'systematic-planning',
      'debug-vue-reactivity',
      'fix-pinia-state'
    ]

    return availableSkills.includes(skillName)
  }
}
```

## User Preference Learning

### Preference Tracking

```typescript
interface UserPreference {
  userInput: string
  selectedSkill: string
  feedback: 'positive' | 'negative'
  timestamp: Date
  context: {
    file?: string
    view?: string
    recentChanges?: string[]
  }
  confidence: number
}

class PreferenceLearner {
  private preferences: UserPreference[] = []

  public recordPreference(preference: UserPreference): void {
    this.preferences.push(preference)
    this.cleanupOldPreferences()
  }

  public getLearnedSuggestions(input: string, context: RequestContext): Array<{
    skill: string
    confidence: number
    reason: string
  }> {
    const suggestions: Array<{skill: string, confidence: number, reason: string}> = []

    // Find similar past inputs
    const similarPreferences = this.preferences.filter(p =>
      this.calculateSimilarity(input, p.userInput) > 0.7
    )

    // Group by skill and calculate confidence
    const skillGroups = this.groupBySkill(similarPreferences)

    for (const [skill, prefs] of Object.entries(skillGroups)) {
      const avgConfidence = prefs.reduce((sum, p) => sum + p.confidence, 0) / prefs.length
      const positiveRatio = prefs.filter(p => p.feedback === 'positive').length / prefs.length

      if (positiveRatio > 0.8 && avgConfidence > 0.6) {
        suggestions.push({
          skill,
          confidence: avgConfidence * positiveRatio,
          reason: `Based on ${prefs.length} similar past selections`
        })
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  private calculateSimilarity(input1: string, input2: string): number {
    // Simple similarity calculation based on word overlap
    const words1 = input1.toLowerCase().split(/\s+/)
    const words2 = input2.toLowerCase().split(/\s+/)

    const intersection = words1.filter(word => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]

    return intersection.length / union.length
  }

  private groupBySkill(preferences: UserPreference[]): Record<string, UserPreference[]> {
    return preferences.reduce((groups, pref) => {
      if (!groups[pref.selectedSkill]) {
        groups[pref.selectedSkill] = []
      }
      groups[pref.selectedSkill].push(pref)
      return groups
    }, {} as Record<string, UserPreference[]>)
  }

  private cleanupOldPreferences(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    this.preferences = this.preferences.filter(p => p.timestamp > thirtyDaysAgo)
  }
}
```

## Compliance and Monitoring

### Override Tracking

```typescript
interface OverrideEvent {
  timestamp: Date
  user: string
  overrideType: 'explicit' | 'forced' | 'skip-gates'
  skillName?: string
  originalInput: string
  context: RequestContext
  gatesBypassed: string[]
  environment: 'development' | 'production'
}

class ComplianceTracker {
  private overrideLog: OverrideEvent[] = []

  public logOverride(override: OverrideCommand, context: RequestContext): void {
    const event: OverrideEvent = {
      timestamp: new Date(),
      user: this.getCurrentUser(),
      overrideType: override.type,
      skillName: override.skillName,
      originalInput: override.originalInput,
      context,
      gatesBypassed: this.getBypassedGates(override),
      environment: process.env.NODE_ENV as 'development' | 'production'
    }

    this.overrideLog.push(event)
    this.analyzeCompliance(event)
  }

  public logEmergencyBypass(override: OverrideCommand, context: RequestContext): void {
    const emergencyEvent: OverrideEvent = {
      timestamp: new Date(),
      user: this.getCurrentUser(),
      overrideType: 'skip-gates',
      originalInput: override.originalInput,
      context,
      gatesBypassed: ['ALL_GATES'],
      environment: process.env.NODE_ENV as 'development' | 'production'
    }

    this.overrideLog.push(emergencyEvent)
    this.alertEmergencyBypass(emergencyEvent)
  }

  private analyzeCompliance(event: OverrideEvent): void {
    // Check for concerning patterns
    const recentOverrides = this.overrideLog.filter(e =>
      e.user === event.user &&
      e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    )

    if (recentOverrides.length > 10) {
      this.alertHighOverrideUsage(event.user, recentOverrides.length)
    }

    if (event.overrideType === 'forced' && event.environment === 'production') {
      this.alertProductionForcedOverride(event)
    }
  }

  private alertHighOverrideUsage(user: string, count: number): void {
    console.log(`⚠️ High override usage detected: ${user} has ${count} overrides in 24h`)
    // Send alert to team leads
  }

  private alertProductionForcedOverride(event: OverrideEvent): void {
    console.log(`🚨 CRITICAL: Forced override in production by ${event.user}`)
    // Immediate alert to development team
  }

  private alertEmergencyBypass(event: OverrideEvent): void {
    console.log(`🚨 EMERGENCY BYPASS: ${event.user} skipped all quality gates`)
    // Immediate alert to development team and compliance
  }

  private getBypassedGates(override: OverrideCommand): string[] {
    // Logic to determine which gates are bypassed by this override
    if (override.type === 'skip-gates') return ['ALL_GATES']
    if (override.type === 'forced') return ['NON_CRITICAL_GATES']
    return []
  }

  private getCurrentUser(): string {
    // Get current user from environment or session
    return process.env.USER || 'unknown'
  }

  public generateComplianceReport(): {
    totalOverrides: number
    overrideTypes: Record<string, number>
    frequentUsers: Array<{user: string, count: number}>
    emergencyBypasses: number
    productionOverrides: number
  } {
    const last30Days = this.overrideLog.filter(e =>
      e.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )

    const overrideTypes = last30Days.reduce((types, e) => {
      types[e.overrideType] = (types[e.overrideType] || 0) + 1
      return types
    }, {} as Record<string, number>)

    const userCounts = last30Days.reduce((users, e) => {
      users[e.user] = (users[e.user] || 0) + 1
      return users
    }, {} as Record<string, number>)

    const frequentUsers = Object.entries(userCounts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalOverrides: last30Days.length,
      overrideTypes,
      frequentUsers,
      emergencyBypasses: last30Days.filter(e => e.overrideType === 'skip-gates').length,
      productionOverrides: last30Days.filter(e => e.environment === 'production').length
    }
  }
}
```

## Best Practices

### For Users
1. **Use Explicit Overrides** when you know exactly which skill you need
2. **Respect Quality Gates** - they're there to ensure quality
3. **Provide Feedback** to help the learning system improve
4. **Document Emergency Bypasses** for team transparency

### For Development Teams
1. **Monitor Override Patterns** to identify routing issues
2. **Review Compliance Reports** regularly
3. **Adjust Routing Patterns** based on user behavior
4. **Educate Team Members** on proper override usage

### For System Administrators
1. **Set Up Alerts** for concerning override patterns
2. **Review Emergency Bypasses** promptly
3. **Maintain Audit Logs** for compliance
4. **Update Skill Catalog** as new skills are added

---

The User Override System provides the flexibility needed for experienced users while maintaining the quality assurance benefits of the automated routing system.