#!/usr/bin/env bash
# Promote the public web/PWA and Electron updater from one validated receipt.
set -euo pipefail

TARGET_ROOT="${1:?public root required}"
PWA_STAGE="${2:?staged PWA directory required}"
ELECTRON_STAGE="${3:?staged Electron directory required}"
RECEIPT="${4:?release receipt required}"
GUARD="$ELECTRON_STAGE/electron-release-collision-guard.cjs"

command -v flock >/dev/null
command -v node >/dev/null
test -s "$RECEIPT"
test -d "$PWA_STAGE"
test -d "$ELECTRON_STAGE"
test -s "$GUARD"

VERSION="$(node -e 'const r=require(process.argv[1]); if(!/^\d+\.\d+\.\d+$/.test(r.version)) process.exit(2); process.stdout.write(r.version)' "$RECEIPT")"
UPDATES="$TARGET_ROOT/updates/electron"
# Keep the lock outside the swappable public directory so an atomic directory
# replacement cannot silently replace the mutex inode.
LOCK="${TARGET_ROOT}.release.lock"
STAGE="/var/tmp/flowstate-release-transaction-$VERSION-$$"

exec 9>"$LOCK"
flock -x 9
cleanup() { rm -rf -- "$STAGE"; }
trap cleanup EXIT

mkdir -p "$UPDATES" "$STAGE/pwa" "$STAGE/electron"
cp -a "$PWA_STAGE/." "$STAGE/pwa/"
cp -a "$ELECTRON_STAGE/." "$STAGE/electron/"
cp -- "$RECEIPT" "$STAGE/release-receipt.json"

node "$GUARD" \
  --local "$ELECTRON_STAGE/latest-linux.yml" \
  --artifacts-dir "$ELECTRON_STAGE" \
  --remote "$UPDATES/latest-linux.yml" \
  --expected-version "$VERSION" \
  --print-files >/dev/null

node - "$STAGE/release-receipt.json" "$STAGE/electron/latest-linux.yml" <<'NODE'
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const [receiptPath, manifestPath] = process.argv.slice(2)
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
const manifest = fs.readFileSync(manifestPath, 'utf8')
const version = manifest.match(/^version:\s*(\S+)$/m)?.[1]
const topPath = manifest.match(/^path:\s*(\S+)$/m)?.[1]
const topSha512 = manifest.match(/^sha512:\s*(\S+)$/m)?.[1]
if (receipt.schemaVersion !== 'flowstate-release-receipt-v1') throw new Error('invalid release receipt schema')
if (version !== receipt.version) throw new Error(`receipt/manifest version mismatch: ${version}/${receipt.version}`)
if (!/^\d+\.\d+\.\d+$/.test(receipt.version)) throw new Error('invalid release receipt version')
if (!/^[0-9a-f]{40}$/.test(receipt.source?.commit || '')) throw new Error('receipt source commit is not immutable')
if (receipt.source?.dirty !== false) throw new Error('refusing dirty source receipt')
if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) throw new Error('receipt has no artifacts')
const manifestArtifacts = [...manifest.matchAll(/^\s*-\s+url:\s*(\S+)\s*$/gm)].map((match) => path.basename(match[1]))
const receiptArtifacts = receipt.artifacts.map((artifact) => artifact.name)
if (manifestArtifacts.length !== receiptArtifacts.length || manifestArtifacts.some((name) => !receiptArtifacts.includes(name))) {
  throw new Error('receipt artifact set does not match manifest')
}
const primaryArtifact = receipt.artifacts.find((artifact) => artifact.name === path.basename(topPath || ''))
if (!primaryArtifact || topSha512 !== primaryArtifact.sha512) {
  throw new Error('manifest top-level path and SHA-512 are not bound to the receipt')
}
for (const artifact of receipt.artifacts) {
  if (!/^[A-Za-z0-9._-]+$/.test(artifact.name)) throw new Error(`unsafe artifact name: ${artifact.name}`)
  if (!/^[0-9a-f]{64}$/.test(artifact.sha256) || typeof artifact.sha512 !== 'string' || artifact.sha512.length === 0 || !Number.isSafeInteger(artifact.size) || artifact.size < 0) {
    throw new Error(`invalid artifact receipt: ${artifact.name}`)
  }
  const path = require('path').join(require('path').dirname(manifestPath), artifact.name)
  const stat = fs.statSync(path)
  if (stat.size !== artifact.size) throw new Error(`artifact size mismatch: ${artifact.name}`)
  const hash = require('crypto').createHash('sha256').update(fs.readFileSync(path)).digest('hex')
  if (hash !== artifact.sha256) throw new Error(`artifact hash mismatch: ${artifact.name}`)
  const sha512 = require('crypto').createHash('sha512').update(fs.readFileSync(path)).digest('base64')
  if (sha512 !== artifact.sha512) throw new Error(`artifact SHA-512 mismatch: ${artifact.name}`)
}
if (!receipt.web || !Number.isSafeInteger(receipt.web.fileCount) || receipt.web.fileCount <= 0 || !/^[0-9a-f]{64}$/.test(receipt.web.sha256)) {
  throw new Error('invalid web receipt')
}
const pwaRoot = path.join(path.dirname(receiptPath), 'pwa')
if (!fs.existsSync(pwaRoot)) throw new Error('staged web build is missing')
const walk = (root, prefix = '') => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const relative = path.join(prefix, entry.name)
  const absolute = path.join(root, entry.name)
  return entry.isDirectory() ? walk(absolute, relative) : [relative]
})
const webFiles = walk(pwaRoot).sort()
const webHash = crypto.createHash('sha256')
for (const relative of webFiles) webHash.update(relative).update('\0').update(fs.readFileSync(path.join(pwaRoot, relative))).update('\0')
if (webFiles.length !== receipt.web.fileCount || webHash.digest('hex') !== receipt.web.sha256) throw new Error('staged web build does not match receipt')
NODE

