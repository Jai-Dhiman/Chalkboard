import type { WSClientMessage, WSServerMessage } from '@/types';
import { toRichText } from 'tldraw';

type MessageHandler = (message: WSServerMessage) => void;
type OpenHandler = () => void;
type CloseHandler = () => void;

export class MockWebSocket {
  private onMessageHandler: MessageHandler | null = null;
  private onOpenHandler: OpenHandler | null = null;
  private onCloseHandler: CloseHandler | null = null;
  private isConnected = false;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private shapeCounter = 0;

  constructor() {
    // Simulate connection delay
    this.connectionTimeout = setTimeout(() => {
      this.isConnected = true;
      this.onOpenHandler?.();
    }, 300);
  }

  set onopen(handler: OpenHandler | null) {
    this.onOpenHandler = handler;
    if (this.isConnected && handler) {
      handler();
    }
  }

  set onmessage(handler: ((event: { data: string }) => void) | null) {
    if (handler) {
      this.onMessageHandler = (msg) => handler({ data: JSON.stringify(msg) });
    } else {
      this.onMessageHandler = null;
    }
  }

  set onclose(handler: CloseHandler | null) {
    this.onCloseHandler = handler;
  }

  set onerror(_handler: ((error: unknown) => void) | null) {
    // Mock doesn't generate errors
  }

