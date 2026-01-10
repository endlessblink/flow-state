# Storybook Master Skill — Universal Component Documentation & Testing Assistant

## Purpose

Create a skill that seamlessly automates, validates, and enriches Storybook documentation for any modern JavaScript/TypeScript design system or component library. This skill guarantees all present and future UI components stay discoverable, visually documented, and fully tested—bridging dev/design workflows and acting as the single source of component truth.

## Overview

This skill operates in **4 phases** to ensure comprehensive component coverage:

- **Phase 1**: Component Discovery & Inventory
- **Phase 2**: Autodocs & Story Automation
- **Phase 3**: Automated Visual & Interaction Testing
- **Phase 4**: Team Workflow Integration & CI

Each phase includes intelligent automation, validation, and integration with modern development workflows.

## Technology Support

### Supported Frameworks
- **React**: TypeScript (.tsx) and JavaScript (.jsx) components
- **Vue**: Single File Components (.vue)
- **Svelte**: Svelte components (.svelte)
- **Web Components**: Custom elements (.ts, .js)
- **Angular**: Components with proper metadata extraction

### Component Architecture Patterns
- **Atomic Design**: Atoms, Molecules, Organisms, Templates, Pages
- **Feature-based**: Grouped by feature/domain
- **Custom**: Configurable patterns via configuration file

### Testing Integration
- **Visual Testing**: Chromatic, Percy, Storybook Chromatic
- **Accessibility**: axe-core, Storybook accessibility addon
- **E2E Testing**: Playwright, Cypress integration
- **Unit Testing**: Jest, Vitest component test coverage

## Phase 1: Component Discovery & Inventory

### Smart Source Scanning
- **Multi-framework detection**: Automatically identifies component types
- **Pattern-based classification**: Uses folder structures and naming conventions
- **Metadata extraction**: Analyzes prop types, interfaces, and exports
- **Hierarchy mapping**: Builds component relationship graphs

### Inventory Generation
- **Comprehensive mapping**: Tracks all components and their metadata
- **Story status detection**: Identifies existing stories and documentation gaps
- **Design integration**: Links to Figma, Sketch, or other design tools
- **Change tracking**: Monitors component updates and story synchronization

### Output Files
- `storybook-inventory.csv`: Complete component inventory with metadata
- `missing-stories-report.md`: Detailed report of undocumented components
- `component-update-map.json`: Mapping of components to their story status

### Classification Categories
- **Status**: Documented, Missing, Outdated, Draft
- **Priority**: Critical, High, Medium, Low (based on usage and importance)
- **Complexity**: Simple, Moderate, Complex (based on props and variants)
- **Owner**: Code owner, team, or individual responsibility

## Phase 2: Autodocs & Story Automation

### Story Creation & Maintenance
- **CSF3 Generation**: Creates modern Component Story Format 3 stories
- **Prop-driven controls**: Auto-generates controls based on TypeScript interfaces
- **Variant discovery**: Identifies possible component states and variations
- **Documentation blocks**: Auto-generates MDX documentation with examples

### Documentation Synchronization
- **Real-time updates**: Syncs stories when component props change
- **Design token integration**: Connects stories to design system tokens
- **Usage examples**: Suggests common usage patterns and best practices
- **API documentation**: Auto-generates props tables and event documentation

### Component/Design Integration
- **Figma integration**: Links stories to Figma components and design specs
- **Design tokens**: Synchronizes with design system tokens (CSS custom properties, etc.)
- **Variant mapping**: Maps component variants to design system states
- **Accessibility metadata**: Includes ARIA properties and accessibility info

### Automation Features
- **Template-based generation**: Uses configurable templates for consistent stories
- **Intelligent prop analysis**: Analyzes prop types to suggest appropriate controls
- **Event handling**: Auto-generates interaction examples for event handlers
- **Responsive testing**: Creates responsive variants for different screen sizes

## Phase 3: Automated Visual & Interaction Testing

### Visual Test Harness
- **Snapshot testing**: Automatic visual regression testing
- **Cross-browser testing**: Tests across multiple browsers and devices
- **Responsive testing**: Validates components at different breakpoints
- **Theme testing**: Tests components across different themes and modes

