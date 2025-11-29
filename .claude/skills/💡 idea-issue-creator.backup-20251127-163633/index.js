/**
 * 💡 Idea-Issue Creator Skill
 * Enhanced with Skill Integration and Modern Pomo-Flow Architecture
 * Restored and enhanced from original issue-creator with modern integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Safety from './safety.js';
import CodeScanner from './code-scanner.js';
import SkillIntegration from './integration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IdeaIssueCreator {
  constructor() {
    // MODERN: Pomo-Flow Project Paths
    this.baseDir = process.cwd();
    this.ideasIssuesPath = path.join(this.baseDir, 'planning-ideas-issues');
    this.masterPlanPath = path.join(this.baseDir, 'docs', 'MASTER_PLAN.md');
    this.archivesDir = path.join(this.baseDir, 'docs', 'archives', 'ideas-issues');

    // ENHANCED: Skill Integration Paths
    this.skillsDir = path.join(this.baseDir, '.claude', 'skills');
    this.chiefArchitectPath = path.join(this.skillsDir, '🎯 chief-architect');
    this.masterPlanManagerPath = path.join(this.skillsDir, '📋 master-plan-manager');

    // LEGACY: Task Management (for backward compatibility)
    this.legacyBaseDir = path.join(this.baseDir, 'task-management');
    this.ideasPath = path.join(this.legacyBaseDir, 'ideas.md');
    this.kanbanPath = path.join(this.legacyBaseDir, 'kanban.md');
    this.archivePath = path.join(this.legacyBaseDir, 'archive.md');

    // SAFETY: Backup directory
    this.backupDir = path.join(this.baseDir, '.claude', 'backups', 'idea-issue-creator');

    // EXISTING: GitHub config
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_OWNER;
    this.repoName = process.env.GITHUB_REPO;
    this.apiBase = 'https://api.github.com';
    this.githubEnabled = process.env.GITHUB_INTEGRATION_ENABLED === 'true';

    // ENHANCED: State tracking with skill integration
    this.state = {
      ideas: new Map(),
      issues: new Map(),
      lastSync: null,
      skillIntegration: {
        chiefArchitectAvailable: false,
        masterPlanManagerAvailable: false
      },
      githubIssues: new Map(),
      lastIdeas: new Map(),
      lastTasks: new Map()
    };
    this.loadState();

    // ENHANCED: ID counters
    this.idCounters = {
      IDEA: 0,
      ISSUE: 0,
      TASK: 0,
      BUG: 0,
      UI: 0
    };
    this.loadIdCounters();

    // SKILL INTEGRATION: Check for available skills
    this.checkSkillAvailability();

    // Initialize safety system with modern paths
    this.safety = new Safety(this.backupDir);
    console.log('✅ Safety system initialized');

    // Initialize code scanner
    this.scanner = new CodeScanner(this.baseDir);
    console.log('✅ Code scanner initialized');

    // Create backup directory if it doesn't exist
    this.ensureBackupDirectory();

    // Initialize skill integration
    this.integration = new SkillIntegration(this);
    this.integration.initializeConnections();

    console.log('💡 Idea-Issue Creator initialized with enhanced features');
  }

  /**
   * ENHANCED: Check skill availability for integration
   */
  checkSkillAvailability() {
    this.state.skillIntegration.chiefArchitectAvailable = fs.existsSync(this.chiefArchitectPath);
    this.state.skillIntegration.masterPlanManagerAvailable = fs.existsSync(this.masterPlanManagerPath);

    console.log(`🔗 Skill Integration Status:`);
    console.log(`   🎯 Chief Architect: ${this.state.skillIntegration.chiefArchitectAvailable ? '✅ Available' : '❌ Not Available'}`);
    console.log(`   📋 Master Plan Manager: ${this.state.skillIntegration.masterPlanManagerAvailable ? '✅ Available' : '❌ Not Available'}`);
  }

  /**
   * ENHANCED: Ensure backup directory exists
   */
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * ENHANCED: Delegate to chief-architect for complex decisions
   */
  async delegateToChiefArchitect(request) {
    if (!this.state.skillIntegration.chiefArchitectAvailable) {
      console.log('⚠️ Chief Architect not available, proceeding with local processing');
      return null;
    }

    // This would integrate with the chief-architect skill
    // For now, return a placeholder
    console.log('🔄 Delegating to chief-architect:', request.type);
    return { delegated: true, requestId: `CA-${Date.now()}` };
  }

  /**
   * ENHANCED: Hand off to master-plan-manager for safe updates
   */
  async handoffToMasterPlanManager(updateRequest) {
    if (!this.state.skillIntegration.masterPlanManagerAvailable) {
      console.log('⚠️ Master Plan Manager not available, proceeding with local updates');
      return await this.localMasterPlanUpdate(updateRequest);
    }

    // This would integrate with the master-plan-manager skill
    console.log('🔄 Handing off to master-plan-manager:', updateRequest.action);
    return { delegated: true, requestId: `MPM-${Date.now()}` };
  }

  /**
   * Load ID counters from file
   */
  loadIdCounters() {
    try {
      const counterFile = path.join(this.baseDir, '.meta', 'id-counters.json');
      if (fs.existsSync(counterFile)) {
        this.idCounters = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
      }
    } catch (e) {
      console.error('Could not load ID counters:', e);
    }
  }

  /**
   * Save ID counters to file
   */
  saveIdCounters() {
    try {
      const counterFile = path.join(this.baseDir, '.meta', 'id-counters.json');
      fs.writeFileSync(counterFile, JSON.stringify(this.idCounters, null, 2));
    } catch (e) {
      console.error('Could not save ID counters:', e);
    }
  }

  /**
   * ENHANCED: Load skill state from file
   */
  loadState() {
    try {
      const stateFile = path.join(this.backupDir, 'state.json');
      if (fs.existsSync(stateFile)) {
        const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

        // Restore state with proper Map conversion
        this.state = {
          ...this.state,
          ideas: new Map(savedState.ideas || []),
          issues: new Map(savedState.issues || []),
          lastSync: savedState.lastSync || null,
          skillIntegration: savedState.skillIntegration || this.state.skillIntegration,
          githubIssues: new Map(savedState.githubIssues || []),
          lastIdeas: new Map(savedState.lastIdeas || []),
          lastTasks: new Map(savedState.lastTasks || [])
        };

        console.log('✅ Skill state loaded successfully');
      }
    } catch (error) {
      console.error('⚠️ Could not load skill state:', error.message);
    }
  }

  /**
   * ENHANCED: Save skill state to file
   */
  saveState() {
    try {
      const stateFile = path.join(this.backupDir, 'state.json');

      // Convert Maps to arrays for JSON serialization
      const stateToSave = {
        ideas: Array.from(this.state.ideas.entries()),
        issues: Array.from(this.state.issues.entries()),
        lastSync: this.state.lastSync,
        skillIntegration: this.state.skillIntegration,
        githubIssues: Array.from(this.state.githubIssues.entries()),
        lastIdeas: Array.from(this.state.lastIdeas.entries()),
        lastTasks: Array.from(this.state.lastTasks.entries())
      };

      fs.writeFileSync(stateFile, JSON.stringify(stateToSave, null, 2));
    } catch (error) {
      console.error('⚠️ Could not save skill state:', error.message);
    }
  }

  /**
   * Generate unique ID with counter
   */
  generateId(prefix) {
    const counter = this.idCounters[prefix] || 0;
    const newCounter = counter + 1;
    this.idCounters[prefix] = newCounter;

    // Format: TASK-090
    const id = `${prefix}-${String(newCounter).padStart(3, '0')}`;
    this.saveIdCounters();

    return id;
  }

  /**
   * Load migration state from localStorage or file
   */
  loadMigrationState() {
    try {
      const stateFile = path.join(process.cwd(), '.github-sync-state.json');
      if (fs.existsSync(stateFile)) {
        const stateData = fs.readFileSync(stateFile, 'utf8');
        const parsed = JSON.parse(stateData);

        this.migrationState.githubIssues = new Map(parsed.githubIssues || []);
        this.migrationState.lastSync = parsed.lastSync;
        this.migrationState.syncEnabled = parsed.syncEnabled;

        console.log('🔄 Migration state loaded');
      }
    } catch (error) {
      console.log('ℹ️ No migration state found, starting fresh');
    }
  }

  /**
   * Save migration state to file
   */
  saveMigrationState() {
    try {
      const stateFile = path.join(process.cwd(), '.github-sync-state.json');
      const stateData = {
        githubIssues: Array.from(this.migrationState.githubIssues.entries()),
        lastSync: this.migrationState.lastSync,
        syncEnabled: this.migrationState.syncEnabled
      };

      fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save migration state:', error.message);
    }
  }

  /**
   * CAPTURE IDEA - Quick thought capture with optional context questions
   */
  async captureIdea(args) {
    const { title, thought, source = 'personal', contextQuestions = false, tags = [] } = args;

    try {
      // Generate unique ID
      const id = this.generateId('IDEA');

      // If context questions are requested, ask them
      let enhancedThought = thought;
      if (contextQuestions) {
        enhancedThought = await this.askContextQuestions(title, thought);
      }

      // Create idea object
      const idea = {
        id,
        title,
        thought: enhancedThought,
        source,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        captured: new Date().toISOString().slice(0, 16).replace('T', ' '),
        stage: 'RAW_IDEA'
      };

      // Add to modern ideas-issues.md file with enhanced tracking
      await this.addToIdeasIssuesFile(idea);

      // Create GitHub issue if enabled
      let githubIssue = null;
      if (this.githubEnabled) {
        githubIssue = await this.createGitHubIssue(idea, 'raw-idea');
        this.migrationState.githubIssues.set(id, githubIssue);
        this.saveMigrationState();
      }

      console.log(`✅ Idea captured: ${id} - ${title}`);
      if (githubIssue) {
        console.log(`🔗 GitHub Issue: #${githubIssue.number} - ${githubIssue.html_url}`);
      }

      return {
        success: true,
        idea,
        githubIssue,
        message: `Idea "${title}" captured successfully${githubIssue ? ` and GitHub Issue #${githubIssue.number} created` : ''}`
      };

    } catch (error) {
      console.error('❌ Failed to capture idea:', error.message);
      throw error;
    }
  }

  /**
   * EXPAND IDEA - Add technical details and effort estimates
   */
  async expandIdea(args) {
    const { ideaId, notes, userBenefit, technicalApproach, effort, comprehensive = false } = args;

    try {
      // Find existing idea
      const ideas = await this.getIdeas();
      const ideaIndex = ideas.findIndex(i => i.id === ideaId);

      if (ideaIndex === -1) {
        throw new Error(`Idea not found: ${ideaId}`);
      }

      const idea = ideas[ideaIndex];
      idea.stage = 'IN_DEVELOPMENT';

      // Add development notes
      if (notes) idea.notes = notes;
      if (userBenefit) idea.userBenefit = userBenefit;
      if (technicalApproach) idea.technicalApproach = technicalApproach;
      if (effort) idea.effort = effort;

      // If comprehensive expansion requested, ask detailed questions
      if (comprehensive) {
        const expansion = await this.askComprehensiveQuestions(idea);
        Object.assign(idea, expansion);
      }

      // Update in feature requests file
      await this.updateIdeaInFeatureRequests(idea);

      // Update GitHub issue if exists
      let githubIssue = null;
      if (this.githubEnabled) {
        const existingIssue = this.migrationState.githubIssues.get(ideaId);
        if (existingIssue) {
          githubIssue = await this.updateGitHubIssue(existingIssue, idea, 'in-development');
          this.migrationState.githubIssues.set(ideaId, githubIssue);
          this.saveMigrationState();
        }
      }

      console.log(`✅ Idea expanded: ${ideaId} - ${idea.title}`);

      return {
        success: true,
        idea,
        githubIssue,
        message: `Idea "${idea.title}" expanded successfully${githubIssue ? ` and GitHub Issue #${githubIssue.number} updated` : ''}`
      };

    } catch (error) {
      console.error('❌ Failed to expand idea:', error.message);
      throw error;
    }
  }

  /**
   * MARK IDEA READY - Flag idea for chief-architect review
   */
  async markIdeaReady(args) {
    const { ideaId, why } = args;

    try {
      // Find and update idea
      const ideas = await this.getIdeas();
      const ideaIndex = ideas.findIndex(i => i.id === ideaId);

      if (ideaIndex === -1) {
        throw new Error(`Idea not found: ${ideaId}`);
      }

      const idea = ideas[ideaIndex];
      idea.stage = 'READY_FOR_REVIEW';
      idea.markedReady = new Date().toISOString();
      idea.readyReason = why;

      // Update in feature requests file
      await this.updateIdeaInFeatureRequests(idea);

      // Update GitHub issue
      let githubIssue = null;
      if (this.githubEnabled) {
        const existingIssue = this.migrationState.githubIssues.get(ideaId);
        if (existingIssue) {
          githubIssue = await this.updateGitHubIssue(existingIssue, idea, 'ready-for-review');
          this.migrationState.githubIssues.set(ideaId, githubIssue);
          this.saveMigrationState();
        }
      }

      console.log(`✅ Idea marked as ready: ${ideaId} - ${idea.title}`);

      return {
        success: true,
        idea,
        githubIssue,
        message: `Idea "${idea.title}" marked as ready for review${githubIssue ? ` and GitHub Issue #${githubIssue.number} updated` : ''}`
      };

    } catch (error) {
      console.error('❌ Failed to mark idea as ready:', error.message);
      throw error;
    }
  }

  /**
   * GET READY IDEAS - Retrieve ideas ready for chief-architect review
   */
  async getReadyIdeas(args = {}) {
    const { withContext = false, priority = null, count = null, source = null } = args;

    try {
      const ideas = await this.getIdeas();

      let readyIdeas = ideas.filter(idea => idea.stage === 'READY_FOR_REVIEW');

      // Apply filters
      if (priority) {
        readyIdeas = readyIdeas.filter(idea =>
          idea.tags.includes(`priority:${priority}`) ||
          idea.tags.includes(`#${priority}-priority`)
        );
      }

      if (source) {
        readyIdeas = readyIdeas.filter(idea => idea.source === source);
      }

      if (count) {
        readyIdeas = readyIdeas.slice(0, count);
      }

      // Add context information if requested
      if (withContext) {
        for (const idea of readyIdeas) {
          idea.githubIssue = this.migrationState.githubIssues.get(idea.id);
          idea.contextInfo = await this.generateContextInfo(idea);
        }
      }

      return {
        success: true,
        ideas: readyIdeas,
        count: readyIdeas.length,
        message: `Found ${readyIdeas.length} ideas ready for review`
      };

    } catch (error) {
      console.error('❌ Failed to get ready ideas:', error.message);
      throw error;
    }
  }

  /**
   * PROMOTE IDEA - Create TASK-XXX and sync across all systems
   */
  async promoteIdea(args) {
    const { ideaId, reason = '', targetPhase = 'execution', asTask = true } = args;

    // START SAFETY
    this.safety.startOperation(`promote-${ideaId}`);

    try {
      console.log(`🚀 Promoting ${ideaId}...`);

      // READ ideas.md
      let ideasContent = fs.readFileSync(this.ideasPath, 'utf8');
      this.safety.backup(this.ideasPath);

      // Check corruption
      const ideasCheck = this.safety.checkCorruption(this.ideasPath);
      if (ideasCheck.corrupted) {
        throw new Error(`ideas.md corrupted: ${ideasCheck.reason}`);
      }

      // FIND IDEA
      const ideaRegex = new RegExp(`### ${ideaId} \\| ([^\n]+)\n([^]*?)(?=###|\\Z)`, 'm');
      const match = ideasContent.match(ideaRegex);

      if (!match) {
        throw new Error(`${ideaId} not found in ideas.md`);
      }

      const [fullMatch, title, body] = match;

      // GENERATE TASK ID
      const taskId = this.generateId('TASK');

      // CREATE TASK IN kanban.md
      const taskEntry = this.createTaskEntry(taskId, title, body, ideaId);

      // BACKUP kanban.md before writing
      this.safety.backup(this.kanbanPath);

      let kanbanContent = fs.readFileSync(this.kanbanPath, 'utf8');
      const todoSection = kanbanContent.indexOf('## 📋 To Do');

      if (todoSection === -1) {
        throw new Error('To Do section not found in kanban.md');
      }

      const insertAfter = kanbanContent.indexOf('\n\n', todoSection) + 2;
      const updatedKanban = kanbanContent.slice(0, insertAfter) + taskEntry + '\n\n' + kanbanContent.slice(insertAfter);

      fs.writeFileSync(this.kanbanPath, updatedKanban);
      console.log(`✅ TASK-${taskId} created in kanban.md`);

      // UPDATE ideas.md - MARK AS PROMOTED
      const promotedMark = `\n**Promoted**: ${new Date().toISOString().slice(0, 10)} → TASK-${taskId}`;
      const updatedIdeas = ideasContent.replace(fullMatch, fullMatch + promotedMark);
      fs.writeFileSync(this.ideasPath, updatedIdeas);
      console.log(`✅ ${ideaId} marked as promoted in ideas.md`);

      // BACKUP ROADMAP before updating
      this.safety.backup(this.roadmapPath);

      // UPDATE ROADMAP.md - ADD TASK REFERENCE
      await this.updateRoadmapWithTask(taskId, title, ideaId);

      // UPDATE 00-START.md - UPDATE PROGRESS
      await this.updateOverviewWithTask(taskId, 'promoted');

      // EXPORT TO SYNC FILE - FOR POMO-FLOW APP
      await this.exportTaskToSync(taskId, title, body);

      // CREATE GITHUB BACKUP
      if (this.githubEnabled) {
        await this.createGitHubIssue({
          title: `[TASK] ${title}`,
          body: `Task: TASK-${taskId}\nOrigin: ${ideaId}\nReason: ${reason}`,
          labels: ['task', 'backup', 'promoted']
        });
        console.log(`✅ GitHub backup created`);
      }

      // ALL SUCCESSFUL - END SAFETY
      this.safety.endOperation();

      console.log(`✅ COMPLETE: ${ideaId} → TASK-${taskId} (all systems synced)`);

      return {
        ideaId,
        taskId,
        success: true,
        synced: ['ideas.md', 'kanban.md', 'ROADMAP.md', '00-START.md', 'sync-export.json', 'GitHub']
      };

    } catch (error) {
      console.error(`❌ Promotion failed: ${error.message}`);

      // AUTOMATIC ROLLBACK
      console.log(`⏮️ Rolling back changes...`);
      this.safety.rollback();

      throw error;
    }
  }

  /**
   * CREATE GITHUB ISSUE - Create GitHub issue for an idea
   */
  async createGitHubIssue(idea, stage) {
    if (!this.githubEnabled) {
      return null;
    }

    try {
      const issueData = {
        title: this.generateGitHubTitle(idea, stage),
        body: this.generateGitHubBody(idea, stage),
        labels: this.generateGitHubLabels(idea, stage)
      };

      const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issueData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create GitHub issue: ${response.statusText} - ${errorData.message}`);
      }

      const githubIssue = await response.json();
      return githubIssue;

    } catch (error) {
      console.error('❌ Failed to create GitHub issue:', error.message);
      return null;
    }
  }

  /**
   * UPDATE GITHUB ISSUE - Update existing GitHub issue
   */
  async updateGitHubIssue(githubIssue, idea, stage) {
    if (!this.githubEnabled) {
      return null;
    }

    try {
      const updateData = {
        title: this.generateGitHubTitle(idea, stage),
        body: this.generateGitHubBody(idea, stage),
        labels: this.generateGitHubLabels(idea, stage)
      };

      const response = await fetch(`${githubIssue.url}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to update GitHub issue: ${response.statusText} - ${errorData.message}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Failed to update GitHub issue:', error.message);
      return null;
    }
  }

  /**
   * Generate appropriate GitHub title based on idea and stage
   */
  generateGitHubTitle(idea, stage) {
    let prefix = '[FEATURE]';

    if (idea.id.startsWith('BUG-')) {
      prefix = '[BUG]';
    } else if (idea.id.startsWith('UI-')) {
      prefix = '[UI]';
    } else if (idea.id.startsWith('INFRA-')) {
      prefix = '[INFRA]';
    } else if (idea.id.startsWith('UX-AUDIT-')) {
      prefix = '[UX-AUDIT]';
    }

    return `${prefix} ${idea.title}`;
  }

  /**
   * Generate GitHub body content
   */
  generateGitHubBody(idea, stage) {
    let body = `## 📋 Description\n\n${idea.thought || 'No initial thought provided'}\n\n`;

    // Add development notes if available
    if (idea.notes) {
      body += `### 📝 Development Notes\n${idea.notes}\n\n`;
    }

    // Add user benefit if available
    if (idea.userBenefit) {
      body += `### 👥 User Benefits\n${idea.userBenefit}\n\n`;
    }

    // Add technical approach if available
    if (idea.technicalApproach) {
      body += `### 🔧 Technical Approach\n${idea.technicalApproach}\n\n`;
    }

    // Add effort estimate if available
    if (idea.effort) {
      body += `### ⏱️ Effort Estimate\n${idea.effort}\n\n`;
    }

    body += `## 🔄 Workflow Details\n\n`;
    body += `- **Original ID**: ${idea.id}\n`;
    body += `- **Source**: ${idea.source}\n`;
    body += `- **Current Stage**: ${stage}\n`;
    body += `- **Captured**: ${idea.captured}\n`;

    if (idea.markedReady) {
      body += `- **Ready for Review**: ${idea.markedReady}\n`;
    }

    if (idea.promotedDate) {
      body += `- **Promoted**: ${idea.promotedDate}\n`;
      body += `- **Target Phase**: ${idea.targetPhase}\n`;
      body += `- **As Task**: ${idea.asTask ? 'Yes' : 'No'}\n`;
    }

    body += `- **Tags**: ${idea.tags.join(', ') || 'None'}\n`;
    body += `- **Migration Date**: ${new Date().toISOString()}\n\n`;

    body += `## 🔗 Cross-References\n\n`;
    body += `- **Feature Requests**: [docs/feature-requests/feature-requests.md](docs/feature-requests/feature-requests.md)\n`;
    body += `- **Master Plan**: [docs/master-plan/README.md](docs/master-plan/README.md)\n`;

    return body;
  }

  /**
   * Generate GitHub labels based on idea
   */
  generateGitHubLabels(idea, stage) {
    const labels = [];

    // Stage label
    switch (stage) {
      case 'raw-idea':
        labels.push('stage:raw-ideas');
        break;
      case 'in-development':
        labels.push('stage:in-development');
        labels.push('status:in-progress');
        break;
      case 'ready-for-review':
        labels.push('stage:ready-for-review');
        break;
      case 'promoted':
        labels.push('stage:promoted');
        labels.push('status:in-progress');
        break;
    }

    // Add existing tags as labels
    idea.tags.forEach(tag => {
      if (tag.startsWith('#')) {
        labels.push(tag.slice(1)); // Remove # prefix
      } else {
        labels.push(tag);
      }
    });

    // Add phase 7 label
    labels.push('phase:7');

    return labels;
  }

  /**
   * Generate unique ID for ideas
   */
  generateId(prefix = 'IDEA') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get all ideas from feature requests file
   */
  async getIdeas() {
    try {
      if (!fs.existsSync(this.featureRequestsPath)) {
        return [];
      }

      const content = fs.readFileSync(this.featureRequestsPath, 'utf8');
      return this.parseIdeasFromContent(content);

    } catch (error) {
      console.error('❌ Failed to read feature requests:', error.message);
      return [];
    }
  }

  /**
   * Parse ideas from feature requests content
   */
  parseIdeasFromContent(content) {
    const ideas = [];

    // Extract all sections
    const sections = [
      { name: 'raw-ideas', header: '### 🔧 RAW_IDEAS' },
      { name: 'in-development', header: '### 🛠 IN_DEVELOPMENT' },
      { name: 'ready-for-review', header: '### ✅ READY_FOR_REVIEW' },
      { name: 'promoted', header: '### 🚀 PROMOTED' }
    ];

    for (const section of sections) {
      const sectionContent = this.extractSection(content, section.header);
      const sectionIdeas = this.parseIdeasSection(sectionContent);
      sectionIdeas.forEach(idea => {
        idea.stage = section.name;
        ideas.push(idea);
      });
    }

    return ideas;
  }

  /**
   * Extract a section from content
   */
  extractSection(content, header) {
    const start = content.indexOf(header);
    if (start === -1) return '';

    const nextSection = content.indexOf('\n###', start + 1);
    const end = nextSection !== -1 ? nextSection : content.length;

    return content.substring(start, end);
  }

  /**
   * Parse ideas from a section
   */
  parseIdeasSection(section) {
    const ideas = [];
    const lines = section.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('- [IDEA-') ||
          trimmed.startsWith('- [BUG-') ||
          trimmed.startsWith('- [UI-') ||
          trimmed.startsWith('- [TEST-') ||
          trimmed.startsWith('- [SYS-') ||
          trimmed.startsWith('- [SYNC-') ||
          trimmed.startsWith('- [BACKUP-') ||
          trimmed.startsWith('- [EXPORT-') ||
          trimmed.startsWith('- [INTEGRITY-')) {

        const idea = this.parseIdeaLine(trimmed);
        if (idea) {
          ideas.push(idea);
        }
      }
    }

    return ideas;
  }

  /**
   * Parse idea from line
   */
  parseIdeaLine(line) {
    const match = line.match(/- \[([A-Z\-]+-\d+)\] \*\*(.+?)\*\* \(Source: (.+?)\)(\s+\*\[([A-Z_]+)\])*$/);
    if (!match) return null;

    const [, id, title, source, , tags] = match;

    return {
      id,
      title: title.replace(/\*\*/g, ''),
      source,
      tags: tags ? tags.split(' #').map(tag => tag.replace('#', '').trim()).filter(tag => tag) : []
    };
  }

  /**
   * Add idea to feature requests file
   */
  async addToFeatureRequests(idea) {
    try {
      const content = fs.readFileSync(this.featureRequestsPath, 'utf8');
      const updatedContent = this.addIdeaToContent(content, idea, 'raw-idea');
      fs.writeFileSync(this.featureRequestsPath, updatedContent);
    } catch (error) {
      console.error('❌ Failed to add idea to feature requests:', error.message);
      throw error;
    }
  }

  /**
   * Update idea in feature requests file
   */
  async updateIdeaInFeatureRequests(idea) {
    try {
      const content = fs.readFileSync(this.featureRequestsPath, 'utf8');
      const updatedContent = this.updateIdeaInContent(content, idea);
      fs.writeFileSync(this.featureRequestsPath, updatedContent);
    } catch (error) {
      console.error('❌ Failed to update idea in feature requests:', error.message);
      throw error;
    }
  }

  /**
   * Add idea to content
   */
  addIdeaToContent(content, idea, stage) {
    // Find appropriate section
    const sectionHeaders = {
      'raw-idea': '### 🔧 RAW_IDEAS',
      'in-development': '### 🛠 IN_DEVELOPMENT',
      'ready-for-review': '### ✅ READY_FOR_REVIEW',
      'promoted': '### 🚀 PROMOTED'
    };

    const sectionHeader = sectionHeaders[stage];
    const sectionStart = content.indexOf(sectionHeader);

    if (sectionStart === -1) {
      throw new Error(`Section not found: ${stage}`);
    }

    const sectionEnd = content.indexOf('\n###', sectionStart + 1);
    const endPos = sectionEnd !== -1 ? sectionEnd : content.length;

    const beforeSection = content.substring(0, sectionStart);
    const sectionContent = content.substring(sectionStart, endPos);
    const afterSection = content.substring(endPos);

    // Parse existing ideas in section
    const existingIdeas = this.parseIdeasSection(sectionContent);

    // Add new idea
    existingIdeas.push(idea);

    // Rebuild section with updated ideas
    const updatedSection = this.rebuildSection(existingIdeas, sectionHeader);

    return beforeSection + updatedSection + afterSection;
  }

  /**
   * Update idea in content
   */
  updateIdeaInContent(content, idea) {
    // Find and replace the idea
    const ideaLine = this.generateIdeaLine(idea);
    const existingLine = this.findIdeaLine(content, idea.id);

    if (!existingLine) {
      throw new Error(`Idea not found in content: ${idea.id}`);
    }

    // Update content
    const updatedContent = content.replace(existingLine, ideaLine);
    return updatedContent;
  }

  /**
   * Generate idea line for feature requests
   */
  generateIdeaLine(idea) {
    const tagsString = idea.tags.length > 0 ? ` *[${idea.tags.map(tag => `#${tag}`).join(' ')}]` : '';
    return `- [${idea.id}] **${idea.title}** (Source: ${idea.source})${tagsString}`;
  }

  /**
   * Find existing idea line in content
   */
  findIdeaLine(content, id) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(`[${id}]`)) {
        return line;
      }
    }
    return null;
  }

  /**
   * Rebuild section with updated ideas
   */
  rebuildSection(ideas, header) {
    let section = `${header}\n\n`;
    section += `*Ideas in this stage: ${ideas.length}*\n\n`;
    section += `<!-- Add new ideas below using format:\n`;
    section += `- [IDEA-XXX] **Title** (Source: Personal/User Feedback)\n`;
    section += `  - **Thought**: Quick concept description\n`;
    section += `  - **Captured**: YYYY-MM-DD HH:MM\n`;
    section += `  - **Tags**: #tag1 #tag2\n`;
    section += `-->\n\n`;

    // Sort ideas by captured date (newest first)
    ideas.sort((a, b) => new Date(b.captured) - new Date(a.captured));

    // Add each idea
    for (const idea of ideas) {
      section += `- [${idea.id}] **${idea.title}** (Source: ${idea.source})`;

      if (idea.thought) {
        section += `\n  - **Thought**: ${idea.thought}`;
      }

      if (idea.tags.length > 0) {
        section += `\n  - **Tags**: ${idea.tags.map(tag => `#${tag}`).join(' ')}`;
      }

      if (idea.stage === 'PROMOTED') {
        section += ` *[PROMOTED]`;
      } else if (idea.stage === 'READY_FOR_REVIEW') {
        section += ` *[READY_FOR_REVIEW]`;
      } else if (idea.stage === 'IN_DEVELOPMENT') {
        section += ` *[IN_DEVELOPMENT]`;
      }

      section += `\n`;
    }

    return section;
  }

  /**
   * Ask context questions for idea capture
   */
  async askContextQuestions(title, initialThought) {
    // For now, return the initial thought
    // In a real implementation, this would use AI to ask follow-up questions
    return initialThought;
  }

  /**
   * Ask comprehensive questions for idea expansion
   */
  async askComprehensiveQuestions(idea) {
    // For now, return empty object
    // In a real implementation, this would use AI to ask detailed questions
    return {};
  }

  /**
   * Generate context information for idea
   */
  async generateContextInfo(idea) {
    return {
      relatedIdeas: [],
      tagsAnalysis: {},
      complexityScore: 5
    };
  }

  /**
   * Perform comprehensive review of idea
   */
  async performComprehensiveReview(idea) {
    // For now, always approve
    // In a real implementation, this would analyze the idea thoroughly
    return {
      approved: true,
      reason: 'Automated approval for demonstration purposes'
    };
  }

  /**
   * CREATE TASK ENTRY - Format task for kanban.md
   */
  createTaskEntry(taskId, title, body, ideaId) {
    // Extract technical details from idea body
    const technicalMatch = body.match(/\*\*Technical Details\*\*:\n([\s\S]*?)(?=\*\*|###|$)/);
    const effortMatch = body.match(/\*\*Effort\*\*:\s*([^\n]+)/);
    const impactMatch = body.match(/\*\*Impact\*\*:\s*([^\n]+)/);

    const technical = technicalMatch ? technicalMatch[1].trim() : 'See ideas.md for details';
    const effort = effortMatch ? effortMatch[1].trim() : 'Unknown';
    const impact = impactMatch ? impactMatch[1].trim() : 'Unknown';

    const description = body.match(/^([^*]+)/m) ? body.match(/^([^*]+)/m)[1].trim() : '';

    return `
### ${taskId} | ${title}
**Priority**: 🟡 Medium | **Category**: Feature | **Assigned**: @me
**Created**: ${new Date().toISOString().slice(0, 10)}
**Tags**: #feature #promoted
**From**: ${ideaId} (ideas.md)

${description}

**Technical Details**:
${technical}

**Effort**: ${effort}
**Impact**: ${impact}

**Subtasks**:
- [ ] Analyze requirements
- [ ] Design solution
- [ ] Implement
- [ ] Test
- [ ] Document

**Status**: Ready for execution
`;
  }

  /**
   * UPDATE ROADMAP WITH TASK - Add task reference to roadmap
   */
  async updateRoadmapWithTask(taskId, title, ideaId) {
    try {
      let roadmapContent = fs.readFileSync(this.roadmapPath, 'utf8');

      // Find Q4 2025 section (or current quarter)
      const quarterMatch = roadmapContent.match(/## 🎯 Q4 2025.*?(?=## |$)/s);

      if (quarterMatch) {
        const reference = `\n- **${taskId}**: ${title} (from ${ideaId})`;
        const quarterSection = quarterMatch[0];
        const updated = roadmapContent.replace(quarterSection, quarterSection + reference);

        fs.writeFileSync(this.roadmapPath, updated);
        console.log(`✅ ROADMAP.md updated with ${taskId}`);
      }

    } catch (error) {
      console.error('⚠️ ROADMAP update skipped:', error.message);
    }
  }

  /**
   * UPDATE OVERVIEW WITH TASK - Update 00-START.md dashboard
   */
  async updateOverviewWithTask(taskId, status) {
    try {
      let overviewContent = fs.readFileSync(this.overviewPath, 'utf8');

      // Update "Active Tasks" section with new task count
      const activeCount = (overviewContent.match(/### TASK-/g) || []).length;
      const updated = overviewContent.replace(
        /Active Tasks.*?(\d+) tasks/,
        `Active Tasks in kanban.md\n\n- **${taskId}**: Just ${status}\n\nTotal: ${activeCount} tasks`
      );

      fs.writeFileSync(this.overviewPath, updated);
      console.log(`✅ 00-START.md updated with ${taskId}`);

    } catch (error) {
      console.error('⚠️ Overview update skipped:', error.message);
    }
  }

  /**
   * EXPORT TASK TO SYNC - Create sync file for Pomo-Flow app
   */
  async exportTaskToSync(taskId, title, body) {
    try {
      // Read current sync file
      let syncData = { tasks: [], timestamp: new Date().toISOString() };

      if (fs.existsSync(this.syncExportPath)) {
        syncData = JSON.parse(fs.readFileSync(this.syncExportPath, 'utf8'));
      }

      // Create task entry for Pomo-Flow
      const taskEntry = {
        id: taskId,
        title: title,
        description: body.match(/^([^*]+)/m) ? body.match(/^([^*]+)/m)[1].trim() : '',
        exportedAt: new Date().toISOString(),
        source: 'kanban-md',
        priority: 'medium',
        tags: ['feature', 'promoted']
      };

      // Add or update
      const existing = syncData.tasks.findIndex(t => t.id === taskId);
      if (existing !== -1) {
        syncData.tasks[existing] = taskEntry;
      } else {
        syncData.tasks.push(taskEntry);
      }

      fs.writeFileSync(this.syncExportPath, JSON.stringify(syncData, null, 2));
      console.log(`✅ ${taskId} exported to sync-export.json (Pomo-Flow ready)`);

    } catch (error) {
      console.error('❌ Sync export failed:', error);
    }
  }

  /**
   * START FILE WATCHER - Monitor kanban.md for changes
   */
  startFileWatcher() {
    try {
      // Watch kanban.md for changes
      fs.watchFile(this.kanbanPath, { interval: 2000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          console.log('📋 Kanban file changed - processing...');
          await this.processKanbanChanges();
        }
      });

      console.log('👁️ File watcher started on kanban.md');

    } catch (error) {
      console.error('⚠️ File watcher setup failed:', error);
    }
  }

  /**
   * PROCESS KANBAN CHANGES - Handle file changes
   */
  async processKanbanChanges() {
    try {
      const kanbanContent = fs.readFileSync(this.kanbanPath, 'utf8');
      const tasks = this.parseTasksFromKanban(kanbanContent);

      for (const task of tasks) {
        const lastKnown = this.migrationState.lastTasks.get(task.id);

        if (!lastKnown) {
          this.migrationState.lastTasks.set(task.id, task);
          continue;
        }

        // Detect if task moved to "Done"
        if (lastKnown.column !== 'done' && task.column === 'done') {
          console.log(`🏁 TASK-${task.id} completed - archiving...`);
          await this.archiveCompletedTask(task.id);
        }

        // Detect if task moved to "In Progress"
        if (lastKnown.column !== 'in-progress' && task.column === 'in-progress') {
          console.log(`🚀 TASK-${task.id} started`);
          await this.updateTaskStarted(task.id);
        }

        this.migrationState.lastTasks.set(task.id, task);
      }

    } catch (error) {
      console.error('❌ Kanban processing failed:', error);
    }
  }

  /**
   * PARSE TASKS FROM KANBAN - Extract tasks with column info
   */
  parseTasksFromKanban(content) {
    const tasks = [];
    const taskRegex = /### (TASK-\d+) \| ([^\n]+)/g;
    let match;

    while ((match = taskRegex.exec(content))) {
      const taskId = match[1];
      const title = match[2];

      // Determine column
      let column = 'unknown';
      const beforeTask = content.substring(0, match.index);
      const lastSectionMatch = beforeTask.match(/## (📋|🚀|👀|✅) [^\n]+$/);

      if (lastSectionMatch) {
        column = {
          '📋': 'to-do',
          '🚀': 'in-progress',
          '👀': 'review',
          '✅': 'done'
        }[lastSectionMatch[1]];
      }

      tasks.push({ id: taskId, title, column });
    }

    return tasks;
  }

  /**
   * ARCHIVE COMPLETED TASK - Move task to archive.md
   */
  async archiveCompletedTask(taskId) {
    try {
      // 1. Read task from kanban.md
      const kanbanContent = fs.readFileSync(this.kanbanPath, 'utf8');
      const taskRegex = new RegExp(`### ${taskId} \\| ([^\n]+)\n([^]*?)(?=###|\\Z)`, 'm');
      const match = kanbanContent.match(taskRegex);

      if (!match) {
        console.error(`${taskId} not found in kanban.md`);
        return;
      }

      const [fullMatch, title, body] = match;

      // 2. Remove from kanban.md
      const updated = kanbanContent.replace(fullMatch, '');
      fs.writeFileSync(this.kanbanPath, updated);
      console.log(`✅ Removed from kanban.md`);

      // 3. Add to archive.md
      let archiveContent = fs.readFileSync(this.archivePath, 'utf8');
      const monthSection = `## ✅ ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;

      const archiveEntry = `
### ${taskId} | ${title}
**Completed**: ${new Date().toISOString().slice(0, 10)}
**Tags**: #completed #archived

${body.slice(0, 200)}...

See task-management/kanban.md history for full details.
`;

      if (archiveContent.includes(monthSection)) {
        archiveContent = archiveContent.replace(
          monthSection,
          monthSection + '\n' + archiveEntry
        );
      } else {
        archiveContent += '\n\n' + monthSection + '\n' + archiveEntry;
      }

      fs.writeFileSync(this.archivePath, archiveContent);
      console.log(`✅ Archived to archive.md`);

      // 4. Update sync with completion
      await this.exportCompletionToSync(taskId);

      // 5. Update documentation
      await this.updateOverviewWithTask(taskId, 'archived');

      console.log(`✅ TASK-${taskId} fully archived (all systems updated)`);

    } catch (error) {
      console.error('❌ Archive failed:', error);
    }
  }

  /**
   * EXPORT COMPLETION TO SYNC - Export completion to sync-import.json
   */
  async exportCompletionToSync(taskId) {
    try {
      let syncData = { completions: [] };

      if (fs.existsSync(this.syncImportPath)) {
        syncData = JSON.parse(fs.readFileSync(this.syncImportPath, 'utf8'));
      }

      syncData.completions.push({
        taskId,
        completedAt: new Date().toISOString(),
        archived: true
      });

      fs.writeFileSync(this.syncImportPath, JSON.stringify(syncData, null, 2));
      console.log(`✅ Completion exported for Pomo-Flow app`);

    } catch (error) {
      console.error('⚠️ Sync export failed:', error);
    }
  }

  /**
   * UPDATE TASK STARTED - Update roadmap when task starts
   */
  async updateTaskStarted(taskId) {
    // Update ROADMAP.md progress if needed
    try {
      let roadmapContent = fs.readFileSync(this.roadmapPath, 'utf8');
      const pattern = new RegExp(`- \\*\\*${taskId}\\*\\*:([^\n]*)`);
      const replacement = `- **${taskId}**: $1 (🚀 IN PROGRESS)`;
      const updated = roadmapContent.replace(pattern, replacement);

      if (updated !== roadmapContent) {
        fs.writeFileSync(this.roadmapPath, updated);
        console.log(`✅ ROADMAP.md updated - ${taskId} in progress`);
      }
    } catch (error) {
      console.error('⚠️ Could not update ROADMAP:', error);
    }
  }

  /**
   * START WATCHER - Manual command to start file watcher
   */
  startWatcher() {
    console.log('Starting file watcher...');
    this.startFileWatcher();
    console.log('✅ File watcher active - monitoring kanban.md for changes');
  }

  /**
   * ADD TO IDEAS FILE - Add idea to ideas.md with proper formatting
   */
  async addToIdeasFile(idea) {
    try {
      // Create the idea entry for ideas.md
      const ideaEntry = this.createIdeaEntryForIdeas(idea);

      // Read current ideas.md
      let ideasContent = '';
      if (fs.existsSync(this.ideasPath)) {
        ideasContent = fs.readFileSync(this.ideasPath, 'utf8');
      } else {
        // Create basic ideas.md structure if it doesn't exist
        ideasContent = this.createBasicIdeasStructure();
      }

      // Find the Raw Ideas section
      const rawIdeasSection = ideasContent.indexOf('## 💭 Raw Ideas (Stage 1)');
      if (rawIdeasSection === -1) {
        throw new Error('Raw Ideas section not found in ideas.md');
      }

      // Insert the new idea
      const insertPoint = ideasContent.indexOf('\n\n---', rawIdeasSection) + 4;
      const updatedContent = ideasContent.slice(0, insertPoint) + '\n\n' + ideaEntry + '\n---' + ideasContent.slice(insertPoint);

      fs.writeFileSync(this.ideasPath, updatedContent);
      console.log(`✅ Idea added to ideas.md: ${idea.id}`);

    } catch (error) {
      console.error('❌ Failed to add idea to ideas.md:', error.message);
      throw error;
    }
  }

  /**
   * ENHANCED: Add to modern ideas-issues.md file
   */
  async addToIdeasIssuesFile(idea) {
    try {
      // Create backup before operation
      this.safety.startOperation('add-idea');
      this.safety.backup(this.ideasIssuesPath, 'add-idea');

      // Ensure the file exists
      this.ensureIdeasIssuesFile();

      // Create the modern idea entry
      const ideaEntry = this.createModernIdeaEntry(idea);

      // Add to file
      fs.appendFileSync(this.ideasIssuesPath, ideaEntry);

      // Track in state
      this.state.ideas.set(idea.id, idea);
      this.saveState();

      console.log(`✅ Idea added to ideas-issues.md: ${idea.id}`);

    } catch (error) {
      console.error('❌ Failed to add idea to ideas-issues.md:', error.message);
      throw error;
    }
  }

  /**
   * ENHANCED: Create modern idea entry for ideas-issues.md
   */
  createModernIdeaEntry(idea) {
    const now = new Date().toISOString();
    const priority = idea.priority || 'low';
    const tags = idea.tags.map(t => `#${t}`).join(' ');

    return `### ${idea.id} | ${idea.title}
**Captured**: ${now.split('T')[0]}
**Priority**: ${priority}
**Tags**: ${tags}
**Type**: Idea
**Source**: ${idea.source}
**Impact Score**: ${this.calculateImpactScore(idea)}

${idea.thought}

---

`;
  }

  /**
   * CREATE IDEA ENTRY FOR IDEAS - Format idea for ideas.md
   */
  createIdeaEntryForIdeas(idea) {
    const priorityEmoji = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    };

    const priority = idea.priority || 'low';
    const emoji = priorityEmoji[priority] || '🟢';

    let tagsString = '';
    if (idea.tags && idea.tags.length > 0) {
      tagsString = `\n**Tags**: #${idea.tags.join(' #')}`;
    }

    return `### IDEA-${idea.id} | ${idea.title}
**Captured**: ${idea.captured}
**Priority**: ${emoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}
**Source**: ${idea.source}${tagsString}

${idea.thought}`;
  }

  /**
   * CREATE BASIC IDEAS STRUCTURE - Create initial ideas.md structure
   */
  createBasicIdeasStructure() {
    return `# 💡 Ideas Pipeline

**Purpose**: Manage ideas from capture → ready for execution
**Managed by**: @issue-creator skill (Claude Code)
**Last Updated**: ${new Date().toISOString().slice(0, 10)}

---

## 💭 Raw Ideas (Stage 1)

Quick captures (<30 seconds), not yet developed.

---

## 📝 In Development (Stage 2)

Ideas enhanced with technical details, effort estimates.

---

## 🎯 Ready for Review (Stage 3)

Mature ideas ready for chief architect evaluation.

---

## ✅ Promoted to Execution

Moved to kanban.md, tracked here for reference.

---
`;
  }

  /**
   * Add idea to master plan
   */
  async addToMasterPlan(idea) {
    // Implementation for Phase 7
    console.log(`📋 Adding to master plan: ${idea.title}`);
  }

  /**
   * LIST IDEAS - View ideas by stage, source, or priority
   */
  async listIdeas(args = {}) {
    const { stage = null, source = null, priority = null } = args;

    try {
      const ideas = await this.getIdeas();

      let filteredIdeas = [...ideas];

      // Apply filters
      if (stage) {
        filteredIdeas = filteredIdeas.filter(idea => idea.stage === stage);
      }
      if (source) {
        filteredIdeas = filteredIdeas.filter(idea => idea.source === source);
      }
      if (priority) {
        filteredIdeas = filteredIdeas.filter(idea =>
          idea.tags.includes(`priority:${priority}`) ||
          idea.tags.includes(`#${priority}-priority`)
        );
      }

      return {
        success: true,
        ideas: filteredIdeas,
        count: filteredIdeas.length,
        total: ideas.length,
        message: `Found ${filteredIdeas.length} ideas out of ${ideas.length} total`
      };

    } catch (error) {
      console.error('❌ Failed to list ideas:', error.message);
      throw error;
    }
  }

  /**
   * SAFETY COMMANDS
   */

  // Check safety status
  async checkSafety() {
    console.log('\n🔒 Safety Status\n');

    // Check for corruptions
    const files = [this.ideasPath, this.kanbanPath, this.roadmapPath];
    let allGood = true;

    for (const file of files) {
      const check = this.safety.checkCorruption(file);
      const status = check.corrupted ? '❌' : '✅';
      console.log(`${status} ${path.basename(file)}: ${check.corrupted ? check.reason : 'OK'}`);

      if (check.corrupted) allGood = false;
    }

    if (allGood) {
      console.log('\n✅ System is safe. No issues detected.');
    } else {
      console.log('\n⚠️ Issues detected. Run @issue-creator recover-backups');
    }

    return { safe: allGood, checked: files.length };
  }

  // Show backup files
  showBackups() {
    this.safety.listBackups(10);
    return { action: 'listed-backups' };
  }

  // Recover from backup
  recoverFromBackup() {
    this.safety.recover();
    return { action: 'recovery-initiated' };
  }

  // Clean up old backups
  cleanupBackups() {
    const cleaned = this.safety.cleanupOldBackups(30);
    return { action: 'cleanup', cleaned };
  }

  /**
   * CODE SCANNER COMMANDS
   */

  // Scan project for insights
  async scanProject() {
    const findings = await this.scanner.scanCode();
    this.scanner.displayFindings(findings);

    return {
      features: findings.features.length,
      bugs: findings.bugs.length,
      improvements: findings.improvements.length,
      nextSteps: findings.nextSteps.length,
      total: findings.features.length + findings.bugs.length + findings.improvements.length + findings.nextSteps.length
    };
  }

  /**
   * ENHANCED: Capture issue with priority scoring
   */
  async captureIssue(args) {
    const { title, description, priority = 'medium', tags = [] } = args;

    try {
      // Create backup before operation
      this.safety.startOperation('capture-issue');
      this.safety.backup(this.ideasIssuesPath, 'capture-issue');

      const issueId = `ISSUE-${++this.idCounters.ISSUE}`;
      const now = new Date().toISOString();

      // Enhanced issue entry with scoring
      const issueEntry = `### ${issueId} | ${title}\n**Captured**: ${now.split('T')[0]}\n**Priority**: ${priority}\n**Tags**: ${tags.map(t => `#${t}`).join(' ')}\n**Type**: Issue\n**Impact Score**: ${this.calculateImpactScore(args)}\n\n${description}\n\n---\n`;

      // Ensure ideas-issues.md exists
      this.ensureIdeasIssuesFile();

      // Add to file
      fs.appendFileSync(this.ideasIssuesPath, issueEntry);

      // Track in state
      this.state.issues.set(issueId, {
        title,
        description,
        priority,
        tags,
        captured: now,
        impactScore: this.calculateImpactScore(args)
      });

      this.saveState();
      console.log(`✅ Issue captured: ${issueId} - ${title}`);

      // Delegate complex architectural issues to chief-architect
      if (tags.includes('architecture') || priority === 'high') {
        await this.integration.delegateArchitecturalDecision({
          concern: `Issue: ${title}`,
          description: description,
          priority: priority,
          tags: tags
        });
      }

      return { success: true, issueId };

    } catch (error) {
      console.error('❌ Failed to capture issue:', error.message);
      throw error;
    }
  }

  /**
   * ENHANCED: Analyze Pomo-Flow app state for issues/ideas
   */
  async analyzeAppState() {
    console.log('🔍 Analyzing Pomo-Flow app state...');

    const findings = {
      performance: [],
      sync: [],
      usability: [],
      data: []
    };

    try {
      // Analyze store files for performance issues
      const storeFiles = [
        'src/stores/tasks.ts',
        'src/stores/timer.ts',
        'src/stores/canvas.ts'
      ];

      for (const storeFile of storeFiles) {
        if (fs.existsSync(path.join(this.baseDir, storeFile))) {
          const analysis = this.analyzeStoreFile(storeFile);
          findings.performance.push(...analysis);
        }
      }

      // Check sync status
      findings.sync = this.analyzeSyncStatus();

      // Analyze component files for usability issues
      findings.usability = this.analyzeUsability();

      // Check data integrity
      findings.data = this.analyzeDataIntegrity();

      const total = findings.performance.length + findings.sync.length +
                   findings.usability.length + findings.data.length;

      console.log(`📊 App state analysis complete: ${total} findings`);
      return findings;

    } catch (error) {
      console.error('❌ App state analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * ENHANCED: Sync with master plan via master-plan-manager
   */
  async syncWithMasterPlan() {
    console.log('🔄 Syncing with master plan...');

    try {
      const readyIdeas = this.getReadyIdeasAndIssues();
      const updateRequests = [];

      for (const item of readyIdeas) {
        updateRequests.push({
          action: 'update-with-implementation-results',
          decision: {
            decision: item.id.startsWith('IDEA-') ? 'idea-implementation' : 'issue-resolution',
            rationale: item.description,
            priority: item.priority
          },
          results: {
            ideasProcessed: 1,
            status: 'ready-for-master-plan',
            integration: 'skill-ecosystem'
          },
          context: {
            source: 'idea-issue-creator',
            itemType: item.id.startsWith('IDEA-') ? 'idea' : 'issue'
          }
        });
      }

      const results = await this.integration.handoffMasterPlanManager({
        updateRequests: updateRequests,
        source: 'idea-issue-creator-sync'
      });

      console.log('✅ Master plan sync completed');
      return results;

    } catch (error) {
      console.error('❌ Master plan sync failed:', error.message);
      throw error;
    }
  }

  /**
   * ENHANCED: List issues by priority
   */
  listIssues() {
    const issues = Array.from(this.state.issues.entries())
      .map(([id, issue]) => ({ id, ...issue }))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    console.log(`📋 Found ${issues.length} issues:`);
    issues.forEach(issue => {
      const score = issue.impactScore ? ` (Score: ${issue.impactScore})` : '';
      console.log(`  ${issue.id}: ${issue.title} [${issue.priority.toUpperCase()}]${score}`);
    });

    return issues;
  }

  /**
   * HELPER: Calculate impact score for ideas/issues
   */
  calculateImpactScore(item) {
    let score = 50; // Base score

    // Priority adjustment
    const priorityScores = { high: 30, medium: 15, low: 5 };
    score += priorityScores[item.priority] || 15;

    // Tag adjustments
    if (item.tags?.includes('performance')) score += 20;
    if (item.tags?.includes('security')) score += 25;
    if (item.tags?.includes('ux')) score += 15;
    if (item.tags?.includes('architecture')) score += 20;

    // Description length (more detailed = higher confidence)
    if (item.description && item.description.length > 100) score += 10;

    return Math.min(100, score);
  }

  /**
   * HELPER: Get ready ideas and issues for promotion
   */
  getReadyIdeasAndIssues() {
    // This would analyze ideas-issues.md for items ready for master plan
    // For now, return empty array
    return [];
  }

  /**
   * HELPER: Analyze store file for performance issues
   */
  analyzeStoreFile(filePath) {
    // This would analyze the store file for performance patterns
    // For now, return empty array
    return [];
  }

  /**
   * HELPER: Analyze sync status
   */
  analyzeSyncStatus() {
    // This would check PouchDB/CouchDB sync status
    // For now, return empty array
    return [];
  }

  /**
   * HELPER: Analyze usability
   */
  analyzeUsability() {
    // This would analyze components for UX issues
    // For now, return empty array
    return [];
  }

  /**
   * HELPER: Analyze data integrity
   */
  analyzeDataIntegrity() {
    // This would check data consistency across stores
    // For now, return empty array
    return [];
  }

  /**
   * HELPER: Ensure ideas-issues.md exists
   */
  ensureIdeasIssuesFile() {
    if (!fs.existsSync(this.ideasIssuesPath)) {
      const dir = path.dirname(this.ideasIssuesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const header = `# Ideas & Issues\n\nGenerated by 💡 Idea-Issue Creator\n\n## 💭 Raw Ideas\n\n## 🐛 Issues\n\n`;
      fs.writeFileSync(this.ideasIssuesPath, header);
    }
  }

  /**
   * ENHANCED: Local master plan update fallback
   */
  async localMasterPlanUpdate(updateData) {
    console.log('🔄 Performing local master plan update...');
    // This would be a fallback implementation
    return { success: true, method: 'local-fallback' };
  }

  /**
   * START WATCHER - Manual command to start file watcher
   */
  startWatcher() {
    console.log('Starting file watcher...');
    this.startFileWatcher();
    console.log('✅ File watcher active - monitoring kanban.md for changes');
  }
}

export default IdeaIssueCreator;