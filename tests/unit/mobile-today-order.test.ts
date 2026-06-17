import { mount } from "@vue/test-utils";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import MobileTodayView from "@/mobile/views/MobileTodayView.vue";

const tasks = [
  {
    id: "today-untimed",
    title: "Today task",
    status: "todo",
    priority: "high",
    dueDate: "2026-06-17",
    projectId: null,
  },
  {
    id: "overdue-task",
    title: "Overdue task",
    status: "todo",
    priority: "medium",
    dueDate: "2026-06-16",
    projectId: null,
  },
];

vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => ({
    tasks,
    projects: [],
    updateTask: vi.fn(),
  }),
}));

vi.mock("@/stores/timer", () => ({
  useTimerStore: () => ({
    startTimer: vi.fn(),
  }),
}));

vi.mock("@/composables/useRecurrenceAwareDelete", () => ({
  useRecurrenceAwareDelete: () => ({ recurrenceAwareDelete: vi.fn() }),
}));

vi.mock("@/composables/mobile/useMobileFilters", () => ({
  useMobileFilters: () => ({
    selectedProject: ref(null),
    selectedPriority: ref(null),
    groupBy: ref("time"),
    hasActiveFilters: ref(false),
    priorityLabel: (p: string) => p,
    clearFilters: vi.fn(),
    setProjectFilter: vi.fn(),
    setPriorityFilter: vi.fn(),
    setGroupBy: vi.fn(),
  }),
}));

describe("MobileTodayView section order", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00+03:00"));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Today section before Overdue in the PWA Today filter", () => {
    const wrapper = mount(MobileTodayView, {
      global: {
        stubs: {
          TaskEditBottomSheet: true,
          SwipeableTaskItem: { template: "<div><slot /></div>" },
        },
      },
    });

    const sectionTitles = wrapper
      .findAll(".section-header span:first-of-type")
      .map((el) => el.text());

    expect(sectionTitles).toEqual(["Today", "Overdue"]);
  });
});
