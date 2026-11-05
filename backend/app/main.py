import asyncio
import json
import logging
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI,UploadFile,File,Form,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from . import db
from .audio import normalize,analyze,AudioError
from .config import config
from .providers import get_provider,ModelUnavailable
from .schemas import JobRequest

analysis_slots=asyncio.Semaphore(2)
logger=logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app):
    db.init()
    yield

app=FastAPI(title='Resona Studio API',version='1.1.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[s.strip() for s in config.allowed_origins.split(',') if s.strip()],allow_credentials=False,allow_methods=['GET','POST','DELETE'],allow_headers=['Content-Type'])

@app.get('/api/health')
async def health():
    try:state=await asyncio.to_thread(get_provider().health)
    except ModelUnavailable as e:state={'available':False,'message':str(e)}
    worker=db.worker_ready()
    ffmpeg=bool(shutil.which(config.ffmpeg_path))
    ffprobe=bool(shutil.which(config.ffprobe_path))
    analysis=ffmpeg and ffprobe
    message=state['message']
    if not analysis:message='Install FFmpeg and FFprobe or set their full paths in backend/.env. Restart the API and worker.'
    elif state['available'] and not worker:message='Model connected. Start the Resona background worker to enable generation.'
    return {**state,'version':'1.1.0','available':bool(state['available'] and worker and analysis),'model_available':state['available'],'worker_ready':worker,'provider':config.model_provider,'model':config.acestep_model,'analysis_available':analysis,'ffmpeg_ready':ffmpeg,'ffprobe_ready':ffprobe,'thinking_enabled':config.acestep_thinking,'max_upload_mb':config.max_upload_mb,'max_audio_seconds':config.max_audio_seconds,'message':message}

@app.post('/api/uploads',status_code=201)
async def upload(file:UploadFile=File(...),trim_start:float=Form(0),trim_end:float|None=Form(None)):
    ext=Path(file.filename or '').suffix.lower()
    if ext not in {'.mp3','.wav','.flac'}:raise HTTPException(415,'Supported formats: MP3, WAV and FLAC.')
    uid=str(uuid.uuid4());folder=config.data_dir/'uploads'/uid;folder.mkdir(parents=True)
    raw=folder/f'input{ext}';normalized=folder/'reference.wav'
    try:
        size=0
        with raw.open('wb') as f:
            while chunk:=await file.read(1024*1024):
                size+=len(chunk)
                if size>config.max_upload_mb*1024*1024:raise HTTPException(413,'The file exceeds the upload limit.')
                f.write(chunk)
        async with analysis_slots:
            await asyncio.to_thread(normalize,raw,normalized,trim_start,trim_end)
            result=await asyncio.to_thread(analyze,normalized)
        with db.connect() as con:
            con.execute('INSERT INTO uploads VALUES (?,?,?,?,?)',(uid,Path(file.filename).name,str(normalized),json.dumps(result),time.time()))
        raw.unlink(missing_ok=True)
        return {'id':uid,'name':Path(file.filename).name,'analysis':result,'audio_url':f'/api/uploads/{uid}/audio'}
    except HTTPException:
        shutil.rmtree(folder,ignore_errors=True);raise
    except (AudioError,ValueError,KeyError) as e:
        shutil.rmtree(folder,ignore_errors=True);raise HTTPException(422,str(e)) from e
    except Exception as e:
        shutil.rmtree(folder,ignore_errors=True);logger.exception('Audio analysis failed');raise HTTPException(500,'Audio analysis failed. Check the backend log.') from e
    finally:
        await file.close()

@app.get('/api/uploads/{upload_id}/audio')
async def source_audio(upload_id:str):
    with db.connect() as con:row=con.execute('SELECT path FROM uploads WHERE id=?',(upload_id,)).fetchone()
    if not row or not Path(row['path']).is_file():raise HTTPException(404,'Reference not found.')
    return FileResponse(row['path'],media_type='audio/wav')

@app.post('/api/jobs',status_code=202)
async def create_job(body:JobRequest):
    state=await health()
    if not state['available']:raise HTTPException(503,state['message'])
    with db.connect() as con:
        con.execute('BEGIN IMMEDIATE')
        row=con.execute('SELECT * FROM uploads WHERE id=?',(body.upload_id,)).fetchone()
        if not row or not Path(row['path']).is_file():raise HTTPException(404,'The reference is missing. Upload and analyze it again.')
        queued=con.execute("SELECT count(*) FROM jobs WHERE status IN ('queued','running','exporting')").fetchone()[0]
        if queued>=10:raise HTTPException(429,'The queue is full. Please try again after a job finishes.')
        jid=str(uuid.uuid4());now=time.time()
        name=Path(row['name']).stem.replace(' — studio reference','')+' — reimagined'
        con.execute('INSERT INTO jobs (id,upload_id,name,settings,status,stage,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',(jid,body.upload_id,name,body.settings.model_dump_json(),'queued','Waiting for inference',now,now))
    return db.get_job(jid)

@app.get('/api/jobs')
async def list_jobs():
    with db.connect() as con:return [db.job_dict(r) for r in con.execute('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100').fetchall()]

@app.get('/api/jobs/{job_id}')
async def get_job(job_id:str):
    job=db.get_job(job_id)
    if not job:raise HTTPException(404,'Generation job not found.')
    return job

@app.get('/api/outputs/{job_id}/{output_id}.{format}')
async def download(job_id:str,output_id:str,format:str,download:bool=False):
    if format not in {'mp3','wav'}:raise HTTPException(400,'Choose MP3 or WAV.')
    job=db.get_job(job_id)
    if not job or not any(o['id']==output_id for o in job['outputs']):raise HTTPException(404,'Output not found.')
    path=config.data_dir/'outputs'/job_id/f'{output_id}.{format}'
    if not path.is_file():raise HTTPException(404,'The output file is no longer available.')
    return FileResponse(path,media_type='audio/mpeg' if format=='mp3' else 'audio/wav',filename=f'resona-{output_id[:8]}.{format}' if download else None)


@app.post('/api/jobs/{job_id}/cancel')
async def cancel_job(job_id:str):
    job=db.request_cancel(job_id)
    if not job:raise HTTPException(404,'Generation job not found.')
    return job
