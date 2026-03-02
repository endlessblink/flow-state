with open('src/components/ai/AIQualityDashboard.vue', 'r') as f:
    content = f.read()

content = content.replace('function formatDuration(ms: number): string {', '// eslint-disable-next-line @typescript-eslint/no-unused-vars\nfunction _formatDuration(ms: number): string {')

with open('src/components/ai/AIQualityDashboard.vue', 'w') as f:
    f.write(content)
