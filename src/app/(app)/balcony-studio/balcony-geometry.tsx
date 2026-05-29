"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Dimensions ────────────────────────────────────────────────────────────────
export const B = {
  w: 10,
  d: 5.5,
  wallH: 2.8,
  sideH: 1.1,
  railH: 0.95,
  parapetH: 0.45,
} as const;

export const HALF_W = B.w / 2;
export const HALF_D = B.d / 2;

// ── Texture factories ─────────────────────────────────────────────────────────
function useTileTexture() {
  return useMemo(() => {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const TILE = S / 5;
    const PALETTE = ["#cc7a42", "#c06838", "#d48c5a", "#b86030", "#d0966e"];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * TILE, y = row * TILE;
        ctx.fillStyle = PALETTE[(row * 3 + col * 2 + (row % 2)) % PALETTE.length];
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);

        // Subtle surface texture
        for (let i = 0; i < 30; i++) {
          const tx = x + 5 + Math.random() * (TILE - 10);
          const ty = y + 5 + Math.random() * (TILE - 10);
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.07)";
          ctx.fillRect(tx, ty, TILE * 0.15, TILE * 0.04);
        }
        // Grout
        ctx.fillStyle = "#7a6858";
        ctx.fillRect(x, y, 3, TILE);
        ctx.fillRect(x, y, TILE, 3);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.8);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function useStuccoTexture(seed = 0) {
  return useMemo(() => {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ece6dc";
    ctx.fillRect(0, 0, S, S);
    const rng = (n: number) => Math.abs(Math.sin(n * 127.1 + seed * 31.7));
    for (let i = 0; i < 8000; i++) {
      const x = rng(i) * S, y = rng(i + 111) * S, r = rng(i + 222) * 2.5 + 0.3;
      const v = Math.floor(210 + rng(i + 333) * 45);
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.5, 1.8);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [seed]);
}

function useConcreteTexture() {
  return useMemo(() => {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c8c0b8";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = Math.floor(180 + Math.random() * 65);
      ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.fillRect(x, y, Math.random() * 3.5, Math.random() * 3.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function useBuildingTexture(cols: number, rows: number, base: string, seed: number) {
  return useMemo(() => {
    const CW = 256, CH = 512;
    const c = document.createElement("canvas");
    c.width = CW; c.height = CH;
    const ctx = c.getContext("2d")!;

    // Building face gradient
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, base);
    g.addColorStop(1, shadeHex(base, -20));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    const wx = CW / cols, wy = CH / rows;
    const rng = (n: number) => Math.abs(Math.sin(n * 127.1 + seed * 31.7));

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = rng(r * cols + col) > 0.38;
        const warm = rng(r * cols + col + 50) > 0.45;
        const color = lit
          ? warm ? "#ffe2a0" : "#c8d8ff"
          : rng(r * cols + col + 100) > 0.6 ? "#1a1a28" : "#0d0d18";
        ctx.fillStyle = color;
        ctx.fillRect(
          col * wx + wx * 0.14, r * wy + wy * 0.14,
          wx * 0.72, wy * 0.62
        );
        if (lit && warm) {
          ctx.fillStyle = "rgba(255,200,80,0.15)";
          ctx.fillRect(col * wx, r * wy, wx, wy);
        }
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [cols, rows, base, seed]);
}

function shadeHex(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Interior room (visible through glass door) ────────────────────────────────
function InteriorRoom() {
  const lampRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!lampRef.current) return;
    const m = lampRef.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 1.8 + Math.sin(clock.elapsedTime * 0.4) * 0.15;
  });

  return (
    <group position={[0, 0, -HALF_D - 0.15]}>
      {/* Interior back wall */}
      <mesh position={[0, B.wallH / 2, -3.0]}>
        <boxGeometry args={[B.w * 0.4, B.wallH, 0.12]} />
        <meshStandardMaterial color="#d8c8b0" roughness={0.9} />
      </mesh>
      {/* Interior floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.5]}>
        <planeGeometry args={[3.5, 3.0]} />
        <meshStandardMaterial color="#b08050" roughness={0.65} />
      </mesh>
      {/* Interior ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, B.wallH, -1.5]}>
        <planeGeometry args={[3.5, 3.0]} />
        <meshStandardMaterial color="#e0dcd6" roughness={0.95} />
      </mesh>
      {/* Pendant lamp */}
      <mesh ref={lampRef} position={[0, B.wallH - 0.55, -1.5]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#fffae0"
          emissive="#ffdd60"
          emissiveIntensity={1.8}
          roughness={0.2}
        />
      </mesh>
      {/* Lamp cord */}
      <mesh position={[0, B.wallH - 0.18, -1.5]}>
        <cylinderGeometry args={[0.008, 0.008, 0.7, 6]} />
        <meshStandardMaterial color="#333" roughness={0.9} />
      </mesh>
      {/* Sofa silhouette */}
      <mesh position={[0, 0.38, -2.5]} castShadow>
        <boxGeometry args={[1.8, 0.45, 0.65]} />
        <meshStandardMaterial color="#7a6a5a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.7, -2.72]}>
        <boxGeometry args={[1.8, 0.5, 0.2]} />
        <meshStandardMaterial color="#6a5a4a" roughness={0.9} />
      </mesh>
      {/* Plant on shelf */}
      <mesh position={[1.0, 0.75, -2.6]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.16, 10]} />
        <meshStandardMaterial color="#c04a10" roughness={0.8} />
      </mesh>
      <mesh position={[1.0, 1.05, -2.6]} castShadow>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#3a7a3a" roughness={0.85} />
      </mesh>
      {/* Interior warm light */}
      <pointLight
        position={[0, B.wallH - 0.58, -1.5]}
        intensity={4}
        color="#ffd070"
        distance={5}
        decay={2}
      />
    </group>
  );
}

// ── Apartment facade (back wall with glass door + windows) ────────────────────
function ApartmentFacade() {
  const stucco = useStuccoTexture(1);
  const DOOR_W = 1.8, DOOR_H = 2.2;
  const WIN_W = 1.1, WIN_H = 1.1, WIN_Y = 1.2;

  return (
    <group position={[0, 0, -HALF_D]}>
      {/* Side panels */}
      {[
        [-3.4, B.wallH / 2, 0, 3.0, B.wallH, 0.18],
        [3.4, B.wallH / 2, 0, 3.0, B.wallH, 0.18],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} receiveShadow castShadow>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial map={stucco} roughness={0.88} color="#e8e2d8" />
        </mesh>
      ))}

      {/* Horizontal band above windows */}
      <mesh position={[0, WIN_Y + WIN_H + 0.35, 0.04]} receiveShadow>
        <boxGeometry args={[B.w, B.wallH - WIN_Y - WIN_H - 0.35, 0.18]} />
        <meshStandardMaterial map={stucco} roughness={0.88} color="#e8e2d8" />
      </mesh>
      {/* Band below windows/door */}
      <mesh position={[0, 0.2, 0.04]}>
        <boxGeometry args={[B.w, 0.4, 0.18]} />
        <meshStandardMaterial map={stucco} roughness={0.88} color="#e0dad0" />
      </mesh>

      {/* Windows (left + right of door) */}
      {[-3.0, 3.0].map((wx, i) => (
        <group key={i} position={[wx, WIN_Y, 0]}>
          {/* Glass */}
          <mesh position={[0, WIN_H / 2, 0.1]}>
            <boxGeometry args={[WIN_W, WIN_H, 0.025]} />
            <meshPhysicalMaterial
              color="#b8d8ea"
              transmission={0.82}
              roughness={0.04}
              metalness={0.12}
              ior={1.52}
              transparent
              opacity={0.55}
              envMapIntensity={2}
            />
          </mesh>
          {/* Frame */}
          {[
            [0, -0.03, 0, WIN_W + 0.1, 0.06, 0.1],
            [0, WIN_H + 0.03, 0, WIN_W + 0.1, 0.06, 0.1],
            [-WIN_W / 2 - 0.03, WIN_H / 2, 0, 0.06, WIN_H + 0.1, 0.1],
            [WIN_W / 2 + 0.03, WIN_H / 2, 0, 0.06, WIN_H + 0.1, 0.1],
          ].map(([fx, fy, fz, fw, fh, fd], j) => (
            <mesh key={j} position={[fx as number, fy as number, fz as number]}>
              <boxGeometry args={[fw as number, fh as number, fd as number]} />
              <meshStandardMaterial color="#d8d0c8" roughness={0.7} metalness={0.1} />
            </mesh>
          ))}
          {/* Window sill */}
          <mesh position={[0, -0.06, 0.12]}>
            <boxGeometry args={[WIN_W + 0.2, 0.06, 0.24]} />
            <meshStandardMaterial color="#d0c8c0" roughness={0.75} />
          </mesh>
        </group>
      ))}

      {/* Sliding glass door (center) */}
      <group position={[0, 0, 0]}>
        {/* Left panel */}
        <mesh position={[-DOOR_W / 4, DOOR_H / 2, 0.1]}>
          <boxGeometry args={[DOOR_W / 2 - 0.04, DOOR_H, 0.025]} />
          <meshPhysicalMaterial
            color="#c0d8e8"
            transmission={0.9}
            roughness={0.03}
            metalness={0.1}
            ior={1.52}
            transparent
            opacity={0.45}
            envMapIntensity={2.5}
          />
        </mesh>
        {/* Right panel */}
        <mesh position={[DOOR_W / 4, DOOR_H / 2, 0.1]}>
          <boxGeometry args={[DOOR_W / 2 - 0.04, DOOR_H, 0.025]} />
          <meshPhysicalMaterial
            color="#c0d8e8"
            transmission={0.9}
            roughness={0.03}
            metalness={0.1}
            ior={1.52}
            transparent
            opacity={0.45}
            envMapIntensity={2.5}
          />
        </mesh>
        {/* Door frame */}
        {[
          [0, -0.03, 0, DOOR_W + 0.08, 0.06, 0.12],
          [0, DOOR_H + 0.03, 0, DOOR_W + 0.08, 0.06, 0.12],
          [-DOOR_W / 2 - 0.03, DOOR_H / 2, 0, 0.06, DOOR_H + 0.08, 0.12],
          [DOOR_W / 2 + 0.03, DOOR_H / 2, 0, 0.06, DOOR_H + 0.08, 0.12],
          [0.02, DOOR_H / 2, 0.1, 0.05, DOOR_H, 0.06], // center mullion
        ].map(([fx, fy, fz, fw, fh, fd], i) => (
          <mesh key={i} position={[fx as number, fy as number, fz as number]}>
            <boxGeometry args={[fw as number, fh as number, fd as number]} />
            <meshStandardMaterial color="#c8c0b8" roughness={0.6} metalness={0.15} />
          </mesh>
        ))}
        {/* Door handle */}
        <mesh position={[DOOR_W / 4 - 0.32, DOOR_H * 0.5, 0.16]}>
          <boxGeometry args={[0.025, 0.12, 0.025]} />
          <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* Pilasters on edges */}
      {[-HALF_W + 0.1, HALF_W - 0.1].map((px, i) => (
        <mesh key={i} position={[px, B.wallH / 2, 0.05]} castShadow>
          <boxGeometry args={[0.2, B.wallH, 0.28]} />
          <meshStandardMaterial color="#dcd6cc" roughness={0.85} />
        </mesh>
      ))}

      {/* Cornice */}
      <mesh position={[0, B.wallH - 0.04, 0.1]}>
        <boxGeometry args={[B.w + 0.1, 0.08, 0.3]} />
        <meshStandardMaterial color="#d8d2c8" roughness={0.8} />
      </mesh>

      {/* Interior room behind glass */}
      <InteriorRoom />
    </group>
  );
}

