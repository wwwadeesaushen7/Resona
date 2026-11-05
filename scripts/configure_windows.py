"""Configure FFmpeg without changing PATH or PowerShell execution policy."""
from pathlib import Path
import subprocess
from dotenv import dotenv_values, set_key

root=Path(__file__).resolve().parents[1]
env=root/'backend'/'.env'
values=dotenv_values(env)
def works(binary):
    try:return subprocess.run([str(binary),'-version'],capture_output=True,timeout=10).returncode==0
    except (OSError,subprocess.TimeoutExpired):return False
ffmpeg=values.get('FFMPEG_PATH','ffmpeg');ffprobe=values.get('FFPROBE_PATH','ffprobe')
if not (works(ffmpeg) and works(ffprobe)):
    print('\nPaste the FFmpeg bin folder containing ffmpeg.exe and ffprobe.exe.')
    print('Example: D:\\Tools\\ffmpeg\\bin')
    folder=Path(input('FFmpeg bin folder: ').strip().strip('"'))
    ffmpeg=folder/'ffmpeg.exe';ffprobe=folder/'ffprobe.exe'
    if not (works(ffmpeg) and works(ffprobe)):raise SystemExit('Could not run both tools. Check the folder and run SETUP-WINDOWS.cmd again.')
    set_key(env,'FFMPEG_PATH',ffmpeg.as_posix());set_key(env,'FFPROBE_PATH',ffprobe.as_posix())
encoders=subprocess.run([str(ffmpeg),'-hide_banner','-encoders'],capture_output=True,text=True,timeout=10)
if 'libmp3lame' not in encoders.stdout:raise SystemExit('This FFmpeg build lacks MP3 encoding. Install a build with libmp3lame support.')
print('FFmpeg and FFprobe are ready. Configuration saved in backend/.env.')
