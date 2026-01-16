# 🔍 Detect Competing Systems Skill

A comprehensive Claude Code skill for identifying duplicate, conflicting, and competing systems in Vue 3 + TypeScript + Pinia projects. This skill helps detect architectural conflicts, duplicate implementations, and competing logic patterns BEFORE they cause technical debt.

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 20.19.0 (required for analysis engine)
- **npm** >= 10.0.0
- Vue 3 project with TypeScript (recommended)

### Installation

1. **Upload skill to Claude Code:**
   ```bash
   # Copy the skill directory to your project
   cp -r .claude-skills/detect-competing-systems /path/to/your/project/.claude-skills/
   ```

2. **Activate the skill in Claude Code:**
   ```
   Use the detect competing systems skill to review this code
   ```

3. **Run your first analysis:**
   ```
   Analyze my entire codebase for competing systems
   Focus on Pinia store conflicts and check for HIGH severity issues
   ```

## 📊 What It Detects

The skill identifies **25 conflict categories** across multiple architectural dimensions:

### Core Architecture
- ✅ **State Management** - Duplicate Pinia stores, overlapping state
- ✅ **Composables & Hooks** - Multiple implementations of same reactive logic
- ✅ **Components** - Duplicate component implementations and functionality
- ✅ **Utility Functions** - Multiple versions of same utility logic
- ✅ **Framework Integration** - Inconsistent framework usage patterns

### Extended Coverage (25 Total Categories)
- ✅ **Reactive Patterns** - Mixed reactive(), ref(), shallowReactive() usage
- ✅ **Side Effects & Lifecycle** - Multiple places fetching same data
- ✅ **Error Handling** - Inconsistent error handling across codebase
- ✅ **Form Handling** - Multiple form validation and submission patterns
- ✅ **Validation Logic** - Duplicate validation rules and business logic
- ✅ **Type Definitions** - Same types defined in multiple places
- ✅ **Authentication** - Scattered auth and permission checks
- ✅ **Data Formatting** - Multiple formatters for same data types
- ✅ **Async Operations** - Mixed promises, callbacks, and async/await
- ✅ **Constants & Config** - Same configuration values in multiple places
- ✅ **Notifications** - Multiple toast/notification systems
- ✅ **Data Caching** - Inconsistent caching and refresh strategies
- ✅ **Content Patterns** - Mixed slot vs prop usage patterns
- ✅ **Naming Conventions** - Inconsistent naming patterns

## 🎯 Usage Examples

### Basic Analysis
```
Use the detect competing systems skill to analyze this project
```

### Targeted Analysis
```
Focus on filtering system conflicts in my codebase
Check for reactive pattern inconsistencies
Analyze only HIGH severity conflicts
```

### Specific Category Analysis
```
Look for duplicate Pinia stores
Find competing form handling patterns
Identify async operation conflicts
Check for naming convention issues
```

### Integration Requests
```
Help me set up pre-commit hooks for conflict detection
Create ESLint rules to prevent competing systems
Set up GitHub Actions for automated analysis
Configure VS Code extension for real-time detection
```

## 📋 Output Format

Each conflict analysis provides a comprehensive report:

### Conflict Details
```json
{
  "conflictId": "duplicate-task-stores-001",
  "type": "State Management",
  "subtype": "Duplicate Pinia Stores",
  "severity": "HIGH",
  "files": [
    {
      "path": "src/stores/TaskStore.ts",
      "lineNumbers": [15, 23, 45]
    }
  ],
  "description": "Two stores managing similar data domains with 92% similarity",
  "patternMatch": 0.92,
  "recommendation": "Consolidate into single store with computed properties",
  "consolidationPath": [
    "Keep TaskStore as primary implementation",
    "Move duplicate logic to computed properties",
    "Update all imports to use consolidated store"
  ],
  "estimatedEffort": "2-3 hours",
  "risk": "Medium"
}
```

### Severity Levels
- **🔴 HIGH**: Critical conflicts causing bugs or major maintenance burden
- **🟡 MEDIUM**: Conflicts causing inconsistency or moderate overhead
- **🟢 LOW**: Minor inconsistencies or code quality issues

### Risk Assessment
- **Breaking changes required**: YES/NO
- **Testing scope**: Components/stores affected
- **Migration complexity**: SIMPLE/MODERATE/COMPLEX
- **Rollback difficulty**: EASY/MEDIUM/HARD

## 🔧 Integration Options

### Pre-commit Hooks
```bash
# Install the pre-commit hook
cp .claude-skills/detect-competing-systems/integration/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

The pre-commit hook will:
- ✅ Block commits with HIGH severity conflicts
- ⚠️ Warn about MEDIUM severity conflicts
- 📊 Show conflict summary and recommendations
- 🚫 Allow bypass with `git commit --no-verify` (not recommended)

### ESLint Configuration
```javascript
// Add to your eslint.config.js
module.exports = {
  extends: [
    './.claude-skills/detect-competing-systems/integration/eslint-config.js'
  ]
}
```

Custom ESLint rules:
- `custom/no-competing-stores` - Detect duplicate store patterns
- `custom/no-duplicate-composables` - Find similar composables
- `custom/prefer-single-fetch-pattern` - Prevent duplicate data fetching
- `custom/consistent-reactive-patterns` - Enforce consistent reactivity

### GitHub Actions
```yaml
# Add to .github/workflows/competing-systems.yml
name: Detect Competing Systems
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run competing systems analysis
        run: node .claude-skills/detect-competing-systems/analysis-engine.js
