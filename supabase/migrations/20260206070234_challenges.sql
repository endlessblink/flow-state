-- FEATURE-1132: Cyberflow RPG — AI Game Master Challenge System
-- This migration adds:
-- 1. user_challenges table for active challenges
-- 2. challenge_history table for analytics
-- 3. New columns on user_gamification for corruption, multipliers, and challenge stats

-- =============================================================================
-- Table: user_challenges
-- Active challenges per user (daily missions, weekly bosses, special events)
-- =============================================================================

CREATE TABLE public.user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Challenge type and identity
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('daily', 'weekly', 'boss', 'special')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Objective definition
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
  objective_context JSONB, -- e.g., { projectId: "...", hour: 9 }

  -- Rewards and penalties
  reward_xp INTEGER NOT NULL CHECK (reward_xp >= 0),
  reward_bonus JSONB, -- e.g., { streakMultiplier: 0.1, shopDiscount: 0.2 }
  penalty_xp INTEGER DEFAULT 0 CHECK (penalty_xp >= 0),

  -- Difficulty and narrative
  difficulty TEXT DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard', 'boss')),
  narrative_flavor TEXT, -- ARIA's cyberpunk flavor text

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- AI context for debugging/analytics
  ai_context JSONB, -- The context sent to AI when generating this challenge

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Table: challenge_history
-- Completed/failed challenge analytics for difficulty scaling
-- =============================================================================

CREATE TABLE public.challenge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Challenge reference (denormalized for analytics)
  challenge_type TEXT NOT NULL,
  objective_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,

  -- Outcome
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'expired')),
  xp_earned INTEGER DEFAULT 0,
  xp_lost INTEGER DEFAULT 0,
  completion_rate FLOAT, -- objective_current / objective_target at time of resolution

  -- Timing
  generated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ DEFAULT now(),

  -- Duration analytics
  time_to_complete_minutes INTEGER, -- NULL if failed/expired

  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Alter: user_gamification
-- Add RPG fields for corruption, multipliers, and challenge stats
-- =============================================================================

ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS corruption_level INTEGER DEFAULT 0
    CHECK (corruption_level >= 0 AND corruption_level <= 100),
  ADD COLUMN IF NOT EXISTS active_multiplier FLOAT DEFAULT 1.0
    CHECK (active_multiplier >= 0.5 AND active_multiplier <= 3.0),
  ADD COLUMN IF NOT EXISTS character_class TEXT DEFAULT 'netrunner',
  ADD COLUMN IF NOT EXISTS daily_challenges_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_challenges_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boss_fights_won INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_challenges_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_generation DATE,
  ADD COLUMN IF NOT EXISTS last_weekly_generation DATE;

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own challenges
CREATE POLICY "users_own_challenges" ON public.user_challenges
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own challenge history
CREATE POLICY "users_own_challenge_history" ON public.challenge_history
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Fast lookup of active challenges for a user
CREATE INDEX idx_user_challenges_active ON public.user_challenges(user_id, status)
  WHERE status = 'active';

-- Find expiring challenges for cleanup
CREATE INDEX idx_user_challenges_expires ON public.user_challenges(expires_at)
  WHERE status = 'active';

-- User's challenge type for daily limit checking
CREATE INDEX idx_user_challenges_type ON public.user_challenges(user_id, challenge_type, status);

-- Challenge history for difficulty calculation
CREATE INDEX idx_challenge_history_user ON public.challenge_history(user_id, resolved_at DESC);

-- History by type for pattern analysis
CREATE INDEX idx_challenge_history_type ON public.challenge_history(user_id, challenge_type, objective_type);

-- =============================================================================
-- Realtime
-- =============================================================================

-- Enable realtime for challenges (for cross-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_challenges;

-- =============================================================================
-- Trigger: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_challenge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_challenges_updated_at
  BEFORE UPDATE ON public.user_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_updated_at();

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE public.user_challenges IS 'Active challenges (daily missions, weekly bosses) for the Cyberflow RPG gamification system (FEATURE-1132)';
COMMENT ON TABLE public.challenge_history IS 'Historical record of completed/failed challenges for analytics and difficulty scaling';
COMMENT ON COLUMN public.user_gamification.corruption_level IS 'Visual corruption level 0-100, increases on failed challenges, decreases on completion';
COMMENT ON COLUMN public.user_gamification.active_multiplier IS 'XP multiplier when challenges are active (2x default when dailies active)';
COMMENT ON COLUMN public.user_gamification.character_class IS 'RPG character class (netrunner default, future expansion)';
