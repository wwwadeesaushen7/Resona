# Resona 1.1 verification

Checked on Linux, 5 November 2026.

- **32 backend tests passed.** Includes real FFmpeg decoding/trimming/export, MP3/WAV/FLAC uploads, Librosa analysis, offline generation rejection, rights/settings validation, official ACE-Step task contracts, musical controls and seed forwarding, optional LM flags, unexpected download-host rejection, queue claiming/cancellation, partial-output retention, old-database migration, duplicate-worker exclusion, and invalid saved settings.
- **3 frontend recipe tests passed.** Settings transfer, fresh source-permission confirmation, invalid settings/files, and unknown/inherited fields.
- **Chromium desktop/mobile checks passed.** Real backend analysis of the included reference, advancing audio playback, trim re-analysis, seed/key/meter controls, recipe export/import, permission reset, presets, mobile navigation, and no horizontal overflow or JavaScript page errors. Mobile width: 390 px. Desktop width: 1440 px.
- **Browser queue/error checks passed with HTTP test fixtures only.** Double-click submission guard, queued cancellation and retry, partial output display, single-player comparison, and hiding/restoring history after reload. These fixtures are external QA scripts, not production providers or returned AI results.
- Production React/Vite build completed. The source ZIP is checked for required launchers, docs, and source files and excludes credentials, databases, caches, installed dependencies, and hosting identity.

## Remaining live acceptance checks

A GPU/model service and checkpoint weights were not available. Actual ACE-Step synthesis, musical quality, live generation speed, and seed reproducibility remain unverified. Run a real generation in each mode on the target PC/service, test multiple variations, stop a batch, replay its completed output, and download both formats.

A Windows host was not available to execute the new `.cmd` launchers. They use project-relative paths, `npm.cmd`, supported Python versions, and no PowerShell activation script. Run `SETUP-WINDOWS.cmd`, `CHECK-SYSTEM.cmd`, and `START-RESONA.cmd` on the target Windows machine.

Model-contract and worker tests deliberately mock inference only inside tests. Real audio analysis/export tests use FFmpeg and Librosa. The production app has no mock generation provider.

Librosa tempo may select half/double-time. Genre, mood, and instrumentation are broad signal heuristics. Dominant pitch is not a detected key. Similarity controls guide model prompts; they do not guarantee exact perceptual matching.
