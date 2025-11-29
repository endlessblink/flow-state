---
name: comprehensive-auditor
description: Exhaustive multi-dimensional project auditor covering code, runtime, infrastructure, security, performance, business logic, and human processes across 12 dimensions with confidence-tracked findings and explicit blind spot documentation.
---

# Comprehensive Honest Project Auditor - Maximum Coverage Edition

## Overview

An exhaustive multi-dimensional project auditor that covers **code, runtime behavior, infrastructure, security, performance, business logic, and human processes**. Provides confidence-tracked findings across 12 audit dimensions with explicit blind spot documentation.

## Quick Start

**Natural Language Commands:**
- "Run comprehensive audit on my project"
- "Audit my code for security and performance issues"
- "Check my documentation accuracy and test coverage"
- "Analyze my project's blind spots and confidence levels"

**Slash Commands:**
- `/audit-comprehensive` — Full 12-dimension audit
- `/audit-comprehensive --quick` — Skip slow dimensions (runtime, performance)
- `/audit-dimension security` — Single dimension deep dive
- `/audit-blindspots` — Show only what can't be verified
- `/audit-compare HEAD~10 HEAD` — Compare two states

## Coverage Dimensions (12 Areas)

### Dimension 1: Static Code Analysis (95% confidence)
**What It Checks:**
- Syntax errors, type errors, unused code
- Import/export resolution
- Dead code branches
- Cyclomatic complexity
- Code duplication

**Tools Used:**
- TypeScript compiler (tsc)
- ESLint/Pylint with all rules
- AST parsing for structure analysis
- Dependency graph analysis
- Code coverage report integration

**Blind Spots:**
- Dynamic imports (`import(variable)`)
- Reflection/meta-programming
- Code generation at build time

### Dimension 2: Runtime Behavior Simulation (70% confidence)
**What It Checks:**
- Memory leak patterns via heap snapshots
- Event loop blocking patterns
- Async error propagation paths
- State mutation race conditions
- Resource cleanup verification

**Tools Used:**
- Instrumented test runs with profiling
- Memory profiler snapshots
- Event loop monitoring
- State machine extraction from code

**Blind Spots:**
- Production-specific load patterns
- User-triggered edge cases
- Time-dependent bugs (timing issues)

### Dimension 3: Data Flow & State Management (80% confidence)
**What It Checks:**
- Global state mutations
- Props/state flow in components
- Redux/Zustand store consistency
- Side effect tracking
- State initialization order

**Tools Used:**
- Data flow graph construction
- State machine extraction
- Redux DevTools log analysis
- Component tree mapping

**Blind Spots:**
- User-driven state sequences
- Complex async state interactions

### Dimension 4: API & External Dependencies (65% confidence)
**What It Checks:**
- API endpoint definitions vs usage
- Database schema vs ORM models
- External service configs (Redis, S3, etc.)
- Environment variable usage vs .env files
- Third-party API version compatibility

**Tools Used:**
- API route extraction
- Database schema diffing
- Config file parsing
- Network call detection

**Blind Spots:**
- Live API availability/correctness
- Production database state
- External service rate limits

### Dimension 5: Security Vulnerabilities (60% confidence)
**What It Checks:**
- XSS injection points
- SQL injection patterns
- CSRF token usage
- Authentication/authorization flows
- Secrets in code/config
- Dependency vulnerabilities (CVEs)

**Tools Used:**
- npm audit / Snyk
- CodeQL security queries
- OWASP patterns matching
- Secret scanning (git-secrets)

**Blind Spots:**
- Logic-based auth bypasses
- Novel zero-day exploits
- Social engineering vectors

### Dimension 6: Performance & Scalability (55% confidence)
**What It Checks:**
- Bundle size analysis
- Render performance (React)
- Database query N+1 problems
- Memory allocation patterns
- Network waterfall inefficiencies

**Tools Used:**
- Webpack bundle analyzer
- React Profiler
- Lighthouse CI
- Database query logging

