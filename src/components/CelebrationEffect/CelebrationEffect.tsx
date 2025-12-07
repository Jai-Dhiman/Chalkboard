'use client';

import { useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationEffectProps {
  trigger: boolean;
  onComplete?: () => void;
}

export function CelebrationEffect({ trigger, onComplete }: CelebrationEffectProps) {
  const fireConfetti = useCallback(() => {
    // Create a burst of confetti from both sides
    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
      colors: ['#6366F1', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA']
    };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        onComplete?.();
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });

      // Confetti from right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    // Also fire a center burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366F1', '#34D399', '#FBBF24', '#F87171', '#A78BFA'],
      zIndex: 9999,
    });

    // Star-shaped confetti
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.5 },
      shapes: ['star'],
      colors: ['#FFD700', '#FFA500'],
      scalar: 1.2,
      zIndex: 9999,
    });

  }, [onComplete]);

  useEffect(() => {
    if (trigger) {
      fireConfetti();
    }
  }, [trigger, fireConfetti]);

  // This component doesn't render anything visible - confetti uses its own canvas
  return null;
}

// Simpler celebration for smaller wins
export function fireMiniCelebration() {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#6366F1', '#34D399', '#FBBF24'],
    zIndex: 9999,
  });
}

// Export for direct use
export { confetti };
