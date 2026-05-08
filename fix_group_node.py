import re

with open('src/components/canvas/GroupNodeSimple.vue', 'r') as f:
    content = f.read()

content = content.replace('data: unknown', 'data: Record<string, any>')
content = content.replace('props.data as Record<string, unknown> | undefined', 'props.data')

with open('src/components/canvas/GroupNodeSimple.vue', 'w') as f:
    f.write(content)
