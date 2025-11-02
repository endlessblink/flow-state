# Pomo-Flow: Product Roadmap & Implementation Plan

> **Note**: This is a backup copy. The primary roadmap is maintained at `/plan.md` (project root) for better visibility.

**Last Updated**: 2025-10-24
**Vision**: Personal productivity system with mobile-optimized experience, AI-powered task management, and full Hebrew/English bilingual support

---

## <� Product Vision

A productivity application that enables seamless task management across PC and mobile devices with:
- **Mobile-first experience**: Optimized UI for on-the-go task management
- **Voice-to-task**: Transcribe Hebrew or English speech into structured tasks
- **Bidirectional sync**: Real-time synchronization between PC and mobile
- **Full RTL support**: 100% Hebrew language support across all interfaces
- **AI-powered assistance**: Smart suggestions, natural language processing, productivity insights

---

## 🚧 Phase 0: Canvas UX Improvements (IN PROGRESS)

### 0.1 Groups vs Sections Wizard
**Goal**: Improve user experience for creating canvas sections with smart automation

**Context**: Currently, users can create basic "Groups" via GroupModal.vue, but creating smart "Sections" (priority, status, timeline, project) requires understanding section types and properties. We need a guided wizard to make this accessible.

**Terminology Decision**:
- **Groups**: Visual organization only (`type: 'custom'`), no property updates on tasks
- **Sections**: Smart automation (`type: 'priority'|'status'|'timeline'|'project'`), auto-updates task properties when dragged in

**Branch**: `feature/groups-vs-sections-wizard` (with safety branch `feature/canvas-date-fixes`)

**Implementation Phases**:

#### Phase 1: Update Terminology (1-2 hours)
- [ ] Add JSDoc comments to canvas store distinguishing Groups vs Sections
- [ ] Update CanvasContextMenu.vue to show both "Create Group" and "Create Section" options
- [ ] Add introductory section to `.claude/docs/canvas-sections-guide.md`

#### Phase 2: Build SectionWizard Component (4-6 hours)
- [ ] Create `src/components/canvas/SectionWizard.vue` with 3-step flow:
  - Step 1: Choose section type (Priority/Status/Timeline/Project)
  - Step 2: Configure property value (dynamic based on type)
  - Step 3: Customize appearance (name, color, size)
- [ ] Implement step navigation (Back/Next/Create)
- [ ] Add validation for each step
- [ ] Style with glass morphism design system

#### Phase 3: Wire Up Context Menu (30 mins)
- [ ] Add "Create Section (Wizard)" button to CanvasContextMenu.vue
- [ ] Connect wizard to CanvasView.vue
- [ ] Pass canvas click position to wizard

#### Phase 4: Update Documentation (1 hour)
- [ ] Update canvas-sections-guide.md with Groups vs Sections intro
- [ ] Add wizard usage instructions
- [ ] Document all section types and their behavior

**Testing**:
- [ ] Test wizard with Playwright MCP (create each section type)
- [ ] Verify sections update task properties correctly
- [ ] Test step navigation and validation
- [ ] Verify backwards compatibility with GroupModal

**Estimated Total Effort**: 8-10 hours

**Rollback**: If issues arise, `git checkout feature/canvas-date-fixes` to restore 100% working state.

---

## =� Phase 1: Firebase Backend & Authentication (IN PROGRESS)

### 1.0 Firebase Backend Setup ✅ COMPLETED
**Goal**: Set up Firebase backend for authentication and real-time sync

**Completed**:
- [x] Create Firebase project (pomo-flow)
- [x] Enable Firestore Database in eur3 region (Europe - optimized for Israel)
- [x] Deploy security rules (user-scoped data access)
- [x] Deploy database indexes (status, priority, dueDate queries)
- [x] Enable Authentication providers (Email/Password + Google Sign-In)
- [x] Create Firebase config file (`src/config/firebase.ts`)
- [x] Create Firestore composable (`src/composables/useFirestore.ts`)
- [x] Configure environment variables (`.env.local`)
- [x] Verify Firebase initialization in browser

**Branch**: `firebase-integration`
**Completed**: 2025-10-26

### 1.1 Authentication Implementation 🚧 NEXT
**Goal**: User authentication with Firebase Auth

