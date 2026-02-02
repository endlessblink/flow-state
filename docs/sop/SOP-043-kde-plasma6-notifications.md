# SOP-043: KDE Plasma 6 Widget Notifications

**Created:** 2026-02-02
**Related:** BUG-1112, TASK-1009

## Overview

How to implement system notifications with action buttons from KDE Plasma 6 widgets (plasmoids) that can trigger Supabase API calls.

## Key Insight: Plasma 6 API Change

**CRITICAL:** In Plasma 6, `DataSource` for executing shell commands moved from `org.kde.plasma.core` to `org.kde.plasma.plasma5support`.

```qml
// ❌ WRONG - Plasma 5 style (doesn't work in Plasma 6)
import org.kde.plasma.core as PlasmaCore
PlasmaCore.DataSource { engine: "executable" }

// ✅ CORRECT - Plasma 6 style
import org.kde.plasma.plasma5support as Plasma5Support
Plasma5Support.DataSource { engine: "executable" }
```

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│   QML Widget    │────▶│   notify.sh       │────▶│  Supabase   │
│ (main.qml)      │     │ (bash script)     │     │  REST API   │
└─────────────────┘     └───────────────────┘     └─────────────┘
         │                       │
         │                       ├── Play sound (paplay)
         │                       ├── Show notification (notify-send)
         │                       └── Handle button clicks → API call
         │
         └── Passes: title, body, buttons, auth credentials
```

## Implementation

### 1. QML: Static DataSource for Shell Commands

```qml
import org.kde.plasma.plasma5support as Plasma5Support

PlasmoidItem {
    // Static DataSource - more reliable than Qt.createQmlObject
    Plasma5Support.DataSource {
        id: executableDataSource
        engine: "executable"
        connectedSources: []
        onNewData: function(sourceName, data) {
            console.log("[EXEC] Command completed:", sourceName)
            disconnectSource(sourceName)
        }
    }

    function showNotification() {
        var cmd = '/path/to/notify.sh "Title" "Body" "Button1" "Button2"'
        executableDataSource.connectSource(cmd)
    }
}
```

### 2. Bash Script: Notification with Functional Buttons

```bash
#!/bin/bash
TITLE="$1"
BODY="$2"
BTN1="$3"
BTN2="$4"
SUPABASE_URL="$5"
ACCESS_TOKEN="$6"
# ... more params

# Play sound (non-blocking)
paplay /usr/share/sounds/freedesktop/stereo/bell.oga &

# Handle notification and button clicks in background
(
    # notify-send --action blocks until user clicks
    ACTION=$(notify-send -u critical -i chronometer -a "AppName" \
        --action="action1=$BTN1" \
        --action="action2=$BTN2" \
        "$TITLE" "$BODY" 2>/dev/null)

    case "$ACTION" in
        "action1")
            # Call Supabase API
            curl -X POST "${SUPABASE_URL}/rest/v1/table" \
                -H "Authorization: Bearer ${ACCESS_TOKEN}" \
                -d '{"key": "value"}'
            ;;
        "action2")
            # Different action
            ;;
    esac
) &

exit 0
```

### 3. Passing Auth Credentials

The QML function must pass all needed credentials to the script:

```qml
function showTimerNotification(wasWorkSession) {
    var cmd = '/path/to/notify.sh "' +
        title + '" "' + body + '" "' + btn1 + '" "' + btn2 + '" "' +
        root.supabaseUrl + '" "' + root.supabaseKey + '" "' +
        root.accessToken + '" "' + root.userId + '"'
    executableDataSource.connectSource(cmd)
}
```

## Common Pitfalls

| Issue | Cause | Solution |
|-------|-------|----------|
| Commands don't execute | Using `PlasmaCore.DataSource` | Use `Plasma5Support.DataSource` |
| `~` path not expanding | QML doesn't expand shell shortcuts | Use full absolute paths |
| notify-send blocks | `--action` waits for click | Run in background with `() &` |
| No buttons on notification | Using kdialog or wrong syntax | Use `notify-send --action="name=Label"` |
| Sound loops | Multiple DataSource connections | Use single script for sound + notification |

## File Locations

| File | Purpose |
|------|---------|
| `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml` | Widget QML code |
| `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/scripts/notify.sh` | Notification script |

## Testing

1. **Test script directly:**
   ```bash
   ./notify.sh "Test Title" "Test Body" "Button1" "Button2" "true"
   ```

2. **Check plasmashell logs:**
   ```bash
   journalctl --user -u plasma-plasmashell -f | grep -i pomoflow
   ```

3. **Restart plasmashell after QML changes:**
   ```bash
   plasmashell --replace &
   ```

## Related Documentation

- [Plasma 5 Support Module](https://api.kde.org/frameworks/plasma-framework/html/namespaceorg_1_1kde_1_1plasma_1_1plasma5support.html)
- [KDE Plasma 6 Migration Guide](https://develop.kde.org/docs/plasma/scripting/api/)
