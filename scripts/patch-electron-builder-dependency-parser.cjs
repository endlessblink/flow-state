#!/usr/bin/env node

/**
 * electron-builder 26.8.1 can fail while parsing `npm list --json` when npm
 * prints a warning before the JSON payload. Its fallback parser accidentally
 * starts scanning at index 0 whenever either "{" or "[" is absent. An earlier
 * local patch can also leave the package-object regex over-escaped in the
 * generated JS. The streamed collector path can also resolve after writing an
 * empty output file even though the same npm command returns valid JSON when
 * run directly. Either case can throw "No JSON content found in output" during
 * release packaging.
 *
 * Remove this patch once app-builder-lib ships the same start-index and
 * direct-process collection fixes.
 */

const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'nodeModulesCollector.js'
)

const upstreamBroken = `        // Find the first index that starts with { or [
        const bracketOpen = Math.max(consoleOutput.indexOf("{"), 0);
        const bracketOpenSquare = Math.max(consoleOutput.indexOf("["), 0);
        const start = Math.min(bracketOpen, bracketOpenSquare); // always non-negative due to Math.max above
        for (let i = start; i < consoleOutput.length; i++) {`

const escapedRegexBroken = `        // Find the first real npm dependency-tree JSON object. The upstream
        // 26.8.1 code can start at warning text before the JSON payload.
        const packageObjectStart = consoleOutput.search(/\\\\{\\\\s*["']?(name|version|dependencies|problems|error)["']?\\\\s*:/);
        const fallbackObjectStart = consoleOutput.indexOf("{");
        const fallbackArrayStart = consoleOutput.indexOf("[");
        const starts = [packageObjectStart, fallbackObjectStart, fallbackArrayStart].filter((index) => index >= 0);
        if (starts.length === 0) {
            throw new Error("No JSON content found in output");
        }
        const start = packageObjectStart >= 0 ? packageObjectStart : (fallbackObjectStart >= 0 ? fallbackObjectStart : fallbackArrayStart);
        for (let i = start; i < consoleOutput.length; i++) {`

const legacyFixedWithoutDirectParse = `        // Find the first real npm dependency-tree JSON object. The upstream
        // 26.8.1 code can start at warning text before the JSON payload.
        const packageObjectStart = consoleOutput.search(/\\{\\s*["']?(name|version|dependencies|problems|error)["']?\\s*:/);
        const fallbackObjectStart = consoleOutput.indexOf("{");
        const fallbackArrayStart = consoleOutput.indexOf("[");
        const starts = [packageObjectStart, fallbackObjectStart, fallbackArrayStart].filter((index) => index >= 0);
        if (starts.length === 0) {
            throw new Error("No JSON content found in output");
        }
        const start = packageObjectStart >= 0 ? packageObjectStart : (fallbackObjectStart >= 0 ? fallbackObjectStart : fallbackArrayStart);
        for (let i = start; i < consoleOutput.length; i++) {`

const legacyDirectParseWithoutObjectPreference = `        // Find the first real npm dependency-tree JSON object. The upstream
        // 26.8.1 code can start at warning text before the JSON payload.
        const packageObjectStart = consoleOutput.search(/\\{\\s*["']?(name|version|dependencies|problems)["']?\\s*:/);
        const fallbackObjectStart = consoleOutput.indexOf("{");
        const fallbackArrayStart = consoleOutput.indexOf("[");
        const starts = [packageObjectStart, fallbackObjectStart, fallbackArrayStart].filter((index) => index >= 0);
        if (starts.length === 0) {
            throw new Error("No JSON content found in output");
        }
        const start = packageObjectStart >= 0 ? packageObjectStart : Math.min(...starts);
        const jsonCandidate = consoleOutput.slice(start);
        try {
            return JSON.parse(jsonCandidate);
        }
        catch {
            // ignore, there may be trailing process noise after the JSON payload
        }
        for (let i = start; i < consoleOutput.length; i++) {`

const fixed = `        // Find the first real npm dependency-tree JSON object. The upstream
        // 26.8.1 code can start at warning text before the JSON payload.
        const packageObjectStart = consoleOutput.search(/\\{\\s*["']?(name|version|dependencies|problems|error)["']?\\s*:/);
        const fallbackObjectStart = consoleOutput.indexOf("{");
        const fallbackArrayStart = consoleOutput.indexOf("[");
        const starts = [packageObjectStart, fallbackObjectStart, fallbackArrayStart].filter((index) => index >= 0);
        if (starts.length === 0) {
            throw new Error("No JSON content found in output");
        }
        const start = packageObjectStart >= 0 ? packageObjectStart : (fallbackObjectStart >= 0 ? fallbackObjectStart : fallbackArrayStart);
        const jsonCandidate = consoleOutput.slice(start);
        try {
            return JSON.parse(jsonCandidate);
        }
        catch {
            // ignore, there may be trailing process noise after the JSON payload
        }
        for (let i = start; i < consoleOutput.length; i++) {`

