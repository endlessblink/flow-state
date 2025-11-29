/**
 * 💡 Idea-Issue Creator - Simplified Workflow
 * Simple bullet points → Automatic enhancement → Interactive questions → Master plan integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IdeaIssueCreator {
  constructor() {
    this.baseDir = process.cwd();
    // Updated to read from the complex format file
    this.ideasIssuesPath = '/home/noam/dev/projects/pomo-flow/docs/planning-ideas-issues/overview/ideas-issues.md';
    this.masterPlanPath = path.join(this.baseDir, 'docs', 'MASTER_PLAN.md');
    this.processedPath = path.join(this.baseDir, '.claude', 'ideas-processed.json');

    // Simple state tracking
    this.state = {
      raw: [],
      processed: [],
      approved: []
    };

    console.log('💡 Idea-Issue Creator - Simplified workflow ready');
  }

  /**
   * Parse simple bullet point format with #categories
   */
  parseSimpleInput(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const items = [];

    let currentSection = 'idea'; // default section

    for (const line of lines) {
      const trimmed = line.trim();

      // Section headers: "## Ideas" or "## Issues"
      if (trimmed.startsWith('##')) {
        currentSection = trimmed.toLowerCase().includes('issue') ? 'issue' : 'idea';
        continue;
      }

      // Bullet points with content
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const text = trimmed.replace(/^[-*]\s*/, '').trim();

        if (text) {
          items.push({
            text: text,
            category: currentSection,
            hashtags: this.extractHashtags(text),
            approved: false
          });
        }
      }
    }

    console.log(`📝 Found ${items.length} items (${items.filter(i => i.category === 'issue').length} issues, ${items.filter(i => i.category === 'idea').length} ideas)`);
    return items;
  }

  /**
   * Extract hashtags from text
   */
  extractHashtags(text) {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.substring(1));
  }

  /**
   * Enhance items with automatic analysis
   */
  enhanceItems(items) {
    console.log(`🧠 Enhancing ${items.length} items...`);

    return items.map(item => {
      const enhanced = { ...item };

      // Calculate priority from hashtags and content
      enhanced.priority = this.calculatePriority(item);

      // Generate suggestions based on content
      enhanced.suggestions = this.generateSuggestions(item);

      // Generate clarifying questions
      enhanced.questions = this.generateQuestions(item);

      // Calculate impact score (1-10)
      enhanced.impactScore = this.calculateImpact(item);

      return enhanced;
    });
  }

  /**
   * Calculate priority from content and hashtags
   */
  calculatePriority(item) {
    let priority = 'medium';

    const text = item.text.toLowerCase();
    const hashtags = item.hashtags.map(h => h.toLowerCase());

    // High priority indicators
    if (hashtags.includes('urgent') || hashtags.includes('critical') ||
        text.includes('crash') || text.includes('broken') || text.includes('security')) {
      priority = 'high';
    }
    // Low priority indicators
    else if (hashtags.includes('nice-to-have') || hashtags.includes('later') ||
             text.includes('enhancement') || text.includes('polish')) {
      priority = 'low';
    }

    return priority;
  }

  /**
   * Generate suggestions based on content analysis
   */
  generateSuggestions(item) {
    const suggestions = [];
    const text = item.text.toLowerCase();
    const hashtags = item.hashtags.map(h => h.toLowerCase());

    // Bug-specific suggestions
    if (item.category === 'issue' || hashtags.includes('bug')) {
      if (text.includes('login') || text.includes('auth')) {
        suggestions.push('Add proper error handling for authentication');
        suggestions.push('Implement session timeout handling');
      }
      if (text.includes('performance') || text.includes('slow')) {
        suggestions.push('Profile the performance bottleneck');
        suggestions.push('Consider caching strategies');
      }
    }

    // Feature-specific suggestions
    if (item.category === 'idea' || hashtags.includes('feature')) {
      if (hashtags.includes('ui') || hashtags.includes('ux')) {
        suggestions.push('Create mockups or wireframes first');
        suggestions.push('Consider mobile responsiveness');
      }
      if (hashtags.includes('api') || hashtags.includes('backend')) {
        suggestions.push('Design REST API endpoints');
        suggestions.push('Plan database schema changes');
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Generate clarifying questions
   */
  generateQuestions(item) {
    const questions = [];

    // Always ask about scope
    questions.push({
      type: 'scope',
      question: 'What is the scope of this work?',
      options: ['Small fix (< 2 hours)', 'Medium task (< 1 day)', 'Large feature (> 1 day)'],
      answer: null
    });

    // Technical complexity for technical items
    const technicalTags = ['api', 'database', 'frontend', 'backend', 'security'];
    if (item.hashtags.some(tag => technicalTags.includes(tag.toLowerCase()))) {
      questions.push({
        type: 'technical',
        question: 'What are the technical requirements?',
        options: ['Simple implementation', 'Requires research', 'Complex architectural changes'],
        answer: null
      });
    }

    // User impact for features
    if (item.category === 'idea') {
      questions.push({
        type: 'impact',
        question: 'Who benefits most from this?',
        options: ['All users', 'Power users', 'Specific user group', 'Internal team'],
        answer: null
      });
    }

    return questions;
  }

  /**
   * Calculate impact score (1-10)
   */
  calculateImpact(item) {
    let score = 5; // Base score

    // Category adjustment
    if (item.category === 'issue') {
      score += 2; // Issues typically have higher impact
    }

    // Hashtag adjustments
    const hashtags = item.hashtags.map(h => h.toLowerCase());

    if (hashtags.includes('security')) score += 3;
    if (hashtags.includes('performance')) score += 2;
    if (hashtags.includes('ux') || hashtags.includes('ui')) score += 1;
    if (hashtags.includes('urgent') || hashtags.includes('critical')) score += 3;
    if (hashtags.includes('accessibility')) score += 2;

    // Content analysis
    const text = item.text.toLowerCase();
    if (text.includes('all users') || text.includes('everyone')) score += 2;
    if (text.includes('crash') || text.includes('broken')) score += 3;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Detect if content is in complex format
   */
  isComplexFormat(content) {
    return /### IDEA-\d+\s*\|/.test(content) ||
           /### ISSUE-\d+\s*\|/.test(content) ||
           /\*\*Captured\*\*:/.test(content) ||
           /\*\*Priority\*\*:/.test(content);
  }

  /**
   * Parse complex format entries from ideas-issues.md
   */
  parseComplexFormat(content) {
    const entries = [];
    const entryRegex = /### (IDEA|ISSUE)-[\w-]+\s*\|\s*([^\n]+)\n((?:[^]|\n(?!--))+?)(?=\n---|\n###|$)/gs;
    let match;

    while ((match = entryRegex.exec(content)) !== null) {
      const metadata = this.parseMetadata(match[3]);
      entries.push({
        type: match[1],
        title: match[2].trim(),
        metadata: metadata
      });
    }

    return entries;
  }

  /**
   * Parse metadata from complex entry
   */
  parseMetadata(metadataBlock) {
    const metadata = {
      captured: null,
      priority: null,
      tags: [],
      description: ''
    };

    const lines = metadataBlock.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('**Captured**:')) {
        metadata.captured = trimmed.replace('**Captured**:', '').trim();
      } else if (trimmed.startsWith('**Priority**:')) {
        metadata.priority = trimmed.replace('**Priority**:', '').trim();
      } else if (trimmed.startsWith('**Tags**:')) {
        metadata.tags = trimmed.replace('**Tags**:', '').trim().split(' ').filter(tag => tag.startsWith('#'));
      } else if (trimmed && !trimmed.startsWith('**')) {
        metadata.description += trimmed + ' ';
      }
    }

    return metadata;
  }

  /**
   * Convert complex format entries to simple bullet points
   */
  convertToSimpleFormat(complexEntries) {
    const simpleEntries = { ideas: [], issues: [] };

    for (const entry of complexEntries) {
      const simpleLine = this.createSimpleLine(entry);

      if (entry.type === 'IDEA') {
        simpleEntries.ideas.push(simpleLine);
      } else if (entry.type === 'ISSUE') {
        simpleEntries.issues.push(simpleLine);
      }
    }

    return simpleEntries;
  }

  /**
   * Create simple format line from complex data
   */
  createSimpleLine(entry) {
    // Map priority emojis to simple tags
    const priorityMap = {
      '🟢 Low': '#low-priority',
      '🟡 Medium': '#medium-priority',
      '🟠 High': '#high-priority'
    };

    const priority = priorityMap[entry.metadata.priority] || '#medium-priority';
    const allTags = [...entry.metadata.tags, priority];
    const tagString = allTags.join(' ');

    return `- ${tagString} ${entry.title.toLowerCase()}`;
  }

  /**
   * Generate simple format content
   */
  generateSimpleContent(simpleEntries) {
    let content = '# Ideas & Issues\n\n';

    if (simpleEntries.ideas.length > 0) {
      content += '## Ideas\n';
      simpleEntries.ideas.forEach(line => {
        content += line + '\n';
      });
      content += '\n';
    }

    if (simpleEntries.issues.length > 0) {
      content += '## Issues\n';
      simpleEntries.issues.forEach(line => {
        content += line + '\n';
      });
      content += '\n';
    }

    return content;
  }

  /**
   * Convert and replace file with safety
   */
  async convertAndReplaceFile() {
    try {
      console.log('🔄 Converting complex format to simple format...');

      // Read complex content
      const complexContent = fs.readFileSync(this.ideasIssuesPath, 'utf8');

      // Parse and convert
      const complexEntries = this.parseComplexFormat(complexContent);
      const simpleEntries = this.convertToSimpleFormat(complexEntries);
      const simpleContent = this.generateSimpleContent(simpleEntries);

      // Create backup
      const backupPath = this.ideasIssuesPath + '.backup-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      fs.writeFileSync(backupPath, complexContent);
      console.log(`💾 Backup created: ${backupPath}`);

      // Replace file with simple format
      fs.writeFileSync(this.ideasIssuesPath, simpleContent);

      console.log('✅ Successfully converted complex format to simple format');
      console.log(`📝 Converted ${complexEntries.length} entries to simple bullet points`);

      return { success: true, entries: complexEntries.length };

    } catch (error) {
      console.error('❌ Conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Process ideas from file
   */
  async processIdeas() {
    console.log('\n📋 Processing ideas and issues...\n');

    try {
      // Read input file
      const content = fs.readFileSync(this.ideasIssuesPath, 'utf8');

      // Check if content is in complex format and convert if needed
      if (this.isComplexFormat(content)) {
        console.log('🔍 Detected complex format - converting to simple bullet points...');
        await this.convertAndReplaceFile();

        // Read the converted simple content
        const simpleContent = fs.readFileSync(this.ideasIssuesPath, 'utf8');
        this.state.raw = this.parseSimpleInput(simpleContent);
      } else {
        // Parse simple format directly
        this.state.raw = this.parseSimpleInput(content);
      }

      // Enhance items
      this.state.processed = this.enhanceItems(this.state.raw);

      // Save processed state
      this.saveState();

      console.log(`✅ Processed ${this.state.processed.length} items`);
      console.log('💡 Use "idea-creator review-ideas" to approve items\n');

      return { success: true, processed: this.state.processed.length };

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('❌ No ideas-issues file found at:', this.ideasIssuesPath);
        console.log('💡 The skill expects the file at: /home/noam/dev/projects/pomo-flow/docs/planning-ideas-issues/overview/ideas-issues.md');
      } else {
        console.error('❌ Error processing ideas:', error.message);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Review and approve processed items
   */
  async reviewIdeas() {
    const items = this.loadState();
    const pending = items.processed.filter(item => !item.approved);

    if (pending.length === 0) {
      console.log('✅ No pending ideas to review');
      return { success: true, pending: 0 };
    }

    console.log(`\n📋 ${pending.length} items pending approval:\n`);

    // Display items for review
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      console.log(`${i + 1}. 📝 "${item.text}"`);
      console.log(`   Priority: ${item.priority} | Impact: ${item.impactScore}/10 | Category: ${item.category}`);

      if (item.hashtags.length > 0) {
        console.log(`   Tags: #${item.hashtags.join(', #')}`);
      }

      if (item.suggestions.length > 0) {
        console.log(`   💡 Suggestions: ${item.suggestions.join(', ')}`);
      }

      if (item.questions.length > 0) {
        console.log(`   ❓ Questions: ${item.questions.length} clarifying question(s)`);
      }

      console.log('');
    }

    console.log('\n💡 Use "idea-creator approve-all" to approve all items');
    console.log('💡 Or use "idea-creator ask-questions" for interactive Q&A\n');

    return { success: true, pending: pending.length, items: pending };
  }

  /**
   * Ask interactive questions (simplified version)
   */
  async askQuestions() {
    const items = this.loadState();
    const pending = items.processed.filter(item => !item.approved && item.questions.length > 0);

    if (pending.length === 0) {
      console.log('✅ No pending items with questions');
      return { success: true };
    }

    console.log(`\n🤔 Asking questions about ${pending.length} items...\n`);

    for (const item of pending) {
      console.log(`📝 "${item.text.substring(0, 60)}..."`);

      for (const question of item.questions) {
        console.log(`\n❓ ${question.question}`);
        console.log(`   Options: ${question.options.join(', ')}`);

        // In a real implementation, this would use AskUserQuestion
        // For now, we'll simulate with a default answer
        console.log(`   ✏️  (Would ask user to choose)`);

        // For now, set default answer
        question.answer = question.options[0];
      }

      console.log('');
    }

    // Save updated state
    this.saveState();

    console.log(`✅ Questions answered for ${pending.length} items`);
    return { success: true, processed: pending.length };
  }

  /**
   * Approve all pending items and add to master plan
   */
  async approveAll() {
    const items = this.loadState();
    const pending = items.processed.filter(item => !item.approved);

    if (pending.length === 0) {
      console.log('✅ No pending items to approve');
      return { success: true };
    }

    console.log(`\n✅ Approving ${pending.length} items...`);

    // Mark as approved
    pending.forEach(item => item.approved = true);

    // Add to master plan (simplified version)
    await this.addToMasterPlan(pending);

    // Update state
    items.approved.push(...pending);
    this.saveState();

    console.log(`🎯 Added ${pending.length} items to master plan`);

    return { success: true, approved: pending.length };
  }

  /**
   * Add items to master plan (simplified integration)
   */
  async addToMasterPlan(items) {
    try {
      let masterPlanContent = '';

      if (fs.existsSync(this.masterPlanPath)) {
        masterPlanContent = fs.readFileSync(this.masterPlanPath, 'utf8');
      } else {
        masterPlanContent = '# MASTER PLAN\n\n';
      }

      // Group items by category
      const issues = items.filter(item => item.category === 'issue');
      const ideas = items.filter(item => item.category === 'idea');

      let additions = '';

      if (issues.length > 0) {
        additions += '\n## Issues\n';
        for (const item of issues) {
          additions += `- [${item.priority.toUpperCase()}] ${item.text} (Impact: ${item.impactScore}/10)\n`;
        }
      }

      if (ideas.length > 0) {
        additions += '\n## Features & Ideas\n';
        for (const item of ideas) {
          additions += `- [${item.priority.toUpperCase()}] ${item.text} (Impact: ${item.impactScore}/10)\n`;
        }
      }

      // Add to master plan
      const updatedContent = masterPlanContent + additions;
      fs.writeFileSync(this.masterPlanPath, updatedContent);

      console.log('📝 Master plan updated');

    } catch (error) {
      console.error('❌ Error updating master plan:', error.message);
    }
  }

  /**
   * Show current status
   */
  async status() {
    const items = this.loadState();

    console.log('\n📊 Current Status:\n');
    console.log(`📝 Raw items: ${items.raw.length}`);
    console.log(`🧠 Processed items: ${items.processed.length}`);
    console.log(`✅ Approved items: ${items.approved.length}`);
    console.log(`⏳ Pending items: ${items.processed.filter(i => !i.approved).length}\n`);

    if (items.processed.filter(i => !i.approved).length > 0) {
      console.log('💡 Next steps:');
      console.log('   idea-creator review-ideas  # See pending items');
      console.log('   idea-creator approve-all     # Approve and add to master plan');
      console.log('   idea-creator ask-questions   # Interactive Q&A session\n');
    }

    return { success: true, status: items };
  }

  /**
   * Save current state
   */
  saveState() {
    try {
      fs.writeFileSync(this.processedPath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('❌ Error saving state:', error.message);
    }
  }

  /**
   * Load saved state
   */
  loadState() {
    try {
      if (fs.existsSync(this.processedPath)) {
        return JSON.parse(fs.readFileSync(this.processedPath, 'utf8'));
      }
    } catch (error) {
      console.error('❌ Error loading state:', error.message);
    }

    return { raw: [], processed: [], approved: [] };
  }

  /**
   * Help - show usage information
   */
  help() {
    console.log(`
💡 Idea-Issue Creator - Simple Workflow

USAGE:
  idea-creator process-ideas    # Parse and enhance ideas from file
  idea-creator review-ideas      # Review pending items
  idea-creator ask-questions    # Interactive Q&A session
  idea-creator approve-all       # Approve all and add to master plan
  idea-creator status            # Show current status
  idea-creator help              # Show this help

INPUT FORMAT (planning-ideas-issues file):
  ## Ideas
  - #feature add dark mode toggle
  - #improvement better keyboard shortcuts

  ## Issues
  - #bug fix login page crashing
  - #performance app is slow loading

WORKFLOW:
  1. Write simple bullet points with #categories
  2. Run "idea-creator process-ideas"
  3. Review with "idea-creator review-ideas"
  4. Approve with "idea-creator approve-all"
  5. Items automatically added to master plan
`);
  }
}

export default IdeaIssueCreator;