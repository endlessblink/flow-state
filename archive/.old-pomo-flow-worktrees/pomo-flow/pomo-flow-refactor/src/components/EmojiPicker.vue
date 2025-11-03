<template>
  <Teleport to="body">
    <div v-if="isOpen" class="emoji-picker-overlay" @click="closePicker">
      <div class="emoji-picker" @click.stop>
        <div class="emoji-picker-header">
          <h3>Choose Project Color</h3>
          <button @click="closePicker" class="close-btn">×</button>
        </div>

        <div class="emoji-picker-tabs">
          <button
            :class="['tab-btn', { active: activeTab === 'emoji' }]"
            @click="activeTab = 'emoji'"
          >
            😀 Emoji
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'recent' }]"
            @click="activeTab = 'recent'"
          >
            🕐 Recent
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'color' }]"
            @click="activeTab = 'color'"
          >
            🎨 Color
          </button>
        </div>

        <div class="emoji-picker-search">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search emojis..."
            class="search-input"
          />
        </div>

        <div class="emoji-picker-content">
          <!-- Emoji Tab -->
          <div v-if="activeTab === 'emoji'" class="emoji-grid">
            <button
              v-for="emoji in filteredEmojis"
              :key="emoji"
              :class="['emoji-btn', { selected: selectedEmoji === emoji }]"
              @click="selectEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>

          <!-- Recent Tab -->
          <div v-if="activeTab === 'recent'" class="emoji-grid">
            <button
              v-for="emoji in recentEmojis"
              :key="emoji"
              :class="['emoji-btn', { selected: selectedEmoji === emoji }]"
              @click="selectEmoji(emoji)"
            >
              {{ emoji }}
            </button>
            <div v-if="recentEmojis.length === 0" class="empty-state">
              No recent emojis yet
            </div>
          </div>

          <!-- Color Tab -->
          <div v-if="activeTab === 'color'" class="color-grid">
            <button
              v-for="color in colorOptions"
              :key="color"
              :class="['color-btn', { selected: selectedColor === color }]"
              :style="{ backgroundColor: color }"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <div class="emoji-picker-footer">
          <button @click="clearSelection" class="clear-btn">
            Clear
          </button>
          <button @click="applySelection" class="apply-btn">
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  isOpen: boolean
  currentColor?: string
  currentEmoji?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'select', data: { type: 'emoji' | 'color'; value: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const activeTab = ref<'emoji' | 'recent' | 'color'>('emoji')
const searchQuery = ref('')
const selectedEmoji = ref<string>()
const selectedColor = ref<string>()

// Emoji categories - productivity-focused for ADHD-friendly workflow
const emojiCategories = {
  productivity: ['💼', '📊', '📈', '💻', '⌨️', '🖥️', '⏰', '📅', '🗓️', '🗂️', '📂', '✅', '☑️', '✔️', '📝', '✏️', '🖊️', '📖', '📚', '📓', '🎯', '🚀', '⚡', '🔥'],
  symbols: ['⭐', '🌟', '✨', '💫', '💡', '🔔', '📢', '🎨', '🎭', '🎬', '🎤', '🎧', '🎸', '🎲', '🎮', '🏆', '🥇', '🥈', '🥉'],
  nature: ['🌿', '🍀', '🌱', '🌲', '🌳', '🌴', '🌵', '🌷', '🌸', '🌹', '🌺', '🌻', '🌼', '🍁', '🍂', '🍃', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️', '💧', '💦'],
  food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🍿', '🍩', '🍪', '🎂', '🍰', '🍫', '🍬', '🍭', '☕', '🍵', '🥤'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦋', '🐝', '🐞'],
  travel: ['✈️', '🚀', '🚁', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚙', '🚚', '🚛', '🚲', '🛴', '🛹', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢'],
  faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝']
}

const colorOptions = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#F4A460', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739',
  '#52C234', '#FF6F61', '#6B5B95', '#88D8B0', '#FFCC5C', '#FF6F69'
]

const allEmojis = computed(() => Object.values(emojiCategories).flat())

const recentEmojis = ref<string[]>([])

const filteredEmojis = computed(() => {
  if (!searchQuery.value) return allEmojis.value

  const query = searchQuery.value.toLowerCase()
  return allEmojis.value.filter(emoji =>
    emoji.includes(query) ||
    getEmojiDescription(emoji).toLowerCase().includes(query)
  )
})

const getEmojiDescription = (emoji: string): string => {
  // Simple description mapping - can be expanded
  const descriptions: Record<string, string> = {
    '😀': 'grinning face',
    '😃': 'grinning face with big eyes',
    '😄': 'grinning face with smiling eyes',
    '🐶': 'dog',
    '🐱': 'cat',
    '🍎': 'red apple',
    '⚽': 'soccer ball',
    '❤️': 'red heart'
  }
  return descriptions[emoji] || 'emoji'
}

