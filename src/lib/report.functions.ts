import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATEGORY_LABELS,
  DEPARTMENT_FOR,
  REVIEW_CONFIDENCE_THRESHOLD,
  SEVERITY_LABEL,
  computeSeverity,
  distanceMeters,
  slaDeadline,
  type Category,
} from "./severity";
import {
  PHOTO_DUPLICATE_SIM,
  categoryForClassifierLabel,
  classifyImage,
  cosine,
  disagrees,
  storedEmbedding,
} from "./classifier";

const Input = z.object({
  description: z.string().max(2000).default(""),
  photoPath: z.string().max(300).nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  isAnonymous: z.boolean(),
});

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.photoPath && data.description.trim().length < 10)
      return { ok: false as const, error: "Add a photo or describe the issue in at least 10 characters." };
    if (data.photoPath && !data.photoPath.startsWith(`${userId}/`))
      return { ok: false as const, error: "Invalid photo." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: 5 reports per hour per user
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Limit reached: 5 reports per hour. Please try later." };

    let imageDataUrl: string | null = null;
    let photo: Blob | null = null;
    if (data.photoPath) {
      const { data: blob, error } = await supabaseAdmin.storage.from("report-photos").download(data.photoPath);
      if (error || !blob) return { ok: false as const, error: "Could not read uploaded photo." };
      photo = blob;
      imageDataUrl = `data:${blob.type || "image/jpeg"};base64,${toBase64(await blob.arrayBuffer())}`;
    }

    // Gate: skip the VLM entirely for a photo-only report the classifier is
    // confident is not civic. When there is a description, the text gets the
    // final say — the classifier sees only the picture.
    const clf = photo ? await classifyImage(photo) : null;
    if (clf && !clf.is_civic && data.description.trim().length < 10)
      return {
        ok: false as const,
        error:
          "This photo doesn't look like a public civic issue. Add a short description of the problem so a person can check it.",
      };

    const { extractReport } = await import("./ai.server");
    const { enrich, osmRoadToType } = await import("./enrich.server");
    const [ai, live] = await Promise.all([
      extractReport({ imageDataUrl, text: data.description }),
      enrich(data.lat, data.lon),
    ]);

    if (ai.ok && (!ai.data.is_civic_issue || ai.data.is_abusive_or_spam)) {
      return {
        ok: false as const,
        error: ai.data.rejection_reason || "This doesn't look like a public civic issue, so it wasn't filed.",
      };
    }

    const reviewReasons: string[] = [];
    let category: Category = "other";
    if (ai.ok) {
      category = ai.data.category;
      if (ai.data.confidence < REVIEW_CONFIDENCE_THRESHOLD)
        reviewReasons.push(`AI confidence ${ai.data.confidence.toFixed(2)} below ${REVIEW_CONFIDENCE_THRESHOLD}`);
    } else {
      reviewReasons.push(ai.error);
      // VLM unavailable: use the classifier's category instead of falling back to "other".
      if (clf?.is_civic) category = categoryForClassifierLabel(clf.best_civic_label);
    }

    // Cross-check. The classifier only sees the photo, the VLM also reads the text,
    // so a disagreement is a signal for a human — not an automatic override.
    if (clf) {
      const pct = `${Math.round(clf.confidence * 100)}%`;
      if (ai.ok && disagrees(category, clf))
        reviewReasons.push(`Classifier saw ${clf.best_civic_label} (${pct}) but the AI said ${category}`);
      else if (clf.needs_review) reviewReasons.push(`Classifier unsure: ${clf.best_civic_label} (${pct})`);
      if (ai.ok && !clf.is_civic) reviewReasons.push("Classifier thought the photo may not show a civic issue");
    }

    const osmRoad = osmRoadToType(live.nearest_road_class);
    const features = {
      category,
      size_estimate: ai.ok ? ai.data.size_estimate : ("unknown" as const),
      people_at_risk: ai.ok ? ai.data.people_at_risk : false,
      blocks_traffic_or_access: ai.ok ? ai.data.blocks_traffic_or_access : false,
      road_type: osmRoad ?? (ai.ok ? ai.data.road_type : ("unknown" as const)),
      near_school_or_hospital: live.near_school_or_hospital,
      rain_mm_last_24h: live.rain_mm_last_24h,
      aqi: live.aqi_us,
    };
    const sev = computeSeverity(features);
    const unavailable = Object.entries(live.sources).filter(([, v]) => v === "unavailable").map(([k]) => k);
    if (unavailable.length) sev.reasons.push(`Live data unavailable: ${unavailable.join(", ")}`);

    const departmentId = DEPARTMENT_FOR[category];
    const { data: dept } = await supabaseAdmin.from("departments").select("name").eq("id", departmentId).single();

    // Dedup: same category, open, within 50 m, last 30 days
    const box = 0.0006;
    const { data: nearby } = await supabaseAdmin
      .from("reports")
      .select("id, ticket_id, lat, lon, report_count, ai_json")
      .eq("category", category)
      .is("deleted_at", null)
      .is("duplicate_of", null)
      .in("status", ["open", "in_progress", "escalated"])
      .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString())
      .gte("lat", data.lat - box).lte("lat", data.lat + box)
      .gte("lon", data.lon - box).lte("lon", data.lon + box);
    // Prefer a candidate whose stored photo embedding matches (same scene);
    // otherwise fall back to the nearest same-category report, as before.
    const candidates = (nearby ?? [])
      .map((r) => {
        const stored = storedEmbedding(r.ai_json);
        return {
          row: r,
          sim: clf && stored ? cosine(clf.embedding, stored) : -1,
          distance: distanceMeters(r, data),
        };
      })
      .filter((c) => c.distance <= 50)
      .sort((a, b) => b.sim - a.sim || a.distance - b.distance);
    const sameScene = candidates.find((c) => c.sim >= PHOTO_DUPLICATE_SIM);
    const original = (sameScene ?? candidates[0])?.row ?? null;

    const deadline = slaDeadline(sev.score);
    const summary = ai.ok ? ai.data.public_summary : data.description.slice(0, 200);
    // Kept with the report so later reports at the same spot can be compared by photo.
    const classifierRecord = clf
      ? {
          label: clf.label,
          confidence: clf.confidence,
          is_civic: clf.is_civic,
          needs_review: clf.needs_review,
          model: clf.model,
          embedding: clf.embedding,
        }
      : null;
    const place = [live.area_name, live.city, live.state].filter(Boolean).join(", ") || `${data.lat.toFixed(5)}, ${data.lon.toFixed(5)}`;
    const complaint = `To,
The Officer In-Charge,
${dept?.name ?? "Concerned Department"}${live.city ? `, ${live.city}` : ""}

Subject: ${CATEGORY_LABELS[category]} reported at ${place}

Respected Sir/Madam,

A citizen has reported the following issue through the Civic Pulse public grievance platform.

Issue: ${summary}
Location: ${place} (GPS ${data.lat.toFixed(5)}, ${data.lon.toFixed(5)})
Assessed severity: ${sev.score}/5 (${SEVERITY_LABEL[sev.score]})
Reasons:
${sev.reasons.map((r) => `  - ${r}`).join("\n")}
Requested resolution by: ${deadline.toUTCString()}

Photo evidence and the live status of this ticket are available on the public ticket page.

Yours faithfully,
Civic Pulse (on behalf of the reporting citizen)`;

    const { data: row, error } = await supabaseAdmin
      .from("reports")
      .insert({
        reporter_id: userId,
        is_anonymous: data.isAnonymous,
        category,
        description: data.description || null,
        ai_summary: summary,
        ai_json: ai.ok
          ? { ...ai.data, classifier: classifierRecord }
          : { error: ai.error, classifier: classifierRecord },
        ai_confidence: ai.ok ? ai.data.confidence : null,
        severity: sev.score,
        severity_reasons: sev.reasons,
        department_id: departmentId,
        lat: data.lat,
        lon: data.lon,
        area_name: live.area_name,
        city: live.city,
        live_context: live,
        photo_url: data.photoPath,
        needs_review: reviewReasons.length > 0,
        review_reason: reviewReasons.join("; ") || null,
        duplicate_of: original?.id ?? null,
        sla_deadline: deadline.toISOString(),
        drafted_complaint: complaint,
      })
      .select("ticket_id")
      .single();
    if (error || !row) {
      console.error(error);
      return { ok: false as const, error: "Could not save the report. Please try again." };
    }
    if (original) {
      await supabaseAdmin.rpc("increment_report_count", { _id: original.id });
    }
    return { ok: true as const, ticketId: row.ticket_id, duplicateOf: original?.ticket_id ?? null };
  });
