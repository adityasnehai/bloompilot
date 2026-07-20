"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";
import type { PlacedPlant, LightReq } from "./store";
import { ZONE_META, getCareScore } from "./store";

// ── Garden wire stake ─────────────────────────────────────────────────────────
// A thin painted-metal stake pressed into the balcony floor.
// Replaces the pot — cleaner, matches the label-card visual above.
const STAKE_H = 0.46;

function Stake() {
  return (
    <group>
      {/* Ground anchor disc — slight soil impression */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <circleGeometry args={[0.046, 20]} />
        <meshStandardMaterial color="#1a2a1c" roughness={1} />
      </mesh>

      {/* Main rod — tapers slightly toward the top */}
      <mesh position={[0, STAKE_H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.010, 0.014, STAKE_H, 8]} />
        <meshStandardMaterial color="#2f5e35" roughness={0.55} metalness={0.45} />
      </mesh>

      {/* Small flag / tab at top where the card visually "sits" */}
      <mesh position={[0, STAKE_H, 0]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshStandardMaterial color="#4a9a52" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

// ── Organic fallback plant ────────────────────────────────────────────────────
function stableUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function FallbackPlant({ plantKey, lightReq, scale = 1 }: { plantKey: string; lightReq: LightReq; scale?: number }) {
  const leafPhase = useMemo(() => Array.from({ length: 8 }, (_, index) => stableUnit(`${plantKey}:leaf:${index}`) * Math.PI * 2), [plantKey]);
  const c1 = lightReq === "full_sun" ? "#2d7a28" : lightReq === "partial_shade" ? "#2a7a55" : "#1a5a40";
  const c2 = lightReq === "full_sun" ? "#4aaa3a" : lightReq === "partial_shade" ? "#3aaa70" : "#2a8060";

  const leaves = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2 + (i % 2) * 0.4,
    lean: 0.4 + (i % 3) * 0.18,
    height: scale * (0.5 + (i % 4) * 0.14),
    w: scale * (0.14 + (i % 2) * 0.06),
    l: scale * (0.22 + (i % 3) * 0.08),
  })), [scale]);

  return (
    <group>
      <mesh position={[0, scale * 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.038, scale * 0.76, 7]} />
        <meshStandardMaterial color="#5a7040" roughness={0.88} />
      </mesh>
      {leaves.map((lf, i) => (
        <group key={i}
          position={[Math.sin(lf.angle) * 0.06, lf.height * 0.85, Math.cos(lf.angle) * 0.06]}
          rotation={[lf.lean, lf.angle, leafPhase[i] * 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[lf.w, lf.l, 0.014]} />
            <meshPhysicalMaterial color={i % 2 === 0 ? c1 : c2} roughness={0.7} transmission={0.12} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <boxGeometry args={[0.008, lf.l * 0.9, 0.006]} />
            <meshStandardMaterial color="#5a7040" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, scale * 0.98, 0]} castShadow>
        <sphereGeometry args={[scale * 0.2, 10, 8]} />
        <meshPhysicalMaterial color={c2} roughness={0.75} transmission={0.1} />
      </mesh>
    </group>
  );
}

// ── Plant photo card ──────────────────────────────────────────────────────────
// Uses drei Html so the image is a real DOM <img> — same source as the search
// panel thumbnail, zero CORS issues, renders at exactly the searched image.
// Name strip pinned at top; card always faces the camera.
// Card is a proper Three.js plane — no DOM/Html, no z-index issues, natural depth.
// Image is loaded via /api/plant-image (same-origin proxy) so WebGL never hits CORS.
const CARD_W = 0.38;   // world units wide
const CARD_H = 0.46;   // world units tall (name strip + photo)
const CARD_Y  = STAKE_H + CARD_H / 2 + 0.02;  // center just above stake tip

function usePlantCardTexture(imageUrl: string, name: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const PX = 128;             // canvas width in px
    const NAME_PX = 18;         // name strip height in px
    const IMG_PX = Math.round(PX * (CARD_H - NAME_PX / PX * CARD_W) / CARD_W);
    const TOTAL_H = NAME_PX + IMG_PX;

    const canvas = document.createElement("canvas");
    canvas.width  = PX;
    canvas.height = TOTAL_H;
    const ctx = canvas.getContext("2d")!;

    // Dark card background
    ctx.fillStyle = "#07120a";
    ctx.fillRect(0, 0, PX, TOTAL_H);

    // Name strip
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, PX, NAME_PX);

    const label = name.length > 16 ? name.slice(0, 16) + "…" : name;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `bold ${Math.round(NAME_PX * 0.62)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, PX / 2, NAME_PX / 2);

    // Divider
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, NAME_PX - 1, PX, 1);

    const commit = () => {
      if (cancelled) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture((prev) => { prev?.dispose(); return tex; });
    };

    // Load image via same-origin proxy
    const proxyUrl = `/api/plant-image?url=${encodeURIComponent(imageUrl)}`;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // Cover-crop into the image area
      const scale = Math.max(PX / img.width, IMG_PX / img.height);
      const sw = PX / scale, sh = IMG_PX / scale;
      const sx = (img.width  - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, NAME_PX, PX, IMG_PX);
      commit();
    };
    img.onerror = commit;   // show name-only card if image fails
    img.src = proxyUrl;

    return () => { cancelled = true; };
  }, [imageUrl, name]);

  return texture;
}

function PlantCard({ url, name, opacity }: { url: string; name: string; opacity: number }) {
  const texture = usePlantCardTexture(url, name);

  if (!texture) {
    // Thin placeholder while texture builds
    return (
      <Billboard position={[0, CARD_Y, 0]}>
        <mesh>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshBasicMaterial color="#0a1c0e" transparent opacity={opacity * 0.55} />
        </mesh>
      </Billboard>
    );
  }

  return (
    <Billboard position={[0, CARD_Y, 0]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[CARD_W + 0.045, CARD_H + 0.045]} />
        <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.12} depthWrite={false} />
      </mesh>
      {/* Thin border frame */}
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[CARD_W + 0.02, CARD_H + 0.02]} />
        <meshBasicMaterial color="#86efac" transparent opacity={opacity * 0.32} depthWrite={false} />
      </mesh>
      {/* Card face */}
      <mesh>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={opacity > 0.6} />
      </mesh>
    </Billboard>
  );
}

// ── Zone compat badge ─────────────────────────────────────────────────────────
// useMemo (not useState) so the texture re-derives when zone changes after a drag.
function CompatBadge({ plantReq, zoneReq }: { plantReq: LightReq; zoneReq: LightReq }) {
  const ok = plantReq === zoneReq;
  const tex = useMemo(() => {
    const s = 64; const c = document.createElement("canvas"); c.width = s; c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = ok ? "#22c55e" : "#172019";
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ok ? "#fff" : "#b7efbf"; ctx.font = `bold ${s * 0.45}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ok ? "✓" : "!", s / 2, s / 2 + 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [ok]);
  // Position: top-right corner of the card
  const badgeX = CARD_W / 2 + 0.08;
  const badgeY = CARD_Y + CARD_H / 2 + 0.08;
  return (
    <Billboard position={[badgeX, badgeY, 0]}>
      <mesh><planeGeometry args={[0.18, 0.18]} /><meshBasicMaterial map={tex} transparent depthWrite={false} /></mesh>
    </Billboard>
  );
}

