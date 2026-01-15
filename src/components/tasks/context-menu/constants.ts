
import { markRaw } from 'vue'
import {
    CheckCircle,
    Loader,
    CalendarDays,
    Inbox,
    PauseCircle,
    Zap,
    Timer,
    Clock,
    HelpCircle
} from 'lucide-vue-next'

export const statusOptions = [
    { value: 'done', label: 'Done', icon: markRaw(CheckCircle) },
    { value: 'in_progress', label: 'In Progress', icon: markRaw(Loader) },
    { value: 'planned', label: 'Planned', icon: markRaw(CalendarDays) },
    { value: 'backlog', label: 'Backlog', icon: markRaw(Inbox) },
    { value: 'on_hold', label: 'On Hold', icon: markRaw(PauseCircle) }
] as const

export const durationOptions = [
    { value: 15, label: '15 min', icon: markRaw(Zap), class: 'quick' },
    { value: 30, label: '30 min', icon: markRaw(Timer), class: 'short' },
    { value: 60, label: '1 hour', icon: markRaw(Timer), class: 'medium' },
    { value: 120, label: '2 hours', icon: markRaw(Clock), class: 'long' },
    { value: null, label: 'None', icon: markRaw(HelpCircle), class: 'none' }
] as const
