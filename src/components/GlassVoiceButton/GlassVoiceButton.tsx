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
        anim.targetIor = 1.5;
        anim.targetThickness = 0.5;
        anim.targetChromaticAberration = 0.02;
        anim.rotationSpeed = 0.1;
        break;
      case 'listening':
        anim.targetScale = 1.1;
        anim.targetIor = 1.8;
        anim.targetThickness = 0.8;
        anim.targetChromaticAberration = 0.06;
        anim.rotationSpeed = 0.3;
        break;
      case 'processing':
        anim.targetScale = 1.05;
        anim.targetIor = 2.0;
        anim.targetThickness = 1.0;
        anim.targetChromaticAberration = 0.1;
        anim.rotationSpeed = 0.8;
        break;
      case 'speaking':
        anim.targetScale = 1.15;
        anim.targetIor = 1.6;
        anim.targetThickness = 0.6;
        anim.targetChromaticAberration = 0.15;
        anim.rotationSpeed = 0.2;
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

    // Smooth interpolation
    anim.scale += (anim.targetScale - anim.scale) * lerpFactor;
    anim.ior += (anim.targetIor - anim.ior) * lerpFactor;
    anim.thickness += (anim.targetThickness - anim.thickness) * lerpFactor;
    anim.chromaticAberration += (anim.targetChromaticAberration - anim.chromaticAberration) * lerpFactor;

    // Add audio reactivity for speaking state
    let audioBoost = 0;
    if (state === 'speaking') {
      audioBoost = audioLevel * 0.3;
    } else if (state === 'listening') {
      audioBoost = audioLevel * 0.15;
    }

    // Breathing animation for idle
    let breathe = 0;
    if (state === 'idle') {
      breathe = Math.sin(anim.time * 1.5) * 0.03;
    }

    // Processing wobble
    let wobble = 0;
    if (state === 'processing') {
      wobble = Math.sin(anim.time * 4) * 0.02;
    }

    // Apply scale
    const finalScale = anim.scale + audioBoost + breathe + wobble;
    meshRef.current.scale.setScalar(finalScale);

    // Rotation
    meshRef.current.rotation.y += anim.rotationSpeed * delta;
    meshRef.current.rotation.x = Math.sin(anim.time * 0.5) * 0.1;
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

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Subtle pulse animation
    let scale = 1;
    if (state === 'speaking') {
      scale = 1 + audioLevel * 0.15 + Math.sin(timeRef.current * 6) * 0.05;
    } else if (state === 'listening') {
      scale = 1 + Math.sin(timeRef.current * 3) * 0.08;
    } else if (state === 'processing') {
      scale = 1 + Math.sin(timeRef.current * 5) * 0.1;
    } else {
      scale = 1 + Math.sin(timeRef.current * 1.5) * 0.03;
    }

    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      <Html
        center
        transform
        distanceFactor={7}
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
            filter: 'drop-shadow(0 0 24px rgba(255,255,255,0.6))',
            objectFit: 'cover',
          }}
        />
      </Html>
      <pointLight position={[0, 0, 0.5]} intensity={1.5} color="#ffffff" />
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
  return (
    <div
      onClick={onPress}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPress()}
      aria-label={state === 'listening' ? 'Stop listening' : 'Start talking'}
      style={{
        width: '120px',
        height: '120px',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{
          background: 'transparent',
          pointerEvents: 'none',
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

      {/* Hover overlay for better click feedback */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          transition: 'background 0.2s ease',
          pointerEvents: 'none',
        }}
        className="glass-voice-button-overlay"
      />

      <style>{`
        .glass-voice-button-overlay:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
