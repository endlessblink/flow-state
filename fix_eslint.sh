#!/bin/bash
# 1. CanvasEmptyState.vue
sed -i 's/<div class="canvas-empty-state" :style="{ zIndex }">/<div\n    class="canvas-empty-state"\n    :style="{ zIndex }"\n  >/g' src/components/canvas/CanvasEmptyState.vue
sed -i 's/<line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" stroke-dasharray="2,2" \/>/<line\n          x1="0"\n          y1="0"\n          x2="100"\n          y2="100"\n          stroke="currentColor"\n          stroke-dasharray="2,2"\n        \/>/g' src/components/canvas/CanvasEmptyState.vue
sed -i 's/<line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" stroke-dasharray="2,2" \/>/<line\n          x1="100"\n          y1="0"\n          x2="0"\n          y2="100"\n          stroke="currentColor"\n          stroke-dasharray="2,2"\n        \/>/g' src/components/canvas/CanvasEmptyState.vue

# 2. CalendarHeader.vue (Boolean prop with 'true' value)
sed -i 's/:active="true"/active/g' src/components/calendar/CalendarHeader.vue
sed -i 's/:compact="true"/compact/g' src/components/calendar/CalendarHeader.vue
sed -i 's/:border="true"/border/g' src/components/calendar/CalendarHeader.vue
sed -i 's/:disabled="true"/disabled/g' src/components/calendar/CalendarHeader.vue
sed -i 's/:clearable="true"/clearable/g' src/components/calendar/CalendarHeader.vue

# 3. CalendarDayView.vue
sed -i 's/const props = defineProps/const _props = defineProps/g' src/components/calendar/CalendarDayView.vue
sed -i 's/function getStatusIcon/function _getStatusIcon/g' src/components/calendar/CalendarDayView.vue
sed -i 's/function getStatusLabel/function _getStatusLabel/g' src/components/calendar/CalendarDayView.vue

# 4. AIQualityDashboard.vue
sed -i 's/@click="handleRunEvaluation" title="Run manual quality assessment"/title="Run manual quality assessment"\n          @click="handleRunEvaluation"/g' src/components/ai/AIQualityDashboard.vue
sed -i 's/<div class="grade-display">{{ report.grade }}<\/div>/<div class="grade-display">\n          {{ report.grade }}\n        <\/div>/g' src/components/ai/AIQualityDashboard.vue

# 5. AIMemoryHealthDashboard.vue
sed -i 's/<div class="stat-value">{{ report.sections.length }}<\/div>/<div class="stat-value">\n          {{ report.sections.length }}\n        <\/div>/g' src/components/ai/AIMemoryHealthDashboard.vue
sed -i 's/<p class="empty-hint">"Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).<\/p>/<p class="empty-hint">\n        "Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).\n      <\/p>/g' src/components/ai/AIMemoryHealthDashboard.vue
sed -i 's/<div class="stat-value">{{ currentHealth.memoryUsage }} \/ {{ currentHealth.memoryLimit }}<\/div>/<div class="stat-value">\n          {{ currentHealth.memoryUsage }} \/ {{ currentHealth.memoryLimit }}\n        <\/div>/g' src/components/ai/AIMemoryHealthDashboard.vue
sed -i 's/<button class="btn btn-sm" @click="handleClearMemory">Clear Memory<\/button>/<button\n            class="btn btn-sm"\n            @click="handleClearMemory"\n          >\n            Clear Memory\n          <\/button>/g' src/components/ai/AIMemoryHealthDashboard.vue
