-- Gamification System "Cyberflow" Migration
-- FEATURE-1118: XP, levels, streaks, achievements, and cosmetic shop

-- -----------------------------------------------------------------------------
-- 1. USER GAMIFICATION PROFILE
-- Main profile table storing XP, level, streak, and equipped cosmetics
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_gamification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0 CHECK (total_xp >= 0),
  available_xp INTEGER DEFAULT 0 CHECK (available_xp >= 0),  -- Spendable XP (total - spent)
  level INTEGER DEFAULT 1 CHECK (level >= 1),
  current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0),
  streak_freezes INTEGER DEFAULT 2 CHECK (streak_freezes >= 0 AND streak_freezes <= 5),
  last_activity_date DATE,
  xp_decay_date DATE,  -- When decay starts (30 days after last activity)
  unlocked_themes TEXT[] DEFAULT '{}',
  equipped_theme TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for User Gamification
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gamification profile"
  ON public.user_gamification FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gamification profile"
  ON public.user_gamification FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification profile"
  ON public.user_gamification FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_gamification_updated_at
    BEFORE UPDATE ON public.user_gamification
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. XP TRANSACTION LOG
-- Audit trail for all XP changes (earned, spent, decayed)
-- -----------------------------------------------------------------------------
CREATE TABLE public.xp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  xp_amount INTEGER NOT NULL,
  xp_type TEXT NOT NULL CHECK (xp_type IN ('earned', 'spent', 'decay')),
  reason TEXT NOT NULL,  -- 'task_complete', 'pomodoro', 'streak_bonus', 'purchase', 'daily_decay', 'achievement'
  task_id uuid,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for XP Logs
ALTER TABLE public.xp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own xp logs"
  ON public.xp_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xp logs"
  ON public.xp_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for analytics and recent logs
CREATE INDEX idx_xp_logs_user_created ON public.xp_logs(user_id, created_at DESC);
CREATE INDEX idx_xp_logs_type ON public.xp_logs(user_id, xp_type);

-- -----------------------------------------------------------------------------
-- 3. ACHIEVEMENT DEFINITIONS
-- Static table seeded with achievement data
-- -----------------------------------------------------------------------------
CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('productivity', 'consistency', 'mastery', 'exploration', 'secret')),
  xp_reward INTEGER DEFAULT 0 CHECK (xp_reward >= 0),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('count', 'streak', 'milestone', 'special')),
  condition_value INTEGER NOT NULL,
  condition_key TEXT,  -- What counter to check: 'tasks_completed', 'pomodoros_completed', etc.
  is_secret BOOLEAN DEFAULT false,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for Achievements (everyone can read definitions)
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  USING (true);

-- Only admin/service role can modify achievements
-- (No INSERT/UPDATE/DELETE policies for regular users)

-- -----------------------------------------------------------------------------
-- 4. USER ACHIEVEMENTS
-- Tracks user progress toward and completion of achievements
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0),
  earned_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,  -- When user was shown the achievement toast
  UNIQUE(user_id, achievement_id)
);

-- RLS Policies for User Achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements"
  ON public.user_achievements FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for checking earned achievements
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_earned ON public.user_achievements(user_id, earned_at)
  WHERE earned_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. SHOP ITEMS
-- Cosmetic items purchasable with XP
-- -----------------------------------------------------------------------------
CREATE TABLE public.shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('theme', 'badge_style', 'animation', 'sound')),
  price_xp INTEGER NOT NULL CHECK (price_xp > 0),
  preview_css JSONB DEFAULT '{}',  -- CSS variables for preview
  is_permanent BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,  -- Can be purchased
  required_level INTEGER DEFAULT 1 CHECK (required_level >= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for Shop Items (everyone can read)
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop items"
  ON public.shop_items FOR SELECT
  USING (true);

-- -----------------------------------------------------------------------------
-- 6. USER PURCHASES
-- Tracks what items each user has purchased
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT REFERENCES public.shop_items(id) ON DELETE CASCADE NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  xp_spent INTEGER NOT NULL CHECK (xp_spent > 0),
  UNIQUE(user_id, item_id)
);

