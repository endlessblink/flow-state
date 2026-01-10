# User Flow Testing Skill

## Overview
Comprehensive user flow testing skill for Pomo-Flow Vue.js application using Playwright with intelligent reporting and fix recommendations.

## Features

### 🎯 Comprehensive User Flow Coverage
- **Task Management**: Creation, editing, organization, deletion workflows
- **Timer Operations**: Pomodoro sessions, controls, tracking
- **Navigation**: View switching, routing, filtering across all views
- **Canvas Interactions**: Drag & drop, node manipulation, connections
- **Calendar Scheduling**: Date management, time blocking, recurring tasks
- **Advanced Features**: Undo/redo, bulk operations, cross-view consistency

### 🧠 Intelligent Testing
- **Visual Regression**: Screenshot comparison and visual consistency
- **Performance Monitoring**: Load times, interaction delays, memory usage
- **Accessibility Testing**: WCAG compliance, keyboard navigation
- **Cross-Browser Testing**: Chrome, Firefox, Safari, mobile variants
- **Error Pattern Recognition**: Automated issue detection and categorization

### 📊 Detailed Reporting
- **Real-time Monitoring**: Live test execution with visual feedback
- **Comprehensive Reports**: HTML reports with screenshots, videos, traces
- **Fix Recommendations**: Specific code suggestions and best practices
- **Performance Metrics**: Detailed performance analysis and optimization tips
- **Trend Analysis**: Historical data and improvement tracking

## Quick Start

```bash
# Run all user flow tests
npm run test:user-flows

# Run specific test categories
npm run test:task-flows
npm run test:timer-flows
npm run test:canvas-flows

# Generate detailed report
npm run test:user-flows -- --reporter=html
```

## Test Categories

### 1. Task Management Flows
- Quick task creation (sidebar)
- Detailed task creation (modal)
- Task editing and updates
- Status changes and organization
- Task deletion and recovery

### 2. Timer Workflows
- Pomodoro session start/stop
- Timer configuration
- Session tracking
- Notification handling

### 3. Navigation & Filtering
- View switching (Board/Calendar/Canvas)
- Search and filter operations
- Project-based filtering
- Date range filtering

### 4. Canvas Interactions
- Node creation and manipulation
- Drag and drop operations
- Connection management
- Section organization

### 5. Calendar Operations
- Task scheduling
- Date navigation
- Recurring task creation
- Time block management

### 6. Advanced Features
- Undo/redo operations
- Bulk operations
- Cross-view consistency
- Data persistence

## Reports

After running tests, find detailed reports in:
- `test-results/user-flow-report.html` - Interactive HTML report
- `test-results/user-flow-report.json` - Machine-readable data
- `test-results/screenshots/` - Failure screenshots
- `test-results/videos/` - Test execution videos

## Fix Recommendations

The skill provides actionable fix recommendations for:
- Performance issues
- Accessibility violations
- User experience problems
- Cross-browser inconsistencies
- Visual regressions

Each recommendation includes:
- Issue severity and priority
- Specific code examples
- Best practice guidelines
- Implementation steps

## Configuration

Edit `config/user-flow-testing.config.js` to customize:
- Test scenarios and timeouts
- Browser configurations
- Reporting options
- Performance thresholds
- Accessibility rules

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
