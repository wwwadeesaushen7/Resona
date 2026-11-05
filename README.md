# Resona 1.1 — reference-based AI music studio

**Windows quick start:** Read [START-HERE.md](START-HERE.md), then run `SETUP-WINDOWS.cmd` once and `START-RESONA.cmd` to launch the studio. `CHECK-SYSTEM.cmd` shows hardware and connection status.

A React studio and a FastAPI audio backend with a durable SQLite background queue. CPU audio analysis runs independently from the configurable ACE-Step 1.5 HTTP inference service. No paid API is required. No simulated generation provider or fallback track is included.

## What is implemented

1. **Frontend:** responsive charcoal studio, upload/drop, real waveform, seeking, preview volume, trimming, two generation modes, customization, settings presets, library and favorites.
2. **Audio analysis:** FFmpeg decodes MP3/WAV/FLAC; Librosa estimates BPM, groove, energy, percussion intensity, harmonic/percussive cues, textures and structural boundaries.
3. **Model adapter:** ACE-Step 1.5 official `/health`, `/v1/models`, `/release_task`, `/query_result` and `/v1/audio` interfaces. Real task submission, polling, error handling and model audio retrieval.
4. **Two modes:** rhythm/energy-guided composition or atmosphere-guided composition, using measured reference characteristics and descriptive prompts. Optional source transformation uses ACE-Step cover mode and requires permission confirmation.
5. **Output:** one to four separately generated variations, regeneration of an individual result, original/output comparison, WAV and 320 kbps MP3 export, optional loudness normalization, limiter and gain.
6. **Validation:** automated upload/analysis/export/API/queue/adapter tests and desktop/mobile browser checks. Live GPU generation needs an operator-provided inference service; it has not been tested in this workspace.

**Accuracy limits:** genre and mood labels and instrumentation cues are explicitly signal-based heuristics, not a trained semantic classifier. Named verse/chorus structure is not inferred; the app shows feature-change sections. Similarity, creativity, instrument and emotional sliders produce descriptive model instructions; ACE-Step does not offer exact numeric perceptual matching. BPM is model metadata; creativity also adjusts its documented LM temperature. In text2music mode the source recording is not sent to the model, which supports originality but cannot guarantee a matching groove or mood. Review actual generated audio for musical quality and originality.

## Requirements

- Windows 10, Linux, or macOS; Node.js 22 LTS or newer and npm.
- Python 3.11–3.13 for the Resona backend; 3.12 recommended. Install ACE-Step in its own environment according to upstream requirements.
- FFmpeg **and FFprobe** on PATH, including libmp3lame support.
- For actual generation: a separate working ACE-Step 1.5 service and its model checkpoints, on supported local hardware or a remote inference host. Requirements vary by model, duration, batch size and CPU offload; consult the official hardware guide before provisioning. The API and analysis do not load PyTorch or require CUDA.

## Local setup on Windows 10 (PowerShell)

Install Node.js, Python, Git, and a Windows FFmpeg build. Add FFmpeg's `bin` directory to PATH, open a new terminal and verify:

```powershell
node --version
py -3.11 --version
ffmpeg -version
ffprobe -version
```

Extract this project and open its root directory. Install the frontend:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Set up Python (these commands avoid PowerShell activation-policy changes):

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Start the backend in terminal 1, from the project root:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the queue worker in terminal 2:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.worker
```

Start the frontend in terminal 3, from the project root:

```powershell
npm.cmd run dev
```

Open `http://localhost:5173`. The Vite proxy forwards `/api` to `http://127.0.0.1:8000`. Leave the connection URL blank for this default. FastAPI API docs are at `http://127.0.0.1:8000/docs`.

Audio uploading, Python analysis and browser preview work without a GPU. Generation stays disabled until the configured model is reachable, listed as available and the queue worker heartbeat is current.

## Local setup on Linux / macOS

Install FFmpeg with your system package manager, then:

```sh
npm ci
cp .env.example .env
python3.11 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Run each command in a separate terminal:

```sh
# terminal 1, project root
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2, project root
cd backend
../.venv/bin/python -m app.worker

