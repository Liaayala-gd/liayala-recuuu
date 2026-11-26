import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';
import { listPharmacies, listProducts } from './db.ts';
import { fetchWeatherForecast } from './weather.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'No se encontró la clave GEMINI_API_KEY configurada en el servidor. Configúrala en Settings > Secrets o en las variables de entorno.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const searchProductsDeclaration: FunctionDeclaration = {
  name: 'buscar_productos_y_farmacias',
  description:
    'Busca productos de higiene y cuidado personal en el catálogo vivo y devuelve en qué farmacias están disponibles, su precio, stock, dirección, horario y coordenadas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          'Palabra clave del producto o ingrediente (ej. "protector solar", "jabón", "shampoo", "pasta dental"). Deja vacío para listar todos.',
      },
      category: {
        type: Type.STRING,
        description:
          'Categoría opcional: Protección Solar, Higiene Corporal, Cuidado Facial, Higiene Bucal, Cuidado Capilar, Botiquín e Higiene.',
      },
      onlyAvailable: {
        type: Type.BOOLEAN,
        description: 'Si es true, filtra únicamente productos con stock > 0 y disponibles.',
      },
    },
  },
};

const listPharmaciesDeclaration: FunctionDeclaration = {
  name: 'listar_farmacias',
  description:
    'Obtiene la lista completa de farmacias registradas con nombre, dirección, colonia, teléfono, horarios, si atiende 24 horas y coordenadas geográficas.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getPharmacyWeatherDeclaration: FunctionDeclaration = {
  name: 'consultar_clima_farmacia',
  description:
    'Consulta el pronóstico meteorológico real en tiempo real (temperatura, probabilidad de lluvia y próximas horas) para una farmacia por su ID o nombre.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pharmacyIdOrName: {
        type: Type.STRING,
        description: 'ID o nombre aproximado de la farmacia a consultar.',
      },
    },
  },
};

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  selectedPharmacyId?: string
): Promise<Record<string, unknown>> {
  if (name === 'buscar_productos_y_farmacias') {
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
    const category = typeof args.category === 'string' ? args.category.trim() : '';
    const onlyAvailable = Boolean(args.onlyAvailable);

    const [pharmacies, products] = await Promise.all([listPharmacies(), listProducts()]);
    const pharmacyMap = new Map(pharmacies.map((p) => [p.id, p]));

    const matches = products
      .filter((pr) => {
        if (onlyAvailable && (!pr.available || pr.stock <= 0)) return false;
        if (category && category !== 'Todas' && pr.category.toLowerCase() !== category.toLowerCase()) {
          return false;
        }
        if (query) {
          const haystack = `${pr.name} ${pr.brand} ${pr.category} ${pr.description}`.toLowerCase();
          const terms = query.split(/\s+/).filter(Boolean);
          return terms.every((t) => haystack.includes(t));
        }
        return true;
      })
      .map((pr) => {
        const ph = pharmacyMap.get(pr.pharmacy_id);
        return {
          producto: pr.name,
          marca: pr.brand,
          categoria: pr.category,
          presentacion: pr.presentation,
          precioPYG: pr.price,
          moneda: 'Guaraníes (PYG / Gs.)',
          stock: pr.stock,
          disponible: pr.available && pr.stock > 0,
          farmacia: ph?.name ?? 'Desconocida',
          direccion: ph?.address ?? '',
          horario: ph?.hours ?? '',
          contacto: ph?.contact ?? '',
          coordenadas: ph ? `${ph.latitude}, ${ph.longitude}` : '',
        };
      });

    return {
      totalCoincidencias: matches.length,
      resultados: matches,
    };
  }

  if (name === 'listar_farmacias') {
    const [pharmacies, products] = await Promise.all([listPharmacies(), listProducts()]);
    return {
      total: pharmacies.length,
      farmacias: pharmacies.map((ph) => ({
        id: ph.id,
        nombre: ph.name,
        direccion: ph.address,
        colonia: ph.neighborhood,
        contacto: ph.contact,
        horarios: ph.hours,
        abierta24h: ph.is_24h,
        latitud: ph.latitude,
        longitud: ph.longitude,
        productosDisponibles: products.filter(
          (pr) => pr.pharmacy_id === ph.id && pr.available && pr.stock > 0
        ).length,
      })),
    };
  }

  if (name === 'consultar_clima_farmacia') {
    const pharmacies = await listPharmacies();
    const targetQuery =
      typeof args.pharmacyIdOrName === 'string' ? args.pharmacyIdOrName.trim().toLowerCase() : '';

    let pharmacy = pharmacies.find((p) => p.id === selectedPharmacyId);
    if (targetQuery) {
      pharmacy =
        pharmacies.find(
          (p) => p.id.toLowerCase() === targetQuery || p.name.toLowerCase().includes(targetQuery)
        ) || pharmacy;
    }
    if (!pharmacy) {
      pharmacy = pharmacies[0];
    }
    if (!pharmacy) {
      return { error: 'No hay farmacias registradas.' };
    }

    try {
      const weather = await fetchWeatherForecast(pharmacy.latitude, pharmacy.longitude);
      return {
        farmacia: pharmacy.name,
        direccion: pharmacy.address,
        temperaturaActualC: weather.current.temperature,
        probabilidadLluviaActualPct: weather.current.rainProbability,
        condicionActual: weather.current.weatherLabel,
        vientoKmh: weather.current.windSpeed,
        proximasHoras: weather.hourly.slice(0, 6).map((h) => ({
          hora: h.time,
          temperaturaC: h.temperature,
          probabilidadLluviaPct: h.rainProbability,
          condicion: h.weatherLabel,
        })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'No fue posible consultar la API meteorológica.',
      };
    }
  }

  return { error: `Herramienta desconocida: ${name}` };
}

export interface ChatTurnInput {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  selectedPharmacyId?: string;
}

export class GeminiServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiErrorDetails(err: unknown): {
  statusCode: number;
  rawStatus: string;
  rawMessage: string;
  isTransient: boolean;
} {
  const errObj = err as { status?: number; code?: number; message?: string } | undefined;
  let statusCode = Number(errObj?.status || errObj?.code || 500);
  let rawStatus = '';
  let rawMessage = err instanceof Error ? err.message : String(err ?? '');

  if (rawMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed.error) {
        statusCode = Number(parsed.error.code || statusCode);
        rawStatus = String(parsed.error.status || '');
        rawMessage = String(parsed.error.message || rawMessage);
      }
    } catch {
      // Ignorar si no es JSON válido
    }
  }

  const lower = `${rawStatus} ${rawMessage}`.toLowerCase();
  const isTransient =
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed');

  return { statusCode, rawStatus, rawMessage, isTransient };
}

