from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

class CallStatus(str, Enum):
    IDLE = "idle"
    DIALING = "dialing"
    RINGING = "ringing"
    ACTIVE = "active"
    HOLD = "hold"
    ENDED = "ended"
    FAILED = "failed"

class CallDisposition(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no_answer"
    VOICEMAIL = "voicemail"
    CALL_BACK = "call_back"

class ContactCategory(str, Enum):
    LEAD = "lead"
    CLIENT = "client"
    FOLLOW_UP = "follow_up"
    OTHER = "other"

class Contact(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: str
    notes: Optional[str] = None
    category: ContactCategory = ContactCategory.OTHER
    is_favorite: bool = False
    call_logs: Optional[List[str]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CallLog(BaseModel):
    call_id: str
    from_number: str
    to_number: str
    duration: int = 0
    status: CallStatus = CallStatus.IDLE
    disposition: Optional[CallDisposition] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    recording_url: Optional[str] = None
    recording_duration: Optional[int] = None
    caller_id_name: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Recording(BaseModel):
    call_id: str
    duration: int
    url: str
    size: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TelnyxConfig(BaseModel):
    key: str
    api_key: str
    api_v2_key: str
    webhook_url: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CallNumber(BaseModel):
    number: str
    name: str
    status: str = "active"
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class User(BaseModel):
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OutboundCallMetadata(BaseModel):
    call_id: str
    tts_message: Optional[str] = None
    auto_reconnect: bool = True
    auto_hangup_duration: int = 60
    reconnect_attempts: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
