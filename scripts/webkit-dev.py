#!/usr/bin/env python3
"""
WebKitGTK 4.1 dev browser — same engine as Tauri's wry (libwebkit2gtk-4.1).
Injects .tauri-app class for full Tauri CSS parity.

Usage:
  npx vite --port 6366 &          # start Vite
  python3 scripts/webkit-dev.py   # opens WebKitGTK with Tauri parity
"""
import sys
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'

# JS to inject .tauri-app class + set Tauri environment flags
TAURI_PARITY_JS = """
(function() {
  // Add .tauri-app class to #app and body (same as real Tauri)
  function addTauriClass() {
    document.body.classList.add('tauri-app');
    var app = document.getElementById('app');
    if (app) app.classList.add('tauri-app');
    // Also set window.__TAURI__ to trick isTauri() checks
    window.__TAURI__ = { convertFileSrc: function(s) { return s; } };
    window.__TAURI_INTERNALS__ = {};
    console.log('[webkit-dev] .tauri-app class injected — Tauri CSS parity active');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addTauriClass);
  } else {
    addTauriClass();
  }
  // Re-apply after Vue mounts (Vue may replace #app contents)
  var observer = new MutationObserver(function() {
    var app = document.getElementById('app');
    if (app && !app.classList.contains('tauri-app')) {
      app.classList.add('tauri-app');
    }
    if (!document.body.classList.contains('tauri-app')) {
      document.body.classList.add('tauri-app');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
"""

class TauriDevBrowser:
    def __init__(self):
        self.win = Gtk.Window(title=f'WebKitGTK 4.1 (Tauri Parity) — {URL}')
        self.win.set_default_size(1400, 900)
        self.win.connect('destroy', Gtk.main_quit)

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_write_console_messages_to_stdout(True)

        # Create user content manager to inject JS early
        content_manager = WebKit2.UserContentManager()
        script = WebKit2.UserScript(
            TAURI_PARITY_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START,
            None, None
        )
        content_manager.add_script(script)

        self.webview = WebKit2.WebView.new_with_user_content_manager(content_manager)
        self.webview.set_settings(settings)
        self.webview.load_uri(URL)

        self.win.add(self.webview)
        self.win.show_all()

        print(f'🔍 WebKitGTK 4.1 (Tauri Parity) loaded: {URL}')
        print(f'   .tauri-app class auto-injected')
        print(f'   Right-click → Inspect Element for DevTools')
        print(f'   CSS changes auto-reload via Vite HMR')

browser = TauriDevBrowser()
Gtk.main()
