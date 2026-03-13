import QtQuick
import QtQuick.Layouts
import QtQuick.Window
import QtQuick.Controls as QQC2
import QtCore
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.plasma.components as PlasmaComponents
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    // Note: hideOnWindowDeactivate requires Plasma 6.5.5+
    // For older versions, we rely on the full-screen overlay instead

    // ===== COLORS (matching main app design tokens) =====
    readonly property color workColor: "#4ECDC4"      // Teal - matches AppHeader.vue
    readonly property color breakColor: "#F59E0B"     // Orange/Amber - matches AppHeader.vue
    readonly property color bgColor: "#232034"        // Purple-tinted: rgb(35, 32, 52) = --surface-primary
    readonly property color textColor: "#E2E8F0"
    readonly property color mutedColor: "#7E7590"     // Purple-tinted muted: hsl(250, 15%, 50%)
    readonly property color currentAccent: isWorkSession ? workColor : breakColor

    // ===== AUTHENTICATION STATE =====
    property string accessToken: ""
    property string refreshToken: ""
    property string userId: ""  // User ID for RLS
    property int tokenExpiresIn: 3600
    property bool isAuthenticating: false
    property bool isRefreshingToken: false  // Prevent multiple refresh attempts
    property real refreshTokenStartTime: 0  // Epoch ms when refresh started (for stuck detection)
    property string authError: ""
    readonly property bool isAuthenticated: accessToken !== ""

    // ===== TIMER STATE =====
    property string currentSessionId: ""
    property string currentTaskId: ""  // TASK-1087: Track active task for highlighting
    // TASK-1435: Resolve currentTaskId to task title for companion widget
    readonly property string currentTaskName: {
        if (!currentTaskId || currentTaskId === "general") return ""
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === currentTaskId) return tasks[i].title || ""
        }
        return ""
    }
    property bool hasActiveSession: false
    property int totalSeconds: plasmoid.configuration.workDuration * 60
    property int secondsRemaining: totalSeconds
    property bool isRunning: false
    property bool isWorkSession: true
    property int completedSessions: 0
    readonly property int maxSessions: plasmoid.configuration.sessionsBeforeLongBreak

    // Device leadership - only leader runs local countdown and sends heartbeats
    property bool isDeviceLeader: false

    // ===== SESSION COMPLETE STATE =====
    property bool sessionJustCompleted: false      // True when session ends, waiting for user action
    property bool lastCompletedWasWork: true       // Track what type of session just completed
    property real transitionUntil: 0               // BUG-1292: Epoch ms - fast-poll until this time (self-expiring)

    // ===== TASK STATE =====
    property var tasks: []
    property var nannyAllTasks: []  // BUG-1498: unfiltered non-done tasks for nanny popup
    property bool isLoadingTasks: false
    property string errorMessage: ""

    // ===== PINNED TASKS STATE =====
    property var pinnedTasks: []
    property bool isLoadingPinnedTasks: false

    // ===== NANNY POPUP TASK LIST (TASK-1475) =====
    // Combined list: pinned tasks first, then recent non-pinned tasks (up to 5 total)
    property var nannyTaskList: []
    property var nannyHiddenToday: ({})   // taskId -> true, reset daily
    property int nannyHiddenDate: 0       // day-of-year when hidden list was set

    // ===== PROJECT STATE (TASK-1454) =====
    property var projects: ({})          // Map of project_id -> {name, color, colorType}
    property bool isLoadingProjects: false

    // ===== TASK SORT/FILTER STATE =====
    // Sort options: "created_desc", "created_asc", "title_asc", "priority_desc", "canvas_order", "project"
    property string taskSortBy: "created_desc"
    // Filter options: "all", "todo", "in_progress", "today", "on_canvas"
    property string taskFilter: "all"
    property bool todayOnly: false
    property string taskSearchQuery: ""
    property var displayTasks: []

    onTaskSearchQueryChanged: updateDisplayTasks()

    // ===== QUICK-ADD DUE DATE (TASK-1447) =====
    property string quickAddDueDate: ""

    // ===== INLINE EDIT STATE (TASK-1429) =====
    property string editingTaskId: ""
    property bool isSavingEdit: false
    property string editError: ""
    property bool confirmingDelete: false

    // ===== NANNY (FOCUS REMINDER) STATE (TASK-1424) =====
    property bool nannyQuietToday: false
    property var nannyLastNotifyTime: 0        // epoch ms of last nanny notification
    property var nannyLastSessionEndTime: 0    // epoch ms when last session ended (or auth init)
    property int nannyQuietDate: -1            // day-of-year when quiet was set (for midnight reset)
    // nannyActionFile removed — nanny actions now handled directly in nannyPopup QML

    // Message banks
    readonly property var nannyGentleMessages: [
        "Ready for a focus session?",
        "A good time to start a Pomodoro?",
        "Your next session is waiting for you",
        "How about a quick focus sprint?",
        "Time to plant a tomato?"
    ]
    readonly property var nannyDirectMessages: [
        "No active session — time to focus",
        "Start a Pomodoro to get in the zone",
        "You've been idle — ready to work?",
        "Focus time: start your next session",
        "Break's over — let's go!"
    ]

    // ===== DEBUG FLAG =====
    readonly property bool debugLogging: false  // Set true to enable verbose console.log

    // ===== COMPUTED =====
    readonly property int minutes: Math.floor(secondsRemaining / 60)
    readonly property int seconds: secondsRemaining % 60
    readonly property string timeDisplay: String(minutes).padStart(2, '0') + ":" + String(seconds).padStart(2, '0')
    readonly property real progress: totalSeconds > 0 ? (1 - (secondsRemaining / totalSeconds)) : 0

    // BUG-1347: Reactive transition flag (replaces impure Date.now() in binding)
    property bool isInTransition: false

    // Pre-end warning: reset each session to prevent repeat warnings
    property bool preEndWarningShown: false
    property bool checkingCompletion: false

    // ===== SUPABASE CONFIG (hardcoded for PomoFlow) =====
    readonly property string supabaseUrl: plasmoid.configuration.supabaseUrl || "http://127.0.0.1:54321"
    readonly property string supabaseKey: plasmoid.configuration.supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODMzMzkxMjR9.quujL-cYcPusBhirDQFq9p-iTN0hRwjY2GLx6XUtYDg"

    // ===== BUG-1112: STATIC DATASOURCE FOR SHELL COMMANDS (Plasma 6) =====
    // In Plasma 6, DataSource moved to org.kde.plasma.plasma5support
    // Using a static DataSource is more reliable than Qt.createQmlObject
    Plasma5Support.DataSource {
        id: executableDataSource
        engine: "executable"
        connectedSources: []
        onNewData: function(sourceName, data) {
            console.log("[EXEC] Command completed:", sourceName)
            disconnectSource(sourceName)
        }
    }

    // ===== FEATURE-1202: GOOGLE OAUTH VIA HELPER SCRIPT =====
    // Separate DataSource to capture OAuth script stdout (JSON with tokens)
    Plasma5Support.DataSource {
        id: oauthDataSource
        engine: "executable"
        connectedSources: []
        onNewData: function(sourceName, data) {
            var stdout = data["stdout"] || ""
            console.log("[OAUTH] Script output:", stdout.substring(0, 200))
            disconnectSource(sourceName)

            if (stdout.trim()) {
                try {
                    var result = JSON.parse(stdout.trim())
                    if (result.access_token && result.refresh_token) {
                        root.accessToken = result.access_token
                        root.refreshToken = result.refresh_token
                        root.userId = result.user_id || ""
                        root.saveAuthTokens("Google")
                        root.authError = ""
                        root.isAuthenticating = false
                        tokenRefreshTimer.restart()
                        // Immediately refresh token to get user_id if missing
                        if (!root.userId) {
                            root.refreshAccessToken()
                        } else {
                            root.fetchCurrentSession()
                            root.fetchTasks()
                            root.fetchPinnedTasks()
                            root.fetchProjects()
                            root.fetchNannyTasks()
                        }
                        console.log("[OAUTH] Google sign-in successful")
                    } else if (result.error) {
                        root.authError = result.error
                        root.isAuthenticating = false
                        console.log("[OAUTH] Error:", result.error)
                    }
                } catch (e) {
                    root.authError = "Failed to parse OAuth response"
                    root.isAuthenticating = false
                    console.log("[OAUTH] Parse error:", e)
                }
            } else {
                root.authError = "No response from OAuth script"
                root.isAuthenticating = false
            }
        }
    }

    // ===== TASK-1009: TIMER COMPLETION NOTIFICATION =====
    // BUG-1112: KDE system notification with FUNCTIONAL action buttons + sound
    // THIS IS THE ONLY NOTIFICATION - no in-widget popup, no overlay
    // Buttons call Supabase API to start next session
    // BUG-1462: Dismiss any pending system notification (notify-send) to prevent duplicate actions
    function dismissSystemNotification() {
        var cmd = "pkill -f 'notify-send.*FlowState' 2>/dev/null; true"
        executableDataSource.connectSource(cmd)
        console.log("[NOTIFY] Dismissed pending system notifications")
    }

    function showTimerNotification(wasWorkSession) {
        var title = wasWorkSession ? "Work session complete!" : "Break is over!"
        var body = wasWorkSession ? "Ready for a break?" : "Ready to focus?"
        var btn1 = wasWorkSession ? "Break" : "Work"
        var isWork = wasWorkSession ? "true" : "false"
        var workDuration = plasmoid.configuration.workDuration * 60
        var breakDuration = plasmoid.configuration.breakDuration * 60

        console.log("[NOTIFY] showTimerNotification called, wasWorkSession:", wasWorkSession)

        // Use the static Plasma5Support.DataSource to run the notification script
        // Pass all params needed for functional buttons
        var scriptDir = Qt.resolvedUrl("../scripts/").toString().replace("file://", "")
        var cmd = scriptDir + 'notify.sh "' +
            title + '" "' + body + '" "' + btn1 + '" "+5 min" "' + isWork + '" "' +
            root.supabaseUrl + '" "' + root.supabaseKey + '" "' + root.accessToken + '" "' +
            root.userId + '" "' + workDuration + '" "' + breakDuration + '"'
        executableDataSource.connectSource(cmd)
        console.log("[NOTIFY] Running notify script:", cmd)
    }

    // ===== TASK-1424: NANNY NOTIFICATION (rich QML popup) =====
    function sendNannyNotification() {
        var tone = plasmoid.configuration.nannyTone || "gentle"
        var messages = tone === "direct" ? root.nannyDirectMessages : root.nannyGentleMessages
        var msg = messages[Math.floor(Math.random() * messages.length)]

        // BUG-1498: Fetch fresh unfiltered tasks, THEN build list and show popup
        root.fetchNannyTasks(function() {
            root.buildNannyTaskList()
            console.log("[NANNY] Showing popup:", msg, "with", root.nannyTaskList.length, "tasks (pinned + recent)")

            // Position on the same screen as the widget
            var sg = root.getWidgetScreenGeometry()
            if (sg.screen) nannyPopup.screen = sg.screen
            nannyPopup.x = sg.x + sg.width - nannyPopup.width - 24
            nannyPopup.y = sg.y + sg.height - nannyPopup.height - 24

            nannyPopup.nannyMessage = msg
            nannyPopup.visible = true
            nannyPopup.raise()
            nannyPopup.requestActivate()

            root.nannyLastNotifyTime = Date.now()
        })
    }

    // TASK-1424: Start a new work session with a specific task
    function startNewSessionWithTask(taskId) {
        if (!root.isAuthenticated) return

        // Reset pre-end warning for new session
        root.preEndWarningShown = false

        root.sessionJustCompleted = false
        var sessionId = generateUUID()
        var duration = plasmoid.configuration.workDuration * 60

        var payload = {
            id: sessionId,
            user_id: root.userId,
            task_id: taskId || "general",
            start_time: new Date().toISOString(),
            duration: duration,
            remaining_time: duration,
            is_active: true,
            is_paused: false,
            is_break: false,
            device_leader_id: "kde-widget",
            device_leader_last_seen: new Date().toISOString()
        }

        console.log("[TIMER] Creating new session for task:", taskId || "general")

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/timer_sessions", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 201 || xhr.status === 200) {
                    root.currentSessionId = sessionId
                    root.currentTaskId = taskId || ""
                    root.totalSeconds = duration
                    root.secondsRemaining = duration
                    root.isRunning = true
                    root.isWorkSession = true
                    root.hasActiveSession = true
                    root.isDeviceLeader = true
                    console.log("[NANNY] Started session:", sessionId, "for task:", taskId)
                } else {
                    console.error("[NANNY] Failed to create session:", xhr.status, xhr.responseText)
                }
            }
        }
        xhr.send(JSON.stringify(payload))
    }

    // ===== TASK-1423: OPEN FLOWSTATE APP =====
    function openApp() {
        var mode = plasmoid.configuration.openAppMode || "web"

        if (mode === "tauri") {
            var appPath = plasmoid.configuration.tauriAppPath || ""
            var cmd
            if (appPath) {
                // Use configured path
                cmd = 'bash -c \'"' + appPath + '" &\''
            } else {
                // Auto-detect: PATH binary (.deb) → AppImage → gtk-launch → web fallback
                var webFallbackUrl = plasmoid.configuration.appUrl || "http://localhost:5546"
                cmd = 'bash -c \'if command -v flow-state >/dev/null 2>&1; then nohup flow-state >/dev/null 2>&1 & elif APP=$(find ~/Applications ~/.local/bin -maxdepth 1 \\( -name "FlowState*.AppImage" -o -name "flow-state*.AppImage" \\) 2>/dev/null | head -1) && [ -n "$APP" ]; then nohup "$APP" >/dev/null 2>&1 & else gtk-launch FlowState 2>/dev/null || xdg-open "' + webFallbackUrl + '"; fi\''
            }
            executableDataSource.connectSource(cmd)
            console.log("[OPEN-APP] Launching Tauri app")
        } else {
            var url = plasmoid.configuration.appUrl || "http://localhost:5546"
            Qt.openUrlExternally(url)
            console.log("[OPEN-APP] Opening web app:", url)
        }
    }

    // ===== TASK-1429: OPEN APP TO SPECIFIC TASK =====
    function openAppToTask(taskId) {
        var mode = plasmoid.configuration.openAppMode || "web"
        var baseUrl = plasmoid.configuration.appUrl || "http://localhost:5546"
        var deepLink = baseUrl + "/#/?editTask=" + taskId

        if (mode === "tauri") {
            // Launch Tauri app - same pattern as openApp()
            // AppImages don't accept URL args, so launch app normally
            var appPath = plasmoid.configuration.tauriAppPath || ""
            var cmd
            if (appPath) {
                cmd = 'bash -c \'"' + appPath + '" &\''
            } else {
                cmd = 'bash -c \'if command -v flow-state >/dev/null 2>&1; then nohup flow-state >/dev/null 2>&1 & elif APP=$(find ~/Applications ~/.local/bin -maxdepth 1 \\( -name "FlowState*.AppImage" -o -name "flow-state*.AppImage" \\) 2>/dev/null | head -1) && [ -n "$APP" ]; then nohup "$APP" >/dev/null 2>&1 & else gtk-launch FlowState 2>/dev/null || xdg-open "' + deepLink + '"; fi\''
            }
            executableDataSource.connectSource(cmd)
            console.log("[OPEN-APP] Launching Tauri app for task:", taskId)
        } else {
            Qt.openUrlExternally(deepLink)
            console.log("[OPEN-APP] Opening web app with deep link:", deepLink)
        }
    }

    // TASK-1435: Write active task state for companion widget
    function writeActiveTaskFile() {
        // Resolve task name inline (more reliable than QML binding)
        var resolvedName = ""
        if (root.currentTaskId && root.currentTaskId !== "general") {
            for (var i = 0; i < root.tasks.length; i++) {
                if (root.tasks[i].id === root.currentTaskId) {
                    resolvedName = root.tasks[i].title || ""
                    break
                }
            }
        }
        var obj = {
            taskName: resolvedName,
            taskId: root.currentTaskId,
            isActive: root.hasActiveSession && root.isRunning,
            isWork: root.isWorkSession,
            timeDisplay: root.timeDisplay,
            progress: root.progress,
            timestamp: Date.now()
        }
        var json = JSON.stringify(obj)
        var escaped = json.replace(/'/g, "'\\''")
        var cmd = "printf '%s' '" + escaped + "' > /tmp/flowstate-active-task.json"
        executableDataSource.connectSource(cmd)
    }

    // ===== FULL-SCREEN BREAK OVERLAY (Fokus-style) =====
    // Using standard Window for Plasma 6 compatibility
    Window {
        id: fullScreenOverlay
        flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint
        color: "transparent"
        visible: false

        // x/y/width/height set programmatically in showFullScreenOverlay() to target widget's screen

        // Semi-transparent dark background
        Rectangle {
            anchors.fill: parent
            color: Qt.rgba(0, 0, 0, 0.85)

            // Click anywhere on background to dismiss
            MouseArea {
                anchors.fill: parent
                onClicked: {
                    fullScreenOverlay.visible = false
                    root.sessionJustCompleted = false
                    root.dismissSystemNotification()
                }
            }

            // Main content card
            Rectangle {
                anchors.centerIn: parent
                width: 450
                height: 400
                radius: 24
                color: Qt.rgba(root.bgColor.r, root.bgColor.g, root.bgColor.b, 0.98)
                border.width: 3
                border.color: root.lastCompletedWasWork ? root.breakColor : root.workColor

                // Glow effect
                Rectangle {
                    anchors.fill: parent
                    anchors.margins: -12
                    radius: 36
                    color: "transparent"
                    border.width: 6
                    border.color: Qt.rgba(
                        root.lastCompletedWasWork ? root.breakColor.r : root.workColor.r,
                        root.lastCompletedWasWork ? root.breakColor.g : root.workColor.g,
                        root.lastCompletedWasWork ? root.breakColor.b : root.workColor.b,
                        0.4
                    )
                    z: -1
                }

                // Stop click propagation on card
                MouseArea {
                    anchors.fill: parent
                    onClicked: {
                        fullScreenOverlay.visible = false
                        root.sessionJustCompleted = false
                        root.dismissSystemNotification()
                    }
                }

                ColumnLayout {
                    anchors.centerIn: parent
                    spacing: 28

                    // Icon — styled emoji container (matches Storybook FullScreenOverlay)
                    Rectangle {
                        Layout.preferredWidth: 72
                        Layout.preferredHeight: 72
                        Layout.alignment: Qt.AlignHCenter
                        radius: 16
                        gradient: Gradient {
                            GradientStop { position: 0.0; color: Qt.rgba(
                                root.lastCompletedWasWork ? root.breakColor.r : root.workColor.r,
                                root.lastCompletedWasWork ? root.breakColor.g : root.workColor.g,
                                root.lastCompletedWasWork ? root.breakColor.b : root.workColor.b,
                                0.27
                            ) }
                            GradientStop { position: 1.0; color: Qt.rgba(
                                root.lastCompletedWasWork ? root.breakColor.r : root.workColor.r,
                                root.lastCompletedWasWork ? root.breakColor.g : root.workColor.g,
                                root.lastCompletedWasWork ? root.breakColor.b : root.workColor.b,
                                0.13
                            ) }
                        }
                        border.width: 2
                        border.color: Qt.rgba(
                            root.lastCompletedWasWork ? root.breakColor.r : root.workColor.r,
                            root.lastCompletedWasWork ? root.breakColor.g : root.workColor.g,
                            root.lastCompletedWasWork ? root.breakColor.b : root.workColor.b,
                            0.4
                        )

                        Text {
                            anchors.centerIn: parent
                            text: root.lastCompletedWasWork ? "🛌" : "⏱"
                            font.pixelSize: 36
                        }
                    }

                    // Title
                    Text {
                        text: root.lastCompletedWasWork ? "Time for a break!" : "Break's over!"
                        font.pixelSize: 32
                        font.bold: true
                        color: root.textColor
                        Layout.alignment: Qt.AlignHCenter
                    }

                    // Subtitle
                    Text {
                        text: root.lastCompletedWasWork
                            ? "You've earned some rest. Step away from the screen."
                            : "Ready to get back to work?"
                        font.pixelSize: 16
                        color: root.mutedColor
                        Layout.alignment: Qt.AlignHCenter
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        Layout.preferredWidth: 350
                    }

                    Item { Layout.preferredHeight: 20 }

                    // Action buttons
                    Row {
                        Layout.alignment: Qt.AlignHCenter
                        spacing: 20

                        // Primary action: Start Break / Start Work
                        Rectangle {
                            width: 160
                            height: 52
                            radius: 14
                            color: Qt.rgba(
                                root.lastCompletedWasWork ? root.breakColor.r : root.workColor.r,
                                root.lastCompletedWasWork ? root.breakColor.g : root.workColor.g,
                                root.lastCompletedWasWork ? root.breakColor.b : root.workColor.b,
                                0.15
                            )
                            border.width: 2
                            border.color: root.lastCompletedWasWork ? root.breakColor : root.workColor

                            Text {
                                anchors.centerIn: parent
                                text: root.lastCompletedWasWork ? "☕ Start Break" : "🍅 Start Work"
                                font.pixelSize: 18
                                font.bold: true
                                color: root.lastCompletedWasWork ? root.breakColor : root.workColor
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    fullScreenOverlay.visible = false
                                    root.sessionJustCompleted = false
                                    root.dismissSystemNotification()
                                    root.startNewSession(root.lastCompletedWasWork)
                                }
                            }
                        }

                        // Secondary action: Postpone
                        Rectangle {
                            width: 140
                            height: 52
                            radius: 14
                            color: "transparent"
                            border.width: 2
                            border.color: root.mutedColor

                            Text {
                                anchors.centerIn: parent
                                text: "⏰ +5 min"
                                font.pixelSize: 18
                                color: root.textColor
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    fullScreenOverlay.visible = false
                                    root.sessionJustCompleted = false
                                    root.dismissSystemNotification()
                                    root.postponeTimer(5 * 60)
                                }
                            }
                        }
                    }

                    // Dismiss link
                    Text {
                        text: "Press anywhere to dismiss"
                        font.pixelSize: 13
                        color: root.mutedColor
                        Layout.alignment: Qt.AlignHCenter
                        opacity: 0.6
                    }
                }
            }
        }
    }

    // ===== NANNY POPUP (TASK-1424: Rich focus reminder) =====
    Window {
        id: nannyPopup
        flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
        color: "transparent"
        visible: false

        width: 500
        // Dynamic height: base (title+subtitle+buttons+dismiss+margins=250) + task/header rows
        height: 250 + nannyListHeight()

        function nannyListHeight() {
            var headers = 0
            var tasks = 0
            for (var i = 0; i < root.nannyTaskList.length; i++) {
                if (root.nannyTaskList[i].isHeader) headers++
                else tasks++
                // Cap at ~15 visible task rows (headers don't count toward cap)
                if (tasks >= 15) break
            }
            return headers * 32 + tasks * 56
        }
        // x/y set programmatically in sendNannyNotification() to target widget's screen

        property string nannyMessage: ""

        // Auto-dismiss after 60 seconds
        Timer {
            id: nannyAutoDismiss
            interval: 60000
            running: nannyPopup.visible
            onTriggered: nannyPopup.visible = false
        }

        Rectangle {
            anchors.fill: parent
            color: "transparent"

            // Click anywhere on background to dismiss
            MouseArea {
                anchors.fill: parent
                onClicked: nannyPopup.visible = false
            }

            // Glass card
            Rectangle {
                anchors.fill: parent
                anchors.margins: 10
                radius: 20
                color: Qt.rgba(root.bgColor.r, root.bgColor.g, root.bgColor.b, 0.95)
                border.width: 2
                border.color: root.workColor

                // Glow effect
                Rectangle {
                    anchors.fill: parent
                    anchors.margins: -8
                    radius: 28
                    color: "transparent"
                    border.width: 4
                    border.color: Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.4)
                    z: -1
                }

                // Click anywhere on card to dismiss
                MouseArea {
                    anchors.fill: parent
                    onClicked: nannyPopup.visible = false
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 24
                    spacing: 14

                    // Title with tomato icon
                    Text {
                        text: "\uD83C\uDF45  " + nannyPopup.nannyMessage
                        font.pixelSize: 20
                        font.bold: true
                        color: root.textColor
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    // Subtitle
                    Text {
                        text: root.nannyTaskList.length > 0 ? "Pick a task to start" : "Start a Pomodoro to get in the zone"
                        font.pixelSize: 14
                        color: root.mutedColor
                        Layout.fillWidth: true
                    }

                    // Task list — TASK-1475: pinned + recent tasks combined with details
                    // Flickable makes the list scrollable when tasks exceed available space
                    Flickable {
                        visible: root.nannyTaskList.length > 0
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        contentHeight: nannyTaskColumn.height
                        clip: true
                        flickableDirection: Flickable.VerticalFlick

                    Column {
                        id: nannyTaskColumn
                        width: parent.width
                        spacing: 4

                        Repeater {
                            model: root.nannyTaskList.length

                            delegate: Item {
                                width: parent ? parent.width : 0
                                height: root.nannyTaskList[index] && root.nannyTaskList[index].isHeader ? nannyProjectHeader.height : nannyTaskRow.height

                                property var itemData: root.nannyTaskList[index]

                                // ===== Project Section Header =====
                                Rectangle {
                                    id: nannyProjectHeader
                                    visible: itemData && itemData.isHeader === true
                                    width: parent.width
                                    height: 28
                                    color: "transparent"

                                    Row {
                                        anchors.verticalCenter: parent.verticalCenter
                                        anchors.left: parent.left
                                        anchors.leftMargin: 8
                                        anchors.right: parent.right
                                        anchors.rightMargin: 8
                                        spacing: 6

                                        Rectangle {
                                            width: 8
                                            height: 8
                                            radius: 4
                                            anchors.verticalCenter: parent.verticalCenter
                                            color: {
                                                var c = (itemData && itemData.projectColor) ? itemData.projectColor : ""
                                                if (c && c.charAt(0) === '#') return c
                                                if (c) return "#" + c
                                                return root.mutedColor
                                            }
                                        }

                                        Text {
                                            text: (itemData && itemData.projectName) ? itemData.projectName : ""
                                            font.pixelSize: 11
                                            font.bold: true
                                            color: root.textColor
                                            anchors.verticalCenter: parent.verticalCenter
                                        }

                                        Item {
                                            width: nannyProjectHeader.width - parent.children[0].width - parent.children[1].implicitWidth - parent.spacing * 2 - 16
                                            height: 1
                                            anchors.verticalCenter: parent.verticalCenter
                                            Rectangle {
                                                width: parent.width
                                                height: 1
                                                color: Qt.rgba(1, 1, 1, 0.08)
                                            }
                                        }
                                    }
                                }

                                // ===== Task Row =====
                                Rectangle {
                                    id: nannyTaskRow
                                    visible: !itemData || itemData.isHeader !== true
                                    width: parent.width
                                    height: 52
                                    radius: 10
                                    color: nannyTaskMouse.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.15) : "transparent"

                                    property var taskData: itemData

                                // X button to hide for today (visible on hover) — anchored to LEFT (RTL layout)
                                Rectangle {
                                    id: hideBtn
                                    width: 22
                                    height: 22
                                    radius: 11
                                    z: 2
                                    anchors.left: parent.left
                                    anchors.leftMargin: 6
                                    anchors.verticalCenter: parent.verticalCenter
                                    visible: nannyTaskMouse.containsMouse
                                    color: hideBtnMouse.containsMouse ? Qt.rgba(1, 0.4, 0.4, 0.3) : Qt.rgba(1, 1, 1, 0.1)

                                    Text {
                                        anchors.centerIn: parent
                                        text: "\u2715"
                                        font.pixelSize: 11
                                        color: hideBtnMouse.containsMouse ? "#FF6B6B" : root.mutedColor
                                    }

                                    MouseArea {
                                        id: hideBtnMouse
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: {
                                            var item = root.nannyTaskList[index]
                                            root.hideNannyTask(item.isPinned ? item.pinId : item.taskId)
                                        }
                                    }
                                }

                                // Play button — anchored to LEFT after X button area
                                Text {
                                    id: playIcon
                                    anchors.left: parent.left
                                    anchors.leftMargin: 32
                                    anchors.verticalCenter: parent.verticalCenter
                                    font.pixelSize: 16
                                    text: "\u25B6"
                                    color: root.workColor
                                }

                                // Title + details — anchored to RIGHT (RTL natural reading)
                                Column {
                                    anchors.right: parent.right
                                    anchors.rightMargin: 12
                                    anchors.left: playIcon.right
                                    anchors.leftMargin: 8
                                    anchors.verticalCenter: parent.verticalCenter
                                    spacing: 2

                                    // Title with pin/tomato icon — right-aligned, clipped
                                    Text {
                                        text: ((nannyTaskRow.taskData && nannyTaskRow.taskData.title) ? nannyTaskRow.taskData.title : "") + ((nannyTaskRow.taskData && nannyTaskRow.taskData.isPinned) ? " \uD83D\uDCCC" : " \uD83C\uDF45")
                                        font.pixelSize: 13
                                        color: root.textColor
                                        elide: Text.ElideLeft
                                        clip: true
                                        width: parent.width
                                        horizontalAlignment: Text.AlignRight
                                    }

                                    // Details row: priority | due date — right-aligned (project shown in header now)
                                    Row {
                                        anchors.right: parent.right
                                        spacing: 8
                                        layoutDirection: Qt.RightToLeft
                                        visible: nannyTaskRow.taskData && (nannyTaskRow.taskData.priorityLabel !== "" || nannyTaskRow.taskData.dueDate !== "")

                                        Text {
                                            text: (nannyTaskRow.taskData && nannyTaskRow.taskData.priorityLabel) ? nannyTaskRow.taskData.priorityLabel : ""
                                            font.pixelSize: 10
                                            font.bold: true
                                            color: (nannyTaskRow.taskData && nannyTaskRow.taskData.priorityColor) ? nannyTaskRow.taskData.priorityColor : root.mutedColor
                                            visible: text !== ""
                                        }

                                        Text {
                                            text: {
                                                if (!nannyTaskRow.taskData || !nannyTaskRow.taskData.dueDate) return ""
                                                var d = new Date(nannyTaskRow.taskData.dueDate)
                                                if (isNaN(d.getTime())) return ""
                                                var now = new Date()
                                                var isToday = d.toDateString() === now.toDateString()
                                                var tomorrow = new Date(now)
                                                tomorrow.setDate(tomorrow.getDate() + 1)
                                                var isTomorrow = d.toDateString() === tomorrow.toDateString()
                                                if (isToday) return "Today \uD83D\uDCC5"
                                                if (isTomorrow) return "Tomorrow \uD83D\uDCC5"
                                                return (d.getDate()) + "/" + (d.getMonth() + 1) + " \uD83D\uDCC5"
                                            }
                                            font.pixelSize: 10
                                            color: {
                                                if (!nannyTaskRow.taskData || !nannyTaskRow.taskData.dueDate) return root.mutedColor
                                                var d = new Date(nannyTaskRow.taskData.dueDate)
                                                var now = new Date()
                                                if (d < now && d.toDateString() !== now.toDateString()) return "#FF6B6B"
                                                if (d.toDateString() === now.toDateString()) return root.workColor
                                                return root.mutedColor
                                            }
                                            visible: text !== ""
                                        }
                                    }
                                }

                                MouseArea {
                                    id: nannyTaskMouse
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    hoverEnabled: true
                                    onClicked: {
                                        // Don't fire if X button was clicked
                                        if (hideBtnMouse.containsMouse) return
                                        var item = root.nannyTaskList[index]
                                        if (item.isPinned) {
                                            root.selectPinnedTask(item)
                                        } else {
                                            if (root.hasActiveSession && root.isRunning) {
                                                if (root.currentTaskId !== item.taskId) {
                                                    root.switchTaskForSession(item.taskId)
                                                }
                                            } else {
                                                root.startSessionForTask(item.taskId)
                                            }
                                        }
                                        nannyPopup.visible = false
                                    }
                                }
                                }
                            }
                        }
                    } // Column
                    } // Flickable

                    // Push buttons to bottom
                    Item { Layout.fillHeight: true }

                    // Bottom buttons
                    Row {
                        Layout.alignment: Qt.AlignHCenter
                        spacing: 12

                        // "Open Widget" button - glass style
                        Rectangle {
                            width: 140
                            height: 42
                            radius: 12
                            color: "transparent"
                            border.width: 1.5
                            border.color: root.workColor

                            Text {
                                anchors.centerIn: parent
                                text: "\uD83D\uDCCB Open Widget"
                                font.pixelSize: 14
                                color: root.workColor
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    nannyPopup.visible = false
                                    root.expanded = true
                                }
                            }
                        }

                        // "Snooze 1hr" button - muted style
                        Rectangle {
                            width: 130
                            height: 42
                            radius: 12
                            color: "transparent"
                            border.width: 1.5
                            border.color: root.mutedColor

                            Text {
                                anchors.centerIn: parent
                                text: "\u23F0 Snooze 1hr"
                                font.pixelSize: 14
                                color: root.textColor
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    nannyPopup.visible = false
                                    root.nannyLastNotifyTime = Date.now()
                                    root.nannyLastSessionEndTime = Date.now()
                                    console.log("[NANNY] Snoozed for 1 hour")
                                }
                            }
                        }

                        // "Stop today" button - muted style
                        Rectangle {
                            width: 130
                            height: 42
                            radius: 12
                            color: "transparent"
                            border.width: 1.5
                            border.color: root.mutedColor

                            Text {
                                anchors.centerIn: parent
                                text: "\uD83D\uDD07 Stop today"
                                font.pixelSize: 14
                                color: root.textColor
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    nannyPopup.visible = false
                                    root.nannyQuietToday = true
                                    var today = new Date()
                                    root.nannyQuietDate = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
                                    console.log("[NANNY] Stopped for today via popup")
                                }
                            }
                        }
                    }

                    // Dismiss hint
                    Text {
                        text: "click anywhere to dismiss"
                        font.pixelSize: 12
                        color: root.mutedColor
                        Layout.alignment: Qt.AlignHCenter
                        opacity: 0.5
                    }
                }

                // Escape key handler
                Keys.onEscapePressed: nannyPopup.visible = false
            }
        }
    }

    // ===== PRE-END WARNING POPUP =====
    Window {
        id: preEndWarningPopup
        flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
        color: "transparent"
        visible: false

        width: 360
        height: 160
        // x/y set programmatically in showPreEndWarning()

        // Auto-dismiss after 15 seconds
        Timer {
            id: preEndWarningDismiss
            interval: 15000
            running: preEndWarningPopup.visible
            onTriggered: preEndWarningPopup.visible = false
        }

        Rectangle {
            anchors.fill: parent
            color: "transparent"

            MouseArea {
                anchors.fill: parent
                onClicked: preEndWarningPopup.visible = false
            }

            // Glass card
            Rectangle {
                anchors.fill: parent
                anchors.margins: 10
                radius: 16
                color: Qt.rgba(root.bgColor.r, root.bgColor.g, root.bgColor.b, 0.95)
                border.width: 2
                border.color: root.currentAccent

                // Glow effect
                Rectangle {
                    anchors.fill: parent
                    anchors.margins: -6
                    radius: 22
                    color: "transparent"
                    border.width: 3
                    border.color: Qt.rgba(root.currentAccent.r, root.currentAccent.g, root.currentAccent.b, 0.3)
                    z: -1
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: preEndWarningPopup.visible = false
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 16

                    // Timer icon
                    Text {
                        text: root.isWorkSession ? "\u23F0" : "\u2615"
                        font.pixelSize: 36
                        Layout.alignment: Qt.AlignVCenter
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 6

                        Text {
                            text: root.isWorkSession ? "Almost done!" : "Break ending soon!"
                            font.pixelSize: 18
                            font.bold: true
                            color: root.textColor
                        }

                        Text {
                            property int secs: plasmoid.configuration.preEndWarningSeconds || 60
                            text: secs >= 60 ? Math.floor(secs / 60) + " minute" + (Math.floor(secs / 60) > 1 ? "s" : "") + " left" : secs + " seconds left"
                            font.pixelSize: 14
                            color: root.mutedColor
                        }

                        Text {
                            text: root.isWorkSession ? "Wrap up your current task" : "Get ready to focus"
                            font.pixelSize: 13
                            color: root.mutedColor
                            opacity: 0.7
                        }
                    }
                }
            }
        }
    }

    // Show pre-end warning notification on widget's screen
    function showPreEndWarning() {
        console.log("[TIMER] Showing pre-end warning")
        var sg = root.getWidgetScreenGeometry()
        if (sg.screen) preEndWarningPopup.screen = sg.screen
        preEndWarningPopup.x = sg.x + sg.width - preEndWarningPopup.width - 24
        preEndWarningPopup.y = sg.y + sg.height - preEndWarningPopup.height - 24
        preEndWarningPopup.visible = true
        preEndWarningPopup.raise()
        preEndWarningPopup.requestActivate()
    }

    // Function to show the full-screen overlay
    function showFullScreenOverlay() {
        console.log("[OVERLAY] showFullScreenOverlay called, config:", plasmoid.configuration.showFullscreenBreak)
        if (plasmoid.configuration.showFullscreenBreak !== false) {
            // Position on the same screen as the widget
            var sg = root.getWidgetScreenGeometry()
            if (sg.screen) fullScreenOverlay.screen = sg.screen
            fullScreenOverlay.x = sg.x
            fullScreenOverlay.y = sg.y
            fullScreenOverlay.width = sg.width
            fullScreenOverlay.height = sg.height
            console.log("[OVERLAY] Showing full-screen overlay on screen:", sg.x, sg.y, sg.width, "x", sg.height)
            fullScreenOverlay.visible = true
            fullScreenOverlay.raise()
            fullScreenOverlay.requestActivate()
        }
    }

    function getWidgetScreenGeometry() {
        // Method 1: Window.window (panel window → correct screen)
        var w = Window.window
        if (w && w.screen) {
            var geom = w.screen.availableGeometry
            console.log("[NANNY] Screen from panel window:", w.screen.name,
                        "geom:", geom.x, geom.y, geom.width, geom.height)
            return { x: geom.x, y: geom.y, width: geom.width, height: geom.height, screen: w.screen }
        }
        // Fallback: Screen attached property (per-screen, NOT virtual desktop)
        console.log("[NANNY] Screen fallback: virtualX=", Screen.virtualX, "virtualY=", Screen.virtualY,
                    "w=", Screen.width, "h=", Screen.height)
        return { x: Screen.virtualX, y: Screen.virtualY, width: Screen.width, height: Screen.height, screen: null }
    }

    // ===== COMPACT REPRESENTATION (TASKBAR) =====
    compactRepresentation: MouseArea {
        id: compactRoot

        // Size for circular progress in panel
        Layout.fillHeight: true
        Layout.preferredWidth: compactRoot.height > 0 ? compactRoot.height : 36
        Layout.minimumWidth: 36

        hoverEnabled: true
        property bool wasExpanded: false
        onPressed: wasExpanded = root.expanded
        onClicked: root.expanded = !wasExpanded

        // Circular progress background
        Canvas {
            id: compactCanvas
            anchors.fill: parent

            onPaint: {
                var ctx = getContext("2d")
                var centerX = width / 2
                var centerY = height / 2
                // 3px inset for glow room, scale stroke with widget size
                var radius = Math.min(width, height) / 2 - 3
                var lineWidth = Math.max(2, Math.round(Math.min(width, height) / 12))

                ctx.reset()

                // Background circle
                ctx.beginPath()
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                ctx.strokeStyle = root.mutedColor
                ctx.globalAlpha = 0.3
                ctx.lineWidth = lineWidth
                ctx.stroke()

                // Progress arc with glow
                if (root.hasActiveSession && root.progress > 0) {
                    // Glow layer
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * root.progress))
                    ctx.strokeStyle = root.currentAccent
                    ctx.globalAlpha = 1.0
                    ctx.lineWidth = lineWidth
                    ctx.lineCap = "round"
                    ctx.shadowColor = root.currentAccent
                    ctx.shadowBlur = 4
                    ctx.shadowOffsetX = 0
                    ctx.shadowOffsetY = 0
                    ctx.stroke()

                    // Bright center stroke (no shadow)
                    ctx.shadowBlur = 0
                    ctx.lineWidth = lineWidth - 1
                    ctx.stroke()
                }

                // Center fill when active
                if (root.hasActiveSession) {
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, radius - lineWidth, 0, 2 * Math.PI)
                    ctx.fillStyle = root.currentAccent
                    ctx.globalAlpha = 0.15
                    ctx.fill()
                }
            }

            // BUG-1347: Throttled repaint to avoid per-second shadow blur recomputation
            Timer {
                id: compactRepaintTimer
                interval: 250
                running: false
                repeat: false
                onTriggered: compactCanvas.requestPaint()
            }

            Connections {
                target: root
                function onProgressChanged() { compactRepaintTimer.restart() }
                function onIsWorkSessionChanged() { compactCanvas.requestPaint() }
                function onHasActiveSessionChanged() { compactCanvas.requestPaint() }
            }

            Component.onCompleted: requestPaint()
        }

        // Center text (minutes remaining or icon)
        Text {
            anchors.centerIn: parent
            text: root.hasActiveSession ? root.minutes.toString() : ""
            font.pixelSize: Math.max(8, Math.round(parent.height * 0.25))
            font.bold: true
            color: root.hasActiveSession ? root.currentAccent : Kirigami.Theme.textColor
            visible: root.hasActiveSession
        }

        // Tomato icon when no session
        Image {
            anchors.centerIn: parent
            width: parent.width * 0.6
            height: parent.height * 0.6
            source: "../icons/tomato.svg"
            visible: !root.hasActiveSession
            smooth: true
        }
    }

    // ===== FULL REPRESENTATION (POPUP) =====
    fullRepresentation: Rectangle {
        Layout.minimumWidth: 440
        Layout.minimumHeight: root.isAuthenticated ? 750 : 320
        Layout.preferredWidth: 480
        Layout.preferredHeight: root.isAuthenticated ? 850 : 350

        color: root.bgColor
        radius: 12

        // ===== LOGIN VIEW (Not authenticated) =====
        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 20
            spacing: 12
            visible: !root.isAuthenticated

            Image {
                source: "../icons/tomato.svg"
                Layout.preferredWidth: 40
                Layout.preferredHeight: 40
                Layout.alignment: Qt.AlignHCenter
                smooth: true
            }

            Text {
                text: "PomoFlow"
                font.pixelSize: 18
                font.weight: Font.Bold
                color: root.textColor
                Layout.alignment: Qt.AlignHCenter
            }

            Text {
                text: "Sign in to sync your tasks and timer"
                font.pixelSize: 11
                color: root.mutedColor
                Layout.alignment: Qt.AlignHCenter
            }

            Item { Layout.preferredHeight: 8 }

            // Email field
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2

                Text {
                    text: "Email"
                    font.pixelSize: 10
                    color: root.mutedColor
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 32
                    radius: 6
                    color: Qt.rgba(0.22, 0.20, 0.35, 0.4)      // Purple-tinted input bg
                    border.width: 1
                    border.color: Qt.rgba(0.22, 0.20, 0.35, 0.6)  // Purple-tinted border

                    TextInput {
                        id: loginEmailField
                        anchors.fill: parent
                        anchors.margins: 8
                        color: root.textColor
                        font.pixelSize: 12
                        clip: true
                        selectByMouse: true
                        activeFocusOnTab: true
                        KeyNavigation.tab: loginPasswordField

                        Keys.onReturnPressed: loginPasswordField.forceActiveFocus()
                        Keys.onEnterPressed: loginPasswordField.forceActiveFocus()

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            text: "your@email.com"
                            color: root.mutedColor
                            font.pixelSize: 12
                            visible: !parent.text && !parent.activeFocus
                        }
                    }
                }
            }

            // Password field
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2

                Text {
                    text: "Password"
                    font.pixelSize: 10
                    color: root.mutedColor
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 32
                    radius: 6
                    color: Qt.rgba(0.22, 0.20, 0.35, 0.4)      // Purple-tinted input bg
                    border.width: 1
                    border.color: Qt.rgba(0.22, 0.20, 0.35, 0.6)  // Purple-tinted border

                    TextInput {
                        id: loginPasswordField
                        anchors.fill: parent
                        anchors.margins: 8
                        color: root.textColor
                        font.pixelSize: 12
                        clip: true
                        echoMode: TextInput.Password
                        selectByMouse: true
                        activeFocusOnTab: true
                        KeyNavigation.backtab: loginEmailField

                        // Enter key submits the form
                        Keys.onReturnPressed: {
                            if (loginEmailField.text && loginPasswordField.text) {
                                root.signIn(loginEmailField.text, loginPasswordField.text)
                                loginPasswordField.text = ""
                            }
                        }
                        Keys.onEnterPressed: {
                            if (loginEmailField.text && loginPasswordField.text) {
                                root.signIn(loginEmailField.text, loginPasswordField.text)
                                loginPasswordField.text = ""
                            }
                        }

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            text: "Enter password"
                            color: root.mutedColor
                            font.pixelSize: 12
                            visible: !parent.text && !parent.activeFocus
                        }
                    }
                }
            }

            // Error message
            Text {
                text: root.authError
                font.pixelSize: 10
                color: "#EF4444"
                visible: root.authError !== ""
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
            }

            // Sign in button - outline style matching design tokens
            Rectangle {
                Layout.fillWidth: true
                height: 36
                radius: 8
                color: "transparent"
                border.width: 1
                border.color: (loginEmailField.text && loginPasswordField.text) ? root.workColor : root.mutedColor
                opacity: (loginEmailField.text && loginPasswordField.text) ? 1.0 : 0.5

                Row {
                    anchors.centerIn: parent
                    spacing: 8

                    PlasmaComponents.BusyIndicator {
                        width: 14
                        height: 14
                        visible: root.isAuthenticating
                        running: root.isAuthenticating
                    }

                    Text {
                        text: root.isAuthenticating ? "Signing in..." : "Sign In"
                        font.pixelSize: 13
                        font.weight: Font.Medium
                        color: (loginEmailField.text && loginPasswordField.text) ? root.workColor : root.mutedColor
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    enabled: loginEmailField.text && loginPasswordField.text && !root.isAuthenticating
                    onClicked: {
                        root.signIn(loginEmailField.text, loginPasswordField.text)
                        loginPasswordField.text = ""
                    }
                }
            }

            // ===== FEATURE-1202: Divider =====
            Row {
                Layout.fillWidth: true
                Layout.topMargin: 4
                spacing: 8

                Rectangle { Layout.fillWidth: true; height: 1; color: Qt.rgba(0.22, 0.20, 0.35, 0.6); anchors.verticalCenter: parent.verticalCenter }
                Text { text: "or"; font.pixelSize: 10; color: root.mutedColor }
                Rectangle { Layout.fillWidth: true; height: 1; color: Qt.rgba(0.22, 0.20, 0.35, 0.6); anchors.verticalCenter: parent.verticalCenter }
            }

            // ===== FEATURE-1202: Sign in with Google button =====
            Rectangle {
                Layout.fillWidth: true
                height: 36
                radius: 8
                color: "transparent"
                border.width: 1
                border.color: "#4285F4"  // Google blue

                Row {
                    anchors.centerIn: parent
                    spacing: 8

                    // Google "G" icon (text fallback)
                    Text {
                        text: "G"
                        font.pixelSize: 16
                        font.weight: Font.Bold
                        color: "#4285F4"
                        anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                        text: "Continue with Google"
                        font.pixelSize: 13
                        font.weight: Font.Medium
                        color: "#4285F4"
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    enabled: !root.isAuthenticating
                    onClicked: root.signInWithGoogle()
                }
            }

            // ===== FEATURE-1202: Import from FlowState app link =====
            Text {
                text: "Import from FlowState app"
                font.pixelSize: 10
                color: root.workColor
                Layout.alignment: Qt.AlignHCenter
                opacity: 0.7

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.importSessionFromFile()
                }

                Accessible.role: Accessible.Link
                Accessible.name: "Import session from FlowState desktop app"
            }

            Item { Layout.fillHeight: true }
        }

        // ===== TIMER VIEW (Authenticated) =====
        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 20
            spacing: 8
            visible: root.isAuthenticated

            // Auth status indicator
            Row {
                Layout.alignment: Qt.AlignRight
                spacing: 6

                Rectangle {
                    width: 8
                    height: 8
                    radius: 4
                    color: "#22C55E"
                    anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                    text: "Connected"
                    font.pixelSize: 10
                    color: root.mutedColor
                    anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                    text: "•"
                    font.pixelSize: 10
                    color: root.mutedColor
                    anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                    text: "Open App"
                    font.pixelSize: 10
                    color: root.workColor
                    anchors.verticalCenter: parent.verticalCenter

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.openApp()
                    }
                }

                // Dev link — opens localhost for development
                Text {
                    text: "Dev"
                    font.pixelSize: 10
                    color: root.mutedColor
                    anchors.verticalCenter: parent.verticalCenter
                    visible: (plasmoid.configuration.appUrl || "").indexOf("localhost") !== -1

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: Qt.openUrlExternally(plasmoid.configuration.appUrl || "http://localhost:5546")
                    }
                }

                Text {
                    text: "•"
                    font.pixelSize: 10
                    color: root.mutedColor
                    anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                    text: "Sign out"
                    font.pixelSize: 10
                    color: root.workColor
                    anchors.verticalCenter: parent.verticalCenter

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.signOut()
                    }
                }
            }

            // Session indicator dots
            Row {
                Layout.alignment: Qt.AlignHCenter
                spacing: 8

                Repeater {
                    model: root.maxSessions

                    Rectangle {
                        width: 8
                        height: 8
                        radius: 4
                        color: index < root.completedSessions ? root.currentAccent : root.mutedColor
                        opacity: index < root.completedSessions ? 1.0 : 0.4
                    }
                }
            }

            // ===== SESSION COMPLETE ACTIONS =====
            // REMOVED: In-widget popup - user only wants system notification with buttons

            // Circular timer
            Item {
                Layout.fillWidth: true
                Layout.preferredHeight: 160
                Layout.alignment: Qt.AlignHCenter

                Canvas {
                    id: progressCanvas
                    anchors.centerIn: parent
                    width: 160
                    height: 160

                    onPaint: {
                        var ctx = getContext("2d")
                        var centerX = width / 2
                        var centerY = height / 2
                        var radius = 70
                        var lineWidth = 6

                        ctx.reset()

                        ctx.beginPath()
                        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                        ctx.strokeStyle = root.mutedColor
                        ctx.globalAlpha = 0.3
                        ctx.lineWidth = lineWidth
                        ctx.stroke()

                        // Progress arc with glow
                        if (root.progress > 0) {
                            // Glow layer
                            ctx.beginPath()
                            ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * root.progress))
                            ctx.strokeStyle = root.currentAccent
                            ctx.globalAlpha = 1.0
                            ctx.lineWidth = lineWidth
                            ctx.lineCap = "round"
                            ctx.shadowColor = root.currentAccent
                            ctx.shadowBlur = 10
                            ctx.shadowOffsetX = 0
                            ctx.shadowOffsetY = 0
                            ctx.stroke()

                            // Bright center stroke (no shadow)
                            ctx.shadowBlur = 0
                            ctx.lineWidth = lineWidth - 2
                            ctx.stroke()
                        }
                    }

                    // BUG-1347: Throttled repaint to avoid per-second shadow blur recomputation
                    Timer {
                        id: progressRepaintTimer
                        interval: 250
                        running: false
                        repeat: false
                        onTriggered: progressCanvas.requestPaint()
                    }

                    Connections {
                        target: root
                        function onProgressChanged() { progressRepaintTimer.restart() }
                        function onIsWorkSessionChanged() { progressCanvas.requestPaint() }
                    }

                    Component.onCompleted: requestPaint()
                }

                Column {
                    anchors.centerIn: parent
                    spacing: 4

                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: root.hasActiveSession ? root.timeDisplay : "--:--"
                        font.pixelSize: 36
                        font.family: "monospace"
                        font.weight: Font.Medium
                        color: root.textColor
                    }

                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: root.hasActiveSession
                            ? (root.isWorkSession ? "focus" : "break")
                            : (root.isAuthenticated ? "ready" : "sign in")
                        font.pixelSize: 14
                        color: root.mutedColor
                    }
                }
            }

            // Control buttons
            Row {
                Layout.alignment: Qt.AlignHCenter
                spacing: 12

                // Skip button
                Rectangle {
                    width: 70
                    height: 32
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.mutedColor
                    opacity: root.hasActiveSession ? 1.0 : 0.4

                    Row {
                        anchors.centerIn: parent
                        spacing: 4
                        Kirigami.Icon { source: "media-skip-forward"; width: 14; height: 14; color: root.textColor }
                        Text { text: "Skip"; font.pixelSize: 12; color: root.textColor; anchors.verticalCenter: parent.verticalCenter }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        enabled: root.hasActiveSession
                        onClicked: root.skipSession()
                    }
                }

                // Start/Pause button - outline style with accent color
                Rectangle {
                    width: 70
                    height: 32
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.currentAccent  // Teal/orange accent border

                    Row {
                        anchors.centerIn: parent
                        spacing: 4
                        Kirigami.Icon { source: root.isRunning ? "media-playback-pause" : "media-playback-start"; width: 14; height: 14; color: root.currentAccent }
                        Text { text: root.isRunning ? "Pause" : "Start"; font.pixelSize: 12; color: root.currentAccent; anchors.verticalCenter: parent.verticalCenter }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.toggleTimer()
                    }
                }

                // TASK-1466: Reset button — restart countdown without changing task
                Rectangle {
                    width: 62
                    height: 32
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.mutedColor
                    opacity: root.hasActiveSession ? 1.0 : 0.4

                    Row {
                        anchors.centerIn: parent
                        spacing: 4
                        Kirigami.Icon { source: "view-refresh"; width: 14; height: 14; color: root.textColor }
                        Text { text: "Reset"; font.pixelSize: 12; color: root.textColor; anchors.verticalCenter: parent.verticalCenter }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        enabled: root.hasActiveSession
                        onClicked: root.resetSession()
                    }
                }

                // Stop button
                Rectangle {
                    width: 62
                    height: 32
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.mutedColor
                    opacity: root.hasActiveSession ? 1.0 : 0.4

                    Row {
                        anchors.centerIn: parent
                        spacing: 4
                        Kirigami.Icon { source: "media-playback-stop"; width: 14; height: 14; color: root.textColor }
                        Text { text: "Stop"; font.pixelSize: 12; color: root.textColor; anchors.verticalCenter: parent.verticalCenter }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        enabled: root.hasActiveSession
                        onClicked: root.stopSession()
                    }
                }
            }

            // Quick break button
            Row {
                Layout.alignment: Qt.AlignHCenter
                spacing: 8
                visible: !root.hasActiveSession

                Rectangle {
                    width: 80
                    height: 28
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.breakColor

                    Text {
                        anchors.centerIn: parent
                        text: "☕ Break"
                        font.pixelSize: 11
                        color: root.breakColor
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.startNewSession(true)
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 1
                color: root.mutedColor
                opacity: 0.2
            }

            // ===== QUICK ADD ROW =====
            RowLayout {
                Layout.fillWidth: true
                spacing: 6

                // Text input
                Rectangle {
                    Layout.fillWidth: true
                    height: 30
                    radius: 6
                    color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
                    border.width: 1
                    border.color: quickAddInput.activeFocus ? root.workColor : Qt.rgba(1, 1, 1, 0.10)

                    TextInput {
                        id: quickAddInput
                        anchors.fill: parent
                        anchors.leftMargin: 8
                        anchors.rightMargin: 8
                        color: root.textColor
                        font.pixelSize: 12
                        clip: true
                        selectByMouse: true
                        verticalAlignment: TextInput.AlignVCenter

                        Keys.onReturnPressed: {
                            if (text.trim()) {
                                root.createTask(text, false)
                                text = ""
                            }
                        }
                        Keys.onEnterPressed: {
                            if (text.trim()) {
                                root.createTask(text, false)
                                text = ""
                            }
                        }

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            text: "Quick add task..."
                            color: root.mutedColor
                            font.pixelSize: 12
                            visible: !parent.text && !parent.activeFocus
                        }
                    }
                }

                // TASK-1447: Due date dropdown for quick-add
                Rectangle {
                    width: 80
                    height: 30
                    radius: 6
                    color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
                    border.width: 1
                    border.color: quickAddDueDateCombo.popup.visible ? root.workColor : Qt.rgba(1, 1, 1, 0.10)

                    QQC2.ComboBox {
                        id: quickAddDueDateCombo
                        anchors.fill: parent

                        property var dueDateLabels: ["Today", "Tomorrow", "3 days", "Next wk", "No date"]

                        function computeQuickAddDate(idx) {
                            var d = new Date()
                            if (idx === 0) { /* today */ }
                            else if (idx === 1) { d.setDate(d.getDate() + 1) }
                            else if (idx === 2) { d.setDate(d.getDate() + 3) }
                            else if (idx === 3) { d.setDate(d.getDate() + 7) }
                            else { root.quickAddDueDate = ""; return }
                            var mm = ("0" + (d.getMonth() + 1)).slice(-2)
                            var dd = ("0" + d.getDate()).slice(-2)
                            root.quickAddDueDate = d.getFullYear() + "-" + mm + "-" + dd
                        }

                        model: dueDateLabels
                        currentIndex: 0

                        Component.onCompleted: {
                            computeQuickAddDate(0)
                        }

                        onActivated: function(idx) {
                            computeQuickAddDate(idx)
                        }

                        background: Rectangle {
                            color: "transparent"
                        }

                        contentItem: Text {
                            text: quickAddDueDateCombo.dueDateLabels[quickAddDueDateCombo.currentIndex]
                            font.pixelSize: 12
                            color: root.textColor
                            verticalAlignment: Text.AlignVCenter
                            horizontalAlignment: Text.AlignHCenter
                        }

                        indicator: Item {}

                        popup: QQC2.Popup {
                            y: quickAddDueDateCombo.height + 2
                            width: 90
                            padding: 2

                            background: Rectangle {
                                color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                border.width: 1
                                border.color: Qt.rgba(1, 1, 1, 0.12)
                                radius: 6
                            }

                            contentItem: Column {
                                Repeater {
                                    model: quickAddDueDateCombo.dueDateLabels
                                    Rectangle {
                                        width: 86
                                        height: 26
                                        radius: 4
                                        color: qaDateMA.containsMouse
                                            ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2)
                                            : "transparent"

                                        Text {
                                            anchors.verticalCenter: parent.verticalCenter
                                            anchors.left: parent.left
                                            anchors.leftMargin: 8
                                            text: modelData
                                            font.pixelSize: 11
                                            color: qaDateMA.containsMouse ? "#FFFFFF" : root.textColor
                                        }

                                        MouseArea {
                                            id: qaDateMA
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                quickAddDueDateCombo.currentIndex = index
                                                quickAddDueDateCombo.computeQuickAddDate(index)
                                                quickAddDueDateCombo.popup.close()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Add button (create only)
                Rectangle {
                    width: 30
                    height: 30
                    radius: 6
                    color: addBtnMouse.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"
                    border.width: 1
                    border.color: root.workColor

                    Text {
                        anchors.centerIn: parent
                        text: "+"
                        font.pixelSize: 16
                        font.bold: true
                        color: root.workColor
                    }

                    MouseArea {
                        id: addBtnMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (quickAddInput.text.trim()) {
                                root.createTask(quickAddInput.text, false)
                                quickAddInput.text = ""
                            }
                        }
                    }
                }

                // Play button (create + start timer)
                Rectangle {
                    width: 30
                    height: 30
                    radius: 6
                    color: playBtnMouse.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"
                    border.width: 1
                    border.color: root.workColor

                    Kirigami.Icon {
                        anchors.centerIn: parent
                        source: "media-playback-start"
                        width: 14
                        height: 14
                        color: root.workColor
                    }

                    MouseArea {
                        id: playBtnMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (quickAddInput.text.trim()) {
                                root.createTask(quickAddInput.text, true)
                                quickAddInput.text = ""
                            }
                        }
                    }
                }
            }

            // ===== TODAY + NANNY TOGGLES (shared row) =====
            RowLayout {
                Layout.fillWidth: true
                spacing: 6

                // --- Today toggle ---
                Rectangle {
                    Layout.fillWidth: true
                    height: 32
                    radius: 6
                    color: root.todayOnly
                        ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2)
                        : (todayChipMouse.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.1) : Qt.rgba(1, 1, 1, 0.03))
                    border.width: 1
                    border.color: root.todayOnly ? root.workColor : Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.3)

                    // Left teal accent bar
                    Rectangle {
                        width: 3
                        height: parent.height - 2
                        anchors.left: parent.left
                        anchors.leftMargin: 1
                        anchors.verticalCenter: parent.verticalCenter
                        radius: 2
                        color: root.workColor
                    }

                    Row {
                        id: todayChipRow
                        anchors.centerIn: parent
                        spacing: 6

                        Text {
                            text: "📅"
                            font.pixelSize: 12
                            anchors.verticalCenter: parent.verticalCenter
                        }

                        Text {
                            text: "Today"
                            font.pixelSize: 12
                            font.bold: true
                            color: root.todayOnly ? root.workColor : root.textColor
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }

                    MouseArea {
                        id: todayChipMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            root.todayOnly = !root.todayOnly
                            root.fetchTasks()
                        }
                    }
                }

                // --- Nanny toggle ---
                Rectangle {
                    Layout.fillWidth: true
                    height: 32
                    radius: 6
                    visible: root.isAuthenticated
                    color: plasmoid.configuration.nannyEnabled
                        ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2)
                        : (nannyToggleMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.06) : Qt.rgba(1, 1, 1, 0.03))
                    border.width: 1
                    border.color: plasmoid.configuration.nannyEnabled
                        ? root.workColor
                        : Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.3)

                    Rectangle {
                        width: 3
                        height: parent.height - 2
                        anchors.left: parent.left
                        anchors.leftMargin: 1
                        anchors.verticalCenter: parent.verticalCenter
                        radius: 2
                        color: plasmoid.configuration.nannyEnabled ? root.workColor : root.mutedColor
                    }

                    Row {
                        anchors.centerIn: parent
                        spacing: 6
                        Text {
                            text: plasmoid.configuration.nannyEnabled ? "\uD83D\uDD14" : "\uD83D\uDD15"
                            font.pixelSize: 12
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Text {
                            text: plasmoid.configuration.nannyEnabled
                                ? (root.nannyQuietToday ? "Nanny (paused today)" : "Nanny")
                                : "Nanny (off)"
                            font.pixelSize: 12
                            font.bold: true
                            color: plasmoid.configuration.nannyEnabled ? root.workColor : root.mutedColor
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }

                    MouseArea {
                        id: nannyToggleMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            plasmoid.configuration.nannyEnabled = !plasmoid.configuration.nannyEnabled
                            console.log("[NANNY] Toggled:", plasmoid.configuration.nannyEnabled)
                        }
                    }
                }
            }

            // ===== PINNED TASKS CHIPS =====
            Flow {
                Layout.fillWidth: true
                spacing: 6
                visible: root.pinnedTasks.length > 0

                Repeater {
                    model: root.pinnedTasks

                    Rectangle {
                        width: pinChipRow.implicitWidth + 16
                        height: 26
                        radius: 13
                        color: pinChipMouse.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.15) : "transparent"
                        border.width: 1
                        border.color: root.workColor

                        Row {
                            id: pinChipRow
                            anchors.centerIn: parent
                            spacing: 4

                            Text {
                                text: "📌"
                                font.pixelSize: 10
                                anchors.verticalCenter: parent.verticalCenter
                            }

                            Text {
                                text: modelData.title
                                font.pixelSize: 11
                                color: root.textColor
                                elide: Text.ElideRight
                                maximumLineCount: 1
                                anchors.verticalCenter: parent.verticalCenter
                                width: Math.min(implicitWidth, 100)
                            }
                        }

                        // Main chip click area
                        MouseArea {
                            id: pinChipMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.selectPinnedTask(modelData)
                        }

                        // Unpin X button (overlaid on top-right, above chip MouseArea)
                        Rectangle {
                            width: 16
                            height: 16
                            radius: 8
                            anchors.right: parent.right
                            anchors.top: parent.top
                            anchors.rightMargin: -4
                            anchors.topMargin: -4
                            color: unpinMouse.containsMouse ? "#EF4444" : Qt.rgba(0.3, 0.3, 0.3, 0.9)
                            visible: pinChipMouse.containsMouse
                            z: 10

                            Text {
                                anchors.centerIn: parent
                                text: "×"
                                font.pixelSize: 10
                                font.bold: true
                                color: "white"
                            }

                            MouseArea {
                                id: unpinMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: root.unpinTask(modelData.id)
                            }
                        }
                    }
                }
            }

            // Task list section
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 8

                // ===== SORT/FILTER CONTROLS =====
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 6

                    // Filter dropdown - glass morphism popup (QQC2)
                    Text {
                        text: "Filter:"
                        font.pixelSize: 9
                        color: root.mutedColor
                    }
                    QQC2.ComboBox {
                        id: filterCombo
                        Layout.preferredWidth: 85
                        model: ["All", "Todo", "Progress", "On Canvas"]
                        currentIndex: root.taskFilter === "all" ? 0 :
                                      root.taskFilter === "todo" ? 1 :
                                      root.taskFilter === "in_progress" ? 2 : 3
                        onActivated: function(index) {
                            var values = ["all", "todo", "in_progress", "on_canvas"]
                            root.taskFilter = values[index]
                            root.fetchTasks()
                        }

                        background: Rectangle {
                            implicitWidth: 85
                            implicitHeight: 26
                            radius: 6
                            color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
                            border.width: 1
                            border.color: filterCombo.hovered ? Qt.rgba(1, 1, 1, 0.15) : Qt.rgba(1, 1, 1, 0.10)
                        }

                        contentItem: Text {
                            leftPadding: 8
                            rightPadding: filterCombo.indicator.width + 4
                            text: filterCombo.displayText
                            font.pixelSize: 11
                            color: root.textColor
                            verticalAlignment: Text.AlignVCenter
                            elide: Text.ElideRight
                        }

                        indicator: Text {
                            x: filterCombo.width - width - 6
                            y: (filterCombo.height - height) / 2
                            text: "▾"
                            font.pixelSize: 10
                            color: root.mutedColor
                        }

                        popup: QQC2.Popup {
                            y: filterCombo.height
                            width: filterCombo.width
                            padding: 2
                            background: Rectangle {
                                color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                border.width: 1
                                border.color: Qt.rgba(1, 1, 1, 0.12)
                                radius: 4
                            }
                            contentItem: Column {
                                Repeater {
                                    model: filterCombo.model
                                    Rectangle {
                                        width: filterCombo.width - 4
                                        height: 28
                                        radius: 2
                                        color: fOptMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"

                                        Text {
                                            anchors.verticalCenter: parent.verticalCenter
                                            anchors.left: parent.left
                                            anchors.leftMargin: 8
                                            text: modelData
                                            font.pixelSize: 11
                                            color: fOptMA.containsMouse ? "#FFFFFF" : root.textColor
                                        }

                                        MouseArea {
                                            id: fOptMA
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                filterCombo.currentIndex = index
                                                filterCombo.activated(index)
                                                filterCombo.popup.close()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Sort dropdown - glass morphism popup (QQC2)
                    Text {
                        text: "Sort:"
                        font.pixelSize: 9
                        color: root.mutedColor
                    }
                    QQC2.ComboBox {
                        id: sortCombo
                        Layout.preferredWidth: 85
                        model: ["Newest", "Oldest", "A-Z", "Priority", "Canvas", "Project"]
                        currentIndex: root.taskSortBy === "created_desc" ? 0 :
                                      root.taskSortBy === "created_asc" ? 1 :
                                      root.taskSortBy === "title_asc" ? 2 :
                                      root.taskSortBy === "priority_desc" ? 3 :
                                      root.taskSortBy === "canvas_order" ? 4 : 5
                        onActivated: function(index) {
                            var values = ["created_desc", "created_asc", "title_asc", "priority_desc", "canvas_order", "project"]
                            root.taskSortBy = values[index]
                            root.fetchTasks()
                        }

                        background: Rectangle {
                            implicitWidth: 85
                            implicitHeight: 26
                            radius: 6
                            color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
                            border.width: 1
                            border.color: sortCombo.hovered ? Qt.rgba(1, 1, 1, 0.15) : Qt.rgba(1, 1, 1, 0.10)
                        }

                        contentItem: Text {
                            leftPadding: 8
                            rightPadding: sortCombo.indicator.width + 4
                            text: sortCombo.displayText
                            font.pixelSize: 11
                            color: root.textColor
                            verticalAlignment: Text.AlignVCenter
                            elide: Text.ElideRight
                        }

                        indicator: Text {
                            x: sortCombo.width - width - 6
                            y: (sortCombo.height - height) / 2
                            text: "▾"
                            font.pixelSize: 10
                            color: root.mutedColor
                        }

                        popup: QQC2.Popup {
                            y: sortCombo.height
                            width: sortCombo.width
                            padding: 2
                            background: Rectangle {
                                color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                border.width: 1
                                border.color: Qt.rgba(1, 1, 1, 0.12)
                                radius: 4
                            }
                            contentItem: Column {
                                Repeater {
                                    model: sortCombo.model
                                    Rectangle {
                                        width: sortCombo.width - 4
                                        height: 28
                                        radius: 2
                                        color: soOptMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"

                                        Text {
                                            anchors.verticalCenter: parent.verticalCenter
                                            anchors.left: parent.left
                                            anchors.leftMargin: 8
                                            text: modelData
                                            font.pixelSize: 11
                                            color: soOptMA.containsMouse ? "#FFFFFF" : root.textColor
                                        }

                                        MouseArea {
                                            id: soOptMA
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                sortCombo.currentIndex = index
                                                sortCombo.activated(index)
                                                sortCombo.popup.close()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Item { Layout.fillWidth: true }

                    // Task count badge
                    Text {
                        text: root.taskSearchQuery ? root.displayTasks.length + "/" + root.tasks.length : root.tasks.length + " tasks"
                        font.pixelSize: 10
                        color: root.mutedColor
                        visible: !root.isLoadingTasks
                    }
                }

                // ===== TASK-1473: SEARCH BOX =====
                Rectangle {
                    Layout.fillWidth: true
                    height: 30
                    radius: 6
                    color: Qt.rgba(0.11, 0.10, 0.18, 0.9)
                    border.width: 1
                    border.color: searchInput.activeFocus ? root.accentColor : Qt.rgba(1, 1, 1, 0.10)

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 8
                        anchors.rightMargin: 8
                        spacing: 6

                        Text {
                            text: "🔍"
                            font.pixelSize: 12
                            color: root.mutedColor
                        }

                        TextInput {
                            id: searchInput
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            verticalAlignment: TextInput.AlignVCenter
                            font.pixelSize: 11
                            color: root.textColor
                            clip: true
                            selectByMouse: true
                            onTextChanged: root.taskSearchQuery = text
                            Keys.onEscapePressed: {
                                text = ""
                                focus = false
                            }

                            Text {
                                anchors.fill: parent
                                verticalAlignment: Text.AlignVCenter
                                text: "Search tasks..."
                                font.pixelSize: 11
                                color: Qt.rgba(1, 1, 1, 0.3)
                                visible: !searchInput.text && !searchInput.activeFocus
                            }
                        }

                        Text {
                            text: "✕"
                            font.pixelSize: 10
                            color: clearArea.containsMouse ? root.textColor : root.mutedColor
                            visible: searchInput.text.length > 0

                            MouseArea {
                                id: clearArea
                                anchors.fill: parent
                                anchors.margins: -4
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    searchInput.text = ""
                                    searchInput.focus = false
                                }
                            }
                        }
                    }
                }

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true

                    PlasmaComponents.BusyIndicator {
                        anchors.centerIn: parent
                        visible: root.isLoadingTasks
                        running: root.isLoadingTasks
                    }

                    ListView {
                        id: taskListView
                        anchors.fill: parent
                        visible: !root.isLoadingTasks
                        model: root.displayTasks
                        clip: true
                        spacing: 6  // TASK-1087: Increased spacing for better readability

                        delegate: Item {
                            id: delegateRoot
                            width: taskListView.width
                            // TASK-1454: Headers are compact, task rows use dynamic height
                            height: modelData.isHeader ? projectHeader.height : taskDelegate.height

                            // ===== TASK-1454: Project Section Header =====
                            Rectangle {
                                id: projectHeader
                                visible: modelData.isHeader === true
                                width: parent.width
                                height: 28
                                color: "transparent"

                                Row {
                                    anchors.verticalCenter: parent.verticalCenter
                                    anchors.left: parent.left
                                    anchors.leftMargin: 8
                                    anchors.right: parent.right
                                    anchors.rightMargin: 8
                                    spacing: 6

                                    // Project color dot
                                    Rectangle {
                                        width: 8
                                        height: 8
                                        radius: 4
                                        anchors.verticalCenter: parent.verticalCenter
                                        color: {
                                            var c = modelData.projectColor || ""
                                            if (c && c.charAt(0) === '#') return c
                                            if (c) return "#" + c
                                            return root.mutedColor
                                        }
                                    }

                                    Text {
                                        text: modelData.projectName || ""
                                        font.pixelSize: 11
                                        font.bold: true
                                        color: root.textColor
                                        anchors.verticalCenter: parent.verticalCenter
                                    }

                                    // Subtle separator line
                                    Item {
                                        width: projectHeader.width - parent.children[0].width - parent.children[1].implicitWidth - parent.spacing * 2 - 16
                                        height: 1
                                        anchors.verticalCenter: parent.verticalCenter
                                        Rectangle {
                                            width: parent.width
                                            height: 1
                                            color: Qt.rgba(1, 1, 1, 0.08)
                                        }
                                    }
                                }
                            }

                            // ===== Task Row (existing delegate) =====
                            Rectangle {
                                id: taskDelegate
                                visible: modelData.isHeader !== true
                                width: parent.width
                                // TASK-1429: Dynamic height - expands when edit panel is open
                                readonly property real taskRowHeight: Math.max(44, Math.min(64, taskText.implicitHeight + 16))
                                readonly property bool isEditing: !modelData.isHeader && root.editingTaskId === modelData.id
                                height: modelData.isHeader ? 0 : (isEditing
                                    ? taskRowHeight + editPanel.height + 8
                                    : taskRowHeight)
                                Behavior on height { NumberAnimation { duration: 150; easing.type: Easing.OutCubic } }
                                radius: 6
                                clip: true

                                // TASK-1087: Check if this task is the active timer task
                                readonly property bool isActiveTask: !modelData.isHeader &&
                                                                      root.currentTaskId !== "" &&
                                                                      root.currentTaskId !== "general" &&
                                                                      modelData.id === root.currentTaskId &&
                                                                      root.isRunning

                                // TASK-1087: Highlight active task with accent glow
                                // TASK-1429: Also highlight when editing
                                color: isActiveTask ? Qt.rgba(root.currentAccent.r, root.currentAccent.g, root.currentAccent.b, 0.15)
                                     : isEditing ? Qt.rgba(0.18, 0.16, 0.27, 0.5)
                                     : Qt.rgba(0.18, 0.16, 0.27, 0.3)  // Purple-tinted task bg
                                border.width: isActiveTask ? 2 : (isEditing ? 1 : 0)
                                border.color: isActiveTask ? root.currentAccent
                                            : isEditing ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.3)
                                            : "transparent"

                                // TASK-1087: Subtle pulse animation for active task
                                SequentialAnimation on opacity {
                                    running: taskDelegate.isActiveTask
                                    loops: Animation.Infinite
                                    NumberAnimation { to: 0.85; duration: 1000; easing.type: Easing.InOutSine }
                                    NumberAnimation { to: 1.0; duration: 1000; easing.type: Easing.InOutSine }
                                }

                            // TASK-1429: Outer Column to stack task row + edit panel
                            Column {
                                id: delegateColumn
                                anchors.fill: parent

                                // === Task Row (existing content) ===
                                Row {
                                    id: taskRow
                                    width: parent.width
                                    height: taskDelegate.taskRowHeight
                                    leftPadding: 8
                                    rightPadding: 8
                                    topPadding: 6
                                    bottomPadding: 6
                                    spacing: 8

                                    // Mark done button (checkmark circle)
                                    Rectangle {
                                        width: 22
                                        height: 22
                                        radius: 11
                                        color: checkMouseArea.containsMouse ?
                                               Qt.rgba(0.13, 0.77, 0.37, 0.25) : "transparent"
                                        border.width: 1.5
                                        border.color: checkMouseArea.containsMouse ?
                                                      "#22C55E" : root.mutedColor
                                        anchors.verticalCenter: parent.verticalCenter

                                        Kirigami.Icon {
                                            anchors.centerIn: parent
                                            source: "checkmark"
                                            width: 12
                                            height: 12
                                            color: checkMouseArea.containsMouse ? "#22C55E" : root.mutedColor
                                        }

                                        MouseArea {
                                            id: checkMouseArea
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: { if (modelData.isHeader) return; root.markTaskDone(modelData.id) }
                                        }
                                    }

                                    // Start timer button (play icon)
                                    Rectangle {
                                        width: 22
                                        height: 22
                                        radius: 11
                                        color: playMouseArea.containsMouse ?
                                               Qt.rgba(root.currentAccent.r, root.currentAccent.g, root.currentAccent.b, 0.25) : "transparent"
                                        anchors.verticalCenter: parent.verticalCenter

                                        Kirigami.Icon {
                                            anchors.centerIn: parent
                                            // TASK-1087: Show different icon for active task
                                            source: taskDelegate.isActiveTask ? "chronometer"
                                                : (root.isRunning ? "media-skip-forward" : "media-playback-start")
                                            width: 14
                                            height: 14
                                            color: root.currentAccent
                                        }

                                        MouseArea {
                                            id: playMouseArea
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                if (modelData.isHeader) return
                                                if (root.isRunning && root.currentTaskId !== modelData.id) {
                                                    // Timer running on different task — switch it
                                                    root.switchTaskForSession(modelData.id)
                                                } else if (!root.isRunning) {
                                                    // No timer running — start new session
                                                    root.startSessionForTask(modelData.id)
                                                }
                                                // If already running on THIS task, do nothing (it's already active)
                                            }
                                        }
                                    }

                                    // Pin task button
                                    Rectangle {
                                        width: 22
                                        height: 22
                                        radius: 11
                                        color: pinMouseArea.containsMouse ?
                                               Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.25) : "transparent"
                                        anchors.verticalCenter: parent.verticalCenter

                                        Text {
                                            anchors.centerIn: parent
                                            text: "\uD83D\uDCCC"
                                            font.pixelSize: 10
                                        }

                                        MouseArea {
                                            id: pinMouseArea
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: { if (modelData.isHeader) return; root.pinTask(modelData.title) }
                                        }
                                    }

                                    // TASK-1429: Task title (clickable for inline edit)
                                    Item {
                                        width: parent.width - (root.taskSortBy === "canvas_order" && !modelData.position ? 170 : 90) - parent.leftPadding - parent.rightPadding
                                        height: parent.height - parent.topPadding - parent.bottomPadding
                                        anchors.verticalCenter: parent.verticalCenter

                                        Text {
                                            id: taskText
                                            anchors.fill: parent
                                            text: modelData.title || "Untitled"
                                            font.pixelSize: 13
                                            // TASK-1087: Bold for active task
                                            font.bold: taskDelegate.isActiveTask
                                            color: taskTitleMouseArea.containsMouse ? root.workColor : root.textColor
                                            // TASK-1087: Allow 2-line wrap for better RTL/long text readability
                                            wrapMode: Text.WordWrap
                                            maximumLineCount: 2
                                            elide: Text.ElideRight
                                            verticalAlignment: Text.AlignVCenter
                                            // RTL support
                                            horizontalAlignment: text.match(/[\u0590-\u05FF\u0600-\u06FF]/) ? Text.AlignRight : Text.AlignLeft
                                            // TASK-1429: Underline on hover
                                            font.underline: taskTitleMouseArea.containsMouse
                                        }

                                        MouseArea {
                                            id: taskTitleMouseArea
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                if (modelData.isHeader) return
                                                if (root.editingTaskId === modelData.id) {
                                                    root.editingTaskId = ""
                                                } else {
                                                    root.editingTaskId = modelData.id
                                                    root.editError = ""
                                                }
                                            }
                                        }
                                    }

                                    // Not on Canvas badge (canvas sort mode)
                                    Rectangle {
                                        visible: root.taskSortBy === "canvas_order" && !modelData.position
                                        width: nocLabel.implicitWidth + 8
                                        height: 16
                                        radius: 3
                                        color: Qt.rgba(1, 1, 1, 0.05)
                                        border.width: 1
                                        border.color: Qt.rgba(1, 1, 1, 0.12)
                                        anchors.verticalCenter: parent.verticalCenter

                                        Text {
                                            id: nocLabel
                                            anchors.centerIn: parent
                                            text: "Not on Canvas"
                                            font.pixelSize: 9
                                            color: root.mutedColor
                                        }
                                    }
                                }

                                // === TASK-1429: Inline Edit Panel ===
                                Column {
                                    id: editPanel
                                    visible: taskDelegate.isEditing
                                    width: parent.width - 16
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    spacing: 6
                                    opacity: visible ? 1.0 : 0.0
                                    Behavior on opacity { NumberAnimation { duration: 150 } }

                                    // Separator line
                                    Rectangle {
                                        width: parent.width
                                        height: 1
                                        color: Qt.rgba(1, 1, 1, 0.08)
                                    }

                                    // Row 1: Status + Priority ComboBoxes
                                    Row {
                                        spacing: 8
                                        width: parent.width

                                        // Status label + ComboBox
                                        Column {
                                            spacing: 2
                                            width: (parent.width - 8) / 2

                                            Text {
                                                text: "Status"
                                                font.pixelSize: 10
                                                color: root.mutedColor
                                            }

                                            QQC2.ComboBox {
                                                id: statusCombo
                                                width: parent.width
                                                model: ["planned", "todo", "in_progress", "done"]
                                                currentIndex: {
                                                    var s = modelData.status || "planned"
                                                    var idx = ["planned", "todo", "in_progress", "done"].indexOf(s)
                                                    return idx >= 0 ? idx : 0
                                                }
                                                background: Rectangle {
                                                    radius: 4
                                                    color: Qt.rgba(0.18, 0.16, 0.27, 0.6)
                                                    border.width: 1
                                                    border.color: Qt.rgba(1, 1, 1, 0.1)
                                                }
                                                contentItem: Text {
                                                    text: statusCombo.displayText
                                                    font.pixelSize: 11
                                                    color: root.textColor
                                                    verticalAlignment: Text.AlignVCenter
                                                    leftPadding: 6
                                                }
                                                popup: QQC2.Popup {
                                                    y: statusCombo.height
                                                    width: statusCombo.width
                                                    padding: 2
                                                    background: Rectangle {
                                                        color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                                        border.width: 1
                                                        border.color: Qt.rgba(1, 1, 1, 0.12)
                                                        radius: 4
                                                    }
                                                    contentItem: Column {
                                                        Repeater {
                                                            model: statusCombo.model
                                                            Rectangle {
                                                                width: statusCombo.width - 4
                                                                height: 28
                                                                radius: 2
                                                                color: sOptMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"

                                                                Text {
                                                                    anchors.verticalCenter: parent.verticalCenter
                                                                    anchors.left: parent.left
                                                                    anchors.leftMargin: 8
                                                                    text: modelData
                                                                    font.pixelSize: 11
                                                                    color: sOptMA.containsMouse ? "#FFFFFF" : root.textColor
                                                                }

                                                                MouseArea {
                                                                    id: sOptMA
                                                                    anchors.fill: parent
                                                                    hoverEnabled: true
                                                                    cursorShape: Qt.PointingHandCursor
                                                                    onClicked: {
                                                                        statusCombo.currentIndex = index
                                                                        statusCombo.popup.close()
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }

                                            }
                                        }

                                        // Priority label + ComboBox
                                        Column {
                                            spacing: 2
                                            width: (parent.width - 8) / 2

                                            Text {
                                                text: "Priority"
                                                font.pixelSize: 10
                                                color: root.mutedColor
                                            }

                                            QQC2.ComboBox {
                                                id: priorityCombo
                                                width: parent.width
                                                model: ["none", "low", "medium", "high"]
                                                currentIndex: {
                                                    var p = modelData.priority || "none"
                                                    var idx = ["none", "low", "medium", "high"].indexOf(p)
                                                    return idx >= 0 ? idx : 0
                                                }
                                                background: Rectangle {
                                                    radius: 4
                                                    color: Qt.rgba(0.18, 0.16, 0.27, 0.6)
                                                    border.width: 1
                                                    border.color: Qt.rgba(1, 1, 1, 0.1)
                                                }
                                                contentItem: Text {
                                                    text: priorityCombo.displayText
                                                    font.pixelSize: 11
                                                    color: root.textColor
                                                    verticalAlignment: Text.AlignVCenter
                                                    leftPadding: 6
                                                }
                                                popup: QQC2.Popup {
                                                    y: priorityCombo.height
                                                    width: priorityCombo.width
                                                    padding: 2
                                                    background: Rectangle {
                                                        color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                                        border.width: 1
                                                        border.color: Qt.rgba(1, 1, 1, 0.12)
                                                        radius: 4
                                                    }
                                                    contentItem: Column {
                                                        Repeater {
                                                            model: priorityCombo.model
                                                            Rectangle {
                                                                width: priorityCombo.width - 4
                                                                height: 28
                                                                radius: 2
                                                                color: pOptMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"

                                                                Text {
                                                                    anchors.verticalCenter: parent.verticalCenter
                                                                    anchors.left: parent.left
                                                                    anchors.leftMargin: 8
                                                                    text: modelData
                                                                    font.pixelSize: 11
                                                                    color: pOptMA.containsMouse ? "#FFFFFF" : root.textColor
                                                                }

                                                                MouseArea {
                                                                    id: pOptMA
                                                                    anchors.fill: parent
                                                                    hoverEnabled: true
                                                                    cursorShape: Qt.PointingHandCursor
                                                                    onClicked: {
                                                                        priorityCombo.currentIndex = index
                                                                        priorityCombo.popup.close()
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }

                                            }
                                        }
                                    }

                                    // Row 2: Due date
                                    Column {
                                        spacing: 2
                                        width: parent.width

                                        Text {
                                            text: "Due Date"
                                            font.pixelSize: 10
                                            color: root.mutedColor
                                        }

                                        QQC2.ComboBox {
                                            id: dueDateCombo
                                            width: parent.width

                                            property string dateValue: ""

                                            function formatDate(d) {
                                                var y = d.getFullYear()
                                                var m = ("0" + (d.getMonth() + 1)).slice(-2)
                                                var day = ("0" + d.getDate()).slice(-2)
                                                return y + "-" + m + "-" + day
                                            }

                                            function applySelection(idx) {
                                                var now = new Date()
                                                switch(idx) {
                                                    case 0: dateValue = ""; displayText = "No due date"; break
                                                    case 1: dateValue = formatDate(now); displayText = dateValue; break
                                                    case 2: now.setDate(now.getDate() + 1); dateValue = formatDate(now); displayText = dateValue; break
                                                    case 3: now.setDate(now.getDate() + 3); dateValue = formatDate(now); displayText = dateValue; break
                                                    case 4:
                                                        var dayOfWeek = now.getDay()
                                                        var daysUntilSat = (6 - dayOfWeek + 7) % 7
                                                        if (daysUntilSat === 0) daysUntilSat = 7
                                                        now.setDate(now.getDate() + daysUntilSat)
                                                        dateValue = formatDate(now); displayText = dateValue; break
                                                    case 5: now.setDate(now.getDate() + 7); dateValue = formatDate(now); displayText = dateValue; break
                                                    case 6: now.setMonth(now.getMonth() + 1); dateValue = formatDate(now); displayText = dateValue; break
                                                }
                                            }

                                            model: ["No due date", "Today", "Tomorrow", "In 3 days", "Weekend", "Next week", "In a month"]

                                            Component.onCompleted: {
                                                if (modelData.due_date) {
                                                    dateValue = modelData.due_date.substring(0, 10)
                                                    displayText = dateValue
                                                } else {
                                                    currentIndex = 0
                                                    dateValue = ""
                                                    displayText = "No due date"
                                                }
                                            }

                                            onActivated: function(idx) { applySelection(idx) }

                                            background: Rectangle {
                                                radius: 4
                                                color: Qt.rgba(0.18, 0.16, 0.27, 0.6)
                                                border.width: 1
                                                border.color: Qt.rgba(1, 1, 1, 0.1)
                                            }
                                            contentItem: Text {
                                                text: dueDateCombo.displayText
                                                font.pixelSize: 11
                                                color: root.textColor
                                                verticalAlignment: Text.AlignVCenter
                                                leftPadding: 6
                                            }
                                            popup: QQC2.Popup {
                                                y: dueDateCombo.height
                                                width: dueDateCombo.width
                                                padding: 2
                                                background: Rectangle {
                                                    color: Qt.rgba(0.14, 0.12, 0.22, 0.95)
                                                    border.width: 1
                                                    border.color: Qt.rgba(1, 1, 1, 0.12)
                                                    radius: 4
                                                }
                                                contentItem: Column {
                                                    Repeater {
                                                        model: dueDateCombo.model
                                                        Rectangle {
                                                            width: dueDateCombo.width - 4
                                                            height: 28
                                                            radius: 2
                                                            color: dOptMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2) : "transparent"

                                                            Text {
                                                                anchors.verticalCenter: parent.verticalCenter
                                                                anchors.left: parent.left
                                                                anchors.leftMargin: 8
                                                                text: modelData
                                                                font.pixelSize: 11
                                                                color: dOptMA.containsMouse ? "#FFFFFF" : root.textColor
                                                            }

                                                            MouseArea {
                                                                id: dOptMA
                                                                anchors.fill: parent
                                                                hoverEnabled: true
                                                                cursorShape: Qt.PointingHandCursor
                                                                onClicked: {
                                                                    dueDateCombo.currentIndex = index
                                                                    dueDateCombo.applySelection(index)
                                                                    dueDateCombo.popup.close()
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Row 2b: Duration quick-set templates
                                    Row {
                                        spacing: 4
                                        width: parent.width

                                        Text {
                                            text: "Set due:"
                                            font.pixelSize: 10
                                            color: root.mutedColor
                                            anchors.verticalCenter: parent.verticalCenter
                                        }

                                        Repeater {
                                            model: [
                                                { label: "15m", mins: 15 },
                                                { label: "30m", mins: 30 },
                                                { label: "1h", mins: 60 },
                                                { label: "2h", mins: 120 },
                                                { label: "3h", mins: 180 }
                                            ]

                                            Rectangle {
                                                width: durationLabel.implicitWidth + 12
                                                height: 22
                                                radius: 11
                                                color: durationChipMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2)
                                                                                     : Qt.rgba(1, 1, 1, 0.06)
                                                border.width: 1
                                                border.color: durationChipMA.containsMouse ? root.workColor : Qt.rgba(1, 1, 1, 0.1)

                                                Text {
                                                    id: durationLabel
                                                    anchors.centerIn: parent
                                                    text: modelData.label
                                                    font.pixelSize: 10
                                                    color: durationChipMA.containsMouse ? root.workColor : root.textColor
                                                }

                                                MouseArea {
                                                    id: durationChipMA
                                                    anchors.fill: parent
                                                    hoverEnabled: true
                                                    cursorShape: Qt.PointingHandCursor
                                                    onClicked: {
                                                        var now = new Date()
                                                        now.setMinutes(now.getMinutes() + modelData.mins)
                                                        var y = now.getFullYear()
                                                        var m = ("0" + (now.getMonth() + 1)).slice(-2)
                                                        var d = ("0" + now.getDate()).slice(-2)
                                                        var dateStr = y + "-" + m + "-" + d
                                                        dueDateCombo.dateValue = dateStr
                                                        dueDateCombo.displayText = dateStr
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Row 3: Save + Cancel + Open in App
                                    Row {
                                        spacing: 8
                                        width: parent.width

                                        // Save button (glass + teal)
                                        Rectangle {
                                            width: 60
                                            height: 28
                                            radius: 4
                                            color: saveMA.containsMouse ? Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.2)
                                                                       : Qt.rgba(root.workColor.r, root.workColor.g, root.workColor.b, 0.1)
                                            border.width: 1
                                            border.color: root.workColor
                                            opacity: root.isSavingEdit ? 0.5 : 1.0

                                            Text {
                                                anchors.centerIn: parent
                                                text: root.isSavingEdit ? "..." : "Save"
                                                font.pixelSize: 11
                                                font.bold: true
                                                color: root.workColor
                                            }

                                            MouseArea {
                                                id: saveMA
                                                anchors.fill: parent
                                                hoverEnabled: true
                                                cursorShape: Qt.PointingHandCursor
                                                enabled: !root.isSavingEdit
                                                onClicked: {
                                                    root.saveTaskEdit(
                                                        modelData.id,
                                                        statusCombo.currentText,
                                                        priorityCombo.currentText,
                                                        dueDateCombo.dateValue
                                                    )
                                                }
                                            }
                                        }

                                        // Cancel button (glass + muted)
                                        Rectangle {
                                            width: 60
                                            height: 28
                                            radius: 4
                                            color: cancelMA.containsMouse ? Qt.rgba(1, 1, 1, 0.08) : Qt.rgba(1, 1, 1, 0.04)
                                            border.width: 1
                                            border.color: root.mutedColor

                                            Text {
                                                anchors.centerIn: parent
                                                text: "Cancel"
                                                font.pixelSize: 11
                                                color: root.mutedColor
                                            }

                                            MouseArea {
                                                id: cancelMA
                                                anchors.fill: parent
                                                hoverEnabled: true
                                                cursorShape: Qt.PointingHandCursor
                                                onClicked: {
                                                    root.editingTaskId = ""
                                                    root.editError = ""
                                                    root.confirmingDelete = false
                                                }
                                            }
                                        }

                                        // Delete button (glass + red)
                                        Rectangle {
                                            width: root.confirmingDelete && taskDelegate.isEditing ? 90 : 95
                                            height: 28
                                            radius: 4
                                            color: deleteMA.containsMouse ? Qt.rgba(0.97, 0.44, 0.44, 0.2) : Qt.rgba(0.97, 0.44, 0.44, 0.1)
                                            border.width: 1
                                            border.color: "#F87171"
                                            Behavior on width { NumberAnimation { duration: 100 } }

                                            Text {
                                                anchors.centerIn: parent
                                                text: root.confirmingDelete && taskDelegate.isEditing ? "Confirm?" : "Perm. Delete"
                                                font.pixelSize: 11
                                                font.bold: root.confirmingDelete && taskDelegate.isEditing
                                                color: "#F87171"
                                            }

                                            MouseArea {
                                                id: deleteMA
                                                anchors.fill: parent
                                                hoverEnabled: true
                                                cursorShape: Qt.PointingHandCursor
                                                onClicked: {
                                                    if (root.confirmingDelete) {
                                                        root.deleteTaskPermanently(modelData.id)
                                                    } else {
                                                        root.confirmingDelete = true
                                                    }
                                                }
                                            }
                                        }

                                        // Spacer
                                        Item {
                                            width: Math.max(0, parent.width - 60 - 60 - (root.confirmingDelete && taskDelegate.isEditing ? 90 : 95) - openAppLink.width - 32)
                                            height: 1
                                        }

                                        // "Open in App" link (teal text, right side)
                                        Text {
                                            id: openAppLink
                                            text: "Open in App \u2192"
                                            font.pixelSize: 11
                                            color: openAppMA.containsMouse ? Qt.lighter(root.workColor, 1.2) : root.workColor
                                            anchors.verticalCenter: parent.verticalCenter

                                            MouseArea {
                                                id: openAppMA
                                                anchors.fill: parent
                                                hoverEnabled: true
                                                cursorShape: Qt.PointingHandCursor
                                                onClicked: root.openAppToTask(modelData.id)
                                            }
                                        }
                                    }

                                    // Error text
                                    Text {
                                        visible: root.editError !== "" && taskDelegate.isEditing
                                        text: root.editError
                                        font.pixelSize: 10
                                        color: "#F87171"
                                        width: parent.width
                                        wrapMode: Text.WordWrap
                                    }

                                    // Bottom padding
                                    Item { width: 1; height: 4 }
                                }
                            }
                        } // end Rectangle (taskDelegate)
                        } // end Item (delegateRoot)

                        Text {
                            anchors.centerIn: parent
                            visible: {
                                // TASK-1454: Filter out header items when checking empty
                                if (root.tasks.length === 0) return true
                                for (var i = 0; i < root.tasks.length; i++) {
                                    if (!root.tasks[i].isHeader) return false
                                }
                                return true
                            }
                            text: "No tasks found"
                            color: root.mutedColor
                            font.pixelSize: 12
                        }
                    }
                }

                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 100
                    height: 28
                    radius: 6
                    color: "transparent"
                    border.width: 1
                    border.color: root.mutedColor
                    opacity: 0.6
                    visible: root.isAuthenticated

                    Row {
                        anchors.centerIn: parent
                        spacing: 6
                        Text { text: "↻"; font.pixelSize: 12; color: root.textColor }
                        Text { text: "Refresh"; font.pixelSize: 11; color: root.textColor }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: { root.fetchCurrentSession(); root.fetchTasks(); root.fetchPinnedTasks(); root.fetchProjects(); root.fetchNannyTasks() }
                        enabled: !root.isLoadingTasks
                    }
                }

                // ===== TASK-1424: Quiet Today toggle =====
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.nannyQuietToday ? "(Reminders paused for today)" : "🔇 Quiet today"
                    font.pixelSize: 10
                    color: root.nannyQuietToday ? root.mutedColor : root.workColor
                    opacity: root.nannyQuietToday ? 0.5 : 0.6
                    visible: plasmoid.configuration.nannyEnabled && root.isAuthenticated

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            root.nannyQuietToday = !root.nannyQuietToday
                            if (root.nannyQuietToday) {
                                var today = new Date()
                                root.nannyQuietDate = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
                                console.log("[NANNY] Quiet mode enabled for today")
                            } else {
                                root.nannyQuietDate = -1
                                console.log("[NANNY] Quiet mode disabled")
                            }
                        }
                    }
                }
            }
        }
    }

    // ===== TIMERS =====

    // Local countdown - ONLY runs when widget is device leader
    Timer {
        id: countdownTimer
        interval: 1000
        running: root.isRunning && root.hasActiveSession && root.isDeviceLeader
        repeat: true
        onTriggered: {
            if (root.secondsRemaining > 0) {
                root.secondsRemaining--
                // Pre-end warning check
                var warningSeconds = plasmoid.configuration.preEndWarningSeconds || 0
                if (warningSeconds > 0 && !root.preEndWarningShown && root.secondsRemaining <= warningSeconds && root.secondsRemaining > 0) {
                    root.preEndWarningShown = true
                    root.showPreEndWarning()
                }
            } else {
                root.onSessionComplete()
            }
        }
    }

    // Sync polling - adaptive: 2s when active session, 30s when idle
    Timer {
        id: syncTimer
        // BUG-1292: Keep 2s polling during session transitions (work→break, break→work)
        // BUG-1347: Use reactive isInTransition instead of impure Date.now() in binding
        interval: (root.hasActiveSession || root.sessionJustCompleted || root.isInTransition) ? 2000 : 30000
        running: root.isAuthenticated
        repeat: true
        onTriggered: root.fetchCurrentSession()
    }

    // TASK-1373: Pinned tasks refresh (separate from 2s session sync)
    // BUG-1447: Reduced from 60s to 15s for faster app↔widget pin sync
    Timer {
        id: pinnedTasksRefreshTimer
        interval: 15000  // 15 seconds
        running: root.isAuthenticated
        repeat: true
        onTriggered: root.fetchPinnedTasks()
    }

    // Task list periodic refresh (sync with changes from Vue app)
    // BUG-1451: Faster polling (10s) when timer active for responsive done/delete sync
    Timer {
        id: taskListRefreshTimer
        interval: root.hasActiveSession ? 10000 : 30000
        running: root.isAuthenticated
        repeat: true
        onTriggered: { root.fetchTasks(); root.fetchNannyTasks() }
    }

    // BUG-1347: Timer to clear transition state (replaces Date.now() < transitionUntil)
    Timer {
        id: transitionTimer
        interval: 15000  // 15 seconds transition window
        running: false
        repeat: false
        onTriggered: root.isInTransition = false
    }

    // Heartbeat - ONLY runs when widget is device leader
    Timer {
        id: heartbeatTimer
        interval: 10000
        running: root.isRunning && root.hasActiveSession && root.isDeviceLeader
        repeat: true
        onTriggered: root.sendHeartbeat()
    }

    // Token refresh timer
    Timer {
        id: tokenRefreshTimer
        interval: Math.max((root.tokenExpiresIn - 300) * 1000, 60000)
        running: root.isAuthenticated
        repeat: false
        onTriggered: root.refreshAccessToken()
    }

    // ===== TASK-1424: NANNY (FOCUS REMINDER) TIMER =====
    Timer {
        id: nannyTimer
        interval: 30000  // Check every 30 seconds
        running: root.isAuthenticated && plasmoid.configuration.nannyEnabled
        repeat: true
        onTriggered: {
            var now = Date.now()

            // Midnight reset: check if day-of-year changed since quiet was set
            if (root.nannyQuietToday) {
                var today = new Date()
                var dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
                if (dayOfYear !== root.nannyQuietDate) {
                    root.nannyQuietToday = false
                    root.nannyQuietDate = -1
                    console.log("[NANNY] Midnight reset: reminders re-enabled")
                }
            }

            // Gate checks with debug logging
            if (root.nannyQuietToday) { console.log("[NANNY] Blocked: quiet today"); return }
            if (root.hasActiveSession) { console.log("[NANNY] Blocked: active session running"); return }

            // Check current day is a work day
            var currentDay = new Date().getDay()  // 0=Sun, 1=Mon, ..., 6=Sat
            var workDays = (plasmoid.configuration.nannyWorkDays || "1,2,3,4,5").split(",")
            var isWorkDay = false
            for (var i = 0; i < workDays.length; i++) {
                if (parseInt(workDays[i]) === currentDay) {
                    isWorkDay = true
                    break
                }
            }
            if (!isWorkDay) { console.log("[NANNY] Blocked: not a work day (day=" + currentDay + ", configured=" + workDays + ")"); return }

            // Check current hour is within work hours
            var currentHour = new Date().getHours()
            var startHour = plasmoid.configuration.nannyStartHour
            var endHour = plasmoid.configuration.nannyEndHour
            if (currentHour < startHour || currentHour >= endHour) { console.log("[NANNY] Blocked: outside work hours (hour=" + currentHour + ", range=" + startHour + "-" + endHour + ")"); return }

            // Check enough idle time has passed
            var intervalMs = (plasmoid.configuration.nannyIntervalMinutes || 60) * 60 * 1000
            var idleMs = root.nannyLastSessionEndTime > 0 ? (now - root.nannyLastSessionEndTime) : intervalMs + 1
            console.log("[NANNY] Idle check: " + Math.round(idleMs / 1000) + "s idle, need " + Math.round(intervalMs / 1000) + "s")
            if (root.nannyLastSessionEndTime > 0 && idleMs < intervalMs) return

            // Check we haven't notified within the interval
            if (root.nannyLastNotifyTime > 0 && (now - root.nannyLastNotifyTime) < intervalMs) { console.log("[NANNY] Blocked: already notified recently"); return }

            // All conditions met - send notification
            console.log("[NANNY] All gates passed — sending notification!")
            root.sendNannyNotification()
        }
    }

    // ===== AUTHENTICATION FUNCTIONS =====

    function signIn(email, password) {
        if (root.supabaseUrl === "" || root.supabaseKey === "") {
            root.authError = "Supabase not configured"
            return
        }

        root.isAuthenticating = true
        root.authError = ""

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/auth/v1/token?grant_type=password"

        xhr.open("POST", url, true)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("apikey", root.supabaseKey)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isAuthenticating = false

                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText)
                        root.accessToken = response.access_token
                        root.refreshToken = response.refresh_token
                        root.userId = response.user?.id || ""  // Extract user ID for RLS
                        root.tokenExpiresIn = response.expires_in || 3600
                        root.saveAuthTokens(email)
                        tokenRefreshTimer.restart()
                        // BUG-1347: Stagger fetches to avoid concurrent JSON.parse blocking UI thread
                        root.fetchCurrentSession()
                        Qt.callLater(root.fetchTasks)
                        Qt.callLater(root.fetchPinnedTasks)
                        Qt.callLater(root.fetchProjects)
                        // TASK-1424: Initialize nanny timestamp on sign-in
                        root.nannyLastSessionEndTime = Date.now()
                        if (root.debugLogging) console.log("[AUTH] Sign in successful, userId:", root.userId)
                    } catch (e) {
                        root.authError = "Failed to parse response"
                    }
                } else {
                    try {
                        var error = JSON.parse(xhr.responseText)
                        root.authError = error.msg || error.error_description || error.message || "Sign in failed"
                    } catch (e) {
                        root.authError = "Sign in failed: " + xhr.status
                    }
                }
            }
        }

        xhr.send(JSON.stringify({ email: email, password: password }))
    }

    function refreshAccessToken() {
        if (root.supabaseUrl === "" || root.refreshToken === "") return
        if (root.isRefreshingToken) {
            // Safety: if stuck for >30s, force reset and proceed
            if (Date.now() - root.refreshTokenStartTime > 30000) {
                console.log("[AUTH] Refresh stuck for >30s, forcing reset")
                root.isRefreshingToken = false
            } else {
                if (root.debugLogging) console.log("[AUTH] Already refreshing token, skipping...")
                return
            }
        }

        root.isRefreshingToken = true
        root.refreshTokenStartTime = Date.now()
        if (root.debugLogging) console.log("[AUTH] Starting token refresh...")

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/auth/v1/token?grant_type=refresh_token"

        xhr.open("POST", url, true)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("apikey", root.supabaseKey)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isRefreshingToken = false  // Reset flag
                if (root.debugLogging) console.log("[AUTH] Refresh response:", xhr.status, xhr.responseText.substring(0, 200))
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText)
                    root.accessToken = response.access_token
                    root.refreshToken = response.refresh_token
                    root.userId = response.user?.id || root.userId  // Also update userId
                    root.tokenExpiresIn = response.expires_in || 3600
                    root.saveAuthTokens(plasmoid.configuration.storageEmail)
                    tokenRefreshTimer.interval = Math.max((root.tokenExpiresIn - 300) * 1000, 60000)
                    tokenRefreshTimer.restart()
                    if (root.debugLogging) console.log("[AUTH] Token refreshed successfully, new expiry:", root.tokenExpiresIn)
                    // BUG-1347: Stagger fetches to avoid concurrent JSON.parse blocking UI thread
                    root.fetchCurrentSession()
                    Qt.callLater(root.fetchTasks)
                    Qt.callLater(root.fetchPinnedTasks)
                    Qt.callLater(root.fetchProjects)
                } else if (xhr.status === 401 || xhr.status === 400) {
                    console.log("[AUTH] Refresh failed, signing out")
                    root.authError = "Session expired. Please sign in again."
                    root.signOut()
                } else {
                    // Network error or unexpected status — retry token refresh in 60 seconds
                    console.log("[AUTH] Refresh failed with status:", xhr.status, "— will retry in 60s")
                    tokenRefreshTimer.interval = 60000
                    tokenRefreshTimer.restart()
                }
            }
        }

        xhr.send(JSON.stringify({ refresh_token: root.refreshToken }))
    }

    function signOut() {
        root.accessToken = ""
        root.refreshToken = ""
        root.userId = ""
        root.hasActiveSession = false
        root.currentSessionId = ""
        plasmoid.configuration.storageAccessToken = ""
        plasmoid.configuration.storageRefreshToken = ""
        plasmoid.configuration.storageUserId = ""
        tokenRefreshTimer.stop()
        console.log("[AUTH] Signed out")
    }

    function saveAuthTokens(email) {
        plasmoid.configuration.storageAccessToken = root.accessToken
        plasmoid.configuration.storageRefreshToken = root.refreshToken
        plasmoid.configuration.storageUserId = root.userId
        plasmoid.configuration.storageEmail = email || ""
    }

    function loadAuthTokens() {
        root.accessToken = plasmoid.configuration.storageAccessToken || ""
        root.refreshToken = plasmoid.configuration.storageRefreshToken || ""
        root.userId = plasmoid.configuration.storageUserId || ""

        if (root.isAuthenticated) {
            console.log("[AUTH] Restored session, userId:", root.userId)
            tokenRefreshTimer.restart()
            // TASK-1424: Initialize nanny timestamp so we don't fire immediately on login
            root.nannyLastSessionEndTime = Date.now()
        }
    }

    // FEATURE-1202: Sign in with Google via OAuth helper script
    function signInWithGoogle() {
        if (root.supabaseUrl === "" || root.supabaseKey === "") {
            root.authError = "Configure Supabase URL and key first (Settings)"
            return
        }

        root.isAuthenticating = true
        root.authError = ""

        var scriptPath = Qt.resolvedUrl("../scripts/oauth-google.py").toString().replace("file://", "")
        var cmd = 'python3 "' + scriptPath + '" "' + root.supabaseUrl + '" "' + root.supabaseKey + '"'
        console.log("[OAUTH] Starting Google sign-in:", cmd)
        oauthDataSource.connectSource(cmd)
    }

    // FEATURE-1202: Import session from FlowState app (reads ~/.config/flowstate/session.json)
    function importSessionFromFile() {
        root.isAuthenticating = true
        root.authError = ""

        var xhr = new XMLHttpRequest()
        var filePath = StandardPaths.writableLocation(StandardPaths.ConfigLocation) + "/flowstate/session.json"

        xhr.open("GET", "file://" + filePath, true)
        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isAuthenticating = false
                if (xhr.status === 200 || xhr.status === 0) {
                    try {
                        var data = JSON.parse(xhr.responseText)
                        if (data.access_token && data.refresh_token) {
                            root.accessToken = data.access_token
                            root.refreshToken = data.refresh_token
                            root.userId = data.user_id || ""
                            root.saveAuthTokens("FlowState Import")
                            tokenRefreshTimer.restart()
                            // Refresh immediately to validate tokens and get fresh user info
                            root.refreshAccessToken()
                            console.log("[AUTH] Imported session from FlowState app")
                        } else {
                            root.authError = "No active session in FlowState app"
                        }
                    } catch (e) {
                        root.authError = "Could not read session file"
                        console.log("[AUTH] Import error:", e)
                    }
                } else {
                    root.authError = "Session file not found. Sign in via FlowState app first."
                }
            }
        }
        xhr.send()
    }

    // ===== TIMER SESSION FUNCTIONS =====

    // BUG: Detect session completion by another device (follower mode)
    // Called when we had an active session but polling returns empty (is_active=eq.true returns nothing)
    // Does a one-time check to see if the session completed naturally vs was manually stopped
    function checkSessionCompletion(sessionId, wasWork) {
        if (!root.isAuthenticated || !sessionId) return
        root.checkingCompletion = true

        if (root.debugLogging) console.log("[SYNC] Checking if session completed naturally:", sessionId)

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/timer_sessions?id=eq." + sessionId + "&select=remaining_time,is_active,completed_at"

        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                var sessions = JSON.parse(xhr.responseText)
                if (sessions.length > 0) {
                    var s = sessions[0]
                    var completedNaturally = s.remaining_time === 0 && s.completed_at !== null && s.completed_at !== undefined
                    if (root.debugLogging) console.log("[SYNC] Session check result:", JSON.stringify({
                        remaining_time: s.remaining_time,
                        is_active: s.is_active,
                        completed_at: s.completed_at,
                        completedNaturally: completedNaturally
                    }))

                    if (completedNaturally) {
                        // Session completed on another device - trigger notification!
                        console.log("[SYNC] Session completed by another device - triggering notification")
                        root.isWorkSession = wasWork
                        onSessionComplete()
                        root.checkingCompletion = false
                    } else {
                        // Session was manually stopped - clear silently
                        console.log("[SYNC] Session was manually stopped - clearing silently")
                        root.hasActiveSession = false
                        root.currentSessionId = ""
                        root.currentTaskId = ""
                        root.isRunning = false
                        root.isDeviceLeader = false
                        root.nannyLastSessionEndTime = Date.now()  // TASK-1424
                        root.writeActiveTaskFile()
                        root.checkingCompletion = false
                    }
                } else {
                    // Session not found at all - clear silently
                    console.log("[SYNC] Session not found - clearing silently")
                    root.hasActiveSession = false
                    root.currentSessionId = ""
                    root.currentTaskId = ""
                    root.isRunning = false
                    root.isDeviceLeader = false
                    root.nannyLastSessionEndTime = Date.now()  // TASK-1424
                    root.writeActiveTaskFile()
                    root.checkingCompletion = false
                }
            } else if (xhr.readyState === XMLHttpRequest.DONE) {
                console.warn("[SYNC] Session check failed:", xhr.status)
                // On error, fall through to normal clear
                root.hasActiveSession = false
                root.currentSessionId = ""
                root.currentTaskId = ""
                root.isRunning = false
                root.isDeviceLeader = false
                root.writeActiveTaskFile()
                root.checkingCompletion = false
            }
        }
        xhr.send()
    }

    function fetchCurrentSession() {
        if (!root.isAuthenticated) {
            if (root.debugLogging) console.log("[SYNC] Not authenticated, skipping fetch")
            return
        }

        if (root.debugLogging) console.log("[SYNC] Fetching current session... userId:", root.userId)

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/timer_sessions?is_active=eq.true&select=*&order=updated_at.desc&limit=1"

        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState !== XMLHttpRequest.DONE) return  // BUG-1347: Early exit for non-DONE states

            if (root.debugLogging) console.log("[SYNC] Response:", xhr.status)

            // Handle expired token - try to refresh
            if (xhr.status === 401) {
                console.log("[SYNC] Token expired, refreshing...")
                root.refreshAccessToken()
                return
            }

            // BUG-1292: Handle unexpected status codes
            if (xhr.status !== 200) {
                console.warn("[SYNC] Unexpected response:", xhr.status)
                return
            }

            // BUG-1347: Merged into single DONE block (was duplicated if-check)
            var sessions = JSON.parse(xhr.responseText)
            if (root.debugLogging) console.log("[SYNC] Found", sessions.length, "active sessions")
            if (sessions.length > 0) {
                var s = sessions[0]
                if (root.debugLogging) console.log("[SYNC] Session:", s.id, "remaining:", s.remaining_time, "leader:", s.device_leader_id, "task:", s.task_id)
                root.currentSessionId = s.id
                root.currentTaskId = s.task_id || ""  // TASK-1087: Track active task
                root.totalSeconds = s.duration
                root.isWorkSession = !s.is_break
                root.hasActiveSession = true
                root.sessionJustCompleted = false  // Clear completion state when active session found

                // BUG-1462: Auto-dismiss overlay + notification when new session detected (e.g. from notify.sh button)
                if (fullScreenOverlay.visible) {
                    fullScreenOverlay.visible = false
                    root.dismissSystemNotification()
                    console.log("[SYNC] Auto-dismissed overlay — new session detected")
                }

                // BUG-1122: Check for stale leadership and take over if needed
                var widgetIsLeader = s.device_leader_id === "kde-widget"
                var leaderIsStale = false
                var driftSeconds = 0

                if (s.device_leader_last_seen) {
                    var lastSeen = new Date(s.device_leader_last_seen).getTime()
                    var now = Date.now()
                    driftSeconds = Math.floor((now - lastSeen) / 1000)
                    // 30 seconds timeout - matches DEVICE_LEADER_TIMEOUT_MS in timer.ts
                    leaderIsStale = driftSeconds > 30
                }

                // Widget becomes leader if: explicitly the leader, leader is stale, or no leader
                var shouldBeLeader = widgetIsLeader || leaderIsStale || !s.device_leader_id

                if (shouldBeLeader && !widgetIsLeader && leaderIsStale) {
                    // Claim leadership from stale leader
                    console.log("[SYNC] Claiming leadership - stale by", driftSeconds, "seconds")
                    patchSession({
                        device_leader_id: "kde-widget",
                        device_leader_last_seen: new Date().toISOString()
                    })
                }

                root.isDeviceLeader = shouldBeLeader

                if (shouldBeLeader) {
                    // Widget is leader - only update if we're not actively counting
                    // This prevents sync from overwriting our local countdown
                    if (!root.isRunning) {
                        root.secondsRemaining = s.remaining_time
                    }
                } else {
                    // Widget is follower - use DB value with drift correction
                    var baseTime = s.remaining_time

                    // TASK-1009 FIX: Apply drift correction based on leader's last heartbeat
                    if (s.device_leader_last_seen && !s.is_paused && driftSeconds > 0) {
                        // Apply drift correction (cap at 120 seconds to avoid huge jumps)
                        if (driftSeconds < 120) {
                            baseTime = Math.max(0, baseTime - driftSeconds)
                            if (root.debugLogging) console.log("[SYNC] Drift correction applied:", driftSeconds, "seconds, new time:", baseTime)
                        }
                    }

                    root.secondsRemaining = baseTime
                }

                root.isRunning = s.is_active && !s.is_paused
                root.writeActiveTaskFile()
            } else {
                // BUG-1292: Don't clear state during transition - notify.sh curl may still be in flight
                if (root.sessionJustCompleted || root.isInTransition) {
                    if (root.debugLogging) console.log("[SYNC] No session during transition - waiting for new session")
                } else if (root.hasActiveSession && root.isRunning && root.currentSessionId && !root.checkingCompletion) {
                    // BUG: Follower completion detection
                    // We had a running session but polling found nothing active
                    // Check if it completed naturally (another device finished it) vs manual stop
                    console.log("[SYNC] Active session disappeared - checking if completed by another device")
                    checkSessionCompletion(root.currentSessionId, root.isWorkSession)
                    // Don't clear state here - checkSessionCompletion will handle it
                } else {
                    // Only update nanny timestamp on actual transition (had session → no session)
                    if (root.hasActiveSession) {
                        root.nannyLastSessionEndTime = Date.now()  // TASK-1424
                    }
                    root.hasActiveSession = false
                    root.currentSessionId = ""
                    root.currentTaskId = ""  // TASK-1087: Clear active task
                    root.isRunning = false
                    root.isDeviceLeader = false
                    root.writeActiveTaskFile()
                }
            }
        }
        xhr.send()
    }

    function toggleTimer() {
        if (!root.isAuthenticated) return

        if (root.hasActiveSession) {
            // Pause/resume existing session - widget becomes leader
            patchSession({
                is_paused: root.isRunning,
                device_leader_id: "kde-widget",
                device_leader_last_seen: new Date().toISOString()
            })
            root.isRunning = !root.isRunning
            root.isDeviceLeader = true  // Widget takes control
        } else {
            // Start new work session
            startNewSession(false)
        }
    }

    function startNewSession(isBreak) {
        if (!root.isAuthenticated) return

        // Reset pre-end warning for new session
        root.preEndWarningShown = false

        // Clear session complete state
        root.sessionJustCompleted = false

        var sessionId = generateUUID()
        var duration = isBreak
            ? plasmoid.configuration.breakDuration * 60
            : plasmoid.configuration.workDuration * 60

        var payload = {
            id: sessionId,
            user_id: root.userId,  // Required for RLS
            task_id: "general",
            start_time: new Date().toISOString(),
            duration: duration,
            remaining_time: duration,
            is_active: true,
            is_paused: false,
            is_break: isBreak,
            device_leader_id: "kde-widget",
            device_leader_last_seen: new Date().toISOString()
        }

        if (root.debugLogging) console.log("[TIMER] Creating session with payload:", JSON.stringify(payload))

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/timer_sessions", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (root.debugLogging) console.log("[TIMER] POST response:", xhr.status, xhr.responseText)
                if (xhr.status === 201 || xhr.status === 200) {
                    root.currentSessionId = sessionId
                    root.totalSeconds = duration
                    root.secondsRemaining = duration
                    root.isRunning = true
                    root.isWorkSession = !isBreak
                    root.hasActiveSession = true
                    root.isDeviceLeader = true  // Widget is leader for new session
                    console.log("[TIMER] Started new session:", sessionId)
                } else {
                    console.error("[TIMER] Failed to create session:", xhr.status, xhr.responseText)
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    function startSessionForTask(taskId) {
        if (!root.isAuthenticated) return

        // Clear session complete state
        root.sessionJustCompleted = false

        var sessionId = generateUUID()
        var duration = plasmoid.configuration.workDuration * 60

        var payload = {
            id: sessionId,
            user_id: root.userId,  // Required for RLS
            task_id: taskId,
            start_time: new Date().toISOString(),
            duration: duration,
            remaining_time: duration,
            is_active: true,
            is_paused: false,
            is_break: false,
            device_leader_id: "kde-widget",
            device_leader_last_seen: new Date().toISOString()
        }

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/timer_sessions", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 201 || xhr.status === 200) {
                    root.currentSessionId = sessionId
                    root.totalSeconds = duration
                    root.secondsRemaining = duration
                    root.isRunning = true
                    root.isWorkSession = true
                    root.hasActiveSession = true
                    root.isDeviceLeader = true  // Widget is leader for new session
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    function switchTaskForSession(newTaskId) {
        if (!root.currentSessionId || !root.isRunning) return
        patchSession({ task_id: newTaskId })
        root.currentTaskId = newTaskId  // optimistic update (poll will confirm)
        console.log("[TIMER] Switched active session to task:", newTaskId)
    }

    function stopSession() {
        if (!root.hasActiveSession) return

        patchSession({
            is_active: false,
            completed_at: new Date().toISOString()
        })
        root.hasActiveSession = false
        root.isRunning = false
        root.currentSessionId = ""
        // TASK-1424: Reset nanny idle timer
        root.nannyLastSessionEndTime = Date.now()
    }

    function skipSession() {
        if (!root.hasActiveSession) return

        // Complete current and start opposite
        patchSession({
            is_active: false,
            completed_at: new Date().toISOString()
        })

        // Start new session with opposite type
        // If isWorkSession=true (work), pass true to start break
        // If isWorkSession=false (break), pass false to start work
        startNewSession(root.isWorkSession)
    }

    // TASK-1466: Reset timer — restart countdown for current task without changing task
    function resetSession() {
        if (!root.hasActiveSession) return

        var taskId = root.currentTaskId || "general"
        var isBreak = !root.isWorkSession

        // End current session
        patchSession({
            is_active: false,
            completed_at: new Date().toISOString()
        })

        // Start fresh session for the same task
        if (taskId !== "general") {
            startSessionForTask(taskId)
        } else {
            startNewSession(isBreak)
        }
    }

    function onSessionComplete() {
        // Guard: prevent duplicate notifications (barrage fix)
        // sessionJustCompleted is set to true below, cleared on user action or new session
        if (root.sessionJustCompleted) {
            console.log("[TIMER] Duplicate onSessionComplete call - ignoring")
            return
        }
        root.isRunning = false
        root.completedSessions++
        // Reset pre-end warning so next session can show it
        root.preEndWarningShown = false

        if (root.completedSessions >= root.maxSessions) {
            root.completedSessions = 0
        }

        // Complete current session on server
        if (root.currentSessionId) {
            patchSession({
                is_active: false,
                remaining_time: 0,
                completed_at: new Date().toISOString()
            })
        }

        // Track what type of session just completed for action buttons
        root.lastCompletedWasWork = root.isWorkSession
        root.sessionJustCompleted = true
        // BUG-1347: Use reactive timer instead of Date.now() epoch comparison
        root.isInTransition = true
        transitionTimer.restart()

        // Show system notification (sound + action buttons via notify-send)
        showTimerNotification(root.isWorkSession)
        // Show full-screen overlay on widget's screen (rich QML with Start Break/Work + Postpone)
        showFullScreenOverlay()
        console.log("[TIMER] Session complete, notification + overlay triggered")

        // TASK-1424: Update nanny timestamp so idle timer resets
        root.nannyLastSessionEndTime = Date.now()

        // Clear session state - wait for user action
        root.hasActiveSession = false
        root.currentSessionId = ""
        root.isDeviceLeader = false
    }

    // TASK-1009: Postpone timer by adding more time
    function postponeTimer(seconds) {
        console.log("[TIMER] Postponing by", seconds, "seconds")

        // Create a new session with the postpone duration
        // Maintain the same session type (work or break)
        var sessionId = generateUUID()
        var isBreak = !root.isWorkSession  // Was work session, now break (or vice versa)

        // Actually, for postpone we want to continue the SAME type of session
        // If user was on a work session and it ended, postpone means +5 min more work
        // The notification text says "Time for break" but user chose postpone instead
        isBreak = root.isWorkSession ? false : true  // Postpone continues the CURRENT type

        var payload = {
            id: sessionId,
            user_id: root.userId,
            task_id: "general",
            start_time: new Date().toISOString(),
            duration: seconds,
            remaining_time: seconds,
            is_active: true,
            is_paused: false,
            is_break: !root.isWorkSession,  // If was work, postpone is still work (before break)
            device_leader_id: "kde-widget",
            device_leader_last_seen: new Date().toISOString()
        }

        if (root.debugLogging) console.log("[TIMER] Creating postpone session:", JSON.stringify(payload))

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/timer_sessions", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (root.debugLogging) console.log("[TIMER] Postpone response:", xhr.status, xhr.responseText)
                if (xhr.status === 201 || xhr.status === 200) {
                    root.currentSessionId = sessionId
                    root.totalSeconds = seconds
                    root.secondsRemaining = seconds
                    root.isRunning = true
                    // Keep the same session type for postpone
                    // If was work session (isWorkSession=true), postpone continues work
                    root.hasActiveSession = true
                    root.isDeviceLeader = true
                    console.log("[TIMER] Postpone session started:", sessionId)
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    function patchSession(data) {
        if (!root.currentSessionId) return

        var xhr = new XMLHttpRequest()
        xhr.open("PATCH", root.supabaseUrl + "/rest/v1/timer_sessions?id=eq." + root.currentSessionId, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.send(JSON.stringify(data))
    }

    function sendHeartbeat() {
        if (!root.currentSessionId || !root.isRunning) return

        patchSession({
            remaining_time: root.secondsRemaining,
            device_leader_id: "kde-widget",
            device_leader_last_seen: new Date().toISOString()
        })
    }

    // ===== TASK FUNCTIONS =====

    function markTaskDone(taskId) {
        if (!root.isAuthenticated || !taskId) return

        console.log("[TASKS] Marking task done:", taskId)

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/tasks?id=eq." + taskId

        xhr.open("PATCH", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200 || xhr.status === 204) {
                    console.log("[TASKS] Task marked done successfully")
                    // Refresh task list to remove the completed task
                    root.fetchTasks()
                } else {
                    console.log("[TASKS] Error marking done:", xhr.status, xhr.responseText)
                }
            }
        }

        xhr.send(JSON.stringify({ status: "done" }))
    }

    // ===== TASK-1429: SAVE INLINE TASK EDIT =====
    function saveTaskEdit(taskId, status, priority, dueDate) {
        if (!root.isAuthenticated || !taskId) return

        root.isSavingEdit = true
        root.editError = ""

        console.log("[TASKS] Saving task edit:", taskId, "status:", status, "priority:", priority, "due:", dueDate)

        // Build payload - only include changed fields
        var payload = {
            updated_at: new Date().toISOString()
        }

        if (status) payload.status = status
        if (priority && priority !== "none") {
            payload.priority = priority
        } else if (priority === "none") {
            payload.priority = null
        }

        // Handle due date - validate or null
        if (dueDate && dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            payload.due_date = dueDate + "T00:00:00"
        } else if (!dueDate || dueDate.replace(/_/g, "").replace(/-/g, "").trim() === "") {
            payload.due_date = null
        }

        // Optimistic update - modify local tasks array
        var oldTasks = root.tasks.slice()
        var newTasks = root.tasks.slice()
        for (var i = 0; i < newTasks.length; i++) {
            if (newTasks[i].id === taskId) {
                var updated = Object.assign({}, newTasks[i])
                if (payload.status) updated.status = payload.status
                if (payload.priority !== undefined) updated.priority = payload.priority
                if (payload.due_date !== undefined) updated.due_date = payload.due_date
                newTasks[i] = updated
                break
            }
        }
        root.tasks = newTasks

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/tasks?id=eq." + taskId

        xhr.open("PATCH", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isSavingEdit = false
                if (xhr.status === 200 || xhr.status === 204) {
                    console.log("[TASKS] Task edit saved successfully")
                    root.editingTaskId = ""
                    root.editError = ""
                    // Refresh to get latest data
                    root.fetchTasks()
                } else {
                    console.log("[TASKS] Error saving edit:", xhr.status, xhr.responseText)
                    root.editError = "Save failed: " + xhr.status
                    // Revert optimistic update
                    root.tasks = oldTasks
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    // ===== TASK-1429: DELETE TASK PERMANENTLY =====
    function deleteTaskPermanently(taskId) {
        if (!root.isAuthenticated || !taskId) return

        console.log("[TASKS] Permanently deleting task:", taskId)
        root.isSavingEdit = true

        // Optimistic: remove from local list immediately
        var oldTasks = root.tasks.slice()
        var newTasks = []
        for (var i = 0; i < root.tasks.length; i++) {
            if (root.tasks[i].id !== taskId) newTasks.push(root.tasks[i])
        }
        root.tasks = newTasks
        root.editingTaskId = ""
        root.confirmingDelete = false

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/tasks?id=eq." + taskId

        // Soft-delete to match web app behavior (is_deleted + deleted_at)
        xhr.open("PATCH", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isSavingEdit = false
                if (xhr.status === 200 || xhr.status === 204) {
                    console.log("[TASKS] Task soft-deleted successfully")
                    root.fetchTasks()
                } else {
                    console.log("[TASKS] Error deleting task:", xhr.status, xhr.responseText)
                    root.editError = "Delete failed: " + xhr.status
                    // Revert optimistic removal
                    root.tasks = oldTasks
                }
            }
        }

        xhr.send(JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() }))
    }

    // ===== TASK-1473: SEARCH FILTER =====
    function updateDisplayTasks() {
        if (!root.taskSearchQuery) {
            root.displayTasks = root.tasks
            return
        }
        var query = root.taskSearchQuery.toLowerCase()
        var result = []
        for (var i = 0; i < root.tasks.length; i++) {
            var task = root.tasks[i]
            if (task.isHeader) {
                var hasMatch = false
                for (var j = i + 1; j < root.tasks.length; j++) {
                    if (root.tasks[j].isHeader) break
                    if (root.tasks[j].title && root.tasks[j].title.toLowerCase().indexOf(query) !== -1) {
                        hasMatch = true
                        break
                    }
                }
                if (hasMatch) result.push(task)
            } else if (task.title && task.title.toLowerCase().indexOf(query) !== -1) {
                result.push(task)
            }
        }
        root.displayTasks = result
    }

    function fetchTasks() {
        if (!root.isAuthenticated) return
        taskListRefreshTimer.restart()

        root.isLoadingTasks = true

        var xhr = new XMLHttpRequest()

        // Build dynamic URL based on sort/filter options
        var url = root.supabaseUrl + "/rest/v1/tasks?select=id,title,status,priority,due_date,position,parent_id,project_id"

        // Apply filter
        if (root.taskFilter === "all") {
            url += "&status=neq.done"
        } else if (root.taskFilter === "todo") {
            // BUG-1451: DB stores 'planned' not 'todo' (toDbStatus mapping)
            url += "&status=eq.planned"
        } else if (root.taskFilter === "in_progress") {
            // BUG-1451: DB stores 'planned' for in_progress too (toDbStatus fallback)
            // This filter effectively shows same as "todo" until DB migration adds 'in_progress'
            url += "&status=eq.planned"
        } else if (root.taskFilter === "on_canvas") {
            url += "&status=neq.done"
            url += "&position=not.is.null"
        }

        // Apply todayOnly AND filter (combines with any dropdown filter)
        if (root.todayOnly) {
            var td = new Date()
            var y = td.getFullYear()
            var m = String(td.getMonth() + 1).padStart(2, '0')
            var d = String(td.getDate()).padStart(2, '0')
            var ds = y + '-' + m + '-' + d
            url += "&due_date=gte." + ds + "T00:00:00&due_date=lt." + ds + "T23:59:59"
        }

        // Always exclude deleted tasks
        url += "&is_deleted=eq.false"

        // Apply sort order
        if (root.taskSortBy === "created_desc") {
            url += "&order=created_at.desc"
        } else if (root.taskSortBy === "created_asc") {
            url += "&order=created_at.asc"
        } else if (root.taskSortBy === "title_asc") {
            url += "&order=title.asc"
        } else if (root.taskSortBy === "priority_desc") {
            // Priority: P0 (critical) > P1 > P2 > P3 > P4 (backlog)
            // In Supabase, lower number = higher priority, so sort ascending
            url += "&order=priority.asc.nullslast"
        } else if (root.taskSortBy === "canvas_order") {
            // TASK-1499: Server can't sort by JSONB nested fields properly, use client-side sort
            url += "&order=created_at.desc"
        } else if (root.taskSortBy === "project") {
            // TASK-1454: Group by project — server sorts by project_id, client injects headers
            url += "&order=project_id.asc.nullslast,created_at.desc"
        }

        // Limit results (TASK-1454: bumped from 20 to 100)
        url += "&limit=100"

        if (root.debugLogging) console.log("[TASKS] Fetching with URL:", url)

        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isLoadingTasks = false
                if (xhr.status === 200) {
                    root.tasks = JSON.parse(xhr.responseText)
                    if (root.debugLogging) console.log("[TASKS] Loaded", root.tasks.length, "tasks")
                    // TASK-1454: Inject project group headers if project sort is active
                    if (root.taskSortBy === "project" && Object.keys(root.projects).length > 0) {
                        root.groupTasksByProject()
                    }
                    // TASK-1499: Client-side canvas order sorting
                    if (root.taskSortBy === "canvas_order" || root.taskFilter === "on_canvas") {
                        root.sortTasksByCanvasOrder()
                    }
                    root.updateDisplayTasks()
                    root.writeActiveTaskFile()
                    root.buildNannyTaskList()
                } else if (xhr.status === 401) {
                    console.log("[TASKS] Token expired, refreshing...")
                    root.refreshAccessToken()
                } else {
                    console.log("[TASKS] Error:", xhr.status, xhr.responseText)
                }
            }
        }
        xhr.send()
    }

    // ===== TASK-1454: PROJECT FETCHING & GROUPING =====

    function fetchProjects() {
        if (!root.isAuthenticated || !root.userId) return

        root.isLoadingProjects = true
        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/projects?select=id,name,color,color_type&is_deleted=eq.false&user_id=eq." + root.userId
        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isLoadingProjects = false
                if (xhr.status === 200) {
                    var list = JSON.parse(xhr.responseText)
                    var map = {}
                    for (var i = 0; i < list.length; i++) {
                        map[list[i].id] = {
                            name: list[i].name || "Unnamed",
                            color: list[i].color || "",
                            colorType: list[i].color_type || "preset"
                        }
                    }
                    root.projects = map
                    if (root.debugLogging) console.log("[PROJECTS] Loaded", list.length, "projects")
                    // If tasks already loaded and sort is project, trigger grouping
                    if (root.tasks.length > 0 && root.taskSortBy === "project") {
                        root.groupTasksByProject()
                        root.updateDisplayTasks()
                    }
                } else if (xhr.status === 401) {
                    console.log("[PROJECTS] Token expired, refreshing...")
                    root.refreshAccessToken()
                } else {
                    console.log("[PROJECTS] Error:", xhr.status, xhr.responseText)
                }
            }
        }
        xhr.send()
    }

    function groupTasksByProject() {
        if (root.taskSortBy !== "project") return

        // Filter out any existing headers (re-grouping scenario)
        var realTasks = []
        for (var i = 0; i < root.tasks.length; i++) {
            if (!root.tasks[i].isHeader) realTasks.push(root.tasks[i])
        }

        // Build project buckets
        var buckets = {}  // projectId -> [tasks]
        var ungrouped = []
        for (var j = 0; j < realTasks.length; j++) {
            var t = realTasks[j]
            var pid = t.project_id
            if (pid && root.projects[pid]) {
                if (!buckets[pid]) buckets[pid] = []
                buckets[pid].push(t)
            } else {
                ungrouped.push(t)
            }
        }

        // Sort project IDs by project name
        var projectIds = Object.keys(buckets)
        projectIds.sort(function(a, b) {
            var nameA = (root.projects[a]?.name || "").toLowerCase()
            var nameB = (root.projects[b]?.name || "").toLowerCase()
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0
        })

        // Build final list with headers
        var result = []
        for (var k = 0; k < projectIds.length; k++) {
            var projId = projectIds[k]
            var proj = root.projects[projId]
            result.push({
                isHeader: true,
                projectName: proj.name,
                projectColor: proj.color,
                projectColorType: proj.colorType
            })
            var tasks = buckets[projId]
            for (var l = 0; l < tasks.length; l++) {
                result.push(tasks[l])
            }
        }

        // Ungrouped at the end
        if (ungrouped.length > 0) {
            result.push({
                isHeader: true,
                projectName: "Ungrouped",
                projectColor: "",
                projectColorType: ""
            })
            for (var m = 0; m < ungrouped.length; m++) {
                result.push(ungrouped[m])
            }
        }

        root.tasks = result
        if (root.debugLogging) console.log("[PROJECTS] Grouped tasks into", projectIds.length + (ungrouped.length > 0 ? 1 : 0), "sections")
    }

    // TASK-1499: Sort canvas tasks by group + Y position (mirrors Vue app canvas sort)
    function sortTasksByCanvasOrder() {
        // Filter out any existing headers (not expected here, but defensive)
        var realTasks = []
        for (var i = 0; i < root.tasks.length; i++) {
            if (!root.tasks[i].isHeader) realTasks.push(root.tasks[i])
        }

        // Build buckets by canvas group (position.parentId inside JSONB)
        var buckets = {}  // parentId -> [tasks]
        var ungrouped = []
        for (var j = 0; j < realTasks.length; j++) {
            var t = realTasks[j]
            var groupId = t.position ? t.position.parentId : null
            if (groupId) {
                if (!buckets[groupId]) buckets[groupId] = []
                buckets[groupId].push(t)
            } else {
                ungrouped.push(t)
            }
        }

        // Sort tasks within each bucket by Y position (top to bottom)
        var sortByY = function(a, b) {
            var ay = (a.position && a.position.y !== undefined) ? a.position.y : 99999
            var by = (b.position && b.position.y !== undefined) ? b.position.y : 99999
            return ay - by
        }

        var groupIds = Object.keys(buckets)
        for (var g = 0; g < groupIds.length; g++) {
            buckets[groupIds[g]].sort(sortByY)
        }
        ungrouped.sort(sortByY)

        // Sort group IDs by first task's X position descending (rightmost group first)
        groupIds.sort(function(a, b) {
            var ax = buckets[a][0] && buckets[a][0].position ? buckets[a][0].position.x : 0
            var bx = buckets[b][0] && buckets[b][0].position ? buckets[b][0].position.x : 0
            return bx - ax
        })

        // Build final list: grouped tasks first, then ungrouped
        var result = []
        for (var k = 0; k < groupIds.length; k++) {
            var tasks = buckets[groupIds[k]]
            for (var l = 0; l < tasks.length; l++) {
                result.push(tasks[l])
            }
        }
        for (var m = 0; m < ungrouped.length; m++) {
            result.push(ungrouped[m])
        }

        root.tasks = result
        if (root.debugLogging) console.log("[CANVAS] Sorted", realTasks.length, "tasks by canvas order:", groupIds.length, "groups +", ungrouped.length, "ungrouped")
    }

    // ===== QUICK TASK CREATION =====

    function createTask(title, startTimer) {
        if (!root.isAuthenticated || !title.trim()) return

        var taskId = generateUUID()
        var now = new Date().toISOString()

        var payload = {
            id: taskId,
            user_id: root.userId,
            title: title.trim(),
            status: "planned",
            is_in_inbox: true,
            is_deleted: false,
            created_at: now,
            updated_at: now
        }

        // TASK-1447: Attach due date from quick-add dropdown
        if (root.quickAddDueDate && root.quickAddDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            payload.due_date = root.quickAddDueDate + "T00:00:00"
        }

        console.log("[TASKS] Creating task:", title, "due:", root.quickAddDueDate || "none")

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/tasks", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 201 || xhr.status === 200) {
                    console.log("[TASKS] Task created:", taskId)
                    root.fetchTasks()
                    if (startTimer) {
                        // TASK-1466: If timer running, switch task without reset
                        if (root.hasActiveSession && root.isRunning) {
                            root.switchTaskForSession(taskId)
                        } else {
                            root.startSessionForTask(taskId)
                        }
                    }
                } else {
                    console.error("[TASKS] Failed to create task:", xhr.status, xhr.responseText)
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    // ===== PINNED TASKS FUNCTIONS =====

    function fetchPinnedTasks() {
        if (!root.isAuthenticated) return
        pinnedTasksRefreshTimer.restart()

        root.isLoadingPinnedTasks = true

        var xhr = new XMLHttpRequest()
        // TASK-1373: Include project_id for optional config-based filtering
        var filterProjectId = plasmoid.configuration.filterProjectId || ""
        var url = root.supabaseUrl + "/rest/v1/pinned_tasks?user_id=eq." + root.userId + "&order=sort_order.asc&select=id,title,sort_order,project_id"

        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                root.isLoadingPinnedTasks = false
                if (xhr.status === 200) {
                    var allPins = JSON.parse(xhr.responseText)
                    // TASK-1373: Client-side project filter — show universal (no project) + matching project
                    if (filterProjectId) {
                        var filtered = []
                        for (var i = 0; i < allPins.length; i++) {
                            var pin = allPins[i]
                            if (!pin.project_id || pin.project_id === filterProjectId) {
                                filtered.push(pin)
                            }
                        }
                        root.pinnedTasks = filtered
                        if (root.debugLogging) console.log("[PINS] Loaded", allPins.length, "pinned tasks, filtered to", filtered.length, "for project", filterProjectId)
                    } else {
                        root.pinnedTasks = allPins
                        if (root.debugLogging) console.log("[PINS] Loaded", allPins.length, "pinned tasks")
                    }
                    root.buildNannyTaskList()
                } else if (xhr.status === 401) {
                    console.log("[PINS] Token expired, refreshing...")
                    root.refreshAccessToken()
                } else {
                    console.error("[PINS] Error:", xhr.status, xhr.responseText)
                }
            }
        }
        xhr.send()
    }

    function selectPinnedTask(pin) {
        if (!root.isAuthenticated) return

        // Search loaded tasks for a title match (case-insensitive, not done, not deleted)
        var matchId = ""
        for (var i = 0; i < root.tasks.length; i++) {
            var t = root.tasks[i]
            if (t.title && t.title.toLowerCase() === pin.title.toLowerCase()) {
                matchId = t.id
                break
            }
        }

        if (matchId) {
            console.log("[PINS] Found matching task:", matchId)
            // TASK-1466: If timer running, switch task without reset
            if (root.hasActiveSession && root.isRunning) {
                if (root.currentTaskId !== matchId) {
                    root.switchTaskForSession(matchId)
                }
                // Same task — do nothing (don't reset)
            } else {
                root.startSessionForTask(matchId)
            }
        } else {
            console.log("[PINS] No match, creating new task:", pin.title)
            root.createTask(pin.title, true)
        }
    }

    function pinTask(title) {
        if (!root.isAuthenticated || !title.trim()) return

        // Check if already pinned
        for (var i = 0; i < root.pinnedTasks.length; i++) {
            if (root.pinnedTasks[i].title.toLowerCase() === title.trim().toLowerCase()) {
                console.log("[PINS] Already pinned:", title)
                return
            }
        }

        var payload = {
            user_id: root.userId,
            title: title.trim(),
            sort_order: root.pinnedTasks.length
        }

        var xhr = new XMLHttpRequest()
        xhr.open("POST", root.supabaseUrl + "/rest/v1/pinned_tasks", true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("Prefer", "return=representation")

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 201 || xhr.status === 200) {
                    console.log("[PINS] Pinned:", title)
                    root.fetchPinnedTasks()
                } else {
                    console.error("[PINS] Pin failed:", xhr.status, xhr.responseText)
                }
            }
        }

        xhr.send(JSON.stringify(payload))
    }

    function unpinTask(pinId) {
        if (!root.isAuthenticated || !pinId) return

        var xhr = new XMLHttpRequest()
        xhr.open("DELETE", root.supabaseUrl + "/rest/v1/pinned_tasks?id=eq." + pinId, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200 || xhr.status === 204) {
                    console.log("[PINS] Unpinned:", pinId)
                    root.fetchPinnedTasks()
                }
            }
        }

        xhr.send()
    }

    // ===== NANNY TASK LIST BUILDER (TASK-1475) =====

    // BUG-1498: Fetch ALL non-done tasks for the nanny popup, independent of widget filters.
    // Optional callback is invoked after the fetch completes.
    function fetchNannyTasks(callback) {
        if (!root.isAuthenticated) {
            if (callback) callback()
            return
        }

        var xhr = new XMLHttpRequest()
        var url = root.supabaseUrl + "/rest/v1/tasks?select=id,title,status,priority,due_date,project_id&status=neq.done&is_deleted=eq.false&order=due_date.asc.nullslast,created_at.desc&limit=100"
        xhr.open("GET", url, true)
        xhr.setRequestHeader("apikey", root.supabaseKey)
        xhr.setRequestHeader("Authorization", "Bearer " + root.accessToken)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    root.nannyAllTasks = JSON.parse(xhr.responseText)
                    console.log("[NANNY] Fetched", root.nannyAllTasks.length, "unfiltered tasks for nanny popup")
                } else {
                    console.log("[NANNY] Unfiltered fetch failed (status=" + xhr.status + "), keeping cached list. Response: " + xhr.responseText.substring(0, 200))
                }
                if (callback) callback()
            }
        }
        xhr.send()
    }

    function buildNannyTaskList() {
        // Reset hidden list if day changed
        var today = new Date()
        var dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
        if (dayOfYear !== root.nannyHiddenDate) {
            root.nannyHiddenToday = ({})
            root.nannyHiddenDate = dayOfYear
        }

        // BUG-1498: Use unfiltered task cache; fall back to widget tasks if empty
        if (root.nannyAllTasks.length === 0) {
            console.log("[NANNY] WARNING: nannyAllTasks empty, falling back to widget tasks (" + root.tasks.length + " tasks)")
        }
        var allTasks = root.nannyAllTasks.length > 0 ? root.nannyAllTasks : root.tasks
        _buildNannyTaskListFromTasks(allTasks)
    }

    function _buildNannyTaskListFromTasks(allTasks) {
        var combined = []
        var pinnedTitles = {}
        var maxItems = 15

        // Helper: look up task details from fetched tasks by title match
        function findTaskByTitle(title) {
            for (var k = 0; k < allTasks.length; k++) {
                if (allTasks[k].title && allTasks[k].title.toLowerCase() === title.toLowerCase()) {
                    return allTasks[k]
                }
            }
            return null
        }

        // Helper: get project info
        function getProjectInfo(projectId) {
            if (!projectId || !root.projects[projectId]) return { name: "", color: "" }
            var p = root.projects[projectId]
            return { name: p.name || "", color: p.color || "" }
        }

        // Helper: format priority
        function priorityLabel(p) {
            if (p === "high") return "P1"
            if (p === "medium") return "P2"
            if (p === "low") return "P3"
            return ""
        }

        function priorityColor(p) {
            if (p === "high") return "#FF6B6B"
            if (p === "medium") return "#FFD93D"
            if (p === "low") return "#6BCB77"
            return root.mutedColor
        }

        // 1. Add pinned tasks first (with details from matching task)
        for (var i = 0; i < root.pinnedTasks.length && combined.length < maxItems; i++) {
            var pin = root.pinnedTasks[i]
            // Skip if hidden today
            if (root.nannyHiddenToday[pin.id]) continue

            var matchedTask = findTaskByTitle(pin.title)
            var proj = getProjectInfo(pin.project_id || (matchedTask ? matchedTask.project_id : ""))
            var prio = matchedTask ? matchedTask.priority : ""
            var dueDate = matchedTask ? matchedTask.due_date : ""

            combined.push({
                title: pin.title,
                taskId: matchedTask ? matchedTask.id : pin.id,
                pinId: pin.id,
                isPinned: true,
                source: "pinned",
                projectName: proj.name,
                projectColor: proj.color,
                priority: prio,
                priorityLabel: priorityLabel(prio),
                priorityColor: priorityColor(prio),
                dueDate: dueDate
            })
            pinnedTitles[pin.title.toLowerCase()] = true
        }

        // 2. Fill remaining slots with recent non-pinned, non-done tasks
        if (combined.length < maxItems && allTasks.length > 0) {
            for (var j = 0; j < allTasks.length && combined.length < maxItems; j++) {
                var task = allTasks[j]
                if (!task || !task.title) continue
                if (pinnedTitles[task.title.toLowerCase()]) continue
                if (task.status === "done") continue
                if (root.nannyHiddenToday[task.id]) continue

                var tProj = getProjectInfo(task.project_id)

                combined.push({
                    title: task.title,
                    taskId: task.id,
                    pinId: "",
                    isPinned: false,
                    source: "recent",
                    projectName: tProj.name,
                    projectColor: tProj.color,
                    priority: task.priority || "",
                    priorityLabel: priorityLabel(task.priority),
                    priorityColor: priorityColor(task.priority),
                    dueDate: task.due_date || ""
                })
            }
        }

        // 3. Group by project and inject header items
        // Sort tasks by projectName (keep relative order within each project)
        combined.sort(function(a, b) {
            var pA = a.projectName || ""
            var pB = b.projectName || ""
            // "No Project" (empty) goes last
            if (pA === "" && pB !== "") return 1
            if (pA !== "" && pB === "") return -1
            if (pA < pB) return -1
            if (pA > pB) return 1
            return 0
        })

        // Inject header items before each project group
        var grouped = []
        var lastProject = null
        for (var g = 0; g < combined.length; g++) {
            var projName = combined[g].projectName || ""
            var projColor = combined[g].projectColor || ""
            var groupKey = projName || "__no_project__"
            if (groupKey !== lastProject) {
                grouped.push({
                    isHeader: true,
                    projectName: projName || "No Project",
                    projectColor: projColor
                })
                lastProject = groupKey
            }
            grouped.push(combined[g])
        }

        root.nannyTaskList = grouped
        if (root.debugLogging) console.log("[NANNY-LIST] Built", combined.length, "tasks +", (grouped.length - combined.length), "headers =", grouped.length, "items")
    }

    function hideNannyTask(itemId) {
        var hidden = root.nannyHiddenToday
        hidden[itemId] = true
        root.nannyHiddenToday = hidden
        root.buildNannyTaskList()
        console.log("[NANNY-LIST] Hidden task for today:", itemId)
    }

    // ===== HELPERS =====

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0
            var v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }

    // ===== LOGIN TRIGGER WATCHER =====
    // Watches for login trigger from config page

    property string _lastLoginTrigger: ""

    Connections {
        target: plasmoid.configuration

        function onLoginTriggerChanged() {
            var trigger = plasmoid.configuration.loginTrigger

            // Skip if empty or same as last (prevent loops)
            if (!trigger || trigger === root._lastLoginTrigger) {
                return
            }

            root._lastLoginTrigger = trigger

            if (trigger === "SIGNOUT") {
                // Sign out requested
                root.signOut()
                plasmoid.configuration.loginTrigger = ""
            } else if (trigger.includes(":")) {
                // Sign in requested - format is "email:password"
                var colonIndex = trigger.indexOf(":")
                var email = trigger.substring(0, colonIndex)
                var password = trigger.substring(colonIndex + 1)

                if (email && password) {
                    root.signIn(email, password)
                }

                // Clear trigger immediately (password should not persist)
                plasmoid.configuration.loginTrigger = ""
            }
        }
    }

    // ===== CLOSE MENUS ON POPUP TOGGLE =====
    onExpandedChanged: {
        // Close dropdown menus when popup closes
        if (!expanded) {
            if (typeof filterMenu !== "undefined" && filterMenu) filterMenu.visible = false
            if (typeof sortMenu !== "undefined" && sortMenu) sortMenu.visible = false
        }
    }

    // ===== INITIALIZATION =====

    Component.onCompleted: {
        root.loadAuthTokens()
        if (root.refreshToken !== "") {
            // TASK-1060: Always refresh token on startup to ensure it's valid
            // This prevents stale tokens from causing sync failures
            console.log("[AUTH] Refreshing token on startup...")
            root.refreshAccessToken()
        }
    }
}
