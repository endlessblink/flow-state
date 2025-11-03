#!/usr/bin/env node

/**
 * CLI Tool for Skill Router Discovery System
 * Provides command-line interface for managing skill discovery and integration
 */

import { Command } from 'commander'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { SkillDiscoveryEngine, DiscoveryResult } from './skill-discovery'
import { AutoIntegrationEngine, IntegrationResult } from './auto-integration'
import { SkillWatchService, WatchConfig } from './watch-service'
import { PatternLearningSystem } from './learning-system'

const program = new Command()

program
  .name('skill-router')
  .description('Automatic Skill Discovery and Integration System CLI')
  .version('1.0.0')

// Global options
program
  .option('-p, --path <path>', 'Skills directory path', join(process.cwd(), '.claude', 'skills'))
  .option('-c, --config <path>', 'Config file path', join(process.cwd(), '.claude', 'skills', 'skill-router', 'routing-config.json'))
  .option('-v, --verbose', 'Verbose output')
  .option('--no-color', 'Disable colored output')

// Discover command
program
  .command('discover')
  .description('Discover skills in the skills directory')
  .option('-o, --output <path>', 'Output file for discovery report')
  .option('--format <format>', 'Output format (json|markdown)', 'markdown')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const skillsPath = globalOpts.path || options.path
      const configPath = globalOpts.config || options.config

      console.log('🔍 Starting skill discovery...')
      if (globalOpts.verbose) {
        console.log(`Skills path: ${skillsPath}`)
        console.log(`Config path: ${configPath}`)
      }

      const discoveryEngine = new SkillDiscoveryEngine(skillsPath, configPath)
      const result = await discoveryEngine.discoverSkills()

      // Display results
      console.log('\n📊 Discovery Results:')
      console.log(`   Total Skills: ${result.summary.totalSkills}`)
      console.log(`   New Skills: ${result.summary.newSkillsCount}`)
      console.log(`   Updated Skills: ${result.summary.updatedSkillsCount}`)
      console.log(`   Removed Skills: ${result.summary.removedSkillsCount}`)
      console.log(`   Conflicts: ${result.summary.conflictsCount}`)

      if (result.newSkills.length > 0) {
        console.log('\n✨ New Skills:')
        result.newSkills.forEach(skill => {
          console.log(`   • ${skill.metadata.name} (${skill.suggestedCategory})`)
          if (globalOpts.verbose) {
            console.log(`     Patterns: ${skill.generatedPatterns.slice(0, 3).map(p => p.pattern).join(', ')}`)
          }
        })
      }

      if (result.conflicts.length > 0) {
        console.log('\n⚠️ Conflicts:')
        result.conflicts.forEach(conflict => {
          console.log(`   • ${conflict.skill1} ↔ ${conflict.skill2}`)
        })
      }

      // Generate report
      const report = discoveryEngine.generateReport(result)

      if (options.output) {
        const fs = require('fs')
        if (options.format === 'json') {
          fs.writeFileSync(options.output, JSON.stringify(result, null, 2))
        } else {
          fs.writeFileSync(options.output, report)
        }
        console.log(`\n📄 Report saved to: ${options.output}`)
      } else if (globalOpts.verbose) {
        console.log('\n' + '='.repeat(50))
        console.log(report)
      }

    } catch (error) {
      console.error('❌ Discovery failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Integrate command
program
  .command('integrate')
  .description('Integrate discovered skills into routing configuration')
  .option('-f, --force', 'Force integration even with low-confidence patterns')
  .option('--no-backup', 'Skip creating backup')
  .option('--no-test', 'Skip pattern testing')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const skillsPath = globalOpts.path
      const configPath = globalOpts.config

      console.log('🔄 Starting skill integration...')

      const discoveryEngine = new SkillDiscoveryEngine(skillsPath, configPath)
      const integrationEngine = new AutoIntegrationEngine(
        configPath,
        discoveryEngine,
        {
          createBackups: options.backup !== false,
          testPatterns: options.test !== false,
          requireConfirmation: !options.force
        }
      )

      const discoveryResult = await discoveryEngine.discoverSkills()
      const integrationResult = await integrationEngine.integrateSkills(discoveryResult, options.force)

      if (integrationResult.success) {
        console.log('\n✅ Integration completed successfully!')

        if (integrationResult.changes.added.length > 0) {
          console.log(`   Added: ${integrationResult.changes.added.join(', ')}`)
        }

        if (integrationResult.changes.updated.length > 0) {
          console.log(`   Updated: ${integrationResult.changes.updated.join(', ')}`)
        }

        if (integrationResult.changes.removed.length > 0) {
          console.log(`   Removed: ${integrationResult.changes.removed.join(', ')}`)
        }

        if (integrationResult.changes.conflictsResolved.length > 0) {
          console.log(`   Conflicts resolved: ${integrationResult.changes.conflictsResolved.length}`)
        }

        if (integrationResult.backupPath) {
          console.log(`   Backup: ${integrationResult.backupPath}`)
        }

        if (integrationResult.warnings.length > 0) {
          console.log('\n⚠️ Warnings:')
          integrationResult.warnings.forEach(warning => console.log(`   ${warning}`))
        }

      } else {
        console.log('\n❌ Integration failed!')

        if (integrationResult.errors.length > 0) {
          console.log('Errors:')
          integrationResult.errors.forEach(error => console.log(`   ${error}`))
        }

        if (integrationResult.backupPath) {
          console.log(`\n📋 Backup available at: ${integrationResult.backupPath}`)
        }

        process.exit(1)
      }

    } catch (error) {
      console.error('❌ Integration failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Watch command
program
  .command('watch')
  .description('Start watching for skill changes')
  .option('-a, --auto-integrate', 'Automatically integrate discovered skills')
  .option('--no-debounce', 'Disable debouncing')
  .option('--debounce-ms <ms>', 'Debounce delay in milliseconds', '2000')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const skillsPath = globalOpts.path
      const configPath = globalOpts.config

      console.log('👀 Starting skill watch service...')

      const watchConfig: Partial<WatchConfig> = {
        autoIntegrate: options.autoIntegrate,
        debounceMs: options.debounceMs ? parseInt(options.debounceMs) : 2000
      }

      const watchService = new SkillWatchService(skillsPath, configPath, watchConfig)

      // Handle shutdown
      process.on('SIGINT', () => {
        console.log('\n⏹️ Stopping watch service...')
        watchService.cleanup()
        process.exit(0)
      })

      process.on('SIGTERM', () => {
        console.log('\n⏹️ Stopping watch service...')
        watchService.cleanup()
        process.exit(0)
      })

      watchService.start()

      console.log('✅ Watch service started. Press Ctrl+C to stop.')
      console.log('💡 Use --auto-integrate to automatically integrate changes.')

      // Keep process alive
      setInterval(() => {
        const stats = watchService.getStats()
        if (globalOpts.verbose && stats.eventsProcessed > 0) {
          console.log(`📊 Stats: ${stats.eventsProcessed} events, ${stats.discoveriesTriggered} discoveries, ${stats.integrationsCompleted} integrations`)
        }
      }, 30000) // Every 30 seconds

    } catch (error) {
      console.error('❌ Watch service failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Status command
program
  .command('status')
  .description('Show system status and statistics')
  .option('--watch-stats', 'Include watch service statistics')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const skillsPath = globalOpts.path
      const configPath = globalOpts.config

      console.log('📊 Skill Router Status\n')

      // Check if paths exist
      console.log(`Skills Directory: ${existsSync(skillsPath) ? '✅' : '❌'} ${skillsPath}`)
      console.log(`Config File: ${existsSync(configPath) ? '✅' : '❌'} ${configPath}`)

      if (existsSync(configPath)) {
        const fs = require('fs')
        const configData = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configData)

        console.log(`\n📋 Configuration:`)
        console.log(`   Project: ${config.project || 'Unknown'}`)
        console.log(`   Version: ${config.version || 'Unknown'}`)
        console.log(`   Routing Patterns: ${Object.keys(config.routingPatterns || {}).length}`)
        console.log(`   Mandatory Gates: ${Object.keys(config.mandatoryGates || {}).length}`)
      }

      // Learning system stats
      try {
        const learningSystem = new PatternLearningSystem(configPath)
        const stats = learningSystem.getStatistics()

        console.log(`\n🧠 Learning System:`)
        console.log(`   Total Events: ${stats.totalEvents}`)
        console.log(`   Tracked Patterns: ${stats.totalPatterns}`)
        console.log(`   Average Success Rate: ${(stats.averageSuccessRate * 100).toFixed(1)}%`)
        console.log(`   Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`)

        if (stats.topPerformingPatterns.length > 0) {
          console.log(`\n🏆 Top Performing Patterns:`)
          stats.topPerformingPatterns.slice(0, 3).forEach((pattern, index) => {
            console.log(`   ${index + 1}. ${pattern.skill}: ${(pattern.successRate * 100).toFixed(1)}% (${pattern.uses} uses)`)
          })
        }

      } catch (error) {
        console.log(`\n🧠 Learning System: ❌ Not available`)
      }

      // Integration engine status
      try {
        const discoveryEngine = new SkillDiscoveryEngine(skillsPath, configPath)
        const integrationEngine = new AutoIntegrationEngine(configPath, discoveryEngine)
        const status = integrationEngine.getStatus()

        console.log(`\n🔄 Integration Engine:`)
        console.log(`   Auto Approve: ${status.autoApproveEnabled ? '✅' : '❌'}`)
        console.log(`   Test Patterns: ${status.testPatternsEnabled ? '✅' : '❌'}`)
        console.log(`   Conflict Resolution: ${status.conflictResolution}`)
        console.log(`   Available Backups: ${status.backupCount}`)

        if (status.lastBackup) {
          console.log(`   Last Backup: ${status.lastBackup.timestamp.toISOString()}`)
        }

      } catch (error) {
        console.log(`\n🔄 Integration Engine: ❌ Not available`)
      }

    } catch (error) {
      console.error('❌ Status check failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Backup command
program
  .command('backup')
  .description('Manage configuration backups')
  .option('--list', 'List available backups')
  .option('--restore <backup>', 'Restore from backup')
  .option('--cleanup', 'Clean up old backups (keep last 10)')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const configPath = globalOpts.config

      const discoveryEngine = new SkillDiscoveryEngine(globalOpts.path, configPath)
      const integrationEngine = new AutoIntegrationEngine(configPath, discoveryEngine)

      if (options.list) {
        const backups = integrationEngine.listBackups()

        if (backups.length === 0) {
          console.log('ℹ️ No backups found')
          return
        }

        console.log('📋 Available Backups:\n')
        backups.forEach((backup, index) => {
          console.log(`${index + 1}. ${backup.timestamp.toISOString()}`)
          console.log(`   File: ${backup.filePath}`)
          console.log(`   Description: ${backup.description}`)
          console.log(`   Checksum: ${backup.checksum}\n`)
        })

      } else if (options.restore) {
        console.log(`🔄 Restoring from backup: ${options.restore}`)
        const result = await integrationEngine.rollback(options.restore)

        if (result.success) {
          console.log('✅ Restore completed successfully')
          if (result.warnings.length > 0) {
            result.warnings.forEach(warning => console.log(`⚠️ ${warning}`))
          }
        } else {
          console.log('❌ Restore failed')
          result.errors.forEach(error => console.log(`   ${error}`))
          process.exit(1)
        }

      } else if (options.cleanup) {
        console.log('🧹 Cleaning up old backups...')
        integrationEngine.cleanupBackups(10)
        console.log('✅ Cleanup completed')

      } else {
        console.log('ℹ️ Use --list to see backups, --restore <backup> to restore, or --cleanup to clean up old backups')
      }

    } catch (error) {
      console.error('❌ Backup operation failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Analyze command
program
  .command('analyze')
  .description('Analyze pattern performance and optimization opportunities')
  .option('--optimize', 'Apply automatic optimizations')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts()
      const configPath = globalOpts.config

      const learningSystem = new PatternLearningSystem(configPath)
      const stats = learningSystem.getStatistics()

      console.log('📊 Pattern Performance Analysis\n')

      console.log(`📈 Overall Statistics:`)
      console.log(`   Total Events: ${stats.totalEvents}`)
      console.log(`   Tracked Patterns: ${stats.totalPatterns}`)
      console.log(`   Average Success Rate: ${(stats.averageSuccessRate * 100).toFixed(1)}%`)
      console.log(`   Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`)

      // Analyze patterns
      const analysis = learningSystem.analyzePatterns()

      if (analysis.underperforming.length > 0) {
        console.log(`\n⚠️ Underperforming Patterns (${analysis.underperforming.length}):`)
        analysis.underperforming.slice(0, 5).forEach((pattern, index) => {
          console.log(`   ${index + 1}. ${pattern.skill}: ${pattern.pattern}`)
          console.log(`      Issues: ${pattern.issues.join(', ')}`)
          console.log(`      Suggestion: ${pattern.suggestion}\n`)
        })
      }

      if (analysis.overperforming.length > 0) {
        console.log(`\n🌟 Overperforming Patterns (${analysis.overperforming.length}):`)
        analysis.overperforming.slice(0, 3).forEach((pattern, index) => {
          console.log(`   ${index + 1}. ${pattern.skill}: ${pattern.pattern}`)
          console.log(`      Strength: ${pattern.strength}`)
          console.log(`      Opportunity: ${pattern.opportunity}\n`)
        })
      }

      if (analysis.conflicts.length > 0) {
        console.log(`\n⚔️ Pattern Conflicts (${analysis.conflicts.length}):`)
        analysis.conflicts.forEach((conflict, index) => {
          console.log(`   ${index + 1}. ${conflict.skill1} ↔ ${conflict.skill2}: ${conflict.pattern}`)
          console.log(`      Suggestion: ${conflict.suggestion}\n`)
        })
      }

      // Apply optimizations if requested
      if (options.optimize) {
        console.log('🔧 Applying automatic optimizations...')
        const currentPatterns = [] // This would be loaded from current config
        const result = learningSystem.optimizePatterns(currentPatterns)

        if (result.optimized) {
          console.log(`✅ Optimization completed:`)
          console.log(`   Patterns Modified: ${result.patternsModified}`)
          console.log(`   Estimated Improvement: ${(result.performanceImprovement * 100).toFixed(1)}%`)

          if (result.changes.length > 0) {
            console.log(`\n📝 Changes Made:`)
            result.changes.forEach((change, index) => {
              console.log(`   ${index + 1}. ${change.skill}`)
              console.log(`      Before: ${change.oldPattern}`)
              console.log(`      After: ${change.newPattern}`)
              console.log(`      Reason: ${change.reason}\n`)
            })
          }

        } else {
          console.log('ℹ️ No optimizations needed')
          if (result.errors.length > 0) {
            result.errors.forEach(error => console.log(`⚠️ ${error}`))
          }
        }
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp()
}