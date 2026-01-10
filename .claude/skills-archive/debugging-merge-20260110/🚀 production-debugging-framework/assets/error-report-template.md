# Error Report Template

## Error Report

**Date:** [YYYY-MM-DD HH:MM]
**Reporter:** [Your Name]
**Project:** Pomo-Flow (Vue 3 + TypeScript + Vite + Pinia)
**Environment:** [Development/Staging/Production]

---

## Error Summary

### Primary Error
- **Type:** [TypeScript compilation / Import resolution / Component reference / Runtime / Build / Linting / Test]
- **Severity:** [Critical / High / Medium / Low]
- **Error Code:** [TS#### or specific error identifier]
- **Location:** [file:line or component name]

### Error Message
```
[Paste complete error message with stack trace]
```

## Context Information

### Recent Changes
- **Dependencies Updated:** [List any package updates]
- **Files Modified:** [List files changed since working state]
- **Configuration Changes:** [Any config file changes]
- **Last Working State:** [Description of when it was working]

### Environment Details
- **Node.js Version:** [e.g., 18.17.0]
- **Vue Version:** [e.g., 3.4.0]
- **TypeScript Version:** [e.g., 5.9.3]
- **Vite Version:** [e.g., 7.1.10]
- **Browser:** [Chrome/Firefox/Safari + version]
- **Operating System:** [Windows/macOS/Linux]

## Error Analysis

### Root Cause Investigation
- **Trigger:** [What specifically triggered this error]
- **Pattern:** [Is this a recurring issue? New pattern?]
- **Impact:** [What functionality is broken]
- **Dependencies:** [Are other systems affected]

### Error Classification
```
□ TypeScript Structural (TS2339, TS2345, TS2322, etc.)
□ Import/Module Resolution (Module not found, path issues)
□ Component Reference (Registration, import/export issues)
□ Runtime Browser (JavaScript errors, undefined properties)
□ Build Process (Vite build failures, bundling issues)
□ Linting/Code Style (ESLint errors, formatting)
□ Test Suite (Unit test failures, integration issues)
□ Performance (Memory leaks, slow rendering)
□ Browser Compatibility (Cross-browser issues)
```

## Debugging Process

### Initial Diagnosis
1. **Validation Commands Run:**
   - [ ] `npm run typecheck` - Result: [pass/fail + details]
   - [ ] `npm run validate:imports` - Result: [pass/fail + details]
   - [ ] `npm run build` - Result: [pass/fail + details]
   - [ ] `npm run test` - Result: [pass/fail + details]
   - [ ] `npm run lint` - Result: [pass/fail + details]

2. **Initial Observations:**
   - [ ] Browser console errors noted
   - [ ] Network tab issues identified
   - [ ] Vue DevTools inspection completed
   - [ ] Component state analyzed

### Systematic Resolution Steps
1. **Phase 1 - Baseline Confirmation:**
   - Working state identified: [Yes/No]
   - Last known good commit: [commit hash or tag]
   - Core functionality status: [working/broken/partial]

2. **Phase 2 - Error Classification:**
   - Error type identified: [specific type]
   - Skill protocol activated: [skill name]
   - Cascading failure detected: [Yes/No]

3. **Phase 3 - Foundation Repair:**
   - Interface updates: [list changes]
   - Type annotations fixed: [list changes]
   - Import resolution: [list changes]
   - Component registration: [list changes]

4. **Phase 4 - Validation:**
   - Typecheck result: [pass/fail]
   - Build result: [pass/fail]
   - Test result: [pass/fail]
   - Runtime validation: [pass/fail]

## Solution Implemented

### Primary Fix
- **Change Type:** [Interface update / Import fix / Component change / Configuration update]
- **Files Modified:** [List all files changed]
- **Code Changes:** [Specific changes made]

```typescript
// Before
[Code before fix]

// After
[Code after fix]
```

### Supporting Changes
- **Configuration:** [Any config file changes]
- **Dependencies:** [Package updates or downgrades]
- **Documentation:** [Documentation updates]

## Verification Results

### Automated Testing
```bash
# Commands executed and results
npm run typecheck          # [Result]
npm run validate:imports   # [Result]
npm run build             # [Result]
npm run test              # [Result]
npm run lint              # [Result]
```

### Manual Testing
- [ ] **Task Creation:** [Working/Not Working]
- [ ] **Canvas Interactions:** [Working/Not Working]
- [ ] **Timer Operations:** [Working/Not Working]
- [ ] **Data Persistence:** [Working/Not Working]
- [ ] **View Switching:** [Working/Not Working]
- [ ] **Browser Compatibility:** [Chrome/Firefox/Safari results]

### Performance Validation
- **Application Load Time:** [e.g., 2.3 seconds]
- **Memory Usage:** [e.g., 45MB steady state]
- **Canvas Performance:** [Responsive/Sluggish]
- **IndexedDB Operations:** [Fast/Slow]

## Post-Follow-up

### Prevention Measures
- **Code Review:** [What to check in future code reviews]
- **Testing Strategy:** [Additional tests needed]
- **Documentation:** [Docs to update]
- **Process Improvement:** [Process changes to prevent recurrence]

### Knowledge Transfer
- **Team Notification:** [Email/Slack message sent]
- **Documentation Updated:** [Link to updated docs]
- **Pattern Recorded:** [New pattern added to knowledge base]
- **Related Issues:** [Any related issues to address]

## Metrics

### Time Tracking
- **Error Detection:** [Time spent identifying the issue]
- **Analysis Phase:** [Time spent analyzing the problem]
- **Implementation:** [Time spent implementing the fix]
- **Validation:** [Time spent testing the fix]
- **Total Resolution Time:** [Total time from detection to resolution]

### Impact Assessment
- **Development Blockers:** [Hours/Days of blocked work]
- **User Impact:** [Number of users affected, if production]
- **Functionality Loss:** [What capabilities were lost]
- **Data Integrity:** [Any data corruption or loss]

## Attachments

### Screenshots
- [Error message screenshot]
- [Browser console screenshot]
- [Vue DevTools screenshot]
- [Build output screenshot]

### Logs
- [Error log file]
- [Build log file]
- [Test output log]

## Follow-up Actions

### Immediate
- [ ] **Commit Fix:** [Commit message and hash]
- [ ] **Tag Release:** [Version tag if applicable]
- [ ] **Deploy:** [Deployment status]
- [ ] **Monitor:** [Post-deployment monitoring]

### Future
- [ ] **Technical Debt:** [Any tech debt created]
- [ ] **Refactoring:** [Planned refactoring]
- [ ] **Testing:** [Additional test coverage needed]
- [ ] **Documentation:** [Documentation improvements]

---

**Report Status:** [Open/In Progress/Resolved]
**Resolution Date:** [YYYY-MM-DD HH:MM]
**Resolver:** [Your Name]

**Next Review Date:** [YYYY-MM-DD]
**Review Required:** [Yes/No]