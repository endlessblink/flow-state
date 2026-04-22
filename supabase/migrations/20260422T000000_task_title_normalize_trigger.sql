-- BUG-1779: server-side guarantee that tasks.title is never blank.
-- Follow-up to BUG-1777 (sync-ingress sanitize) — closes the last hole where
-- a client path bypassing toSupabaseTask() (direct SQL, RPC, third-party
-- write) could store an empty string in public.tasks.title.
--
-- The trigger NORMALIZES rather than REJECTS so optimistic UI edits that
-- briefly hold title = '' during user typing are not blocked.

CREATE OR REPLACE FUNCTION public.trg_normalize_task_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    NEW.title := 'Untitled Task';
  ELSE
    NEW.title := trim(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_task_title_before_write ON public.tasks;
CREATE TRIGGER trg_normalize_task_title_before_write
  BEFORE INSERT OR UPDATE OF title ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_normalize_task_title();
