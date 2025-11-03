# Complete Design Transformation Guide

## Current State (Commit fb65f48)
- ✅ Canvas MVP working
- ✅ Naive UI installed
- ✅ Modern design tokens created
- ✅ All features functional

## Transformation Plan

### Step 1: Configure Naive UI (30 min)

**App.vue - Wrap with NConfigProvider:**
```vue
<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <!-- Your existing app structure -->
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'

const themeOverrides = {
  common: {
    primaryColor: '#667eea',
    borderRadius: '8px'
  }
}
</script>
```

### Step 2: Create Glass Utilities (30 min)

**src/assets/glass-utilities.css:**
```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
}
```

### Step 3: Transform Views One by One

**Priority order:**
1. **Kanban** (most used) - 2-3 hours
2. **Calendar** (complex) - 3-4 hours
3. **Canvas** (newest) - 2 hours
4. **Global nav** - 1 hour

### Step 4: Test Everything

After each view transformation:
- ✅ Test drag and drop still works
- ✅ Test all interactions
- ✅ Verify no performance regression
- ✅ Check on different screen sizes

## Expected Result

**Before:** Fragmented, dated, inconsistent
**After:** Cohesive, modern, Linear/Notion-quality design

All functionality preserved, just visually transformed!
