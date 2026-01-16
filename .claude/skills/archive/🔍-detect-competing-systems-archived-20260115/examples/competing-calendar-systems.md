# Competing Calendar Systems

## Scenario: Multiple Calendar Implementations

### ❌ BAD - Three Different Calendar Implementations

**Component 1: src/components/CalendarView.vue (Inline Calendar Logic)**
```vue
<template>
  <div class="calendar-view">
    <div class="calendar-header">
      <button @click="previousMonth">‹</button>
      <h2>{{ currentMonthYear }}</h2>
      <button @click="nextMonth">›</button>
      <button @click="goToToday">Today</button>
    </div>

    <div class="calendar-grid">
      <div class="weekdays">
        <div v-for="day in weekdayNames" :key="day" class="weekday">
          {{ day }}
        </div>
      </div>
      <div class="calendar-days">
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="calendar-day"
          :class="{
            'other-month': day === null,
            'today': isToday(day),
            'selected': isSelected(day)
          }"
          @click="selectDate(day)"
        >
          <span v-if="day">{{ day }}</span>
        </div>
      </div>
    </div>

    <div class="calendar-events">
      <h3>Events for {{ selectedDateFormatted }}</h3>
      <div v-for="event in eventsForSelectedDate" :key="event.id" class="event">
        {{ event.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTaskStore } from '@/stores/TaskStore';

const taskStore = useTaskStore();
const currentDate = ref(new Date());
const selectedDate = ref(new Date());

// Inline calendar calculations (implementation #1)
const currentMonthYear = computed(() => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[currentDate.value.getMonth()]} ${currentDate.value.getFullYear()}`;
});

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  return new Date(year, month + 1, 0).getDate();
});

const firstDayOfMonth = computed(() => {
  return new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    1
  ).getDay();
});

const calendarDays = computed(() => {
  const days = [];
  const daysInPrevMonth = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    0
  ).getDate();

  // Previous month days
  for (let i = firstDayOfMonth.value - 1; i >= 0; i--) {
    days.push(daysInPrevMonth - i);
  }

  // Current month days
  for (let i = 1; i <= daysInMonth.value; i++) {
    days.push(i);
  }

  // Next month days to fill the grid
  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
});

const selectedDateFormatted = computed(() => {
  return selectedDate.value.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const eventsForSelectedDate = computed(() => {
  return taskStore.tasks.filter(task => {
    if (!task.dueDate) return false;
    const taskDate = new Date(task.dueDate);
    return taskDate.toDateString() === selectedDate.value.toDateString();
  });
});

const isToday = (day: number | null) => {
  if (!day) return false;
  const today = new Date();
  const compareDate = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    day
  );
  return compareDate.toDateString() === today.toDateString();
};

const isSelected = (day: number | null) => {
  if (!day) return false;
  const compareDate = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    day
  );
  return compareDate.toDateString() === selectedDate.value.toDateString();
};

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  );
};

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  );
};

const goToToday = () => {
  currentDate.value = new Date();
};

const selectDate = (day: number | null) => {
  if (!day) return;
  selectedDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    day
  );
};

onMounted(() => {
  taskStore.fetchTasks();
});
</script>
```

**Composable 2: src/composables/useCalendarLogic.ts (Separate Calendar Composable)**
```typescript
import { ref, computed } from 'vue';

export interface CalendarConfig {
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
  locale?: string;
  showWeekNumbers?: boolean;
  highlightToday?: boolean;
}

