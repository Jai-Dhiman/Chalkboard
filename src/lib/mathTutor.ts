// Math Tutor Agent - generates problems using Grok AI
import { toRichText } from 'tldraw';
import { callGrok } from './grokClient';
import type { TldrawShapeData } from '@/types';

// Color palette for problems
const COLORS = ['violet', 'blue', 'green', 'red', 'orange', 'yellow'] as const;

const MATH_TUTOR_PROMPT = `You are a friendly and patient math tutor named Grok. You help students understand mathematical concepts through clear explanations and practice problems.

When a student asks you to create problems or explain a concept, you MUST respond with valid JSON in this exact format:

{
    "explanation": "Your friendly explanation to the student about what you're providing",
    "problems": [
        {
            "label": "Problem 1",
            "content": "The math problem or equation to display",
            "hint": "Optional hint for the student"
        }
    ]
}

Guidelines:
1. Generate clear, educational math problems appropriate for the topic
2. Use text-based math notation: x^2 for exponents, sqrt(x) for square roots, * for multiplication
3. Vary difficulty levels when creating multiple problems
4. Include helpful hints when appropriate
5. Keep explanations encouraging and educational

Examples of good problem content:
- "Solve: x^2 + 5x + 6 = 0"
- "Find x: 2x^2 - 8x + 6 = 0"
- "Factor: x^2 - 9 = 0"

Always respond with valid JSON only. No markdown, no extra text outside the JSON.`;

interface Problem {
  label: string;
  content: string;
  hint?: string;
}

interface GrokMathResponse {
  explanation: string;
  problems: Problem[];
}

interface MathTutorResult {
  explanation: string;
  shapes: TldrawShapeData[];
}

function parseGrokResponse(responseText: string): GrokMathResponse {
  // Try direct JSON parse first
  try {
    return JSON.parse(responseText);
  } catch {
    // Continue to other methods
  }

  // Try to extract JSON from markdown code blocks
  if (responseText.includes('```json')) {
    try {
      const jsonStr = responseText.split('```json')[1].split('```')[0];
      return JSON.parse(jsonStr);
    } catch {
      // Continue
    }
  }

  if (responseText.includes('```')) {
    try {
      const jsonStr = responseText.split('```')[1].split('```')[0];
      return JSON.parse(jsonStr);
    } catch {
      // Continue
    }
  }

  // Try to find JSON object in response
  if (responseText.includes('{')) {
    try {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}') + 1;
      const jsonStr = responseText.slice(start, end);
      return JSON.parse(jsonStr);
    } catch {
      // Continue
    }
  }

  throw new Error(`Failed to parse Grok response as JSON: ${responseText.slice(0, 200)}`);
}

function buildProblemShapes(problems: Problem[]): TldrawShapeData[] {
  const shapes: TldrawShapeData[] = [];
  const baseX = 100;
  const baseY = 100;
  const ySpacing = 120;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const color = COLORS[i % COLORS.length];
    const currentY = baseY + i * ySpacing;

    // Problem label
    shapes.push({
      id: `shape:tutor-${Date.now()}-${i}-label`,
      type: 'text',
      x: baseX,
      y: currentY,
      props: {
        richText: toRichText(problem.label || `Problem ${i + 1}`),
        size: 's',
        color: 'grey',
        autoSize: true,
      },
    });

    // Problem content
    shapes.push({
      id: `shape:tutor-${Date.now()}-${i}-content`,
      type: 'text',
      x: baseX,
      y: currentY + 25,
      props: {
        richText: toRichText(problem.content),
        size: 'l',
        color,
        autoSize: true,
      },
    });

    // Optional hint
    if (problem.hint) {
      shapes.push({
        id: `shape:tutor-${Date.now()}-${i}-hint`,
        type: 'text',
        x: baseX,
        y: currentY + 60,
        props: {
          richText: toRichText(`Hint: ${problem.hint}`),
          size: 's',
          color: 'grey',
          autoSize: true,
        },
      });
    }
  }

  return shapes;
}

export async function generateProblems(
  userRequest: string,
  apiKey: string
): Promise<MathTutorResult> {
  const responseText = await callGrok(
    [
      { role: 'system', content: MATH_TUTOR_PROMPT },
      { role: 'user', content: userRequest },
    ],
    apiKey
  );

  const parsed = parseGrokResponse(responseText);

  if (!parsed.problems || parsed.problems.length === 0) {
    throw new Error('Grok response did not contain any problems');
  }

  const shapes = buildProblemShapes(parsed.problems);

  return {
    explanation: parsed.explanation || 'Here are your practice problems!',
    shapes,
  };
}
