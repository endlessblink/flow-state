with open('src/components/calendar/CalendarDayView.vue', 'r') as f:
    content = f.read()

content = content.replace("@dragstart=\"!calEvent.isVirtual && $emit('eventDragStart', $event, calEvent.id, slot)\"", "@dragstart=\"!calEvent.isVirtual && $emit('eventDragStart', $event, calEvent)\"")
content = content.replace("@dragend=\"!calEvent.isVirtual && $emit('eventDragEnd', slot)\"", "@dragend=\"!calEvent.isVirtual && $emit('eventDragEnd', $event, calEvent)\"")

with open('src/components/calendar/CalendarDayView.vue', 'w') as f:
    f.write(content)
