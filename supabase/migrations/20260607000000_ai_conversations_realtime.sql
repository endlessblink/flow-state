-- Ensure AI chat conversations emit Supabase Realtime events for cross-surface sync.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
