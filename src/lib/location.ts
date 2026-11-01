// Location hierarchy for filtering and grouping reports: state → city → area.
// Comes from reverse geocoding at submission (enrich.server.ts); missing parts are "Unknown".

export type Loc = { state: string; city: string; area: string };
export type LocLevel = keyof Loc;
/** Empty string means "any" at that level. */
export type LocFilter = Loc;

export const UNKNOWN = "Unknown";
export const ANY_LOCATION: LocFilter = { state: "", city: "", area: "" };
export const LEVEL_LABEL: Record<LocLevel, string> = { state: "State", city: "City", area: "Area" };

type Locatable = { area_name: string | null; city: string | null; live_context?: unknown };

export function locationOf(r: Locatable): Loc {
  const state = (r.live_context as { state?: string | null } | null)?.state;
  return { state: state || UNKNOWN, city: r.city || UNKNOWN, area: r.area_name || UNKNOWN };
}

export function matchesLocation(loc: Loc, f: LocFilter): boolean {
  return (!f.state || loc.state === f.state) && (!f.city || loc.city === f.city) && (!f.area || loc.area === f.area);
}

/** Distinct values at one level, restricted by the levels above it, most reports first. */
export function locationOptions(locs: Loc[], level: LocLevel, f: LocFilter): [string, number][] {
  const parent: LocFilter =
    level === "state" ? ANY_LOCATION : level === "city" ? { ...ANY_LOCATION, state: f.state } : { ...ANY_LOCATION, state: f.state, city: f.city };
  const counts = new Map<string, number>();
  for (const l of locs) if (matchesLocation(l, parent)) counts.set(l[level], (counts.get(l[level]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Label for a group at `level`, with enough of its parents to be unambiguous. */
export function groupKey(loc: Loc, level: LocLevel): string {
  if (level === "state") return loc.state;
  if (level === "city") return loc.state === UNKNOWN ? loc.city : `${loc.city}, ${loc.state}`;
  return loc.city === UNKNOWN ? loc.area : `${loc.area}, ${loc.city}`;
}

/** Filter that selects exactly one group, used when a grouped row is clicked. */
export function filterForGroup(loc: Loc, level: LocLevel): LocFilter {
  if (level === "state") return { ...ANY_LOCATION, state: loc.state };
  if (level === "city") return { ...ANY_LOCATION, state: loc.state, city: loc.city };
  return { state: loc.state, city: loc.city, area: loc.area };
}
