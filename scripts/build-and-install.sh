#!/bin/bash
# Build and Install FlowState Tauri App
# Usage: npm run tauri:install

set -e

echo "🔨 Building FlowState Tauri App..."
echo "=================================="

# Kill any running instances first
echo "🔌 Stopping any running FlowState instances..."
npm run kill 2>/dev/null || true

# Sync Doppler secrets
echo "🔄 Syncing secrets from Doppler..."
bash scripts/sync-doppler.sh

# Build the Tauri app
echo "📦 Building Tauri app (this may take a few minutes)..."
npm run tauri build

# Find and install the built package
BUNDLE_DIR="src-tauri/target/release/bundle"

echo ""
echo "✅ Build complete! Installing..."
echo "=================================="

# Detect OS and install appropriate package
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - prefer .deb if available, otherwise AppImage
    DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" 2>/dev/null | head -1)
    APPIMAGE_FILE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" 2>/dev/null | head -1)

    if [[ -n "$DEB_FILE" ]]; then
        echo "📦 Installing .deb package: $DEB_FILE"
        sudo dpkg -i "$DEB_FILE"
        echo "✅ Installed! Run 'flowstate' or find it in your app menu."
    elif [[ -n "$APPIMAGE_FILE" ]]; then
        echo "📦 AppImage found: $APPIMAGE_FILE"
        chmod +x "$APPIMAGE_FILE"

        # Copy to ~/.local/bin for easy access
        mkdir -p ~/.local/bin
        cp "$APPIMAGE_FILE" ~/.local/bin/FlowState.AppImage
        echo "✅ Copied to ~/.local/bin/FlowState.AppImage"
        echo "   Run with: ~/.local/bin/FlowState.AppImage"
    else
        echo "❌ No installable package found in $BUNDLE_DIR"
        exit 1
    fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    DMG_FILE=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" 2>/dev/null | head -1)
    APP_FILE=$(find "$BUNDLE_DIR/macos" -name "*.app" 2>/dev/null | head -1)

    if [[ -n "$DMG_FILE" ]]; then
        echo "📦 Opening DMG: $DMG_FILE"
        open "$DMG_FILE"
        echo "✅ DMG opened. Drag FlowState to Applications folder."
    elif [[ -n "$APP_FILE" ]]; then
        echo "📦 Copying app to /Applications..."
        cp -R "$APP_FILE" /Applications/
        echo "✅ Installed to /Applications!"
    else
        echo "❌ No installable package found in $BUNDLE_DIR"
        exit 1
    fi

elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    MSI_FILE=$(find "$BUNDLE_DIR/msi" -name "*.msi" 2>/dev/null | head -1)
    EXE_FILE=$(find "$BUNDLE_DIR/nsis" -name "*.exe" 2>/dev/null | head -1)

    if [[ -n "$MSI_FILE" ]]; then
        echo "📦 Running MSI installer: $MSI_FILE"
        start "$MSI_FILE"
    elif [[ -n "$EXE_FILE" ]]; then
        echo "📦 Running EXE installer: $EXE_FILE"
        start "$EXE_FILE"
    else
        echo "❌ No installable package found in $BUNDLE_DIR"
        exit 1
    fi
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

echo ""
echo "🎉 FlowState installation complete!"
