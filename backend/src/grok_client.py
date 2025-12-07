"""Grok Voice API client for realtime voice conversations."""

import asyncio
import base64
import json
from dataclasses import dataclass
from enum import Enum
from typing import Callable

import websockets
from websockets.asyncio.client import ClientConnection

XAI_REALTIME_URL = "wss://api.x.ai/v1/realtime"


class GrokMessageType(str, Enum):
    # Client -> Grok
    SESSION_UPDATE = "session.update"
    INPUT_AUDIO_APPEND = "input_audio_buffer.append"
    INPUT_AUDIO_COMMIT = "input_audio_buffer.commit"
    INPUT_AUDIO_CLEAR = "input_audio_buffer.clear"
    CONVERSATION_ITEM_CREATE = "conversation.item.create"
    RESPONSE_CREATE = "response.create"
    RESPONSE_CANCEL = "response.cancel"

    # Grok -> Client
    SESSION_CREATED = "session.created"
    SESSION_UPDATED = "session.updated"
    CONVERSATION_CREATED = "conversation.created"
    CONVERSATION_ITEM_CREATED = "conversation.item.created"
    INPUT_AUDIO_SPEECH_STARTED = "input_audio_buffer.speech_started"
    INPUT_AUDIO_SPEECH_STOPPED = "input_audio_buffer.speech_stopped"
    INPUT_AUDIO_COMMITTED = "input_audio_buffer.committed"
    RESPONSE_CREATED = "response.created"
    RESPONSE_OUTPUT_ITEM_ADDED = "response.output_item.added"
    RESPONSE_OUTPUT_AUDIO_DELTA = "response.output_audio.delta"
    RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DELTA = "response.output_audio_transcript.delta"
    RESPONSE_OUTPUT_AUDIO_DONE = "response.output_audio.done"
    RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DONE = "response.output_audio_transcript.done"
    RESPONSE_OUTPUT_ITEM_DONE = "response.output_item.done"
    RESPONSE_DONE = "response.done"
    RESPONSE_FUNCTION_CALL_ARGS_DELTA = "response.function_call_arguments.delta"
    RESPONSE_FUNCTION_CALL_ARGS_DONE = "response.function_call_arguments.done"
    INPUT_AUDIO_TRANSCRIPTION_COMPLETED = "conversation.item.input_audio_transcription.completed"
    ERROR = "error"


@dataclass
class GrokConfig:
    """Configuration for Grok voice session."""

    voice: str = "tara"
    instructions: str = ""
    input_sample_rate: int = 24000
    output_sample_rate: int = 24000
    turn_detection: str = "server_vad"
    tools: list | None = None  # List of tool definitions for function calling


