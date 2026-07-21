-- FEATURE-1947: signed, preview-first timer control for the local companion.

ALTER TABLE public.timer_sessions
  ADD COLUMN IF NOT EXISTS canonical_revision bigint NOT NULL DEFAULT 1
  CHECK (canonical_revision > 0);

CREATE OR REPLACE FUNCTION public.flowstate_increment_timer_revision_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(
    NEW.task_id, NEW.duration, NEW.is_active, NEW.is_paused,
    NEW.is_break, NEW.completed_at
  ) IS DISTINCT FROM ROW(
    OLD.task_id, OLD.duration, OLD.is_active, OLD.is_paused,
    OLD.is_break, OLD.completed_at
  ) THEN
    NEW.canonical_revision := OLD.canonical_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timer_sessions_canonical_revision
  ON public.timer_sessions;
CREATE TRIGGER timer_sessions_canonical_revision
BEFORE UPDATE ON public.timer_sessions
FOR EACH ROW
EXECUTE FUNCTION public.flowstate_increment_timer_revision_v1();

-- Repair legacy duplicate-active rows deterministically before enforcing the
-- invariant for every writer, including old renderer and KDE clients.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS position
  FROM public.timer_sessions
  WHERE is_active = true
)
UPDATE public.timer_sessions AS session
SET is_active = false,
    completed_at = COALESCE(session.completed_at, pg_catalog.clock_timestamp())
