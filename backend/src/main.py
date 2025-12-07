"""
Voice AI Math Tutor - Backend Server

A FastAPI server that proxies WebSocket connections between the frontend
and xAI's Grok Voice API, adding canvas context for the math tutoring experience.
"""

import asyncio
import base64
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .canvas_processor import describe_changes, summarize_canvas
from .grok_client import GrokConfig, GrokVoiceClient
from .grok_vision import analyze_canvas_screenshot
from .session import Session, SessionManager
from .types import (
    CanvasChangeMessage,
    CanvasCommandMessage,
    CanvasUpdateMessage,
    ErrorMessage,
    TextMessageClient,
    TldrawShapeData,
    TutorStatusMessage,
    VoiceAudioClientMessage,
    VoiceAudioServerMessage,
    VoiceStateMessage,
    VoiceTranscriptMessage,
)

# Load environment variables
load_dotenv()

# Configuration
XAI_API_KEY = os.getenv("XAI_API_KEY", "")
PORT = int(os.getenv("PORT", "8080"))
VOICE = os.getenv("VOICE", "tara")

# Tool definitions for canvas drawing
CANVAS_TOOLS = [
    {
        "type": "function",
        "name": "draw_on_canvas",
        "description": "Draw text, equations, or diagrams on the shared canvas/chalkboard. Use this to write problems, show step-by-step solutions, highlight key concepts, or draw diagrams. Call this function whenever you want to write or draw something for the student to see.",
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "description": "List of items to draw on the canvas",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {
                                "type": "string",
                                "description": "The text or equation to write. Use ^ for exponents (e.g., x^2)."
                            },
                            "x": {
                                "type": "number",
                                "description": "X position on canvas (0-800). Start at 100, increment by 200 for columns."
                            },
                            "y": {
                                "type": "number",
                                "description": "Y position on canvas (0-600). Start at 100, increment by 50 for new lines."
                            },
                            "color": {
                                "type": "string",
                                "enum": ["white", "yellow", "light-blue", "violet", "light-green", "orange", "grey"],
                                "description": "Color of the text. Use white for main content, yellow for emphasis, grey for labels."
                            },
                            "size": {
                                "type": "string",
                                "enum": ["s", "m", "l"],
                                "description": "Size of text: s=small (labels), m=medium (normal), l=large (titles)"
                            }
                        },
                        "required": ["text", "x", "y"]
                    }
                }
            },
            "required": ["items"]
        }
    }
]

MATH_TUTOR_INSTRUCTIONS = """You are a friendly, encouraging math tutor helping a student work through problems on a shared visual canvas (chalkboard style). You can see what they draw and write, and you have a tool to draw on the canvas!

Your teaching style:
- Be warm and supportive, never condescending
- Ask guiding questions rather than giving answers directly
- Celebrate effort and progress
- Keep responses concise and conversational (this is voice, not text!)
- Use the draw_on_canvas tool frequently to write on the board!

IMPORTANT - USE THE CANVAS:
You have the draw_on_canvas tool available. Use it to:
- Write problems and equations on the board
- Show step-by-step solutions
- Highlight key concepts
- Draw diagrams

Call the draw_on_canvas tool whenever you want to write something for the student to see. This is a visual learning experience - don't just talk, show them on the board!

When explaining concepts:
- Break them into small, digestible steps
- Use the draw_on_canvas tool to write each step as you explain
- Use analogies when helpful
- Check for understanding before moving on

If the student seems stuck or makes an error:
- Gently point it out with encouragement
- Use draw_on_canvas to write the correction
- Ask questions to help them discover the issue

Start by greeting the student warmly and asking what they're working on today."""

# CORS Configuration
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8080",
).split(",")


