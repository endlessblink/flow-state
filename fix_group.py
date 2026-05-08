import re

with open('src/components/canvas/GroupNodeSimple.vue', 'r') as f:
    content = f.read()

content = re.sub(r'data: unknown', r'data: Record<string, any>', content)
content = re.sub(r'data:\s*\{\}', r'data: Record<string, any>', content)

with open('src/components/canvas/GroupNodeSimple.vue', 'w') as f:
    f.write(content)
