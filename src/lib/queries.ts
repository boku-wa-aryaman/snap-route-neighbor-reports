import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const publicReportsQuery = queryOptions({
  queryKey: ["public_reports"],
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
