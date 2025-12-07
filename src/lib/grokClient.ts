// Grok API Client for frontend
// Uses OpenAI-compatible API with vision support
// Uses Vite proxy to avoid CORS issues

const GROK_BASE_URL = '/api/grok/v1';

// Text-only message content
type TextContent = string;

// Vision message content (array of text and image parts)
type VisionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' } };

type MessageContent = TextContent | VisionContentPart[];

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

interface GrokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call Grok API (text-only)
 */
export async function callGrok(
  messages: GrokMessage[],
  apiKey: string,
  model: string = 'grok-3'
): Promise<string> {
  if (!apiKey) {
    throw new Error('GROK_API_KEY is required');
  }

  const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data: GrokResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from Grok API');
  }

  const content = data.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from Grok API');
  }

  return content;
}

/**
 * Call Grok Vision API with image input
 * @param systemPrompt - System message (text only)
 * @param userText - User's text message
 * @param imageBase64 - Base64 encoded image (without data URI prefix)
 * @param apiKey - xAI API key
 * @param model - Vision model to use (default: grok-2-vision)
 */
export async function callGrokVision(
  systemPrompt: string,
  userText: string,
  imageBase64: string,
  apiKey: string,
  model: string = 'grok-2-vision'
): Promise<string> {
  if (!apiKey) {
    throw new Error('GROK_API_KEY is required');
  }

  const messages: GrokMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${imageBase64}`,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: userText,
        },
      ],
    },
  ];

  const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok Vision API error: ${response.status} - ${error}`);
  }

  const data: GrokResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from Grok Vision API');
  }

  const content = data.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from Grok Vision API');
  }

  return content;
}
