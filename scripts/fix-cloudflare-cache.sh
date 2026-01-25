#!/bin/bash
# Fix Cloudflare edge cache MIME type issue
# This adds Vary header to prevent preload scanner cache conflicts

VPS_HOST="84.46.253.137"
VPS_USER="root"

echo "=== Cloudflare Cache MIME Type Fix ==="
echo ""
echo "This script will:"
echo "  1. Add 'Vary: Accept-Encoding, Accept' header for /assets/*"
echo "  2. Add Cache-Control no-cache for index.html"
echo "  3. Reload Caddy"
echo ""
echo "After this, you'll need to purge Cloudflare cache manually."
echo ""

# The sed command to add the Vary header after the Cache-Control line for @static
SSH_COMMAND='
# Backup current config
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)

# Check if Vary header already exists for @static
if grep -q "header @static Vary" /etc/caddy/Caddyfile; then
    echo "Vary header already exists for @static"
else
    # Add Vary header after the Cache-Control line for @static
    sed -i "/header @static Cache-Control/a\    header @static Vary \"Accept-Encoding, Accept\"" /etc/caddy/Caddyfile
    echo "Added Vary header for @static"
fi

# Check if index.html Cache-Control exists
if grep -q "@html path /index.html" /etc/caddy/Caddyfile; then
    echo "index.html Cache-Control already exists"
else
    # Add index.html no-cache before try_files
    sed -i "/try_files {path} \/index.html/i\    @html path /index.html\n    header @html Cache-Control \"no-cache, no-store, must-revalidate\"\n" /etc/caddy/Caddyfile
    echo "Added Cache-Control for index.html"
fi

# Validate config
echo ""
echo "Validating Caddy config..."
caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
echo ""
echo "Reloading Caddy..."
systemctl reload caddy

echo ""
echo "=== Done ==="
echo "Current @static and @html config:"
grep -A1 "@static\|@html" /etc/caddy/Caddyfile
'

echo "Connecting to VPS..."
ssh ${VPS_USER}@${VPS_HOST} "$SSH_COMMAND"

echo ""
echo "=== Next Steps ==="
echo "1. Go to Cloudflare Dashboard → in-theflow.com → Caching → Configuration"
echo "2. Click 'Purge Everything' to clear edge cache"
echo "3. Wait 30 seconds, then hard refresh your browser (Ctrl+Shift+R)"
echo ""
echo "If issues persist, try 'Empty Cache and Hard Reload' (right-click reload button)"
