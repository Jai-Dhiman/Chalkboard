import type { Editor } from 'tldraw';
import { getSvgAsImage, FileHelpers } from 'tldraw';

export interface CanvasScreenshotResult {
  dataUrl: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  padding: number;
}

/**
 * Captures a screenshot of the current canvas state as a base64 PNG.
 * Returns null if the canvas is empty or capture fails.
 *
 * Note: We export as PNG (not SVG) because vision APIs like Grok-4
 * expect raster image formats for analysis.
 *
 * Returns both the image and the bounds info needed to transform
 * vision coordinates back to canvas coordinates.
 */
export async function captureCanvasScreenshot(editor: Editor): Promise<string | null> {
  const result = await captureCanvasScreenshotWithBounds(editor);
  return result?.dataUrl ?? null;
}

export async function captureCanvasScreenshotWithBounds(editor: Editor): Promise<CanvasScreenshotResult | null> {
  const shapes = editor.getCurrentPageShapes();

  if (shapes.length === 0) {
    return null;
  }

  const PADDING = 16;

  try {
    // Get the bounds of all shapes
    const bounds = editor.getCurrentPageBounds();

    if (!bounds) {
      return null;
    }

    // First get SVG string
    const svg = await editor.getSvgString(shapes.map(s => s.id), {
      scale: 1,
      background: true,
      padding: PADDING,
    });

    if (!svg) {
      return null;
    }

    // Convert SVG to JPEG blob for vision API compatibility
    // Using JPEG with moderate quality for faster uploads and processing
    // Vision API can still read text clearly at 0.8 quality
    const pngBlob = await getSvgAsImage(svg.svg, {
      type: 'jpeg',
      quality: 0.8,
      width: svg.width,
      height: svg.height,
      pixelRatio: 1,
    });

    if (!pngBlob) {
      console.warn('[Canvas] Failed to convert SVG to PNG');
      return null;
    }

    // Convert blob to base64 data URL
    const dataUrl = await FileHelpers.blobToDataUrl(pngBlob);
    return {
      dataUrl,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      padding: PADDING,
    };
  } catch (error) {
    console.error('[Canvas] Failed to capture screenshot:', error);
    return null;
  }
}
