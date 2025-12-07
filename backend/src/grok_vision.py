"""Grok Vision API client for analyzing canvas screenshots."""

import time

import httpx

XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions"
VISION_MODEL = "grok-4"  # Latest model with vision capabilities

VISION_SYSTEM_PROMPT = """You analyze a student's math work on a digital canvas. Be concise and precise.

Tasks:
1. Read any HANDWRITTEN content (freehand strokes) - transcribe EXACTLY what's written
2. Note the typed problem text separately
3. Estimate bounding box of the handwritten answer

Response format:
- Student's answer: [exact value like "x = 5" or "15"]
- Answer bounding box: x=[left], y=[top], width=[w], height=[h]
- Problem shown: [typed problem text]

Bounding box: Use pixel coords (canvas ~800x600). x=0 left, y=0 top. Be generous with size."""


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
        print("[Vision] No screenshot provided")
        return None

    # Calculate size for diagnostics
    size_bytes = len(screenshot_b64)
    size_kb = size_bytes / 1024
    print(f"[Vision] Screenshot size: {size_kb:.1f} KB ({size_bytes} bytes)")

    # Handle both data URL format and raw base64
    if screenshot_b64.startswith("data:"):
        image_url = screenshot_b64
        # Extract mime type for logging
        mime_end = screenshot_b64.find(";base64,")
        if mime_end > 5:
            mime_type = screenshot_b64[5:mime_end]
            print(f"[Vision] Image format: {mime_type}")
    else:
        # Assume PNG if no prefix (frontend exports canvas as PNG for vision API compatibility)
        image_url = f"data:image/png;base64,{screenshot_b64}"
        print("[Vision] Image format: image/png (assumed)")

    start_time = time.time()
    try:
        # 90s timeout - vision API can be slow, we want to wait for it during demo
        async with httpx.AsyncClient(timeout=90.0) as client:
            print(f"[Vision] Sending request to {VISION_MODEL}...")
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
                                        "detail": "high",  # High detail for reading handwriting
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "Read and transcribe everything on the canvas, especially any handwritten content from the student.",
                                },
                            ],
                        },
                    ],
                    "max_tokens": 300,
                    "temperature": 0.1,
                },
            )

            elapsed = time.time() - start_time
            print(f"[Vision] Response received in {elapsed:.2f}s, status: {response.status_code}")

            if response.status_code != 200:
                print(f"[Vision] API error: {response.status_code} - {response.text[:500]}")
                return None

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            # Log usage info if available
            usage = data.get("usage", {})
            if usage:
                print(f"[Vision] Tokens used: prompt={usage.get('prompt_tokens', '?')}, completion={usage.get('completion_tokens', '?')}")

            if content:
                print(f"[Vision] Analysis complete ({elapsed:.2f}s): {content[:150]}...")
                return content

            print("[Vision] Empty response from API")
            return None

    except httpx.TimeoutException:
        elapsed = time.time() - start_time
        print(f"[Vision] Request timed out after {elapsed:.2f}s (limit: 90s)")
        return None
    except httpx.ConnectError as e:
        elapsed = time.time() - start_time
        print(f"[Vision] Connection error after {elapsed:.2f}s: {e}")
        return None
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Vision] Error after {elapsed:.2f}s: {type(e).__name__}: {e}")
        return None
