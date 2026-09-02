# BUG-2071 release evidence — 2026-09-02

- Candidate: deliver the whitespace-tolerant direct-replacement readiness predicate in v1.4.504, which is newer than the trapped v1.4.503 artifact.
- Focused regression command: `npm test -- tests/unit/scripts/vps-release-branch-contract.test.ts tests/unit/electron/appimage-installer-transaction-runtime.test.ts tests/unit/electron/updater-pending.test.ts tests/unit/electron/updater-auth-durability.test.ts`.
- Initial review correction: the original direct-path fixture emitted compact JSON, so its whitespace claim was withdrawn. The revised runtime fixture now emits and records the exact multi-line payload `{\n  "appVersion": "1.4.275"\n}\n` while exercising the direct replacement flow.
- Result after correction: 4 files passed, 24 tests passed. The direct installer retains that formatted expected-version provenance response and clears markers only afterward; stale provenance still rolls back. The pending-marker and retry tests retain failed-marker scope; the release-worker contract proves a cached single-branch checkout fetches and resets `origin/main` rather than stale `master`.
- Packaging: the clean release worker built a clean receipt for v1.4.504 at source commit `35af15217a24120844408350103789e46ac6ade0`, with `source.dirty` false, an AppImage, and a Debian package.
- Promotion: the guarded atomic promotion completed with `promoted FlowState 1.4.504 across web/PWA/Electron`.
- Public read-back: `https://in-theflow.com/updates/electron/latest-linux.yml` reports `version: 1.4.504`, `FlowState-1.4.504-x86_64.AppImage`, and size `180208878`; a HEAD request for that AppImage returned HTTP 200 and the same content length.
- Remaining runtime gate: verify from the installed 1.4.502 desktop app that retry sees 1.4.504, downloads it, relaunches, and reports 1.4.504 without a new failed marker.
