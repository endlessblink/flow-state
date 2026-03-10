import re

filepath = "src/components/canvas/CanvasModals.vue"

with open(filepath, "r") as f:
    content = f.read()

# Fix the $emit overload issues by casting the arguments correctly, or just letting Vue infer it.
# The issue is passing `(group) => $emit(...)` instead of directly emitting.
# We'll just define wrapper functions or use `$emit` directly without arrow functions.
# The error "No overload matches this call" typically happens when $emit is passed an event name but the payload type doesn't perfectly align in template checking.
# Easiest way in template is: @created="$emit('handleGroupCreated', $event)"

content = content.replace(
    """@created="(group) => $emit('handleGroupCreated', group)"
    @updated="(group) => $emit('handleGroupUpdated', group)"
  />""",
    """@created="$emit('handleGroupCreated', $event as any)"
    @updated="$emit('handleGroupUpdated', $event as any)"
  />"""
)

content = content.replace(
    """@save="(updatedSection) => $emit('handleGroupEditSave', updatedSection)"
  />""",
    """@save="$emit('handleGroupEditSave', $event as any)"
  />"""
)

content = content.replace(
    """@save="(settings) => $emit('handleSectionSettingsSave', settings)"
  />""",
    """@save="$emit('handleSectionSettingsSave', $event as any)"
  />"""
)

with open(filepath, "w") as f:
    f.write(content)
