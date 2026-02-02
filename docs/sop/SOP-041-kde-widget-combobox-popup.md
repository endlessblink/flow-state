# SOP-041: KDE Plasma 6 Widget ComboBox Popup Handling

**Created**: 2026-02-02
**Related Bug**: BUG-1121
**Status**: Active

## Problem

When using `QQC2.ComboBox` (Qt Quick Controls 2) in KDE Plasma 6 widgets, dropdown popups get clipped by parent container boundaries. Users see only some options while others are cut off.

### Symptoms
- Dropdown opens but only shows partial list (e.g., 2 of 4 items)
- Items at top or bottom of list are invisible
- Popup appears to be clipped at widget boundary

### Root Cause

In Plasma widgets, the `fullRepresentation` is not a top-level window. Qt Quick Controls 2 Popups (used internally by `QQC2.ComboBox`) have issues with positioning when not in a top-level window context:

1. The Popup's parent chain doesn't escape the widget's visual boundaries
2. `QQC2.Overlay.overlay` is not available in Plasma widget context
3. Reparenting to `root` (PlasmoidItem) breaks coordinate calculations

## Solution

Use `PlasmaComponents.ComboBox` instead of `QQC2.ComboBox`. PlasmaComponents3 is specifically designed for Plasma widgets and handles popup positioning correctly.

### Before (Broken)
```qml
import QtQuick.Controls as QQC2

QQC2.ComboBox {
    id: myCombo
    model: ["Option 1", "Option 2", "Option 3", "Option 4"]
    // Custom popup with parent: QQC2.Overlay.overlay crashes
    // Custom popup with parent: root doesn't open
}
```

### After (Working)
```qml
import org.kde.plasma.components as PlasmaComponents

PlasmaComponents.ComboBox {
    id: myCombo
    model: ["Option 1", "Option 2", "Option 3", "Option 4"]

    // Custom styling still works!
    background: Rectangle {
        radius: 6
        color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
        border.width: 1
        border.color: myCombo.hovered ? Qt.rgba(1, 1, 1, 0.15) : Qt.rgba(1, 1, 1, 0.10)
    }

    contentItem: Text {
        leftPadding: 8
        text: myCombo.displayText
        font.pixelSize: 11
        color: "#E2E8F0"
        verticalAlignment: Text.AlignVCenter
    }

    indicator: Text {
        x: myCombo.width - width - 6
        y: (myCombo.height - height) / 2
        text: "▾"
        font.pixelSize: 10
        color: "#7E7590"
    }
}
```

## Key Points

1. **Always use `PlasmaComponents.ComboBox`** for dropdowns in Plasma widgets
2. **Custom styling is still possible** - `background`, `contentItem`, `indicator` properties work
3. **Do NOT customize the `popup` property** - let PlasmaComponents handle it
4. **Do NOT use `QQC2.Overlay.overlay`** - it causes crashes in Plasma widget context

## Imports Required

```qml
import org.kde.plasma.components as PlasmaComponents
```

This is typically already imported in Plasma widgets alongside:
```qml
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.kirigami as Kirigami
```

## References

- [PlasmaComponents3 ComboBox Source](https://invent.kde.org/frameworks/plasma-framework/-/blob/master/src/declarativeimports/plasmacomponents3/ComboBox.qml)
- [Plasma QML API Documentation](https://develop.kde.org/docs/plasma/widget/plasma-qml-api/)
- [Plasma Widget Tutorial](https://zren.github.io/kde/docs/widget/)

## Testing

After making changes:
1. Restart plasmashell: `kquitapp6 plasmashell && kstart plasmashell`
2. Open widget popup
3. Click dropdown - verify ALL options are visible
4. Select different options - verify selection works
