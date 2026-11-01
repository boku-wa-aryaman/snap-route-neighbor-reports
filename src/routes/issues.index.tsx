import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isActive, isBreached, isOriginal, publicReportsQuery } from "@/lib/queries";
import { ANY_LOCATION, locationOf, matchesLocation, type LocLevel } from "@/lib/location";
import { LevelToggle, LocationFilter, LocationTable, useLocationGroups } from "@/components/LocationFilter";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/severity";
import { IssuesMap } from "@/components/LazyMaps";
import { EmptyState, SeverityBadge, SlaCountdown, StatusBadge } from "@/components/civic";

export const Route = createFileRoute("/issues/")({
  head: () => ({
    meta: [
      { title: "Public issues — Civic Pulse" },
      { name: "description", content: "Every reported civic issue, its severity, responsible department and SLA status." },
      { property: "og:title", content: "Public issues — Civic Pulse" },
      { property: "og:description", content: "Live map and list of reported civic issues." },
    ],
  }),
  component: Issues,
});

function Issues() {
  const { data = [], isLoading } = useQuery(publicReportsQuery);
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("active");
  const [loc, setLoc] = useState(ANY_LOCATION);
  const [level, setLevel] = useState<LocLevel>("city");
  const issues = useMemo(() => data.filter(isOriginal), [data]);
  const locs = useMemo(() => issues.map(locationOf), [issues]);
  const inLocation = useMemo(() => issues.filter((r) => matchesLocation(locationOf(r), loc)), [issues, loc]);
  const rows = useMemo(
    () =>
      inLocation
        .filter((r) => cat === "all" || r.category === cat)
        .filter((r) => status === "all" || (status === "active" ? isActive(r) : r.status === status))
        .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || +new Date(b.created_at!) - +new Date(a.created_at!)),
    [inLocation, cat, status],
  );
  const groups = useLocationGroups(inLocation, level, (r) => ({
    loc: locationOf(r),
    active: isActive(r),
    breached: isBreached(r),
    resolved: r.status === "resolved",
  }));

  const sel = "h-9 rounded-sm border bg-card px-2 text-sm";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Public issues</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ranked by severity. Every number here is computed live from filed reports.</p>

      {!isLoading && data.length === 0 ? (
        <div className="mt-8"><EmptyState title="No reports yet. Be the first to report an issue."><Link to="/report" className="text-primary underline">Report an issue</Link></EmptyState></div>
      ) : (
        <>
          <IssuesMap
            className="mt-6 h-[380px] rounded-md border"
            pins={rows.map((r) => ({ ticket_id: r.ticket_id!, lat: r.lat!, lon: r.lon!, severity: r.severity ?? 1, ai_summary: r.ai_summary, status: r.status! }))}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
                  <option value="all">All categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                  <option value="active">Active</option>
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
                <LocationFilter locs={locs} value={loc} onChange={setLoc} />
                <span className="self-center text-sm text-muted-foreground">{rows.length} shown</span>
              </div>
              <div className="mt-4 overflow-x-auto rounded-md border bg-card shadow-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="p-3">Ticket</th><th className="p-3">Issue</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Department</th><th className="p-3">SLA</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/50">
                        <td className="p-3 font-mono text-xs"><Link to="/issues/$ticketId" params={{ ticketId: r.ticket_id! }} className="text-primary underline-offset-2 hover:underline">{r.ticket_id}</Link>{(r.report_count ?? 1) > 1 && <span className="ml-1 text-muted-foreground">×{r.report_count}</span>}</td>
                        <td className="max-w-xs p-3"><p className="line-clamp-2">{r.ai_summary}</p><p className="text-xs text-muted-foreground">{[r.area_name, r.city].filter(Boolean).join(", ")}</p></td>
                        <td className="p-3"><SeverityBadge value={r.severity ?? 1} /></td>
                        <td className="p-3"><StatusBadge status={r.status!} /></td>
                        <td className="p-3 text-xs">{r.department_name}</td>
                        <td className="p-3"><SlaCountdown deadline={r.sla_deadline} status={r.status!} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No issues match these filters.</p>}
              </div>
            </div>
            <aside>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">By location</h2>
                <LevelToggle value={level} onChange={setLevel} />
              </div>
              <div className="mt-3 overflow-hidden rounded-md border bg-card">
                <LocationTable groups={groups} level={level} filter={loc} onPick={setLoc} />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
