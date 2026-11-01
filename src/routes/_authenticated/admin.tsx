import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/severity";
import { EmptyState, ReportPhoto, SeverityBadge, SlaCountdown, StatusBadge } from "@/components/civic";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Civic Pulse" }] }),
  component: Admin,
});

// Admins can read the raw table (RLS), which carries the classifier's opinion in ai_json.
const adminReportsQuery = queryOptions({
  queryKey: ["admin_reports"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("id, ticket_id, category, description, ai_summary, ai_json, ai_confidence, severity, severity_override, status, needs_review, review_reason, duplicate_of, report_count, sla_deadline, photo_url, area_name, city, created_at, deleted_at, deleted_reason")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },
});
type Row = Awaited<ReturnType<NonNullable<typeof adminReportsQuery.queryFn>>>[number];

const STATUSES = ["open", "in_progress", "escalated", "resolved", "rejected"] as const;
const STATUS_TEXT: Record<string, string> = { open: "Open", in_progress: "In progress", escalated: "Escalated", resolved: "Resolved", rejected: "Rejected" };

function classifierOf(r: Row) {
  const c = (r.ai_json as { classifier?: { label?: string; confidence?: number; is_civic?: boolean } } | null)?.classifier;
  return c?.label ? c : null;
}

function Admin() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ ...adminReportsQuery, enabled: isAdmin, refetchInterval: 20_000 });
  const [tab, setTab] = useState<"review" | "active" | "all" | "deleted">("review");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => ({
    review: data.filter((r) => !r.deleted_at && r.needs_review && r.status !== "resolved" && r.status !== "rejected").length,
    active: data.filter((r) => !r.deleted_at && r.status !== "resolved" && r.status !== "rejected").length,
    all: data.filter((r) => !r.deleted_at).length,
    deleted: data.filter((r) => r.deleted_at).length,
  }), [data]);

  const rows = useMemo(() => data.filter((r) => {
    if (tab === "deleted") return !!r.deleted_at;
    if (r.deleted_at) return false;
    if (tab === "all") return true;
    const active = r.status !== "resolved" && r.status !== "rejected";
    return tab === "active" ? active : active && r.needs_review;
  }).sort((a, b) => (b.severity_override ?? b.severity) - (a.severity_override ?? a.severity)), [data, tab]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["admin_reports"] });
    qc.invalidateQueries({ queryKey: ["public_reports"] });
  }

  if (!loading && !isAdmin)
    return <div className="mx-auto max-w-6xl px-4 py-10"><EmptyState title="Admins only">Ask a team admin to grant you the admin role.</EmptyState></div>;

  const tabBtn = (k: typeof tab, label: string) => (
    <button
      key={k}
      onClick={() => setTab(k)}
      className={`rounded-sm border px-3 py-1.5 text-sm ${tab === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {label} <span className="ml-1 font-mono text-xs opacity-80">{counts[k]}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review flagged reports, correct the AI, and move tickets along. Every action is written to the public audit log.</p>
        </div>
        <Link to="/dashboard" className="text-sm text-primary underline-offset-2 hover:underline">← Dashboard</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabBtn("review", "Needs review")}
        {tabBtn("active", "Active")}
        {tabBtn("all", "All")}
        {tabBtn("deleted", "Deleted")}
      </div>

      {!isLoading && rows.length === 0 ? (
        <div className="mt-6"><EmptyState title={tab === "review" ? "Review queue is clear." : "Nothing here."} /></div>
      ) : (
        <div className="mt-4 divide-y rounded-md border bg-card shadow-card">
          {rows.map((r) => {
            const clf = classifierOf(r);
            const open = openId === r.id;
            return (
              <div key={r.id} className="p-4">
                <button className="grid w-full grid-cols-[64px_1fr_auto] items-start gap-4 text-left" onClick={() => setOpenId(open ? null : r.id)}>
                  <ReportPhoto path={r.photo_url} alt={r.ai_summary ?? "Report photo"} className="h-16 w-16 rounded-sm" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-primary">{r.ticket_id}</span>
                      <span className="text-muted-foreground">{CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}</span>
                      {(r.report_count ?? 1) > 1 && <span className="text-muted-foreground">×{r.report_count}</span>}
                      {r.duplicate_of && <span className="rounded-sm border px-1.5 text-muted-foreground">duplicate</span>}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm">{r.ai_summary ?? r.description}</p>
                    {r.needs_review && r.review_reason && <p className="mt-1 text-xs text-destructive">⚑ {r.review_reason}</p>}
                    {r.deleted_at && <p className="mt-1 text-xs text-muted-foreground">Deleted: {r.deleted_reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <SeverityBadge value={r.severity_override ?? r.severity} />
                    <StatusBadge status={r.status} />
                    <SlaCountdown deadline={r.sla_deadline} status={r.status} />
                  </div>
                </button>
                {open && <Editor r={r} clf={clf} run={run} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Editor({ r, clf, run }: {
  r: Row;
  clf: ReturnType<typeof classifierOf>;
  run: (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => Promise<unknown>;
}) {
  const [note, setNote] = useState("");
  const [category, setCategory] = useState(r.category);
  const [sev, setSev] = useState<string>(r.severity_override ? String(r.severity_override) : "");
  const field = "h-9 rounded-sm border bg-background px-2 text-sm";
  const reason = note.trim();

  return (
    <div className="mt-4 grid gap-4 rounded-md border bg-muted/40 p-4 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        <p><span className="text-muted-foreground">Citizen wrote:</span> {r.description || "—"}</p>
        <p><span className="text-muted-foreground">VLM:</span> {r.category} · confidence {r.ai_confidence != null ? `${Math.round(Number(r.ai_confidence) * 100)}%` : "n/a"}</p>
        <p><span className="text-muted-foreground">CLIP classifier:</span> {clf ? `${clf.label} · ${Math.round((clf.confidence ?? 0) * 100)}%${clf.is_civic === false ? " · may not be civic" : ""}` : "not run"}</p>
        <p><span className="text-muted-foreground">Computed severity:</span> {r.severity}/5{r.severity_override ? ` · overridden to ${r.severity_override}/5` : ""}</p>
        <p><span className="text-muted-foreground">Location:</span> {[r.area_name, r.city].filter(Boolean).join(", ") || "—"}</p>
        <Link to="/issues/$ticketId" params={{ ticketId: r.ticket_id }} className="text-primary underline-offset-2 hover:underline">Open public ticket →</Link>
      </div>
      <div className="space-y-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note / reason (required for severity override and delete)"
          className="min-h-16 w-full rounded-sm border bg-background p-2 text-sm"
        />
        {r.deleted_at ? (
          <Button size="sm" onClick={() => run(supabase.rpc("admin_restore", { _report_id: r.id, _reason: reason }), `${r.ticket_id} restored`)}>Restore</Button>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== r.status).map((s) => (
                <Button key={s} size="sm" variant={s === "resolved" ? "default" : "outline"}
                  onClick={() => run(supabase.rpc("set_report_status", { _report_id: r.id, _status: s, ...(reason ? { _note: reason } : {}) }), `${r.ticket_id} → ${STATUS_TEXT[s]}`)}>
                  {STATUS_TEXT[s]}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <select className={field} value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity override">
                <option value="">Computed severity</option>
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Override: {v}/5</option>)}
              </select>
              <Button size="sm" variant="outline"
                onClick={() => {
                  const patch: { needs_review: boolean; category?: string; severity_override?: string } = { needs_review: false };
                  if (category !== r.category) patch.category = category;
                  if (sev !== (r.severity_override ? String(r.severity_override) : "")) patch.severity_override = sev;
                  return run(supabase.rpc("admin_update_report", { _report_id: r.id, _patch: patch as never, _reason: reason }), `${r.ticket_id} reviewed`);
                }}>
                Save & clear review
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive"
              onClick={() => reason ? run(supabase.rpc("admin_soft_delete", { _report_id: r.id, _reason: reason }), `${r.ticket_id} deleted`) : toast.error("Write a reason first")}>
              Delete (spam / invalid)
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