const syncCollectorMarker = 'FlowState buffered shell-command collector output patch'
const syncCollectorPattern =
  /    async streamCollectorCommandToFile\(command, args, cwd, tempOutputFile\) \{[\s\S]*?\n    \}\n\}\nexports\.NodeModulesCollector = NodeModulesCollector;/
const syncCollectorFixed = `    async streamCollectorCommandToFile(command, args, cwd, tempOutputFile) {
        const execName = path.basename(command, path.extname(command));
        await new Promise((resolve, reject) => {
            // ${syncCollectorMarker}: avoid piping stdout directly to a file.
            // The piped path can close with an empty file before npm's large JSON
            // dependency tree is fully flushed. Avoid shell execution because
            // managed Linux sandboxes can reject /bin/sh with EPERM.
            const child = childProcess.spawn(command, args, {
                cwd,
                env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env },
                shell: false,
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", chunk => {
                stdout += chunk.toString();
            });
            child.stderr.on("data", chunk => {
                stderr += chunk.toString();
            });
            child.on("error", err => {
                reject(new Error(\`Node module collector spawn failed: \${err.message}\`));
            });
            child.on("close", code => {
                const shouldIgnore = code === 1 && "npm" === execName.toLowerCase() && args.includes("list");
                if (stderr.length > 0) {
                    builder_util_1.log.debug({ stderr }, "note: there was node module collector output on stderr");
                    this.cache.logSummary[moduleManager_1.LogMessageByKey.PKG_COLLECTOR_OUTPUT].push(stderr);
                }
                fs.writeFile(tempOutputFile, stdout, { encoding: "utf8" })
                    .then(() => {
                    if (code === 0 || shouldIgnore) {
                        resolve();
                    }
                    else {
                        reject(new Error(\`Node module collector process exited with code \${code}:\\n\${stderr}\`));
                    }
                })
                    .catch(reject);
            });
        });
    }
}
exports.NodeModulesCollector = NodeModulesCollector;`

if (!fs.existsSync(target)) {
  console.warn(`[electron-builder-patch] skipped; ${target} does not exist`)
  process.exit(0)
}

const current = fs.readFileSync(target, 'utf8')
let patched = current
const applied = []

if (!patched.includes(fixed)) {
  const broken = patched.includes(escapedRegexBroken)
    ? escapedRegexBroken
    : patched.includes(legacyDirectParseWithoutObjectPreference)
      ? legacyDirectParseWithoutObjectPreference
      : patched.includes(legacyFixedWithoutDirectParse)
        ? legacyFixedWithoutDirectParse
        : patched.includes(upstreamBroken)
          ? upstreamBroken
          : null

  if (!broken) {
    console.warn('[electron-builder-patch] skipped parser patch; expected snippet not found')
  } else {
    patched = patched.replace(broken, fixed)
    applied.push('parser')
  }
}

if (!patched.includes(syncCollectorMarker)) {
  if (!syncCollectorPattern.test(patched)) {
    console.warn('[electron-builder-patch] skipped collector patch; expected method not found')
  } else {
    patched = patched.replace(syncCollectorPattern, syncCollectorFixed)
    applied.push('collector')
  }
}

const shellSpawnCollector = `            const child = childProcess.spawn([command, ...args].join(" "), {
                cwd,
                env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env },
                shell: true,
            });`
const directSpawnCollector = `            const child = childProcess.spawn(command, args, {
                cwd,
                env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env },
                shell: false,
            });`

if (patched.includes(shellSpawnCollector)) {
  patched = patched.replace(shellSpawnCollector, directSpawnCollector)
  applied.push('direct-spawn')
}

const syncShellCollector = `            const shellOutput = childProcess.execSync([command, ...args].join(" "), {
                cwd: this.rootDir,
                env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env },
                encoding: "utf8",
                maxBuffer: 200 * 1024 * 1024,
            });`
const directCollector = `            const shellOutput = childProcess.execFileSync(command, args, {
                cwd: this.rootDir,
                env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env },
                encoding: "utf8",
                maxBuffer: 200 * 1024 * 1024,
            });`

if (patched.includes(syncShellCollector)) {
  patched = patched.replace(syncShellCollector, directCollector)
  applied.push('direct-process')
}

const collectorEnvWithoutShimBypass = 'env: { COREPACK_ENABLE_STRICT: "0", ...process.env }'
const collectorEnvWithShimBypass = 'env: { COREPACK_ENABLE_STRICT: "0", SC_DISABLE_GATE: "1", ...process.env }'

if (patched.includes(collectorEnvWithoutShimBypass)) {
  patched = patched.replaceAll(collectorEnvWithoutShimBypass, collectorEnvWithShimBypass)
  applied.push('shim-bypass')
}

if (patched === current) {
  console.log('[electron-builder-patch] dependency collector already patched')
  process.exit(0)
}

fs.writeFileSync(target, patched)
console.log(`[electron-builder-patch] patched app-builder-lib ${applied.join(' + ')}`)
