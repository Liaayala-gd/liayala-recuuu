import { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import type { ActiveSection } from './Navbar';

interface HeroSectionProps {
  totalPharmacies: number;
  availableProducts: number;
  onNavigate: (section: ActiveSection) => void;
}

export function HeroSection({
  totalPharmacies,
  availableProducts,
  onNavigate,
}: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          <div className="flex flex-col justify-between lg:col-span-6 lg:py-2">
            <div>
              <p className="text-xs font-medium text-teal-700">
                Red Metropolitana · Higiene y Cuidado Personal
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12] [text-wrap:balance]">
                Disponibilidad real en farmacias, mapa conectado y clima local
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                Consulta precios, existencias y horarios de sucursales en tiempo real. Explora
                ubicaciones sobre OpenStreetMap, transfiere coordenadas directamente a Google Maps
                y revisa el pronóstico de las próximas 24 horas antes de salir.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('mapa')}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              >
                <MapPin className="h-4 w-4" />
                Explorar Mapa y Clima
              </button>
              <button
                type="button"
                onClick={() => onNavigate('asistente')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              >
                Preguntar al Asistente
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {totalPharmacies}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Farmacias conectadas</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {availableProducts}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Productos con stock</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  24h
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Pronóstico por sucursal</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-80 lg:h-full lg:min-h-[340px]">
              {!imgError ? (
                <img
                  src="/src/assets/images/hero_pharmacy_apothecary_1795699196523.jpg"
                  alt="Interior de farmacia moderna con productos de cuidado personal e higiene"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 p-6 text-center">
                  <MapPin className="h-8 w-8 text-teal-700" />
                  <p className="mt-2 font-display text-base font-semibold text-slate-800">
                    Botica Atlas
                  </p>
                  <p className="text-xs text-slate-500">
                    Red de farmacias e higiene personal
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
