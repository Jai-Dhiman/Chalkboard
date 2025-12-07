// Math Tutor Agent - generates problems using Grok AI
import { type Editor } from 'tldraw';
import { callGrok, callGrokVision } from './grokClient';
import type { TldrawShapeData } from '@/types';

// Color palette for problems (chalk-like colors for dark background)
const COLORS = ['white', 'violet', 'light-blue', 'light-green', 'yellow', 'orange'] as const;

/**
 * Shape manifest entry for AI context
 */
export interface ShapeManifestEntry {
  id: string;
  label: string;        // Human-readable label like "problem-1", "student-answer-1"
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  content?: string;     // Text content if applicable
  isStudentWork: boolean; // True for freehand drawings (student work)
  isTutorContent: boolean; // True for tutor-generated content
}

/**
 * Build a structured manifest of canvas shapes for AI
 * This gives the AI precise spatial information to anchor annotations
 */
export function buildShapeManifest(editor: Editor): ShapeManifestEntry[] {
  const shapes = editor.getCurrentPageShapes();
  const manifest: ShapeManifestEntry[] = [];

  let studentWorkIndex = 0;
  let problemIndex = 0;
  let otherIndex = 0;

  for (const shape of shapes) {
    const bounds = editor.getShapeGeometry(shape).bounds;
    let content: string | undefined;
    let label: string;
    let isStudentWork = false;
    let isTutorContent = false;

    // Determine if this is tutor-generated content (has our ID pattern)
    const isTutorShape = shape.id.includes('tutor-') || shape.id.includes('annotation-');

    if (shape.type === 'text') {
      const props = shape.props as { text?: string; richText?: unknown; color?: string };
      // Extract text content
      let textContent = props.text || '';
      if (!textContent && props.richText) {
        try {
          const rt = props.richText as { content?: Array<{ content?: Array<{ text?: string }> }> };
          textContent = rt.content?.map(p => p.content?.map(c => c.text || '').join('')).join('\n') || '';
        } catch {
          textContent = '';
        }
      }
      content = textContent.slice(0, 150);

      // Check if this looks like a problem (starts with "Problem" or has equation-like content)
      if (content.toLowerCase().includes('problem') || content.toLowerCase().includes('solve') || content.toLowerCase().includes('find')) {
        problemIndex++;
        label = `problem-${problemIndex}`;
        isTutorContent = true;
      } else if (isTutorShape) {
        label = `tutor-text-${++otherIndex}`;
        isTutorContent = true;
      } else {
        studentWorkIndex++;
        label = `student-text-${studentWorkIndex}`;
        isStudentWork = true;
      }
    } else if (shape.type === 'draw') {
      // Freehand drawings are student work
      studentWorkIndex++;
      label = `student-drawing-${studentWorkIndex}`;
      isStudentWork = true;
    } else if (shape.type === 'geo') {
      const props = shape.props as { geo?: string };
      otherIndex++;
      label = `shape-${props.geo || 'unknown'}-${otherIndex}`;
    } else {
      otherIndex++;
      label = `${shape.type}-${otherIndex}`;
    }

    manifest.push({
      id: shape.id,
      label,
      type: shape.type,
      bounds: {
        x: Math.round(shape.x),
        y: Math.round(shape.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      },
      content,
      isStudentWork,
      isTutorContent,
    });
  }

  return manifest;
}

/**
 * Serialize canvas state to a text description for AI context
 */
export function serializeCanvasForAI(editor: Editor): string {
  const shapes = editor.getCurrentPageShapes();

  if (shapes.length === 0) {
    return 'The canvas is empty.';
  }

  const descriptions: string[] = [];

  for (const shape of shapes) {
    if (shape.type === 'text') {
      const props = shape.props as { text?: string; richText?: unknown };
      // Extract text content - try text first, then richText
      let textContent = props.text || '';
      if (!textContent && props.richText) {
        // richText is a complex object, try to extract plain text
        try {
          const rt = props.richText as { content?: Array<{ content?: Array<{ text?: string }> }> };
          textContent = rt.content?.map(p => p.content?.map(c => c.text || '').join('')).join('\n') || '[text shape]';
        } catch {
          textContent = '[text shape]';
        }
      }
      descriptions.push(`- Text at (${Math.round(shape.x)}, ${Math.round(shape.y)}): "${textContent.slice(0, 100)}${textContent.length > 100 ? '...' : ''}"`);
    } else if (shape.type === 'draw') {
      descriptions.push(`- Freehand drawing at (${Math.round(shape.x)}, ${Math.round(shape.y)})`);
    } else if (shape.type === 'geo') {
      const props = shape.props as { geo?: string; w?: number; h?: number };
      descriptions.push(`- ${props.geo || 'shape'} (${Math.round(props.w || 0)}x${Math.round(props.h || 0)}) at (${Math.round(shape.x)}, ${Math.round(shape.y)})`);
    } else {
      descriptions.push(`- ${shape.type} at (${Math.round(shape.x)}, ${Math.round(shape.y)})`);
    }
  }

  return `Canvas contains ${shapes.length} element(s):\n${descriptions.join('\n')}`;
}

/**
 * Capture canvas as base64 PNG image for vision API
 * Returns null if canvas is empty or capture fails
 */
export async function captureCanvasScreenshot(editor: Editor): Promise<string | null> {
  try {
    const shapeIds = [...editor.getCurrentPageShapeIds()];

    // If canvas is empty, no need for screenshot
    if (shapeIds.length === 0) {
      console.log('[Screenshot] Canvas is empty, skipping capture');
      return null;
    }

    console.log('[Screenshot] Capturing canvas with', shapeIds.length, 'shapes');

    // tldraw v4 API: toImage returns { blob: Blob, width: number, height: number }
    const result = await editor.toImage(shapeIds, {
      format: 'png',
      quality: 1,
      background: '#1a1a1a', // Match our dark canvas background
      padding: 20,
    });

    if (!result) {
      console.error('[Screenshot] toImage returned null/undefined');
      return null;
    }

    // Handle object result with blob property (tldraw v4 format)
    let blob: Blob | null = null;

    if (result instanceof Blob) {
      blob = result;
    } else if (typeof result === 'object' && 'blob' in result && result.blob instanceof Blob) {
      blob = result.blob;
    }

    if (blob) {
      console.log('[Screenshot] Got Blob, converting to base64...');
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);
      console.log('[Screenshot] Successfully captured, base64 length:', base64Data.length);
      return base64Data;
    }

    // Handle string result (data URL) - legacy fallback
    if (typeof result === 'string' && result.startsWith('data:')) {
      const base64Data = result.split(',')[1];
      if (!base64Data) {
        console.error('[Screenshot] Could not extract base64 from data URL');
        return null;
      }
      console.log('[Screenshot] Successfully captured, base64 length:', base64Data.length);
      return base64Data;
    }

    console.error('[Screenshot] Unexpected result type:', typeof result, result);
    return null;
  } catch (error) {
    console.error('[Screenshot] Failed to capture canvas:', error);
    return null;
  }
}

