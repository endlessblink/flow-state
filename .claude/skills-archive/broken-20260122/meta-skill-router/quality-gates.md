# Quality Gates System

## Overview

The Quality Gates system enforces mandatory testing and verification steps before certain actions can be completed. This ensures that features are properly tested and verified before being claimed as working or deployed.

## Mandatory Quality Gates

### 1. Before Success Claim Gates

**Trigger Patterns:**
- "claim.*works"
- "claim.*done"
- "claim.*ready"
- "ready.*production"
- "done.*"
- "finished.*"
- "complete.*"

**Required Skills:**
1. `qa-testing` - Validate application functionality with Playwright
2. `qa-verify` - Mandatory verification protocol

**Description:** Prevents false claims of success without proper testing and visual confirmation.

### 2. Before Deployment Gates

**Trigger Patterns:**
- "deploy.*"
- "merge.*"
- "release.*"
- "ship.*"
- "publish.*"

**Required Skills:**
1. `qa-testing` - Full application testing
2. `qa-verify` - Final verification

**Description:** Ensures application is thoroughly tested before any deployment or release actions.

### 3. After Feature Change Gates

**Trigger Patterns:**
- "feature.*"
- "implement.*"
- "add.*feature"
- "new.*feature"
- "build.*"

**Required Skills:**
1. `qa-testing` - Validate new feature functionality

**Description:** Automatically triggers testing after feature implementation to prevent regressions.

### 4. After Bug Fix Gates

**Trigger Patterns:**
- "fix.*bug"
- "bug.*fix"
- "resolve.*issue"
- "patch.*"

**Required Skills:**
1. `qa-testing` - Validate bug fix
2. `qa-verify` - Confirm fix works

**Description:** Ensures bug fixes are properly tested and verified before claiming resolution.

## Gate Enforcement Logic

### Gate Trigger Detection

```typescript
function checkQualityGates(userInput: string): QualityGateResult {
  const normalizedInput = userInput.toLowerCase()

  for (const [gateName, gate] of Object.entries(MANDATORY_GATES)) {
    for (const trigger of gate.triggers) {
      const regex = new RegExp(trigger, 'i')
      if (regex.test(normalizedInput)) {
        return {
          gateName,
          triggered: true,
          requiredSkills: gate.requiredSkills,
          description: gate.description,
          canProceed: false // Must complete gates first
        }
      }
    }
  }

  return { gateName: null, triggered: false, requiredSkills: [], canProceed: true }
}
```

### Gate Completion Tracking

```typescript
interface GateCompletion {
  gateName: string
  skillName: string
  completedAt: Date
  sessionId: string
  results: any
}

class QualityGateManager {
  private activeGates: Map<string, GateCompletion[]> = new Map()

  public startGateSequence(gateName: string, requiredSkills: string[]): string {
    const sessionId = generateSessionId()
    this.activeGates.set(sessionId, [])

    console.log(`🔒 Quality Gate "${gateName}" activated`)
    console.log(`Required skills: ${requiredSkills.join(' → ')}`)

    return sessionId
  }

  public completeSkill(sessionId: string, skillName: string, results: any): boolean {
    const session = this.activeGates.get(sessionId)
    if (!session) return false

    session.push({
      gateName: session[0]?.gateName || 'unknown',
      skillName,
      completedAt: new Date(),
      sessionId,
      results
    })

    console.log(`✅ Gate step completed: ${skillName}`)
    return true
  }

  public isGateSequenceComplete(sessionId: string): boolean {
    const session = this.activeGates.get(sessionId)
    if (!session) return false

    const gateName = session[0]?.gateName
    const requiredSkills = MANDATORY_GATES[gateName]?.requiredSkills || []
    const completedSkills = session.map(s => s.skillName)

    return requiredSkills.every(skill => completedSkills.includes(skill))
  }
}
```

## Gate Workflow Examples

### Example 1: Bug Fix Workflow
```
User: "I fixed the timer bug, it works now"

Router Analysis:
├── Input matches: "fix.*bug" + "works.*now"
├── Triggered Gates: After Bug Fix + Before Success Claim
└── Required Skills: [qa-testing, qa-verify]

Workflow:
1. 🔒 Activate "Bug Fix Quality Gate"
2. 🚀 Route to "qa-testing" skill
   - Test timer functionality
   - Verify no regressions
   - Check console for errors
3. ✅ Complete testing step
4. 🚀 Route to "qa-verify" skill
   - Visual confirmation in Playwright
   - Real data verification
   - Cross-view validation
5. ✅ Complete verification step
6. 🔓 All gates satisfied - claim can proceed
```