const selectEmoji = (emoji: string) => {
  selectedEmoji.value = emoji
  selectedColor.value = undefined
}

const selectColor = (color: string) => {
  selectedColor.value = color
  selectedEmoji.value = undefined
}

const clearSelection = () => {
  selectedEmoji.value = undefined
  selectedColor.value = undefined
}

const applySelection = () => {
  if (selectedEmoji.value) {
    addToRecent(selectedEmoji.value)
    emit('select', { type: 'emoji', value: selectedEmoji.value })
  } else if (selectedColor.value) {
    emit('select', { type: 'color', value: selectedColor.value })
  }
  closePicker()
}

const closePicker = () => {
  emit('close')
}

const addToRecent = (emoji: string) => {
  const recent = [...recentEmojis.value]
  const index = recent.indexOf(emoji)

  if (index > -1) {
    recent.splice(index, 1)
  }

  recent.unshift(emoji)
  recentEmojis.value = recent.slice(0, 20) // Keep only 20 recent

  // Save to localStorage
  localStorage.setItem('recent-emojis', JSON.stringify(recentEmojis.value))
}

// Load recent emojis from localStorage
onMounted(() => {
  const saved = localStorage.getItem('recent-emojis')
  if (saved) {
    try {
      recentEmojis.value = JSON.parse(saved)
    } catch (e) {
      console.warn('Failed to load recent emojis:', e)
    }
  }

  // Set initial selection
  if (props.currentEmoji) {
    selectedEmoji.value = props.currentEmoji
    activeTab.value = 'emoji'
  } else if (props.currentColor) {
    selectedColor.value = props.currentColor
    activeTab.value = 'color'
  }
})
</script>

<style scoped>
.emoji-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  backdrop-filter: blur(12px) saturate(150%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.emoji-picker {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  width: 90%;
  max-width: 420px;
  max-height: 560px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleIn var(--duration-normal) var(--spring-bounce);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.emoji-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--glass-border);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
}

.emoji-picker-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  text-shadow: 0 2px 4px var(--shadow-subtle);
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.emoji-picker-tabs {
  display: flex;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
}

.tab-btn {
  flex: 1;
  padding: var(--space-3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.tab-btn.active {
  border-bottom-color: var(--purple-border-medium);
  color: var(--text-primary);
  background: var(--glass-bg-light);
}

.tab-btn:hover:not(.active) {
  background: var(--glass-bg-light);
  color: var(--text-secondary);
}

.emoji-picker-search {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--glass-border);
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  box-sizing: border-box;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.search-input:focus {
  outline: none;
  border-color: var(--purple-border-medium);
  background: var(--glass-bg-light);
  box-shadow: 0 0 0 3px var(--purple-glow-subtle);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.emoji-picker-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-1);
}

.emoji-btn {
  background: transparent;
  border: 1px solid transparent;
  font-size: 24px;
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-bounce);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.emoji-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
  transform: scale(1.15);
}

.emoji-btn.selected {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start) 0%,
    var(--purple-gradient-end) 100%
  );
  border-color: var(--purple-border-medium);
  box-shadow: 0 4px 8px var(--purple-shadow-strong), 0 0 16px var(--purple-glow-subtle);
  transform: scale(1.08);
}

.emoji-btn:active {
  transform: scale(0.95);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-2);
}

.color-btn {
  width: 48px;
  height: 48px;
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.color-btn:hover {
  transform: scale(1.1) translateY(-2px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.color-btn.selected {
  border-color: var(--glass-border-active);
  box-shadow:
    0 0 0 3px var(--glass-border-soft),
    0 8px 16px var(--shadow-strong);
  transform: scale(1.05);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
  font-size: var(--text-sm);
  padding: var(--space-8) var(--space-5);
}

.emoji-picker-footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--glass-border);
  gap: var(--space-3);
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glass-bg-tint) 100%
  );
}

.clear-btn, .apply-btn {
  padding: var(--space-3) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
}

.clear-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border-color: var(--glass-border);
  color: var(--text-secondary);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.clear-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}

.apply-btn {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start) 0%,
    var(--purple-gradient-end) 100%
  );
  border-color: var(--purple-border-medium);
  color: white;
  flex: 1;
  box-shadow:
    0 8px 16px var(--purple-border-medium),
    0 0 20px var(--purple-glow-subtle);
}

.apply-btn:hover {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-hover-start) 0%,
    var(--purple-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    0 12px 24px var(--purple-shadow-strong),
    0 0 30px var(--purple-border-medium);
}

.apply-btn:disabled {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border);
  color: var(--text-muted);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>