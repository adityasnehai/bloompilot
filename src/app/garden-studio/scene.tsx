"use client";

import { Suspense, useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls, Environment, ContactShadows,
  AdaptiveDpr, AdaptiveEvents, PerformanceMonitor,
} from "@react-three/drei";
import {
  EffectComposer, Vignette, SMAA,
  HueSaturation, BrightnessContrast, N8AO,
} from "@react-three/postprocessing";
import * as THREE from "three";
import {
  BalconyGeometry, TerraceGeometry, IndoorGeometry, BackyardGeometry,
  B, T, IND, BY,
} from "./geometry";
import { PlantSprite, GhostPlant } from "./sprites";
import { LightZones } from "./zones";
import { WateringEffortMap } from "./heatmap";
import { useStudio, zoneAt, GARDEN_DIMS } from "./store";
import type { PlacedPlant, CameraView } from "./store";

// ── Camera view presets ───────────────────────────────────────────────────────
const VIEW_POS: Record<string, Record<CameraView, [number, number, number]>> = {
  balcony: {
    orbit:  [0, 5,    9],
    front:  [0, 2.3,  8.6],
    top:    [0.01, 12.5, 0.4],
    corner: [7.6, 4.6, 7.6],
  },
  terrace: {
    orbit:  [0, 8,  13],
    front:  [0, 3,  13],
    top:    [0.01, 16, 0.5],
    corner: [10, 6, 10],
  },
  indoor: {
    orbit:  [0, 3.5,  7],
    front:  [0, 2,    7],
    top:    [0.01, 10, 0.3],
    corner: [5, 3.5,  5],
  },
  backyard: {
    orbit:  [0, 9,  15],
    front:  [0, 3.5, 15],
    top:    [0.01, 20, 0.5],
    corner: [10, 7,  10],
  },
};
const VIEW_TARGET: Record<CameraView, [number, number, number]> = {
  orbit:  [0, 1.0, -0.2],
  front:  [0, 1.25, 0],
  top:    [0, 0, -0.2],
  corner: [0, 1.0, -0.2],
};

function CameraRig() {
  const viewRequest = useStudio((s) => s.viewRequest);
  const gardenType  = useStudio((s) => s.gardenType);
  const { camera, controls } = useThree();
  const anim = useRef<{ active: boolean; t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (viewRequest.nonce === 0) return;
    const v = viewRequest.view;
    const ctrl = controls as unknown as { target: THREE.Vector3 } | null;
    anim.current = {
      active: true, t: 0,
      fromP: camera.position.clone(),
      toP: new THREE.Vector3(...(VIEW_POS[gardenType]?.[v] ?? VIEW_POS.balcony[v])),
      fromT: (ctrl?.target?.clone?.() ?? new THREE.Vector3(0, 1, -0.2)),
      toT: new THREE.Vector3(...VIEW_TARGET[v]),
    };
  }, [viewRequest, camera, controls, gardenType]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a?.active) return;
    a.t = Math.min(1, a.t + delta * 1.6);
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2; // easeInOut
    camera.position.lerpVectors(a.fromP, a.toP, e);
    const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (ctrl?.target) { ctrl.target.lerpVectors(a.fromT, a.toT, e); ctrl.update(); }
    if (a.t >= 1) a.active = false;
  });
  return null;
}

// ── Screenshot capture — listens for window event, downloads PNG ──────────────
function CaptureBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    function onCapture() {
      gl.render(scene, camera);
      requestAnimationFrame(() => {
        try {
          const url = gl.domElement.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `bloompilot-garden-${Date.now()}.png`;
          a.click();
        } catch { /* ignore */ }
      });
    }
    window.addEventListener("studio:capture", onCapture);
    return () => window.removeEventListener("studio:capture", onCapture);
  }, [gl, scene, camera]);
  return null;
}

