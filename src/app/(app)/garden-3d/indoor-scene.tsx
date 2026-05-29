"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, AccumulativeShadows, RandomizedLight, Sparkles, SpotLight } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, DepthOfField, SMAA, HueSaturation } from "@react-three/postprocessing";
import * as THREE from "three";
import { useIndoorStore, ROOM_ZONES, type Zone } from "./indoor-store";
import { PlacedIndoorPlantMesh } from "./indoor-plants";

// ─── Room shell ───────────────────────────────────────────────────────────────
const ROOM = { w: 7.5, h: 2.9, d: 6.5 };
const WALL_COLOR = "#f4f0eb";
const TRIM_COLOR = "#e8e2d9";

function Room() {
  return (
    <group>
      {/* floor */}
      <HardwoodFloor />
      {/* ceiling */}
      <mesh position={[0, ROOM.h, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial color="#f8f5f0" roughness={1} />
      </mesh>
      {/* back wall (with window) */}
      <BackWall />
      {/* left wall (with shelf) */}
      <mesh position={[-ROOM.w / 2, ROOM.h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.92} />
      </mesh>
      {/* right wall */}
      <mesh position={[ROOM.w / 2, ROOM.h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.92} />
      </mesh>
      {/* skirting boards */}
      {[
        [0, 0.065, -ROOM.d / 2 + 0.04, ROOM.w, 0.13, 0.08],
        [0, 0.065,  ROOM.d / 2 - 0.04, ROOM.w, 0.13, 0.08],
        [-ROOM.w / 2 + 0.04, 0.065, 0, 0.08, 0.13, ROOM.d],
        [ ROOM.w / 2 - 0.04, 0.065, 0, 0.08, 0.13, ROOM.d],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.8} />
        </mesh>
      ))}
      {/* ceiling cornice */}
      <mesh position={[0, ROOM.h - 0.06, -ROOM.d / 2 + 0.05]}>
        <boxGeometry args={[ROOM.w, 0.12, 0.1]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.8} />
      </mesh>
      {/* wall shelf unit */}
      <WallShelf />
    </group>
  );
}

function HardwoodFloor() {
  const floorTex = useMemo(() => {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c8a070";
    ctx.fillRect(0, 0, size, size);
    // plank lines
    const plankW = size / 5;
    for (let p = 0; p < 5; p++) {
      const x = p * plankW;
      const shade = p % 2 === 0 ? "#c0986a" : "#d0aa78";
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, 0, plankW - 4, size);
      // grain lines
      for (let g = 0; g < 12; g++) {
        const gy = Math.random() * size;
        ctx.strokeStyle = "rgba(100,60,20,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.lineTo(x + plankW - 4, gy + (Math.random() - 0.5) * 20);
        ctx.stroke();
      }
      // plank gap
      ctx.fillStyle = "#8a6040";
      ctx.fillRect(x, 0, 3, size);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[ROOM.w, ROOM.d, 1, 1]} />
      <meshStandardMaterial map={floorTex} roughness={0.5} metalness={0.05} color="#d4aa80" />
    </mesh>
  );
}

function BackWall() {
  const WIN_W = 1.5, WIN_H = 1.8, WIN_Y = 0.95;
  return (
    <group position={[0, 0, -ROOM.d / 2]}>
      {/* wall panels around window */}
      {[
        [-2.0, ROOM.h / 2, 0,     2.8, ROOM.h, 0.06],
        [ 2.0, ROOM.h / 2, 0,     2.8, ROOM.h, 0.06],
        [ 0, ROOM.h - 0.45, 0,    WIN_W + 0.6, 0.9, 0.06],
        [ 0, 0.3, 0,               WIN_W + 0.6, 0.6, 0.06],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} receiveShadow>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
        </mesh>
      ))}

      {/* window frame */}
      <WindowFrame w={WIN_W} h={WIN_H} y={WIN_Y} />
    </group>
  );
}