-- RLS Policies for User Purchases
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.user_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
  ON public.user_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for quick ownership checks
CREATE INDEX idx_user_purchases_user ON public.user_purchases(user_id);

-- -----------------------------------------------------------------------------
-- 7. USER STATS (Aggregate counters for achievement checks)
-- Materialized stats for fast achievement progress checking
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tasks_completed INTEGER DEFAULT 0,
  pomodoros_completed INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  tasks_completed_on_time INTEGER DEFAULT 0,  -- Not overdue when completed
  tasks_completed_high_priority INTEGER DEFAULT 0,
  midnight_tasks INTEGER DEFAULT 0,  -- Tasks completed between 00:00-04:00
  speed_completions INTEGER DEFAULT 0,  -- Tasks completed under 60 seconds
  views_used JSONB DEFAULT '{}',  -- Track which views have been used
  features_used JSONB DEFAULT '{}',  -- Track feature discovery
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for User Stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats"
  ON public.user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
  ON public.user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON public.user_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to initialize gamification profile for new users
CREATE OR REPLACE FUNCTION create_gamification_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create gamification profile on user signup
-- Note: This requires the trigger to be on auth.users which may need superuser
-- Alternative: Call from application layer on first login
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_gamification_profile();

-- Function to calculate level from total XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  level INTEGER := 1;
  xp_required INTEGER := 100;
  remaining_xp INTEGER := xp;
BEGIN
  -- Level 1-5: 100 XP each (100, 200, 300, 400, 500)
  WHILE level <= 5 AND remaining_xp >= xp_required LOOP
    remaining_xp := remaining_xp - xp_required;
    level := level + 1;
    xp_required := level * 100;
  END LOOP;

  -- Level 6-10: 250 XP increment (750, 1000, 1250, 1500, 1750)
  WHILE level > 5 AND level <= 10 AND remaining_xp >= xp_required LOOP
    remaining_xp := remaining_xp - xp_required;
    level := level + 1;
    xp_required := 500 + (level - 5) * 250;
  END LOOP;

  -- Level 11+: 500 XP increment (2250, 2750, 3250...)
  WHILE level > 10 AND remaining_xp >= xp_required LOOP
    remaining_xp := remaining_xp - xp_required;
    level := level + 1;
    xp_required := 1750 + (level - 10) * 500;
  END LOOP;

  RETURN level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- 9. ENABLE REALTIME
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_gamification;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;

