# Legacy Tech Remover Skill — Automated Audit & Clean-up

## Purpose

Provide a safe, automated method to audit your entire codebase for **abandoned/dead libraries, legacy tech stacks, and deprecated development directions**. Generate actionable removal and migration plans with integrated Claude Code skill automation.

## Overview

This skill operates in **4 phases** to safely identify, assess, remove, and document legacy technology:

- **Phase 1**: Legacy Detection & Inventory
- **Phase 2**: Impact Assessment & Safe Removal Planning
- **Phase 3**: Execution Automation via Skills Integration
- **Phase 4**: Documentation & Team Communication

Each phase includes safety checks, risk scoring, and rollback capabilities to ensure zero production impact.

## Technology Detection

### Supported Languages & Frameworks
- **JavaScript/TypeScript**: npm, yarn, pnpm packages, Node.js modules
- **Python**: pip packages, requirements.txt, pyproject.toml
- **Java**: Maven, Gradle dependencies
- **Ruby**: Bundler gems
- **PHP**: Composer packages
- **Go**: Go modules
- **Rust**: Cargo crates

### Legacy Technology Patterns
- **Deprecated Libraries**: Libraries unmaintained >18 months
- **Dead Frameworks**: AngularJS, jQuery, Grunt, Gulp, TravisCI
- **Abandoned Patterns**: MVC, Flux, legacy build systems
- **Orphaned Directories**: `old/`, `legacy/`, `v1/`, `bak/`

## Phase 1: Legacy Detection & Inventory

### Capabilities
- **Dependency Analysis**: Scan package managers for unused/abandoned libraries
- **Directory Analysis**: Identify orphaned source trees and dead folders
- **Pattern Detection**: Find deprecated architectural patterns
- **Git History**: Analyze last touched dates relative to project activity
- **Usage Scanning**: Cross-reference imports and require statements

### Output Files
- `legacy-inventory.csv`: Complete inventory with risk scores
- `legacy-directories.tree`: Hierarchical view of removal candidates
- `legacy-dependencies.json`: Dependency graph analysis

### Safety Features
- Cross-verification across multiple detection methods
- Conservative risk scoring to prevent false positives
- Protection for core dependencies and production libraries

## Phase 2: Impact Assessment & Risk Analysis

### Risk Categories
- **🟢 SAFE**: Zero usage, safe for immediate removal
- **🟡 CAUTION**: Low/uncertain usage, manual review recommended
- **🔴 RISKY**: Possible indirect use, migration required

### Analysis Features
- **Dependency Graph**: Full dependency impact analysis
- **Import Tracking**: Cross-file usage analysis
- **Test Coverage**: Check if legacy code is covered by tests
- **Build Impact**: Verify removal won't break builds
- **Migration Path**: Suggest modern replacements where applicable

### Planning Tools
- **Stepwise Action Plan**: Ordered by risk level
- **Skill Linking**: Automatically links to appropriate Claude Code skills
- **Rollback Planning**: Pre-calculated rollback strategies
- **Batch Processing**: Group safe removals for efficiency

## Phase 3: Execution Automation

### Skill Integration
Automatically links to existing Claude Code skills:
- `/skill-remove-library` - Package removal automation
- `/skill-code-folder-remove` - Safe directory removal
- `/skill-config-cleanup` - Configuration file cleanup
- `/skill-request-code-review` - Manual review assignments

### Execution Modes
- **🔍 DRY RUN**: Preview mode with detailed reports, no changes
- **⚡ BATCH EXECUTION**: Automated removal of safe items
- **👨‍💻 MANUAL REVIEW**: Interactive review of risky items
- **📊 VALIDATION**: Post-execution verification

### Safety Mechanisms
- **Git Commits**: Automatic commits after each action for rollback
- **Build Verification**: Ensure builds/tests pass after batch changes
- **Dependency Validation**: Verify no broken references remain
- **Rollback Commands**: One-click revert for any action

## Phase 4: Documentation & Communication

### Documentation Updates
- **Migration Log**: Complete record of all changes
- **Onboarding Updates**: Remove legacy references from docs
- **Architecture Updates**: Update system documentation
- **API Documentation**: Remove deprecated endpoints/features

### Team Communication
- **Pull Request**: Automated PR with change summary
- **Migration Guide**: Step-by-step migration notes
- **Team Notifications**: Automated announcements to dev channels
- **Knowledge Transfer**: Documentation for new maintainers

## Configuration

### Configuration File: `.claude/legacy-remover-config.yml`
```yaml
# Detection Settings
min_years_untouched: 2
safe_folder_patterns:
  - "^src/legacy/"
  - "^old/"
  - "^bak/"
  - "^deprecated/"

# Protected Packages (never remove)
protected_packages:
  - "core-js"
  - "typescript"
  - "react"
  - "vue"

# Risk Thresholds
risk_thresholds:
  safe_removal: 0.2
  caution_zone: 0.6
  risky_removal: 0.8

# Skill Mappings
custom_skills_phase:
  library_removal: "/skill-remove-library"
  folder_removal: "/skill-code-folder-remove"
  config_cleanup: "/skill-config-cleanup"
  code_review: "/skill-request-code-review"

# Git Settings
git:
  auto_commit: true
  commit_prefix: "[legacy-removal]"
  create_backup_branch: true

# Execution Settings
execution:
  default_mode: "dry-run"
  batch_size: 5
  validate_after_batch: true
```

