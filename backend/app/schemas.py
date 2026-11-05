from typing import Literal
from pydantic import BaseModel, Field, model_validator

class GenerationSettings(BaseModel):
    mode: Literal['beat','vibe'] = 'beat'
    duration: int = Field(60, ge=10, le=600)
    variations: int = Field(2, ge=1, le=4)
    instrumental: bool = True
    creativity: int = Field(65, ge=0, le=100)
    rhythm: int = Field(75, ge=0, le=100)
    intensity: int = Field(70, ge=0, le=100)
    originality: int = Field(85, ge=0, le=100)
    instrument_changes: int = Field(60, ge=0, le=100)
    energy: int = Field(70, ge=0, le=100)
    mood_similarity: int = Field(75, ge=0, le=100)
    emotional_intensity: int = Field(65, ge=0, le=100)
    tempo: int = Field(120, ge=30, le=300)
    seed: int | None = Field(None, ge=0, le=2147483647)
    key_scale: str = Field('', pattern=r'^$|^[A-G](?:#|b)? (?:major|minor)$')
    time_signature: Literal['', '2', '3', '4', '6'] = ''
    genre: str = Field('Auto-detect', max_length=100)
    instruments: str = Field('Let the model choose', max_length=300)
    instructions: str = Field('', max_length=2000)
    mastering: bool = True
    gain_db: int = Field(0, ge=-12, le=6)
    preserve_source: bool = False
    rights_confirmed: bool = False

    @model_validator(mode='after')
    def check_rights(self):
        if self.preserve_source and not self.rights_confirmed:
            raise ValueError('Source transformations require ownership or permission confirmation.')
        return self

class JobRequest(BaseModel):
    upload_id: str
    settings: GenerationSettings