function WindowFrame({ w, h, y }: { w: number; h: number; y: number }) {
  const frameRef = useRef<THREE.Mesh>(null);

  // animated light shaft
  useFrame(({ clock }) => {
    if (!frameRef.current) return;
    const mat = frameRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.055 + Math.sin(clock.elapsedTime * 0.3) * 0.015;
  });

  return (
    <group position={[0, y, 0]}>
      {/* glass */}
      <mesh position={[0, h / 2, 0.03]}>
        <boxGeometry args={[w, h, 0.025]} />
        <meshPhysicalMaterial
          color="#c8e8f8"
          transmission={0.85}
          roughness={0.05}
          metalness={0.1}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* frame */}
      {[
        [0,     -0.04,  0, w + 0.12, 0.08, 0.1],
        [0,   h + 0.04, 0, w + 0.12, 0.08, 0.1],
        [-w / 2 - 0.04, h / 2, 0, 0.08, h + 0.1, 0.1],
        [ w / 2 + 0.04, h / 2, 0, 0.08, h + 0.1, 0.1],
        [0, h / 2, 0, 0.06, h, 0.1],          // centre mullion
        [0, h * 0.55, 0, w + 0.06, 0.06, 0.1], // horizontal bar
      ].map(([x, fy, fz, fw, fh, fd], i) => (
        <mesh key={i} position={[x as number, fy as number, fz as number]}>
          <boxGeometry args={[fw as number, fh as number, fd as number]} />
          <meshStandardMaterial color="#f0ece6" roughness={0.75} />
        </mesh>
      ))}

      {/* window sill */}
      <mesh position={[0, -0.06, 0.1]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.06, 0.28]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.7} />
      </mesh>

      {/* light shaft */}
      <mesh ref={frameRef} position={[0, h / 2, 1.5]} rotation={[0, 0, 0]}>
        <boxGeometry args={[w * 0.9, h * 0.85, 3]} />
        <meshBasicMaterial color="#fff8e0" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

