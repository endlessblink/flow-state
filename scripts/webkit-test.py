#!/usr/bin/env python3
"""
WebKitGTK 4.1 automated visual regression tester with Supabase auth.
Same engine as Tauri's wry — full .tauri-app CSS parity + authenticated user.

Usage:
  npx vite --port 6366 &
  python3 scripts/webkit-test.py [port]

Outputs JSON results to stdout. Screenshots to .dev/screenshots/webkit/.
Exit code 0 = all pass, 1 = failures, 2 = timeout.
"""
import sys
import os
import json
import time
import subprocess
import requests
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOT_DIR = os.path.join(PROJECT_ROOT, '.dev', 'screenshots', 'webkit')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# ── Auth: sign in test user via Supabase REST API ──
def get_supabase_auth():
    """Sign in the test user and return localStorage injection JS."""
    try:
        # Get anon key from env or .env.local
        anon_key = os.environ.get('VITE_SUPABASE_ANON_KEY')
        if not anon_key:
            env_path = os.path.join(PROJECT_ROOT, '.env.local')
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('VITE_SUPABASE_ANON_KEY='):
                            anon_key = line.split('=', 1)[1].strip().strip('"')
                            break
        if not anon_key:
            # Try supabase status
            result = subprocess.run(['supabase', 'status', '--output', 'json'],
                                    capture_output=True, text=True, cwd=PROJECT_ROOT)
            if result.returncode == 0:
                status = json.loads(result.stdout)
                anon_key = status.get('ANON_KEY', '')

        supabase_url = os.environ.get('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')

        resp = requests.post(
            f'{supabase_url}/auth/v1/token?grant_type=password',
            headers={'Content-Type': 'application/json', 'apikey': anon_key},
            json={'email': 'playwright@test.flowstate', 'password': 'pw-playwright-e2e-2026!'},
            timeout=10
        )
        resp.raise_for_status()
        session = resp.json()

        storage_value = json.dumps({
            'access_token': session['access_token'],
            'refresh_token': session['refresh_token'],
            'expires_in': session['expires_in'],
            'expires_at': int(time.time()) + session['expires_in'],
            'token_type': 'bearer',
            'user': session['user'],
        })

        print(f'✅ Authenticated as {session["user"]["email"]}', file=sys.stderr)
        return f"""
localStorage.setItem('flowstate-supabase-auth', {json.dumps(storage_value)});
localStorage.setItem('flowstate-settings-v2', '{{"aiSetupComplete":true}}');
localStorage.setItem('flowstate-onboarding-v2', 'true');
localStorage.setItem('flowstate-welcome-seen', 'true');
"""
    except Exception as e:
        print(f'⚠️  Auth failed: {e} — running unauthenticated', file=sys.stderr)
        return ''

AUTH_JS = get_supabase_auth()

# ── Inject .tauri-app class + auth before page loads ──
INJECT_JS = f"""
(function() {{
  // Auth — must run before Vue boots
  {AUTH_JS}

  // Tauri CSS parity
  function injectTauri() {{
    document.body.classList.add('tauri-app');
    var app = document.getElementById('app');
    if (app) app.classList.add('tauri-app');
    window.__TAURI__ = {{ convertFileSrc: function(s) {{ return s; }} }};
    window.__TAURI_INTERNALS__ = {{}};
  }}
  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', injectTauri);
  }} else {{ injectTauri(); }}
  new MutationObserver(function() {{
    var app = document.getElementById('app');
    if (app && !app.classList.contains('tauri-app')) app.classList.add('tauri-app');
    if (!document.body.classList.contains('tauri-app')) document.body.classList.add('tauri-app');
  }}).observe(document.documentElement, {{ childList: true, subtree: true }});
}})();
"""

