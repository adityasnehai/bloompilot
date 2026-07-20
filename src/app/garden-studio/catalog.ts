import type { LightReq } from "./store";

export type CatalogPlant = {
  id: string;
  commonName: string;
  species: string;
  emoji: string;
  lightReq: LightReq;
  waterDays: number;
  gradient: [string, string];
  category: "herb" | "flower" | "vegetable" | "succulent" | "foliage";
  description: string;
};

export const BALCONY_CATALOG: CatalogPlant[] = [
  { id: "basil",      commonName: "Basil",          species: "Ocimum basilicum",         emoji: "🌿", lightReq: "full_sun",      waterDays: 3,  gradient: ["#15803d","#4ade80"], category: "herb",      description: "Fragrant kitchen herb. Loves heat and sun." },
  { id: "lavender",   commonName: "Lavender",        species: "Lavandula angustifolia",   emoji: "💜", lightReq: "full_sun",      waterDays: 10, gradient: ["#7c3aed","#c4b5fd"], category: "flower",    description: "Fragrant purple spikes. Attracts pollinators." },
  { id: "mint",       commonName: "Mint",            species: "Mentha spicata",           emoji: "🌿", lightReq: "partial_shade", waterDays: 3,  gradient: ["#0f766e","#5eead4"], category: "herb",      description: "Fast-spreading herb. Great in containers." },
  { id: "tomato",     commonName: "Cherry Tomato",   species: "Solanum lycopersicum",     emoji: "🍅", lightReq: "full_sun",      waterDays: 2,  gradient: ["#b91c1c","#fca5a5"], category: "vegetable", description: "Compact variety ideal for balcony pots." },
  { id: "marigold",   commonName: "Marigold",        species: "Tagetes erecta",           emoji: "🌼", lightReq: "full_sun",      waterDays: 5,  gradient: ["#b45309","#fde68a"], category: "flower",    description: "Pest-repelling bright blooms. Very hardy." },
  { id: "geranium",   commonName: "Geranium",        species: "Pelargonium hortorum",     emoji: "🌺", lightReq: "full_sun",      waterDays: 5,  gradient: ["#be185d","#fbcfe8"], category: "flower",    description: "Classic balcony flower. Long blooming season." },
  { id: "rosemary",   commonName: "Rosemary",        species: "Salvia rosmarinus",        emoji: "🌿", lightReq: "full_sun",      waterDays: 7,  gradient: ["#4d7c0f","#bef264"], category: "herb",      description: "Woody herb with needle-like leaves. Drought tolerant." },
  { id: "petunia",    commonName: "Petunia",         species: "Petunia hybrida",          emoji: "🌸", lightReq: "full_sun",      waterDays: 3,  gradient: ["#9333ea","#e9d5ff"], category: "flower",    description: "Cascading blooms. Excellent for hanging pots." },
  { id: "aloe",       commonName: "Aloe Vera",       species: "Aloe barbadensis",         emoji: "🌵", lightReq: "full_sun",      waterDays: 14, gradient: ["#65a30d","#d9f99d"], category: "succulent", description: "Medicinal succulent. Thrives in neglect." },
  { id: "fern",       commonName: "Boston Fern",     species: "Nephrolepis exaltata",     emoji: "🌿", lightReq: "shade",         waterDays: 3,  gradient: ["#166534","#86efac"], category: "foliage",   description: "Lush arching fronds. Loves shade and humidity." },
  { id: "chilli",     commonName: "Chilli",          species: "Capsicum annuum",          emoji: "🌶️", lightReq: "full_sun",      waterDays: 3,  gradient: ["#dc2626","#fbbf24"], category: "vegetable", description: "Hot peppers in a compact container. Very rewarding." },
  { id: "strawberry", commonName: "Strawberry",      species: "Fragaria × ananassa",      emoji: "🍓", lightReq: "full_sun",      waterDays: 2,  gradient: ["#e11d48","#fda4af"], category: "vegetable", description: "Sweet berries from a hanging basket." },
  { id: "jasmine",    commonName: "Jasmine",         species: "Jasminum sambac",          emoji: "🌸", lightReq: "full_sun",      waterDays: 5,  gradient: ["#d97706","#fef3c7"], category: "flower",    description: "Intoxicating fragrance. Perfect climber." },
  { id: "succulent",  commonName: "Echeveria",       species: "Echeveria elegans",        emoji: "🪴", lightReq: "full_sun",      waterDays: 14, gradient: ["#0891b2","#a5f3fc"], category: "succulent", description: "Rose-shaped rosette in pastels. Zero maintenance." },
  { id: "coriander",  commonName: "Coriander",       species: "Coriandrum sativum",       emoji: "🌿", lightReq: "partial_shade", waterDays: 3,  gradient: ["#059669","#6ee7b7"], category: "herb",      description: "Fast-growing culinary herb. Harvest often." },
  { id: "pansy",      commonName: "Pansy",           species: "Viola tricolor hortensis", emoji: "💐", lightReq: "partial_shade", waterDays: 4,  gradient: ["#4f46e5","#c7d2fe"], category: "flower",    description: "Colourful cold-hardy blooms for cool seasons." },
];

export const CATEGORIES = ["herb", "flower", "vegetable", "succulent", "foliage"] as const;
export type Category = typeof CATEGORIES[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  herb: "Herbs",
  flower: "Flowers",
  vegetable: "Edibles",
  succulent: "Succulents",
  foliage: "Foliage",
};
