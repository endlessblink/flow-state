import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, computed, defineComponent, h } from 'vue'

// Mock data matching real KDE widget data shapes
const mockTasks = [
  {
    title: 'לארגן משימות / טאבים',
    taskId: 'task-1',
    pinId: 'pin-1',
    isPinned: true,
    source: 'pinned',
    projectName: 'My Projects',
    projectColor: '#4ECDC4',
    priority: 'medium',
    priorityLabel: 'P2',
    priorityColor: '#FFD93D',
    dueDate: '',
  },
  {
    title: 'פיתוח כללי',
    taskId: 'task-2',
    pinId: 'pin-2',
    isPinned: true,
    source: 'pinned',
    projectName: '',
    projectColor: '',
    priority: 'medium',
    priorityLabel: 'P2',
    priorityColor: '#FFD93D',
    dueDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  },
  {
    title: 'לכתוב היכרות עצמית',
    taskId: 'task-3',
    pinId: '',
    isPinned: false,
    source: 'recent',
    projectName: '',
    projectColor: '',
    priority: '',
    priorityLabel: '',
    priorityColor: '',
    dueDate: '',
  },
  {
    title: 'לעבור על כלים ששמרתי ואובסידיאן',
    taskId: 'task-4',
    pinId: '',
    isPinned: false,
    source: 'recent',
    projectName: 'Work',
    projectColor: '#FF6B6B',
    priority: 'low',
    priorityLabel: 'P3',
    priorityColor: '#6BCB77',
    dueDate: new Date().toISOString(), // today
  },
  {
    title: 'לתבוע ביטוח אוראו',
    taskId: 'task-5',
    pinId: '',
    isPinned: false,
    source: 'recent',
    projectName: 'Personal',
    projectColor: '#A78BFA',
    priority: 'high',
    priorityLabel: 'P1',
    priorityColor: '#FF6B6B',
    dueDate: new Date(Date.now() - 86400000).toISOString(), // overdue
  },
]

const nannyMessages = [
  'Your next session is waiting for you',
  'How about a quick focus sprint?',
  'Ready to get back in the zone?',
  'Time to make progress!',
]

