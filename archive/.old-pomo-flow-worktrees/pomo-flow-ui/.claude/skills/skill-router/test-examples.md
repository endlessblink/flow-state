# Skill Router Test Examples

## Test Scenarios

This document provides comprehensive test examples to verify the skill router functionality across different scenarios.

## 1. Basic Pattern Matching Tests

### Bug Fix Scenarios
```
Input: "I need to fix the timer bug"
Expected Route: fix-timer-bugs
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing, verify-before-claiming]

Input: "The drag and drop is broken"
Expected Route: calendar-canvas-integration
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing, verify-before-claiming]

Input: "There's an error in the console"
Expected Route: comprehensive-debugging
Expected Confidence: Medium (>0.6)
Expected Gates: [comprehensive-testing, verify-before-claiming]
```

### Feature Development Scenarios
```
Input: "I want to add a new component for the sidebar"
Expected Route: vue-development
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing]

Input: "Implement undo/redo for the canvas"
Expected Route: pomoflow-undo-redo-unification
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing]

Input: "Add keyboard shortcuts for the app"
Expected Route: fix-keyboard-shortcuts
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing]
```

### Performance Scenarios
```
Input: "The app is running slow"
Expected Route: optimize-performance
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing]

Input: "I need to optimize the canvas performance"
Expected Route: optimize-performance
Expected Confidence: High (>0.8)
Expected Gates: [comprehensive-testing]
```

## 2. Context-Aware Routing Tests

### File-Based Context
```
Context:
- User Input: "I need to modify this"
- Current File: "src/components/TimerComponent.vue"

Expected Route: vue-development
Expected Reasoning: ["File context: src/components/TimerComponent.vue matches *.vue"]
Expected Confidence Boost: +0.3

Context:
- User Input: "Update the state management"
- Current File: "src/stores/tasks.ts"

Expected Route: pinia-state-management
Expected Reasoning: ["File context: src/stores/tasks.ts matches */stores/*.ts"]
Expected Confidence Boost: +0.3

Context:
- User Input: "Fix the issue with this file"
- Current File: "src/views/CanvasView.vue"

Expected Route: calendar-canvas-integration
Expected Reasoning: ["File context: src/views/CanvasView.vue matches */canvas/*"]
Expected Confidence Boost: +0.3
```

### View-Based Context
```
Context:
- User Input: "Something is not working"
- Current View: "BoardView"

Expected Route: vue-development
Expected Reasoning: ["View context: BoardView"]
Expected Confidence Boost: +0.25

Context:
- User Input: "I need to add a feature here"
- Current View: "CanvasView"

Expected Route: calendar-canvas-integration
Expected Reasoning: ["View context: CanvasView"]
Expected Confidence Boost: +0.25
```

## 3. Quality Gates Tests

### Success Claim Gates
```
Input: "I fixed the bug, it works now"
Expected Gates Triggered: beforeSuccessClaim, afterBugFix
Expected Required Skills: [comprehensive-testing, verify-before-claiming]
Expected Workflow: [
  "comprehensive-testing",
  "verify-before-claiming"
]

Input: "The feature is done and ready"
Expected Gates Triggered: beforeSuccessClaim, afterFeatureChange
Expected Required Skills: [comprehensive-testing, verify-before-claiming]
Expected Workflow: [
  "comprehensive-testing",
  "verify-before-claiming"
]
```

### Deployment Gates
```
Input: "The app is ready to deploy"
Expected Gates Triggered: beforeDeployment
Expected Required Skills: [comprehensive-testing, verify-before-claiming]
Expected Workflow: [
  "comprehensive-testing",
  "verify-before-claiming"
]

Input: "Let's merge this to main"
Expected Gates Triggered: beforeDeployment
Expected Required Skills: [comprehensive-testing, verify-before-claiming]
Expected Workflow: [
  "comprehensive-testing",
  "verify-before-claiming"
]
```

## 4. User Override Tests

