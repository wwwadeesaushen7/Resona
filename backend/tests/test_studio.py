import io
import json
import time
from pathlib import Path
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.config import config
from app.schemas import GenerationSettings
from app.providers import AceStepProvider, ModelUnavailable, describe
from app.audio import analyze, normalize, export
from app import db
from app.main import app

SAMPLE=Path(__file__).resolve().parents[2]/'public/studio-reference.wav'

@pytest.fixture(autouse=True)
def isolated_data(tmp_path,monkeypatch):
    monkeypatch.setattr(config,'data_dir',tmp_path)
    monkeypatch.setattr(config,'acestep_base_url','')
    db.init()

@pytest.fixture
def client():
    with TestClient(app) as c:yield c

def test_offline_is_honest(client):
    health=client.get('/api/health').json()
    assert health['available'] is False
    assert health['worker_ready'] is False
    r=client.post('/api/jobs',json={'upload_id':'missing','settings':{}})
    assert r.status_code==503
    assert client.get('/api/jobs').json()==[]

def test_source_permissions_are_enforced():
    with pytest.raises(ValidationError):GenerationSettings(preserve_source=True)
    assert GenerationSettings(preserve_source=True,rights_confirmed=True).preserve_source

@pytest.mark.parametrize('settings',[{'variations':5},{'duration':9},{'tempo':301},{'creativity':101}])
def test_setting_limits(settings):
    with pytest.raises(ValidationError):GenerationSettings(**settings)

def test_decode_analyze_and_export(tmp_path):
    wav=tmp_path/'normalized.wav';normalize(SAMPLE,wav,2,14)
    a=analyze(wav)
    assert a['duration']==pytest.approx(12,abs=.05)
    assert a['bpm']==pytest.approx(120,abs=5)
    assert len(a['waveform'])==180
    assert 0<=a['energy']<=100
    assert a['structure'][0]['start']==0
    mp3=tmp_path/'out.mp3';out=tmp_path/'out.wav'
    export(wav,out,mp3,True,-2)
    assert mp3.stat().st_size>1000 and out.stat().st_size>1000
    assert out.read_bytes()[:4]==b'RIFF'

@pytest.mark.parametrize('extension',['mp3','flac','wav'])
def test_real_upload_formats(client,tmp_path,extension):
    from app.audio import run
    source=tmp_path/f'input.{extension}'
    run([config.ffmpeg_path,'-v','error','-y','-i',str(SAMPLE),'-t','4',str(source)])
    r=client.post('/api/uploads',files={'file':(source.name,source.read_bytes())})
    assert r.status_code==201,r.text
    d=r.json();assert d['analysis']['duration']==pytest.approx(4,abs=.05)
    assert client.get(d['audio_url']).content[:4]==b'RIFF'

def test_bad_upload_and_trim(client):
    assert client.post('/api/uploads',files={'file':('bad.txt',b'no')}).status_code==415
    assert client.post('/api/uploads',files={'file':('bad.wav',b'not audio')}).status_code==422
    assert client.post('/api/uploads',files={'file':('valid.wav',SAMPLE.read_bytes())},data={'trim_start':'10','trim_end':'3'}).status_code==422

def test_modes_use_high_level_features():
    a={'genre':'Mixed / tonal','groove':'Steady pulse','beat_intensity':55,'energy':65,'mood':'Balanced','textures':'Warm / tonal','instrumentation':['pitched elements']}
    beat=describe(GenerationSettings(mode='beat'),a)
    vibe=describe(GenerationSettings(mode='vibe'),a)
    assert 'Rhythmic direction' in beat
    assert 'Atmosphere' in vibe
    assert 'entirely new melodies' in beat

# MockTransport is used only in adapter contract tests. Runtime has no mock provider.
def transport_for(payloads,result_url='/v1/audio?path=model.wav'):
    def handle(request):
        if request.url.path=='/health':return httpx.Response(200,json={'code':200,'data':{'status':'ok'}})
        if request.url.path=='/v1/models':return httpx.Response(200,json={'data':{'models':[{'name':'acestep-v15-turbo'}]},'code':200})
        if request.url.path=='/release_task':
            payloads.append(json.loads(request.content))
            return httpx.Response(200,json={'code':200,'data':{'task_id':'real-task-contract'}})
        if request.url.path=='/query_result':
            assert json.loads(request.content)=={'task_id_list':['real-task-contract']}
            return httpx.Response(200,json={'code':200,'data':[{'task_id':'real-task-contract','status':1,'result':json.dumps([{'file':result_url,'status':1}])}]})
        if request.url.path=='/v1/audio':return httpx.Response(200,content=SAMPLE.read_bytes())
        raise AssertionError(request.url)
    return httpx.MockTransport(handle)