**Tasks**:
- [ ] Create authentication store (`src/stores/auth.ts`)
  - Integrate Firebase Auth with Pinia
  - Login/signup/logout actions
  - Auth state persistence
  - User profile management
- [ ] Build authentication UI components
  - `src/components/auth/LoginForm.vue` - Email/password login
  - `src/components/auth/SignupForm.vue` - User registration
  - `src/components/auth/GoogleSignInButton.vue` - Google OAuth
  - Form validation and error handling
  - Password reset flow
- [ ] Add route guards
  - Protect authenticated routes
  - Redirect logic for unauthenticated users
  - Handle auth state changes in router
- [ ] Update UI store
  - Auth modal states (login/signup/reset password)
  - Modal management and transitions

**Dependencies**: Phase 1.0 (Firebase setup - COMPLETED)
**Estimated effort**: 2-3 days

### 1.2 Sync Architecture Implementation
**Goal**: Bidirectional sync between IndexedDB and Firestore

**Tasks**:
- [ ] Create sync manager composable (`src/composables/useSyncManager.ts`)
  - Online/offline detection
  - Sync conflict resolution
  - Optimistic updates with rollback
- [ ] Migrate tasks from IndexedDB to Firestore
  - Migration utility for existing local data
  - Preserve task IDs and relationships
  - Handle user data ownership
- [ ] Implement real-time listeners
  - Subscribe to Firestore changes
  - Update Pinia stores reactively
  - Handle multi-device sync
- [ ] Add sync status UI
  - Sync indicators in navigation
  - Manual sync trigger option
  - Sync conflict resolution UI

**Dependencies**: Phase 1.1 (Authentication)
**Estimated effort**: 4-5 days

### 1.3 Mobile UI Optimization
**Goal**: Create touch-optimized interface for mobile devices

- [ ] Responsive layout for all views (Board, Calendar, Canvas)
- [ ] Touch gesture support (swipe, long-press, pinch-to-zoom)
- [ ] Mobile-optimized task cards with larger touch targets
- [ ] Bottom sheet navigation for mobile
- [ ] Mobile-specific quick actions (floating action button)
- [ ] Optimize glass morphism for mobile performance

**Dependencies**: Current Capacitor 7 setup
**Estimated effort**: 5-7 days

### 1.4 Mobile Widget Development
**Goal**: Native home screen widget for quick task access

