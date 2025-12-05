# Pomo-Flow Comprehensive Sync Requirements

**Generated**: 2025-12-03
**Analysis Method**: Deep code audit + Playwright UI exploration

## Executive Summary

This document identifies ALL data that should sync across devices/browsers in Pomo-Flow. Based on comprehensive analysis of 8 Pinia stores, persistence layers, and UI exploration.

---

## 1. TASKS (CRITICAL - Must Sync)

### Core Task Properties
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | CRITICAL |
| `title` | string | YES | CRITICAL |
| `description` | string | YES | HIGH |
| `status` | enum (planned/in_progress/done/backlog/on_hold) | YES | CRITICAL |
| `priority` | enum (low/medium/high/null) | YES | HIGH |
| `progress` | number (0-100) | YES | HIGH |
| `dueDate` | string (YYYY-MM-DD) | YES | CRITICAL |
| `projectId` | string | YES | CRITICAL |
| `parentTaskId` | string | null | YES | HIGH |
| `createdAt` | Date | YES | MEDIUM |
| `updatedAt` | Date | YES | MEDIUM |

### Task Scheduling (Calendar Integration)
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `scheduledDate` | string (legacy) | YES | HIGH |
| `scheduledTime` | string (legacy) | YES | HIGH |
| `instances` | TaskInstance[] | YES | CRITICAL |
| `estimatedDuration` | number (minutes) | YES | MEDIUM |
| `estimatedPomodoros` | number | YES | MEDIUM |

### TaskInstance Properties (Calendar Events)
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | CRITICAL |
| `taskId` | string | YES | CRITICAL |
| `date` | string | YES | CRITICAL |
| `startTime` | string | YES | HIGH |
| `endTime` | string | YES | HIGH |
| `status` | enum | YES | HIGH |
| `completedPomodoros` | number | YES | HIGH |

### Task Canvas Properties
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `canvasPosition` | {x, y} | YES | MEDIUM |
| `isInInbox` | boolean | YES | HIGH |

### Task Dependencies
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `dependsOn` | string[] | YES | MEDIUM |
| `connectionTypes` | {taskId: type} | YES | MEDIUM |

### Task Pomodoro Tracking
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `completedPomodoros` | number | YES | HIGH |

### Task Organization
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `tags` | string[] | YES | MEDIUM |
| `subtasks` | Subtask[] | YES | HIGH |

### Subtask Properties
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | HIGH |
| `title` | string | YES | HIGH |
| `completed` | boolean | YES | HIGH |

### Task Recurrence
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `recurrence` | TaskRecurrence | YES | HIGH |
| `recurrence.pattern` | enum | YES | HIGH |
| `recurrence.interval` | number | YES | HIGH |
| `recurrence.daysOfWeek` | number[] | YES | MEDIUM |
| `recurrence.endDate` | string | YES | MEDIUM |
| `recurringInstances` | RecurringTaskInstance[] | YES | MEDIUM |

### Task Notifications
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `notificationPreferences` | object | YES | MEDIUM |

---

## 2. PROJECTS (CRITICAL - Must Sync)

| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | CRITICAL |
| `name` | string | YES | CRITICAL |
| `color` | string (hex/emoji) | YES | HIGH |
| `colorType` | enum (hex/emoji) | YES | HIGH |
| `emoji` | string | YES | MEDIUM |
| `viewType` | enum (status/date/priority) | YES | HIGH |
| `parentId` | string | null | YES | HIGH |
| `createdAt` | Date | YES | MEDIUM |

---

## 3. CANVAS STATE (HIGH - Must Sync)

### Canvas Sections
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | HIGH |
| `name` | string | YES | HIGH |
| `type` | enum (priority/status/timeline/custom/project) | YES | HIGH |
| `position` | {x, y, width, height} | YES | HIGH |
| `color` | string | YES | MEDIUM |
| `filters` | SectionFilter | YES | MEDIUM |
| `layout` | enum (vertical/horizontal/grid/freeform) | YES | MEDIUM |
| `isVisible` | boolean | YES | HIGH |
| `isCollapsed` | boolean | YES | MEDIUM |
| `propertyValue` | any | YES | MEDIUM |
| `autoCollect` | boolean | YES | MEDIUM |
| `collapsedHeight` | number | YES | MEDIUM |

### Canvas UI State (Device-Specific - Don't Sync)
| Property | Type | Sync Status | Reason |
|----------|------|-------------|--------|
| `viewport` | {x, y, zoom} | NO | Device-specific view position |
| `selectedNodeIds` | string[] | NO | Temporary selection |
| `connectMode` | boolean | NO | UI state |
| `activeSection` | string | NO | Temporary focus |

---

## 4. TIMER SETTINGS (HIGH - Must Sync)

### Timer Configuration
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `workDuration` | number (minutes) | YES | HIGH |
| `shortBreakDuration` | number (minutes) | YES | HIGH |
| `longBreakDuration` | number (minutes) | YES | HIGH |
| `autoStartBreaks` | boolean | YES | MEDIUM |
| `autoStartPomodoros` | boolean | YES | MEDIUM |
| `playNotificationSounds` | boolean | YES | MEDIUM |

### Timer Session History
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `completedSessions` | Session[] | YES | HIGH |
| Session.id | string | YES | HIGH |
| Session.taskId | string | YES | HIGH |
| Session.startTime | Date | YES | MEDIUM |
| Session.duration | number | YES | HIGH |
| Session.completedAt | Date | YES | MEDIUM |
| Session.isBreak | boolean | YES | MEDIUM |

### Current Timer State (Partial Sync)
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `currentSession` | Session | PARTIAL | MEDIUM |
| `remainingTime` | number | PARTIAL | HIGH |
| `isActive` | boolean | PARTIAL | HIGH |
| `isPaused` | boolean | PARTIAL | HIGH |

