import json
import sqlite3
import time
from contextlib import contextmanager
from .config import config

@contextmanager
def connect():
    con = sqlite3.connect(config.data_dir / 'studio.sqlite', timeout=30)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()

def init():
    with connect() as con:
        con.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, name TEXT, path TEXT, analysis TEXT, created_at REAL);
        CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, upload_id TEXT, name TEXT, settings TEXT, status TEXT, stage TEXT, outputs TEXT DEFAULT '[]', error TEXT, completed_variations INTEGER DEFAULT 0, created_at REAL, updated_at REAL);
        CREATE TABLE IF NOT EXISTS runtime (key TEXT PRIMARY KEY, value REAL);
        ''')
        columns = {r['name'] for r in con.execute('PRAGMA table_info(jobs)')}
        if 'cancel_requested' not in columns:
            con.execute('ALTER TABLE jobs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0')

def job_dict(row):
    if not row: return None
    d = dict(row)
    d['settings'] = json.loads(d['settings'])
    d['outputs'] = json.loads(d['outputs'])
    d['source_url'] = f"/api/uploads/{d['upload_id']}/audio"
    return d

def get_job(job_id):
    with connect() as con:
        return job_dict(con.execute('SELECT * FROM jobs WHERE id=?',(job_id,)).fetchone())

def update_job(job_id, **values):
    allowed = {'status','stage','outputs','error','completed_variations'}
    if set(values) - allowed: raise ValueError('Invalid job field')
    if 'outputs' in values: values['outputs'] = json.dumps(values['outputs'])
    values['updated_at'] = time.time()
    with connect() as con:
        con.execute(f"UPDATE jobs SET {', '.join(k+'=?' for k in values)} WHERE id=?", [*values.values(),job_id])

def heartbeat():
    with connect() as con:
        con.execute("INSERT INTO runtime VALUES ('worker_heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(time.time(),))

def worker_ready():
    with connect() as con:
        row = con.execute("SELECT value FROM runtime WHERE key='worker_heartbeat'").fetchone()
    return bool(row and time.time()-row['value'] < 20)


def request_cancel(job_id):
    with connect() as con:
        con.execute('BEGIN IMMEDIATE')
        row=con.execute('SELECT status FROM jobs WHERE id=?',(job_id,)).fetchone()
        if not row:return None
        if row['status']=='queued':
            con.execute("UPDATE jobs SET cancel_requested=1,status='cancelled',stage='Cancelled before generation',updated_at=? WHERE id=?",(time.time(),job_id))
        elif row['status'] in ('running','exporting'):
            con.execute('UPDATE jobs SET cancel_requested=1,updated_at=? WHERE id=?',(time.time(),job_id))
    return get_job(job_id)

def cancel_requested(job_id):
    with connect() as con:row=con.execute('SELECT cancel_requested FROM jobs WHERE id=?',(job_id,)).fetchone()
    return bool(row and row['cancel_requested'])
