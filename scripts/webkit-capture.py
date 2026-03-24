#!/usr/bin/env python3
"""
Capture WebKitGTK 4.1 screenshots for each view — used as Tauri proxy for visual regression.
Saves to tests/visual/artifacts/tauri-{view}.png for pixelmatch comparison.

Usage:
  npx vite --port 6366 &
  python3 scripts/webkit-capture.py [port]
"""
import sys
import os
import json
import time
import requests
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(PROJECT_ROOT, 'tests', 'visual', 'artifacts')
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

VIEWS = [
    ('/#/', 'canvas'),
    ('/#/board', 'board'),
    ('/#/tasks', 'catalog'),
    ('/#/calendar', 'calendar'),
]

# ── Auth ──
def get_auth_js():
    try:
        anon_key = None
        env_path = os.path.join(PROJECT_ROOT, '.env.local')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith('VITE_SUPABASE_ANON_KEY='):
                        anon_key = line.split('=', 1)[1].strip().strip('"')
        supabase_url = 'http://127.0.0.1:54321'
        resp = requests.post(
            f'{supabase_url}/auth/v1/token?grant_type=password',
            headers={'Content-Type': 'application/json', 'apikey': anon_key},
            json={'email': 'playwright@test.flowstate', 'password': 'pw-playwright-e2e-2026!'},
            timeout=10
        )
        resp.raise_for_status()
        session = resp.json()
        storage = json.dumps({
            'access_token': session['access_token'],
            'refresh_token': session['refresh_token'],
            'expires_in': session['expires_in'],
            'expires_at': int(time.time()) + session['expires_in'],
            'token_type': 'bearer',
            'user': session['user'],
        })
        print(f'✅ Authenticated as {session["user"]["email"]}', file=sys.stderr)
        return f"localStorage.setItem('flowstate-supabase-auth', {json.dumps(storage)});"
    except Exception as e:
        print(f'⚠️  Auth failed: {e}', file=sys.stderr)
        return ''

AUTH_JS = get_auth_js()

INJECT_JS = f"""
(function() {{
  {AUTH_JS}
  localStorage.setItem('flowstate-settings-v2', '{{"aiSetupComplete":true}}');
  localStorage.setItem('flowstate-onboarding-v2', 'true');
  localStorage.setItem('flowstate-welcome-seen', 'true');
  function injectTauri() {{
    document.body.classList.add('tauri-app');
    var app = document.getElementById('app');
    if (app) app.classList.add('tauri-app');
    window.__TAURI__ = {{ convertFileSrc: function(s) {{ return s; }} }};
    window.__TAURI_INTERNALS__ = {{}};
  }}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectTauri);
  else injectTauri();
  new MutationObserver(function() {{
    var app = document.getElementById('app');
    if (app && !app.classList.contains('tauri-app')) app.classList.add('tauri-app');
    if (document.body && !document.body.classList.contains('tauri-app')) document.body.classList.add('tauri-app');
  }}).observe(document.documentElement, {{ childList: true, subtree: true }});
}})();
"""

class ViewCapture:
    def __init__(self):
        self.current_view = 0
        self.captured = []

        self.win = Gtk.Window(title='WebKitGTK View Capture')
        self.win.set_default_size(1280, 720)
        self.win.connect('destroy', Gtk.main_quit)

        content_manager = WebKit2.UserContentManager()
        content_manager.add_script(WebKit2.UserScript(
            INJECT_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START, None, None
        ))

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)

        self.webview = WebKit2.WebView.new_with_user_content_manager(content_manager)
        self.webview.set_settings(settings)
        self.webview.connect('load-changed', self.on_load_changed)

        self.win.add(self.webview)
        self.win.show_all()

        # Start with first view
        self.navigate_to_view()

    def navigate_to_view(self):
        if self.current_view >= len(VIEWS):
            self.finish()
            return
        route, name = VIEWS[self.current_view]
        print(f'📸 Navigating to {name} ({route})...', file=sys.stderr)
        if self.current_view == 0:
            # First load — use load_uri
            self.webview.load_uri(f'{URL}{route}')
        else:
            # Subsequent views — use JS hash navigation (load-changed won't fire for hash changes)
            self.webview.evaluate_javascript(
                f"window.location.hash = '{route.lstrip('/')}'",
                -1, None, None, None, None, None
            )
            GLib.timeout_add(4000, self.capture_screenshot)

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            # Only used for initial page load
            GLib.timeout_add(6000, self.capture_screenshot)

    def capture_screenshot(self):
        route, name = VIEWS[self.current_view]
        path = os.path.join(ARTIFACTS_DIR, f'tauri-{name}.png')
        try:
            self.webview.get_snapshot(
                WebKit2.SnapshotRegion.VISIBLE,
                WebKit2.SnapshotOptions.NONE,
                None, self.on_screenshot, (name, path)
            )
        except Exception as e:
            print(f'❌ Screenshot error for {name}: {e}', file=sys.stderr)
            self.next_view()
        return False

    def on_screenshot(self, webview, result, data):
        name, path = data
        try:
            surface = webview.get_snapshot_finish(result)
            surface.write_to_png(path)
            self.captured.append(name)
            print(f'  ✅ {name} → {path}', file=sys.stderr)
        except Exception as e:
            print(f'  ❌ {name} failed: {e}', file=sys.stderr)
        self.next_view()

    def next_view(self):
        self.current_view += 1
        GLib.timeout_add(500, self.navigate_to_view)

    def finish(self):
        print(f'\n📊 Captured {len(self.captured)}/{len(VIEWS)} views', file=sys.stderr)
        print(json.dumps({'captured': self.captured, 'dir': ARTIFACTS_DIR}))
        GLib.timeout_add(500, lambda: (Gtk.main_quit(), False))

capture = ViewCapture()
GLib.timeout_add(60000, lambda: (print('TIMEOUT', file=sys.stderr), Gtk.main_quit(), sys.exit(2)))
Gtk.main()
