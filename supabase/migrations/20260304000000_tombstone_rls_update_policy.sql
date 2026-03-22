-- BUG-1136: Add missing UPDATE policy to tombstones RLS
--
-- The tombstones table was created with SELECT, INSERT, and DELETE policies
-- (all checking auth.uid() = user_id), but no UPDATE policy.
--
-- The application uses upsert with onConflict to record tombstones
-- (src/composables/supabase/_tombstone.ts). When a conflict occurs on
-- (entity_type, entity_id, user_id), Postgres resolves it via UPDATE.
-- Without an UPDATE policy, these upserts silently fail for authenticated
-- users — only the SECURITY DEFINER trigger (trg_task_tombstone) succeeds.
--
-- Fix: Add UPDATE policy with the same auth.uid() = user_id ownership check.

DROP POLICY IF EXISTS "Users can update their own tombstones" ON public.tombstones;
CREATE POLICY "Users can update their own tombstones"
    ON public.tombstones FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
