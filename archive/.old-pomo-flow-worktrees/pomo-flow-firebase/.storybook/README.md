# Pomo Flow Storybook Design System

A comprehensive design system and component documentation for the Pomo Flow productivity application.

## 🚀 Getting Started

### Running Storybook

```bash
npm run storybook
```

This will start Storybook on `http://localhost:6006` with all components and their variants.

### Building for Production

```bash
npm run build-storybook
```

## 📁 Story Structure

Stories are organized by component category:

```
src/stories/
├── base/           # Base UI components (Button, Input, Card, etc.)
├── ui/             # UI components (TimeDisplay, Select, etc.)
├── board/          # Kanban board components (TaskCard, KanbanColumn)
├── canvas/         # Canvas components (TaskNode, SectionManager)
├── modals/         # Modal components (TaskEditModal, ConfirmationModal)
├── popups/         # Popup components (ProjectModal, QuickTaskCreate)
└── right-click-menus/  # Context menu components
```

## 🎨 Component Coverage

### Base Components (5/6 documented)
- ✅ BaseButton
- ✅ BaseInput
- ✅ BaseCard
- ✅ BaseBadge
- ✅ BaseIconButton
- ⏳ BaseNavItem

### UI Components (2/9 documented)
- ✅ TimeDisplay
- ✅ TaskCard
- ⏳ DensityController
- ⏳ CustomSelect
- ⏳ ProjectTreeItem
- ⏳ TaskManagerSidebar
- ⏳ ProjectDropZone
- ⏳ EmojiPicker
- ⏳ CommandPalette
- ⏳ ErrorBoundary

### Board Components (2/3 documented)
- ✅ TaskCard
- ⏳ KanbanColumn
- ⏳ KanbanSwimlane

### Canvas Components (2/9 documented)
- ✅ TaskNode
- ✅ InboxPanel
- ⏳ CanvasSection
- ⏳ SectionManager
- ⏳ SectionNodeSimple
- ⏳ MultiSelectionOverlay
- ⏳ CanvasContextMenu
- ⏳ EdgeContextMenu
- ⏳ InboxContextMenu

### Modal Components (5/9 documented)
- ✅ TaskEditModal
- ✅ TaskContextMenu
- ✅ ProjectModal
- ✅ ConfirmationModal
- ✅ QuickTaskCreateModal
- ⏳ QuickTaskCreate
- ⏳ SettingsModal
- ⏳ SearchModal
- ⏳ ContextMenu

## 🛠️ Available Addons

### Core Addons
- **Controls**: Interactive component props
- **Actions**: Event handling and debugging
- **Docs**: Auto-generated documentation
- **Backgrounds**: Multiple background options
- **Viewport**: Responsive testing
- **A11y**: Accessibility testing

### Development Addons
- **Chromatic**: Visual testing and publishing
- **Vitest**: Unit testing integration

## 🎯 Features

### Dark Theme Support
- Custom dark theme matching app design
- Multiple background options
- Proper color scheme handling

### Responsive Testing
- Mobile (375x667)
- Tablet (768x1024)
- Desktop (1440x900)
- Widescreen (1920x1080)

### Interactive Controls
- Real-time prop manipulation
- Event action logging
- State management testing

### Accessibility
- Manual a11y testing tools
- Screen reader support
- Keyboard navigation testing

## 📝 Story Writing Guidelines

### File Structure
```typescript
// Component.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import Component from '@/components/Component.vue'

const meta = {
  component: Component,
  title: 'category/Component-Name',
  tags: ['autodocs'],
  // ... configuration
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // component props
  },
}
```

### Best Practices

1. **Use Real Data**: All stories should use realistic, production-like data
2. **Cover All States**: Show different variants (default, hover, active, disabled, etc.)
3. **Event Handlers**: Include proper event handlers for interactive components
4. **Type Safety**: Ensure all props match TypeScript interfaces
5. **Documentation**: Add clear descriptions for props and component behavior

## 🔧 Configuration

### Main Configuration (`.storybook/main.ts`)
- Story file patterns
- Addon configuration
- Vite customization

### Preview Configuration (`.storybook/preview.ts`)
- Global decorators
- Parameter defaults
- Theme configuration
- Viewport options

### Custom Theme (`.storybook/theme.ts`)
- Brand colors
- Typography
- Component styling
- UI customization

## 🚀 Deployment

### Chromatic Publishing
Stories are automatically published to Chromatic for:
- Visual testing
- Component documentation
- Design system sharing
- Team collaboration

### Build Process
```bash
npm run build-storybook
```
Outputs to `storybook-static/` directory for deployment.

## 🤝 Contributing

When adding new components:

1. Create comprehensive stories covering all variants
2. Use real, production-like data
3. Include proper event handlers
4. Test accessibility
5. Update this README

## 📊 Statistics

- **Total Components**: 51
- **Stories Created**: 9 files
- **Coverage**: ~25%
- **Variants**: 60+ story variants
- **Addons**: 8 essential addons

---

Last updated: October 2024