**Blind Spots:**
- Real user performance
- Production load patterns
- Network latency variations

### Dimension 7: Documentation Accuracy (85% confidence)
**What It Checks:**
- README vs actual features
- API docs vs code implementation
- Config examples vs actual config schema
- Architecture diagrams vs code structure
- Inline comments vs actual behavior

**Tools Used:**
- Code-doc cross-reference engine
- Comment staleness detection
- Example code verification

**Blind Spots:**
- Developer intent vs documentation intent
- Future plans documented as current features

### Dimension 8: Test Coverage & Quality (90% confidence)
**What It Checks:**
- Unit test coverage (line, branch, function)
- Integration test presence
- E2E test coverage of critical paths
- Test quality (assertions vs test length)
- Flaky test detection

**Tools Used:**
- Jest/Vitest coverage reports
- Mutation testing (Stryker)
- Test execution history analysis

**Blind Spots:**
- Test correctness (testing wrong behavior)
- Missing edge case tests

### Dimension 9: Infrastructure & Deployment (70% confidence)
**What It Checks:**
- Docker/k8s config correctness
- CI/CD pipeline health
- Environment parity (dev/staging/prod)
- Deployment rollback capability
- Health check endpoints

**Tools Used:**
- Docker config validation
- CI/CD config linting
- Environment variable comparison

**Blind Spots:**
- Production infrastructure state
- Cloud provider quotas/limits
- Network topology issues

### Dimension 10: Accessibility & UX (50% confidence)
**What It Checks:**
- ARIA attributes presence
- Keyboard navigation support
- Color contrast ratios
- Screen reader compatibility
- Mobile responsiveness

**Tools Used:**
- axe-core automated checks
- Lighthouse accessibility score
- Pa11y CI

**Blind Spots:**
- Real user experience with assistive tech
- Cognitive accessibility issues
- Context-dependent UX problems

### Dimension 11: Business Logic Correctness (40% confidence)
**What It Checks:**
- Calculation algorithms vs specs
- State machine transitions vs requirements
- Edge case handling
- Domain rule enforcement
- Data validation completeness

**Tools Used:**
- Property-based testing (fast-check)
- Business rule extraction from tests
- Requirements traceability

**Blind Spots:**
- Undocumented business rules
- Implicit assumptions
- Changing requirements

### Dimension 12: Human Processes & Team Health (30% confidence)
**What It Checks:**
- Code review coverage (% of commits reviewed)
- Documentation update patterns
- Breaking change communication
- Onboarding documentation freshness
- Bus factor analysis (knowledge concentration)

**Tools Used:**
- Git log analysis
- PR review pattern detection
- Contributor activity mapping

**Blind Spots:**
- Team communication quality
- Knowledge transfer effectiveness
- Developer satisfaction

## Execution Workflow

### Phase 1: Parallel Scans (All 12 Dimensions)
```bash
# Run all audits in parallel for speed
python3 .claude/skills/comprehensive-auditor/scripts/run_comprehensive_audit.py --all-dimensions
```

### Phase 2: Cross-Dimension Correlation
```bash
# Find issues that appear across multiple dimensions
python3 .claude/skills/comprehensive-auditor/scripts/correlate_findings.py
```

### Phase 3: Weighted Confidence Scoring
```bash
# Calculate overall project health score
python3 .claude/skills/comprehensive-auditor/scripts/calculate_health_score.py
```

## Core Scripts

### Main Auditor Engine
```bash
# Run full comprehensive audit
python3 scripts/run_comprehensive_audit.py

# Quick audit (skip slow dimensions)
python3 scripts/run_comprehensive_audit.py --quick

# Single dimension
python3 scripts/run_comprehensive_audit.py --dimension security
```

### Individual Dimension Auditors
```bash
# Static code analysis
python3 scripts/auditors/static_code_analyzer.py

# Runtime behavior simulation
python3 scripts/auditors/runtime_behavior_analyzer.py

# Security vulnerability scanning
python3 scripts/auditors/security_scanner.py

# Performance profiling
python3 scripts/auditors/performance_profiler.py
```

