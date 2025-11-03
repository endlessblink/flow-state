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

// Emoji categories
const emojiCategories = {
  faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈'],
  food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆'],
  activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏'],
  objects: ['💎', '💍', '🌟', '⭐', '✨', '💫', '🌈', '☀️', '🌞', '🌝', '🌜', '🌛', '🌙', '🌎', '🌍', '🌏', '🌐'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘']
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.emoji-picker {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  width: 400px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.emoji-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.emoji-picker-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
}

.emoji-picker-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  border-bottom-color: #4ECDC4;
  color: #4ECDC4;
}

.tab-btn:hover:not(.active) {
  background: #f9f9f9;
}

.emoji-picker-search {
  padding: 12px 20px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #4ECDC4;
}

.emoji-picker-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.emoji-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
}

.emoji-btn:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}

.emoji-btn.selected {
  background: #4ECDC4;
  color: white;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.color-btn {
  width: 40px;
  height: 40px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.selected {
  border-color: #333;
  box-shadow: 0 0 0 2px white, 0 0 0 4px #333;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 40px 20px;
}

.emoji-picker-footer {
  display: flex;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid #eee;
  gap: 12px;
}

.clear-btn, .apply-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.clear-btn {
  background: #f0f0f0;
  color: #666;
}

.clear-btn:hover {
  background: #e0e0e0;
}

.apply-btn {
  background: #4ECDC4;
  color: white;
  flex: 1;
}

.apply-btn:hover {
  background: #45b7b0;
}

.apply-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>