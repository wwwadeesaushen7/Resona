# Start Resona on your Windows PC

Resona 1.1 includes a local studio, audio analysis, and a connection to a real ACE-Step music model. You can upload, preview, trim, and analyze audio before installing the model.

## First time

1. Extract the entire ZIP. Keep the `resona` folder together. Do not run files from inside the ZIP.
2. Install **Node.js 22 LTS or newer**, **Python 3.12 with its Python launcher**, and **FFmpeg**. Python 3.11 and 3.13 are also accepted for the Resona backend. ACE-Step has its own environment and requirements.
3. Double-click **SETUP-WINDOWS.cmd** in the extracted folder. It installs the studio dependencies. If FFmpeg is not found, paste the full path to its `bin` folder containing `ffmpeg.exe` and `ffprobe.exe`. Existing `.env` settings are preserved.
4. Double-click **START-RESONA.cmd**. It opens three terminal windows: the API, queue worker, and website. Keep them open. Your browser opens at **http://localhost:5173**.
5. In the studio, choose **Connect engine**. Leave Backend URL blank for local use, then select **Save & test connection**. The four checks tell you which components are ready.

No administrator privileges or PowerShell execution-policy changes are needed. The launchers use their own folder, so you do not need to type `cd` commands.

## Enable AI generation

The setup button installs Resona, not the large music model. Install ACE-Step separately using the [official platform instructions](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md). Choose the setup for the PC that will actually run inference. An NVIDIA GPU is not required for the frontend or audio analysis. Other inference backends depend on upstream support; CPU inference can be very slow.

Once the ACE-Step API is running, edit `backend/.env` in a text editor:

```dotenv
ACESTEP_BASE_URL=http://127.0.0.1:8001
ACESTEP_MODEL=acestep-v15-turbo
ACESTEP_API_KEY=
```

Use the service's actual address and model name. Keep any API key in this file. Restart Resona's API and worker after changing it. Generation becomes available when the service lists that model, audio tools are installed, and the worker is running. No example track is substituted for model output.

Double-click **CHECK-SYSTEM.cmd** to display this PC's processor, memory, graphics adapters, and local connection status. It does not print API keys.

## Everyday use

- Upload MP3, WAV, or FLAC and let the backend analyze it.
- After changing the trim, choose **Apply & analyze**. Generation waits until the selection is analyzed.
- Choose a mode, then use **Advanced controls** for tempo, key, meter, seed, instrumentation, and mastering.
- **Export recipe** saves your settings as a JSON file. Use **Import recipe** on another PC. Audio is not included; select a reference separately. Ownership confirmations must be made again for source transformations.
- A blank seed produces a new seed for each variation. A fixed seed increments by one for subsequent variations. Model versions and hardware can still change the result.
- Queued jobs can be cancelled immediately. A running job finishes its current variation, saves it, and skips the rest. This does not interrupt a remote model task already running.
- Finished variations remain playable when a later variation fails. Retry remaining variations from the error notice.
- WAV and MP3 downloads contain the real generated track. Each result also offers its recipe and seed.

## Move to another PC or upgrade

Use the new ZIP and extract it into a **new folder**, then run setup there. Do not copy `node_modules` or `.venv` from another PC.

To preserve existing generations, stop the old API and worker and back up the old `backend/data` folder. With the default `DATA_DIR=data` configuration, copy it into the new project's `backend/data` folder. If you used an absolute custom data path, keep that same path or update the stored reference paths before using the moved library. Preserve your `backend/.env` and update any FFmpeg paths for the target PC. Database changes are additive. Browser presets and favorites stay in that browser; export recipes to transfer settings.

For the simplest test on a different PC, start with a fresh data directory and upload the reference again.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Browser refuses port 5173 | Run START-RESONA.cmd and keep its three windows open. |
| Port already in use | Use the existing studio, or stop the earlier server windows with Ctrl+C before restarting. |
| FFmpeg not ready | Run setup again and give the full FFmpeg `bin` folder path. |
| Backend connected; model unavailable | Set ACESTEP_BASE_URL and start the separate model service. |
| Queue worker not ready | Check the Resona Queue window. Only one worker may use a data directory. |
| Model connected but generation fails | Read the queue and ACE-Step terminal errors. Check memory, model name, duration, and inference configuration. |
| Hosted website cannot reach local backend | Use http://localhost:5173 for local testing. The hosted website expects an HTTPS backend accessible to your browser. |

Detailed installation, cloud options, accuracy limits, and the model interfaces are in README.md. Verification results and remaining limitations are in TESTING.md.
