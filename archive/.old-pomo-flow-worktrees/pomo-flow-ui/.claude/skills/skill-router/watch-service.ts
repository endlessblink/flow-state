/**
 * Continuous Monitoring and Watch Service
 * Monitors file system for skill changes and automatically triggers discovery/integration
 */

import { watch, FSWatcher, statSync } from 'fs'
import { join, dirname } from 'path'
import { debounce } from 'lodash'
import { SkillDiscoveryEngine, DiscoveryResult } from './skill-discovery'
import { AutoIntegrationEngine, IntegrationResult } from './auto-integration'

// Types
interface WatchConfig {
  enabled: boolean
  debounceMs: number
  autoIntegrate: boolean
  requireConfirmation: boolean
  watchPatterns: string[]
  ignorePatterns: string[]
}

interface WatchEvent {
  type: 'added' | 'modified' | 'removed'
  path: string
  timestamp: Date
  skillName?: string
}

interface MonitoringStats {
  startTime: Date
  eventsProcessed: number
  discoveriesTriggered: number
  integrationsCompleted: number
  integrationErrors: number
  lastEvent?: WatchEvent
  lastDiscovery?: Date
  lastIntegration?: Date
}

class SkillWatchService {
  private watcher?: FSWatcher
  private config: WatchConfig
  private discoveryEngine: SkillDiscoveryEngine
  private integrationEngine: AutoIntegrationEngine
  private isRunning: boolean = false
  private eventQueue: WatchEvent[] = []
  private stats: MonitoringStats
  private processEvents: () => Promise<void>

  constructor(
    skillsPath: string,
    configPath: string,
    config: Partial<WatchConfig> = {}
  ) {
    this.discoveryEngine = new SkillDiscoveryEngine(skillsPath, configPath)
    this.integrationEngine = new AutoIntegrationEngine(configPath, this.discoveryEngine)

    this.config = {
      enabled: true,
      debounceMs: 2000,
      autoIntegrate: false,
      requireConfirmation: true,
      watchPatterns: ['*/SKILL.md'],
      ignorePatterns: ['*.log', '*.tmp', 'node_modules/**', '.git/**'],
      ...config
    }

    this.stats = {
      startTime: new Date(),
      eventsProcessed: 0,
      discoveriesTriggered: 0,
      integrationsCompleted: 0,
      integrationErrors: 0
    }

    // Debounced event processor
    this.processEvents = debounce(this._processEvents.bind(this), this.config.debounceMs)
  }

  /**
   * Start watching for skill changes
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Watch service is already running')
      return
    }

    if (!this.config.enabled) {
      console.log('ℹ️ Watch service is disabled')
      return
    }

    const skillsPath = dirname(this.discoveryEngine['skillsPath'])

    try {
      this.watcher = watch(skillsPath, { recursive: true }, (eventType, filename) => {
        this.handleFileChange(eventType, filename)
      })

      this.isRunning = true
      console.log(`👀 Started watching skills directory: ${skillsPath}`)
      console.log(`⚙️ Config: debounce=${this.config.debounceMs}ms, autoIntegrate=${this.config.autoIntegrate}`)

    } catch (error) {
      console.error('❌ Failed to start watch service:', error)
      throw error
    }
  }

  /**
   * Stop watching for changes
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('ℹ️ Watch service is not running')
      return
    }

    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }

    this.isRunning = false
    console.log('⏹️ Stopped watching skills directory')
  }

  /**
   * Handle file system events
   */
  private handleFileChange(eventType: string, filename?: string): void {
    if (!filename) return

    // Check if file matches our patterns
    if (!this.shouldProcessFile(filename)) {
      return
    }

    const fullPath = join(dirname(this.discoveryEngine['skillsPath']), filename)

    // Determine event type
    let watchEventType: 'added' | 'modified' | 'removed'
    if (eventType === 'rename') {
      watchEventType = this.fileExists(fullPath) ? 'added' : 'removed'
    } else {
      watchEventType = eventType === 'change' ? 'modified' : 'added'
    }

    // Extract skill name from path
    const skillName = this.extractSkillName(fullPath)

    const event: WatchEvent = {
      type: watchEventType,
      path: fullPath,
      timestamp: new Date(),
      skillName
    }

    this.eventQueue.push(event)
    this.stats.eventsProcessed++
    this.stats.lastEvent = event

    console.log(`📝 File ${watchEventType}: ${filename} (${skillName || 'unknown'})`)

    // Trigger debounced processing
    this.processEvents()
  }

