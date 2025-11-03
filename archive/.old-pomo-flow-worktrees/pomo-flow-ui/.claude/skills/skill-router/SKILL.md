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
- **Testing Required**: Routes to `comprehensive-testing` for feature validation
- **Verification Required**: Routes to `verify-before-claiming` before success claims
- **Audit Required**: Routes to `audit-ui-ux-consistency` for UI changes

### 3. User Override System
- Explicit skill selection when needed
- Bypass routing for specific scenarios
- Learning system for improvement

## Routing Configuration

### Pattern Matching Rules

```typescript
const ROUTING_PATTERNS = {
  // Testing & Quality Assurance
  'test.*': 'comprehensive-testing',
  'verify.*': 'verify-before-claiming',
  'claim.*works': 'verify-before-claiming',
  'validate.*': 'comprehensive-testing',
  'deploy.*': 'comprehensive-testing',

  // Debugging & Fixes
  'fix.*bug': 'comprehensive-debugging',
  'debug.*': 'comprehensive-debugging',
  'broken.*': 'comprehensive-debugging',
  'error.*': 'comprehensive-debugging',
  'issue.*': 'comprehensive-debugging',

  // Performance
  'performance.*': 'optimize-performance',
  'slow.*': 'optimize-performance',
  'optimize.*': 'optimize-performance',
  'speed.*': 'optimize-performance',

  // Vue Development
  'vue.*component': 'vue-development',
  'component.*': 'vue-development',
  'reactive.*': 'vue-development',
  'composable.*': 'vue-development',

  // State Management
  'pinia.*': 'pinia-state-management',
  'store.*': 'pinia-state-management',
  'state.*': 'pinia-state-management',

  // Canvas & UI
  'canvas.*': 'calendar-canvas-integration',
  'drag.*drop': 'calendar-canvas-integration',
  'ui.*consistency': 'audit-ui-ux-consistency',
  'design.*system': 'audit-ui-ux-consistency',

  // Undo/Redo System
  'undo.*redo': 'pomoflow-undo-redo-unification',
  'history.*': 'pomoflow-undo-redo-unification',
  'state.*sync': 'pomoflow-undo-redo-unification',

  // Timer Functionality
  'timer.*': 'fix-timer-bugs',
  'pomodoro.*': 'fix-timer-bugs',
  'session.*': 'fix-timer-bugs',

  // Task Management
  'task.*store': 'fix-task-store',
  'task.*creation': 'fix-task-store',
  'task.*management': 'fix-task-store',

  // Keyboard & Accessibility
  'keyboard.*': 'fix-keyboard-shortcuts',
  'shortcut.*': 'fix-keyboard-shortcuts',
  'accessibility.*': 'fix-keyboard-shortcuts',

  // Port Management
  'port.*': 'port-manager',
  'server.*': 'port-manager',
  'localhost.*': 'port-manager',

  // Planning & Architecture
  'plan.*': 'systematic-planning',
  'architecture.*': 'systematic-planning',
  'refactor.*': 'systematic-planning'
}
```

### Mandatory Quality Gates

```typescript
const MANDATORY_ROUTES = {
  // Before claiming success
  'claim.*works': ['comprehensive-testing', 'verify-before-claiming'],
  'ready.*production': ['comprehensive-testing', 'verify-before-claiming'],
  'done.*': ['comprehensive-testing', 'verify-before-claiming'],
  'finished.*': ['comprehensive-testing', 'verify-before-claiming'],

  // Before deployment
  'deploy.*': ['comprehensive-testing', 'verify-before-claiming'],
  'merge.*': ['comprehensive-testing', 'verify-before-claiming'],
  'release.*': ['comprehensive-testing', 'verify-before-claiming'],

  // After feature changes
  'feature.*': ['comprehensive-testing'],
  'implement.*': ['comprehensive-testing'],
  'add.*feature': ['comprehensive-testing']
}
```

## Usage Examples

### Example 1: Feature Development Workflow
```
User: "I need to add drag and drop for tasks"
Router:
1. Route to 'vue-development' (component implementation)
2. Auto-route to 'calendar-canvas-integration' (drag/drop logic)
3. Force route to 'comprehensive-testing' (validation)
4. Auto-route to 'verify-before-claiming' (quality gate)
```

### Example 2: Bug Fix Workflow
```
User: "The timer isn't working correctly"
Router:
1. Route to 'fix-timer-bugs' (domain-specific debugging)
2. Auto-route to 'comprehensive-testing' (validation)
3. Auto-route to 'verify-before-claiming' (quality gate)
```

### Example 3: Performance Optimization
```
User: "The app is running slow"
Router:
1. Route to 'optimize-performance' (performance analysis)
2. Route to 'comprehensive-debugging' (if needed)
3. Force route to 'comprehensive-testing' (validation)
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
name: comprehensive-testing
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