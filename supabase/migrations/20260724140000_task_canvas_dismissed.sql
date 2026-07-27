-- TASK-1977: persist "user removed this task from the canvas".
--
-- Failure this fixes (found via the maximal task field round-trip contract,
-- audit vector `maximal-task-and-subtask-field-roundtrip`):
--
--   Removing a task from the canvas writes
--     { isInInbox: true, canvasPosition: undefined, canvasDismissed: true }
--   `is_in_inbox` and the cleared position both persist, but `canvasDismissed`
--   was never mapped to Supabase at all — it existed only in renderer memory.
--
--   Canvas auto-placement considers a task eligible when it has no
--   canvasPosition, is not canvasDismissed, has a due date and is not done.
--   After any reload the dismissed flag was gone, so the task became eligible
--   again and was auto-placed straight back onto the canvas. The user's
--   explicit "remove this" was undone by every refresh.
--
-- Additive and safe: a nullable-free boolean with a false default. Existing
-- rows become `false`, which is the historical behaviour (not dismissed), so
-- no task changes meaning as a result of this migration. No backfill needed
-- and nothing is deleted.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS canvas_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.canvas_dismissed IS
  'True when the user explicitly removed this task from the canvas. Blocks canvas auto-placement from putting it back after a reload (TASK-1977).';
