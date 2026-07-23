import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSmartViews } from "@/composables/useSmartViews";
import type { Task } from "@/types/tasks";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Task",
    description: "",
    status: "todo",
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: "",
    projectId: "project-1",
    createdAt: new Date("2026-06-01T08:00:00+03:00"),
    updatedAt: new Date("2026-06-01T08:00:00+03:00"),
    ...overrides,
  };
}

describe("useSmartViews today filtering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00+03:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes tasks with a due date on today even when stored as an ISO timestamp", () => {
    const { isTodayTask } = useSmartViews();

    expect(
      isTodayTask(makeTask({ dueDate: "2026-06-17T20:59:00+00:00" })),
    ).toBe(true);
  });

  it("includes tasks with a scheduled date on today even when stale instances exist", () => {
    const { isTodayTask } = useSmartViews();

    expect(
      isTodayTask(
        makeTask({
          scheduledDate: "2026-06-17T00:00:00+00:00",
          instances: [{ scheduledDate: "2026-06-18" }],
        }),
      ),
    ).toBe(true);
  });
});

describe("useSmartViews all-active filtering", () => {
  it("excludes completed tasks while retaining every active status", () => {
    const { applySmartViewFilter } = useSmartViews();
    const tasks = [
      makeTask({ id: "todo", status: "todo" }),
      makeTask({ id: "planned", status: "planned" }),
      makeTask({ id: "in-progress", status: "in_progress" }),
      makeTask({ id: "done", status: "done" }),
    ];

    expect(applySmartViewFilter(tasks, "all_active").map(task => task.id)).toEqual([
      "todo",
      "planned",
      "in-progress",
    ]);
  });
});
