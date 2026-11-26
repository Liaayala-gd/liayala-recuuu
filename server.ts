import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_CATEGORIES, type ProductCategory } from './shared/types.ts';
import {
  claimInitialAdminPasscode,
  getAuthState,
  requireAdmin,
  verifyAdminLogin,
} from './server/auth.ts';
import {
  createPharmacy,
  createProduct,
  deletePharmacy,
  deleteProduct,
  ensureSeededDatabase,
  getLastSeedError,
  getStorageMode,
  listPharmacies,
  listProducts,
  updatePharmacy,
  updateProduct,
} from './server/db.ts';
import { GeminiServiceError, runGeminiAssistant } from './server/gemini.ts';
import { fetchWeatherForecast } from './server/weather.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validatePharmacyBody(body: Record<string, unknown>, partial = false) {
  const result: Record<string, unknown> = {};
  const strFields = ['name', 'address', 'neighborhood', 'contact', 'hours'] as const;

  for (const f of strFields) {
    if (body[f] !== undefined) {
      if (typeof body[f] !== 'string' || !body[f].trim()) {
        throw new Error(`El campo "${f}" no puede estar vacío.`);
      }
      result[f] = body[f].trim();
    } else if (!partial && f !== 'neighborhood') {
      throw new Error(`Falta el campo obligatorio "${f}".`);
    }
  }

  if (body.neighborhood === undefined && !partial) {
    result.neighborhood = '';
  }

  if (body.is_24h !== undefined) {
    result.is_24h = Boolean(body.is_24h);
  } else if (!partial) {
    result.is_24h = false;
  }

  if (body.latitude !== undefined) {
    const lat = Number(body.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error('La latitud debe ser un número válido entre -90 y 90.');
    }
    result.latitude = lat;
  } else if (!partial) {
    throw new Error('Falta la latitud.');
  }

  if (body.longitude !== undefined) {
    const lng = Number(body.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error('La longitud debe ser un número válido entre -180 y 180.');
    }
    result.longitude = lng;
  } else if (!partial) {
    throw new Error('Falta la longitud.');
  }

  return result;
}

