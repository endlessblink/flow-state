-- TASK-1768: Persist mini-canvas planning notes
-- Adds a JSONB column to store the free-form PlanningNote[] payload that
-- useMiniCanvasActions.ts already maintains in-memory. The Supabase mappers
-- (src/utils/supabaseMappers.ts) write/read this column as task.planningNotes.
--
-- Idempotent: local DB already has this column (added out-of-band); this
-- migration brings production into parity and locks the schema in git.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planning_notes JSONB DEFAULT '[]'::jsonb;