---

## 5. NOTIFICATIONS (MEDIUM - Should Sync)

### Scheduled Notifications
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `id` | string | YES | MEDIUM |
| `taskId` | string | YES | MEDIUM |
| `title` | string | YES | MEDIUM |
| `body` | string | YES | MEDIUM |
| `scheduledTime` | Date | YES | HIGH |
| `isShown` | boolean | YES | MEDIUM |
| `isDismissed` | boolean | YES | MEDIUM |
| `snoozedUntil` | Date | YES | MEDIUM |
| `createdAt` | Date | YES | MEDIUM |

### Notification Preferences (NOT Currently Syncing!)
| Property | Type | Current Status | Priority |
|----------|------|----------------|----------|
| `defaultPreferences` | object | NOT SYNCING | HIGH |
| `doNotDisturb.enabled` | boolean | NOT SYNCING | MEDIUM |
| `doNotDisturb.startTime` | string | NOT SYNCING | MEDIUM |
| `doNotDisturb.endTime` | string | NOT SYNCING | MEDIUM |

---

## 6. USER PREFERENCES (MEDIUM - Should Sync)

### Local Auth Preferences
| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `displayName` | string | YES | MEDIUM |
| `language` | enum (en/he) | YES | MEDIUM |
| `timezone` | string | YES | MEDIUM |
| `defaultPomodoroLength` | number | YES | MEDIUM |
| `defaultBreakLength` | number | YES | MEDIUM |
| `taskView` | enum (board/calendar/canvas) | YES | MEDIUM |
| `notifications.reminders` | boolean | YES | MEDIUM |
| `notifications.pomodoro` | boolean | YES | MEDIUM |
| `notifications.daily` | boolean | YES | MEDIUM |

---

## 7. BACKUP METADATA (LOW - Optional Sync)

| Property | Type | Sync Status | Priority |
|----------|------|-------------|----------|
| `lastBackupTime` | Date | YES | LOW |
| `totalBackups` | number | YES | LOW |
| `historyCount` | number | YES | LOW |

---

## 8. DEVICE-SPECIFIC (Don't Sync)

### UI State
| Property | Store | Reason |
|----------|-------|--------|
| `mainSidebarVisible` | ui.ts | Device-specific layout |
| `secondarySidebarVisible` | ui.ts | Device-specific layout |
| `focusMode` | ui.ts | Device-specific mode |
| `boardDensity` | ui.ts | Device-specific preference |
| `theme` | theme.ts | Device-specific preference |
| `locale` | ui.ts | Browser language |
| `direction` | ui.ts | Auto-detected |

### Quick Sort Session
| Property | Store | Reason |
|----------|-------|--------|
| `isActive` | quickSort.ts | Session-specific |
| `undoStack` | quickSort.ts | Session-specific |
| `redoStack` | quickSort.ts | Session-specific |
| `currentSessionId` | quickSort.ts | Session-specific |

### Undo/Redo History
| Property | Store | Reason |
|----------|-------|--------|
| `history` | undoSingleton | Session-specific |
| `undoStack` | canvas.ts | Session-specific |
| `redoStack` | canvas.ts | Session-specific |

---

## Current Sync Status Summary

### Currently Syncing (via PouchDB/CouchDB)
- Tasks (individual `task-{id}` documents)
- Projects (`projects:data`)
- Canvas sections (`canvas:data`)
- Timer settings (`settings:data`)
- Notifications (`notifications:data`)

### NOT Syncing (Gaps to Fix)
1. **Notification Preferences** - Stored only in localStorage
2. **Quick Sort Session History** - Only localStorage
3. **Timer Current Session** - Only partial sync

### Sync Method
- **Local**: PouchDB (IndexedDB)
- **Remote**: CouchDB via Vite proxy (`/couchdb/pomoflow-tasks`)
- **Pattern**: Individual documents for tasks (`task-{id}`), single documents for other data types

---

## Recommendations

### High Priority Fixes
1. **Add Notification Preferences to DB** - Currently stored in localStorage only
2. **Verify Task Instances Sync** - Critical for calendar functionality
3. **Sync Timer Session on Complete** - Ensure pomodoro history syncs immediately

### Medium Priority
1. **Quick Sort History** - Consider syncing session statistics
2. **User Preferences Consolidation** - Merge local-auth preferences with settings

### Low Priority
1. **Canvas Viewport** - Could optionally sync "last position" for continuity
2. **Board Filters** - Could sync active filter selections

---

## Database Keys Reference

```typescript
export const DB_KEYS = {
  TASKS: 'tasks',           // Individual: task-{id}
  PROJECTS: 'projects',     // Single: projects:data
  CANVAS: 'canvas',         // Single: canvas:data
  TIMER: 'timer',          // Single: settings:data
  SETTINGS: 'settings',    // Single: settings:data
  NOTIFICATIONS: 'notifications', // Single: notifications:data
  HIDE_DONE_TASKS: 'hide_done_tasks',
  VERSION: 'version'
} as const
```

---

## Testing Checklist

### Cross-Browser Sync Verification
- [ ] Create task in Browser A → Appears in Browser B
- [ ] Edit task title in Browser A → Updates in Browser B
- [ ] Delete task in Browser A → Disappears from Browser B
- [ ] Change task status → Syncs to other browser
- [ ] Schedule task on calendar → Calendar event syncs
- [ ] Complete pomodoro → Session count syncs
- [ ] Create project → Project syncs with color/emoji
- [ ] Move task on canvas → Position syncs
- [ ] Collapse canvas section → State syncs
- [ ] Change timer settings → Settings sync

---

**Document Version**: 1.0
**Last Updated**: 2025-12-03
