import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Pharmacy } from '../../shared/types';
import { buildGoogleMapsSearchUrl } from '../utils/maps';

interface LeafletOsmMapProps {
  pharmacies: Pharmacy[];
  selectedPharmacyId: string | null;
  onSelectPharmacy: (pharmacyId: string) => void;
  syncedPin: { lat: number; lng: number } | null;
  interactivePinMode?: boolean;
  onMapClickCoordinates?: (lat: number, lng: number) => void;
  heightClass?: string;
  fitAllKey?: number;
  initialFitCountry?: boolean;
}

function createPinIcon(active: boolean, isCustomPin = false): L.DivIcon {
  const fill = isCustomPin ? '#0284c7' : active ? '#0f766e' : '#334155';
  const size = active || isCustomPin ? 34 : 28;
  const ring = active || isCustomPin ? `<circle cx="16" cy="14" r="13" fill="${fill}" fill-opacity="0.18"/>` : '';

  return L.divIcon({
    className: 'custom-osm-pin',
    iconSize: [size, size + 6],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `
      <svg width="${size}" height="${size + 6}" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M16 3C10.477 3 6 7.477 6 13c0 7.25 10 20 10 20s10-12.75 10-20c0-5.523-4.477-10-10-10z" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="16" cy="13" r="3.8" fill="#ffffff"/>
      </svg>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function LeafletOsmMap({
  pharmacies,
  selectedPharmacyId,
  onSelectPharmacy,
  syncedPin,
  interactivePinMode = false,
  onMapClickCoordinates,
  heightClass = 'h-[420px]',
  fitAllKey = 0,
  initialFitCountry = false,
}: LeafletOsmMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const customMarkerRef = useRef<L.Marker | null>(null);
  const onClickRef = useRef(onMapClickCoordinates);
  const onSelectRef = useRef(onSelectPharmacy);
  const interactiveModeRef = useRef(interactivePinMode);
  const hasDoneInitialFitRef = useRef(false);
  const lastSelectedIdRef = useRef<string | null>(selectedPharmacyId);

  onClickRef.current = onMapClickCoordinates;
  onSelectRef.current = onSelectPharmacy;
  interactiveModeRef.current = interactivePinMode;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = [-25.2867, -57.635];

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialFitCountry ? 6 : 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (interactiveModeRef.current && onClickRef.current) {
        onClickRef.current(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        );
      }
    });

    mapRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      customMarkerRef.current = null;
    };
  }, []);

  // Renderizar marcadores de farmacias
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    pharmacies.forEach((ph) => {
      const isSelected = ph.id === selectedPharmacyId;
      const marker = L.marker([ph.latitude, ph.longitude], {
        icon: createPinIcon(isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      });

      const gmapsUrl = buildGoogleMapsSearchUrl(ph.latitude, ph.longitude);
      const popupHtml = `
        <div style="min-width:210px;font-family:DM Sans,sans-serif;">
          <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0;">${escapeHtml(ph.name)}</p>
          <p style="font-size:12px;color:#475569;margin:4px 0 0;">${escapeHtml(ph.address)}</p>
          <p style="font-size:11px;color:#0f766e;margin:4px 0 0;font-weight:600;">${escapeHtml(ph.hours)}</p>
          <p style="font-size:11px;color:#64748b;margin:4px 0 8px;font-family:JetBrains Mono,monospace;">${ph.latitude.toFixed(5)}, ${ph.longitude.toFixed(5)}</p>
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f766e;color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;text-decoration:none;">
            Abrir en Google Maps &rarr;
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onSelectRef.current(ph.id);
      });
      marker.addTo(layerGroup);

      if (isSelected && !syncedPin && (!initialFitCountry || hasDoneInitialFitRef.current)) {
        marker.openPopup();
      }
    });

    if (initialFitCountry && !hasDoneInitialFitRef.current && pharmacies.length > 0) {
      hasDoneInitialFitRef.current = true;
      const bounds = L.latLngBounds(pharmacies.map((p) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
    }
  }, [pharmacies, selectedPharmacyId, syncedPin, initialFitCountry]);

  // Ajustar vista a todo Paraguay cuando el usuario pulsa "Ver todo Paraguay"
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitAllKey === 0 || pharmacies.length === 0) return;
    const bounds = L.latLngBounds(pharmacies.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
  }, [fitAllKey, pharmacies]);

  // Centrar suavemente cuando cambia la farmacia seleccionada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPharmacyId) return;
    if (initialFitCountry && lastSelectedIdRef.current === selectedPharmacyId && fitAllKey === 0) {
      return;
    }
    lastSelectedIdRef.current = selectedPharmacyId;
    const target = pharmacies.find((p) => p.id === selectedPharmacyId);
    if (target) {
      map.flyTo([target.latitude, target.longitude], 14, { duration: 0.65 });
    }
  }, [selectedPharmacyId, pharmacies, initialFitCountry, fitAllKey]);

  // Pin sincronizado personalizado para transferencia en tiempo real a Google Maps
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!syncedPin) {
      if (customMarkerRef.current) {
        customMarkerRef.current.remove();
        customMarkerRef.current = null;
      }
      return;
    }

    if (!customMarkerRef.current) {
      const marker = L.marker([syncedPin.lat, syncedPin.lng], {
        icon: createPinIcon(true, true),
        draggable: true,
        zIndexOffset: 900,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        if (onClickRef.current) {
          onClickRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        }
      });

      customMarkerRef.current = marker;
    } else {
      customMarkerRef.current.setLatLng([syncedPin.lat, syncedPin.lng]);
    }
  }, [syncedPin]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} ${interactivePinMode ? 'cursor-crosshair' : ''}`}
      aria-label="Mapa interactivo de farmacias en OpenStreetMap"
    />
  );
}
