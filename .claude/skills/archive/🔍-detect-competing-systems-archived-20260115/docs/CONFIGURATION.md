# ⚙️ Configuration Guide

This guide covers advanced configuration options for customizing the Detect Competing Systems skill to match your project's specific needs.

## 📋 Table of Contents

- [Core Configuration](#core-configuration)
- [Analysis Engine Settings](#analysis-engine-settings)
- [Pattern Customization](#pattern-customization)
- [Exemptions Management](#exemptions-management)
- [Integration Configuration](#integration-configuration)
- [Performance Tuning](#performance-tuning)
- [Environment-Specific Settings](#environment-specific-settings)

## 🎯 Core Configuration

### Analysis Options

```javascript
// Basic configuration when running analysis engine
const options = {
  rootDir: process.cwd(),           // Project root directory
  similarityThreshold: 0.75,        // Minimum similarity for conflicts (0.1-1.0)
  maxFileSize: 100000,             // Max file size to analyze (bytes)
  severity: 'MEDIUM',              // Minimum severity to report (HIGH/MEDIUM/LOW)
  includeExamples: true,           // Include example files in analysis
  outputFormat: 'json'             // Output format (json|text|markdown)
};
```

### File and Directory Configuration

```javascript
const fileConfig = {
  // Include patterns (globs)
  include: [
    'src/**/*.{ts,tsx,vue}',
    'stores/**/*',
    'composables/**/*',
    'components/**/*'
  ],

  // Exclude patterns (globs)
  exclude: [
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '**/*.d.ts',
    '**/*.test.*',
    '**/*.spec.*',
    'tests/**',
    'stories/**'
  ],

  // Directory-specific settings
  directories: {
    stores: {
      path: 'src/stores',
      patterns: ['defineStore', 'use\\w+Store'],
      severity: 'HIGH'
    },
    composables: {
      path: 'src/composables',
      patterns: ['function use\\w+', 'export.*use'],
      severity: 'MEDIUM'
    },
    components: {
      path: 'src/components',
      patterns: ['defineComponent', '<script setup'],
      severity: 'MEDIUM'
    }
  }
};
```

## 🔍 Analysis Engine Settings

### Similarity Threshold Configuration

```javascript
const similarityConfig = {
  // Global threshold for all conflict types
  defaultThreshold: 0.75,

  // Type-specific thresholds
  typeThresholds: {
    'duplicate_stores': 0.80,        // Higher threshold for stores
    'duplicate_composables': 0.75,   // Medium threshold for composables
    'duplicate_components': 0.80,     // Higher threshold for components
    'duplicate_utilities': 0.85,      // Very high threshold for utilities
    'naming_conflicts': 0.90,         // Highest threshold for naming
    'form_conflicts': 0.70            // Lower threshold for forms (patterns differ more)
  },

  // Adjust threshold based on file size
  sizeAdjustments: {
    small: { maxSize: 5000, adjustment: -0.10 },   // Small files: lower threshold
    medium: { maxSize: 20000, adjustment: 0 },       // Medium files: no adjustment
    large: { maxSize: 100000, adjustment: 0.10 }     // Large files: higher threshold
  }
};
```

### Analysis Scope Configuration

```javascript
const scopeConfig = {
  // What to analyze
  analyze: {
    stores: true,
    composables: true,
    components: true,
    utilities: true,
    types: true,
    tests: false,
    documentation: false
  },

  // Analysis depth
  depth: {
    // How deep to analyze imports
    importDepth: 3,
    // How many levels of function calls to analyze
    callDepth: 2,
    // How many lines of context to include around matches
    contextLines: 5
  },

  // Cross-file analysis
  crossFile: {
    enabled: true,
    maxFiles: 50,                   // Limit files to analyze for performance
    includeImports: true,
    includeExports: true,
    trackDependencies: true
  }
};
```

## 🎨 Pattern Customization

### Adding Custom Conflict Types

```javascript
// Add to conflict-patterns.json
{
  "categories": {
    "custom_patterns": {
      "description": "Custom conflict patterns for my project",
      "patterns": [
        {
          "id": "custom_api_layer_conflicts",
          "name": "API Layer Duplication",
          "description": "Multiple API client implementations",
          "severity": "HIGH",
          "detection": {
            "indicators": [
              "Multiple axios instances",
              "Duplicate API endpoint definitions",
              "Similar error handling patterns",
              "Duplicate authentication handling"
            ],
            "filePatterns": ["src/api/**/*.ts", "src/services/**/*.ts"],
            "similarityThreshold": 0.80,
            "codePatterns": [
              "axios\\.create",
              "export.*api",
              "\\b(baseURL|endpoint)\\b",
              "interceptors\\.(request|response)"
            ]
          },
          "recommendation": "Consolidate into single API client with configuration",
          "estimatedEffort": "3-4 hours",
          "risk": "Medium"
        },
        {
          "id": "custom_state_management",
          "name": "Mixed State Management",
          "description": "Inconsistent state management patterns",
          "severity": "MEDIUM",
          "detection": {
            "indicators": [
              "Vuex mixed with Pinia",
              "Local state mixed with global state",
              "Context API mixed with stores"
            ],
            "similarityThreshold": 0.70,
            "codePatterns": [
              "createStore",
              "defineStore",
              "useState",
              "useContext",
              "provide/inject"
            ]
          },
          "recommendation": "Standardize on single state management approach",
          "estimatedEffort": "5-8 hours",
          "risk": "High"
        }
      ]
    }
  }
}
```

### Modifying Existing Patterns

```javascript
// Example: Customizing store detection pattern
{
  "id": "duplicate_store",
  "name": "Duplicate Pinia Store (Custom)",
  "description": "Enhanced store conflict detection for our project",
  "severity": "HIGH",
  "detection": {
    "indicators": [
      // Existing indicators
      "Similar store names",
      "Overlapping state properties",
      // Custom indicators
      "Same API endpoints in actions",
      "Duplicate getter patterns",
      "Similar mutation patterns",
      "Cross-store dependencies detected"
    ],
    "filePatterns": [
      "src/stores/**/*.ts",
      "src/stores/**/*.js",
      "src/pinia/**/*"  // Custom pattern
    ],
    "similarityThreshold": 0.85,  // Increased threshold
    "codePatterns": [
      "defineStore\\('[^']*'[^}]*}",
      "\\b(actions|mutations|getters)\\b",
      "\\$patch\\(",
      "\\$reset\\(",
      "storeToRefs",              // Custom pattern
      "mapStores"                 // Custom pattern
    ]
  }
}
```

### Advanced Pattern Matching

```javascript
const advancedPatterns = {
  // Regex patterns for complex matching
  regex: {
    // Complex store pattern
    storePattern: /defineStore\s*\(\s*['"]([^'"]+)['"]\s*,\s*\(\s*\)\s*=>\s*\{([^}]+)\}/g,

    // Composable pattern with return object
    composablePattern: /export\s+function\s+(use\w+)\s*\([^)]*\)\s*\{[^}]*return\s*\{([^}]+)\}/g,

    // Component with script setup
    componentPattern: /<script\s+setup[^>]*>([\s\S]*?)<\/script>/g
  },

  // Context-based patterns
  contextual: {
    // Check if files are in related directories
    directoryRelated: (file1, file2) => {
      const dir1 = path.dirname(file1);
      const dir2 = path.dirname(file2);
      return dir1.includes('stores') && dir2.includes('stores');
    },

    // Check if files import similar modules
    importSimilarity: (file1, file2) => {
      const imports1 = extractImports(file1);
      const imports2 = extractImports(file2);
      return calculateSimilarity(imports1, imports2);
    }
  }
};
```

## 🚫 Exemptions Management

### Project-Specific Exemptions

```json
{
  "exemptions": [
    {
      "id": "legacy_adapter_pattern",
      "name": "Legacy Adapter Pattern",
      "reason": "Maintaining compatibility with legacy API during migration",
      "description": "Adapter classes for legacy API integration",
      "pattern": {
        "filePatterns": ["src/adapters/legacy/**/*", "**/*LegacyAdapter*"],
        "codePatterns": ["LEGACY_ADAPTER", "@deprecated"],
        "conditions": [
          "Files contain 'Legacy' in name",
          "Has deprecation comments",
          "Migration plan documented"
        ]
      },
      "expires": "2025-12-31",  // Exemption expiry date
      "owner": "backend-team"
    },
    {
      "id": "feature_flag_variants",
      "name": "Feature Flag Variants",
      "reason": "Different implementations controlled by feature flags",
      "description": "Feature-specific variants for A/B testing",
      "pattern": {
        "conditions": [
          "Contains feature flag checks",
          "Different implementations for different flags",
          "Feature flag documentation present"
        ]
      }
    }
  ]
}
```

### Dynamic Exemptions

```javascript
// Dynamic exemption based on file content
const dynamicExemptions = {
  // Exempt files with specific comments
  commentBased: (file, content) => {
    return content.includes('// COMPETING-SYSTEMS-EXEMPT') ||
           content.includes('// TODO: consolidate with') ||
           content.includes('// TEMPORARY: parallel implementation');
  },

  // Exempt based on file size (small utility files)
  sizeBased: (file, size) => {
    return size < 1000 && file.includes('util');
  },

  // Exempt based on path patterns
  pathBased: (file) => {
    const exemptPaths = [
      'src/legacy/',
      'src/experimental/',
      'src/migration/',
      'src/temp/'
    ];
    return exemptPaths.some(path => file.includes(path));
  },

  // Exempt based on git history (recently added files)
  gitBased: async (file) => {
    const addedDate = await getFileGitDate(file);
    const daysOld = (Date.now() - addedDate) / (1000 * 60 * 60 * 24);
    return daysOld < 7; // Exempt files added in last 7 days
  }
};
```

## 🔗 Integration Configuration

### Pre-commit Hook Configuration

```bash
# Environment variables for pre-commit hook
export COMPETING_SYSTEMS_THRESHOLD=0.8
export COMPETING_SYSTEMS_SEVERITY=HIGH
export COMPETING_SYSTEMS_EXCLUDE="tests/**,stories/**"
export COMPETING_SYSTEMS_TIMEOUT=120

# Enable/disable specific checks
export COMPETING_SYSTEMS_QUICK_CHECK=true
export COMPETING_SYSTEMS_SIZE_CHECK=true
export COMPETING_SYSTEMS_PATTERN_CHECK=true
```

### ESLint Custom Rules Configuration

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Custom rule configurations
    'custom/no-competing-stores': ['error', {
      threshold: 0.8,
      excludePatterns: ['TestStore', 'MockStore'],
      allowedSimilarity: ['computed', 'actions']
    }],

    'custom/prefer-single-fetch-pattern': ['warn', {
      allowInTests: true,
      allowInStories: true,
      exceptionPatterns: ['useLazyFetch', 'useBackgroundFetch']
    }],

    'custom/consistent-reactive-patterns': ['error', {
      preferredPattern: 'ref',
      allowReactive: ['forms', 'config'],
      allowShallowReactive: false
    }]
  }
};
```

### GitHub Actions Configuration

```yaml
# .github/workflows/competing-systems.yml
env:
  THRESHOLD: ${{ vars.COMPETING_SYSTEMS_THRESHOLD || '0.75' }}
  SEVERITY: ${{ vars.COMPETING_SYSTEMS_SEVERITY || 'MEDIUM' }}
  TIMEOUT: ${{ vars.COMPETING_SYSTEMS_TIMEOUT || '300' }}
  FAIL_ON_HIGH: ${{ vars.COMPETING_SYSTEMS_FAIL_ON_HIGH || 'true' }}

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Run Analysis
        run: |
          node .claude-skills/detect-competing-systems/analysis-engine.js \
            --threshold=${{ env.THRESHOLD }} \
            --severity=${{ env.SEVERITY }} \
            --timeout=${{ env.TIMEOUT }}
```

### VS Code Extension Settings

```json
// .vscode/settings.json
{
  "competingSystems.enabled": true,
  "competingSystems.similarityThreshold": 0.75,
  "competingSystems.severityFilter": "medium",
  "competingSystems.excludePatterns": [
    "node_modules/**",
    "dist/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "competingSystems.analyzeOnSave": false,
  "competingSystems.highlightConflicts": true,
  "competingSystems.showGutterIcons": true,
  "competingSystems.enableRealTimeAnalysis": false,
  "competingSystems.maxFileSize": 100000,
  "competingSystems.customPatterns": {
    "myProjectSpecific": {
      "enabled": true,
      "threshold": 0.8,
      "patterns": ["customPattern1", "customPattern2"]
    }
  }
}
```

## ⚡ Performance Tuning

### Memory and Performance Configuration

```javascript
const performanceConfig = {
  // Memory limits
  memory: {
    maxFileSize: 100000,           // 100KB per file
    maxTotalSize: 50000000,        // 50MB total analysis size
    maxFilesInMemory: 100,         // Max files to keep in memory
    gcInterval: 1000               // Garbage collection interval (ms)
  },

  // Processing limits
  processing: {
    maxConcurrentFiles: 10,        // Process files in parallel
    maxAnalysisTime: 300000,       // 5 minutes max analysis time
    chunkSize: 50,                 // Process files in chunks
    progressReporting: true        // Show progress during analysis
  },

  // Caching
  cache: {
    enabled: true,
    maxSize: 10000000,             // 10MB cache size
    ttl: 3600000,                  // 1 hour cache TTL
    keyGenerator: (file) => `${file}:${fs.statSync(file).mtime.getTime()}`
  },

  // Optimization flags
  optimizations: {
    skipEmptyFiles: true,
    skipTestFiles: true,
    useStreaming: true,
    enableParallelism: true,
    incremental: false              // Enable incremental analysis
  }
};
```

### Large Project Configuration

```javascript
// For projects with 1000+ files
const largeProjectConfig = {
  // Reduce scope for performance
  scope: {
    priority: ['stores', 'composables', 'components'],
    exclude: ['tests/**', 'docs/**', 'examples/**'],
    maxDepth: 3
  },

  // Aggressive exclusions
  exclude: [
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    'vendor/**',
    'third-party/**'
  ],

  // Sampling for very large projects
  sampling: {
    enabled: true,
    sampleRate: 0.1,               // Analyze 10% of files randomly
    prioritize: ['stores', 'composables'],
    ensureAnalyzed: ['**/stores/*.ts', '**/composables/*.ts']
  }
};
```

## 🌍 Environment-Specific Settings

### Development Environment

```javascript
const devConfig = {
  // More thorough analysis in development
  similarityThreshold: 0.7,         // Lower threshold = more conflicts detected
  severity: 'LOW',                  // Report all severity levels
  includeTests: true,               // Include test files in analysis
  detailedReporting: true,          // Include detailed recommendations
  progressReporting: true           // Show progress during analysis
};
```

### CI/CD Environment

```javascript
const ciConfig = {
  // Optimized for CI/CD
  similarityThreshold: 0.8,         // Higher threshold = fewer false positives
  severity: 'HIGH',                 // Only report HIGH severity conflicts
  includeTests: false,              // Skip test files
  detailedReporting: false,         // Concise reporting
  outputFormat: 'json',            // Machine-readable output
  timeout: 120000,                  // 2 minute timeout
  failOnHigh: true                  // Fail build on HIGH severity conflicts
};
```

### Production Monitoring

```javascript
const monitoringConfig = {
  // Monitoring configuration
  enabled: true,
  metrics: {
    trackAnalysisTime: true,
    trackMemoryUsage: true,
    trackConflictCounts: true,
    trackPerformanceMetrics: true
  },
  alerts: {
    highConflictCount: { threshold: 10, action: 'warn' },
    longAnalysisTime: { threshold: 300000, action: 'error' },
    memoryUsage: { threshold: 500000000, action: 'warn' }
  }
};
```

## 📝 Configuration File Examples

### Complete Configuration Example

```json
{
  "analysis": {
    "rootDir": ".",
    "similarityThreshold": 0.75,
    "severity": "MEDIUM",
    "maxFileSize": 100000,
    "outputFormat": "json"
  },
  "patterns": {
    "custom": {
      "enabled": true,
      "threshold": 0.8,
      "types": ["stores", "composables", "components"]
    }
  },
  "exemptions": {
    "autoApply": true,
    "customRules": [
      {
        "pattern": "legacy/**/*",
        "reason": "Legacy code migration"
      },
      {
        "pattern": "**/*Test*",
        "reason": "Test files"
      }
    ]
  },
  "performance": {
    "maxConcurrentFiles": 10,
    "timeout": 300000,
    "cache": {
      "enabled": true,
      "ttl": 3600000
    }
  },
  "reporting": {
    "includeExamples": true,
    "includeRecommendations": true,
    "includeMetrics": true
  }
}
```

### Environment-Specific Configuration

```javascript
// config/competing-systems.js
module.exports = {
  development: {
    similarityThreshold: 0.7,
    severity: 'LOW',
    detailedReporting: true
  },

  production: {
    similarityThreshold: 0.8,
    severity: 'HIGH',
    outputFormat: 'json',
    failOnHigh: true
  },

  ci: {
    similarityThreshold: 0.85,
    severity: 'HIGH',
    timeout: 120000,
    exclude: ['tests/**', 'stories/**']
  }
};
```

This configuration guide provides comprehensive options for customizing the Detect Competing Systems skill to match your project's specific needs and constraints.