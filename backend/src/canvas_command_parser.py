"""
Canvas Command Parser

Parses canvas drawing commands from Grok's voice transcripts.
Commands are embedded in the transcript using a specific format:
  [DRAW: type=text, x=100, y=200, text="Problem: x^2 + 3x = 0", color=white, size=m]
  [HIGHLIGHT: ids="shape-1,shape-2"]
  [CLEAR_CANVAS]
"""

import re
import uuid
from typing import Union

from .types import (
    AddAnimatedTextCommand,
    AddShapeCommand,
    DeleteShapeCommand,
    HighlightCommand,
    PanToCommand,
    TldrawShapeData,
    UpdateShapeCommand,
)

CanvasCommand = Union[
    AddShapeCommand,
    AddAnimatedTextCommand,
    UpdateShapeCommand,
    DeleteShapeCommand,
    HighlightCommand,
    PanToCommand,
]

# Regex patterns for parsing commands
DRAW_PATTERN = re.compile(r'\[DRAW:\s*([^\]]+)\]', re.IGNORECASE)
WRITE_PATTERN = re.compile(r'\[WRITE:\s*([^\]]+)\]', re.IGNORECASE)
HIGHLIGHT_PATTERN = re.compile(r'\[HIGHLIGHT:\s*ids="([^"]+)"\]', re.IGNORECASE)
CLEAR_CANVAS_PATTERN = re.compile(r'\[CLEAR_CANVAS\]', re.IGNORECASE)
PAN_TO_PATTERN = re.compile(r'\[PAN_TO:\s*x=(-?\d+(?:\.\d+)?),\s*y=(-?\d+(?:\.\d+)?)\]', re.IGNORECASE)

# Size mappings for text
SIZE_MAP = {
    's': 16,
    'm': 24,
    'l': 36,
    'xl': 48,
}

# Color mappings (tldraw color names)
VALID_COLORS = {
    'black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue',
    'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'
}


def parse_draw_params(param_str: str) -> dict:
    """Parse key=value pairs from a DRAW command string."""
    params = {}

    # Handle quoted strings first (for text content)
    text_match = re.search(r'text="([^"]*)"', param_str)
    if text_match:
        params['text'] = text_match.group(1)
        # Remove the text param from the string to avoid confusion
        param_str = param_str[:text_match.start()] + param_str[text_match.end():]

    # Parse remaining key=value pairs
    for match in re.finditer(r'(\w+)=([^,\s\]]+)', param_str):
        key = match.group(1).lower()
        value = match.group(2).strip()

        if key == 'text':
            continue  # Already handled
        elif key in ('x', 'y'):
            params[key] = float(value)
        elif key == 'size':
            params['size'] = value.lower()
        elif key == 'color':
            params['color'] = value.lower()
        elif key == 'type':
            params['type'] = value.lower()

    return params


def generate_shape_id() -> str:
    """Generate a unique shape ID."""
    return f"shape:{uuid.uuid4()}"


def create_shape_from_params(params: dict) -> TldrawShapeData | None:
    """Create a TldrawShapeData from parsed parameters."""
    shape_type = params.get('type', 'text')
    x = params.get('x', 100)
    y = params.get('y', 100)
    shape_id = generate_shape_id()

    if shape_type == 'text':
        text = params.get('text', '')
        if not text:
            return None

        color = params.get('color', 'white')
        if color not in VALID_COLORS:
            color = 'white'

        size_key = params.get('size', 'm')
        font_size = SIZE_MAP.get(size_key, 24)

        # Determine tldraw size prop based on font size
        if font_size <= 16:
            size = 's'
        elif font_size <= 28:
            size = 'm'
        elif font_size <= 40:
            size = 'l'
        else:
            size = 'xl'

        return TldrawShapeData(
            id=shape_id,
            type='text',
            x=x,
            y=y,
            props={
                'text': text,
                'color': color,
                'size': size,
                'font': 'draw',  # Chalk-like font
                'textAlign': 'start',
            }
        )

    elif shape_type in ('geo', 'rectangle', 'ellipse', 'triangle'):
        geo_type = 'rectangle' if shape_type == 'geo' else shape_type
        color = params.get('color', 'white')
        if color not in VALID_COLORS:
            color = 'white'

        return TldrawShapeData(
            id=shape_id,
            type='geo',
            x=x,
            y=y,
            props={
                'geo': geo_type,
                'color': color,
                'fill': 'none',
                'w': params.get('width', 100),
                'h': params.get('height', 60),
            }
        )

    elif shape_type == 'arrow':
        color = params.get('color', 'white')
        if color not in VALID_COLORS:
            color = 'white'

        return TldrawShapeData(
            id=shape_id,
            type='arrow',
            x=x,
            y=y,
            props={
                'color': color,
                'start': {'x': 0, 'y': 0},
                'end': {'x': params.get('length', 100), 'y': 0},
            }
        )

    return None


def parse_canvas_commands(transcript: str) -> tuple[str, list[CanvasCommand]]:
    """
    Parse transcript for canvas commands.

    Returns:
        tuple: (cleaned_transcript, list_of_commands)

        The cleaned_transcript has the [DRAW:...] commands removed
        so they don't appear in the user-facing transcript.
    """
    commands: list[CanvasCommand] = []
    cleaned = transcript

    # Parse DRAW commands (instant text)
    for match in DRAW_PATTERN.finditer(transcript):
        params = parse_draw_params(match.group(1))
        shape = create_shape_from_params(params)
        if shape:
            commands.append(AddShapeCommand(shape=shape))
        # Remove from transcript
        cleaned = cleaned.replace(match.group(0), '')

    # Parse WRITE commands (animated handwriting)
    for match in WRITE_PATTERN.finditer(transcript):
        params = parse_draw_params(match.group(1))
        text = params.get('text', '')
        if text:
            color = params.get('color', 'white')
            if color not in VALID_COLORS:
                color = 'white'
            commands.append(AddAnimatedTextCommand(
                text=text,
                x=params.get('x', 100),
                y=params.get('y', 100),
                color=color,
                size=params.get('size', 'm'),
            ))
        # Remove from transcript
        cleaned = cleaned.replace(match.group(0), '')

    # Parse HIGHLIGHT commands
    for match in HIGHLIGHT_PATTERN.finditer(transcript):
        shape_ids = [id.strip() for id in match.group(1).split(',')]
        commands.append(HighlightCommand(shapeIds=shape_ids))
        cleaned = cleaned.replace(match.group(0), '')

    # Parse CLEAR_CANVAS commands (we'll implement as delete all shapes)
    for match in CLEAR_CANVAS_PATTERN.finditer(transcript):
        # For clear, we could emit a special message, but for now skip
        # The frontend already has clearCanvas functionality
        cleaned = cleaned.replace(match.group(0), '')

    # Parse PAN_TO commands
    for match in PAN_TO_PATTERN.finditer(transcript):
        x = float(match.group(1))
        y = float(match.group(2))
        commands.append(PanToCommand(x=x, y=y))
        cleaned = cleaned.replace(match.group(0), '')

    # Clean up extra whitespace from removed commands
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    return cleaned, commands
