# Verify Before Claiming - Complete Guide

## 🚨 **CRITICAL SKILL FOR CLAUDE DEVELOPERS**

This skill prevents Claude from making false claims about functionality without proper testing and verification. It enforces evidence-based development and honest reporting.

## 📋 **When Claude Should Use This Skill**

Claude should automatically activate this skill when:
- Making any improvements or changes
- Claiming features work
- Reporting bug fixes
- Making performance claims
- Testing functionality
- Validating changes

## 🔄 **MANDATORY TESTING PROTOCOL**

### Phase 1: Baseline Verification
**ALWAYS verify the current state first:**

```bash
# 1. Check build status
npm run build
# Must pass without errors

# 2. Start application
npm run dev
# Must start successfully

# 3. Verify server responds
curl -s -o /dev/null -w "%{http_code}" http://localhost:5547
# Should return 200
```

### Phase 2: Change Implementation
**Make ONE change at a time:**

```bash
# 1. Make single change
# (Edit one file)

# 2. Test build immediately
npm run build
# Must pass before proceeding

# 3. Fix any errors
# Don't proceed until build works
```

### Phase 3: Functional Testing
**Verify the specific feature works:**

```bash
# 1. Navigate to app
# Use Playwright MCP or browser

# 2. Test the feature
# Only test what was changed

# 3. Check console
# No errors allowed

# 4. Test related features
# Ensure no regression
```

## ❌ **ZERO TOLERANCE VIOLATIONS**

Claude MUST NOT:
- Claim something works without running it
- Make performance claims without benchmarks
- Use phrases like "should work" instead of "works"
- Create tables/metrics without real testing
- Skip build verification
- Make changes without testing them

## ✅ **REQUIRED EVIDENCE**

Before claiming ANY feature works, Claude must provide:

### For Bug Fixes:
- [ ] Build passes (`npm run build`)
- [ ] Before screenshot
- [ ] After screenshot showing fix
- [ ] Console log showing no errors
- [ ] Step-by-step reproduction test

### For Performance Claims:
- [ ] Baseline measurement
- [ ] After measurement
- [ ] Actual numbers provided
- [ ] Screenshots of metrics
- [ ] Reproducible test case

### For New Features:
- [ ] Build passes
- [ ] Feature loads successfully
- [ ] Feature functions correctly
- [ ] No console errors
- [ ] Data persists after refresh

## 📸 **EVIDENCE EXAMPLES**

### ✅ **GOOD Example** (Honest Claim):
```
## Fix InnerHTML Security Issues

### Phase 1: Baseline Verification
- [x] Build status: PASS (npm run build completed successfully)
- [x] Dev server: RUNNING on http://localhost:5547

### Phase 2: Implementation
- [x] Fixed useCopy.ts innerHTML usage
- [x] Fixed errorHandler.ts innerHTML usage (2 locations)
- [x] Fixed CanvasView.vue innerHTML usage (2 locations)
- [x] Build test: PASS after each change

### Phase 3: Testing
- [x] Toast notifications still work (tested manually)
- [x] Error messages display correctly (verified in console)
- [x] Canvas buttons function properly (tested in browser)
- [x] No XSS vulnerabilities (verified with DevTools)

### Phase 4: Claim
**FIXED**: InnerHTML security vulnerabilities eliminated while maintaining full functionality.
```

### ❌ **BAD Example** (False Claim):
```
## Performance Improvements ✅
- Bundle size reduced by 27%
- Memory usage optimized
- All security issues fixed
- Performance monitoring added
- Application is now enterprise-grade
```

## 🚨 **EMERGENCY RECOVERY**

If Claude breaks something:

1. **STOP immediately** - Don't make more changes
2. **Check git status**: `git status`
3. **Revert if needed**: `git checkout HEAD -- [broken files]`
4. **Test baseline**: Ensure original functionality works
5. **Start over**: Make smaller, testable changes

## 🎯 **TRIGGER WORDS FOR AUTO-ACTIVATION**

Claude should automatically use this skill when it hears:
- "improve", "optimize", "fix", "enhance"
- "performance", "speed", "faster", "better"
- "security", "vulnerability", "issue", "bug"
- "works", "functional", "operational", "ready"
- "done", "complete", "finished", "implemented"

## 📊 **APPLICATION SPECIFIC TESTING**

For Pomo-Flow, always test:

### Core Features:
- [ ] Task creation and management
- [ ] Undo/Redo functionality (Ctrl+Z/Ctrl+Y)
- [ ] Pomodoro timer sessions
- [ ] Canvas drag and drop
- [ ] Calendar scheduling
- [ ] Data persistence (IndexedDB)

### Cross-View Sync:
- [ ] Board ↔ Calendar sync
- [ ] Board ↔ Canvas sync
- [ ] Calendar ↔ Canvas sync
- [ ] Changes persist after refresh

### Performance:
- [ ] Application loads under 3 seconds
- [ ] No memory leaks during extended use
- [ ] Smooth animations and transitions
- [ ] Large task lists handle efficiently

## 🔄 **INTEGRATION WITH OTHER SKILLS**

This skill should be used BEFORE:
- `dev-debug-reactivity` - Verify reactivity issues are real
- `fix-pinia-state` - Test store fixes actually work
- `optimize-performance` - Measure before/after optimization
- `test-application-features` - Required evidence before claiming

## 📚 **SKILL FILES**

- **Main Skill**: `.claude/skills/qa-verify/SKILL.md`
- **Documentation**: `.claude/docs/VERIFY-BEFORE-CLAIMING-GUIDE.md`
- **Configuration**: `.claude/config/skills.json` (auto-discovery)

## 💡 **KEY LESSONS**

1. **Test First, Claim Later** - Never the reverse
2. **Evidence or It Didn't Happen** - Screenshots required
3. **One Change at a Time** - Prevents cascading failures
4. **Build Passes or Nothing Works** - Non-negotiable
5. **Honest Over Impressive** - Admit limitations

## 🎖️ **FOR CLAUDE USERS**

When working with Claude on this project, expect:
- ✅ **Honest assessments** - Only what can be verified
- ✅ **Evidence-based claims** - Screenshots and logs provided
- ✅ **Step-by-step testing** - Nothing assumed
- ✅ **Build verification** - Application must compile
- ❌ **False promises** - No exaggerated claims
- ❌ **Assumptions** - Everything tested
- ❌ **Rushed fixes** - Proper testing required

---

**Created**: October 23, 2025
**Purpose**: Prevent false claims and ensure quality development
**Impact**: Transform Claude from "optimistic" to "evidence-based" approach