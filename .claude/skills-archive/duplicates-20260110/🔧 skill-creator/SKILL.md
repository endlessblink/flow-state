# Skill Creator

**Purpose**: Automated skill creation and packaging system for rapid skill development.

## 🏭 **Skill Factory**
- Template-based skill generation
- Automated boilerplate creation
- Standardized skill structure
- Metadata generation and validation

## 📝 **Creation Tools**
- Skill template library
- Interactive skill builder
- Code pattern recognition
- Documentation generation

## 📦 **Packaging System**
- Skill dependency management
- Version control integration
- Publication preparation
- Distribution packaging

## 🔧 **Development Workflow**
- Initialize new skill project
- Set up development environment
- Create testing framework
- Generate documentation templates

## ✅ **Validation Features**
- Skill structure validation
- Metadata completeness checks
- Code quality assessment
- Integration testing setup

## 🚀 **Deployment Tools**
- Build automation
- Registry integration
- Version management
- Rollback capabilities

## 🎯 **Templates Available**
- **Debug Skill**: Troubleshooting and issue resolution
- **Analysis Skill**: Code analysis and reporting
- **Utility Skill**: Helper functions and tools
- **Integration Skill**: System integration workflows

## ⚡ **Quick Start**
```bash
# Initialize new skill
skill-creator init my-new-skill

# Generate from template
skill-creator generate --template=analysis --name=code-analyzer

# Package for distribution
skill-creator package --target=production
```

## 🎭 **Triggers**
- New skill development requests
- Skill standardization needs
- Workflow automation requirements
- Development environment setup

---

**Usage**: Create, package, and deploy new skills with automated tooling and standardized templates.

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
