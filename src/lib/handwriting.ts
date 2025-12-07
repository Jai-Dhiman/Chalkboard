// Handwriting conversion using opentype.js
// Converts text to stroke paths for tldraw draw shapes
import opentype from 'opentype.js';

export interface HandwritingPoint {
  x: number;
  y: number;
  z: number; // Pressure (0-1)
}

export interface HandwritingStroke {
  points: HandwritingPoint[];
}

export interface HandwritingResult {
  strokes: HandwritingStroke[];
  width: number;
  height: number;
}

// Cached font instance
let cachedFont: opentype.Font | null = null;
let fontLoadPromise: Promise<opentype.Font> | null = null;

/**
 * Load the handwriting font (cached)
 */
async function loadFont(): Promise<opentype.Font> {
  if (cachedFont) return cachedFont;

  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = opentype.load('/fonts/Roboto.ttf').then((font) => {
    cachedFont = font;
    return font;
  });

  return fontLoadPromise;
}

/**
 * Add natural pressure variation to strokes
 * Pressure peaks in the middle of each stroke (like real pen strokes)
 */
function addPressureVariation(points: Array<{ x: number; y: number }>): HandwritingPoint[] {
  const len = points.length;
  if (len === 0) return [];
  if (len === 1) return [{ ...points[0], z: 0.5 }];

  return points.map((point, index) => {
    // Pressure curve: starts lower, peaks in middle, ends lower
    const progress = index / (len - 1);
    const basePressure = 0.4;
    const variation = Math.sin(progress * Math.PI) * 0.4;
    return {
      x: point.x,
      y: point.y,
      z: basePressure + variation,
    };
  });
}

/**
 * Add slight jitter to make strokes look more natural/hand-drawn
 * Disabled for now to improve legibility
 */
function addJitter(
  points: HandwritingPoint[],
  _amount: number = 0.3
): HandwritingPoint[] {
  // Return points unchanged for cleaner, more legible output
  return points;
}

/**
 * Convert SVG path commands to points
 */
function pathToPoints(path: opentype.Path, scale: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  for (const cmd of path.commands) {
    if (cmd.type === 'M' || cmd.type === 'L') {
      points.push({ x: cmd.x * scale, y: cmd.y * scale });
    } else if (cmd.type === 'C') {
      // Cubic bezier - sample points along the curve
      const lastPoint = points[points.length - 1] || { x: 0, y: 0 };
      const steps = 8;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps;
        const t1 = 1 - tt;
        const x = t1 * t1 * t1 * lastPoint.x +
                  3 * t1 * t1 * tt * cmd.x1 * scale +
                  3 * t1 * tt * tt * cmd.x2 * scale +
                  tt * tt * tt * cmd.x * scale;
        const y = t1 * t1 * t1 * lastPoint.y +
                  3 * t1 * t1 * tt * cmd.y1 * scale +
                  3 * t1 * tt * tt * cmd.y2 * scale +
                  tt * tt * tt * cmd.y * scale;
        points.push({ x, y });
      }
    } else if (cmd.type === 'Q') {
      // Quadratic bezier - sample points along the curve
      const lastPoint = points[points.length - 1] || { x: 0, y: 0 };
      const steps = 6;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps;
        const t1 = 1 - tt;
        const x = t1 * t1 * lastPoint.x +
                  2 * t1 * tt * cmd.x1 * scale +
                  tt * tt * cmd.x * scale;
        const y = t1 * t1 * lastPoint.y +
                  2 * t1 * tt * cmd.y1 * scale +
                  tt * tt * cmd.y * scale;
        points.push({ x, y });
      }
    }
    // 'Z' (close path) - we can ignore for stroke rendering
  }

  return points;
}

/**
 * Convert text to handwriting strokes using opentype.js
 *
 * @param text - The text to convert
 * @param scale - Scale factor for the output (default 2.5 for good visibility)
 * @param offsetX - X offset for positioning
 * @param offsetY - Y offset for positioning
 * @returns HandwritingResult with strokes and dimensions
 */