### Explicit Skill Selection
```
Input: "/skill:comprehensive-testing I need to test the timer"
Expected Route: comprehensive-testing
Expected Confidence: 1.0
Expected Reasoning: ["Explicit user override: comprehensive-testing"]
Expected Gates: Respected based on remaining input
Expected User Override: true

Input: "/skill:vue-development Create a new button component"
Expected Route: vue-development
Expected Confidence: 1.0
Expected Reasoning: ["Explicit user override: vue-development"]
Expected Gates: [comprehensive-testing] (from "create new button")
Expected User Override: true
```

### Forced Skill Selection
```
Input: "/force-skill:vue-development Just need a quick fix"
Expected Route: vue-development
Expected Confidence: 1.0
Expected Reasoning: ["Forced skill selection: vue-development", "Non-critical gates bypassed"]
Expected Gates: [] (bypassed)
Expected User Override: true

Input: "/force-skill:comprehensive-testing Deploy this hotfix"
Expected Result: ERROR - Cannot bypass critical deployment gates
Expected Error: "Cannot force override critical quality gates: [comprehensive-testing, verify-before-claiming]"
```

### Emergency Bypass
```
Input: "/skip-gates Deploy this emergency fix"
Expected Result: Allowed (development only)
Expected Route: Based on remaining input "Deploy this emergency fix"
Expected Reasoning: ["🚨 Emergency gate bypass activated", "Pattern matched: deploy.*"]
Expected Gates: [] (all bypassed)
Expected Compliance: Logged for review
Expected User Override: true
```

## 5. Ambiguous Input Tests

### Low Confidence Scenarios
```
Input: "help"
Expected Route: comprehensive-debugging (fallback)
Expected Confidence: Low (<0.5)
Expected Reasoning: ["No confident pattern match found", "Using fallback skill: comprehensive-debugging"]
Expected Alternatives: Multiple suggestions

Input: "update something"
Expected Route: comprehensive-debugging (fallback)
Expected Confidence: Low (<0.5)
Expected Reasoning: ["No confident pattern match found", "Using fallback skill: comprehensive-debugging"]
Expected Alternatives: ["vue-development", "optimize-performance", "comprehensive-testing"]
```

### Multiple Pattern Matches
```
Input: "Fix the performance issue with the timer"
Expected Matches:
- fix-timer-bugs (confidence: 0.8)
- optimize-performance (confidence: 0.8)
- comprehensive-debugging (confidence: 0.6)

Expected Route: optimize-performance (higher priority for performance)
Expected Reasoning: ["Multiple high-confidence matches, selected highest priority"]
Expected Alternatives: ["fix-timer-bugs", "comprehensive-debugging"]
```

## 6. Edge Case Tests

### Empty or Invalid Input
```
Input: ""
Expected Route: comprehensive-debugging (fallback)
Expected Confidence: Low
Expected Reasoning: ["No input provided, using fallback skill"]

Input: "/skill:nonexistent-skill test something"
Expected Result: ERROR - Unknown skill
Expected Error: "Unknown skill: nonexistent-skill"

Input: "/invalid-command test something"
Expected Route: Based on pattern matching for "test something"
Expected Confidence: Normal routing
Expected Reasoning: ["Invalid override command, using normal routing"]
```

### Special Characters and Formatting
```
Input: "Fix the timer!!! It's not working :("
Expected Route: fix-timer-bugs
Expected Confidence: High
Expected Reasoning: ["Matched pattern 'fix.*timer' in timerFunctionality"]

Input: "I need to... um... test the thing?"
Expected Route: comprehensive-testing
Expected Confidence: Medium
Expected Reasoning: ["Matched pattern 'test.*' in testing"]
```

## 7. Integration Tests

