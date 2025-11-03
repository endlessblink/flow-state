🚨🚨🚨 CRITICAL: ALWAYS TEST WITH PLAYWRIGHT BEFORE CLAIMING ANYTHING WORKS 🚨🚨🚨

MANDATORY PLAYWRIGHT VERIFICATION: You MUST use Playwright MCP to test and verify EVERY feature before claiming it works. Do not rely on console logs, code analysis, or assumptions. If it's not visually confirmed in Playwright MCP browser, it's NOT working.

# ALWAYS CREATE AND UPDATE LIKE I SAID TASKS BEFORE DOING ANYTHING!!!

ALWAYS TEST WITH PLAYWRIGHT BEFORE SAYING THAT SOMETHING IS DONE - IT PROBABLY ISN'T

CRITICAL VALIDATION RULE: Whatever you want me to test MUST be functional and visible through Playwright MCP browser. If it's not working in Playwright MCP, it's not working at all. Do not claim functionality exists without Playwright MCP confirmation.

NEVER CLAIM FUNCTIONALITY WORKS WITHOUT PLAYWRIGHT VERIFICATION: Always use Playwright MCP to test before confirming that any feature is working. Do not assume or claim success without actual visual confirmation through browser testing.

🚨 PLAYWRIGHT FIRST RULE: Test functionality with Playwright MCP BEFORE making claims about what works. Visual confirmation is mandatory.

## CORE PHILOSOPHY

🎯 THIS IS A PERSONAL PRODUCTIVITY TOOL BUILT FOR ONE USER - ME

This is MY productivity tool, built for MY workflow. Compromising on UX means I won't use it effectively, which defeats the entire purpose. Every feature, interaction, and design decision must serve MY specific productivity needs.

CRITICAL PRINCIPLE: Do not suggest "good enough" solutions, library compromises, or generic UX patterns. This tool must work EXACTLY as needed for MY workflow. No shortcuts, no settling, no "most users don't need this."

Build features as by-products of this core principle:
- Perfect UX trumps faster implementation
- Custom solutions over library limitations
- Exact workflow match over generic patterns
- Long-term usability over short-term convenience

## CALENDAR IMPLEMENTATION REQUIREMENTS

### Core Calendar Functionality Requirements
1. **Drag from Sidebar to Calendar**: Tasks must visually appear in calendar immediately after drag-drop
2. **Resize Handles**: Top and bottom resize handles that work independently of drag functionality
3. **Ghost Preview**: Real-time visual feedback showing exactly where tasks will be positioned/resized
4. **Task Movement**: Drag tasks within calendar to reschedule to different time slots
5. **Multi-slot Spanning**: Tasks with durations > 30min must span multiple time slots visually
6. **State Synchronization**: Changes in calendar must reflect in sidebar and kanban immediately

### Implementation Patterns (Research-Based)
1. **Separate Interaction Zones**:
   - Event content center = drag handle (move)
   - Event edges (top/bottom) = resize handles
   - Use event.stopPropagation() on resize to prevent drag conflicts

2. **State Management**:
   - Single source of truth through Pinia store
   - Reactive computed properties for calendar rendering
   - Proper Vue reactivity for real-time updates

3. **Event Positioning**:
   - Absolute positioning for multi-slot events
   - Proper z-index management
   - Grid-based slot calculations

4. **Visual Feedback**:
   - Ghost overlay during resize operations
   - Real-time duration display
   - Snap-to-grid visual cues

### Technical Architecture Requirements
1. **Component Structure**: CalendarGrid + TaskEvent + ResizeHandle + GhostPreview
2. **Data Flow**: TaskStore → CalendarView → EventComponents
3. **Event Handling**: Proper event delegation and conflict prevention
4. **Rendering Logic**: Efficient slot-to-event mapping
5. **Performance**: Smooth 60fps interactions with proper event cleanup

NEVER USE PRODUCTION LANGUAGE: Do not use terms like "production-ready", "enterprise-quality", "professional-grade", "fully functional", etc. when building basic functionality. Keep language practical and focused on what's actually working.