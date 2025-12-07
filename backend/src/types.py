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


CanvasCommand = Union[
    AddShapeCommand,
    AddAnimatedTextCommand,
    UpdateShapeCommand,
    DeleteShapeCommand,
    HighlightCommand,
    PanToCommand,
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
    state: Literal["listening", "processing", "speaking"]


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


WSServerMessage = Union[
    VoiceStateMessage,
    VoiceAudioServerMessage,
    VoiceTranscriptMessage,
    CanvasCommandMessage,
    TutorStatusMessage,
    ErrorMessage,
]
