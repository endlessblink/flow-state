# Verify Before Claiming Skill

## Purpose
Prevents Claude from making false claims about functionality working without proper testing and verification.

## Mandatory Protocol
ALWAYS follow this sequence before claiming ANY feature works:

### Phase 1: Baseline Verification
1. **Start Application**: Run `npm run dev`
2. **Verify Server Running**: Check dev server starts successfully
3. **Verify Build Works**: Run `npm run build` - must pass without errors
4. **Take Baseline Screenshot**: Use Playwright MCP to capture initial state

### Phase 2: Change Implementation
1. **Make ONE Change**: Only one small change at a time
2. **Immediate Build Test**: Run `npm run build` after every single change
3. **Fix Build Errors**: If build fails, fix before proceeding
4. **Check Console**: Monitor for any console errors

### Phase 3: Functional Testing
1. **Navigate to Application**: Use Playwright MCP to go to the running app
2. **Take Screenshot**: Capture state before testing
3. **Test the Specific Feature**: Only test what was changed
4. **Take After Screenshot**: Capture state after testing
5. **Check Console**: Ensure no errors during testing

### Phase 4: Cross-View Verification
1. **Test in Multiple Views**: Verify changes work across different app views
2. **Test Data Persistence**: Refresh page and verify changes persist
3. **Test Related Features**: Ensure no regression in related functionality

## ZERO TOLERANCE VIOLATIONS
- ❌ Claiming something works without running it
- ❌ Making performance claims without benchmarks
- ❌ Saying "should work" instead of "does work"
- ❌ Creating tables and metrics without real testing
- ❌ Skipping build verification
- ❌ Making changes without testing them

## Required Evidence Before Any Claim
For each claim, you MUST provide:
- ✅ **Build Status**: `npm run build` passes
- ✅ **Screenshot**: Before/after visual proof
- ✅ **Console Log**: No errors shown
- ✅ **Functionality**: Actual feature working
- ✅ **Data Persistence**: Changes survive refresh

## Forbidden Phrases
- "This should work" → "This works" (after testing)
- "I expect this to improve performance" → "This improves performance by X%" (after measurement)
- "The architecture is better" → "The architecture is better because..." (with specific proof)
- "No errors detected" → "No errors in console (verified with screenshots)"

## Testing Templates

### Before Making Changes
```bash
# 1. Verify baseline works
npm run build  # Must pass
npm run dev     # Must start
# Take baseline screenshot
```

### After Making Changes
```bash
# 1. Build test
npm run build  # Must pass
if [ $? -ne 0 ]; then echo "BUILD FAILED - CANNOT CLAIM ANYTHING WORKS"; exit 1; fi

# 2. Test with Playwright
# Navigate to app
# Take screenshot
# Test feature
# Take screenshot
# Check console

# 3. Only then make claims
```

## Claim Validation Checklist
Before claiming anything works, check:

- [ ] Application builds successfully
- [ ] Development server starts
- [ ] No console errors on load
- [ ] Feature actually works in browser
- [ ] No errors during feature use
- [ ] Changes persist after refresh
- [ ] Related features still work
- [ ] Screenshots prove before/after state

## Performance Claim Requirements
Before claiming any performance improvement:
- [ ] Baseline measurement taken
- [ ] After measurement taken
- [ ] Actual numbers provided
- [ ] Screenshots of metrics
- [ ] Reproducible test case

## Emergency Recovery
If you break something:
1. **STOP immediately** - Don't make more changes
2. **Check git status**: See what was modified
3. **Revert if needed**: `git checkout HEAD -- [broken files]`
4. **Test baseline**: Ensure original functionality works
5. **Start over**: Make smaller, testable changes

## Examples of BAD Claims
- ❌ "Fixed innerHTML security issues" (without testing toast notifications work)
- ❌ "Improved performance by 27%" (without actual benchmarks)
- ❌ "Modular architecture is better" (without proving it works)
- ❌ "Undo system is consolidated" (without testing undo actually works)

## Examples of GOOD Claims
- ✅ "Fixed innerHTML security issues - toast notifications still work (screenshot attached)"
- ✅ "Bundle size reduced from 1.9MB to 1.4MB (build output screenshot)"
- ✅ "Task creation works after refactoring (before/after screenshots included)"
- ✅ "No console errors on page load (console log screenshot)"

## Required Response Format
When asked to make improvements, respond with:

```
## Phase 1: Baseline Verification
- [ ] Build status: Checking...
- [ ] Dev server: Checking...

## Phase 2: Implementation
- [ ] Making change: [specific change]
- [ ] Build test: After each change

## Phase 3: Testing
- [ ] Screenshot before: [attach]
- [ ] Feature test: [description]
- [ ] Screenshot after: [attach]
- [ ] Console check: [attach log]

## Phase 4: Claim
[Only if all above pass]
```

## REMEMBER
- **Test before claim**
- **Screenshots or it didn't happen**
- **Build passes or nothing works**
- **One change at a time**
- **Real data only, no assumptions**