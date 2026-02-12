-- TASK-1301: Daily Cyberpunk Arena — Wave-Based Productivity Combat
-- Phase 1: arena_runs table + user_gamification extensions

-- Arena run history (one run per day per user)
CREATE TABLE IF NOT EXISTS public.arena_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  run_date DATE NOT NULL,
  seed BIGINT NOT NULL,
  enemy_count INTEGER NOT NULL,
  enemies_killed INTEGER DEFAULT 0,
  boss_defeated BOOLEAN DEFAULT false,
  abilities_used INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  max_corruption_reached FLOAT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, run_date)
);

-- RLS
ALTER TABLE public.arena_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own arena runs"
  ON public.arena_runs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_runs;

-- Extend user_gamification with arena stats
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS arena_runs_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_boss_kills INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_perfect_runs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_longest_streak INTEGER DEFAULT 0;

-- Index for quick daily run lookup
CREATE INDEX IF NOT EXISTS idx_arena_runs_user_date ON public.arena_runs(user_id, run_date);
