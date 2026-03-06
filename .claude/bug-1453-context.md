# BUG-1453: Quick Sort Drag Broken on Mobile PWA

## Status: IN PROGRESS

## Fixed Already
- Production CSS preload failure (restored SITE_URL/API_URL GitHub vars, resilient CF purge)
- CI type/lint errors (ChatMessage, BaseModal, AIQualityDashboard, QuickSortCard)
- Deploy pipeline now fully green

## Still Broken: Mobile PWA swipe

### Key Discovery: TWO Quick Sort implementations
- Desktop: `src/views/QuickSortView.vue` + `src/components/QuickSortCard.vue`
- Mobile: `src/mobile/views/MobileQuickSortView.vue` + `src/mobile/components/MobileQuickSortCard.vue`
- Mobile route: `#/mobile-quick-sort`, card class: `.task-card`

### Playwright touch simulation WORKS locally
- Dispatched synthetic TouchEvents on `.task-card` — swipe-right triggered Save correctly
- So the JS logic is fine. Problem is browser-level touch interception on real device.

### Hypotheses (not yet tested)
1. SW caching old code — user's phone may serve stale JS
2. Parent scroll containers stealing touches — MobileQuickSortView has overflow-y:auto parents
3. useSwipeGestures refactored in 072eea6c — old had touchstart passive:true, new has passive:false
4. Last known working composable version: commit `3a149cb6`

### Next Steps
1. Ask user to hard-refresh PWA or test in incognito
2. If still broken: diff useSwipeGestures between 3a149cb6 and HEAD, revert if needed
3. Check parent touch-action/overflow CSS chain in mobile view
4. Consider unconditional skipWaiting in SW install handler

### Key Files
- `src/composables/useSwipeGestures.ts`
- `src/mobile/components/MobileQuickSortCard.vue`
- `src/mobile/views/MobileQuickSortView.vue`
- `src/sw.ts` (skipWaiting only on SKIP_WAITING message, not auto)
