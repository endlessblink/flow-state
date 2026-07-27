/**
 * TASK-1977 — "I removed this from the canvas and it came back."
 *
 * Removing a task from the canvas writes
 *   { isInInbox: true, canvasPosition: undefined, canvasDismissed: true }
 *
 * `is_in_inbox` and the cleared position persisted; `canvasDismissed` did not —
 * it was never mapped to Supabase in either direction. Canvas auto-placement
 * treats a task as eligible when it has no canvasPosition, is NOT
 * canvasDismissed, has a due date and is not done. So on the next load the
 * dismissed flag was gone, the task qualified again, and it was placed straight
 * back onto the canvas. The user's explicit removal was undone by every reload.
 *
 * The round-trip half is proved in tests/contract/task-field-roundtrip.test.ts.
 * This proves the behaviour that made it matter: a task that comes back from
 * the server as dismissed must not be re-placed.
 */

import { describe, expect, it } from "vitest";
import { toSupabaseTask, fromSupabaseTask } from "@/utils/supabaseMappers";
import type { Task } from "@/types/tasks";

const USER_ID = "9f1f6a2e-6c1b-4a1a-9a0e-2d5f7c3b8e21";

/**
 * The eligibility rule from useCanvasAutoPlacement.autoPlaceEligibleTasks.
 * Kept in step with the source deliberately: this vector is about the flag
 * surviving a reload, and the rule is what makes losing it user-visible.
 */
const isAutoPlaceEligible = (task: Task): boolean =>
  !task.canvasPosition &&
  !task.canvasDismissed &&
  !!task.dueDate &&
  task.status !== "done";

function dismissedTask(): Task {
  return {
    id: "aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Removed from canvas on purpose",
    description: "",
    status: "todo",
    priority: "medium",
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: "2026-07-30",
    projectId: "cccccccc-1111-4ccc-8ccc-cccccccccccc",
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    updatedAt: new Date("2026-06-02T08:00:00.000Z"),
    // exactly what the remove-from-canvas action writes
    isInInbox: true,
    canvasPosition: undefined,
    canvasDismissed: true,
  } as Task;
}

describe("a task removed from the canvas stays removed across a reload", () => {
  it("is not auto-place eligible before the reload", () => {
    expect(isAutoPlaceEligible(dismissedTask())).toBe(false);
  });

  it("survives the save/load round-trip as dismissed", () => {
    const reloaded = fromSupabaseTask(toSupabaseTask(dismissedTask(), USER_ID));
    expect(reloaded.canvasDismissed).toBe(true);
  });

  it("is still not auto-place eligible after the reload", () => {
    const reloaded = fromSupabaseTask(toSupabaseTask(dismissedTask(), USER_ID));
    expect(isAutoPlaceEligible(reloaded)).toBe(false);
  });

  it("keeps a task that was never dismissed eligible, so the guard is not blanket", () => {
    const normal = {
      ...dismissedTask(),
      isInInbox: false,
      canvasDismissed: false,
    };
    const reloaded = fromSupabaseTask(toSupabaseTask(normal, USER_ID));
    expect(reloaded.canvasDismissed).toBe(false);
    expect(isAutoPlaceEligible(reloaded)).toBe(true);
  });

  it("treats a legacy row with no stored flag as not dismissed", () => {
    // Rows written before the column existed have no value; the migration
    // defaults them to false, and the mapper must agree rather than yield
    // undefined and change meaning.
    const legacyRow = toSupabaseTask(dismissedTask(), USER_ID) as Record<
      string,
      unknown
    >;
    delete legacyRow.canvas_dismissed;
    expect(fromSupabaseTask(legacyRow as never).canvasDismissed).toBe(false);
  });
});
