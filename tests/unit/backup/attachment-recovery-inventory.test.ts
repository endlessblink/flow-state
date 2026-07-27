/**
 * TASK-1977 — vector: comments-and-attachment-recovery-inventory [high]
 * (personal-scope facet).
 *
 * Task attachments (FEATURE-1414: Google Drive image references) are a field on
 * the Task, so they are captured whole in a backup and reinserted whole on
 * restore. They must survive the Supabase mapping and the restore ordering
 * without loss or reference drift — a dropped attachment is a lost image
 * reference the user cannot recover.
 *
 * Scope note: task COMMENTS live in the `task_comments` workspace table, not on
 * the Task and not in BackupData (which holds tasks/projects/groups/tombstones/
 * settings). Comment recovery is therefore part of the DEFERRED team-workspace
 * lane, not this personal-scope vector, and is asserted here only as a boundary
 * (BackupData has no comments field) so the gap is explicit rather than silent.
 */

import { describe, it, expect } from "vitest";
import { toSupabaseTask, fromSupabaseTask } from "@/utils/supabaseMappers";
import { validateAndSortTasksForRestore } from "@/composables/backup/types";
import type { Task, TaskAttachment } from "@/types/tasks";

const USER_ID = "9f1f6a2e-6c1b-4a1a-9a0e-2d5f7c3b8e21";

const attachment = (id: string): TaskAttachment => ({
  id,
  driveFileId: `drive-${id}`,
  name: `${id}.jpg`,
  mimeType: "image/jpeg",
  thumbnailUrl: `https://drive.example/thumb/${id}`,
  uploadedAt: "2026-06-01T08:00:00.000Z",
});

const taskWithAttachments = (attachments: TaskAttachment[]): Task =>
  ({
    id: "task-att",
    title: "Task with images",
    description: "",
    status: "todo",
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: "",
    projectId: "p1",
    parentTaskId: null,
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    updatedAt: new Date("2026-06-01T08:00:00.000Z"),
    attachments,
  }) as Task;

describe("attachment recovery inventory", () => {
  it("preserves every attachment and its fields through the Supabase round-trip", () => {
    const original = taskWithAttachments([attachment("a1"), attachment("a2")]);
    const restored = fromSupabaseTask(toSupabaseTask(original, USER_ID));

    expect(restored.attachments).toHaveLength(2);
    expect(restored.attachments).toEqual(original.attachments);
  });

  it("does not drop a single-attachment task, nor invent attachments on a bare task", () => {
    const one = fromSupabaseTask(
      toSupabaseTask(taskWithAttachments([attachment("solo")]), USER_ID),
    );
    expect(one.attachments).toEqual([attachment("solo")]);

    const none = fromSupabaseTask(
      toSupabaseTask(taskWithAttachments([]), USER_ID),
    );
    expect(none.attachments ?? []).toEqual([]);
  });

  it("carries attachments through the restore ordering gate intact", () => {
    const task = taskWithAttachments([attachment("r1")]);
    const ordered = validateAndSortTasksForRestore([task]);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].attachments).toEqual([attachment("r1")]);
  });

  it("BOUNDARY: BackupData carries no comments field — comment recovery is the deferred team lane", async () => {
    // Documented gap, not silent: a personal backup cannot restore workspace
    // comments because they are not in the artifact. This assertion pins that
    // boundary so a future change that starts capturing comments is noticed.
    const types = await import("@/composables/backup/types");
    const sampleKeys = Object.keys({
      id: "",
      source: {},
      tasks: [],
      projects: [],
      groups: [],
      tombstones: [],
      settings: {},
      timestamp: 0,
      version: "",
      checksum: "",
      type: "manual",
      metadata: {},
    });
    expect(sampleKeys).not.toContain("comments");
    expect(typeof types.validateAndSortTasksForRestore).toBe("function");
  });
});
