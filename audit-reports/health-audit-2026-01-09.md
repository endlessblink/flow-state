# Codebase Health Audit Report

**Generated**: 2026-01-09T14:59:27.467Z
**Project**: /home/endlessblink/my-projects/ai-development/productivity/pomo-flow
**Duration**: 14.88s

## Summary

| Category | Count |
|----------|-------|
| SAFE (auto-remove OK) | 369 |
| CAUTION (review needed) | 26 |
| RISKY (migration needed) | 21 |
| **Total** | **416** |

## SAFE Items (369)

These items can be safely removed:

| Type | Path/Name | Message |
|------|-----------|----------|
| unused-local | src/composables/__tests__/useDateTransition.spec.ts | Local variable 'expect' is never read |
| unused-local | src/composables/__tests__/useDateTransition.spec.ts | Local variable 'useDateTransition' is never read |
| unused-local | src/composables/app/useAppShortcuts.ts | Local variable 'undoHistory' is never read |
| unused-local | src/composables/calendar/useCalendarDayView.ts | Local variable '_startEventDrag' is never read |
| unused-local | src/composables/calendar/useCalendarDayView.ts | Local variable 'event' is never read |
| unused-local | src/composables/calendar/useCalendarInteractionHandlers.ts | Local variable 'Task' is never read |
| unused-local | src/composables/calendar/useCalendarInteractionHandlers.ts | Local variable 'handleConfirmDelete' is never read |
| unused-local | src/composables/calendar/useCalendarWeekView.ts | Local variable '_startWeekDrag' is never read |
| unused-local | src/composables/calendar/useCalendarWeekView.ts | Local variable '_duplicateInstanceId' is never read |
| unused-local | src/composables/canvas/useCanvasActions.ts | Local variable 'getSelectedNodes' is never read |
| unused-local | src/composables/canvas/useCanvasActions.ts | Local variable 'vfViewport' is never read |
| unused-local | src/composables/canvas/useCanvasActions.ts | Local variable 'newTask' is never read |
| unused-local | src/composables/canvas/useCanvasDragDrop.ts | Local variable 'getTaskCenter' is never read |
| unused-local | src/composables/canvas/useCanvasDragDrop.ts | Local variable 'findSmallestContainingRect' is never read |
| unused-local | src/composables/canvas/useCanvasDragDrop.ts | Local variable 'findAllContainingRects' is never read |
| unused-local | src/composables/canvas/useCanvasDragDrop.ts | Local variable 'syncNodes' is never read |
| unused-local | src/composables/canvas/useCanvasEvents.ts | Local variable 'isAnyCanvasStateLocked' is never read |
| unused-local | src/composables/canvas/useCanvasEvents.ts | Local variable 'viewport' is never read |
| unused-local | src/composables/canvas/useCanvasEvents.ts | Local variable 'updateNode' is never read |
| unused-local | src/composables/canvas/useCanvasFilteredState.ts | Local variable 'ref' is never read |
| unused-local | src/composables/canvas/useCanvasFilteredState.ts | Local variable 'width' is never read |
| unused-local | src/composables/canvas/useCanvasFiltering.ts | Local variable 'canvasStore' is never read |
| unused-local | src/composables/canvas/useCanvasGroupMembership.ts | Local variable 'CanvasGroup' is never read |
| unused-local | src/composables/canvas/useCanvasGroupMembership.ts | Local variable 'isPointInRect' is never read |
| unused-local | src/composables/canvas/useCanvasGroupMembership.ts | Local variable 'Rect' is never read |
| unused-local | src/composables/canvas/useCanvasInteractionHandlers.ts | Local variable 'event' is never read |
| unused-local | src/composables/canvas/useCanvasInteractionHandlers.ts | Local variable 'param' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'Node' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'useCanvasStore' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'storeToRefs' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'minX' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'minY' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'maxX' is never read |
| unused-local | src/composables/canvas/useCanvasNavigation.ts | Local variable 'maxY' is never read |
| unused-local | src/composables/canvas/useCanvasOverdueCollector.ts | Local variable 'dueDate' is never read |
| unused-local | src/composables/canvas/useCanvasOverdueCollector.ts | Local variable 'FRIDAY_GROUP_NAME' is never read |
| unused-local | src/composables/canvas/useCanvasOverdueCollector.ts | Local variable 'FRIDAY_GROUP_COLOR' is never read |
| unused-local | src/composables/canvas/useCanvasOverdueCollector.ts | Local variable 'SATURDAY_GROUP_NAME' is never read |
| unused-local | src/composables/canvas/useCanvasOverdueCollector.ts | Local variable 'SATURDAY_GROUP_COLOR' is never read |
| unused-local | src/composables/canvas/useCanvasParentChild.ts | Local variable 'Node' is never read |
| unused-local | src/composables/canvas/useCanvasParentChild.ts | Local variable 'getAbsoluteNodePosition' is never read |
| unused-local | src/composables/canvas/useCanvasParentChild.ts | Local variable 'nodes' is never read |
| unused-local | src/composables/canvas/useCanvasSelection.ts | Local variable 'computed' is never read |
| unused-local | src/composables/canvas/useCanvasSelection.ts | Local variable 'project' is never read |
| unused-local | src/composables/canvas/useCanvasSelection.ts | Local variable 'event' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'ref' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'isAnyCanvasStateLocked' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'getLockedGroupPosition' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'uiStore' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'storeName' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'getSectionAbsolutePosition' is never read |
| unused-local | src/composables/canvas/useCanvasSync.ts | Local variable 'sectionRects' is never read |
| unused-local | src/composables/canvas/useMidnightTaskMover.ts | Local variable 'Ref' is never read |
| unused-local | src/composables/undoSingleton.ts | Local variable 'description' is never read |
| unused-local | src/composables/useCanvasPerformanceTesting.ts | Local variable '_testNodes' is never read |
| unused-local | src/composables/useCanvasProgressiveLoading.ts | Local variable '_throughputHistory' is never read |
| unused-local | src/composables/useCanvasProgressiveLoading.ts | Local variable '_loadingQueue' is never read |
| unused-local | src/composables/useCanvasProgressiveLoading.ts | Local variable '_isLoadingInBackground' is never read |
| unused-local | src/composables/useCanvasRenderingOptimization.ts | Local variable '_createSkeletonNode' is never read |
| unused-local | src/composables/useCanvasRenderingOptimization.ts | Local variable '_debouncedUpdate' is never read |
| unused-local | src/composables/useCanvasVirtualization.ts | Local variable '_offscreenCount' is never read |
| unused-local | src/composables/useCrossTabSync.ts | Local variable '_taskStore' is never read |
| unused-local | src/composables/useCrossTabSync.ts | Local variable '_uiStore' is never read |
| unused-local | src/composables/useCrossTabSync.ts | Local variable '_canvasStore' is never read |
| unused-local | src/composables/useCrossTabSyncIntegration.ts | Local variable '_undoSystem' is never read |
| unused-local | src/composables/useCrossTabSyncIntegration.ts | Local variable '_lastKnownTaskState' is never read |
| unused-local | src/composables/useCrossTabSyncIntegration.ts | Local variable '_handleRemoteChangeStart' is never read |
| unused-local | src/composables/useCrossTabSyncIntegration.ts | Local variable '_handleRemoteChangeEnd' is never read |
| unused-local | src/composables/useCrossTabSyncIntegration.ts | Local variable '_oldTask' is never read |
| unused-local | src/composables/useDateTransition.ts | Local variable 'watch' is never read |
| unused-local | src/composables/useDynamicImports.ts | Local variable '_importCache' is never read |
| unused-local | src/composables/useNetworkOptimizer.ts | Local variable '_decompressData' is never read |
| unused-local | src/composables/usePerformanceMonitor.ts | Local variable '_maxScore' is never read |
| unused-local | src/composables/useSupabaseDatabase.ts | Local variable 'deps' is never read |
| unused-local | src/composables/useSupabaseDatabaseV2.ts | Local variable 'deps' is never read |
| unused-local | src/composables/useSupabaseDatabaseV2.ts | Local variable 'getUserId' is never read |
| unused-local | src/composables/useTaskLifecycle.ts | Local variable 'task' is never read |
| unused-local | src/composables/useVirtualList.ts | Local variable '_containerScrollElement' is never read |
| unused-local | src/composables/useVueFlowErrorHandling.ts | Local variable '_logData' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable '_canvasStore' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable '_edgeSources' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable '_edgeTargets' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable 'oldVal' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable 'oldVal' is never read |
| unused-local | src/composables/useVueFlowStateManager.ts | Local variable '_originalScheduleOperation' is never read |
| unused-local | src/services/trash/TrashService.ts | Local variable 'logger' is never read |
| unused-local | src/services/unified-task-service.ts | Local variable 'conflictResolver' is never read |
| unused-local | src/services/unified-task-service.ts | Local variable 'fromStage' is never read |
| unused-local | src/skills/git-restoration-analyzer.ts | Local variable 'commit' is never read |
| unused-local | src/skills/git-restoration-analyzer.ts | Local variable '_fileNames' is never read |
| unused-local | src/utils/CrossTabBrowserCompatibility.ts | Local variable 'retryCount' is never read |
| unused-local | src/utils/CrossTabPerformance.ts | Local variable 'messageId' is never read |
| unused-local | src/utils/DragInteractionRecorder.ts | Local variable '_ctx' is never read |
| unused-local | src/utils/DragInteractionRecorder.ts | Local variable '_mouseUps' is never read |
| unused-local | src/utils/conflict-resolution.ts | Local variable 'DocumentVersion' is never read |
| unused-local | src/utils/conflict-resolution.ts | Local variable 'deviceId' is never read |
| unused-local | src/utils/conflict-resolution.ts | Local variable 'localData' is never read |
| unused-local | src/utils/conflict-resolution.ts | Local variable 'remoteData' is never read |
| unused-local | src/utils/individualProjectStorage.ts | Local variable 'index' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'db' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'maxRetries' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'db' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'maxRetries' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'db' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'maxRetries' is never read |
| unused-local | src/utils/individualSectionStorage.ts | Local variable 'docId' is never read |
| unused-local | src/utils/memoryLeakDetector.ts | Local variable 'frameCount' is never read |
| unused-local | src/utils/memoryLeakDetector.ts | Local variable 'lastFrameTime' is never read |
| unused-local | src/utils/memoryLeakDetector.ts | Local variable '_deltaTime' is never read |
| unused-local | src/utils/mockTaskDetector.ts | Local variable '_mockPatterns' is never read |
| unused-local | src/utils/networkOptimizer.ts | Local variable '_response' is never read |
| unused-local | src/utils/offlineQueue.ts | Local variable 'processingInterval' is never read |
| unused-local | src/utils/offlineQueue.ts | Local variable 'connectivityMonitor' is never read |
| unused-local | src/utils/offlineQueue.ts | Local variable 'conflictHandling' is never read |
| unused-local | src/utils/offlineQueue.ts | Local variable 'calculateNextRetryTime' is never read |
| unused-local | src/utils/offlineQueue.ts | Local variable 'canProcessOperation' is never read |
| unused-local | src/utils/performanceBenchmark.ts | Local variable 'initialMemory' is never read |
| unused-local | src/utils/performanceBenchmark.ts | Local variable 'cpuSnapshots' is never read |
| unused-local | src/utils/performanceBenchmark.ts | Local variable '_cached' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'plannedTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'inProgressTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'doneTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'totalTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'completedTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'inProgressTasks' is never read |
| unused-local | src/utils/performanceTest.ts | Local variable 'plannedTasks' is never read |
| unused-local | src/utils/retryManager.ts | Local variable '_attemptDuration' is never read |
| unused-local | src/utils/securityScanner.ts | Local variable '_validationPatterns' is never read |
| unused-local | src/utils/syncValidator.ts | Local variable 'totalErrors' is never read |
| unused-local | src/utils/syncValidator.ts | Local variable 'document' is never read |
| unused-local | src/utils/syncValidator.ts | Local variable 'duration' is never read |
| unused-local | src/utils/taskValidation.ts | Local variable 'validPriorities' is never read |
| unused-local | src/utils/timezoneCompatibility.ts | Local variable '_testDate' is never read |
| unused-dev-dependency | @storybook/addon-docs | Dev package '@storybook/addon-docs' appears unused |
| unused-dev-dependency | @storybook/addon-onboarding | Dev package '@storybook/addon-onboarding' appears unused |
| unused-dev-dependency | @typescript-eslint/eslint-plugin | Dev package '@typescript-eslint/eslint-plugin' appears unused |
| unused-dev-dependency | @typescript-eslint/parser | Dev package '@typescript-eslint/parser' appears unused |
| unused-dev-dependency | @vitest/coverage-v8 | Dev package '@vitest/coverage-v8' appears unused |
| unused-dev-dependency | @vue/eslint-config-typescript | Dev package '@vue/eslint-config-typescript' appears unused |
| unused-dev-dependency | @vue/test-utils | Dev package '@vue/test-utils' appears unused |
| unused-dev-dependency | autoprefixer | Dev package 'autoprefixer' appears unused |
| unused-dev-dependency | depcheck | Dev package 'depcheck' appears unused |
| unused-dev-dependency | dotenv | Dev package 'dotenv' appears unused |
| unused-dev-dependency | knip | Dev package 'knip' appears unused |
| unused-dev-dependency | postcss | Dev package 'postcss' appears unused |
| unused-dev-dependency | tsc-watch | Dev package 'tsc-watch' appears unused |
| unused-dev-dependency | vue-tsc | Dev package 'vue-tsc' appears unused |
| unused-file | vitest.shims.d.ts | File is never imported |
| unused-file | vitest.sync.config.ts | File is never imported |
| unused-file | .claude/skill-wrapper.js | File is never imported |
| unused-file | dev-dist/registerSW.js | File is never imported |
| unused-file | dev-dist/sw.js | File is never imported |
| unused-file | dev-dist/workbox-ef62e675.js | File is never imported |
| unused-file | .storybook/emoji-scheme.ts | File is never imported |
| unused-file | dev-manager/server.js | File is never imported |
| unused-file | src/mcp-crash-monitor.cjs | File is never imported |
| unused-file | scripts/add-missing-columns.cjs | File is never imported |
| unused-file | scripts/analyze-reference.js | File is never imported |
| unused-file | scripts/baseline-test-runner.mjs | File is never imported |
| unused-file | scripts/check-darkmode.js | File is never imported |
| unused-file | scripts/cleanup-orphan-tasks.cjs | File is never imported |
| unused-file | scripts/debug-browser.js | File is never imported |
| unused-file | scripts/debug-create-tasks.js | File is never imported |
| unused-file | scripts/debug-fonts.js | File is never imported |
| unused-file | scripts/debug_eslint_config.js | File is never imported |
| unused-file | scripts/debug_eslint_rules.js | File is never imported |
| unused-file | scripts/find-darkmode.js | File is never imported |
| unused-file | scripts/find-hardcoded-values.js | File is never imported |
| unused-file | scripts/generate-sql-insert.cjs | File is never imported |
| unused-file | scripts/lint-check.js | File is never imported |
| unused-file | scripts/log-skill-usage.mjs | File is never imported |
| unused-file | scripts/migrate-console-to-logger.cjs | File is never imported |
| unused-file | scripts/migrate-db.mjs | File is never imported |
| unused-file | scripts/quick-test-logging.js | File is never imported |
| unused-file | scripts/simple-dark-test.js | File is never imported |
| unused-file | scripts/sync-backend.cjs | File is never imported |
| unused-file | scripts/test-rtl.mjs | File is never imported |
| unused-file | scripts/test-runner.mjs | File is never imported |
| unused-file | scripts/ultra-analysis.js | File is never imported |
| unused-file | scripts/verify-db-state.cjs | File is never imported |
| unused-file | scripts/verify-schema-columns.cjs | File is never imported |
| unused-file | .claude/logs/log-rotation.cjs | File is never imported |
| unused-file | .claude/utils/skill-logger.mjs | File is never imported |
| unused-file | .claude/utils/skill-tracker.mjs | File is never imported |
| unused-file | src/assets/styles-built.css | File is never imported |
| unused-file | src/config/themes.ts | File is never imported |
| unused-file | src/composables/composer-error-debug.cjs | File is never imported |
| unused-file | src/composables/documentFilters.ts | File is never imported |
| unused-file | src/composables/simple-analysis.cjs | File is never imported |
| unused-file | src/composables/useBackupSystem.ts | File is never imported |
| unused-file | src/composables/useBrowserTab.ts | File is never imported |
| unused-file | src/composables/useCanvasPerformanceTesting.ts | File is never imported |
| unused-file | src/composables/useCanvasProgressiveLoading.ts | File is never imported |
| unused-file | src/composables/useCanvasRenderingOptimization.ts | File is never imported |
| unused-file | src/composables/useCanvasVirtualization.ts | File is never imported |
| unused-file | src/composables/useCleanupManager.ts | File is never imported |
| unused-file | src/composables/useCrossTabSyncIntegration.ts | File is never imported |
| unused-file | src/composables/useDatabaseAdapter.ts | File is never imported |
| unused-file | src/composables/useErrorHandler.ts | File is never imported |
| unused-file | src/composables/useFavicon.ts | File is never imported |
| unused-file | src/composables/useFocusManagement.ts | File is never imported |
| unused-file | src/composables/useInboxDrag.ts | File is never imported |
| unused-file | src/composables/useInboxFiltering.ts | File is never imported |
| unused-file | src/composables/useOptimisticUI.ts | File is never imported |
| unused-file | src/composables/usePerformanceMonitor.ts | File is never imported |
| unused-file | src/composables/usePersistentStorage.ts | File is never imported |
| unused-file | src/composables/useSidebarToggle.ts | File is never imported |
| unused-file | src/composables/useSupabaseDatabase.ts | File is never imported |
| unused-file | src/composables/useTaskLifecycle.ts | File is never imported |
| unused-file | src/composables/useTaskRecurrence.ts | File is never imported |
| unused-file | src/composables/useTheme.ts | File is never imported |
| unused-file | src/composables/useTimerChangesSync.ts | File is never imported |
| unused-file | src/composables/useVirtualList.ts | File is never imported |
| unused-file | src/composables/vue-app-debug.cjs | File is never imported |
| unused-file | src/skills/git-restoration-analyzer.ts | File is never imported |
| unused-file | src/services/github-service.ts | File is never imported |
| unused-file | src/services/unified-task-service.ts | File is never imported |
| unused-file | src/storage/task-storage.ts | File is never imported |
| unused-file | src/test/setup.ts | File is never imported |
| unused-file | src/utils/SaveQueueManager.ts | File is never imported |
| unused-file | src/utils/TaskValidationGuard.ts | File is never imported |
| unused-file | src/utils/animationBatcher.ts | File is never imported |
| unused-file | src/utils/conflict-detector.ts | File is never imported |
| unused-file | src/utils/csrfProtection.ts | File is never imported |
| unused-file | src/utils/emojiDetection.ts | File is never imported |
| unused-file | src/utils/event-bus.ts | File is never imported |
| unused-file | src/utils/extension-safety.ts | File is never imported |
| unused-file | src/utils/forensicBackupLogger.ts | File is never imported |
| unused-file | src/utils/iconImports.ts | File is never imported |
| unused-file | src/utils/id-mapping.ts | File is never imported |
| unused-file | src/utils/individualNotificationStorage.ts | File is never imported |
| unused-file | src/utils/individualProjectStorage.ts | File is never imported |
| unused-file | src/utils/individualSectionStorage.ts | File is never imported |
| unused-file | src/utils/individualTimerStorage.ts | File is never imported |
| unused-file | src/utils/integrity.ts | File is never imported |
| unused-file | src/utils/logger.ts | File is never imported |
| unused-file | src/utils/memoryLeakDetector.ts | File is never imported |
| unused-file | src/utils/mockTaskDetector.ts | File is never imported |
| unused-file | src/utils/networkOptimizer.ts | File is never imported |
| unused-file | src/utils/offlineQueue.ts | File is never imported |
| unused-file | src/utils/performanceTest.ts | File is never imported |
| unused-file | src/utils/rateLimiter.ts | File is never imported |
| unused-file | src/utils/retryManager.ts | File is never imported |
| unused-file | src/utils/securityScanner.ts | File is never imported |
| unused-file | src/utils/simpleSanitizer.ts | File is never imported |
| unused-file | src/utils/storageQuotaMonitor.ts | File is never imported |
| unused-file | src/utils/syncBatchManager.ts | File is never imported |
| unused-file | src/utils/syncValidator.ts | File is never imported |
| unused-file | src/utils/timezoneCompatibility.ts | File is never imported |
| unused-file | src/utils/userResolutionRules.ts | File is never imported |
| unused-file | src/utils/verificationReportGenerator.ts | File is never imported |
| unused-file | scripts/debug/add-test-data.js | File is never imported |
| unused-file | scripts/debug/check-browser-storage.cjs | File is never imported |
| unused-file | scripts/debug/check-db.cjs | File is never imported |
| unused-file | scripts/debug/check-projects.js | File is never imported |
| unused-file | scripts/debug/clear-db.cjs | File is never imported |
| unused-file | scripts/debug/comprehensive-storage-check.cjs | File is never imported |
| unused-file | scripts/debug/debug-tasks.cjs | File is never imported |
| unused-file | scripts/debug/extract-tasks-from-indexeddb.cjs | File is never imported |
| unused-file | scripts/debug/fix-db.cjs | File is never imported |
| unused-file | scripts/debug/inspect-styles.js | File is never imported |
| unused-file | scripts/debug/load-test-data-simple.js | File is never imported |
| unused-file | scripts/debug/load-test-data.js | File is never imported |
| unused-file | scripts/debug/manual-restore-test.js | File is never imported |
| unused-file | scripts/debug/simple-debug.cjs | File is never imported |
| unused-file | scripts/debug/simulate-task-recovery.js | File is never imported |
| unused-file | scripts/debug/verify-calendar-functionality.js | File is never imported |
| unused-file | scripts/debug/verify-nested-tasks-data.cjs | File is never imported |
| unused-file | scripts/utils/debug-timer-indicator.js | File is never imported |
| unused-file | scripts/utils/debug-timer.cjs | File is never imported |
| unused-file | scripts/utils/debug-zoom.js | File is never imported |
| unused-file | scripts/utils/demo-skill-logging.mjs | File is never imported |
| unused-file | scripts/utils/test-log-analyzer.mjs | File is never imported |
| unused-file | scripts/utils/test-skill-logger.mjs | File is never imported |
| unused-file | tests/debug/console-undo-test.js | File is never imported |
| unused-file | tests/debug/debug-undo-error.js | File is never imported |
| unused-file | tests/debug/debug-undo-system.js | File is never imported |
| unused-file | tests/debug/run-undo-test.cjs | File is never imported |
| unused-file | tests/debug/simple-undo-validation.js | File is never imported |
| unused-file | tests/debug/validate-undo-fix.js | File is never imported |
| unused-file | tests/manual/comprehensive-test.cjs | File is never imported |
| unused-file | tests/manual/manual-test.cjs | File is never imported |
| unused-file | tests/manual/simple-test.cjs | File is never imported |
| unused-file | .claude/skills/meta-skill-router/auto-integration.ts | File is never imported |
| unused-file | .claude/skills/meta-skill-router/cli-tool.ts | File is never imported |
| unused-file | .claude/skills/meta-skill-router/learning-system.ts | File is never imported |
| unused-file | .claude/skills/meta-skill-router/router.js | File is never imported |
| unused-file | .claude/skills/meta-skill-router/skill-discovery.ts | File is never imported |
| unused-file | .claude/skills/meta-skill-router/update-router.js | File is never imported |
| unused-file | .claude/skills/meta-skill-router/watch-service.ts | File is never imported |
| unused-file | .claude/skills/🎯 chief-architect/index.cjs | File is never imported |
| unused-file | .claude/skills/👁️ view-by-view-filter-analyzer/index.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/index.js | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/run-skill.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/run-skill.mjs | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator.backup-20251127-163633/code-scanner.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator.backup-20251127-163633/index.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator.backup-20251127-163633/integration.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator.backup-20251127-163633/safety.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator/cli.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator/code-scanner.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator/index.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator/integration.js | File is never imported |
| unused-file | .claude/skills/💡 idea-issue-creator/safety.js | File is never imported |
| unused-file | .claude/skills/📆 calendar-interface-architect/execute.js | File is never imported |
| unused-file | .claude/skills/🔍 comprehensive-system-analyzer/index-old.cjs | File is never imported |
| unused-file | .claude/skills/🔍 comprehensive-system-analyzer/index.cjs | File is never imported |
| unused-file | .claude/skills/🔍-detect-competing-systems/analysis-engine.js | File is never imported |
| unused-file | .claude/skills/🔍-detect-competing-systems/pomo-analyzer.js | File is never imported |
| unused-file | .claude/skills/🔧 persistence-type-fixer/execute.js | File is never imported |
| unused-file | .claude/skills/🔧 ts-foundation-restorer/execute.js | File is never imported |
| unused-file | .claude/skills/🚨 crisis-debugging-advisor/index.js | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/index.cjs | File is never imported |
| unused-file | .claude/skills/🧹 root-project-cleaner/index.js | File is never imported |
| unused-file | .claude/skills/🧹 ts-architectural-cleanup/execute.js | File is never imported |
| unused-file | src/assets/styles/modal.css | File is never imported |
| unused-file | src/components/app/AppSidebar.vue | File is never imported |
| unused-file | src/components/canvas/CanvasStatusOverlays.vue | File is never imported |
| unused-file | src/components/canvas/GroupManager.vue | File is never imported |
| unused-file | src/components/canvas/InboxPanel.vue | File is never imported |
| unused-file | src/components/canvas/NodeContextMenu.vue | File is never imported |
| unused-file | src/components/common/AsyncLoader.vue | File is never imported |
| unused-file | src/components/kanban/KanbanCardCompact.vue | File is never imported |
| unused-file | src/components/layout/TaskManagerSidebar.vue | File is never imported |
| unused-file | src/components/recurrence/RecurrencePatternSelector.vue | File is never imported |
| unused-file | src/composables/calendar/useCalendarDateNavigation.ts | File is never imported |
| unused-file | src/composables/calendar/useCalendarDrag.ts | File is never imported |
| unused-file | src/composables/canvas/useCanvasFilteredState.ts | File is never imported |
| unused-file | src/composables/canvas/useCanvasModals.ts | File is never imported |
| unused-file | src/services/data/MarkdownExportService.ts | File is never imported |
| unused-file | src/stories/helpers/mockUseCanvasStore.ts | File is never imported |
| unused-file | src/stories/helpers/mockUseLocalAuthStore.ts | File is never imported |
| unused-file | src/utils/canvas/positionUtils.ts | File is never imported |
| unused-file | .claude/skills/codebase-health-auditor/scripts/orchestrator.js | File is never imported |
| unused-file | .claude/skills/tauri-e2e-testing/assets/mock-tauri.ts | File is never imported |
| unused-file | .claude/skills/tauri-e2e-testing/assets/playwright.config.ts | File is never imported |
| unused-file | .claude/skills/tauri-e2e-testing/assets/vitest.config.ts | File is never imported |
| unused-file | .claude/skills/⏰ calendar-scheduling-fixer/scripts/analyze-task-state.js | File is never imported |
| unused-file | .claude/skills/⏰ calendar-scheduling-fixer/scripts/diagnose-calendar-leak.js | File is never imported |
| unused-file | .claude/skills/⏰ calendar-scheduling-fixer/scripts/package-skill.js | File is never imported |
| unused-file | .claude/skills/🎨 css-design-token-enforcer/scripts/browser_color_test.js | File is never imported |
| unused-file | .claude/skills/🎨 css-design-token-enforcer/scripts/final_color_verification.cjs | File is never imported |
| unused-file | .claude/skills/🎨 css-design-token-enforcer/scripts/simple_color_test.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/config/global-setup.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/config/global-teardown.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/config/playwright.config.cjs | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/page-objects/BasePage.js | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/page-objects/BoardView.js | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/page-objects/CanvasView.js | File is never imported |
| unused-file | .claude/skills/👤 user-flow-testing-skills/utils/FixRecommendationEngine.js | File is never imported |
| unused-file | .claude/skills/💾 indexeddb-backup-debugger/scripts/analyze-database.cjs | File is never imported |
| unused-file | .claude/skills/💾 indexeddb-backup-debugger/scripts/trace-data-flow.cjs | File is never imported |
| unused-file | .claude/skills/🔍-detect-competing-systems/integration/eslint-config.js | File is never imported |
| unused-file | .claude/skills/🔧 ts-foundation-restorer/examples/Store-Methods-Example.ts | File is never imported |
| unused-file | .claude/skills/🔧 ts-foundation-restorer/examples/Task-Interface-Example.ts | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/core/AuditFinding.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/core/DataSafetyAuditor.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/core/RiskRegistry.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/DataIntegrityDetector.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/LocalForageDetector.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/PiniaHydrationDetector.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/PouchDBSyncDetector.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/SafariITPDetector.cjs | File is never imported |
| unused-file | .claude/skills/🛡️-data-safety-auditor/detectors/StorageQuotaDetector.cjs | File is never imported |
| unused-file | src-tauri/target/debug/build/app-831f84fc63005e61/out/__global-api-script.js | File is never imported |
| unused-file | src-tauri/target/debug/build/app-8840551b3396ed31/out/__global-api-script.js | File is never imported |
| unused-dependency | @tiptap/extension-link | Package '@tiptap/extension-link' appears unused |
| unused-dependency | @tiptap/extension-underline | Package '@tiptap/extension-underline' appears unused |
| unused-dependency | @vueuse/gesture | Package '@vueuse/gesture' appears unused |