-- -----------------------------------------------------------------------------
-- 10. SEED INITIAL ACHIEVEMENTS
-- -----------------------------------------------------------------------------
INSERT INTO public.achievements (id, name, description, icon, category, xp_reward, condition_type, condition_value, condition_key, is_secret, tier) VALUES
  -- Productivity (8 achievements)
  ('tasks_10', 'Getting Started', 'Complete 10 tasks', 'rocket', 'productivity', 50, 'count', 10, 'tasks_completed', false, 'bronze'),
  ('tasks_50', 'Task Master', 'Complete 50 tasks', 'target', 'productivity', 150, 'count', 50, 'tasks_completed', false, 'silver'),
  ('tasks_100', 'Centurion', 'Complete 100 tasks', 'award', 'productivity', 300, 'count', 100, 'tasks_completed', false, 'gold'),
  ('tasks_500', 'Legendary Achiever', 'Complete 500 tasks', 'crown', 'productivity', 500, 'count', 500, 'tasks_completed', false, 'platinum'),
  ('priority_crusher', 'Priority Crusher', 'Complete 25 high-priority tasks', 'flame', 'productivity', 100, 'count', 25, 'tasks_completed_high_priority', false, 'silver'),
  ('on_time_10', 'Punctual', 'Complete 10 tasks before their due date', 'clock', 'productivity', 75, 'count', 10, 'tasks_completed_on_time', false, 'bronze'),
  ('on_time_50', 'Time Master', 'Complete 50 tasks before their due date', 'hourglass', 'productivity', 200, 'count', 50, 'tasks_completed_on_time', false, 'gold'),
  ('batch_5', 'Batch Processor', 'Complete 5 tasks in a single day', 'layers', 'productivity', 50, 'milestone', 5, 'daily_tasks', false, 'bronze'),

  -- Consistency (6 achievements)
  ('streak_7', 'Week Warrior', 'Maintain a 7-day streak', 'fire', 'consistency', 50, 'streak', 7, 'current_streak', false, 'bronze'),
  ('streak_30', 'Monthly Master', 'Maintain a 30-day streak', 'calendar', 'consistency', 150, 'streak', 30, 'current_streak', false, 'silver'),
  ('streak_100', 'Century Club', 'Maintain a 100-day streak', 'trophy', 'consistency', 300, 'streak', 100, 'current_streak', false, 'gold'),
  ('streak_365', 'Year of Flow', 'Maintain a 365-day streak', 'star', 'consistency', 500, 'streak', 365, 'current_streak', false, 'platinum'),
  ('comeback', 'Comeback Kid', 'Return after 7+ days and complete a task', 'refresh-cw', 'consistency', 25, 'special', 1, 'comeback', false, 'bronze'),
  ('freeze_master', 'Freeze Master', 'Use a streak freeze to save your streak', 'shield', 'consistency', 25, 'special', 1, 'freeze_used', false, 'bronze'),

  -- Mastery (8 achievements)
  ('pomo_10', 'Focused Mind', 'Complete 10 Pomodoro sessions', 'timer', 'mastery', 50, 'count', 10, 'pomodoros_completed', false, 'bronze'),
  ('pomo_50', 'Deep Worker', 'Complete 50 Pomodoro sessions', 'brain', 'mastery', 150, 'count', 50, 'pomodoros_completed', false, 'silver'),
  ('pomo_100', 'Focus Champion', 'Complete 100 Pomodoro sessions', 'zap', 'mastery', 300, 'count', 100, 'pomodoros_completed', false, 'gold'),
  ('pomo_500', 'Flow State Master', 'Complete 500 Pomodoro sessions', 'infinity', 'mastery', 500, 'count', 500, 'pomodoros_completed', false, 'platinum'),
  ('focus_1h', 'One Hour Focus', 'Accumulate 1 hour of focus time', 'clock', 'mastery', 25, 'count', 60, 'total_focus_minutes', false, 'bronze'),
  ('focus_10h', 'Ten Hour Focus', 'Accumulate 10 hours of focus time', 'clock', 'mastery', 100, 'count', 600, 'total_focus_minutes', false, 'silver'),
  ('focus_100h', 'Hundred Hour Focus', 'Accumulate 100 hours of focus time', 'clock', 'mastery', 300, 'count', 6000, 'total_focus_minutes', false, 'gold'),
  ('marathon', 'Marathon Session', 'Complete 4 Pomodoros in a row', 'activity', 'mastery', 75, 'milestone', 4, 'consecutive_pomodoros', false, 'silver'),

  -- Exploration (5 achievements)
  ('first_canvas', 'Canvas Explorer', 'Create your first group on the canvas', 'layout', 'exploration', 25, 'special', 1, 'canvas_used', false, 'bronze'),
  ('board_view', 'Board Navigator', 'Use the Kanban board view', 'columns', 'exploration', 25, 'special', 1, 'board_used', false, 'bronze'),
  ('calendar_view', 'Calendar Pro', 'Schedule a task using the calendar', 'calendar', 'exploration', 25, 'special', 1, 'calendar_used', false, 'bronze'),
  ('mobile_user', 'Mobile Warrior', 'Complete a task on mobile', 'smartphone', 'exploration', 50, 'special', 1, 'mobile_used', false, 'silver'),
  ('theme_buyer', 'Style Seeker', 'Purchase your first theme from the shop', 'palette', 'exploration', 50, 'special', 1, 'theme_purchased', false, 'bronze'),

  -- Secret (5 achievements)
  ('night_owl', 'Night Owl', 'Complete a task between midnight and 4 AM', 'moon', 'secret', 100, 'special', 1, 'midnight_task', true, 'silver'),
  ('speed_demon', 'Speed Demon', 'Complete a task within 60 seconds of creation', 'zap', 'secret', 75, 'special', 1, 'speed_completion', true, 'bronze'),
  ('early_bird', 'Early Bird', 'Complete a task before 6 AM', 'sunrise', 'secret', 75, 'special', 1, 'early_task', true, 'bronze'),
  ('perfect_week', 'Perfect Week', 'Complete at least one task every day for a week', 'check-circle', 'secret', 150, 'streak', 7, 'perfect_week', true, 'gold'),
  ('xp_hoarder', 'XP Hoarder', 'Accumulate 10,000 XP', 'database', 'secret', 0, 'count', 10000, 'total_xp', true, 'platinum')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. SEED INITIAL SHOP ITEMS
