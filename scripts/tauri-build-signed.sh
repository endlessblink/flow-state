#!/bin/bash
# Tauri Build with Signing
# This script builds the Tauri app with automatic code signing.
# Usage: npm run tauri:build:signed

set -e

KEY_FILE="$HOME/.tauri/flow-state.key"

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
  echo "❌ Signing key not found at $KEY_FILE"
  echo ""
  echo "To generate a new key:"
  echo "  npx @tauri-apps/cli@2.8.0 signer generate --ci -w ~/.tauri/flow-state"
  echo ""
  echo "Then update the public key in src-tauri/tauri.conf.json"
  exit 1
fi

echo "🔐 Loading signing key from $KEY_FILE"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"

# Set signing password — passwordless keys need explicit empty string
# to prevent Tauri CLI from prompting via /dev/tty (fails in non-TTY)
if [ -n "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]; then
  echo "🔑 Using password from TAURI_SIGNING_PRIVATE_KEY_PASSWORD env var"
elif [ -n "${TAURI_SIGNING_KEY_PASSWORD:-}" ]; then
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$TAURI_SIGNING_KEY_PASSWORD"
  echo "🔑 Using password from TAURI_SIGNING_KEY_PASSWORD env var"
else
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
  echo "🔑 No password set — using passwordless key"
fi

echo "🔨 Building Tauri app..."
echo ""

# Run the build
npx tauri build

echo ""
echo "✅ Build complete!"
echo ""

# Check if signing succeeded
if ls src-tauri/target/release/bundle/appimage/*.tar.gz.sig 1>/dev/null 2>&1; then
  echo "✅ Signing successful!"
  echo ""
  echo "📦 Artifacts:"
  ls -la src-tauri/target/release/bundle/appimage/*.tar.gz*
  ls -la src-tauri/target/release/bundle/deb/*.deb
  echo ""
  echo "📋 Next steps:"
  echo "  1. Generate manifest: npm run tauri:update-manifest"
  echo "  2. Upload to VPS: npm run tauri:upload-update"
else
  echo "⚠️  Warning: No signature files found. Signing may have failed."
  echo "Check if TAURI_SIGNING_PRIVATE_KEY was set correctly."
fi
