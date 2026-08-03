import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempRoots: string[] = [];

function write(root: string, relativePath: string, value: string | Buffer) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function sha512(value: Buffer) {
  return createHash("sha512").update(value).digest("base64");
}

function makeReleaseFixture(version = "1.4.262") {
  const root = mkdtempSync(join(tmpdir(), "flowstate-truth-ledger-"));
  tempRoots.push(root);
  const app = Buffer.from("app-image-fixture");
  const deb = Buffer.from("deb-fixture");
  write(root, "package.json", JSON.stringify({ name: "flow-state", version }));
  write(root, "dist-electron/local-api-server.cjs", "sidecar fixture");
  write(root, `release/FlowState-${version}-x86_64.AppImage`, app);
  write(root, `release/FlowState_${version}_amd64.deb`, deb);
  write(
    root,
    "release/latest-linux.yml",
    [
      `version: ${version}`,
      "files:",
      `  - url: FlowState-${version}-x86_64.AppImage`,
      `    sha512: ${sha512(app)}`,
      `    size: ${app.length}`,
      `  - url: FlowState_${version}_amd64.deb`,
      `    sha512: ${sha512(deb)}`,
      `    size: ${deb.length}`,
      `path: FlowState-${version}-x86_64.AppImage`,
      `sha512: ${sha512(app)}`,
      "",
    ].join("\n"),
  );
  return root;
}

async function loadLedger() {
  return import("../../../scripts/flowstate-truth-ledger.cjs") as Promise<{
    buildTruthLedger: (
      options: Record<string, unknown>,
    ) => Promise<Record<string, any>>;
    readSource: (root: string) => { commit: string; dirty: boolean };
  }>;
}

