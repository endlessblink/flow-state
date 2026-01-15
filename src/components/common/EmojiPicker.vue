<template>
  <Teleport to="body">
    <div v-if="isOpen" class="emoji-picker-overlay" @click="closePicker">
      <div class="emoji-picker" @click.stop>
        <div class="emoji-picker-header">
          <h3>Choose Project Color</h3>
          <button class="close-btn" @click="closePicker">
            ×
          </button>
        </div>

        <div class="emoji-picker-tabs">
          <button
            class="tab-btn"
            :class="[{ active: activeTab === 'emoji' }]"
            @click="activeTab = 'emoji'"
          >
            😀 Emoji
          </button>
          <button
            class="tab-btn"
            :class="[{ active: activeTab === 'recent' }]"
            @click="activeTab = 'recent'"
          >
            🕐 Recent
          </button>
          <button
            class="tab-btn"
            :class="[{ active: activeTab === 'color' }]"
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
          >
        </div>

        <div class="emoji-picker-content">
          <!-- Emoji Tab -->
          <div v-if="activeTab === 'emoji'" class="emoji-grid">
            <button
              v-for="emoji in filteredEmojis"
              :key="emoji"
              class="emoji-btn"
              :class="[{ selected: selectedEmoji === emoji }]"
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
              class="emoji-btn"
              :class="[{ selected: selectedEmoji === emoji }]"
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
              class="color-btn"
              :class="[{ selected: selectedColor === color }]"
              :style="{ backgroundColor: color }"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <div class="emoji-picker-footer">
          <button class="clear-btn" @click="clearSelection">
            Clear
          </button>
          <button class="apply-btn" @click="applySelection">
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
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  business: ['📄', '📃', '📑', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🖊️', '🖋️', '📝', '📓', '📔', '📒', '📚', '📖', '📰', '💼', '💰', '💵', '💴', '💶', '💷', '💳', '💹', '🏦', '🏛️'],
  technology: ['📱', '📲', '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📠', '☎️', '📞', '📷', '📹', '🎥', '📼', '💾', '💿', '📀', '🎮', '🕹️', '🎰', '📡', '📶', '🛰️', '🔌', '🔋', '📟', '📺', '📻', '⏰', '⏳']
}

