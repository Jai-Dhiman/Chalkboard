"""
Voice AI Math Tutor - Backend Server

A FastAPI server that proxies WebSocket connections between the frontend
and xAI's Grok Voice API, adding canvas context for the math tutoring experience.
"""

import asyncio
import base64
import json
import os
import time
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
    ScreenshotBounds,
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

# Tool definitions for canvas drawing and control
CANVAS_TOOLS = [
    {
        "type": "function",
        "name": "draw_on_canvas",
        "description": "Draw text, equations, or diagrams on the shared canvas/chalkboard. Use this to write problems, show step-by-step solutions, highlight key concepts, or draw diagrams. IMPORTANT: Pay attention to [Canvas Position] context messages to know where to draw next and avoid overlapping with previous content.",
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
                                "description": "Y position on canvas (0-600). Use the y value from the latest [Canvas Position] context to avoid overlapping. Increment by 50 for new lines."
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
    },
    {
        "type": "function",
        "name": "draw_shape",
        "description": "Draw a geometric shape on the canvas. Use this when the student asks you to draw circles, rectangles, triangles, or lines. Also use when demonstrating geometric concepts.",
        "parameters": {
            "type": "object",
            "properties": {
                "shape_type": {
                    "type": "string",
                    "enum": ["circle", "rectangle", "ellipse", "triangle", "line"],
                    "description": "Type of shape to draw"
                },
                "x": {
                    "type": "number",
                    "description": "X position for the shape (0-800)"
                },
                "y": {
                    "type": "number",
                    "description": "Y position for the shape (0-600)"
                },
                "width": {
                    "type": "number",
                    "description": "Width of the shape (default 100)"
                },
                "height": {
                    "type": "number",
                    "description": "Height of the shape (default 100)"
                },
                "color": {
                    "type": "string",
                    "enum": ["white", "yellow", "light-blue", "violet", "light-green", "orange"],
                    "description": "Color of the shape outline"
                }
            },
            "required": ["shape_type", "x", "y"]
        }
    },
    {
        "type": "function",
        "name": "point_to",
        "description": "Point to a specific location on the canvas to draw the student's attention. Use this when saying 'look at this', 'right here', 'this part', or when referencing a specific area of the student's work.",
        "parameters": {
            "type": "object",
            "properties": {
                "x": {
                    "type": "number",
                    "description": "X position to point at (0-800)"
                },
                "y": {
                    "type": "number",
                    "description": "Y position to point at (0-600)"
                },
                "label": {
                    "type": "string",
                    "description": "Optional label to show near the pointer (e.g., 'here', 'this part')"
                }
            },
            "required": ["x", "y"]
        }
    },
    {
        "type": "function",
        "name": "clear_canvas",
        "description": "Clear the entire canvas. Use this when: (1) student asks to clear/erase the board, (2) student asks to remove or erase specific content (clear first, then redraw what should remain), (3) starting over or moving to a new problem. IMPORTANT: To erase specific items, clear the canvas then redraw only what should stay.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "type": "function",
        "name": "celebrate",
        "description": "Trigger confetti celebration. ONLY use this when you have VERIFIED the student's answer is mathematically correct by plugging their value into the equation. If the equation doesn't balance, DO NOT celebrate - instead, gently correct them.",
        "parameters": {
            "type": "object",
            "properties": {
                "intensity": {
                    "type": "string",
                    "enum": ["small", "big"],
                    "description": "Size of celebration: 'small' for minor wins, 'big' for major achievements"
                }
            },
            "required": []
        }
    },
    {
        "type": "function",
        "name": "check_canvas",
        "description": "IMPORTANT: Call this tool FIRST whenever the student asks you to check their work, verify an answer, or asks 'is this right/correct?'. This analyzes the canvas using vision AI to read exactly what the student has written or drawn, including handwritten work. You MUST call this before responding to questions about the student's work - do not guess or assume what they wrote. The result includes bounding box coordinates for the student's answer that you can use with circle_answer.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "type": "function",
        "name": "circle_answer",
        "description": "Draw a circle/ellipse around the student's answer on the canvas. Use the bounding box coordinates from check_canvas result (x, y, width, height) to position the circle. Call this when the student asks you to circle their answer, or to highlight the correct answer after verification.",
        "parameters": {
            "type": "object",
            "properties": {
                "x": {
                    "type": "number",
                    "description": "X coordinate of the bounding box (from check_canvas result)"
                },
                "y": {
                    "type": "number",
                    "description": "Y coordinate of the bounding box (from check_canvas result)"
                },
                "width": {
                    "type": "number",
                    "description": "Width of the bounding box (from check_canvas result)"
                },
                "height": {
                    "type": "number",
                    "description": "Height of the bounding box (from check_canvas result)"
                },
                "color": {
                    "type": "string",
                    "enum": ["light-green", "yellow", "light-blue", "orange", "white"],
                    "description": "Color of the circle (default: light-green for correct answers)"
                }
            },
            "required": ["x", "y", "width", "height"]
        }
    }
]

