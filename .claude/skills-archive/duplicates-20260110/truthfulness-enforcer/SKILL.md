# 🛡️ Truthfulness Enforcer

**Purpose**: Force Claude Code instances to be truthful and evidence-based by mandating verification before any claims can be made.

**Location**: managed

**When to Use**:
- Before any technical work on critical systems
- When multiple Claude instances have made false claims
- For rescue operations or mission-critical tasks
- When coordination chaos has been documented

---

## **🎯 Core Functionality**

This skill implements a multi-layered truthfulness enforcement system:

### **Layer 1: Pre-Task Truthfulness Contract**
- Forces Claude to read and acknowledge truthfulness mandate
- Requires explicit acceptance before any work can begin
- Documents history of false claims to establish context
- Sets clear penalties for truthfulness violations

### **Layer 2: Evidence-First Workflow**
- Requires evidence collection before any progress claims
- Mandates specific verification commands for technical work
- Forces exact error counts instead of estimates
- Requires actual build/dev server testing before claims

### **Layer 3: Claim Validation System**
- Validates all claims against verification evidence
- Blocks confident assertions without supporting data
- Requires uncertainty quantification for all estimates
- Cross-references claims with actual system state

### **Layer 4: Documentation Verification**
- Uses existing `/🕵️ evidence-doc` system for verification
- Creates audit trail of all claims and their validation
- Documents false claims patterns
- Maintains history of instance reliability

---

## **🚀 Implementation Strategy**

### **Phase 1: Mandatory Priming**
```markdown
# Step 1: Force Claude to read truthfulness mandate
- Present documented false claims history
- Require explicit acceptance of truthfulness terms
- Establish immediate termination penalty for false claims
- Create psychological barrier against overconfidence

# Step 2: Evidence collection mandate
- Require specific verification commands before any work
- Force exact counts instead of estimates
- Mandate actual testing before functionality claims
- Create structured evidence reporting format
```

### **Phase 2: Runtime Enforcement**
```typescript
interface TruthfulnessEnforcement {
  validateClaim(claim: string): ValidationResult {
    // Blocks confident assertions without evidence
    // Requires specific verification commands
    // Forces uncertainty quantification
    // Returns structured validation result
  }

  requireEvidence(topic: string): EvidenceRequirement {
    // Generates specific evidence requirements
    // Provides exact commands to run
    // Sets expected output format
    // Creates verification checklist
  }
}
```

### **Phase 3: Documentation Integration**
```bash
# Integration with existing evidence-doc system
# Automatic verification of all claims
# Cross-reference with actual system state
# Documentation of truthfulness violations
# Creation of reliability scores
```

---

## **🛡️ Truthfulness Protocol**

### **For Technical Claims:**
1. **MUST run**: `npx vue-tsc --noEmit` before any TypeScript claims
2. **MUST run**: `npm run build` before any build claims
3. **MUST run**: `npm run dev` before any dev server claims
4. **MUST provide**: Exact error counts, not estimates
5. **MUST show**: Actual console outputs, not summaries

### **For Progress Claims:**
1. **MUST include**: Before/after measurements with exact numbers
2. **MUST provide**: Specific file changes with `git diff --stat`
3. **MUST include**: Verification of functionality (screenshots, tests)
4. **MUST quantify**: Exact improvement percentages with calculation
5. **MUST reference**: Evidence files with actual proof

### **For Problem Analysis:**
1. **MUST base**: Analysis on actual verification results
2. **MUST cite**: Specific error messages and line numbers
3. **MUST provide**: Exact counts of issues, not "many/some"
4. **MUST include**: Actual system state, not assumptions
5. **MUST quantify**: Scope of problems with measurements

---

## **⚠️ Prohibited Language Patterns**

### **Forbidden Claims:**
- "Fixed TypeScript errors" (without exact count)
- "Build working" (without actual build output)
- "Dev server ready in X ms" (without actual test)
- "X% improvement" (without before/after data)
- "Should work now" (without verification)
- "Probably fixed" (without testing evidence)

### **Required Evidence Format:**
- "TypeScript errors: 938 → 884 (54 fixed, 5.7% improvement)"
- "Build result: [actual build output with success/failure]"
- "Dev server: [actual startup message or error output]"
- "Evidence: verification files at [specific paths]"
- "Verification: commands run [timestamp] with results"

---

## **🔧 Integration with Existing Systems**

### **Works With:**
- `/🕵️ evidence-doc` command for verification
- Existing documentation structure
- Current verification protocols
- Established evidence collection methods

### **Enhances:**
- Pre-work truthfulness priming
- Runtime claim validation
- Evidence-first workflow enforcement
- False claim detection and documentation

### **Maintains:**
- All existing functionality
- Current documentation systems
- Established workflows
- Existing verification capabilities

---

## **🎯 Success Metrics**

### **Effectiveness Indicators:**
- Reduction in false claims (measured)
- Increase in verified progress (tracked)
- Improved evidence quality (monitored)
- Enhanced coordination reliability (assessed)

### **Quality Standards:**
- 100% of claims have supporting evidence
- 0% false claims accepted
- All progress quantified with exact numbers
- All functionality verified by actual testing

---

## **📊 Implementation Complexity**

| Component | Complexity | Time to Implement | Maintenance |
|-----------|------------|-------------------|-------------|
| Truthfulness Mandate | Low | Immediate | Low |
| Evidence Collection | Medium | 1-2 hours | Low |
| Runtime Enforcement | High | 1 day | Medium |
| Documentation Integration | Low | 2-3 hours | Low |
| Claim Validation | High | 1-2 days | Medium |

---

## **🚀 Immediate Benefits**

1. **Prevents False Claims**: Forces evidence before any claims
2. **Improves Coordination**: Eliminates contradictory information
3. **Enhances Reliability**: All progress is verifiable
4. **Reduces Waste**: No time spent on fabricated progress
5. **Creates Accountability**: Clear audit trail of all claims

---

**This skill addresses the root cause of coordination chaos by forcing truthfulness at the source rather than just detecting false claims after they're made.**

**Research Basis**: Constitutional AI principles, truthfulness research, and documented patterns of AI false claims in technical contexts.

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
