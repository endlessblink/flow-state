# Mobile Migration Plan for Pomo-Flow

**Generated**: October 23, 2025
**Project**: Pomo-Flow - Multi-view Productivity Application
**Goal**: Transform from desktop-first web app to fully functional native mobile app (iOS + Android)

---

## Executive Summary

Transform Pomo-Flow from a desktop-first web application into a fully functional native mobile app for iOS and Android using Capacitor 7. The app already has Capacitor configured and some mobile components, but needs complete mobile-optimized views, responsive design, touch interactions, and native platform integration.

**Timeline**: 33-42 hours (4-5 full working days)
**Minimum Viable Product**: 15-20 hours
**Critical Path**: 20-24 hours (with parallelization)

---

## Current State Analysis

### ✅ Already Complete

- Capacitor 7 configured (`capacitor.config.ts`)
- Mobile build scripts in package.json
- Native plugins installed:
  - @capacitor/haptics ^7.0.2
  - @capacitor/local-notifications ^7.0.3
  - @capacitor/push-notifications ^7.0.3
- Mobile service layer: `notificationService.ts` (390 lines)
- Initial mobile views: `TodayView.vue` (574 lines)
- Mobile components:
  - QuickCapture.vue (12.5 KB) - Bottom sheet task creation
  - TaskList.vue (9.2 KB) - Mobile task list with swipe actions
- iOS platform initialized (`ios/` directory exists)
- Router includes `/today` mobile route
- App ID configured: `com.pomoflow.app`

### ⚠️ Needs Work

- **Android platform NOT initialized** - must run `npx cap add android`
- **No responsive CSS** - desktop-only layouts (68 Vue components)
- **No mobile navigation** - needs bottom nav and mobile-optimized sidebar
- **Desktop views not mobile-ready** - Board, Calendar, Canvas need mobile versions
- **No platform detection** - app doesn't adapt routing based on mobile/desktop
- **Touch gestures incomplete** - needs swipe, long-press, pull-to-refresh
- **Performance not optimized** - needs virtual scrolling for large lists
- **No app icons/splash screens** - needs native assets
- **Build process untested** - hasn't been built for production mobile

---

## Success Criteria

- [ ] App builds successfully for iOS and Android
- [ ] All core features work on mobile (task CRUD, timer, views)
- [ ] Touch interactions feel native (swipe, haptics, gestures)
- [ ] Performance: <100ms tap response, smooth 60fps scrolling
- [ ] Works offline with IndexedDB persistence
- [ ] Notifications work (local + push)
- [ ] App passes Apple App Store and Google Play Store requirements
- [ ] User testing confirms mobile UX is intuitive

---

## Phase 1: Platform Setup & Infrastructure

**Duration**: 3-4 hours
**Goal**: Initialize native platforms, add mobile detection, create responsive foundation

### 1.1 Initialize Android Platform
**Complexity**: Low (30 min)

- **File**: Root directory
- **Command**: `npx cap add android`
- **Description**: Create Android native project with Capacitor
- **Acceptance**: `android/` directory exists with Gradle project
- **Dependencies**: None

### 1.2 Create Platform Detection Utility
**Complexity**: Low (30 min)

- **File**: `src/utils/platform.ts`
- **Description**: Detect iOS/Android/Web, screen size, Capacitor availability
- **Code Example**:
```typescript
import { Capacitor } from '@capacitor/core'

export const Platform = {
  isNative: Capacitor.isNativePlatform(),
  isIOS: Capacitor.getPlatform() === 'ios',
  isAndroid: Capacitor.getPlatform() === 'android',
  isWeb: Capacitor.getPlatform() === 'web',
  isMobile: window.innerWidth < 768
}
```
- **Acceptance**: Can import and use platform checks throughout app
- **Dependencies**: None

### 1.3 Add Mobile-First CSS Reset
**Complexity**: Medium (1 hour)

- **File**: `src/assets/mobile-responsive.css`
- **Description**: Add responsive breakpoints, touch-friendly sizing, mobile typography
- **Includes**:
  - CSS custom properties for mobile spacing
  - Touch target sizes (min 44x44px per Apple HIG)
  - Mobile viewport meta tag configuration
  - Responsive breakpoints (sm: 640px, md: 768px, lg: 1024px)
- **Acceptance**: Design tokens adapt to screen size
- **Dependencies**: Task 1.2 complete

