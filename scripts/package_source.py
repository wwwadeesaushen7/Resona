"""Build a distributable source ZIP from an explicit allowlist; never package .env/data."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
root_files=['README.md','START-HERE.md','TESTING.md','CHANGELOG.md','.gitignore','.env.example','.env.cloud.example','compose.yaml','index.html','package.json','package-lock.json','vite.config.js','SETUP-WINDOWS.cmd','START-RESONA.cmd','CHECK-SYSTEM.cmd']
files=[root/name for name in root_files]
files += [root/'backend'/name for name in ['requirements.txt','requirements-dev.txt','.env.example','Dockerfile','.dockerignore']]
for directory in ['frontend/src','frontend/tests','backend/app','backend/tests','scripts']:
    files += [p for p in (root/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc']
files += [root/'public/studio-reference.wav']
out=root/'public/downloads';out.mkdir(parents=True,exist_ok=True)
archive=out/f'resona-source-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted(set(files)):
        data=file.read_bytes()
        if file.suffix.lower()=='.cmd':data=data.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
        z.writestr('resona/'+file.relative_to(root).as_posix(),data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names=z.namelist()
    assert all('/.env' not in n or n.endswith('.example') for n in names)
    assert not any('/data/' in n or '/node_modules/' in n or '/.openai/' in n for n in names)
    assert 'resona/START-RESONA.cmd' in names and 'resona/frontend/src/studio.js' in names
shutil.copyfile(archive,out/'resona-source.zip')
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(out/(archive.name+'.sha256')).write_text(digest+'  '+archive.name+'\n')
print(f'{archive.name}: {len(files)} files, {archive.stat().st_size} bytes, SHA256 {digest}')
