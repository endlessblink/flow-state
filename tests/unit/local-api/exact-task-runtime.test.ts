import {
  execFileSync,
  fork,
  spawn,
  type ChildProcess,
} from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "runtime-regression-token";

type TaskRow = Record<string, unknown>;

function baseTask(overrides: TaskRow = {}): TaskRow {
  return {
    id: TASK_ID,
    user_id: USER_ID,
    workspace_id: null,
    title: "Detailed task fixture",
    description: "Safe planning context",
    status: "planned",
    priority: "high",
    progress: 35,
    due_date: "2026-07-15T00:00:00.000Z",
    due_time: "09:30",
    project_id: null,
    tags: ["fixture"],
    position: { x: 12, y: 34 },
    instances: [{ id: "instance-1", scheduledDate: "2026-07-15" }, null, "bad"],
    recurrence_rule: null,
    recurrence_parent_id: null,
    recurrence_count: 0,
    is_completion_record: false,
    is_in_inbox: true,
    canonical_revision: 7,
    created_at: "2026-07-14T08:00:00.000Z",
    updated_at: "2026-07-14T09:00:00.000Z",
    completed_at: null,
    is_deleted: false,
    accessToken: "must-not-leak",
    refreshToken: "must-not-leak",
    authorization: "must-not-leak",
    ...overrides,
  };
}

function queryValue(url: URL, name: string, operator: string): string | null {
  const value = url.searchParams.get(name);
  return value?.startsWith(`${operator}.`)
    ? value.slice(operator.length + 1)
    : null;
}

async function startFakePostgrest() {
  let row = baseTask();
  const requests: URL[] = [];
  const rpcRequests: TaskRow[] = [];
  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      requests.push(url);
      if (req.method === "GET" && url.pathname === "/auth/v1/user") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: USER_ID,
            aud: "authenticated",
            role: "authenticated",
            email: "runtime-user@test.flowstate",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-07-16T00:00:00.000Z",
          }),
        );
        return;
      }
      if (
        req.method === "POST" &&
        url.pathname === "/rest/v1/rpc/flowstate_subtask_batch_v1"
      ) {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const input = JSON.parse(raw) as TaskRow;
        rpcRequests.push(input);
        const operations = input.p_operations as TaskRow[];
        const operation = operations[0];
        const existing = Array.isArray(row.subtasks)
          ? (row.subtasks as TaskRow[])
          : [];
        let subtasks = existing;
        if (operation.kind === "create") {
          subtasks = [
            ...existing,
            {
              id: "generated-legacy-step",
              clientId: operation.clientId,
              parentTaskId: TASK_ID,
              title: operation.title,
              completedPomodoros: 0,
              isCompleted: false,
              order: existing.length,
            },
          ];
        }
        const response = {
          ok: true,
          result: "preview",
          preview: true,
          contractVersion: "task-v1",
          operationId: input.p_operation_id,
          action: "subtask_batch",
          taskId: TASK_ID,
          baseRevision: input.p_base_revision,
          requestHash: "c".repeat(64),
          previewDigest: "d".repeat(64),
          previewExpiresAt: "2099-01-01T00:00:00.000Z",
          normalizedPayload: { taskId: TASK_ID, operations },
          readBack: {
            id: TASK_ID,
            workspaceId: null,
            canonicalRevision: input.p_base_revision,
            subtasks,
          },
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
        return;
      }
      if (req.method !== "GET" || url.pathname !== "/rest/v1/tasks") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "not found" }));
        return;
      }

      let matches = true;
      const idFilter = queryValue(url, "id", "eq");
      const deletedFilter = queryValue(url, "is_deleted", "eq");
      const userFilter = queryValue(url, "user_id", "eq");
      const workspaceFilter = url.searchParams.get("workspace_id");
      if (idFilter !== null) matches = matches && idFilter === row.id;
      if (deletedFilter !== null)
        matches = matches && deletedFilter === String(row.is_deleted);
      if (userFilter !== null) matches = matches && userFilter === row.user_id;
      if (workspaceFilter !== null)
        matches = matches && workspaceFilter === "is.null";
      const body = matches ? [row] : [];
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Range": matches ? "0-0/1" : "*/0",
      });
      res.end(JSON.stringify(body));
    },
  );

  await new Promise<void>((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("fake PostgREST did not bind");

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    rpcRequests,
    setRow(next: TaskRow) {
      row = next;
    },
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolveClose) =>
        server.close(() => resolveClose()),
      );
    },
  };
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("port probe did not bind");
  const port = address.port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