### 1.4 Create Mobile Layout Wrapper
**Complexity**: Medium (1.5 hours)

- **File**: `src/layouts/MobileLayout.vue`
- **Description**: Bottom navigation, mobile header, safe area insets
- **Features**:
  - Bottom tab bar (Today, Board, Canvas, More)
  - Mobile-optimized header with hamburger menu
  - iOS safe area inset support (`env(safe-area-inset-*)`)
  - Pull-to-refresh container
- **Acceptance**: Mobile layout renders with navigation
- **Dependencies**: Task 1.3 complete

---

## Phase 2: Mobile-Optimized Views

**Duration**: 8-10 hours
**Goal**: Create touch-friendly versions of core views

### 2.1 Mobile Board View
**Complexity**: High (3 hours)

- **File**: `src/mobile/views/BoardView.vue`
- **Description**: Touch-optimized Kanban with horizontal scrolling swimlanes
- **Features**:
  - Horizontal scroll snap for swimlanes
  - Touch drag-and-drop (using @vueuse/gesture)
  - Collapsible sections with smooth animations
  - FAB for quick task creation
  - Long-press for task actions
- **Acceptance**: Can drag tasks between columns on touch device
- **Dependencies**: Phase 1 complete

### 2.2 Mobile Calendar View
**Complexity**: High (3 hours)

- **File**: `src/mobile/views/CalendarView.vue`
- **Description**: Mobile-first calendar with agenda view
- **Features**:
  - Week view optimized for mobile portrait
  - Swipe to change weeks
  - Drag from sidebar to calendar slots
  - Time slot selection with haptic feedback
  - Agenda mode for list view
- **Acceptance**: Can schedule tasks via drag-and-drop on mobile
- **Dependencies**: Phase 1 complete

### 2.3 Mobile Canvas View
**Complexity**: Critical (4 hours)

- **File**: `src/mobile/views/CanvasView.vue`
- **Description**: Touch-friendly infinite canvas with pinch-zoom
- **Features**:
  - Two-finger pan and zoom
  - Tap to select, double-tap to edit
  - Floating toolbar for canvas actions
  - Simplified node connections
  - Performance: virtual viewport rendering
- **Acceptance**: Canvas is usable with touch gestures
- **Dependencies**: Phase 1 complete, Vue Flow touch support verified

---

## Phase 3: Mobile Navigation & Shell

**Duration**: 4-5 hours
**Goal**: Complete mobile app shell with navigation and settings

### 3.1 Bottom Tab Navigation
**Complexity**: Medium (2 hours)

- **File**: `src/components/mobile/BottomTabBar.vue`
- **Description**: Native-style bottom navigation with icons and labels
- **Tabs**:
  - Today (home icon)
  - Board (columns icon)
  - Canvas (grid icon)
  - Timer (clock icon)
  - More (menu icon)
- **Acceptance**: Can navigate between views via bottom tabs
- **Dependencies**: Phase 2 complete

### 3.2 Mobile Settings Panel
**Complexity**: Medium (1.5 hours)

- **File**: `src/mobile/views/SettingsView.vue`
- **Description**: Mobile settings with native UI patterns
- **Sections**:
  - Timer configuration (work/break durations)
  - Notification preferences
  - Theme selection
  - Data sync settings
  - About/version info
- **Acceptance**: Can change settings from mobile UI
- **Dependencies**: None

### 3.3 Mobile Search & Filter
**Complexity**: Medium (1.5 hours)

- **File**: `src/mobile/components/SearchModal.vue`
- **Description**: Full-screen search with keyboard optimization
- **Features**:
  - Instant search across tasks
  - Filter by project, status, priority
  - Recent searches
  - Voice input (future enhancement)
- **Acceptance**: Can search and filter tasks on mobile
- **Dependencies**: None

---

## Phase 4: Touch Gestures & Interactions

**Duration**: 3-4 hours
**Goal**: Make interactions feel native with gestures and haptics

### 4.1 Implement Swipe Gestures
**Complexity**: Medium (2 hours)

- **File**: `src/composables/useSwipeGestures.ts`
- **Description**: Composable for swipe-to-action patterns
- **Gestures**:
  - Swipe right: Complete task
  - Swipe left: Delete task
  - Swipe down: Refresh list
  - Pull-to-refresh on views
