#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage: npm run next:interactive -- [mode]

Modes:
  planned   Show planned tasks (default)
  progress  Show in-progress tasks
  review    Show review tasks
  active    Show in-progress + review tasks
  bugs      Show bug tasks
  all       Show all tasks (including done)
  choose    Pick mode interactively first
EOF
}

mode="${1:-planned}"

case "$mode" in
  -h|--help|help)
    usage
    exit 0
    ;;
esac

select_mode_interactively() {
  local options
  options=$(
    cat <<'EOF'
planned
progress
review
active
bugs
all
EOF
  )

  if ! command -v fzf >/dev/null 2>&1; then
    echo "fzf is not installed. Falling back to 'planned' mode." >&2
    echo "planned"
    return
  fi

  if [[ ! -t 0 || ! -t 1 ]]; then
    echo "planned"
    return
  fi

  printf '%s\n' "$options" | fzf \
    --prompt="Mode> " \
    --header="Pick task view mode" \
    --height=40% \
    --border
}

if [[ "$mode" == "choose" ]]; then
  picked_mode="$(select_mode_interactively || true)"
  if [[ -z "${picked_mode:-}" ]]; then
    echo "No mode selected."
    exit 0
  fi
  mode="$picked_mode"
fi

list_args=(--limit=300)

case "$mode" in
  planned) list_args+=(--planned) ;;
  progress) list_args+=(--progress) ;;
  review) list_args+=(--review) ;;
  active) list_args+=(--active) ;;
  bugs) list_args+=(--bugs) ;;
  all) list_args+=(--all) ;;
  *)
    echo "Unknown mode: $mode" >&2
    usage
    exit 1
    ;;
esac

list_cmd=(npm run --silent pick:list -- "${list_args[@]}")

if ! command -v fzf >/dev/null 2>&1; then
  echo "fzf is not installed. Showing plain list instead."
  "${list_cmd[@]}"
  echo
  echo "Install fzf for interactive mode: https://github.com/junegunn/fzf"
  exit 0
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  "${list_cmd[@]}"
  exit 0
fi

preview_cmd='id=$(printf "%s\n" {} | awk "{print \$3}" | sed "s/:$//"); if [[ -n "$id" ]]; then npm run --silent pick:show -- "$id"; fi'

selected="$(
  "${list_cmd[@]}" | fzf \
    --ansi \
    --prompt="Task> " \
    --height=90% \
    --layout=reverse \
    --border \
    --preview="$preview_cmd" \
    --preview-window="right,65%,wrap" \
    --header="Enter=open task context | Ctrl-R=refresh | Mode=$mode" \
    --bind="ctrl-r:reload:${list_cmd[*]}"
)"

if [[ -z "${selected:-}" ]]; then
  echo "No task selected."
  exit 0
fi

task_id="$(printf '%s\n' "$selected" | awk '{print $3}' | sed 's/:$//')"

if [[ -z "$task_id" ]]; then
  echo "Failed to parse task ID from selection:"
  printf '%s\n' "$selected"
  exit 1
fi

echo
echo "Selected: $task_id"
echo
npm run --silent pick:show -- "$task_id"
