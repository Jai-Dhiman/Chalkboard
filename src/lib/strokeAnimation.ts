// Stroke animation utilities for handwritten text
// Progressively reveals draw shapes to simulate writing
import type { Editor, TLShapeId } from 'tldraw';
import type { HandwritingPoint } from './handwriting';

export interface DrawShapeSegment {
  type: 'free';
  points: HandwritingPoint[];
}

export interface AnimationOptions {
  pointsPerFrame: number; // Points to add per animation frame
  frameInterval: number; // Milliseconds between frames
  strokeDelay: number; // Milliseconds pause between strokes
}

const DEFAULT_OPTIONS: AnimationOptions = {
  pointsPerFrame: 3, // Add 3 points per frame for smooth animation
  frameInterval: 16, // ~60fps
  strokeDelay: 30, // Brief pause between strokes
};

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Animate a draw shape by progressively adding points to segments
 * This creates the effect of the shape being drawn in real-time
 */
export async function animateDrawShape(
  editor: Editor,
  shapeId: TLShapeId,
  targetSegments: DrawShapeSegment[],
  baseProps: Record<string, unknown>,
  options: Partial<AnimationOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (targetSegments.length === 0) return;

  // Start with shape having empty segments
  const animatedSegments: DrawShapeSegment[] = [];

  // Process each segment (stroke) sequentially
  for (let segmentIndex = 0; segmentIndex < targetSegments.length; segmentIndex++) {
    const targetSegment = targetSegments[segmentIndex];
    const totalPoints = targetSegment.points.length;

    if (totalPoints === 0) continue;

    // Initialize this segment with empty points
    animatedSegments.push({
      type: 'free',
      points: [],
    });

    // Progressively add points to this segment
    for (let pointIndex = 0; pointIndex < totalPoints; pointIndex += opts.pointsPerFrame) {
      const endIndex = Math.min(pointIndex + opts.pointsPerFrame, totalPoints);
      const partialPoints = targetSegment.points.slice(0, endIndex);

      // Update the current segment with partial points
      animatedSegments[segmentIndex] = {
        type: 'free',
        points: partialPoints,
      };

      // Update the shape
      editor.updateShape({
        id: shapeId,
        type: 'draw',
        props: {
          ...baseProps,
          segments: [...animatedSegments],
          isComplete: false,
        },
      });

      await delay(opts.frameInterval);
    }

    // Ensure final segment has all points
    animatedSegments[segmentIndex] = {
      type: 'free',
      points: targetSegment.points,
    };

    // Brief pause between strokes
    if (segmentIndex < targetSegments.length - 1) {
      await delay(opts.strokeDelay);
    }
  }

  // Mark shape as complete
  editor.updateShape({
    id: shapeId,
    type: 'draw',
    props: {
      ...baseProps,
      segments: animatedSegments,
      isComplete: true,
    },
  });
}

/**
 * Animate multiple draw shapes sequentially
 * Useful for writing multiple words/problems
 */
export async function animateMultipleShapes(
  editor: Editor,
  shapes: Array<{
    id: TLShapeId;
    x: number;
    y: number;
    segments: DrawShapeSegment[];
    props: Record<string, unknown>;
  }>,
  options: Partial<AnimationOptions> = {}
): Promise<void> {
  for (const shape of shapes) {
    // Create the shape first with empty segments
    editor.createShape({
      id: shape.id,
      type: 'draw',
      x: shape.x,
      y: shape.y,
      props: {
        ...shape.props,
        segments: [],
        isComplete: false,
      },
    });

    // Animate it
    await animateDrawShape(editor, shape.id, shape.segments, shape.props, options);
  }
}

/**
 * Create a draw shape without animation (instant)
 * Useful for fallback or when animation is disabled
 */
export function createDrawShapeInstant(
  editor: Editor,
  shapeId: TLShapeId,
  x: number,
  y: number,
  segments: DrawShapeSegment[],
  props: Record<string, unknown>
): void {
  editor.createShape({
    id: shapeId,
    type: 'draw',
    x,
    y,
    props: {
      ...props,
      segments,
      isComplete: true,
    },
  });
}
