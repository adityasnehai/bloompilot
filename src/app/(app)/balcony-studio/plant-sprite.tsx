"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { PlacedPlant, LightReq } from "./studio-store";
import { ZONE_META } from "./studio-store";

// ── Terracotta pot ────────────────────────────────────────────────────────────
function Pot({ r = 0.22 }: { r?: number }) {
  const h = r * 1.1;
  return (
    <group>
      {/* saucer */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r * 1.18, 20]} />
        <meshStandardMaterial color="#8a3e10" roughness={0.9} />
      </mesh>
      {/* pot body */}
      <mesh position={[0, h * 0.5 + 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.88, r, h, 20]} />
        <meshStandardMaterial color="#c1440e" roughness={0.78} />
      </mesh>
      {/* rim */}
      <mesh position={[0, h + 0.015, 0]} castShadow>
        <cylinderGeometry args={[r * 0.95, r * 0.88, 0.04, 20]} />
        <meshStandardMaterial color="#a83c0c" roughness={0.75} />
      </mesh>
      {/* soil */}
      <mesh position={[0, h + 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.84, 20]} />
        <meshStandardMaterial color="#2a1a0e" roughness={1} />
      </mesh>
    </group>
  );
}

// ── Fallback geometry when no image ──────────────────────────────────────────
function FallbackPlant({ lightReq, scale = 1 }: { lightReq: LightReq; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * 100, []);
  const color = lightReq === "full_sun" ? "#4a9a3a" : lightReq === "partial_shade" ? "#3a8a5a" : "#2a6a4a";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * 0.6 + phase;
    groupRef.current.rotation.z = Math.sin(t) * 0.025;
  });

  return (
    <group ref={groupRef}>
      {/* stem */}
      <mesh position={[0, 0.45 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.55 * scale, 8]} />
        <meshStandardMaterial color="#5a7040" roughness={0.9} />
      </mesh>
      {/* foliage cluster */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        const h = 0.65 * scale + (i % 3) * 0.12 * scale;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.18 * scale, h, Math.cos(a) * 0.18 * scale]} castShadow>
            <sphereGeometry args={[0.18 * scale + (i % 2) * 0.06, 8, 8]} />
            <meshPhysicalMaterial color={color} roughness={0.85} transmission={0.08} />
          </mesh>
        );
      })}
      {/* top sphere */}
      <mesh position={[0, 0.88 * scale, 0]} castShadow>
        <sphereGeometry args={[0.22 * scale, 10, 10]} />
        <meshPhysicalMaterial color={color} roughness={0.82} transmission={0.1} />
      </mesh>
    </group>
  );
}

// ── Image billboard ───────────────────────────────────────────────────────────
function ImageBillboard({
  url,
  height,
  opacity,
  isActive,
}: {
  url: string;
  height: number;
  opacity: number;
  isActive: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const tex = loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        setTexture(t);
      },
      undefined,
      () => setTexture(null),
    );
    return () => tex?.dispose();
  }, [url]);

  if (!texture) return null;

  return (
    <Billboard position={[0, height, 0]}>
      {/* glow ring when active */}
      {isActive && (
        <mesh>
          <planeGeometry args={[1.02, 1.02]} />
          <meshBasicMaterial color="#86efac" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {/* photo plane */}
      <mesh>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          depthWrite={opacity > 0.8}
          alphaTest={0.05}
        />
      </mesh>
      {/* subtle shadow beneath image */}
      <mesh position={[0, -0.52, -0.01]}>
        <planeGeometry args={[0.88, 0.12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15 * opacity} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

// ── Compatibility badge ───────────────────────────────────────────────────────
function CompatBadge({
  plantReq,
  zoneReq,
}: {
  plantReq: LightReq;
  zoneReq: LightReq;
}) {
  const ok = plantReq === zoneReq || (plantReq === "partial_shade" && zoneReq !== "shade");
  const [texture] = useState(() => {
    const s = 64;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = ok ? "#22c55e" : "#ef4444";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${s * 0.45}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ok ? "✓" : "!", s / 2, s / 2 + 1);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  return (
    <Billboard position={[0.52, 1.28, 0]}>
      <mesh>
        <planeGeometry args={[0.28, 0.28]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

// ── Label billboard ───────────────────────────────────────────────────────────
function NameLabel({ name }: { name: string }) {
  const texture = useMemo(() => {
    const W = 256, H = 48;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(15,20,15,0.75)";
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
    ctx.arcTo(W, 0, W, r, r);
    ctx.lineTo(W, H - r);
    ctx.arcTo(W, H, W - r, H, r);
    ctx.lineTo(r, H);
    ctx.arcTo(0, H, 0, H - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.length > 18 ? name.slice(0, 16) + "…" : name, W / 2, H / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [name]);

  return (
    <Billboard position={[0, 0.06, 0]}>
      <mesh>
        <planeGeometry args={[1.1, 0.22]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

// ── Main placed plant ─────────────────────────────────────────────────────────
export function PlantSprite({
  plant,
  isGhost = false,
  isActive = false,
  zoneReq,
  onClick,
}: {
  plant: PlacedPlant | { commonName: string; species: string; imageUrl?: string; lightReq: LightReq };
  isGhost?: boolean;
  isActive?: boolean;
  zoneReq?: LightReq;
  onClick?: (e?: unknown) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * 100, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || isGhost) return;
    const t = clock.elapsedTime * 0.5 + phase;
    groupRef.current.rotation.z = Math.sin(t) * 0.018;
    groupRef.current.rotation.x = Math.sin(t * 0.7) * 0.008;
  });

  const opacity = isGhost ? 0.55 : 1;

  return (
    <group ref={groupRef} onClick={onClick}>
      <Pot r={0.22} />

      {plant.imageUrl ? (
        <ImageBillboard
          url={plant.imageUrl}
          height={0.76}
          opacity={opacity}
          isActive={isActive}
        />
      ) : (
        <group>
          <FallbackPlant lightReq={plant.lightReq} scale={0.9} />
        </group>
      )}

      {!isGhost && <NameLabel name={plant.commonName} />}

      {!isGhost && zoneReq && (
        <CompatBadge plantReq={plant.lightReq} zoneReq={zoneReq} />
      )}
    </group>
  );
}

// ── Ghost preview that follows cursor ─────────────────────────────────────────
export function GhostPlant({
  plant,
  position,
}: {
  plant: { commonName: string; species: string; imageUrl?: string; lightReq: LightReq };
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      {/* placement ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.34, 0.42, 32]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <PlantSprite plant={plant} isGhost />
    </group>
  );
}
