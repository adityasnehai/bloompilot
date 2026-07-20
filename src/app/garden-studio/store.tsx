"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type LightReq = "full_sun" | "partial_shade" | "shade";

export type PendingPlant = {
  plantId?: string;
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: LightReq;
  waterDays: number;
};

export type PlacedPlant = {
  id: string;
  plantId?: string;
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: LightReq;
  waterDays: number;
  x: number;
  z: number;
  rotation: number;
};

export type CameraView    = "orbit" | "front" | "top" | "corner";
export type GardenTypeStudio = "balcony" | "terrace" | "indoor" | "backyard";
export type StudioSyncStatus = "loading" | "saving" | "saved" | "local" | "error";

export const GARDEN_DIMS: Record<GardenTypeStudio, { halfW: number; halfD: number }> = {
  balcony:  { halfW: 5.5, halfD: 1.2 },
  terrace:  { halfW: 6.5, halfD: 2.0 },
  indoor:   { halfW: 3.8, halfD: 2.2 },
  backyard: { halfW: 6.0, halfD: 3.2 },
};

type StudioState = {
  placed: PlacedPlant[];
  history: PlacedPlant[][];   // undo stack
  pending: PendingPlant | null;
  activeId: string | null;
  hoveredId: string | null;
  isDraggingId: string | null;
  sunHour: number;
  sunPlaying: boolean;
  showZones: boolean;
  showHeatmap: boolean;
  ghostPos: [number, number] | null;
  companionSpecies: string[];
  viewRequest: { view: CameraView; nonce: number };
  gardenType: GardenTypeStudio;
  syncReady: boolean;
  syncStatus: StudioSyncStatus;
  lastSavedAt: string | null;

  setPending: (p: PendingPlant | null) => void;
  setGardenType: (t: GardenTypeStudio) => void;
  // Loads a server-persisted layout, overriding the localStorage snapshot.
  initPlaced: (plants: PlacedPlant[], gardenType: GardenTypeStudio) => void;
  restoreLocal: (gardenType: GardenTypeStudio) => void;
  linkPlacedPlant: (localId: string, plantId: string) => void;
  placeAt: (x: number, z: number) => void;
  movePlant: (id: string, x: number, z: number) => void;
  setActive: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  removePlant: (id: string) => void;
  duplicatePlant: (id: string) => void;
  autoArrange: () => void;
  undo: () => void;
  setSunHour: (h: number) => void;
  tickSun: (h: number) => void;
  toggleSunPlay: () => void;
  requestView: (view: CameraView) => void;
  toggleZones: () => void;
  toggleHeatmap: () => void;
  setGhostPos: (pos: [number, number] | null) => void;
  setCompanionSpecies: (s: string[]) => void;
  clearLayout: () => void;
  setSyncState: (status: StudioSyncStatus, options?: { ready?: boolean; savedAt?: string | null }) => void;
};

const LS_KEY = "bloom-studio-v3";

function save(placed: PlacedPlant[], gardenType: GardenTypeStudio) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const layouts = raw ? JSON.parse(raw) as Partial<Record<GardenTypeStudio, PlacedPlant[]>> : {};
    localStorage.setItem(LS_KEY, JSON.stringify({ ...layouts, [gardenType]: placed }));
  } catch {}
}

function load(gardenType: GardenTypeStudio): PlacedPlant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const layouts = JSON.parse(raw) as Partial<Record<GardenTypeStudio, PlacedPlant[]>>;
    return Array.isArray(layouts[gardenType]) ? layouts[gardenType]! : [];
  } catch { return []; }
}