const MATH_TUTOR_PROMPT = `You are Grok, a patient Socratic math tutor. You write problems on a shared canvas.

YOUR TEACHING PHILOSOPHY:
- Guide students to discover solutions, don't just give answers
- Start with easier problems and build up
- Be encouraging and patient
- Keep spoken explanations brief - the canvas does the teaching

JSON FORMAT:
{
    "explanation": "Brief, friendly introduction (1-2 sentences)",
    "clearCanvas": false,
    "problems": [
        {
            "label": "Problem 1",
            "content": "The math problem to display"
        }
    ]
}

IMPORTANT RULES:
1. RESPECT THE REQUESTED COUNT - If user asks for "a problem" or "one problem", give exactly 1. If they ask for "3 problems", give exactly 3. Default to 1 if unspecified.
2. Set "clearCanvas": true when user wants NEW/DIFFERENT problems (e.g., "let's try something else", "different topic", "start over", "new problem")
3. Set "clearCanvas": false when user is continuing work on existing problems
4. Use text notation: x^2 for exponents, sqrt(x) for square roots
5. Keep explanations SHORT and encouraging
6. Don't include answers - let students work them out

Examples of good problem content:
- "Find f'(x) if f(x) = 3x^2 + 5x - 2"
- "Solve: x^2 + 5x + 6 = 0"
- "Factor: x^2 - 9"

Always respond with valid JSON only.`;

