import re

with open('src/components/canvas/InboxFilters.vue', 'r') as f:
    content = f.read()

content = content.replace('''// Computed: Check if task is scheduled on calendar (has instances with dates)
const isScheduledOnCalendar = (task: Task): boolean => {
  if (!task.instances || task.instances.length === 0) return false
  return task.instances.some(inst => inst.scheduledDate)
}

''', '')

with open('src/components/canvas/InboxFilters.vue', 'w') as f:
    f.write(content)