- **Libraries**: @vueuse/gesture
- **Acceptance**: Swipe gestures work with haptic feedback
- **Dependencies**: Phase 2 complete

### 4.2 Long-Press Context Menus
**Complexity**: Medium (1 hour)

- **File**: `src/composables/useLongPress.ts`
- **Description**: Long-press to open context menus
- **Actions**:
  - Edit task
  - Change priority
  - Move to project
  - Set due date
  - Delete
- **Acceptance**: Long-press opens context menu with haptic
- **Dependencies**: None

### 4.3 Enhanced Haptic Feedback
**Complexity**: Low (1 hour)

- **File**: Update `src/mobile/services/notificationService.ts`
- **Description**: Add haptics to all interactions
- **Triggers**:
  - Button taps (light)
  - Task completion (success)
  - Errors (error)
  - Drag start/end (medium)
  - Pomodoro start/complete (heavy)
- **Acceptance**: Haptics enhance all touch interactions
- **Dependencies**: None

---

## Phase 5: Performance Optimization

**Duration**: 3-4 hours
**Goal**: Ensure smooth 60fps performance on mobile devices

### 5.1 Virtual Scrolling for Task Lists
**Complexity**: High (2 hours)

- **File**: `src/mobile/components/VirtualTaskList.vue`
- **Description**: Render only visible tasks for large lists
- **Library**: @tanstack/vue-virtual
- **Features**:
  - Dynamic height calculation
  - Scroll position restoration
  - Smooth scrolling
  - Works with drag-and-drop
- **Acceptance**: 1000+ task list scrolls smoothly at 60fps
- **Dependencies**: None

### 5.2 Lazy Loading & Code Splitting
**Complexity**: Medium (1 hour)

- **File**: `src/router/index.ts`
- **Description**: Dynamic imports for mobile views
- **Changes**:
  - Lazy load mobile views with `() => import()`
  - Split vendor chunks for Capacitor plugins
  - Preload critical mobile components
- **Acceptance**: Initial load time <2s on 3G
- **Dependencies**: None

### 5.3 Image & Asset Optimization
**Complexity**: Low (1 hour)

- **Files**: `public/assets/icons/`, `public/splash/`
- **Description**: Generate mobile app icons and splash screens
- **Tools**: @capacitor/assets or capacitor-assets CLI
- **Outputs**:
  - iOS: Icon.png (1024x1024), Launch screens
  - Android: ic_launcher (adaptive), splash screens (hdpi, xhdpi, xxhdpi, xxxhdpi)
- **Acceptance**: App has proper icons on home screen
- **Dependencies**: None

---

## Phase 6: Offline & Data Sync

**Duration**: 3-4 hours
**Goal**: Ensure app works offline and syncs when online

### 6.1 Offline Mode Detection
**Complexity**: Low (1 hour)

- **File**: `src/composables/useNetworkStatus.ts`
- **Description**: Monitor online/offline status
- **Library**: @vueuse/core (useNetwork)
- **Features**:
  - Network status indicator in UI
  - Queue mutations when offline
  - Sync on reconnect
- **Acceptance**: App works offline, syncs when online
- **Dependencies**: None

### 6.2 Background Sync Queue
**Complexity**: Medium (2 hours)

- **File**: `src/services/syncQueue.ts`
- **Description**: Queue operations when offline
- **Features**:
  - IndexedDB queue for pending operations
  - Retry logic with exponential backoff
  - Conflict resolution (last-write-wins strategy)
- **Acceptance**: Changes made offline sync when online
- **Dependencies**: Task 6.1 complete

### 6.3 Service Worker for PWA
**Complexity**: Medium (1 hour)

- **File**: `vite.config.ts`, `src/sw.ts`
- **Description**: Add service worker for caching
- **Plugin**: vite-plugin-pwa
- **Strategy**:
  - Cache-first for static assets
  - Network-first for API calls
  - Background sync for mutations
- **Acceptance**: App works offline via PWA
- **Dependencies**: None

---

## Phase 7: Native Features Integration

**Duration**: 3-4 hours
**Goal**: Integrate device-specific features

### 7.1 Enhanced Notifications
**Complexity**: Medium (1.5 hours)

- **File**: Extend `src/mobile/services/notificationService.ts`
- **Features**:
  - Rich notifications with images
  - Notification actions (Complete, Snooze, Dismiss)
  - Scheduled reminders for tasks
  - Daily summary notifications
