import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export class CodeScanner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  // Scan entire codebase for patterns
  async scanCode() {
    console.log('\n🔍 Scanning codebase for insights...\n');

    const findings = {
      features: [],
      bugs: [],
      improvements: [],
      nextSteps: []
    };

    try {
      // Scan 1: Vue components for unused
      console.log('📊 Analyzing Vue components...');
      findings.features.push(...this.findVueIssues());

      // Scan 2: TypeScript errors patterns
      console.log('📊 Analyzing TypeScript patterns...');
      findings.bugs.push(...this.findTypeScriptIssues());

      // Scan 3: Performance improvements
      console.log('📊 Analyzing performance...');
      findings.improvements.push(...this.findPerformanceIssues());

      // Scan 4: Git history for patterns
      console.log('📊 Analyzing git history...');
      findings.nextSteps.push(...this.analyzeGitHistory());

    } catch (e) {
      console.error(`⚠️ Scan failed: ${e.message}`);
    }

    return findings;
  }

  findVueIssues() {
    const issues = [];

    try {
      const vueFiles = this.findFiles(this.projectRoot, '.vue');

      for (const file of vueFiles) {
        const content = fs.readFileSync(file, 'utf8');

        // Check 1: Unused computed properties
        if (content.match(/computed:\s*{[\s\S]*?}/)) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'info',
            title: 'Computed Properties Found',
            description: 'Review if all computed properties are used',
            priority: 'low'
          });
        }

        // Check 2: Missing key in v-for
        if (content.match(/v-for="[^"]*"\s(?!:key)/)) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'warning',
            title: 'Missing :key in v-for',
            description: 'Add :key binding to v-for loops for better performance',
            priority: 'medium'
          });
        }

        // Check 3: Console.log
        if (content.match(/console\.(log|error|warn)/)) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'info',
            title: 'Console statements found',
            description: 'Remove or replace with logger in production code',
            priority: 'low'
          });
        }
      }

    } catch (e) {
      console.warn(`⚠️ Vue scan failed: ${e.message}`);
    }

    return issues;
  }

  findTypeScriptIssues() {
    const issues = [];

    try {
      const tsFiles = this.findFiles(this.projectRoot, '.ts', '.tsx');

      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf8');

        // Check 1: Any types
        if (content.match(/:\s*any\b/g)) {
          const count = content.match(/:\s*any\b/g).length;
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'warning',
            title: `${count} 'any' types found`,
            description: 'Replace with specific types for better type safety',
            priority: 'medium'
          });
        }

        // Check 2: Untyped params
        if (content.match(/\(\s*(\w+)\s*\)\s*=>/)) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'warning',
            title: 'Untyped arrow function parameters',
            description: 'Add type annotations to function parameters',
            priority: 'low'
          });
        }

        // Check 3: TODO comments
        if (content.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/)) {
          const todos = content.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/g).length;
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'info',
            title: `${todos} TODO/FIXME comments`,
            description: 'Track these in kanban as tasks',
            priority: 'low'
          });
        }
      }

    } catch (e) {
      console.warn(`⚠️ TypeScript scan failed: ${e.message}`);
    }

    return issues;
  }

  findPerformanceIssues() {
    const issues = [];

    try {
      const allFiles = this.findFiles(this.projectRoot, '.vue', '.ts', '.tsx', '.js');

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');

        // Check 1: Large files
        const lines = content.split('\n').length;
        if (lines > 500) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'suggestion',
            title: `Large file (${lines} lines)`,
            description: 'Consider splitting into smaller modules',
            priority: 'low'
          });
        }

        // Check 2: Inline large objects
        if (content.match(/const\s+\w+\s*=\s*\{[\s\S]{500,}\}/)) {
          issues.push({
            file: path.relative(this.projectRoot, file),
            type: 'suggestion',
            title: 'Large inline object',
            description: 'Consider extracting to separate constant or file',
            priority: 'low'
          });
        }
      }

    } catch (e) {
      console.warn(`⚠️ Performance scan failed: ${e.message}`);
    }

    return issues;
  }

  analyzeGitHistory() {
    const suggestions = [];

    try {
      // Get recent commits
      const log = execSync('git log --oneline -20', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      // Analyze patterns
      if (log.match(/fix|bug/i)) {
        suggestions.push({
          type: 'observation',
          title: 'Active bug fixing',
          description: 'Track recurring issues in kanban for pattern analysis',
          priority: 'medium'
        });
      }

      if (log.match(/refactor/i)) {
        suggestions.push({
          type: 'observation',
          title: 'Recent refactoring',
          description: 'Good! Document architectural changes in ARCHITECTURE.md',
          priority: 'low'
        });
      }

      // Check commit frequency
      const commits = log.split('\n').filter(l => l.trim().length > 0).length;
      if (commits < 5) {
        suggestions.push({
          type: 'suggestion',
          title: 'Low commit frequency',
          description: 'Consider more frequent commits for better tracking',
          priority: 'low'
        });
      }

    } catch (e) {
      console.warn(`⚠️ Git analysis failed: ${e.message}`);
    }

    return suggestions;
  }

  findFiles(dir, ...extensions) {
    const files = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            files.push(...this.findFiles(fullPath, ...extensions));
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.warn(`⚠️ File search failed: ${e.message}`);
    }

    return files;
  }

  // Format and display findings
  displayFindings(findings) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CODE SCAN RESULTS');
    console.log('='.repeat(60) + '\n');

    // Features
    if (findings.features.length > 0) {
      console.log('🎯 SUGGESTED FEATURES:');
      findings.features.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.title} [${f.file}]`);
        console.log(`     ${f.description}\n`);
      });
    }

    // Bugs
    if (findings.bugs.length > 0) {
      console.log('\n❌ POTENTIAL ISSUES:');
      findings.bugs.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.title} [${b.file}]`);
        console.log(`     ${b.description}\n`);
      });
    }

    // Improvements
    if (findings.improvements.length > 0) {
      console.log('\n⚡ IMPROVEMENTS:');
      findings.improvements.forEach((imp, i) => {
        console.log(`  ${i + 1}. ${imp.title} [${imp.file}]`);
        console.log(`     ${imp.description}\n`);
      });
    }

    // Next Steps
    if (findings.nextSteps.length > 0) {
      console.log('\n🚀 NEXT STEPS:');
      findings.nextSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.title}`);
        console.log(`     ${step.description}\n`);
      });
    }

    console.log('='.repeat(60));
    console.log('💡 Review these findings and add as ideas/tasks:\n');
    console.log('  @issue-creator capture-idea --title "Fix [X]" --thought "[reason]"\n');
  }
}

export default CodeScanner;