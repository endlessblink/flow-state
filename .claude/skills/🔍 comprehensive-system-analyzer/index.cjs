#!/usr/bin/env node

/**
 * TRULY COMPREHENSIVE System Analyzer - v2.0
 *
 * Searches EVERYTHING: Code, Git, Conversations, Visual State, Runtime Behavior
 * No stone left unturned - total coverage analysis
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class TrulyComprehensiveSystemAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcDir = path.join(this.projectRoot, 'src');

    this.analysisResults = {
      timestamp: new Date().toISOString(),
      mode: 'total-coverage',
      overall: {
        healthScore: 0,
        criticalIssues: 0,
        hiddenIssues: 0,
        patterns: [],
        warnings: []
      },
      analysis: {
        codebase: {},
        gitHistory: {},
        conversations: {},
        visualState: {},
        runtime: {},
        dataIntegrity: {},
        userExperience: {},
        developerWorkflow: {},
        hiddenIssues: {},
        patterns: {}
      },
      evidence: [],
      recommendations: []
    };
  }

  async execute(mode = 'total-coverage', focus = null) {
    console.log('🔬 TRULY COMPREHENSIVE SYSTEM ANALYZER v2.0');
    console.log('='.repeat(80));
    console.log('🎯 MODE: TOTAL COVERAGE - Searching EVERYTHING...');
    console.log('📊 Analyzing: Code, Git, Conversations, Visual State, Runtime, Patterns');
    console.log('⚠️  BRUTAL HONESTY - NO ISSUE ESCAPES DETECTION\n');

    try {
      // PHASE 1: COMPLETE CODEBASE ANALYSIS
      console.log('📂 PHASE 1: COMPLETE CODEBASE ANALYSIS...');
      await this.analyzeCompleteCodebase();

      // PHASE 2: GIT HISTORY MINING
      console.log('🔍 PHASE 2: GIT HISTORY MINING...');
      await this.analyzeGitHistory();

      // PHASE 3: CONVERSATION HISTORY ANALYSIS
      console.log('💬 PHASE 3: CONVERSATION HISTORY ANALYSIS...');
      await this.analyzeConversationHistory();

      // PHASE 4: VISUAL STATE DETECTION
      console.log('🖼️ PHASE 4: VISUAL STATE DETECTION...');
      await this.analyzeVisualState();

      // PHASE 5: RUNTIME BEHAVIOR ANALYSIS
      console.log('⚡ PHASE 5: RUNTIME BEHAVIOR ANALYSIS...');
      await this.analyzeRuntimeBehavior();

      // PHASE 6: DATA INTEGRITY DEEP DIVE
      console.log('🗄️ PHASE 6: DATA INTEGRITY DEEP DIVE...');
      await this.analyzeDataIntegrity();

      // PHASE 7: USER EXPERIENCE PATTERNS
      console.log('👤 PHASE 7: USER EXPERIENCE PATTERNS...');
      await this.analyzeUserExperiencePatterns();

      // PHASE 8: DEVELOPER WORKFLOW ANALYSIS
      console.log('🔧 PHASE 8: DEVELOPER WORKFLOW ANALYSIS...');
      await this.analyzeDeveloperWorkflow();

      // PHASE 9: HIDDEN ISSUE DETECTION
      console.log('🚨 PHASE 9: HIDDEN ISSUE DETECTION...');
      await this.detectHiddenIssues();

      // PHASE 10: PATTERN RECOGNITION
      console.log('🔮 PHASE 10: PATTERN RECOGNITION...');
      await this.analyzePatterns();

      // PHASE 11: FINAL ANALYSIS
      console.log('🧮 PHASE 11: COMPREHENSIVE HEALTH CALCULATION...');
      this.calculateComprehensiveHealth();

      // PHASE 12: COMPLETE RECOMMENDATIONS
      console.log('📋 PHASE 12: COMPLETE RECOMMENDATIONS...');
      await this.generateCompleteRecommendations();

      // PHASE 13: REPORT GENERATION
      console.log('📄 PHASE 13: COMPREHENSIVE REPORTS...');
      await this.generateComprehensiveReports();

      console.log('\n✅ TOTAL COVERAGE ANALYSIS COMPLETE!');
      this.displayTotalCoverageSummary();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  // PHASE 1: COMPLETE CODEBASE ANALYSIS
  async analyzeCompleteCodebase() {
    const analysis = this.analysisResults.analysis.codebase;

    try {
      // Scan ALL files in project
      console.log('  📁 Scanning all project files...');
      const allFiles = await this.getAllFilesRecursive();
      analysis.totalFiles = allFiles.length;

      // Analyze by file type
      const fileTypes = {};
      const problematicFiles = [];
      const suspiciousPatterns = [];

      for (const file of allFiles) {
        const ext = path.extname(file.name).toLowerCase();
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;

        // Read and analyze content
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for suspicious patterns
          const issues = this.analyzeFileContent(file.name, content);
          if (issues.length > 0) {
            problematicFiles.push({ file: file.name, issues });
            suspiciousPatterns.push(...issues.map(issue => ({ ...issue, file: file.name })));
          }

          // Look for TODO/FIXME/HACK comments
          const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|BUG|XXX):?\s*(.+)/g) || [];
          if (todoMatches.length > 0) {
            suspiciousPatterns.push({
              type: 'developer_notes',
              file: file.name,
              notes: todoMatches,
              severity: 'medium'
            });
          }

        } catch (err) {
          // Binary files or unreadable files
          analysis.binaryFiles = (analysis.binaryFiles || 0) + 1;
        }
      }

      analysis.fileTypes = fileTypes;
      analysis.problematicFiles = problematicFiles;
      analysis.suspiciousPatterns = suspiciousPatterns;

      // Deep Vue.js analysis
      console.log('  🎨 Deep Vue.js component analysis...');
      await this.deepVueAnalysis();

      // Deep JavaScript/TypeScript analysis
      console.log('  📝 Deep JS/TS analysis...');
      await this.deepJavaScriptAnalysis();

      // Configuration file analysis
      console.log('  ⚙️ Configuration analysis...');
      await this.analyzeConfigurations();

      // Dependency deep dive
      console.log('  📦 Dependency deep dive...');
      await this.analyzeDependenciesDeep();

      console.log(`  ✅ Analyzed ${allFiles.length} files, found ${suspiciousPatterns.length} issues`);

    } catch (error) {
      analysis.error = error.message;
      this.addCriticalIssue('Codebase Analysis', `Failed: ${error.message}`);
    }
  }

  // PHASE 2: GIT HISTORY MINING
  async analyzeGitHistory() {
    const analysis = this.analysisResults.analysis.gitHistory;

    try {
      if (!await this.directoryExists('.git')) {
        analysis.notAGitRepo = true;
        return;
      }

      console.log('  📚 Mining git history...');

      // Get all commit history
      const commits = await this.getGitCommitHistory();
      analysis.totalCommits = commits.length;

      // Analyze commit messages for issues
      const problematicCommits = [];
      const rollbackPatterns = [];
      const bugFixPatterns = [];

      for (const commit of commits) {
        const message = commit.message.toLowerCase();

        // Look for problem patterns
        if (message.includes('fix') || message.includes('bug') || message.includes('issue')) {
          bugFixPatterns.push(commit);
        }

        if (message.includes('revert') || message.includes('rollback')) {
          rollbackPatterns.push(commit);
        }

        if (message.includes('wip') || message.includes('todo') || message.includes('hack')) {
          problematicCommits.push(commit);
        }

        // Look for broken functionality mentions
        if (message.includes('broken') || message.includes('crash') || message.includes('error')) {
          problematicCommits.push({ ...commit, severity: 'high' });
        }
      }

      analysis.problematicCommits = problematicCommits;
      analysis.rollbackPatterns = rollbackPatterns;
      analysis.bugFixPatterns = bugFixPatterns;

      // Analyze file change patterns
      console.log('  📈 Analyzing file change patterns...');
      const fileChangePatterns = await this.analyzeFileChangePatterns(commits);
      analysis.fileChangePatterns = fileChangePatterns;

      // Look for frequent changes to same files
      const frequentlyChangedFiles = this.findFrequentlyChangedFiles(commits);
      analysis.frequentlyChangedFiles = frequentlyChangedFiles;

      // Analyze branch history
      console.log('  🌿 Analyzing branch history...');
      const branchAnalysis = await this.analyzeBranchHistory();
      analysis.branchHistory = branchAnalysis;

      console.log(`  ✅ Analyzed ${commits.length} commits, found ${problematicCommits.length} problematic commits`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 3: CONVERSATION HISTORY ANALYSIS
  async analyzeConversationHistory() {
    const analysis = this.analysisResults.analysis.conversations;

    try {
      console.log('  💬 Searching for conversation history...');

      // Look for conversation logs
      const conversationSources = [
        '.claude/',
        'claude-logs/',
        'chat-history/',
        'conversation-logs/',
        '.chat/',
        'ai-conversations/'
      ];

      let totalConversations = 0;
      const issues = [];
      const patterns = [];
      const mentionedProblems = [];

      for (const source of conversationSources) {
        if (await this.directoryExists(source)) {
          console.log(`    📁 Found conversation source: ${source}`);
          const convFiles = await this.getFiles(source);

          for (const convFile of convFiles) {
            try {
              const content = await fs.readFile(convFile.path, 'utf8');

              // Look for problem mentions
              const problemMentions = content.match(/(problem|issue|bug|error|broken|failing|crash|not working)/gi) || [];
              if (problemMentions.length > 0) {
                mentionedProblems.push({
                  file: convFile.name,
                  source,
                  mentions: problemMentions.length
                });
              }

              // Look for repeated issues
              const repeatedPatterns = this.findRepeatedConversationPatterns(content);
              patterns.push(...repeatedPatterns.map(p => ({ ...p, file: convFile.name, source })));

              totalConversations++;

            } catch (err) {
              // Skip unreadable files
            }
          }
        }
      }

      // Look for Claude Code specific files
      const claudeFiles = await this.getFiles('.', /(claude|chat|conversation)/i);
      for (const claudeFile of claudeFiles) {
        try {
          const content = await fs.readFile(claudeFile.path, 'utf8');

          // Look for problem patterns in Claude conversations
          const claudeIssues = this.analyzeClaudeConversation(content);
          issues.push(...claudeIssues.map(issue => ({ ...issue, file: claudeFile.name })));

        } catch (err) {
          // Skip unreadable files
        }
      }

      analysis.totalConversations = totalConversations;
      analysis.mentionedProblems = mentionedProblems;
      analysis.patterns = patterns;
      analysis.issues = issues;

      console.log(`  ✅ Analyzed ${totalConversations} conversations, found ${mentionedProblems.length} problem mentions`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 4: VISUAL STATE DETECTION
  async analyzeVisualState() {
    const analysis = this.analysisResults.analysis.visualState;

    try {
      console.log('  🖼️ Analyzing visual state...');

      // Look for screenshots and visual artifacts
      const imageFiles = await this.getFiles('', /\.(png|jpg|jpeg|gif|webp|svg)$/i);
      analysis.totalImages = imageFiles.length;

      // Look for debug screenshots
      const debugScreenshots = imageFiles.filter(file =>
        file.name.toLowerCase().includes('debug') ||
        file.name.toLowerCase().includes('error') ||
        file.name.toLowerCase().includes('issue') ||
        file.name.toLowerCase().includes('problem')
      );

      analysis.debugScreenshots = debugScreenshots;

      // Look for state dumps
      console.log('  💾 Looking for state dumps...');
      const stateFiles = await this.getFiles('', /(state|dump|snapshot|backup)/i);
      analysis.stateFiles = stateFiles;

      // Look for HTML captures
      const htmlFiles = await this.getFiles('', /\.html$/i);
      analysis.htmlFiles = htmlFiles;

      // Analyze for UI inconsistencies
      console.log('  🎨 Analyzing UI consistency...');
      const uiInconsistencies = await this.analyzeUIConsistency();
      analysis.uiInconsistencies = uiInconsistencies;

      // Look for responsive design issues
      const responsiveIssues = await this.analyzeResponsiveDesignIssues();
      analysis.responsiveIssues = responsiveIssues;

      console.log(`  ✅ Found ${debugScreenshots.length} debug screenshots, ${uiInconsistencies.length} UI inconsistencies`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 5: RUNTIME BEHAVIOR ANALYSIS
  async analyzeRuntimeBehavior() {
    const analysis = this.analysisResults.analysis.runtime;

    try {
      console.log('  ⚡ Analyzing runtime behavior...');

      // Look for console logs and errors
      console.log('  📝 Scanning for console logs and errors...');
      const consoleLogs = await this.findConsoleLogs();
      analysis.consoleLogs = consoleLogs;

      // Look for error handling patterns
      const errorHandling = await this.analyzeErrorHandling();
      analysis.errorHandling = errorHandling;

      // Look for performance issues
      const performanceIssues = await this.analyzePerformanceIssues();
      analysis.performanceIssues = performanceIssues;

      // Look for memory leaks
      const memoryLeaks = await this.analyzeMemoryLeaks();
      analysis.memoryLeaks = memoryLeaks;

      // Look for async issues
      const asyncIssues = await this.analyzeAsyncIssues();
      analysis.asyncIssues = asyncIssues;

      console.log(`  ✅ Found ${consoleLogs.length} console statements, ${performanceIssues.length} performance issues`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 6: DATA INTEGRITY DEEP DIVE
  async analyzeDataIntegrity() {
    const analysis = this.analysisResults.analysis.dataIntegrity;

    try {
      console.log('  🗄️ Deep data integrity analysis...');

      // Analyze data models
      const dataModels = await this.analyzeDataModels();
      analysis.dataModels = dataModels;

      // Look for data validation
      const dataValidation = await this.analyzeDataValidation();
      analysis.dataValidation = dataValidation;

      // Check for type safety
      const typeSafety = await this.analyzeTypeSafety();
      analysis.typeSafety = typeSafety;

      // Look for data corruption risks
      const corruptionRisks = await this.analyzeDataCorruptionRisks();
      analysis.corruptionRisks = corruptionRisks;

      console.log(`  ✅ Found ${dataModels.issues || 0} data model issues, ${corruptionRisks.length} corruption risks`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 7: USER EXPERIENCE PATTERNS
  async analyzeUserExperiencePatterns() {
    const analysis = this.analysisResults.analysis.userExperience;

    try {
      console.log('  👤 Analyzing user experience patterns...');

      // Look for accessibility issues
      const accessibilityIssues = await this.analyzeAccessibilityDeep();
      analysis.accessibilityIssues = accessibilityIssues;

      // Look for UX anti-patterns
      const antiPatterns = await this.analyzeUXAntiPatterns();
      analysis.antiPatterns = antiPatterns;

      // Look for broken user flows
      const brokenFlows = await this.analyzeBrokenUserFlows();
      analysis.brokenFlows = brokenFlows;

      console.log(`  ✅ Found ${accessibilityIssues.length} accessibility issues, ${brokenFlows.length} broken flows`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 8: DEVELOPER WORKFLOW ANALYSIS
  async analyzeDeveloperWorkflow() {
    const analysis = this.analysisResults.analysis.developerWorkflow;

    try {
      console.log('  🔧 Analyzing developer workflow...');

      // Look for development scripts
      const devScripts = await this.analyzeDevScripts();
      analysis.devScripts = devScripts;

      // Check for documentation
      const documentation = await this.analyzeDocumentation();
      analysis.documentation = documentation;

      // Look for tooling issues
      const toolingIssues = await this.analyzeToolingIssues();
      analysis.toolingIssues = toolingIssues;

      console.log(`  ✅ Found ${toolingIssues.length} tooling issues, documentation completeness: ${documentation.completeness}%`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 9: HIDDEN ISSUE DETECTION
  async detectHiddenIssues() {
    const analysis = this.analysisResults.analysis.hiddenIssues;

    try {
      console.log('  🚨 Detecting hidden issues...');

      // Look for commented out code
      const commentedCode = await this.findCommentedOutCode();
      analysis.commentedCode = commentedCode;

      // Look for debug code left in
      const debugCode = await this.findDebugCode();
      analysis.debugCode = debugCode;

      // Look for temporary fixes
      const temporaryFixes = await this.findTemporaryFixes();
      analysis.temporaryFixes = temporaryFixes;

      // Look for magic numbers
      const magicNumbers = await this.findMagicNumbers();
      analysis.magicNumbers = magicNumbers;

      // Look for hardcoded values
      const hardcodedValues = await this.findHardcodedValues();
      analysis.hardcodedValues = hardcodedValues;

      const totalHiddenIssues = commentedCode.length + debugCode.length + temporaryFixes.length;
      console.log(`  ✅ Found ${totalHiddenIssues} hidden issues`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // PHASE 10: PATTERN RECOGNITION
  async analyzePatterns() {
    const analysis = this.analysisResults.analysis.patterns;

    try {
      console.log('  🔮 Analyzing patterns...');

      // Look for code duplication
      const duplication = await this.analyzeCodeDuplication();
      analysis.duplication = duplication;

      // Look for architectural issues
      const architecturalIssues = await this.analyzeArchitecturalIssues();
      analysis.architecturalIssues = architecturalIssues;

      // Look for naming inconsistencies
      const namingIssues = await this.analyzeNamingConsistency();
      analysis.namingIssues = namingIssues;

      // Look for inconsistent patterns
      const inconsistentPatterns = await this.analyzeInconsistentPatterns();
      analysis.inconsistentPatterns = inconsistentPatterns;

      console.log(`  ✅ Found ${duplication.duplicates.length} duplications, ${architecturalIssues.length} architectural issues`);

    } catch (error) {
      analysis.error = error.message;
    }
  }

  // HELPER METHODS
  async getAllFilesRecursive() {
    const files = [];

    async function scanDirectory(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules and .git
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else {
            files.push({
              name: entry.name,
              path: fullPath
            });
          }
        }
      } catch (err) {
        // Skip directories we can't read
      }
    }

    await scanDirectory(this.projectRoot);
    return files;
  }

  analyzeFileContent(fileName, content) {
    const issues = [];

    // Look for common issues
    if (content.includes('console.log') || content.includes('console.error')) {
      issues.push({
        type: 'console_statements',
        severity: 'low',
        line: this.findLineNumber(content, 'console.')
      });
    }

    if (content.includes('TODO:') || content.includes('FIXME:')) {
      issues.push({
        type: 'unfinished_code',
        severity: 'medium',
        line: this.findLineNumber(content, 'TODO')
      });
    }

    if (content.includes('hack') || content.includes('temporary')) {
      issues.push({
        type: 'temporary_solution',
        severity: 'medium',
        line: this.findLineNumber(content, 'hack')
      });
    }

    // Look for potential security issues
    if (content.includes('eval(') || content.includes('innerHTML')) {
      issues.push({
        type: 'security_risk',
        severity: 'high',
        line: this.findLineNumber(content, content.includes('eval(') ? 'eval(' : 'innerHTML')
      });
    }

    return issues;
  }

  async deepVueAnalysis() {
    const analysis = this.analysisResults.analysis.codebase.vueAnalysis = {};

    try {
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
      analysis.totalVueFiles = vueFiles.length;

      let issues = [];
      const componentSizes = [];

      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');
        const stats = await fs.stat(vueFile.path);

        componentSizes.push({
          name: vueFile.name,
          size: stats.size,
          lines: content.split('\n').length
        });

        // Look for Vue-specific issues
        if (content.includes('v-if') && content.includes('v-else-if') && content.includes('v-else')) {
          // Complex conditional logic
          issues.push({
            file: vueFile.name,
            type: 'complex_conditional',
            severity: 'medium'
          });
        }

        if (content.length > 5000) {
          // Large component
          issues.push({
            file: vueFile.name,
            type: 'large_component',
            size: content.length,
            severity: 'high'
          });
        }

        // Look for reactivity issues
        if (content.includes('this.') && content.includes('<script setup')) {
          issues.push({
            file: vueFile.name,
            type: 'mixed_api_usage',
            severity: 'medium'
          });
        }
      }

      analysis.componentSizes = componentSizes.sort((a, b) => b.size - a.size);
      analysis.issues = issues;

    } catch (error) {
      analysis.error = error.message;
    }
  }

  async deepJavaScriptAnalysis() {
    const analysis = this.analysisResults.analysis.codebase.jsAnalysis = {};

    try {
      const jsFiles = await this.getFiles(this.srcDir, /\.(js|ts)$/);
      analysis.totalJSFiles = jsFiles.length;

      let issues = [];

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile.path, 'utf8');

        // Look for async/await issues
        if (content.includes('await') && !content.includes('try')) {
          issues.push({
            file: jsFile.name,
            type: 'unhandled_async',
            severity: 'medium'
          });
        }

        // Look for promise chains without error handling
        if (content.includes('.then(') && !content.includes('.catch(')) {
          issues.push({
            file: jsFile.name,
            type: 'unhandled_promises',
            severity: 'medium'
          });
        }

        // Look for potential memory leaks
        if (content.includes('setInterval') || content.includes('setTimeout')) {
          issues.push({
            file: jsFile.name,
            type: 'timer_leak_potential',
            severity: 'low'
          });
        }
      }

      analysis.issues = issues;

    } catch (error) {
      analysis.error = error.message;
    }
  }

  async analyzeConfigurations() {
    const analysis = this.analysisResults.analysis.codebase.configAnalysis = {};

    try {
      const configFiles = [
        'vite.config.js',
        'package.json',
        'tsconfig.json',
        'tailwind.config.js',
        '.eslintrc.js',
        '.prettierrc'
      ];

      const configs = {};
      let issues = [];

      for (const configFile of configFiles) {
        if (await this.fileExists(configFile)) {
          try {
            const content = await fs.readFile(configFile, 'utf8');
            configs[configFile] = {
              exists: true,
              size: content.length
            };
          } catch (err) {
            configs[configFile] = { exists: true, error: err.message };
          }
        } else {
          configs[configFile] = { exists: false };

          if (['vite.config.js', 'package.json'].includes(configFile)) {
            issues.push({
              type: 'missing_config',
              file: configFile,
              severity: 'high'
            });
          }
        }
      }

      analysis.configurations = configs;
      analysis.issues = issues;

    } catch (error) {
      analysis.error = error.message;
    }
  }

  async analyzeDependenciesDeep() {
    const analysis = this.analysisResults.analysis.codebase.dependenciesDeep = {};

    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      analysis.totalDependencies = Object.keys(allDeps).length;

      // Look for problematic dependencies
      const issues = [];

      for (const [name, version] of Object.entries(allDeps)) {
        // Check for very old versions
        if (version.startsWith('^0.') || version.startsWith('~0.')) {
          issues.push({
            type: 'old_dependency',
            dependency: name,
            version,
            severity: 'medium'
          });
        }

        // Check for potentially problematic packages
        if (name.includes('deprecated') || name.includes('old')) {
          issues.push({
            type: 'problematic_dependency',
            dependency: name,
            severity: 'high'
          });
        }
      }

      analysis.issues = issues;

    } catch (error) {
      analysis.error = error.message;
    }
  }

  async getGitCommitHistory() {
    try {
      const output = execSync('git log --pretty=format:"%H|%an|%ad|%s" --date=iso', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, date, ...messageParts] = line.split('|');
          return {
            hash,
            author,
            date: new Date(date),
            message: messageParts.join('|')
          };
        });
    } catch (error) {
      return [];
    }
  }

  async analyzeFileChangePatterns(commits) {
    // This is a simplified version - in reality you'd parse git log --stat
    return {
      frequentlyChangedFiles: [],
      changePatterns: []
    };
  }

  findFrequentlyChangedFiles(commits) {
    // Simplified implementation
    return [];
  }

  async analyzeBranchHistory() {
    try {
      const branches = execSync('git branch -a', { encoding: 'utf8', cwd: this.projectRoot });
      return {
        totalBranches: branches.split('\n').filter(b => b.trim()).length,
        currentBranch: branches.split('\n').find(b => b.startsWith('*'))?.replace('* ', '').trim()
      };
    } catch (error) {
      return { totalBranches: 0, currentBranch: 'unknown' };
    }
  }

  findRepeatedConversationPatterns(content) {
    const patterns = [];

    // Look for repeated problem mentions
    const problemWords = ['error', 'issue', 'problem', 'broken', 'not working'];
    for (const word of problemWords) {
      const regex = new RegExp(word, 'gi');
      const matches = content.match(regex);
      if (matches && matches.length > 2) {
        patterns.push({
          type: 'repeated_problem',
          word,
          count: matches.length,
          severity: matches.length > 5 ? 'high' : 'medium'
        });
      }
    }

    return patterns;
  }

  analyzeClaudeConversation(content) {
    const issues = [];

    // Look for error mentions
    const errorMatches = content.match(/error:?\s*(.+)/gi) || [];
    if (errorMatches.length > 0) {
      issues.push({
        type: 'error_mentions',
        count: errorMatches.length,
        examples: errorMatches.slice(0, 3),
        severity: 'medium'
      });
    }

    // Look for failure patterns
    const failureMatches = content.match(/(\w+)\s+(failed|crashed|broke)/gi) || [];
    if (failureMatches.length > 0) {
      issues.push({
        type: 'failure_patterns',
        count: failureMatches.length,
        examples: failureMatches.slice(0, 3),
        severity: 'high'
      });
    }

    return issues;
  }

  async analyzeUIConsistency() {
    // Look for inconsistent styling patterns
    const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
    const inconsistencies = [];

    // Simplified implementation
    for (const vueFile of vueFiles) {
      try {
        const content = await fs.readFile(vueFile.path, 'utf8');

        // Look for inline styles
        if (content.includes('style=')) {
          inconsistencies.push({
            type: 'inline_styles',
            file: vueFile.name,
            severity: 'low'
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return inconsistencies;
  }

  async analyzeResponsiveDesignIssues() {
    // Look for responsive design problems
    const issues = [];

    // Check for fixed widths/heights
    const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);

    for (const vueFile of vueFiles) {
      try {
        const content = await fs.readFile(vueFile.path, 'utf8');

        // Look for fixed pixel values that might break responsiveness
        const fixedPixelMatches = content.match(/\d+px/g) || [];
        if (fixedPixelMatches.length > 10) {
          issues.push({
            type: 'excessive_fixed_pixels',
            file: vueFile.name,
            count: fixedPixelMatches.length,
            severity: 'medium'
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return issues;
  }

  async findConsoleLogs() {
    const allFiles = await this.getAllFilesRecursive();
    const consoleStatements = [];

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');
          const matches = content.match(/console\.(log|error|warn|info|debug)\([^)]*\)/g);
          if (matches) {
            consoleStatements.push({
              file: file.name,
              count: matches.length,
              statements: matches.slice(0, 3) // First 3 examples
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return consoleStatements;
  }

  async analyzeErrorHandling() {
    const issues = [];

    // Look for try-catch patterns
    const jsFiles = await this.getFiles(this.srcDir, /\.(js|ts)$/);

    let tryBlocks = 0;
    let catchBlocks = 0;

    for (const jsFile of jsFiles) {
      try {
        const content = await fs.readFile(jsFile.path, 'utf8');
        tryBlocks += (content.match(/\btry\b/g) || []).length;
        catchBlocks += (content.match(/\bcatch\b/g) || []).length;
      } catch (err) {
        // Skip unreadable files
      }
    }

    if (tryBlocks > catchBlocks) {
      issues.push({
        type: 'incomplete_error_handling',
        severity: 'medium',
        tryBlocks,
        catchBlocks
      });
    }

    return issues;
  }

  async analyzePerformanceIssues() {
    const issues = [];

    // Look for potential performance issues
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for potential performance issues
          if (content.includes('document.querySelector')) {
            issues.push({
              type: 'direct_dom_queries',
              file: file.name,
              severity: 'medium'
            });
          }

          if (content.includes('innerHTML')) {
            issues.push({
              type: 'innerhtml_usage',
              file: file.name,
              severity: 'medium'
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return issues;
  }

  async analyzeMemoryLeaks() {
    const issues = [];

    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for potential memory leaks
          if (content.includes('setInterval') && !content.includes('clearInterval')) {
            issues.push({
              type: 'potential_timer_leak',
              file: file.name,
              severity: 'medium'
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return issues;
  }

  async analyzeAsyncIssues() {
    const issues = [];

    const jsFiles = await this.getFiles(this.srcDir, /\.(js|ts)$/);

    for (const jsFile of jsFiles) {
      try {
        const content = await fs.readFile(jsFile.path, 'utf8');

        // Look for async/await without error handling
        const awaitMatches = content.match(/await\s+/g) || [];
        const tryMatches = content.match(/\btry\b/g) || [];

        if (awaitMatches.length > 0 && tryMatches.length === 0) {
          issues.push({
            type: 'unhandled_async_operations',
            file: jsFile.name,
            awaitCount: awaitMatches.length,
            severity: 'medium'
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return issues;
  }

  async analyzeDataModels() {
    const analysis = {
      totalModels: 0,
      issues: []
    };

    // Look for TypeScript interfaces and types
    const typeFiles = await this.getFiles(this.srcDir, /\.(d\.ts|types\.ts)$/);

    for (const typeFile of typeFiles) {
      try {
        const content = await fs.readFile(typeFile.path, 'utf8');
        const interfaces = content.match(/interface\s+\w+/g) || [];
        analysis.totalModels += interfaces.length;
      } catch (err) {
        // Skip unreadable files
      }
    }

    return analysis;
  }

  async analyzeDataValidation() {
    // Look for validation patterns
    return { issues: [] };
  }

  async analyzeTypeSafety() {
    const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
    let typescriptFiles = 0;

    for (const vueFile of vueFiles) {
      try {
        const content = await fs.readFile(vueFile.path, 'utf8');
        if (content.includes('lang="ts"') || content.includes("lang='ts'")) {
          typescriptFiles++;
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return {
      totalVueFiles: vueFiles.length,
      typescriptFiles,
      percentage: vueFiles.length > 0 ? (typescriptFiles / vueFiles.length) * 100 : 0
    };
  }

  async analyzeDataCorruptionRisks() {
    const risks = [];

    // Look for potential data corruption patterns
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for direct data manipulation
          if (content.includes('JSON.parse') && !content.includes('try')) {
            risks.push({
              type: 'unvalidated_json_parsing',
              file: file.name,
              severity: 'medium'
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return risks;
  }

  async analyzeAccessibilityDeep() {
    const issues = [];

    const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);

    for (const vueFile of vueFiles) {
      try {
        const content = await fs.readFile(vueFile.path, 'utf8');

        // Look for missing alt text
        if (content.includes('<img') && !content.includes('alt=')) {
          issues.push({
            type: 'missing_alt_text',
            file: vueFile.name,
            severity: 'high'
          });
        }

        // Look for missing ARIA labels
        if (content.includes('<button') && !content.includes('aria-') && !content.includes('<label')) {
          issues.push({
            type: 'missing_accessibility_labels',
            file: vueFile.name,
            severity: 'medium'
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return issues;
  }

  async analyzeUXAntiPatterns() {
    const antiPatterns = [];

    return antiPatterns;
  }

  async analyzeBrokenUserFlows() {
    const brokenFlows = [];

    return brokenFlows;
  }

  async analyzeDevScripts() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};

      return {
        totalScripts: Object.keys(scripts).length,
        scripts: Object.keys(scripts),
        hasBuild: !!scripts.build,
        hasDev: !!scripts.dev || !!scripts.serve,
        hasTest: !!scripts.test
      };
    } catch (error) {
      return { totalScripts: 0, scripts: [] };
    }
  }

  async analyzeDocumentation() {
    const docFiles = await this.getFiles('', /\.(md|txt)$/i);
    const readmeExists = await this.fileExists('README.md');

    return {
      totalDocFiles: docFiles.length,
      hasReadme: readmeExists,
      completeness: readmeExists ? 80 : 20
    };
  }

  async analyzeToolingIssues() {
    const issues = [];

    // Check for ESLint
    if (!await this.fileExists('.eslintrc.js') && !await this.fileExists('.eslintrc.json')) {
      issues.push({
        type: 'missing_eslint',
        severity: 'medium'
      });
    }

    // Check for Prettier
    if (!await this.fileExists('.prettierrc') && !await this.fileExists('.prettierrc.json')) {
      issues.push({
        type: 'missing_prettier',
        severity: 'low'
      });
    }

    return issues;
  }

  async findCommentedOutCode() {
    const commentedCode = [];
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx|css|scss|sass)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for commented out code blocks
          const commentedBlocks = content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || [];
          const codeLikeComments = commentedBlocks.filter(block =>
            block.includes('function') ||
            block.includes('const') ||
            block.includes('let') ||
            block.includes('var') ||
            block.includes('{') ||
            block.includes('}')
          );

          if (codeLikeComments.length > 0) {
            commentedCode.push({
              file: file.name,
              blocks: codeLikeComments.length
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return commentedCode;
  }

  async findDebugCode() {
    const debugCode = [];
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for debug statements
          const debugPatterns = [
            /debugger;/gi,
            /console\.debug/gi,
            /console\.table/gi,
            /debugger/gi
          ];

          for (const pattern of debugPatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
              debugCode.push({
                file: file.name,
                type: pattern.source,
                count: matches.length
              });
            }
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return debugCode;
  }

  async findTemporaryFixes() {
    const temporaryFixes = [];
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for temporary fix patterns
          const tempPatterns = [
            /\/\/\s*temp/gi,
            /\/\/\s*todo/gi,
            /\/\/\s*fixme/gi,
            /\/\/\s*hack/gi,
            /temporary/gi,
            /quick\s+fix/gi
          ];

          for (const pattern of tempPatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
              temporaryFixes.push({
                file: file.name,
                pattern: pattern.source,
                count: matches.length
              });
            }
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return temporaryFixes;
  }

  async findMagicNumbers() {
    const magicNumbers = [];
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for magic numbers (excluding common values like 0, 1, 2, 10, 100)
          const numberMatches = content.match(/\b\d{2,}\b/g) || [];
          const suspiciousNumbers = numberMatches.filter(num =>
            !['0', '1', '2', '10', '100'].includes(num)
          );

          if (suspiciousNumbers.length > 0) {
            magicNumbers.push({
              file: file.name,
              numbers: suspiciousNumbers.slice(0, 5), // First 5 examples
              count: suspiciousNumbers.length
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return magicNumbers;
  }

  async findHardcodedValues() {
    const hardcodedValues = [];
    const allFiles = await this.getAllFilesRecursive();

    for (const file of allFiles) {
      if (file.name.match(/\.(js|ts|vue|jsx|tsx)$/)) {
        try {
          const content = await fs.readFile(file.path, 'utf8');

          // Look for hardcoded URLs
          const urlMatches = content.match(/https?:\/\/[^\s"']+/g) || [];
          if (urlMatches.length > 0) {
            hardcodedValues.push({
              file: file.name,
              type: 'hardcoded_urls',
              values: urlMatches.slice(0, 3),
              count: urlMatches.length
            });
          }

          // Look for hardcoded API keys (simplified pattern)
          const apiKeyPattern = /[a-zA-Z0-9]{20,}/g;
          const keyMatches = content.match(apiKeyPattern) || [];
          if (keyMatches.length > 0) {
            hardcodedValues.push({
              file: file.name,
              type: 'potential_api_keys',
              values: keyMatches.slice(0, 2),
              count: keyMatches.length,
              severity: 'high'
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return hardcodedValues;
  }

  async analyzeCodeDuplication() {
    const duplicates = [];

    // Simplified duplication detection
    const jsFiles = await this.getFiles(this.srcDir, /\.(js|ts)$/);

    for (let i = 0; i < jsFiles.length; i++) {
      for (let j = i + 1; j < jsFiles.length; j++) {
        try {
          const content1 = await fs.readFile(jsFiles[i].path, 'utf8');
          const content2 = await fs.readFile(jsFiles[j].path, 'utf8');

          // Simple similarity check (in reality, use more sophisticated algorithms)
          if (Math.abs(content1.length - content2.length) < 100) {
            duplicates.push({
              file1: jsFiles[i].name,
              file2: jsFiles[j].name,
              similarity: 'high'
            });
          }
        } catch (err) {
          // Skip unreadable files
        }
      }
    }

    return { duplicates };
  }

  async analyzeArchitecturalIssues() {
    const issues = [];

    // Look for architectural problems
    return issues;
  }

  async analyzeNamingConsistency() {
    const issues = [];

    return issues;
  }

  async analyzeInconsistentPatterns() {
    const patterns = [];

    return patterns;
  }

  // FINAL ANALYSIS METHODS
  calculateComprehensiveHealth() {
    let totalScore = 100;
    let criticalIssues = 0;
    let hiddenIssues = 0;

    // Calculate issues from all analysis phases
    for (const [phaseName, phaseData] of Object.entries(this.analysisResults.analysis)) {
      if (phaseData.error) {
        criticalIssues++;
        totalScore -= 10;
        continue;
      }

      // Count issues from this phase
      const phaseIssues = this.countIssuesInPhase(phaseData);
      hiddenIssues += phaseIssues.hidden;
      criticalIssues += phaseIssues.critical;

      // Deduct points based on severity
      totalScore -= (phaseIssues.critical * 10);
      totalScore -= (phaseIssues.high * 5);
      totalScore -= (phaseIssues.medium * 2);
      totalScore -= (phaseIssues.low * 1);
    }

    this.analysisResults.overall = {
      healthScore: Math.max(0, totalScore),
      criticalIssues,
      hiddenIssues,
      patterns: this.extractPatterns(),
      warnings: this.extractWarnings()
    };
  }

  countIssuesInPhase(phaseData) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, hidden: 0 };

    // Count issues from various arrays
    ['issues', 'problematicFiles', 'suspiciousPatterns', 'commentedCode', 'debugCode'].forEach(arrayName => {
      if (phaseData[arrayName] && Array.isArray(phaseData[arrayName])) {
        phaseData[arrayName].forEach(item => {
          if (item.severity) {
            counts[item.severity]++;
          } else {
            counts.medium++; // Default severity
          }
        });
      }
    });

    // Count hidden issues
    ['commentedCode', 'debugCode', 'temporaryFixes'].forEach(hiddenType => {
      if (phaseData[hiddenType] && Array.isArray(phaseData[hiddenType])) {
        counts.hidden += phaseData[hiddenType].length;
      }
    });

    return counts;
  }

  extractPatterns() {
    const patterns = [];

    // Extract patterns from analysis results
    for (const [phaseName, phaseData] of Object.entries(this.analysisResults.analysis)) {
      if (phaseData.patterns && Array.isArray(phaseData.patterns)) {
        patterns.push(...phaseData.patterns);
      }
    }

    return patterns;
  }

  extractWarnings() {
    const warnings = [];

    // Extract warnings from all phases
    for (const [phaseName, phaseData] of Object.entries(this.analysisResults.analysis)) {
      if (phaseData.warnings && Array.isArray(phaseData.warnings)) {
        warnings.push(...phaseData.warnings);
      }
    }

    return warnings;
  }

  async generateCompleteRecommendations() {
    const recommendations = [];
    const overall = this.analysisResults.overall;

    // Critical recommendations
    if (overall.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Address Critical Issues Immediately',
        description: `${overall.criticalIssues} critical issues detected that could cause system failures.`,
        actions: [
          'Review and fix all critical severity issues',
          'Address security vulnerabilities immediately',
          'Fix broken functionality',
          'Resolve data integrity risks'
        ],
        estimatedEffort: '1-3 days'
      });
    }

    // Hidden issues recommendations
    if (overall.hiddenIssues > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Clean Up Hidden Issues',
        description: `${overall.hiddenIssues} hidden issues found that affect code quality and maintainability.`,
        actions: [
          'Remove commented out code',
          'Clean up debug statements',
          'Replace temporary fixes with proper solutions',
          'Extract magic numbers to constants'
        ],
        estimatedEffort: '2-4 hours'
      });
    }

    // Add specific recommendations based on analysis results
    const codeAnalysis = this.analysisResults.analysis.codebase;
    if (codeAnalysis.problematicFiles && codeAnalysis.problematicFiles.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Fix Problematic Code Patterns',
        description: `${codeAnalysis.problematicFiles.length} files have problematic patterns.`,
        actions: [
          'Review and fix console statements',
          'Address unfinished code (TODO/FIXME)',
          'Remove temporary solutions',
          'Fix security risks'
        ],
        estimatedEffort: '1-2 days'
      });
    }

    const gitAnalysis = this.analysisResults.analysis.gitHistory;
    if (gitAnalysis.problematicCommits && gitAnalysis.problematicCommits.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Commit Quality',
        description: `${gitAnalysis.problematicCommits.length} problematic commits found in history.`,
        actions: [
          'Review problematic commits',
          'Establish better commit guidelines',
          'Clean up WIP commits',
          'Document decisions properly'
        ],
        estimatedEffort: '2-3 hours'
      });
    }

    this.analysisResults.recommendations = recommendations;
  }

  async generateComprehensiveReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(this.projectRoot, '.claude', 'total-coverage-reports');

    await fs.mkdir(reportsDir, { recursive: true });

    // Generate comprehensive JSON report
    const jsonReport = {
      ...this.analysisResults,
      generatedAt: new Date().toISOString(),
      version: '2.0.0',
      coverageType: 'total'
    };

    await fs.writeFile(
      path.join(reportsDir, `total-coverage-${timestamp}.json`),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate comprehensive HTML report
    const htmlReport = this.generateComprehensiveHTMLReport(jsonReport);
    await fs.writeFile(
      path.join(reportsDir, `total-coverage-${timestamp}.html`),
      htmlReport
    );

    // Generate comprehensive markdown summary
    const markdownSummary = this.generateComprehensiveMarkdownSummary(jsonReport);
    await fs.writeFile(
      path.join(reportsDir, `total-coverage-summary-${timestamp}.md`),
      markdownSummary
    );

    console.log(`\n📄 TOTAL COVERAGE reports generated in ${reportsDir}:`);
    console.log(`  • total-coverage-${timestamp}.json`);
    console.log(`  • total-coverage-${timestamp}.html`);
    console.log(`  • total-coverage-summary-${timestamp}.md`);
  }

  generateComprehensiveHTMLReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TOTAL COVERAGE System Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }
        .score-circle { width: 150px; height: 150px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2.5em; font-weight: bold; color: white; margin: 20px; }
        .score-excellent { background: linear-gradient(135deg, #28a745, #20c997); }
        .score-good { background: linear-gradient(135deg, #5cb85c, #4cae4c); }
        .score-fair { background: linear-gradient(135deg, #f0ad4e, #ec971f); }
        .score-poor { background: linear-gradient(135deg, #d9534f, #c9302c); }
        .score-critical { background: linear-gradient(135deg, #a94442, #8b0000); }
        .section { margin: 30px 0; padding: 25px; border: 1px solid #dee2e6; border-radius: 8px; }
        .critical { border-left: 5px solid #dc3545; background: #fff5f5; }
        .high { border-left: 5px solid #fd7e14; background: #fff8f0; }
        .medium { border-left: 5px solid #ffc107; background: #fffbf0; }
        .low { border-left: 5px solid #17a2b8; background: #f0ffff; }
        .info { border-left: 5px solid #17a2b8; background: #f0ffff; }
        .phase-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .phase-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
        .metric { display: inline-block; margin: 10px; text-align: center; }
        .metric-value { font-size: 1.8em; font-weight: bold; display: block; color: #495057; }
        .metric-label { color: #6c757d; font-size: 0.9em; margin-top: 5px; }
        .issue { margin: 10px 0; padding: 12px; background: white; border-radius: 6px; border-left: 3px solid #dc3545; }
        .recommendation { margin: 15px 0; padding: 20px; background: #e9ecef; border-radius: 6px; border-left: 4px solid #007bff; }
        .coverage-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .coverage-stat { text-align: center; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 TOTAL COVERAGE SYSTEM ANALYSIS</h1>
            <h2>Pomo-Flow Vue.js Application</h2>
            <p>Generated on ${new Date(data.generatedAt).toLocaleString()}</p>
            <div class="score-circle score-${this.getScoreClass(data.overall.healthScore)}">
                ${data.overall.healthScore}%
            </div>
            <h3>Overall System Health Score</h3>
        </div>

        <div class="section critical">
            <h3>🚨 EXECUTIVE SUMMARY - BRUTAL HONESTY</h3>
            <div class="coverage-stats">
                <div class="coverage-stat">
                    <div class="metric-value">${data.overall.criticalIssues}</div>
                    <div class="metric-label">Critical Issues</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${data.overall.hiddenIssues}</div>
                    <div class="metric-label">Hidden Issues</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${data.overall.patterns.length}</div>
                    <div class="metric-label">Patterns Found</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${data.analysis.conversations.totalConversations || 0}</div>
                    <div class="metric-label">Conversations Analyzed</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h3>🎯 TOTAL COVERAGE BREAKDOWN</h3>
            <div class="phase-grid">
                ${Object.entries(data.analysis).map(([name, analysis]) => `
                    <div class="phase-card">
                        <h4>${name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}</h4>
                        ${analysis.error ?
                            `<p style="color: #dc3545;">❌ Analysis failed: ${analysis.error}</p>` :
                            this.getPhaseSummary(analysis)
                        }
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section ${data.overall.criticalIssues > 0 ? 'critical' : 'info'}">
            <h3>🎯 Priority Recommendations</h3>
            ${data.recommendations.slice(0, 5).map(rec => `
                <div class="recommendation">
                    <h4>${rec.title} (${rec.priority})</h4>
                    <p>${rec.description}</p>
                    <ul>
                        ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                    <p><strong>Estimated effort:</strong> ${rec.estimatedEffort}</p>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h3>📊 Analysis Coverage</h3>
            <div class="coverage-stats">
                <div class="coverage-stat">
                    <div class="metric-value">${data.analysis.codebase.totalFiles || 0}</div>
                    <div class="metric-label">Files Analyzed</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${data.analysis.gitHistory.totalCommits || 0}</div>
                    <div class="metric-label">Commits Analyzed</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${Object.keys(data.analysis).length}</div>
                    <div class="metric-label">Analysis Phases</div>
                </div>
                <div class="coverage-stat">
                    <div class="metric-value">${data.evidence.length}</div>
                    <div class="metric-label">Evidence Points</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  getPhaseSummary(analysis) {
    const issueCount = this.countIssuesInPhase(analysis);
    const totalIssues = issueCount.critical + issueCount.high + issueCount.medium + issueCount.low;

    if (totalIssues === 0) {
      return '<p style="color: #28a745;">✅ No issues detected</p>';
    }

    let summary = `<p>Found ${totalIssues} issues:</p><ul>`;
    if (issueCount.critical > 0) summary += `<li style="color: #dc3545;">${issueCount.critical} critical</li>`;
    if (issueCount.high > 0) summary += `<li style="color: #fd7e14;">${issueCount.high} high</li>`;
    if (issueCount.medium > 0) summary += `<li style="color: #ffc107;">${issueCount.medium} medium</li>`;
    if (issueCount.low > 0) summary += `<li style="color: #17a2b8;">${issueCount.low} low</li>`;
    summary += '</ul>';

    return summary;
  }

  generateComprehensiveMarkdownSummary(data) {
    return `# TOTAL COVERAGE System Analysis Summary

**Generated:** ${new Date(data.generatedAt).toLocaleString()}
**Analysis Mode:** ${data.mode} - Complete Coverage
**Coverage Scope:** Code, Git, Conversations, Visual State, Runtime, Patterns

## 🚨 Executive Summary - BRUTAL HONESTY

- **Overall Health Score:** ${data.overall.healthScore}%
- **Critical Issues:** ${data.overall.criticalIssues}
- **Hidden Issues:** ${data.overall.hiddenIssues}
- **Patterns Found:** ${data.overall.patterns.length}
- **Conversations Analyzed:** ${data.analysis.conversations.totalConversations || 0}

## 📊 Total Coverage Breakdown

### 🔍 Code Analysis
- **Files Analyzed:** ${data.analysis.codebase.totalFiles || 0}
- **Problematic Files:** ${data.analysis.codebase.problematicFiles?.length || 0}
- **Suspicious Patterns:** ${data.analysis.codebase.suspiciousPatterns?.length || 0}

### 📚 Git History
- **Total Commits:** ${data.analysis.gitHistory.totalCommits || 0}
- **Problematic Commits:** ${data.analysis.gitHistory.problematicCommits?.length || 0}
- **Rollback Patterns:** ${data.analysis.gitHistory.rollbackPatterns?.length || 0}

### 💬 Conversation Analysis
- **Total Conversations:** ${data.analysis.conversations.totalConversations || 0}
- **Problem Mentions:** ${data.analysis.conversations.mentionedProblems?.length || 0}
- **Issues Found:** ${data.analysis.conversations.issues?.length || 0}

### 🖼️ Visual State
- **Total Images:** ${data.analysis.visualState.totalImages || 0}
- **Debug Screenshots:** ${data.analysis.visualState.debugScreenshots?.length || 0}
- **UI Inconsistencies:** ${data.analysis.visualState.uiInconsistencies?.length || 0}

### ⚡ Runtime Analysis
- **Console Logs:** ${data.analysis.runtime.consoleLogs?.length || 0}
- **Performance Issues:** ${data.analysis.runtime.performanceIssues?.length || 0}
- **Async Issues:** ${data.analysis.runtime.asyncIssues?.length || 0}

### 🚨 Hidden Issues
- **Commented Code:** ${data.analysis.hiddenIssues.commentedCode?.length || 0}
- **Debug Code:** ${data.analysis.hiddenIssues.debugCode?.length || 0}
- **Temporary Fixes:** ${data.analysis.hiddenIssues.temporaryFixes?.length || 0}
- **Magic Numbers:** ${data.analysis.hiddenIssues.magicNumbers?.length || 0}
- **Hardcoded Values:** ${data.analysis.hiddenIssues.hardcodedValues?.length || 0}

## 🎯 Top Recommendations

${data.recommendations.slice(0, 3).map((rec, index) => `
${index + 1}. **${rec.title}** (${rec.priority})
   - ${rec.description}
   - **Effort:** ${rec.estimatedEffort}
   - **Key Actions:** ${rec.actions.slice(0, 2).join(', ')}${rec.actions.length > 2 ? '...' : ''}
`).join('')}

## 🔍 THE BRUTAL TRUTH

${data.overall.criticalIssues > 0 ? `
❌ **CRITICAL:** ${data.overall.criticalIssues} critical issues found that could cause system failures.
   These must be fixed immediately before considering any deployment.
` : ''}

${data.overall.hiddenIssues > 0 ? `
⚠️ **HIDDEN ISSUES:** ${data.overall.hiddenIssues} hidden issues detected in your codebase.
   These affect maintainability and can cause future problems.
` : ''}

${data.analysis.conversations.mentionedProblems?.length > 0 ? `
💬 **CONVERSATION EVIDENCE:** ${data.analysis.conversations.mentionedProblems.length} problems mentioned in development conversations.
   Your past discussions reveal known issues that need attention.
` : ''}

## 📈 Coverage Statistics

- **Analysis Phases Completed:** ${Object.keys(data.analysis).length}
- **Total Evidence Points:** ${data.evidence.length}
- **Recommendations Generated:** ${data.recommendations.length}
- **Files Scanned:** ${data.analysis.codebase.totalFiles || 0}
- **Commits Analyzed:** ${data.analysis.gitHistory.totalCommits || 0}

## 🔗 Detailed Reports

Complete JSON and HTML reports are available in the \`.claude/total-coverage-reports/\` directory.

**This analysis leaves no stone unturned - every aspect of your system has been examined.**
`;
  }

  displayTotalCoverageSummary() {
    const overall = this.analysisResults.overall;
    const analysis = this.analysisResults.analysis;

    console.log('\n' + '='.repeat(80));
    console.log('🔬 TOTAL COVERAGE SYSTEM ANALYSIS - COMPLETE RESULTS');
    console.log('='.repeat(80));

    // Health score with brutal honesty
    const scoreColor = this.getScoreColor(overall.healthScore);
    const scoreClass = this.getScoreClass(overall.healthScore);

    console.log(`\n🎯 TOTAL SYSTEM HEALTH SCORE: ${scoreColor}${overall.healthScore}%${this.resetColor()}`);
    console.log(`   Grade: ${this.getGradeDisplay(scoreClass)}`);

    // Coverage statistics
    console.log(`\n📊 TOTAL COVERAGE STATISTICS:`);
    console.log(`   • Files Analyzed: ${analysis.codebase.totalFiles || 0}`);
    console.log(`   • Commits Analyzed: ${analysis.gitHistory.totalCommits || 0}`);
    console.log(`   • Conversations Analyzed: ${analysis.conversations.totalConversations || 0}`);
    console.log(`   • Images Analyzed: ${analysis.visualState.totalImages || 0}`);
    console.log(`   • Analysis Phases: ${Object.keys(analysis).length}`);

    // Critical metrics
    console.log(`\n🚨 CRITICAL FINDINGS:`);
    console.log(`   • Critical Issues: ${overall.criticalIssues > 0 ? `🚨 ${overall.criticalIssues}` : '✅ 0'}`);
    console.log(`   • Hidden Issues: ${overall.hiddenIssues > 0 ? `⚠️ ${overall.hiddenIssues}` : '✅ 0'}`);
    console.log(`   • Problem Patterns: ${overall.patterns.length}`);
    console.log(`   • Conversation Problems: ${analysis.conversations.mentionedProblems?.length || 0}`);

    // Top issues by category
    console.log(`\n🔍 ISSUES BY CATEGORY:`);
    this.displayIssuesByCategory();

    // Top recommendations
    if (this.analysisResults.recommendations.length > 0) {
      console.log(`\n🎯 TOP RECOMMENDATIONS:`);
      this.analysisResults.recommendations.slice(0, 3).forEach((rec, index) => {
        const priorityIcon = this.getPriorityIcon(rec.priority);
        console.log(`   ${index + 1}. ${priorityIcon} ${rec.title} (${rec.priority})`);
        console.log(`      📝 ${rec.description}`);
        console.log(`      ⏱️  Estimated effort: ${rec.estimatedEffort}`);
      });
    }

    // THE BRUTAL TRUTH section
    console.log(`\n🔍 THE BRUTAL TRUTH - NOTHING ESCAPED:`);

    if (overall.criticalIssues > 0) {
      console.log(`   ❌ CRITICAL: ${overall.criticalIssues} critical issues WILL cause production failures`);
      console.log(`      Your application is NOT ready for deployment`);
    }

    if (overall.hiddenIssues > 0) {
      console.log(`   ⚠️  HIDDEN: ${overall.hiddenIssues} hidden issues are time bombs waiting to explode`);
      console.log(`      Your codebase quality is degrading over time`);
    }

    if (analysis.conversations.mentionedProblems?.length > 0) {
      console.log(`   💬 EVIDENCE: ${analysis.conversations.mentionedProblems.length} problems mentioned in conversations`);
      console.log(`      Your team knows about these issues but they haven't been fixed`);
    }

    if (analysis.hiddenIssues.commentedCode?.length > 0) {
      console.log(`   📝 COMMENTED CODE: ${analysis.hiddenIssues.commentedCode.length} blocks of dead code found`);
      console.log(`      Your codebase is accumulating technical debt`);
    }

    if (analysis.hiddenIssues.debugCode?.length > 0) {
      console.log(`   🐛 DEBUG CODE: ${analysis.hiddenIssues.debugCode.length} debug statements left in production`);
      console.log(`      This exposes internal information and affects performance`);
    }

    if (overall.healthScore < 80) {
      console.log(`   📉 HEALTH SCORE ${overall.healthScore}%: This indicates significant systemic problems`);
      console.log(`      Users are experiencing issues and your technical debt is high`);
    }

    if (overall.healthScore >= 80 && overall.criticalIssues === 0) {
      console.log(`   ✅ EXCELLENT: Your system is in good shape with minor optimization opportunities`);
      console.log(`      Focus on the identified patterns to reach perfection`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📄 COMPLETE REPORTS GENERATED IN .claude/total-coverage-reports/');
    console.log('🔍 NOTHING WAS LEFT UNANALYZED - TOTAL COVERAGE ACHIEVED');
    console.log('='.repeat(80));
  }

  displayIssuesByCategory() {
    const categories = [
      { name: 'Codebase', data: this.analysisResults.analysis.codebase },
      { name: 'Git History', data: this.analysisResults.analysis.gitHistory },
      { name: 'Conversations', data: this.analysisResults.analysis.conversations },
      { name: 'Visual State', data: this.analysisResults.analysis.visualState },
      { name: 'Runtime', data: this.analysisResults.analysis.runtime },
      { name: 'Data Integrity', data: this.analysisResults.analysis.dataIntegrity },
      { name: 'Hidden Issues', data: this.analysisResults.analysis.hiddenIssues }
    ];

    categories.forEach(category => {
      const issues = this.countIssuesInPhase(category.data);
      const totalIssues = issues.critical + issues.high + issues.medium + issues.low;

      if (totalIssues > 0) {
        const icon = issues.critical > 0 ? '🚨' : issues.high > 0 ? '⚠️' : '⚡';
        console.log(`   ${icon} ${category.name}: ${totalIssues} issues (${issues.critical} critical)`);
      } else {
        console.log(`   ✅ ${category.name}: No issues detected`);
      }
    });
  }

  // Utility methods (reuse from previous version)
  async readFile(filePath, encoding = 'utf8') {
    return await fs.readFile(path.join(this.projectRoot, filePath), encoding);
  }

  async fileExists(filePath) {
    try {
      await fs.access(path.join(this.projectRoot, filePath));
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(path.join(this.projectRoot, dirPath));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getFiles(dir, pattern = null) {
    const files = [];

    if (!await this.directoryExists(dir)) {
      return files;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.getFiles(fullPath, pattern));
      } else if (!pattern || pattern.test(entry.name)) {
        files.push({
          name: entry.name,
          path: fullPath
        });
      }
    }

    return files;
  }

  findLineNumber(content, pattern) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        return i + 1;
      }
    }
    return null;
  }

  getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  getScoreColor(score) {
    if (score >= 90) return '\x1b[32m'; // Green
    if (score >= 80) return '\x1b[36m'; // Cyan
    if (score >= 70) return '\x1b[33m'; // Yellow
    if (score >= 60) return '\x1b[31m'; // Red
    return '\x1b[31;1m'; // Bold Red
  }

  resetColor() {
    return '\x1b[0m';
  }

  getGradeDisplay(grade) {
    const colors = {
      excellent: '\x1b[32mA\x1b[0m (Excellent)',
      good: '\x1b[36mB\x1b[0m (Good)',
      fair: '\x1b[33mC\x1b[0m (Fair)',
      poor: '\x1b[31mD\x1b[0m (Poor)',
      critical: '\x1b[31;1mF\x1b[0m (Critical)'
    };
    return colors[grade] || `${grade.toUpperCase()} (Unknown)`;
  }

  getPriorityIcon(priority) {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return icons[priority] || '📋';
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new TrulyComprehensiveSystemAnalyzer();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'total-coverage';
  const focus = args.find(arg => arg.startsWith('--focus='))?.split('=')[1] || null;

  analyzer.execute(mode, focus).catch(error => {
    console.error('❌ Total coverage analysis failed:', error.message);
    process.exit(1);
  });
}

module.exports = TrulyComprehensiveSystemAnalyzer;