  /**
   * Check if file should be processed
   */
  private shouldProcessFile(filename: string): boolean {
    // Normalize path separators
    const normalizedFilename = filename.replace(/\\/g, '/')

    // Check include patterns
    const matchesInclude = this.config.watchPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(normalizedFilename)
    })

    if (!matchesInclude) {
      return false
    }

    // Check exclude patterns
    const matchesExclude = this.config.ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(normalizedFilename)
    })

    return !matchesExclude
  }

  /**
   * Check if file exists
   */
  private fileExists(path: string): boolean {
    try {
      statSync(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Extract skill name from file path
   */
  private extractSkillName(filePath: string): string | undefined {
    // Extract skill directory name from path like ".../skills/skill-name/SKILL.md"
    const pathParts = filePath.split('/')
    const skillIndex = pathParts.findIndex(part => part === 'skills')

    if (skillIndex !== -1 && skillIndex + 1 < pathParts.length) {
      return pathParts[skillIndex + 1]
    }

    return undefined
  }

  /**
   * Process queued events
   */
  private async _processEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return
    }

    console.log(`🔄 Processing ${this.eventQueue.length} file change events...`)

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      // Group events by skill
      const eventsBySkill = this.groupEventsBySkill(events)

      // Process each affected skill
      for (const [skillName, skillEvents] of eventsBySkill.entries()) {
        await this.processSkillEvents(skillName, skillEvents)
      }

    } catch (error) {
      console.error('❌ Error processing events:', error)
    }
  }

  /**
   * Group events by skill name
   */
  private groupEventsBySkill(events: WatchEvent[]): Map<string, WatchEvent[]> {
    const grouped = new Map<string, WatchEvent[]>()

    events.forEach(event => {
      const skillName = event.skillName || 'unknown'
      if (!grouped.has(skillName)) {
        grouped.set(skillName, [])
      }
      grouped.get(skillName)!.push(event)
    })

    return grouped
  }

  /**
   * Process events for a specific skill
   */
  private async processSkillEvents(skillName: string, events: WatchEvent[]): Promise<void> {
    console.log(`🔍 Processing ${events.length} events for skill: ${skillName}`)

    // Determine if we should trigger discovery
    const shouldDiscover = this.shouldTriggerDiscovery(events)

    if (!shouldDiscover) {
      console.log(`⏭️ Skipping discovery for ${skillName} (no significant changes)`)
      return
    }

    try {
      // Trigger discovery
      console.log(`🔍 Triggering skill discovery for ${skillName}...`)
      const discoveryResult = await this.discoveryEngine.discoverSkills()

      this.stats.discoveriesTriggered++
      this.stats.lastDiscovery = new Date()

      // Check if there are relevant changes
      const hasRelevantChanges = this.hasRelevantChanges(discoveryResult, skillName)

      if (!hasRelevantChanges) {
        console.log(`ℹ️ No relevant changes found for ${skillName}`)
        return
      }

      // Log discovery results
      this.logDiscoveryResults(discoveryResult)

      // Auto-integrate if enabled
      if (this.config.autoIntegrate) {
        await this.autoIntegrate(discoveryResult)
      } else {
        console.log(`ℹ️ Auto-integration disabled. Manual integration required.`)
        console.log(`Run: npx skill-router integrate --force`)
      }

    } catch (error) {
      console.error(`❌ Error processing skill ${skillName}:`, error)
    }
  }

  /**
   * Determine if events should trigger discovery
   */
  private shouldTriggerDiscovery(events: WatchEvent[]): boolean {
    // Always trigger if any SKILL.md was added, modified, or removed
    return events.some(event =>
      event.path.endsWith('SKILL.md') ||
      event.path.endsWith('skill.json')
    )
  }

  /**
   * Check if discovery has relevant changes
   */
  private hasRelevantChanges(discoveryResult: DiscoveryResult, skillName: string): boolean {
    // Check if the skill is in new or updated skills
    const skillInNew = discoveryResult.newSkills.some(skill =>
      skill.metadata.name === skillName || skill.metadata.folderName === skillName
    )

    const skillInUpdated = discoveryResult.updatedSkills.some(skill =>
      skill.metadata.name === skillName || skill.metadata.folderName === skillName
    )

    return skillInNew || skillInUpdated
  }

  /**
   * Log discovery results
   */
  private logDiscoveryResults(discoveryResult: DiscoveryResult): void {
    console.log(`📊 Discovery Results:`)
    console.log(`   New skills: ${discoveryResult.summary.newSkillsCount}`)
    console.log(`   Updated skills: ${discoveryResult.summary.updatedSkillsCount}`)
    console.log(`   Removed skills: ${discoveryResult.summary.removedSkillsCount}`)
    console.log(`   Conflicts: ${discoveryResult.summary.conflictsCount}`)

    if (discoveryResult.newSkills.length > 0) {
      console.log(`   New skills: ${discoveryResult.newSkills.map(s => s.metadata.name).join(', ')}`)
    }

    if (discoveryResult.updatedSkills.length > 0) {
      console.log(`   Updated skills: ${discoveryResult.updatedSkills.map(s => s.metadata.name).join(', ')}`)
    }
  }

  /**
   * Auto-integrate discovered changes
   */
  private async autoIntegrate(discoveryResult: DiscoveryResult): Promise<void> {
    try {
      console.log(`🔄 Starting auto-integration...`)

      const integrationResult = await this.integrationEngine.integrateSkills(
        discoveryResult,
        !this.config.requireConfirmation // force if confirmation not required
      )

      this.stats.lastIntegration = new Date()

      if (integrationResult.success) {
        this.stats.integrationsCompleted++
        console.log(`✅ Auto-integration completed successfully`)

        if (integrationResult.changes.added.length > 0) {
          console.log(`   Added: ${integrationResult.changes.added.join(', ')}`)
        }

        if (integrationResult.changes.updated.length > 0) {
          console.log(`   Updated: ${integrationResult.changes.updated.join(', ')}`)
        }

        if (integrationResult.changes.removed.length > 0) {
          console.log(`   Removed: ${integrationResult.changes.removed.join(', ')}`)
        }

        if (integrationResult.warnings.length > 0) {
          console.log(`⚠️ Warnings:`)
          integrationResult.warnings.forEach(warning => console.log(`   ${warning}`))
        }

      } else {
        this.stats.integrationErrors++
        console.log(`❌ Auto-integration failed`)

        if (integrationResult.errors.length > 0) {
          console.log(`Errors:`)
          integrationResult.errors.forEach(error => console.log(`   ${error}`))
        }

        if (integrationResult.backupPath) {
          console.log(`📋 Backup available at: ${integrationResult.backupPath}`)
        }
      }

    } catch (error) {
      this.stats.integrationErrors++
      console.error(`❌ Auto-integration error:`, error)
    }
  }

  /**
   * Manually trigger discovery
   */
  public async triggerDiscovery(): Promise<DiscoveryResult> {
    console.log(`🔍 Manually triggering skill discovery...`)
    const result = await this.discoveryEngine.discoverSkills()
    this.stats.discoveriesTriggered++
    this.stats.lastDiscovery = new Date()
    return result
  }

  /**
   * Manually trigger integration
   */
  public async triggerIntegration(force: boolean = false): Promise<IntegrationResult> {
    const discoveryResult = await this.triggerDiscovery()
    return await this.integrationEngine.integrateSkills(discoveryResult, force)
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): MonitoringStats {
    return { ...this.stats }
  }

  /**
   * Get current configuration
   */
  public getConfig(): WatchConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<WatchConfig>): void {
    const wasRunning = this.isRunning

    if (wasRunning) {
      this.stop()
    }

    this.config = { ...this.config, ...updates }

    console.log(`⚙️ Updated watch config:`, updates)

    if (wasRunning) {
      this.start()
    }
  }

  /**
   * Generate monitoring report
   */
  public generateReport(): string {
    const uptime = Date.now() - this.stats.startTime.getTime()
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60))
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))

    let report = '# Skill Router Monitoring Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n`
    report += `Uptime: ${uptimeHours}h ${uptimeMinutes}m\n\n`

    report += '## Statistics\n\n'
    report += `- Events Processed: ${this.stats.eventsProcessed}\n`
    report += `- Discoveries Triggered: ${this.stats.discoveriesTriggered}\n`
    report += `- Integrations Completed: ${this.stats.integrationsCompleted}\n`
    report += `- Integration Errors: ${this.stats.integrationErrors}\n`
    report += `- Success Rate: ${this.stats.integrationsCompleted > 0 ?
        ((this.stats.integrationsCompleted / (this.stats.integrationsCompleted + this.stats.integrationErrors)) * 100).toFixed(1) : 0}%\n\n`

    if (this.stats.lastEvent) {
      report += '## Last Event\n\n'
      report += `- Type: ${this.stats.lastEvent.type}\n`
      report += `- Path: ${this.stats.lastEvent.path}\n`
      report += `- Skill: ${this.stats.lastEvent.skillName || 'unknown'}\n`
      report += `- Time: ${this.stats.lastEvent.timestamp.toISOString()}\n\n`
    }

    if (this.stats.lastDiscovery) {
      report += '## Last Discovery\n\n'
      report += `- Time: ${this.stats.lastDiscovery.toISOString()}\n\n`
    }

    if (this.stats.lastIntegration) {
      report += '## Last Integration\n\n'
      report += `- Time: ${this.stats.lastIntegration.toISOString()}\n\n`
    }

    report += '## Configuration\n\n'
    report += `- Enabled: ${this.config.enabled}\n`
    report += `- Auto Integrate: ${this.config.autoIntegrate}\n`
    report += `- Require Confirmation: ${this.config.requireConfirmation}\n`
    report += `- Debounce: ${this.config.debounceMs}ms\n`
    report += `- Watch Patterns: ${this.config.watchPatterns.join(', ')}\n\n`

    report += '## Current Status\n\n'
    report += `- Running: ${this.isRunning ? '✅ Yes' : '❌ No'}\n`
    report += `- Queue Length: ${this.eventQueue.length}\n\n`

    return report
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stop()
    this.eventQueue = []
    console.log('🧹 Watch service cleaned up')
  }
}

export { SkillWatchService, WatchConfig, WatchEvent, MonitoringStats }