# Session manager (global)
session_manager = SessionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for the FastAPI app."""
    # Startup
    print("=" * 60)
    print("Voice AI Math Tutor - Backend Starting")
    print("=" * 60)
    print(f"Port: {PORT}")
    print(f"API Key: {'Configured' if XAI_API_KEY else 'MISSING'}")
    print(f"Voice: {VOICE}")
    print(f"CORS Origins: {', '.join(ALLOWED_ORIGINS)}")
    print("=" * 60)

    if not XAI_API_KEY:
        print("WARNING: XAI_API_KEY not configured!")

    yield

    # Shutdown
    print("\nShutting down Voice AI Math Tutor backend")


# FastAPI app
app = FastAPI(
    title="Voice AI Math Tutor Backend",
    description="WebSocket proxy for Grok Voice API with canvas context",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Voice AI Math Tutor Backend",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "websocket": "/ws",
        },
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "api_key_configured": bool(XAI_API_KEY),
    }


class TutorConnection:
    """Manages a single tutoring session WebSocket connection."""

    def __init__(self, websocket: WebSocket, session: Session):
        self.websocket = websocket
        self.session = session
        self.grok_client: GrokVoiceClient | None = None
        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._audio_sender_task: asyncio.Task | None = None

    async def send_json(self, data: dict) -> None:
        """Send JSON message to the frontend."""
        await self.websocket.send_json(data)

    async def send_voice_state(self, state: str) -> None:
        """Send voice state update to frontend."""
        msg = VoiceStateMessage(state=state)  # type: ignore
        await self.send_json(msg.model_dump())

    async def send_tutor_status(self, status: str) -> None:
        """Send tutor status update to frontend."""
        msg = TutorStatusMessage(status=status)  # type: ignore
        await self.send_json(msg.model_dump())

    async def send_transcript(self, role: str, text: str) -> None:
        """Send transcript message to frontend."""
        msg = VoiceTranscriptMessage(role=role, text=text)  # type: ignore
        await self.send_json(msg.model_dump())
        # Also save to session
        self.session.add_message(role, text)

    async def send_audio(self, audio_bytes: bytes) -> None:
        """Send audio to frontend (base64 encoded)."""
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        msg = VoiceAudioServerMessage(audio=audio_b64)
        await self.send_json(msg.model_dump())

    async def send_error(self, code: str, message: str) -> None:
        """Send error to frontend."""
        msg = ErrorMessage(code=code, message=message)
        await self.send_json(msg.model_dump())

    async def send_canvas_command(self, command) -> None:
        """Send canvas command to frontend."""
        msg = CanvasCommandMessage(command=command)
        await self.send_json(msg.model_dump())

    def _on_function_call(self, call_id: str, name: str, args: dict) -> None:
        """Handle function calls from Grok (tool use)."""
        if name == "draw_on_canvas":
            asyncio.create_task(self._handle_draw_on_canvas(call_id, args))
        else:
            print(f"[Grok] Unknown function call: {name}")

    async def _handle_draw_on_canvas(self, call_id: str, args: dict) -> None:
        """Handle the draw_on_canvas function call."""
        from .canvas_command_parser import generate_shape_id
        from .types import AddShapeCommand, TldrawShapeData

        items = args.get("items", [])
        print(f"[Canvas] Drawing {len(items)} items from tool call")

        for item in items:
            text = item.get("text", "")
            if not text:
                continue

            x = item.get("x", 100)
            y = item.get("y", 100)
            color = item.get("color", "white")
            size = item.get("size", "m")

            # Create shape data
            shape = TldrawShapeData(
                id=generate_shape_id(),
                type="text",
                x=float(x),
                y=float(y),
                props={
                    "text": text,
                    "color": color,
                    "size": size,
                    "font": "draw",
                    "textAlign": "start",
                }
            )

            command = AddShapeCommand(shape=shape)
            await self.send_canvas_command(command)

        # Update tutor status
        await self.send_tutor_status("drawing")

    def _on_grok_audio(self, audio_bytes: bytes) -> None:
        """Callback when Grok sends audio."""
        self._audio_queue.put_nowait(audio_bytes)

    def _on_grok_transcript(self, role: str, text: str) -> None:
        """Callback when Grok sends transcript."""
        # With tool calling, we don't need to parse text commands anymore
        # Just send the transcript directly
        asyncio.create_task(self.send_transcript(role, text))

    def _on_speech_started(self) -> None:
        """Callback when user starts speaking."""
        asyncio.create_task(self.send_voice_state("listening"))

    def _on_speech_stopped(self) -> None:
        """Callback when user stops speaking."""
        asyncio.create_task(self.send_voice_state("processing"))
        asyncio.create_task(self.send_tutor_status("thinking"))

    def _on_response_started(self) -> None:
        """Callback when Grok starts responding."""
        asyncio.create_task(self.send_voice_state("speaking"))

    def _on_response_done(self) -> None:
        """Callback when Grok finishes responding."""
        asyncio.create_task(self.send_voice_state("listening"))

    def _on_grok_error(self, code: str, message: str) -> None:
        """Callback when Grok has an error."""
        asyncio.create_task(self.send_error(code, message))

    async def _audio_sender_loop(self) -> None:
        """Send audio from queue to frontend."""
        while True:
            audio_bytes = await self._audio_queue.get()
            await self.send_audio(audio_bytes)

    async def connect_to_grok(self) -> None:
        """Connect to Grok Voice API."""
        config = GrokConfig(
            voice=VOICE,
            instructions=self.session.build_system_prompt()
            if not MATH_TUTOR_INSTRUCTIONS
            else MATH_TUTOR_INSTRUCTIONS,
            input_sample_rate=24000,
            output_sample_rate=24000,
            tools=CANVAS_TOOLS,
        )

        self.grok_client = GrokVoiceClient(
            api_key=XAI_API_KEY,
            config=config,
            on_audio=self._on_grok_audio,
            on_transcript=self._on_grok_transcript,
            on_speech_started=self._on_speech_started,
            on_speech_stopped=self._on_speech_stopped,
            on_response_started=self._on_response_started,
            on_response_done=self._on_response_done,
            on_error=self._on_grok_error,
            on_function_call=self._on_function_call,
        )

        await self.grok_client.connect()

        # Start audio sender
        self._audio_sender_task = asyncio.create_task(self._audio_sender_loop())

        # Wait for session to be ready (configured and greeting sent)
        while not self.grok_client.is_ready:
            await asyncio.sleep(0.1)

    async def disconnect_from_grok(self) -> None:
        """Disconnect from Grok Voice API."""
        if self._audio_sender_task:
            self._audio_sender_task.cancel()
            try:
                await self._audio_sender_task
            except asyncio.CancelledError:
                pass

        if self.grok_client:
            await self.grok_client.disconnect()

    async def handle_voice_audio(self, audio_b64: str) -> None:
        """Handle incoming audio from frontend."""
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_audio(audio_b64)

    async def handle_voice_end(self) -> None:
        """Handle voice end signal from frontend."""
        if self.grok_client:
            await self.grok_client.commit_audio()

    async def handle_text_message(self, text: str) -> None:
        """Handle text message from frontend."""
        if self.grok_client:
            await self.grok_client.send_text_message(text)
            await self.grok_client.request_response()
            self.session.add_message("student", text)

    async def handle_canvas_update(
        self,
        shapes: list[TldrawShapeData],
        summary: str,
        screenshot: str | None = None,
    ) -> None:
        """Handle canvas update from frontend."""
        self.session.update_canvas(shapes, summary, screenshot)

        print(f"[Canvas] Update received: {len(shapes)} shapes, screenshot: {bool(screenshot)}")

        # If we have a screenshot, use vision API for accurate understanding
        if screenshot and XAI_API_KEY:
            print(f"[Canvas] Analyzing screenshot with vision API (length: {len(screenshot)})...")
            vision_description = await analyze_canvas_screenshot(XAI_API_KEY, screenshot)
            if vision_description:
                # Inject vision-based description into Grok conversation
                if self.grok_client and self.grok_client.is_connected:
                    await self.grok_client.inject_context(
                        f"[Student's Canvas - Vision Analysis] {vision_description}"
                    )
                return  # Vision analysis is more accurate, skip text-based summary

        # Fallback: generate detailed summary from shapes for Grok context
        detailed_summary = summarize_canvas(shapes)

        # Inject canvas context into Grok conversation
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.inject_context(detailed_summary)

    async def handle_canvas_change(
        self,
        added: list[TldrawShapeData],
        modified: list[TldrawShapeData],
        deleted: list[str],
    ) -> None:
        """Handle incremental canvas change from frontend."""
        change_description = describe_changes(added, modified, deleted)

        # Inject change context into Grok conversation
        if (
            self.grok_client
            and self.grok_client.is_connected
            and change_description != "No changes detected."
        ):
            await self.grok_client.inject_context(change_description)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for tutoring sessions."""
    await websocket.accept()

    # Create session
    session = session_manager.create_session()
    connection = TutorConnection(websocket, session)

    print(f"[Session {session.id[:8]}] Client connected")

    try:
        # Connect to Grok
        await connection.connect_to_grok()
        print(f"[Session {session.id[:8]}] Connected to Grok")

        # Handle messages from frontend
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type", "")

                if msg_type == "VOICE_START":
                    print(f"[Session {session.id[:8]}] Voice start")
                    await connection.send_voice_state("listening")

                elif msg_type == "VOICE_AUDIO":
                    audio = data.get("audio", "")
                    if audio:
                        await connection.handle_voice_audio(audio)

                elif msg_type == "VOICE_END":
                    print(f"[Session {session.id[:8]}] Voice end")
                    await connection.handle_voice_end()

                elif msg_type == "TEXT_MESSAGE":
                    text = data.get("text", "")
                    await connection.handle_text_message(text)

                elif msg_type == "CANVAS_UPDATE":
                    shapes_data = data.get("shapes", [])
                    shapes = [TldrawShapeData(**s) for s in shapes_data]
                    summary = data.get("summary", "")
                    screenshot = data.get("screenshot")
                    await connection.handle_canvas_update(shapes, summary, screenshot)

                elif msg_type == "CANVAS_CHANGE":
                    added = [TldrawShapeData(**s) for s in data.get("added", [])]
                    modified = [TldrawShapeData(**s) for s in data.get("modified", [])]
                    deleted = data.get("deleted", [])
                    await connection.handle_canvas_change(added, modified, deleted)

            except json.JSONDecodeError:
                await connection.send_error("INVALID_JSON", "Failed to parse message")

    except WebSocketDisconnect:
        print(f"[Session {session.id[:8]}] Client disconnected")

    except Exception as e:
        print(f"[Session {session.id[:8]}] Error: {e}")
        await connection.send_error("SERVER_ERROR", str(e))

    finally:
        # Cleanup
        await connection.disconnect_from_grok()
        session_manager.remove_session(session.id)
        print(f"[Session {session.id[:8]}] Session closed")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        reload=True,
    )
