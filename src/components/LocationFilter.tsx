import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ANY_LOCATION,
  LEVEL_LABEL,
  filterForGroup,
  groupKey,
  locationOptions,
  matchesLocation,
  type Loc,
  type LocFilter,
  type LocLevel,
} from "@/lib/location";

const sel = "h-9 rounded-sm border bg-card px-2 text-sm";

/** Cascading State → City → Area selects. Changing a level clears the levels below it. */
export function LocationFilter({ locs, value, onChange }: { locs: Loc[]; value: LocFilter; onChange: (f: LocFilter) => void }) {
  const set = (level: LocLevel, v: string) =>
    onChange(
      level === "state" ? { state: v, city: "", area: "" } : level === "city" ? { ...value, city: v, area: "" } : { ...value, area: v },
    );
  const active = value.state || value.city || value.area;
  return (
    <>
      {(["state", "city", "area"] as const).map((level) => (
        <select key={level} className={sel} value={value[level]} onChange={(e) => set(level, e.target.value)} aria-label={LEVEL_LABEL[level]}>
          <option value="">All {LEVEL_LABEL[level] === "City" ? "cities" : `${LEVEL_LABEL[level].toLowerCase()}s`}</option>
          {locationOptions(locs, level, value).map(([v, n]) => (
            <option key={v} value={v}>{v} ({n})</option>
          ))}
        </select>
      ))}
      {active && (
        <button className="text-sm text-primary underline-offset-2 hover:underline" onClick={() => onChange(ANY_LOCATION)}>
          Clear location
        </button>
      )}
    </>
  );
}

export type LocationGroup = { key: string; loc: Loc; total: number; active: number; breached: number; resolved: number };

/** Count rows per location group. `rows` must already be filtered the way the page wants. */
export function useLocationGroups<T>(
  rows: T[],
  level: LocLevel,
  get: (r: T) => { loc: Loc; active: boolean; breached: boolean; resolved: boolean },
): LocationGroup[] {
  return useMemo(() => {
    const m = new Map<string, LocationGroup>();
    for (const r of rows) {
      const g = get(r);
      const key = groupKey(g.loc, level);
      const v = m.get(key) ?? { key, loc: g.loc, total: 0, active: 0, breached: 0, resolved: 0 };
      v.total++;
      if (g.active) v.active++;
      if (g.breached) v.breached++;
      if (g.resolved) v.resolved++;
      m.set(key, v);
    }
    return [...m.values()].sort((a, b) => b.active - a.active || b.total - a.total);
    // `get` is a pure accessor; callers pass an inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, level]);
}

/** State / City / Area toggle for grouped views. */
export function LevelToggle({ value, onChange }: { value: LocLevel; onChange: (l: LocLevel) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border text-xs">
      {(["state", "city", "area"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn("px-2.5 py-1", value === l ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
        >
          {LEVEL_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** Grouped location table; clicking a row narrows the page's location filter to that group. */
export function LocationTable({ groups, level, filter, onPick }: { groups: LocationGroup[]; level: LocLevel; filter: LocFilter; onPick: (f: LocFilter) => void }) {
  if (!groups.length) return <p className="p-4 text-sm text-muted-foreground">No reports in this selection.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr><th className="p-3">{LEVEL_LABEL[level]}</th><th className="p-3 text-right">Active</th><th className="p-3 text-right">Breached</th><th className="p-3 text-right">Resolved</th></tr>
      </thead>
      <tbody className="divide-y">
        {groups.map((g) => {
          const selected = matchesLocation(g.loc, filter) && filter[level] === g.loc[level];
          return (
            <tr key={g.key} className={cn("cursor-pointer hover:bg-muted/50", selected && "bg-accent/20")} onClick={() => onPick(filterForGroup(g.loc, level))}>
              <td className="p-3">{g.key}</td>
              <td className="p-3 text-right font-mono text-xs">{g.active}</td>
              <td className={cn("p-3 text-right font-mono text-xs", g.breached > 0 && "font-semibold text-destructive")}>{g.breached}</td>
              <td className="p-3 text-right font-mono text-xs">{g.resolved}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
