#!/bin/bash
# FEATURE-1345: Build and optionally sign FlowState Android APK/AAB via Capacitor
#
# Usage:
#   ./scripts/build-capacitor-android.sh              # Debug build
#   ./scripts/build-capacitor-android.sh --release     # Signed release build
#   ./scripts/build-capacitor-android.sh --aab         # Signed AAB (for Play Store)
#
# Prerequisites:
#   - Java 17+ (sudo apt install openjdk-17-jdk)
#   - Android SDK (ANDROID_HOME set, or ~/Android/Sdk)
#   - For release: keystore at ~/.android/flowstate-release.keystore
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Parse args
BUILD_TYPE="debug"
BUILD_FORMAT="apk"
for arg in "$@"; do
  case $arg in
    --release) BUILD_TYPE="release" ;;
    --aab) BUILD_TYPE="release"; BUILD_FORMAT="aab" ;;
    --help|-h)
      echo "Usage: $0 [--release] [--aab]"
      echo "  --release  Build signed release APK"
      echo "  --aab      Build signed release AAB (for Play Store upload)"
      exit 0
      ;;
  esac
done

echo "================================================"
echo "  FlowState Android Build (Capacitor)"
echo "  Type: $BUILD_TYPE | Format: $BUILD_FORMAT"
echo "================================================"

# Step 1: Check prerequisites
echo ""
echo "[1/5] Checking prerequisites..."

if ! command -v java &> /dev/null; then
  echo "ERROR: Java not found. Install with: sudo apt install openjdk-17-jdk"
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "  Java version: $JAVA_VERSION"

# Find Android SDK
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  if [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
    export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
  else
    echo "ERROR: Android SDK not found. Set ANDROID_HOME or install Android Studio."
    echo "  Quick install: https://developer.android.com/studio/command-line"
    exit 1
  fi
fi
echo "  Android SDK: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

# Step 2: Build Vue frontend
echo ""
echo "[2/5] Building Vue frontend for Capacitor..."
CAPACITOR_PLATFORM=android npm run build

# Step 3: Sync to Android project
echo ""
echo "[3/5] Syncing to Android project..."
npx cap sync android

# Step 4: Build Android
echo ""
echo "[4/5] Building Android $BUILD_FORMAT ($BUILD_TYPE)..."
cd android

if [ "$BUILD_TYPE" = "release" ]; then
  # Check for keystore
  KEYSTORE="${ANDROID_KEYSTORE_PATH:-$HOME/.android/flowstate-release.keystore}"
  if [ ! -f "$KEYSTORE" ]; then
    echo "ERROR: Release keystore not found at $KEYSTORE"
    echo "Generate with:"
    echo "  keytool -genkey -v -keystore $KEYSTORE \\"
    echo "    -alias flowstate -keyalg RSA -keysize 2048 -validity 10000"
    exit 1
  fi

  if [ "$BUILD_FORMAT" = "aab" ]; then
    ./gradlew bundleRelease
    OUTPUT="app/build/outputs/bundle/release/app-release.aab"
  else
    ./gradlew assembleRelease
    OUTPUT="app/build/outputs/apk/release/app-release.apk"
  fi
else
  ./gradlew assembleDebug
  OUTPUT="app/build/outputs/apk/debug/app-debug.apk"
fi

cd "$PROJECT_DIR"

# Step 5: Report
echo ""
echo "[5/5] Build complete!"
echo "================================================"

if [ -f "android/$OUTPUT" ]; then
  SIZE=$(du -h "android/$OUTPUT" | cut -f1)
  echo "  Output: android/$OUTPUT"
  echo "  Size:   $SIZE"
  echo ""

  if [ "$BUILD_TYPE" = "debug" ]; then
    echo "To install on connected device:"
    echo "  adb install android/$OUTPUT"
  else
    echo "To install release APK:"
    echo "  adb install android/$OUTPUT"
    echo ""
    echo "To upload to Play Store (AAB):"
    echo "  Upload android/$OUTPUT via Google Play Console"
  fi
else
  echo "WARNING: Expected output not found at android/$OUTPUT"
  echo "Check build logs above for errors."
  exit 1
fi

echo "================================================"