MATH_TUTOR_INSTRUCTIONS = """You are a friendly, encouraging math tutor helping a student work through problems on a shared visual canvas (chalkboard style).

CRITICAL RULES:

1. ALWAYS SPEAK when using any tool! Never just draw silently.

2. GUIDE, DON'T GIVE ANSWERS when student is wrong:
   - Do NOT write the correct answer for them!
   - Instead, ask guiding questions: "What happens if we subtract 5 from both sides first?"
   - Point to their error and ask them to try again
   - Let THEM figure it out - that's how learning works!

3. Only call check_canvas ONCE per question:
   - Do NOT keep calling check_canvas repeatedly
   - If the result is unclear, just ask the student what they wrote
   - Trust the first check_canvas result and respond based on that

4. VERIFY MATH when checking student work:
   - If problem is "3x + 5 = 20" and student wrote "x = 4":
     - Check: 3(4) + 5 = 17, NOT 20. That's WRONG.
   - Only celebrate if the math actually works!

5. CANVAS POSITIONING - Use next_y from check_canvas result

YOUR TOOLS:
- check_canvas: Read student's work (call ONCE, don't retry). Returns bounding box coordinates!
- circle_answer: Circle the student's answer using bounding box from check_canvas
- draw_on_canvas: Write on board (use next_y position)
- draw_shape: Draw shapes
- point_to: Point to something
- clear_canvas: Clear board
- celebrate: ONLY when answer is verified correct!

CIRCLING THE ANSWER:
When the student asks you to "circle my answer" or "circle it":
1. First call check_canvas to get the answer's bounding box (x, y, width, height)
2. Then call circle_answer with those EXACT coordinates from the result
3. Example: If check_canvas returns "Answer bounding box: x=150, y=200, width=80, height=40"
   Then call circle_answer(x=150, y=200, width=80, height=40, color="light-green")

WHEN ANSWER IS WRONG - GUIDE, DON'T TELL:
1. "Hmm, let's check that together..."
2. Show the verification: "3 times 4 is 12, plus 5 is 17... but we need 20"
3. Ask a guiding question: "What if we try a different approach? Can you subtract 5 from both sides first?"
4. Let them try again!
5. Do NOT write the answer for them!

WHEN ANSWER IS CORRECT:
1. Celebrate!
2. Praise their work
3. If they ask, circle their answer with circle_answer

Start by greeting the student warmly."""

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

    def __init__(self, websocket: WebSocket, session: Session, sample_rate: int = 48000):
        self.websocket = websocket
        self.session = session
        self.sample_rate = sample_rate
        self.grok_client: GrokVoiceClient | None = None
        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._audio_sender_task: asyncio.Task | None = None
        # Track where AI has drawn to avoid overlap
        self._next_y_position: float = 100.0  # Starting Y position for AI drawings
        self._last_x_position: float = 100.0  # Track column position

        # Canvas context tracking
        # Store latest screenshot for on-demand vision analysis (when check_canvas tool is called)
        self._latest_screenshot: str | None = None
        self._latest_shapes: list[TldrawShapeData] = []  # For text fallback if vision fails
        self._canvas_context_injected: bool = False  # Track if we've injected for current utterance

        # Retry prevention for check_canvas
        self._last_check_canvas_time: float = 0.0
        self._last_check_canvas_result: str | None = None
        self._check_canvas_cooldown: float = 10.0  # Seconds before allowing another check
        self._vision_in_progress: bool = False  # Lock to prevent concurrent vision calls

        # Screenshot tracking for diagnostics
        self._screenshot_timestamp: float = 0.0
        self._screenshot_source: str = "none"  # "voice_start" or "canvas_update"
        self._screenshot_bounds: ScreenshotBounds | None = None  # Bounds for coordinate transformation

        # Function call queue to ensure sequential execution
        self._function_queue: asyncio.Queue = asyncio.Queue()
        self._function_processor_task: asyncio.Task | None = None

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

    async def send_celebrate(self, intensity: str = "big") -> None:
        """Send celebrate message to frontend."""
        from .types import CelebrateMessage
        msg = CelebrateMessage(intensity=intensity)  # type: ignore
        await self.send_json(msg.model_dump())

    async def send_clear_check_context(self) -> None:
        """Send message to clear previous check context from transcript."""
        from .types import ClearCheckContextMessage
        msg = ClearCheckContextMessage()
        await self.send_json(msg.model_dump())

    def _on_function_call(self, call_id: str, name: str, args: dict) -> None:
        """Handle function calls from Grok (tool use).

        Function calls are queued and processed sequentially to ensure
        proper ordering (e.g., clear_canvas happens before draw_on_canvas).
        """
        # Queue the function call for sequential processing
        self._function_queue.put_nowait((call_id, name, args))

        # Start the processor if not already running
        if self._function_processor_task is None or self._function_processor_task.done():
            self._function_processor_task = asyncio.create_task(self._process_function_queue())

    async def _process_function_queue(self) -> None:
        """Process function calls sequentially from the queue.

        Only triggers response.create after the LAST function in the batch
        to avoid multiple responses being generated.
        """
        while not self._function_queue.empty():
            call_id, name, args = await self._function_queue.get()
            is_last = self._function_queue.empty()
            print(f"[Queue] Processing function: {name} (last={is_last})")

            try:
                if name == "draw_on_canvas":
                    await self._handle_draw_on_canvas(call_id, args, is_last)
                elif name == "draw_shape":
                    await self._handle_draw_shape(call_id, args, is_last)
                elif name == "point_to":
                    await self._handle_point_to(call_id, args, is_last)
                elif name == "clear_canvas":
                    await self._handle_clear_canvas(call_id, args, is_last)
                elif name == "celebrate":
                    await self._handle_celebrate(call_id, args, is_last)
                elif name == "check_canvas":
                    await self._handle_check_canvas(call_id, args, is_last)
                elif name == "circle_answer":
                    await self._handle_circle_answer(call_id, args, is_last)
                else:
                    print(f"[Grok] Unknown function call: {name}")
            except Exception as e:
                print(f"[Queue] Error processing {name}: {e}")

    async def _handle_draw_on_canvas(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the draw_on_canvas function call with animated handwriting."""
        from .types import AddAnimatedTextCommand

        items = args.get("items", [])
        print(f"[Canvas] Drawing {len(items)} items with animation")

        # Track the maximum Y position used in this draw call
        max_y_used = self._next_y_position

        for item in items:
            text = item.get("text", "")
            if not text:
                continue

            x = item.get("x", self._last_x_position)
            y = item.get("y", self._next_y_position)
            color = item.get("color", "white")
            size = item.get("size", "m")

            # Estimate line height based on size
            line_height = {"s": 30, "m": 50, "l": 70}.get(size, 50)

            # Track positions
            if float(y) >= max_y_used:
                max_y_used = float(y) + line_height
            self._last_x_position = float(x)

            # Use AddAnimatedTextCommand for handwriting animation
            # Frontend will convert text to strokes and animate progressively
            command = AddAnimatedTextCommand(
                text=text,
                x=float(x),
                y=float(y),
                color=color,
                size=size,
            )
            await self.send_canvas_command(command)

        # Update next Y position for future draws
        self._next_y_position = max_y_used
        print(f"[Canvas] Next Y position updated to: {self._next_y_position}")

        # Update tutor status
        await self.send_tutor_status("drawing")

        # Send function result back to Grok with position info
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(
                call_id,
                f"Drew {len(items)} item(s) on canvas. Next available y position: {int(self._next_y_position)}.",
                request_response=is_last
            )

    async def _handle_draw_shape(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the draw_shape function call."""
        from .canvas_command_parser import generate_shape_id
        from .types import AddShapeCommand, TldrawShapeData

        shape_type = args.get("shape_type", "rectangle")
        x = float(args.get("x", self._last_x_position + 150))
        y = float(args.get("y", self._next_y_position))
        width = float(args.get("width", 100))
        height = float(args.get("height", 100))
        color = args.get("color", "white")

        # Map shape types to tldraw geo types
        geo_map = {
            "circle": "ellipse",
            "rectangle": "rectangle",
            "ellipse": "ellipse",
            "triangle": "triangle",
            "line": "line",
        }
        geo_type = geo_map.get(shape_type, "rectangle")

        print(f"[Canvas] Drawing shape: {shape_type} at ({x}, {y})")

        # Update position tracking
        self._last_x_position = x
        if y + height > self._next_y_position:
            self._next_y_position = y + height + 20  # Add padding

        if shape_type == "line":
            # Lines are handled differently in tldraw
            shape = TldrawShapeData(
                id=generate_shape_id(),
                type="line",
                x=x,
                y=y,
                props={
                    "color": color,
                    "points": {
                        "a1": {"id": "a1", "index": "a1", "x": 0, "y": 0},
                        "a2": {"id": "a2", "index": "a2", "x": width, "y": 0},
                    },
                }
            )
        else:
            # For circles, make width = height
            if shape_type == "circle":
                height = width

            shape = TldrawShapeData(
                id=generate_shape_id(),
                type="geo",
                x=x,
                y=y,
                props={
                    "geo": geo_type,
                    "color": color,
                    "fill": "none",
                    "w": width,
                    "h": height,
                }
            )

        command = AddShapeCommand(shape=shape)
        await self.send_canvas_command(command)
        await self.send_tutor_status("drawing")

        # Send function result back to Grok with position info
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(
                call_id,
                f"Drew {shape_type} at ({x:.0f}, {y:.0f}). Next available y position: {int(self._next_y_position)}.",
                request_response=is_last
            )

    async def _handle_point_to(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the point_to function call - shows attention cursor."""
        from .types import AttentionToCommand

        x = float(args.get("x", 400))
        y = float(args.get("y", 300))
        label = args.get("label")

        print(f"[Canvas] Pointing to ({x}, {y})" + (f" with label: {label}" if label else ""))

        command = AttentionToCommand(x=x, y=y, label=label)
        await self.send_canvas_command(command)

        # Auto-clear attention after 3 seconds
        async def clear_after_delay():
            await asyncio.sleep(3)
            from .types import ClearAttentionCommand
            await self.send_canvas_command(ClearAttentionCommand())

        asyncio.create_task(clear_after_delay())

        # Send function result back to Grok
        if self.grok_client and self.grok_client.is_connected:
            label_text = f" with label '{label}'" if label else ""
            await self.grok_client.send_function_result(
                call_id,
                f"Pointing to ({x:.0f}, {y:.0f}){label_text}. Attention will clear in 3 seconds.",
                request_response=is_last
            )

    async def _handle_clear_canvas(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the clear_canvas function call."""
        from .types import ClearCanvasCommand

        print("[Canvas] Clearing canvas")

        # Send clear canvas command to frontend
        command = ClearCanvasCommand()
        await self.send_canvas_command(command)

        # Reset position tracking for fresh canvas
        self._next_y_position = 100.0
        self._last_x_position = 100.0

        # Also clear the session's canvas state
        self.session.update_canvas([], "Canvas cleared", None)
        await self.send_tutor_status("drawing")

        # Send function result back to Grok so it knows the action completed
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(
                call_id,
                "Canvas cleared successfully. Ready for new content.",
                request_response=is_last
            )

    async def _handle_celebrate(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the celebrate function call."""
        intensity = args.get("intensity", "big")
        print(f"[Celebration] Triggering {intensity} celebration!")
        await self.send_celebrate(intensity)

        # Send function result back to Grok
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(
                call_id,
                f"Celebration ({intensity}) triggered!",
                request_response=is_last
            )

    async def _handle_circle_answer(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the circle_answer function call - draws an ellipse around the student's answer.

        Uses bounding box coordinates from check_canvas to properly encircle the answer.
        Adds padding to make the circle visually appealing and not too tight.

        COORDINATE TRANSFORMATION:
        Vision API returns coordinates relative to the exported screenshot image.
        The screenshot is cropped to content bounds with padding, so we need to transform:
        - vision_x -> canvas_x = vision_x + bounds.x - padding
        - vision_y -> canvas_y = vision_y + bounds.y - padding
        """
        from .canvas_command_parser import generate_shape_id
        from .types import AddShapeCommand, TldrawShapeData

        vision_x = float(args.get("x", 100))
        vision_y = float(args.get("y", 100))
        width = float(args.get("width", 100))
        height = float(args.get("height", 50))
        color = args.get("color", "light-green")

        # Transform vision coordinates to canvas coordinates
        if self._screenshot_bounds:
            # Vision coords are relative to screenshot image
            # Screenshot image = content bounds + padding on each side
            # So: canvas_coord = vision_coord + bounds_origin - padding
            bounds = self._screenshot_bounds
            canvas_x = vision_x + bounds.x - bounds.padding
            canvas_y = vision_y + bounds.y - bounds.padding
            print(f"[Canvas] Transforming vision coords ({vision_x}, {vision_y}) -> canvas ({canvas_x}, {canvas_y}) using bounds (origin: {bounds.x}, {bounds.y}, padding: {bounds.padding})")

            # Additional correction: vision API tends to report x too far right
            # Shift left to better center on the answer
            canvas_x = canvas_x - (width * 0.5)
        else:
            # Fallback: apply static correction if no bounds available
            canvas_x = vision_x - 50
            canvas_y = vision_y - 30
            print(f"[Canvas] No bounds available, using static correction: ({vision_x}, {vision_y}) -> ({canvas_x}, {canvas_y})")

        # Add generous padding around the bounding box for a nicer circle
        padding_x = 30
        padding_y = 20

        # Calculate ellipse dimensions with padding
        # Also expand width to ensure we capture the full answer
        ellipse_x = canvas_x - padding_x
        ellipse_y = canvas_y - padding_y
        ellipse_width = width * 1.2 + (padding_x * 2)  # 20% wider to capture full answer
        ellipse_height = height + (padding_y * 2)

        print(f"[Canvas] Drawing circle around answer at ({ellipse_x}, {ellipse_y}) size ({ellipse_width}x{ellipse_height})")

        shape = TldrawShapeData(
            id=generate_shape_id(),
            type="geo",
            x=ellipse_x,
            y=ellipse_y,
            props={
                "geo": "ellipse",
                "color": color,
                "fill": "none",
                "w": ellipse_width,
                "h": ellipse_height,
            }
        )

        command = AddShapeCommand(shape=shape)
        await self.send_canvas_command(command)
        await self.send_tutor_status("drawing")

        # Send function result back to Grok
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(
                call_id,
                f"Circle drawn around the answer at ({ellipse_x:.0f}, {ellipse_y:.0f}).",
                request_response=is_last
            )

    async def _handle_check_canvas(self, call_id: str, args: dict, is_last: bool = True) -> None:
        """Handle the check_canvas function call - uses vision to read student's work.

        This is the ON-DEMAND vision analysis that gets called when Grok needs to
        see what the student has written/drawn. This approach avoids race conditions
        because the vision result goes directly back to Grok before it responds.

        Returns both the vision analysis AND the next_y position for drawing.

        Implements a lock to prevent concurrent vision calls and cooldown to prevent retries.
        """
        current_time = time.time()
        time_since_last = current_time - self._last_check_canvas_time

        # Check if vision is already in progress (prevent concurrent calls)
        if self._vision_in_progress:
            print(f"[Vision] check_canvas called but vision already in progress - returning wait message")
            next_y = int(self._next_y_position)
            result = f"""Vision analysis is already in progress. Please wait for the result.

DO NOT call check_canvas again - just wait a moment and I'll have the answer.

POSITIONING (use for any drawings):
- next_y = {next_y}"""

            if self.grok_client and self.grok_client.is_connected:
                await self.grok_client.send_function_result(call_id, result, request_response=is_last)
            return

        # Check if we're within the cooldown period and have a cached result
        if time_since_last < self._check_canvas_cooldown and self._last_check_canvas_result:
            print(f"[Vision] check_canvas called again within {time_since_last:.1f}s - returning cached result")
            next_y = int(self._next_y_position)
            result = f"""I already checked the canvas {time_since_last:.0f} seconds ago. Here's what I found:

{self._last_check_canvas_result}

DO NOT call check_canvas again. Use the result above to respond to the student.

POSITIONING (use for any drawings):
- next_y = {next_y}"""

            if self.grok_client and self.grok_client.is_connected:
                await self.grok_client.send_function_result(call_id, result, request_response=is_last)
            return

        print("[Vision] check_canvas tool called - analyzing student's work...")
        self._last_check_canvas_time = current_time
        self._vision_in_progress = True  # Set lock

        # Clear previous check context from the transcript so the UI doesn't show stale feedback
        await self.send_clear_check_context()

        vision_result = None

        try:
            # Try vision analysis if we have a screenshot
            if self._latest_screenshot and XAI_API_KEY:
                screenshot_age = current_time - self._screenshot_timestamp
                print(f"[Vision] Analyzing screenshot from {self._screenshot_source} ({screenshot_age:.1f}s ago)")
                await self.send_tutor_status("thinking")

                vision_result = await analyze_canvas_screenshot(XAI_API_KEY, self._latest_screenshot)
                if vision_result:
                    print(f"[Vision] Analysis complete: {vision_result[:100]}...")

            # For demo: NO FALLBACK - we wait for vision to succeed
            # If vision failed, provide minimal info but don't suggest asking user
            if not vision_result:
                if self._latest_shapes:
                    freehand_count = sum(1 for s in self._latest_shapes if s.type == "draw")
                    if freehand_count > 0:
                        vision_result = f"I can see the student has written something ({freehand_count} handwritten element(s)), but I'm still processing the image. Give me just a moment to read it clearly."
                    else:
                        vision_result = "The canvas only has typed text from the tutor - no student work visible yet."
                else:
                    vision_result = "The canvas appears to be empty. The student hasn't written anything yet."
                print(f"[Vision] Vision unavailable, minimal response: {vision_result[:80]}...")
        finally:
            self._vision_in_progress = False  # Release lock

        # Cache the vision result for retry prevention
        self._last_check_canvas_result = vision_result

        # Build result with position info and verification reminder
        next_y = int(self._next_y_position)
        result = f"""{vision_result}

ACTION REQUIRED - VERIFY THE MATH:
1. Look at the "Problem shown" above
2. Look at the "Student's answer" above
3. Plug the student's answer into the problem equation
4. Does it work? If 3x + 5 = 20 and student wrote x = 4, then 3(4) + 5 = 17, NOT 20. That's WRONG!
5. Only celebrate if the math actually checks out!

POSITIONING (use for any drawings):
- next_y = {next_y}"""

        print(f"[Vision] Returning result with next_y={next_y}")

        # Send the result back to Grok so it can continue responding
        if self.grok_client and self.grok_client.is_connected:
            await self.grok_client.send_function_result(call_id, result, request_response=is_last)

    def _on_grok_audio(self, audio_bytes: bytes) -> None:
        """Callback when Grok sends audio."""
        self._audio_queue.put_nowait(audio_bytes)

    def _on_grok_transcript(self, role: str, text: str) -> None:
        """Callback when Grok sends transcript."""
        # With tool calling, we don't need to parse text commands anymore
        # Just send the transcript directly
        asyncio.create_task(self.send_transcript(role, text))

    def _on_speech_started(self) -> None:
        """Callback when user starts speaking (VAD detected)."""
        asyncio.create_task(self.send_voice_state("listening"))

    def _on_speech_stopped(self) -> None:
        """Callback when user stops speaking (VAD detected).

        Note: Canvas context is now injected ON-DEMAND when Grok calls the
        check_canvas tool. This avoids race conditions with async vision analysis.
        """
        asyncio.create_task(self._notify_processing())

    async def _notify_processing(self) -> None:
        """Update UI state when transitioning to processing."""
        await self.send_voice_state("processing")
        await self.send_tutor_status("thinking")

    def _on_response_started(self) -> None:
        """Callback when Grok starts responding."""
        asyncio.create_task(self.send_voice_state("speaking"))

    def _on_response_done(self) -> None:
        """Callback when Grok finishes responding."""
        # Send idle state so frontend resumes sending audio
        # VAD will trigger 'listening' when user actually speaks
        print("[Grok] Response done, ready for next input")
        asyncio.create_task(self.send_voice_state("idle"))

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
        print(f"[Grok] Configuring with sample rate: {self.sample_rate}Hz")
        config = GrokConfig(
            voice=VOICE,
            instructions=self.session.build_system_prompt()
            if not MATH_TUTOR_INSTRUCTIONS
            else MATH_TUTOR_INSTRUCTIONS,
            input_sample_rate=self.sample_rate,
            output_sample_rate=self.sample_rate,
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
        print("[Grok] Waiting for session to be ready...")
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
        """Handle voice end signal from frontend.

        Note: Screenshot is now processed at VOICE_START to ensure Grok has
        canvas context before server-side VAD commits the audio.
        """
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
        screenshot_bounds: ScreenshotBounds | None = None,
    ) -> None:
        """Handle canvas update from frontend.

        Stores the latest screenshot and shapes for on-demand vision analysis
        when the check_canvas tool is called.
        """
        self.session.update_canvas(shapes, summary, screenshot)

        # Store for on-demand vision analysis (when check_canvas tool is called)
        if screenshot:
            self._latest_screenshot = screenshot
            self._screenshot_timestamp = time.time()
            self._screenshot_source = "canvas_update"
            if screenshot_bounds:
                self._screenshot_bounds = screenshot_bounds
            # IMPORTANT: Invalidate cached vision result when canvas changes
            # This ensures the next check_canvas does a fresh analysis
            if self._last_check_canvas_result:
                print("[Canvas] New screenshot received, invalidating vision cache")
                self._last_check_canvas_result = None
        self._latest_shapes = shapes

        screenshot_size = len(screenshot) if screenshot else 0
        print(f"[Canvas] Update received: {len(shapes)} shapes, screenshot: {bool(screenshot)} ({screenshot_size / 1024:.1f} KB)")

        # Update position tracking based on ALL shapes (user + AI) to avoid overlap
        if shapes:
            max_y = 100.0
            for shape in shapes:
                # Estimate shape height based on type
                shape_height = 50.0  # Default height estimate
                if shape.type == "text":
                    # Estimate based on text size
                    size = shape.props.get("size", "m")
                    shape_height = {"s": 30, "m": 50, "l": 70}.get(size, 50)
                elif shape.type == "geo":
                    shape_height = float(shape.props.get("h", 100))
                elif shape.type == "draw":
                    # Freehand drawings - estimate from segments if available
                    shape_height = 80  # Conservative estimate for handwriting

                shape_bottom = shape.y + shape_height
                if shape_bottom > max_y:
                    max_y = shape_bottom

            # Update next Y position to be below all existing content
            self._next_y_position = max(self._next_y_position, max_y + 30)
            print(f"[Canvas] Position tracking updated: next_y={self._next_y_position}")

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

    # Get sample rate from query parameter (default to 48000 which is common on most systems)
    sample_rate_str = websocket.query_params.get("sampleRate", "48000")
    try:
        sample_rate = int(sample_rate_str)
        # Validate sample rate is reasonable
        if sample_rate not in [8000, 16000, 22050, 24000, 44100, 48000, 96000]:
            print(f"[WebSocket] Unusual sample rate {sample_rate}, using anyway")
    except ValueError:
        sample_rate = 48000

    print(f"[WebSocket] Client connected with sample rate: {sample_rate}Hz")

    # Create session
    session = session_manager.create_session()
    connection = TutorConnection(websocket, session, sample_rate)

    print(f"[Session {session.id[:8]}] Client connected")

    try:
        # Connect to Grok
        await connection.connect_to_grok()
        print(f"[Session {session.id[:8]}] Connected to Grok, sending SESSION_READY")

        # Notify frontend that session is ready for audio streaming
        from .types import SessionReadyMessage
        await connection.send_json(SessionReadyMessage().model_dump())

        # Handle messages from frontend
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type", "")

                if msg_type == "VOICE_START":
                    screenshot = data.get("screenshot")
                    screenshot_bounds_data = data.get("screenshotBounds")
                    screenshot_size = len(screenshot) if screenshot else 0
                    print(f"[Session {session.id[:8]}] Voice start, screenshot: {bool(screenshot)} ({screenshot_size / 1024:.1f} KB), bounds: {bool(screenshot_bounds_data)}")

                    # Store screenshot for on-demand analysis when check_canvas tool is called
                    # This approach avoids blocking and race conditions
                    if screenshot:
                        connection._latest_screenshot = screenshot
                        connection._screenshot_timestamp = time.time()
                        connection._screenshot_source = "voice_start"
                        if screenshot_bounds_data:
                            connection._screenshot_bounds = ScreenshotBounds(**screenshot_bounds_data)
                            print(f"[Session {session.id[:8]}] Screenshot bounds: origin=({connection._screenshot_bounds.x:.0f}, {connection._screenshot_bounds.y:.0f}), size=({connection._screenshot_bounds.width:.0f}x{connection._screenshot_bounds.height:.0f}), padding={connection._screenshot_bounds.padding}")

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
                    screenshot_bounds_data = data.get("screenshotBounds")
                    screenshot_bounds = ScreenshotBounds(**screenshot_bounds_data) if screenshot_bounds_data else None
                    await connection.handle_canvas_update(shapes, summary, screenshot, screenshot_bounds)

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
