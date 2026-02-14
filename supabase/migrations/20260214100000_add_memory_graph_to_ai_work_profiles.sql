-- FEATURE-1317 Phase 2: Add memory_graph for structured observations (knowledge graph)
-- Stores typed observations like "user overplans", "project X tasks slip", etc.
-- Backward-compatible: new jsonb column with empty array default

ALTER TABLE public.ai_work_profiles
  ADD COLUMN IF NOT EXISTS memory_graph jsonb DEFAULT '[]'::jsonb;
