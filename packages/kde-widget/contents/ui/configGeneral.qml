import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kcmutils as KCM

KCM.SimpleKCM {
    id: configPage

    property alias cfg_supabaseUrl: supabaseUrlField.text
    property alias cfg_supabaseAnonKey: supabaseKeyField.text
    property alias cfg_workDuration: workDurationSpinBox.value
    property alias cfg_breakDuration: breakDurationSpinBox.value
    property alias cfg_longBreakDuration: longBreakDurationSpinBox.value
    property alias cfg_sessionsBeforeLongBreak: sessionsSpinBox.value
    property alias cfg_showTaskList: showTaskListCheckBox.checked
    property alias cfg_showCurrentBlock: showCurrentBlockCheckBox.checked

    // Nanny (Focus Reminder) settings
    property alias cfg_nannyEnabled: nannyEnabledCheckBox.checked
    property string cfg_nannyWorkDays: "0,1,2,3,4,5"
    property alias cfg_nannyStartHour: nannyStartHourSpinBox.value
    property alias cfg_nannyEndHour: nannyEndHourSpinBox.value
    property int cfg_nannyIntervalMinutes: 60
    property string cfg_nannyTone: "gentle"
    property alias cfg_storageEmail: emailField.text
    property alias cfg_loginTrigger: loginTriggerField.text

    // Read-only display of auth status
    property string cfg_storageAccessToken: ""

    // Open App settings
    property string cfg_openAppMode: "web"
    property alias cfg_appUrl: appUrlField.text
    property alias cfg_tauriAppPath: tauriAppPathField.text

    Kirigami.FormLayout {
        anchors.fill: parent

        // Account Section
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Account"
        }

        // Auth status
        RowLayout {
            Kirigami.FormData.label: "Status:"
            spacing: 8

            Rectangle {
                width: 10
                height: 10
                radius: 5
                color: configPage.cfg_storageAccessToken !== "" ? "#22C55E" : "#EF4444"
            }

            QQC2.Label {
                text: configPage.cfg_storageAccessToken !== "" ? "Signed in" : "Not signed in"
            }
        }

        QQC2.TextField {
            id: emailField
            Kirigami.FormData.label: "Email:"
            placeholderText: "your@email.com"
            Layout.fillWidth: true
        }

        QQC2.TextField {
            id: passwordField
            Kirigami.FormData.label: "Password:"
            placeholderText: "Enter password to sign in"
            echoMode: TextInput.Password
            Layout.fillWidth: true
        }

        // Hidden field to trigger login
        QQC2.TextField {
            id: loginTriggerField
            visible: false
        }

        RowLayout {
            Kirigami.FormData.label: " "
            spacing: 8

            QQC2.Button {
                text: configPage.cfg_storageAccessToken !== "" ? "Sign Out" : "Sign In"
                onClicked: {
                    if (configPage.cfg_storageAccessToken !== "") {
                        // Sign out - clear tokens
                        configPage.cfg_storageAccessToken = ""
                        loginTriggerField.text = "SIGNOUT"
                    } else {
                        // Sign in - set trigger with credentials
                        if (emailField.text && passwordField.text) {
                            loginTriggerField.text = emailField.text + ":" + passwordField.text
                            passwordField.text = ""  // Clear password after trigger
                        }
                    }
                }
            }

            QQC2.Label {
                text: emailField.text === "" || passwordField.text === ""
                    ? "Enter email and password"
                    : ""
                opacity: 0.6
                font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                visible: configPage.cfg_storageAccessToken === ""
            }
        }

        QQC2.Label {
            text: "Your password is never stored. Only auth tokens are saved locally."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.5
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        QQC2.Label {
            text: "Google sign-in available from the widget's login screen."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.5
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        // Supabase Section
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Supabase Connection"
        }

        QQC2.TextField {
            id: supabaseUrlField
            Kirigami.FormData.label: "Project URL:"
            placeholderText: "https://your-project.supabase.co"
            Layout.fillWidth: true
        }

        QQC2.TextField {
            id: supabaseKeyField
            Kirigami.FormData.label: "Anon Key:"
            placeholderText: "eyJhbGciOiJIUzI1NiIs..."
            echoMode: TextInput.Password
            Layout.fillWidth: true
        }

        QQC2.Label {
            text: "Find these in your Supabase project settings under API."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.7
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        // Timer Section
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Timer Settings"
        }

        QQC2.SpinBox {
            id: workDurationSpinBox
            Kirigami.FormData.label: "Work duration (min):"
            from: 1
            to: 120
            value: 25
        }

        QQC2.SpinBox {
            id: breakDurationSpinBox
            Kirigami.FormData.label: "Break duration (min):"
            from: 1
            to: 60
            value: 5
        }

        QQC2.SpinBox {
            id: longBreakDurationSpinBox
            Kirigami.FormData.label: "Long break (min):"
            from: 1
            to: 120
            value: 15
        }

        QQC2.SpinBox {
            id: sessionsSpinBox
            Kirigami.FormData.label: "Sessions before long break:"
            from: 1
            to: 10
            value: 4
        }

        // Focus Reminders Section (TASK-1424)
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Focus Reminders"
        }

        QQC2.CheckBox {
            id: nannyEnabledCheckBox
            Kirigami.FormData.label: "Enable reminders:"
            checked: false
        }

        QQC2.Label {
            text: "Get notified when no Pomodoro session is active during work hours."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.5
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        // Work days checkboxes
        RowLayout {
            Kirigami.FormData.label: "Work days:"
            spacing: 4
            enabled: nannyEnabledCheckBox.checked

            Repeater {
                model: [
                    { label: "Mon", day: 1 },
                    { label: "Tue", day: 2 },
                    { label: "Wed", day: 3 },
                    { label: "Thu", day: 4 },
                    { label: "Fri", day: 5 },
                    { label: "Sat", day: 6 },
                    { label: "Sun", day: 0 }
                ]

                QQC2.CheckBox {
                    text: modelData.label
                    checked: configPage.cfg_nannyWorkDays.split(",").indexOf(String(modelData.day)) !== -1
                    onToggled: {
                        var days = configPage.cfg_nannyWorkDays.split(",").filter(function(d) { return d !== "" })
                        var dayStr = String(modelData.day)
                        var idx = days.indexOf(dayStr)
                        if (checked && idx === -1) {
                            days.push(dayStr)
                        } else if (!checked && idx !== -1) {
                            days.splice(idx, 1)
                        }
                        configPage.cfg_nannyWorkDays = days.join(",")
                    }
                }
            }
        }

        QQC2.SpinBox {
            id: nannyStartHourSpinBox
            Kirigami.FormData.label: "Start hour:"
            from: 0
            to: 23
            value: 9
            enabled: nannyEnabledCheckBox.checked
        }

        QQC2.SpinBox {
            id: nannyEndHourSpinBox
            Kirigami.FormData.label: "End hour:"
            from: 0
            to: 23
            value: 18
            enabled: nannyEnabledCheckBox.checked
        }

        QQC2.ComboBox {
            id: nannyIntervalCombo
            Kirigami.FormData.label: "Remind after idle:"
            model: ["5 min", "15 min", "30 min", "60 min", "90 min", "120 min"]
            enabled: nannyEnabledCheckBox.checked
            currentIndex: {
                var mins = configPage.cfg_nannyIntervalMinutes
                if (mins <= 5) return 0
                if (mins <= 15) return 1
                if (mins <= 30) return 2
                if (mins <= 60) return 3
                if (mins <= 90) return 4
                return 5
            }
            onActivated: function(index) {
                var values = [5, 15, 30, 60, 90, 120]
                configPage.cfg_nannyIntervalMinutes = values[index]
            }
        }

        QQC2.ComboBox {
            id: nannyToneCombo
            Kirigami.FormData.label: "Tone:"
            model: ["Gentle", "Direct"]
            enabled: nannyEnabledCheckBox.checked
            currentIndex: configPage.cfg_nannyTone === "direct" ? 1 : 0
            onActivated: function(index) {
                configPage.cfg_nannyTone = index === 1 ? "direct" : "gentle"
            }
        }

        // Open App Section
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Open App"
        }

        QQC2.ComboBox {
            id: openAppModeCombo
            Kirigami.FormData.label: "Open with:"
            model: ["Web Browser", "Tauri Desktop App"]
            currentIndex: configPage.cfg_openAppMode === "tauri" ? 1 : 0
            onActivated: function(index) {
                configPage.cfg_openAppMode = index === 1 ? "tauri" : "web"
            }
        }

        QQC2.TextField {
            id: appUrlField
            Kirigami.FormData.label: "Web URL:"
            placeholderText: "http://localhost:5546"
            Layout.fillWidth: true
            visible: configPage.cfg_openAppMode !== "tauri"
        }

        QQC2.TextField {
            id: tauriAppPathField
            Kirigami.FormData.label: "AppImage path:"
            placeholderText: "~/Applications/FlowState.AppImage"
            Layout.fillWidth: true
            visible: configPage.cfg_openAppMode === "tauri"
        }

        QQC2.Label {
            text: configPage.cfg_openAppMode === "tauri"
                ? "Path to the FlowState AppImage. Leave empty to auto-detect."
                : "URL to open in your browser when clicking 'Open App'."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.5
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        // Display Section
        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: "Display"
        }

        QQC2.CheckBox {
            id: showTaskListCheckBox
            Kirigami.FormData.label: "Show task list:"
            checked: true
        }

        QQC2.CheckBox {
            id: showCurrentBlockCheckBox
            Kirigami.FormData.label: "Show current block:"
            checked: true
        }
        QQC2.Label {
            text: "Display the current scheduled calendar block next to the timer in the panel."
            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
            opacity: 0.5
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
    }
}