class GrokVoiceClient:
    """Client for Grok's realtime voice API."""

    def __init__(
        self,
        api_key: str,
        config: GrokConfig,
        on_audio: Callable[[bytes], None] | None = None,
        on_transcript: Callable[[str, str], None] | None = None,
        on_speech_started: Callable[[], None] | None = None,
        on_speech_stopped: Callable[[], None] | None = None,
        on_response_started: Callable[[], None] | None = None,
        on_response_done: Callable[[], None] | None = None,
        on_error: Callable[[str, str], None] | None = None,
        on_ready: Callable[[], None] | None = None,
        on_function_call: Callable[[str, str, dict], None] | None = None,
    ):
        self.api_key = api_key
        self.config = config
        self.on_audio = on_audio
        self.on_transcript = on_transcript
        self.on_speech_started = on_speech_started
        self.on_speech_stopped = on_speech_stopped
        self.on_response_started = on_response_started
        self.on_response_done = on_response_done
        self.on_error = on_error
        self.on_ready = on_ready
        self.on_function_call = on_function_call

        self._ws: ClientConnection | None = None
        self._connected = False
        self._session_configured = False
        self._receive_task: asyncio.Task | None = None
        self._current_transcript = ""
        self._current_function_call: dict | None = None  # Track current function call
        self._function_call_args = ""  # Accumulate function call arguments

    @property
    def is_connected(self) -> bool:
        return self._connected and self._ws is not None

    @property
    def is_ready(self) -> bool:
        return self._connected and self._session_configured

    async def connect(self) -> None:
        """Connect to Grok's realtime API."""
        if self._connected:
            return

        # Use Authorization header (server-side approach)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        print(f"[Grok] Connecting to {XAI_REALTIME_URL}...")

        self._ws = await websockets.connect(
            XAI_REALTIME_URL,
            additional_headers=headers,
            max_size=None,
        )
        self._connected = True
        self._session_configured = False

        print("[Grok] Connected, waiting for conversation.created...")

        # Start receiving messages
        self._receive_task = asyncio.create_task(self._receive_loop())

    async def disconnect(self) -> None:
        """Disconnect from Grok's API."""
        self._connected = False
        self._session_configured = False

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._ws:
            await self._ws.close()
            self._ws = None

    async def _configure_session(self) -> None:
        """Configure the Grok session with voice settings and instructions."""
        if not self._ws:
            raise RuntimeError("Not connected to Grok API")

        print(f"[Grok] Configuring session with {self.config.input_sample_rate}Hz audio...")

        session = {
            "instructions": self.config.instructions,
            "voice": self.config.voice,
            "audio": {
                "input": {
                    "format": {
                        "type": "audio/pcm",
                        "rate": self.config.input_sample_rate,
                    },
                },
                "output": {
                    "format": {
                        "type": "audio/pcm",
                        "rate": self.config.output_sample_rate,
                    },
                },
            },
            "turn_detection": {
                "type": self.config.turn_detection,
            },
            "input_audio_transcription": {
                "model": "grok-2-public",
            },
        }

        # Add tools if provided
        if self.config.tools:
            session["tools"] = self.config.tools
            print(f"[Grok] Registering {len(self.config.tools)} tools")

        session_config = {
            "type": GrokMessageType.SESSION_UPDATE.value,
            "session": session,
        }

        await self._ws.send(json.dumps(session_config))
        print("[Grok] Waiting for session.updated confirmation...")

    async def _send_initial_greeting(self) -> None:
        """Send initial greeting after session is configured."""
        if not self._ws:
            return

        print("[Grok] Session configured, sending initial greeting...")

        # Commit any pending audio buffer first
        await self._ws.send(json.dumps({"type": GrokMessageType.INPUT_AUDIO_COMMIT.value}))

        # Create greeting message
        greeting = {
            "type": GrokMessageType.CONVERSATION_ITEM_CREATE.value,
            "item": {
                "type": "message",
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Greet me briefly.",
                    },
                ],
            },
        }
        await self._ws.send(json.dumps(greeting))

        # Request response
        await self._ws.send(json.dumps({"type": GrokMessageType.RESPONSE_CREATE.value}))

        print("[Grok] Ready for voice interaction")

    async def send_audio(self, audio_b64: str) -> None:
        """Send audio data to Grok (base64 PCM16)."""
        if not self._ws:
            return
        if not self._session_configured:
            return

        msg = {
            "type": GrokMessageType.INPUT_AUDIO_APPEND.value,
            "audio": audio_b64,
        }
        await self._ws.send(json.dumps(msg))

    async def commit_audio(self) -> None:
        """Commit the audio buffer to signal end of user speech."""
        if not self._ws:
            return

        print("[Grok] Committing audio buffer")
        msg = {"type": GrokMessageType.INPUT_AUDIO_COMMIT.value}
        await self._ws.send(json.dumps(msg))

    async def clear_audio_buffer(self) -> None:
        """Clear the input audio buffer."""
        if not self._ws:
            return

        msg = {"type": GrokMessageType.INPUT_AUDIO_CLEAR.value}
        await self._ws.send(json.dumps(msg))

    async def send_text_message(self, text: str, role: str = "user") -> None:
        """Send a text message to Grok."""
        if not self._ws:
            return

        msg = {
            "type": GrokMessageType.CONVERSATION_ITEM_CREATE.value,
            "item": {
                "type": "message",
                "role": role,
                "content": [
                    {
                        "type": "input_text",
                        "text": text,
                    },
                ],
            },
        }
        await self._ws.send(json.dumps(msg))

    async def request_response(self) -> None:
        """Request Grok to generate a response."""
        if not self._ws:
            return

        msg = {"type": GrokMessageType.RESPONSE_CREATE.value}
        await self._ws.send(json.dumps(msg))

    async def cancel_response(self) -> None:
        """Cancel the current response (for interruptions)."""
        if not self._ws:
            return

        msg = {"type": GrokMessageType.RESPONSE_CANCEL.value}
        await self._ws.send(json.dumps(msg))

    async def inject_context(self, context: str) -> None:
        """Inject context (like canvas state) as a system message."""
        if not self._ws:
            return

        msg = {
            "type": GrokMessageType.CONVERSATION_ITEM_CREATE.value,
            "item": {
                "type": "message",
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"[Canvas Update] {context}",
                    },
                ],
            },
        }
        await self._ws.send(json.dumps(msg))

    async def send_function_result(self, call_id: str, result: str, request_response: bool = True) -> None:
        """Send the result of a function call back to Grok.

        After Grok calls a function (tool), we need to send the result back
        so it can continue generating its response with that information.

        Args:
            call_id: The function call ID from Grok
            result: The result string to send back
            request_response: If True, also sends response.create to trigger Grok's response.
                             Set to False when batching multiple function results - only the
                             last one should trigger the response.
        """
        if not self._ws:
            return

        print(f"[Grok] Sending function result for call_id {call_id}: {result[:100]}...")

        # Create the function call output item
        msg = {
            "type": GrokMessageType.CONVERSATION_ITEM_CREATE.value,
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": result,
            },
        }
        await self._ws.send(json.dumps(msg))

        # Only request response if this is the last function result in a batch
        if request_response:
            await self._ws.send(json.dumps({"type": GrokMessageType.RESPONSE_CREATE.value}))

    async def _receive_loop(self) -> None:
        """Receive and process messages from Grok."""
        if not self._ws:
            return

        try:
            async for raw_message in self._ws:
                if not self._connected:
                    break

                try:
                    message = json.loads(raw_message)
                    await self._handle_message(message)
                except json.JSONDecodeError:
                    print(f"[Grok] Failed to parse message: {raw_message}")

        except websockets.exceptions.ConnectionClosed as e:
            print(f"[Grok] Connection closed: {e}")
            self._connected = False
        except asyncio.CancelledError:
            pass

    async def _handle_message(self, message: dict) -> None:
        """Handle a message from Grok."""
        msg_type = message.get("type", "")

        # Log non-audio events
        if msg_type not in [
            GrokMessageType.RESPONSE_OUTPUT_AUDIO_DELTA.value,
            GrokMessageType.INPUT_AUDIO_APPEND.value,
        ]:
            print(f"[Grok] Received: {msg_type}")

        if msg_type == GrokMessageType.CONVERSATION_CREATED.value:
            # Conversation created, configure the session
            await self._configure_session()

        elif msg_type == GrokMessageType.SESSION_UPDATED.value:
            # Session configured, now ready for interaction
            self._session_configured = True
            await self._send_initial_greeting()
            if self.on_ready:
                self.on_ready()

        elif msg_type == GrokMessageType.INPUT_AUDIO_SPEECH_STARTED.value:
            print("[Grok] Speech started (VAD detected)")
            if self.on_speech_started:
                self.on_speech_started()

        elif msg_type == GrokMessageType.INPUT_AUDIO_SPEECH_STOPPED.value:
            print("[Grok] Speech stopped (VAD detected)")
            if self.on_speech_stopped:
                self.on_speech_stopped()

        elif msg_type == GrokMessageType.INPUT_AUDIO_TRANSCRIPTION_COMPLETED.value:
            # User's speech transcript
            transcript = message.get("transcript", "")
            if transcript and self.on_transcript:
                print(f"[Grok] User transcript: {transcript}")
                self.on_transcript("student", transcript)

        elif msg_type == GrokMessageType.RESPONSE_CREATED.value:
            self._current_transcript = ""
            self._current_function_call = None
            self._function_call_args = ""
            if self.on_response_started:
                self.on_response_started()

        elif msg_type == GrokMessageType.RESPONSE_OUTPUT_AUDIO_DELTA.value:
            # Audio chunk from Grok
            audio_b64 = message.get("delta", "")
            if audio_b64 and self.on_audio:
                audio_bytes = base64.b64decode(audio_b64)
                self.on_audio(audio_bytes)

        elif msg_type == GrokMessageType.RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DELTA.value:
            # Transcript chunk from Grok
            delta = message.get("delta", "")
            self._current_transcript += delta

        elif msg_type == GrokMessageType.RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DONE.value:
            # Full transcript available
            if self._current_transcript and self.on_transcript:
                self.on_transcript("tutor", self._current_transcript)
            self._current_transcript = ""

        elif msg_type == GrokMessageType.RESPONSE_OUTPUT_ITEM_ADDED.value:
            # Check if this is a function call item
            item = message.get("item", {})
            if item.get("type") == "function_call":
                self._current_function_call = {
                    "call_id": item.get("call_id"),
                    "name": item.get("name"),
                }
                self._function_call_args = ""
                print(f"[Grok] Function call started: {item.get('name')}")

        elif msg_type == GrokMessageType.RESPONSE_FUNCTION_CALL_ARGS_DELTA.value:
            # Accumulate function call arguments
            delta = message.get("delta", "")
            self._function_call_args += delta

        elif msg_type == GrokMessageType.RESPONSE_FUNCTION_CALL_ARGS_DONE.value:
            # Function call arguments complete
            if self._current_function_call and self.on_function_call:
                try:
                    args = json.loads(self._function_call_args) if self._function_call_args else {}
                    func_name = self._current_function_call["name"]
                    call_id = self._current_function_call["call_id"]
                    print(f"[Grok] Function call complete: {func_name} with args: {args}")

                    # For check_canvas, we need to cancel the response immediately
                    # to prevent Grok from speaking "I don't see your answer" while we analyze
                    if func_name == "check_canvas":
                        print("[Grok] Cancelling response to wait for vision analysis...")
                        await self.cancel_response()

                    self.on_function_call(call_id, func_name, args)
                except json.JSONDecodeError as e:
                    print(f"[Grok] Failed to parse function args: {e}")
            self._current_function_call = None
            self._function_call_args = ""

        elif msg_type == GrokMessageType.RESPONSE_DONE.value:
            if self.on_response_done:
                self.on_response_done()

        elif msg_type == GrokMessageType.ERROR.value:
            error = message.get("error", {})
            error_code = error.get("code", "unknown")
            error_message = error.get("message", "Unknown error")
            print(f"[Grok Error] {error_code}: {error_message}")
            if self.on_error:
                self.on_error(error_code, error_message)