// Dark theme color palette - deeply muted tones for dark backgrounds
const colorOptions = [
  '#2D7A75', // Dark Teal
  '#1E40AF', // Navy Blue
  '#5B21B6', // Dark Purple
  '#9D174D', // Dark Pink
  '#9A3412', // Dark Orange
  '#854D0E', // Dark Gold
  '#166534', // Dark Green
  '#334155', // Dark Slate
  '#6B21A8', // Dark Violet
  '#115E59', // Dark Cyan
  '#9F1239', // Dark Rose
  '#3730A3', // Dark Indigo
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
  // Comprehensive description mapping for better search functionality
  const descriptions: Record<string, string> = {
    // Faces
    '😀': 'grinning face',
    '😃': 'grinning face with big eyes',
    '😄': 'grinning face with smiling eyes',
    '😁': 'beaming face with smiling eyes',
    '😆': 'grinning squinting face',
    '😅': 'grinning face with sweat',
    '🤣': 'rolling on the floor laughing',
    '😂': 'face with tears of joy',
    '🙂': 'slightly smiling face',
    '🙃': 'upside-down face',
    '😉': 'winking face',
    '😊': 'smiling face with smiling eyes',
    '😇': 'smiling face with halo',
    '🥰': 'smiling face with hearts',
    '😍': 'smiling face with heart-eyes',
    '🤩': 'star-struck',
    '😘': 'face blowing a kiss',
    '😗': 'kissing face',
    '☺️': 'smiling face',
    '😚': 'kissing face with closed eyes',
    '😙': 'kissing face with smiling eyes',
    '🥲': 'smiling face with tear',
    '😋': 'face savoring food',
    '😛': 'face with tongue',
    '😜': 'winking face with tongue',
    '🤪': 'zany face',
    '😝': 'squinting face with tongue',
    '🤑': 'money-mouth face',
    '🤗': 'hugging face',
    '🤭': 'face with hand over mouth',
    '🤫': 'shushing face',
    '🤔': 'thinking face',
    '🤐': 'zipper-mouth face',
    '🤨': 'face with raised eyebrow',
    '😐': 'neutral face',
    '😑': 'expressionless face',
    '😶': 'face without mouth',

    // Hearts
    '❤️': 'red heart',
    '🧡': 'orange heart',
    '💛': 'yellow heart',
    '💚': 'green heart',
    '💙': 'blue heart',
    '💜': 'purple heart',
    '🖤': 'black heart',
    '🤍': 'white heart',
    '🤎': 'brown heart',
    '💔': 'broken heart',
    '❣️': 'exclamation heart',
    '💕': 'two hearts',
    '💞': 'revolving hearts',
    '💓': 'beating heart',
    '💗': 'growing heart',
    '💖': 'sparkling heart',
    '💘': 'cupid',
    '💝': 'heart with ribbon',

    // Animals
    '🐶': 'dog',
    '🐱': 'cat',
    '🐭': 'mouse',
    '🐹': 'hamster',
    '🐰': 'rabbit',
    '🦊': 'fox',
    '🐻': 'bear',
    '🐼': 'panda',
    '🐨': 'koala',
    '🐯': 'tiger',
    '🦁': 'lion',
    '🐮': 'cow',
    '🐷': 'pig',
    '🐸': 'frog',
    '🐵': 'monkey',
    '🙈': 'see-no-evil monkey',
    '🙉': 'hear-no-evil monkey',
    '🙊': 'speak-no-evil monkey',
    '🐔': 'chicken',
    '🐧': 'penguin',
    '🐦': 'bird',
    '🐤': 'baby chick',
    '🦆': 'duck',
    '🦅': 'eagle',
    '🦉': 'owl',
    '🦋': 'butterfly',
    '🐝': 'bee',
    '🐞': 'lady beetle',

    // Food
    '🍎': 'red apple',
    '🍊': 'orange',
    '🍋': 'lemon',
    '🍌': 'banana',
    '🍉': 'watermelon',
    '🍇': 'grapes',
    '🍓': 'strawberry',
    '🍈': 'melon',
    '🍒': 'cherries',
    '🍑': 'peach',
    '🥭': 'mango',
    '🍍': 'pineapple',
    '🥥': 'coconut',
    '🥝': 'kiwi fruit',
    '🍕': 'pizza',
    '🍔': 'hamburger',
    '🍟': 'french fries',
    '🌭': 'hot dog',
    '🥪': 'sandwich',
    '🌮': 'taco',
    '🍿': 'popcorn',
    '🍩': 'doughnut',
    '🍪': 'cookie',
    '🎂': 'birthday cake',
    '🍰': 'shortcake',
    '🍫': 'chocolate bar',
    '🍬': 'candy',
    '🍭': 'lollipop',
    '☕': 'coffee',
    '🍵': 'tea',
    '🥤': 'cup with straw',

    // Nature
    '🌿': 'herb',
    '🍀': 'four leaf clover',
    '🌱': 'seedling',
    '🌲': 'evergreen tree',
    '🌳': 'deciduous tree',
    '🌴': 'palm tree',
    '🌵': 'cactus',
    '🌷': 'tulip',
    '🌸': 'cherry blossom',
    '🌹': 'rose',
    '🌺': 'hibiscus',
    '🌻': 'sunflower',
    '🌼': 'blossom',
    '🍁': 'maple leaf',
    '🍂': 'fallen leaf',
    '🍃': 'leaf fluttering in wind',
    '🌈': 'rainbow',
    '☀️': 'sun',
    '🌤️': 'sun behind small cloud',
    '⛅': 'sun behind large cloud',
    '🌥️': 'sun behind clouds',
    '☁️': 'cloud',
    '🌧️': 'cloud with rain',
    '⛈️': 'cloud with lightning and rain',
    '🌩️': 'cloud with lightning',
    '❄️': 'snowflake',
    '☃️': 'snowman with snow',
    '💧': 'droplet',
    '💦': 'splashing sweat',

    // Travel
    '✈️': 'airplane',
    '🚀': 'rocket',
    '🚁': 'helicopter',
    '🚂': 'steam locomotive',
    '🚃': 'railway car',
    '🚄': 'high-speed train',
    '🚅': 'bullet train',
    '🚆': 'train',
    '🚇': 'metro',
    '🚌': 'bus',
    '🚍': 'oncoming bus',
    '🚎': 'trolleybus',
    '🚐': 'minibus',
    '🚑': 'ambulance',
    '🚒': 'fire engine',
    '🚓': 'police car',
    '🚔': 'oncoming police car',
    '🚕': 'taxi',
    '🚖': 'oncoming taxi',
    '🚗': 'automobile',
    '🚙': 'sport utility vehicle',
    '🚚': 'delivery truck',
    '🚛': 'articulated lorry',
    '🚲': 'bicycle',
    '🛴': 'kick scooter',
    '🛹': 'skateboard',
    '⛵': 'sailboat',
    '🚤': 'speedboat',
    '🛥️': 'motor boat',
    '🛳️': 'ship',
    '⛴️': 'ferry',
    '🚢': 'anchor',

    // Symbols
    '⭐': 'star',
    '🌟': 'glowing star',
    '✨': 'sparkles',
    '💫': 'dizzy',
    '💡': 'light bulb',
    '🔔': 'bell',
    '📢': 'public address loudspeaker',
    '🎨': 'artist palette',
    '🎭': 'performing arts',
    '🎬': 'clapper board',
    '🎤': 'microphone',
    '🎧': 'headphone',
    '🎸': 'guitar',
    '🎲': 'game die',
    '🎮': 'video game',
    '🏆': 'trophy',
    '🥇': '1st place medal',
    '🥈': '2nd place medal',
    '🥉': '3rd place medal',

    // Productivity
    '💼': 'briefcase',
    '📊': 'bar chart',
    '📈': 'chart increasing',
    '💻': 'laptop computer',
    '⌨️': 'keyboard',
    '🖥️': 'desktop computer',
    '⏰': 'alarm clock',
    '📅': 'calendar',
    '🗓️': 'spiral calendar',
    '🗂️': 'card index dividers',
    '📂': 'open file folder',
    '✅': 'check mark button',
    '☑️': 'check box with check',
    '✔️': 'check mark',
    '📝': 'memo',
    '✏️': 'pencil',
    '🖊️': 'pen',
    '📖': 'open book',
    '📚': 'books',
    '📓': 'notebook with decorative cover',
    '🎯': 'bullseye',
    '⚡': 'high voltage',
    '🔥': 'fire',

    // Business (NEW)
    '📄': 'page facing up',
    '📃': 'page with curl',
    '📑': 'bookmark tabs',
    '📋': 'clipboard',
    '📌': 'pushpin',
    '📍': 'round pushpin',
    '📎': 'paperclip',
    '🖇️': 'linked paperclips',
    '📏': 'straight ruler',
    '📐': 'triangular ruler',
    '✂️': 'scissors',
    '🖋️': 'fountain pen',
    '📔': 'notebook',
    '📒': 'ledger',
    '📰': 'newspaper',
    '💰': 'money bag',
    '💵': 'dollar bill',
    '💴': 'yen banknote',
    '💶': 'euro banknote',
    '💷': 'pound banknote',
    '💳': 'credit card',
    '💹': 'chart increasing with yen',
    '🏦': 'bank',
    '🏛️': 'classical building',

    // Technology (NEW)
    '📱': 'mobile phone',
    '📲': 'mobile phone with arrow',
    '🖱️': 'computer mouse',
    '🖨️': 'printer',
    '📠': 'fax machine',
    '☎️': 'telephone',
    '📞': 'telephone receiver',
    '📷': 'camera',
    '📹': 'video camera',
    '🎥': 'movie camera',
    '📼': 'videocassette',
    '💾': 'floppy disk',
    '💿': 'optical disc',
    '📀': 'dvd',
    '🕹️': 'joystick',
    '🎰': 'slot machine',
    '📡': 'satellite antenna',
    '📶': 'antenna bars',
    '🛰️': 'satellite',
    '🔌': 'electric plug',
    '🔋': 'battery',
    '📟': 'pager',
    '📺': 'television',
    '📻': 'radio',
    '⏳': 'hourglass not done'
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
  background: var(--overlay-darker);
  backdrop-filter: blur(12px) saturate(100%);
  -webkit-backdrop-filter: blur(12px) saturate(100%);
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
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.5),
    0 16px 32px rgba(0, 0, 0, 0.3);
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
    transform: scale(0.96) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.emoji-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.emoji-picker-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  font-size: var(--text-2xl);
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
  background: var(--glass-bg-tint);
  border-color: var(--border-interactive);
  color: var(--text-primary);
  transform: scale(1.05);
}

