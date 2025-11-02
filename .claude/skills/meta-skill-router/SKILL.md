---
name: Skill Router
description: Intelligent skill selection system that automatically routes to appropriate skills based on user intent, context, and project requirements. Enforces quality gates and optimizes development workflow.
---

# Skill Router

## Overview

The Skill Router is an intelligent system that automatically selects the most appropriate skill based on user input, project context, and established quality requirements. It eliminates the need to manually choose from 27+ specialized skills while enforcing mandatory quality gates.

## Core Features

### 1. Pattern-Based Routing
- Matches user intent using regex patterns
- Context-aware skill selection
- Automatic workflow chaining

### 2. Mandatory Quality Gates
- **Testing Required**: Routes to `qa-testing` for feature validation
- **Verification Required**: Routes to `qa-verify` before success claims
- **Audit Required**: Routes to `qa-audit-ui-ux` for UI changes

### 3. User Override System
- Explicit skill selection when needed
- Bypass routing for specific scenarios
- Learning system for improvement

## Routing Configuration

### Pattern Matching Rules

```typescript
const ROUTING_PATTERNS = {
  // Testing & Quality Assurance
  'test.*': 'qa-testing',
  'verify.*': 'qa-verify',
  'claim.*works': 'qa-verify',
  'validate.*': 'qa-testing',
  'deploy.*': 'qa-testing',

  // Debugging & Fixes
  'fix.*bug': 'comprehensive-debugging',
  'debug.*': 'comprehensive-debugging',
  'broken.*': 'comprehensive-debugging',
  'error.*': 'comprehensive-debugging',
  'issue.*': 'comprehensive-debugging',

  // Performance
  'performance.*': 'dev-optimize-performance',
  'slow.*': 'dev-optimize-performance',
  'optimize.*': 'dev-optimize-performance',
  'speed.*': 'dev-optimize-performance',

  // Vue Development
  'vue.*component': 'dev-vue',
  'component.*': 'dev-vue',
  'reactive.*': 'dev-vue',
  'composable.*': 'dev-vue',

  // State Management
  'pinia.*': 'dev-pinia-state',
  'store.*': 'dev-pinia-state',
  'state.*': 'dev-pinia-state',

  // Canvas & UI
  'canvas.*': 'calendar-canvas-integration',
  'drag.*drop': 'calendar-canvas-integration',
  'ui.*consistency': 'qa-audit-ui-ux',
  'design.*system': 'qa-audit-ui-ux',

  // Undo/Redo System
  'undo.*redo': 'dev-undo-redo',
  'history.*': 'dev-undo-redo',
  'state.*sync': 'dev-undo-redo',

  // Timer Functionality
  'timer.*': 'fix-timer-bugs',
  'pomodoro.*': 'fix-timer-bugs',
  'session.*': 'fix-timer-bugs',

  // Task Management
  'task.*store': 'fix-task-store',
  'task.*creation': 'fix-task-store',
  'task.*management': 'fix-task-store',

  // Keyboard & Accessibility
  'keyboard.*': 'dev-fix-keyboard',
  'shortcut.*': 'dev-fix-keyboard',
  'accessibility.*': 'dev-fix-keyboard',

  // Port Management
  'port.*': 'ops-port-manager',
  'server.*': 'ops-port-manager',
  'localhost.*': 'ops-port-manager',

  // Planning & Architecture
  'plan.*': 'arch-planning',
  'architecture.*': 'arch-planning',
  'refactor.*': 'arch-planning'
}
```

### Mandatory Quality Gates

```typescript
const MANDATORY_ROUTES = {
  // Before claiming success
  'claim.*works': ['qa-testing', 'qa-verify'],
  'ready.*production': ['qa-testing', 'qa-verify'],
  'done.*': ['qa-testing', 'qa-verify'],
  'finished.*': ['qa-testing', 'qa-verify'],

  // Before deployment
  'deploy.*': ['qa-testing', 'qa-verify'],
  'merge.*': ['qa-testing', 'qa-verify'],
  'release.*': ['qa-testing', 'qa-verify'],

  // After feature changes
  'feature.*': ['qa-testing'],
  'implement.*': ['qa-testing'],
  'add.*feature': ['qa-testing']
}
```

## Usage Examples

