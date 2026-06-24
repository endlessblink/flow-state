#!/usr/bin/env bash
# One-time Android SDK setup for FlowState TASK-1883 (Android Gemma build proof).
# Installs the minimum components the android/ Gradle project needs:
#   compileSdk 35, build-tools 35.0.0, platform-tools (adb).
# JDK 21 (Temurin) is already present at the antigravity path below.
set -euo pipefail

SDK="$HOME/Android/Sdk"
JDK="$HOME/Android/jdk-21"
# Adoptium Temurin 21 full JDK (the antigravity bundle is a stripped JRE without jlink/jmods,
# which the Android JdkImageTransform requires).
JDK_URL="https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
PROJECT_DIR="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state"

# 0. Full JDK (with jlink) — required by the Android Gradle plugin's system-modules transform.
if [ ! -x "$JDK/bin/jlink" ]; then
  echo "==> Downloading full Temurin JDK 21 (need jlink for Android builds)..."
  mkdir -p "$JDK"
  curl -fSL -o /tmp/temurin21.tar.gz "$JDK_URL"
  tar -xzf /tmp/temurin21.tar.gz -C "$JDK" --strip-components=1
  rm -f /tmp/temurin21.tar.gz
else
  echo "==> Full JDK already present at $JDK"
fi

export JAVA_HOME="$JDK"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

echo "==> JDK: $($JAVA_HOME/bin/java -version 2>&1 | head -1)"
echo "==> jlink: $(command -v jlink || echo MISSING)"

# 1. Command-line tools
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "==> Downloading Android command-line tools..."
  mkdir -p "$SDK/cmdline-tools"
  cd "$SDK/cmdline-tools"
  curl -fSL -o cmdtools.zip "$CMDTOOLS_URL"
  unzip -q -o cmdtools.zip
  rm -rf latest && mv cmdline-tools latest
  rm -f cmdtools.zip
else
  echo "==> cmdline-tools already present"
fi

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"

# 2. Accept licenses
# Note: `yes |` exits non-zero on SIGPIPE; guard it so pipefail doesn't abort.
echo "==> Accepting SDK licenses..."
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null || true

# 3. Install required components
echo "==> Installing platform-tools, platforms;android-35, build-tools;35.0.0 ..."
"$SDKMANAGER" --sdk_root="$SDK" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0"

# 4. Write local.properties so Gradle finds the SDK
echo "sdk.dir=$SDK" > "$PROJECT_DIR/android/local.properties"
echo "==> Wrote $PROJECT_DIR/android/local.properties"

echo
echo "==> DONE. Verify with:"
echo "    $SDK/platform-tools/adb devices"
echo
echo "Then build with:"
echo "    export JAVA_HOME=$JDK"
echo "    export ANDROID_HOME=$SDK"
echo "    export PATH=\$JAVA_HOME/bin:\$PATH"
echo "    cd $PROJECT_DIR/android && ./gradlew :app:assembleDebug"
