# Groups vs Sections Wizard - Feature Plan

**Feature Branch**: `feature/groups-vs-sections-wizard`
**Safety Branch**: `feature/canvas-date-fixes`
**Started**: October 25, 2025
**Status**: 🚧 In Progress

---

## Overview

Implement a clear distinction between **Groups** (visual organization) and **Sections** (smart automation) with a multi-step wizard for creating smart sections that automatically update task properties.

---

## Problem Statement

### Current Issues:
1. **Inconsistent terminology** - UI says "Group", code says "Section"
2. **Limited creation UX** - Existing GroupModal only creates basic groups
3. **No guidance** - Users don't know how to create smart sections that auto-update tasks
4. **Hidden power** - Property-updating sections require manual code editing

### User Impact:
- Confusion about which containers update task properties
- Difficulty discovering and using smart section features
- Manual code editing required for custom timeline sections (e.g., "Tomorrow")

---

## Solution

### Terminology Standardization

| Term | Purpose | Auto-Updates? | Type Value | Example |
|------|---------|---------------|------------|---------|
| **Group** | Visual organization | ❌ No | `type: 'custom'` | "Ideas", "Next Week", "Brainstorming" |
| **Section** | Smart automation | ✅ Yes | `type: 'priority'|'status'|'timeline'|'project'` | "Today", "High Priority", "In Progress" |

**Mental Model**: "Groups organize, Sections transform"

---

## Architecture

### Branch Strategy

```
feature/fix-canvas-parent-child (original branch)
  │
  ├─ feature/canvas-date-fixes (safety branch - preserves working state)
  │
  └─ feature/groups-vs-sections-wizard (new feature branch)
```

**Rollback Plan**:
```bash
# Return to 100% working state
git checkout feature/canvas-date-fixes
```

---

## Implementation Plan

### Phase 1: Terminology Standardization (1-2 hours)

**Goal**: Make UI terminology consistent without breaking changes

**Files to Modify**:

1. **`src/components/canvas/CanvasContextMenu.vue`**
   - Add "Create Smart Section" button
   - Keep existing "Create Group" button

2. **`src/stores/canvas.ts`**
   - Add JSDoc comments to `createSection()`:
   ```typescript
   /**
    * Create a canvas section or group.
    * - Groups (type='custom'): Visual organization only
    * - Sections (type='priority'|'status'|etc): Auto-update task properties
    */
   ```

3. **`.claude/docs/canvas-sections-guide.md`**
   - Add intro explaining Groups vs Sections
   - Add comparison table
   - Link to GroupModal for simple groups

**No breaking changes** - all existing functionality preserved!

---

### Phase 2: Build SectionWizard Component (4-6 hours)

**New File**: `src/components/canvas/SectionWizard.vue`

**Features**:
- Multi-step wizard with progress indicator
- Type selection (Priority, Status, Project, Timeline)
- Property configuration (dynamic based on type)
- Appearance customization (name, color, size)
- Preview of behavior

**Architecture**:

```typescript
// State management
const wizardData = ref({
  type: '',           // Selected section type
  propertyValue: '',  // Selected property value
  name: '',           // Custom name
  color: '#3b82f6',   // Color
  width: 300,
  height: 250
})

const currentStep = ref(1) // 1, 2, or 3

// Step flow
Step 1: Choose Type (priority|status|project|timeline)
   ↓
Step 2: Configure Property (high|medium|low | planned|done|etc | today|tomorrow)
   ↓
Step 3: Customize Appearance (name, color, size)
   ↓
Create Section!
```

**UI Mockup**:

```
┌─────────────────────────────────────────┐
│  Create Smart Section           [Step 1/3]│
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                          │
│  What should this section do?           │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ ⚡ Priority  │  │ ✓ Status     │    │
│  │              │  │              │    │
│  │ Auto-update  │  │ Auto-update  │    │
│  │ task         │  │ completion   │    │
│  │ priority     │  │ status       │    │
│  └──────────────┘  └──────────────┘    │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ 📁 Project   │  │ 📅 Timeline  │    │
│  │              │  │              │    │
│  │ Assign to    │  │ Schedule for │    │
│  │ specific     │  │ specific     │    │
│  │ project      │  │ date         │    │
│  └──────────────┘  └──────────────┘    │
│                                          │
│  [Cancel]                    [Next →]   │
└─────────────────────────────────────────┘
```

**Component Structure**:

```vue
<template>
  <div v-if="isOpen" class="wizard-overlay" @click="emit('close')">
    <div class="wizard-content" @click.stop>
      <!-- Header with Step Indicator -->
      <div class="wizard-header">
        <h2>Create Smart Section</h2>
        <div class="step-indicator">Step {{ currentStep }} of 3</div>
      </div>

      <!-- Step 1: Choose Type -->
      <div v-if="currentStep === 1" class="step-content">
        <h3>What should this section do?</h3>
        <div class="type-grid">
          <TypeOption
            icon="⚡"
            title="Update Priority"
            description="Auto-update task priority"
            @click="selectType('priority')"
          />
          <TypeOption icon="✓" title="Update Status" .../>
          <TypeOption icon="📁" title="Assign to Project" .../>
          <TypeOption icon="📅" title="Schedule for Date" .../>
        </div>
      </div>

      <!-- Step 2: Configure Property (Dynamic) -->
      <div v-if="currentStep === 2" class="step-content">
        <!-- Priority Options -->
        <template v-if="wizardData.type === 'priority'">
          <h3>Which priority level?</h3>
          <PropertyOption value="high" label="High Priority" icon="⚡"/>
          <PropertyOption value="medium" label="Medium Priority" icon="⚠️"/>
          <PropertyOption value="low" label="Low Priority" icon="🏳️"/>
        </template>

        <!-- Status Options -->
        <template v-else-if="wizardData.type === 'status'">
          <h3>Which status?</h3>
          <PropertyOption value="planned" label="Planned"/>
          <PropertyOption value="in_progress" label="In Progress"/>
          <PropertyOption value="done" label="Done"/>
          <PropertyOption value="backlog" label="Backlog"/>
        </template>

        <!-- Timeline Options -->
        <template v-else-if="wizardData.type === 'timeline'">
          <h3>When should tasks be scheduled?</h3>
          <PropertyOption value="today" label="Today" icon="📅"/>
          <PropertyOption value="tomorrow" label="Tomorrow" icon="📅"/>
          <PropertyOption value="weekend" label="This Weekend" icon="📅"/>
          <PropertyOption value="custom" label="Custom (manual logic)" icon="⚙️"/>
        </template>

        <!-- Project Options -->
        <template v-else-if="wizardData.type === 'project'">
          <h3>Which project?</h3>
          <ProjectSelector v-model="wizardData.propertyValue"/>
        </template>
      </div>

      <!-- Step 3: Customize Appearance -->
      <div v-if="currentStep === 3" class="step-content">
        <h3>Customize Section</h3>
        <div class="form-group">
          <label>Section Name</label>
          <input v-model="wizardData.name" placeholder="e.g., High Priority Tasks"/>
        </div>
        <div class="form-group">
          <label>Color</label>
          <ColorPicker v-model="wizardData.color"/>
        </div>
        <div class="form-group">
          <label>Size</label>
          <div class="size-inputs">
            <input v-model.number="wizardData.width" type="number"/> ×
            <input v-model.number="wizardData.height" type="number"/>
          </div>
        </div>
      </div>

      <!-- Footer with Navigation -->
      <div class="wizard-footer">
        <button v-if="currentStep > 1" @click="currentStep--" class="btn-secondary">
          ← Back
        </button>
        <button v-if="currentStep < 3" @click="nextStep" class="btn-primary">
          Next →
        </button>
        <button v-if="currentStep === 3" @click="createSection" class="btn-primary">
          Create Section
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'

interface Props {
  isOpen: boolean
  position?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  position: () => ({ x: 100, y: 100 })
})

const emit = defineEmits<{
  close: []
  created: [section: CanvasSection]
}>()

const canvasStore = useCanvasStore()
const currentStep = ref(1)

const wizardData = ref({
  type: '',
  propertyValue: '',
  name: '',
  color: '#3b82f6',
  width: 300,
  height: 250
})

const selectType = (type: string) => {
  wizardData.value.type = type
  currentStep.value = 2
}

const selectProperty = (value: string) => {
  wizardData.value.propertyValue = value

  // Auto-generate default name
  const names = {
    priority: { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' },
    status: { planned: 'Planned', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog' },
    timeline: { today: 'Today', tomorrow: 'Tomorrow', weekend: 'This Weekend' }
  }

  wizardData.value.name = names[wizardData.value.type]?.[value] || value

  currentStep.value = 3
}

const nextStep = () => {
  if (currentStep.value < 3) {
    currentStep.value++
  }
}

const createSection = () => {
  const section = canvasStore.createSection({
    name: wizardData.value.name,
    type: wizardData.value.type as any,
    propertyValue: wizardData.value.propertyValue,
    position: {
      x: props.position.x,
      y: props.position.y,
      width: wizardData.value.width,
      height: wizardData.value.height
    },
    color: wizardData.value.color,
    layout: 'grid',
    isVisible: true,
    isCollapsed: false
  })

  emit('created', section)
  emit('close')

  // Reset wizard
  currentStep.value = 1
  wizardData.value = {
    type: '',
    propertyValue: '',
    name: '',
    color: '#3b82f6',
    width: 300,
    height: 250
  }
}
</script>
```

