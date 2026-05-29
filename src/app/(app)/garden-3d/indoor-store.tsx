"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type ZoneType = "floor" | "shelf" | "windowsill" | "hanging";

export type Zone = {
  id: string;
  type: ZoneType;
  x: number;
  y: number;
  z: number;
  label: string;
};

export type IndoorPlant = {
  id: string;
  name: string;
  species: string;
  emoji: string;
  suitableZones: ZoneType[];
  potColor: string;
  foliageColor: string;
  foliageColor2: string;
  trunkColor: string;
  accentColor: string;
  plantType: "upright" | "bushy" | "trailing" | "succulent" | "tall";
  height: number;         // metres
  waterDays: number;
  light: "low" | "medium" | "bright";
  description: string;
};

export type PlacedIndoorPlant = {
  id: string;
  zone: Zone;
  plant: IndoorPlant;
  rotation: number;
};

type IndoorState = {
  placed: PlacedIndoorPlant[];
  selected: IndoorPlant | null;
  activeId: string | null;
  searchQuery: string;
  lightMode: "day" | "evening" | "golden";
  selectPlant: (p: IndoorPlant | null) => void;
  placeInZone: (zone: Zone) => void;
  removePlant: (id: string) => void;
  setActive: (id: string | null) => void;
  setSearch: (q: string) => void;
  setLight: (l: IndoorState["lightMode"]) => void;
};

export const INDOOR_PLANTS: IndoorPlant[] = [
  { id: "monstera", name: "Monstera", species: "Monstera deliciosa", emoji: "🌿", suitableZones: ["floor"], potColor: "#e8d5b0", foliageColor: "#2d6b2d", foliageColor2: "#3d8b3d", trunkColor: "#7a5a3a", accentColor: "#4aab4a", plantType: "bushy", height: 1.1, waterDays: 7, light: "medium", description: "Iconic split-leaf plant. Thrives in bright indirect light." },
  { id: "fiddleleaf", name: "Fiddle Leaf Fig", species: "Ficus lyrata", emoji: "🌳", suitableZones: ["floor"], potColor: "#f5e8d0", foliageColor: "#3a7a3a", foliageColor2: "#2a5a2a", trunkColor: "#8a6040", accentColor: "#5aaa5a", plantType: "tall", height: 1.5, waterDays: 7, light: "bright", description: "Statement tree. Large glossy leaves on a slender trunk." },
  { id: "birdofparadise", name: "Bird of Paradise", species: "Strelitzia reginae", emoji: "🌴", suitableZones: ["floor"], potColor: "#d0c8b8", foliageColor: "#2a6a4a", foliageColor2: "#1a4a2a", trunkColor: "#6a4a2a", accentColor: "#5aaa6a", plantType: "tall", height: 1.3, waterDays: 7, light: "bright", description: "Tropical drama. Paddle-shaped leaves in a bold fan." },
  { id: "snake", name: "Snake Plant", species: "Sansevieria trifasciata", emoji: "🗡️", suitableZones: ["floor", "shelf"], potColor: "#c8b8a0", foliageColor: "#4a7a5a", foliageColor2: "#d4b84a", trunkColor: "#5a4a3a", accentColor: "#8aaa6a", plantType: "upright", height: 0.8, waterDays: 14, light: "low", description: "Nearly indestructible. Air purifying. Perfect beginner plant." },
  { id: "zz", name: "ZZ Plant", species: "Zamioculcas zamiifolia", emoji: "🌱", suitableZones: ["floor", "shelf"], potColor: "#e0d0c0", foliageColor: "#2a5a2a", foliageColor2: "#3a7a3a", trunkColor: "#6a5a4a", accentColor: "#5a9a5a", plantType: "upright", height: 0.6, waterDays: 14, light: "low", description: "Glossy dark leaves. Tolerates low light and neglect." },
  { id: "peacelily", name: "Peace Lily", species: "Spathiphyllum wallisii", emoji: "🌸", suitableZones: ["floor", "shelf"], potColor: "#e8e0d8", foliageColor: "#2a6a2a", foliageColor2: "#f0f5f0", trunkColor: "#5a5a4a", accentColor: "#ffffff", plantType: "bushy", height: 0.6, waterDays: 5, light: "low", description: "White blooms against deep green leaves. Loves shade." },
  { id: "pothos", name: "Golden Pothos", species: "Epipremnum aureum", emoji: "🍃", suitableZones: ["shelf", "hanging"], potColor: "#c8d0b8", foliageColor: "#4a8a2a", foliageColor2: "#d4b84a", trunkColor: "#5a4a2a", accentColor: "#8ab84a", plantType: "trailing", height: 0.4, waterDays: 7, light: "low", description: "Trailing vines with golden variegation. Nearly impossible to kill." },
  { id: "stringofpearls", name: "String of Pearls", species: "Senecio rowleyanus", emoji: "🟢", suitableZones: ["hanging", "shelf"], potColor: "#d8c8b8", foliageColor: "#5a9a5a", foliageColor2: "#4a8a4a", trunkColor: "#7a6a4a", accentColor: "#6aaa6a", plantType: "trailing", height: 0.3, waterDays: 14, light: "bright", description: "Cascading bead-like leaves. A living necklace." },
  { id: "spiderplant", name: "Spider Plant", species: "Chlorophytum comosum", emoji: "🌿", suitableZones: ["hanging", "shelf"], potColor: "#d0c0a8", foliageColor: "#6a9a3a", foliageColor2: "#d4d48a", trunkColor: "#6a5a3a", accentColor: "#aad45a", plantType: "trailing", height: 0.4, waterDays: 7, light: "medium", description: "Long arching leaves with white stripes. Baby plantlets hang down." },
  { id: "aloe", name: "Aloe Vera", species: "Aloe barbadensis", emoji: "🌵", suitableZones: ["windowsill", "shelf"], potColor: "#e8d8c0", foliageColor: "#5a8a6a", foliageColor2: "#7aaa8a", trunkColor: "#6a5a3a", accentColor: "#9acaaa", plantType: "succulent", height: 0.3, waterDays: 14, light: "bright", description: "Medicinal succulent. Thrives on sunny windowsills." },
  { id: "herbs", name: "Herb Garden", species: "Mixed herbs", emoji: "🌿", suitableZones: ["windowsill"], potColor: "#c8a888", foliageColor: "#5a9a3a", foliageColor2: "#7aba5a", trunkColor: "#6a5a2a", accentColor: "#9aba5a", plantType: "bushy", height: 0.25, waterDays: 3, light: "bright", description: "Basil, mint, rosemary. Fresh herbs from your windowsill." },
  { id: "succulent", name: "Succulent Mix", species: "Echeveria & friends", emoji: "🌸", suitableZones: ["windowsill", "shelf"], potColor: "#f0e0d0", foliageColor: "#d48a8a", foliageColor2: "#8ad4d4", trunkColor: "#7a6a5a", accentColor: "#f4c8a8", plantType: "succulent", height: 0.18, waterDays: 21, light: "bright", description: "Rosette-forming succulents in pastels and purples." },
];