function createStudioStore() {
  return createStore<StudioState>((set, get) => ({
    placed: [],
    history: [],
    pending: null,
    activeId: null,
    hoveredId: null,
    isDraggingId: null,
    sunHour: 12,
    sunPlaying: false,
    showZones: true,
    showHeatmap: false,
    ghostPos: null,
    companionSpecies: [],
    viewRequest: { view: "orbit", nonce: 0 },
    gardenType: "balcony",
    syncReady: false,
    syncStatus: "loading",
    lastSavedAt: null,

    setPending: (p) => set({ pending: p, activeId: null, ghostPos: null }),

    placeAt: (x, z) => {
      const { pending, placed, gardenType } = get();
      if (!pending) return;
      const id = `p${Date.now()}`;
      const next = [...placed, { id, ...pending, x, z, rotation: Math.random() * Math.PI * 2 }];
      save(next, gardenType);
      set((s) => ({ placed: next, history: [...s.history.slice(-20), placed], pending: null, ghostPos: null }));
    },

    movePlant: (id, x, z) => {
      const { placed, gardenType } = get();
      const current = placed.find((plant) => plant.id === id);
      if (!current) {
        set({ isDraggingId: null });
        return;
      }
      // A click starts the drag layer too. Do not create an undo entry or
      // trigger a save when the pointer was released without moving the plant.
      if (Math.hypot(current.x - x, current.z - z) < 0.02) {
        set({ isDraggingId: null });
        return;
      }
      const next = placed.map((p) => p.id === id ? { ...p, x, z } : p);
      save(next, gardenType);
      // Keep activeId — plant stays selected after a drag so the user can
      // immediately see its tooltip / delete it without re-clicking.
      set((s) => ({ placed: next, history: [...s.history.slice(-20), placed], isDraggingId: null }));
    },

    setActive: (id) => set({ activeId: id }),
    setHovered: (id) => set({ hoveredId: id }),
    setDragging: (id) => set({ isDraggingId: id }),

    removePlant: (id) => {
      const { placed, gardenType } = get();
      const next = placed.filter((p) => p.id !== id);
      save(next, gardenType);
      set((s) => ({ placed: next, history: [...s.history.slice(-20), placed], activeId: null }));
    },

    duplicatePlant: (id) => {
      const { placed, gardenType } = get();
      const src = placed.find((p) => p.id === id);
      if (!src) return;
      const nid = `p${Date.now()}`;
      const maxX = GARDEN_DIMS[gardenType].halfW - 0.6;
      const ox = src.x + 0.55 > maxX ? src.x - 0.55 : src.x + 0.55;
      // A duplicate is a new specimen, not another position for the same garden record.
      const copy: PlacedPlant = { ...src, plantId: undefined, id: nid, x: ox, rotation: Math.random() * Math.PI * 2 };
      const next = [...placed, copy];
      save(next, gardenType);
      set((s) => ({ placed: next, history: [...s.history.slice(-20), placed], activeId: nid }));
    },

    autoArrange: () => {
      const { placed, gardenType } = get();
      if (!placed.length) return;
      const next = arrangeConfiguredLayout(placed, gardenType);
      save(next, gardenType);
      set((s) => ({ placed: next, history: [...s.history.slice(-20), placed], activeId: null }));
    },

    undo: () => {
      const { history, gardenType } = get();
      if (!history.length) return;
      const prev = history[history.length - 1];
      save(prev, gardenType);
      set({ placed: prev, history: history.slice(0, -1), activeId: null });
    },

    setGardenType: (t) => set({
      gardenType: t,
      placed: load(t),
      history: [],
      activeId: null,
      ghostPos: null,
      pending: null,
      syncReady: false,
      syncStatus: "loading",
      lastSavedAt: null,
    }),
    initPlaced: (plants, gardenType) => {
      save(plants, gardenType);
      set({ placed: plants, gardenType, history: [], activeId: null, ghostPos: null, pending: null });
    },
    restoreLocal: (gardenType) => set({
      placed: load(gardenType),
      gardenType,
      history: [],
      activeId: null,
      ghostPos: null,
      pending: null,
    }),
    linkPlacedPlant: (localId, plantId) => set((s) => {
      const next = s.placed.map((plant) => plant.id === localId ? { ...plant, plantId } : plant);
      save(next, s.gardenType);
      return { placed: next };
    }),
    setSunHour: (h) => set({ sunHour: h, sunPlaying: false }),
    tickSun: (h) => set({ sunHour: h }),
    toggleSunPlay: () => set((s) => ({ sunPlaying: !s.sunPlaying })),
    requestView: (view) => set((s) => ({ viewRequest: { view, nonce: s.viewRequest.nonce + 1 } })),
    toggleZones: () => set((s) => ({ showZones: !s.showZones })),
    toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
    setGhostPos: (pos) => set({ ghostPos: pos }),
    setCompanionSpecies: (s) => set({ companionSpecies: s }),
    clearLayout: () => {
      const { placed, gardenType } = get();
      save([], gardenType);
      set((s) => ({ placed: [], history: [...s.history.slice(-20), placed], activeId: null }));
    },
    setSyncState: (status, options) => set((state) => ({
      syncStatus: status,
      syncReady: options?.ready ?? state.syncReady,
      lastSavedAt: options && "savedAt" in options ? options.savedAt ?? null : state.lastSavedAt,
    })),
  }));
}

