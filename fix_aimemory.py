import re

filepath = "src/components/ai/AIMemoryHealthDashboard.vue"

with open(filepath, "r") as f:
    content = f.read()

# Fix `<div class="grade-display">{{ report.grade }}</div>` (Line 45)
content = content.replace(
    '<div class="grade-display">{{ report.grade }}</div>',
    '<div class="grade-display">\n          {{ report.grade }}\n        </div>'
)

# Fix `<div class="stat-value">{{ report.sections.length }}</div>` (Line 59)
content = content.replace(
    '<div class="stat-value">{{ report.sections.length }}</div>',
    '<div class="stat-value">\n          {{ report.sections.length }}\n        </div>'
)

# Fix `<div class="error-banner glass">{{ error }}</div>` (Line 39)
content = content.replace(
    '<div v-if="error" class="error-banner glass">{{ error }}</div>',
    '<div v-if="error" class="error-banner glass">\n      {{ error }}\n    </div>'
)

with open(filepath, "w") as f:
    f.write(content)