## Configuration

Create `.claude/comprehensive-auditor-config.yml`:

```yaml
dimensions:
  static_code: { enabled: true, weight: 0.15 }
  runtime_behavior: { enabled: true, weight: 0.12 }
  data_flow: { enabled: true, weight: 0.10 }
  api_deps: { enabled: true, weight: 0.08 }
  security: { enabled: true, weight: 0.15 }
  performance: { enabled: true, weight: 0.08 }
  documentation: { enabled: true, weight: 0.10 }
  test_coverage: { enabled: true, weight: 0.12 }
  infrastructure: { enabled: true, weight: 0.05 }
  accessibility: { enabled: true, weight: 0.03 }
  business_logic: { enabled: true, weight: 0.01 }
  team_health: { enabled: true, weight: 0.01 }

thresholds:
  high_confidence: 90
  medium_confidence: 70
  low_confidence: 50
  min_overall_health: 75

reporting:
  include_blind_spots: true
  prioritize_cross_dimension: true
  suggest_improvements: true
```

## Report Format

The auditor generates comprehensive reports with:

### Executive Summary
- Overall health score (weighted across 12 dimensions)
- Overall confidence level
- Critical issues requiring immediate attention
- Blind spot documentation

### Dimension Breakdown
- Individual dimension scores and confidence levels
- Specific findings with evidence
- Actionable recommendations
- Known limitations

### Cross-Dimension Findings
- Issues appearing across multiple dimensions
- Prioritized action items
- Risk assessment based on combined evidence

### Blind Spots Analysis
- What cannot be verified
- Confidence limitations
- Recommendations for improving coverage

## Success Metrics

- **Coverage:** 95%+ of verifiable issues detected
- **False Positives:** <5% of findings
- **Blind Spots:** Explicitly documented, reduced over time
- **Actionability:** 100% of findings have clear next steps
- **Trust:** Never claims certainty beyond evidence

## Honest Limitations

**This skill still cannot:**
- Predict future bugs
- Understand business context without tests/docs
- Verify production state without access
- Detect malicious insider threats
- Know what users actually want

**But it CAN:**
- Cover 95%+ of technical verifiable issues
- Explicitly document the remaining 5%
- Provide actionable, prioritized fixes
- Track improvements over time
- Never claim false certainty

## Resources

This skill includes specialized analysis tools and reference materials:

### scripts/
- **run_comprehensive_audit.py** - Main audit orchestrator
- **auditors/** - Individual dimension analyzers
- **correlate_findings.py** - Cross-dimensional analysis
- **calculate_health_score.py** - Weighted scoring system
- **generate_report.py** - Comprehensive report generation

### references/
- **audit_techniques.md** - Detailed audit methodologies
- **security_patterns.md** - Security vulnerability patterns
- **performance_benchmarks.md** - Performance standards and thresholds
- **business_logic_rules.md** - Common business rule patterns

### assets/
- **config_schemas/** - JSON schemas for configuration validation
- **report_templates/** - Template system for different report formats
- **threshold_definitions/** - Default thresholds and benchmarks

## Integration with Existing Tools

This auditor integrates seamlessly with:
- **Document Sync Skill** - For documentation accuracy verification
- **QA Testing** - For test coverage and quality analysis
- **Security Scanner** - For vulnerability detection
- **Performance Profiler** - For runtime performance analysis

## Safety and Performance

- **Parallel Execution** - All dimensions run concurrently for speed
- **Incremental Mode** - Only scan changed files for quick updates
- **Configurable Depth** - Adjust analysis depth based on time constraints
- **Memory Efficient** - Streaming analysis for large codebases
- **Non-Destructive** - Read-only analysis, never modifies code

This is as comprehensive as technically possible while remaining honest about limitations.

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
