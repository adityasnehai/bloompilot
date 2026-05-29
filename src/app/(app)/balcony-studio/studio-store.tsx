"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type LightReq = "full_sun" | "partial_shade" | "shade";

export type PendingPlant = {
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: LightReq;
};

export type PlacedPlant = {
  id: string;
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: LightReq;
  x: number;
  z: number;
  rotation: number;
};

type StudioState = {
  placed: PlacedPlant[];
  pending: PendingPlant | null;
  activeId: string | null;
  sunHour: number;
  showZones: boolean;
  ghostPos: [number, number] | null;

  setPending: (p: PendingPlant | null) => void;
  placeAt: (x: number, z: number) => void;
  setActive: (id: string | null) => void;
  removePlant: (id: string) => void;
  setSunHour: (h: number) => void;
  toggleZones: () => void;
  setGhostPos: (pos: [number, number] | null) => void;
};

function createStudioStore() {
  return createStore<StudioState>((set, get) => ({
    placed: [],
    pending: null,
    activeId: null,
    sunHour: 12,
    showZones: true,
    ghostPos: null,

    setPending: (p) => set({ pending: p, activeId: null, ghostPos: null }),

    placeAt: (x, z) => {
      const { pending } = get();
      if (!pending) return;
      const id = `p${Date.now()}`;
      set((s) => ({
        placed: [...s.placed, { id, ...pending, x, z, rotation: Math.random() * Math.PI * 2 }],
        pending: null,
        ghostPos: null,
      }));
    },

    setActive: (id) => set({ activeId: id }),
    removePlant: (id) =>
      set((s) => ({ placed: s.placed.filter((p) => p.id !== id), activeId: null })),
    setSunHour: (h) => set({ sunHour: h }),
    toggleZones: () => set((s) => ({ showZones: !s.showZones })),
    setGhostPos: (pos) => set({ ghostPos: pos }),
  }));
}

const Ctx = createContext<StoreApi<StudioState> | null>(null);

export function StudioStoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<StoreApi<StudioState>>(null);
  if (!ref.current)
    (ref as { current: StoreApi<StudioState> }).current = createStudioStore();
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function useStudioStore<T>(sel: (s: StudioState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("Must be within StudioStoreProvider");
  return useStore(store, sel);
}

// ── Sun data ──────────────────────────────────────────────────────────────────
export function getSun(hour: number) {
  const t = Math.max(0, Math.min(1, (hour - 5.5) / 13));
  const angle = t * Math.PI;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  // Dawn in east (−X), noon overhead (high Y), dusk in west (+X)
  const norm: [number, number, number] = [-cosA * 0.85, Math.max(0.02, sinA), -0.45];
  const pos: [number, number, number] = [-cosA * 85, Math.max(2, sinA * 95), -45];
  const isDay = sinA > 0.06;
  const intensity = isDay ? Math.max(0.15, sinA) * 3.8 : 0;
  const color =
    t < 0.1 || t > 0.9
      ? "#ff7722"
      : t < 0.22 || t > 0.78
      ? "#ffcc55"
      : "#fff8ee";
  return { norm, pos, isDay, intensity, color };
}

// ── Zone utilities ────────────────────────────────────────────────────────────
// Balcony is 5.5 units deep. Front z=+2.75, back z=−2.75.
// Shadow from front railing depends on sun elevation.
export function getZoneSplit(hour: number) {
  const t = Math.max(0, Math.min(1, (hour - 5.5) / 13));
  const elevation = Math.sin(t * Math.PI); // 0 at edges, 1 at noon
  // fullSunFraction: fraction of balcony depth (from front) in direct sun
  const fullFrac = Math.max(0.1, 0.15 + elevation * 0.5);
  const partialFrac = Math.min(0.95, fullFrac + 0.28);
  return { fullFrac, partialFrac };
}

export function zoneAt(z: number, hour: number): LightReq {
  const HALF_D = 2.75;
  const fromFront = (HALF_D - z) / (HALF_D * 2); // 0=front, 1=back
  const { fullFrac, partialFrac } = getZoneSplit(hour);
  if (fromFront <= fullFrac) return "full_sun";
  if (fromFront <= partialFrac) return "partial_shade";
  return "shade";
}

export const ZONE_META: Record<LightReq, { label: string; color: string; emoji: string }> = {
  full_sun:      { label: "Full Sun",        color: "#ef4444", emoji: "☀️" },
  partial_shade: { label: "Partial Shade",   color: "#eab308", emoji: "⛅" },
  shade:         { label: "Low Light",       color: "#3b82f6", emoji: "🌑" },
};
