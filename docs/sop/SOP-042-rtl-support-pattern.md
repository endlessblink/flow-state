# SOP-042: RTL Support Pattern for Text Inputs

**Created**: 2026-01-30
**Related**: BUG-1108
**Status**: Active

## Overview

FlowState supports Hebrew, Arabic, Persian, and Urdu users. Text inputs must auto-detect RTL languages and adjust direction accordingly.

## Problem

Without RTL support:
- Hebrew/Arabic text displays left-to-right (hard to read)
- Cursor position is confusing
- Text editing feels broken

## Solution: Auto-Detection Pattern

### Step 1: Add RTL Detection Computed Property

```typescript
// RTL detection for text (Hebrew, Arabic, Persian, Urdu Unicode ranges)
const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const textDirection = computed(() => {
  if (!textValue.value.trim()) return 'auto'
  const firstChar = textValue.value.trim()[0]
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})
```

### Step 2: Bind to Input Element

```html
<textarea
  v-model="textValue"
  :dir="textDirection"
  ...
/>

<input
  v-model="textValue"
  :dir="textDirection"
  type="text"
  ...
/>
```

## Unicode Ranges Covered

| Range | Script |
|-------|--------|
| `\u0590-\u05FF` | Hebrew |
| `\u0600-\u06FF` | Arabic |
| `\u0750-\u077F` | Arabic Supplement |
| `\u08A0-\u08FF` | Arabic Extended-A |
| `\uFB50-\uFDFF` | Arabic Presentation Forms-A |
| `\uFE70-\uFEFF` | Arabic Presentation Forms-B |

## Components with RTL Support

| Component | Field | Status |
|-----------|-------|--------|
| `TaskCreateBottomSheet.vue` | Title textarea | ✅ Implemented |
| `TaskEditBottomSheet.vue` | Title input | ✅ Implemented |
| `TaskEditBottomSheet.vue` | Description textarea | ✅ Implemented |
| `VoiceTaskConfirmation.vue` | Title textarea | ✅ Reference implementation |
| `TaskCard.vue` | Display text | ⚠️ Check if needed |
| `TaskEditModal.vue` | All inputs | ⚠️ Check if needed |

## Full Example

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const taskTitle = ref('')

// RTL detection
const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const titleDirection = computed(() => {
  if (!taskTitle.value.trim()) return 'auto'
  const firstChar = taskTitle.value.trim()[0]
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})
</script>

<template>
  <textarea
    v-model="taskTitle"
    :dir="titleDirection"
    placeholder="What needs to be done?"
  />
</template>
```

## Testing RTL Support

1. Open task creation modal on mobile
2. Type Hebrew text: `לבדוק את המשימה`
3. Verify:
   - Text aligns to the right
   - Cursor is on the left side
   - Text flows right-to-left
4. Switch to English and verify LTR works

## CSS Considerations

The `dir` attribute handles most styling, but you may need:

```css
/* Optional: Explicit RTL text alignment */
[dir="rtl"] {
  text-align: right;
}

/* Placeholder alignment */
textarea[dir="rtl"]::placeholder {
  text-align: right;
}
```

## Related Files

- `src/mobile/components/TaskCreateBottomSheet.vue`
- `src/mobile/components/TaskEditBottomSheet.vue`
- `src/mobile/components/VoiceTaskConfirmation.vue` (reference)
