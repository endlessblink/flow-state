#!/usr/bin/env python3
"""FlowState OAuth Helper — Google Sign-In for KDE Widget.

Opens system browser for Google OAuth, captures tokens via localhost redirect.
Usage: python3 oauth-google.py <supabase_url> <supabase_anon_key>
Outputs JSON with access_token and refresh_token to stdout.
"""
import http.server
import json
import os
import sys
import threading
import urllib.parse
import webbrowser

SUPABASE_URL = sys.argv[1] if len(sys.argv) > 1 else ""
SUPABASE_KEY = sys.argv[2] if len(sys.argv) > 2 else ""
PORT = 24895
SESSION_DIR = os.path.expanduser("~/.config/flowstate")
SESSION_FILE = os.path.join(SESSION_DIR, "session.json")

# HTML page served at localhost — extracts tokens from URL hash fragment
# (Supabase implicit flow puts tokens in the hash, not query params)
CALLBACK_HTML = """<!DOCTYPE html>
<html>
<head><title>FlowState</title>
<style>
body { font-family: system-ui, sans-serif; text-align: center; margin-top: 80px;
       background: #1a1a2e; color: #e2e8f0; }
h2 { color: #4ECDC4; font-size: 24px; }
p { color: #7E7590; margin-top: 12px; }
.error { color: #EF4444; }
</style></head>
<body>
<h2 id="status">Authenticating...</h2>
<p id="detail"></p>
<script>
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const token = params.get('access_token');
const refresh = params.get('refresh_token');
if (token && refresh) {
  fetch('/capture', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({access_token: token, refresh_token: refresh})
  }).then(() => {
    document.getElementById('status').textContent = 'Signed in!';
    document.getElementById('status').style.color = '#22C55E';
    document.getElementById('detail').textContent = 'You can close this tab and return to the KDE widget.';
  }).catch(() => {
    document.getElementById('status').textContent = 'Failed to send tokens';
    document.getElementById('status').className = 'error';
  });
} else if (params.get('error')) {
  document.getElementById('status').textContent = 'Authentication failed';
  document.getElementById('status').className = 'error';
  document.getElementById('detail').textContent = params.get('error_description') || params.get('error');
} else {
  document.getElementById('status').textContent = 'No tokens received';
  document.getElementById('status').className = 'error';
  document.getElementById('detail').textContent = 'Hash: ' + (hash || '(empty)');
}
</script>
</body></html>
"""

captured_tokens = None


class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(CALLBACK_HTML.encode())

    def do_POST(self):
        global captured_tokens
        if '/capture' in self.path:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            captured_tokens = json.loads(body)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'OK')
            threading.Thread(target=lambda: self.server.shutdown(), daemon=True).start()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # Suppress HTTP request logs


if not SUPABASE_URL:
    print(json.dumps({"error": "No Supabase URL configured"}))
    sys.exit(1)

try:
    server = http.server.HTTPServer(('127.0.0.1', PORT), OAuthHandler)
except OSError as e:
    print(json.dumps({"error": f"Port {PORT} in use: {e}"}))
    sys.exit(1)

# Build OAuth URL — implicit flow (tokens in hash fragment)
redirect_to = urllib.parse.quote(f'http://127.0.0.1:{PORT}')
auth_url = f'{SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to={redirect_to}'

# Open system browser
webbrowser.open(auth_url)

# Serve until tokens captured or timeout
server.timeout = 120
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()

if captured_tokens:
    # Persist to session file for KDE widget auto-import
    os.makedirs(SESSION_DIR, exist_ok=True)
    captured_tokens['updated_at'] = __import__('datetime').datetime.now().isoformat()
    with open(SESSION_FILE, 'w') as f:
        json.dump(captured_tokens, f)
    # Output to stdout for KDE widget DataSource capture
    print(json.dumps(captured_tokens))
else:
    print(json.dumps({"error": "Authentication timed out or was cancelled"}))
    sys.exit(1)
