/* eslint-disable react/no-unknown-property */
import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { VoiceState } from '@/types';

interface GlassVoiceButtonProps {
  state: VoiceState;
  audioLevel?: number;
  onPress: () => void;
}

interface GlassOrbProps {
  state: VoiceState;
  audioLevel: number;
}

function GlassOrb({ state, audioLevel }: GlassOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null!);

  // Animation values stored as refs for smooth interpolation
  const animationState = useRef({
    scale: 1,
    targetScale: 1,
    ior: 1.5,
    targetIor: 1.5,
    thickness: 0.5,
    targetThickness: 0.5,
    chromaticAberration: 0.02,
    targetChromaticAberration: 0.02,
    rotationSpeed: 0,
    time: 0,
  });

  // Update targets based on voice state
  useMemo(() => {
    const anim = animationState.current;
    switch (state) {
      case 'idle':
        anim.targetScale = 1;
        anim.targetIor = 1.4;
        anim.targetThickness = 0.4;
        anim.targetChromaticAberration = 0.015;
        anim.rotationSpeed = 0.08;
        break;
      case 'listening':
        anim.targetScale = 1.08;
        anim.targetIor = 1.6;
        anim.targetThickness = 0.7;
        anim.targetChromaticAberration = 0.05;
        anim.rotationSpeed = 0.25;
        break;
      case 'processing':
        anim.targetScale = 1.04;
        anim.targetIor = 1.8;
        anim.targetThickness = 0.9;
        anim.targetChromaticAberration = 0.08;
        anim.rotationSpeed = 0.6;
        break;
      case 'speaking':
        anim.targetScale = 1.1;
        anim.targetIor = 1.5;
        anim.targetThickness = 0.5;
        anim.targetChromaticAberration = 0.1;
        anim.rotationSpeed = 0.15;
        break;
      case 'interrupted':
        anim.targetScale = 0.95;
        anim.targetIor = 1.3;
        anim.targetThickness = 0.3;
        anim.targetChromaticAberration = 0.02;
        anim.rotationSpeed = 0;
        break;
    }
  }, [state]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const anim = animationState.current;
    const lerpFactor = 1 - Math.pow(0.001, delta);

    anim.time += delta;

    // Smooth interpolation for material properties only
    anim.ior += (anim.targetIor - anim.ior) * lerpFactor;
    anim.thickness += (anim.targetThickness - anim.thickness) * lerpFactor;
    anim.chromaticAberration += (anim.targetChromaticAberration - anim.chromaticAberration) * lerpFactor;

    // Enhanced idle breathing animation - subtle but visible scale pulse
    let breathingScale = 1;
    if (state === 'idle') {
      // Gentle breathing: 4 second cycle, subtle 3% scale change
      breathingScale = 1 + Math.sin(anim.time * 0.5 * Math.PI) * 0.03;
    } else if (state === 'speaking') {
      // Audio-responsive + gentle pulse
      breathingScale = 1 + audioLevel * 0.05 + Math.sin(anim.time * 2) * 0.02;
    } else if (state === 'listening') {
      breathingScale = 1 + Math.sin(anim.time * 1.2) * 0.025;
    } else if (state === 'processing') {
      breathingScale = 1 + Math.sin(anim.time * 1.8) * 0.02;
    }

    meshRef.current.scale.setScalar(breathingScale);

    // Gentle rotation
    meshRef.current.rotation.y += anim.rotationSpeed * delta;
    meshRef.current.rotation.x = Math.sin(anim.time * 0.4) * 0.04;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        ref={materialRef}
        backside
        samples={16}
        thickness={0.5}
        chromaticAberration={0.02}
        anisotropy={0.3}
        distortion={0.2}
        distortionScale={0.3}
        temporalDistortion={0.1}
        ior={1.5}
        color="#ffffff"
        attenuationDistance={0.5}
        attenuationColor="#8b5cf6"
      />
    </mesh>
  );
}

function GrokLogo({ state, audioLevel }: { state: VoiceState; audioLevel: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const opacityRef = useRef(0.6);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Gentle, subtle pulse animation
    let scale = 1;
    let targetOpacity = 0.6;

    if (state === 'speaking') {
      scale = 1 + audioLevel * 0.05 + Math.sin(timeRef.current * 2) * 0.015;
      targetOpacity = 0.9;
    } else if (state === 'listening') {
      scale = 1 + Math.sin(timeRef.current * 1.5) * 0.02;
      targetOpacity = 0.85;
    } else if (state === 'processing') {
      scale = 1 + Math.sin(timeRef.current * 2) * 0.02;
      targetOpacity = 0.8;
    } else if (state === 'idle') {
      // Subtle breathing for logo in idle - synced with orb
      scale = 1 + Math.sin(timeRef.current * 0.5 * Math.PI) * 0.015;
      targetOpacity = 0.5; // More subtle in idle state
    } else {
      scale = 0.95;
      targetOpacity = 0.4;
    }

    groupRef.current.scale.setScalar(scale);

    // Smooth opacity transition
    opacityRef.current += (targetOpacity - opacityRef.current) * delta * 3;
  });

  // Determine filter based on state for subtle visual feedback
  const getFilter = () => {
    if (state === 'idle') {
      return 'drop-shadow(0 0 16px rgba(255,255,255,0.3)) brightness(0.9)';
    }
    if (state === 'speaking') {
      return 'drop-shadow(0 0 28px rgba(99, 102, 241, 0.7))';
    }
    if (state === 'listening') {
      return 'drop-shadow(0 0 24px rgba(52, 211, 153, 0.6))';
    }
    return 'drop-shadow(0 0 20px rgba(255,255,255,0.5))';
  };

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      <Html
        center
        transform
        distanceFactor={9}
        style={{
          pointerEvents: 'none',
        }}
      >
        <img
          src="/grok.jpg"
          alt="Grok"
          width={500}
          height={500}
          style={{
            borderRadius: '50%',
            filter: getFilter(),
            objectFit: 'cover',
            opacity: state === 'idle' ? 0.7 : 1,
            transition: 'filter 0.3s ease, opacity 0.3s ease',
          }}
        />
      </Html>
      <pointLight
        position={[0, 0, 0.5]}
        intensity={state === 'idle' ? 1 : 1.5}
        color="#ffffff"
      />
    </group>
  );
}

function Scene({ state, audioLevel }: GlassOrbProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, -5]} intensity={0.5} />

      <GrokLogo state={state} audioLevel={audioLevel} />
      <GlassOrb state={state} audioLevel={audioLevel} />

      <Environment preset="city" />
    </>
  );
}

export function GlassVoiceButton({ state, audioLevel = 0, onPress }: GlassVoiceButtonProps) {
  const handleClick = () => {
    console.log('[GlassVoiceButton] Clicked, calling onPress');
    onPress();
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={state === 'listening' ? 'Stop listening' : 'Start talking'}
      style={{
        width: '100px',
        height: '100px',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          style={{
            background: 'transparent',
          }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          }}
        >
          <Suspense fallback={null}>
            <Scene state={state} audioLevel={audioLevel} />
          </Suspense>
        </Canvas>
      </div>

      {/* Clickable overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          zIndex: 10,
        }}
      />
    </div>
  );
}
