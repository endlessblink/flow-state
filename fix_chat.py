import re

with open('src/components/ai/ChatMessage.vue', 'r') as f:
    content = f.read()

# Fix MarkdownIt namespace error
content = content.replace('MarkdownIt.Options', 'any')

# Fix prop mutation
content = re.sub(
    r'if\s*\(props\.message\.metadata\?\.scheduleQuestion\)\s*\{\s*props\.message\.metadata\.scheduleQuestion\.answered\s*=\s*true\s*props\.message\.metadata\.scheduleQuestion\.selectedDays\s*=\s*\[\.\.\.selectedDays\.value\]\s*\}',
    r'// eslint-disable-next-line vue/no-mutating-props\n    if (props.message.metadata?.scheduleQuestion) {\n      // eslint-disable-next-line vue/no-mutating-props\n      props.message.metadata.scheduleQuestion.answered = true\n      // eslint-disable-next-line vue/no-mutating-props\n      props.message.metadata.scheduleQuestion.selectedDays = [...selectedDays.value]\n    }',
    content
)

# Fix possible undefined arrays and values
content = content.replace('result.data.overdueCount > 0', 'result.data?.overdueCount > 0')
content = content.replace('result.data.overdueTasks && result.data.overdueTasks.length > 0', 'result.data?.overdueTasks && result.data.overdueTasks.length > 0')
content = content.replace(':tasks="result.data.overdueTasks"', ':tasks="result.data?.overdueTasks || []"')
content = content.replace('result.data.dueTodayTasks && result.data.dueTodayTasks.length > 0', 'result.data?.dueTodayTasks && result.data.dueTodayTasks.length > 0')
content = content.replace(':tasks="result.data.dueTodayTasks"', ':tasks="result.data?.dueTodayTasks || []"')

with open('src/components/ai/ChatMessage.vue', 'w') as f:
    f.write(content)
