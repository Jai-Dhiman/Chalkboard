"""Grok Vision API client for analyzing canvas screenshots."""

import httpx

XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions"
VISION_MODEL = "grok-4"  # Latest model with vision capabilities

VISION_SYSTEM_PROMPT = """You are analyzing a student's work on a digital chalkboard/canvas for a math tutoring session.

Describe what you see concisely and accurately:
- Identify any handwritten text, numbers, or equations
- Note any drawings, diagrams, or geometric shapes
- Describe the spatial layout if relevant
- If you see mathematical work, describe the steps shown

Be brief (2-3 sentences max). Focus on what would be useful for a tutor to know about what the student has written or drawn."""


async def analyze_canvas_screenshot(
    api_key: str,
    screenshot_b64: str,
) -> str | None:
    """
    Analyze a canvas screenshot using Grok Vision API.

    Args:
        api_key: xAI API key
        screenshot_b64: Base64-encoded image (data URL format: data:image/...;base64,...)

    Returns:
        Description of what's on the canvas, or None if analysis fails
    """
    if not screenshot_b64:
        return None

    # Handle both data URL format and raw base64
    if screenshot_b64.startswith("data:"):
        image_url = screenshot_b64
    else:
        # Assume SVG if no prefix
        image_url = f"data:image/svg+xml;base64,{screenshot_b64}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                XAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": VISION_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": VISION_SYSTEM_PROMPT,
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": image_url,
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "What does the student have on their canvas?",
                                },
                            ],
                        },
                    ],
                    "max_tokens": 200,
                    "temperature": 0.3,
                },
            )

            if response.status_code != 200:
                print(f"[Vision] API error: {response.status_code} - {response.text}")
                return None

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            if content:
                print(f"[Vision] Analysis: {content[:100]}...")
                return content

            return None

    except httpx.TimeoutException:
        print("[Vision] Request timed out")
        return None
    except Exception as e:
        print(f"[Vision] Error analyzing screenshot: {e}")
        return None