export function useCalendarLogic(config: CalendarConfig = {}) {
  const {
    weekStartsOn = 0,
    locale = 'en-US',
    showWeekNumbers = false,
    highlightToday = true
  } = config;

  const viewDate = ref(new Date());
  const selectedDate = ref<Date | null>(null);

  // Different calendar implementation (implementation #2)
  const currentYear = computed(() => viewDate.value.getFullYear());
  const currentMonth = computed(() => viewDate.value.getMonth());

  const monthDays = computed(() => {
    // Slightly different month calculation
    const firstDay = new Date(currentYear.value, currentMonth.value, 1);
    const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);
    const daysInMonth = lastDay.getDate();

    const startingDayOfWeek = firstDay.getDay() - weekStartsOn;
    const adjustedStartDay = startingDayOfWeek < 0 ? 6 : startingDayOfWeek;

    const calendar = [];
    let currentWeek = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < adjustedStartDay; i++) {
      currentWeek.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        calendar.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add remaining days to complete the last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      calendar.push(currentWeek);
    }

    return calendar;
  });

  const monthName = computed(() => {
    return viewDate.value.toLocaleString(locale, {
      month: 'long',
      year: 'numeric'
    });
  });

  const weekdayNames = computed(() => {
    const names = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - startDate.getDay() + weekStartsOn);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      names.push(date.toLocaleString(locale, { weekday: 'short' }));
    }
    return names;
  });

  const isDateInCurrentMonth = (date: Date) => {
    return date.getFullYear() === currentYear.value &&
           date.getMonth() === currentMonth.value;
  };

  const isToday = (date: Date) => {
    if (!highlightToday) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate.value?.toDateString() === date.toDateString();
  };

  const goToPreviousMonth = () => {
    viewDate.value = new Date(currentYear.value, currentMonth.value - 1, 1);
  };

  const goToNextMonth = () => {
    viewDate.value = new Date(currentYear.value, currentMonth.value + 1, 1);
  };

  const goToToday = () => {
    viewDate.value = new Date();
  };

  const selectDate = (date: Date) => {
    selectedDate.value = date;
  };

  const goToMonth = (year: number, month: number) => {
    viewDate.value = new Date(year, month, 1);
  };

  return {
    viewDate,
    selectedDate,
    monthDays,
    monthName,
    weekdayNames,
    isDateInCurrentMonth,
    isToday,
    isSelected,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    selectDate,
    goToMonth
  };
}
```

**Store 3: src/stores/CalendarStore.ts (Store-Based Calendar)**
```typescript
import { defineStore } from 'pinia';
import type { CalendarEvent } from '@/types';

export const useCalendarStore = defineStore('calendar', () => {
  const currentView = ref<'month' | 'week' | 'day'>('month');
  const selectedDate = ref(new Date());
  const viewDate = ref(new Date());
  const events = ref<CalendarEvent[]>([]);

  // Third calendar implementation (implementation #3)
  const calendarDays = computed(() => {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // Sunday = 0

    const days = [];
    let weekNumber = 1;

    // Previous month trailing days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
        weekNumber
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const dayOfWeek = dayDate.getDay();

      days.push({
        day,
        month,
        year,
        isCurrentMonth: true,
        weekNumber,
        date: dayDate
      });

      if (dayOfWeek === 6) {
        weekNumber++;
      }
    }

    // Next month leading days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        day,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
        weekNumber: weekNumber
      });
    }

    return days;
  });

  const weeks = computed(() => {
    const weeks = [];
    for (let i = 0; i < calendarDays.value.length; i += 7) {
      weeks.push(calendarDays.value.slice(i, i + 7));
    }
    return weeks;
  });

  const currentMonthYear = computed(() => {
    return viewDate.value.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  });

  const eventsForSelectedDate = computed(() => {
    return events.value.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === selectedDate.value.toDateString();
    });
  });

  const goToPreviousMonth = () => {
    viewDate.value = new Date(
      viewDate.value.getFullYear(),
      viewDate.value.getMonth() - 1,
      1
    );
  };

  const goToNextMonth = () => {
    viewDate.value = new Date(
      viewDate.value.getFullYear(),
      viewDate.value.getMonth() + 1,
      1
    );
  };

  const goToToday = () => {
    viewDate.value = new Date();
    selectedDate.value = new Date();
  };

  const selectDate = (date: Date) => {
    selectedDate.value = date;
  };

  const addEvent = (event: CalendarEvent) => {
    events.value.push(event);
  };

  const removeEvent = (eventId: string) => {
    events.value = events.value.filter(e => e.id !== eventId);
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/calendar/events');
      const data = await response.json();
      events.value = data;
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    }
  };

  return {
    currentView,
    selectedDate,
    viewDate,
    events,
    calendarDays,
    weeks,
    currentMonthYear,
    eventsForSelectedDate,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    selectDate,
    addEvent,
    removeEvent,
    fetchEvents
  };
});
```

### ✅ GOOD - Single Unified Calendar System

**Consolidated: src/composables/useCalendar.ts**
```typescript
import { ref, computed, reactive } from 'vue';
import type { CalendarEvent, CalendarConfig } from '@/types';

export interface CalendarDay {
  date: Date;
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  weekNumber: number;
  events: CalendarEvent[];
}

export interface CalendarView {
  type: 'month' | 'week' | 'day';
  startDate: Date;
  endDate: Date;
  days: CalendarDay[];
}