// ── Background sphere with atmospheric gradient ───────────────────────────────
function SceneBackground() {
  const sunHour = useStudio((s) => s.sunHour);
  const isNight  = sunHour < 6.5 || sunHour > 19.5;
  const isGolden = sunHour < 9.5 || sunHour > 16.5;

  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    if (isNight) {
      g.addColorStop(0.0, "#0a0c18");
      g.addColorStop(0.5, "#070910");
      g.addColorStop(1.0, "#050608");
    } else if (isGolden) {
      g.addColorStop(0.0, "#1a1428");
      g.addColorStop(0.45, "#2c1a38");
      g.addColorStop(0.75, "#4a2420");
      g.addColorStop(1.0, "#2a1008");
    } else {
      g.addColorStop(0.0, "#0e1120");
      g.addColorStop(0.4, "#0c0f1c");
      g.addColorStop(0.75, "#121820");
      g.addColorStop(1.0, "#0a0c10");
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [isNight, isGolden]);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[95, 16, 10]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function KeyboardShortcuts() {
  const activeId   = useStudio((s) => s.activeId);
  const pending    = useStudio((s) => s.pending);
  const history    = useStudio((s) => s.history);
  const setPending = useStudio((s) => s.setPending);
  const setActive  = useStudio((s) => s.setActive);
  const remove     = useStudio((s) => s.removePlant);
  const duplicate  = useStudio((s) => s.duplicatePlant);
  const undo       = useStudio((s) => s.undo);
  const setComp    = useStudio((s) => s.setCompanionSpecies);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (pending) {
          setPending(null);
          setComp([]);
        } else {
          setActive(null);
        }
      }
      if (e.key === "Delete" && activeId) {
        e.preventDefault(); remove(activeId);
      }
      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey) && activeId) {
        e.preventDefault(); duplicate(activeId);
      }
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && history.length) {
        e.preventDefault(); undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, pending, history, setPending, setActive, remove, duplicate, undo, setComp]);

  return null;
}

// ── Floor grid ────────────────────────────────────────────────────────────────
function FloorGrid() {
  const ref        = useRef<THREE.GridHelper>(null);
  const gardenType = useStudio((s) => s.gardenType);
  const gw = gardenType === "terrace" ? T.w : gardenType === "indoor" ? IND.w : gardenType === "backyard" ? BY.w : B.w;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.LineBasicMaterial).opacity =
      0.12 + Math.sin(clock.elapsedTime * 1.5) * 0.03;
  });
  return (
    <gridHelper ref={ref} args={[gw, Math.floor(gw / 0.5), "#4ade80", "#4ade80"]} position={[0, 0.009, 0]}
      material-transparent material-opacity={0.12} />
  );
}

// ── Companion highlights ──────────────────────────────────────────────────────
function CompanionHighlights({ placed, species }: { placed: PlacedPlant[]; species: string[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = 0.5 + Math.sin(clock.elapsedTime * 1.8) * 0.5;
    ref.current.children.forEach((c) => {
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.28 + p * 0.22;
    });
  });
  const matches = useMemo(
    () => placed.filter((p) => species.some((s) =>
      p.species.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(p.species.toLowerCase())
    )),
    [placed, species],
  );
  if (!matches.length || !species.length) return null;
  return (
    <group ref={ref}>
      {matches.map((p) => (
        <mesh key={p.id} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.011, p.z]}>
          <ringGeometry args={[0.34, 0.56, 40]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

// ── Drop target ring ──────────────────────────────────────────────────────────
function DropRing({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.62 + Math.sin(clock.elapsedTime * 4) * 0.24;
      ref.current.scale.setScalar(0.94 + Math.sin(clock.elapsedTime * 3) * 0.05);
    }
    if (haloRef.current) {
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.04;
    }
  });
  return (
    <group position={[x, 0.012, z]}>
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.14, 0.34, 40]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.22, 36]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.035, 24]} />
        <meshBasicMaterial color="#dcfce7" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Drag system ───────────────────────────────────────────────────────────────