### Example 2: Feature Development Workflow
```
User: "I implemented drag and drop for the canvas"

Router Analysis:
├── Input matches: "implement.*" + "canvas.*"
├── Triggered Gates: After Feature Change
└── Required Skills: [qa-testing]

Workflow:
1. 🔒 Activate "Feature Development Quality Gate"
2. 🚀 Route to "calendar-canvas-integration" (context-based)
3. 🚀 Route to "qa-testing" (mandatory gate)
   - Test drag and drop functionality
   - Verify canvas interactions
   - Check for performance issues
4. ✅ Complete testing step
5. 🔓 Gate satisfied - feature validated
```

### Example 3: Deployment Workflow
```
User: "The app is ready to deploy"

Router Analysis:
├── Input matches: "ready.*deploy"
├── Triggered Gates: Before Deployment
└── Required Skills: [qa-testing, qa-verify]

Workflow:
1. 🔒 Activate "Deployment Quality Gate"
2. 🚀 Route to "qa-testing"
   - Full application test suite
   - Performance validation
   - Cross-browser testing
3. ✅ Complete testing step
4. 🚀 Route to "qa-verify"
   - Final visual verification
   - Production readiness check
5. ✅ Complete verification step
6. 🔓 All gates satisfied - deployment approved
```

## Gate Bypass Protection

### User Override Limitations

While users can override skill selection with `/skill:{skill-name}`, quality gates **cannot be bypassed**:

```typescript
// ❌ This will NOT work for gate-protected actions
User: "/skill:dev-vue I'm ready to deploy"

Router Response:
"⚠️  Cannot override mandatory quality gates for deployment actions.
Required sequence: qa-testing → qa-verify"

// ✅ This works - user selects skill but respects gates
User: "/skill:qa-testing I need to test before deploying"

Router Response:
"✅ Explicit skill selection: qa-testing
🔒 Deployment quality gate remains active - testing step 1 of 2"
```

### Emergency Bypass (Development Only)

For development emergencies, use `/skip-gates` (only works in development mode):

```typescript
// ⚠️ Emergency bypass - development only
User: "/skip-gates deploy the hotfix"

Router Response:
"🚨 EMERGENCY BYPASS ACTIVATED
⚠️  Quality gates skipped - this should not be used in production
📝 This action will be logged for review
Proceeding with deployment..."
```

## Gate Configuration

### Custom Quality Gates

Add project-specific quality gates to `routing-config.json`:

```json
{
  "mandatoryGates": {
    "beforeApiChange": {
      "triggers": [
        "api.*change",
        "endpoint.*modify",
        "schema.*update"
      ],
      "requiredSkills": [
        "qa-testing",
        "api-documentation-review",
        "backward-compatibility-check"
      ],
      "description": "Mandatory testing and review before API changes"
    }
  }
}
```

### Gate Priority System

Higher priority gates override lower priority gates:

```typescript
const GATE_PRIORITIES = {
  "beforeSuccessClaim": 10,    // Highest priority
  "beforeDeployment": 9,
  "afterBugFix": 8,
  "afterFeatureChange": 7,
  "beforeApiChange": 6         // Lower priority
}
```

## Gate Monitoring and Reporting

### Gate Compliance Metrics

```typescript
interface GateMetrics {
  totalGatesTriggered: number
  gatesCompleted: number
  gatesBypassed: number
  averageCompletionTime: number
  failureRate: number
  skillEffectiveness: Record<string, number>
}

function generateGateReport(): GateMetrics {
  return {
    totalGatesTriggered: 127,
    gatesCompleted: 124,
    gatesBypassed: 3,
    averageCompletionTime: 4.2, // minutes
    failureRate: 0.02, // 2%
    skillEffectiveness: {
      "qa-testing": 0.95,
      "qa-verify": 0.98,
      "qa-audit-ui-ux": 0.87
    }
  }
}
```

### Gate Violation Tracking

```typescript
interface GateViolation {
  timestamp: Date
  user: string
  action: string
  bypassedGates: string[]
  reason: string
  severity: 'low' | 'medium' | 'high'
}

function trackGateViolation(violation: GateViolation): void {
  console.log(`🚨 Gate violation recorded: ${violation.action}`)
  console.log(`Bypassed gates: ${violation.bypassedGates.join(', ')}`)

  // Send to monitoring system
  sendToMonitoring(violation)

  // Update user compliance score
  updateUserCompliance(violation.user, -10)
}
```

## Best Practices

### 1. Gate Design Principles
- **Specific Triggers**: Use precise patterns to avoid false positives
- **Clear Sequences**: Required skills should have logical ordering
- **Minimal Friction**: Gates should be helpful, not hindering

### 2. User Communication
- **Clear Messaging**: Explain why gates are triggered
- **Progress Tracking**: Show completion status
- **Quick Recovery**: Easy recovery from gate failures

### 3. Continuous Improvement
- **Monitor Effectiveness**: Track gate success rates
- **Adjust Patterns**: Refine trigger patterns based on feedback
- **Update Skills**: Ensure required skills remain relevant

---

The Quality Gates system ensures consistent, high-quality development by enforcing mandatory testing and verification steps while providing flexibility for legitimate development workflows.