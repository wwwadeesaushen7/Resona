# Resona 1.1

## New controls and workflows

- Musical key, time signature, and optional fixed generation seeds.
- Export/import portable JSON recipes and download each output's recorded seed and inference settings.
- Cancel queued jobs; stop running batches after the current variation and keep finished audio.
- Retry remaining variations after errors and access successful outputs from partially failed jobs.
- Separate API, audio-tool, worker, and model diagnostics.
- Windows setup, launcher, and system check scripts; FFmpeg paths saved without changing system PATH.
- Persistent hiding/restoring of library entries and a single active audio preview for comparisons.

## Fixed

- Generation now waits for analysis after trim changes.
- Replacing or removing audio invalidates earlier analysis requests and permission confirmations.
- Rapid clicks cannot submit duplicate generation requests.
- Job progress uses the submitted job's variation count even if current studio settings change.
- Switching backends clears incompatible references and keeps histories separate.
- Duplicate workers are rejected before recovery; malformed saved job settings fail the job instead of stopping the queue.
- Non-finite trim boundaries are rejected, missing FFmpeg blocks generation, and unhealthy model services are reported unavailable.
- Presets/recipes reset source-permission confirmations; invalid recipe values are rejected.

Real synthesis remains dependent on a working external ACE-Step service. No simulated model or fallback generated track is included.
