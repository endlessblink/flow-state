#!/usr/bin/env python3
"""
WebKitGTK 4.1 automated inspector — runs JS to check computed styles.
Same engine as Tauri's wry (libwebkit2gtk-4.1).

Usage:
  python3 scripts/webkit-inspect.py [port]
"""
import sys
import json
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 6366
URL = f'http://localhost:{PORT}'

INSPECT_JS = """
(function() {
  const results = {};

  function getStyles(selector, label) {
    const el = document.querySelector(selector);
    if (!el) return { found: false, selector };
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      selector,
      label,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      computedWidth: cs.width,
      computedMinWidth: cs.minWidth,
      computedMaxWidth: cs.maxWidth,
      display: cs.display,
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      contain: cs.contain,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
      position: cs.position,
      gridTemplateColumns: cs.gridTemplateColumns || 'N/A',
    };
  }

  results['appLayout'] = getStyles('.app-layout', 'Grid Container');
  results['sidebar'] = getStyles('.sidebar, .app-sidebar, aside', 'Sidebar');
  results['taskMgmt'] = getStyles('.task-management-section', 'Task Management Section');
  results['projectsList'] = getStyles('.projects-list', 'Projects List');

  // Get all nav items
  const navItems = document.querySelectorAll('.base-nav-item, .nav-item');
  results['navItemCount'] = navItems.length;
  if (navItems.length > 0) {
    const first = navItems[0];
    const cs = getComputedStyle(first);
    const rect = first.getBoundingClientRect();
    results['firstNavItem'] = {
      found: true,
      label: 'First Nav Item',
      text: first.textContent.trim().substring(0, 30),
      width: rect.width,
      height: rect.height,
      x: rect.x,
      display: cs.display,
      computedWidth: cs.width,
      boxSizing: cs.boxSizing,
    };
  }

  // Check OverflowTooltip container
  const tooltipContainer = document.querySelector('.overflow-tooltip-container');
  if (tooltipContainer) {
    const cs = getComputedStyle(tooltipContainer);
    const rect = tooltipContainer.getBoundingClientRect();
    results['overflowTooltip'] = {
      found: true,
      label: 'OverflowTooltip Container',
      width: rect.width,
      display: cs.display,
      computedWidth: cs.width,
    };
  }

  // Check nav-label
  const navLabel = document.querySelector('.nav-label');
  if (navLabel) {
    const cs = getComputedStyle(navLabel);
    const rect = navLabel.getBoundingClientRect();
    results['navLabel'] = {
      found: true,
      label: 'Nav Label',
      text: navLabel.textContent.trim().substring(0, 30),
      width: rect.width,
      display: cs.display,
      computedWidth: cs.width,
    };
  }

  return JSON.stringify(results, null, 2);
})()
"""

class Inspector:
    def __init__(self):
        self.win = Gtk.Window(title=f'WebKitGTK 4.1 Inspector — {URL}')
        self.win.set_default_size(1400, 900)
        self.win.connect('destroy', Gtk.main_quit)

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(True)

        self.webview = WebKit2.WebView()
        self.webview.set_settings(settings)
        self.webview.connect('load-changed', self.on_load_changed)
        self.webview.load_uri(URL)

        self.win.add(self.webview)
        self.win.show_all()

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            # Wait 5s for Vue app to mount and hydrate
            print(f'📄 Page loaded. Waiting 5s for Vue hydration...')
            GLib.timeout_add(5000, self.run_inspection)

    def run_inspection(self):
        print(f'🔍 Running CSS inspection on WebKitGTK 4.1...\n')
        self.webview.evaluate_javascript(
            INSPECT_JS, -1, None, None, None, self.on_js_result, None
        )
        return False  # don't repeat

    def on_js_result(self, webview, result, user_data):
        try:
            js_result = webview.evaluate_javascript_finish(result)
            json_str = js_result.to_string()
            data = json.loads(json_str)

            print('=' * 60)
            print('  WebKitGTK 4.1 Sidebar CSS Inspection')
            print('=' * 60)

            for key, val in data.items():
                if isinstance(val, dict) and val.get('found'):
                    print(f'\n📐 {val.get("label", key)}')
                    print(f'   Selector: {val.get("selector", "N/A")}')
                    if 'text' in val:
                        print(f'   Text: "{val["text"]}"')
                    print(f'   Width: {val.get("width", "?")}px (computed: {val.get("computedWidth", "?")})')
                    if 'height' in val:
                        print(f'   Height: {val.get("height", "?")}px')
                    if 'x' in val:
                        print(f'   Position: x={val.get("x", "?")}, y={val.get("y", "?")}')
                    for prop in ['display', 'overflow', 'overflowX', 'contain', 'backdropFilter', 'gridTemplateColumns', 'boxSizing']:
                        if prop in val and val[prop] and val[prop] != 'N/A':
                            print(f'   {prop}: {val[prop]}')
                elif isinstance(val, dict) and not val.get('found'):
                    print(f'\n❌ {val.get("selector", key)} — NOT FOUND')
                elif key == 'navItemCount':
                    print(f'\n📊 Total nav items found: {val}')

            print('\n' + '=' * 60)
            print('  Inspection complete. Window stays open for manual testing.')
            print('  Right-click → Inspect Element for DevTools.')
            print('=' * 60)

        except Exception as e:
            print(f'❌ JS execution error: {e}')

inspector = Inspector()
Gtk.main()