## CAUTION Items (26)

Review these items before removal:

| Type | Path/Name | Score | Message |
|------|-----------|-------|----------|
| unused-computed | src/views/CanvasView.vue | 21 | Computed property 'systemHealthMessage' is defined but never used |
| unused-computed | src/views/CanvasView.vue | 21 | Computed property '_hasInboxTasks' is defined but never used |
| unused-computed | src/views/CanvasView.vue | 21 | Computed property '_resizeHandleStyle' is defined but never used |
| unused-computed | src/components/tasks/HierarchicalTaskRow.vue | 21 | Computed property '_subtaskProgressPercentage' is defined but never used |
| unused-computed | src/components/tasks/TaskEditModal.vue | 21 | Computed property 'descriptionAlignmentClasses' is defined but never used |
| unused-computed | src/components/tasks/TaskEditModal.vue | 21 | Computed property 'descriptionAlignmentStyles' is defined but never used |
| unused-computed | src/components/debug/KeyboardDeletionTest.vue | 21 | Computed property '_canvasTasks' is defined but never used |
| unused-computed | src/components/canvas/TaskNode.vue | 21 | Computed property 'projectVisual' is defined but never used |
| unused-computed | src/components/common/MultiSelectToggle.vue | 21 | Computed property '_hasSelection' is defined but never used |
| unused-computed | src/components/base/BaseInput.vue | 21 | Computed property '_hasHebrew' is defined but never used |
| unused-computed | src/components/layout/TaskManagerSidebar.vue | 21 | Computed property '_hideStatusFilters' is defined but never used |
| unused-prop | src/components/canvas/CanvasModals.vue | 24 | Prop 'x' is defined but never used in template or script |
| unused-prop | src/components/canvas/CanvasModals.vue | 24 | Prop 'y' is defined but never used in template or script |
| unused-local | src/stores/__tests__/canvas.test.ts | 57 | Local variable 'nodes' is never read |
| unused-local | src/stores/canvas.ts | 57 | Local variable 'getAbsoluteNodePosition' is never read |
| unused-local | src/stores/projects.ts | 57 | Local variable 'isSyncing' is never read |
| unused-local | src/stores/tasks.ts | 57 | Local variable 'saveTasks' is never read |
| unused-local | src/stores/tasks.ts | 57 | Local variable 'tasks' is never read |
| unused-local | src/stores/tasks.ts | 57 | Local variable 'loadPersistedFilters' is never read |
| unused-local | src/stores/tasks.ts | 57 | Local variable 'importTasksFromJSON' is never read |
| unused-local | src/stores/tasks.ts | 57 | Local variable 'importFromRecoveryTool' is never read |
| unused-local | src/stores/tasks/taskOperations.ts | 57 | Local variable 'saveTasksToStorage' is never read |
| unused-local | src/stores/tasks/taskPersistence.ts | 57 | Local variable 'hideDoneTasks' is never read |
| unused-local | src/stores/timer.ts | 57 | Local variable '_crossDeviceSyncInitialized' is never read |
| unused-local | src/stores/ui.ts | 57 | Local variable 'showAllSidebars' is never read |
| unused-local | src/stores/ui.ts | 57 | Local variable 'hideAllSidebars' is never read |