// ── Side walls ────────────────────────────────────────────────────────────────
function SideWalls() {
  const stucco = useStuccoTexture(2);
  return (
    <>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (HALF_W - 0.09), 0, 0]}>
          {/* Main side panel */}
          <mesh position={[0, B.sideH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[B.d, B.sideH, 0.18]} />
            <meshStandardMaterial map={stucco} roughness={0.88} color="#e4ded4" />
          </mesh>
          {/* Parapet cap */}
          <mesh position={[0, B.sideH + 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[B.d, 0.06, 0.25]} />
            <meshStandardMaterial color="#d4cec4" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Floor ─────────────────────────────────────────────────────────────────────
function Floor() {
  const tileTex = useTileTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[B.w, B.d, 2, 2]} />
      <meshStandardMaterial map={tileTex} roughness={0.72} metalness={0.06} color="#d8956a" />
    </mesh>
  );
}

// ── Railing ───────────────────────────────────────────────────────────────────
function Railing() {
  const concreteTex = useConcreteTexture();
  const POST_SPACING = 0.95;
  const POST_COUNT = Math.floor(B.w / POST_SPACING) + 1;
  const railH = B.railH - B.parapetH;

  return (
    <group position={[0, 0, HALF_D - 0.09]}>
      {/* Parapet base */}
      <mesh position={[0, B.parapetH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[B.w, B.parapetH, 0.18]} />
        <meshStandardMaterial map={concreteTex} roughness={0.82} color="#c8c0b8" />
      </mesh>
      {/* Horizontal bars */}
      {[0.2, 0.5, 0.78].map((frac, i) => (
        <mesh key={i} position={[0, B.parapetH + frac * railH, 0]} castShadow>
          <boxGeometry args={[B.w, 0.022, 0.022]} />
          <meshStandardMaterial color="#6a7888" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* Vertical posts */}
      {Array.from({ length: POST_COUNT }, (_, i) => {
        const x = -HALF_W + i * POST_SPACING;
        return (
          <mesh key={i} position={[x, B.parapetH + railH / 2, 0]} castShadow>
            <boxGeometry args={[0.022, railH, 0.022]} />
            <meshStandardMaterial color="#5a6878" roughness={0.35} metalness={0.75} />
          </mesh>
        );
      })}
      {/* Handrail cap */}
      <mesh position={[0, B.railH + 0.025, 0]} castShadow>
        <boxGeometry args={[B.w, 0.05, 0.14]} />
        <meshStandardMaterial map={concreteTex} roughness={0.72} color="#d0c8c0" />
      </mesh>
      {/* Corner posts */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HALF_W, B.parapetH + railH / 2, 0]} castShadow>
          <boxGeometry args={[0.045, railH, 0.045]} />
          <meshStandardMaterial color="#5a6878" roughness={0.35} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// ── String lights ─────────────────────────────────────────────────────────────
function StringLights() {
  const bulbRef = useRef<THREE.Group>(null);
  const BULB_SPACING = 0.8;
  const BULBS = Math.floor(B.w / BULB_SPACING);
  const SAG = 0.18;
  const HEIGHT = 2.55;

  useFrame(({ clock }) => {
    if (!bulbRef.current) return;
    bulbRef.current.children.forEach((child, i) => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m && m.emissive) {
        m.emissiveIntensity = 0.85 + Math.sin(clock.elapsedTime * 0.3 + i * 0.5) * 0.08;
      }
    });
  });

  return (
    <group>
      {/* Wire */}
      <mesh position={[0, HEIGHT, -HALF_D + 0.6]}>
        <boxGeometry args={[B.w, 0.008, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>
      {/* Bulbs with catenary sag */}
      <group ref={bulbRef}>
        {Array.from({ length: BULBS }, (_, i) => {
          const t = (i + 0.5) / BULBS;
          const x = -HALF_W + (i + 0.5) * BULB_SPACING;
          const y = HEIGHT - SAG * Math.sin(t * Math.PI) - 0.06;
          return (
            <mesh key={i} position={[x, y, -HALF_D + 0.6]} castShadow>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial
                color="#fffae0"
                emissive="#ffdd60"
                emissiveIntensity={0.85}
                roughness={0.15}
              />
            </mesh>
          );
        })}
      </group>
      {/* Point lights for glow (spread evenly) */}
      {[-HALF_W * 0.55, 0, HALF_W * 0.55].map((x, i) => (
        <pointLight
          key={i}
          position={[x, HEIGHT - 0.12, -HALF_D + 0.6]}
          intensity={0.9}
          color="#ffd860"
          distance={3.5}
          decay={2}
        />
      ))}
    </group>
  );
}

// ── Café table + chair ─────────────────────────────────────────────────────────
function CafeProps() {
  const tableX = 3.5, tableZ = 1.5;
  const TABLE_R = 0.38, TABLE_H = 0.72;

  return (
    <group>
      {/* Table top */}
      <mesh position={[tableX, TABLE_H, tableZ]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.04, 24]} />
        <meshStandardMaterial color="#d0c4a0" roughness={0.65} />
      </mesh>
      {/* Table rim */}
      <mesh position={[tableX, TABLE_H - 0.02, tableZ]}>
        <torusGeometry args={[TABLE_R, 0.018, 8, 24]} />
        <meshStandardMaterial color="#a09070" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Table stem */}
      <mesh position={[tableX, TABLE_H / 2, tableZ]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, TABLE_H, 8]} />
        <meshStandardMaterial color="#888" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Base */}
      <mesh position={[tableX, 0.025, tableZ]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
        <meshStandardMaterial color="#777" roughness={0.45} metalness={0.6} />
      </mesh>

      {/* Chair */}
      {[{ x: tableX - 0.65, z: tableZ - 0.1, ry: 0.3 }].map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.ry, 0]}>
          {/* Seat */}
          <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.04, 0.42]} />
            <meshStandardMaterial color="#c8b890" roughness={0.7} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.78, -0.18]} castShadow>
            <boxGeometry args={[0.42, 0.55, 0.035]} />
            <meshStandardMaterial color="#c0b088" roughness={0.7} />
          </mesh>
          {/* Backrest bar */}
          <mesh position={[0, 0.62, -0.175]}>
            <boxGeometry args={[0.38, 0.06, 0.025]} />
            <meshStandardMaterial color="#a09068" roughness={0.65} />
          </mesh>
          {/* Legs */}
          {[[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.16], [0.16, -0.16]].map(([lx, lz], j) => (
            <mesh key={j} position={[lx, 0.22, lz]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.44, 6]} />
              <meshStandardMaterial color="#888" roughness={0.4} metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Small espresso cup on table */}
      <mesh position={[tableX + 0.12, TABLE_H + 0.04, tableZ - 0.08]}>
        <cylinderGeometry args={[0.04, 0.03, 0.07, 10]} />
        <meshStandardMaterial color="#f0ece4" roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── Decorative fixed planter (tall ornamental grass, left side) ───────────────
function DecorativePlanter() {
  const bladeRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!bladeRef.current) return;
    const t = clock.elapsedTime;
    bladeRef.current.rotation.z = Math.sin(t * 0.9) * 0.04;
    bladeRef.current.rotation.x = Math.sin(t * 0.7) * 0.02;
  });

  return (
    <group position={[-3.8, 0, -0.8]}>
      {/* Large terracotta planter */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.7, 16]} />
        <meshStandardMaterial color="#b84010" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.28, 0.06, 16]} />
        <meshStandardMaterial color="#a03810" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 16]} />
        <meshStandardMaterial color="#2a1a0e" roughness={1} />
      </mesh>
      {/* Ornamental grass blades */}
      <group ref={bladeRef}>
        {Array.from({ length: 22 }, (_, i) => {
          const angle = (i / 22) * Math.PI * 2;
          const r = 0.08 + Math.random() * 0.12;
          const h = 0.8 + Math.random() * 0.6;
          const lean = 0.25 + Math.random() * 0.35;
          return (
            <mesh
              key={i}
              position={[Math.sin(angle) * r, 0.75 + h * 0.5, Math.cos(angle) * r]}
              rotation={[lean * Math.sin(angle + Math.PI), 0, lean * Math.cos(angle + Math.PI)]}
              castShadow
            >
              <boxGeometry args={[0.022, h, 0.009]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#5a9a4a" : i % 3 === 1 ? "#4a8a3a" : "#6aaa5a"}
                roughness={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ── City skyline backdrop ─────────────────────────────────────────────────────
type BuildingDef = {
  x: number; z: number; w: number; h: number; d: number;
  cols: number; rows: number; base: string; seed: number;
};

const BUILDINGS: BuildingDef[] = [
  { x: -12, z: -14, w: 4.5, h: 11, d: 3.0, cols: 4, rows: 8,  base: "#4a5060", seed: 1  },
  { x: -5,  z: -18, w: 3.8, h: 16, d: 2.5, cols: 3, rows: 12, base: "#3a4050", seed: 2  },
  { x:  3,  z: -12, w: 5.0, h:  8, d: 3.5, cols: 5, rows: 6,  base: "#556070", seed: 3  },
  { x: 10,  z: -16, w: 4.0, h: 13, d: 3.0, cols: 4, rows: 10, base: "#48586a", seed: 4  },
  { x: 18,  z: -14, w: 3.5, h: 10, d: 2.8, cols: 3, rows: 8,  base: "#404858", seed: 5  },
  { x: -18, z: -10, w: 3.2, h:  7, d: 2.5, cols: 3, rows: 5,  base: "#505a6a", seed: 6  },
  { x:  0,  z: -22, w: 6.0, h: 18, d: 4.0, cols: 5, rows: 14, base: "#384048", seed: 7  },
  { x: -8,  z: -8,  w: 2.8, h:  6, d: 2.0, cols: 3, rows: 4,  base: "#586070", seed: 8  },
  { x: 14,  z: -10, w: 3.0, h:  9, d: 2.2, cols: 3, rows: 7,  base: "#465060", seed: 9  },
  { x: -22, z: -18, w: 5.0, h: 14, d: 3.5, cols: 4, rows: 11, base: "#3c4852", seed: 10 },
  { x: 22,  z: -20, w: 4.5, h: 12, d: 3.0, cols: 4, rows: 9,  base: "#445058", seed: 11 },
  { x:  7,  z: -28, w: 3.5, h: 22, d: 2.8, cols: 3, rows: 16, base: "#303840", seed: 12 },
];

function Building({ def }: { def: BuildingDef }) {
  const tex = useBuildingTexture(def.cols, def.rows, def.base, def.seed);
  return (
    <mesh position={[def.x, def.h / 2, def.z]} castShadow receiveShadow>
      <boxGeometry args={[def.w, def.h, def.d]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.75}
        metalness={0.08}
        color="#aabbc8"
      />
    </mesh>
  );
}

function CityBackdrop() {
  // Ground plane extending into the city
  return (
    <group>
      {/* Street-level ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -15]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.95} />
      </mesh>
      {/* Buildings */}
      {BUILDINGS.map((def) => (
        <Building key={def.seed} def={def} />
      ))}
      {/* Distant haze plane */}
      <mesh position={[0, 8, -35]}>
        <planeGeometry args={[80, 30]} />
        <meshStandardMaterial color="#6888a0" transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Soffit (ceiling) ──────────────────────────────────────────────────────────
function Soffit() {
  return (
    <group>
      {/* Ceiling */}
      <mesh position={[0, B.wallH, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[B.w + 0.15, B.d + 0.3]} />
        <meshStandardMaterial color="#ddd8d0" roughness={0.95} side={THREE.BackSide} />
      </mesh>
      {/* Ceiling edge beam */}
      <mesh position={[0, B.wallH - 0.04, HALF_D - 0.14]} castShadow>
        <boxGeometry args={[B.w + 0.15, 0.08, 0.28]} />
        <meshStandardMaterial color="#d0ccc4" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ── Drain ─────────────────────────────────────────────────────────────────────
function Drain() {
  return (
    <mesh position={[0, 0.004, HALF_D - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[B.w, 0.1]} />
      <meshStandardMaterial color="#5a4a3a" roughness={0.95} />
    </mesh>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function BalconyGeometry() {
  return (
    <group>
      <Floor />
      <ApartmentFacade />
      <SideWalls />
      <Railing />
      <Soffit />
      <Drain />
      <StringLights />
      <CafeProps />
      <DecorativePlanter />
      <CityBackdrop />
    </group>
  );
}