describe("FlowState source-to-runtime truth ledger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of tempRoots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  it("does not mark a clean release dirty only because the build refreshed tracked outputs", async () => {
    const root = makeReleaseFixture();
    write(root, "source.txt", "source\n");
    write(root, "stats.html", "old stats\n");
    write(root, "dist-electron/package.json", '{"old":true}\n');
    execFileSync("git", ["init"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "flowstate-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "FlowState Test"], {
      cwd: root,
    });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
    const { readSource } = await loadLedger();

    write(root, "stats.html", "new stats\n");
    write(root, "dist-electron/package.json", '{"new":true}\n');
    expect(readSource(root).dirty).toBe(false);

    write(root, "source.txt", "changed source\n");
    expect(readSource(root).dirty).toBe(true);
  });

  it("builds a redacted non-live ledger without probing public, installed, or sidecar surfaces", async () => {
    const root = makeReleaseFixture();
    const probePublic = vi.fn(() => {
      throw new Error("must not run");
    });
    const probeInstalled = vi.fn(() => {
      throw new Error("must not run");
    });
    const probeSidecar = vi.fn(() => {
      throw new Error("must not run");
    });
    const { buildTruthLedger } = await loadLedger();

    const ledger = await buildTruthLedger({
      root,
      mode: "non-live",
      now: "2026-07-15T12:00:00.000Z",
      readSource: () => ({ commit: "a".repeat(40), dirty: false }),
      probePublic,
      probeInstalled,
      probeSidecar,
    });

    expect(probePublic).not.toHaveBeenCalled();
    expect(probeInstalled).not.toHaveBeenCalled();
    expect(probeSidecar).not.toHaveBeenCalled();
    expect(ledger).toMatchObject({
      schemaVersion: "flowstate-truth-ledger-v1",
      generatedAt: "2026-07-15T12:00:00.000Z",
      mode: "non-live",
      source: { commit: "a".repeat(40), dirty: false },
      build: {
        packageVersion: "1.4.262",
        builtAt: "2026-07-15T12:00:00.000Z",
        contractSet: [
          "canonical-task/task-v1",
          "electron-updater/latest-linux-v1",
          "local-task-api/v1",
          "local-task-api/flowstate-hermes-capabilities-v1",
          "notion-activation/notion-activation-v1",
          "truth-ledger/flowstate-truth-ledger-v1",
        ],
        manifest: { status: "available", version: "1.4.262" },
        sidecar: { status: "available" },
      },
      public: { status: "not_checked", reason: "non_live_mode" },
      installed: { status: "not_checked", reason: "non_live_mode" },
      sidecar: { status: "not_checked", reason: "non_live_mode" },
      verdict: { consistent: true, mismatches: [] },
    });
    expect(ledger.build.manifest.artifacts).toHaveLength(2);
    expect(ledger.build.manifest.artifacts[0]).toEqual(
      expect.objectContaining({
        name: "FlowState-1.4.262-x86_64.AppImage",
        localStatus: "available",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );

    const serialized = JSON.stringify(ledger);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("/home/");
    expect(serialized).not.toMatch(/token|authorization|cookie|email/i);
  });

  it("reports version and sidecar digest mismatches independently in full mode", async () => {
    const root = makeReleaseFixture("1.4.262");
    const { buildTruthLedger } = await loadLedger();

    const ledger = await buildTruthLedger({
      root,
      mode: "full",
      now: "2026-07-15T12:00:00.000Z",
      readSource: () => ({ commit: "b".repeat(40), dirty: true }),
      probePublic: async () => ({
        status: "available",
        version: "1.4.261",
        artifactsReachable: true,
      }),
      probeInstalled: async () => ({
        status: "available",
        version: "1.4.260",
        sha256: "c".repeat(64),
      }),
      probeSidecar: async () => ({
        status: "available",
        health: true,
        appVersion: "1.4.259",
        bundleSha256: "d".repeat(64),
      }),
    });

    expect(ledger.verdict.consistent).toBe(false);
    expect(ledger.verdict.mismatches).toEqual([
      { surface: "source", field: "dirty", expected: false, actual: true },
      {
        surface: "public",
        field: "version",
        expected: "1.4.262",
        actual: "1.4.261",
      },
      {
        surface: "installed",
        field: "version",
        expected: "1.4.262",
        actual: "1.4.260",
      },
      {
        surface: "sidecar",
        field: "appVersion",
        expected: "1.4.262",
        actual: "1.4.259",
      },
      {
        surface: "sidecar",
        field: "bundleSha256",
        expected: ledger.build.sidecar.sha256,
        actual: "d".repeat(64),
      },
    ]);
  });

  it("keeps live probe failures typed instead of treating them as mismatches", async () => {
    const root = makeReleaseFixture();
    const { buildTruthLedger } = await loadLedger();

    const ledger = await buildTruthLedger({
      root,
      mode: "full",
      readSource: () => ({ commit: "e".repeat(40), dirty: false }),
      probePublic: async () => ({
        status: "unavailable",
        error: "request_failed",
      }),
      probeInstalled: async () => ({
        status: "unavailable",
        error: "not_found",
      }),
      probeSidecar: async () => ({
        status: "unavailable",
        error: "connection_refused",
      }),
    });

    expect(ledger.verdict).toEqual({ consistent: null, mismatches: [] });
    expect(ledger.public).toEqual({
      status: "unavailable",
      error: "request_failed",
    });
  });

  it("uses the dedicated redacted sidecar provenance contract instead of timer diagnostics", () => {
    const root = resolve(__dirname, "../../..");
    const source = readFileSync(
      join(root, "scripts/flowstate-truth-ledger.cjs"),
      "utf8",
    );

    expect(source).toContain("/api/provenance");
    expect(source).not.toContain("/api/timer/diagnostics");
  });

  it("is generated as a non-live release output by the canonical Electron builder", () => {
    const root = resolve(__dirname, "../../..");
    const buildScript = readFileSync(
      join(root, "scripts/run-electron-builder-with-npm-tree.sh"),
      "utf8",
    );

    expect(buildScript).toContain("scripts/flowstate-truth-ledger.cjs");
    expect(buildScript).toContain("--mode non-live");
    expect(buildScript).toContain("dist-electron/flowstate-truth-ledger.json");
    expect(buildScript).toContain("release/flowstate-truth-ledger.json");
    expect(
      buildScript.indexOf("dist-electron/flowstate-truth-ledger.json"),
    ).toBeLessThan(
      buildScript.indexOf("electron-builder --config electron-builder.yml"),
    );
  });

  it("keeps mandatory browser-test reports out of tracked release provenance", () => {
    const root = resolve(__dirname, "../../..");
    const config = readFileSync(join(root, "playwright.config.ts"), "utf8");

    // Quote style is owned by the formatter, so match on the value rather than
    // the exact literal. What matters is that the report folder is one
    // .gitignore already covers — a report written into a tracked path leaves
    // the worktree dirty and forces release provenance to report dirty.
    expect(config).toMatch(
      /outputFolder:\s*['"]playwright-report\/regression['"]/,
    );
  });
});
