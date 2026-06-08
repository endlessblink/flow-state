-- Privacy/export-delete support for append-only clarification history.
-- Events remain immutable during normal assistant operation, but users must be
-- able to clear their own AI memory records through the debug/delete path.

create policy "Users can delete their own AI clarification events"
  on public.ai_clarification_events for delete using (auth.uid() = user_id);