CURRENT="$(awk '/^version:/{print $2; exit}' "$UPDATES/latest-linux.yml" 2>/dev/null || true)"
node - "$CURRENT" "$VERSION" <<'NODE'
const [current, next] = process.argv.slice(2)
const parts = (v) => (v || '0.0.0').split('.').map(Number)
const a = parts(current), b = parts(next)
const cmp = a.reduce((result, n, i) => result || Math.sign(b[i] - n), 0)
if (cmp === 0) throw new Error(`same-version release: ${next}`)
if (cmp < 0) throw new Error(`downgrade release: ${next} < ${current}`)
NODE

# Prepare a complete next public root outside the live path. Copying the
# existing root first preserves server-managed auth/backup/font/icon content
# and historical updater artifacts; the staged PWA then replaces its complete
# web tree before the live directory is switched.
NEXT_ROOT="$STAGE/public-root"
mkdir -p "$NEXT_ROOT"
cp -a "$TARGET_ROOT/." "$NEXT_ROOT/"
rsync -a --delete --exclude updates --exclude .release.lock "$STAGE/pwa/" "$NEXT_ROOT/"
mkdir -p "$NEXT_ROOT/updates/electron"
cp -f -- "$STAGE/release-receipt.json" "$NEXT_ROOT/release-receipt.json"
for artifact in "$STAGE/electron"/*; do
  [ -f "$artifact" ] || continue
  [ "$(basename "$artifact")" = latest-linux.yml ] || cp -f -- "$artifact" "$NEXT_ROOT/updates/electron/"
done
cp -f -- "$STAGE/electron/latest-linux.yml" "$NEXT_ROOT/updates/electron/latest-linux.yml"

# Replace the public directory only after the complete snapshot is ready.
# Both rename operations are on the same filesystem; a failed second rename
# restores the old tree before returning an error.
BACKUP_ROOT="${TARGET_ROOT}.previous-${VERSION}-$$"
mv -- "$TARGET_ROOT" "$BACKUP_ROOT"
if ! mv -- "$NEXT_ROOT" "$TARGET_ROOT"; then
  mv -- "$BACKUP_ROOT" "$TARGET_ROOT"
  exit 1
fi
rm -rf -- "$BACKUP_ROOT"
echo "promoted FlowState $VERSION across web/PWA/Electron"
