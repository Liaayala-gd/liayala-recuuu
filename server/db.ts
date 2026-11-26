import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Pharmacy, Product, ProductCategory } from '../shared/types.ts';
import { CATEGORY_IMAGES, SEED_PHARMACIES, SEED_PRODUCTS } from './seedData.ts';

let supabaseClient: SupabaseClient | null = null;
let supabaseInitialized = false;
let lastSeedError: string | null = null;
let oldMexicoSeedBlockedByRls = false;
let emptySeedBlockedByRls = false;
let supabaseReadOnlyAnonKey = false;

export function getLastSeedError(): string | null {
  return lastSeedError;
}

function isWriteCapableSupabaseKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return false;
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        role?: string;
      };
      if (payload.role === 'anon') return false;
    } catch {
      // Si no es un JWT estándar, continuar normalmente
    }
  }
  return true;
}

function formatSupabaseError(prefix: string, message: string): Error {
  if (message.toLowerCase().includes('row-level security')) {
    return new Error(
      `${prefix}: Permiso denegado por RLS en Supabase. Verifica que SUPABASE_SERVICE_ROLE_KEY sea la clave secreta "service_role" (no la clave pública "anon").`
    );
  }
  return new Error(`${prefix}: ${message}`);
}

// Almacenamiento en memoria cuando SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY aún no están definidos
let memoryPharmacies: Pharmacy[] = SEED_PHARMACIES.map((p) => ({ ...p }));
let memoryProducts: Product[] = SEED_PRODUCTS.map((p) => ({ ...p }));
let memoryAdminHash: string | null = null;