---

### Phase 3: Wire Up Context Menu (30 mins)

**File**: `src/components/canvas/CanvasContextMenu.vue`

**Add new button**:
```vue
<button @click="emit('createSection')" class="context-menu-item">
  <Lightning :size="16" />
  Create Smart Section
</button>
```

**File**: `src/views/CanvasView.vue`

**Add state and handlers**:
```typescript
const showSectionWizard = ref(false)
const sectionWizardPosition = ref({ x: 0, y: 0 })

const createSection = () => {
  sectionWizardPosition.value = {
    x: contextMenuPosition.value.x,
    y: contextMenuPosition.value.y
  }
  showSectionWizard.value = true
  showContextMenu.value = false
}
```

**Add to template**:
```vue
<CanvasContextMenu
  @createGroup="createGroup"
  @createSection="createSection"
/>

<SectionWizard
  :isOpen="showSectionWizard"
  :position="sectionWizardPosition"
  @close="showSectionWizard = false"
  @created="handleSectionCreated"
/>
```

---

### Phase 4: Documentation Updates (1 hour)

**File**: `.claude/docs/canvas-sections-guide.md`

**Add intro section**:

```markdown
# Canvas Sections vs Groups - Complete Guide

## Quick Overview

**Two ways to organize tasks on the canvas:**

| Feature | Groups | Sections |
|---------|--------|----------|
| **Purpose** | Visual organization | Smart automation |
| **Updates tasks?** | ❌ No | ✅ Yes |
| **Creation** | Right-click → "Create Group" | Right-click → "Create Smart Section" |
| **Type** | `type: 'custom'` | `type: 'priority'|'status'|'timeline'|'project'` |
| **Example** | "Ideas", "Next Week" | "Today", "High Priority", "In Progress" |
| **Use Case** | Grouping related tasks visually | Automating task property updates |

---

## When to Use What?

### Use Groups When:
- ✅ You want to visually organize related tasks
- ✅ Tasks don't need property changes
- ✅ Quick and simple organization
- ✅ Example: "Brainstorming Ideas", "Later This Month"

### Use Sections When:
- ✅ You want tasks to automatically update when dragged in
- ✅ Setting priority, status, dates, or project assignments
- ✅ Workflow automation
- ✅ Example: "High Priority Work", "In Progress", "Today"

---

## Creating Groups (Simple)

**Steps:**
1. Right-click on canvas
2. Click "Create Group"
3. Enter name and choose color
4. Done!

**Result**: Tasks dragged into groups stay organized but don't change properties.

---

## Creating Smart Sections (Wizard)

**Steps:**
1. Right-click on canvas
2. Click "Create Smart Section"
3. **Step 1**: Choose what the section should do
   - Update Priority
   - Update Status
   - Assign to Project
   - Schedule for Date
4. **Step 2**: Choose the specific value
   - For Priority: High, Medium, or Low
   - For Status: Planned, In Progress, Done, Backlog
   - For Timeline: Today, Tomorrow, This Weekend
   - For Project: Select from your projects
5. **Step 3**: Customize name, color, and size
6. Click "Create Section"

**Result**: Tasks dragged into this section will automatically update with the chosen properties!

---

(Rest of existing documentation continues...)
```

---

## Testing Plan

### Manual Testing Checklist:

**Groups (Existing Functionality)**:
- [ ] Right-click canvas → "Create Group" opens GroupModal
- [ ] Create group with custom name and color
- [ ] Drag task into group
- [ ] Verify task properties don't change
- [ ] Verify group appears and persists

**Smart Sections (New Functionality)**:
- [ ] Right-click canvas → "Create Smart Section" opens SectionWizard
- [ ] **Priority Section**:
  - [ ] Choose "Update Priority" → "High" → Create
  - [ ] Drag task into section
  - [ ] Verify task priority becomes "high"
  - [ ] Verify UI shows high priority icon/color
- [ ] **Status Section**:
  - [ ] Choose "Update Status" → "In Progress" → Create
  - [ ] Drag task into section
  - [ ] Verify task status becomes "in_progress"
- [ ] **Timeline Section**:
  - [ ] Choose "Schedule for Date" → "Tomorrow" → Create
  - [ ] Drag task into section
  - [ ] Verify task date updates to tomorrow
  - [ ] Open edit modal → verify date field shows tomorrow
- [ ] **Project Section**:
  - [ ] Choose "Assign to Project" → Select project → Create
  - [ ] Drag task into section
  - [ ] Verify task assigned to project

**Wizard UX**:
- [ ] Step navigation (Next/Back) works
- [ ] Can't proceed without making selection
- [ ] Default names auto-populate
- [ ] Color picker works
- [ ] Size inputs accept valid numbers
- [ ] Cancel/Close works at any step

