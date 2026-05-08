import re

with open('src/components/canvas/CanvasModals.vue', 'r') as f:
    content = f.read()

content = content.replace("handleGroupEditSave", "handleGroupUpdated")

with open('src/components/canvas/CanvasModals.vue', 'w') as f:
    f.write(content)