function formatUserFriendlyError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const { statusCode, rawStatus, rawMessage } = parseGeminiErrorDetails(err);
  const lower = `${rawStatus} ${rawMessage}`.toLowerCase();

  if (
    statusCode === 403 ||
    statusCode === 400 && lower.includes('api_key') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid')
  ) {
    return new GeminiServiceError(
      'La clave de Gemini no es válida o no tiene permisos. Verifica GEMINI_API_KEY en Settings > Secrets.',
      403
    );
  }
  if (statusCode === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
    return new GeminiServiceError(
      'El servicio de Gemini presenta alta demanda temporalmente (503). Espera unos segundos y pulsa Reintentar.',
      503
    );
  }
  if (statusCode === 429 || lower.includes('resource_exhausted')) {
    return new GeminiServiceError(
      'Se alcanzó temporalmente el límite de solicitudes de Gemini (429). Intenta de nuevo en unos instantes.',
      429
    );
  }
  return new GeminiServiceError(
    rawMessage || 'No fue posible obtener respuesta del asistente en este momento.',
    statusCode >= 400 && statusCode < 600 ? statusCode : 500
  );
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: {
    contents: Content[];
    systemInstruction: string;
    tools: Array<{ functionDeclarations: FunctionDeclaration[] }>;
    preferredModel?: string;
  }
) {
  const models = params.preferredModel
    ? [params.preferredModel]
    : [PRIMARY_MODEL, FALLBACK_MODEL];
  const delaysMs = [700, 1500];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            tools: params.tools,
          },
        });
        return { response: res, modelUsed: model };
      } catch (err) {
        lastError = err;
        const details = parseGeminiErrorDetails(err);
        if (!details.isTransient) {
          throw formatUserFriendlyError(err);
        }
        if (attempt < delaysMs.length) {
          await sleep(delaysMs[attempt]);
        }
      }
    }
  }

  throw formatUserFriendlyError(lastError);
}