### Playwright Testing:

```typescript
test('section wizard creates priority section and updates tasks', async ({ page }) => {
  await page.goto('http://localhost:5548')

  // Navigate to canvas
  await page.click('a[href="#/canvas"]')
  await page.waitForSelector('.canvas-view')

  // Right-click to open context menu
  await page.click('.canvas-view', { button: 'right', position: { x: 400, y: 300 } })

  // Click "Create Smart Section"
  await page.click('text=Create Smart Section')

  // Step 1: Choose type
  await expect(page.locator('text=What should this section do?')).toBeVisible()
  await page.click('text=Update Priority')

  // Step 2: Choose property
  await expect(page.locator('text=Which priority level?')).toBeVisible()
  await page.click('text=High Priority')

  // Step 3: Customize (defaults should be filled)
  await expect(page.locator('input[value="High Priority"]')).toBeVisible()
  await page.click('text=Create Section')

  // Verify section appears
  await expect(page.locator('.section-node:has-text("High Priority")')).toBeVisible()

  // Create a test task
  await page.click('[data-testid="quick-task-input"]')
  await page.fill('[data-testid="quick-task-input"]', 'Test Task')
  await page.press('[data-testid="quick-task-input"]', 'Enter')

  // Drag task into section
  const task = page.locator('.task-node:has-text("Test Task")')
  const section = page.locator('.section-node:has-text("High Priority")')
  await task.dragTo(section)

  // Verify task priority updated
  await task.dblclick() // Open edit modal
  await expect(page.locator('select[value="high"]')).toBeVisible()
})
```

---

## Files Modified

### New Files:
- `src/components/canvas/SectionWizard.vue` (new wizard component)
- `docs/plans/groups-vs-sections-wizard.md` (this file)

### Modified Files:
- `src/components/canvas/CanvasContextMenu.vue` (add "Create Smart Section" button)
- `src/views/CanvasView.vue` (wire up wizard)
- `src/stores/canvas.ts` (JSDoc comments only)
- `.claude/docs/canvas-sections-guide.md` (add Groups vs Sections intro)

### No Breaking Changes:
- All existing code continues to work
- GroupModal unchanged
- API unchanged
- Backward compatible

---

## Timeline Estimate

| Phase | Time | Status |
|-------|------|--------|
| **Setup**: Create branches | 5 mins | ✅ Complete |
| **Phase 1**: Terminology updates | 1-2 hours | 🚧 In Progress |
| **Phase 2**: Build SectionWizard | 4-6 hours | ⏳ Pending |
| **Phase 3**: Wire up context menu | 30 mins | ⏳ Pending |
| **Phase 4**: Update documentation | 1 hour | ⏳ Pending |
| **Testing**: Manual + Playwright | 1 hour | ⏳ Pending |
| **Total** | **~8-10 hours** | |

---

## Rollback Plan

**If something breaks:**

```bash
# Option 1: Switch to safety branch (100% working state)
git checkout feature/canvas-date-fixes

# Option 2: Abandon feature and start fresh
git checkout feature/fix-canvas-parent-child
git branch -D feature/groups-vs-sections-wizard

# Option 3: Cherry-pick specific commits
git checkout feature/canvas-date-fixes
git cherry-pick <commit-hash>
```

---

## Future Enhancements

### Phase 5 (Future): Auto-Logic Generation

**Concept**: When users create custom timeline sections via wizard, automatically generate the detection logic in `CanvasView.vue`.

**Example**:
User creates "Tomorrow" section →
System auto-generates:
```typescript
else if (section.propertyValue === 'tomorrow') {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  updates.dueDate = formatDateKey(tomorrow)
}
```

**Complexity**: High - requires code generation and AST manipulation
**Priority**: Low - documentation-first approach is sufficient
**Estimate**: 8-12 hours

---

## Success Criteria

- [x] Safety branch created and working
- [ ] Users can distinguish between Groups and Sections
- [ ] Wizard guides users through section creation
- [ ] All section types (Priority, Status, Timeline, Project) work
- [ ] Tasks update correctly when dragged into sections
- [ ] Documentation clearly explains both features
- [ ] No breaking changes to existing functionality
- [ ] Playwright tests pass

---

## Notes

- **Terminology**: "Groups organize, Sections transform"
- **Progressive Disclosure**: Keep simple case simple (GroupModal), add wizard for advanced
- **No Code Editing**: Users should not need to edit CanvasView.vue for common use cases
- **Discoverability**: Context menu makes both features easy to find

---

**Last Updated**: October 25, 2025
**Branch**: `feature/groups-vs-sections-wizard`
**Next Steps**: Continue with Phase 1 (terminology updates)
