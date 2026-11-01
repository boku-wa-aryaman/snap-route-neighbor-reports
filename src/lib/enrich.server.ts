// Live, real external data. Every field is null when its feed fails — never a made-up value.
const UA = "CivicPulse/1.0 (hackathon civic grievance app)";

async function getJson(url: string, init?: RequestInit, ms = 7000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, ...(init?.headers ?? {}) } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export type LiveContext = {
  area_name: string | null;
  city: string | null;
  state: string | null;
  rain_mm_last_24h: number | null;
  aqi_us: number | null;
  pm2_5: number | null;
  nearest_road_class: string | null;
  near_school_or_hospital: boolean | null;
  nearby_facilities: string[];
  sources: Record<string, "ok" | "unavailable">;
  fetched_at: string;
};

export async function enrich(lat: number, lon: number): Promise<LiveContext> {
  const [geo, wx, aq, osm] = await Promise.all([
    getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`),
    getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&past_days=1&forecast_days=1&timezone=auto`),
    getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`),
    getJson(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:
          "data=" +
          encodeURIComponent(
            `[out:json][timeout:8];(nwr(around:200,${lat},${lon})[amenity~"^(school|hospital|clinic|college)$"];way(around:40,${lat},${lon})[highway];);out tags 30;`,
          ),
      },
      9000,
    ),
  ]);

  const a = geo?.address ?? {};
  let rain: number | null = null;
  if (wx?.hourly?.time && wx?.hourly?.precipitation) {
    const now = Date.now();
    rain = 0;
    (wx.hourly.time as string[]).forEach((t, i) => {
      const ts = new Date(t).getTime();
      if (ts <= now && ts > now - 24 * 3600_000) rain! += Number(wx.hourly.precipitation[i] ?? 0);
    });
  }

  let roadClass: string | null = null;
  let near: boolean | null = null;
  const facilities: string[] = [];
  if (osm?.elements) {
    near = false;
    const rank = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "service"];
    let best = 99;
    for (const el of osm.elements as any[]) {
      const t = el.tags ?? {};
      if (t.amenity) {
        near = true;
        facilities.push(`${t.amenity}${t.name ? `: ${t.name}` : ""}`);
      }
      if (t.highway) {
        const r = rank.indexOf(t.highway);
        if (r >= 0 && r < best) {
          best = r;
          roadClass = t.highway;
        }
      }
    }
  }

  return {
    area_name: a.suburb || a.neighbourhood || a.city_district || a.village || a.town || null,
    city: a.city || a.town || a.state_district || a.county || null,
    state: a.state || null,
    rain_mm_last_24h: rain,
    aqi_us: aq?.current?.us_aqi ?? null,
    pm2_5: aq?.current?.pm2_5 ?? null,
    nearest_road_class: roadClass,
    near_school_or_hospital: near,
    nearby_facilities: [...new Set(facilities)].slice(0, 5),
    sources: {
      reverse_geocode_osm: geo ? "ok" : "unavailable",
      rainfall_open_meteo: rain !== null ? "ok" : "unavailable",
      air_quality_open_meteo: aq?.current ? "ok" : "unavailable",
      overpass_osm: osm ? "ok" : "unavailable",
    },
    fetched_at: new Date().toISOString(),
  };
}

export function osmRoadToType(c: string | null): "highway" | "arterial" | "local" | "lane" | null {
  if (!c) return null;
  if (c === "motorway" || c === "trunk") return "highway";
  if (c === "primary" || c === "secondary") return "arterial";
  if (c === "tertiary" || c === "residential" || c === "unclassified") return "local";
  return "lane";
}
