"use client";

import { Suspense, lazy, useEffect, useRef } from "react";
import { StudioProvider, useStudio, type PlacedPlant, type GardenTypeStudio } from "./store";
import { TopBar, LeftPanel, RightPanel, BottomBar, WelcomeOverlay, GlobalStyles } from "./ui";

const BalconyCanvas = lazy(() =>
  import("./scene").then((m) => ({ default: m.BalconyCanvas }))
);

function Loader({ message = "Building your garden…" }: { message?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050c09]">
      <div className="mb-6 text-5xl" style={{ animation: "float 2s ease-in-out infinite" }}>🌿</div>
      <div className="relative h-0.5 w-48 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-emerald-400/60" style={{ animation: "shimmer 1.8s ease-in-out infinite" }} />
      </div>
      <p className="mt-5 text-sm text-white/30">{message}</p>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes shimmer { 0%{width:0;margin-left:0} 50%{width:55%;margin-left:22%} 100%{width:0;margin-left:100%} }
      `}</style>
    </div>
  );
}

// ── Auto-save placed plants to the server (debounced 2s) ──────────────────────
function AutoSave() {
  const placed      = useStudio((s) => s.placed);
  const gardenType  = useStudio((s) => s.gardenType);
  const syncReady   = useStudio((s) => s.syncReady);
  const setSync     = useStudio((s) => s.setSyncState);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef  = useRef<AbortController | null>(null);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!syncReady) {
      baselineRef.current = null;
      return;
    }
    const snapshot = JSON.stringify({ gardenType, placed });
    if (baselineRef.current === null) {
      baselineRef.current = snapshot;
      return;
    }
    if (baselineRef.current === snapshot) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current?.abort();
    setSync("saving");
    timerRef.current = setTimeout(async () => {
      const persisted = placed.filter((plant) => plant.plantId);
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const response = await fetch("/api/garden-studio/layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gardenType,
            plants: persisted.map((plant) => ({
              plantId: plant.plantId,
              imageUrl: plant.imageUrl,
              lightReq: plant.lightReq,
              waterDays: plant.waterDays,
              x: plant.x,
              z: plant.z,
              rotation: plant.rotation,
            })),
          }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as { saved?: number; savedAt?: string } | null;
        if (!response.ok || data?.saved !== persisted.length) throw new Error("Layout save failed");
        baselineRef.current = snapshot;
        setSync(persisted.length === placed.length ? "saved" : "local", { savedAt: data.savedAt ?? new Date().toISOString() });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSync("error");
      }
    }, 900);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      requestRef.current?.abort();
    };
  }, [placed, gardenType, syncReady, setSync]);

  return null;
}

// ── Load layout from server on mount, then switch types on demand ─────────────
function ServerLayoutSync() {
  const gardenType  = useStudio((s) => s.gardenType);
  const initPlaced  = useStudio((s) => s.initPlaced);
  const restoreLocal = useStudio((s) => s.restoreLocal);
  const setSync     = useStudio((s) => s.setSyncState);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/garden-studio/layout?gardenType=${gardenType}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Layout request failed (${r.status})`);
        return r.json();
      })
      .then((data: { plants?: (PlacedPlant & { plantId?: string })[]; savedAt?: string | null } | null) => {
        if (cancelled) return;
        if (data?.savedAt && data.plants && Array.isArray(data.plants)) {
          initPlaced(
            data.plants.map((plant) => ({ ...plant, id: plant.id || plant.plantId || crypto.randomUUID() })),
            gardenType as GardenTypeStudio,
          );
          setSync("saved", { ready: true, savedAt: data.savedAt });
        } else {
          restoreLocal(gardenType as GardenTypeStudio);
          setSync("local", { ready: true, savedAt: null });
        }
      })
      .catch(() => {
        // Keep the local layout usable when the server is unavailable.
        // A failed sync must not replace a user's working canvas with an empty one.
        if (cancelled) return;
        restoreLocal(gardenType as GardenTypeStudio);
        setSync("error", { ready: true, savedAt: null });
      });
    return () => {
      cancelled = true;
    };
  // Re-run when gardenType changes (user switches environment)
  }, [gardenType, initPlaced, restoreLocal, setSync]);

  return null;
}

// ── Main studio — wrapped inside StudioProvider so hooks work ─────────────────
function StudioInner() {
  return (
    <>
      <GlobalStyles />
      <div className="studio-ui fixed inset-0 overflow-hidden bg-[#050c09]">
        <Suspense fallback={<Loader />}>
          <BalconyCanvas />
        </Suspense>
        <TopBar />
        <LeftPanel />
        <RightPanel />
        <BottomBar />
        <WelcomeOverlay />
        <AutoSave />
        <ServerLayoutSync />
      </div>
    </>
  );
}

export function GardenStudio() {
  return (
    <StudioProvider>
      <StudioInner />
    </StudioProvider>
  );
}
