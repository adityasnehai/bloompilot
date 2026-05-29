"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Sky,
  OrbitControls,
  Environment,
  Sparkles,
  AccumulativeShadows,
  RandomizedLight,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  HueSaturation,
  DepthOfField,
  ChromaticAberration,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { Vector2 } from "three";
import * as THREE from "three";
import { BalconyGeometry, HALF_D } from "./balcony-geometry";
import { PlantSprite, GhostPlant } from "./plant-sprite";
import { LightZones } from "./light-zones";
import { useStudioStore, getSun, zoneAt } from "./studio-store";

// ── Floor click / ghost interaction ──────────────────────────────────────────
function FloorInteraction() {
  const pending   = useStudioStore((s) => s.pending);
  const ghostPos  = useStudioStore((s) => s.ghostPos);
  const placeAt   = useStudioStore((s) => s.placeAt);
  const setGhost  = useStudioStore((s) => s.setGhostPos);
  const setActive = useStudioStore((s) => s.setActive);

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerMove={(e) => {
          if (!pending) return;
          e.stopPropagation();
          setGhost([e.point.x, e.point.z]);
        }}
        onPointerLeave={() => pending && setGhost(null)}
        onClick={(e) => {
          if (!pending) { setActive(null); return; }
          e.stopPropagation();
          const cx = Math.max(-4.5, Math.min(4.5, e.point.x));
          const cz = Math.max(-HALF_D + 0.35, Math.min(HALF_D - 0.65, e.point.z));
          placeAt(cx, cz);
        }}
      >
        <planeGeometry args={[10, 5.5]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {pending && ghostPos && (
        <GhostPlant plant={pending} position={[ghostPos[0], 0, ghostPos[1]]} />
      )}
    </>
  );
}

// ── Placed plants ─────────────────────────────────────────────────────────────
function PlacedPlants() {
  const placed    = useStudioStore((s) => s.placed);
  const activeId  = useStudioStore((s) => s.activeId);
  const setActive = useStudioStore((s) => s.setActive);
  const sunHour   = useStudioStore((s) => s.sunHour);
  const showZones = useStudioStore((s) => s.showZones);

  return (
    <>
      {placed.map((plant) => (
        <group key={plant.id} position={[plant.x, 0, plant.z]}>
          <PlantSprite
            plant={plant}
            isActive={activeId === plant.id}
            zoneReq={showZones ? zoneAt(plant.z, sunHour) : undefined}
            onClick={() => setActive(activeId === plant.id ? null : plant.id)}
          />
        </group>
      ))}
    </>
  );
}

// ── Dynamic sky + lighting ────────────────────────────────────────────────────
function SkyLighting() {
  const sunHour = useStudioStore((s) => s.sunHour);
  const sun     = getSun(sunHour);

  const isGolden = sunHour < 9.5 || sunHour > 16.5;
  const ambColor = !sun.isDay
    ? "#0a0e1a"
    : isGolden ? "#ffcc80" : "#fff8f0";
  const ambIntensity = !sun.isDay ? 0.04 : isGolden ? 0.5 : 0.65;

  return (
    <>
      {/* Realistic atmospheric sky */}
      <Sky
        distance={450000}
        sunPosition={sun.norm}
        rayleigh={sun.isDay ? 2.8 : 0.3}
        turbidity={sun.isDay ? 9 : 1.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.88}
      />

      {/* Ambient */}
      <ambientLight color={ambColor} intensity={ambIntensity} />

      {/* Sun directional */}
      {sun.isDay && (
        <directionalLight
          position={sun.pos}
          intensity={sun.intensity}
          color={sun.color}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-near={1}
          shadow-camera-far={250}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={8}
          shadow-camera-bottom={-5}
        />
      )}

      {/* Sky hemisphere */}
      <hemisphereLight
        args={[
          sun.isDay ? (isGolden ? "#88aacc" : "#aaccee") : "#0a1020",
          "#5a3820",
          sun.isDay ? 0.55 : 0.04,
        ]}
      />

      {/* Terracotta floor bounce */}
      <pointLight
        position={[0, 0.4, 0]}
        intensity={sun.isDay ? 0.4 : 0}
        color="#cc7a40"
        distance={9}
        decay={2}
      />

      {/* Interior lamp glow through glass */}
      <pointLight
        position={[0, 1.8, -HALF_D - 0.5]}
        intensity={1.2}
        color="#ffd070"
        distance={4}
        decay={2}
      />
    </>
  );
}

