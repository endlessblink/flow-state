# SOP-034: Tauri Linux Microphone Limitation

**Status:** KNOWN LIMITATION
**Related:** TASK-1071
**Last Updated:** 2026-01-25

## Summary

Microphone access (WebRTC `getUserMedia`) does not work in Tauri on Linux due to WebKitGTK limitations. This is an upstream issue, not a FlowState bug.

## Platform Support

| Platform | WebView Engine | Mic Support | Status |
|----------|----------------|-------------|--------|
| Windows  | WebView2 (Edge Chromium) | ✅ Works | Full support |
| macOS    | WKWebView | ✅ Works | Full support |
| Linux    | WebKitGTK | ❌ No | Blocked upstream |

## Root Cause

WebKitGTK (the WebView engine on Linux) does not include WebRTC support by default. The WebRTC/GStreamer integration is:
- Optional at compile time
- Not included in most distro packages (Ubuntu, Fedora, Arch)
- Requires custom compilation with specific flags

### Technical Details

When `navigator.mediaDevices.getUserMedia()` is called in Tauri on Linux:
- The call either fails silently
- Or returns a "NotAllowedError" or "NotFoundError"
- No permission prompt is shown (unlike Chrome/Firefox)

## Workarounds

### 1. Use the Web App (Recommended)

Access FlowState via the browser at `https://in-theflow.com`. Chrome/Firefox have full microphone support on all platforms.

### 2. Use Whisper Mode (Server-Side)

FlowState offers two voice input modes:
- **Whisper Mode**: Uses Groq API for transcription (works everywhere, requires API key)
- **Browser Mode**: Uses Web Speech API (requires browser support)

Whisper mode doesn't need browser microphone permission in the same way - it uses the MediaRecorder API which has slightly different requirements. However, it still needs `getUserMedia` for the initial recording, so this is also blocked on Linux/WebKitGTK.

### 3. Use Windows or macOS

The Tauri desktop app has full microphone support on:
- Windows 10/11 (WebView2)
- macOS 10.15+ (WKWebView)

### 4. Custom WebKitGTK Build (Advanced)

Compile WebKitGTK with WebRTC enabled:
```bash
# Not recommended - very complex, requires webkit build system
# See: https://trac.webkit.org/wiki/WebKitGTK/GettingStarted
```

## Future Outlook

WebKitGTK developers are actively working on WebRTC integration:
- FOSDEM 2024/2025 talks showed progress
- GStreamer WebRTC pipeline integration ongoing
- Eventually distros may ship with WebRTC enabled

**Estimated Timeline:** Unknown. Depends on upstream WebKitGTK releases and distro adoption.

## FlowState Implementation

FlowState handles this gracefully:
1. Voice mode toggle in sidebar (Whisper vs Browser)
2. Disabled button with tooltip when mic not available
3. Auto-fallback to available mode
4. Clear error messaging when mic access fails

### Relevant Code

- `src/layouts/AppSidebar.vue` - Voice mode toggle UI
- `src/composables/useWhisperSpeech.ts` - Whisper transcription
- `src/composables/useBrowserVoice.ts` - Browser Speech API

## References

- [Tauri Issue #2284: Linux MediaDevices](https://github.com/tauri-apps/tauri/issues/2284)
- [WebKitGTK WebRTC Status](https://webkitgtk.org/)
- [GStreamer WebRTC](https://gstreamer.freedesktop.org/documentation/webrtc/)
