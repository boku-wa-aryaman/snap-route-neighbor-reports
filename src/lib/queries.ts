import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Every page polls on the same clock so Home, Issues, a ticket, Changes and the
// staff pages never show different states of the same data for long.
export const LIVE_REFRESH_MS = 15_000;

/** One rule for "still needs work", shared by every page that counts or filters. */
export const isActive = (r: { status: string | null }) => r.status !== "resolved" && r.status !== "rejected";
/** Duplicates are folded into their original (shown as ×N), so counts are per issue, not per report. */
export const isOriginal = (r: { duplicate_of: string | null }) => !r.duplicate_of;
export const isBreached = (r: { status: string | null; sla_deadline: string | null }, now = Date.now()) =>
  isActive(r) && !!r.sla_deadline && new Date(r.sla_deadline).getTime() < now;

export const publicReportsQuery = queryOptions({
  queryKey: ["public_reports"],
  refetchInterval: LIVE_REFRESH_MS,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("public_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  },
});

export type PublicReport = import("@/integrations/supabase/types").Database["public"]["Views"]["public_reports"]["Row"];

export const reportQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["report", ticketId],
    refetchInterval: LIVE_REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from("public_reports").select("*").eq("ticket_id", ticketId).maybeSingle();
      if (error) throw error;
      if (!data) return { report: null, events: [], original: null };
      const [{ data: events }, orig] = await Promise.all([
        supabase.from("public_events").select("*").eq("report_id", data.id!).order("created_at"),
        data.duplicate_of
          ? supabase.from("public_reports").select("ticket_id").eq("id", data.duplicate_of).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { report: data, events: events ?? [], original: orig.data?.ticket_id ?? null };
    },
  });

export const departmentsQuery = queryOptions({
  queryKey: ["departments"],
  queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
});

export const publicChangesQuery = queryOptions({
  queryKey: ["public_changes"],
  refetchInterval: LIVE_REFRESH_MS,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("public_changes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },
});