# terminal 3, project root
npm run dev
```

## Connect real ACE-Step generation

Use the official project and follow its platform-specific installation instructions, including GPU drivers, PyTorch/CUDA compatibility and checkpoint downloads:

- Installation: https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md
- API contract: https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/API.md
- Project and hardware guidance: https://github.com/ace-step/ACE-Step-1.5

With `uv` installed, the upstream standard installation flow is:

```sh
git clone https://github.com/ace-step/ACE-Step-1.5.git
cd ACE-Step-1.5
uv sync
uv run acestep-api
```

The upstream server normally uses port 8001. Wait for model initialization and check `/health` and `/v1/models`. On the Resona backend, edit `backend/.env`:

```dotenv
ACESTEP_BASE_URL=http://127.0.0.1:8001
ACESTEP_API_KEY=
ACESTEP_MODEL=acestep-v15-turbo
```

If the model server requires a key, put the matching key in `ACESTEP_API_KEY` on the backend only. Restart the API and worker after changing their environment. Keep the worker running. Select **Connect engine** in Resona and save/test your backend URL (blank for the local Vite proxy). Re-analyze the current reference if you changed backend services.

Generation calls ACE-Step once per variation using `batch_size=1`, then downloads actual returned audio. Tasks poll every two seconds up to `GENERATION_TIMEOUT`. Failed jobs surface an error without invented results. Exact quality, latency and successful inference remain dependent on the external model service and hardware. Custom text is passed to the model as direction; no output is guaranteed to satisfy every instruction.

## Configuration

See both `.env.example` files. Backend environment is loaded relative to the **backend working directory**, so run API and worker there.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Optional frontend build-time backend origin. Blank uses same-origin `/api`. A saved connection URL in the browser takes priority. |
| `ACESTEP_BASE_URL` | Private inference-service URL. Empty disables generation. |
| `ACESTEP_API_KEY` | Inference-service bearer key, kept server-side. |
| `ACESTEP_MODEL` | Model name that must appear in `/v1/models`. |
| `ACESTEP_THINKING` | Enables optional LM planning/caption/language enhancement. Set false for a service without an LM; explicit key and meter avoid missing metadata. |
| `ACESTEP_INFERENCE_STEPS` | Inference steps passed to the model; default 8 for turbo. Use upstream recommendations for other model types. |
| `MODEL_PROVIDER` | `acestep`; add a `MusicProvider` subclass to support another model. |
| `DATA_DIR` | Durable SQLite database, references and output files; default `data`. |
| `ALLOWED_ORIGINS` | Exact comma-separated browser origins; include your deployed frontend origin. |
| `GENERATION_TIMEOUT` | Per-variation model timeout in seconds; default 1800. |
| `MAX_UPLOAD_MB` | Upload cap, default 100 MB. |
| `MAX_AUDIO_SECONDS` | Reference cap, default 600 seconds. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Binary name or absolute path, useful on Windows. |

Presets, current settings and favorites are browser-local. Job metadata and real files persist under `DATA_DIR`. On connection, the library recovers backend job records. Hiding a finished creation persists in this browser across reconnects. Restore hidden creations from the library. Hiding does not delete backend files. Histories are separated by backend URL. Back up or remove `DATA_DIR` manually when the services are stopped. Browser decoding depends on codec support; FFmpeg handles all three accepted formats server-side.

## Architecture and optional cloud GPU

```text
React studio -> FastAPI API -> FFmpeg + Librosa (CPU analysis)
                        |
                  SQLite job queue -> separate Python worker
                                           |
                                     MusicProvider adapter
                                           |
                                  ACE-Step HTTP service (GPU)
                                           |
                                  real audio -> FFmpeg exports
