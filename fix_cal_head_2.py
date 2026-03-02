with open('src/components/inbox/calendar/CalendarInboxHeader.vue', 'r') as f:
    content = f.read()

content = content.replace('const { t } = useI18n()', '// eslint-disable-next-line @typescript-eslint/no-unused-vars\nconst { t } = useI18n()')

with open('src/components/inbox/calendar/CalendarInboxHeader.vue', 'w') as f:
    f.write(content)

with open('src/components/gamification/cyber/CyberAchievements.vue', 'r') as f:
    content = f.read()

content = content.replace('import { Trophy, Star, Shield, Zap, Lock } from \'lucide-vue-next\'', 'import { Trophy, Star, Shield, Zap } from \'lucide-vue-next\'')

with open('src/components/gamification/cyber/CyberAchievements.vue', 'w') as f:
    f.write(content)
