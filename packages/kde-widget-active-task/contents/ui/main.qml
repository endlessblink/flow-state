import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    // Force compact representation in panel
    preferredRepresentation: compactRepresentation

    // ===== COLORS (matching main PomoFlow widget) =====
    readonly property color workColor: "#4ECDC4"
    readonly property color breakColor: "#F59E0B"
    readonly property color bgColor: "#232034"
    readonly property color textColor: "#E2E8F0"
    readonly property color textSecondary: "#CBD5E1"
    readonly property color mutedColor: "#7E7590"

    // ===== STATE (from temp file) =====
    property string taskName: ""
    property string taskId: ""
    property bool isActive: false
    property bool isWork: true
    property string timeDisplay: ""
    property real progress: 0.0

    readonly property color accentColor: isWork ? workColor : breakColor
    readonly property bool showPill: isActive && taskName !== ""

    // ===== SHELL DATASOURCE (reads temp file) =====
    Plasma5Support.DataSource {
        id: fileReader
        engine: "executable"
        connectedSources: []
        onNewData: function(sourceName, data) {
            var stdout = data["stdout"] || ""
            disconnectSource(sourceName)

            if (stdout.trim()) {
                try {
                    var parsed = JSON.parse(stdout.trim())
                    root.taskName = parsed.taskName || ""
                    root.taskId = parsed.taskId || ""
                    root.isActive = !!parsed.isActive
                    root.isWork = parsed.isWork !== undefined ? !!parsed.isWork : true
                    root.timeDisplay = parsed.timeDisplay || ""
                    root.progress = parsed.progress || 0.0
                } catch(e) {
                    console.log("[ACTIVETASK] Parse error:", e)
                }
            }
        }
    }

    function readTaskFile() {
        fileReader.connectSource("cat /tmp/flowstate-active-task.json 2>/dev/null")
    }

    // ===== POLL TIMER =====
    Timer {
        id: pollTimer
        interval: 2000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: root.readTaskFile()
    }

    // ===== COMPACT REPRESENTATION (PANEL) =====
    compactRepresentation: MouseArea {
        id: compactRoot

        Layout.fillHeight: true
        Layout.minimumWidth: root.showPill ? taskLabel.implicitWidth + 24 : 8
        Layout.preferredWidth: root.showPill ? taskLabel.implicitWidth + 24 : 8
        Layout.maximumWidth: 220

        hoverEnabled: true
        property bool wasExpanded: false
        onPressed: wasExpanded = root.expanded
        onClicked: root.expanded = !wasExpanded

        // Glass pill background (visible when task is active)
        Rectangle {
            anchors.centerIn: parent
            width: parent.width
            height: Math.min(parent.height - 4, 22)
            radius: height / 2
            color: Qt.rgba(0.137, 0.125, 0.204, 0.65)
            border.color: Qt.rgba(1.0, 1.0, 1.0, 0.1)
            border.width: 1
            visible: root.showPill

            Row {
                anchors.centerIn: parent
                spacing: 5

                // Accent dot
                Rectangle {
                    width: 5
                    height: 5
                    radius: 2.5
                    color: root.accentColor
                    anchors.verticalCenter: parent.verticalCenter
                }

                // Task name
                Text {
                    id: taskLabel
                    text: root.taskName
                    color: root.textColor
                    font.pixelSize: 11
                    font.weight: Font.Medium
                    elide: Text.ElideRight
                    maximumLineCount: 1
                    width: Math.min(implicitWidth, 180)
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        // Idle: tiny muted dot (minimal footprint)
        Rectangle {
            anchors.centerIn: parent
            width: 4
            height: 4
            radius: 2
            color: root.mutedColor
            opacity: 0.4
            visible: !root.showPill
        }
    }

    // ===== FULL REPRESENTATION (POPUP) =====
    fullRepresentation: Rectangle {
        Layout.minimumWidth: 260
        Layout.minimumHeight: root.isActive ? 110 : 70
        Layout.preferredWidth: 280
        Layout.preferredHeight: root.isActive ? 130 : 80

        color: root.bgColor
        radius: 12

        Column {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 10

            Text {
                text: "ACTIVE TASK"
                color: root.mutedColor
                font.pixelSize: 10
                font.weight: Font.Medium
                font.letterSpacing: 1.5
            }

            Text {
                text: root.isActive && root.taskName !== "" ? root.taskName : "No active task"
                color: root.isActive ? root.textColor : root.mutedColor
                font.pixelSize: 13
                font.weight: root.isActive ? Font.DemiBold : Font.Normal
                wrapMode: Text.WordWrap
                width: parent.width
            }

            Column {
                width: parent.width
                spacing: 6
                visible: root.isActive

                Row {
                    spacing: 6

                    Rectangle {
                        width: 7
                        height: 7
                        radius: 3.5
                        color: root.accentColor
                        anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                        text: root.isWork ? "Working" : "Break"
                        color: root.accentColor
                        font.pixelSize: 11
                        font.weight: Font.Medium
                    }

                    Text {
                        text: root.timeDisplay
                        color: root.textSecondary
                        font.pixelSize: 11
                    }
                }

                Rectangle {
                    width: parent.width
                    height: 3
                    radius: 1.5
                    color: Qt.rgba(1.0, 1.0, 1.0, 0.06)

                    Rectangle {
                        width: parent.width * root.progress
                        height: parent.height
                        radius: parent.radius
                        color: root.accentColor
                        opacity: 0.8

                        Behavior on width {
                            NumberAnimation { duration: 500; easing.type: Easing.OutCubic }
                        }
                    }
                }
            }
        }
    }
}
