import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";

// Map colours read from design tokens at runtime
function sevColor(v: number) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(`--sev-${v}`).trim();
}

type Pin = { ticket_id: string; lat: number; lon: number; severity: number; ai_summary: string | null; status: string };

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 15 });
  }, [pins, map]);
  return null;
}

export default function IssuesMap({ pins, className }: { pins: Pin[]; className?: string | undefined }) {
  return (
    <MapContainer center={[22.5, 79]} zoom={4} className={className ?? ""} scrollWheelZoom={false}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds pins={pins} />
      {pins.map((p) => (
        <CircleMarker
          key={p.ticket_id}
          center={[p.lat, p.lon]}
          radius={6 + p.severity * 2}
          pathOptions={{ color: sevColor(p.severity), fillColor: sevColor(p.severity), fillOpacity: 0.75, weight: 2 }}
        >
          <Popup>
            <strong>{p.ticket_id}</strong> · severity {p.severity}/5
            <br />
            {p.ai_summary}
            <br />
            <Link to="/issues/$ticketId" params={{ ticketId: p.ticket_id }}>Open ticket →</Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:var(--primary);border:3px solid var(--primary-foreground);box-shadow:0 0 0 2px var(--primary)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickToPick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 16));
  }, [lat, lon, map]);
  return null;
}

export function PickerMap({
  value,
  onPick,
  className,
}: {
  value: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  className?: string | undefined;
}) {
  return (
    <MapContainer center={value ? [value.lat, value.lon] : [22.5, 79]} zoom={value ? 16 : 4} className={className ?? ""}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPick onPick={onPick} />
      {value && (
        <>
          <Marker position={[value.lat, value.lon]} icon={pinIcon} />
          <Recenter lat={value.lat} lon={value.lon} />
        </>
      )}
    </MapContainer>
  );
}