const NannyPopup = defineComponent({
  name: 'NannyPopup',
  props: {
    message: { type: String, default: nannyMessages[0] },
    tasks: { type: Array, default: () => mockTasks },
    popupWidth: { type: Number, default: 500 },
    popupHeight: { type: Number, default: 520 },
    cardPadding: { type: Number, default: 24 },
    cardRadius: { type: Number, default: 20 },
    glowSize: { type: Number, default: 8 },
    titleSize: { type: Number, default: 20 },
    subtitleSize: { type: Number, default: 14 },
    taskRowHeight: { type: Number, default: 52 },
    taskTitleSize: { type: Number, default: 13 },
    detailSize: { type: Number, default: 11 },
    taskSpacing: { type: Number, default: 4 },
    playIconSize: { type: Number, default: 16 },
    showXButton: { type: Boolean, default: true },
  },
  setup(props) {
    const hoveredIndex = ref<number | null>(null)
    const hiddenTasks = ref<Set<string>>(new Set())

    const visibleTasks = computed(() =>
      (props.tasks as typeof mockTasks).filter(t => !hiddenTasks.value.has(t.taskId))
    )

    const formatDate = (dueDate: string) => {
      if (!dueDate) return ''
      const d = new Date(dueDate)
      if (isNaN(d.getTime())) return ''
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = d.toDateString() === tomorrow.toDateString()
      if (isToday) return 'Today'
      if (isTomorrow) return 'Tomorrow'
      return `${d.getDate()}/${d.getMonth() + 1}`
    }

    const dateColor = (dueDate: string) => {
      if (!dueDate) return '#888'
      const d = new Date(dueDate)
      const now = new Date()
      if (d < now && d.toDateString() !== now.toDateString()) return '#FF6B6B'
      if (d.toDateString() === now.toDateString()) return '#4ECDC4'
      return '#888'
    }

    const hideTask = (taskId: string) => {
      hiddenTasks.value = new Set([...hiddenTasks.value, taskId])
    }

    return { hoveredIndex, visibleTasks, formatDate, dateColor, hideTask }
  },
  render() {
    const p = this.$props as any
    const tealColor = '#4ECDC4'
    const bgColor = 'rgba(18, 16, 27, 0.95)'
    const textColor = '#E8E6F0'
    const mutedColor = '#888'

    return h('div', {
      style: {
        width: `${p.popupWidth}px`,
        height: `${p.popupHeight}px`,
        position: 'relative',
        fontFamily: 'Noto Sans, Noto Sans Hebrew, sans-serif',
      },
    }, [
      // Glow border
      h('div', {
        style: {
          position: 'absolute',
          inset: `${10 - p.glowSize}px`,
          borderRadius: `${p.cardRadius + p.glowSize}px`,
          border: `4px solid rgba(78, 205, 196, 0.4)`,
          pointerEvents: 'none',
        },
      }),
      // Card
      h('div', {
        style: {
          position: 'absolute',
          inset: '10px',
          borderRadius: `${p.cardRadius}px`,
          background: bgColor,
          border: `2px solid ${tealColor}`,
          padding: `${p.cardPadding}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflow: 'hidden',
        },
      }, [
        // Title
        h('div', {
          style: { fontSize: `${p.titleSize}px`, fontWeight: 'bold', color: textColor, direction: 'ltr' },
        }, `🍅  ${p.message}`),

        // Subtitle
        h('div', {
          style: { fontSize: `${p.subtitleSize}px`, color: mutedColor, direction: 'ltr' },
        }, this.visibleTasks.length > 0 ? 'Pick a task to start' : 'Start a Pomodoro to get in the zone'),

        // Task list (scrollable)
        h('div', {
          style: { display: 'flex', flexDirection: 'column', gap: `${p.taskSpacing}px`, flex: '1', minHeight: '0', overflow: 'auto' },
        }, this.visibleTasks.map((task: typeof mockTasks[0], i: number) =>
          h('div', {
            key: task.taskId,
            style: {
              height: `${p.taskRowHeight}px`,
              borderRadius: '10px',
              background: this.hoveredIndex === i ? 'rgba(78, 205, 196, 0.15)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              direction: 'rtl',
              padding: '0 12px',
              position: 'relative',
              flexShrink: '0',
              transition: 'background 0.15s',
            },
            onMouseenter: () => { this.hoveredIndex = i },
            onMouseleave: () => { this.hoveredIndex = null },
          }, [
            // Task content (right side — RTL natural)
            h('div', {
              style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' },
            }, [
              // Title line
              h('div', {
                style: {
                  fontSize: `${p.taskTitleSize}px`,
                  color: textColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  direction: 'rtl',
                  textAlign: 'right',
                },
              }, `${task.title} ${task.isPinned ? '📌' : '🍅'}`),

              // Details line
              (task.projectName || task.priorityLabel || task.dueDate) ? h('div', {
                style: {
                  display: 'flex',
                  gap: '8px',
                  direction: 'rtl',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                },
              }, [
                // Project dot + name
                task.projectName ? h('div', {
                  style: { display: 'flex', gap: '4px', alignItems: 'center', direction: 'rtl' },
                }, [
                  h('div', {
                    style: {
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: task.projectColor || tealColor,
                      flexShrink: '0',
                    },
                  }),
                  h('span', {
                    style: { fontSize: `${p.detailSize}px`, color: mutedColor },
                  }, task.projectName),
                ]) : null,

                // Priority
                task.priorityLabel ? h('span', {
                  style: {
                    fontSize: `${p.detailSize - 1}px`,
                    fontWeight: 'bold',
                    color: task.priorityColor || mutedColor,
                  },
                }, task.priorityLabel) : null,

                // Due date
                this.formatDate(task.dueDate) ? h('span', {
                  style: {
                    fontSize: `${p.detailSize - 1}px`,
                    color: this.dateColor(task.dueDate),
                  },
                }, `${this.formatDate(task.dueDate)} 📅`) : null,
              ]) : null,
            ]),

            // Play button (left side in RTL)
            h('div', {
              style: {
                fontSize: `${p.playIconSize}px`,
                color: tealColor,
                marginRight: '8px',
                flexShrink: '0',
              },
            }, '▶'),

            // X button (hide for today) — shown on hover, far left
            p.showXButton && this.hoveredIndex === i ? h('div', {
              style: {
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: mutedColor,
                marginRight: '4px',
                flexShrink: '0',
                transition: 'all 0.15s',
              },
              onClick: (e: Event) => {
                e.stopPropagation()
                this.hideTask(task.taskId)
              },
              onMouseenter: (e: MouseEvent) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255, 100, 100, 0.3)'
                el.style.color = '#FF6B6B'
              },
              onMouseleave: (e: MouseEvent) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255, 255, 255, 0.1)'
                el.style.color = mutedColor
              },
            }, '✕') : null,
          ])
        )),

        // Bottom buttons
        h('div', {
          style: { display: 'flex', justifyContent: 'center', gap: '12px', flexShrink: '0', paddingTop: '10px' },
        }, [
          // Open Widget
          h('div', {
            style: {
              padding: '10px 20px',
              borderRadius: '12px',
              border: `1.5px solid ${tealColor}`,
              color: tealColor,
              fontSize: '14px',
              cursor: 'pointer',
              background: 'transparent',
              transition: 'background 0.15s',
            },
          }, '🟩 Open Widget'),
          // Snooze
          h('div', {
            style: {
              padding: '10px 20px',
              borderRadius: '12px',
              border: `1.5px solid ${mutedColor}`,
              color: textColor,
              fontSize: '14px',
              cursor: 'pointer',
              background: 'transparent',
            },
          }, '⏰ Snooze 1hr'),
          // Stop today
          h('div', {
            style: {
              padding: '10px 20px',
              borderRadius: '12px',
              border: `1.5px solid ${mutedColor}`,
              color: textColor,
              fontSize: '14px',
              cursor: 'pointer',
              background: 'transparent',
            },
          }, '🔇 Stop today'),
        ]),

        // Dismiss hint
        h('div', {
          style: { textAlign: 'center', fontSize: '12px', color: mutedColor, opacity: '0.5', flexShrink: '0' },
        }, 'click anywhere to dismiss'),
      ]),
    ])
  },
})

const meta: Meta<typeof NannyPopup> = {
  title: 'KDE Widget/NannyPopup',
  component: NannyPopup,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a2e' },
        { name: 'desktop', value: '#2d2d44' },
      ],
    },
  },
  argTypes: {
    message: {
      control: 'select',
      options: nannyMessages,
    },
    popupWidth: { control: { type: 'range', min: 400, max: 700, step: 10 } },
    popupHeight: { control: { type: 'range', min: 350, max: 600, step: 10 } },
    cardPadding: { control: { type: 'range', min: 12, max: 40, step: 2 } },
    cardRadius: { control: { type: 'range', min: 8, max: 30, step: 2 } },
    glowSize: { control: { type: 'range', min: 0, max: 20, step: 1 } },
    titleSize: { control: { type: 'range', min: 14, max: 28, step: 1 } },
    subtitleSize: { control: { type: 'range', min: 10, max: 20, step: 1 } },
    taskRowHeight: { control: { type: 'range', min: 36, max: 72, step: 2 } },
    taskTitleSize: { control: { type: 'range', min: 10, max: 18, step: 1 } },
    detailSize: { control: { type: 'range', min: 8, max: 16, step: 1 } },
    taskSpacing: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    playIconSize: { control: { type: 'range', min: 10, max: 24, step: 1 } },
    showXButton: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof NannyPopup>

export const Default: Story = {
  args: {
    message: 'Your next session is waiting for you',
    popupWidth: 500,
    popupHeight: 520,
    cardPadding: 24,
    cardRadius: 20,
    glowSize: 8,
    titleSize: 20,
    subtitleSize: 14,
    taskRowHeight: 52,
    taskTitleSize: 13,
    detailSize: 11,
    taskSpacing: 4,
    playIconSize: 16,
    showXButton: true,
  },
}

export const Compact: Story = {
  args: {
    ...Default.args,
    popupWidth: 440,
    popupHeight: 400,
    cardPadding: 16,
    taskRowHeight: 44,
    taskTitleSize: 12,
    detailSize: 10,
    titleSize: 18,
  },
}

export const FocusSprint: Story = {
  args: {
    ...Default.args,
    message: 'How about a quick focus sprint?',
  },
}

export const OnlyPinned: Story = {
  args: {
    ...Default.args,
    tasks: mockTasks.filter(t => t.isPinned),
    popupHeight: 340,
  },
}

export const NoTasks: Story = {
  args: {
    ...Default.args,
    tasks: [],
    popupHeight: 280,
  },
}
