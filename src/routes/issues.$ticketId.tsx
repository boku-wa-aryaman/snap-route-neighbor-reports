import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { reportQuery } from "@/lib/queries";
import { CATEGORY_LABELS, type Category } from "@/lib/severity";
import { EmptyState, ReportPhoto, SeverityBadge, SlaCountdown, StatusBadge } from "@/components/civic";
import { IssuesMap } from "@/components/LazyMaps";

export const Route = createFileRoute("/issues/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket — Civic Pulse" },
      { name: "description", content: "Status, severity, photo and history of a reported civic issue." },
      { property: "og:title", content: "Civic issue ticket — Civic Pulse" },
      { property: "og:description", content: "Status, severity and history of a reported civic issue." },
    ],
  }),
  component: TicketPage,
});

function formatWhen(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { data, isLoading } = useQuery(reportQuery(ticketId));

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm text-muted-foreground">Loading ticket…</p>
      </div>
    );

  const report = data?.report ?? null;
  if (!report)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title={`No ticket ${ticketId}`}>
          It may have been removed, or the link is wrong.{" "}
          <Link to="/issues" className="text-primary underline">
            See all issues
          </Link>
          .
        </EmptyState>
      </div>
    );

  const category = (report.category ?? "other") as Category;
  const events = data?.events ?? [];
  const place =
    [report.area_name, report.city].filter(Boolean).join(", ") ||
    (report.lat !== null && report.lon !== null ? `${report.lat.toFixed(5)}, ${report.lon.toFixed(5)}` : "Unknown location");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-muted-foreground">{report.ticket_id}</span>
        <StatusBadge status={report.status ?? "open"} />
        <SeverityBadge value={report.severity ?? 1} />
        <SlaCountdown deadline={report.sla_deadline} status={report.status ?? "open"} />
      </div>

      <h1 className="mt-3 text-3xl font-semibold">{CATEGORY_LABELS[category]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {place} · reported {formatWhen(report.created_at)}
        {(report.report_count ?? 1) > 1 && <> · {report.report_count} citizens reported this</>}
      </p>

      {data?.original && (
        <p className="mt-4 rounded-md border border-accent bg-accent/20 p-3 text-sm">
          This is the same issue as{" "}
          <Link to="/issues/$ticketId" params={{ ticketId: data.original }} className="font-mono underline">
            {data.original}
          </Link>
          , so the two are linked.
        </p>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold">What was reported</h2>
            <p className="mt-2 text-sm">{report.ai_summary ?? report.description ?? "No description given."}</p>
            {report.ai_summary && report.description && report.description !== report.ai_summary && (
              <p className="mt-2 rounded-sm border bg-muted/40 p-3 text-sm text-muted-foreground">
                In the citizen's words: {report.description}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Photo</h2>
            <ReportPhoto path={report.photo_url} alt={`Photo for ticket ${report.ticket_id}`} className="mt-2 max-h-80 w-full rounded-md border" />
          </section>

          <section>
            <h2 className="text-lg font-semibold">Why this severity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.severity ?? 1}/5, from the published formula. No discretion, no manual scoring.
            </p>
            <ul className="mt-3 divide-y rounded-md border bg-card text-sm">
              {(report.severity_reasons ?? []).map((reason, i) => (
                <li key={i} className="p-3">
                  {reason}
                </li>
              ))}
              {(report.severity_reasons ?? []).length === 0 && (
                <li className="p-3 text-muted-foreground">No scoring details recorded.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">History</h2>
            {events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No updates yet. The SLA clock is running.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{e.type?.replaceAll("_", " ") ?? "update"}</p>
                      {e.note && <p className="text-muted-foreground">{e.note}</p>}
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(e.created_at)}
                        {e.actor_role && ` · ${e.actor_role}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Location</h2>
            <IssuesMap
              className="mt-2 h-56 rounded-md border"
              pins={
                report.lat !== null && report.lon !== null
                  ? [
                      {
                        ticket_id: report.ticket_id ?? ticketId,
                        lat: report.lat,
                        lon: report.lon,
                        severity: report.severity ?? 1,
                        ai_summary: report.ai_summary,
                        status: report.status ?? "open",
                      },
                    ]
                  : []
              }
            />
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {report.lat !== null && report.lon !== null ? `${report.lat.toFixed(5)}, ${report.lon.toFixed(5)}` : "No coordinates"}
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Responsible</h2>
            <p className="mt-2 text-sm">{report.department_name ?? "Not assigned"}</p>
            {report.sla_deadline && (
              <p className="mt-1 text-xs text-muted-foreground">Target: {formatWhen(report.sla_deadline)}</p>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Reported by</h2>
            <p className="mt-2 text-sm">{report.reporter_name ?? "Anonymous citizen"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