function DragLayer() {
  const isDraggingId = useStudio((s) => s.isDraggingId);
  const movePlant    = useStudio((s) => s.movePlant);
  const setDragging  = useStudio((s) => s.setDragging);
  const setGhost     = useStudio((s) => s.setGhostPos);
  const gardenType   = useStudio((s) => s.gardenType);
  const { raycaster, camera, gl } = useThree();
  const floorPlane   = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit          = useMemo(() => new THREE.Vector3(), []);
  const { halfW, halfD: hD } = GARDEN_DIMS[gardenType];
  const MAX_X        = halfW - 0.4;

  // Use a ref so onUp always reads the latest ghost position without
  // needing ghostPos in the effect deps (which would re-register
  // listeners on every single pointer-move pixel — very bad for perf).
  const ghostRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!isDraggingId) return;
    const canvas = gl.domElement;
    ghostRef.current = null;

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ), camera);
      if (raycaster.ray.intersectPlane(floorPlane, hit)) {
        const pos: [number, number] = [
          Math.max(-MAX_X, Math.min(MAX_X, hit.x)),
          Math.max(-hD + 0.2, Math.min(hD - 0.35, hit.z)),
        ];
        ghostRef.current = pos;
        setGhost(pos);
      }
    }

    function onUp() {
      const pos = ghostRef.current;
      if (pos && isDraggingId) movePlant(isDraggingId, pos[0], pos[1]);
      setDragging(null);
      setGhost(null);
      ghostRef.current = null;
      canvas.style.cursor = "";
    }

    // Listen on the window so releasing outside the canvas cannot leave the
    // studio stuck in a dragging state.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    window.addEventListener("pointercancel", onUp);
    canvas.style.cursor = "grabbing";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      window.removeEventListener("pointercancel", onUp);
      canvas.style.cursor = "";  // reset cursor even if unmounted mid-drag
    };
  // ghostPos intentionally excluded — use ghostRef instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggingId, camera, gl, raycaster, floorPlane, hit, movePlant, setDragging, setGhost, MAX_X]);

  return null;
}

// ── Floor interaction ─────────────────────────────────────────────────────────
function FloorInteraction() {
  const pending    = useStudio((s) => s.pending);
  const isDragging = useStudio((s) => s.isDraggingId);
  const ghostPos   = useStudio((s) => s.ghostPos);
  const placeAt    = useStudio((s) => s.placeAt);
  const setGhost   = useStudio((s) => s.setGhostPos);
  const setActive  = useStudio((s) => s.setActive);
  const gardenType = useStudio((s) => s.gardenType);
  const { halfW, halfD: hD } = GARDEN_DIMS[gardenType];
  const floorW = gardenType === "terrace" ? T.w : gardenType === "indoor" ? IND.w : gardenType === "backyard" ? BY.w : B.w;
  const floorD = gardenType === "terrace" ? T.d : gardenType === "indoor" ? IND.d : gardenType === "backyard" ? BY.d : B.d;
  const MAX_X      = halfW - 0.4;

  if (isDragging) return null;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}
        onPointerMove={(e) => {
          if (!pending) return;
          e.stopPropagation();
          setGhost([
            Math.max(-MAX_X, Math.min(MAX_X, e.point.x)),
            Math.max(-hD + 0.2, Math.min(hD - 0.35, e.point.z)),
          ]);
        }}
        onPointerLeave={() => pending && setGhost(null)}
        onClick={(e) => {
          if (!pending) { setActive(null); return; }
          e.stopPropagation();
          placeAt(Math.max(-MAX_X, Math.min(MAX_X, e.point.x)), Math.max(-hD + 0.2, Math.min(hD - 0.35, e.point.z)));
        }}
      >
        <planeGeometry args={[floorW, floorD]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {pending && ghostPos && <GhostPlant plant={pending} position={[ghostPos[0], 0, ghostPos[1]]} />}
    </>
  );
}

