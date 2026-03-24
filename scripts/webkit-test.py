#!/usr/bin/env python3
"""
WebKitGTK 4.1 automated visual regression tester.
Same engine as Tauri's wry — runs headless-like checks with .tauri-app parity.

Usage:
  npx vite --port 6366 &
  python3 scripts/webkit-test.py [port]

Outputs JSON results to stdout. Screenshots saved to .dev/screenshots/webkit/.
Exit code 0 = all pass, 1 = failures found.
"""
import sys
import os
import json
import time
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.dev', 'screenshots', 'webkit')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Inject .tauri-app class for CSS parity
TAURI_PARITY_JS = """
(function() {
  function inject() {
    document.body.classList.add('tauri-app');
    var app = document.getElementById('app');
    if (app) app.classList.add('tauri-app');
    window.__TAURI__ = { convertFileSrc: function(s) { return s; } };
    window.__TAURI_INTERNALS__ = {};
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else { inject(); }
  new MutationObserver(function() {
    var app = document.getElementById('app');
    if (app && !app.classList.contains('tauri-app')) app.classList.add('tauri-app');
    if (!document.body.classList.contains('tauri-app')) document.body.classList.add('tauri-app');
  }).observe(document.body, { childList: true, subtree: true });
})();
"""

# All visual checks as JS — returns JSON array of results
VISUAL_CHECKS_JS = """
(function() {
  var results = [];

  function check(name, passed, details) {
    results.push({ name: name, passed: passed, details: details || '' });
  }

  // === 1. Sidebar width check ===
  var sidebar = document.querySelector('.sidebar, aside');
  if (sidebar) {
    var sRect = sidebar.getBoundingClientRect();
    check('sidebar-width', sRect.width >= 200,
      'width=' + Math.round(sRect.width) + 'px (expect >=200)');
  } else {
    check('sidebar-width', false, 'sidebar element not found');
  }

  // === 2. Nav item label visibility ===
  var navLabels = document.querySelectorAll('.nav-label');
  var visibleLabels = 0;
  navLabels.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width > 20) visibleLabels++;
  });
  check('nav-labels-visible', visibleLabels >= 3,
    visibleLabels + ' of ' + navLabels.length + ' labels wider than 20px');

  // === 3. Task card text not overlapped by action icons ===
  var overlaps = [];
  var taskItems = document.querySelectorAll('.inbox-task-card, .task-card, [class*="task-item"]');
  taskItems.forEach(function(card) {
    var title = card.querySelector('.task-title, .task-name, [class*="title"]');
    var actions = card.querySelector('.task-actions, .action-icons, [class*="actions"]');
    if (title && actions) {
      var tRect = title.getBoundingClientRect();
      var aRect = actions.getBoundingClientRect();
      // RTL: actions on left, title on right — check if actions.right > title.left
      // LTR: actions on right, title on left — check if actions.left < title.right
      var isRTL = getComputedStyle(card).direction === 'rtl';
      var overlap = isRTL
        ? (aRect.right > tRect.left + 5)
        : (aRect.left < tRect.right - 5);
      if (overlap && aRect.width > 0 && tRect.width > 0) {
        overlaps.push(title.textContent.trim().substring(0, 25));
      }
    }
  });
  check('task-text-no-overlap', overlaps.length === 0,
    overlaps.length > 0 ? 'Overlapping: ' + overlaps.join(', ') : taskItems.length + ' cards checked');

  // === 4. Done toggle icons have recognizable shape (not blobs) ===
  var doneToggles = document.querySelectorAll('.done-toggle, [class*="done-toggle"], [class*="check-circle"]');
  var toggleIssues = [];
  doneToggles.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    // Icon should be roughly square and between 14-32px
    if (rect.width < 12 || rect.width > 40 || rect.height < 12 || rect.height > 40) {
      toggleIssues.push('size=' + Math.round(rect.width) + 'x' + Math.round(rect.height));
    }
    // Check opacity — if too faded, icon is unclear
    var opacity = parseFloat(getComputedStyle(el).opacity);
    if (opacity < 0.3) {
      toggleIssues.push('opacity=' + opacity);
    }
  });
  check('done-toggle-visible', toggleIssues.length === 0,
    toggleIssues.length > 0 ? toggleIssues.join('; ') : doneToggles.length + ' toggles OK');

  // === 5. Popover/dropdown CSP check — create a style tag and verify it applies ===
  var testEl = document.createElement('div');
  testEl.id = '__csp_test__';
  testEl.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
  document.body.appendChild(testEl);
  var styleTag = document.createElement('style');
  styleTag.textContent = '#__csp_test__ { width: 42px !important; }';
  document.head.appendChild(styleTag);
  var testWidth = document.getElementById('__csp_test__').getBoundingClientRect().width;
  check('runtime-style-injection', Math.round(testWidth) === 42,
    'injected width=' + Math.round(testWidth) + ' (expect 42) — CSP blocks runtime styles if !=42');
  testEl.remove();
  styleTag.remove();

  // === 6. Grid layout — sidebar + main content don't overlap ===
  var mainContent = document.querySelector('.main-content, main');
  if (sidebar && mainContent) {
    var sEnd = sidebar.getBoundingClientRect().right;
    var mStart = mainContent.getBoundingClientRect().left;
    check('grid-no-overlap', mStart >= sEnd - 2,
      'sidebar.right=' + Math.round(sEnd) + ' main.left=' + Math.round(mStart));
  }

  // === 7. No elements with 0 width that should be visible ===
  var zeroWidthIssues = [];
  ['.inbox-title', '.section-title', '.project-name', '.nav-label-tooltip'].forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && el.textContent.trim().length > 0) {
        zeroWidthIssues.push(sel + ': "' + el.textContent.trim().substring(0, 20) + '"');
      }
    });
  });
  check('no-zero-width-text', zeroWidthIssues.length === 0,
    zeroWidthIssues.length > 0 ? zeroWidthIssues.join('; ') : 'all text elements have width');

  return JSON.stringify(results);
})()
"""

