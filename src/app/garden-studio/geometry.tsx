"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const B = {
  w: 11.0,
  d: 2.4,
  wallH: 2.6,
  railH: 1.05,
  parapetH: 0.12,
} as const;

export const HALF_W = B.w / 2;
export const HALF_D = B.d / 2;

// ── Textures ──────────────────────────────────────────────────────────────────
function useWarmTileTexture() {
  return useMemo(() => {
    const random = createSeededRandom(101);
    const S = 512, TILE = S / 4;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const shades = ["#ede8df", "#e8e2d8", "#f0ebe2", "#e5dfd5"];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * TILE, y = row * TILE;
        ctx.fillStyle = shades[(row + col) % shades.length];
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        // subtle diagonal shadow in corner for depth
        const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
        g.addColorStop(0, "rgba(0,0,0,0.03)");
        g.addColorStop(1, "rgba(0,0,0,0.0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = "rgba(160,148,130,0.04)";
          ctx.fillRect(x + 4 + random() * (TILE - 8), y + 4 + random() * (TILE - 8), TILE * 0.07, 1);
        }
        ctx.fillStyle = "#b8b0a4";
        ctx.fillRect(x, y, 2, TILE);
        ctx.fillRect(x, y, TILE, 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4.4, 1.4);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function useWallTexture(base = "#f8f4ee") {
  return useMemo(() => {
    const random = createSeededRandom(211);
    const S = 256;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      const v = 200 + Math.floor(random() * 48);
      ctx.fillStyle = `rgba(${v},${v - 6},${v - 14},0.045)`;
      ctx.fillRect(random() * S, random() * S, random() * 2.5, random() * 2.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3.5, 1.8);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [base]);
}

// ── Floor ─────────────────────────────────────────────────────────────────────
function Floor() {
  const tex = useWarmTileTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[B.w, B.d, 1, 1]} />
      <meshStandardMaterial map={tex} roughness={0.9} metalness={0.0} color="#ede8df" />
    </mesh>
  );
}

// ── Back wall with warm interior ──────────────────────────────────────────────
function BackWall() {
  const wallTex = useWallTexture("#dce8df");
  const DOOR_W = 1.6, DOOR_H = 2.1;
  const WIN_W = 0.9, WIN_H = 1.0, WIN_Y = 0.95;

  return (
    <group position={[0, 0, -HALF_D]}>
      {[[-3.8, B.wallH / 2, 0, 2.8, B.wallH, 0.2], [3.8, B.wallH / 2, 0, 2.8, B.wallH, 0.2]].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} receiveShadow>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial map={wallTex} roughness={0.88} color="#dce8df" />
        </mesh>
      ))}
      <mesh position={[0, B.wallH - 0.28, 0]} receiveShadow>
        <boxGeometry args={[B.w - 5.6, 0.56, 0.2]} />
        <meshStandardMaterial map={wallTex} roughness={0.88} color="#dce8df" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[B.w - 5.6, 0.24, 0.2]} />
        <meshStandardMaterial color="#b9cbbd" roughness={0.92} />
      </mesh>

      {/* Glass door — warm interior glow behind it */}
      <group>
        {/* Warm fill panel behind glass (simulates interior) */}
        <mesh position={[0, DOOR_H / 2, -0.18]}>
          <boxGeometry args={[DOOR_W - 0.05, DOOR_H - 0.05, 0.02]} />
          <meshStandardMaterial color="#bfe0c6" emissive="#94d7a0" emissiveIntensity={0.2} roughness={1} />
        </mesh>
        {[[-DOOR_W / 4, DOOR_H / 2, 0.06], [DOOR_W / 4, DOOR_H / 2, 0.06]].map(([px, py, pz], i) => (
          <mesh key={i} position={[px as number, py as number, pz as number]}>
            <boxGeometry args={[DOOR_W / 2 - 0.04, DOOR_H, 0.02]} />
            <meshPhysicalMaterial color="#b7d0c0" transmission={0.92} roughness={0.02} metalness={0.05} transparent opacity={0.45} />
          </mesh>
        ))}
        {[
          [0, -0.025, 0, DOOR_W + 0.06, 0.05, 0.1],
          [0, DOOR_H + 0.025, 0, DOOR_W + 0.06, 0.05, 0.1],
          [-DOOR_W / 2 - 0.025, DOOR_H / 2, 0, 0.05, DOOR_H + 0.06, 0.1],
          [DOOR_W / 2 + 0.025, DOOR_H / 2, 0, 0.05, DOOR_H + 0.06, 0.1],
          [0.01, DOOR_H / 2, 0.06, 0.038, DOOR_H, 0.04],
        ].map(([fx, fy, fz, fw, fh, fd], j) => (
          <mesh key={j} position={[fx as number, fy as number, fz as number]}>
            <boxGeometry args={[fw as number, fh as number, fd as number]} />
            <meshStandardMaterial color="#dce8dd" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        <mesh position={[DOOR_W / 4 - 0.28, DOOR_H * 0.5, 0.12]}>
          <boxGeometry args={[0.02, 0.1, 0.02]} />
          <meshStandardMaterial color="#b9c9bd" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Warm interior point light through door */}
        <pointLight position={[0, DOOR_H / 2, -0.5]} intensity={0.9} color="#ffd880" distance={3} decay={2} />
      </group>

      {/* Windows */}
      {[-2.6, 2.6].map((wx, i) => (
        <group key={i} position={[wx, WIN_Y, 0]}>
          <mesh position={[0, WIN_H / 2, -0.1]}>
            <boxGeometry args={[WIN_W - 0.06, WIN_H - 0.06, 0.02]} />
            <meshStandardMaterial color="#d8eee0" emissive="#b8dbbf" emissiveIntensity={0.12} roughness={1} />
          </mesh>
          <mesh position={[0, WIN_H / 2, 0.07]}>
            <boxGeometry args={[WIN_W, WIN_H, 0.018]} />
            <meshPhysicalMaterial color="#b7d0c0" transmission={0.88} roughness={0.04} transparent opacity={0.5} />
          </mesh>
          {[
            [0, -0.022, 0, WIN_W + 0.08, 0.044, 0.09],
            [0, WIN_H + 0.022, 0, WIN_W + 0.08, 0.044, 0.09],
            [-WIN_W / 2 - 0.022, WIN_H / 2, 0, 0.044, WIN_H + 0.06, 0.09],
            [WIN_W / 2 + 0.022, WIN_H / 2, 0, 0.044, WIN_H + 0.06, 0.09],
          ].map(([fx, fy, fz, fw, fh, fd], k) => (
            <mesh key={k} position={[fx as number, fy as number, fz as number]}>
              <boxGeometry args={[fw as number, fh as number, fd as number]} />
              <meshStandardMaterial color="#dce8dd" roughness={0.5} metalness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, -0.04, 0.12]}>
            <boxGeometry args={[WIN_W + 0.18, 0.045, 0.18]} />
            <meshStandardMaterial color="#d1ddd2" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, B.wallH - 0.03, 0.08]}>
        <boxGeometry args={[B.w + 0.1, 0.055, 0.18]} />
        <meshStandardMaterial color="#e7f0e7" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ── Side walls ────────────────────────────────────────────────────────────────
function SideWalls() {
  const tex = useWallTexture("#cbdacd");
  return (
    <>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (HALF_W - 0.11), 0, 0]}>
          <mesh position={[0, B.wallH * 0.42 / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
            <boxGeometry args={[B.d, B.wallH * 0.42, 0.22]} />
            <meshStandardMaterial map={tex} roughness={0.88} color="#cbdacd" />
          </mesh>
          <mesh position={[0, B.wallH * 0.42 + 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[B.d, 0.055, 0.28]} />
            <meshStandardMaterial color="#a9bcae" roughness={0.82} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Railing — instanced vertical bars ────────────────────────────────────────
function Railing() {
  const POST_SPACING = 0.42;
  const POST_COUNT   = Math.floor(B.w / POST_SPACING);
  const barH         = B.railH - B.parapetH;
  const instanceRef  = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!instanceRef.current) return;
    const mat = new THREE.Matrix4();
    for (let i = 0; i < POST_COUNT; i++) {
      mat.makeTranslation(-HALF_W + i * POST_SPACING + POST_SPACING / 2, 0, 0);
      instanceRef.current.setMatrixAt(i, mat);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
  }, [POST_COUNT]);

  return (
    <group position={[0, 0, HALF_D - 0.06]}>
      <mesh position={[0, B.parapetH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[B.w, B.parapetH, 0.16]} />
        <meshStandardMaterial color="#c5d5c8" roughness={0.88} />
      </mesh>
      <instancedMesh ref={instanceRef} args={[undefined, undefined, POST_COUNT]}
        position={[0, B.parapetH + barH / 2, 0]} castShadow>
        <boxGeometry args={[0.018, barH, 0.018]} />
        <meshStandardMaterial color="#6f8175" roughness={0.28} metalness={0.72} />
      </instancedMesh>
      {[0.22, 0.55, 0.88].map((frac, i) => (
        <mesh key={i} position={[0, B.parapetH + frac * barH, 0]} castShadow>
          <boxGeometry args={[B.w, 0.02, 0.02]} />
          <meshStandardMaterial color="#6f8175" roughness={0.25} metalness={0.78} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HALF_W, B.parapetH + barH / 2, 0]} castShadow>
          <boxGeometry args={[0.036, barH, 0.036]} />
          <meshStandardMaterial color="#6f8175" roughness={0.25} metalness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, B.railH + 0.022, 0]} castShadow>
        <boxGeometry args={[B.w + 0.04, 0.042, 0.075]} />
        <meshStandardMaterial color="#82978a" roughness={0.32} metalness={0.74} />
      </mesh>
    </group>
  );
}

// ── Ceiling ───────────────────────────────────────────────────────────────────
function Soffit() {
  return (
    <group>
      <mesh position={[0, B.wallH, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[B.w + 0.2, B.d + 0.3]} />
        <meshStandardMaterial color="#425247" roughness={0.95} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, B.wallH - 0.03, HALF_D - 0.1]} castShadow>
        <boxGeometry args={[B.w + 0.2, 0.055, 0.22]} />
        <meshStandardMaterial color="#8fa594" roughness={0.88} />
      </mesh>
    </group>
  );
}

function Drain() {
  return (
    <mesh position={[0, 0.003, HALF_D - 0.38]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[B.w, 0.07]} />
      <meshStandardMaterial color="#b8b4ae" roughness={0.95} />
    </mesh>
  );
}

// ── Corner wood shelf (left side, near back wall) ─────────────────────────────
function CornerShelf() {
  const woodTex = useMemo(() => {
    const random = createSeededRandom(307);
    const S = 256;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c4904a";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(${80 + random() * 40},${40 + random() * 20},${10},0.12)`;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, random() * S);
      ctx.lineTo(S, random() * S + (random() - 0.5) * 30);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const X = -HALF_W + 0.22;
  const Z = -HALF_D + 0.25;

  return (
    <group position={[X, 0, Z]}>
      {/* Shelf board */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.028, 0.32]} />
        <meshStandardMaterial map={woodTex} roughness={0.65} color="#c4904a" />
      </mesh>
      {/* Lower shelf */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.028, 0.32]} />
        <meshStandardMaterial map={woodTex} roughness={0.65} color="#c4904a" />
      </mesh>
      {/* Bracket left */}
      <mesh position={[-0.14, 0.91, 0]}>
        <boxGeometry args={[0.025, 0.4, 0.28]} />
        <meshStandardMaterial color="#b07838" roughness={0.7} />
      </mesh>
      {/* Bracket right */}
      <mesh position={[0.14, 0.91, 0]}>
        <boxGeometry args={[0.025, 0.4, 0.28]} />
        <meshStandardMaterial color="#b07838" roughness={0.7} />
      </mesh>
      {/* Small terra-cotta pot on shelf */}
      <mesh position={[0.05, 1.14, 0.04]} castShadow>
        <cylinderGeometry args={[0.048, 0.058, 0.09, 12]} />
        <meshStandardMaterial color="#b84010" roughness={0.78} />
      </mesh>
      <mesh position={[0.05, 1.2, 0.04]}>
        <cylinderGeometry args={[0.042, 0.046, 0.02, 12]} />
        <meshStandardMaterial color="#a03810" roughness={0.75} />
      </mesh>
      {/* Tiny succulent on it */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[0.05 + Math.cos(a) * 0.025, 1.24, 0.04 + Math.sin(a) * 0.025]} castShadow>
            <sphereGeometry args={[0.018, 5, 5]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7ac87a" : "#a8d870"} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Watering can prop ─────────────────────────────────────────────────────────
function WateringCan() {
  return (
    <group position={[HALF_W - 0.52, 0, HALF_D - 0.55]} rotation={[0, 0.6, 0]}>
      {/* Body */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.095, 0.28, 14]} />
        <meshStandardMaterial color="#6a9a78" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Top opening */}
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.055, 0.08, 0.035, 12]} />
        <meshStandardMaterial color="#5a8a68" roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Handle arch */}
      <mesh position={[0.1, 0.24, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <torusGeometry args={[0.08, 0.012, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#5a8a68" roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Spout */}
      <mesh position={[-0.14, 0.19, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.018, 0.032, 0.22, 8]} />
        <meshStandardMaterial color="#5a8a68" roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Spout head / rose */}
      <mesh position={[-0.24, 0.25, 0]} rotation={[0.5, 0, 0.35]}>
        <cylinderGeometry args={[0.028, 0.018, 0.04, 10]} />
        <meshStandardMaterial color="#4a7a58" roughness={0.55} metalness={0.35} />
      </mesh>
    </group>
  );
}

// ── Sky gradient visible through railing ──────────────────────────────────────
function SkyGradientPlane() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, "#b8cce8");
    g.addColorStop(0.4, "#d4e4f0");
    g.addColorStop(0.75, "#f0e8d8");
    g.addColorStop(1.0, "#f8e8c0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh position={[0, 2, HALF_D + 5]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[40, 16]} />
      <meshBasicMaterial map={tex} transparent opacity={0.5} depthWrite={false} side={THREE.FrontSide} />
    </mesh>
  );
}

// ── String lights ─────────────────────────────────────────────────────────────
function StringLights() {
  const ref  = useRef<THREE.Group>(null);
  const N    = 16, H = B.wallH - 0.12, SAG = 0.16, SPAN = B.w - 0.6;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.emissive) m.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 0.25 + i * 0.55) * 0.07;
    });
  });

  return (
    <group>
      <mesh position={[0, H, -HALF_D + 0.4]}>
        <boxGeometry args={[SPAN, 0.005, 0.005]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
      <group ref={ref}>
        {Array.from({ length: N }, (_, i) => {
          const t = (i + 0.5) / N;
          return (
            <mesh key={i} position={[-SPAN / 2 + t * SPAN, H - SAG * Math.sin(t * Math.PI) - 0.055, -HALF_D + 0.4]}>
              <sphereGeometry args={[0.038, 7, 7]} />
              <meshStandardMaterial color="#fff8e0" emissive="#ffd050" emissiveIntensity={0.9} roughness={0.18} />
            </mesh>
          );
        })}
      </group>
      {[-SPAN * 0.38, 0, SPAN * 0.38].map((x, i) => (
        <pointLight key={i} position={[x, H - 0.1, -HALF_D + 0.4]} intensity={0.5} color="#ffcc50" distance={3} decay={2} />
      ))}
    </group>
  );
}