// ── Placed plants ─────────────────────────────────────────────────────────────
function PlacedPlants() {
  const placed       = useStudio((s) => s.placed);
  const activeId     = useStudio((s) => s.activeId);
  const isDraggingId = useStudio((s) => s.isDraggingId);
  const ghostPos     = useStudio((s) => s.ghostPos);
  const setActive    = useStudio((s) => s.setActive);
  const setDragging  = useStudio((s) => s.setDragging);
  const setHovered   = useStudio((s) => s.setHovered);
  const sunHour      = useStudio((s) => s.sunHour);
  const showZones    = useStudio((s) => s.showZones);
  const pending      = useStudio((s) => s.pending);
  const gardenType   = useStudio((s) => s.gardenType);
  const halfD        = GARDEN_DIMS[gardenType].halfD;

  return (
    <>
      {placed.map((plant) => {
        const draggingThis = isDraggingId === plant.id;
        const pos: [number, number, number] = draggingThis && ghostPos
          ? [ghostPos[0], 0, ghostPos[1]]
          : [plant.x, 0, plant.z];
        return (
          <group key={plant.id} position={pos}>
            <PlantSprite
              plant={plant}
              isActive={activeId === plant.id}
              isDragging={draggingThis}
              zoneReq={showZones ? zoneAt(plant.z, sunHour, halfD, gardenType) : undefined}
              onClick={() => {
                // onClick fires AFTER pointerUp; by this point isDraggingId is
                // already null (cleared by DragLayer.onUp), so draggingThis is
                // always false for a real click — safe to toggle selection here.
                if (draggingThis) return;
                setActive(activeId === plant.id ? null : plant.id);
              }}
              onPointerDown={(e) => {
                if (pending) return;
                (e as unknown as PointerEvent).stopPropagation?.();
                // Only start drag tracking here — selection is handled in onClick.
                // Setting activeId here caused a race where onClick fired with
                // activeId already set and immediately toggled it back to null.
                setDragging(plant.id);
              }}
              onPointerEnter={() => { if (!pending) { setHovered(plant.id); document.body.style.cursor = "grab"; } }}
              onPointerLeave={() => { setHovered(null); document.body.style.cursor = ""; }}
            />
          </group>
        );
      })}
      {isDraggingId && ghostPos && <DropRing x={ghostPos[0]} z={ghostPos[1]} />}
    </>
  );
}

// ── Lighting ──────────────────────────────────────────────────────────────────
function StudioLighting() {
  const sunHour  = useStudio((s) => s.sunHour);
  const isGolden = sunHour < 9.5 || sunHour > 16.5;
  const isNight  = sunHour < 6.5 || sunHour > 19.5;

  return (
    <>
      <ambientLight intensity={isNight ? 0.07 : isGolden ? 0.28 : 0.22} color={isNight ? "#182050" : "#fff8ee"} />
      <directionalLight
        position={[5, 8, 6]} castShadow
        intensity={isNight ? 0.55 : isGolden ? 2.6 : 2.0}
        color={isNight ? "#304080" : isGolden ? "#ffb050" : "#fff8ec"}
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} shadow-normalBias={0.02}
        shadow-camera-near={0.5} shadow-camera-far={32}
        shadow-camera-left={-7} shadow-camera-right={7}
        shadow-camera-top={5} shadow-camera-bottom={-3}
      />
      {/* Sky fill — subtle blue from above */}
      <directionalLight position={[0, 10, 0]} intensity={isNight ? 0.08 : 0.35} color={isNight ? "#0a1840" : "#b8d8f8"} />
      <directionalLight position={[-6, 5, 5]} intensity={isNight ? 0.15 : isGolden ? 0.9 : 0.6} color={isNight ? "#0a1030" : isGolden ? "#ffd090" : "#e8f0ff"} />
      <directionalLight position={[0, 3, -9]} intensity={isNight ? 0.25 : isGolden ? 1.1 : 0.7} color={isNight ? "#1e2850" : isGolden ? "#ff9030" : "#ffeedd"} />
      <pointLight position={[0, 0.3, 0]} intensity={isNight ? 0.05 : 0.35} color="#ede8de" distance={9} decay={2} />
      <pointLight position={[0, 2.4, -0.8]} intensity={isNight ? 1.6 : 0.5} color="#ffcc50" distance={5} decay={2} />
    </>
  );
}

