# BUG-2071 release evidence — 2026-09-02

- Candidate: deliver v1.4.505 with the direct-replacement readiness predicate sealed into the AppImage updater payload; predict that a healthy replacement reporting the exact target version survives the installer transaction while stale provenance still rolls back.
- Focused regression command: `npm test -- --run tests/unit/scripts/validate-electron-package.test.ts tests/unit/electron/appimage-installer-transaction-runtime.test.ts tests/unit/electron-appimage-installer.test.ts`.
- Result: 3 files and 19 tests passed. The direct installer retains the literal multi-line expected-version provenance response and clears markers only afterward; stale provenance still rolls back. The retry and failed-marker protections remain covered by their paired updater tests.
- Package proof: the committed v1.4.505 build at `b2a7d5015f0dcec2a7a3540d83189c123e022f87` produced `release/latest-linux.yml` and `release/linux-unpacked/resources/app.asar`; `node scripts/validate-electron-package.cjs` passed against the sealed archive. The validator now extracts `dist-electron/updater.js` and rejects the earlier grep-only verifier.
- Receipt: `release/flowstate-release-receipt.json` records v1.4.505, `source.dirty: false`, the AppImage and Debian artifacts, and the matching updater manifest.
- Remaining delivery/runtime gates: deploy v1.4.505, fetch the public manifest and artifact, then verify from the installed desktop app that retry downloads, relaunches, and reports v1.4.505 without a new failed marker.