def test_official_task_contract(tmp_path):
    payloads=[];p=AceStepProvider('http://gpu:8001',api_key='',transport=transport_for(payloads))
    assert p.health()['available']
    a={'genre':'Mixed / tonal','groove':'Steady pulse','beat_intensity':55,'energy':65,'mood':'Balanced','textures':'Warm / tonal','instrumentation':['pitched elements']}
    out=tmp_path/'model.wav';p.generate(GenerationSettings(mode='vibe'),a,SAMPLE,out)
    assert out.read_bytes()==SAMPLE.read_bytes()
    assert payloads[0]['task_type']=='text2music'
    assert 'reference_audio_path' not in payloads[0]
    assert payloads[0]['audio_format']=='wav'

def test_adapter_rejects_external_result_host(tmp_path):
    p=AceStepProvider('http://gpu:8001',api_key='',transport=transport_for([],result_url='https://unexpected.example/audio.wav'))
    a={'genre':'Mixed','groove':'Steady','beat_intensity':55,'energy':65,'mood':'Balanced','textures':'Warm','instrumentation':['pitched elements']}
    with pytest.raises(ModelUnavailable,match='unexpected download host'):p.generate(GenerationSettings(),a,SAMPLE,tmp_path/'out.wav')
    assert not (tmp_path/'out.wav').exists()

def test_queue_claims_once():
    from app.worker import claim
    with db.connect() as c:c.execute('INSERT INTO jobs (id,upload_id,name,settings,status,stage,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',('j1','u1','Test','{}','queued','Waiting',time.time(),time.time()))
    assert claim()['id']=='j1'
    assert claim() is None
    assert db.get_job('j1')['status']=='running'

def test_unknown_outputs_are_not_readable(client):
    assert client.get('/api/outputs/unknown/missing.wav').status_code==404
    assert client.get('/api/uploads/unknown/audio').status_code==404

@pytest.mark.parametrize('bad',[{'seed':-1},{'seed':2147483648},{'time_signature':'5'},{'key_scale':'unknown'}])
def test_advanced_setting_limits(bad):
    with pytest.raises(ValidationError):GenerationSettings(**bad)

@pytest.mark.parametrize('start,end',[(float('nan'),None),(0,float('inf')),(float('inf'),None)])
def test_nonfinite_trims_rejected(tmp_path,start,end):
    from app.audio import AudioError
    with pytest.raises(AudioError,match='trim'):normalize(SAMPLE,tmp_path/'out.wav',start,end)

def test_missing_tools_block_generation(client,monkeypatch):
    import app.main as main
    monkeypatch.setattr(main,'get_provider',lambda:type('Ready',(),{'health':lambda self:{'available':True,'message':'Ready'}})())
    monkeypatch.setattr(config,'ffmpeg_path','missing-ffmpeg');db.heartbeat()
    d=client.get('/api/health').json()
    assert d['model_available'] and d['worker_ready'] and not d['available'] and not d['analysis_available']
    assert client.post('/api/jobs',json={'upload_id':'missing','settings':{}}).status_code==503

def test_unhealthy_model_not_ready():
    transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'data':{'status':'starting'}}))
    assert not AceStepProvider('http://gpu:8001',api_key='',transport=transport).health()['available']

def test_musical_controls_optional_lm(tmp_path,monkeypatch):
    monkeypatch.setattr(config,'acestep_thinking',False);payloads=[]
    p=AceStepProvider('http://gpu:8001',api_key='',transport=transport_for(payloads))
    a={'genre':'Mixed','groove':'Steady','beat_intensity':55,'energy':65,'mood':'Balanced','textures':'Warm','instrumentation':['pitched elements']}
    p.generate(GenerationSettings(seed=42,key_scale='D minor',time_signature='3'),a,SAMPLE,tmp_path/'out.wav')
    d=payloads[0];assert d['seed']==42 and not d['use_random_seed'] and d['key_scale']=='D minor' and d['time_signature']=='3'
    assert not d['thinking'] and not d['use_cot_caption']

