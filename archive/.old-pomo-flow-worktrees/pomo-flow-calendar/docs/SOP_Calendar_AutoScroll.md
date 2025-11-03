# Calendar Auto-Scroll to Current Time - Standard Operating Procedure (SOP)

## Overview

This SOP documents the calendar auto-scroll functionality that ensures users always see the current time when opening or navigating the calendar view. This improves user experience by immediately showing relevant time slots instead of starting at the beginning of the day.

## Functionality Description

The calendar automatically scrolls to the current time slot in the following scenarios:

1. **Initial Load**: When the calendar component mounts
2. **Today Button**: When user clicks the "Today" navigation button
3. **View Switching**: When switching back to day view from week/month views
4. **Date Navigation**: When navigating to today's date

## Technical Implementation

### Core Function: `scrollToCurrentTime()`

**Location**: `src/views/CalendarView.vue` (lines 513-536)

```javascript
const scrollToCurrentTime = () => {
  nextTick(() => {
    const container = document.querySelector('.calendar-grid') as HTMLElement
    if (!container) return

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Calculate which time slot to scroll to (30-minute slots)
    const slotIndex = Math.floor((currentHour * 2) + (currentMinute >= 30 ? 1 : 0))
    const slotHeight = 30 // Each slot is 30px high

    // Calculate scroll position with some offset to show current time in upper portion
    const scrollTop = slotIndex * slotHeight - 100 // 100px offset from top

    // Scroll to the calculated position
    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    })
  })
}
```

### Trigger Points

1. **Component Mount** (line 554):
   ```javascript
   onMounted(() => {
     setupScrollSync()
     // ... other setup
     scrollToCurrentTime() // Auto-scroll on mount
   })
   ```

2. **Today Button** (lines 632-636):
   ```javascript
   const goToToday = () => {
     currentDate.value = new Date()
     setTimeout(() => scrollToCurrentTime(), 100)
   }
   ```

3. **View Mode Watcher** (lines 567-573):
   ```javascript
   watch(viewMode, (newMode) => {
     if (newMode === 'day') {
       setTimeout(() => scrollToCurrentTime(), 100)
     }
   })
   ```

4. **Date Change Watcher** (lines 575-586):
   ```javascript
   watch(currentDate, (newDate, oldDate) => {
     if (viewMode.value === 'day') {
       const today = new Date()
       const isToday = newDate.toDateString() === today.toDateString()
       if (isToday) {
         setTimeout(() => scrollToCurrentTime(), 100)
       }
     }
   })
   ```

## Key Configuration

- **Time Slot Duration**: 30 minutes
- **Slot Height**: 30px
- **Scroll Offset**: 100px from top (shows current time in upper portion)
- **Scroll Behavior**: Smooth animation
- **Target Container**: `.calendar-grid` (NOT `.calendar-events-container`)
- **Delay**: 100ms timeout for DOM updates

## User Experience

### Expected Behavior

1. **Calendar Opens**: Automatically scrolls to current time slot
2. **Current Time Indicator**: Red line with glow shows current time position
3. **Today Button**: Jumps to today and scrolls to current time
4. **View Switching**: Maintains current time focus when returning to day view
5. **Smooth Scrolling**: Pleasant animation when position changes

### Example Scenarios

- **At 9:15 AM**: Scrolls to 9:00-9:30 time slot
- **At 2:45 PM**: Scrolls to 2:30-3:00 time slot
- **At 11:59 PM**: Scrolls to 11:30-12:00 time slot

## Testing Guidelines

### Manual Testing Checklist

- [ ] Calendar opens scrolled to current time
- [ ] Today button scrolls to current time
- [ ] Week → Day view switches scroll to current time
- [ ] Month → Day view switches scroll to current time
- [ ] Current time indicator is visible and positioned correctly
- [ ] Scrolling is smooth and animated
- [ ] Current time appears in upper portion of view (100px offset)

### Automated Testing

Use the following test files for validation:

- `test-calendar-scroll.js` - Basic functionality test
- `verify-calendar-functionality.js` - Complete implementation verification
- `test-calendar-browser.html` - Browser-based interactive test

## Troubleshooting

### Common Issues

1. **Scroll Not Working**
   - **Check**: DOM selector `.calendar-grid` exists
   - **Fix**: Verify container is rendered before calling function

2. **Wrong Position**
   - **Check**: Time calculation logic
   - **Fix**: Verify slot height (30px) and offset (100px) values

3. **No Animation**
   - **Check**: `behavior: 'smooth'` in scrollTo options
   - **Fix**: Ensure browser supports smooth scrolling

4. **Multiple Triggers**
   - **Check**: Watchers causing duplicate scrolls
   - **Fix**: Add debouncing or conditional checks

### Debug Steps

1. Open browser dev tools
2. Navigate to calendar view
3. Check console for errors
4. Verify `.calendar-grid` element exists
5. Test `scrollToCurrentTime()` function manually
6. Check calculated scroll position matches expected

## Maintenance

### Code Locations to Monitor

- `src/views/CalendarView.vue` - Main implementation
- CSS classes: `.calendar-grid`, `.time-slot`, `.current-time`
- Component lifecycle: `onMounted`, `onUnmounted`
- Vue watchers: `viewMode`, `currentDate`

### Future Enhancements

1. **User Preferences**: Allow disabling auto-scroll
2. **Custom Offset**: Let users set scroll position preference
3. **Time Format**: Support 12-hour/24-hour format considerations
4. **Animation Speed**: Configurable scroll duration
5. **Week View**: Extend functionality to week view scrolling

## Version History

- **v1.0** (2025-10-13): Initial implementation
  - Auto-scroll on mount
  - Today button functionality
  - View switching support
  - Date navigation support
  - Fixed DOM selector bug (.calendar-events-container → .calendar-grid)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-13
**Author**: Claude Code Assistant
**Review Date**: 2025-10-13