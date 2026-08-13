import re

with open('src/components/base/BaseModal.vue', 'r') as f:
    content = f.read()

# Extract script block
script_block = re.search(r'<script setup lang="ts">(.*?)</script>', content, re.DOTALL).group(1)

# Extract sections
imports = "\n".join(re.findall(r'^import .*?$', script_block, re.MULTILINE))
options = "\n".join(re.findall(r'^defineOptions\(.*?\)', script_block, re.MULTILINE))
interfaces = re.search(r'interface Props \{.*?\n\}', script_block, re.DOTALL).group(0)

# Extract everything else
rest_of_script = script_block
for string_to_remove in [imports, options, interfaces]:
    rest_of_script = rest_of_script.replace(string_to_remove, '')

# Remove double newlines
rest_of_script = re.sub(r'\n{3,}', '\n\n', rest_of_script).strip()
# Remove BUG-1724 comment which was attached to defineOptions
rest_of_script = rest_of_script.replace("// BUG-1724: Teleport root can't auto-inherit attrs (class) — disable to suppress Vue warning", "").strip()

new_script_block = f"""
{imports}

// BUG-1724: Teleport root can't auto-inherit attrs (class) — disable to suppress Vue warning
{options}

{interfaces}

{rest_of_script}
"""

content = content.replace(f'<script setup lang="ts">{script_block}</script>', f'<script setup lang="ts">\n{new_script_block.strip()}\n</script>')

with open('src/components/base/BaseModal.vue', 'w') as f:
    f.write(content)
