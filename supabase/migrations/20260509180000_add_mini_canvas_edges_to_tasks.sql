-- Persist Thinking Flow user-drawn edges
-- Adds a JSONB column to store the MiniCanvasEdge[] payload that
-- useMiniCanvasActions.ts maintains. The Supabase mappers
-- (src/utils/supabaseMappers.ts) write/read this column as task.miniCanvasEdges.
--
-- Idempotent: safe to apply against environments where the column already exists.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mini_canvas_edges JSONB DEFAULT '[]'::jsonb;
