"""Session management for tracking conversation context per client."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from .types import TldrawShapeData


@dataclass
class Message:
    role: str  # "student" or "tutor"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Session:
    """Tracks conversation and canvas state for a single client connection."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    messages: list[Message] = field(default_factory=list)
    canvas_shapes: list[TldrawShapeData] = field(default_factory=list)
    canvas_summary: str = ""
    canvas_screenshot: str | None = None
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str) -> Message:
        """Add a message to the conversation history."""
        msg = Message(role=role, content=content)
        self.messages.append(msg)
        self.last_activity = datetime.now()
        return msg

    def update_canvas(
        self,
        shapes: list[TldrawShapeData],
        summary: str,
        screenshot: str | None = None,
    ) -> None:
        """Update the current canvas state."""
        self.canvas_shapes = shapes
        self.canvas_summary = summary
        self.canvas_screenshot = screenshot
        self.last_activity = datetime.now()

    def get_conversation_context(self, max_messages: int = 20) -> list[dict]:
        """Get recent conversation history for context."""
        recent = self.messages[-max_messages:]
        return [{"role": m.role, "content": m.content} for m in recent]

    def build_system_prompt(self) -> str:
        """Build the system prompt with canvas context."""
        base_prompt = """You are a friendly, encouraging math tutor helping a student work through problems on a shared canvas. You can see what they draw and write.

Your teaching style:
- Be warm and supportive, never condescending
- Ask guiding questions rather than giving answers directly
- Celebrate effort and progress
- Use visual explanations when helpful
- Keep responses concise and conversational

When you want to draw on the canvas, describe what you'd like to add and it will appear.
"""

        if self.canvas_summary:
            base_prompt += f"\n\nCurrent canvas state:\n{self.canvas_summary}"

        return base_prompt


class SessionManager:
    """Manages multiple client sessions."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create_session(self) -> Session:
        """Create a new session."""
        session = Session()
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        """Get an existing session by ID."""
        return self._sessions.get(session_id)

    def remove_session(self, session_id: str) -> None:
        """Remove a session."""
        self._sessions.pop(session_id, None)

    def cleanup_stale_sessions(self, max_age_hours: int = 24) -> int:
        """Remove sessions older than max_age_hours. Returns count removed."""
        now = datetime.now()
        stale_ids = [
            sid
            for sid, session in self._sessions.items()
            if (now - session.last_activity).total_seconds() > max_age_hours * 3600
        ]
        for sid in stale_ids:
            del self._sessions[sid]
        return len(stale_ids)