### Accessibility & Interaction Coverage
- **Automated a11y testing**: axe-core integration for accessibility compliance
- **Keyboard navigation**: Tests keyboard accessibility and focus management
- **Screen reader testing**: Validates screen reader compatibility
- **Interaction testing**: Automated testing of user interactions

### Test Gap Reporting
- **Coverage analysis**: Identifies untested component states and variants
- **Missing test detection**: Highlights areas needing additional test coverage
- **Visual diff reporting**: Detailed visual regression reports
- **Performance metrics**: Tracks component performance and bundle impact

### Testing Workflows
- **CI integration**: Automated testing in continuous integration
- **PR validation**: Visual diffs for pull requests
- **Baseline management**: Smart baseline updates and management
- **Flake detection**: Identifies and manages flaky visual tests

## Phase 4: Team Workflow Integration & CI

### CI Enforcement
- **Build validation**: Validates story completeness and syntax
- **Coverage enforcement**: Enforces minimum story coverage requirements
- **Quality gates**: Prevents merging undocumented or untested components
- **Automated reports**: Generates coverage and quality reports

### Story/Docs PR Assistant
- **PR comments**: Automatic status updates and suggestions
- **Coverage metrics**: Storybook coverage statistics in PR descriptions
- **Missing components**: Alerts for new components without stories
- **Review assignments**: Automatically assigns reviewers for component changes

### Living Documentation/Inventory
- **Real-time inventory**: Always up-to-date component inventory
- **Coverage dashboard**: Visual dashboard of documentation coverage
- **Team notifications**: Automated notifications for coverage drops
- **Historical tracking**: Tracks coverage trends over time

### Integration Features
- **GitHub Actions**: Native GitHub Actions workflows
- **GitLab CI**: GitLab CI/CD pipeline integration
- **Slack notifications**: Team communication integration
- **Design tool sync**: Automatic sync with design tools

## Configuration

### Configuration File: `.storybook/skill-config.yml`
```yaml
# Component Discovery Settings
discovery:
  component_paths:
    - "src/components/**/*"
    - "lib/components/**/*"
  story_paths:
    - "src/**/*.stories.*"
    - "stories/**/*"
  ignore_patterns:
    - "*.test.*"
    - "*.spec.*"
    - "node_modules/**"

# Framework Detection
frameworks:
  react:
    enabled: true
    extensions: [".tsx", ".jsx"]
    story_pattern: "{component}.stories.{ext}"
  vue:
    enabled: true
    extensions: [".vue"]
    story_pattern: "{component}.stories.{ext}"
  svelte:
    enabled: false
    extensions: [".svelte"]

# Story Generation Settings
generation:
  autodocs: true
  controls: true
  interactions: true
  responsive_variants: true
  accessibility_testing: true
  design_token_integration: true

# Testing Configuration
testing:
  visual_testing:
    enabled: true
    tool: "chromatic" # chromatic, percy, playwright
    browsers: ["chrome", "firefox", "safari"]
    viewports: ["320px", "768px", "1024px", "1440px"]

  accessibility:
    enabled: true
    standards: ["WCAG2.1AA"]
    automatic: true

  coverage:
    minimum_story_coverage: 80
    minimum_variant_coverage: 60
    exclude_patterns:
      - "*.internal.*"

# CI/CD Integration
ci:
  enforce_coverage: true
  fail_on_missing_stories: true
  generate_reports: true
  pr_comments: true
  notification_channels: ["slack", "github"]

# Design Integration
design:
  figma:
    enabled: false
    token: "${FIGMA_TOKEN}"
    team_id: "your-team-id"

  design_tokens:
    enabled: true
    source: "tokens.json"

  link_components: true
```

## Usage Examples

### Basic Usage
```bash
# Generate inventory and missing stories report
python3 scripts/run_storybook_master.py --phase inventory

# Auto-generate missing stories
python3 scripts/run_storybook_master.py --phase generate --auto-fix

# Run visual testing and coverage analysis
python3 scripts/run_storybook_master.py --phase test --coverage

# Full workflow with CI integration
python3 scripts/run_storybook_master.py --full
```

