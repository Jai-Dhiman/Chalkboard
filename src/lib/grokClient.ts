// Grok API Client for frontend
// Uses OpenAI-compatible API

const GROK_BASE_URL = 'https://api.x.ai/v1';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

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
