import re

filepath = "src/components/ai/AIChatPanel.vue"

with open(filepath, "r") as f:
    content = f.read()

content = content.replace(
    """<OverflowTooltip v-if="headerBadgeText" class="provider-badge" :class="'provider-' + activeProvider" :text="headerBadgeText">{{ headerBadgeText }}</OverflowTooltip>""",
    """<OverflowTooltip
            v-if="headerBadgeText"
            class="provider-badge"
            :class="'provider-' + activeProvider"
            :text="headerBadgeText"
          >
            {{ headerBadgeText }}
          </OverflowTooltip>"""
)

content = content.replace(
    """<OverflowTooltip class="chat-history-title" :text="conv.title" style="flex: 1; min-width: 0">{{ conv.title }}</OverflowTooltip>""",
    """<OverflowTooltip
                      class="chat-history-title"
                      :text="conv.title"
                      style="flex: 1; min-width: 0"
                    >
                      {{ conv.title }}
                    </OverflowTooltip>"""
)

with open(filepath, "w") as f:
    f.write(content)
