/**
 * TASK-1977 — vectors: backup-restore-absolute-data-existence and the
 * anti-resurrection half of the backup-restore-and-inventory class.
 *
 * assertNoTombstoneContradictions refuses to produce or restore a backup whose
 * permanent-delete inventory (tombstones) also lists an entity as live. Such a
 * backup is internally contradictory: restoring it would either resurrect a
 * permanently deleted item or delete a live one, depending on replay order.
 * Refusing is correct — but the refusal must fire on exactly the contradictory
 * cases and NOT on ordinary backups, or it becomes the silent auto-backup
 * failure fixed elsewhere in TASK-1977.
 *
 * This guard had zero direct coverage.
 */

import { describe, expect, it } from "vitest";
import { assertNoTombstoneContradictions } from "@/composables/backup/types";

const backup = (
  over: Partial<Parameters<typeof assertNoTombstoneContradictions>[0]> = {},
) => ({
  tasks: [],
  projects: [],
  groups: [],
  tombstones: [],
  ...over,
});

const tombstone = (entityType: string, entityId: string) =>
  ({ entityType, entityId }) as unknown as NonNullable<
    Parameters<typeof assertNoTombstoneContradictions>[0]["tombstones"]
  >[number];

describe("assertNoTombstoneContradictions", () => {
  it("accepts an ordinary backup with disjoint live rows and tombstones", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          tasks: [{ id: "live-1" }] as never,
          tombstones: [tombstone("task", "deleted-1")],
        }),
      ),
    ).not.toThrow();
  });

  it("accepts a backup with no tombstones at all", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({ tasks: [{ id: "a" }] as never }),
      ),
    ).not.toThrow();
  });

  it("refuses when a tombstoned task is also present as a live task", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          tasks: [{ id: "both" }] as never,
          tombstones: [tombstone("task", "both")],
        }),
      ),
    ).toThrow(
      /contradictory permanent-delete inventory contains live task both/,
    );
  });

  it("refuses a contradictory project", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          projects: [{ id: "proj-x" }] as never,
          tombstones: [tombstone("project", "proj-x")],
        }),
      ),
    ).toThrow(/live project proj-x/);
  });

  it("refuses a contradictory group", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          groups: [{ id: "grp-y" }] as never,
          tombstones: [tombstone("group", "grp-y")],
        }),
      ),
    ).toThrow(/live group grp-y/);
  });

  it("ignores lane tombstones, which are not part of the recoverable id set", () => {
    // Lanes are pure metadata; a lane tombstone must never block a backup.
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          tasks: [{ id: "lane-shaped-id" }] as never,
          tombstones: [tombstone("lane", "lane-shaped-id")],
        }),
      ),
    ).not.toThrow();
  });

  it("catches the first contradiction even when other entities are consistent", () => {
    expect(() =>
      assertNoTombstoneContradictions(
        backup({
          tasks: [{ id: "ok" }, { id: "bad" }] as never,
          projects: [{ id: "okp" }] as never,
          tombstones: [tombstone("task", "gone"), tombstone("task", "bad")],
        }),
      ),
    ).toThrow(/live task bad/);
  });
});
