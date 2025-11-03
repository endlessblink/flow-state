# 🎨 POMO-FLOW DESIGN SYSTEM
*Visual Foundation for Multi-View Productivity Excellence*

## 📋 Overview

The pomo-flow design system provides a comprehensive visual foundation for your sophisticated productivity ecosystem, ensuring consistency across all 5 view modes while optimizing for focus and deep work.

### Design Philosophy: "Focused Flow"
- **Calm Productivity** - Reduce visual noise, enhance concentration
- **Spatial Consistency** - Same elements feel familiar across views
- **Progressive Disclosure** - Advanced features revealed contextually
- **Desktop Excellence** - Rich, professional interface design
- **Focus Enhancement** - Visual psychology supporting deep work

---

## 🌈 Color System

### Primary Colors - Deep Work Focus
```css
--color-primary-500: #6b7cff  /* Main brand color - calming navy */
--color-pomodoro-500: #ef4444  /* Timer red - energizing focus */
--color-success-500: #10b981   /* Completion green - satisfying achievement */
--color-warning-500: #f59e0b   /* Attention amber - needs focus */
```

### Task Status Colors
- **Todo**: `#94a3b8` - Neutral, ready state
- **In Progress**: `#3b82f6` - Active blue, energizing
- **Review**: `#f59e0b` - Warm attention amber
- **Done**: `#10b981` - Satisfying achievement green
- **Blocked**: `#ef4444` - Alert red, needs attention

### Canvas & Dependency Colors
- **Blocks Dependency**: `#dc2626` - Critical path red
- **Prerequisite**: `#2563eb` - Strong dependency blue
- **Related**: `#6b7280` - Loose connection gray
- **Selection**: `#8b5cf6` - Canvas selection purple
- **Connection**: `#10b981` - Active connection green

### Theme Switching
```typescript
// Easy theme changes
document.documentElement.dataset.theme = 'dark';   // Dark mode
document.documentElement.dataset.theme = 'focus';  // Focus mode
document.documentElement.dataset.theme = 'light';  // Default
```

---

## 📝 Typography

### Font Stack
- **Interface**: Inter (professional, readable)
- **Timers**: JetBrains Mono (precise, technical)
- **Display**: Cal Sans (friendly, approachable)

### Typography Scale
```css
/* Headers */
--text-heading-xl: 1.875rem   /* Page titles */
--text-heading-lg: 1.5rem     /* Section headers */
--text-heading-md: 1.25rem    /* Subsection headers */

/* Body Text */
--text-body-lg: 1.125rem      /* Primary content */
--text-body-md: 1rem          /* Standard text */
--text-body-sm: 0.875rem      /* Secondary content */

/* Timer Display */
--text-timer-xl: 3rem         /* Main timer */
--text-timer-lg: 2rem         /* Widget timer */
```

### Usage Examples
```jsx
<h1 className="text-heading-xl font-semibold text-slate-800">
  Project Alpha
</h1>

<div className="text-timer-lg font-mono font-bold text-pomodoro-600">
  25:00
</div>

<p className="text-body-md text-slate-700 leading-normal">
  Task description goes here
</p>
```

---

## 📏 Spacing System

### 8px Base Grid
```css
--spacing-2: 0.5rem      /* 8px - Base unit */
--spacing-4: 1rem        /* 16px - Element padding */
--spacing-6: 1.5rem      /* 24px - Section spacing */
--spacing-8: 2rem        /* 32px - Component separation */
```

### Layout Dimensions
```css
--sidebar-width-normal: 15rem     /* 240px */
--task-card-width: 18rem          /* 288px */
--canvas-node-width: 12.5rem      /* 200px */
--header-height: 3.5rem           /* 56px */
```

### Usage Patterns
```jsx
<div className="p-6 gap-4">          {/* 24px padding, 16px gap */}
<div className="space-y-2">          {/* 8px vertical spacing */}
<div className="w-task-card">        {/* 288px task card width */}
```

---

## 🧩 Component Styles

