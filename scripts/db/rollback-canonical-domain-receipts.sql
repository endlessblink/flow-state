-- Roll back only the H3 canonical receipt wrapper surface.
--
-- This inverse intentionally keeps the additive canonical_operations columns
-- and every committed operation row. It restores the pre-H3 public function
-- signatures and privileges without deleting user or receipt data. The whole
-- inverse is one transaction so an interrupted or rejected DDL statement
-- cannot leave a mixed public RPC surface.

BEGIN;

DROP FUNCTION IF EXISTS public.flowstate_patch_task_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
);
DROP FUNCTION IF EXISTS public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid, text
);
DROP FUNCTION IF EXISTS public.flowstate_done_for_now(
  text, boolean, date, text, text, uuid, text
);
DROP FUNCTION IF EXISTS public.flowstate_merge_tasks(
  text, text, boolean, text, text, uuid, text
);
DROP FUNCTION IF EXISTS public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid, text
);

DO $rollback$
BEGIN
  IF pg_catalog.to_regprocedure(
       'public.flowstate_patch_task_v1_h3_base(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_patch_task_v1_h3_base(
      text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
    ) RENAME TO flowstate_patch_task_v1;
  END IF;

  IF pg_catalog.to_regprocedure(
       'public.flowstate_complete_task_v1_h3_base(text,text,text,text,bigint,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamptz,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_complete_task_v1_h3_base(
      text, text, text, text, bigint, boolean, text, timestamptz, uuid
    ) RENAME TO flowstate_complete_task_v1;
  END IF;

  IF pg_catalog.to_regprocedure(
       'public.flowstate_done_for_now_h3_base(text,boolean,date,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_done_for_now(text,boolean,date,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_done_for_now_h3_base(
      text, boolean, date, text, text, uuid
    ) RENAME TO flowstate_done_for_now;
  END IF;

  IF pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_h3_base(text,text,boolean,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks(text,text,boolean,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_merge_tasks_h3_base(
      text, text, boolean, text, text, uuid
    ) RENAME TO flowstate_merge_tasks;
  END IF;

  IF pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence_h3_base(text,text,jsonb,boolean,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence(text,text,jsonb,boolean,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_merge_tasks_with_recurrence_h3_base(
      text, text, jsonb, boolean, text, text, uuid
    ) RENAME TO flowstate_merge_tasks_with_recurrence;
  END IF;
END;
$rollback$;

REVOKE ALL ON FUNCTION public.flowstate_patch_task_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_done_for_now(
  text, boolean, date, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks(
  text, text, boolean, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.flowstate_patch_task_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_done_for_now(
  text, boolean, date, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks(
  text, text, boolean, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid
) TO authenticated;

DROP FUNCTION IF EXISTS public.flowstate_h3_finalize_receipt(
  uuid, text, jsonb, jsonb, jsonb
);
DROP FUNCTION IF EXISTS public.flowstate_h3_link_task_changes(
  text[], text, bigint
);
DROP FUNCTION IF EXISTS public.flowstate_h3_task_affected(
  text[], text[]
);
DROP FUNCTION IF EXISTS public.flowstate_h3_task_read_back(text);

NOTIFY pgrst, 'reload schema';

COMMIT;