def add_job(jid='cancel-test',status='queued',settings=None):
    with db.connect() as con:
        con.execute('INSERT OR IGNORE INTO uploads VALUES (?,?,?,?,?)',('ref','sample.wav',str(SAMPLE),'{}',time.time()))
        con.execute('INSERT INTO jobs (id,upload_id,name,settings,status,stage,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',(jid,'ref','Test',(settings or GenerationSettings()).model_dump_json(),status,'Waiting',time.time(),time.time()))
    return db.get_job(jid)

def test_cancel_idempotent_and_not_claimed(client):
    from app.worker import claim
    add_job();assert client.post('/api/jobs/cancel-test/cancel').json()['status']=='cancelled'
    assert client.post('/api/jobs/cancel-test/cancel').json()['status']=='cancelled'
    assert claim() is None and client.post('/api/jobs/missing/cancel').status_code==404

def test_running_cancel_preserves_output(client,monkeypatch):
    import app.worker as worker
    calls=[]
    class TestOnlyProvider:
        def health(self):return {'available':True,'message':'Test fixture'}
        def generate(self,settings,analysis,source,output,heartbeat):
            calls.append(settings.seed);db.request_cancel('cancel-test');output.write_bytes(b'test-only-audio')
    monkeypatch.setattr(worker,'get_provider',TestOnlyProvider)
    monkeypatch.setattr(worker,'export',lambda raw,wav,mp3,*a:(wav.write_bytes(raw.read_bytes()),mp3.write_bytes(b'mp3')))
    job=add_job(status='running',settings=GenerationSettings(seed=10,variations=3));worker.process(job);d=db.get_job(job['id'])
    assert d['status']=='cancelled' and d['completed_variations']==1 and calls==[10] and d['outputs'][0]['seed']==10
    assert client.get(d['outputs'][0]['wav_url']).status_code==200
    assert not list((config.data_dir/'outputs'/job['id']).glob('*-model.wav'))

def test_failure_preserves_prior_output(monkeypatch):
    import app.worker as worker
    class TestOnlyProvider:
        def health(self):return {'available':True,'message':'Test fixture'}
        def generate(self,settings,analysis,source,output,heartbeat):
            if settings.seed==11:raise ModelUnavailable('private-service-secret')
            output.write_bytes(b'test-only-audio')
    monkeypatch.setattr(worker,'get_provider',TestOnlyProvider)
    monkeypatch.setattr(worker,'export',lambda raw,wav,mp3,*a:(wav.write_bytes(raw.read_bytes()),mp3.write_bytes(b'mp3')))
    job=add_job(status='running',settings=GenerationSettings(seed=10,variations=3));worker.process(job);d=db.get_job(job['id'])
    assert d['status']=='failed' and d['completed_variations']==1 and len(d['outputs'])==1
    assert 'private-service-secret' not in d['error']

def test_duplicate_worker_lock():
    from app.worker import worker_lock
    with worker_lock():
        with pytest.raises(RuntimeError,match='already running'):
            with worker_lock():pass
    with worker_lock():pass

def test_migration_keeps_old_jobs():
    import sqlite3
    with sqlite3.connect(config.data_dir/'studio.sqlite') as con:
        con.execute('DROP TABLE jobs')
        con.execute("CREATE TABLE jobs (id TEXT PRIMARY KEY,upload_id TEXT,name TEXT,settings TEXT,status TEXT,stage TEXT,outputs TEXT DEFAULT '[]',error TEXT,completed_variations INTEGER DEFAULT 0,created_at REAL,updated_at REAL)")
    add_job(jid='legacy');db.init()
    assert db.get_job('legacy')['cancel_requested']==0 and db.get_job('legacy')['name']=='Test'

def test_bad_saved_settings_do_not_crash_worker():
    from app.worker import process
    job=add_job();job['settings']={'duration':-10};process(job)
    assert db.get_job(job['id'])['status']=='failed'
