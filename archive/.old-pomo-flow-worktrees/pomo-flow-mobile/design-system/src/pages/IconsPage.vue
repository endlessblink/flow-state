<template>
  <div class="page">
    <h1 class="page-title">Lucide Icons</h1>
    <p class="page-description">All icons used in the app - click to copy code</p>

    <section class="section">
      <h2 class="section-title">Navigation & Actions</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('Plus')">
          <Plus :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Plus</div>
        </div>
        <div class="icon-card" @click="copyIcon('X')">
          <X :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">X</div>
        </div>
        <div class="icon-card" @click="copyIcon('ChevronLeft')">
          <ChevronLeft :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ChevronLeft</div>
        </div>
        <div class="icon-card" @click="copyIcon('ChevronRight')">
          <ChevronRight :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ChevronRight</div>
        </div>
        <div class="icon-card" @click="copyIcon('ChevronDown')">
          <ChevronDown :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ChevronDown</div>
        </div>
        <div class="icon-card" @click="copyIcon('ChevronUp')">
          <ChevronUp :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ChevronUp</div>
        </div>
        <div class="icon-card" @click="copyIcon('Settings')">
          <Settings :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Settings</div>
        </div>
        <div class="icon-card" @click="copyIcon('MoreHorizontal')">
          <MoreHorizontal :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">MoreHorizontal</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Timer & Playback</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('Play')">
          <Play :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Play</div>
        </div>
        <div class="icon-card" @click="copyIcon('Pause')">
          <Pause :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Pause</div>
        </div>
        <div class="icon-card" @click="copyIcon('Square')">
          <Square :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Square</div>
        </div>
        <div class="icon-card" @click="copyIcon('RotateCcw')">
          <RotateCcw :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">RotateCcw</div>
        </div>
        <div class="icon-card" @click="copyIcon('Timer')">
          <Timer :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Timer</div>
        </div>
        <div class="icon-card" @click="copyIcon('Clock')">
          <Clock :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Clock</div>
        </div>
        <div class="icon-card" @click="copyIcon('Circle')">
          <Circle :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Circle</div>
        </div>
        <div class="icon-card" @click="copyIcon('PlayCircle')">
          <PlayCircle :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">PlayCircle</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Organization</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('FolderOpen')">
          <FolderOpen :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">FolderOpen</div>
        </div>
        <div class="icon-card" @click="copyIcon('Inbox')">
          <Inbox :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Inbox</div>
        </div>
        <div class="icon-card" @click="copyIcon('Archive')">
          <Archive :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Archive</div>
        </div>
        <div class="icon-card" @click="copyIcon('Calendar')">
          <Calendar :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Calendar</div>
        </div>
        <div class="icon-card" @click="copyIcon('ListTodo')">
          <ListTodo :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ListTodo</div>
        </div>
        <div class="icon-card" @click="copyIcon('CheckSquare')">
          <CheckSquare :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">CheckSquare</div>
        </div>
        <div class="icon-card" @click="copyIcon('Flag')">
          <Flag :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Flag</div>
        </div>
        <div class="icon-card" @click="copyIcon('BarChart3')">
          <BarChart3 :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">BarChart3</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Editing & Tools</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('Edit')">
          <Edit :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Edit</div>
        </div>
        <div class="icon-card" @click="copyIcon('Trash2')">
          <Trash2 :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Trash2</div>
        </div>
        <div class="icon-card" @click="copyIcon('Search')">
          <Search :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Search</div>
        </div>
        <div class="icon-card" @click="copyIcon('Filter')">
          <Filter :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Filter</div>
        </div>
        <div class="icon-card" @click="copyIcon('Check')">
          <Check :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Check</div>
        </div>
        <div class="icon-card" @click="copyIcon('CheckCircle')">
          <CheckCircle :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">CheckCircle</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Canvas & Layout</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('Grid3X3')">
          <Grid3X3 :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Grid3X3</div>
        </div>
        <div class="icon-card" @click="copyIcon('Layout')">
          <Layout :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Layout</div>
        </div>
        <div class="icon-card" @click="copyIcon('Maximize')">
          <Maximize :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Maximize</div>
        </div>
        <div class="icon-card" @click="copyIcon('Maximize2')">
          <Maximize2 :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Maximize2</div>
        </div>
        <div class="icon-card" @click="copyIcon('ZoomIn')">
          <ZoomIn :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ZoomIn</div>
        </div>
        <div class="icon-card" @click="copyIcon('ZoomOut')">
          <ZoomOut :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ZoomOut</div>
        </div>
        <div class="icon-card" @click="copyIcon('Eye')">
          <Eye :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Eye</div>
        </div>
        <div class="icon-card" @click="copyIcon('EyeOff')">
          <EyeOff :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">EyeOff</div>
        </div>
        <div class="icon-card" @click="copyIcon('Unlink')">
          <Unlink :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Unlink</div>
        </div>
        <div class="icon-card" @click="copyIcon('Columns')">
          <Columns :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Columns</div>
        </div>
        <div class="icon-card" @click="copyIcon('ArrowLeftRight')">
          <ArrowLeftRight :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ArrowLeftRight</div>
        </div>
        <div class="icon-card" @click="copyIcon('ArrowUpDown')">
          <ArrowUpDown :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ArrowUpDown</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Miscellaneous</h2>
      <div class="icon-grid">
        <div class="icon-card" @click="copyIcon('User')">
          <User :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">User</div>
        </div>
        <div class="icon-card" @click="copyIcon('Coffee')">
          <Coffee :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Coffee</div>
        </div>
        <div class="icon-card" @click="copyIcon('Bell')">
          <Bell :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Bell</div>
        </div>
        <div class="icon-card" @click="copyIcon('FileText')">
          <FileText :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">FileText</div>
        </div>
        <div class="icon-card" @click="copyIcon('Zap')">
          <Zap :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Zap</div>
        </div>
        <div class="icon-card" @click="copyIcon('AlertCircle')">
          <AlertCircle :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">AlertCircle</div>
        </div>
        <div class="icon-card" @click="copyIcon('ArrowRight')">
          <ArrowRight :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">ArrowRight</div>
        </div>
        <div class="icon-card" @click="copyIcon('Sun')">
          <Sun :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Sun</div>
        </div>
        <div class="icon-card" @click="copyIcon('Moon')">
          <Moon :size="24" :stroke-width="1.5" class="icon-preview" />
          <div class="icon-name">Moon</div>
        </div>
      </div>
    </section>

    <!-- Copied notification -->
    <div v-if="showCopied" class="copied-notification">
      ✓ Copied: &lt;{{ copiedIcon }} :size="16" :stroke-width="1.5" /&gt;
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Play, Pause, Square, RotateCcw, Timer, Clock, Circle, PlayCircle,
  FolderOpen, Inbox, Archive, Calendar, ListTodo, CheckSquare, Flag, BarChart3,
  Edit, Trash2, Search, Filter, Check, CheckCircle,
  Grid3X3, Layout, Maximize, Maximize2, ZoomIn, ZoomOut, Eye, EyeOff, Unlink, Columns, ArrowLeftRight, ArrowUpDown,
  User, Coffee, Bell, FileText, Zap, AlertCircle, ArrowRight, Sun, Moon, Settings, MoreHorizontal
} from 'lucide-vue-next'

const showCopied = ref(false)
const copiedIcon = ref('')

const copyIcon = async (iconName: string) => {
  const code = `<${iconName} :size="16" :stroke-width="1.5" />`
  try {
    await navigator.clipboard.writeText(code)
    copiedIcon.value = iconName
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.page {
  max-width: 1400px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
}

.page-description {
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

.section {
  margin-bottom: var(--space-12);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-primary);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-4);
}

.icon-card {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  cursor: pointer;
  transition: all var(--duration-fast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.icon-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow);
}

.icon-preview {
  color: var(--text-primary);
}

.icon-name {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  text-align: center;
}

.copied-notification {
  position: fixed;
  bottom: var(--space-8);
  right: var(--space-8);
  background: var(--color-work);
  color: white;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  animation: slideIn 0.3s ease;
  z-index: 9999;
}

@keyframes slideIn {
  from {
    transform: translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