## RISKY Items (21)

These items need migration or careful review:

| Type | Path/Name | Score | Message |
|------|-----------|-------|----------|
| unused-file | src/stores/taskScheduler.ts | 68 | File is never imported |
| unused-file | src/stores/theme.ts | 68 | File is never imported |
| unused-file | src/stores/canvas/canvasInteraction.ts | 68 | File is never imported |
| unused-file | src/stores/canvas/useSelection.ts | 68 | File is never imported |
| unused-file | src/stores/canvas/useZoom.ts | 68 | File is never imported |
| missing-dependency | @eslint/js | 83 | Package '@eslint/js' is imported but not in package.json |
| missing-dependency | vue-eslint-parser | 83 | Package 'vue-eslint-parser' is imported but not in package.json |
| missing-dependency | playwright | 83 | Package 'playwright' is imported but not in package.json |
| missing-dependency | pouchdb | 83 | Package 'pouchdb' is imported but not in package.json |
| missing-dependency | puppeteer | 83 | Package 'puppeteer' is imported but not in package.json |
| missing-dependency | @storybook/vue3 | 83 | Package '@storybook/vue3' is imported but not in package.json |
| missing-dependency | lodash | 83 | Package 'lodash' is imported but not in package.json |
| missing-dependency | pg | 83 | Package 'pg' is imported but not in package.json |
| missing-dependency | chokidar | 83 | Package 'chokidar' is imported but not in package.json |
| missing-dependency | node-fetch | 83 | Package 'node-fetch' is imported but not in package.json |
| missing-dependency | express | 83 | Package 'express' is imported but not in package.json |
| missing-dependency | jsonwebtoken | 83 | Package 'jsonwebtoken' is imported but not in package.json |
| missing-dependency | cors | 83 | Package 'cors' is imported but not in package.json |
| missing-dependency | localforage | 83 | Package 'localforage' is imported but not in package.json |
| missing-dependency | glob | 83 | Package 'glob' is imported but not in package.json |
| missing-dependency | archiver | 83 | Package 'archiver' is imported but not in package.json |

## Blind Spots

The following cannot be detected statically:
- Dynamic imports (`import(variable)`)
- Reflection and metaprogramming
- Runtime code generation
- Framework magic (Vue's `$attrs`, `$slots`)
- Side-effect-only imports

---
*Generated by Codebase Health Auditor v1.0.0*