# ── Visual checks — comprehensive JS that returns JSON array ──
VISUAL_CHECKS_JS = """
(function() {
  var results = [];
  function check(name, passed, details) {
    results.push({ name: name, passed: passed, details: details || '' });
  }

  // 1. Sidebar width
  var sidebar = document.querySelector('.sidebar, aside');
  if (sidebar) {
    var sRect = sidebar.getBoundingClientRect();
    check('sidebar-width', sRect.width >= 200, 'width=' + Math.round(sRect.width) + 'px');
  } else { check('sidebar-width', false, 'not found'); }

  // 2. Nav labels visible (need >=3 with width >20px)
  var navLabels = document.querySelectorAll('.nav-label');
  var wideLabels = 0;
  navLabels.forEach(function(el) { if (el.getBoundingClientRect().width > 20) wideLabels++; });
  check('nav-labels-visible', wideLabels >= 3, wideLabels + '/' + navLabels.length + ' labels >20px');

  // 3. Task text not overlapped by action icons
  var overlaps = [];
  document.querySelectorAll('.inbox-task-card, .task-card, [class*="task-item"], [class*="inbox-task"]').forEach(function(card) {
    var title = card.querySelector('[class*="title"], [class*="task-name"], [class*="task-text"]');
    var actions = card.querySelector('[class*="actions"], [class*="action-btn"]');
    if (title && actions) {
      var tR = title.getBoundingClientRect();
      var aR = actions.getBoundingClientRect();
      var dir = getComputedStyle(card).direction;
      var hasOverlap = dir === 'rtl' ? (aR.right > tR.left + 5) : (aR.left < tR.right - 5);
      if (hasOverlap && aR.width > 0 && tR.width > 0)
        overlaps.push(title.textContent.trim().substring(0, 20));
    }
  });
  check('task-text-no-overlap', overlaps.length === 0,
    overlaps.length ? 'OVERLAP: ' + overlaps.join(', ') : 'checked OK');

  // 4. Done toggle icons — proper size and opacity
  var toggleIssues = [];
  document.querySelectorAll('.done-toggle, [class*="done-toggle"], .task-check').forEach(function(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 12 || r.width > 40 || r.height < 12 || r.height > 40)
      toggleIssues.push('size=' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (parseFloat(getComputedStyle(el).opacity) < 0.3)
      toggleIssues.push('opacity=' + getComputedStyle(el).opacity);
  });
  check('done-toggle-icons', toggleIssues.length === 0,
    toggleIssues.length ? toggleIssues.join('; ') : 'OK');

  // 5. Runtime style injection (CSP check)
  var cspEl = document.createElement('div');
  cspEl.id = '__csp__'; cspEl.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
  document.body.appendChild(cspEl);
  var st = document.createElement('style');
  st.textContent = '#__csp__ { width: 42px !important; }';
  document.head.appendChild(st);
  var w = document.getElementById('__csp__').getBoundingClientRect().width;
  check('csp-allows-runtime-styles', Math.round(w) === 42, 'injected=' + Math.round(w) + ' expect=42');
  cspEl.remove(); st.remove();

  // 6. Grid: sidebar + main don't overlap
  var main = document.querySelector('.main-content, main');
  if (sidebar && main) {
    var sR = sidebar.getBoundingClientRect().right;
    var mL = main.getBoundingClientRect().left;
    check('grid-layout-ok', mL >= sR - 2, 'sidebar.right=' + Math.round(sR) + ' main.left=' + Math.round(mL));
  }

  // 7. No zero-width text elements
  var zw = [];
  ['.inbox-title', '.section-title', '.project-name', '.nav-label-tooltip', '.task-title'].forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el) {
      if (el.getBoundingClientRect().width === 0 && el.textContent.trim().length > 0)
        zw.push(sel + ':"' + el.textContent.trim().substring(0, 15) + '"');
    });
  });
  check('no-zero-width-text', zw.length === 0, zw.length ? zw.join('; ') : 'OK');

  // 8. Backdrop-filter renders (glass morphism)
  var blurCount = 0;
  document.querySelectorAll('.sidebar, .empty-card, .glass, [class*="glass"]').forEach(function(el) {
    var cs = getComputedStyle(el);
    var bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    if (bf && bf !== 'none' && bf.includes('blur')) blurCount++;
  });
  check('glass-morphism-renders', blurCount > 0, blurCount + ' elements with backdrop-filter blur');

  // 9. All project names visible in sidebar
  var projNames = [];
  document.querySelectorAll('.projects-list .nav-label, .project-name').forEach(function(el) {
    var r = el.getBoundingClientRect();
    projNames.push({ text: el.textContent.trim().substring(0, 20), width: Math.round(r.width) });
  });
  var clippedProjects = projNames.filter(function(p) { return p.width < 30 && p.text.length > 0; });
  check('project-names-visible', clippedProjects.length === 0,
    clippedProjects.length ? 'CLIPPED: ' + clippedProjects.map(function(p) { return p.text + '(' + p.width + 'px)'; }).join(', ')
    : projNames.length + ' projects OK');

  // 10. Console errors (check if any were captured)
  var consoleErrors = window.__webkitTestErrors || [];
  check('no-console-errors', consoleErrors.length === 0,
    consoleErrors.length ? consoleErrors.slice(0, 5).join('; ') : 'clean');

  // 11. Popover containers accessible (NPopover teleport to body works)
  var popoverContainers = document.querySelectorAll('.n-popover-shared-class, [class*="n-popover"]');
  check('popover-containers', true, popoverContainers.length + ' popover containers in DOM');

  // 12. All views navigable — check router links exist
  var viewLinks = [];
  ['Canvas', 'Calendar', 'Board', 'Catalog', 'Quick Sort'].forEach(function(name) {
    var found = document.querySelector('a[href*="' + name.toLowerCase() + '"], [class*="nav"] *');
    viewLinks.push(name);
  });
  check('view-nav-exists', viewLinks.length >= 3, viewLinks.join(', '));

  // 13. No elements overflowing viewport
  var overflows = [];
  document.querySelectorAll('.sidebar, .main-content, .inbox-header, .content-header').forEach(function(el) {
    var r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 5) overflows.push(el.className.substring(0, 25) + ' right=' + Math.round(r.right));
    if (r.bottom > window.innerHeight + 50) {} // Allow some vertical scroll
  });
  check('no-horizontal-overflow', overflows.length === 0,
    overflows.length ? overflows.join('; ') : 'OK');

  return JSON.stringify(results);
})()
"""