- **Acceptance**: Notifications work with actions
- **Dependencies**: None

### 7.2 Biometric Authentication (Optional)
**Complexity**: Medium (1.5 hours)

- **File**: `src/mobile/services/biometricAuth.ts`
- **Plugin**: @capacitor-community/biometric (install required)
- **Features**:
  - Face ID / Touch ID (iOS)
  - Fingerprint (Android)
  - Optional app lock
  - Secure settings toggle
- **Acceptance**: Can unlock app with biometrics
- **Dependencies**: None (optional feature)

### 7.3 Share & Export Integration
**Complexity**: Low (1 hour)

- **File**: `src/mobile/services/shareService.ts`
- **Plugin**: @capacitor/share
- **Features**:
  - Share tasks as text
  - Export tasks as JSON
  - Share daily/weekly progress
- **Acceptance**: Can share tasks via native share sheet
- **Dependencies**: None

---

## Phase 8: Testing & Polish

**Duration**: 4-6 hours
**Goal**: Comprehensive testing and bug fixes

### 8.1 Playwright Mobile E2E Tests
**Complexity**: High (2 hours)

- **File**: `tests/mobile/mobile-workflow.spec.ts`
- **Description**: E2E tests for mobile workflows
- **Tests**:
  - Create task on mobile
  - Complete pomodoro session
  - Drag task to calendar
  - Swipe to complete task
  - Offline mode behavior
- **Acceptance**: All critical paths tested with Playwright MCP
- **Dependencies**: Phases 1-7 complete

### 8.2 Physical Device Testing
**Complexity**: Critical (2 hours)

- **Devices**: iOS (iPhone 12+), Android (Pixel 5+)
- **Test Cases**:
  - Task creation and editing
  - Timer functionality
  - Notifications
  - Gestures (swipe, drag, pinch)
  - Offline mode
  - Performance (60fps scrolling)
- **Acceptance**: App works on real devices
- **Dependencies**: Phase 8.1 complete

### 8.3 UI Polish & Bug Fixes
**Complexity**: Medium (2 hours)

- **Files**: Various component files
- **Tasks**:
  - Fix layout bugs on different screen sizes
  - Adjust touch target sizes (<44x44px violations)
  - Improve loading states
  - Add skeleton screens
  - Fix iOS safe area issues
- **Acceptance**: UI looks polished on all devices
- **Dependencies**: Phase 8.2 complete

---

## Phase 9: Build & Deployment

**Duration**: 2-3 hours
**Goal**: Prepare for app store submission

### 9.1 Configure App Store Metadata
**Complexity**: Low (1 hour)

- **Files**: `android/app/build.gradle`, `ios/App/App.xcodeproj`
- **Configuration**:
  - App name: "PomoFlow"
  - Bundle ID: com.pomoflow.app
  - Version: 1.0.0
  - Min SDK versions (Android 24 / API 24, iOS 13)
  - Permissions declarations
- **Acceptance**: Build configs ready for release
- **Dependencies**: None

### 9.2 Generate Signed Builds
**Complexity**: Medium (1 hour)

- **iOS**: Archive with Xcode, sign with Apple Developer cert
- **Android**: Generate signed APK/AAB with keystore
- **Commands**:
  - `npm run build:mobile`
  - `npx cap open ios` → Archive in Xcode
  - `cd android && ./gradlew bundleRelease`
- **Acceptance**: Signed builds ready for upload
- **Dependencies**: Task 9.1 complete

### 9.3 App Store Submission Prep
**Complexity**: Medium (1 hour)

- **Files**: App store listings, screenshots
- **Assets Needed**:
  - App icon (1024x1024)
  - Screenshots (6.5", 5.5" iOS | Phone, Tablet Android)
  - Privacy policy URL
  - App description
  - Keywords
- **Acceptance**: Ready to submit to stores
- **Dependencies**: Task 9.2 complete

---

## Critical Path & Parallelization

### Sequential Critical Path
```
Phase 1 (Setup)
  ↓
Phase 2 (Views)
  ↓
Phase 3 (Navigation)
  ↓
Phase 4 (Gestures)
  ↓
Phase 8 (Testing)
  ↓
Phase 9 (Deploy)
```

### Parallelization Opportunities

