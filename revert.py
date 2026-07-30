import re

filepath = 'tests/unit/ai-sidebar-first.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

# Just removing the temporary comments so it matches CI baseline expectations
content = content.replace("// expect(interview).toBeNull(); // Skipped to allow quickDraft assertions", "expect(interview).toBeNull();")

with open(filepath, 'w') as f:
    f.write(content)
