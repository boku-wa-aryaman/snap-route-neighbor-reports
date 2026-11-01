import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { isActive, isBreached, isOriginal, publicReportsQuery } from "@/lib/queries";
import { ANY_LOCATION, LEVEL_LABEL, locationOf, matchesLocation, type LocLevel } from "@/lib/location";
import { LevelToggle, LocationFilter, LocationTable, useLocationGroups } from "@/components/LocationFilter";
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_LABEL } from "@/lib/severity";
import { IssuesMap } from "@/components/LazyMaps";
import { EmptyState, SeverityBadge, SlaCountdown, StatusBadge } from "@/components/civic";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Civic Pulse" }] }),
  component: Dashboard,
});

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string | undefined; tone?: string }) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr_36px] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
        <div className={`h-full rounded-sm ${cls}`} style={{ width: `${max ? (100 * value) / max : 0}%` }} />
      </div>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function Dashboard() {
  const { isStaff, loading } = useAuth();
  const { data: all = [], isLoading } = useQuery(publicReportsQuery);
  const qc = useQueryClient();
  // Officials and admins may both do this (set_report_status checks the role server-side).
  async function setStatus(id: string, ticket: string, status: "in_progress" | "resolved") {
    const { error } = await supabase.rpc("set_report_status", { _report_id: id, _status: status });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ticket} → ${status === "resolved" ? "Resolved" : "In progress"}`);
    qc.invalidateQueries();
  }
  const [loc, setLoc] = useState(ANY_LOCATION);
  const [level, setLevel] = useState<LocLevel>("city");
  const locs = useMemo(() => all.filter(isOriginal).map(locationOf), [all]);
  // Everything below, including the map and charts, follows the location filter.
  const data = useMemo(() => all.filter((r) => matchesLocation(locationOf(r), loc)), [all, loc]);
  const groups = useLocationGroups(data.filter(isOriginal), level, (r) => ({
    loc: locationOf(r),
    active: isActive(r),
    breached: isBreached(r),
    resolved: r.status === "resolved",
  }));

  const s = useMemo(() => {
    const issues = data.filter(isOriginal);
    const active = issues.filter(isActive);
    const now = Date.now();
    const breached = active.filter((r) => isBreached(r, now));
    const resolved = issues.filter((r) => r.status === "resolved");
    const resolveHours = resolved.map((r) => (+new Date(r.updated_at!) - +new Date(r.created_at!)) / 3600_000);
    const byCat = CATEGORIES.map((c) => [c, active.filter((r) => r.category === c).length] as const).filter(([, n]) => n > 0);
    const bySev = [5, 4, 3, 2, 1].map((v) => [v, active.filter((r) => (r.severity ?? 1) === v).length] as const);
    const depts = new Map<string, { open: number; breached: number; resolved: number }>();
    for (const r of issues) {
      const k = r.department_name ?? "Unassigned";
      const d = depts.get(k) ?? { open: 0, breached: 0, resolved: 0 };
      if (isActive(r)) d.open++;
      if (r.status === "resolved") d.resolved++;
      if (isBreached(r, now)) d.breached++;
      depts.set(k, d);
    }
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(now - (13 - i) * 86400_000);
      const key = d.toDateString();
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, n: data.filter((r) => new Date(r.created_at!).toDateString() === key).length };
    });
    const urgent = [...active]
      .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || +new Date(a.sla_deadline ?? 0) - +new Date(b.sla_deadline ?? 0))
      .slice(0, 8);
    return {
      issues, active, breached, resolved, byCat, bySev, days, urgent,
      depts: [...depts.entries()].sort((a, b) => b[1].open - a[1].open),
      review: active.filter((r) => r.needs_review).length,
      merged: data.length - issues.length,
      avgFix: resolveHours.length ? resolveHours.reduce((a, b) => a + b, 0) / resolveHours.length : null,
    };
  }, [data]);

  if (!loading && !isStaff)
    return <div className="mx-auto max-w-6xl px-4 py-10"><EmptyState title="Staff only">The dashboard is for officials and admins.</EmptyState></div>;

  const maxCat = Math.max(1, ...s.byCat.map(([, n]) => n));
  const maxSev = Math.max(1, ...s.bySev.map(([, n]) => n));
  const maxDay = Math.max(1, ...s.days.map((d) => d.n));
  const fix = s.avgFix == null ? "–" : s.avgFix < 48 ? `${s.avgFix.toFixed(1)}h` : `${(s.avgFix / 24).toFixed(1)}d`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold">Operations dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aggregate view for the teams fixing issues. Live from filed reports, refreshed every 15 seconds.</p>
        </div>
        <Link to="/admin" className="text-sm text-primary underline-offset-2 hover:underline">Open review queue →</Link>
      </div>

      {all.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Location</span>
          <LocationFilter locs={locs} value={loc} onChange={setLoc} />
        </div>
      )}

      {!isLoading && data.length === 0 ? (
        <div className="mt-8"><EmptyState title={all.length ? "No reports in this location." : "No reports yet."}>Numbers appear here as soon as citizens file reports.</EmptyState></div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Active issues" value={s.active.length} hint={`${s.issues.length} total`} />
            <Stat label="SLA breached" value={s.breached.length} tone={s.breached.length ? "text-destructive" : ""} hint="past deadline, still open" />
            <Stat label="Needs review" value={s.review} hint="AI unsure or models disagree" />
            <Stat label="Resolved" value={s.resolved.length} hint={s.issues.length ? `${Math.round((100 * s.resolved.length) / s.issues.length)}% of issues` : undefined} />
            <Stat label="Avg time to fix" value={fix} hint="filed → resolved" />
            <Stat label="Duplicates merged" value={s.merged} hint="same spot, same issue" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-lg font-semibold">Active issues map</h2>
              <IssuesMap
                className="mt-3 h-[360px] rounded-md border"
                pins={s.active.map((r) => ({ ticket_id: r.ticket_id!, lat: r.lat!, lon: r.lon!, severity: r.severity ?? 1, ai_summary: r.ai_summary, status: r.status! }))}
              />
            </div>
            <div className="space-y-6">
              <section className="rounded-md border bg-card p-4 shadow-card">
                <h2 className="font-semibold">Active by category</h2>
                <div className="mt-3 space-y-2.5">
                  {s.byCat.length ? s.byCat.map(([c, n]) => <Bar key={c} label={CATEGORY_LABELS[c]} value={n} max={maxCat} cls="bg-primary" />)
                    : <p className="text-sm text-muted-foreground">Nothing active.</p>}
                </div>
              </section>
              <section className="rounded-md border bg-card p-4 shadow-card">
                <h2 className="font-semibold">Active by severity</h2>
                <div className="mt-3 space-y-2.5">
                  {s.bySev.map(([v, n]) => <Bar key={v} label={`${v}/5 ${SEVERITY_LABEL[v]}`} value={n} max={maxSev} cls={`bg-sev-${v}`} />)}
                </div>
              </section>
            </div>
          </div>

          <section className="mt-8 rounded-md border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
              <h2 className="font-semibold">By location <span className="text-xs font-normal text-muted-foreground">grouped by {LEVEL_LABEL[level].toLowerCase()}, click a row to focus on it</span></h2>
              <LevelToggle value={level} onChange={setLevel} />
            </div>
            <LocationTable groups={groups} level={level} filter={loc} onPick={setLoc} />
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-md border bg-card p-4 shadow-card">
              <h2 className="font-semibold">Reports per day <span className="text-xs font-normal text-muted-foreground">last 14 days</span></h2>
              <div className="mt-4 flex h-36 items-end gap-1.5">
                {s.days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.n}`}>
                    <span className="font-mono text-[10px] text-muted-foreground">{d.n || ""}</span>
                    <div className={`w-full rounded-sm ${d.n ? "bg-primary" : "bg-muted"}`} style={{ height: `${Math.max(3, (100 * d.n) / maxDay)}px` }} />
                    <span className="text-[10px] text-muted-foreground">{i % 2 ? d.label : ""}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-md border bg-card shadow-card">
              <h2 className="p-4 pb-2 font-semibold">Departments</h2>
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="p-3">Department</th><th className="p-3 text-right">Open</th><th className="p-3 text-right">Breached</th><th className="p-3 text-right">Resolved</th></tr>
                </thead>
                <tbody className="divide-y">
                  {s.depts.map(([k, d]) => (
                    <tr key={k}>
                      <td className="p-3">{k}</td>
                      <td className="p-3 text-right font-mono text-xs">{d.open}</td>
                      <td className={`p-3 text-right font-mono text-xs ${d.breached ? "font-semibold text-destructive" : ""}`}>{d.breached}</td>
                      <td className="p-3 text-right font-mono text-xs">{d.resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <h2 className="mt-8 text-lg font-semibold">Most urgent</h2>
          <div className="mt-3 overflow-x-auto rounded-md border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3">Ticket</th><th className="p-3">Issue</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Department</th><th className="p-3">SLA</th><th className="p-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y">
                {s.urgent.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="p-3 font-mono text-xs"><Link to="/issues/$ticketId" params={{ ticketId: r.ticket_id! }} className="text-primary underline-offset-2 hover:underline">{r.ticket_id}</Link>{(r.report_count ?? 1) > 1 && <span className="ml-1 text-muted-foreground">×{r.report_count}</span>}</td>
                    <td className="max-w-xs p-3"><p className="line-clamp-2">{r.ai_summary}</p><p className="text-xs text-muted-foreground">{[r.area_name, r.city].filter(Boolean).join(", ")}</p></td>
                    <td className="p-3"><SeverityBadge value={r.severity ?? 1} /></td>
                    <td className="p-3"><StatusBadge status={r.status!} /></td>
                    <td className="p-3 text-xs">{r.department_name}</td>
                    <td className="p-3"><SlaCountdown deadline={r.sla_deadline} status={r.status!} /></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id!, r.ticket_id!, "in_progress")}>Start</Button>}
                        <Button size="sm" onClick={() => setStatus(r.id!, r.ticket_id!, "resolved")}>Resolve</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.urgent.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No active issues.</p>}
          </div>
        </>
      )}
    </div>
  );
}
