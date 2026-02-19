-- TASK-1344: AI settings, conversations, and usage sync to Supabase
-- Enables cross-device persistence for AI chat provider/model, conversation history, and usage tracking

-- 1. Add ai_settings JSONB column to user_settings
-- Stores: { provider, model, chatDirection }
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS ai_settings jsonb;

-- 2. AI Conversations table
-- Stores chat conversations with messages as JSONB array
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id text PRIMARY KEY,                    -- app-generated: conv_${timestamp}_${random}
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'New Chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
  ON public.ai_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON public.ai_conversations(user_id, updated_at DESC);

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- 3. AI Usage Log (daily aggregates per user/provider/model)
-- Raw usage entries are aggregated into daily buckets client-side before upsert
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date, provider, model)
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own usage log"
  ON public.ai_usage_log FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_date
  ON public.ai_usage_log(user_id, date DESC);

CREATE TRIGGER update_ai_usage_log_updated_at
  BEFORE UPDATE ON public.ai_usage_log
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- 4. Additive upsert function for usage log
-- Adds tokens/requests to existing daily aggregate instead of replacing
CREATE OR REPLACE FUNCTION public.upsert_ai_usage_log(
  p_user_id uuid,
  p_date date,
  p_provider text,
  p_model text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_request_count integer
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_usage_log(user_id, date, provider, model, input_tokens, output_tokens, request_count)
  VALUES (p_user_id, p_date, p_provider, p_model, p_input_tokens, p_output_tokens, p_request_count)
  ON CONFLICT (user_id, date, provider, model)
  DO UPDATE SET
    input_tokens = ai_usage_log.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_usage_log.output_tokens + EXCLUDED.output_tokens,
    request_count = ai_usage_log.request_count + EXCLUDED.request_count,
    updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION public.upsert_ai_usage_log TO authenticated;
