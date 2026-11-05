"""Replaceable inference adapter. Only real model audio is accepted as output.
Contract: https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/API.md
"""
import json
import time
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import urljoin,urlparse
import httpx
from .config import config
from .schemas import GenerationSettings

class ModelUnavailable(RuntimeError): pass

def describe(settings: GenerationSettings, a: dict):
    genre=a['genre'] if settings.genre=='Auto-detect' else settings.genre
    common=f"Create a new original {genre} composition at {settings.tempo} BPM. Use entirely new melodies, chord progressions and arrangements. Do not reproduce identifiable passages, vocals or lyrics from a reference. "
    if settings.mode=='beat':
        common+=f"Rhythmic direction: {a['groove']}; percussive intensity {a['beat_intensity']}/100; reference energy {a['energy']}/100. Aim for rhythm similarity {settings.rhythm}/100, beat intensity {settings.intensity}/100 and energy {settings.energy}/100. Melody invention {settings.originality}/100. Change the instrumental palette by {settings.instrument_changes}/100. "
    else:
        common+=f"Atmosphere: {a['mood']}; texture: {a['textures']}; sound palette: {', '.join(a['instrumentation'])}. Mood closeness {settings.mood_similarity}/100; emotional intensity {settings.emotional_intensity}/100. Use fresh rhythm and harmony. "
    common+=f"Creative exploration {settings.creativity}/100. Instruments: {settings.instruments}. "
    common+='Instrumental only, no singing or spoken voice. ' if settings.instrumental else 'Vocals may be included; use original words only. '
    return common+settings.instructions

class MusicProvider(ABC):
    @abstractmethod
    def health(self): ...
    @abstractmethod
    def generate(self, settings, analysis, source, output, heartbeat=lambda:None): ...

class AceStepProvider(MusicProvider):
    def __init__(self, base=None, api_key=None, transport=None):
        self.base=(config.acestep_base_url if base is None else base).rstrip('/')
        self.headers={'Authorization':f'Bearer {config.acestep_api_key if api_key is None else api_key}'} if (config.acestep_api_key if api_key is None else api_key) else {}
        self.transport=transport
    def client(self, timeout=60):
        return httpx.Client(base_url=self.base,headers=self.headers,timeout=timeout,transport=self.transport,follow_redirects=False)
    @staticmethod
    def unwrap(response):
        response.raise_for_status()
        body=response.json()
        if not isinstance(body,dict):raise ModelUnavailable('Invalid inference response.')
        if body.get('error') or body.get('code',200)!=200: raise ModelUnavailable(str(body.get('error') or 'The model rejected the request.'))
        return body.get('data',body)
    def health(self):
        if not self.base:return {'available':False,'message':'Set ACESTEP_BASE_URL in backend/.env to connect an ACE-Step inference service.'}
        try:
            with self.client(timeout=5) as c:
                state=self.unwrap(c.get('/health'))
                if not isinstance(state,dict) or state.get('status')!='ok':return {'available':False,'message':'ACE-Step is starting or reports an unhealthy state.'}
                models=self.unwrap(c.get('/v1/models'))
                entries=models.get('models',models.get('data',[])) if isinstance(models,dict) else models
                # A responding HTTP server alone is not evidence that a generation model is loaded.
                ids=[m.get('id',m.get('name',m.get('model_name',''))) if isinstance(m,dict) else str(m) for m in entries]
                ready=bool(ids) and config.acestep_model in ids
                return {'available':ready,'message':'ACE-Step is ready.' if ready else f'Model {config.acestep_model} is not listed by the inference service.'}
        except (httpx.HTTPError,ValueError,TypeError,AttributeError,ModelUnavailable):
            return {'available':False,'message':'Cannot reach ACE-Step. Check its address, credentials, and model startup log.'}
    def generate(self,settings,analysis,source:Path,output:Path,heartbeat=lambda:None):
        if not self.base:raise ModelUnavailable('Model inference is not configured.')
        payload={'prompt':describe(settings,analysis),'lyrics':'[Instrumental]' if settings.instrumental else '', 'task_type':'cover' if settings.preserve_source else 'text2music','model':config.acestep_model,'thinking':config.acestep_thinking and not settings.preserve_source,'use_cot_caption':config.acestep_thinking,'use_cot_language':config.acestep_thinking,'bpm':settings.tempo,'audio_duration':settings.duration,'batch_size':1,'audio_format':'wav','inference_steps':config.acestep_inference_steps,'use_random_seed':settings.seed is None,'seed':settings.seed if settings.seed is not None else -1,'key_scale':settings.key_scale,'time_signature':settings.time_signature,'lm_temperature':round(.5+settings.creativity*.009,3)}
        with self.client() as c:
            if settings.preserve_source:
                if not settings.rights_confirmed:raise ValueError('Permission is required for source transformation.')
                with source.open('rb') as f:
                    response=c.post('/release_task',data={k:str(v).lower() if isinstance(v,bool) else str(v) for k,v in {**payload,'audio_cover_strength':max(.2,settings.rhythm/100) if settings.mode=='beat' else .2}.items()},files={'src_audio':('reference.wav',f,'audio/wav')})
            else:
                response=c.post('/release_task',json=payload)
            task=self.unwrap(response)
            task_id=task.get('task_id')
            if not task_id:raise ModelUnavailable('The inference service returned no task ID.')
            deadline=time.monotonic()+config.generation_timeout
            while time.monotonic()<deadline:
                heartbeat()
                rows=self.unwrap(c.post('/query_result',json={'task_id_list':[task_id]}))
                row=next((r for r in rows if r.get('task_id')==task_id),None)
                if row and row.get('status')==2:raise ModelUnavailable('The model reported a failed generation.')
                if row and row.get('status')==1:
                    results=json.loads(row['result']) if isinstance(row.get('result'),str) else row.get('result',[])
                    if not results or results[0].get('status',1)!=1 or not results[0].get('file'):raise ModelUnavailable('The model returned no successful audio output.')
                    url=urljoin(self.base+'/',results[0]['file'])
                    if urlparse(url).netloc!=urlparse(self.base).netloc or urlparse(url).scheme!=urlparse(self.base).scheme:raise ModelUnavailable('The model returned an unexpected download host.')
                    output.parent.mkdir(parents=True,exist_ok=True)
                    with c.stream('GET',url) as r:
                        r.raise_for_status()
                        total=0
                        with output.open('wb') as f:
                            for chunk in r.iter_bytes():
                                total+=len(chunk)
                                if total>300*1024*1024:raise ModelUnavailable('The output exceeds the supported file size.')
                                f.write(chunk)
                    if output.stat().st_size<44:raise ModelUnavailable('The model returned an empty audio file.')
                    return
                time.sleep(2)
            raise ModelUnavailable('Generation timed out waiting for the Model inference service.')

def get_provider():
    if config.model_provider=='acestep':return AceStepProvider()
    raise ModelUnavailable(f'Unsupported model provider: {config.model_provider}')