function sanitizeEnvValue(raw: string | undefined): string {
  const trimmed = (raw || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeSupabaseUrl(raw: string): string {
  const cleaned = sanitizeEnvValue(raw);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    // Siempre usar solo el origen (ej. https://xxxx.supabase.co), eliminando rutas como /rest/v1/
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return cleaned;
  }
}

function getSupabase(): SupabaseClient | null {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const key = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  supabaseReadOnlyAnonKey = !isWriteCapableSupabaseKey(key);
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

export function getStorageMode(): 'supabase' | 'memory' {
  return getSupabase() ? 'supabase' : 'memory';
}

export async function ensureSeededDatabase(): Promise<void> {
  const sb = getSupabase();
  if (!sb || supabaseInitialized) return;

  try {
    const { data, error } = await sb
      .from('pharmacies')
      .select('id, neighborhood')
      .limit(10);
    if (error) {
      lastSeedError = error.message;
      supabaseInitialized = true;
      return;
    }

    const hasOldMexicoSeed = (data ?? []).some(
      (row: { id: string; neighborhood?: string }) =>
        row.id.startsWith('11111111-1111-4111-8111-') &&
        (row.neighborhood || '').includes('CDMX')
    );
    const isEmpty = !data || data.length === 0;

    if (isEmpty || hasOldMexicoSeed) {
      if (supabaseReadOnlyAnonKey) {
        oldMexicoSeedBlockedByRls = hasOldMexicoSeed;
        emptySeedBlockedByRls = isEmpty;
        lastSeedError =
          'SUPABASE_SERVICE_ROLE_KEY corresponde a una clave pública "anon/publishable" de solo lectura; reemplázala por la clave secreta "service_role" para habilitar escrituras.';
        supabaseInitialized = true;
        return;
      }

      const { error: phError } = await sb
        .from('pharmacies')
        .upsert(SEED_PHARMACIES, { onConflict: 'id' });
      if (phError) {
        lastSeedError = phError.message;
        const isRls = phError.message.toLowerCase().includes('row-level security');
        if (isRls) {
          supabaseReadOnlyAnonKey = true;
          oldMexicoSeedBlockedByRls = hasOldMexicoSeed;
          emptySeedBlockedByRls = isEmpty;
          supabaseInitialized = true;
        }
        return;
      }
      const { error: prError } = await sb
        .from('products')
        .upsert(SEED_PRODUCTS, { onConflict: 'id' });
      if (prError) {
        lastSeedError = prError.message;
        const isRls = prError.message.toLowerCase().includes('row-level security');
        if (isRls) {
          supabaseReadOnlyAnonKey = true;
          oldMexicoSeedBlockedByRls = hasOldMexicoSeed;
          emptySeedBlockedByRls = isEmpty;
          supabaseInitialized = true;
        }
        return;
      }
    }
    lastSeedError = null;
    oldMexicoSeedBlockedByRls = false;
    emptySeedBlockedByRls = false;
    supabaseInitialized = true;
  } catch (err) {
    lastSeedError = err instanceof Error ? err.message : String(err);
  }
}

export async function getAdminHash(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || supabaseReadOnlyAnonKey) return memoryAdminHash;

  const { data, error } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_passcode_hash')
    .maybeSingle();

  if (error) {
    return memoryAdminHash;
  }
  return data?.value ?? memoryAdminHash;
}

export async function setAdminHash(hash: string): Promise<void> {
  memoryAdminHash = hash;
  const sb = getSupabase();
  if (!sb || supabaseReadOnlyAnonKey) return;

  const { error } = await sb.from('app_settings').upsert(
    {
      key: 'admin_passcode_hash',
      value: hash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    lastSeedError = error.message;
  }
}

export async function listPharmacies(): Promise<Pharmacy[]> {
  await ensureSeededDatabase();
  const sb = getSupabase();
  if (!sb) {
    return [...memoryPharmacies].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  const { data, error } = await sb.from('pharmacies').select('*').order('name', { ascending: true });
  if (error) throw formatSupabaseError('Error al consultar farmacias en Supabase', error.message);

  let rows = (data ?? []) as Pharmacy[];
  if (rows.length === 0 && emptySeedBlockedByRls) {
    rows = [...SEED_PHARMACIES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } else if (oldMexicoSeedBlockedByRls) {
    const seedById = new Map(SEED_PHARMACIES.map((p) => [p.id, p]));
    rows = rows
      .map((row) => {
        if ((row.neighborhood || '').includes('CDMX') && seedById.has(row.id)) {
          return seedById.get(row.id)!;
        }
        return row;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  return rows;
}

export async function createPharmacy(
  input: Omit<Pharmacy, 'id' | 'created_at'>
): Promise<Pharmacy> {
  await ensureSeededDatabase();
  const sb = getSupabase();
  const record: Pharmacy = {
    ...input,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };

  if (!sb) {
    memoryPharmacies.push(record);
    return record;
  }

  const { data, error } = await sb.from('pharmacies').insert(record).select().single();
  if (error) throw formatSupabaseError('Error al crear farmacia en Supabase', error.message);
  return data as Pharmacy;
}

export async function updatePharmacy(
  id: string,
  input: Partial<Omit<Pharmacy, 'id' | 'created_at'>>
): Promise<Pharmacy | null> {
  await ensureSeededDatabase();
  const sb = getSupabase();

  if (!sb) {
    const idx = memoryPharmacies.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    memoryPharmacies[idx] = { ...memoryPharmacies[idx], ...input };
    return memoryPharmacies[idx];
  }

  const { data, error } = await sb
    .from('pharmacies')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw formatSupabaseError('Error al actualizar farmacia en Supabase', error.message);
  return (data as Pharmacy | null) ?? null;
}

export async function deletePharmacy(id: string): Promise<boolean> {
  await ensureSeededDatabase();
  const sb = getSupabase();

  if (!sb) {
    const before = memoryPharmacies.length;
    memoryPharmacies = memoryPharmacies.filter((p) => p.id !== id);
    memoryProducts = memoryProducts.filter((pr) => pr.pharmacy_id !== id);
    return memoryPharmacies.length < before;
  }

  const { error, count } = await sb.from('pharmacies').delete({ count: 'exact' }).eq('id', id);
  if (error) throw formatSupabaseError('Error al eliminar farmacia en Supabase', error.message);
  return (count ?? 0) > 0;
}

export async function listProducts(filters?: {
  category?: string;
  available?: string;
  pharmacyId?: string;
  search?: string;
}): Promise<Product[]> {
  await ensureSeededDatabase();
  const sb = getSupabase();
  let items: Product[];

  if (!sb) {
    items = [...memoryProducts];
  } else {
    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw formatSupabaseError('Error al consultar productos en Supabase', error.message);
    items = (data ?? []) as Product[];
    if (items.length === 0 && emptySeedBlockedByRls) {
      items = [...SEED_PRODUCTS];
    } else if (oldMexicoSeedBlockedByRls) {
      const seedById = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
      items = items.map((item) => seedById.get(item.id) ?? item);
    }
  }

  if (filters?.category && filters.category !== 'Todas') {
    items = items.filter((p) => p.category === filters.category);
  }
  if (filters?.pharmacyId && filters.pharmacyId !== 'Todas') {
    items = items.filter((p) => p.pharmacy_id === filters.pharmacyId);
  }
  if (filters?.available === 'true') {
    items = items.filter((p) => p.available && p.stock > 0);
  } else if (filters?.available === 'false') {
    items = items.filter((p) => !p.available || p.stock <= 0);
  }
  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function createProduct(
  input: Omit<Product, 'id' | 'updated_at' | 'image_url'> & { image_url?: string }
): Promise<Product> {
  await ensureSeededDatabase();
  const sb = getSupabase();
  const category = input.category as ProductCategory;
  const record: Product = {
    ...input,
    id: crypto.randomUUID(),
    image_url: input.image_url?.trim() || CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Higiene Corporal'],
    available: input.stock > 0 ? input.available : false,
    updated_at: new Date().toISOString(),
  };

  if (!sb) {
    const exists = memoryPharmacies.some((ph) => ph.id === record.pharmacy_id);
    if (!exists) throw new Error('La farmacia seleccionada no existe.');
    memoryProducts.push(record);
    return record;
  }

  const { data, error } = await sb.from('products').insert(record).select().single();
  if (error) throw formatSupabaseError('Error al crear producto en Supabase', error.message);
  return data as Product;
}

export async function updateProduct(
  id: string,
  input: Partial<Omit<Product, 'id' | 'updated_at'>>
): Promise<Product | null> {
  await ensureSeededDatabase();
  const sb = getSupabase();
  const patch: Partial<Product> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.stock === 'number' && patch.stock <= 0) {
    patch.available = false;
  }

  if (!sb) {
    const idx = memoryProducts.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    memoryProducts[idx] = { ...memoryProducts[idx], ...patch };
    return memoryProducts[idx];
  }

  const { data, error } = await sb
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw formatSupabaseError('Error al actualizar producto en Supabase', error.message);
  return (data as Product | null) ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSeededDatabase();
  const sb = getSupabase();

  if (!sb) {
    const before = memoryProducts.length;
    memoryProducts = memoryProducts.filter((p) => p.id !== id);
    return memoryProducts.length < before;
  }

  const { error, count } = await sb.from('products').delete({ count: 'exact' }).eq('id', id);
  if (error) throw formatSupabaseError('Error al eliminar producto en Supabase', error.message);
  return (count ?? 0) > 0;
}