function validateProductBody(body: Record<string, unknown>, partial = false) {
  const result: Record<string, unknown> = {};

  if (body.pharmacy_id !== undefined) {
    if (typeof body.pharmacy_id !== 'string' || !body.pharmacy_id.trim()) {
      throw new Error('Selecciona una farmacia válida.');
    }
    result.pharmacy_id = body.pharmacy_id.trim();
  } else if (!partial) {
    throw new Error('Falta la farmacia asignada.');
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw new Error('El nombre del producto es obligatorio.');
    }
    result.name = body.name.trim();
  } else if (!partial) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  if (body.brand !== undefined) {
    result.brand = String(body.brand).trim();
  } else if (!partial) {
    result.brand = '';
  }

  if (body.category !== undefined) {
    const cat = String(body.category) as ProductCategory;
    if (!PRODUCT_CATEGORIES.includes(cat)) {
      throw new Error('Categoría de producto inválida.');
    }
    result.category = cat;
  } else if (!partial) {
    throw new Error('La categoría es obligatoria.');
  }

  if (body.presentation !== undefined) {
    result.presentation = String(body.presentation).trim();
  } else if (!partial) {
    result.presentation = '';
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('El precio debe ser un número mayor o igual a 0.');
    }
    result.price = Number(price.toFixed(2));
  } else if (!partial) {
    throw new Error('El precio es obligatorio.');
  }

  if (body.stock !== undefined) {
    const stock = Math.floor(Number(body.stock));
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error('El stock debe ser un número entero mayor o igual a 0.');
    }
    result.stock = stock;
  } else if (!partial) {
    throw new Error('El stock es obligatorio.');
  }

  if (body.available !== undefined) {
    result.available = Boolean(body.available);
  } else if (!partial) {
    result.available = Number(result.stock ?? 0) > 0;
  }

  if (body.description !== undefined) {
    result.description = String(body.description).trim();
  } else if (!partial) {
    result.description = '';
  }

  if (body.image_url !== undefined) {
    const img = String(body.image_url).trim();
    if (img && !img.startsWith('/src/assets/') && !img.startsWith('https://')) {
      throw new Error('URL de imagen no permitida.');
    }
    result.image_url = img;
  }

  return result;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  await ensureSeededDatabase();

  // Salud y estado del almacenamiento (sin exponer secretos)
  app.get('/api/health', async (req, res) => {
    const auth = await getAuthState(req);
    res.json({
      ok: true,
      storageMode: getStorageMode(),
      authenticated: auth.authenticated,
      seedError: getLastSeedError(),
    });
  });

  // Autenticación de administración (control de permisos de escritura)
  app.get('/api/auth/status', async (req, res) => {
    try {
      const state = await getAuthState(req);
      res.json({
        ...state,
        storageMode: getStorageMode(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando estado de autenticación.',
      });
    }
  });

  app.post('/api/auth/setup', async (req, res) => {
    try {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const result = await claimInitialAdminPasscode(password);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ token: result.token });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error configurando la clave inicial.',
      });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const result = await verifyAdminLogin(password);
      if (!result.ok) {
        res.status(401).json({ error: result.error });
        return;
      }
      res.json({ token: result.token });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al iniciar sesión.',
      });
    }
  });

  // Farmacias (Lectura pública, escritura protegida)
  app.get('/api/pharmacies', async (_req, res) => {
    try {
      const data = await listPharmacies();
      res.json({ pharmacies: data, storageMode: getStorageMode() });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al obtener farmacias.',
      });
    }
  });

  app.post('/api/pharmacies', requireAdmin, async (req, res) => {
    try {
      const valid = validatePharmacyBody((req.body ?? {}) as Record<string, unknown>, false);
      const created = await createPharmacy(
        valid as Parameters<typeof createPharmacy>[0]
      );
      res.status(201).json({ pharmacy: created });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al crear farmacia.',
      });
    }
  });

  app.put('/api/pharmacies/:id', requireAdmin, async (req, res) => {
    try {
      const valid = validatePharmacyBody((req.body ?? {}) as Record<string, unknown>, true);
      const updated = await updatePharmacy(
        req.params.id,
        valid as Parameters<typeof updatePharmacy>[1]
      );
      if (!updated) {
        res.status(404).json({ error: 'Farmacia no encontrada.' });
        return;
      }
      res.json({ pharmacy: updated });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al actualizar farmacia.',
      });
    }
  });

  app.delete('/api/pharmacies/:id', requireAdmin, async (req, res) => {
    try {
      const removed = await deletePharmacy(req.params.id);
      if (!removed) {
        res.status(404).json({ error: 'Farmacia no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al eliminar farmacia.',
      });
    }
  });

  // Productos (Lectura pública con filtros, escritura protegida)
  app.get('/api/products', async (req, res) => {
    try {
      const items = await listProducts({
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        available: typeof req.query.available === 'string' ? req.query.available : undefined,
        pharmacyId: typeof req.query.pharmacyId === 'string' ? req.query.pharmacyId : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.json({ products: items });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al consultar productos.',
      });
    }
  });

  app.post('/api/products', requireAdmin, async (req, res) => {
    try {
      const valid = validateProductBody((req.body ?? {}) as Record<string, unknown>, false);
      const created = await createProduct(valid as Parameters<typeof createProduct>[0]);
      res.status(201).json({ product: created });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al crear producto.',
      });
    }
  });

  app.put('/api/products/:id', requireAdmin, async (req, res) => {
    try {
      const valid = validateProductBody((req.body ?? {}) as Record<string, unknown>, true);
      const updated = await updateProduct(
        req.params.id,
        valid as Parameters<typeof updateProduct>[1]
      );
      if (!updated) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      res.json({ product: updated });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al actualizar producto.',
      });
    }
  });

  app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    try {
      const removed = await deleteProduct(req.params.id);
      if (!removed) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error al eliminar producto.',
      });
    }
  });

  // Pronóstico meteorológico en tiempo real (Open-Meteo, sin datos simulados)
  app.get('/api/weather', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Debes proporcionar parámetros lat y lng válidos.' });
      return;
    }
    try {
      const forecast = await fetchWeatherForecast(lat, lng);
      res.json(forecast);
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Error al consultar la API meteorológica en tiempo real.',
      });
    }
  });

  // Asistente Inteligente Gemini (server-side con Function Calling)
  app.post('/api/chat', async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'Escribe una pregunta para el asistente.' });
      return;
    }
    try {
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const selectedPharmacyId =
        typeof req.body?.selectedPharmacyId === 'string' ? req.body.selectedPharmacyId : undefined;
      const result = await runGeminiAssistant({
        message,
        history,
        selectedPharmacyId,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      const msg =
        err instanceof Error ? err.message : 'No fue posible obtener respuesta de Gemini.';
      const status =
        msg.includes('GEMINI_API_KEY') || msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED')
          ? 503
          : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Vite en desarrollo / archivos estáticos en producción
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Botica Atlas ejecutándose en http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
