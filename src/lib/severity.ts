// Published, deterministic severity formula and routing table.
// The AI only extracts features; this file decides the score. Shown on /how-it-works.

export const CATEGORIES = [
  "road_damage",
  "garbage",
  "water_leak",
  "waterlogging",
  "streetlight",
  "pollution",
  "noise",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  road_damage: "Road / bridge damage",
  garbage: "Garbage / litter",
  water_leak: "Water leak",
  waterlogging: "Waterlogging / drainage",
  streetlight: "Streetlight",
  pollution: "Pollution",
  noise: "Noise",
  other: "Other",
};

export const CATEGORY_BASE: Record<Category, number> = {
  road_damage: 2,
  garbage: 1,
  water_leak: 2,
  waterlogging: 2,
  streetlight: 1,
  pollution: 2,
  noise: 1,
  other: 1,
};

export const DEPARTMENT_FOR: Record<Category, string> = {
  road_damage: "municipal",
  garbage: "municipal",
  water_leak: "water",
  waterlogging: "water",
  streetlight: "municipal",
  pollution: "pcb",
  noise: "police",
  other: "municipal",
};

export type SeverityFeatures = {
  category: Category;
  size_estimate: "small" | "medium" | "large" | "unknown";
  people_at_risk: boolean;
  blocks_traffic_or_access: boolean;
  road_type: "highway" | "arterial" | "local" | "lane" | "none" | "unknown";
  near_school_or_hospital: boolean | null; // null = live data unavailable
  rain_mm_last_24h: number | null; // null = live data unavailable
  aqi: number | null;
};

export function computeSeverity(f: SeverityFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = CATEGORY_BASE[f.category];
  reasons.push(`Base for ${CATEGORY_LABELS[f.category]}: +${points}`);

  if (f.size_estimate === "large") {
    points += 1;
    reasons.push("Large in size: +1");
  }
  if (f.people_at_risk) {
    points += 1;
    reasons.push("People visibly at risk: +1");
  }
  if (f.blocks_traffic_or_access) {
    points += 1;
    reasons.push("Blocks traffic or access: +1");
  }
  if (
    (f.category === "road_damage" || f.category === "waterlogging") &&
    (f.road_type === "highway" || f.road_type === "arterial")
  ) {
    points += 1;
    reasons.push(`On a ${f.road_type} road: +1`);
  }
  if (f.near_school_or_hospital) {
    points += 1;
    reasons.push("School or hospital within 200 m: +1");
  }
  if (
    f.rain_mm_last_24h !== null &&
    f.rain_mm_last_24h >= 10 &&
    (f.category === "road_damage" || f.category === "waterlogging" || f.category === "water_leak")
  ) {
    points += 1;
    reasons.push(`Heavy rain in last 24 h (${f.rain_mm_last_24h.toFixed(1)} mm): +1`);
  }
  if (f.category === "pollution" && f.aqi !== null && f.aqi > 150) {
    points += 1;
    reasons.push(`Local AQI is high (${Math.round(f.aqi)}): +1`);
  }

  const score = Math.max(1, Math.min(5, points));
  if (points > 5) reasons.push(`Capped at 5 (raw ${points})`);
  return { score, reasons };
}

export const SLA_HOURS: Record<number, number> = { 5: 24, 4: 48, 3: 72, 2: 168, 1: 336 };

export function slaDeadline(score: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[score] * 3600_000);
}

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const SEVERITY_LABEL: Record<number, string> = {
  1: "Low",
  2: "Minor",
  3: "Moderate",
  4: "High",
  5: "Critical",
};