**Can Run in Parallel:**
- Phase 5 (Performance) - Independent optimization work
- Phase 6 (Offline) - Separate from UI work
- Phase 7 (Native Features) - Can be done alongside testing

**Optimized Timeline:**
```
Phase 1 (3-4h)
  ↓
Phase 2 (8-10h) ⫿ Phase 5 (3-4h) Start
  ↓
Phase 3 (4-5h) ⫿ Phase 6 (3-4h)
  ↓
Phase 4 (3-4h) ⫿ Phase 7 (3-4h)
  ↓
Phase 8 (4-6h)
  ↓
Phase 9 (2-3h)
```

**Sequential Duration**: 33-42 hours
**Optimized Duration**: 20-24 hours (with 2-3 parallel developers)

### Minimum Viable Mobile (MVM)

**Required Phases**: 1, 2, 3, 8.1, 8.2
**Duration**: 15-20 hours
**Deliverable**: Basic mobile app with core views and testing

---

## Risk Assessment & Mitigation

### Risk 1: Vue Flow Touch Support Inadequate for Mobile Canvas
**Impact**: High - Canvas unusable on mobile
**Probability**: Medium - Vue Flow designed for desktop
**Mitigation**: Test Vue Flow touch support early (Phase 1). Research touch event handling.
**Contingency**: Phase 2.3 - Switch to vue-konva for custom canvas if Vue Flow fails
**Testing**: Create simple touch test in Phase 1 before full implementation

### Risk 2: Performance Issues with Large Task Lists on Older Devices
**Impact**: High - Poor UX, app feels sluggish
**Probability**: Medium - IndexedDB + rendering overhead
**Mitigation**: Phase 5.1 virtual scrolling mandatory, lazy loading, debounced saves
**Contingency**: Add "Archive" feature to reduce active task count, paginate data
**Testing**: Test with 1000+ task dataset on older devices (iPhone SE, Android budget phone)

### Risk 3: iOS App Store Rejection Due to Policy Violations
**Impact**: Critical - Can't distribute on iOS
**Probability**: Low - Standard productivity app
**Mitigation**: Follow Apple HIG, proper permission requests, privacy policy URL
**Contingency**: Address review feedback quickly, resubmit within 48 hours
**Prevention**: Review App Store Review Guidelines before Phase 9

### Risk 4: Capacitor Plugin Compatibility Issues on Latest Android Versions
**Impact**: Medium - Some features broken on Android
**Probability**: Low - Using stable Capacitor 7
**Mitigation**: Test on Android 13+, use fallbacks for unsupported features
**Contingency**: Disable problematic features on affected Android versions with graceful degradation
**Testing**: Test on latest Android 14+ devices

### Risk 5: Offline Sync Conflicts Cause Data Loss
**Impact**: Critical - User data integrity compromised
**Probability**: Medium - Complex conflict scenarios
**Mitigation**: Phase 6.2 conflict resolution with last-write-wins, comprehensive tests
**Contingency**: Show conflict resolution UI, let user choose version to keep
**Testing**: Create test scenarios for offline edits on multiple devices

---

## Testing Strategy

### Unit Tests (Vitest)

**Coverage Requirements**: >80% for critical business logic

- [ ] Platform detection utility (`platform.ts`)
- [ ] Swipe gesture composables (`useSwipeGestures.ts`)
- [ ] Sync queue logic (`syncQueue.ts`)
- [ ] Network status monitoring (`useNetworkStatus.ts`)
- [ ] Notification service methods (scheduling, permissions)

### Component Tests

**Coverage**: All mobile-specific components

- [ ] Mobile layout renders correctly
- [ ] Bottom navigation updates routes
- [ ] Mobile views display tasks
- [ ] Touch gestures trigger correct actions
- [ ] Context menus open on long-press
- [ ] Virtual scroll list handles large datasets

### Integration Tests

**Coverage**: Critical workflows across components

- [ ] Task creation from mobile UI → storage → display
- [ ] Pomodoro timer works on mobile with notifications
- [ ] Notifications schedule correctly with permissions
- [ ] Offline mode persists data correctly
- [ ] Sync queue processes on reconnect with proper conflict handling

### E2E Tests (Playwright Mobile)

**Critical User Paths**:

