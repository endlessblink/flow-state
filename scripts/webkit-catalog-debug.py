#!/usr/bin/env python3
"""
WebKitGTK 4.1 Catalog debug — reproduces BUG-1673 with real user auth.
Injects production auth session + Tauri CSS parity + navigates to /catalog.
"""
import sys
import os
import json
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'

# Auth session (generated via admin API)
AUTH_TOKEN = os.environ.get('AUTH_TOKEN', '')
REFRESH_TOKEN = os.environ.get('REFRESH_TOKEN', '')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://api.in-theflow.com')

# JS to inject: Tauri parity + auth + persisted state
INJECT_JS = """
(function() {
  // 1. Tauri CSS parity
  function addTauriClass() {
    document.body.classList.add('tauri-app');
    var app = document.getElementById('app');
    if (app) app.classList.add('tauri-app');
    window.__TAURI__ = { convertFileSrc: function(s) { return s; } };
    window.__TAURI_INTERNALS__ = {};
    console.log('[webkit-debug] .tauri-app class injected');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addTauriClass);
  } else {
    addTauriClass();
  }
  var observer = new MutationObserver(function() {
    var app = document.getElementById('app');
    if (app && !app.classList.contains('tauri-app')) app.classList.add('tauri-app');
    if (!document.body.classList.contains('tauri-app')) document.body.classList.add('tauri-app');
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // 2. Inject Supabase auth session into localStorage
  var supabaseUrl = '""" + SUPABASE_URL + """';
  var storageKey = 'sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token';
  var session = {
    access_token: '""" + AUTH_TOKEN + """',
    refresh_token: '""" + REFRESH_TOKEN + """',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: """ + str(int(__import__('time').time()) + 3600) + """,
    user: { id: '717f5209-42d8-4bb9-8781-740107a384e5', email: 'endlessblink@gmail.com' }
  };
  localStorage.setItem(storageKey, JSON.stringify(session));
  console.log('[webkit-debug] Auth injected: ' + storageKey);

  // 3. Set persisted filter state to TABLE mode (matching Tauri app state)
  localStorage.setItem('flowstate-catalog-view-mode', '"table"');
  // Don't set filters — let the app load its defaults to test clean state
  // Then we'll also test with the problematic 'all' filter
  console.log('[webkit-debug] Table mode set');

  // 4. Debug: log filteredTasks after a delay
  setTimeout(function() {
    try {
      var app = document.querySelector('#app').__vue_app__;
      var pinia = app.config.globalProperties.$pinia;
      var taskStore = pinia._s.get('tasks');
      var projectStore = pinia._s.get('projects');
      var uiStore = pinia._s.get('ui');
      console.log('[webkit-debug] Store state:', JSON.stringify({
        rawTasks: taskStore._rawTasks?.length,
        filteredTasks: taskStore.filteredTasks?.length,
        tasks: taskStore.tasks?.length,
        smartView: taskStore.activeSmartView,
        statusFilter: taskStore.activeStatusFilter,
        durationFilter: taskStore.activeDurationFilter,
        projectId: projectStore?.activeProjectId,
        selectedProjectIds: uiStore?.selectedProjectIds?.size,
        hideDone: taskStore.hideDoneTasks,
        projects: projectStore?.projects?.length,
      }));

      // Check table body
      var tableBody = document.querySelector('.table-body');
      if (tableBody) {
        console.log('[webkit-debug] .table-body children:', tableBody.children.length);
        console.log('[webkit-debug] .table-body innerHTML length:', tableBody.innerHTML.length);
      } else {
        console.log('[webkit-debug] No .table-body found');
        var taskList = document.querySelector('.task-list');
        console.log('[webkit-debug] .task-list found:', !!taskList);
      }
    } catch(e) {
      console.log('[webkit-debug] Error reading store:', e.message);
    }
  }, 6000);
})();
"""

class CatalogDebugBrowser:
    def __init__(self):
        self.win = Gtk.Window(title=f'BUG-1673 Debug — {URL}/#/catalog')
        self.win.set_default_size(1400, 900)
        self.win.connect('destroy', Gtk.main_quit)

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_write_console_messages_to_stdout(True)

        content_manager = WebKit2.UserContentManager()
        script = WebKit2.UserScript(
            INJECT_JS,
            WebKit2.UserContentInjectedFrames.ALL_FRAMES,
            WebKit2.UserScriptInjectionTime.START,
            None, None
        )
        content_manager.add_script(script)

        self.webview = WebKit2.WebView.new_with_user_content_manager(content_manager)
        self.webview.set_settings(settings)

        # Navigate to catalog directly
        self.webview.load_uri(f'{URL}/#/catalog')

        self.win.add(self.webview)
        self.win.show_all()

        print(f'🔍 BUG-1673 Debug: WebKitGTK 4.1 + auth + table mode')
        print(f'   URL: {URL}/#/catalog')
        print(f'   Watch console for [webkit-debug] messages')

browser = CatalogDebugBrowser()
Gtk.main()
