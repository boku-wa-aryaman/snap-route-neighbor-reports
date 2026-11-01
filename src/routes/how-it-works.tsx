import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CATEGORIES,
  CATEGORY_BASE,
  CATEGORY_LABELS,
  DEPARTMENT_FOR,
  REVIEW_CONFIDENCE_THRESHOLD,
  SEVERITY_LABEL,
  SLA_HOURS,
} from "@/lib/severity";
import { SeverityBadge } from "@/components/civic";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — Civic Pulse" },
      { name: "description", content: "How a civic report becomes a ticket, a severity score and a deadline." },
      { property: "og:title", content: "How it works — Civic Pulse" },
      { property: "og:description", content: "The published severity formula, routing table and SLA rules." },
    ],
  }),
  component: HowItWorks,
});

const DEPARTMENT_LABEL: Record<string, string> = {
  municipal: "Municipal corporation",
  water: "Water board",
  pcb: "Pollution control board",
  police: "Police",
};

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">How it works</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A citizen sends a photo, a description and a location. A language model reads the report and extracts
        facts; a published formula turns those facts into a severity score and a deadline. Nothing about the
        score is left to the model's judgement.
      </p>

      <ol className="mt-8 space-y-4">
        {[
          ["Read", "A hosted vision model looks at the photo and text, in any language, and extracts: is this a civic issue, which category, how big, whether people are at risk, whether it blocks traffic, and a short public summary."],
          ["Check", "A separate image classifier — a frozen CLIP encoder with a small trained head — looks at the photo alone. If it disagrees with the model, or is unsure, the report goes to human review instead of being trusted."],
          ["Score", "The severity formula below runs on the extracted facts, not on the model's opinion of severity."],
          ["Route", "The category picks a department, and the score sets the deadline the ticket is held to."],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The severity formula</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from the category's base score, add one point per condition that applies, then clamp to 1–5.
        </p>

        <div className="mt-4 overflow-hidden rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Category</th>
                <th className="p-3">Base</th>
                <th className="p-3">Routed to</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {CATEGORIES.map((c) => (
                <tr key={c}>
                  <td className="p-3">{CATEGORY_LABELS[c]}</td>
                  <td className="p-3 font-mono">{CATEGORY_BASE[c]}</td>
                  <td className="p-3 text-xs text-muted-foreground">{DEPARTMENT_LABEL[DEPARTMENT_FOR[c]] ?? DEPARTMENT_FOR[c]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 font-semibold">Each of these adds one point</h3>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>• Large in physical extent.</li>
          <li>• People visibly at risk (injury, accident, health hazard).</li>
          <li>• Blocks traffic or access.</li>
          <li>• Road damage or waterlogging on a highway or arterial road.</li>
          <li>• A school or hospital within 200 m.</li>
          <li>• 10 mm or more of rain in the last 24 h, for road, waterlogging or leak reports.</li>
          <li>• Local AQI above 150, for pollution reports.</li>
        </ul>

        <h3 className="mt-8 font-semibold">What the score means</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <SeverityBadge key={s} value={s} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The score sets the deadline a ticket is held to: {Object.entries(SLA_HOURS).sort((a, b) => b[0].localeCompare(a[0])).map(([score, hours]) => `${SEVERITY_LABEL[Number(score)]} ${hours / 24}d`).join(" · ")}.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">When a human steps in</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A report is flagged for review when the model's confidence is below {REVIEW_CONFIDENCE_THRESHOLD}, when the
          image classifier disagrees with it, when either one is unsure, or when the model is unavailable. A flagged
          ticket is still published — it just carries a review badge and a reason.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Photos the classifier is confident are not civic issues are rejected before any model call, unless the
          citizen added a description — in which case the text still gets a human's attention.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">What we don't claim</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>• The classifier predicts category, not severity.</li>
          <li>• It cannot tell whether a streetlight is actually broken from a daytime photo.</li>
          <li>• The AI summary is a paraphrase, not evidence. The photo and the citizen's words are the record.</li>
        </ul>
      </section>

      <p className="mt-12 text-sm">
        <Link to="/report" className="text-primary underline">
          Report an issue
        </Link>{" "}
        ·{" "}
        <Link to="/issues" className="text-primary underline">
          See every ticket
        </Link>
      </p>
    </div>
  );
}
