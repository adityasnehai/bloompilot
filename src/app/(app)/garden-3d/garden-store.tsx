"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type PlantDef = {
  id: string;
  name: string;
  species: string;
  emoji: string;
  type: "tree" | "shrub" | "flower" | "grass" | "palm" | "fern" | "succulent" | "herb";
  trunkColor: string;
  foliageColor: string;
  foliageColor2: string;
  accentColor: string;
  scale: number;
  waterDays: number;
  sunlight: string;
  description: string;
};

export type PlacedPlant = {
  id: string;
  x: number;
  z: number;
  rotation: number;
  plant: PlantDef;
  scale: number;
};

type GardenState = {
  placed: PlacedPlant[];
  selected: PlantDef | null;
  activeId: string | null;
  searchQuery: string;
  season: "spring" | "summer" | "autumn" | "winter";
  timeOfDay: "morning" | "day" | "evening";
  selectPlant: (p: PlantDef | null) => void;
  placeAt: (x: number, z: number) => void;
  removePlant: (id: string) => void;
  setActive: (id: string | null) => void;
  setSearch: (q: string) => void;
  setSeason: (s: GardenState["season"]) => void;
  setTime: (t: GardenState["timeOfDay"]) => void;
};

export const PLANT_CATALOG: PlantDef[] = [
  { id: "oak", name: "Oak Tree", species: "Quercus robur", emoji: "🌳", type: "tree", trunkColor: "#5c4033", foliageColor: "#2d5a27", foliageColor2: "#3d7a35", accentColor: "#4a8f40", scale: 1.4, waterDays: 14, sunlight: "Full sun", description: "Majestic shade tree, great as a centrepiece." },
  { id: "cherry", name: "Cherry Blossom", species: "Prunus serrulata", emoji: "🌸", type: "tree", trunkColor: "#6b3a2a", foliageColor: "#f4a7c3", foliageColor2: "#e87fa8", accentColor: "#ffd6e7", scale: 1.2, waterDays: 7, sunlight: "Full sun", description: "Beautiful spring blooms. Iconic pink canopy." },
  { id: "pine", name: "Pine Tree", species: "Pinus sylvestris", emoji: "🌲", type: "tree", trunkColor: "#7a4a2a", foliageColor: "#1a4a1a", foliageColor2: "#255225", accentColor: "#2d6b2d", scale: 1.6, waterDays: 21, sunlight: "Full sun", description: "Evergreen conifer with a classic triangular form." },
  { id: "rose", name: "Rose Bush", species: "Rosa hybrida", emoji: "🌹", type: "shrub", trunkColor: "#5a3a2a", foliageColor: "#2d6b2d", foliageColor2: "#d4282a", accentColor: "#f05050", scale: 0.7, waterDays: 4, sunlight: "Full sun", description: "Classic roses with deep green foliage and vivid blooms." },
  { id: "lavender", name: "Lavender", species: "Lavandula angustifolia", emoji: "💜", type: "herb", trunkColor: "#8a7060", foliageColor: "#7b9a6b", foliageColor2: "#9b67b8", accentColor: "#c39bd3", scale: 0.5, waterDays: 10, sunlight: "Full sun", description: "Fragrant purple spikes. Attracts bees and butterflies." },
  { id: "hydrangea", name: "Hydrangea", species: "Hydrangea macrophylla", emoji: "💐", type: "shrub", trunkColor: "#7a6040", foliageColor: "#3a7a3a", foliageColor2: "#6ba3e0", accentColor: "#9ec8f5", scale: 0.8, waterDays: 5, sunlight: "Partial sun", description: "Large mophead blooms in blue, pink, or white." },
  { id: "palm", name: "Palm Tree", species: "Phoenix dactylifera", emoji: "🌴", type: "palm", trunkColor: "#8a6a4a", foliageColor: "#3a8a3a", foliageColor2: "#4aa04a", accentColor: "#5aba5a", scale: 1.5, waterDays: 10, sunlight: "Full sun", description: "Tropical statement plant. Tall slender silhouette." },
  { id: "fern", name: "Boston Fern", species: "Nephrolepis exaltata", emoji: "🌿", type: "fern", trunkColor: "#5a4a3a", foliageColor: "#2d7a2d", foliageColor2: "#3d9a3d", accentColor: "#4dba4d", scale: 0.6, waterDays: 3, sunlight: "Partial shade", description: "Lush arching fronds. Loves humidity and shade." },
  { id: "boxwood", name: "Boxwood Hedge", species: "Buxus sempervirens", emoji: "🌿", type: "shrub", trunkColor: "#5a4a3a", foliageColor: "#2a5a2a", foliageColor2: "#357a35", accentColor: "#3d8c3d", scale: 0.9, waterDays: 7, sunlight: "Full sun", description: "Classic evergreen for formal hedges and topiary." },
  { id: "sunflower", name: "Sunflower", species: "Helianthus annuus", emoji: "🌻", type: "flower", trunkColor: "#6a8a3a", foliageColor: "#5a8a2a", foliageColor2: "#f5d020", accentColor: "#7a4a1a", scale: 0.8, waterDays: 3, sunlight: "Full sun", description: "Tall cheerful blooms that follow the sun." },
  { id: "bamboo", name: "Bamboo", species: "Phyllostachys aurea", emoji: "🎋", type: "grass", trunkColor: "#7a9a5a", foliageColor: "#5a8a3a", foliageColor2: "#6aaa4a", accentColor: "#8aba5a", scale: 1.1, waterDays: 5, sunlight: "Partial sun", description: "Fast-growing, creates privacy screens and movement." },
  { id: "agave", name: "Agave", species: "Agave americana", emoji: "🌵", type: "succulent", trunkColor: "#5a6a4a", foliageColor: "#5a8a6a", foliageColor2: "#7aaa8a", accentColor: "#9acaaa", scale: 0.7, waterDays: 21, sunlight: "Full sun", description: "Dramatic sculptural rosette. Drought tolerant." },
];

function createGardenStore() {
  return createStore<GardenState>((set, get) => ({
    placed: [],
    selected: null,
    activeId: null,
    searchQuery: "",
    season: "summer",
    timeOfDay: "day",

    selectPlant: (p) => set({ selected: p }),

    placeAt: (x, z) => {
      const { selected } = get();
      if (!selected) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      set((s) => ({
        placed: [
          ...s.placed,
          {
            id,
            x,
            z,
            rotation: Math.random() * Math.PI * 2,
            plant: selected,
            scale: selected.scale * (0.85 + Math.random() * 0.3),
          },
        ],
      }));
    },

    removePlant: (id) => set((s) => ({ placed: s.placed.filter((p) => p.id !== id), activeId: null })),
    setActive: (id) => set({ activeId: id }),
    setSearch: (q) => set({ searchQuery: q }),
    setSeason: (s) => set({ season: s }),
    setTime: (t) => set({ timeOfDay: t }),
  }));
}

const Ctx = createContext<StoreApi<GardenState> | null>(null);

export function GardenStoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<StoreApi<GardenState>>(null);
  if (!ref.current) (ref as { current: StoreApi<GardenState> }).current = createGardenStore();
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function useGardenStore<T>(sel: (s: GardenState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("Must be within GardenStoreProvider");
  return useStore(store, sel);
}
