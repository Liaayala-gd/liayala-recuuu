import { useMemo, useState } from 'react';
import { MapPin, Package, Search, X } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type Pharmacy,
  type Product,
} from '../../shared/types';
import { formatCurrencyPYG } from '../utils/maps';

interface CatalogSectionProps {
  pharmacies: Pharmacy[];
  products: Product[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectPharmacyOnMap: (pharmacyId: string) => void;
}

type AvailabilityFilter = 'all' | 'available' | 'low' | 'out';

export function CatalogSection({
  pharmacies,
  products,
  loading,
  error,
  onRetry,
  onSelectPharmacyOnMap,
}: CatalogSectionProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>('Todas');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const pharmacyMap = useMemo(
    () => new Map(pharmacies.map((p) => [p.id, p])),
    [pharmacies]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => {
      if (selectedCategory !== 'Todas' && item.category !== selectedCategory) return false;
      if (selectedPharmacyId !== 'Todas' && item.pharmacy_id !== selectedPharmacyId) return false;

      const isAvailable = item.available && item.stock > 0;
      if (availability === 'available' && !isAvailable) return false;
      if (availability === 'low' && (!isAvailable || item.stock > 5)) return false;
      if (availability === 'out' && isAvailable) return false;

      if (q) {
        const ph = pharmacyMap.get(item.pharmacy_id);
        const haystack = `${item.name} ${item.brand} ${item.category} ${item.description} ${ph?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedPharmacyId, availability, search, pharmacyMap]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('Todas');
    setAvailability('all');
    setSelectedPharmacyId('Todas');
  };

  return (
    <section aria-labelledby="catalog-heading" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="catalog-heading" className="font-display text-2xl font-bold text-slate-900">
            Catálogo de higiene y cuidado personal
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Filtra por categoría, disponibilidad en sucursal o busca un producto específico.
          </p>
        </div>

        <p className="font-mono text-xs text-slate-500 tabular-nums">
          Mostrando {filteredProducts.length} de {products.length} registros
        </p>
      </div>

      {/* Barra de filtros */}
      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar protector solar, jabón, shampoo, marca..."
              aria-label="Buscar productos"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select
              value={selectedPharmacyId}
              onChange={(e) => setSelectedPharmacyId(e.target.value)}
              aria-label="Filtrar por farmacia"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
            >
              <option value="Todas">Todas las farmacias ({pharmacies.length})</option>
              {pharmacies.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name} — {ph.neighborhood || ph.address}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'available', label: 'Disponible' },
                { id: 'low', label: 'Bajo' },
                { id: 'out', label: 'Agotado' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAvailability(tab.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  availability === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categorías interactivas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['Todas', ...PRODUCT_CATEGORIES].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Estados de carga, error y catálogo */}
      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="aspect-[4/3] w-full animate-pulse bg-slate-200" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
          >
            Reintentar carga
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No encontramos productos con esos filtros
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Prueba limpiando la búsqueda o seleccionando otra categoría o farmacia.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const pharmacy = pharmacyMap.get(product.pharmacy_id);
            const inStock = product.available && product.stock > 0;
            const lowStock = inStock && product.stock <= 5;
            const showFallback = !product.image_url || failedImages[product.id];

            return (
              <article
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {!showFallback ? (
                    <img
                      src={product.image_url}
                      alt={`${product.name} — ${product.brand}`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 text-center">
                      <Package className="h-7 w-7 text-slate-400" />
                      <span className="mt-2 text-xs font-medium text-slate-600">
                        {product.category}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <span>{product.category}</span>
                      {product.brand && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.brand}</span>
                        </>
                      )}
                      {product.presentation && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.presentation}</span>
                        </>
                      )}
                    </div>

                    <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-slate-900">
                      {product.name}
                    </h3>

                    {product.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                        {formatCurrencyPYG(product.price)}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          !inStock
                            ? 'text-red-700'
                            : lowStock
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {!inStock
                          ? 'Agotado (0 uds.)'
                          : lowStock
                          ? `Stock bajo (${product.stock} uds.)`
                          : `Disponible (${product.stock} uds.)`}
                      </span>
                    </div>

                    {pharmacy && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{pharmacy.name}</p>
                          <p className="truncate text-slate-500">{pharmacy.hours}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectPharmacyOnMap(pharmacy.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Ver mapa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