FROM ranked
WHERE session.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS timer_sessions_one_active_per_user_idx
  ON public.timer_sessions (user_id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.flowstate_timer_lifecycle_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_action text,
  p_session_id uuid,
  p_base_revision bigint,
  p_payload jsonb,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_session public.timer_sessions%ROWTYPE;
  v_updated public.timer_sessions%ROWTYPE;
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_expires_at timestamptz;
  v_request_hash text;
  v_expected_digest text;
  v_read_back jsonb;
  v_proposed jsonb;
  v_receipt jsonb;
  v_read_back_hash text;
  v_change_sequence bigint;
  v_task_id text;
  v_duration integer;
  v_is_break boolean;
  v_effective_remaining integer;
  v_elapsed_seconds integer;
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'not_authenticated', 'message', 'Authentication is required'
      )
    );
  END IF;

  IF p_contract_version IS DISTINCT FROM 'timer-lifecycle-v1'
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS NULL
     OR p_source !~ '^[a-z0-9][a-z0-9._:-]{0,63}$'
     OR p_action NOT IN ('start', 'pause', 'resume', 'stop')
     OR p_session_id IS NULL
     OR p_base_revision IS NULL
     OR p_base_revision < 0
     OR p_payload IS NULL
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The canonical timer request is invalid'
      )
    );
  END IF;

  IF p_action = 'start' THEN
    IF p_base_revision <> 0
       OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(p_payload) key)
          IS DISTINCT FROM ARRAY['duration', 'isBreak', 'taskId']::text[]
       OR pg_catalog.jsonb_typeof(p_payload -> 'taskId') <> 'string'
       OR pg_catalog.jsonb_typeof(p_payload -> 'duration') <> 'number'
       OR pg_catalog.jsonb_typeof(p_payload -> 'isBreak') <> 'boolean' THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_request', 'message', 'The timer start payload is invalid')
      );
    END IF;
    v_task_id := p_payload ->> 'taskId';
    BEGIN
      v_duration := (p_payload ->> 'duration')::integer;
    EXCEPTION WHEN OTHERS THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_request', 'message', 'The timer duration is invalid')
      );
    END;
    v_is_break := (p_payload ->> 'isBreak')::boolean;
    IF nullif(pg_catalog.btrim(v_task_id), '') IS NULL
       OR pg_catalog.char_length(v_task_id) > 160
       OR v_duration < 1 OR v_duration > 86400
       OR (v_is_break AND v_task_id <> 'break')
       OR (NOT v_is_break AND v_task_id = 'break') THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_request', 'message', 'The timer start payload is invalid')
      );
    END IF;
    IF v_task_id NOT IN ('general', 'break') AND NOT EXISTS (
      SELECT 1
      FROM public.tasks AS task
      WHERE task.id::text = v_task_id
        AND task.is_deleted = false
        AND (
          (task.workspace_id IS NULL AND task.user_id = v_actor)
          OR (task.workspace_id IS NOT NULL AND public.flowstate_can_read_workspace_v1(task.workspace_id))
        )
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'task_not_found', 'message', 'Task was not found')
      );
    END IF;
  ELSIF p_base_revision < 1 OR p_payload <> '{}'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object('code', 'invalid_request', 'message', 'The timer action payload is invalid')
    );
  END IF;

  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
          'contractVersion', p_contract_version,
          'source', p_source,
          'action', p_action,
          'sessionId', p_session_id,
          'baseRevision', p_base_revision,
          'payload', p_payload
        )),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  IF NOT p_preview AND p_request_hash IS DISTINCT FROM v_request_hash THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request')
    );
  END IF;

  -- All timer state for one actor is serialized, not only one session row.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':timer-lifecycle', 0)
  );

  SELECT * INTO v_existing
  FROM public.canonical_operations AS operation
  WHERE operation.user_id = v_actor
    AND operation.operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already used for another request')
      );
    END IF;
    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      v_receipt := v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true);
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed', 'status', 'committed',
        'requestHash', v_request_hash, 'receipt', v_receipt
      );
    END IF;
  END IF;

  IF p_action = 'start' THEN
    IF p_preview THEN
      SELECT * INTO v_session
      FROM public.timer_sessions
      WHERE user_id = v_actor AND is_active = true
      ORDER BY updated_at DESC LIMIT 1;
    ELSE
      SELECT * INTO v_session
      FROM public.timer_sessions
      WHERE user_id = v_actor AND is_active = true
      ORDER BY updated_at DESC LIMIT 1
      FOR UPDATE;
    END IF;
    IF FOUND THEN
      v_elapsed_seconds := CASE WHEN v_session.is_paused THEN 0 ELSE
        pg_catalog.greatest(0, pg_catalog.floor(pg_catalog.date_part(
          'epoch', (v_now - pg_catalog.coalesce(
            v_session.device_leader_last_seen, v_session.updated_at, v_session.start_time
          ))
        )))::integer END;
      v_effective_remaining := pg_catalog.greatest(0, v_session.remaining_time - v_elapsed_seconds);
      IF v_effective_remaining <= 0 THEN
        IF NOT p_preview THEN
          UPDATE public.timer_sessions
          SET remaining_time = 0,
              is_active = false,
              completed_at = pg_catalog.coalesce(
                completed_at,
                pg_catalog.coalesce(
                  v_session.device_leader_last_seen, v_session.updated_at, v_session.start_time
                ) + pg_catalog.make_interval(secs => v_session.remaining_time)
              ),
              device_leader_id = 'flowstate-companion',
              device_leader_last_seen = v_now
          WHERE id = v_session.id AND user_id = v_actor AND is_active = true;
        END IF;
        v_session.id := NULL;
      END IF;
    END IF;
    IF v_session.id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'active_session_conflict',
          'message', 'Stop the active timer before starting another one',
          'activeSessionId', v_session.id,
          'currentRevision', v_session.canonical_revision
        )
      );
    END IF;
    v_proposed := pg_catalog.jsonb_build_object(
      'id', p_session_id,
      'taskId', v_task_id,
      'duration', v_duration,
      'remainingTime', v_duration,
      'isActive', true,
      'isPaused', false,
      'isBreak', v_is_break,
      'canonicalRevision', 1
    );
  ELSE
    IF p_preview THEN
      SELECT * INTO v_session
      FROM public.timer_sessions
      WHERE id = p_session_id AND user_id = v_actor AND is_active = true;
    ELSE
      SELECT * INTO v_session
      FROM public.timer_sessions
      WHERE id = p_session_id AND user_id = v_actor AND is_active = true
      FOR UPDATE;
    END IF;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'session_not_found', 'message', 'Active timer was not found')
      );
    END IF;
    IF v_session.canonical_revision IS DISTINCT FROM p_base_revision THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'stale_revision', 'message', 'Timer state changed after preview',
          'currentRevision', v_session.canonical_revision
        )
      );
    END IF;
    v_elapsed_seconds := CASE WHEN v_session.is_paused THEN 0 ELSE
      pg_catalog.greatest(0, pg_catalog.floor(pg_catalog.date_part(
        'epoch', (v_now - pg_catalog.coalesce(
          v_session.device_leader_last_seen, v_session.updated_at, v_session.start_time
        ))
      )))::integer END;
    v_effective_remaining := pg_catalog.greatest(0, v_session.remaining_time - v_elapsed_seconds);
    IF v_effective_remaining <= 0 THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_state', 'message', 'Timer has already expired')
      );
    END IF;
    IF (p_action = 'pause' AND v_session.is_paused)
       OR (p_action = 'resume' AND NOT v_session.is_paused) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_state', 'message', 'Timer is already in the requested state')
      );
    END IF;
    v_proposed := pg_catalog.jsonb_build_object(
      'id', v_session.id,
      'taskId', v_session.task_id,
      'duration', v_session.duration,
      'remainingTime', v_effective_remaining,
      'isActive', p_action <> 'stop',
      'isPaused', CASE
        WHEN p_action = 'pause' THEN true
        WHEN p_action = 'resume' THEN false
        ELSE v_session.is_paused
      END,
      'isBreak', v_session.is_break,
      'canonicalRevision', v_session.canonical_revision + 1
    );
  END IF;

  IF p_preview THEN
    v_expires_at := v_now + interval '15 minutes';
    v_expected_digest := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
            'operationId', p_operation_id,
            'requestHash', v_request_hash,
            'proposed', v_proposed,
            'expiresAt', v_expires_at
          )),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    INSERT INTO public.canonical_operation_previews (
      user_id, operation_id, preview_digest, request_hash, expires_at
    ) VALUES (
      v_actor, p_operation_id, v_expected_digest, v_request_hash, v_expires_at
    )
    ON CONFLICT (user_id, operation_id) DO UPDATE SET
      preview_digest = EXCLUDED.preview_digest,
      request_hash = EXCLUDED.request_hash,
      expires_at = EXCLUDED.expires_at,
      consumed_at = NULL,
      updated_at = pg_catalog.clock_timestamp();

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'result', 'preview',
      'contractVersion', p_contract_version,
      'operationId', p_operation_id,
      'action', p_action,
      'sessionId', p_session_id,
      'baseRevision', p_base_revision,
      'requestHash', v_request_hash,
      'previewDigest', v_expected_digest,
      'previewExpiresAt', v_expires_at,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'contractVersion', p_contract_version,
        'source', p_source,
        'action', p_action,
        'sessionId', p_session_id,
        'baseRevision', p_base_revision,
        'payload', p_payload
      ),
      'readBack', CASE WHEN p_action = 'start' THEN NULL ELSE v_proposed END,
      'proposed', v_proposed
    );
  END IF;

  IF nullif(p_preview_digest, '') IS NULL OR p_preview_expires_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request')
    );
  END IF;
  SELECT * INTO v_issued_preview
  FROM public.canonical_operation_previews AS issued
  WHERE issued.user_id = v_actor
    AND issued.operation_id = p_operation_id
    AND issued.preview_digest = p_preview_digest
  FOR UPDATE;
  IF NOT FOUND
     OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
     OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at
     OR v_issued_preview.consumed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request')
    );
  END IF;
  IF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'The approved preview has expired')
    );
  END IF;

  IF p_action = 'start' THEN
    INSERT INTO public.timer_sessions (
      id, user_id, task_id, start_time, duration, remaining_time,
      is_active, is_paused, is_break, completed_at,
      device_leader_id, device_leader_last_seen
    ) VALUES (
      p_session_id, v_actor, v_task_id, v_now, v_duration, v_duration,
      true, false, v_is_break, NULL,
      'flowstate-companion', v_now
    ) RETURNING * INTO v_updated;
  ELSE
    UPDATE public.timer_sessions
    SET remaining_time = v_effective_remaining,
        is_paused = CASE
          WHEN p_action = 'pause' THEN true
          WHEN p_action = 'resume' THEN false
          ELSE is_paused
        END,
        is_active = CASE WHEN p_action = 'stop' THEN false ELSE true END,
        completed_at = CASE WHEN p_action = 'stop' THEN v_now ELSE NULL END,
        device_leader_id = 'flowstate-companion',
        device_leader_last_seen = v_now
    WHERE id = p_session_id
      AND user_id = v_actor
      AND is_active = true
      AND canonical_revision = p_base_revision
    RETURNING * INTO v_updated;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'stale_revision', 'message', 'Timer state changed before apply')
      );
    END IF;
  END IF;

  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'taskId', v_updated.task_id,
    'startTime', v_updated.start_time,
    'duration', v_updated.duration,
    'remainingTime', v_updated.remaining_time,
    'isActive', v_updated.is_active,
    'isPaused', v_updated.is_paused,
    'isBreak', v_updated.is_break,
    'completedAt', v_updated.completed_at,
    'deviceLeaderId', v_updated.device_leader_id,
    'deviceLeaderLastSeen', v_updated.device_leader_last_seen,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at
  );
  v_read_back_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(v_read_back), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.canonical_change_log (
    user_id, actor_user_id, workspace_id, entity_type, entity_id,
    action, canonical_revision, operation_id, source, tombstone, projection
  ) VALUES (
    v_actor, v_actor, NULL, 'timer_session', v_updated.id::text,
    CASE WHEN p_action = 'start' THEN 'inserted' ELSE 'updated' END,
    v_updated.canonical_revision, p_operation_id, p_source,
    p_action = 'stop', v_read_back
  ) RETURNING change_sequence INTO v_change_sequence;

  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version,
    'operationId', p_operation_id,
    'source', p_source,
    'status', 'committed',
    'requestHash', v_request_hash,
    'entityType', 'timer_session',
    'action', p_action,
    'entityId', v_updated.id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at,
    'changeSequence', v_change_sequence,
    'replayed', false,
    'committedAt', pg_catalog.clock_timestamp(),
    'readBack', v_read_back,
    'readBackHash', v_read_back_hash
  );

  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source, scope_kind, scope_id,
    workspace_id, entity_type, action, entity_id, request_hash, state,
    canonical_revision, change_sequence, canonical_result, committed_at
  ) VALUES (
    v_actor, p_operation_id, p_contract_version, p_source, 'personal', v_actor::text,
    NULL, 'timer_session', p_action, v_updated.id::text, v_request_hash, 'committed',
    v_updated.canonical_revision, v_change_sequence, v_receipt, pg_catalog.clock_timestamp()
  );
  UPDATE public.canonical_operation_previews
  SET consumed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  WHERE user_id = v_actor AND operation_id = p_operation_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'result', 'committed', 'status', 'committed',
    'requestHash', v_request_hash, 'receipt', v_receipt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_timer_lifecycle_v1(
  text, text, text, text, uuid, bigint, jsonb, boolean, text, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_timer_lifecycle_v1(
  text, text, text, text, uuid, bigint, jsonb, boolean, text, timestamptz, text
) TO authenticated;
