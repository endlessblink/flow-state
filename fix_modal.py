with open('src/components/base/BaseModal.vue', 'r') as f:
    content = f.read()

emit_block = """const emit = defineEmits<{
  close: []
  cancel: []
  confirm: []
  open: []
  afterOpen: []
  afterClose: []
}>()"""

content = content.replace(emit_block, "")
content = content.replace("const { t } = useI18n()", f"{emit_block}\n\nconst {{ t }} = useI18n()")

with open('src/components/base/BaseModal.vue', 'w') as f:
    f.write(content)
