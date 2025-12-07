import type { Editor } from 'tldraw';

/**
 * Captures a screenshot of the current canvas state as a base64 PNG.
 * Returns null if the canvas is empty or capture fails.
 */
export async function captureCanvasScreenshot(editor: Editor): Promise<string | null> {
  const shapes = editor.getCurrentPageShapes();

  if (shapes.length === 0) {
    return null;
  }

  try {
    // Get the bounds of all shapes
    const bounds = editor.getSelectionPageBounds() || editor.getCurrentPageBounds();

    if (!bounds) {
      return null;
    }

    // Export as SVG and convert to base64
    const svg = await editor.getSvgString(shapes.map(s => s.id), {
      scale: 1,
      background: true,
      padding: 16,
    });

    if (!svg) {
      return null;
    }

    // Convert SVG to base64
    const base64 = btoa(unescape(encodeURIComponent(svg.svg)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.error('[Canvas] Failed to capture screenshot:', error);
    return null;
  }
}