/**
 * TASK-1977: unusedPort() probes a free port, releases it, and only then hands
 * it to a spawned sidecar — a time-of-check/time-of-use gap another parallel
 * worker can win. Under full-suite load the sidecar then died with
 * "sidecar exited with 1" (EADDRINUSE) and the file failed, while passing when
 * run alone. A lost race is environmental, not a product failure, so retry it
 * with a fresh port; a genuinely broken sidecar still fails on the last attempt.
 */
async function startWithPortRetry<T>(
  start: (port: number) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await start(await unusedPort());
    } catch (error) {
      lastError = error;
      if (!/sidecar exited with/.test(String(error))) throw error;
    }
  }
  throw lastError;
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`sidecar exited with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Host: `127.0.0.1:${port}` },
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // Startup is asynchronous; retry until the bounded deadline.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error("sidecar did not become healthy");
}

async function startSidecar(entry: string, supabaseUrl: string) {
  return startWithPortRetry((port) =>
    startSidecarOnPort(entry, supabaseUrl, port),
  );
}

async function startSidecarOnPort(
  entry: string,
  supabaseUrl: string,
  port: number,
) {
  const dataDir = mkdtempSync(join(tmpdir(), "flowstate-exact-task-runtime-"));
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: {
      HOME: dataDir,
      PATH: process.env.PATH || "/usr/bin:/bin",
      NODE_ENV: "test",
      FLOW_STATE_API_DATA_DIR: dataDir,
      FLOW_STATE_API_PORT: String(port),
      FLOW_STATE_API_TOKEN: TOKEN,
      FLOW_STATE_USER_ID: USER_ID,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = async () => {
    child.kill("SIGTERM");
    await new Promise<void>((resolveExit) => {
      if (child.exitCode !== null) return resolveExit();
      child.once("exit", () => resolveExit());
      setTimeout(() => {
        child.kill("SIGKILL");
        resolveExit();
      }, 2_000).unref();
    });
    rmSync(dataDir, { recursive: true, force: true });
  };
  try {
    await waitForHealth(port, child);
  } catch (error) {
    await stop();
    throw error;
  }
  return {
    port,
    stop,
  };
}

async function startSignedSidecar(entry: string, supabaseUrl: string) {
  return startWithPortRetry((port) =>
    startSignedSidecarOnPort(entry, supabaseUrl, port),
  );
}

async function startSignedSidecarOnPort(
  entry: string,
  supabaseUrl: string,
  port: number,
) {
  const dataDir = mkdtempSync(
    join(tmpdir(), "flowstate-exact-task-signed-runtime-"),
  );
  const jwtPart = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({
    sub: USER_ID,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`;
  const child = fork(entry, [], {
    cwd: dataDir,
    env: {
      HOME: dataDir,
      PATH: process.env.PATH || "/usr/bin:/bin",
      NODE_ENV: "test",
      FLOW_STATE_API_DATA_DIR: dataDir,
      FLOW_STATE_API_PORT: String(port),
      FLOW_STATE_API_TOKEN: TOKEN,
      FLOW_STATE_API_MODE: "token",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.send({
    type: "session",
    supabaseUrl,
    anonKey: "test-anon-key",
    accessToken,
    refreshToken: "test-refresh-token",
    userId: USER_ID,
  });
  const stop = async () => {
    child.kill("SIGTERM");
    await new Promise<void>((resolveExit) => {
      if (child.exitCode !== null) return resolveExit();
      child.once("exit", () => resolveExit());
      setTimeout(() => {
        child.kill("SIGKILL");
        resolveExit();
      }, 2_000).unref();
    });
    rmSync(dataDir, { recursive: true, force: true });
  };
  try {
    await waitForHealth(port, child);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if ((await getTask(port)).status !== 503) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    }
  } catch (error) {
    await stop();
    throw error;
  }
  return { port, stop };
}

async function getTask(port: number) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/tasks/${TASK_ID}`,
    {
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function getSubtasks(port: number, query = "") {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/tasks/${TASK_ID}/subtasks${query}`,
    {
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function createSubtask(port: number, body: TaskRow) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/tasks/${TASK_ID}/subtasks`,
    {
      method: "POST",
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function assertNoSecrets(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "authorization",
    "user_id",
    "is_deleted",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe("exact task runtime contract", () => {
  const bundleArtifact = process.env.FLOWSTATE_EXACT_TASK_BUNDLE
    ? resolve(process.env.FLOWSTATE_EXACT_TASK_BUNDLE)
    : resolve(ROOT, "dist-electron/local-api-server.cjs");
  const artifacts = [
    ["source", resolve(ROOT, "server/local-api/server.cjs")],
    ["Electron bundle", bundleArtifact],
  ] as const;

  beforeAll(() => {
    if (process.env.FLOWSTATE_EXACT_TASK_BUNDLE) {
      expect(bundleArtifact).not.toBe(
        resolve(ROOT, "server/local-api/server.cjs"),
      );
      return;
    }
    execFileSync(
      resolve(ROOT, "node_modules/.bin/esbuild"),
      [
        "server/local-api/server.cjs",
        "--bundle",
        "--platform=node",
        "--target=node22",
        "--outfile=dist-electron/local-api-server.cjs",
      ],
      { cwd: ROOT, stdio: "pipe" },
    );
  }, 120_000);

  for (const [label, artifact] of artifacts) {
    it(`${label} returns only fresh ordered canonical subtasks with parent revision authority`, async () => {
      const fake = await startFakePostgrest();
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null;
      try {
        fake.setRow(
          baseTask({
            canonical_revision: 11,
            updated_at: "2026-07-16T08:30:00.000Z",
            subtasks: [
              {
                id: "step-a",
                clientId: "draft-a",
                title: "First step",
                order: 0,
              },
              {
                id: "step-b",
                clientId: "draft-b",
                title: "Second step",
                order: 1,
              },
            ],
          }),
        );
        sidecar = await startSidecar(artifact, fake.url);

        const result = await getSubtasks(sidecar.port);
        expect(result).toEqual({
          status: 200,
          body: {
            ok: true,
            task: {
              id: TASK_ID,
              title: "Detailed task fixture",
              workspaceId: null,
              canonicalRevision: 11,
              canonicalUpdatedAt: "2026-07-16T08:30:00.000Z",
            },
            subtasks: [
              {
                id: "step-a",
                clientId: "draft-a",
                title: "First step",
                order: 0,
              },
              {
                id: "step-b",
                clientId: "draft-b",
                title: "Second step",
                order: 1,
              },
            ],
            page: { limit: 100, total: 2, hasMore: false, nextCursor: null },
          },
        });
        assertNoSecrets(result.body);

        const request = fake.requests.at(-1);
        expect(request?.searchParams.get("select")).toBe(
          "id,title,workspace_id,canonical_revision,updated_at,subtasks",
        );
        expect(request?.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
        expect(request?.searchParams.get("workspace_id")).toBe("is.null");

        fake.setRow(
          baseTask({
            canonical_revision: 12,
            updated_at: "2026-07-16T08:31:00.000Z",
            subtasks: [{ id: "step-c", title: "Fresh step", order: 0 }],
          }),
        );
        const refreshed = await getSubtasks(sidecar.port);
        expect((refreshed.body.task as TaskRow).canonicalRevision).toBe(12);
        expect(refreshed.body.subtasks).toEqual([
          { id: "step-c", title: "Fresh step", order: 0 },
        ]);
        expect(refreshed.body.page).toEqual({
          limit: 100,
          total: 1,
          hasMore: false,
          nextCursor: null,
        });

        fake.setRow(baseTask({ canonical_revision: null, subtasks: [] }));
        expect(await getSubtasks(sidecar.port)).toEqual({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "read_failed",
              message: "subtasks could not be read",
            },
          },
        });
      } finally {
        await sidecar?.stop();
        await fake.close();
      }
    }, 30_000);

    it(`${label} pages validated canonical subtasks and rejects a cursor after the parent revision changes`, async () => {
      const fake = await startFakePostgrest();
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null;
      try {
        const subtasks = Array.from({ length: 101 }, (_, order) => ({
          id: `step-${order}`,
          title: `Step ${order}`,
          order,
        }));
        fake.setRow(baseTask({ canonical_revision: 21, subtasks }));
        sidecar = await startSidecar(artifact, fake.url);

        for (const query of [
          "?limit=0",
          "?limit=101",
          "?cursor=not-a-cursor",
        ]) {
          expect(await getSubtasks(sidecar.port, query)).toEqual({
            status: 400,
            body: {
              ok: false,
              error: {
                code: "invalid_request",
                message: "invalid subtask page request",
              },
            },
          });
        }

        const first = await getSubtasks(sidecar.port, "?limit=100");
        expect(first.status).toBe(200);
        expect(first.body.subtasks as unknown[]).toHaveLength(100);
        expect(first.body.page).toMatchObject({
          limit: 100,
          total: 101,
          hasMore: true,
        });
        const nextCursor = (first.body.page as TaskRow).nextCursor;
        expect(typeof nextCursor).toBe("string");

        const second = await getSubtasks(
          sidecar.port,
          `?cursor=${encodeURIComponent(String(nextCursor))}`,
        );
        expect(second).toEqual({
          status: 200,
          body: {
            ok: true,
            task: {
              id: TASK_ID,
              title: "Detailed task fixture",
              workspaceId: null,
              canonicalRevision: 21,
              canonicalUpdatedAt: "2026-07-14T09:00:00.000Z",
            },
            subtasks: [{ id: "step-100", title: "Step 100", order: 100 }],
            page: { limit: 100, total: 101, hasMore: false, nextCursor: null },
          },
        });

        fake.setRow(baseTask({ canonical_revision: 22, subtasks }));
        const stale = await getSubtasks(
          sidecar.port,
          `?cursor=${encodeURIComponent(String(nextCursor))}`,
        );
        expect(stale).toEqual({
          status: 409,
          body: {
            ok: false,
            error: {
              code: "stale_revision",
              message: "task changed while reading subtasks",
              currentRevision: 22,
            },
          },
        });
      } finally {
        await sidecar?.stop();
        await fake.close();
      }
    }, 30_000);

    it(`${label} preserves legacy singular preview requests without allowing receipt-free apply`, async () => {
      const fake = await startFakePostgrest();
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null;
      try {
        fake.setRow(baseTask({ canonical_revision: 31, subtasks: [] }));
        sidecar = await startSignedSidecar(artifact, fake.url);

        const preview = await createSubtask(sidecar.port, {
          title: "Legacy preview step",
        });
        expect(preview.status).toBe(200);
        expect(preview.body).toMatchObject({
          ok: true,
          result: "preview",
          preview: true,
          baseRevision: 31,
          subtask: {
            id: "generated-legacy-step",
            title: "Legacy preview step",
          },
          receipt: {
            action: "create",
            taskId: TASK_ID,
            subtaskId: "generated-legacy-step",
            baseRevision: 31,
          },
        });
        const rpc = fake.rpcRequests.at(-1) as TaskRow;
        const operations = rpc.p_operations as TaskRow[];
        expect(operations).toHaveLength(1);
        expect(operations[0]).toEqual({
          kind: "create",
          clientId: rpc.p_operation_id,
          title: "Legacy preview step",
        });

        const apply = await createSubtask(sidecar.port, {
          title: "Unsafe legacy apply",
          preview: false,
          requestId: "legacy-apply-without-approval",
        });
        expect(apply).toEqual({
          status: 400,
          body: {
            ok: false,
            error: {
              code: "approval_receipt_required",
              message:
                "operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply",
            },
          },
        });
        expect(fake.rpcRequests).toHaveLength(1);
      } finally {
        await sidecar?.stop();
        await fake.close();
      }
    }, 30_000);

    it(`${label} fails closed when stored subtask identities or ordering are malformed`, async () => {
      const fake = await startFakePostgrest();
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null;
      try {
        sidecar = await startSidecar(artifact, fake.url);
        const invalidSubtasks = [
          null,
          [{ id: "step-a", title: "Missing order" }],
          [
            { id: "duplicate", title: "First", order: 0 },
            { id: "duplicate", title: "Second", order: 1 },
          ],
          [
            {
              id: "step-a",
              clientId: "duplicate-client",
              title: "First",
              order: 0,
            },
            {
              id: "step-b",
              clientId: "duplicate-client",
              title: "Second",
              order: 1,
            },
          ],
          [{ id: "step-a", title: "Wrong order", order: 2 }],
          [{ id: "step-a", title: "Unknown field", order: 0, raw: true }],
          Array.from({ length: 101 }, (_, order) =>
            order === 100
              ? { id: "hidden-invalid", title: "Invalid beyond first page" }
              : { id: `valid-${order}`, title: `Valid ${order}`, order },
          ),
        ];
        for (const subtasks of invalidSubtasks) {
          fake.setRow(baseTask({ subtasks }));
          expect(await getSubtasks(sidecar.port)).toEqual({
            status: 500,
            body: {
              ok: false,
              error: {
                code: "read_failed",
                message: "subtasks could not be read",
              },
            },
          });
        }
      } finally {
        await sidecar?.stop();
        await fake.close();
      }
    }, 30_000);

    it(`${label} executes detailed reads with safe subtask normalization and scope`, async () => {
      const fake = await startFakePostgrest();
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null;
      try {
        sidecar = await startSidecar(artifact, fake.url);
        for (const subtasks of [undefined, null, [], "bad", { bad: true }]) {
          const row = baseTask();
          if (subtasks !== undefined) row.subtasks = subtasks;
          fake.setRow(row);
          const result = await getTask(sidecar.port);
          expect(result.status).toBe(200);
          expect((result.body.task as TaskRow).subtasks).toEqual([]);
        }

        fake.setRow(
          baseTask({
            subtasks: [null, "bad", [], { id: "subtask-1", title: "Keep me" }],
          }),
        );
        const detailed = await getTask(sidecar.port);
        expect(detailed.status).toBe(200);
        expect((detailed.body.task as TaskRow).subtasks).toEqual([
          { id: "subtask-1", title: "Keep me" },
        ]);
        expect((detailed.body.task as TaskRow).instances).toEqual([
          { id: "instance-1", scheduledDate: "2026-07-15" },
        ]);
        expect(Object.keys(detailed.body.task as TaskRow).sort()).toEqual(
          [
            "canonicalRevision",
            "canvasPosition",
            "completedAt",
            "createdAt",
            "description",
            "dueDate",
            "dueTime",
            "id",
            "instances",
            "isCompletionRecord",
            "isInInbox",
            "priority",
            "progress",
            "projectId",
            "recurrenceCount",
            "recurrenceParentId",
            "recurrenceRule",
            "status",
            "subtasks",
            "tags",
            "title",
            "updatedAt",
            "workspaceId",
          ].sort(),
        );
        assertNoSecrets(detailed.body);

        const request = fake.requests.at(-1);
        expect(request?.searchParams.get("id")).toBe(`eq.${TASK_ID}`);
        expect(request?.searchParams.get("is_deleted")).toBe("eq.false");
        expect(request?.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
        expect(request?.searchParams.get("workspace_id")).toBe("is.null");
        expect(request?.searchParams.get("select")).toContain("description");
        expect(request?.searchParams.get("select")).toContain("subtasks");

        fake.setRow(baseTask({ user_id: OTHER_USER_ID }));
        expect((await getTask(sidecar.port)).status).toBe(404);

        fake.setRow(baseTask({ is_deleted: true }));
        expect((await getTask(sidecar.port)).status).toBe(404);
      } finally {
        await sidecar?.stop();
        await fake.close();
      }
    }, 30_000);
  }
});