// ── Terrace / Rooftop dimensions ──────────────────────────────────────────────
export const T = {
  w: 13.0,      // wider open platform
  d: 4.0,       // deeper than balcony
  parapetH: 0.55,
} as const;
export const TERRACE_HALF_W = T.w / 2;
export const TERRACE_HALF_D = T.d / 2;

// ── Concrete paver texture ────────────────────────────────────────────────────
function useConcreteTexture() {
  return useMemo(() => {
    const random = createSeededRandom(401);
    const S = 512, TILE = S / 5;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const shades = ["#9b9f99", "#929791", "#a4a7a0", "#898f89", "#979b95"];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * TILE, y = row * TILE;
        ctx.fillStyle = shades[(row * 5 + col) % shades.length];
        ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
        // grain/noise
        for (let i = 0; i < 60; i++) {
          const v = 125 + Math.floor(random() * 35);
          ctx.fillStyle = `rgba(${v},${v},${v},0.08)`;
          ctx.fillRect(x + 2 + random() * (TILE - 4), y + 2 + random() * (TILE - 4), random() * 4 + 1, 1);
        }
        // grout lines
        ctx.fillStyle = "#737873";
        ctx.fillRect(x, y, 1.5, TILE);
        ctx.fillRect(x, y, TILE, 1.5);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5.2, 2.0);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

// ── City skyline background ───────────────────────────────────────────────────
function CitySkyline() {
  const tex = useMemo(() => {
    const random = createSeededRandom(503);
    const W = 1024, H = 256;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;

    // Gradient sky backdrop
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#162133");
    sky.addColorStop(0.58, "#243a4a");
    sky.addColorStop(1, "#6b7d78");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Building silhouettes
    const rng = (n: number) => Math.floor(random() * n);
    // seed-like approach — deterministic look
    const buildings = [
      [0,    180, 55, H],  [50,   140, 40, H],  [85,   160, 50, H],
      [130,  100, 38, H],  [162,  120, 30, H],  [188,  85,  45, H],
      [228,  110, 35, H],  [258,  140, 55, H],  [308,  90,  40, H],
      [344,  65,  28, H],  [368,  95,  60, H],  [424,  75,  35, H],
      [454,  110, 45, H],  [494,  80,  35, H],  [526,  130, 50, H],
      [572,  95,  38, H],  [606,  60,  25, H],  [628,  90,  42, H],
      [666,  115, 50, H],  [712,  80,  32, H],  [740,  140, 55, H],
      [790,  100, 38, H],  [824,  70,  30, H],  [850,  120, 48, H],
      [893,  90,  35, H],  [924,  155, 60, H],  [980,  110, 44, H],
    ] as [number, number, number, number][];

    buildings.forEach(([x, y, w, h]) => {
      // building face
      ctx.fillStyle = `rgba(${32 + rng(18)},${44 + rng(18)},${51 + rng(20)},1)`;
      ctx.fillRect(x, y, w, h - y);
      // window lights — scattered warm dots
      for (let wx = x + 4; wx < x + w - 4; wx += 7) {
        for (let wy = y + 6; wy < h - 8; wy += 9) {
          if (random() > 0.55) {
            const bright = random() > 0.3;
            ctx.fillStyle = bright ? "rgba(255,226,166,0.8)" : "rgba(194,225,220,0.4)";
            ctx.fillRect(wx, wy, 4, 3);
          }
        }
      }
    });

    // Hazy glow on horizon
    const glow = ctx.createLinearGradient(0, H * 0.6, 0, H);
    glow.addColorStop(0, "rgba(50,80,140,0)");
    glow.addColorStop(1, "rgba(180,220,202,0.22)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh position={[0, 3.5, TERRACE_HALF_D + 18]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[80, 14]} />
      <meshBasicMaterial map={tex} transparent opacity={0.92} depthWrite={false} />
    </mesh>
  );
}

// ── Terrace parapet walls (all 4 sides, low) ──────────────────────────────────
function TerraceParapets() {
  const capping = "#a7ada7";
  const face    = "#777d78";

  return (
    <group>
      {/* Front parapet */}
      <mesh position={[0, T.parapetH / 2, TERRACE_HALF_D]} castShadow receiveShadow>
        <boxGeometry args={[T.w + 0.24, T.parapetH, 0.22]} />
        <meshStandardMaterial color={face} roughness={0.88} />
      </mesh>
      <mesh position={[0, T.parapetH + 0.025, TERRACE_HALF_D]}>
        <boxGeometry args={[T.w + 0.26, 0.05, 0.28]} />
        <meshStandardMaterial color={capping} roughness={0.72} />
      </mesh>

      {/* Back parapet */}
      <mesh position={[0, T.parapetH / 2, -TERRACE_HALF_D]} castShadow receiveShadow>
        <boxGeometry args={[T.w + 0.24, T.parapetH, 0.22]} />
        <meshStandardMaterial color={face} roughness={0.88} />
      </mesh>
      <mesh position={[0, T.parapetH + 0.025, -TERRACE_HALF_D]}>
        <boxGeometry args={[T.w + 0.26, 0.05, 0.28]} />
        <meshStandardMaterial color={capping} roughness={0.72} />
      </mesh>

      {/* Left parapet */}
      <mesh position={[-TERRACE_HALF_W, T.parapetH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, T.parapetH, T.d + 0.24]} />
        <meshStandardMaterial color={face} roughness={0.88} />
      </mesh>
      <mesh position={[-TERRACE_HALF_W, T.parapetH + 0.025, 0]}>
        <boxGeometry args={[0.28, 0.05, T.d + 0.26]} />
        <meshStandardMaterial color={capping} roughness={0.72} />
      </mesh>

      {/* Right parapet */}
      <mesh position={[TERRACE_HALF_W, T.parapetH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, T.parapetH, T.d + 0.24]} />
        <meshStandardMaterial color={face} roughness={0.88} />
      </mesh>
      <mesh position={[TERRACE_HALF_W, T.parapetH + 0.025, 0]}>
        <boxGeometry args={[0.28, 0.05, T.d + 0.26]} />
        <meshStandardMaterial color={capping} roughness={0.72} />
      </mesh>
    </group>
  );
}

// ── Rooftop access door / stairwell hatch ─────────────────────────────────────
function RooftopDoor() {
  const DOOR_W = 1.4, DOOR_H = 2.2, SURROUND = 0.18;
  const cx = -TERRACE_HALF_W + 1.8, cz = -TERRACE_HALF_D + 0.15;
  return (
    <group position={[cx, 0, cz]}>
      {/* Surround box */}
      <mesh position={[0, DOOR_H / 2 + 0.05, 0]} castShadow>
        <boxGeometry args={[DOOR_W + SURROUND * 2, DOOR_H + 0.1, SURROUND * 1.5]} />
        <meshStandardMaterial color="#737873" roughness={0.85} />
      </mesh>
      {/* Door panel */}
      <mesh position={[0, DOOR_H / 2, SURROUND * 0.5]}>
        <boxGeometry args={[DOOR_W, DOOR_H, 0.06]} />
        <meshStandardMaterial color="#343a37" roughness={0.6} metalness={0.45} />
      </mesh>
      {/* Handle */}
      <mesh position={[DOOR_W * 0.3, DOOR_H * 0.48, SURROUND * 0.5 + 0.05]}>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#b4b9b3" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Warm light leak under door */}
      <pointLight position={[0, 0.1, 0.3]} intensity={0.6} color="#ffcc60" distance={2.5} decay={2} />
    </group>
  );
}

// ── HVAC unit ─────────────────────────────────────────────────────────────────
function HVACUnit() {
  const cx = TERRACE_HALF_W - 1.2, cz = -TERRACE_HALF_D + 0.55;
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.6, 0.7]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Grille slats */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, 0.18 + i * 0.09, 0.36]}>
          <boxGeometry args={[0.82, 0.018, 0.018]} />
          <meshStandardMaterial color="#444" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
      {/* Fan ring */}
      <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.025, 6, 24]} />
        <meshStandardMaterial color="#666" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
}

