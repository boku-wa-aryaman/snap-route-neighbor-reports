import { useEffect, useState } from "react";
import { cva } from "class-variance-authority";
import { supabase } from "@/integrations/supabase/client";
import { SEVERITY_LABEL } from "@/lib/severity";
import { cn } from "@/lib/utils";

const sev = cva("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold", {
  variants: {
    level: {
      1: "bg-sev-1 text-sev-ink",
      2: "bg-sev-2 text-sev-ink",
      3: "bg-sev-3 text-sev-ink",
      4: "bg-sev-4 text-sev-ink",
      5: "bg-sev-5 text-primary-foreground",
    },
  },
});

export function SeverityBadge({ value, className }: { value: number; className?: string }) {
  const v = Math.min(5, Math.max(1, value)) as 1 | 2 | 3 | 4 | 5;
  return (
    <span className={cn(sev({ level: v }), className)}>
      <span className="font-mono">{v}/5</span> {SEVERITY_LABEL[v]}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "border-foreground/30 text-foreground" },
  in_progress: { label: "In progress", cls: "border-accent bg-accent/30 text-accent-foreground" },
  resolved: { label: "Resolved", cls: "border-success bg-success text-success-foreground" },
  escalated: { label: "Escalated", cls: "border-destructive text-destructive" },
  rejected: { label: "Rejected", cls: "border-muted-foreground text-muted-foreground" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.open;
  return <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-xs font-medium", s.cls)}>{s.label}</span>;
}

export function SlaCountdown({ deadline, status }: { deadline: string | null; status: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!deadline || now === null) return null;
  if (status === "resolved" || status === "rejected") return <span className="text-xs text-muted-foreground">Closed</span>;
  const ms = new Date(deadline).getTime() - now;
  const h = Math.floor(Math.abs(ms) / 3600_000);
  const label = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((Math.abs(ms) % 3600_000) / 60_000)}m`;
  return (
    <span className={cn("font-mono text-xs", ms < 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
      {ms < 0 ? `SLA breached ${label} ago` : `${label} left`}
    </span>
  );
}

const urlCache = new Map<string, string>();
export function usePhotoUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path ? (urlCache.get(path) ?? null) : null);
  useEffect(() => {
    if (!path || urlCache.has(path)) return;
    supabase.storage
      .from("report-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) {
          urlCache.set(path, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
  }, [path]);
  return url;
}

export function ReportPhoto({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const url = usePhotoUrl(path);
  if (!path) return <div className={cn("flex items-center justify-center bg-muted text-xs text-muted-foreground", className)}>No photo</div>;
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} className={cn("object-cover", className)} loading="lazy" />;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-card p-10 text-center">
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