const Ctx = createContext<StoreApi<StudioState> | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createStudioStore);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStudio<T>(sel: (s: StudioState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("Must be within StudioProvider");
  return useStore(store, sel);
}

export function getSun(hour: number) {
  const t = Math.max(0, Math.min(1, (hour - 5.5) / 13));
  const angle = t * Math.PI;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  const norm: [number, number, number] = [-cosA * 0.85, Math.max(0.02, sinA), -0.45];
  const pos: [number, number, number] = [-cosA * 85, Math.max(2, sinA * 95), -45];
  const isDay = sinA > 0.06;
  const intensity = isDay ? Math.max(0.15, sinA) * 3.8 : 0;
  const color = t < 0.1 || t > 0.9 ? "#ff7722" : t < 0.22 || t > 0.78 ? "#ffcc55" : "#fff8ee";
  return { norm, pos, isDay, intensity, color };
}

export function getZoneSplit(_hour: number) {
  void _hour;
  return { fullFrac: 1 / 3, partialFrac: 2 / 3 };
}

export const HALF_BALCONY_D = 1.2;
export const HALF_BALCONY_W = 5.5;

export function zoneAt(
  z: number,
  hour: number,
  halfD = HALF_BALCONY_D,
  gardenType: GardenTypeStudio = "balcony",
): LightReq {
  const fromLightSide = gardenType === "indoor"
    ? (halfD + z) / (halfD * 2)
    : (halfD - z) / (halfD * 2);
  const { fullFrac, partialFrac } = getZoneSplit(hour);
  if (fromLightSide <= fullFrac) return "full_sun";
  if (fromLightSide <= partialFrac) return "partial_shade";
  return "shade";
}

export function getCareScore(plant: Pick<PlacedPlant, "waterDays">): number {
  if (plant.waterDays <= 2) return 1;
  if (plant.waterDays <= 4) return 0.75;
  if (plant.waterDays <= 7) return 0.5;
  if (plant.waterDays <= 14) return 0.25;
  return 0.12;
}

function stableHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function arrangeConfiguredLayout(placed: PlacedPlant[], gardenType: GardenTypeStudio) {
  const { halfW, halfD } = GARDEN_DIMS[gardenType];
  const maxX = halfW - 0.62;
  const lightSide = gardenType === "indoor" ? -1 : 1;
  const bandCenter: Record<LightReq, number> = {
    full_sun: lightSide * (halfD - 0.36),
    partial_shade: 0,
    shade: lightSide * (-halfD + 0.3),
  };
  const companionBandDepth = gardenType === "backyard" ? 0.18 : gardenType === "terrace" ? 0.15 : gardenType === "indoor" ? 0.08 : 0.12;

  const grouped: Record<LightReq, PlacedPlant[]> = { full_sun: [], partial_shade: [], shade: [] };
  for (const plant of placed) grouped[plant.lightReq].push(plant);

  const next = placed.map((plant) => ({ ...plant }));

  const bandSequence: LightReq[] = ["full_sun", "partial_shade", "shade"];
  for (const band of bandSequence) {
    const items = grouped[band];
    if (!items.length) continue;

    // Ordering uses only user-confirmed inputs: light band first, then watering cadence.
    const ordered = [...items].sort((a, b) => {
      if (a.waterDays !== b.waterDays) return a.waterDays - b.waterDays;
      return a.commonName.localeCompare(b.commonName);
    });

    const count = ordered.length;
    const spans = Math.min(maxX * 1.75, Math.max(0.8, (count - 1) * 0.92));
    const step = count > 1 ? spans / (count - 1) : 0;
    const xSlots = count <= 1
      ? [0]
      : Array.from({ length: count }, (_, idx) => (idx === 0 ? 0 : Math.ceil(idx / 2) * step * (idx % 2 === 1 ? -1 : 1)));
    const zOffsets = count <= 1
      ? [0]
      : Array.from({ length: count }, (_, idx) => {
          const pattern = [0, 1, -1, 0.65, -0.65, 1.15, -1.15];
          return (pattern[idx % pattern.length] ?? 0) * companionBandDepth;
        });

    ordered.forEach((plant, index) => {
      const idx = next.findIndex((candidate) => candidate.id === plant.id);
      if (idx < 0) return;

      const rotation = ((stableHash(`${plant.species}:${plant.commonName}`) % 360) - 180) * (Math.PI / 180) * 0.08;
      next[idx] = {
        ...next[idx],
        x: Math.max(-maxX, Math.min(maxX, xSlots[index] ?? 0)),
        z: Math.max(-halfD + 0.25, Math.min(halfD - 0.34, bandCenter[band] + (zOffsets[index] ?? 0))),
        rotation,
      };
    });
  }

  // Keep the layout deterministic and readable by preserving the new order.
  // Plants already grouped above are positioned around the band centers.
  return next;
}

export const ZONE_META: Record<LightReq, { label: string; color: string; emoji: string }> = {
  full_sun:      { label: "Full sun target",      color: "#e8bd68", emoji: "☀️" },
  partial_shade: { label: "Partial sun target", color: "#8fb9c7", emoji: "⛅" },
  shade:         { label: "Low-light target",     color: "#9892b7", emoji: "🌑" },
};

export function mapSunlight(s: string): LightReq {
  if (s === "Full sun") return "full_sun";
  if (s === "Low light") return "shade";
  return "partial_shade";
}

// LightReq → backend SunlightLevel (matches sunlightOptions in lib/garden.ts)
export function lightToSunlight(l: LightReq): string {
  if (l === "full_sun") return "Full sun";
  if (l === "shade") return "Low light";
  return "Partial sun";
}