// ─── Pre-defined placement zones in the room ──────────────────────────────────
export const ROOM_ZONES: Zone[] = [
  // Floor zones (large area)
  { id: "f1", type: "floor",      x: -2.2, y: 0,   z: -1.5, label: "Corner spot" },
  { id: "f2", type: "floor",      x:  2.2, y: 0,   z: -1.5, label: "Corner spot" },
  { id: "f3", type: "floor",      x: -2.8, y: 0,   z:  0.5, label: "Wall side" },
  { id: "f4", type: "floor",      x:  2.8, y: 0,   z:  0.5, label: "Wall side" },
  { id: "f5", type: "floor",      x:  0,   y: 0,   z:  1.8, label: "Centre" },
  { id: "f6", type: "floor",      x: -1.2, y: 0,   z:  1.2, label: "Floor spot" },
  // Shelf zones (left wall unit — 2 tiers)
  { id: "s1", type: "shelf",      x: -3.2, y: 0.72, z: -0.8, label: "Shelf top-left" },
  { id: "s2", type: "shelf",      x: -3.2, y: 0.72, z:  0,   label: "Shelf top-mid" },
  { id: "s3", type: "shelf",      x: -3.2, y: 0.72, z:  0.8, label: "Shelf top-right" },
  { id: "s4", type: "shelf",      x: -3.2, y: 1.42, z: -0.8, label: "Shelf high-left" },
  { id: "s5", type: "shelf",      x: -3.2, y: 1.42, z:  0,   label: "Shelf high-mid" },
  { id: "s6", type: "shelf",      x: -3.2, y: 1.42, z:  0.8, label: "Shelf high-right" },
  // Windowsill
  { id: "w1", type: "windowsill", x: -0.6, y: 1.05, z: -3.1, label: "Windowsill left" },
  { id: "w2", type: "windowsill", x:  0,   y: 1.05, z: -3.1, label: "Windowsill centre" },
  { id: "w3", type: "windowsill", x:  0.6, y: 1.05, z: -3.1, label: "Windowsill right" },
  // Hanging (ceiling hooks)
  { id: "h1", type: "hanging",    x: -1.5, y: 2.5,  z: -1.0, label: "Hanging hook" },
  { id: "h2", type: "hanging",    x:  1.0, y: 2.5,  z: -0.5, label: "Hanging hook" },
  { id: "h3", type: "hanging",    x:  0,   y: 2.5,  z:  1.0, label: "Hanging hook" },
];

function makeStore() {
  return createStore<IndoorState>((set, get) => ({
    placed: [],
    selected: null,
    activeId: null,
    searchQuery: "",
    lightMode: "day",

    selectPlant: (p) => set({ selected: p }),

    placeInZone: (zone) => {
      const { selected, placed } = get();
      if (!selected) return;
      if (!selected.suitableZones.includes(zone.type)) return;
      if (placed.find((p) => p.zone.id === zone.id)) return; // already occupied
      set({
        placed: [...placed, {
          id: `${Date.now()}`,
          zone,
          plant: selected,
          rotation: Math.random() * Math.PI * 2,
        }],
      });
    },

    removePlant: (id) => set((s) => ({ placed: s.placed.filter((p) => p.id !== id), activeId: null })),
    setActive: (id) => set({ activeId: id }),
    setSearch: (q) => set({ searchQuery: q }),
    setLight: (l) => set({ lightMode: l }),
  }));
}

const Ctx = createContext<StoreApi<IndoorState> | null>(null);

export function IndoorStoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<StoreApi<IndoorState>>(null);
  if (!ref.current) (ref as { current: StoreApi<IndoorState> }).current = makeStore();
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function useIndoorStore<T>(sel: (s: IndoorState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("Must be within IndoorStoreProvider");
  return useStore(store, sel);
}
