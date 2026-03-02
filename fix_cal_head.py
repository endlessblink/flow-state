with open('src/components/calendar/CalendarHeader.vue', 'r') as f:
    content = f.read()

content = content.replace(':close-on-click-outside="true"', 'close-on-click-outside')
content = content.replace('<EyeOff v-if="hideCalendarDoneTasks" :size="16" :stroke-width="1.5" class="option-icon" />', '<EyeOff\n              v-if="hideCalendarDoneTasks"\n              :size="16"\n              :stroke-width="1.5"\n              class="option-icon"\n            />')
content = content.replace('<Eye v-else :size="16" :stroke-width="1.5" class="option-icon" />', '<Eye\n              v-else\n              :size="16"\n              :stroke-width="1.5"\n              class="option-icon"\n            />')

with open('src/components/calendar/CalendarHeader.vue', 'w') as f:
    f.write(content)