- [ ] Android widget (Today's tasks, quick add)
- [ ] iOS widget (using WidgetKit)
- [ ] Widget configuration screen
- [ ] Deep linking from widget to app
- [ ] Live updates for task completion status

**Dependencies**: Capacitor native plugins
**Estimated effort**: 7-10 days

### 1.5 Mobile Build & Deployment
**Goal**: Production-ready mobile apps

- [ ] Android build configuration (Play Store)
- [ ] iOS build configuration (App Store)
- [ ] App icons and splash screens
- [ ] Mobile-specific build optimizations
- [ ] Test on physical devices (Android & iOS)

**Dependencies**: Google Play Console, Apple Developer account
**Estimated effort**: 3-5 days

---

## < Phase 2: Hebrew Localization (i18n)

### 2.1 Internationalization Setup
**Goal**: Framework for multi-language support

- [ ] Install and configure vue-i18n
- [ ] Extract all hardcoded strings to translation files
- [ ] Create language switching mechanism
- [ ] Setup translation file structure (en, he)
- [ ] Add RTL layout detection and switching

**Tech stack**: vue-i18n v9+
**Estimated effort**: 3-4 days

### 2.2 RTL Support
**Goal**: Full right-to-left layout support

- [ ] RTL CSS modifications (Tailwind direction utilities)
- [ ] Mirror layouts for Hebrew (sidebar, navigation)
- [ ] RTL-aware animations and transitions
- [ ] Fix canvas interactions for RTL
- [ ] Date/time formatting for Hebrew locale

**Dependencies**: Phase 2.1
**Estimated effort**: 4-5 days

### 2.3 Hebrew Translation
**Goal**: Complete Hebrew translation of all UI text

- [ ] Translate core UI elements
- [ ] Translate task management views
- [ ] Translate settings and configuration
- [ ] Translate error messages and notifications
- [ ] Translate onboarding and help content
- [ ] Review and QA Hebrew translations

**Estimated effort**: 3-4 days

---

## = Phase 3: Cross-Device Synchronization

### 3.1 Sync Architecture Design
**Goal**: Define synchronization strategy

**Options to evaluate**:
1. **Firebase Realtime Database** (easiest, managed)
2. **Supabase** (PostgreSQL with real-time)
3. **Self-hosted CouchDB** (offline-first with PouchDB)
4. **Custom WebSocket server** (full control)

**Decision criteria**:
- Offline-first capability
- Conflict resolution strategy
- Real-time updates latency
- Cost for single user
- Privacy considerations

**Estimated effort**: 2-3 days research

### 3.2 Backend Implementation
**Goal**: Sync server with authentication

- [ ] Setup chosen backend service
- [ ] User authentication (email or anonymous)
- [ ] Database schema for tasks, projects, settings
- [ ] Sync API endpoints (push/pull changes)
- [ ] Conflict resolution logic
- [ ] Implement change tracking (timestamps, version vectors)

**Dependencies**: Phase 3.1 decision
**Estimated effort**: 7-10 days

### 3.3 Client Sync Integration
**Goal**: Bidirectional sync in web and mobile apps

- [ ] Sync composable (useSyncManager.ts)
- [ ] Online/offline detection
- [ ] Background sync for mobile (Capacitor BackgroundTask)
- [ ] Optimistic updates with rollback
- [ ] Sync status indicators in UI
- [ ] Manual sync trigger option
- [ ] Sync conflict resolution UI

**Dependencies**: Phase 3.2
**Estimated effort**: 8-12 days

---

## > Phase 4: AI Features

### 4.1 Voice-to-Task Transcription
**Goal**: Convert Hebrew/English speech to structured tasks

**Tech options**:
1. **OpenAI Whisper API** (best accuracy, cost per minute)
2. **Google Cloud Speech-to-Text** (Hebrew support, pay-as-you-go)
3. **Azure Speech Services** (good Hebrew, competitive pricing)
4. **Web Speech API** (free, browser-based, limited accuracy)

**Implementation**:
- [ ] Choose and integrate speech recognition service
- [ ] Language detection (auto-detect Hebrew/English)
- [ ] Audio recording UI (mobile and desktop)
- [ ] Real-time transcription display
- [ ] Post-processing for task extraction
- [ ] Task field mapping (title, description, due date, priority)

**Dependencies**: None (can start in parallel)
**Estimated effort**: 5-7 days

### 4.2 Natural Language Task Parsing
**Goal**: Extract structured task data from free-form text

**Tech approach**: GPT-4 API or Claude API

**Features**:
- [ ] Parse task title, description, priority
- [ ] Extract due dates and times (Hebrew date formats)
- [ ] Identify project associations
- [ ] Extract subtasks from description
- [ ] Estimate Pomodoro count based on description
- [ ] Handle Hebrew and English mixed input

**Example inputs**:
- "����� �� ���� ��� ������ ���� �������" � Meeting with team, tomorrow 2pm
- "urgent: fix the login bug by Friday" � High priority, due Friday

**Dependencies**: None
**Estimated effort**: 5-7 days

### 4.3 Smart Task Suggestions
**Goal**: AI-powered task prioritization and time estimation

- [ ] Analyze task complexity from description
- [ ] Suggest Pomodoro count based on task type
- [ ] Recommend optimal time slots based on calendar
- [ ] Smart project categorization
- [ ] Suggest breaking down large tasks
- [ ] Priority recommendations based on deadlines

**Dependencies**: Phase 4.2 (NLP foundation)
**Estimated effort**: 7-10 days

### 4.4 Productivity Insights
**Goal**: AI analysis of work patterns and recommendations

- [ ] Track completion patterns (time of day, day of week)
- [ ] Identify peak productivity hours
- [ ] Analyze task type performance (coding vs meetings)
- [ ] Pomodoro effectiveness analysis
- [ ] Weekly/monthly productivity reports
- [ ] Personalized recommendations for improvement

**Dependencies**: Sufficient usage data
**Estimated effort**: 8-10 days

### 4.5 Automated Scheduling
**Goal**: AI-optimized task scheduling

- [ ] Integrate with calendar view
- [ ] Auto-schedule tasks based on:
  - Deadlines and priorities
  - Estimated duration (Pomodoros)
  - User's productive hours
  - Dependencies between tasks
- [ ] Handle schedule conflicts
- [ ] Reschedule on task completion/delay
- [ ] "Smart snooze" - optimal rescheduling

**Dependencies**: Phase 4.3, 4.4
**Estimated effort**: 10-14 days

---

## =� Phase 5: Infrastructure & Polish

### 5.1 Performance Optimization
- [ ] Mobile bundle size optimization
- [ ] Lazy loading for views
- [ ] IndexedDB query optimization
- [ ] Canvas rendering performance
- [ ] Reduce JavaScript heap usage
- [ ] Optimize images and assets

**Estimated effort**: 4-5 days

### 5.2 Testing & Quality
- [ ] Playwright tests for mobile views
- [ ] Test Hebrew RTL layouts
- [ ] Test sync conflict scenarios
- [ ] Test offline mode
- [ ] Test voice transcription accuracy
- [ ] Cross-browser testing (Safari iOS, Chrome Android)

**Estimated effort**: 5-7 days

### 5.3 Documentation
- [ ] User guide (English & Hebrew)
- [ ] Mobile setup instructions
- [ ] Sync setup guide
- [ ] AI features documentation
- [ ] Privacy policy (data storage, AI usage)

**Estimated effort**: 3-4 days

---

## =� Implementation Priority

### Immediate Next Steps (Phase 1)
1. **Mobile UI Optimization** - Foundation for mobile experience
2. **Build and deploy to mobile** - Get it usable on phone ASAP

### Short Term (Phases 2-3)
3. **Hebrew localization** - Essential for personal use
4. **Sync implementation** - Connect PC and mobile

### Medium Term (Phase 4)
5. **Voice-to-task** - High-value AI feature for mobile
6. **Natural language parsing** - Enhance voice input
7. **Smart suggestions** - Progressive AI enhancement

### Long Term
8. **Productivity insights** - Requires usage data
9. **Automated scheduling** - Advanced AI capability

---

## =' Technical Considerations

### Current Tech Stack
- **Frontend**: Vue 3 + TypeScript + Vite
- **State**: Pinia with IndexedDB persistence
- **Mobile**: Capacitor 7
- **Styling**: Tailwind CSS + Naive UI
- **Canvas**: Vue Flow

### New Dependencies Needed
- **i18n**: vue-i18n (~50KB)
- **Sync**: Firebase SDK or Supabase client (~200KB)
- **AI**: OpenAI/Claude SDK (~100KB)
- **Speech**: Browser API (native) or cloud service SDK
- **RTL**: Tailwind direction plugin

### Performance Budget
- Mobile bundle: < 500KB gzipped
- Initial load: < 3 seconds on 3G
- Time to interactive: < 5 seconds

---

## =� Success Metrics

### Mobile Experience
- [ ] App installs successfully on Android/iOS
- [ ] Widget displays tasks correctly
- [ ] Touch interactions feel native
- [ ] Offline mode works seamlessly

### Hebrew Support
- [ ] All UI elements display correctly in RTL
- [ ] Hebrew text renders properly
- [ ] Date/time formats match Hebrew locale
- [ ] Language switching works instantly

### Sync
- [ ] Changes appear on other device within 5 seconds
- [ ] Offline changes sync when reconnected
- [ ] No data loss in conflict scenarios
- [ ] Sync works in background on mobile

### AI Features
- [ ] Voice transcription accuracy > 90% (Hebrew & English)
- [ ] Natural language parsing creates correct task 85%+ of time
- [ ] Time estimates within 20% of actual
- [ ] User accepts AI suggestions > 60% of time

---

## =� Getting Started

**Recommended first task**: Mobile UI Optimization

This provides:
1. Immediate usability on phone
2. Foundation for widget development
3. No external dependencies
4. Validates mobile build process

**Command to begin**:
```bash
# Ensure Capacitor is configured
npm run mobile:sync

# Start development with mobile preview
npm run dev
# Open in browser with mobile device emulation
```

---

**Notes**:
- Each phase can be broken down into smaller tasks
- Some phases can run in parallel (e.g., Hebrew i18n while building sync)
- AI features can be implemented incrementally
- User testing required after each major phase
