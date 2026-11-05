from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    data_dir: Path = Path('data')
    allowed_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    model_provider: str = 'acestep'
    acestep_base_url: str = ''
    acestep_api_key: str = ''
    acestep_model: str = 'acestep-v15-turbo'
    acestep_thinking: bool = True
    acestep_inference_steps: int = Field(8, ge=1, le=200)
    generation_timeout: int = 1800
    max_upload_mb: int = 100
    max_audio_seconds: int = 600
    ffmpeg_path: str = 'ffmpeg'
    ffprobe_path: str = 'ffprobe'

config = Config()
config.data_dir.mkdir(parents=True, exist_ok=True)