- [ ] Complete task workflow (create → edit → complete)
- [ ] Pomodoro session from start to finish with notifications
- [ ] Calendar drag-and-drop scheduling on mobile
- [ ] Swipe gestures (complete, delete, refresh)
- [ ] Offline → online sync behavior with data integrity
- [ ] Push notification interactions and deep links

### Device Testing Matrix

| Device | OS Version | Screen Size | Priority | Test Status |
|--------|-----------|-------------|----------|-------------|
| iPhone 13 | iOS 16+ | 6.1" | High | ⏳ Pending |
| iPhone SE | iOS 15+ | 4.7" | High | ⏳ Pending |
| Pixel 6 | Android 13+ | 6.4" | High | ⏳ Pending |
| Samsung Galaxy S21 | Android 12+ | 6.2" | Medium | ⏳ Pending |
| iPad Mini | iPadOS 16+ | 8.3" | Low | ⏳ Future |

**Test Environment**: Physical devices required for accurate touch, haptics, and performance testing

---

## Open Questions

### Question 1: Route Structure
**Should we maintain separate mobile routes (`/mobile/board`) or detect platform and adapt?**

**Option A**: Separate mobile routes
- ✅ Clear separation of mobile vs desktop code
- ✅ Easier testing and development
- ❌ Route duplication, more complex navigation

**Option B**: Platform detection + adaptive components
- ✅ Single source of truth for routes
- ✅ Less code duplication
- ❌ More complex components with conditional logic

**Recommendation**: Option B (Platform detection) - Less duplication, more maintainable

### Question 2: Tablet Support
**Do we need tablet-optimized layouts or just phone + desktop?**

**Considerations**:
- iPad usage in productivity apps is significant
- Tablets have screen sizes between phone (6") and desktop (13"+)
- Current app might work on tablets but not optimized

**Recommendation**: Start with phone-optimized mobile views. Add tablet-specific layouts in Phase 2 if user demand exists. Tablets can fall back to desktop views for MVP.

### Question 3: Canvas View Priority
**Should Canvas view be in MVP or defer to Phase 2?**

**Considerations**:
- Canvas is complex to make touch-friendly (pinch-zoom, pan, drag)
- Board and Calendar are more commonly used views
- Vue Flow touch support needs verification

**Recommendation**: Include simplified canvas in MVP (Phase 2.3 critical). Canvas is a key differentiator. Mark as higher risk and have contingency plan.

### Question 4: Native Code Requirement
**Will we need native iOS (Swift) or Android (Kotlin) code, or is Capacitor sufficient?**

**Considerations**:
- Capacitor plugins cover most common features (notifications, haptics, camera)
- Performance-critical features might need native code
- App Store requirements might necessitate native modules

**Recommendation**: Pure Capacitor for MVP. Only add custom native code if required by performance testing or App Store requirements. Capacitor community has most needed plugins.

### Question 5: Push Notification Server
**Do we need a push notification server backend, or are local notifications sufficient?**

**Considerations**:
- Local notifications work for timers and reminders
- Push notifications require server backend + APNs/FCM setup
- Current app is client-side only (IndexedDB persistence)

**Recommendation**: Local notifications only for MVP. Push notifications are a "nice-to-have" for future cloud sync features. Focus on core offline-first functionality first.

---

## Next Immediate Steps

### Day 1 Morning (2-3 hours)
1. **Run `npx cap add android`** to initialize Android platform (5 min)
2. **Create `src/utils/platform.ts`** for platform detection (30 min)
3. **Test mobile build**: `npm run build:mobile && npx cap run ios` (15 min)
4. **Set up Playwright mobile testing** environment (1 hour)
5. **Implement Phase 1 completely** before starting Phase 2 (1-1.5 hours)

### Day 1 Afternoon (4-5 hours)
6. **Start Phase 2: Mobile Board View** (3 hours)
7. **Test on physical device** (1 hour)
8. **Document any blockers or unexpected issues** (30 min)

### Day 2+ Schedule
- Continue with Phases 2-3 (mobile views and navigation)
- Parallel work on Phase 5 (performance) if multiple developers
- Daily testing on physical devices
- Continuous integration of Playwright tests

---

## Success Metrics

### Technical Metrics
- **Build Success Rate**: 100% successful builds for iOS and Android
- **Performance**: <100ms tap response time, 60fps sustained scrolling
- **Test Coverage**: >80% unit test coverage, >90% critical path E2E coverage
- **Crash Rate**: <0.1% on production devices
- **Load Time**: <2s initial load on 3G connection