// ── Rooftop drain / expansion joints ─────────────────────────────────────────
function TerraceDrain() {
  return (
    <>
      {/* Expansion joint lines across floor */}
      {[-2, 0, 2].map((z, i) => (
        <mesh key={i} position={[0, 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[T.w, 0.04]} />
          <meshStandardMaterial color="#737873" roughness={0.95} />
        </mesh>
      ))}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, T.d]} />
          <meshStandardMaterial color="#737873" roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

export function TerraceGeometry() {
  const tex = useConcreteTexture();
  return (
    <group>
      {/* Concrete paver floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[T.w, T.d]} />
        <meshStandardMaterial map={tex} roughness={0.92} color="#9b9f99" />
      </mesh>
      <TerraceDrain />
      <TerraceParapets />
      <RooftopDoor />
      <HVACUnit />
      <CitySkyline />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INDOOR GEOMETRY
// ═══════════════════════════════════════════════════════════════════
export const IND = { w: 7.6, d: 4.4, ceilH: 2.8 } as const;
export const INDOOR_HALF_W = IND.w / 2;
export const INDOOR_HALF_D = IND.d / 2;

function useHerringboneTexture() {
  return useMemo(() => {
    const S = 512;
    const c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const planks = ["#c4864a","#bb7e44","#c99050","#b87640","#d09458"];
    // Draw diagonal herringbone planks
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(Math.PI / 4); ctx.translate(-S, -S);
    const PW = 28, PH = 80;
    for (let col = -2; col < 6; col++) {
      for (let row = -2; row < 8; row++) {
        const x = col * PW * 2, y = row * PH;
        const shade = planks[(col * 3 + row * 2 + 7) % planks.length];
        ctx.fillStyle = shade; ctx.fillRect(x, y, PW - 2, PH - 2);
        ctx.fillStyle = shade; ctx.fillRect(x + PW, y + PH / 2, PW - 2, PH - 2);
        // wood grain lines
        ctx.strokeStyle = "rgba(80,40,10,0.08)"; ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
          ctx.beginPath(); ctx.moveTo(x + g * 7, y); ctx.lineTo(x + g * 7, y + PH - 2); ctx.stroke();
        }
      }
    }
    ctx.restore();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.8, 2.0); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
}

function IndoorFloor() {
  const tex = useHerringboneTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[IND.w, IND.d]} />
      <meshStandardMaterial map={tex} roughness={0.45} metalness={0.05} color="#c9884e" />
    </mesh>
  );
}

function IndoorWalls() {
  const wallColor = "#e8ede6"; // sage-tinged white
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, IND.ceilH / 2, -INDOOR_HALF_D]} receiveShadow>
        <boxGeometry args={[IND.w, IND.ceilH, 0.18]} />
        <meshStandardMaterial color={wallColor} roughness={0.92} />
      </mesh>
      {/* Side walls */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * INDOOR_HALF_W, IND.ceilH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <boxGeometry args={[IND.d, IND.ceilH, 0.18]} />
          <meshStandardMaterial color={wallColor} roughness={0.92} />
        </mesh>
      ))}
      {/* Ceiling */}
      <mesh position={[0, IND.ceilH, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[IND.w, IND.d]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.98} side={THREE.BackSide} />
      </mesh>
      {/* Skirting boards */}
      {[
        [0, 0.045, -INDOOR_HALF_D + 0.09, IND.w + 0.04, 0.09, 0.04],
        [-INDOOR_HALF_W + 0.09, 0.045, 0, 0.04, 0.09, IND.d + 0.04],
        [ INDOOR_HALF_W - 0.09, 0.045, 0, 0.04, 0.09, IND.d + 0.04],
      ].map(([x,y,z,w,h,d], i) => (
        <mesh key={i} position={[x as number,y as number,z as number]}>
          <boxGeometry args={[w as number,h as number,d as number]} />
          <meshStandardMaterial color="#ddd8ce" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function IndoorWindow() {
  const WIN_W = 3.2, WIN_H = 1.8, WIN_Y = 0.75;
  return (
    <group position={[0, WIN_Y, -INDOOR_HALF_D + 0.12]}>
      {/* Bright daylight fill behind glass */}
      <mesh position={[0, WIN_H / 2, -0.2]}>
        <boxGeometry args={[WIN_W - 0.1, WIN_H - 0.1, 0.02]} />
        <meshStandardMaterial color="#d8eeff" emissive="#b8daff" emissiveIntensity={0.6} roughness={1} />
      </mesh>
      {/* Glass pane (2 panels) */}
      {([-0.5, 0.5] as const).map((s, i) => (
        <mesh key={i} position={[s * WIN_W / 2, WIN_H / 2, 0]}>
          <boxGeometry args={[WIN_W / 2 - 0.04, WIN_H, 0.018]} />
          <meshPhysicalMaterial color="#c8dcf0" transmission={0.88} roughness={0.02} transparent opacity={0.45} />
        </mesh>
      ))}
      {/* Frame */}
      {[
        [0, -0.025, 0, WIN_W + 0.08, 0.05, 0.1],
        [0, WIN_H + 0.025, 0, WIN_W + 0.08, 0.05, 0.1],
        [-WIN_W / 2 - 0.025, WIN_H / 2, 0, 0.05, WIN_H + 0.06, 0.1],
        [ WIN_W / 2 + 0.025, WIN_H / 2, 0, 0.05, WIN_H + 0.06, 0.1],
        [0, WIN_H / 2, 0, 0.04, WIN_H, 0.06], // centre mullion
      ].map(([fx,fy,fz,fw,fh,fd], j) => (
        <mesh key={j} position={[fx as number, fy as number, fz as number]}>
          <boxGeometry args={[fw as number, fh as number, fd as number]} />
          <meshStandardMaterial color="#e0dbd2" roughness={0.55} metalness={0.1} />
        </mesh>
      ))}
      {/* Wide sill */}
      <mesh position={[0, -0.04, 0.14]}>
        <boxGeometry args={[WIN_W + 0.28, 0.05, 0.28]} />
        <meshStandardMaterial color="#e8e3d8" roughness={0.78} />
      </mesh>
      {/* Curtains */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * (WIN_W / 2 + 0.22), WIN_H / 2, 0.04]}>
          <mesh>
            <boxGeometry args={[0.28, WIN_H + 0.3, 0.02]} />
            <meshStandardMaterial color="#f0ece4" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Curtain rod */}
      <mesh position={[0, WIN_H + 0.2, 0.06]}>
        <cylinderGeometry args={[0.012, 0.012, WIN_W + 0.7, 8]} rotation-z={Math.PI / 2} />
        <meshStandardMaterial color="#a09590" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Sunlight streaming through */}
      <pointLight position={[0, WIN_H / 2, 0.5]} intensity={2.2} color="#fff4d0" distance={7} decay={1.8} />
      <directionalLight position={[0, WIN_H, 0.5]} intensity={0.8} color="#ffe8b0"
        target-position={[0, 0, 2]} castShadow shadow-mapSize={[512,512]} />
    </group>
  );
}

function TieredPlantStand() {
  const X = -INDOOR_HALF_W + 0.38, Z = -INDOOR_HALF_D + 0.38;
  const metalColor = "#2a2a2a";
  return (
    <group position={[X, 0, Z]}>
      {/* Three shelves at different heights */}
      {[0.28, 0.68, 1.10].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.38 - i * 0.05, 0.02, 0.32 - i * 0.04]} />
            <meshStandardMaterial color="#a06830" roughness={0.65} />
          </mesh>
          {/* Legs below each shelf */}
          {[[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]].map(([lx, lz], j) => (
            <mesh key={j} position={[lx, y / 2, lz]}>
              <cylinderGeometry args={[0.008, 0.008, y, 5]} />
              <meshStandardMaterial color={metalColor} roughness={0.3} metalness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Bookcase() {
  const X = INDOOR_HALF_W - 0.14, Z = 0;
  return (
    <group position={[X, 0, Z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Back panel */}
      <mesh position={[0, 0.8, -0.15]} receiveShadow>
        <boxGeometry args={[1.4, 1.6, 0.02]} />
        <meshStandardMaterial color="#9a6a30" roughness={0.75} />
      </mesh>
      {/* Sides */}
      {([-0.7, 0.7] as const).map((s) => (
        <mesh key={s} position={[s, 0.8, 0]} receiveShadow>
          <boxGeometry args={[0.04, 1.6, 0.3]} />
          <meshStandardMaterial color="#a87040" roughness={0.7} />
        </mesh>
      ))}
      {/* Shelves */}
      {[0, 0.5, 1.0, 1.52].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[1.44, 0.03, 0.3]} />
          <meshStandardMaterial color="#a87040" roughness={0.7} />
        </mesh>
      ))}
      {/* Books - coloured boxes */}
      {[
        [-0.28, 0.55, "#c04040", 0.06, 0.36],
        [-0.18, 0.55, "#2060a0", 0.05, 0.40],
        [-0.08, 0.55, "#208040", 0.07, 0.38],
        [ 0.02, 0.55, "#806020", 0.06, 0.34],
        [ 0.11, 0.55, "#603080", 0.05, 0.42],
        [-0.3,  1.05, "#204080", 0.06, 0.36],
        [-0.2,  1.05, "#804020", 0.07, 0.40],
        [-0.1,  1.05, "#206040", 0.05, 0.38],
        [ 0.0,  1.05, "#802040", 0.06, 0.35],
        [ 0.1,  1.05, "#404080", 0.07, 0.38],
      ].map(([bx, by, col, w, h], k) => (
        <mesh key={k} position={[bx as number, by as number + (h as number) / 2, -0.08]} castShadow>
          <boxGeometry args={[w as number, h as number, 0.19]} />
          <meshStandardMaterial color={col as string} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function CeilingLight() {
  return (
    <group position={[0, IND.ceilH - 0.02, -0.2]}>
      <mesh>
        <cylinderGeometry args={[0.14, 0.08, 0.22, 16]} />
        <meshStandardMaterial color="#e0ddd8" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color="#fffbe0" emissive="#ffe870" emissiveIntensity={1.2} roughness={0.1} />
      </mesh>
      <pointLight position={[0, -0.2, 0]} intensity={1.8} color="#fff4c0" distance={8} decay={1.6} />
    </group>
  );
}

export function IndoorGeometry() {
  return (
    <group>
      <IndoorFloor />
      <IndoorWalls />
      <IndoorWindow />
      <TieredPlantStand />
      <Bookcase />
      <CeilingLight />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACKYARD GEOMETRY
// ═══════════════════════════════════════════════════════════════════
export const BY = { w: 12.0, d: 6.4 } as const;
export const BACKYARD_HALF_W = BY.w / 2;
export const BACKYARD_HALF_D = BY.d / 2;

function useGrassTexture() {
  return useMemo(() => {
    const random = createSeededRandom(601);
    const S = 512;
    const c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4a7a28"; ctx.fillRect(0, 0, S, S);
    // Colour variation patches
    for (let i = 0; i < 300; i++) {
      const v = Math.floor(random() * 24) - 12;
      const r = 32 + v, g = 110 + v * 2, b = 20 + v;
      ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
      const px = random() * S, py = random() * S, pr = 10 + random() * 28;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
    // Short vertical stroke blades
    for (let i = 0; i < 2000; i++) {
      const x = random() * S, y = random() * S;
      const len = 3 + random() * 5;
      const shade = random() > 0.5 ? "rgba(80,140,40,0.25)" : "rgba(30,80,10,0.18)";
      ctx.strokeStyle = shade; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (random() - 0.5), y - len); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
}

function GrassGround() {
  const tex = useGrassTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[BY.w, BY.d]} />
      <meshStandardMaterial map={tex} roughness={0.96} color="#5a8a32" />
    </mesh>
  );
}

function GardenPath() {
  const tex = useMemo(() => {
    const random = createSeededRandom(701);
    const S = 256;
    const c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#8a7a6a"; ctx.fillRect(0, 0, S, S);
    // Gravel/stone pebbles
    for (let i = 0; i < 400; i++) {
      const x = random() * S, y = random() * S;
      const r = 2 + random() * 5;
      const v = 100 + Math.floor(random() * 50);
      ctx.fillStyle = `rgba(${v},${v-10},${v-20},0.7)`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.65, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[1.2, BY.d]} />
      <meshStandardMaterial map={tex} roughness={0.94} color="#9a8a7a" />
    </mesh>
  );
}

function RaisedBeds() {
  const soilTex = useMemo(() => {
    const random = createSeededRandom(809);
    const S = 256;
    const c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3a2010"; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 600; i++) {
      const v = 40 + Math.floor(random() * 30);
      ctx.fillStyle = `rgba(${v+10},${v},${v-10},0.5)`;
      ctx.fillRect(random() * S, random() * S, random() * 6 + 1, random() * 3 + 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);

  const BEDS: [number, number, number, number][] = [
    [-2.6, 1, 0, BY.d * 0.5],
    [ 2.6, 1, 0, BY.d * 0.5],
  ]; // [x, w, z, d]
  const BED_H = 0.28;

  return (
    <>
      {BEDS.map(([bx, bw, bz, bd], i) => (
        <group key={i} position={[bx, 0, bz]}>
          {/* Wooden frame sides */}
          {[
            [0,       BED_H/2,  bd/2,  bw,     BED_H, 0.06],
            [0,       BED_H/2, -bd/2,  bw,     BED_H, 0.06],
            [ bw/2,   BED_H/2,  0,     0.06,  BED_H, bd],
            [-bw/2,   BED_H/2,  0,     0.06,  BED_H, bd],
          ].map(([fx,fy,fz,fw,fh,fd],j) => (
            <mesh key={j} position={[fx as number,fy as number,fz as number]} castShadow receiveShadow>
              <boxGeometry args={[fw as number,fh as number,fd as number]} />
              <meshStandardMaterial color="#7a5030" roughness={0.82} />
            </mesh>
          ))}
          {/* Soil fill */}
          <mesh position={[0, BED_H, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
            <planeGeometry args={[bw - 0.08, bd - 0.08]} />
            <meshStandardMaterial map={soilTex} roughness={0.98} color="#3a2010" />
          </mesh>
          {/* Corner posts */}
          {[[-bw/2, bw/2], [-bd/2, bd/2]].reduce<[number,number][]>((acc, _, idx, arr) =>
            acc.concat(idx===0 ? [] : (arr[0] as number[]).flatMap(x => (arr[1] as number[]).map(z => [x,z] as [number,number]))), []
          ).map(([px, pz], k) => (
            <mesh key={k} position={[px, BED_H/2, pz]}>
              <boxGeometry args={[0.09, BED_H+0.04, 0.09]} />
              <meshStandardMaterial color="#5a3820" roughness={0.78} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function WoodenFence() {
  const POST_W = 0.055, RAIL_H = [0.4, 0.85] as const;
  const PLANK_H = 1.0;
  const fenceColor = "#c89a60";

  // Back fence
  const BACK_Z = -BACKYARD_HALF_D + 0.06;
  const BACK_POSTS = Math.floor(BY.w / 0.8);

  return (
    <group>
      {/* Back fence */}
      {Array.from({ length: BACK_POSTS + 1 }, (_, i) => {
        const x = -BACKYARD_HALF_W + i * (BY.w / BACK_POSTS);
        return (
          <mesh key={i} position={[x, PLANK_H / 2, BACK_Z]} castShadow>
            <boxGeometry args={[POST_W, PLANK_H + 0.1, POST_W]} />
            <meshStandardMaterial color="#a07840" roughness={0.85} />
          </mesh>
        );
      })}
      {/* Back fence rails */}
      {RAIL_H.map((h, i) => (
        <mesh key={i} position={[0, h, BACK_Z]} castShadow>
          <boxGeometry args={[BY.w, 0.04, POST_W]} />
          <meshStandardMaterial color={fenceColor} roughness={0.8} />
        </mesh>
      ))}
      {/* Back fence horizontal planks */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 0.1 + i * 0.135, BACK_Z + 0.03]} receiveShadow>
          <boxGeometry args={[BY.w, 0.11, 0.024]} />
          <meshStandardMaterial color={fenceColor} roughness={0.82} />
        </mesh>
      ))}
      {/* Side fences (left + right) */}
      {([-1, 1] as const).map((side) => {
        const fx = side * (BACKYARD_HALF_W - 0.06);
        const SIDE_POSTS = Math.floor(BY.d / 0.8);
        return (
          <group key={side}>
            {Array.from({ length: SIDE_POSTS + 1 }, (_, i) => {
              const z = -BACKYARD_HALF_D + i * (BY.d / SIDE_POSTS);
              return (
                <mesh key={i} position={[fx, PLANK_H / 2, z]} castShadow>
                  <boxGeometry args={[POST_W, PLANK_H + 0.1, POST_W]} />
                  <meshStandardMaterial color="#a07840" roughness={0.85} />
                </mesh>
              );
            })}
            {RAIL_H.map((h, i) => (
              <mesh key={i} position={[fx, h, 0]} castShadow>
                <boxGeometry args={[POST_W, 0.04, BY.d]} />
                <meshStandardMaterial color={fenceColor} roughness={0.8} />
              </mesh>
            ))}
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} position={[fx - side * 0.02, 0.1 + i * 0.135, 0]} receiveShadow>
                <boxGeometry args={[0.024, 0.11, BY.d]} />
                <meshStandardMaterial color={fenceColor} roughness={0.82} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Gate in back center */}
      <group position={[0, 0, BACK_Z + 0.05]}>
        <mesh position={[-0.42, 0.52, 0]}>
          <boxGeometry args={[0.78, 1.04, 0.04]} />
          <meshStandardMaterial color="#b08040" roughness={0.78} />
        </mesh>
        <mesh position={[0.42, 0.52, 0]}>
          <boxGeometry args={[0.78, 1.04, 0.04]} />
          <meshStandardMaterial color="#b08040" roughness={0.78} />
        </mesh>
        {/* Gate crossbars */}
        {([-0.42, 0.42] as const).map((gx, gi) => (
          [0.25, 0.52, 0.78].map((gy, gj) => (
            <mesh key={`${gi}-${gj}`} position={[gx, gy, 0.025]}>
              <boxGeometry args={[0.72, 0.04, 0.022]} />
              <meshStandardMaterial color="#c89040" roughness={0.75} />
            </mesh>
          ))
        ))}
        {/* Latch */}
        <mesh position={[0.06, 0.52, 0.06]}>
          <boxGeometry args={[0.12, 0.04, 0.04]} />
          <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

function TreesBackground() {
  const tex = useMemo(() => {
    const random = createSeededRandom(907);
    const W = 1024, H = 320;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#5090d8"); sky.addColorStop(0.5, "#78b0e8"); sky.addColorStop(1, "#b0d0f0");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Tree silhouettes
    const trees = [
      [0, 220, 70], [60, 200, 55], [110, 230, 80], [175, 210, 60],
      [225, 195, 50], [270, 220, 72], [340, 205, 58], [390, 225, 78],
      [455, 200, 55], [505, 215, 68], [565, 205, 60], [615, 220, 74],
      [680, 200, 58], [730, 215, 65], [790, 225, 75], [850, 205, 55],
      [900, 218, 62], [950, 200, 50], [985, 220, 70],
    ] as [number, number, number][];
    trees.forEach(([tx, ty, r]) => {
      // Trunk
      ctx.fillStyle = "#5a3a18";
      ctx.fillRect(tx + r * 0.42, ty, r * 0.16, H - ty);
      // Canopy layers (3 triangles offset)
      [[0, 0], [0.18, -20], [-0.18, -10]].forEach(([dx, dy]) => {
        ctx.fillStyle = `rgba(${30 + random()*20},${95+random()*25},${25+random()*20},${0.75+random()*0.2})`;
        ctx.beginPath();
        ctx.moveTo(tx + r * 0.5 + dx * r, ty + dy);
        ctx.lineTo(tx, ty + r * 1.3 + dy);
        ctx.lineTo(tx + r, ty + r * 1.3 + dy);
        ctx.closePath(); ctx.fill();
      });
    });
    // Hedge at base
    const hg = ctx.createLinearGradient(0, H * 0.75, 0, H);
    hg.addColorStop(0, "#3a7020"); hg.addColorStop(1, "#2a5818");
    ctx.fillStyle = hg; ctx.fillRect(0, H * 0.78, W, H);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <mesh position={[0, 2.5, -BACKYARD_HALF_D - 16]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[80, 14]} />
      <meshBasicMaterial map={tex} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

function GardenShed() {
  const X = BACKYARD_HALF_W - 1.4, Z = -BACKYARD_HALF_D + 1.0;
  return (
    <group position={[X, 0, Z]}>
      {/* Walls */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 2.2, 1.4]} />
        <meshStandardMaterial color="#8a6a40" roughness={0.85} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 2.4, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[2.0, 0.14, 1.6]} />
        <meshStandardMaterial color="#5a4028" roughness={0.9} />
      </mesh>
      {/* Pitched gable extension */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[0, 2.55, s * 0.82]} rotation={[s * 0.38, 0, 0]}>
          <boxGeometry args={[2.0, 0.12, 0.82]} />
          <meshStandardMaterial color="#5a4028" roughness={0.9} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0, 0.95, 0.71]}>
        <boxGeometry args={[0.68, 1.9, 0.04]} />
        <meshStandardMaterial color="#6a5030" roughness={0.78} />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.25, 0.95, 0.74]}>
        <sphereGeometry args={[0.04, 6, 5]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Small window */}
      <mesh position={[-0.5, 1.4, 0.71]}>
        <boxGeometry args={[0.4, 0.38, 0.04]} />
        <meshPhysicalMaterial color="#c8dcf0" transmission={0.8} roughness={0.05} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function BirdbathProp() {
  return (
    <group position={[BACKYARD_HALF_W - 2.6, 0, BACKYARD_HALF_D - 1.0]}>
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.04, 0.06, 20]} />
        <meshStandardMaterial color="#b0b0b0" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.1, 8]} />
        <meshStandardMaterial color="#a8a8a8" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.06, 14]} />
        <meshStandardMaterial color="#a0a0a0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.71, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.22, 20]} />
        <meshStandardMaterial color="#6090b8" roughness={0.08} metalness={0.1} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export function BackyardGeometry() {
  return (
    <group>
      <GrassGround />
      <GardenPath />
      <RaisedBeds />
      <WoodenFence />
      <GardenShed />
      <BirdbathProp />
      <TreesBackground />
    </group>
  );
}

export function BalconyGeometry() {
  return (
    <group>
      <Floor />
      <BackWall />
      <SideWalls />
      <Railing />
      <Soffit />
      <Drain />
      <CornerShelf />
      <WateringCan />
      <StringLights />
      <SkyGradientPlane />
    </group>
  );
}
