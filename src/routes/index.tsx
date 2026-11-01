import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { isActive, isBreached, isOriginal, publicReportsQuery } from "@/lib/queries";
import { IssuesMap } from "@/components/LazyMaps";
import { EmptyState, SeverityBadge, StatusBadge } from "@/components/civic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Civic Pulse — Report civic issues, track accountability" },
      { name: "description", content: "Photograph a pothole, leak or garbage pile. AI scores severity, routes it to the responsible authority and tracks it publicly." },
      { property: "og:title", content: "Civic Pulse — Report civic issues, track accountability" },
      { property: "og:description", content: "Transparent civic grievance triage with public SLAs." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data = [], isLoading } = useQuery(publicReportsQuery);
  const total = data.length;
  const issues = data.filter(isOriginal);
  const open = issues.filter(isActive).length;
  const resolved = issues.filter((r) => r.status === "resolved").length;
  const breached = issues.filter((r) => isBreached(r)).length;

  return (
    <div>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest opacity-80">Public grievance ledger</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
              See it. Snap it. <span className="text-accent">Hold it to account.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base opacity-90">
              Report a pothole, leak, garbage pile or broken streetlight. AI reads the photo, a published formula scores
              severity, and the issue is routed to the responsible authority with a public deadline.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary"><Link to="/report">Report an issue</Link></Button>
              <Button asChild size="lg" variant="ghost" className="border border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/how-it-works">How severity is scored</Link>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px self-end overflow-hidden rounded-md bg-primary-foreground/20">
            {[
              ["Reports filed", total],
              ["Open now", open],
              ["Resolved", resolved],
              ["SLA breached", breached],
            ].map(([k, v]) => (
              <div key={k} className="bg-primary/60 p-5">
                <dt className="text-xs uppercase tracking-wide opacity-80">{k}</dt>
                <dd className="mt-1 font-mono text-3xl font-semibold">{isLoading ? "–" : v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Latest reports</h2>
          <Link to="/issues" className="text-sm font-medium text-primary underline-offset-4 hover:underline">All issues →</Link>
        </div>
        {!isLoading && total === 0 ? (
          <div className="mt-6">
            <EmptyState title="No reports yet. Be the first to report an issue.">
              <Link to="/report" className="font-medium text-primary underline">File the first report</Link>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.1fr]">
            <ul className="divide-y rounded-md border bg-card shadow-card">
              {data.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to="/issues/$ticketId" params={{ ticketId: r.ticket_id! }} className="block p-4 hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{r.ticket_id}</span>
                      <SeverityBadge value={r.severity ?? 1} />
                      <StatusBadge status={r.status ?? "open"} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{r.ai_summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{[r.area_name, r.city].filter(Boolean).join(", ")} · {r.department_name}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <IssuesMap
              className="h-[420px] rounded-md border"
              pins={data.map((r) => ({ ticket_id: r.ticket_id!, lat: r.lat!, lon: r.lon!, severity: r.severity ?? 1, ai_summary: r.ai_summary, status: r.status! }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
