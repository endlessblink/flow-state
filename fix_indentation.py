import re

with open('src/components/base/BaseInput.vue', 'r') as f:
    lines = f.readlines()

new_lines = []
in_input = False
for i, line in enumerate(lines):
    if line.strip().startswith('<input'):
        in_input = True
        new_lines.append(line.replace('<input :dir="inputDir"', '<input\n        :dir="inputDir"'))
    elif in_input:
        if line.strip().startswith(':'):
            new_lines.append('        ' + line.strip() + '\n')
        elif line.strip().startswith('ref='):
            new_lines.append('        ' + line.strip() + '\n')
        elif line.strip().startswith('v-model='):
            new_lines.append('        ' + line.strip() + '\n')
        elif line.strip().startswith('@'):
            new_lines.append('        ' + line.strip() + '\n')
        elif line.strip().startswith('>'):
            new_lines.append('      >\n')
            in_input = False
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('src/components/base/BaseInput.vue', 'w') as f:
    f.writelines(new_lines)
