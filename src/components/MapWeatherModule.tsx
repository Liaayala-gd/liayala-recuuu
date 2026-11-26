import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  CloudRain,
  Compass,
  Copy,
  Crosshair,
  ExternalLink,
  Navigation,
  Phone,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import type {
  Pharmacy,
  Product,
  WeatherForecastResponse,
} from '../../shared/types';
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  buildOpenStreetMapUrl,
  formatCoordinates,
  formatCurrencyMXN,
} from '../utils/maps';
import { LeafletOsmMap } from './LeafletOsmMap';

interface MapWeatherModuleProps {
  pharmacies: Pharmacy[];
  products: Product[];
  selectedPharmacyId: string | null;
  onSelectPharmacy: (id: string) => void;
}

export function MapWeatherModule({
  pharmacies,
  products,
  selectedPharmacyId,
  onSelectPharmacy,
}: MapWeatherModuleProps) {
  const selectedPharmacy = useMemo(
    () => pharmacies.find((p) => p.id === selectedPharmacyId) ?? pharmacies[0] ?? null,
    [pharmacies, selectedPharmacyId]
  );

  const [interactivePinMode, setInteractivePinMode] = useState(false);
  const [syncedPin, setSyncedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showGoogleEmbed, setShowGoogleEmbed] = useState(true);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Estado del clima real (Open-Meteo vía backend)
  const [weather, setWeather] = useState<WeatherForecastResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const activeCoords = useMemo(() => {
    if (syncedPin) return syncedPin;
    if (selectedPharmacy) {
      return { lat: selectedPharmacy.latitude, lng: selectedPharmacy.longitude };
    }
    return null;
  }, [syncedPin, selectedPharmacy]);

  const loadWeather = useCallback(async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const res = await fetch(
        `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener el pronóstico meteorológico.');
      }
      setWeather(data as WeatherForecastResponse);
    } catch (err) {
      setWeather(null);
      setWeatherError(
        err instanceof Error
          ? err.message
          : 'Error de conexión al consultar el servicio meteorológico.'
      );
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCoords) return;
    loadWeather(activeCoords.lat, activeCoords.lng);
  }, [activeCoords?.lat, activeCoords?.lng, loadWeather]);

  const handleSelectPharmacy = (id: string) => {
    setSyncedPin(null);
    onSelectPharmacy(id);
  };

  const handleMapClickCoordinates = (lat: number, lng: number) => {
    setSyncedPin({ lat, lng });
  };

  const handleCopyCoordinates = async () => {
    if (!activeCoords) return;
    try {
      await navigator.clipboard.writeText(formatCoordinates(activeCoords.lat, activeCoords.lng));
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 1800);
    } catch {
      setCopiedCoords(false);
    }
  };

  const selectedPharmacyProducts = useMemo(() => {
    if (!selectedPharmacy) return [];
    return products.filter((p) => p.pharmacy_id === selectedPharmacy.id);
  }, [products, selectedPharmacy]);

  return (
    <section aria-labelledby="map-weather-heading" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="map-weather-heading" className="font-display text-2xl font-bold text-slate-900">
            Mapa OpenStreetMap, sincronización Google Maps y clima 24 h
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona una farmacia o activa el pin libre en OpenStreetMap para transferir las
            coordenadas en tiempo real a Google Maps y actualizar el pronóstico local.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInteractivePinMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
              interactivePinMode
                ? 'border-sky-600 bg-sky-50 text-sky-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {interactivePinMode ? 'Pin libre activo (clic en mapa)' : 'Seleccionar punto en mapa'}
          </button>

          <button
            type="button"
            onClick={() => setShowGoogleEmbed((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
              showGoogleEmbed
                ? 'border-teal-700 bg-teal-50 text-teal-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            {showGoogleEmbed ? 'Ocultar vista Google Maps' : 'Ver Google Maps en paralelo'}
          </button>
        </div>
      </div>

      {/* Selector rápido de sucursales */}
      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2">
        {pharmacies.map((ph) => {
          const active = selectedPharmacy?.id === ph.id && !syncedPin;
          return (
            <button
              key={ph.id}
              type="button"
              onClick={() => handleSelectPharmacy(ph.id)}
              className={`rounded-lg border px-3.5 py-2 text-left transition-colors shrink-0 cursor-pointer ${
                active
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <p className="text-xs font-semibold whitespace-nowrap">{ph.name}</p>
              <p
                className={`mt-0.5 text-[11px] whitespace-nowrap ${
                  active ? 'text-teal-100' : 'text-slate-500'
                }`}
              >
                {ph.neighborhood || ph.address}
              </p>
            </button>
          );
        })}
      </div>

      {/* Barra de sincronización en tiempo real OSM -> Google Maps */}
      {activeCoords && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">
                {syncedPin
                  ? 'Coordenada personalizada sincronizada'
                  : selectedPharmacy?.name}
              </span>
              <span aria-hidden="true">·</span>
              <span>Sincronización OpenStreetMap ↔ Google Maps</span>
            </div>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {formatCoordinates(activeCoords.lat, activeCoords.lng)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {syncedPin && (
              <button
                type="button"
                onClick={() => setSyncedPin(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
              >
                Volver a farmacia
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              {copiedCoords ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  Copiadas
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar coordenadas
                </>
              )}
            </button>

            <a
              href={buildGoogleMapsSearchUrl(activeCoords.lat, activeCoords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Pasar a Google Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <a
              href={buildGoogleMapsDirectionsUrl(activeCoords.lat, activeCoords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700 bg-white px-3.5 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-50 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Navigation className="h-3.5 w-3.5" />
              Ruta en Google Maps
            </a>
          </div>
        </div>
      )}

      {/* Mapas: OpenStreetMap + Vista paralela sincronizada de Google Maps */}
      <div
        className={`mt-4 grid grid-cols-1 gap-4 ${
          showGoogleEmbed ? 'lg:grid-cols-12' : ''
        }`}
      >
        <div
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${
            showGoogleEmbed ? 'lg:col-span-7' : ''
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Mapa interactivo OpenStreetMap ({pharmacies.length} ubicaciones)
            </span>
            {activeCoords && (
              <a
                href={buildOpenStreetMapUrl(activeCoords.lat, activeCoords.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-800 hover:underline whitespace-nowrap"
              >
                Abrir OSM
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <LeafletOsmMap
            pharmacies={pharmacies}
            selectedPharmacyId={selectedPharmacy?.id ?? null}
            onSelectPharmacy={handleSelectPharmacy}
            syncedPin={syncedPin}
            interactivePinMode={interactivePinMode}
            onMapClickCoordinates={handleMapClickCoordinates}
            heightClass="h-[420px]"
          />
        </div>

        {showGoogleEmbed && activeCoords && (
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Google Maps sincronizado en tiempo real
              </span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {formatCoordinates(activeCoords.lat, activeCoords.lng)}
              </span>
            </div>
            <div className="relative h-[420px] w-full bg-slate-100">
              <iframe
                title="Vista sincronizada de Google Maps"
                src={buildGoogleMapsEmbedUrl(activeCoords.lat, activeCoords.lng)}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        )}
      </div>

      {/* Detalle de sucursal + Pronóstico meteorológico 24 horas */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Información de la farmacia seleccionada */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          {selectedPharmacy ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-teal-700">
                    {selectedPharmacy.is_24h ? 'Servicio continuo 24 horas' : 'Sucursal verificada'}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-slate-900">
                    {selectedPharmacy.name}
                  </h3>
                </div>
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <div>
                  <dt className="text-xs font-medium text-slate-400">Dirección</dt>
                  <dd className="text-slate-800">{selectedPharmacy.address}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{selectedPharmacy.hours}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="font-mono text-xs tabular-nums">{selectedPharmacy.contact}</span>
                </div>
              </dl>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">
                  Inventario en esta sucursal ({selectedPharmacyProducts.length})
                </p>
                {selectedPharmacyProducts.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Sin productos registrados en esta sucursal todavía.
                  </p>
                ) : (
                  <ul className="mt-2.5 divide-y divide-slate-100">
                    {selectedPharmacyProducts.map((item) => {
                      const ok = item.available && item.stock > 0;
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{item.name}</p>
                            <p className="text-slate-500">
                              {item.category} ·{' '}
                              <span className={ok ? 'text-emerald-700' : 'text-red-700'}>
                                {ok ? `${item.stock} disponibles` : 'Agotado'}
                              </span>
                            </p>
                          </div>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                            {formatCurrencyMXN(item.price)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Selecciona una farmacia en el mapa.</p>
          )}
        </div>

        {/* Pronóstico meteorológico obligatorio (Open-Meteo real) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-teal-700">
                Pronóstico meteorológico en tiempo real
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-slate-900">
                {syncedPin
                  ? 'Clima para punto seleccionado en mapa'
                  : selectedPharmacy
                  ? `Clima en ${selectedPharmacy.name}`
                  : 'Pronóstico local'}
              </h3>
            </div>

            {activeCoords && (
              <button
                type="button"
                onClick={() => loadWeather(activeCoords.lat, activeCoords.lng)}
                disabled={weatherLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            )}
          </div>

          {weatherLoading ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : weatherError ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-800">
                No fue posible obtener el pronóstico real
              </p>
              <p className="mt-1 text-xs text-red-700">{weatherError}</p>
              {activeCoords && (
                <button
                  type="button"
                  onClick={() => loadWeather(activeCoords.lat, activeCoords.lng)}
                  className="mt-3 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Reintentar consulta
                </button>
              )}
            </div>
          ) : weather ? (
            <div className="mt-5">
              <div className="grid grid-cols-1 gap-4 border-y border-slate-100 py-4 sm:grid-cols-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Sun className="h-3.5 w-3.5 text-amber-600" />
                    Temperatura actual
                  </div>
                  <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                    {weather.current.temperature.toFixed(1)} °C
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {weather.current.weatherLabel}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CloudRain className="h-3.5 w-3.5 text-sky-600" />
                    Probabilidad de lluvia
                  </div>
                  <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                    {weather.current.rainProbability}%
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {weather.current.rainProbability >= 50
                      ? 'Conviene llevar paraguas'
                      : 'Baja probabilidad de lluvia'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Wind className="h-3.5 w-3.5 text-slate-500" />
                    Viento y zona horaria
                  </div>
                  <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                    {weather.current.windSpeed.toFixed(0)} <span className="text-base">km/h</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">{weather.timezone}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Pronóstico próximas 24 horas
                  </span>
                  <span>Fuente: Open-Meteo</span>
                </div>

                <div className="mt-3 flex gap-2.5 overflow-x-auto pb-2">
                  {weather.hourly.map((hour) => {
                    const hhmm = hour.time.includes('T')
                      ? hour.time.split('T')[1].slice(0, 5)
                      : hour.time.slice(0, 5);
                    return (
                      <div
                        key={hour.time}
                        className="flex min-w-[82px] flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-center shrink-0"
                      >
                        <span className="font-mono text-[11px] font-medium text-slate-500 tabular-nums">
                          {hhmm}
                        </span>
                        <span className="mt-1.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {hour.temperature.toFixed(0)}°C
                        </span>
                        <span className="mt-1 font-mono text-[11px] font-medium text-sky-700 tabular-nums">
                          {hour.rainProbability}% lluvia
                        </span>
                        <span className="mt-1 truncate text-[10px] text-slate-500" title={hour.weatherLabel}>
                          {hour.weatherLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