-- -----------------------------------------------------------------------------
INSERT INTO public.shop_items (id, name, description, category, price_xp, preview_css, required_level) VALUES
  -- Themes (5 items)
  ('theme_neon_cyan', 'Neon Cyan', 'Electric cyan accent with glowing highlights', 'theme', 500,
    '{"--accent-primary": "0, 255, 255", "--accent-glow": "0 0 8px rgba(0, 255, 255, 0.6)"}', 1),
  ('theme_neon_magenta', 'Neon Magenta', 'Vibrant magenta for a cyberpunk vibe', 'theme', 500,
    '{"--accent-primary": "255, 0, 255", "--accent-glow": "0 0 8px rgba(255, 0, 255, 0.6)"}', 1),
  ('theme_neon_lime', 'Neon Lime', 'Matrix-inspired green glow', 'theme', 500,
    '{"--accent-primary": "57, 255, 20", "--accent-glow": "0 0 8px rgba(57, 255, 20, 0.6)"}', 1),
  ('theme_sunset', 'Sunset Orange', 'Warm sunset gradient accents', 'theme', 750,
    '{"--accent-primary": "255, 107, 53", "--accent-glow": "0 0 8px rgba(255, 107, 53, 0.6)"}', 5),
  ('theme_royal_purple', 'Royal Purple', 'Elegant purple for distinguished achievers', 'theme', 1000,
    '{"--accent-primary": "138, 43, 226", "--accent-glow": "0 0 8px rgba(138, 43, 226, 0.6)"}', 10),

  -- Badge Styles (3 items)
  ('badge_glow', 'Glowing Badges', 'Add a pulsing glow to your achievement badges', 'badge_style', 750,
    '{"--badge-glow": "0 0 10px var(--accent-primary)", "--badge-animation": "pulse 2s infinite"}', 3),
  ('badge_platinum', 'Platinum Borders', 'Shiny platinum borders on all badges', 'badge_style', 1000,
    '{"--badge-border": "2px solid #e5e4e2", "--badge-shine": "linear-gradient(135deg, #e5e4e2, #b8b8b8)"}', 7),
  ('badge_holographic', 'Holographic', 'Rainbow holographic effect on badges', 'badge_style', 1500,
    '{"--badge-effect": "holographic", "--badge-animation": "rainbow 3s linear infinite"}', 10),

  -- Animations (3 items)
  ('anim_confetti', 'Confetti Celebration', 'Confetti burst on level up', 'animation', 500,
    '{"--levelup-effect": "confetti"}', 1),
  ('anim_rainbow_glow', 'Rainbow Glow', 'XP bar cycles through rainbow colors', 'animation', 1000,
    '{"--xp-bar-animation": "rainbow 3s linear infinite"}', 5),
  ('anim_particle_trail', 'Particle Trail', 'Sparkling particles follow your cursor', 'animation', 2000,
    '{"--cursor-effect": "particles"}', 15)
ON CONFLICT (id) DO NOTHING;