  send(data: string): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const message: WSClientMessage = JSON.parse(data);
    this.handleClientMessage(message);
  }

  close(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.isConnected = false;
    this.onCloseHandler?.();
  }

  private handleClientMessage(message: WSClientMessage): void {
    switch (message.type) {
      case 'VOICE_START':
        this.simulateListeningStart();
        break;
      case 'VOICE_END':
        this.simulateProcessingAndResponse();
        break;
      case 'TEXT_MESSAGE':
        this.handleTextMessage(message.text);
        break;
      case 'CANVAS_UPDATE':
      case 'CANVAS_CHANGE':
        break;
    }
  }

  private simulateListeningStart(): void {
    this.emit({ type: 'VOICE_STATE', state: 'listening' });
    this.emit({ type: 'TUTOR_STATUS', status: 'thinking' });
  }

  private handleTextMessage(text: string): void {
    // Show the student's message
    this.emit({
      type: 'VOICE_TRANSCRIPT',
      role: 'student',
      text: text,
    });

    // Processing state
    setTimeout(() => {
      this.emit({ type: 'TUTOR_STATUS', status: 'thinking' });
    }, 200);

    // Tutor response with drawing
    setTimeout(() => {
      this.emit({ type: 'TUTOR_STATUS', status: 'drawing' });

      // Parse what to draw based on input
      const drawings = this.parseDrawingRequest(text);

      // Add shapes to canvas
      drawings.forEach((drawing, index) => {
        setTimeout(() => {
          this.emit({
            type: 'CANVAS_COMMAND',
            command: {
              action: 'ADD_SHAPE',
              shape: drawing,
            },
          });
        }, index * 300);
      });

      // Tutor explains what was drawn
      setTimeout(() => {
        this.emit({
          type: 'VOICE_TRANSCRIPT',
          role: 'tutor',
          text: this.getResponseForDrawing(text),
        });
        this.emit({ type: 'TUTOR_STATUS', status: 'thinking' });
      }, drawings.length * 300 + 500);
    }, 800);
  }

  private parseDrawingRequest(text: string): Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    props: Record<string, unknown>;
  }> {
    const lowerText = text.toLowerCase();
    const baseX = 100 + (this.shapeCounter % 5) * 150;
    const baseY = 100 + Math.floor(this.shapeCounter / 5) * 150;
    this.shapeCounter++;

    // Quadratic equation
    if (lowerText.includes('quadratic') || lowerText.includes('ax^2') || lowerText.includes('parabola')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'text',
          x: baseX,
          y: baseY,
          props: { richText: toRichText('ax^2 + bx + c = 0'), size: 'l', color: 'violet', autoSize: true },
        },
        {
          id: `shape:tutor-${Date.now()}-2`,
          type: 'text',
          x: baseX,
          y: baseY + 50,
          props: { richText: toRichText('x = (-b +/- sqrt(b^2-4ac)) / 2a'), size: 'm', color: 'blue', autoSize: true },
        },
      ];
    }

    // Linear equation
    if (lowerText.includes('linear') || lowerText.includes('y = mx')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'text',
          x: baseX,
          y: baseY,
          props: { richText: toRichText('y = mx + b'), size: 'l', color: 'green', autoSize: true },
        },
        {
          id: `shape:tutor-${Date.now()}-2`,
          type: 'text',
          x: baseX,
          y: baseY + 40,
          props: { richText: toRichText('m = slope, b = y-intercept'), size: 's', color: 'grey', autoSize: true },
        },
      ];
    }

    // Pythagorean theorem
    if (lowerText.includes('pythag') || lowerText.includes('triangle') || lowerText.includes('a^2 + b^2')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'text',
          x: baseX,
          y: baseY,
          props: { richText: toRichText('a^2 + b^2 = c^2'), size: 'l', color: 'red', autoSize: true },
        },
        {
          id: `shape:tutor-${Date.now()}-2`,
          type: 'geo',
          x: baseX + 200,
          y: baseY,
          props: { geo: 'triangle', w: 100, h: 80, color: 'orange' },
        },
      ];
    }

    // Circle / Pi
    if (lowerText.includes('circle') || lowerText.includes('pi') || lowerText.includes('radius')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'geo',
          x: baseX,
          y: baseY,
          props: { geo: 'ellipse', w: 100, h: 100, color: 'blue' },
        },
        {
          id: `shape:tutor-${Date.now()}-2`,
          type: 'text',
          x: baseX + 120,
          y: baseY + 30,
          props: { richText: toRichText('A = pi * r^2'), size: 'm', color: 'blue', autoSize: true },
        },
        {
          id: `shape:tutor-${Date.now()}-3`,
          type: 'text',
          x: baseX + 120,
          y: baseY + 60,
          props: { richText: toRichText('C = 2 * pi * r'), size: 'm', color: 'violet', autoSize: true },
        },
      ];
    }

    // Derivative / Calculus
    if (lowerText.includes('derivative') || lowerText.includes('calculus') || lowerText.includes('dx')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'text',
          x: baseX,
          y: baseY,
          props: { richText: toRichText('d/dx [x^n] = n*x^(n-1)'), size: 'l', color: 'violet', autoSize: true },
        },
        {
          id: `shape:tutor-${Date.now()}-2`,
          type: 'text',
          x: baseX,
          y: baseY + 50,
          props: { richText: toRichText('Power Rule'), size: 's', color: 'grey', autoSize: true },
        },
      ];
    }

    // Integral
    if (lowerText.includes('integral') || lowerText.includes('antiderivative')) {
      return [
        {
          id: `shape:tutor-${Date.now()}-1`,
          type: 'text',
          x: baseX,
          y: baseY,
          props: { richText: toRichText('integral x^n dx = x^(n+1)/(n+1) + C'), size: 'l', color: 'green', autoSize: true },
        },
      ];
    }

    // Default: Just show the user's text as a note
    return [
      {
        id: `shape:tutor-${Date.now()}`,
        type: 'text',
        x: baseX,
        y: baseY,
        props: { richText: toRichText(text), size: 'm', color: 'black', autoSize: true },
      },
    ];
  }

  private getResponseForDrawing(text: string): string {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('quadratic')) {
      return "I've drawn the quadratic formula. This is used to find the roots of any quadratic equation ax^2 + bx + c = 0.";
    }
    if (lowerText.includes('linear')) {
      return "Here's the slope-intercept form of a linear equation. 'm' is the slope and 'b' is where the line crosses the y-axis.";
    }
    if (lowerText.includes('pythag') || lowerText.includes('triangle')) {
      return "The Pythagorean theorem relates the sides of a right triangle. The square of the hypotenuse equals the sum of squares of the other two sides.";
    }
    if (lowerText.includes('circle') || lowerText.includes('pi')) {
      return "I've drawn a circle with the formulas for area (A = pi*r^2) and circumference (C = 2*pi*r).";
    }
    if (lowerText.includes('derivative')) {
      return "The power rule is one of the most important differentiation rules. It tells us how to find the derivative of x raised to any power.";
    }
    if (lowerText.includes('integral')) {
      return "This is the reverse of the power rule - integration. Don't forget the constant of integration C!";
    }

    return `I've added your note to the canvas: "${text}"`;
  }

  private simulateProcessingAndResponse(): void {
    setTimeout(() => {
      this.emit({
        type: 'VOICE_TRANSCRIPT',
        role: 'student',
        text: "I'm confused about how to solve this quadratic equation...",
      });
    }, 300);

    setTimeout(() => {
      this.emit({ type: 'VOICE_STATE', state: 'processing' });
      this.emit({ type: 'TUTOR_STATUS', status: 'thinking' });
    }, 800);

    setTimeout(() => {
      this.emit({ type: 'VOICE_STATE', state: 'speaking' });
      this.emit({
        type: 'VOICE_TRANSCRIPT',
        role: 'tutor',
        text: "Let's break this down step by step. First, can you identify the coefficients a, b, and c?",
      });

      this.emit({
        type: 'CANVAS_COMMAND',
        command: {
          action: 'ADD_SHAPE',
          shape: {
            id: `shape:tutor-${Date.now()}`,
            type: 'text',
            x: 200,
            y: 200,
            props: { richText: toRichText('ax^2 + bx + c = 0'), size: 'l', color: 'violet', autoSize: true },
          },
        },
      });
    }, 2000);

    setTimeout(() => {
      this.emit({ type: 'VOICE_STATE', state: 'listening' });
      this.emit({ type: 'TUTOR_STATUS', status: 'thinking' });
    }, 4000);
  }

  private emit(message: WSServerMessage): void {
    if (this.onMessageHandler && this.isConnected) {
      this.onMessageHandler(message);
    }
  }
}
