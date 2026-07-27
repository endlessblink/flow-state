import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SERVER_CJS = readFileSync(
  resolve(__dirname, "../../../server/local-api/server.cjs"),
  "utf-8",
);
const README = readFileSync(
  resolve(__dirname, "../../../server/local-api/README.md"),
  "utf-8",
);

function functionBody(name: string): string {
  const start = SERVER_CJS.indexOf(`function ${name}(`);
  const asyncStart = SERVER_CJS.indexOf(`async function ${name}(`);
  const fnStart = start === -1 ? asyncStart : start;
  expect(fnStart, `${name} not found`).toBeGreaterThan(-1);

  const nextSection = SERVER_CJS.indexOf("\n// ---", fnStart + name.length);
  return SERVER_CJS.slice(
    fnStart,
    nextSection === -1 ? undefined : nextSection,
  );
}

describe("Local API sidecar timer endpoint regression contract", () => {
  it("classifies missing auth context from the renderer heartbeat before protected routes", () => {
    const classifierImport = SERVER_CJS.indexOf(
      "require('./auth-availability.cjs')",
    );
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const ctxCheck = SERVER_CJS.indexOf(
      "classifyMissingAuthContext(rendererAuthState)",
    );
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'");

    expect(classifierImport).toBeGreaterThan(-1);
    expect(tokenCheck).toBeGreaterThan(-1);
    expect(ctxCheck).toBeGreaterThan(-1);
    expect(tokenCheck).toBeLessThan(ctxCheck);
    expect(ctxCheck).toBeLessThan(tasksRoute);
  });

  it("exposes GET /api/timer/current before Life OS bearer-token protected task routes", () => {
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'");
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'");

    expect(timerRoute, "timer route not found").toBeGreaterThan(-1);
    expect(tokenCheck, "token check not found").toBeGreaterThan(-1);
    expect(tasksRoute, "tasks route not found").toBeGreaterThan(-1);
    expect(timerRoute).toBeLessThan(tokenCheck);
    expect(tasksRoute).toBeGreaterThan(tokenCheck);
  });

  it("serves a renderer-owned KDE timer snapshot before requiring Supabase auth context", () => {
    const ctxCheck = SERVER_CJS.indexOf(
      "if (!ctx) return send(res, 503, { error: 'not signed in' })",
    );
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'");
    const localSnapshotCheck = SERVER_CJS.indexOf(
      "const localTimer = getLocalTimerResponse()",
    );

    expect(ctxCheck, "auth context check not found").toBeGreaterThan(-1);
    expect(timerRoute, "timer route not found").toBeGreaterThan(-1);
    expect(
      localSnapshotCheck,
      "local timer snapshot check not found",
    ).toBeGreaterThan(-1);
    expect(timerRoute).toBeLessThan(ctxCheck);
    expect(localSnapshotCheck).toBeGreaterThan(timerRoute);
    expect(localSnapshotCheck).toBeLessThan(ctxCheck);
  });

  it("exposes loopback-only timer diagnostics before bearer-token protected routes", () => {
    const diagnosticsRoute = SERVER_CJS.indexOf(
      "path === '/api/timer/diagnostics'",
    );
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'");

    expect(
      diagnosticsRoute,
      "timer diagnostics route not found",
    ).toBeGreaterThan(-1);
    expect(diagnosticsRoute).toBeLessThan(tokenCheck);
    expect(diagnosticsRoute).toBeLessThan(tasksRoute);
  });

  it("exposes dedicated redacted build provenance without reusing timer diagnostics", () => {
    const provenanceRoute = SERVER_CJS.indexOf("path === '/api/provenance'");
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const body = functionBody("handleGetBuildProvenance");

    expect(
      provenanceRoute,
      "sidecar provenance route not found",
    ).toBeGreaterThan(-1);
    expect(provenanceRoute).toBeLessThan(tokenCheck);
    expect(body).toContain("schemaVersion: 'flowstate-sidecar-provenance-v1'");
    expect(body).toContain("appVersion: APP_VERSION");
    expect(body).toContain("sourceCommit");
    expect(body).toContain("sourceDirty");
    expect(body).toContain("builtAt");
    expect(body).toContain("contractSet");
    expect(body).not.toContain("localTimerSnapshot");
    expect(body).not.toContain("rendererAuthState");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
  });

  it("publishes the complete Hermes route manifest before protected work begins", () => {
    const route = SERVER_CJS.indexOf("path === '/api/capabilities'");
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const body = functionBody("handleGetHermesCapabilities");

    expect(route, "Hermes capabilities route not found").toBeGreaterThan(-1);
    expect(route).toBeLessThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./hermes-route-capabilities.cjs')");
    expect(body).toContain("schemaVersion: HERMES_CAPABILITIES_SCHEMA_VERSION");
    expect(body).toContain("routes: HERMES_ROUTE_CAPABILITIES.map");
    expect(body).not.toContain("TOKEN");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
  });

  it("routes canonical task lifecycle creation and keeps legacy create blocked", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const legacyRoute = SERVER_CJS.indexOf(
      "req.method === 'POST' && path === '/api/tasks'",
    );
    const lifecycleRoute = SERVER_CJS.indexOf(
      "req.method === 'POST' && path === '/api/tasks/lifecycle'",
    );
    const legacyBody = functionBody("handleCreateTask");

    expect(
      lifecycleRoute,
      "canonical task lifecycle route not found",
    ).toBeGreaterThan(-1);
    expect(lifecycleRoute).toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./canonical-task-lifecycle.cjs')");
    expect(SERVER_CJS).toContain(
      "executeCanonicalTaskLifecycle(ctx, body, notifyTaskMutation)",
    );
    expect(legacyRoute).toBeGreaterThan(tokenCheck);
    expect(legacyBody).toContain("canonical_lifecycle_required");
    expect(legacyBody).not.toContain(".from('tasks').insert");
  });

  it("documents canonical lifecycle creation instead of the blocked legacy endpoint", () => {
    expect(README).toContain("### `POST /api/tasks/lifecycle`");
    expect(README).toContain("action: 'create'");
    expect(README).toMatch(
      /getTasks[\s\S]*canonicalRevision: number[\s\S]*deleteTask\(id: string, canonicalRevision: number\)/,
    );
    expect(README).not.toContain("### `POST /api/tasks`\n");
    expect(README).not.toContain("fetch(`${BASE}/api/tasks`, { method: 'POST'");
  });

  it("diagnoses timer boundary state without exposing secrets or full task rows", () => {
    const body = functionBody("handleGetTimerDiagnostics");

    expect(body).toContain("appVersion");
    expect(body).toContain("hasAuthContext");
    expect(body).toContain("hasLocalTimerSnapshot");
    expect(body).toContain("localSnapshotActive");
    expect(body).toContain("localSnapshotAgeMs");
    expect(body).toContain("currentTimerBranch");
    expect(body).toContain("supabaseActiveSessionFound");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
    expect(body).not.toContain("anonKey");
    expect(body).not.toContain("title");
  });

  it("keeps renderer-owned local snapshots fresh enough for the KDE widget clock", () => {
    const body = functionBody("getLocalTimerResponse");

    expect(body).toContain("source: 'local-snapshot'");
    expect(SERVER_CJS).toContain("LOCAL_TIMER_INACTIVE_GRACE_MS");
    expect(body).toContain("Date.now() - updatedAt");
    expect(body).toContain("Math.floor");
    expect(body).toContain("session.is_active && !session.is_paused");
    expect(body).toContain("Math.max(0");
    expect(body).toContain("remaining_time:");
    expect(body).toContain("session.remaining_time <= 0");
    expect(body).toContain(
      "active: false, session: null, source: 'local-snapshot'",
    );
  });

  it("does not let stale inactive local snapshots mask signed-in timer lookup", () => {
    const body = functionBody("getLocalTimerResponse");
    const staleCheck = body.indexOf(
      "snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS",
    );
    const inactiveResponse = body.indexOf(
      "active: false, session: null, source: 'local-snapshot'",
    );

    expect(
      staleCheck,
      "stale inactive snapshot guard not found",
    ).toBeGreaterThan(-1);
    expect(
      inactiveResponse,
      "fresh inactive tombstone response not found",
    ).toBeGreaterThan(-1);
    expect(staleCheck).toBeLessThan(inactiveResponse);
    expect(body.slice(staleCheck, inactiveResponse)).toContain("return null");
  });

  it("does not let stale active local snapshots stuck at zero mask signed-in completion lookup", () => {
    const body = functionBody("getLocalTimerResponse");
    const zeroCheck = body.indexOf("session.remaining_time <= 0");
    const staleCheckAfterZero = body.indexOf(
      "snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS",
      zeroCheck,
    );
    const inactiveResponse = body.indexOf(
      "active: false, session: null, source: 'local-snapshot'",
      zeroCheck,
    );

    expect(zeroCheck, "zero remaining-time branch not found").toBeGreaterThan(
      -1,
    );
    expect(
      staleCheckAfterZero,
      "stale active-zero snapshot guard not found",
    ).toBeGreaterThan(zeroCheck);
    expect(
      inactiveResponse,
      "active-zero inactive response not found",
    ).toBeGreaterThan(zeroCheck);
    expect(staleCheckAfterZero).toBeLessThan(inactiveResponse);
    expect(body.slice(staleCheckAfterZero, inactiveResponse)).toContain(
      "return null",
    );
  });

  it("accepts parent-process timerSnapshot messages independently of auth session messages", () => {
    const messageHandlerStart = SERVER_CJS.indexOf("PARENT_PORT.on('message'");
    expect(
      messageHandlerStart,
      "process message handler not found",
    ).toBeGreaterThan(-1);
    const body = SERVER_CJS.slice(
      messageHandlerStart,
      messageHandlerStart + 1600,
    );

    expect(body).toContain("msg.type === 'timerSnapshot'");
    expect(body).toContain("localTimerSnapshot = msg.snapshot || null");
    expect(body).toContain("msg.type === 'session'");
    expect(body).toContain("msg.type === 'clear'");
  });

  it("queries only the current user active timer session and returns an inactive payload when absent", () => {
    const body = functionBody("handleGetCurrentTimer");

    expect(body).toContain(".from('timer_sessions')");
    expect(body).toContain(".eq('user_id', userId)");
    expect(body).toContain(".eq('is_active', true)");
    expect(body).toContain(".order('updated_at', { ascending: false })");
    expect(body).toContain(".limit(1)");
    expect(body).toContain(".maybeSingle()");
    expect(body).toContain(
      "return send(res, 200, { active: false, session: null })",
    );
    expect(body).toContain("send(res, 200, { active: true, session: data })");
  });

  it("exposes signed-in local timer controls before the external-app bearer token boundary", () => {
    const controlRoute = SERVER_CJS.indexOf("path === '/api/timer/control'");
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");

    expect(controlRoute, "timer control route not found").toBeGreaterThan(-1);
    expect(controlRoute).toBeLessThan(tokenCheck);

    const body = functionBody("handlePostTimerControl");
    expect(body).toContain("action === 'toggle'");
    expect(body).toContain("action === 'start'");
    expect(body).toContain(".from('timer_sessions')");
    expect(body).toContain(".eq('user_id', userId)");
    expect(body).toContain("device_leader_id: 'kde-widget'");
    expect(body).toContain(
      "send(res, 400, { error: 'action must be toggle|start' })",
    );
  });

  it("routes Hermes timer lifecycle commands behind bearer auth without requiring a renderer", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const route = SERVER_CJS.indexOf("path === '/api/timer/lifecycle'");

    expect(route, "Hermes timer lifecycle route not found").toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./canonical-timer-lifecycle.cjs')");
    expect(SERVER_CJS).toContain(
      "executeCanonicalTimerLifecycle(ctx, body, notifyTimerMutation)",
    );
    expect(SERVER_CJS).not.toContain(
      "executeCanonicalTimerLifecycle(ctx, body, BrowserWindow",
    );
  });

  it("keeps task endpoints behind the bearer token used by external local apps", () => {
    const tokenBlockStart = SERVER_CJS.indexOf("if (TOKEN)");
    const tokenBlock = SERVER_CJS.slice(tokenBlockStart, tokenBlockStart + 220);

    expect(tokenBlock).toContain("req.headers.authorization");
    expect(tokenBlock).toContain("Bearer ${TOKEN}");
    expect(tokenBlock).toContain("return send(res, 401");
  });

  it("keeps AI clarification runtime endpoints behind the same signed-in and bearer-token boundary", () => {
    const ctxCheck = SERVER_CJS.indexOf(
      "if (!ctx) return send(res, 503, { error: 'not signed in' })",
    );
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const startRoute = SERVER_CJS.indexOf(
      "path === '/api/ai/clarifications/start'",
    );
    const resumeRoute = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/ai\\/clarifications\\/([^/]+)\\/resume$/)",
    );

    expect(
      startRoute,
      "AI clarification start route not found",
    ).toBeGreaterThan(-1);
    expect(
      resumeRoute,
      "AI clarification resume route not found",
    ).toBeGreaterThan(-1);
    expect(ctxCheck).toBeLessThan(startRoute);
    expect(tokenCheck).toBeLessThan(startRoute);
    expect(tokenCheck).toBeLessThan(resumeRoute);
  });

  it("creates the Mastra AI runtime from the configured local API data directory", () => {
    expect(SERVER_CJS).toContain(
      "const DATA_DIR = process.env.FLOW_STATE_API_DATA_DIR || join(process.cwd(), '.flowstate-local-api')",
    );
    expect(SERVER_CJS).toContain(
      "createAIMastraRuntime({ dataDir: DATA_DIR })",
    );
  });

  it("exposes a bearer-protected read-only assistant context endpoint after the token boundary", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const assistantRoute = SERVER_CJS.indexOf(
      "path === '/api/assistant/context'",
    );
    const patchTaskRoute = SERVER_CJS.indexOf(
      "req.method === 'PATCH' && taskMatch",
    );

    expect(assistantRoute, "assistant context route not found").toBeGreaterThan(
      -1,
    );
    expect(assistantRoute).toBeGreaterThan(tokenCheck);
    expect(assistantRoute).toBeLessThan(patchTaskRoute);
    expect(SERVER_CJS).toContain("return await handleGetAssistantContext(res)");
  });

  it("summarizes assistant context from user-scoped tables without exposing secrets or full conversations", () => {
    const body = functionBody("handleGetAssistantContext");

    expect(body).toContain(".from('tasks')");
    expect(body).toContain(".from('projects')");
    expect(body).toContain(".from('timer_sessions')");
    expect(body).toContain(".from('pomodoro_history')");
    expect(body).toContain(".from('quick_sort_sessions')");
    expect(body).toContain(".from('user_gamification')");
    expect(body).toContain(".from('ai_conversations')");
    expect(body).toContain(".from('ai_usage_log')");
    expect(body).toContain(".from('project_contexts')");
    expect(body).toContain(".from('task_contexts')");
    expect(body).toContain(".from('memory_events')");
    expect(body).toContain(".from('ai_clarification_events')");
    expect(body).toContain(".from('ai_parameter_beliefs')");
    expect(body).toContain(".from('ai_recommendation_feedback')");
    expect(body).toContain(".eq('user_id', userId)");
    expect(body).toContain("taskPressure");
    expect(body).toContain("focusPatterns");
    expect(body).toContain("projectSignals");
    expect(body).toContain("assistantMemory");
    expect(body).toContain("safeCount");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
    expect(body).not.toContain("anonKey");
    expect(body).not.toContain("messages");
  });

  it("exposes task-instance scheduling routes behind the external-app bearer token boundary", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const instancesRoute = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/instances$/)",
    );
    const patchTaskRoute = SERVER_CJS.indexOf(
      "req.method === 'PATCH' && taskMatch",
    );

    expect(instancesRoute, "task instance route not found").toBeGreaterThan(-1);
    expect(instancesRoute).toBeGreaterThan(tokenCheck);
    expect(instancesRoute).toBeLessThan(patchTaskRoute);
    expect(SERVER_CJS).toContain(
      "return await handleGetTaskInstances(decodeURIComponent(taskInstancesMatch[1]), res)",
    );
    expect(SERVER_CJS).toContain(
      "return await handlePostTaskInstance(decodeURIComponent(taskInstancesMatch[1]), req, res)",
    );
  });

  it("reads task instances from the active signed-user scope with revision authority", () => {
    const body = functionBody("handleGetTaskInstances");

    expect(body).toContain(".from('tasks')");
    expect(body).toContain(
      ".select('id,title,instances,workspace_id,canonical_revision,updated_at')",
    );
    expect(body).toContain(".eq('id', id)");
    expect(body).toContain("scopeTaskQuery(ctx, query)");
    expect(body).toContain(".eq('is_deleted', false)");
    expect(body).toContain(".maybeSingle()");
    expect(body).toContain("return send(res, 404, { error: 'not found' })");
    expect(body).toContain(
      "instances: normalizeTaskInstances(existing.instances)",
    );
    expect(body).toContain("canonicalRevision: existing.canonical_revision");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
    expect(body).not.toContain("anonKey");
    expect(body).not.toContain("description");
    expect(body).not.toContain("subtasks");
  });

  it("previews a task instance without mutating and applies by updating only instances", () => {
    const body = functionBody("handlePostTaskInstance");
    const previewBranch = body.slice(
      body.indexOf("if (preview)"),
      body.indexOf("const updatedInstances"),
    );

    expect(body).toContain(".from('tasks')");
    expect(body).toContain(
      ".select('id,title,status,priority,due_date,instances')",
    );
    expect(body).toContain(".eq('id', id)");
    expect(body).toContain(".eq('user_id', userId)");
    expect(body).toContain(".eq('is_deleted', false)");
    expect(body).toContain("validateTaskInstanceInput(body)");
    expect(body).toContain("const proposedInstance = buildTaskInstance(body)");
    expect(previewBranch).toContain(
      "buildTaskInstanceResponse(existing, proposedInstance, true)",
    );
    expect(previewBranch).not.toContain(".update(");
    expect(body).toContain(
      "const updatedInstances = [...normalizeTaskInstances(existing.instances), proposedInstance]",
    );
    expect(body).toContain(
      ".update({ instances: updatedInstances, updated_at: now })",
    );
    expect(body).toContain(".eq('id', id)");
    expect(body).toContain(".eq('user_id', userId)");
    expect(body).not.toContain("status:");
    expect(body).not.toContain("title:");
    expect(body).not.toContain("priority:");
    expect(body).not.toContain("due_date:");
  });

  it("validates task instance date, time, duration, and preview shape before scheduling", () => {
    const body = functionBody("validateTaskInstanceInput");

    expect(body).toContain("isValidDateOnly");
    expect(body).toContain("isValidTimeOnly");
    expect(body).toContain("duration");
    expect(body).toContain("preview");
    expect(body).toContain(
      "return { ok: false, error: 'scheduledDate must be YYYY-MM-DD' }",
    );
    expect(body).toContain(
      "return { ok: false, error: 'scheduledTime must be HH:mm' }",
    );
    expect(body).toContain(
      "return { ok: false, error: 'duration must be an integer from 1 to 1440 minutes' }",
    );
    expect(body).toContain(
      "return { ok: false, error: 'preview must be a boolean when provided' }",
    );
  });

  it("returns safe task-instance scheduling responses without secrets or full task dumps", () => {
    const body = functionBody("buildTaskInstanceResponse");

    expect(body).toContain("ok: true");
    expect(body).toContain("preview");
    expect(body).toContain("task: { id: task.id, title: task.title }");
    expect(body).toContain("instance");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
    expect(body).not.toContain("anonKey");
    expect(body).not.toContain("authorization");
    expect(body).not.toContain("messages");
    expect(body).not.toContain("description");
    expect(body).not.toContain("subtasks");
  });

  it("exposes recurring Done for now preview/apply behind the signed-in bearer boundary", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const route = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/done-for-now$/)",
    );

    expect(route, "Done for now route not found").toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./done-for-now.cjs')");
    expect(SERVER_CJS).toContain(
      "return await handleDoneForNow(decodeURIComponent(doneForNowMatch[1]), req, res)",
    );
  });

  it("stores renderer workspace context on the signed-in sidecar context", () => {
    const messageHandlerStart = SERVER_CJS.indexOf("PARENT_PORT.on('message'");
    const body = SERVER_CJS.slice(
      messageHandlerStart,
      messageHandlerStart + 2200,
    );

    expect(body).toContain("msg.type === 'workspaceContext'");
    expect(body).toContain(
      "activeWorkspaceId = sanitizeActiveWorkspaceId(msg.activeWorkspaceId)",
    );
    expect(body).toContain("ctx = { ...ctx, activeWorkspaceId }");
  });

  it("passes the exact active workspace context into Done for now", () => {
    const body = functionBody("handleDoneForNow");

    expect(body).toContain("activeWorkspaceId: ctx.activeWorkspaceId");
    expect(body).toContain(
      "executeDoneForNow(doneForNowContext, id, body, notifyTaskMutation)",
    );
  });

  it("routes generic task patches through the canonical preview/apply adapter", () => {
    const body = functionBody("handlePatchTask");

    expect(SERVER_CJS).toContain("require('./canonical-task-patch.cjs')");
    expect(body).toContain(
      "executeCanonicalTaskPatch(ctx, id, body, notifyTaskMutation)",
    );
    expect(body).not.toContain(".from('tasks').update");
  });

  it("uses the same active workspace scope for list, exact read, and canonical patch", () => {
    const listBody = functionBody("handleGetTasks");
    const detailBody = functionBody("handleGetTask");

    expect(listBody).toContain("scopeTaskQuery(ctx, query)");
    expect(detailBody).toContain("scopeTaskQuery(ctx, query)");
    expect(SERVER_CJS).toContain("require('./task-scope.cjs')");
  });

  it("exposes an exact task read with recurrence and occurrence state for verification", () => {
    const route = SERVER_CJS.indexOf("req.method === 'GET' && taskMatch");
    const body = functionBody("handleGetTask");

    expect(route, "exact task route not found").toBeGreaterThan(-1);
    expect(body).toContain("description,status,priority,progress");
    expect(body).toContain("subtasks,tags,position,instances");
    expect(body).toContain(
      "workspace_id,canonical_revision,created_at,updated_at,completed_at",
    );
    expect(body).toContain(".eq('id', id)");
    expect(body).toContain(".eq('is_deleted', false)");
    expect(body).toContain("scopeTaskQuery(ctx, query)");
    expect(body).toContain("recurrenceRule: task.recurrence_rule");
    expect(body).toContain("subtasks: normalizeSubtasks(task.subtasks)");
    expect(body).toContain("canvasPosition: task.position");
    expect(body).toContain("instances: normalizeTaskInstances(task.instances)");
    expect(body).toContain("canonicalRevision: task.canonical_revision");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
  });

  it("exposes workspace-scoped task search behind the bearer boundary", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const route = SERVER_CJS.indexOf("path === '/api/tasks/search'");
    const body = functionBody("handleSearchTasks");

    expect(route, "task search route not found").toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./task-search.cjs')");
    expect(body).toContain("parseTaskSearchParams(url.searchParams)");
    expect(body).toContain("buildTaskSearchQuery(ctx, input)");
    expect(body).toContain("isCompletionRecord: row.is_completion_record");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
  });

  it("exposes a bearer-protected complete inventory receipt instead of a capped task sample", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const route = SERVER_CJS.indexOf("path === '/api/tasks/inventory'");
    const body = functionBody("handleGetTaskInventory");

    expect(route, "task inventory route not found").toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("require('./task-inventory.cjs')");
    expect(body).toContain("parseTaskInventoryParams(url.searchParams)");
    expect(body).toContain("readCompleteTaskInventory");
    expect(body).toContain("readTaskInventoryPage");
    expect(body).toContain("APP_VERSION");
    expect(body).not.toContain("accessToken");
    expect(body).not.toContain("refreshToken");
  });

  it("exposes bearer-protected preview-first subtask routes", () => {
    const tokenCheck = SERVER_CJS.indexOf("if (TOKEN)");
    const route = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks$/)",
    );
    const itemRoute = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/([^/]+)$/)",
    );
    const deleteRoute = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/([^/]+)\\/delete$/)",
    );

    expect(route).toBeGreaterThan(tokenCheck);
    expect(itemRoute).toBeGreaterThan(tokenCheck);
    expect(deleteRoute).toBeGreaterThan(tokenCheck);
    expect(SERVER_CJS).toContain("handleGetSubtasks");
    expect(SERVER_CJS).toContain("handleCreateSubtask");
    expect(SERVER_CJS).toContain("handlePatchSubtask");
    expect(SERVER_CJS).toContain("handleDeleteSubtask");
  });

  it("reads only the user-owned task subtask payload", () => {
    const body = functionBody("handleGetSubtasks");
    const getBody = body.slice(
      0,
      body.indexOf("async function handleCreateSubtask"),
    );
    const finder = functionBody("findTaskForSubtasks");
    const pageParser = functionBody("parseCanonicalSubtaskPage");

    expect(getBody).toContain(
      "const fields = 'id,title,workspace_id,canonical_revision,updated_at,subtasks'",
    );
    expect(getBody).toContain("findTaskForSubtasks(id, fields)");
    expect(finder).toContain(".select(fields)");
    expect(finder).toContain(".eq('is_deleted', false)");
    expect(finder).toContain("scopeTaskQuery(ctx, query)");
    expect(getBody).toContain("workspaceId: existing.workspace_id");
    expect(getBody).toContain("canonicalRevision: existing.canonical_revision");
    expect(getBody).toContain("canonicalUpdatedAt: existing.updated_at");
    expect(getBody).toContain(
      "validCanonicalSubtasks(existing.subtasks, existing.id)",
    );
    expect(getBody).toContain(
      "parseCanonicalSubtaskPage(url, existing.id, existing.canonical_revision)",
    );
    expect(getBody).toContain(
      "subtasks.slice(page.offset, page.offset + page.limit)",
    );
    expect(getBody).toContain("limit: page.limit");
    expect(getBody).toContain("total: subtasks.length");
    expect(getBody).toContain("hasMore");
    expect(getBody).toContain("nextCursor");
    expect(pageParser).toContain("code: 'stale_revision'");
    expect(pageParser).toContain("currentRevision: canonicalRevision");
    expect(getBody).toContain("code: 'read_failed'");
    expect(getBody).toContain("code: 'not_found'");
    expect(getBody).not.toContain("error.message");
  });

  it("routes singular subtask mutations through the canonical preview/apply batch", () => {
    const create = functionBody("handleCreateSubtask");
    const patch = functionBody("handlePatchSubtask");
    const deletion = functionBody("handleDeleteSubtask");
    const canonical = functionBody("handleCanonicalSubtaskBatch");
    const wrappers = [
      create.slice(0, create.indexOf("async function handlePatchSubtask")),
      patch.slice(0, patch.indexOf("async function handleDeleteSubtask")),
      deletion.slice(
        0,
        deletion.indexOf("async function handleCanonicalSubtaskBatch"),
      ),
    ];

    expect(create).toContain("kind: 'create'");
    expect(create).toContain(
      "const operationId = body.operationId || body.requestId",
    );
    expect(create).toContain("clientId: body.clientId || operationId");
    expect(create).toContain("prepareSingularSubtaskPreview");
    expect(canonical).toContain("legacySingularPreviewResponse");
    expect(patch).toContain("kind: 'update', subtaskId");
    expect(deletion).toContain("kind: 'delete', subtaskId");
    for (const body of [create, patch]) {
      expect(body).toContain("completedPomodoros: body.completedPomodoros");
      expect(body).toContain("canvasPosition: body.canvasPosition");
      expect(body).toContain("isCompleted: body.isCompleted ?? body.completed");
    }
    for (const body of wrappers) {
      expect(body).toContain(
        "body.operationId = body.operationId || body.requestId",
      );
      expect(body).toContain("handleCanonicalSubtaskBatch");
      expect(body).not.toContain(".from('tasks')");
    }
  });

  it("uses the signed-user canonical adapter instead of direct task writes", () => {
    const body = functionBody("handleCanonicalSubtaskBatch");
    const canonicalBody = body.slice(
      0,
      body.indexOf("async function handleSubtaskBatch"),
    );

    expect(SERVER_CJS).toContain("require('./subtask-batch.cjs')");
    expect(canonicalBody).toContain("executeSubtaskBatch");
    expect(canonicalBody).toContain("signedUser: ctx.signedUser");
    expect(canonicalBody).not.toContain("ctx.mode");
    expect(canonicalBody).toContain("activeWorkspaceId: ctx.activeWorkspaceId");
    expect(canonicalBody).toContain("notifyTaskMutation");
    expect(canonicalBody).not.toContain(".from('tasks')");
  });

  it("supports one preview-first atomic subtask batch receipt", () => {
    const route = SERVER_CJS.indexOf(
      "path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/batch$/)",
    );
    const body = functionBody("handleSubtaskBatch");

    expect(route).toBeGreaterThan(-1);
    expect(body).toContain("handleCanonicalSubtaskBatch");
    expect(SERVER_CJS).not.toContain("applySubtaskOperations");
    expect(SERVER_CJS).not.toContain("subtaskMutationReceipts");
  });

  it("keeps replay identity durable outside the sidecar process", () => {
    expect(SERVER_CJS).not.toContain("subtaskMutationReceipts");
    expect(SERVER_CJS).not.toContain("deterministicSubtaskId");
    expect(SERVER_CJS).not.toContain("replaySubtaskResponse");
    expect(SERVER_CJS).toContain("require('./subtask-batch.cjs')");
  });
});
