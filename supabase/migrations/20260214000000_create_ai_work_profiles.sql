-- FEATURE-1317: AI Work Profile / Persistent Memory
-- Stores user work preferences and learned productivity patterns

CREATE TABLE public.ai_work_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  work_days text[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  days_off text[] DEFAULT ARRAY[]::text[],
  heavy_meeting_days text[] DEFAULT ARRAY[]::text[],
  max_tasks_per_day integer DEFAULT 6,
  preferred_work_style text DEFAULT 'balanced',
  top_priority_note text,
  avg_work_minutes_per_day numeric(6,1),
  avg_tasks_completed_per_day numeric(4,1),
  peak_productivity_days text[],
  avg_plan_accuracy numeric(5,2),
  weekly_history jsonb DEFAULT '[]'::jsonb,
  profile_version integer DEFAULT 1,
  interview_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_work_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.ai_work_profiles
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_ai_work_profiles_user ON public.ai_work_profiles(user_id);
