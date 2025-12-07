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
 *
 * IMPORTANT: tldraw requires each segment to have at least 2 points.
 * This function handles shape creation internally to ensure validity.
 */
export async function animateDrawShape(
  editor: Editor,
  shapeId: TLShapeId,
  targetSegments: DrawShapeSegment[],
  baseProps: Record<string, unknown>,
  options: Partial<AnimationOptions> = {},
  position?: { x: number; y: number }
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter out segments with fewer than 2 points (tldraw requirement)
  const validSegments = targetSegments.filter(seg => seg.points.length >= 2);

  if (validSegments.length === 0) return;

  // Track if we've created the shape yet
  let shapeCreated = false;

  // Accumulated segments for updates (only segments with >= 2 points)
  const animatedSegments: DrawShapeSegment[] = [];

  // Process each segment (stroke) sequentially
  for (let segmentIndex = 0; segmentIndex < validSegments.length; segmentIndex++) {
    const targetSegment = validSegments[segmentIndex];
    const totalPoints = targetSegment.points.length;

    // Progressively add points to this segment
    // Start at 2 points minimum to satisfy tldraw's Polyline2d requirement
    for (let pointIndex = 2; pointIndex <= totalPoints; pointIndex += opts.pointsPerFrame) {
      const endIndex = Math.min(pointIndex, totalPoints);
      const partialPoints = targetSegment.points.slice(0, endIndex);

      // Build current state of segments
      const currentSegments = [
        ...animatedSegments,
        { type: 'free' as const, points: partialPoints },
      ];

      if (!shapeCreated) {
        // Create the shape with initial valid segments
        editor.createShape({
          id: shapeId,
          type: 'draw',
          x: position?.x ?? 0,
          y: position?.y ?? 0,
          props: {
            ...baseProps,
            segments: currentSegments,
            isComplete: false,
          },
        });
        shapeCreated = true;
      } else {
        // Update the shape
        editor.updateShape({
          id: shapeId,
          type: 'draw',
          props: {
            ...baseProps,
            segments: currentSegments,
            isComplete: false,
          },
        });
      }

      await delay(opts.frameInterval);
    }

    // Add completed segment to our accumulated list
    animatedSegments.push({
      type: 'free',
      points: targetSegment.points,
    });

    // Brief pause between strokes
    if (segmentIndex < validSegments.length - 1) {
      await delay(opts.strokeDelay);
    }
  }

  // Mark shape as complete
  if (shapeCreated) {
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
    // animateDrawShape handles shape creation internally to ensure valid segments
    await animateDrawShape(
      editor,
      shape.id,
      shape.segments,
      shape.props,
      options,
      { x: shape.x, y: shape.y }
    );
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
