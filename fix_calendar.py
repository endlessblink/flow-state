with open('src/components/calendar/CalendarDayView.vue', 'r') as f:
    content = f.read()

content = content.replace("@dragend=\"!calEvent.isVirtual && $emit('eventDragEnd', slot)\"", "@dragend=\"!calEvent.isVirtual && $emit('eventDragEnd', slot, calEvent)\"")
content = content.replace("calEvent.id, slot", "calEvent.id, slot.time")

with open('src/components/calendar/CalendarDayView.vue', 'w') as f:
    f.write(content)
