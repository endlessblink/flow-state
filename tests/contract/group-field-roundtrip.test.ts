/**
 * TASK-1977 — vector: canvas-geometry-and-membership-durability (field-mapping
 * facet). Companion to task-field-roundtrip: canvas GROUPS cross the same
 * Supabase mapping on every save, load, backup and restore. A group field
 * dropped or renamed is silent loss of a day-column's configuration —
 * collapse state, nesting, power-keyword behaviour, collect filters.
 *
 * Builds a group with every optional field populated and proves the
 * toSupabaseGroup → fromSupabaseGroup round-trip is lossless. Anything the
 * mapping cannot carry must be an explicit, justified exclusion.
 */

import { describe, expect, it } from "vitest";
import { toSupabaseGroup, fromSupabaseGroup } from "@/utils/supabaseMappers";
import type { CanvasGroup } from "@/types/canvas";

const USER_ID = "9f1f6a2e-6c1b-4a1a-9a0e-2d5f7c3b8e21";

const KNOWN_NOT_PERSISTED: Array<{ field: keyof CanvasGroup; why: string }> = [
  {
    field: "taskCount",
    why: "Derived from the tasks currently in the group; storing it would let the count drift from reality.",
  },
  {
    field: "positionVersion",
    why: "Managed by DB triggers and not sent on update; the geometry version guard depends on the server owning it.",
  },
  {
    field: "positionFormat",
    why: 'DB has no column; the mapper always reads back "absolute" during the TASK-240 relative transition.',
  },
  {
    field: "propertyValue",
    why: "Deprecated in favour of assignOnDrop; object values are intentionally normalised on write.",
  },
  {
    field: "updatedAt",
    why: "Stamped to write time by toSupabaseGroup on every save; a client-pinned updated_at could defeat last-write-wins.",
  },
];

function maximalGroup(): CanvasGroup {
  return {
    id: "aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Monday",
    type: "custom",
    position: { x: 100, y: 200, width: 350, height: 600 },
    color: "#4ECDC4",
    filters: { status: ["todo"] } as CanvasGroup["filters"],
    layout: "freeform",
    isVisible: true,
    isCollapsed: true,
    autoCollect: true,
    collapsedHeight: 120,
    isPowerMode: true,
    powerKeyword: {
      category: "day_of_week",
      value: "monday",
    } as unknown as CanvasGroup["powerKeyword"],
    assignOnDrop: { dueDate: true } as unknown as CanvasGroup["assignOnDrop"],
    collectFilter: {
      overdueOnly: false,
    } as unknown as CanvasGroup["collectFilter"],
    parentGroupId: "bbbbbbbb-3333-4bbb-8bbb-bbbbbbbbbbbb",
    linkedParentTaskId: "cccccccc-3333-4ccc-8ccc-cccccccccccc",
    updatedAt: "2026-06-02T08:00:00.000Z",
    isPinned: true,
  } as CanvasGroup;
}

function normalize(value: unknown): unknown {
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

describe("maximal canvas group field round-trip through Supabase mapping", () => {
  const original = maximalGroup();
  const mapped = toSupabaseGroup(original, USER_ID);

  it("maps a valid-UUID group (does not skip it as legacy)", () => {
    expect(mapped).not.toBeNull();
  });

  const roundTripped = fromSupabaseGroup(mapped!);
  const excluded = new Set(KNOWN_NOT_PERSISTED.map((e) => e.field));
  const populatedFields = (
    Object.keys(original) as Array<keyof CanvasGroup>
  ).filter((field) => original[field] !== undefined && !excluded.has(field));

  it("populates enough fields to actually exercise the mapping", () => {
    expect(populatedFields.length + excluded.size).toBeGreaterThanOrEqual(18);
  });

  it.each(populatedFields)("preserves %s", (field) => {
    expect(normalize(roundTripped[field])).toEqual(normalize(original[field]));
  });

  it("preserves collapse state and nesting, which drive layout after reload", () => {
    expect(roundTripped.isCollapsed).toBe(true);
    expect(roundTripped.collapsedHeight).toBe(120);
    expect(roundTripped.parentGroupId).toBe(original.parentGroupId);
    expect(roundTripped.linkedParentTaskId).toBe(original.linkedParentTaskId);
  });

  it("refuses to sync a legacy non-UUID group id rather than corrupt it", () => {
    const legacy = { ...maximalGroup(), id: "group-1768138473081-54fxz7t" };
    expect(toSupabaseGroup(legacy, USER_ID)).toBeNull();
  });

  it("documents a reason for every field it does not carry", () => {
    for (const entry of KNOWN_NOT_PERSISTED) {
      expect(entry.why.length).toBeGreaterThan(20);
    }
  });
});
