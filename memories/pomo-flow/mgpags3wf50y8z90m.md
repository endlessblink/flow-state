---
id: mgpags3wf50y8z90m
timestamp: 2025-10-13T15:29:20.972Z
project: pomo-flow
category: Bug Fixes
tags: ["calendar","context-menu","task-deletion","frontend","user-experience"]
priority: medium
---

Fixed Calendar view task delete functionality - when right-clicking calendar events and choosing delete, it now removes only the scheduled instance and returns the task to the sidebar, rather than deleting the entire task. Updated CalendarView.vue to pass instanceId and isCalendarEvent flag, modified App.vue global context menu handler to distinguish between calendar and regular task deletion, and enhanced TaskContextMenu.vue to show appropriate messaging.