export interface CalendarState {
  currentDate: Date;
  selectedDate: Date | null;
  viewDate: Date;
  view: 'month' | 'week' | 'day';
  locale: string;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
}

export function useCalendar(config: Partial<CalendarConfig> = {}) {
  const {
    locale = 'en-US',
    weekStartsOn = 0,
    initialView = 'month',
    initialDate = new Date(),
    showWeekNumbers = false,
    highlightToday = true,
    minDate,
    maxDate
  } = config;

  // Calendar state
  const state = reactive<CalendarState>({
    currentDate: initialDate,
    selectedDate: null,
    viewDate: initialDate,
    view: initialView,
    locale,
    weekStartsOn
  });

  // Events state (separate from calendar logic)
  const events = ref<CalendarEvent[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // Computed properties
  const currentYear = computed(() => state.viewDate.getFullYear());
  const currentMonth = computed(() => state.viewDate.getMonth());
  const currentDay = computed(() => state.viewDate.getDate());

  const monthYearFormatted = computed(() => {
    return state.viewDate.toLocaleDateString(state.locale, {
      month: 'long',
      year: 'numeric'
    });
  });

  const weekdayNames = computed(() => {
    const names = [];
    const startDate = new Date();
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - day + state.weekStartsOn);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      names.push(date.toLocaleDateString(state.locale, { weekday: 'short' }));
    }
    return names;
  });

  const monthNames = computed(() => {
    const names = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(state.currentDate.getFullYear(), i, 1);
      names.push(date.toLocaleDateString(state.locale, { month: 'long' }));
    }
    return names;
  });

  // Month view calculation (unified logic)
  const monthView = computed((): CalendarView => {
    const firstDayOfMonth = new Date(currentYear.value, currentMonth.value, 1);
    const lastDayOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Adjust for week start day
    const startDayOfWeek = firstDayOfMonth.getDay() - state.weekStartsOn;
    const adjustedStartDay = startDayOfWeek < 0 ? startDayOfWeek + 7 : startDayOfWeek;

    const days: CalendarDay[] = [];
    let currentDate = new Date(firstDayOfMonth);

    // Previous month trailing days
    const prevMonth = new Date(currentYear.value, currentMonth.value, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
      const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonthDays - i);
      days.push(createCalendarDay(date, false));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear.value, currentMonth.value, day);
      days.push(createCalendarDay(date, true));
    }

    // Next month leading days to complete the grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remainingDays = totalCells - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear.value, currentMonth.value + 1, day);
      days.push(createCalendarDay(date, false));
    }

    return {
      type: 'month',
      startDate: days[0].date,
      endDate: days[days.length - 1].date,
      days
    };
  });

  // Week view calculation
  const weekView = computed((): CalendarView => {
    const startOfWeek = new Date(state.viewDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day + state.weekStartsOn);

    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(createCalendarDay(date, true));
    }

    return {
      type: 'week',
      startDate: days[0].date,
      endDate: days[days.length - 1].date,
      days
    };
  });

  // Day view calculation
  const dayView = computed((): CalendarView => {
    const date = new Date(state.viewDate);
    return {
      type: 'day',
      startDate: date,
      endDate: date,
      days: [createCalendarDay(date, true)]
    };
  });

  // Current view based on state
  const currentView = computed(() => {
    switch (state.view) {
      case 'week':
        return weekView.value;
      case 'day':
        return dayView.value;
      case 'month':
      default:
        return monthView.value;
    }
  });

  // Events for current view
  const viewEvents = computed(() => {
    const { startDate, endDate } = currentView.value;
    return events.value.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });
  });

  // Events for selected date
  const selectedDateEvents = computed(() => {
    if (!state.selectedDate) return [];
    return events.value.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === state.selectedDate!.toDateString();
    });
  });

  // Helper function to create calendar day
  function createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const dayEvents = events.value.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });

    const today = new Date();
    const isToday = highlightToday && date.toDateString() === today.toDateString();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Calculate week number (ISO week)
    const weekNumber = getWeekNumber(date);

    return {
      date,
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      isCurrentMonth,
      isToday,
      isWeekend,
      weekNumber,
      events: dayEvents
    };
  }

  // ISO week number calculation
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Navigation methods
  const goToPrevious = () => {
    const newDate = new Date(state.viewDate);
    switch (state.view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    state.viewDate = newDate;
  };

  const goToNext = () => {
    const newDate = new Date(state.viewDate);
    switch (state.view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    state.viewDate = newDate;
  };

  const goToToday = () => {
    state.viewDate = new Date();
    if (!state.selectedDate) {
      state.selectedDate = new Date();
    }
  };

  const goToMonth = (year: number, month: number) => {
    state.viewDate = new Date(year, month, 1);
    state.view = 'month';
  };

  const goToWeek = (year: number, month: number, day: number) => {
    state.viewDate = new Date(year, month, day);
    state.view = 'week';
  };

  const goToDay = (date: Date) => {
    state.viewDate = new Date(date);
    state.view = 'day';
  };

  // Date selection
  const selectDate = (date: Date) => {
    state.selectedDate = date;
  };

  const clearSelection = () => {
    state.selectedDate = null;
  };

  // View management
  const setView = (view: 'month' | 'week' | 'day') => {
    state.view = view;
  };

  // Event management
  const addEvent = (event: CalendarEvent) => {
    events.value.push(event);
  };

  const updateEvent = (eventId: string, updates: Partial<CalendarEvent>) => {
    const index = events.value.findIndex(e => e.id === eventId);
    if (index !== -1) {
      events.value[index] = { ...events.value[index], ...updates };
    }
  };

  const removeEvent = (eventId: string) => {
    events.value = events.value.filter(e => e.id !== eventId);
  };

  const fetchEvents = async (startDate?: Date, endDate?: Date) => {
    loading.value = true;
    error.value = null;

    try {
      const start = startDate || currentView.value.startDate;
      const end = endDate || currentView.value.endDate;

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString()
      });

      const response = await fetch(`/api/calendar/events?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      events.value = data;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Utility methods
  const isDateSelectable = (date: Date): boolean => {
    if (minDate && date < minDate) return false;
    if (maxDate && date > maxDate) return false;
    return true;
  };

  const formatDate = (date: Date, format?: string): string => {
    if (format === 'short') {
      return date.toLocaleDateString(state.locale, {
        month: 'short',
        day: 'numeric'
      });
    } else if (format === 'long') {
      return date.toLocaleDateString(state.locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      return date.toLocaleDateString(state.locale);
    }
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.value.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Reset to initial state
  const reset = () => {
    state.currentDate = initialDate;
    state.selectedDate = null;
    state.viewDate = initialDate;
    state.view = initialView;
    events.value = [];
  };

  return {
    // State
    state: readonly(state),
    events,
    loading,
    error,

    // Computed
    currentYear,
    currentMonth,
    currentDay,
    monthYearFormatted,
    weekdayNames,
    monthNames,
    currentView,
    viewEvents,
    selectedDateEvents,

    // Navigation
    goToPrevious,
    goToNext,
    goToToday,
    goToMonth,
    goToWeek,
    goToDay,

    // Date management
    selectDate,
    clearSelection,
    isDateSelectable,
    formatDate,

    // View management
    setView,

    // Event management
    addEvent,
    updateEvent,
    removeEvent,
    fetchEvents,
    getEventsForDate,

    // Utility
    reset
  };
}

// Specialized calendar for task management
export function useTaskCalendar() {
  const baseCalendar = useCalendar({
    initialView: 'month',
    showWeekNumbers: false,
    highlightToday: true
  });

  // Task-specific event fetching
  const fetchTaskEvents = async () => {
    try {
      const response = await fetch('/api/tasks');
      const tasks = await response.json();

      // Convert tasks to calendar events
      const taskEvents: CalendarEvent[] = tasks
        .filter((task: any) => task.dueDate)
        .map((task: any) => ({
          id: `task-${task.id}`,
          title: task.title,
          date: task.dueDate,
          type: 'task',
          priority: task.priority,
          completed: task.completed,
          color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'
        }));

      baseCalendar.events.value = taskEvents;
    } catch (error) {
      console.error('Failed to fetch task events:', error);
    }
  };

  return {
    ...baseCalendar,
    fetchTaskEvents
  };
}
```

**Usage Example:**
```vue
<template>
  <div class="task-calendar">
    <div class="calendar-header">
      <button @click="calendar.goToPrevious">‹</button>
      <h2>{{ calendar.monthYearFormatted }}</h2>
      <button @click="calendar.goToNext">›</button>
      <button @click="calendar.goToToday">Today</button>

      <div class="view-switcher">
        <button
          v-for="view in ['month', 'week', 'day']"
          :key="view"
          @click="calendar.setView(view)"
          :class="{ active: calendar.state.view === view }"
        >
          {{ view.charAt(0).toUpperCase() + view.slice(1) }}
        </button>
      </div>
    </div>

    <div class="calendar-grid">
      <div class="weekdays">
        <div v-for="day in calendar.weekdayNames" :key="day" class="weekday">
          {{ day }}
        </div>
      </div>

      <div class="calendar-days">
        <div
          v-for="day in calendar.currentView.days"
          :key="day.date.toISOString()"
          class="calendar-day"
          :class="{
            'other-month': !day.isCurrentMonth,
            'today': day.isToday,
            'weekend': day.isWeekend,
            'selected': calendar.selectedDate?.toDateString() === day.date.toDateString()
          }"
          @click="calendar.selectDate(day.date)"
        >
          <div class="day-number">{{ day.day }}</div>
          <div class="day-events">
            <div
              v-for="event in day.events.slice(0, 3)"
              :key="event.id"
              class="event-indicator"
              :style="{ backgroundColor: event.color }"
              :title="event.title"
            />
            <div v-if="day.events.length > 3" class="more-events">
              +{{ day.events.length - 3 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="selected-date-events" v-if="calendar.selectedDate">
      <h3>Events for {{ calendar.formatDate(calendar.selectedDate, 'long') }}</h3>
      <div v-for="event in calendar.selectedDateEvents" :key="event.id" class="event-item">
        <span class="event-title">{{ event.title }}</span>
        <span class="event-type">{{ event.type }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskCalendar } from '@/composables/useCalendar';

const calendar = useTaskCalendar();

// Load task events on mount
onMounted(() => {
  calendar.fetchTaskEvents();
});
</script>
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: Calendar/Scheduling Logic
- **Severity**: HIGH

**Conflict Type**: Multiple Calendar Implementations
- **Scope**: Date calculations and calendar rendering
- **Pattern Match**: 89% code similarity in date calculations

**Files Involved**:
- `src/components/CalendarView.vue` (inline implementation #1)
- `src/composables/useCalendarLogic.ts` (composable implementation #2)
- `src/stores/CalendarStore.ts` (store-based implementation #3)

**Issues Identified**:
1. **Duplicate date calculations**: 89% code similarity across all three implementations
2. **Inconsistent month grid logic**: Different approaches to calculating calendar days
3. **Scattered event management**: Events handled differently in each implementation
4. **Conflicting navigation methods**: Different function signatures for navigation
5. **Inconsistent state management**: Mix of component state, composable state, and store state
6. **Performance issues**: Calendar recalculated in multiple places
7. **Maintenance nightmare**: Calendar bugs must be fixed in 3 places
8. **Inconsistent locale support**: Different approaches to internationalization

**Recommendation**: Consolidate into single calendar composable
1. **Create comprehensive useCalendar composable** with all calendar features
2. **Separate concerns**: Calendar logic vs event management
3. **Support multiple views**: Month, week, and day views
4. **Add comprehensive localization**: Configurable locales and week start
5. **Optimize performance**: Efficient date calculations and event filtering
6. **Update all calendar usage** to use unified system
7. **Remove duplicate implementations**

**Estimated Effort**: 4-5 hours
- **Core implementation**: 3 hours
- **Migration of components**: 1-2 hours
- **Testing and optimization**: 1 hour

**Risk**: High
- **Breaking changes**: Calendar is critical user interface component
- **Testing scope**: All calendar-dependent features and user workflows
- **Rollback difficulty**: High (affects core navigation functionality)

**Migration Path**:
1. Implement comprehensive useCalendar with all features from three implementations
2. Create specialized wrappers like useTaskCalendar for domain-specific needs
3. Update CalendarView.vue to use new composable
4. Remove calendar logic from CalendarStore (keep only event management)
5. Update useCalendarLogic users to new composable
6. Test all calendar functionality thoroughly
7. Deploy with feature flag for gradual rollout
8. Remove old implementations after successful rollout

**Benefits**:
- **Single source of truth** for all calendar logic
- **Consistent user experience** across all calendar views
- **Reduced code duplication** by 80%
- **Better performance** through optimized date calculations
- **Enhanced features** (week/day views, better localization)
- **Easier maintenance** and bug fixes
- **Improved accessibility** with unified keyboard navigation
- **Better testing** with centralized calendar logic