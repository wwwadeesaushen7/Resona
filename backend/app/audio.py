import json
import subprocess
from pathlib import Path
import librosa
import numpy as np
from scipy.signal import butter, sosfilt
from .config import config

class AudioError(ValueError): pass

def run(args, timeout=120):
    try:
        return subprocess.run(args, check=True, capture_output=True, timeout=timeout)
    except FileNotFoundError as exc:
        raise AudioError('FFmpeg and FFprobe must be installed and available on PATH.') from exc
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise AudioError('The audio could not be processed. Check the format and try a shorter file.') from exc

def normalize(source: Path, destination: Path, start=0., end=None):
    info=json.loads(run([config.ffprobe_path,'-v','error','-show_entries','format=duration','-of','json',str(source)]).stdout)
    duration=float(info['format']['duration'])
    if not np.isfinite(duration) or duration<=0 or duration>config.max_audio_seconds:
        raise AudioError(f'Audio must be no longer than {config.max_audio_seconds} seconds.')
    if not np.isfinite(start) or start<0 or start>=duration or (end is not None and (not np.isfinite(end) or end<=start or end>duration+.15)):
        raise AudioError('Invalid trim range.')
    args=[config.ffmpeg_path,'-v','error','-nostdin','-y','-ss',str(start),'-i',str(source)]
    if end is not None: args+=['-t',str(end-start)]
    args+=['-vn','-ac','2','-ar','44100','-c:a','pcm_s16le',str(destination)]
    run(args)

def analyze(path: Path):
    y,sr=librosa.load(path,sr=22050,mono=True,duration=config.max_audio_seconds)
    if y.size<sr or not np.isfinite(y).all() or np.max(np.abs(y))<1e-5:
        raise AudioError('Choose a non-silent reference that is at least one second long.')
    duration=len(y)/sr
    # Favor the low-band pulse over bright off-beat hats and snare accents.
    # Fall back to broadband onsets for references with little bass content.
    low=sosfilt(butter(4,500,fs=sr,output='sos'),y)
    low_ratio=float(np.mean(low**2)/max(np.mean(y**2),1e-9))
    onset=librosa.onset.onset_strength(y=low if low_ratio>.08 else y,sr=sr,n_mels=32,fmax=500 if low_ratio>.08 else sr/2)
    tempo,beats=librosa.beat.beat_track(onset_envelope=onset,sr=sr)
    bpm=float(np.asarray(tempo).reshape(-1)[0]) if len(beats)>1 else None
    rms=librosa.feature.rms(y=y)[0]
    loudness=float(20*np.log10(max(float(np.sqrt(np.mean(y*y))),1e-9)))
    energy=int(np.clip((loudness+45)/40*100,0,100))
    harmonic,percussive=librosa.effects.hpss(y)
    perc_ratio=float(np.mean(percussive**2)/max(np.mean(y**2),1e-9))
    centroid=float(np.mean(librosa.feature.spectral_centroid(y=y,sr=sr)))
    flatness=float(np.mean(librosa.feature.spectral_flatness(y=y)))
    chroma=librosa.feature.chroma_stft(y=harmonic,sr=sr)
    root=int(np.argmax(chroma.mean(axis=1)))
    key=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][root]
    beat_times=librosa.frames_to_time(beats,sr=sr)
    regularity=float(np.std(np.diff(beat_times))/max(np.mean(np.diff(beat_times)),.001)) if len(beats)>2 else 1.
    groove='Steady pulse' if regularity<.12 else 'Loose or changing rhythm'
    # Broad descriptive cues only: no genre, emotion, or instrument classifier is claimed.
    genre='Beat-driven' if perc_ratio>.45 else 'Ambient-leaning' if energy<45 and (bpm or 0)<110 else 'Mixed / tonal'
    mood='Energetic' if energy>70 else 'Reflective' if energy<40 else 'Balanced'
    instruments=[]
    if perc_ratio>.15: instruments.append('percussive elements')
    if np.mean(harmonic**2)>np.mean(y**2)*.15: instruments.append('pitched / harmonic elements')
    if centroid>2500: instruments.append('bright upper textures')
    if not instruments: instruments=['mixed sound sources']
    textures=('Bright' if centroid>2000 else 'Warm')+(' / noisy' if flatness>.08 else ' / tonal')
    # Segment at changes in the MFCC feature sequence, not assumed verse/chorus identities.
    segment_count=min(5,max(1,int(duration/8)))
    mfcc=librosa.feature.mfcc(y=y,sr=sr,n_mfcc=12)
    boundaries=librosa.segment.agglomerative(mfcc,k=segment_count) if segment_count>1 else np.array([0])
    times=[float(t) for t in librosa.frames_to_time(boundaries,sr=sr)]+[duration]
    structure=[{'label':f'Section {i+1}','start':round(a,2),'end':round(b,2)} for i,(a,b) in enumerate(zip(times,times[1:]))]
    waveform=[float(np.max(np.abs(a))) for a in np.array_split(y,180) if len(a)]
    return {'bpm':round(bpm,1) if bpm else None,'duration':round(duration,2),'energy':energy,'beat_intensity':int(np.clip(perc_ratio*150,0,100)),'groove':groove,'instrumentation':instruments,'genre':genre,'mood':mood,'textures':textures,'structure':structure,'key_hint':key,'rms_db':round(loudness,1),'waveform':waveform,'estimation_note':'Genre, mood and instrument cues are broad signal-based heuristics, not semantic classification. Structure indicates feature changes, not named song sections.'}

def export(source: Path, wav: Path, mp3: Path, mastering=True, gain_db=0):
    filters=[]
    if mastering: filters.append('loudnorm=I=-14:TP=-1.5:LRA=11')
    filters.extend([f'volume={gain_db}dB','alimiter=limit=0.95'])
    run([config.ffmpeg_path,'-v','error','-nostdin','-y','-i',str(source),'-af',','.join(filters),'-ar','44100','-ac','2','-c:a','pcm_s16le',str(wav)])
    run([config.ffmpeg_path,'-v','error','-nostdin','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','320k',str(mp3)])