export async function textToStrokesAsync(
  text: string,
  scale: number = 2.5,
  offsetX: number = 0,
  offsetY: number = 0
): Promise<HandwritingResult> {
  if (!text || text.trim() === '') {
    return { strokes: [], width: 0, height: 0 };
  }

  try {
    const font = await loadFont();
    console.log('[Handwriting] Font loaded successfully');

    // Get the path for the text
    const fontSize = 48; // Larger base font size for better detail
    const path = font.getPath(text, 0, fontSize, fontSize);
    console.log('[Handwriting] Path commands:', path.commands.length, 'for text:', text);

    // Get bounding box
    const bbox = path.getBoundingBox();
    console.log('[Handwriting] Bounding box:', bbox);
    const width = (bbox.x2 - bbox.x1) * scale;
    const height = (bbox.y2 - bbox.y1) * scale;

    // Convert path commands to strokes
    // Each 'M' command starts a new stroke
    // We also break strokes on 'Z' (close path) commands
    const strokes: HandwritingStroke[] = [];
    let currentStrokePoints: Array<{ x: number; y: number }> = [];

    const saveCurrentStroke = () => {
      if (currentStrokePoints.length >= 2) {
        const pointsWithPressure = addPressureVariation(currentStrokePoints);
        const pointsWithJitter = addJitter(pointsWithPressure, 0.2 * scale);
        strokes.push({ points: pointsWithJitter });
      }
      currentStrokePoints = [];
    };

    for (const cmd of path.commands) {
      if (cmd.type === 'M') {
        // Start new stroke - save previous if it has points
        saveCurrentStroke();
        currentStrokePoints = [{
          x: (cmd.x - bbox.x1) * scale + offsetX,
          y: (cmd.y - bbox.y1) * scale + offsetY
        }];
      } else if (cmd.type === 'L') {
        currentStrokePoints.push({
          x: (cmd.x - bbox.x1) * scale + offsetX,
          y: (cmd.y - bbox.y1) * scale + offsetY
        });
      } else if (cmd.type === 'C') {
        // Cubic bezier - sample points
        const lastPoint = currentStrokePoints[currentStrokePoints.length - 1] || { x: offsetX, y: offsetY };
        const steps = 8;
        for (let t = 1; t <= steps; t++) {
          const tt = t / steps;
          const t1 = 1 - tt;
          // Convert control points
          const x1 = (cmd.x1 - bbox.x1) * scale + offsetX;
          const y1 = (cmd.y1 - bbox.y1) * scale + offsetY;
          const x2 = (cmd.x2 - bbox.x1) * scale + offsetX;
          const y2 = (cmd.y2 - bbox.y1) * scale + offsetY;
          const x = (cmd.x - bbox.x1) * scale + offsetX;
          const y = (cmd.y - bbox.y1) * scale + offsetY;

          const px = t1 * t1 * t1 * lastPoint.x +
                    3 * t1 * t1 * tt * x1 +
                    3 * t1 * tt * tt * x2 +
                    tt * tt * tt * x;
          const py = t1 * t1 * t1 * lastPoint.y +
                    3 * t1 * t1 * tt * y1 +
                    3 * t1 * tt * tt * y2 +
                    tt * tt * tt * y;
          currentStrokePoints.push({ x: px, y: py });
        }
      } else if (cmd.type === 'Q') {
        // Quadratic bezier
        const lastPoint = currentStrokePoints[currentStrokePoints.length - 1] || { x: offsetX, y: offsetY };
        const steps = 6;
        for (let t = 1; t <= steps; t++) {
          const tt = t / steps;
          const t1 = 1 - tt;
          const x1 = (cmd.x1 - bbox.x1) * scale + offsetX;
          const y1 = (cmd.y1 - bbox.y1) * scale + offsetY;
          const x = (cmd.x - bbox.x1) * scale + offsetX;
          const y = (cmd.y - bbox.y1) * scale + offsetY;

          const px = t1 * t1 * lastPoint.x +
                    2 * t1 * tt * x1 +
                    tt * tt * x;
          const py = t1 * t1 * lastPoint.y +
                    2 * t1 * tt * y1 +
                    tt * tt * y;
          currentStrokePoints.push({ x: px, y: py });
        }
      } else if (cmd.type === 'Z') {
        // Close path - save current stroke
        saveCurrentStroke();
      }
    }

    // Don't forget the last stroke
    saveCurrentStroke();

    console.log('[Handwriting] Generated', strokes.length, 'strokes for text:', text);
    if (strokes.length > 0) {
      console.log('[Handwriting] First stroke has', strokes[0].points.length, 'points');
    }

    return {
      strokes,
      width,
      height,
    };
  } catch (error) {
    console.error('[Handwriting] Error converting text to strokes:', error, 'Text:', text);
    return { strokes: [], width: 0, height: 0 };
  }
}

// Synchronous wrapper that returns empty result if font not loaded
// Use textToStrokesAsync for actual conversions
export function textToStrokes(
  text: string,
  scale: number = 2.5,
  offsetX: number = 0,
  offsetY: number = 0
): HandwritingResult {
  // For backwards compatibility - but this won't work without async
  console.warn('[Handwriting] textToStrokes is deprecated, use textToStrokesAsync instead');
  return { strokes: [], width: 0, height: 0 };
}

/**
 * Convert strokes to tldraw draw shape segments format
 */
export function strokesToSegments(
  strokes: HandwritingStroke[]
): Array<{ type: 'free'; points: HandwritingPoint[] }> {
  return strokes.map(stroke => ({
    type: 'free' as const,
    points: stroke.points,
  }));
}

/**
 * Get the bounding box of strokes
 */
export function getStrokesBounds(strokes: HandwritingStroke[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (strokes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