### User Experience Metrics
- **Task Completion**: Users can complete primary workflows (create task, start timer, complete task) in <30 seconds
- **Gesture Discovery**: >80% of users discover swipe gestures within first session
- **Offline Usage**: App remains functional 100% of the time when offline
- **Satisfaction**: >4.0 star rating on App Store and Play Store (post-launch)

### Business Metrics
- **App Store Approval**: Pass iOS and Android review on first submission
- **Distribution**: Available on both app stores within 2 weeks of submission
- **Adoption**: >100 downloads in first week (internal testing + soft launch)

---

## Resources & Dependencies

### External Dependencies
- **Capacitor 7**: Already installed
- **@vueuse/gesture**: Install for touch gestures (Phase 4)
- **@tanstack/vue-virtual**: Install for virtual scrolling (Phase 5)
- **vite-plugin-pwa**: Install for service worker (Phase 6)
- **@capacitor-community/biometric**: Install if biometric auth implemented (Phase 7)

### Development Tools
- **Xcode** (macOS required for iOS development)
- **Android Studio** (for Android development)
- **Physical iOS device** (for testing)
- **Physical Android device** (for testing)
- **Apple Developer Account** ($99/year for App Store)
- **Google Play Developer Account** ($25 one-time fee)

### Design Assets Needed
- App icon source file (1024x1024 PNG)
- Splash screen designs (for @capacitor/assets)
- App Store screenshots (once app is built)
- Privacy policy (can use template generator)

---

## Appendix: File Structure

### New Files to Create

```
src/
├── mobile/
│   ├── views/
│   │   ├── BoardView.vue         (NEW - Phase 2.1)
│   │   ├── CalendarView.vue      (NEW - Phase 2.2)
│   │   ├── CanvasView.vue        (NEW - Phase 2.3)
│   │   ├── SettingsView.vue      (NEW - Phase 3.2)
│   │   └── TodayView.vue         (EXISTS - enhance)
│   ├── components/
│   │   ├── BottomTabBar.vue      (NEW - Phase 3.1)
│   │   ├── SearchModal.vue       (NEW - Phase 3.3)
│   │   ├── VirtualTaskList.vue   (NEW - Phase 5.1)
│   │   ├── QuickCapture.vue      (EXISTS)
│   │   └── TaskList.vue          (EXISTS)
│   └── services/
│       ├── notificationService.ts (EXISTS - enhance)
│       ├── biometricAuth.ts      (NEW - Phase 7.2)
│       └── shareService.ts       (NEW - Phase 7.3)
├── utils/
│   └── platform.ts               (NEW - Phase 1.2)
├── composables/
│   ├── useSwipeGestures.ts       (NEW - Phase 4.1)
│   ├── useLongPress.ts           (NEW - Phase 4.2)
│   └── useNetworkStatus.ts       (NEW - Phase 6.1)
├── services/
│   └── syncQueue.ts              (NEW - Phase 6.2)
├── assets/
│   └── mobile-responsive.css     (NEW - Phase 1.3)
└── layouts/
    └── MobileLayout.vue          (NEW - Phase 1.4)

tests/
└── mobile/
    ├── mobile-workflow.spec.ts   (NEW - Phase 8.1)
    └── section-resize.spec.ts    (separate canvas work)

docs/
└── plans/
    └── mobile-migration-plan.md  (THIS DOCUMENT)

android/                          (NEW - Phase 1.1)
```

---

**Document Version**: 1.0
**Last Updated**: October 23, 2025
**Next Review**: After Phase 1 completion

---

## Implementation Tracking

Use this checklist to track progress:

- [ ] Phase 1: Platform Setup (3-4 hours)
- [ ] Phase 2: Mobile Views (8-10 hours)
- [ ] Phase 3: Navigation & Shell (4-5 hours)
- [ ] Phase 4: Touch Gestures (3-4 hours)
- [ ] Phase 5: Performance (3-4 hours)
- [ ] Phase 6: Offline & Sync (3-4 hours)
- [ ] Phase 7: Native Features (3-4 hours)
- [ ] Phase 8: Testing & Polish (4-6 hours)
- [ ] Phase 9: Build & Deployment (2-3 hours)

**Total Progress**: 0 / 9 phases complete
**Estimated Completion**: [DATE TO BE FILLED IN]