### Complex Workflow Scenarios
```
Scenario: Complete Bug Fix Workflow
Step 1 Input: "The timer is broken and shows errors"
Expected Route: fix-timer-bugs
Expected Gates: [comprehensive-testing, verify-before-claiming]

Step 2 Input: "/skill:comprehensive-testing I implemented the fix"
Expected Route: comprehensive-testing
Expected Gates: Still active from step 1

Step 3 Input: "The timer works perfectly now"
Expected Route: verify-before-claiming (gate triggered)
Expected Gates: [verify-before-claiming] (testing completed)

Step 4 Input: "Ready to deploy the timer fix"
Expected Route: comprehensive-testing (new gate triggered)
Expected Gates: [comprehensive-testing, verify-before-claiming]
```

### Context Switching
```
Context:
- User Input: "Fix this issue"
- Current File: "src/components/TimerComponent.vue"

Expected Route: fix-timer-bugs (context wins over generic debugging)
Expected Reasoning: ["File context: src/components/TimerComponent.vue", "Timer-specific context"]

Switch Context:
- User Input: "Fix this issue"
- Current File: "src/stores/tasks.ts"

Expected Route: fix-task-store (context wins over generic debugging)
Expected Reasoning: ["File context: src/stores/tasks.ts", "Task store context"]
```

## 8. Performance Tests

### Large Input Processing
```
Input: "I need to fix a very complex bug that involves multiple components including the timer component and the task store and also affects the canvas view and it's causing performance issues and the app is running slow and users are complaining about it and it's urgent and I need to deploy a fix as soon as possible"

Expected Route: optimize-performance (highest confidence from multiple patterns)
Expected Confidence: High
Expected Processing Time: <100ms
Expected Reasoning: ["Multiple patterns detected, selected highest confidence", "Performance patterns weighted higher"]
```

### Rapid Successive Requests
```
Test: 100 rapid routing requests
Expected Behavior: All requests processed successfully
Expected Average Response Time: <50ms
Expected Memory Usage: Stable
Expected Error Rate: 0%
```

## 9. Learning System Tests

### Preference Learning
```
User History:
- Week 1: Always selects "/skill:comprehensive-testing" for "test" inputs
- Week 2: Router starts suggesting comprehensive-testing for "test" inputs
- Week 3: Confidence increases for learned suggestions

Expected Behavior:
- System learns user preferences
- Suggestions improve over time
- Confidence scores reflect learning
```

## 10. Error Handling Tests

### Configuration Errors
```
Scenario: Invalid routing configuration
Expected Behavior: Graceful fallback to default routing
Expected Error Handling: Clear error messages, continue operation
Expected Fallback Route: comprehensive-debugging

Scenario: Missing skill files
Expected Behavior: Router detects missing skills and provides alternatives
Expected Error Handling: Inform user about unavailable skills
Expected Fallback Route: comprehensive-debugging
```

### Runtime Errors
```
Scenario: Pattern matching regex error
Expected Behavior: Skip problematic pattern, continue with others
Expected Error Handling: Log error, continue routing
Expected Fallback Route: comprehensive-debugging

Scenario: Context analysis error
Expected Behavior: Proceed without context analysis
Expected Error Handling: Log error, use pattern matching only
Expected Expected Route: Based on patterns only
```

## Test Execution

### Automated Test Suite
```bash
# Run all router tests
npm run test:router

# Run specific test categories
npm run test:router -- --category=pattern-matching
npm run test:router -- --category=quality-gates
npm run test:router -- --category=user-overrides

# Run performance tests
npm run test:router -- --performance

# Run integration tests
npm run test:router -- --integration
```

### Manual Testing Checklist
- [ ] All basic pattern matching scenarios work
- [ ] Context-aware routing functions correctly
- [ ] Quality gates trigger appropriately
- [ ] User overrides work as expected
- [ ] Ambiguous inputs handled gracefully
- [ ] Edge cases don't crash the system
- [ ] Performance remains acceptable
- [ ] Learning system improves suggestions
- [ ] Error handling is robust
- [ ] Integration with skill system works

---

These test examples ensure the skill router functions reliably across all scenarios and maintains the quality standards required for the Pomo-Flow development workflow.