### Example 1: Feature Development Workflow
```
User: "I need to add drag and drop for tasks"
Router:
1. Route to 'dev-vue' (component implementation)
2. Auto-route to 'calendar-canvas-integration' (drag/drop logic)
3. Force route to 'qa-testing' (validation)
4. Auto-route to 'qa-verify' (quality gate)
```

### Example 2: Bug Fix Workflow
```
User: "The timer isn't working correctly"
Router:
1. Route to 'fix-timer-bugs' (domain-specific debugging)
2. Auto-route to 'qa-testing' (validation)
3. Auto-route to 'qa-verify' (quality gate)
```

### Example 3: Performance Optimization
```
User: "The app is running slow"
Router:
1. Route to 'dev-optimize-performance' (performance analysis)
2. Route to 'comprehensive-debugging' (if needed)
3. Force route to 'qa-testing' (validation)
```

## Router Logic

### 1. Intent Analysis
- Parse user input for key phrases and patterns
- Analyze project context (file changes, current view, etc.)
- Identify domain-specific requirements

### 2. Pattern Matching
- Match against routing patterns in priority order
- Handle multiple pattern matches with confidence scoring
- Select highest confidence skill route

### 3. Quality Gate Enforcement
- Check if mandatory gates apply to the request
- Chain required skills in correct order
- Prevent bypassing critical quality steps

### 4. User Override Handling
- Allow explicit skill selection with `/skill:skill-name` syntax
- Remember user preferences for similar requests
- Provide feedback on routing decisions

## Configuration

### Custom Routing Rules
Add project-specific patterns to `.claude/skill-router/config.json`:

```json
{
  "customPatterns": {
    "custom.*feature": "custom-skill-name",
    "specific.*bug": "specific-debug-skill"
  },
  "mandatoryGates": {
    "critical.*feature": ["testing", "security-review", "code-review"]
  },
  "userOverrides": {
    "allowExplicitSelection": true,
    "rememberPreferences": true
  }
}
```

### Skill Metadata
Each skill can provide routing metadata:

```yaml
---
name: qa-testing
description: Validate application functionality
routing:
  patterns:
    - 'test.*'
    - 'validate.*'
    - 'verify.*'
  mandatoryFor:
    - 'feature.*'
    - 'bug.*fix'
    - 'deploy.*'
  priority: 10
  context: ['vue', 'component', 'feature']
---
```

## Implementation Details

### Router Architecture
```
User Input → Intent Analysis → Pattern Matching → Quality Gates → Skill Selection
     ↓              ↓                ↓                ↓              ↓
Context Analysis  → Scoring System  → Chain Builder → Override Check → Execution
```

### Error Handling
- Fallback to general-purpose debugging skill
- Request clarification for ambiguous requests
- Provide skill suggestions when routing fails

### Performance Considerations
- Cache pattern matching results
- Lazy load skill metadata
- Optimize for common routing patterns

## Benefits

### 1. Improved Development Velocity
- No need to remember all skill names
- Automatic quality gate enforcement
- Consistent workflow across team

### 2. Quality Assurance
- Mandatory testing for all changes
- Verification before claiming success
- Consistent application of best practices

### 3. Reduced Cognitive Load
- Natural language skill selection
- Automatic workflow chaining
- Clear guidance on next steps

### 4. Scalability
- Easy to add new skills and patterns
- Adaptive routing based on usage
- Project-specific customization

## Troubleshooting

### Common Issues
- **Router selects wrong skill**: Check pattern priority and specificity
- **Mandatory gates not firing**: Verify pattern matching for gate triggers
- **User override not working**: Ensure override syntax is correct

### Debug Mode
Enable routing diagnostics with `ROUTER_DEBUG=true` environment variable to see:
- Pattern matching scores
- Routing decision process
- Quality gate application

## Future Enhancements

### 1. Machine Learning Integration
- Learn from user routing corrections
- Improve pattern matching based on usage
- Predict skill needs based on context

### 2. Advanced Context Analysis
- Git integration for change-based routing
- File system analysis for context awareness
- Team workflow integration

### 3. Custom Router Creation
- Project-specific router templates
- Team-based routing configurations
- Integration with external tools

---

The Skill Router transforms the development experience by making skill selection intelligent, automatic, and consistent while maintaining the flexibility for expert users to override when needed.