// ── Atmospheric particles ─────────────────────────────────────────────────────
function Atmosphere() {
  const sunHour = useStudioStore((s) => s.sunHour);
  const isDay   = sunHour > 6.5 && sunHour < 19.5;
  const isNight = sunHour < 6 || sunHour > 20;

  return (
    <>
      {/* Dust motes in sunlight */}
      {isDay && (
        <Sparkles
          count={80}
          scale={[9, 2.5, 4]}
          position={[0, 1.5, -0.5]}
          size={1.4}
          speed={0.1}
          opacity={0.22}
          color="#fff8d0"
        />
      )}
      {/* Night stars */}
      {isNight && (
        <Sparkles
          count={250}
          scale={[40, 25, 40]}
          position={[0, 12, -8]}
          size={2.2}
          speed={0.04}
          opacity={0.75}
          color="#e8eeff"
        />
      )}
    </>
  );
}

// ── Post processing ───────────────────────────────────────────────────────────
function PostFX() {
  const sunHour = useStudioStore((s) => s.sunHour);
  const sun     = getSun(sunHour);
  const isGolden = sunHour < 9.5 || sunHour > 16.5;

  return (
    <EffectComposer multisampling={4}>
      <SMAA />
      <DepthOfField
        focusDistance={0.0055}
        focalLength={0.028}
        bokehScale={2.5}
        height={720}
      />
      <Bloom
        luminanceThreshold={0.82}
        luminanceSmoothing={0.92}
        intensity={isGolden ? 0.85 : 0.45}
        mipmapBlur
      />
      <ChromaticAberration
        offset={new Vector2(0.0004, 0.0004)}
        radialModulation={false}
        modulationOffset={0}
      />
      <HueSaturation
        hue={isGolden ? 0.025 : 0}
        saturation={isGolden ? 0.18 : 0.1}
      />
      <BrightnessContrast brightness={0.02} contrast={0.06} />
      <Vignette offset={0.3} darkness={0.58} />
    </EffectComposer>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene() {
  const sunHour   = useStudioStore((s) => s.sunHour);
  const showZones = useStudioStore((s) => s.showZones);
  const sun       = getSun(sunHour);

  // Atmospheric fog colour shifts with sun
  const fogColor = !sun.isDay ? "#05080f"
    : sunHour < 9 || sunHour > 18 ? "#c8a070"
    : "#c8dce8";

  return (
    <>
      <fog attach="fog" args={[fogColor, 22, 60]} />

      <SkyLighting />

      {/* Soft realtime shadows on floor */}
      <AccumulativeShadows
        temporal
        frames={50}
        alphaTest={0.7}
        scale={16}
        position={[0, 0.003, 0]}
      >
        <RandomizedLight
          amount={5}
          radius={6}
          intensity={0.9}
          ambient={0.4}
          position={[0, 8, -8]}
        />
      </AccumulativeShadows>

      <BalconyGeometry />
      <LightZones sunHour={sunHour} visible={showZones} />
      <FloorInteraction />
      <PlacedPlants />
      <Atmosphere />
      <PostFX />
    </>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────
export function BalconyCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [1.5, 5.5, 10.5], fov: 48, near: 0.08, far: 300 }}
      gl={{
        antialias: false,        // SMAA handles AA
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4.5}
        maxDistance={16}
        minPolarAngle={Math.PI / 9}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 1.2, -0.5]}
        enableDamping
        dampingFactor={0.07}
      />
    </Canvas>
  );
}
