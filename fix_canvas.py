import re

with open('src/components/canvas/CanvasEmptyState.vue', 'r') as f:
    content = f.read()

content = content.replace('<circle class="node-dot node-dot-1" cx="80" cy="72" r="4" />', '''<circle
            class="node-dot node-dot-1"
            cx="80"
            cy="72"
            r="4"
          />''')
content = content.replace('<circle class="node-dot node-dot-2" cx="240" cy="68" r="4" />', '''<circle
            class="node-dot node-dot-2"
            cx="240"
            cy="68"
            r="4"
          />''')
content = content.replace('<circle class="node-dot node-dot-3" cx="160" cy="148" r="4" />', '''<circle
            class="node-dot node-dot-3"
            cx="160"
            cy="148"
            r="4"
          />''')
content = content.replace('<circle class="node-center" cx="160" cy="100" r="6" />', '''<circle
            class="node-center"
            cx="160"
            cy="100"
            r="6"
          />''')
content = content.replace('<rect x="28" y="44" width="104" height="56" rx="8" class="task-card-rect" />', '''<rect
              x="28"
              y="44"
              width="104"
              height="56"
              rx="8"
              class="task-card-rect"
            />''')

with open('src/components/canvas/CanvasEmptyState.vue', 'w') as f:
    f.write(content)