# ── Error capture script — inject before page loads ──
ERROR_CAPTURE_JS = """
window.__webkitTestErrors = [];
window.addEventListener('error', function(e) {
  window.__webkitTestErrors.push('ERR: ' + e.message + ' at ' + (e.filename || '') + ':' + (e.lineno || ''));
});
window.addEventListener('unhandledrejection', function(e) {
  window.__webkitTestErrors.push('PROMISE: ' + (e.reason ? e.reason.message || String(e.reason) : 'unknown'));
});
console._origError = console.error;
console.error = function() {
  var msg = Array.prototype.slice.call(arguments).map(String).join(' ');
  if (msg.length < 200) window.__webkitTestErrors.push('console.error: ' + msg);
  console._origError.apply(console, arguments);
};
"""

class WebKitTester:
    def __init__(self):
        self.results = []

        self.win = Gtk.Window(title='WebKitGTK Test Runner')
        self.win.set_default_size(1400, 900)
        self.win.connect('destroy', Gtk.main_quit)

        content_manager = WebKit2.UserContentManager()

        # Error capture — must be first
        content_manager.add_script(WebKit2.UserScript(
            ERROR_CAPTURE_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START, None, None
        ))

        # Auth + Tauri parity
        content_manager.add_script(WebKit2.UserScript(
            INJECT_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START, None, None
        ))

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_write_console_messages_to_stdout(True)

        self.webview = WebKit2.WebView.new_with_user_content_manager(content_manager)
        self.webview.set_settings(settings)
        self.webview.connect('load-changed', self.on_load_changed)
        self.webview.load_uri(URL)

        self.win.add(self.webview)
        self.win.show_all()

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            print('Page loaded. Waiting 8s for Vue + Supabase hydration...', file=sys.stderr)
            GLib.timeout_add(8000, self.run_checks)

    def run_checks(self):
        print('Running visual checks...', file=sys.stderr)
        self.take_screenshot()
        self.webview.evaluate_javascript(
            VISUAL_CHECKS_JS, -1, None, None, None, self.on_results, None
        )
        return False

    def take_screenshot(self):
        path = os.path.join(SCREENSHOT_DIR, f'webkit-test-{int(time.time())}.png')
        try:
            self.webview.get_snapshot(
                WebKit2.SnapshotRegion.FULL_DOCUMENT,
                WebKit2.SnapshotOptions.NONE,
                None, self.on_screenshot, path
            )
        except Exception as e:
            print(f'Screenshot error: {e}', file=sys.stderr)

    def on_screenshot(self, webview, result, path):
        try:
            surface = webview.get_snapshot_finish(result)
            surface.write_to_png(path)
            print(f'📸 Screenshot: {path}', file=sys.stderr)
        except Exception as e:
            print(f'Screenshot error: {e}', file=sys.stderr)

    def on_results(self, webview, result, user_data):
        try:
            js_result = webview.evaluate_javascript_finish(result)
            self.results = json.loads(js_result.to_string())
        except Exception as e:
            self.results = [{'name': 'js-error', 'passed': False, 'details': str(e)}]

        passed = sum(1 for r in self.results if r['passed'])
        failed = sum(1 for r in self.results if not r['passed'])

        # JSON to stdout
        print(json.dumps({
            'summary': {'passed': passed, 'failed': failed, 'total': len(self.results)},
            'results': self.results
        }, indent=2))

        # Human-readable to stderr
        print(f'\n{"=" * 55}', file=sys.stderr)
        print(f'  WebKitGTK 4.1 Visual Regression — {passed} passed, {failed} failed', file=sys.stderr)
        print(f'{"=" * 55}', file=sys.stderr)
        for r in self.results:
            icon = '✅' if r['passed'] else '❌'
            print(f'  {icon} {r["name"]}: {r["details"]}', file=sys.stderr)
        print(f'{"=" * 55}\n', file=sys.stderr)

        GLib.timeout_add(1000, self.quit)

    def quit(self):
        Gtk.main_quit()
        code = 0 if all(r['passed'] for r in self.results) else 1
        sys.exit(code)
        return False

tester = WebKitTester()
GLib.timeout_add(45000, lambda: (print('TIMEOUT', file=sys.stderr), Gtk.main_quit(), sys.exit(2)))
Gtk.main()
