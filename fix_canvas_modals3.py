with open('src/components/canvas/CanvasModals.vue', 'r') as f:
    content = f.read()

content = content.replace("handleGroupEditSave", "handleGroupUpdated")
content = content.replace("v-on:save=\"handleGroupUpdated\"", "@save=\"handleGroupUpdated\"")
content = content.replace("CanvasGroup", "Record<string, unknown>")

with open('src/components/canvas/CanvasModals.vue', 'w') as f:
    f.write(content)