// ── In-world HTML tooltip (drei Html) ────────────────────────────────────────
function PlantTooltip({ plant }: { plant: PlacedPlant }) {
  const score = getCareScore(plant);
  const careColor = score > 0.65 ? "#b7efbf" : score > 0.38 ? "#78d58a" : "#4f8b55";
  const dots = score > 0.65 ? "●●●" : score > 0.38 ? "●●○" : "●○○";

  return (
    <Html
      position={[CARD_W / 2 + 0.06, CARD_Y, 0]}
      distanceFactor={6}
      style={{ pointerEvents: "none" }}
      occlude
    >
      <div style={{
        background: "rgba(8,10,14,0.92)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "10px 12px",
        minWidth: 148,
        backdropFilter: "blur(16px)",
        fontFamily: "var(--font-sans-ui)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.2 }}>
          {plant.commonName}
        </p>
        <p style={{ margin: "2px 0 8px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
          {plant.species}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Row icon={ZONE_META[plant.lightReq].emoji} label={ZONE_META[plant.lightReq].label} />
          <Row icon="💧" label={`Every ${plant.waterDays}d`} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11 }}>🌿</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Watering frequency</span>
            <span style={{ fontSize: 11, color: careColor, fontFamily: "var(--font-mono-ui)", marginLeft: "auto" }}>{dots}</span>
          </div>
        </div>
        <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
          drag to move · del to remove
        </div>
      </div>
    </Html>
  );
}

function Row({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

// ── Active selection ring ─────────────────────────────────────────────────────
function SelectionRing({ isDragging }: { isDragging: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = isDragging ? 0.9 : 0.5 + Math.sin(clock.elapsedTime * 3) * 0.25;
    ref.current.scale.setScalar(isDragging ? 1.05 : 1 + Math.sin(clock.elapsedTime * 2) * 0.04);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <ringGeometry args={[0.09, 0.2, 36]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

// ── Main placed plant sprite ──────────────────────────────────────────────────
export function PlantSprite({
  plant,
  isGhost = false,
  isActive = false,
  isDragging = false,
  zoneReq,
  onClick,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  plant: PlacedPlant | PendingPlant;
  isGhost?: boolean;
  isActive?: boolean;
  isDragging?: boolean;
  zoneReq?: LightReq;
  onClick?: () => void;
  onPointerDown?: (e: THREE.Event) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  // Spring in on mount
  const { scale, posY } = useSpring({
    from: { scale: isGhost ? 1 : 0.01, posY: isGhost ? 0 : 0.6 },
    to:   { scale: 1, posY: 0 },
    config: { mass: 1.2, tension: 260, friction: 20 },
  });

  const isPlaced = "id" in plant;
  const opacity  = isGhost ? 0.55 : 1;

  const content = (
    <animated.group scale={scale} position-y={posY}>
      <Stake />
      {plant.imageUrl
        ? <PlantCard url={plant.imageUrl} name={plant.commonName} opacity={opacity} />
        : <FallbackPlant plantKey={"id" in plant ? plant.id : `${plant.species}:${plant.commonName}`} lightReq={plant.lightReq} scale={0.9} />
      }
      {!isGhost && isPlaced && <CompatBadge plantReq={plant.lightReq} zoneReq={zoneReq ?? plant.lightReq} />}
      {isActive && <SelectionRing isDragging={isDragging} />}
      {isActive && isPlaced && <PlantTooltip plant={plant as PlacedPlant} />}
    </animated.group>
  );

  return (
    <group
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {content}
    </group>
  );
}

type PendingPlant = {
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: LightReq;
  waterDays: number;
};

// ── Ghost ─────────────────────────────────────────────────────────────────────
export function GhostPlant({ plant, position }: { plant: PendingPlant; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.16;
  });
  return (
    <group position={position}>
      {/* Small drop-target ring around stake base */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.14, 0.28, 36]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <PlantSprite plant={plant} isGhost />
    </group>
  );
}