### Universal Task Base
```css
.task-base {
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  transition: all var(--duration-fast) var(--ease-in-out);
}
```

**Usage across all views:**
- List view task rows
- Kanban task cards
- Calendar time blocks
- Canvas task nodes

### Status Indicators
```jsx
<div className="task-status status-in-progress">
  <Icon name="play-circle" size="sm" />
  <span>In Progress</span>
</div>
```

### Pomodoro Progress
```jsx
<div className="pomodoro-progress">
  <div className="progress-track">
    <div className="progress-completed" style={{width: '60%'}} />
    <div className="progress-current" style={{width: '20%'}} />
  </div>
  <span className="tomato-count">3/5 🍅</span>
</div>
```

---

## 🎨 Icon System

### Icon Component Usage
```jsx
import { Icon, StatusIcon, ViewIcon, CustomIcon } from './components/icons/Icon';

// Standard icons
<Icon name="play" size="md" color="interactive" />

// Status icons with semantic colors
<StatusIcon status="in_progress" size="sm" />

// View navigation icons
<ViewIcon view="canvas" active={currentView === 'canvas'} />

// Custom productivity icons
<CustomIcon name="tomato" size="lg" />
```

### Icon Categories
- **Navigation**: list-view, kanban-board, calendar-days, network, timeline
- **Status**: circle, play-circle, clock, check-circle, x-circle
- **Actions**: plus, pencil, trash, copy, archive
- **Timer**: play, pause, square
- **Canvas**: arrow-right, shield-x, link, grid-3x3, zoom-in
- **Custom**: tomato, dependency-arrow, focus-mode

---

## 🎭 Animation System

### Animation Philosophy
- **Purposeful** - Every animation serves user understanding
- **Calm** - No distracting or bouncy animations
- **Performance** - 60fps with GPU acceleration
- **Accessibility** - Respects reduced motion preferences

### Animation Classes
```jsx
// Entrance animations
<div className="animate-slide-in-up">New task</div>
<div className="animate-fade-in">Modal backdrop</div>
<div className="animate-scale-in">Popup menu</div>

// Timer animations
<div className="animate-timer-pulse">Active timer</div>
<div className="animate-timer-blink">Timer separator</div>

// Task interactions
<div className="animate-task-complete">Completed task</div>
<div className="animate-node-select">Selected canvas node</div>

// Loading states
<div className="loading-shimmer">Loading content</div>
```

### Custom Animation Integration
```css
/* Component-specific animations */
.timer-widget.timer-active {
  animation: timer-pulse 3s infinite ease-in-out;
}

.canvas-node.selected {
  animation: node-select 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.task-row.completed {
  animation: task-complete 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 🖥️ View-Specific Styling

### List View
- **Hierarchical indentation**: 24px per level with left border
- **Expand/collapse toggles**: Smooth rotation animations
- **Hover actions**: Fade-in action buttons on row hover

### Kanban View
- **Column backgrounds**: Subtle gray (`#f8fafc`) for visual separation
- **Card hover states**: Lift effect with enhanced shadow
- **Drag feedback**: Rotation and scale during drag operations

### Calendar View
- **Time slot grid**: Clean borders with hover states
- **Time blocks**: Left border accent with gradient backgrounds
- **Drop zones**: Animated border highlighting for valid drops

### Canvas View
- **Node design**: Rounded cards with status indicators and progress
- **Dependency arrows**: Curved paths with type-specific colors
- **Selection states**: Purple glow with scale animation
- **Controls overlay**: Floating controls with backdrop blur

---

## 🎯 Implementation Guide

### CSS Import Order
```css
/* 1. Design tokens - Foundation */
@import './design-tokens.css';

/* 2. Component styles - Building blocks */
@import './components.css';

/* 3. Animations - Interactive layer */
@import './animations.css';

/* 4. Tailwind utilities - Final layer */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Component Integration
```jsx
// Use design system classes
import './styles/design-tokens.css';
import './styles/components.css';
import './styles/animations.css';

