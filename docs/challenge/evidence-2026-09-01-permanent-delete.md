# Permanent-delete idempotency gate evidence

- Candidate: a zero-row delete may return success only when a matching tombstone is visible under the authenticated user's scope.
- Falsifiable prediction: an existing matching tombstone resolves; an absent task with no tombstone, a visible task with a zero-row delete, and a failed visibility lookup still reject.
- Command: `npm test -- --run tests/unit/composables/useSupabaseDatabase-delete.test.ts`
- Result: PASS on 2026-09-01, 9 tests passed.
- Protection retained: no fallback tombstone is created or scope inferred; all unknown-scope cases fail closed.
