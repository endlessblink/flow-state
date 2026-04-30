-- BUG-1777 hardening: never let a fallback title clobber an existing real title.
--
-- The previous trigger normalized blank writes to "Untitled Task". That prevented
-- blank storage, but stale local caches could still persist the fallback over a
-- real title during whole-row upserts. On UPDATE, preserve OLD.title whenever it
-- is real and the incoming title is blank or the fallback.

CREATE OR REPLACE FUNCTION public.trg_normalize_task_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.title IS NOT NULL
     AND length(trim(OLD.title)) > 0
     AND trim(OLD.title) <> 'Untitled Task'
     AND (NEW.title IS NULL OR length(trim(NEW.title)) = 0 OR trim(NEW.title) = 'Untitled Task') THEN
    NEW.title := trim(OLD.title);
  ELSIF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    NEW.title := 'Untitled Task';
  ELSE
    NEW.title := trim(NEW.title);
  END IF;

  RETURN NEW;
END;
$$;
