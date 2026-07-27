/**
 * TASK-1871: schema-vs-payload completeness guard (the "field-completeness trap").
 *
 * The task UPDATE sync path (taskOperations.ts) builds its DB payload from a HAND-LISTED
 * set of columns. When a new column is added to the create mapper (toSupabaseTask) but
 * NOT to the update path, updates to that field SILENTLY never sync (no error) — the
 * exact class behind BUG-1799 (7 missing fields) and the lane_id miss (TASK-1812).
 *
 * This test diffs the columns the CREATE mapper emits against the columns the UPDATE
 * path can emit. Any create column not covered by the update path AND not in the
 * explicit create-only allowlist fails the build — forcing a conscious decision:
 * wire it into the update payload, or document why it's create-only.
 *
 * It's a source-scan (no runtime), so it can't break the app; if it false-positives on
 * a legitimately create-only/derived column, add that column to CREATE_ONLY below.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

function createMapperColumns(): Set<string> {
  const src = read("src/utils/supabaseMappers.ts");
  const start = src.indexOf("export function toSupabaseTask");
  expect(start, "toSupabaseTask not found").toBeGreaterThan(-1);
  // Body up to the next top-level `export function`
  const rest = src.slice(start + 1);
  const end = rest.indexOf("\nexport function");
  const body = end === -1 ? rest : rest.slice(0, end);
  const cols = new Set<string>();
  for (const m of body.matchAll(/^\s{4,12}([a-z_]+):/gm)) cols.add(m[1]);
  return cols;
}

function updatePathColumns(): Set<string> {
  const src = read("src/stores/tasks/taskOperations.ts");
  const cols = new Set<string>();
  for (const m of src.matchAll(/payload\.([a-z_]+)\s*=/g)) cols.add(m[1]);
  cols.add("updated_at"); // always added unconditionally (not via payload.x =)
  return cols;
}

// Columns that legitimately exist only on CREATE, are derived, or use a different
// update representation. Adding a NEW real syncable column here instead of wiring
// the update path is the failure mode this test exists to prevent — so keep it tight.
const CREATE_ONLY = new Set<string>([
  "id",
  "user_id",
  "created_at",
  "updated_at", // identity/timestamps
  "deleted_at",
  "is_deleted", // delete path, not update
  "is_uncategorized", // derived from project_id in update path
  "format",
  "x",
  "y", // legacy/position-json artifacts (position handles geometry on update)
  "recurrence", // update path uses split recurrence_rule/_count/_parent_id
]);

describe("task sync payload completeness (TASK-1871)", () => {
  it("every create-mapper column is covered by the update path (or explicitly create-only)", () => {
    const createCols = createMapperColumns();
    const updateCols = updatePathColumns();
    expect(
      createCols.size,
      "failed to parse create mapper columns",
    ).toBeGreaterThan(10);

    const uncovered = [...createCols].filter(
      (c) => !updateCols.has(c) && !CREATE_ONLY.has(c),
    );
    expect(
      uncovered,
      `These columns sync on CREATE but NOT on UPDATE (field-completeness trap). ` +
        `Wire them into the updateTask payload builder, or add to CREATE_ONLY with a reason:\n  ${uncovered.join(", ")}`,
    ).toEqual([]);
  });

  it("project changes always emit project_id, including clearing to Uncategorized", () => {
    const src = read("src/stores/tasks/taskOperations.ts");
    const projectPayloadLine =
      "payload.project_id = isValidUUID(updatedTask.projectId) ? updatedTask.projectId : null";

    expect(src).toContain(projectPayloadLine);
    expect(src).not.toContain(
      "if (changedKeys.has('projectId') && updatedTask.projectId !== undefined)",
    );
  });
});