## Usage Examples

### Basic Usage
```bash
# Full legacy audit and removal plan
python3 scripts/run_legacy_removal.py --full-audit

# Only phase 1: Detection and inventory
python3 scripts/phase1_detection.py --output-dir ./reports

# Dry run of removal plan
python3 scripts/phase3_execution.py --dry-run --plan ./reports/removal_plan.json

# Execute safe removals only
python3 scripts/phase3_execution.py --safe-only --auto-commit
```

### Advanced Usage
```bash
# Custom configuration
python3 scripts/run_legacy_removal.py --config ./custom-config.yml

# Focus on specific areas
python3 scripts/phase1_detection.py --focus dependencies,dirs

# Include specific skill integration
python3 scripts/phase3_execution.py --skill-map ./custom_skills.json

# Generate migration documentation
python3 scripts/phase4_documentation.py --template enterprise
```

## Reports & Outputs

### Legacy Inventory Report
```csv
Type,Path,Last Reference,Risk Score,Suggested Action,Linked Skill
Library,deprecated-lib,v1.2.3 (2021-05),0.1,Remove,/skill-remove-library
Directory,src/old-api,2022-01,0.05,Remove,/skill-code-folder-remove
File,utils/legacy.js,2023-03,0.6,Review,/skill-request-code-review
```

### Removal Plan Summary
```
Phase 1: Safe Library Removals (8 items, ~2.3MB reduction)
Phase 2: Dead Directory Cleanup (12 directories, ~15MB reduction)
Phase 3: Code Review Required (5 files, manual assessment)
Phase 4: Migration Projects (3 major upgrades needed)
```

### Team Communication Template
```markdown
## Legacy Tech Removal — {date}

### Summary
- **Removed**: {count} libraries and {size} of legacy code
- **Impact**: Zero production issues, builds passing
- **Migration**: {migration_count} upgrades completed

### Changes
- [x] Removed deprecated libraries: {library_list}
- [x] Cleaned up dead directories: {directory_list}
- [x] Updated configuration files: {config_list}
- [x] Documentation updated: {doc_updates}

### Rollback
All changes are committed with messages prefixed `[legacy-removal]`
Use `git revert <commit_hash>` to rollback any specific changes

### Migration Guide
See `migration-log.md` for detailed migration notes and compatibility information
```

## Success Metrics

### Quantitative Metrics
- **Zero Production Outages**: No incidents from legacy removals
- **Complete Cleanup**: 100% of unused libraries and folders removed
- **Build Performance**: Improved build times after cleanup
- **Bundle Size**: Reduced bundle sizes and dependencies

### Qualitative Metrics
- **Team Clarity**: Reduced confusion from legacy code
- **Developer Experience**: Cleaner, more maintainable codebase
- **Onboarding**: Easier for new developers to understand architecture
- **Documentation**: Up-to-date and accurate documentation

## Safety & Rollback

### Safety Checks
- **Pre-execution Validation**: Verify all dependencies and imports
- **Build Verification**: Ensure builds/tests pass after changes
- **Cross-reference Validation**: Multiple verification methods
- **Manual Review Required**: Risky items always require human approval

### Rollback Strategies
- **Git Commits**: Each action committed separately for granular rollback
- **Backup Branch**: Automatic backup branch before execution
- **Migration Logs**: Complete audit trail of all changes
- **One-click Commands**: Pre-calculated rollback commands

## Troubleshooting

### Common Issues
- **False Positives**: Adjust risk thresholds in configuration
- **Build Failures**: Use rollback commands and review dependency graph
- **Permission Issues**: Ensure proper Git and filesystem permissions
- **Missing Skills**: Verify all required Claude Code skills are installed

### Debug Mode
```bash
# Enable detailed logging
python3 scripts/run_legacy_removal.py --debug --verbose

# Skip specific phases
python3 scripts/run_legacy_removal.py --skip-phase 3

# Force analysis of specific paths
python3 scripts/phase1_detection.py --force-paths src/legacy,old-code
```

## Integration with Other Skills

This skill integrates seamlessly with the Claude Code ecosystem:
- **Document Sync**: Updates documentation after removals
- **Code Refactoring**: Helps migrate from legacy to modern patterns
- **Security Auditor**: Removes vulnerable legacy dependencies
- **Performance Profiler**: Eliminates performance-impacting legacy code

---

**Version**: 1.0.0
**Author**: Claude Code Skills Team
**Category**: Code Maintenance & Refactoring
**Last Updated**: 2025-11-24

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