function WallShelf() {
  const W = 2.2, D = 0.28, TIER_H = 0.025;
  const tiers = [0.72, 1.42];
  return (
    <group position={[-ROOM.w / 2 + 0.06, 0, 0]}>
      {/* brackets */}
      {tiers.map((y, i) => [-0.8, 0, 0.8].map((z, j) => (
        <mesh key={`b${i}${j}`} position={[0.08, y - 0.05, z]}>
          <boxGeometry args={[0.14, 0.06, 0.22]} />
          <meshStandardMaterial color="#b89060" roughness={0.85} />
        </mesh>
      )))}
      {/* shelves */}
      {tiers.map((y, i) => (
        <mesh key={`shelf${i}`} position={[0.12, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, TIER_H, W]} />
          <meshStandardMaterial color="#c8a060" roughness={0.7} />
        </mesh>
      ))}
      {/* side panels */}
      {[-W / 2, W / 2].map((z, i) => (
        <mesh key={`side${i}`} position={[0.12, 1.07, z]}>
          <boxGeometry args={[0.22, 0.82, 0.02]} />
          <meshStandardMaterial color="#c8a060" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Zone hotspots ────────────────────────────────────────────────────────────
function ZoneHotspots() {
  const selected = useIndoorStore((s) => s.selected);
  const placed = useIndoorStore((s) => s.placed);
  const placeInZone = useIndoorStore((s) => s.placeInZone);
  const [hovered, setHovered] = React.useState<string | null>(null);

  if (!selected) return null;

  return (
    <>
      {ROOM_ZONES.map((zone: Zone) => {
        const occupied = placed.some((p) => p.zone.id === zone.id);
        const compatible = selected.suitableZones.includes(zone.type);
        if (occupied || !compatible) return null;

        const isH = hovered === zone.id;
        const r = zone.type === "hanging" ? 0.18 : zone.type === "windowsill" ? 0.14 : 0.22;

        return (
          <mesh
            key={zone.id}
            position={[zone.x, zone.y + (zone.type === "hanging" ? 0 : 0.01), zone.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => { e.stopPropagation(); placeInZone(zone); }}
            onPointerOver={() => { setHovered(zone.id); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { setHovered(null); document.body.style.cursor = "default"; }}
          >
            <circleGeometry args={[r, 24]} />
            <meshBasicMaterial
              color={isH ? "#86efac" : "#d4fde4"}
              transparent
              opacity={isH ? 0.85 : 0.45}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Lighting configs ─────────────────────────────────────────────────────────
const LIGHT_CONFIGS = {
  day:     { env: "apartment" as const, sunColor: "#fff8e8", sunIntensity: 2.0, ambIntensity: 0.7, hue: 0.0,   sat: 0.05 },
  evening: { env: "apartment" as const, sunColor: "#ff8040", sunIntensity: 1.1, ambIntensity: 0.5, hue: -0.02, sat: 0.12 },
  golden:  { env: "sunset"    as const, sunColor: "#ffbb44", sunIntensity: 1.4, ambIntensity: 0.55, hue: 0.04,  sat: 0.18 },
};

// ─── Main indoor scene ────────────────────────────────────────────────────────
import React from "react";

export function IndoorScene() {
  const placed = useIndoorStore((s) => s.placed);
  const setActive = useIndoorStore((s) => s.setActive);
  const lightMode = useIndoorStore((s) => s.lightMode);
  const cfg = LIGHT_CONFIGS[lightMode];

  return (
    <>
      {/* Environment (HDR for bounce light) */}
      <Environment preset={cfg.env} />

      {/* Window sunlight */}
      <directionalLight
        position={[-1, 4, -14]}
        target-position={[0, 0, 0]}
        intensity={cfg.sunIntensity}
        color={cfg.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
      />

      {/* Warm ambient fill */}
      <ambientLight intensity={cfg.ambIntensity} color="#fff5e0" />

      {/* Warm lamp point light */}
      <pointLight position={[2.5, 2.4, 1.5]} intensity={0.8} color="#ffd080" distance={5} decay={2} />
      <pointLight position={[-2.0, 2.4, 1.5]} intensity={0.6} color="#ffe0a0" distance={4} decay={2} />

      {/* Spot for shelf */}
      <SpotLight
        position={[-2.8, 2.7, 0]}
        angle={0.55}
        penumbra={0.8}
        intensity={0.6}
        color="#fff8e8"
        castShadow={false}
        target-position={[-3.5, 1.0, 0]}
      />

      {/* background plane */}
      <mesh position={[0, ROOM.h / 2, 0]} onClick={() => setActive(null)}>
        <boxGeometry args={[ROOM.w + 2, ROOM.h + 2, ROOM.d + 2]} />
        <meshBasicMaterial visible={false} side={THREE.BackSide} />
      </mesh>

      {/* Room */}
      <Room />

      {/* Zone hotspots */}
      <ZoneHotspots />

      {/* Placed plants */}
      {placed.map((item) => (
        <PlacedIndoorPlantMesh key={item.id} item={item} />
      ))}

      {/* Dust motes in window light */}
      <Sparkles
        count={80}
        scale={[2.0, 2.0, 1.5]}
        position={[0, 1.5, -2.0]}
        size={1.5}
        speed={0.15}
        opacity={0.3}
        color="#fff8d0"
      />

      {/* Soft accumulated shadows */}
      <AccumulativeShadows
        temporal
        frames={30}
        alphaTest={0.7}
        scale={18}
        position={[0, 0.01, 0]}
      >
        <RandomizedLight amount={5} radius={4} intensity={0.7} ambient={0.5} position={[-2, 6, -10]} />
      </AccumulativeShadows>

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        <SMAA />
        <DepthOfField focusDistance={0.008} focalLength={0.04} bokehScale={2.0} />
        <Bloom luminanceThreshold={0.88} luminanceSmoothing={0.9} intensity={0.4} />
        <HueSaturation hue={cfg.hue} saturation={cfg.sat} />
        <Vignette offset={0.25} darkness={0.5} />
      </EffectComposer>
    </>
  );
}
