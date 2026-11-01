import { describe, expect, it } from "vitest";
import { computeSeverity, slaDeadline, DEPARTMENT_FOR } from "./severity";

const base = {
  size_estimate: "small" as const,
  people_at_risk: false,
  blocks_traffic_or_access: false,
  road_type: "local" as const,
  near_school_or_hospital: false,
  rain_mm_last_24h: 0,
  aqi: null,
};

describe("severity formula", () => {
  it("small garbage pile scores 1", () => {
    expect(computeSeverity({ ...base, category: "garbage" }).score).toBe(1);
  });
  it("large pothole on arterial road blocking traffic near school is capped at 5", () => {
    const r = computeSeverity({
      ...base,
      category: "road_damage",
      size_estimate: "large",
      blocks_traffic_or_access: true,
      road_type: "arterial",
      near_school_or_hospital: true,
      people_at_risk: true,
    });
    expect(r.score).toBe(5);
  });
  it("unavailable live data adds nothing", () => {
    const r = computeSeverity({ ...base, category: "waterlogging", near_school_or_hospital: null, rain_mm_last_24h: null });
    expect(r.score).toBe(2);
  });
  it("critical tickets get a 24 hour SLA", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(slaDeadline(5, from).toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
  it("noise routes to police, water leak to water board", () => {
    expect(DEPARTMENT_FOR.noise).toBe("police");
    expect(DEPARTMENT_FOR.water_leak).toBe("water");
  });
});
