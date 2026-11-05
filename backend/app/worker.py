"""Durable single-worker queue; CPU exports and remote inference stay separate."""
import json
import logging
import secrets
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from . import db
from .audio import export, AudioError
from .config import config
from .providers import get_provider, ModelUnavailable
from .schemas import GenerationSettings

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log=logging.getLogger(__name__)

@contextmanager
def worker_lock():
    """The OS releases this lock on process exit, including crashes."""
    import os
    with (config.data_dir/'worker.lock').open('a+b') as lock:
        lock.seek(0)
        if not lock.read(1):lock.write(b'0');lock.flush()
        lock.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as exc:raise RuntimeError('A Resona worker is already running for this data directory.') from exc
        try:yield
        finally:
            if os.name=='nt':
                lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1)
            else:fcntl.flock(lock.fileno(),fcntl.LOCK_UN)

def claim():
    with db.connect() as con:
        con.execute('BEGIN IMMEDIATE')
        row=con.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1").fetchone()
        if not row:return None
        con.execute("UPDATE jobs SET status='running',stage='Preparing generation',updated_at=? WHERE id=?",(time.time(),row['id']))
        return db.job_dict(row)

def finish(jid):
    with db.connect() as con:
        con.execute('BEGIN IMMEDIATE')
        cancelled=con.execute('SELECT cancel_requested FROM jobs WHERE id=?',(jid,)).fetchone()[0]
        con.execute('UPDATE jobs SET status=?,stage=?,updated_at=? WHERE id=?',('cancelled' if cancelled else 'completed','Stopped. Finished variations are saved.' if cancelled else 'Ready to listen',time.time(),jid))

def process(job):
    jid=job['id'];outputs=[]
    try:
        settings=GenerationSettings(**job['settings'])
        with db.connect() as con:source=con.execute('SELECT * FROM uploads WHERE id=?',(job['upload_id'],)).fetchone()
        if not source or not Path(source['path']).is_file():raise ModelUnavailable('Reference missing.')
        folder=config.data_dir/'outputs'/jid;folder.mkdir(parents=True,exist_ok=True)
        provider=get_provider();state=provider.health()
        if not state['available']:raise ModelUnavailable(state['message'])
        for i in range(settings.variations):
            if db.cancel_requested(jid):break
            seed=secrets.randbelow(2147483648) if settings.seed is None else (settings.seed+i)%2147483648
            effective=settings.model_copy(update={'seed':seed,'variations':1})
            oid=str(uuid.uuid4());raw,wav,mp3=(folder/f'{oid}{suffix}' for suffix in ('-model.wav','.wav','.mp3'))
            try:
                db.update_job(jid,status='running',stage=f'Generating variation {i+1} of {settings.variations}')
                provider.generate(effective,json.loads(source['analysis']),Path(source['path']),raw,db.heartbeat)
                db.update_job(jid,status='exporting',stage=f'Mastering & exporting variation {i+1}')
                export(raw,wav,mp3,settings.mastering,settings.gain_db)
            except Exception:
                wav.unlink(missing_ok=True);mp3.unlink(missing_ok=True);raise
            finally:raw.unlink(missing_ok=True)
            outputs.append({'id':oid,'seed':seed,'model':config.acestep_model,'thinking':config.acestep_thinking and not settings.preserve_source,'inference_steps':config.acestep_inference_steps,'wav_url':f'/api/outputs/{jid}/{oid}.wav','mp3_url':f'/api/outputs/{jid}/{oid}.mp3'})
            db.update_job(jid,outputs=outputs,completed_variations=i+1)
        finish(jid)
    except Exception as exc:
        log.exception('Generation job %s failed',jid)
        # Never expose provider exception text: it may contain private URLs or credentials.
        if isinstance(exc,AudioError):message='Audio export failed. Check FFmpeg and MP3 encoder support in the worker log.'
        elif isinstance(exc,ModelUnavailable):message='The model could not complete this request. Check its connection and the worker log, then retry.'
        else:message='Generation failed. Check the worker log, then retry.'
        db.update_job(jid,status='failed',stage='Generation failed',error=message+' Any finished variations remain available.')

def run():
    db.init()
    with worker_lock():
        with db.connect() as con:con.execute("UPDATE jobs SET status='failed',error='Worker stopped before the job finished. Finished variations are saved; you can retry.',stage='Interrupted',updated_at=? WHERE status IN ('running','exporting')",(time.time(),))
        stop=threading.Event()
        def pulse():
            while not stop.is_set():db.heartbeat();stop.wait(5)
        thread=threading.Thread(target=pulse,daemon=True);thread.start()
        log.info('Resona generation worker started. Waiting for jobs.')
        try:
            while True:
                job=claim()
                if job:process(job)
                else:stop.wait(1)
        except KeyboardInterrupt:log.info('Worker stopped.')
        finally:
            stop.set();thread.join(timeout=2)
            with db.connect() as con:con.execute("DELETE FROM runtime WHERE key='worker_heartbeat'")

if __name__=='__main__':run()
