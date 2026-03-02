with open('src/components/ai/AIMemoryHealthDashboard.vue', 'r') as f:
    content = f.read()

content = content.replace('<div class="grade-display">{{ report.grade }}</div>', '<div class="grade-display">\n          {{ report.grade }}\n        </div>')
content = content.replace('<div class="stat-value">{{ report.sections.length }}</div>', '<div class="stat-value">\n          {{ report.sections.length }}\n        </div>')
content = content.replace('<div class="stat-value stat-value--small">{{ formatDuration(report.durationMs) }}</div>', '<div class="stat-value stat-value--small">\n          {{ formatDuration(report.durationMs) }}\n        </div>')
content = content.replace('<p class="empty-hint">"Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).</p>', '<p class="empty-hint">\n        "Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).\n      </p>')

with open('src/components/ai/AIMemoryHealthDashboard.vue', 'w') as f:
    f.write(content)