// Vision-enhanced prompt that can see the canvas
// Note: The shape manifest is appended dynamically in generateProblems()
const MATH_TUTOR_VISION_PROMPT = `You are Grok, a patient Socratic math tutor. You can SEE the student's canvas AND you have a structured map of all shapes.

YOUR TEACHING PHILOSOPHY:
- NEVER give away answers directly
- Guide students to discover solutions themselves
- Ask leading questions that prompt insight
- Celebrate what they did RIGHT before addressing mistakes
- Use the canvas to write hints near the student's work

WHEN CHECKING STUDENT WORK:
1. First, acknowledge their effort and what's correct
2. If there's an error, DON'T reveal the answer
3. Instead, write a guiding question or hint ON THE CANVAS next to their work
4. Keep your spoken explanation brief - let the canvas do the teaching

CANVAS ANNOTATION SYSTEM:
You will receive a SHAPE_MANIFEST listing all canvas elements with labels like:
- "student-drawing-1" (freehand work by student)
- "student-text-1" (text typed by student)
- "problem-1", "problem-2" (problems you previously wrote)

Use these labels to ANCHOR your annotations precisely:

JSON FORMAT:
{
    "explanation": "Brief, encouraging spoken response (1-2 sentences max)",
    "annotations": [
        {
            "type": "hint",
            "anchor": "student-drawing-1",
            "position": "right",
            "content": "What rule applies to x^2?"
        },
        {
            "type": "encouragement",
            "anchor": "student-drawing-1",
            "position": "above",
            "content": "Good start!"
        }
    ],
    "problems": []
}

ANNOTATION FIELDS:
- "type": One of "hint", "correction", "encouragement", "arrow"
- "anchor": The label from SHAPE_MANIFEST (e.g., "student-drawing-1")
- "position": Where to place relative to anchor:
  - "below": Best for hints/next steps (gives space to work)
  - "above": Best for short encouragement
  - "right": Only for very short labels
  - "left": Rarely used
- "content": The text to display (keep SHORT - under 40 chars if possible)

ANNOTATION TYPES:
- "hint" (yellow): A guiding question - use position "below"
- "correction" (blue): Shows ONE step or formula hint - use position "below"
- "encouragement" (green): Short praise - use position "above"
- "arrow" (orange): Points to something - use position "right" or "left"

POSITIONING RULES:
- Hints and corrections go BELOW the student's work (so they can continue working)
- Encouragement goes ABOVE (short, out of the way)
- Keep annotations SHORT to avoid overlapping

EXAMPLE - Student writes answer, needs verification:
{
    "explanation": "Nice work! Let's verify.",
    "annotations": [
        {
            "type": "encouragement",
            "anchor": "student-drawing-1",
            "position": "above",
            "content": "Good attempt!"
        },
        {
            "type": "hint",
            "anchor": "student-drawing-1",
            "position": "below",
            "content": "Try plugging your answer back in"
        }
    ],
    "problems": []
}

IMPORTANT RULES:
1. Always use anchor + position, NOT x/y coordinates
2. Reference the SHAPE_MANIFEST labels exactly
3. Keep explanations SHORT - canvas hints do the teaching
4. Use text notation: x^2, sqrt(x), etc.
5. RESPECT THE REQUESTED COUNT - If user asks for "a problem", give exactly 1
6. Set "clearCanvas": true when user wants NEW/DIFFERENT problems (e.g., "let's try something else", "different topic", "new problem", "I don't like these")
7. Set "clearCanvas": false when checking work or continuing on existing problems

Full JSON format:
{
    "explanation": "Brief response",
    "clearCanvas": false,
    "annotations": [...],
    "problems": [...]
}

Always respond with valid JSON only.`;

interface Problem {
  label: string;
  content: string;
  hint?: string;
}

type AnnotationPosition = 'right' | 'below' | 'above' | 'left';

interface Annotation {
  type: 'hint' | 'arrow' | 'correction' | 'encouragement';
  content: string;
  // Anchor-based positioning (preferred)
  anchor?: string;           // Label from shape manifest (e.g., "student-drawing-1")
  position?: AnnotationPosition; // Where to place relative to anchor
  // Fallback absolute positioning (only if no anchor)
  x?: number;
  y?: number;
}