### Advanced Usage
```bash
# Custom configuration
python3 scripts/run_storybook_master.py --config custom-config.yml

# Focus on specific component paths
python3 scripts/run_storybook_master.py --component-paths "src/ui/**"

# Only process Vue components
python3 scripts/run_storybook_master.py --framework vue

# Generate stories for specific component
python3 scripts/run_storybook_master.py --component src/components/Button.tsx
```

### Individual Commands
```bash
# Generate missing stories
python3 scripts/phase1_discovery.py --generate-stories

# Run accessibility audit
python3 scripts/phase3_testing.py --accessibility

# Sync with Figma
python3 scripts/phase2_generation.py --figma-sync

# Generate coverage report
python3 scripts/phase3_testing.py --coverage-report
```

## Reports & Outputs

### Inventory Report
```csv
Component,Path,Framework,HasStory,LastUpdated,Owner,Priority
Button,src/components/Button.tsx,React,Yes,2024-01-15,john,High
Card,src/components/Card.tsx,React,No,2024-01-10,sarah,Medium
Modal,src/components/Modal.tsx,React,Yes,2024-01-12,mike,High
```

### Missing Stories Report
```markdown
# Missing Stories Report

## High Priority
- [ ] `Card.tsx` - Essential UI component
- [ ] `DataTable.tsx` - Complex data display component

## Medium Priority
- [ ] `Avatar.tsx` - User profile component
- [ ] `Tooltip.tsx` - UI enhancement component
```

### Coverage Summary
```json
{
  "total_components": 45,
  "documented_components": 38,
  "coverage_percentage": 84.4,
  "missing_stories": 7,
  "outdated_stories": 3,
  "accessibility_compliance": 92.5
}
```

## Integration with Other Skills

This skill integrates seamlessly with the Claude Code ecosystem:
- **Code Refactoring**: Updates stories during component refactoring
- **Testing**: Coordinates with testing skills for comprehensive coverage
- **Documentation**: Syncs with documentation maintenance skills
- **Code Review**: Provides story coverage feedback in PR reviews

## Success Metrics

### Quantitative Metrics
- **100% component discovery**: All UI components identified and cataloged
- **Zero undocumented components**: Every component has corresponding stories
- **Complete visual coverage**: All component states and variants tested
- **Accessibility compliance**: 100% WCAG compliance for all components

### Qualitative Metrics
- **Developer productivity**: Faster onboarding and component discovery
- **Design alignment**: Perfect sync between design and implementation
- **Team collaboration**: Seamless handoff between design and development
- **Documentation quality**: Comprehensive, accurate, and maintainable docs

## Troubleshooting

### Common Issues
- **Component not detected**: Check configuration patterns and file extensions
- **Story generation fails**: Verify component exports and prop types
- **Visual tests flaky**: Review test environments and baselines
- **CI failures**: Check configuration and dependencies

### Debug Mode
```bash
# Enable detailed logging
python3 scripts/run_storybook_master.py --debug --verbose

# Run specific phases only
python3 scripts/run_storybook_master.py --phases discovery,generation

# Skip testing phase
python3 scripts/run_storybook_master.py --skip testing
```

## Advanced Features

### Custom Story Templates
- **Framework-specific templates**: Tailored templates for React, Vue, etc.
- **Component type templates**: Different templates for different component types
- **Brand-specific styling**: Custom documentation styling and branding
- **Interactive examples**: Rich, interactive story examples

### Performance Optimization
- **Incremental processing**: Only process changed components
- **Parallel generation**: Parallel story generation for large codebases
- **Smart caching**: Intelligent caching of generated content
- **Bundle optimization**: Optimized bundle sizes for generated stories

### Enterprise Features
- **Multi-team support**: Support for multiple teams and projects
- **Permission management**: Fine-grained permissions for different users
- **Audit trails**: Complete audit trails for all changes
- **Compliance reporting**: Compliance reports for enterprise requirements

---

**Version**: 1.0.0
**Author**: Claude Code Skills Team
**Category**: Documentation & Testing
**Last Updated**: 2025-11-24
**Frameworks**: React, Vue, Svelte, Web Components
**Testing**: Chromatic, Percy, Playwright, axe-core

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