```

The included Dockerfile and Compose configuration deploy only the CPU API and queue worker, sharing a persistent volume. Point `ACESTEP_BASE_URL` at a separately deployed GPU service. You may use a local Windows GPU, an existing GPU server, or a cloud host; the app requires no paid model API.

For a cloud deployment:

1. Host the static React build (`npm run build`, output `dist/`). Sites hosting runs this frontend only; it cannot run this Python/GPU stack.
2. Run FastAPI and exactly **one** queue worker on the same CPU host with the same `DATA_DIR`. SQLite is intended for a personal/single-host studio. Use a dedicated distributed queue and database when scaling to multiple hosts.
3. Run upstream ACE-Step on the GPU host. Keep its API private; use HTTPS/authentication or a private network. Set its API key on the Resona backend.
4. Expose the Resona API through HTTPS, add the exact frontend origin to `ALLOWED_ORIGINS`, and set the studio connection to the HTTPS API URL.
5. Before exposing a shared backend beyond your own trusted access, put it behind authentication, per-user storage isolation, rate limits and quotas. This build is a personal studio, not a multi-tenant service. CORS is not access control. UUIDs are identifiers, not authorization.

The optional CPU deployment:

```sh
# Copy .env.cloud.example to .env.cloud and set your real inference URL.
docker compose --env-file .env.cloud up --build
```

The default binds the API to loopback. Put your HTTPS reverse proxy in front of it for remote access. No cloud resources, paid services, GPU model weights or credentials are provisioned by this source package.

## Verification

Run `npm test` for recipe validation tests. Run `python scripts/package_source.py` from the project root to rebuild the distributable source ZIP.

```powershell
# Windows, project root
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

```sh
# Linux/macOS, project root
.venv/bin/python -m pip install -r backend/requirements-dev.txt
(cd backend && ../.venv/bin/python -m pytest -q)
npm run build
```

The provider tests use `httpx.MockTransport` to verify the documented task contract; mocks are confined to tests and are never runtime generation results. GPU synthesis needs a separate live acceptance test: upload your authorized reference, generate in each mode, verify each output is playable, compare it to the source, regenerate one variation, and download both formats. Windows commands are supplied, but this workspace's automated checks run on Linux.

## Originality and source permissions

Default generation uses broad characteristics and fresh compositions rather than source audio conditioning. Optional **Use source audio for a closer transformation** can preserve source elements and requires an explicit ownership/permission confirmation, enforced both in the UI and the backend schema. Review outputs before use. This app makes no promise that outputs are copyright-free or will avoid copyright detection.

The included `studio-reference.wav` is an original deterministic synthesis created for this project (not an AI output or a claimed generated result). Use it freely as a reference and test fixture. Third-party model weights and dependencies retain their own licenses; review the upstream licenses before distribution or commercial use.


## Studio 1.1 additions

- Key, meter, and seed map to documented ACE-Step `key_scale`, `time_signature`, `seed`, and `use_random_seed` parameters. These are conditioning requests, not musical guarantees. Fixed seeds increment for each variation; random seeds are chosen and recorded by the worker.
- Portable JSON recipes can be imported/exported without storing credentials. Each generated variation records its requested seed, model name, planning setting, and inference-step count. Reproducing an experiment also requires the same analyzed reference, model version, and inference configuration. Importing a recipe changes studio settings; it does not change the server's configured model. Permissions are never carried over in recipes.
- Cancel queued jobs through `POST /api/jobs/{id}/cancel`. Running jobs stop after their current variation. ACE-Step tasks already submitted continue; the UI does not promise GPU interruption. Partial successful outputs remain accessible on failure or cancellation.
- The worker uses an OS lock to reject duplicate processes before recovery. An interrupted worker marks unfinished jobs failed on restart, keeping already exported audio. A database migration adds cancellation state without replacing existing tables.
- Trim edits invalidate generation until analysis matches the selected range. Upload races are discarded, analysis requests time out, double submission is blocked, and only one preview plays at a time.
- Connection diagnostics distinguish the API, FFmpeg/FFprobe, worker, and model. Missing audio tools block generation as well as analysis. Health probes time out quickly instead of leaving the interface waiting for a minute.
- `scripts/configure_windows.py` saves FFmpeg paths in the backend environment; it does not change system PATH. Launch scripts use `npm.cmd`, automatically select the project directory, and bind local servers to loopback.

For DiT-only operation, set `ACESTEP_THINKING=false` in Resona and follow the upstream model server instructions to disable its LM. Set an explicit key and time signature in the studio. This changes the request flags; it does not configure GPU drivers, load model checkpoints, or guarantee a particular PC can run inference.