interface GrokMathResponse {
  explanation: string;
  problems: Problem[];
  annotations?: Annotation[];
  clearCanvas?: boolean;
}

export interface MathTutorResult {
  explanation: string;
  shapes: TextShapeData[];
  clearCanvas: boolean;
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

// Text shape data for native tldraw text rendering
export interface TextShapeData {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string; // Plain text content (used for animation)
  props: {
    color: string;
    size: 's' | 'm' | 'l' | 'xl';
    font: 'draw' | 'sans' | 'serif' | 'mono';
    textAlign: 'start' | 'middle' | 'end';
    autoSize: boolean;
    scale: number;
  };
}

// Color mapping for annotation types
const ANNOTATION_COLORS: Record<Annotation['type'], string> = {
  hint: 'yellow',        // Guiding questions in yellow
  arrow: 'orange',       // Arrows/pointers in orange
  correction: 'light-blue', // Corrections in blue
  encouragement: 'light-green', // Positive feedback in green
};

// Prefix symbols for annotation types
const ANNOTATION_PREFIXES: Record<Annotation['type'], string> = {
  hint: '? ',           // Question mark for hints
  arrow: '-> ',          // Arrow for pointers
  correction: '',        // No prefix for corrections
  encouragement: '',     // No prefix for encouragement
};

// Offset distances for positioning annotations relative to anchors
const POSITION_OFFSETS: Record<AnnotationPosition, { dx: number; dy: number }> = {
  right: { dx: 30, dy: 0 },    // 30px gap to the right
  left: { dx: -250, dy: 0 },   // 250px to the left (approximate width)
  above: { dx: 0, dy: -50 },   // 50px above
  below: { dx: 0, dy: 30 },    // 30px below the bottom edge
};

/**
 * Resolve annotation position from anchor reference
 */
function resolveAnnotationPosition(
  annotation: Annotation,
  shapeManifest: ShapeManifestEntry[]
): { x: number; y: number } {
  // If anchor is specified, resolve from manifest
  if (annotation.anchor && shapeManifest.length > 0) {
    const anchorShape = shapeManifest.find(s => s.label === annotation.anchor);

    if (anchorShape) {
      const offset = POSITION_OFFSETS[annotation.position || 'right'];
      let x = anchorShape.bounds.x;
      let y = anchorShape.bounds.y;

      // Calculate position based on anchor bounds and offset
      switch (annotation.position) {
        case 'right':
          x = anchorShape.bounds.x + anchorShape.bounds.width + offset.dx;
          y = anchorShape.bounds.y + offset.dy;
          break;
        case 'left':
          x = anchorShape.bounds.x + offset.dx;
          y = anchorShape.bounds.y + offset.dy;
          break;
        case 'above':
          x = anchorShape.bounds.x + offset.dx;
          y = anchorShape.bounds.y + offset.dy;
          break;
        case 'below':
          x = anchorShape.bounds.x + offset.dx;
          y = anchorShape.bounds.y + anchorShape.bounds.height + offset.dy;
          break;
        default:
          // Default to right of shape
          x = anchorShape.bounds.x + anchorShape.bounds.width + 20;
          y = anchorShape.bounds.y;
      }

      console.log(`[Annotation] Anchored "${annotation.content}" to ${annotation.anchor} at (${x}, ${y})`);
      return { x, y };
    } else {
      console.warn(`[Annotation] Anchor "${annotation.anchor}" not found in manifest, using fallback`);
    }
  }

  // Fallback to absolute coordinates if provided
  if (annotation.x !== undefined && annotation.y !== undefined) {
    return { x: annotation.x, y: annotation.y };
  }

  // Last resort: place in a default location
  console.warn('[Annotation] No valid position, using default (100, 400)');
  return { x: 100, y: 400 };
}

function buildAnnotationShapes(
  annotations: Annotation[],
  shapeManifest: ShapeManifestEntry[]
): TextShapeData[] {
  const shapes: TextShapeData[] = [];

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    const color = ANNOTATION_COLORS[annotation.type];
    const prefix = ANNOTATION_PREFIXES[annotation.type];
    const { x, y } = resolveAnnotationPosition(annotation, shapeManifest);

    shapes.push({
      id: `shape:annotation-${Date.now()}-${i}`,
      type: 'text',
      x,
      y,
      text: `${prefix}${annotation.content}`,
      props: {
        color,
        size: annotation.type === 'hint' ? 'm' : 's',
        font: 'draw',
        textAlign: 'start',
        autoSize: true,
        scale: 1,
      },
    });
  }

