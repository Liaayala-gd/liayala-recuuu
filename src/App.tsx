import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Pharmacy, Product } from '../shared/types';
import { AdminPanel } from './components/AdminPanel';
import { CatalogSection } from './components/CatalogSection';
import { GeminiAssistant } from './components/GeminiAssistant';
import { HeroSection } from './components/HeroSection';
import { MapWeatherModule } from './components/MapWeatherModule';
import { Navbar, type ActiveSection } from './components/Navbar';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('catalogo');
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [phRes, prRes] = await Promise.all([
        fetch('/api/pharmacies'),
        fetch('/api/products'),
      ]);
      const phData = await phRes.json();
      const prData = await prRes.json();

      if (!phRes.ok) throw new Error(phData.error || 'Error cargando farmacias.');
      if (!prRes.ok) throw new Error(prData.error || 'Error cargando productos.');

      const loadedPharmacies = (phData.pharmacies ?? []) as Pharmacy[];
      const loadedProducts = (prData.products ?? []) as Product[];

      setPharmacies(loadedPharmacies);
      setProducts(loadedProducts);
      setSelectedPharmacyId((prev) =>
        prev && loadedPharmacies.some((p) => p.id === prev)
          ? prev
          : loadedPharmacies[0]?.id ?? null
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No fue posible cargar el catálogo.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const selectedPharmacy = useMemo(
    () => pharmacies.find((p) => p.id === selectedPharmacyId) ?? pharmacies[0] ?? null,
    [pharmacies, selectedPharmacyId]
  );

  const availableProductsCount = useMemo(
    () => products.filter((p) => p.available && p.stock > 0).length,
    [products]
  );

  const handleSelectPharmacyOnMap = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
    setActiveSection('mapa');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar activeSection={activeSection} onNavigate={setActiveSection} />

      <main className="flex-1">
        {activeSection === 'catalogo' && (
          <>
            <HeroSection
              totalPharmacies={pharmacies.length}
              availableProducts={availableProductsCount}
              onNavigate={setActiveSection}
            />
            <CatalogSection
              pharmacies={pharmacies}
              products={products}
              loading={loading}
              error={error}
              onRetry={loadCatalog}
              onSelectPharmacyOnMap={handleSelectPharmacyOnMap}
            />
          </>
        )}

        {activeSection === 'mapa' && (
          <MapWeatherModule
            pharmacies={pharmacies}
            products={products}
            selectedPharmacyId={selectedPharmacyId}
            onSelectPharmacy={setSelectedPharmacyId}
          />
        )}

        {activeSection === 'asistente' && (
          <GeminiAssistant selectedPharmacy={selectedPharmacy} />
        )}

        {activeSection === 'admin' && (
          <AdminPanel
            pharmacies={pharmacies}
            products={products}
            adminToken={adminToken}
            onSetAdminToken={setAdminToken}
            onRefreshCatalog={loadCatalog}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>Botica Atlas · Red de Farmacias y Cuidado Personal</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('catalogo')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('mapa')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Mapa y Clima
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('asistente')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Asistente
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('admin')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Administración
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
