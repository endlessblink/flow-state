# Production Debugging Checklist

## Phase 1: Working Baseline Confirmation
- [ ] **Recent Working State**: When was the application last fully functional?
- [ ] **Baseline Tests**: What core functionality was working?
- [ ] **Current Status**: What specifically is broken right now?
- [ ] **Error Inventory**: List ALL current errors (compilation, runtime, linting)
- [ ] **Change Log**: What changed since last working state?

## Phase 2: Clear All Errors
- [ ] **Compilation Errors**: Run `npm run typecheck` and document all TS errors
- [ ] **Build Errors**: Run `npm run build` and document build failures
- [ ] **Linting Errors**: Run `npm run lint` and document linting issues
- [ ] **Runtime Errors**: Check browser console for runtime errors
- [ ] **Test Failures**: Run `npm run test` and document test failures

## Phase 3: Partial Build Fix
- [ ] **Import Resolution**: Module not found errors
- [ ] **Syntax Errors**: Basic TypeScript/JavaScript syntax
- [ ] **Missing Dependencies**: Package installation issues
- [ ] **Configuration**: Vite, TypeScript, ESLint config issues

## Phase 4: TypeScript Foundation
- [ ] **Interface Definitions**: All interfaces properly defined
- [ ] **Type Annotations**: Consistent typing throughout
- [ ] **Generic Constraints**: Proper generic type usage
- [ ] **Module Declarations**: Correct module type declarations

## Phase 5: CSS/Design System
- [ ] **Design Token Usage**: Replace hardcoded values with tokens
- [ ] **CSS Validation**: Run `npm run validate:css`
- [ ] **Tailwind Configuration**: Ensure consistent utility usage
- [ ] **Component Styling**: Verify component style consistency

## Phase 6: Critical Functionality (Pomo-Flow Specific)
- [ ] **Task Creation**: Create new tasks successfully
- [ ] **Canvas Interactions**: Drag and drop tasks on canvas
- [ ] **Timer Operations**: Start/stop Pomodoro timer
- [ ] **Data Persistence**: IndexedDB save/load operations
- [ ] **View Switching**: Navigate between Board/Calendar/Canvas views

## Phase 7: Deep Error Resolution
- [ ] **Performance Problems**: Memory leaks, slow rendering
- [ ] **Integration Issues**: Cross-component communication failures
- [ ] **State Management**: Pinia store synchronization problems
- [ ] **Browser Compatibility**: Cross-browser rendering differences
- [ ] **Edge Cases**: Unusual user interaction scenarios

## Error Classification
```
CLASSIFY ERROR TYPE:
□ TypeScript compilation (TS2339, TS2345, TS2322, etc.)
□ Import/module resolution (Module not found)
□ Component reference (Component failed to resolve)
□ Runtime browser (Cannot read property of undefined)
□ Build failure (Build failed with code)
□ Linting error (eslint error)
□ Test failure (Test failed)
```

## Validation Commands Checklist
```bash
# TypeScript compilation
npm run typecheck

# Import validation
npm run validate:imports

# CSS validation
npm run validate:css

# Dependency checks
npm run validate:dependencies

# Full validation suite
npm run validate:all

# Production build test
npm run build

# Test suite
npm run test
```

## Success Criteria
- [ ] Zero TypeScript compilation errors
- [ ] Zero build failures
- [ ] Zero runtime browser errors
- [ ] Zero test failures
- [ ] Zero linting errors (or acceptable warnings)
- [ ] All core features functional
- [ ] Performance within acceptable limits
- [ ] Documentation updated with fixes

## Documentation Requirements

### Before Fixing
- [ ] Exact error message and stack trace
- [ ] File and line location
- [ ] Recent changes that may have caused the issue
- [ ] Current working state (what works)

### After Fixing
- [ ] Root cause analysis
- [ ] Specific change made
- [ ] Files affected
- [ ] Validation command used
- [ ] Confirmation of working state

### Knowledge Transfer
- [ ] Update related documentation if needed
- [ ] Note any patterns discovered
- [ ] Record solutions for future reference
- [ ] Share with team if applicable

## Quick Reference: Common Error Solutions

### TypeScript Structural Errors
1. **Stop**: Don't fix individual errors
2. **Assess**: Is it cascading (>10 errors)?
3. **Activate**: Use ts-foundation-restorer skill
4. **Foundation**: Fix interfaces first
5. **Validate**: Run npm run typecheck

### Import/Module Errors
1. **Verify**: File actually exists
2. **Check**: Case sensitivity (Linux)
3. **Validate**: Import path accuracy
4. **Barrel**: Check index.ts exports
5. **Alias**: Verify @/ prefix configuration

### Component Reference Errors
1. **Registration**: Check component registration
2. **Import**: Verify import/export consistency
3. **Naming**: Validate component naming
4. **Test**: Use explicit imports
5. **Browser**: Verify in browser console

## Emergency Procedures

### Cascading TypeScript Failures (>20 errors)
1. **STOP** all development work
2. **ACTIVATE** ts-foundation-restorer immediately
3. **DO NOT** fix individual errors
4. **FOLLOW** foundation restoration protocol
5. **VALIDATE** complete type system

### Complete Build Failure
1. **CHECK** recent dependency updates
2. **RUN** npm run validate:imports
3. **VERIFY** barrel exports
4. **CHECK** Vite configuration
5. **TEST** with fresh build

### Critical Runtime Errors
1. **CHECK** browser console immediately
2. **IDENTIFY** component causing error
3. **VERIFY** component state and props
4. **TEST** with minimal data
5. **ROLLBACK** if necessary

---

**Print this checklist and use for every debugging session to ensure systematic, thorough error resolution.**