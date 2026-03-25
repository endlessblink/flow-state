import re

# AIQualityDashboard
with open('src/components/ai/AIQualityDashboard.vue', 'r') as f:
    content = f.read()

content = content.replace('''<div class="grade-display">
          {{ report.grade }}
        </div>''', '''<div class="grade-display">
          {{ report.grade }}
        </div>
''')

content = content.replace('''<div class="grade-display">
          {{ report.grade }}
        </div>
''', '''<div class="grade-display">
          {{ report.grade }}
        </div>
''') # just checking

with open('src/components/ai/AIQualityDashboard.vue', 'w') as f:
    f.write(content)