class WebKitTester:
    def __init__(self):
        self.results = []
        self.timeout_id = None

        self.win = Gtk.Window(title='WebKitGTK Test Runner')
        self.win.set_default_size(1400, 900)
        self.win.connect('destroy', Gtk.main_quit)

        content_manager = WebKit2.UserContentManager()
        script = WebKit2.UserScript(
            TAURI_PARITY_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START,
            None, None
        )
        content_manager.add_script(script)

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)

        self.webview = WebKit2.WebView.new_with_user_content_manager(content_manager)
        self.webview.set_settings(settings)
        self.webview.connect('load-changed', self.on_load_changed)
        self.webview.load_uri(URL)

        self.win.add(self.webview)
        self.win.show_all()

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            print('Page loaded. Waiting 6s for Vue hydration...', file=sys.stderr)
            GLib.timeout_add(6000, self.run_checks)

    def run_checks(self):
        print('Running visual checks...', file=sys.stderr)
        # Take screenshot first
        self.take_screenshot()
        # Run JS checks
        self.webview.evaluate_javascript(
            VISUAL_CHECKS_JS, -1, None, None, None, self.on_results, None
        )
        return False

    def take_screenshot(self):
        snapshot_path = os.path.join(SCREENSHOT_DIR, f'webkit-test-{int(time.time())}.png')
        try:
            self.webview.get_snapshot(
                WebKit2.SnapshotRegion.FULL_DOCUMENT,
                WebKit2.SnapshotOptions.NONE,
                None,
                self.on_screenshot,
                snapshot_path
            )
        except Exception as e:
            print(f'Screenshot error: {e}', file=sys.stderr)

    def on_screenshot(self, webview, result, path):
        try:
            surface = webview.get_snapshot_finish(result)
            surface.write_to_png(path)
            print(f'Screenshot: {path}', file=sys.stderr)
        except Exception as e:
            print(f'Screenshot save error: {e}', file=sys.stderr)

    def on_results(self, webview, result, user_data):
        try:
            js_result = webview.evaluate_javascript_finish(result)
            json_str = js_result.to_string()
            self.results = json.loads(json_str)
        except Exception as e:
            self.results = [{'name': 'js-execution', 'passed': False, 'details': str(e)}]

        # Print results
        passed = sum(1 for r in self.results if r['passed'])
        failed = sum(1 for r in self.results if not r['passed'])

        print(json.dumps({
            'summary': {'passed': passed, 'failed': failed, 'total': len(self.results)},
            'results': self.results
        }, indent=2))

        # Also print human-readable to stderr
        print(f'\n{"=" * 50}', file=sys.stderr)
        print(f'  WebKitGTK 4.1 Visual Regression Results', file=sys.stderr)
        print(f'  {passed} passed, {failed} failed', file=sys.stderr)
        print(f'{"=" * 50}', file=sys.stderr)
        for r in self.results:
            icon = '✅' if r['passed'] else '❌'
            print(f'  {icon} {r["name"]}: {r["details"]}', file=sys.stderr)
        print(f'{"=" * 50}\n', file=sys.stderr)

        # Exit after a short delay (let screenshot finish)
        GLib.timeout_add(1000, self.quit)

    def quit(self):
        Gtk.main_quit()
        sys.exit(0 if all(r['passed'] for r in self.results) else 1)
        return False

tester = WebKitTester()
# Safety timeout — quit after 30s regardless
GLib.timeout_add(30000, lambda: (print('TIMEOUT after 30s', file=sys.stderr), Gtk.main_quit(), sys.exit(2)))
Gtk.main()
