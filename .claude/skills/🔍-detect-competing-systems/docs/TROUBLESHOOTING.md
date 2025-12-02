# 🔧 Troubleshooting Guide

This guide covers common issues, error scenarios, and solutions for the Detect Competing Systems skill.

## 📋 Table of Contents

- [Installation Issues](#installation-issues)
- [Analysis Engine Problems](#analysis-engine-problems)
- [False Positives/Negatives](#false-positivesnegatives)
- [Performance Issues](#performance-issues)
- [Integration Problems](#integration-problems)
- [Configuration Issues](#configuration-issues)
- [Output Issues](#output-issues)
- [Advanced Debugging](#advanced-debugging)

## 🚀 Installation Issues

### Node.js Version Errors

**Problem**: `Error: Node.js version not supported`
```bash
❌ Error: Node.js version 18.x is not supported. Requires Node.js >= 20.19.0
```

**Solution**:
```bash
# Check current Node.js version
node --version

# Install correct version using nvm
nvm install 20
nvm use 20
nvm alias default 20

# Or upgrade Node.js directly
# Visit https://nodejs.org and download v20+
```

### Permission Errors

**Problem**: `Permission denied` when accessing skill files
```bash
❌ Error: EACCES: permission denied, open '.claude-skills/detect-competing-systems/analysis-engine.js'
```

**Solution**:
```bash
# Fix file permissions
chmod -R 755 .claude-skills/detect-competing-systems/

# Or run with appropriate permissions
sudo chown -R $USER:$USER .claude-skills/detect-competing-systems/
```

### Missing Dependencies

**Problem**: Module not found errors
```bash
❌ Error: Cannot find module 'fs/promises'
```

**Solution**:
```bash
# Install skill dependencies
cd .claude-skills/detect-competing-systems
npm install

# Or ensure Node.js version supports required modules
node --version  # Should be 14+ for fs/promises
```

## 🔍 Analysis Engine Problems

### Analysis Engine Fails to Start

**Problem**: Analysis engine crashes immediately
```bash
❌ Error: Analysis engine failed to start
```

**Solution**:
```bash
# Check if Node.js can access the file
node .claude-skills/detect-competing-systems/analysis-engine.js --help

# Check for syntax errors
node -c .claude-skills/detect-competing-systems/analysis-engine.js

# Run with verbose output
node .claude-skills/detect-competing-systems/analysis-engine.js --verbose
```

### Pattern Loading Errors

**Problem**: Conflict patterns not loading
```bash
❌ Error: Failed to load conflict patterns
```

**Solution**:
```bash
# Validate JSON syntax
node -e "
  try {
    JSON.parse(require('fs').readFileSync('.claude-skills/detect-competing-systems/conflict-patterns.json', 'utf8'));
    console.log('✅ conflict-patterns.json is valid');
  } catch (e) {
    console.log('❌ conflict-patterns.json error:', e.message);
  }
"

# Check file existence and permissions
ls -la .claude-skills/detect-competing-systems/conflict-patterns.json
```

### Memory Issues

**Problem**: `JavaScript heap out of memory`
```bash
❌ FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
```

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or run with memory flag
node --max-old-space-size=4096 .claude-skills/detect-competing-systems/analysis-engine.js

# Reduce analysis scope
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --maxFileSize=50000 \
  --exclude="node_modules/**,dist/**"
```

## 🎯 False Positives/Negatives

### Too Many False Positives

**Problem**: Legitimate code flagged as conflicts

**Solution**:
```javascript
// Adjust similarity threshold
const options = {
  similarityThreshold: 0.85  // Increase from 0.75 to 0.85
};

// Add exemptions
{
  "exemptions": [
    {
      "name": "utility_functions",
      "reason": "Intentional utility duplication",
      "pattern": "**/utils/**/*"
    }
  ]
}

// Exclude specific patterns
{
  "excludePatterns": [
    "**/*Test*",
    "**/*Mock*",
    "**/*Example*"
  ]
}
```

### Missing Obvious Conflicts

**Problem**: Clear duplicates not being detected

**Solution**:
```bash
# Lower similarity threshold
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --threshold=0.6

# Check file patterns are matching
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --verbose --dry-run

# Verify patterns in conflict-patterns.json
grep -A 10 -B 2 "filePatterns" .claude-skills/detect-competing-systems/conflict-patterns.json
```

### Context Issues

**Problem**: Conflicts detected in wrong context

**Solution**:
```javascript
// Add context-aware exemptions
{
  "exemptions": [
    {
      "name": "testing_context",
      "reason": "Test-specific implementations are intentional",
      "condition": "file.includes('test') || file.includes('spec')"
    }
  ]
}

// Configure analysis depth
const options = {
  depth: {
    importDepth: 2,        // Reduce import analysis depth
    callDepth: 1,          // Reduce call analysis depth
    contextLines: 3        // Reduce context around matches
  }
};
```

## ⚡ Performance Issues

### Slow Analysis on Large Projects

**Problem**: Analysis takes too long (>5 minutes)

**Solution**:
```bash
# Limit file analysis
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --maxFiles=100 \
  --maxFileSize=50000

# Use sampling for large projects
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --sampleRate=0.1

# Analyze specific directories only
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --include="src/stores/**,src/composables/**"
```

### Memory Usage Too High

**Problem**: Process consumes excessive RAM

**Solution**:
```javascript
// Configure memory limits
const performanceConfig = {
  memory: {
    maxFileSize: 50000,      // Reduce from 100KB
    maxTotalSize: 20000000,  // Reduce from 50MB
    maxFilesInMemory: 50      // Reduce from 100
  },

  // Enable garbage collection
  gcInterval: 500,           // More frequent GC

  // Process in smaller chunks
  chunkSize: 25              // Reduce from 50
};
```

### CPU Usage Issues

**Problem**: High CPU usage during analysis

**Solution**:
```bash
# Reduce parallelism
export COMPETING_SYSTEMS_MAX_CONCURRENT=5

# Use single-threaded mode
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --singleThread

# Add delays between file processing
export COMPETING_SYSTEMS_FILE_DELAY=100
```

## 🔗 Integration Problems

### Pre-commit Hook Issues

**Problem**: Pre-commit hook not working
```bash
❌ .git/hooks/pre-commit: line 1: node: command not found
```

**Solution**:
```bash
# Ensure Node.js is in PATH
which node
echo $PATH

# Update hook shebang to use full Node.js path
sed -i '1s|#!/usr/bin/env node|#!'"$(which node)"'|' .git/hooks/pre-commit

# Or make script executable with proper permissions
chmod +x .git/hooks/pre-commit
```

### Pre-commit Hook Too Slow

**Problem**: Hook makes commits too slow

**Solution**:
```bash
# Enable quick check mode
export COMPETING_SYSTEMS_QUICK_CHECK=true

# Reduce analysis scope for commits
export COMPETING_SYSTEMS_COMMIT_SCOPE="changed"

# Skip analysis for small commits
export COMPETING_SYSTEMS_SKIP_SMALL=true
```

### ESLint Integration Issues

**Problem**: Custom ESLint rules not working

**Solution**:
```javascript
// Check ESLint configuration
npx eslint --print-config src/stores/TaskStore.ts

// Verify custom rules are loaded
npx eslint --debug src/stores/TaskStore.ts

// Check rule configuration
module.exports = {
  rules: {
    'custom/no-competing-stores': ['error', {
      enabled: true,
      threshold: 0.8
    }]
  }
};
```

### GitHub Actions Failures

**Problem**: CI workflow failing

**Solution**:
```yaml
# Add debugging steps
- name: Debug Analysis
  run: |
    node --version
    ls -la .claude-skills/detect-competing-systems/
    node .claude-skills/detect-competing-systems/analysis-engine.js --help

# Add timeout handling
- name: Run Analysis
  run: |
    timeout 300 node .claude-skills/detect-competing-systems/analysis-engine.js \
      --reportFormat=json \
      --outputFile=report.json

# Handle failures gracefully
- name: Handle Analysis Failure
  if: failure()
  run: |
    echo "Analysis failed, but continuing..."
    # Optional: Create empty report to avoid downstream failures
    echo '{"conflicts": [], "summary": {"total": 0}}' > report.json
```

## ⚙️ Configuration Issues

### Invalid JSON Configuration

**Problem**: Syntax errors in configuration files

**Solution**:
```bash
# Validate JSON files
node -e "
  const files = [
    '.claude-skills/detect-competing-systems/conflict-patterns.json',
    '.claude-skills/detect-competing-systems/exemptions.json'
  ];

  files.forEach(file => {
    try {
      JSON.parse(require('fs').readFileSync(file, 'utf8'));
      console.log('✅', file, 'is valid');
    } catch (e) {
      console.log('❌', file, 'error:', e.message);
      console.log('Line:', e.message.match(/line (\d+)/)?.[1] || 'unknown');
    }
  });
"

# Use JSON linter
npm install -g jsonlint
jsonlint .claude-skills/detect-competing-systems/conflict-patterns.json
```

### Pattern Not Matching

**Problem**: Custom patterns not detecting expected conflicts

**Solution**:
```javascript
// Test patterns manually
const testPattern = /defineStore\s*\(\s*['"]([^'"]+)['"]/;
const testCode = `
  defineStore('tasks', () => {
    // store content
  });
`;

const match = testCode.exec(testCode);
console.log('Pattern match:', match);
```

### Threshold Too High/Low

**Problem**: Similarity threshold not working as expected

**Solution**:
```bash
# Test different thresholds
for threshold in 0.6 0.7 0.8 0.9; do
  echo "Testing threshold: $threshold"
  node .claude-skills/detect-competing-systems/analysis-engine.js \
    --threshold=$threshold \
    --outputFile=report-$threshold.json
  echo "Conflicts found: $(node -e "console.log(JSON.parse(require('fs').readFileSync('report-$threshold.json')).summary.total)")"
done
```

## 📊 Output Issues

### Report Generation Problems

**Problem**: No report file created

**Solution**:
```bash
# Check output directory permissions
ls -la ./

# Try different output path
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --outputFile=/tmp/competing-systems-report.json

# Check for write errors
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --outputFile=test-report.json \
  2>&1 | tee analysis.log
```

### JSON Output Malformed

**Problem**: Generated JSON is invalid

**Solution**:
```bash
# Validate generated JSON
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --outputFile=report.json

node -e "
  try {
    JSON.parse(require('fs').readFileSync('report.json', 'utf8'));
    console.log('✅ Generated JSON is valid');
  } catch (e) {
    console.log('❌ Generated JSON error:', e.message);
    console.log('Position:', e.message.match(/position (\d+)/)?.[1]);
  }
"
```

### Console Output Issues

**Problem**: Too much or too little console output

**Solution**:
```bash
# Control verbosity
export COMPETING_SYSTEMS_VERBOSE=false
export COMPETING_SYSTEMS_QUIET=true

# Or use command line flags
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --quiet \
  --no-progress
```

## 🔧 Advanced Debugging

### Debug Mode

**Problem**: Need detailed debugging information

**Solution**:
```bash
# Enable debug mode
export DEBUG=competing-systems:*
export NODE_OPTIONS="--inspect"

# Run with debug output
node --inspect .claude-skills/detect-competing-systems/analysis-engine.js \
  --debug \
  --verbose
```

### Step-by-Step Analysis

**Problem**: Need to understand analysis process

**Solution**:
```javascript
// Add debugging to analysis engine
const debugMode = process.env.DEBUG === 'true';

function debug(message, data) {
  if (debugMode) {
    console.log(`[DEBUG] ${message}`, data);
  }
}

// Use in analysis flow
debug('Starting file analysis', { file: filePath, size: fileSize });
debug('Pattern match result', { pattern, matches: similarity });
debug('Conflict detected', conflict);
```

### Memory Profiling

**Problem**: Need to analyze memory usage

**Solution**:
```bash
# Generate memory profile
node --prof .claude-skills/detect-competing-systems/analysis-engine.js

# Analyze profile
node --prof-process isolate-*.log > profile-analysis.txt

# Or use heap snapshots
node --inspect --heap-prof .claude-skills/detect-competing-systems/analysis-engine.js
```

### File Isolation Testing

**Problem**: Specific files causing issues

**Solution**:
```bash
# Test single file
node -e "
  const analyzer = require('./.claude-skills/detect-competing-systems/analysis-engine.js');
  analyzer.analyzeFile('src/stores/TaskStore.ts').then(result => {
    console.log('Analysis result:', result);
  }).catch(error => {
    console.error('Analysis error:', error);
  });
"

# Test specific directory
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --include="src/stores/**" \
  --outputFile=stores-analysis.json
```

### Getting Help

**Problem**: Issue not covered in this guide

**Solution**:
```bash
# Generate debug information
node .claude-skills/detect-competing-systems/analysis-engine.js \
  --help > help.txt

# Create bug report template
cat > bug-report.md << EOF
## Issue Description
[Describe the problem]

## Environment
- Node.js version: $(node --version)
- OS: $(uname -a)
- Project size: $(find src -name "*.ts" -o -name "*.vue" | wc -l) files

## Reproduction Steps
1.
2.
3.

## Error Message
[Paste the full error message]

## Configuration
[Paste your configuration if relevant]

## Expected vs Actual
- Expected:
- Actual:
EOF

echo "📝 Bug report template created: bug-report.md"
echo "Please include this file when reporting the issue."
```

This troubleshooting guide should help resolve most common issues with the Detect Competing Systems skill. For persistent problems, consider creating a bug report with the template provided above.