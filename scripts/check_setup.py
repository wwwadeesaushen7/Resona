"""Read-only checks; never prints API keys or private inference URLs."""
from pathlib import Path
import os,sys,json,shutil,urllib.request
root=Path(__file__).resolve().parents[1];os.chdir(root/'backend');sys.path.insert(0,str(root/'backend'))
try:from app.config import config
except ImportError:raise SystemExit('Dependencies missing. Run SETUP-WINDOWS.cmd first.')
print('Python:',sys.version.split()[0])
for name,binary in [('FFmpeg',config.ffmpeg_path),('FFprobe',config.ffprobe_path)]:print(name+':','found' if shutil.which(binary) else 'missing; run setup or edit backend/.env')
print('Inference address:','configured' if config.acestep_base_url else 'not configured')
try:
    with urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=15) as r:health=json.load(r)
    for key in ['analysis_available','worker_ready','model_available','available']:print(key+':',bool(health.get(key)))
    print(health.get('message',''))
except Exception:print('Backend is not reachable at port 8000. Start Resona to check its connection.')
