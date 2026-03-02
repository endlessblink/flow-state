import re

def fix_component(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Extract defineProps
    props_match = re.search(r'const props = defineProps<\{[^}]+\}>[()]*', content, re.MULTILINE | re.DOTALL)
    if props_match:
        props_str = props_match.group(0)
        content = content.replace(props_str, "")

        # Insert after imports
        imports_end = content.rfind("import ")
        if imports_end != -1:
            next_newline = content.find("\n", imports_end)
            content = content[:next_newline+1] + "\n" + props_str + "\n" + content[next_newline+1:]

        with open(filepath, 'w') as f:
            f.write(content)

fix_component('src/components/canvas/DayRotationBanner.vue')
fix_component('src/components/canvas/InboxFilters.vue')
