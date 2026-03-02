import re

# Fix UnifiedInboxHeader.vue defineProps ordering
with open('src/components/inbox/unified/UnifiedInboxHeader.vue', 'r') as f:
    content = f.read()

props_match = re.search(r'const props = defineProps<\{[^}]+\}>[()]*', content, re.MULTILINE | re.DOTALL)
if props_match:
    props_str = props_match.group(0)
    content = content.replace(props_str, "")
    imports_end = content.rfind("import ")
    if imports_end != -1:
        next_newline = content.find("\n", imports_end)
        content = content[:next_newline+1] + "\n" + props_str + "\n" + content[next_newline+1:]
        with open('src/components/inbox/unified/UnifiedInboxHeader.vue', 'w') as f:
            f.write(content)

# Fix CalendarInboxHeader.vue defineProps ordering
with open('src/components/inbox/calendar/CalendarInboxHeader.vue', 'r') as f:
    content = f.read()

props_match = re.search(r'const props = defineProps<\{[^}]+\}>[()]*', content, re.MULTILINE | re.DOTALL)
if props_match:
    props_str = props_match.group(0)
    content = content.replace(props_str, "")
    imports_end = content.rfind("import ")
    if imports_end != -1:
        next_newline = content.find("\n", imports_end)
        content = content[:next_newline+1] + "\n" + props_str + "\n" + content[next_newline+1:]
        with open('src/components/inbox/calendar/CalendarInboxHeader.vue', 'w') as f:
            f.write(content)
