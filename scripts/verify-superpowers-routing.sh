#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pass() {
  printf 'ok: %s\n' "$1"
}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "missing required file: $path"
  pass "found $path"
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "missing command on PATH: $command_name"
  pass "found command $command_name"
}

require_command codex
require_command claude

required_skills=(
  superpowers-flowstate-auto-router
  superpowers-systematic-debugging
  superpowers-test-driven-development
  superpowers-verification-before-completion
  superpowers-requesting-code-review
  superpowers-receiving-code-review
  superpowers-writing-plans
)

for skill in "${required_skills[@]}"; do
  require_file ".claude/skills/${skill}/SKILL.md"
  require_file ".codex/skills/${skill}/SKILL.md"
done

codex_plugins="$(codex plugin list 2>&1 || true)"
if ! grep -Eq 'superpowers@openai-curated[[:space:]]+installed, enabled' <<<"$codex_plugins"; then
  printf '%s\n' "$codex_plugins" >&2
  fail "Codex Superpowers plugin is not installed and enabled"
fi
pass "Codex Superpowers plugin installed and enabled"

claude_plugins="$(claude plugin list 2>&1 || true)"
if ! grep -Eq 'superpowers@claude-plugins-official|superpowers@superpowers-marketplace' <<<"$claude_plugins"; then
  printf '%s\n' "$claude_plugins" >&2
  fail "Claude Code Superpowers plugin is not installed"
fi
pass "Claude Code Superpowers plugin installed"

if command -v opencode >/dev/null 2>&1; then
  opencode_config="${HOME}/.config/opencode/opencode.json"
  [[ -f "$opencode_config" ]] || fail "missing OpenCode config: $opencode_config"
  if ! grep -Eq '\.codex/skills|\.config/opencode/skills|\.claude/skills' "$opencode_config"; then
    fail "OpenCode config does not expose known skill paths"
  fi
  pass "OpenCode skill paths expose Superpowers wrappers"
else
  pass "OpenCode not on PATH; skipping OpenCode checks"
fi

if [[ "${FLOWSTATE_SUPERPOWERS_SKIP_CODEX_SMOKE:-0}" == "1" ]]; then
  pass "fresh Codex smoke skipped by FLOWSTATE_SUPERPOWERS_SKIP_CODEX_SMOKE=1"
  exit 0
fi

run_codex_smoke() {
  local label="$1"
  local prompt="$2"
  local output

  if ! output="$(timeout 90 codex exec --ephemeral -s read-only -C "$ROOT_DIR" "$prompt" 2>&1)"; then
    printf '%s\n' "$output"
    fail "fresh Codex smoke command failed for ${label}"
  fi

  printf '%s\n' "$output"

  if ! grep -Fq 'Skills used: superpowers-flowstate-auto-router' <<<"$output"; then
    fail "fresh Codex smoke did not report FlowState Superpowers router for ${label}"
  fi

  pass "fresh Codex smoke used FlowState router for ${label}"
}

run_codex_smoke \
  "planning prompt" \
  "For this FlowState repo, answer in one line only: Skills used: <names>. Then say whether the FlowState Superpowers router is visible. Do not modify files."

run_codex_smoke \
  "bug/fix prompt" \
  "For this FlowState repo, treat this as a bugfix planning prompt. Answer in one line only: Skills used: <names>. Then say whether the FlowState Superpowers router is visible. Do not modify files."
