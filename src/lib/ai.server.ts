// Single server-side AI module. Swap the provider/model here only.
import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { CATEGORIES } from "./severity";

const MODEL = "openai/gpt-6-astra" as const;

export const ReportObject = z.object({
  is_civic_issue: z.boolean(),
  is_abusive_or_spam: z.boolean(),
  category: z.enum(CATEGORIES),
  hazard_visible: z.string(),
  size_estimate: z.enum(["small", "medium", "large", "unknown"]),
  road_type: z.enum(["highway", "arterial", "local", "lane", "none", "unknown"]),
  people_at_risk: z.boolean(),
  blocks_traffic_or_access: z.boolean(),
  language_detected: z.string(),
  landmarks: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  public_summary: z.string().max(240),
  rejection_reason: z.string(),
});
export type ReportObject = z.infer<typeof ReportObject>;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(ReportObject.shape),
  properties: {
    is_civic_issue: { type: "boolean" },
    is_abusive_or_spam: { type: "boolean" },
    category: { type: "string", enum: [...CATEGORIES] },
    hazard_visible: { type: "string" },
    size_estimate: { type: "string", enum: ["small", "medium", "large", "unknown"] },
    road_type: { type: "string", enum: ["highway", "arterial", "local", "lane", "none", "unknown"] },
    people_at_risk: { type: "boolean" },
    blocks_traffic_or_access: { type: "boolean" },
    language_detected: { type: "string" },
    landmarks: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    public_summary: { type: "string" },
    rejection_reason: { type: "string" },
  },
};

const SYSTEM = `You triage civic infrastructure reports from Indian citizens. You receive an optional photo and an optional text description (may be Hindi, Hinglish or a regional language).
Return ONLY the JSON object required by the schema. Never invent departments, phone numbers or addresses.

Category definitions:
- road_damage: potholes, cracks, broken roads, damaged bridges/footpaths/dividers
- garbage: dumped waste, overflowing bins, litter, debris
- water_leak: leaking/burst pipes, wasted supply water, sewage overflow from pipes
- waterlogging: standing water, flooded streets, blocked drains
- streetlight: broken, missing or non-working street lights, exposed wiring on poles
- pollution: smoke, burning waste, industrial discharge, dust, polluted water bodies
- noise: loud music, construction noise, horns, loudspeakers
- other: genuine civic issue not listed above

Rules:
- is_civic_issue=false for selfies, memes, screenshots, indoor private matters, or anything not a public civic problem.
- is_abusive_or_spam=true for hate, harassment, sexual content, or ads.
- size_estimate is the physical extent of the problem; "unknown" if no photo and text gives no clue.
- people_at_risk=true only if there is a clear injury/accident/health risk to the public.
- confidence is your honest 0-1 confidence in category + is_civic_issue.
- public_summary: neutral English, <= 200 chars, no personal names, faces or number plates.
- rejection_reason: empty string unless is_civic_issue=false or is_abusive_or_spam=true.

Examples:
Text "sadak pe bada gaddha hai, bike wale gir rahe hai, school ke saamne" -> category road_damage, size_estimate large, people_at_risk true, blocks_traffic_or_access true, language_detected "Hinglish", landmarks ["school"].
Photo of a cat on a sofa -> is_civic_issue false, category other, rejection_reason "Photo does not show a public civic issue".
Text "pipe phata hai, subah se paani beh raha hai" -> category water_leak, size_estimate medium, people_at_risk false.`;

export async function extractReport(input: {
  imageDataUrl: string | null;
  text: string;
}): Promise<{ ok: true; data: ReportObject } | { ok: false; error: string }> {
  type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
  const content: Part[] = [{ type: "text", text: `Citizen description: ${input.text || "(none)"}` }];
  if (input.imageDataUrl) content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateChatCompletion({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "report_object", strict: true, schema: jsonSchema },
        },
        reasoning_effort: "low",
      });
      const raw = res.choices?.[0]?.message?.content;
      const parsed = ReportObject.safeParse(JSON.parse(typeof raw === "string" ? raw : ""));
      if (parsed.success) return { ok: true, data: parsed.data };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("AI gateway error", e.code, e.httpStatus);
        return { ok: false, error: `AI unavailable (${e.code})` };
      }
      console.error("AI parse error", e);
    }
  }
  return { ok: false, error: "AI returned invalid output twice" };
}