.emoji-picker-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
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
  border-bottom-color: rgba(78, 205, 196, 0.8);
  color: rgba(78, 205, 196, 1);
  background: transparent;
}

.tab-btn:hover:not(.active) {
  background: var(--glass-bg-tint);
  color: var(--text-secondary);
}

.emoji-picker-search {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  box-sizing: border-box;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.search-input:focus {
  outline: none;
  border-color: var(--brand-primary-alpha-50);
  background: var(--glass-bg-tint);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15), 0 0 8px rgba(78, 205, 196, 0.1);
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
  font-size: var(--text-2xl);
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
  background: var(--brand-primary-bg-heavy);
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 16px rgba(78, 205, 196, 0.2);
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
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.color-btn:hover {
  transform: scale(1.1) translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}

.color-btn.selected {
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.2),
    0 8px 16px rgba(0, 0, 0, 0.4);
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
  border-top: 1px solid var(--border-subtle);
  gap: var(--space-3);
  background: transparent;
}

.clear-btn, .apply-btn {
  padding: var(--space-3) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.clear-btn {
  background: transparent;
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.clear-btn:hover {
  background: var(--glass-bg-tint);
  border-color: var(--border-interactive);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.apply-btn {
  background: var(--brand-primary-bg-medium);
  border-color: var(--brand-primary-alpha-50);
  color: rgba(78, 205, 196, 1);
  flex: 1;
}

.apply-btn:hover {
  background: rgba(78, 205, 196, 0.25);
  border-color: rgba(78, 205, 196, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(78, 205, 196, 0.2);
}

.apply-btn:disabled {
  background: transparent;
  border-color: var(--glass-border);
  color: var(--text-muted);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>