```

### VS Code Extension
Install the provided VS Code extension for:
- 🎨 Real-time conflict highlighting
- 📊 Conflict details panel
- ⚡ Quick-fix suggestions
- 🔍 Workspace-wide analysis

## 📚 Documentation Structure

```
docs/
├── README.md                    # This file
├── CONFIGURATION.md             # How to customize detection
├── TROUBLESHOOTING.md           # Common issues and solutions
├── EXTENDING.md                 # Adding custom conflict patterns
├── API.md                       # Analysis engine API reference
└── EXAMPLES.md                  # Real-world conflict examples
```

## 🛠️ Advanced Configuration

### Customizing Detection Patterns
Edit `conflict-patterns.json` to:
- Add new conflict categories
- Adjust similarity thresholds
- Modify file patterns
- Update exemption rules

### Example: Adding Custom Pattern
```json
{
  "id": "custom_api_conflicts",
  "name": "API Client Duplication",
  "description": "Multiple API client implementations",
  "severity": "HIGH",
  "detection": {
    "indicators": ["axios", "fetch", "apiClient"],
    "similarityThreshold": 0.80
  }
}
```

### Setting Exemptions
Add intentional patterns to `exemptions.json`:
```json
{
  "name": "adapter_pattern",
  "reason": "Adapter pattern for different APIs",
  "pattern": "Multiple implementations of same interface",
  "condition": "File contains 'Adapter' or implements same interface"
}
```

## 🚨 Conflict Resolution Strategies

### High Priority (Immediate Action)
1. **Duplicate Stores** - Consolidate into single store with computed properties
2. **Side Effects** - Move to single lifecycle owner (usually store)
3. **Form Handling** - Create unified form composable
4. **Async Patterns** - Standardize on async/await

### Medium Priority (Next Sprint)
1. **Component Duplication** - Consolidate with prop/slot configuration
2. **Utility Functions** - Move to shared utilities module
3. **Error Handling** - Implement centralized error service
4. **Validation** - Create shared validation utilities

### Low Priority (Technical Debt)
1. **Naming Conventions** - Establish and enforce naming standards
2. **Constants** - Centralize configuration values
3. **Type Definitions** - Consolidate into single location
4. **Notifications** - Standardize notification system

## 📈 Success Metrics

Track improvements with these metrics:
- **Reduced duplicate code** - Measure similarity reduction
- **Faster development** - Time saved from not reinventing patterns
- **Fewer bugs** - Issues from inconsistent implementations
- **Easier onboarding** - Clearer architecture for new developers
- **Better maintainability** - Single source of truth for common patterns

## 🎯 Best Practices

### Prevention
1. **Code reviews** - Check for duplicate implementations
2. **Architecture guidelines** - Document approved patterns
3. **Pattern libraries** - Maintain approved component/composable libraries
4. **Regular audits** - Schedule periodic conflict detection runs

### Consolidation
1. **Prioritize HIGH severity** - Focus on critical conflicts first
2. **Test thoroughly** - Ensure consolidated implementations work correctly
3. **Update documentation** - Reflect new consolidated patterns
4. **Team communication** - Inform team of pattern standardization

### Maintenance
1. **Run detection regularly** - Integrate into CI/CD pipeline
2. **Update patterns** - Add new conflict types as they emerge
3. **Monitor effectiveness** - Track reduction in duplicate code
4. **Team training** - Ensure team understands approved patterns

## 🔍 Troubleshooting

### Common Issues

**Analysis fails to run:**
- Check Node.js version (requires 20+)
- Verify file permissions
- Check for syntax errors in skill files

**Too many false positives:**
- Adjust similarity threshold in configuration
- Add legitimate patterns to exemptions
- Review file patterns for exclusions

**Performance issues:**
- Increase file size limit
- Add more exclude patterns
- Run analysis on specific directories

**Missing conflicts:**
- Lower similarity threshold
- Check file pattern matches
- Verify code patterns cover your use cases

For detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 🤝 Contributing

### Adding New Conflict Types
1. Define pattern in `conflict-patterns.json`
2. Create example in `examples/` directory
3. Add detection logic to `analysis-engine.js`
4. Update documentation
5. Test with real code samples

### Reporting Issues
- Provide code samples that reproduce the issue
- Include expected vs actual behavior
- Suggest improvements or new conflict types

## 📄 License

This skill is part of the Claude Code skills collection and follows the same license terms.

---

**Version**: 2.0.0
**Last Updated**: 2025-11-28
**Framework Support**: Vue 3.4+, TypeScript 5.0+, Pinia 2.0+
**Project**: Compatible with any Vue 3 + TypeScript project