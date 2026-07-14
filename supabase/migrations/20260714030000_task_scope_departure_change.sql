-- TASK-1956: a workspace move must advance both the destination and source
-- scope cursors. The canonical change trigger records NEW.workspace_id; this
-- companion tombstone records OLD.workspace_id so an inventory already reading
-- the source scope detects the membership change and retries.

CREATE OR REPLACE FUNCTION public.flowstate_task_scope_departure_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    INSERT INTO public.canonical_change_log (
      user_id,
      actor_user_id,
      workspace_id,
      entity_type,
      entity_id,
      action,
      canonical_revision,
      operation_id,
      source,
      tombstone,
      projection
    ) VALUES (
      OLD.user_id,
      (SELECT auth.uid()),
      OLD.workspace_id,
      'task',
      OLD.id,
      'deleted',
      NEW.canonical_revision,
      NULL,
      'scope_departure',
      true,
      pg_catalog.jsonb_build_object(
        'id', OLD.id,
        'workspaceId', OLD.workspace_id,
        'movedToWorkspaceId', NEW.workspace_id,
        'isDeleted', true
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_task_scope_departure_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flowstate_task_scope_departure_change ON public.tasks;
CREATE TRIGGER flowstate_task_scope_departure_change
AFTER UPDATE OF workspace_id ON public.tasks
FOR EACH ROW
WHEN (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id)
EXECUTE FUNCTION public.flowstate_task_scope_departure_change();
