with open('src/components/canvas/CanvasEmptyState.vue', 'r') as f:
    content = f.read()

content = content.replace('''          <line class="connector connector-1" x1="80" y1="72" x2="160" y2="100" stroke-dasharray="4 3" />
          <line class="connector connector-2" x1="240" y1="68" x2="160" y2="100" stroke-dasharray="4 3" />
          <line class="connector connector-3" x1="160" y1="100" x2="160" y2="148" stroke-dasharray="4 3" />''', '''          <line
            class="connector connector-1"
            x1="80"
            y1="72"
            x2="160"
            y2="100"
            stroke-dasharray="4 3"
          />
          <line
            class="connector connector-2"
            x1="240"
            y1="68"
            x2="160"
            y2="100"
            stroke-dasharray="4 3"
          />
          <line
            class="connector connector-3"
            x1="160"
            y1="100"
            x2="160"
            y2="148"
            stroke-dasharray="4 3"
          />''')

content = content.replace('''      <span v-for="i in 24" :key="i" class="grid-dot" :style="gridDotStyle(i)" />''', '''      <span
        v-for="i in 24"
        :key="i"
        class="grid-dot"
        :style="gridDotStyle(i)"
      />''')

with open('src/components/canvas/CanvasEmptyState.vue', 'w') as f:
    f.write(content)
