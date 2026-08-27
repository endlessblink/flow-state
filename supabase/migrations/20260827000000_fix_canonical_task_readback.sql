-- Keep canonical task previews compatible with the Electron receipt validator.
-- This forward migration repairs databases that already applied the original
-- canonical-domain migration without replaying that historical migration.

CREATE OR REPLACE FUNCTION public.flowstate_h3_task_read_back(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', task.id,
    'title', task.title,
    'description', task.description,
    'priority', task.priority,
    'progress', task.progress,
    'status', CASE WHEN task.status = 'done' THEN 'done' ELSE 'todo' END,
    'completedAt', task.completed_at,
    'dueDate', task.due_date,
    'isDeleted', task.is_deleted,
    'deletedAt', task.deleted_at,
    'workspaceId', task.workspace_id,
    'canonicalRevision', task.canonical_revision,
    'canonicalUpdatedAt', task.updated_at,
    'recurrenceRule', task.recurrence_rule,
    'recurrenceParentId', task.recurrence_parent_id,
    'recurrenceCount', task.recurrence_count,
    'isCompletionRecord', task.is_completion_record
  )
  FROM public.tasks AS task
  WHERE task.id::text = p_task_id
$$;
