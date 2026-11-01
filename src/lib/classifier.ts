// Client for the CLIP civic classifier — a separate Python service (Modal).
// The endpoint is public and holds no secrets, so both the browser and the
// server may call it. It is never the only opinion: the VLM stays authoritative.
import type { Category } from "./severity";

const DEFAULT_URL = "https://kedia-pradyun--civic-classifier-fastapi-app.us-east.modal.run";

function configuredUrl(): string | undefined {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return env["VITE_CLASSIFIER_URL"];
}

export const CLASSIFIER_URL = (configuredUrl() ?? DEFAULT_URL).replace(/\/+$/, "");

/** Similarity above which two reports are probably the same scene. Untuned guess. */
export const PHOTO_DUPLICATE_SIM = 0.92;

export const CLASSIFIER_LABELS = [
  "road_damage",
  "garbage",
  "water_issue",
  "streetlight",
  "pollution",
  "not_civic",
] as const;

export type ClassifierLabel = (typeof CLASSIFIER_LABELS)[number];
export type CivicClassifierLabel = Exclude<ClassifierLabel, "not_civic">;

export type ClassifierResult = {
  label: ClassifierLabel;
  probabilities: Record<ClassifierLabel, number>;
  confidence: number;
  best_civic_label: CivicClassifierLabel;
  is_civic: boolean;
  needs_review: boolean;
  embedding: number[];
  model: string;
};

export const CLASSIFIER_LABEL_TEXT: Record<CivicClassifierLabel, string> = {
  road_damage: "road / pothole damage",
  garbage: "garbage or litter",
  water_issue: "waterlogging or a leak",
  streetlight: "a streetlight",
  pollution: "pollution",
};

// The classifier merges water leaks and waterlogging into one class, and has no
// image signature for noise. Everything else maps one-to-one.
const FAMILY: Record<Category, ClassifierLabel | null> = {
  road_damage: "road_damage",
  garbage: "garbage",
  water_leak: "water_issue",
  waterlogging: "water_issue",
  streetlight: "streetlight",
  pollution: "pollution",
  noise: null,
  other: null,
};

const CATEGORY_FOR: Record<CivicClassifierLabel, Category> = {
  road_damage: "road_damage",
  garbage: "garbage",
  water_issue: "waterlogging",
  streetlight: "streetlight",
  pollution: "pollution",
};

/** The classifier class that should correspond to an app category, if any. */
export function classifierFamily(category: Category): ClassifierLabel | null {
  return FAMILY[category];
}

/** True when the classifier's best civic guess contradicts the VLM's category. */
export function disagrees(category: Category, clf: ClassifierResult): boolean {
  const family = FAMILY[category];
  return family !== null && family !== clf.best_civic_label;
}

/** Best app category implied by the classifier, used only when the VLM fails. */
export function categoryForClassifierLabel(label: CivicClassifierLabel): Category {
  return CATEGORY_FOR[label];
}

/**
 * Classify one photo. Returns null on any failure — callers must treat null as
 * "classifier unavailable" and carry on with the VLM alone.
 */
export async function classifyImage(image: Blob, timeoutMs = 25_000): Promise<ClassifierResult | null> {
  try {
    const form = new FormData();
    form.append("file", image, "photo.jpg");
    const res = await fetch(`${CLASSIFIER_URL}/classify`, {
      method: "POST",
      body: form,
      // A cold container can take tens of seconds to answer the first request.
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    const candidate = data as ClassifierResult;
    if (typeof candidate.label !== "string" || !Array.isArray(candidate.embedding)) return null;
    return candidate;
  } catch {
    return null;
  }
}

/** Embeddings are L2-normalised by the service, so similarity is a dot product. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

/** Pull a stored embedding back out of a report's `ai_json` column. */
export function storedEmbedding(aiJson: unknown): number[] | null {
  if (!aiJson || typeof aiJson !== "object") return null;
  const clf = (aiJson as { classifier?: unknown }).classifier;
  if (!clf || typeof clf !== "object") return null;
  const embedding = (clf as { embedding?: unknown }).embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) return null;
  return embedding.every((v) => typeof v === "number") ? (embedding as number[]) : null;
}