// ── PostFX ────────────────────────────────────────────────────────────────────
function PostFX({ lowPerf }: { lowPerf: boolean }) {
  const sunHour  = useStudio((s) => s.sunHour);
  const isGolden = sunHour < 9.5 || sunHour > 16.5;
  const isNight  = sunHour < 6.5 || sunHour > 19.5;

  if (lowPerf) {
    return (
      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={4}>
      <SMAA />
      {/* Ambient occlusion — adds depth to corners and crevices */}
      <N8AO
        aoRadius={0.6}
        intensity={1.8}
        distanceFalloff={0.4}
        screenSpaceRadius
        halfRes
      />
      <HueSaturation hue={isGolden ? 0.015 : 0} saturation={isGolden ? 0.12 : isNight ? -0.16 : 0.06} />
      <BrightnessContrast brightness={isNight ? -0.03 : 0.01} contrast={0.06} />
      <Vignette offset={0.35} darkness={isNight ? 0.55 : 0.32} />
    </EffectComposer>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
function Scene({ lowPerf }: { lowPerf: boolean }) {
  const sunHour      = useStudio((s) => s.sunHour);
  const showZones    = useStudio((s) => s.showZones);
  const showHeatmap  = useStudio((s) => s.showHeatmap);
  const placed       = useStudio((s) => s.placed);
  const pending      = useStudio((s) => s.pending);
  const isDraggingId = useStudio((s) => s.isDraggingId);
  const companionSp  = useStudio((s) => s.companionSpecies);
  const gardenType   = useStudio((s) => s.gardenType);
  const isGolden     = sunHour < 9.5 || sunHour > 16.5;

  return (
    <>
      <SceneBackground />
      <Environment preset={isGolden ? "sunset" : "apartment"} background={false} />
      <StudioLighting />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.5}
        scale={gardenType === "backyard" ? 28 : gardenType === "terrace" ? 22 : 15}
        blur={2.8} far={4} color="#0c0e12" frames={1} />

      {gardenType === "terrace"  ? <TerraceGeometry />  :
       gardenType === "indoor"   ? <IndoorGeometry />   :
       gardenType === "backyard" ? <BackyardGeometry /> :
                                   <BalconyGeometry />  }
      <LightZones gardenType={gardenType} sunHour={sunHour} visible={showZones} />
      <WateringEffortMap plants={placed} visible={showHeatmap} />

      {(pending || isDraggingId) && <FloorGrid />}
      <CompanionHighlights placed={placed} species={companionSp} />
      <DragLayer />
      <FloorInteraction />
      <PlacedPlants />
      <CameraRig />
      <CaptureBridge />
      <PostFX lowPerf={lowPerf} />
    </>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────
export function BalconyCanvas() {
  const isDraggingId = useStudio((s) => s.isDraggingId);
  const pending      = useStudio((s) => s.pending);
  const gardenType   = useStudio((s) => s.gardenType);
  const [lowPerf, setLowPerf] = useState(false);
  const initPos =
    gardenType === "terrace"  ? [0, 8,   13] :
    gardenType === "indoor"   ? [0, 3.5,  7] :
    gardenType === "backyard" ? [0, 9,   15] :
                                [0, 5,    9];

  return (
    <Canvas
      shadows="percentage"
      camera={{ position: initPos as [number,number,number], fov: 50, near: 0.08, far: 200 }}
      gl={{
        antialias: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
      }}
      dpr={[1, 1.8]}
    >
      <PerformanceMonitor onDecline={() => setLowPerf(true)} onIncline={() => setLowPerf(false)} flipflops={3} threshold={0.9} />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />

      <Suspense fallback={null}>
        <Scene lowPerf={lowPerf} />
      </Suspense>

      <OrbitControls
        makeDefault
        enabled={!isDraggingId && !pending}
        enablePan={false}
        minDistance={4}
        maxDistance={gardenType === "backyard" ? 28 : gardenType === "terrace" ? 24 : gardenType === "indoor" ? 12 : 16}
        minPolarAngle={Math.PI / 10}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 1.0, -0.2]}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.75}
        zoomSpeed={0.9}
      />
      <KeyboardShortcuts />
    </Canvas>
  );
}