  return shapes;
}

async function buildProblemShapes(problems: Problem[]): Promise<TextShapeData[]> {
  const shapes: TextShapeData[] = [];
  const baseX = 100;
  const baseY = 100;
  const ySpacing = 80; // Spacing between problems

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const color = COLORS[i % COLORS.length];
    const currentY = baseY + i * ySpacing;

    // Problem label
    const labelText = problem.label || `Problem ${i + 1}`;
    shapes.push({
      id: `shape:tutor-${Date.now()}-${i}-label`,
      type: 'text',
      x: baseX,
      y: currentY,
      text: labelText,
      props: {
        color: 'grey',
        size: 's',
        font: 'draw',
        textAlign: 'start',
        autoSize: true,
        scale: 1,
      },
    });

    // Problem content
    shapes.push({
      id: `shape:tutor-${Date.now()}-${i}-content`,
      type: 'text',
      x: baseX,
      y: currentY + 25,
      text: problem.content,
      props: {
        color,
        size: 'm',
        font: 'draw',
        textAlign: 'start',
        autoSize: true,
        scale: 1,
      },
    });

    // Optional hint
    if (problem.hint) {
      const hintText = `Hint: ${problem.hint}`;
      shapes.push({
        id: `shape:tutor-${Date.now()}-${i}-hint`,
        type: 'text',
        x: baseX,
        y: currentY + 55,
        text: hintText,
        props: {
          color: 'grey',
          size: 's',
          font: 'draw',
          textAlign: 'start',
          autoSize: true,
          scale: 1,
        },
      });
    }
  }

  return shapes;
}

export async function generateProblems(
  userRequest: string,
  apiKey: string,
  canvasScreenshot?: string | null,
  editor?: Editor | null
): Promise<MathTutorResult> {
  let responseText: string;
  let shapeManifest: ShapeManifestEntry[] = [];

  // Build shape manifest if we have an editor reference
  if (editor) {
    shapeManifest = buildShapeManifest(editor);
    console.log('[MathTutor] Shape manifest:', shapeManifest.map(s => s.label));
  }

  // Always use Grok 4 - it handles both text and vision in one model
  if (canvasScreenshot) {
    console.log('[MathTutor] Using Grok 4 with canvas screenshot');

    // Build enhanced user message with shape manifest
    let enhancedUserMessage = userRequest;
    if (shapeManifest.length > 0) {
      const manifestText = shapeManifest.map(s =>
        `- "${s.label}": ${s.type}${s.content ? ` containing "${s.content.slice(0, 50)}..."` : ''} at bounds {x: ${s.bounds.x}, y: ${s.bounds.y}, width: ${s.bounds.width}, height: ${s.bounds.height}}${s.isStudentWork ? ' [STUDENT WORK]' : ''}`
      ).join('\n');

      enhancedUserMessage = `SHAPE_MANIFEST:\n${manifestText}\n\nSTUDENT MESSAGE: ${userRequest}`;
    }

    responseText = await callGrokVision(
      MATH_TUTOR_VISION_PROMPT,
      enhancedUserMessage,
      canvasScreenshot,
      apiKey,
      'grok-4'
    );
  } else {
    console.log('[MathTutor] Using Grok 4 (empty canvas)');
    responseText = await callGrok(
      [
        { role: 'system', content: MATH_TUTOR_PROMPT },
        { role: 'user', content: userRequest },
      ],
      apiKey,
      'grok-4'
    );
  }

  const parsed = parseGrokResponse(responseText);

  // Allow empty problems array (for feedback-only responses)
  if (!parsed.problems) {
    parsed.problems = [];
  }

  // Build shapes from both problems and annotations
  const problemShapes = await buildProblemShapes(parsed.problems);
  const annotationShapes = parsed.annotations
    ? buildAnnotationShapes(parsed.annotations, shapeManifest)
    : [];

  const shapes = [...annotationShapes, ...problemShapes];

  return {
    explanation: parsed.explanation || 'Here are your practice problems!',
    shapes,
    clearCanvas: parsed.clearCanvas || false,
  };
}
