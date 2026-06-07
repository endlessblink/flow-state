#!/usr/bin/env bash
# verify-build-renders.sh — TASK-1823
#
# The single reliable gate against the "Electron doesn't load" / white-screen
# regression class. It proves the PRODUCTION BUNDLE (the exact dist/ that ships
# to the web PWA and to Electron via file://) actually mounts, by:
#   1. type-checking the source (catches used-but-unimported symbols — BUG-1796),
#   2. building the production bundle (unless --no-build),
#   3. serving that bundle and asserting the app renders with no fatal runtime
#      error and no stuck loading spinner (tests/smoke/prod-build-render.spec.ts).
#
# Exit non-zero on ANY failure so callers (deploy script, CI) abort the release.
#
# Usage:
#   scripts/verify-build-renders.sh              # type-check + build + smoke
#   scripts/verify-build-renders.sh --no-build   # smoke an already-built dist/
#   scripts/verify-build-renders.sh --skip-typecheck
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

NO_BUILD=false
SKIP_TYPECHECK=false
CHECK_FILE_PROTOCOL=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) NO_BUILD=true; shift ;;
    --skip-typecheck) SKIP_TYPECHECK=true; shift ;;
    # Also assert dist/index.html mounts over file:// (the Electron desktop load
    # path). Use ONLY for base './' (ELECTRON_BUILD) bundles — a base '/' web
    # bundle legitimately fails over file://.
    --check-file-protocol) CHECK_FILE_PROTOCOL=true; shift ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 2 ;;
  esac
done

echo -e "${CYAN}=== verify-build-renders (blank-screen gate) ===${NC}"

# Step 1 — Type check. Catches the undefined-symbol class that the esbuild-based
# `npm run build` silently ships. Cheap and deterministic; runs first.
if [ "$SKIP_TYPECHECK" = false ]; then
  echo -e "${YELLOW}[1/3] Type-checking source...${NC}"
  npm run type-check
else
  echo -e "${YELLOW}[1/3] Type-check SKIPPED (--skip-typecheck)${NC}"
fi

# Step 2 — Build the production bundle (the Electron base './' path is the most
# failure-prone, so verify that variant by default).
if [ "$NO_BUILD" = false ]; then
  echo -e "${YELLOW}[2/3] Building production bundle (ELECTRON_BUILD=true)...${NC}"
  ELECTRON_BUILD=true npm run build
else
  echo -e "${YELLOW}[2/3] Build SKIPPED (--no-build) — smoke-testing existing dist/${NC}"
fi

if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  echo -e "${RED}✗ dist/index.html missing — nothing to smoke-test.${NC}"
  exit 1
fi

# Step 2b — Electron file:// base-path guard (static, deterministic).
# Electron loads dist/index.html over file://. If the bundle uses ABSOLUTE asset
# paths (/assets/...) instead of RELATIVE (./assets/...), every asset 404s over
# file:// and the desktop app is blank while the web app is fine. Plain Chromium
# can't load ESM over file:// (security), so we assert this statically rather than
# in a (false-failing, flaky) browser test. Only valid for ELECTRON_BUILD bundles.
if [ "$CHECK_FILE_PROTOCOL" = true ]; then
  echo -e "${YELLOW}[2b/3] Verifying Electron file:// base path (relative assets)...${NC}"
  if grep -qE '(src|href)="/assets/' "$PROJECT_DIR/dist/index.html"; then
    echo -e "${RED}✗ dist/index.html uses ABSOLUTE asset paths (/assets/...).${NC}"
    echo -e "${RED}  The desktop app loads over file:// and will be BLANK. Expected relative './assets/'.${NC}"
    echo -e "${RED}  Fix: ensure ELECTRON_BUILD is set so vite.config.ts uses base './'.${NC}"
    exit 1
  fi
  if ! grep -qE '(src|href)="\./assets/' "$PROJECT_DIR/dist/index.html"; then
    echo -e "${RED}✗ dist/index.html has no relative './assets/' references — unexpected bundle shape.${NC}"
    exit 1
  fi
  echo -e "${GREEN}  ✓ Electron bundle uses relative asset paths (file://-safe).${NC}"
fi

# Step 3 — Render smoke against the built bundle.
echo -e "${YELLOW}[3/3] Smoke-testing rendered output...${NC}"
if npx playwright test --config playwright.smoke.config.ts; then
  echo -e "${GREEN}✓ Production bundle renders — no blank screen.${NC}"
else
  echo -e "${RED}✗ BLANK-SCREEN GATE FAILED — the built bundle does not render.${NC}"
  echo -e "${RED}  Do NOT deploy. Inspect the Playwright report and console output above.${NC}"
  exit 1
fi
