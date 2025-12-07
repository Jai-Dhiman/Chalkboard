"""Canvas state processor for summarizing and analyzing canvas content."""

from .types import TldrawShapeData


def extract_text_from_props(props: dict) -> str:
    """Extract text from shape props, handling both plain text and richText formats."""
    # Try plain text first (legacy format)
    text = props.get("text", "")
    if text:
        return text

    # Try richText format (TipTap JSON document)
    rich_text = props.get("richText")
    if rich_text:
        return extract_text_from_rich_text(rich_text)

    return ""


def extract_text_from_rich_text(rich_text) -> str:
    """Extract plain text from TipTap richText JSON structure."""
    if isinstance(rich_text, str):
        # Sometimes richText might be a plain string
        return rich_text

    if not isinstance(rich_text, dict):
        return ""

    # TipTap format: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "..." }] }] }
    texts = []
    _extract_text_recursive(rich_text, texts)
    return " ".join(texts)


def _extract_text_recursive(node: dict, texts: list) -> None:
    """Recursively extract text from TipTap node structure."""
    if not isinstance(node, dict):
        return

    # If this node has text, add it
    if node.get("type") == "text" and "text" in node:
        texts.append(node["text"])

    # Recurse into content array
    content = node.get("content", [])
    if isinstance(content, list):
        for child in content:
            _extract_text_recursive(child, texts)


def summarize_canvas(shapes: list[TldrawShapeData]) -> str:
    """Convert canvas shapes into a text description for Grok context."""
    if not shapes:
        return "The canvas is empty."

    summaries: list[str] = []

    for shape in shapes:
        shape_type = shape.type
        props = shape.props

        if shape_type == "draw":
            # Freehand drawing
            summaries.append(f"Freehand drawing at ({shape.x:.0f}, {shape.y:.0f})")

        elif shape_type == "text":
            text = extract_text_from_props(props)
            if text:
                summaries.append(f'Text "{text}" at ({shape.x:.0f}, {shape.y:.0f})')

        elif shape_type == "geo":
            geo_type = props.get("geo", "rectangle")
            summaries.append(f"{geo_type.capitalize()} shape at ({shape.x:.0f}, {shape.y:.0f})")

        elif shape_type == "arrow":
            summaries.append(f"Arrow at ({shape.x:.0f}, {shape.y:.0f})")

        elif shape_type == "line":
            summaries.append(f"Line at ({shape.x:.0f}, {shape.y:.0f})")

        elif shape_type == "note":
            text = extract_text_from_props(props)
            if text:
                summaries.append(f'Note "{text}" at ({shape.x:.0f}, {shape.y:.0f})')
            else:
                summaries.append(f"Empty note at ({shape.x:.0f}, {shape.y:.0f})")

        elif shape_type == "frame":
            name = props.get("name", "")
            if name:
                summaries.append(f'Frame "{name}" at ({shape.x:.0f}, {shape.y:.0f})')
            else:
                summaries.append(f"Frame at ({shape.x:.0f}, {shape.y:.0f})")

        else:
            summaries.append(f"{shape_type} at ({shape.x:.0f}, {shape.y:.0f})")

    return f"Canvas contains {len(shapes)} element(s):\n- " + "\n- ".join(summaries)


def detect_math_content(shapes: list[TldrawShapeData]) -> list[str]:
    """Detect potential math expressions or equations in text shapes."""
    math_content: list[str] = []

    for shape in shapes:
        if shape.type == "text":
            text = extract_text_from_props(shape.props)
            if text and _looks_like_math(text):
                math_content.append(text)

    return math_content


def _looks_like_math(text: str) -> bool:
    """Heuristic to detect if text looks like a math expression."""
    math_indicators = [
        "+", "-", "*", "/", "=", "^",
        "x", "y", "z",  # Common variables
        "(", ")",
        "sqrt", "sin", "cos", "tan", "log",
    ]
    # Check if text contains numbers and math operators
    has_numbers = any(c.isdigit() for c in text)
    has_math_ops = any(indicator in text.lower() for indicator in math_indicators)
    return has_numbers and has_math_ops


def describe_changes(
    added: list[TldrawShapeData],
    modified: list[TldrawShapeData],
    deleted: list[str],
) -> str:
    """Describe what changed on the canvas."""
    parts: list[str] = []

    if added:
        types = [s.type for s in added]
        parts.append(f"Added: {', '.join(types)}")

    if modified:
        parts.append(f"Modified: {len(modified)} element(s)")

    if deleted:
        parts.append(f"Deleted: {len(deleted)} element(s)")

    if not parts:
        return "No changes detected."

    return "; ".join(parts)