const TaskCard = ({ task, selected, onSelect }) => (
  <div className={`
    task-base
    hover-lift-glow
    ${selected ? 'selected animate-node-select' : ''}
    interactive-element
    focus-ring
  `}>
    <div className="task-header">
      <h3 className="text-body-lg font-medium text-slate-800">
        {task.title}
      </h3>
      <StatusIcon status={task.status} />
    </div>

    <div className="pomodoro-progress">
      {/* Progress implementation */}
    </div>
  </div>
);
```

### Theme Switching
```typescript
// Theme management utility
export const themeManager = {
  setTheme: (theme: 'light' | 'dark' | 'focus') => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pomo-flow-theme', theme);
  },

  getTheme: () => {
    return localStorage.getItem('pomo-flow-theme') || 'light';
  },

  initTheme: () => {
    const savedTheme = themeManager.getTheme();
    themeManager.setTheme(savedTheme);
  },
};
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
```

### 2. Import Styles
```jsx
// src/main.tsx
import './styles/design-tokens.css';
import './styles/components.css';
import './styles/animations.css';
import './index.css'; // Tailwind imports
```

### 3. Use Components
```jsx
// Example implementation
const App = () => (
  <div className="app-layout">
    <header className="app-header">
      <div className="app-title">
        <CustomIcon name="tomato" size="lg" />
        <span>Pomo-Flow</span>
      </div>

      <div className="timer-widget timer-active">
        <div className="timer-display">25:00</div>
        <TimerIcon state="active" />
      </div>
    </header>

    <div className="app-sidebar">
      <nav className="view-navigation">
        <button className="view-tab active">
          <ViewIcon view="list" active />
          <span>List</span>
        </button>
      </nav>
    </div>

    <main className="main-content">
      {/* Your views here */}
    </main>
  </div>
);
```

---

## 🎯 Design System Benefits

### ✅ **Multi-View Consistency**
- Same visual language across List, Kanban, Calendar, Canvas, Timeline
- Unified task representation with consistent status indicators
- Harmonious color and spacing relationships

### ✅ **Productivity Optimization**
- Color psychology supporting focus and concentration
- Calm animations that don't disrupt workflow
- Clear visual hierarchy for information processing

### ✅ **Easy Updates**
- 5-second theme changes with CSS variables
- Automatic propagation across all components
- Future-proof architecture for design evolution

### ✅ **Developer Experience**
- Type-safe icon system with IntelliSense
- Tailwind integration with custom design tokens
- Performance-optimized animations with GPU acceleration

### ✅ **Accessibility First**
- WCAG 2.1 compliant color contrasts
- Reduced motion support for users with vestibular disorders
- Focus indicators and keyboard navigation support

---

## 🚀 Ready for Implementation

**Your design system provides:**
- **Complete visual foundation** for all 5 view modes
- **Productivity-optimized** color and animation choices
- **Scalable architecture** that grows with your app
- **Update flexibility** for design evolution
- **Professional aesthetics** rivaling top productivity tools

**Next Steps:**
1. **Import design system** into your React components
2. **Implement layout structure** using design tokens
3. **Apply component styles** to your view implementations
4. **Add animations** for delightful micro-interactions

Your pomo-flow productivity app will have **world-class visual design** that enhances focus, reduces cognitive load, and makes complex multi-view interactions feel effortless! 🎯

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create design tokens CSS file", "status": "completed", "activeForm": "Creating design tokens CSS file"}, {"content": "Generate component style definitions", "status": "completed", "activeForm": "Generating component style definitions"}, {"content": "Create icon system implementation", "status": "completed", "activeForm": "Creating icon system implementation"}, {"content": "Build animation utility classes", "status": "completed", "activeForm": "Building animation utility classes"}, {"content": "Create Tailwind CSS configuration", "status": "completed", "activeForm": "Creating Tailwind CSS configuration"}, {"content": "Generate design system documentation", "status": "completed", "activeForm": "Generating design system documentation"}]