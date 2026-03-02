with open('src/components/calendar/CalendarDayView.vue', 'r') as f:
    content = f.read()

content = content.replace('getStatusLabel,\n  getStatusIcon\n', '_getStatusLabel,\n  _getStatusIcon\n')

with open('src/components/calendar/CalendarDayView.vue', 'w') as f:
    f.write(content)
