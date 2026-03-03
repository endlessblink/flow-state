# PomoFlow KDE Plasma Widget

KDE Plasma 6 panel widget for FlowState — Pomodoro timer with Supabase task integration.

## Development Setup

```bash
cd packages/kde-widget
bash install.sh        # Symlinks widget to Plasma plasmoids dir
plasmashell --replace & # Reload Plasma to pick up changes
```

The install script creates a symlink from `~/.local/share/plasma/plasmoids/com.pomoflow.widget` to this directory, so edits here are reflected live after a Plasma restart.

## Structure

```
contents/
  ui/main.qml           # Main widget UI + all logic (~2500 lines)
  ui/configGeneral.qml   # Settings panel (Supabase URL, timer durations, auth)
  config/main.xml        # KDE config schema (persisted settings)
  config/config.qml      # Config page registration
  scripts/notify.sh      # Timer completion notification with action buttons
  scripts/oauth-google.py # Google OAuth helper (localhost redirect capture)
  icons/tomato.svg       # Work session icon
  icons/rest.svg         # Break session icon
metadata.json            # Plasma applet metadata
```

## Configuration

Right-click widget > Configure:
- **Supabase URL** + **Anon Key** — point to your Supabase instance
- **Email/Password** — sign in (password never stored, only JWT tokens)
- **Timer durations** — work, break, long break
- **filterProjectId** — (power-user) filter pinned tasks to a specific project UUID

## Features

- Pomodoro timer with cross-device sync (2s polling when active, 30s idle)
- Task list with sort/filter
- Quick task creation (text input + create/play buttons)
- Pinned task chips (60s refresh, project-filterable)
- Desktop notifications with action buttons (start break / +5min)
- Google OAuth sign-in
