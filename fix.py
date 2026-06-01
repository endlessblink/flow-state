with open('src/components/base/BaseDropdown.vue', 'r') as f:
    content = f.read()

old_str = """const listboxId = useId()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[]]
}>()"""

new_str = """const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[]]
}>()

const listboxId = useId()"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('src/components/base/BaseDropdown.vue', 'w') as f:
        f.write(content)
    print("Fixed script order.")
else:
    print("Could not find string to replace.")
