import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitReport } from "@/lib/report.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PickerMap } from "@/components/LazyMaps";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report an issue — Civic Pulse" },
      { name: "description", content: "Submit a photo and location of a civic issue." },
      { property: "og:title", content: "Report an issue — Civic Pulse" },
      { property: "og:description", content: "Submit a photo and location of a civic issue." },
    ],
  }),
  component: ReportPage,
});

// Re-encode to JPEG ≤1024px: strips EXIF (incl. GPS) and shrinks upload.
async function processImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

function ReportPage() {
  const submit = useServerFn(submitReport);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ticketId: string; duplicateOf: string | null } | null>(null);

  function locate() {
    if (!navigator.geolocation) return void toast.error("Location not available. Tap the map instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => toast.error("Couldn't get your location. Tap the map to place a pin."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loc) return void toast.error("Add a location first.");
    try {
      let photoPath: string | null = null;
      if (file) {
        setBusy("Uploading photo…");
        const blob = await processImage(file);
        const { data: u } = await supabase.auth.getUser();
        photoPath = `${u.user!.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("report-photos").upload(photoPath, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
      }
      setBusy("AI is reviewing your report and fetching live local data…");
      const res = await submit({ data: { description: desc, photoPath, lat: loc.lat, lon: loc.lon, isAnonymous: anon } });
      if (!res.ok) toast.error(res.error);
      else setResult({ ticketId: res.ticketId, duplicateOf: res.duplicateOf });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (result)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-mono text-sm text-muted-foreground">Ticket filed</p>
        <h1 className="mt-2 font-mono text-4xl font-semibold text-primary">{result.ticketId}</h1>
        {result.duplicateOf && (
          <p className="mt-4 text-sm">This looks like the same issue as <strong>{result.duplicateOf}</strong>, so it's been linked and that ticket's report count went up.</p>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild><Link to="/issues/$ticketId" params={{ ticketId: result.ticketId }}>View public ticket</Link></Button>
          <Button variant="outline" onClick={() => { setResult(null); setFile(null); setPreview(null); setDesc(""); }}>Report another</Button>
        </div>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Report an issue</h1>
        <p className="mt-1 text-sm text-muted-foreground">A photo and a location are the most useful. Any language is fine.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          className="block w-full text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 15 * 1024 * 1024) return void toast.error("Photo is too large (max 15 MB).");
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        {preview && <img src={preview} alt="Selected" className="max-h-64 rounded-md border object-cover" />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">What's the problem?</Label>
        <Textarea id="desc" rows={3} maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Big pothole in front of the school gate, bikes are slipping" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Location</Label>
          <Button type="button" size="sm" variant="outline" onClick={locate}>Use my location</Button>
        </div>
        <PickerMap value={loc} onPick={(lat, lon) => setLoc({ lat, lon })} className="h-64 rounded-md border" />
        <p className="font-mono text-xs text-muted-foreground">{loc ? `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}` : "Tap the map or use your location"}</p>
      </div>

      <label className="flex items-start gap-3 rounded-md border bg-card p-3 text-sm">
        <Checkbox checked={anon} onCheckedChange={(v) => setAnon(v === true)} className="mt-0.5" />
        <span><strong>Report anonymously.</strong> Your name is never shown publicly or to officials.</span>
      </label>

      <Button type="submit" size="lg" className="w-full" disabled={!!busy}>{busy ?? "Submit report"}</Button>
    </form>
  );
}
