import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  ExternalLink,
  Lock,
  LogOut,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type AuthStatus,
  type Pharmacy,
  type Product,
  type ProductCategory,
} from '../../shared/types';
import {
  buildGoogleMapsSearchUrl,
  formatCoordinates,
  formatCurrencyMXN,
} from '../utils/maps';
import { LeafletOsmMap } from './LeafletOsmMap';

interface AdminPanelProps {
  pharmacies: Pharmacy[];
  products: Product[];
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
  onRefreshCatalog: () => Promise<void>;
}

const EMPTY_PHARMACY_FORM = {
  id: '',
  name: '',
  address: '',
  neighborhood: '',
  contact: '',
  hours: 'Lun–Sáb 08:00–21:00 · Dom 09:00–19:00',
  is_24h: false,
  latitude: 19.419,
  longitude: -99.165,
};

const EMPTY_PRODUCT_FORM = {
  id: '',
  pharmacy_id: '',
  name: '',
  brand: '',
  category: 'Protección Solar' as ProductCategory,
  presentation: '',
  price: 250,
  stock: 10,
  available: true,
  description: '',
};

export function AdminPanel({
  pharmacies,
  products,
  adminToken,
  onSetAdminToken,
  onRefreshCatalog,
}: AdminPanelProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [tab, setTab] = useState<'products' | 'pharmacies'>('products');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [pharmacyForm, setPharmacyForm] = useState(EMPTY_PHARMACY_FORM);
  const [showPharmacyForm, setShowPharmacyForm] = useState(false);

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [showProductForm, setShowProductForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAuthStatus = async (tokenOverride?: string | null) => {
    setAuthLoading(true);
    try {
      const token = tokenOverride === undefined ? adminToken : tokenOverride;
      const res = await fetch('/api/auth/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as AuthStatus;
      setAuthStatus(data);
    } catch {
      setAuthError('No se pudo verificar el estado de autenticación.');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
  }, [adminToken]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const endpoint = authStatus?.requiresSetup ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcodeInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No fue posible validar la clave.');
      }
      onSetAdminToken(data.token);
      setPasscodeInput('');
      await fetchAuthStatus(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error de autenticación.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    onSetAdminToken(null);
    setFeedback(null);
  };

  const authHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  });

  // CRUD Farmacias
  const openNewPharmacy = () => {
    setPharmacyForm(EMPTY_PHARMACY_FORM);
    setShowPharmacyForm(true);
    setFeedback(null);
  };

  const openEditPharmacy = (ph: Pharmacy) => {
    setPharmacyForm({
      id: ph.id,
      name: ph.name,
      address: ph.address,
      neighborhood: ph.neighborhood,
      contact: ph.contact,
      hours: ph.hours,
      is_24h: ph.is_24h,
      latitude: ph.latitude,
      longitude: ph.longitude,
    });
    setShowPharmacyForm(true);
    setFeedback(null);
  };

  const handleSavePharmacy = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const isEdit = Boolean(pharmacyForm.id);
      const url = isEdit ? `/api/pharmacies/${pharmacyForm.id}` : '/api/pharmacies';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          name: pharmacyForm.name,
          address: pharmacyForm.address,
          neighborhood: pharmacyForm.neighborhood,
          contact: pharmacyForm.contact,
          hours: pharmacyForm.hours,
          is_24h: pharmacyForm.is_24h,
          latitude: Number(pharmacyForm.latitude),
          longitude: Number(pharmacyForm.longitude),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando la farmacia.');
      await onRefreshCatalog();
      setShowPharmacyForm(false);
      setFeedback({
        type: 'ok',
        text: isEdit ? 'Farmacia actualizada correctamente.' : 'Farmacia registrada correctamente.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error al guardar la farmacia.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePharmacy = async (ph: Pharmacy) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/pharmacies/${ph.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar farmacia.');
      await onRefreshCatalog();
      setFeedback({ type: 'ok', text: `Farmacia "${ph.name}" eliminada.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error eliminando farmacia.',
      });
    }
  };

  // CRUD Productos
  const openNewProduct = () => {
    setProductForm({
      ...EMPTY_PRODUCT_FORM,
      pharmacy_id: pharmacies[0]?.id ?? '',
    });
    setShowProductForm(true);
    setFeedback(null);
  };

  const openEditProduct = (pr: Product) => {
    setProductForm({
      id: pr.id,
      pharmacy_id: pr.pharmacy_id,
      name: pr.name,
      brand: pr.brand,
      category: pr.category,
      presentation: pr.presentation,
      price: pr.price,
      stock: pr.stock,
      available: pr.available,
      description: pr.description,
    });
    setShowProductForm(true);
    setFeedback(null);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const isEdit = Boolean(productForm.id);
      const url = isEdit ? `/api/products/${productForm.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          pharmacy_id: productForm.pharmacy_id,
          name: productForm.name,
          brand: productForm.brand,
          category: productForm.category,
          presentation: productForm.presentation,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          available: Number(productForm.stock) > 0 ? productForm.available : false,
          description: productForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar producto.');
      await onRefreshCatalog();
      setShowProductForm(false);
      setFeedback({
        type: 'ok',
        text: isEdit ? 'Producto actualizado correctamente.' : 'Producto agregado al catálogo.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error al guardar producto.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (pr: Product) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/products/${pr.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar producto.');
      await onRefreshCatalog();
      setFeedback({ type: 'ok', text: `Producto "${pr.name}" eliminado.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error eliminando producto.',
      });
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </section>
    );
  }

  if (!authStatus?.authenticated) {
    const isSetup = Boolean(authStatus?.requiresSetup);
    return (
      <section aria-labelledby="admin-auth-heading" className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Lock className="h-5 w-5" />
          </div>

          <h2 id="admin-auth-heading" className="mt-4 font-display text-xl font-bold text-slate-900">
            {isSetup ? 'Configurar clave de administración' : 'Acceso de administración'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            {isSetup
              ? 'Define una clave inicial (mínimo 6 caracteres) para habilitar altas, bajas y modificaciones del catálogo.'
              : 'Ingresa la clave de administración para gestionar farmacias, precios, stock y coordenadas.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-passcode" className="block text-xs font-semibold text-slate-700">
                {isSetup ? 'Nueva clave de administración' : 'Clave de administración'}
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                required
                minLength={isSetup ? 6 : 1}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </div>

            {authError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer min-h-[44px]"
            >
              {authSubmitting
                ? 'Verificando...'
                : isSetup
                ? 'Guardar clave y entrar'
                : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            Origen de datos actual:{' '}
            <strong className="text-slate-700">
              {authStatus?.storageMode === 'supabase' ? 'Supabase PostgreSQL' : 'Memoria local (sin credenciales Supabase aún)'}
            </strong>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="admin-heading" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="admin-heading" className="font-display text-2xl font-bold text-slate-900">
            Administración del catálogo y sucursales
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Altas, bajas y modificaciones protegidas en el servidor · Almacenamiento:{' '}
            <span className="font-medium text-slate-800">
              {authStatus.storageMode === 'supabase' ? 'Supabase' : 'Catálogo en memoria'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('products')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Productos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('pharmacies')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'pharmacies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Farmacias ({pharmacies.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {tab === 'products' ? (
        <div className="mt-6 space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openNewProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer min-h-[40px]"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          </div>

          {showProductForm && (
            <form
              onSubmit={handleSaveProduct}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <h3 className="font-display text-base font-bold text-slate-900">
                {productForm.id ? 'Editar producto' : 'Alta de producto'}
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Farmacia</label>
                  <select
                    required
                    value={productForm.pharmacy_id}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, pharmacy_id: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {pharmacies.map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre</label>
                  <input
                    required
                    type="text"
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ej. Protector Solar FPS 50+"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Marca</label>
                  <input
                    type="text"
                    value={productForm.brand}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, brand: e.target.value }))
                    }
                    placeholder="Ej. La Roche-Posay"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Categoría</label>
                  <select
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        category: e.target.value as ProductCategory,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Presentación</label>
                  <input
                    type="text"
                    value={productForm.presentation}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, presentation: e.target.value }))
                    }
                    placeholder="Ej. 50 ml"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Precio (MXN)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, price: Number(e.target.value) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Stock</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={productForm.stock}
                      onChange={(e) => {
                        const s = Math.max(0, Math.floor(Number(e.target.value)));
                        setProductForm((prev) => ({
                          ...prev,
                          stock: s,
                          available: s > 0 ? prev.available : false,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Descripción</label>
                <input
                  type="text"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Uso recomendado y detalles principales..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={productForm.available}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, available: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Visible como disponible para venta
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar producto'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Farmacia</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((pr) => {
                  const ph = pharmacies.find((p) => p.id === pr.pharmacy_id);
                  const ok = pr.available && pr.stock > 0;
                  return (
                    <tr key={pr.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{pr.name}</p>
                        <p className="text-xs text-slate-500">
                          {pr.brand} {pr.presentation ? `· ${pr.presentation}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{pr.category}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{ph?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {formatCurrencyMXN(pr.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-900 tabular-nums">
                        {pr.stock}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        <span className={ok ? 'text-emerald-700' : 'text-red-700'}>
                          {ok ? 'Disponible' : 'Agotado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditProduct(pr)}
                            aria-label={`Editar ${pr.name}`}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(pr)}
                            aria-label={`Eliminar ${pr.name}`}
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openNewPharmacy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer min-h-[40px]"
            >
              <Plus className="h-4 w-4" />
              Nueva farmacia
            </button>
          </div>

          {showPharmacyForm && (
            <form
              onSubmit={handleSavePharmacy}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
            >
              <h3 className="font-display text-base font-bold text-slate-900">
                {pharmacyForm.id ? 'Editar farmacia' : 'Registrar farmacia'}
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre</label>
                  <input
                    required
                    type="text"
                    value={pharmacyForm.name}
                    onChange={(e) =>
                      setPharmacyForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ej. Botica Narvarte"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Colonia / Zona</label>
                  <input
                    type="text"
                    value={pharmacyForm.neighborhood}
                    onChange={(e) =>
                      setPharmacyForm((prev) => ({ ...prev, neighborhood: e.target.value }))
                    }
                    placeholder="Ej. Narvarte, CDMX"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Dirección</label>
                  <input
                    required
                    type="text"
                    value={pharmacyForm.address}
                    onChange={(e) =>
                      setPharmacyForm((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Calle y número"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Contacto</label>
                  <input
                    required
                    type="text"
                    value={pharmacyForm.contact}
                    onChange={(e) =>
                      setPharmacyForm((prev) => ({ ...prev, contact: e.target.value }))
                    }
                    placeholder="+52 55 ..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Horarios</label>
                  <input
                    required
                    type="text"
                    value={pharmacyForm.hours}
                    onChange={(e) =>
                      setPharmacyForm((prev) => ({ ...prev, hours: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Latitud</label>
                    <input
                      required
                      type="number"
                      step="0.000001"
                      value={pharmacyForm.latitude}
                      onChange={(e) =>
                        setPharmacyForm((prev) => ({ ...prev, latitude: Number(e.target.value) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Longitud</label>
                    <input
                      required
                      type="number"
                      step="0.000001"
                      value={pharmacyForm.longitude}
                      onChange={(e) =>
                        setPharmacyForm((prev) => ({ ...prev, longitude: Number(e.target.value) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700">
                    Haz clic en OpenStreetMap para fijar coordenadas exactas (sincronizadas con Google Maps)
                  </span>
                  <a
                    href={buildGoogleMapsSearchUrl(
                      Number(pharmacyForm.latitude),
                      Number(pharmacyForm.longitude)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                  >
                    Probar en Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <LeafletOsmMap
                    pharmacies={pharmacies}
                    selectedPharmacyId={pharmacyForm.id || null}
                    onSelectPharmacy={() => {}}
                    syncedPin={{
                      lat: Number(pharmacyForm.latitude),
                      lng: Number(pharmacyForm.longitude),
                    }}
                    interactivePinMode
                    onMapClickCoordinates={(lat, lng) =>
                      setPharmacyForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                    }
                    heightClass="h-[250px]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={pharmacyForm.is_24h}
                  onChange={(e) =>
                    setPharmacyForm((prev) => ({ ...prev, is_24h: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Atiende 24 horas
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPharmacyForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar farmacia'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Farmacia</th>
                  <th className="px-4 py-3">Dirección y Contacto</th>
                  <th className="px-4 py-3">Horarios</th>
                  <th className="px-4 py-3">Coordenadas</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pharmacies.map((ph) => (
                  <tr key={ph.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{ph.name}</p>
                      <p className="text-xs text-slate-500">{ph.neighborhood}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{ph.address}</p>
                      <p className="font-mono text-slate-500">{ph.contact}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{ph.hours}</td>
                    <td className="px-4 py-3 text-xs">
                      <a
                        href={buildGoogleMapsSearchUrl(ph.latitude, ph.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-teal-800 hover:underline tabular-nums"
                      >
                        {formatCoordinates(ph.latitude, ph.longitude)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPharmacy(ph)}
                          aria-label={`Editar ${ph.name}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePharmacy(ph)}
                          aria-label={`Eliminar ${ph.name}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
