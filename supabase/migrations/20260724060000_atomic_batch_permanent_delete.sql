-- Permanently delete a task selection as one all-or-nothing operation.
-- Any visibility or DELETE-policy mismatch raises inside this transaction, so
-- PostgreSQL rolls back both hard deletes and recurrence-chain changes.

CREATE OR REPLACE FUNCTION public.flowstate_permanently_delete_tasks(
  p_task_ids text[],
  p_user_id uuid,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_requested_count integer;
  v_visible_count integer;
  v_deleted_ids text[];
  v_chain_ids text[];
  v_payload_hash text;
  v_receipt jsonb;
  v_existing_receipt public.flowstate_action_receipts%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Authentication scope mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF p_task_ids IS NULL
     OR cardinality(p_task_ids) = 0
     OR array_position(p_task_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'At least one exact task id is required'
      USING ERRCODE = '22023';
  END IF;

  IF nullif(pg_catalog.btrim(p_request_id), '') IS NULL THEN
    RAISE EXCEPTION 'A stable request id is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT requested_id)
  INTO v_requested_count
  FROM pg_catalog.unnest(p_task_ids) AS requested(requested_id);

  IF v_requested_count IS DISTINCT FROM cardinality(p_task_ids) THEN
    RAISE EXCEPTION 'Duplicate task ids are not allowed'
      USING ERRCODE = '22023';
  END IF;

  v_payload_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        (
          SELECT pg_catalog.jsonb_agg(requested_id ORDER BY requested_id)::text
          FROM pg_catalog.unnest(p_task_ids) AS requested(requested_id)
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT *
  INTO v_existing_receipt
  FROM public.flowstate_action_receipts
  WHERE user_id = v_actor
    AND operation = 'permanently_delete_tasks'
    AND request_id = pg_catalog.btrim(p_request_id);

  IF FOUND THEN
    IF v_existing_receipt.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Request id was already used for another task selection'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing_receipt.receipt;
  END IF;

  PERFORM task.id
  FROM public.tasks AS task
  WHERE task.id = ANY(p_task_ids)
    AND (
      (task.workspace_id IS NULL AND task.user_id = v_actor)
      OR (
        task.workspace_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1
            FROM public.workspace_members AS member
            WHERE member.workspace_id = task.workspace_id
              AND member.user_id = v_actor
              AND member.role IN ('owner', 'admin', 'member')
          )
          OR EXISTS (
            SELECT 1
            FROM public.workspaces AS workspace
            WHERE workspace.id = task.workspace_id
              AND workspace.owner_id = v_actor
          )
        )
      )
    )
  FOR UPDATE;

  -- An identical request may have waited on the task lock while the first
  -- transaction completed. Return its durable receipt instead of treating the
  -- now-absent rows as a failed retry.
  SELECT *
  INTO v_existing_receipt
  FROM public.flowstate_action_receipts
  WHERE user_id = v_actor
    AND operation = 'permanently_delete_tasks'
    AND request_id = pg_catalog.btrim(p_request_id);

  IF FOUND THEN
    IF v_existing_receipt.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Request id was already used for another task selection'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing_receipt.receipt;
  END IF;

  SELECT
    count(*),
    coalesce(
      array_agg(DISTINCT coalesce(task.recurrence_parent_id, task.id))
        FILTER (WHERE task.recurrence_rule IS NOT NULL),
      ARRAY[]::text[]
    )
  INTO v_visible_count, v_chain_ids
  FROM public.tasks AS task
  WHERE task.id = ANY(p_task_ids)
    AND (
      (task.workspace_id IS NULL AND task.user_id = v_actor)
      OR (
        task.workspace_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1
            FROM public.workspace_members AS member
            WHERE member.workspace_id = task.workspace_id
              AND member.user_id = v_actor
              AND member.role IN ('owner', 'admin', 'member')
          )
          OR EXISTS (
            SELECT 1
            FROM public.workspaces AS workspace
            WHERE workspace.id = task.workspace_id
              AND workspace.owner_id = v_actor
          )
        )
      )
    );

  IF v_visible_count IS DISTINCT FROM v_requested_count THEN
    RAISE EXCEPTION 'Permanent delete scope mismatch: % of % tasks are visible',
      v_visible_count, v_requested_count
      USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_chain_ids) > 0 THEN
    UPDATE public.tasks
    SET recurrence_rule = NULL,
        updated_at = clock_timestamp()
    WHERE id = ANY(v_chain_ids)
       OR recurrence_parent_id = ANY(v_chain_ids);
  END IF;

  -- Destructive statement, guarded three ways (TASK-1977):
  --   * scope was already proven above — the actor can see every requested id,
  --     or the function raised 42501 before reaching here;
  --   * all-or-none — the count check below raises and rolls the transaction
  --     back if the deleted set differs from what was requested;
  --   * safety backup is automatic — trg_task_tombstone fires BEFORE DELETE on
  --     public.tasks and records a tombstone per row, so a later sync cannot
  --     resurrect what was permanently deleted.
  WITH deleted AS (
    DELETE FROM public.tasks
    WHERE id = ANY(p_task_ids)
    RETURNING id
  )
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::text[])
  INTO v_deleted_ids
  FROM deleted;

  IF cardinality(v_deleted_ids) IS DISTINCT FROM v_requested_count THEN
    RAISE EXCEPTION 'Permanent delete policy mismatch: % of % tasks were deleted',
      cardinality(v_deleted_ids), v_requested_count
      USING ERRCODE = '42501';
  END IF;

  v_receipt := pg_catalog.jsonb_build_object(
    'deleted_ids', to_jsonb(v_deleted_ids),
    'deleted_count', cardinality(v_deleted_ids),
    'request_id', pg_catalog.btrim(p_request_id)
  );

  INSERT INTO public.flowstate_action_receipts (
    user_id, workspace_id, operation, request_id,
    payload_hash, preview_version, receipt
  ) VALUES (
    v_actor, NULL, 'permanently_delete_tasks', pg_catalog.btrim(p_request_id),
    v_payload_hash, 'batch-permanent-delete-v1', v_receipt
  );

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_permanently_delete_tasks(text[], uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_permanently_delete_tasks(text[], uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.flowstate_permanently_delete_tasks(text[], uuid, text) IS
  'Atomically clears recurrence chains and hard-deletes a complete authorized task selection; any partial result rolls back.';
