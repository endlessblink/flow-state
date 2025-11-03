#!/usr/bin/env node

/**
 * Skill Wrapper - Automatic logging for Claude Code skills
 * This script wraps skill execution and logs usage automatically
 */

import { spawn } from 'child_process';
import { SkillLogger } from './skill-logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SkillWrapper {
  constructor() {
    this.logger = new SkillLogger();
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.logger.init();
      this.initialized = true;
    }
  }

  /**
   * Execute a skill with automatic logging
   */
  async executeSkill(skillName, args = []) {
    await this.init();

    const startTime = Date.now();
    let outcome = 'success';
    let error = null;

    try {
      console.log(`[SkillWrapper] Executing skill: ${skillName}`);

      // Execute the skill command
      const result = await this.runSkillCommand(skillName, args);

      const duration = Date.now() - startTime;

      // Log successful execution
      await this.logger.logSkillUsage(
        skillName,
        { args },
        'success',
        duration,
        null
      );

      console.log(`[SkillWrapper] Skill completed: ${skillName} (${duration}ms)`);
      return result;

    } catch (err) {
      outcome = 'error';
      error = err;
      const duration = Date.now() - startTime;

      // Log failed execution
      await this.logger.logSkillUsage(
        skillName,
        { args },
        'error',
        duration,
        err
      );

      console.error(`[SkillWrapper] Skill failed: ${skillName} (${duration}ms) - ${err.message}`);
      throw err;
    }
  }

  /**
   * Run the actual skill command
   */
  async runSkillCommand(skillName, args) {
    return new Promise((resolve, reject) => {
      // Map skill names to their actual commands
      const skillCommands = {
        'comprehensive-testing': 'npm run test',
        'port-manager': 'echo "Port management skill executed"',
        'vue-development': 'echo "Vue development skill executed"'
      };

      const command = skillCommands[skillName];
      if (!command) {
        reject(new Error(`Unknown skill: ${skillName}`));
        return;
      }

      const [cmd, ...cmdArgs] = command.split(' ');

      const child = spawn(cmd, [...cmdArgs, ...args], {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, exitCode: code });
        } else {
          reject(new Error(`Skill process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start skill process: ${err.message}`));
      });
    });
  }

  /**
   * Log manual skill invocation (for when skills are called directly)
   */
  async logManualInvocation(skillName, parameters = {}, outcome = 'success', duration = null) {
    await this.init();

    await this.logger.logSkillUsage(
      skillName,
      parameters,
      outcome,
      duration
    );

    console.log(`[SkillWrapper] Manual invocation logged: ${skillName}`);
  }

  /**
   * Get skill usage summary
   */
  async getUsageSummary() {
    await this.init();

    const recentLogs = await this.logger.getRecentLogs(10);
    const metrics = await this.logger.getMetrics();

    return {
      recentActivity: recentLogs.map(log => ({
        skill: log.skillName,
        outcome: log.outcome,
        time: log.timestamp,
        duration: log.duration
      })),
      metrics
    };
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const wrapper = new SkillWrapper();
  const skillName = process.argv[2];
  const args = process.argv.slice(3);

  if (!skillName) {
    console.log('Usage: node skill-wrapper.js <skill-name> [args...]');
    console.log('Available skills: comprehensive-testing, port-manager, vue-development');
    process.exit(1);
  }

  wrapper.executeSkill(skillName, args)
    .then(() => {
      console.log('Skill execution completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Skill execution failed:', err.message);
      process.exit(1);
    });
}

export { SkillWrapper };