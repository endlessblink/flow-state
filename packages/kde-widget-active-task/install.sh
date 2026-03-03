#!/bin/bash
# Install/symlink the KDE Plasma active task widget for development
# Run from the packages/kde-widget-active-task/ directory

set -e

TARGET="$HOME/.local/share/plasma/plasmoids/com.pomoflow.activetask"
SOURCE="$(cd "$(dirname "$0")" && pwd)"

if [ -L "$TARGET" ]; then
    echo "Removing existing symlink: $TARGET"
    rm "$TARGET"
elif [ -d "$TARGET" ]; then
    echo "Backing up existing widget to ${TARGET}.bak"
    mv "$TARGET" "${TARGET}.bak"
fi

ln -s "$SOURCE" "$TARGET"
echo "Symlinked $SOURCE -> $TARGET"
echo "Restart plasmashell to pick up changes: plasmashell --replace &"
