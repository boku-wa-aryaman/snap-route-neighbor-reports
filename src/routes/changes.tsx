import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { publicChangesQuery } from "@/lib/queries";
import { EmptyState } from "@/components/civic";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Recent changes — Civic Pulse" },
      { name: "description", content: "Every status change on a public ticket, in order." },
      { property: "og:title", content: "Recent changes — Civic Pulse" },
      { property: "og:description", content: "Audit log of ticket status changes." },
    ],
  }),
  component: Changes,
});

const ACTION_LABEL: Record<string, string> = {
  insert: "filed",
  update: "updated",
  delete: "removed",
  status_change: "status changed",
  severity_override: "severity overridden",
  duplicate: "linked as duplicate",
};

function Changes() {
  const { data = [], isLoading } = useQuery(publicChangesQuery);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Recent changes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every change to a public ticket, newest first. Nothing is edited silently.
      </p>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No changes yet">
            Once tickets are filed and updated, every change shows up here.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-md border bg-card">
          {data.map((c) => (
            <li key={`${c.id}-${c.created_at}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-3 text-sm">
              <span className="font-mono text-xs">
                {c.ticket_id ? (
                  <Link to="/issues/$ticketId" params={{ ticketId: c.ticket_id }} className="text-primary underline-offset-2 hover:underline">
                    {c.ticket_id}
                  </Link>
                ) : (
                  "—"
                )}
              </span>
              <span>{ACTION_LABEL[c.action ?? ""] ?? (c.action ?? "changed").replaceAll("_", " ")}</span>
              {c.actor_role && <span className="text-xs text-muted-foreground">by {c.actor_role}</span>}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {c.created_at
                  ? new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
