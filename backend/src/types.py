"""Type definitions matching the frontend WebSocket protocol."""

from enum import Enum
from typing import Literal, Union

from pydantic import BaseModel


# Voice States
class VoiceState(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"


# Tutor Status
class TutorStatus(str, Enum):
    THINKING = "thinking"
    WATCHING = "watching"
    DRAWING = "drawing"


# Canvas Shape Data
class TldrawShapeData(BaseModel):
    id: str
    type: str
    x: float
    y: float
    props: dict


# Screenshot bounds for coordinate transformation
class ScreenshotBounds(BaseModel):
    x: float  # Canvas x coordinate of content bounds start
    y: float  # Canvas y coordinate of content bounds start
    width: float
    height: float
    padding: float  # Padding added around content in screenshot


# Canvas Commands
class AddShapeCommand(BaseModel):
    action: Literal["ADD_SHAPE"] = "ADD_SHAPE"
    shape: TldrawShapeData


class UpdateShapeCommand(BaseModel):
    action: Literal["UPDATE_SHAPE"] = "UPDATE_SHAPE"
    shapeId: str
    updates: dict


class DeleteShapeCommand(BaseModel):
    action: Literal["DELETE_SHAPE"] = "DELETE_SHAPE"
    shapeId: str


class HighlightCommand(BaseModel):
    action: Literal["HIGHLIGHT"] = "HIGHLIGHT"
    shapeIds: list[str]


class PanToCommand(BaseModel):
    action: Literal["PAN_TO"] = "PAN_TO"
    x: float
    y: float


class AddAnimatedTextCommand(BaseModel):
    action: Literal["ADD_ANIMATED_TEXT"] = "ADD_ANIMATED_TEXT"
    text: str
    x: float = 100
    y: float = 100
    color: str = "white"
    size: str = "m"


class AttentionToCommand(BaseModel):
    action: Literal["ATTENTION_TO"] = "ATTENTION_TO"
    x: float
    y: float
    label: str | None = None


class ClearAttentionCommand(BaseModel):
    action: Literal["CLEAR_ATTENTION"] = "CLEAR_ATTENTION"


class ClearCanvasCommand(BaseModel):
    action: Literal["CLEAR_CANVAS"] = "CLEAR_CANVAS"


CanvasCommand = Union[
    AddShapeCommand,
    AddAnimatedTextCommand,
    UpdateShapeCommand,
    DeleteShapeCommand,
    HighlightCommand,
    PanToCommand,
    AttentionToCommand,
    ClearAttentionCommand,
    ClearCanvasCommand,
]


# Client -> Server Messages
class VoiceStartMessage(BaseModel):
    type: Literal["VOICE_START"] = "VOICE_START"


class VoiceAudioClientMessage(BaseModel):
    type: Literal["VOICE_AUDIO"] = "VOICE_AUDIO"
    audio: str  # base64 encoded


class VoiceEndMessage(BaseModel):
    type: Literal["VOICE_END"] = "VOICE_END"


class TextMessageClient(BaseModel):
    type: Literal["TEXT_MESSAGE"] = "TEXT_MESSAGE"
    text: str


class CanvasUpdateMessage(BaseModel):
    type: Literal["CANVAS_UPDATE"] = "CANVAS_UPDATE"
    shapes: list[TldrawShapeData]
    summary: str
    screenshot: str | None = None  # base64 encoded PNG


class CanvasChangeMessage(BaseModel):
    type: Literal["CANVAS_CHANGE"] = "CANVAS_CHANGE"
    added: list[TldrawShapeData]
    modified: list[TldrawShapeData]
    deleted: list[str]


WSClientMessage = Union[
    VoiceStartMessage,
    VoiceAudioClientMessage,
    VoiceEndMessage,
    TextMessageClient,
    CanvasUpdateMessage,
    CanvasChangeMessage,
]


# Server -> Client Messages
class VoiceStateMessage(BaseModel):
    type: Literal["VOICE_STATE"] = "VOICE_STATE"
    state: Literal["idle", "listening", "processing", "speaking"]


class VoiceAudioServerMessage(BaseModel):
    type: Literal["VOICE_AUDIO"] = "VOICE_AUDIO"
    audio: str  # base64 encoded


class VoiceTranscriptMessage(BaseModel):
    type: Literal["VOICE_TRANSCRIPT"] = "VOICE_TRANSCRIPT"
    role: Literal["student", "tutor"]
    text: str


class CanvasCommandMessage(BaseModel):
    type: Literal["CANVAS_COMMAND"] = "CANVAS_COMMAND"
    command: CanvasCommand


class TutorStatusMessage(BaseModel):
    type: Literal["TUTOR_STATUS"] = "TUTOR_STATUS"
    status: Literal["thinking", "watching", "drawing"]


class ErrorMessage(BaseModel):
    type: Literal["ERROR"] = "ERROR"
    code: str
    message: str


class CelebrateMessage(BaseModel):
    type: Literal["CELEBRATE"] = "CELEBRATE"
    intensity: Literal["small", "big"] = "big"


class SessionReadyMessage(BaseModel):
    type: Literal["SESSION_READY"] = "SESSION_READY"


class ClearCheckContextMessage(BaseModel):
    type: Literal["CLEAR_CHECK_CONTEXT"] = "CLEAR_CHECK_CONTEXT"


WSServerMessage = Union[
    VoiceStateMessage,
    VoiceAudioServerMessage,
    VoiceTranscriptMessage,
    CanvasCommandMessage,
    TutorStatusMessage,
    CelebrateMessage,
    SessionReadyMessage,
    ClearCheckContextMessage,
    ErrorMessage,
]