export async function runGeminiAssistant(input: ChatTurnInput): Promise<{
  reply: string;
  sourcesUsed: string[];
}> {
  const ai = getAiClient();
  const pharmacies = await listPharmacies();
  const selected = pharmacies.find((p) => p.id === input.selectedPharmacyId);

  const systemInstruction = [
    'Eres el asistente inteligente de Botica Atlas, una red de farmacias en Paraguay especializada en higiene y cuidado personal.',
    'Responde siempre en español claro, útil, empático y bien estructurado.',
    'Reglas fundamentales:',
    '1. Cuando el usuario pregunte por productos, disponibilidad, precios, stock, sucursales u horarios, USA las herramientas (buscar_productos_y_farmacias o listar_farmacias) para consultar los datos reales del sistema. Nunca inventes stock ni precios.',
    '2. Si el usuario pregunta por el clima de una sucursal o menciona salir bajo lluvia/sol, puedes usar consultar_clima_farmacia si aporta contexto real, y además responder recomendaciones prácticas generales y responsables de higiene, cuidado personal o prevención.',
    '3. Nunca des diagnósticos médicos definitivos; para síntomas médicos graves sugiere acudir con un profesional de la salud.',
    '4. Presenta nombres de farmacias, direcciones en Paraguay, horarios, precios en guaraníes (Gs. / PYG) y cantidades disponibles de forma clara.',
    selected
      ? `Contexto actual de la interfaz: el usuario tiene seleccionada la farmacia "${selected.name}" (${selected.address}, coordenadas ${selected.latitude}, ${selected.longitude}).`
      : 'No hay una farmacia seleccionada específicamente en este momento.',
  ].join('\n');

  const contents: Content[] = [];
  if (Array.isArray(input.history)) {
    for (const turn of input.history.slice(-8)) {
      if (!turn.text?.trim()) continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: input.message }],
  });

  const tools = [
    {
      functionDeclarations: [
        searchProductsDeclaration,
        listPharmaciesDeclaration,
        getPharmacyWeatherDeclaration,
      ],
    },
  ];

  const sourcesUsed = new Set<string>();
  const sourceLabels: Record<string, string> = {
    buscar_productos_y_farmacias: 'Catálogo de productos y stock',
    listar_farmacias: 'Directorio de farmacias',
    consultar_clima_farmacia: 'Pronóstico meteorológico en vivo',
  };

  let { response, modelUsed } = await generateWithResilience(ai, {
    contents,
    systemInstruction,
    tools,
  });

  for (let round = 0; round < 4; round++) {
    const functionCalls = response.functionCalls;
    const modelContent = response.candidates?.[0]?.content;
    if (!functionCalls || functionCalls.length === 0 || !modelContent) {
      break;
    }

    contents.push(modelContent);

    const responseParts = [];
    for (const call of functionCalls) {
      const fnName = call.name || '';
      sourcesUsed.add(sourceLabels[fnName] || fnName);
      const result = await executeToolCall(
        fnName,
        (call.args ?? {}) as Record<string, unknown>,
        input.selectedPharmacyId
      );
      responseParts.push({
        functionResponse: {
          id: call.id,
          name: fnName,
          response: result,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: responseParts,
    });

    const nextTurn = await generateWithResilience(ai, {
      contents,
      systemInstruction,
      tools,
      preferredModel: modelUsed,
    });
    response = nextTurn.response;
  }

  const reply = (response.text || '').trim();
  if (!reply) {
    throw new GeminiServiceError(
      'Gemini no devolvió texto de respuesta. Intenta reformular tu consulta.',
      502
    );
  }

  return {
    reply,
    sourcesUsed: Array.from(sourcesUsed),
  };
}
