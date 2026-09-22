# Sync recovery incident: review surface and group geometry

**Status:** in progress
**Opened:** 2026-09-22
**User-visible symptoms:** the desktop reports local changes needing review, may show an error count without individual entries, and group locations can move after a retry or reload.

## What the existing record proves

- The serialized task revision fix shipped in 1.4.544 and was verified in the public updater. It covers numeric revisions returned as strings; it does not cover every queue or canvas failure class.
- Earlier sync work added durable error text and made conflict rows contribute to the badge count, but the badge reads the `conflicts` table while the popover list historically read only `operations` rows.
- Earlier canvas work closed stale realtime echoes, duplicate group writers, and several Tidy/load cases. The master plan explicitly left boot-time load versus mutation serialization in progress.
- Existing logs are mostly development-console logs. They are useful during a live reproduction but are not a durable per-operation incident record, so a restart can leave only the generic review message.

## Current failure boundaries

1. **Review-surface mismatch:** an unresolved conflict record can remain after its queue row changes status or is removed. The count can therefore be nonzero while the list is empty.
2. **Retry semantics:** conflict retries must use the server version captured with the conflict, not blindly replay the old queue row. Otherwise Retry All can reproduce the same stale revision.
3. **Canvas mutation tracking:** some canvas mutation aliases bypassed the timestamp used to keep an in-flight canonical load from replacing a newer local change. This makes the boot/load race easier to reproduce even though the main move path had a guard.
4. **Remaining unverified boundary:** no installed authenticated reproduction has yet read back the exact conflict records and group operation payloads from the affected device. Source tests are not proof of that device's IndexedDB state.

## Acceptance gate

- Queue tests prove conflict records are visible in the review list even when the current row is no longer marked `conflict`.
- Local entity deletion removes its related conflict records in the same transaction.
- Retry All rebases a conflict using its recorded server version.
- Canvas group mutation aliases update the load-race guard; the existing version/echo regressions still pass.
- Type-check and targeted lint pass.
- Before claiming completion: build Electron, publish a new updater version, restart the installed app, reproduce the affected device state, and read back the conflict count, operation list, group position, and server position.

## Do not do during recovery

- Do not discard local changes as a way to make the badge disappear.
- Do not weaken zero-row deletion checks or treat an unacknowledged remote delete as success.
- Do not call source tests, a successful build, or an updater manifest read-back proof that the affected authenticated desktop is repaired.
