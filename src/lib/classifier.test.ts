import { describe, expect, it } from "vitest";
import {
  categoryForClassifierLabel,
  classifierFamily,
  cosine,
  disagrees,
  storedEmbedding,
  type ClassifierResult,
} from "./classifier";

function result(overrides: Partial<ClassifierResult> = {}): ClassifierResult {
  return {
    label: "road_damage",
    probabilities: {
      road_damage: 0.9,
      garbage: 0.02,
      water_issue: 0.02,
      streetlight: 0.02,
      pollution: 0.02,
      not_civic: 0.02,
    },
    confidence: 0.9,
    best_civic_label: "road_damage",
    is_civic: true,
    needs_review: false,
    embedding: [1, 0, 0],
    model: "ViT-B-32/openai frozen + logistic-regression head",
    ...overrides,
  };
}

describe("classifier label mapping", () => {
  it("maps both water categories onto the merged water_issue class", () => {
    expect(classifierFamily("water_leak")).toBe("water_issue");
    expect(classifierFamily("waterlogging")).toBe("water_issue");
  });

  it("has no image family for noise or other", () => {
    expect(classifierFamily("noise")).toBeNull();
    expect(classifierFamily("other")).toBeNull();
  });

  it("falls back to waterlogging for the merged class", () => {
    expect(categoryForClassifierLabel("water_issue")).toBe("waterlogging");
  });
});

describe("disagrees", () => {
  it("is false when the classes match", () => {
    expect(disagrees("road_damage", result())).toBe(false);
  });

  it("is true when the classes differ", () => {
    expect(disagrees("garbage", result())).toBe(true);
  });

  it("is false for a water leak, since the classifier merges it", () => {
    expect(disagrees("water_leak", result({ best_civic_label: "water_issue" }))).toBe(false);
  });

  it("never disagrees for noise, which has no image signature", () => {
    expect(disagrees("noise", result())).toBe(false);
  });
});

describe("cosine", () => {
  it("is 1 for identical unit vectors", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("tolerates mismatched lengths", () => {
    expect(cosine([1, 0, 0], [1, 0])).toBeCloseTo(1);
  });
});

describe("storedEmbedding", () => {
  it("reads the embedding out of ai_json", () => {
    expect(storedEmbedding({ classifier: { embedding: [0.1, 0.2] } })).toEqual([0.1, 0.2]);
  });

  it("returns null when the report predates the classifier", () => {
    expect(storedEmbedding({ category: "garbage" })).toBeNull();
    expect(storedEmbedding(null)).toBeNull();
    expect(storedEmbedding({ classifier: null })).toBeNull();
  });

  it("rejects non-numeric arrays", () => {
    expect(storedEmbedding({ classifier: { embedding: ["a"] } })).toBeNull();
  });
});
