-- Challenge System "Cyberflow RPG" Migration
-- FEATURE-1132: AI-driven daily missions, weekly bosses, and corruption system

-- -----------------------------------------------------------------------------
-- 1. USER CHALLENGES
-- Active challenges per user with objectives, rewards, and penalties
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('daily', 'weekly', 'boss', 'special')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objective_type TEXT NOT NULL CHECK (objective_type IN (
    'complete_tasks',
    'complete_pomodoros',
    'clear_overdue',
    'focus_time_minutes',
    'complete_high_priority',
    'complete_project_tasks',
    'complete_before_hour',
    'complete_variety'
  )),
  objective_target INTEGER NOT NULL CHECK (objective_target > 0),
  objective_current INTEGER DEFAULT 0 CHECK (objective_current >= 0),
  objective_context JSONB DEFAULT '{}',  -- Additional context like project_id, hour, etc.
  reward_xp INTEGER NOT NULL CHECK (reward_xp > 0),
  reward_bonus JSONB DEFAULT '{}',  -- Optional: { streakMultiplier, shopDiscount }
  penalty_xp INTEGER DEFAULT 0 CHECK (penalty_xp >= 0),
  difficulty TEXT DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard', 'boss')),
  narrative_flavor TEXT,  -- ARIA's cyberpunk flavor text
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  ai_context JSONB DEFAULT '{}'  -- Context used to generate this challenge (for debugging)
);

-- RLS Policies for User Challenges
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenges"
  ON public.user_challenges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenges"
  ON public.user_challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges"
  ON public.user_challenges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenges"
  ON public.user_challenges FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX idx_user_challenges_active ON public.user_challenges(user_id, status)
  WHERE status = 'active';
CREATE INDEX idx_user_challenges_expires ON public.user_challenges(expires_at)
  WHERE status = 'active';
CREATE INDEX idx_user_challenges_type ON public.user_challenges(user_id, challenge_type, status);

-- -----------------------------------------------------------------------------
-- 2. CHALLENGE HISTORY
-- Completed/failed challenge analytics for adaptive difficulty
-- -----------------------------------------------------------------------------
CREATE TABLE public.challenge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id uuid,  -- Original challenge ID (may be null if challenge was deleted)
  challenge_type TEXT NOT NULL,
  objective_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'expired')),
  xp_earned INTEGER DEFAULT 0,
  xp_lost INTEGER DEFAULT 0,
  objective_target INTEGER NOT NULL,
  objective_achieved INTEGER DEFAULT 0,
  completion_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN objective_target > 0
      THEN LEAST(1.0, objective_achieved::FLOAT / objective_target::FLOAT)
      ELSE 0
    END
  ) STORED,
  generated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for Challenge History
ALTER TABLE public.challenge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenge history"
  ON public.challenge_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenge history"
  ON public.challenge_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for analytics
CREATE INDEX idx_challenge_history_user ON public.challenge_history(user_id, resolved_at DESC);
CREATE INDEX idx_challenge_history_analytics ON public.challenge_history(user_id, challenge_type, difficulty, status);

-- -----------------------------------------------------------------------------
-- 3. EXTEND USER GAMIFICATION WITH RPG FIELDS
-- Add corruption, multiplier, character class, and challenge counters
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS corruption_level INTEGER DEFAULT 0
    CHECK (corruption_level >= 0 AND corruption_level <= 100),
  ADD COLUMN IF NOT EXISTS active_multiplier FLOAT DEFAULT 1.0
    CHECK (active_multiplier >= 0.5 AND active_multiplier <= 5.0),
  ADD COLUMN IF NOT EXISTS character_class TEXT DEFAULT 'netrunner',
  ADD COLUMN IF NOT EXISTS daily_challenges_completed INTEGER DEFAULT 0
    CHECK (daily_challenges_completed >= 0),
  ADD COLUMN IF NOT EXISTS weekly_challenges_completed INTEGER DEFAULT 0
    CHECK (weekly_challenges_completed >= 0),
  ADD COLUMN IF NOT EXISTS boss_fights_won INTEGER DEFAULT 0
    CHECK (boss_fights_won >= 0),
  ADD COLUMN IF NOT EXISTS last_daily_generation DATE,
  ADD COLUMN IF NOT EXISTS last_weekly_generation DATE;

-- -----------------------------------------------------------------------------
-- 4. REALTIME SUBSCRIPTIONS
-- Enable realtime for challenge updates
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_challenges;

-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTION: Get Active Challenges Count
-- Used by UI to show challenge badge count
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_challenges_count(p_user_id uuid)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_challenges
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at > now();
$$ LANGUAGE sql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 6. HELPER FUNCTION: Calculate Difficulty from History
-- Returns recommended difficulty based on last 14 days performance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_challenge_difficulty(p_user_id uuid)
RETURNS TEXT AS $$
DECLARE
  v_completion_rate FLOAT;
BEGIN
  SELECT COALESCE(AVG(
    CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END
  ), 0.5)
  INTO v_completion_rate
  FROM public.challenge_history
  WHERE user_id = p_user_id
    AND resolved_at > now() - interval '14 days';

  -- Return difficulty based on completion rate
  RETURN CASE
    WHEN v_completion_rate < 0.4 THEN 'easy'
    WHEN v_completion_rate < 0.7 THEN 'normal'
    WHEN v_completion_rate < 0.9 THEN 'hard'
    ELSE 'boss'
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 7. TRIGGER: Archive Challenge to History on Status Change
-- Automatically creates history entry when challenge completes/fails/expires
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_challenge_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only archive when status changes to a final state
  IF NEW.status IN ('completed', 'failed', 'expired')
     AND OLD.status = 'active' THEN
    INSERT INTO public.challenge_history (
      user_id,
      challenge_id,
      challenge_type,
      objective_type,
      difficulty,
      status,
      xp_earned,
      xp_lost,
      objective_target,
      objective_achieved,
      generated_at,
      resolved_at
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.challenge_type,
      NEW.objective_type,
      NEW.difficulty,
      NEW.status,
      CASE WHEN NEW.status = 'completed' THEN NEW.reward_xp ELSE 0 END,
      CASE WHEN NEW.status IN ('failed', 'expired') THEN NEW.penalty_xp ELSE 0 END,
      NEW.objective_target,
      NEW.objective_current,
      NEW.generated_at,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_archive_challenge
  AFTER UPDATE ON public.user_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_challenge_to_history();

-- -----------------------------------------------------------------------------
-- 8. COMMENTS FOR DOCUMENTATION
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.user_challenges IS 'Active challenges per user with objectives, rewards, penalties, and ARIA narrative';
COMMENT ON TABLE public.challenge_history IS 'Completed/failed challenge archive for analytics and adaptive difficulty';
COMMENT ON COLUMN public.user_gamification.corruption_level IS 'UI corruption effect level (0-100), increases on failure, decreases on success';
COMMENT ON COLUMN public.user_gamification.active_multiplier IS 'XP multiplier from active challenges (1.0-5.0)';
COMMENT ON COLUMN public.user_gamification.character_class IS 'RPG character class for flavor (netrunner, ghost, architect, etc)';
COMMENT ON FUNCTION public.calculate_challenge_difficulty IS 'Returns recommended difficulty (easy/normal/hard/boss) based on 14-day history';
