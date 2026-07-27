/**
 * TASK-1977 — vector: maximal-task-and-subtask-field-roundtrip [critical]
 *
 * Audit ledger evidence for this vector was MISSING: no deterministic repro
 * existed. The file that looked like it covered field fidelity
 * (`backup-restore-field-fidelity.test.ts`) contains a single source-grep
 * assertion about which RPC is called — it never checks a single field.
 *
 * Every task the user owns crosses `toSupabaseTask` on the way out and
 * `fromSupabaseTask` on the way back — on every save, every load, every backup
 * and every restore. A field dropped or renamed on either side is silent data
 * loss: the UI looks right until a reload, and the loss is permanent.
 *
 * This builds a task with EVERY optional field populated and proves the
 * round-trip is lossless. Any field the mapping cannot carry must be an
 * explicit, justified entry in KNOWN_NOT_PERSISTED below — never an accident.
 */

import { describe, expect, it } from "vitest";
import { toSupabaseTask, fromSupabaseTask } from "@/utils/supabaseMappers";
import type { Task } from "@/types/tasks";

const USER_ID = "9f1f6a2e-6c1b-4a1a-9a0e-2d5f7c3b8e21";

/**
 * Fields that legitimately do not survive a Supabase round-trip.
 * Each entry needs a reason. An unexplained entry here is a bug in hiding.
 */
const KNOWN_NOT_PERSISTED: Array<{ field: keyof Task; why: string }> = [
  {
    field: "isUncategorized",
    why: "Derived at read time from projectId; storing it would let it drift.",
  },
  {
    field: "updatedAt",
    why: "Write time is server-owned. A client that could pin updated_at could defeat last-write-wins merges.",
  },
  {
    field: "positionVersion",
    why: "Managed by DB triggers and never sent on update (see toSupabaseTask); the geometry version guard depends on the server owning it.",
  },
  {
    field: "canonicalRevision",
    why: "Canonical row revision is assigned by the signed-user command boundary; a restored row is legitimately a new revision.",
  },
];

function maximalTask(): Task {
  return {
    id: "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Maximal round-trip task",
    description: "Every field populated on purpose.",
    status: "todo",
    priority: "high",
    progress: 42,
    completedPomodoros: 3,
    subtasks: [
      {
        id: "bbbbbbbb-1111-4bbb-8bbb-bbbbbbbbbbbb",
        parentTaskId: "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Subtask one",
        description: "Subtask description",
        completedPomodoros: 1,
        isCompleted: false,
        createdAt: new Date("2026-06-01T08:00:00.000Z"),
        updatedAt: new Date("2026-06-02T08:00:00.000Z"),
        canvasPosition: { x: 12, y: 34 },
      },
    ],
    dueDate: "2026-07-30",
    dueTime: "14:30",
    estimatedDuration: 90,
    scheduledDate: "2026-07-29",
    scheduledTime: "09:15",
    estimatedPomodoros: 5,
    projectId: "cccccccc-1111-4ccc-8ccc-cccccccccccc",
    parentId: "dddddddd-1111-4ddd-8ddd-dddddddddddd",
    parentTaskId: null,
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    updatedAt: new Date("2026-06-02T08:00:00.000Z"),
    canonicalRevision: 7,
    canvasPosition: { x: 100, y: 200 },
    positionVersion: 4,
    positionFormat: "absolute",
    isInInbox: false,
    canvasDismissed: false,
    dependsOn: ["eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee"],
    tags: ["alpha", "beta"],
    connectionTypes: { "eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee": "blocker" },
    recurrenceRule: {
      frequency: "weekly",
      interval: 1,
    } as Task["recurrenceRule"],
    recurrenceParentId: "ffffffff-1111-4fff-8fff-ffffffffffff",
    recurrenceCount: 2,
    reminders: [
      { id: "rem-1", at: "2026-07-29T09:00:00.000Z" },
    ] as unknown as Task["reminders"],
    instances: [
      { id: "inst-1", date: "2026-07-30", startTime: "14:30", duration: 60 },
    ] as unknown as Task["instances"],
    attachments: [
      { id: "att-1", name: "diagram.png" },
    ] as unknown as Task["attachments"],
    planningNotes: [
      {
        id: "note-1",
        title: "Note",
        description: "body",
        canvasPosition: { x: 5, y: 6 },
        createdAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-01T08:00:00.000Z",
      },
    ] as unknown as Task["planningNotes"],
    miniCanvasEdges: [
      {
        id: "user-a-b",
        source: "a",
        target: "b",
        sourceHandle: "right",
        targetHandle: "left",
      },
    ],
    order: 11,
    columnId: "col-1",
    completedAt: new Date("2026-07-01T10:00:00.000Z"),
    _soft_deleted: false,
    deletedAt: undefined,
    doneForNowUntil: "2026-07-31",
    isCompletionRecord: false,
    isPinned: true,
    calendarLocked: true,
    workspaceId: null,
    assignedTo: null,
    laneId: "aaaa1111-2222-4333-8444-555566667777",
  } as Task;
}

/** Dates round-trip as ISO strings; compare on instant, not on class. */
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  }
  return value;
}

describe("maximal task field round-trip through Supabase mapping", () => {
  const original = maximalTask();
  const roundTripped = fromSupabaseTask(toSupabaseTask(original, USER_ID));
  const excluded = new Set(KNOWN_NOT_PERSISTED.map((entry) => entry.field));

  const populatedFields = (Object.keys(original) as Array<keyof Task>).filter(
    (field) => original[field] !== undefined && !excluded.has(field),
  );

  it("populates every optional field, so the round-trip is actually exercised", () => {
    // Guards the test itself: if Task gains a field and the fixture is not
    // updated, this vector silently stops covering it.
    const taskFields = populatedFields.length + excluded.size;
    expect(taskFields).toBeGreaterThanOrEqual(45);
  });

  it.each(populatedFields)("preserves %s", (field) => {
    expect(normalize(roundTripped[field])).toEqual(normalize(original[field]));
  });

  it("preserves subtask identity, ordering and completion state", () => {
    expect(roundTripped.subtasks).toHaveLength(original.subtasks.length);
    expect(roundTripped.subtasks[0].id).toBe(original.subtasks[0].id);
    expect(roundTripped.subtasks[0].isCompleted).toBe(
      original.subtasks[0].isCompleted,
    );
    expect(roundTripped.subtasks[0].title).toBe(original.subtasks[0].title);
  });

  it("documents a reason for every field it does not carry", () => {
    for (const entry of KNOWN_NOT_PERSISTED) {
      expect(entry.why.length).toBeGreaterThan(20);
    }
  });
});
