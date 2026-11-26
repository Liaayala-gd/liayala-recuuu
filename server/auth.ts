import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getAdminHash, setAdminHash } from './db.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function sha256(input: string): Buffer {
  return crypto.createHash('sha256').update(input).digest();
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyScryptHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hexHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function issueSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: Date.now() + TOKEN_TTL_MS,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return false;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token || !verifySessionToken(token)) {
    res.status(401).json({
      error: 'Se requiere sesión de administración activa para modificar el catálogo.',
    });
    return;
  }
  next();
}

export async function getAuthState(req?: Request) {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const storedHash = await getAdminHash();
  const token = req ? extractBearerToken(req) : null;
  const authenticated = token ? verifySessionToken(token) : false;

  return {
    envPasscodeConfigured: Boolean(envPasscode),
    claimed: Boolean(storedHash),
    requiresSetup: !envPasscode && !storedHash,
    authenticated,
  };
}

export async function claimInitialAdminPasscode(password: string): Promise<{ ok: boolean; error?: string; token?: string }> {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode) {
    return {
      ok: false,
      error: 'La clave de administración ya está configurada en las variables del servidor.',
    };
  }
  const existing = await getAdminHash();
  if (existing) {
    return {
      ok: false,
      error: 'La clave inicial de administración ya fue reclamada. Inicia sesión con ella.',
    };
  }
  if (!password || password.trim().length < 6) {
    return {
      ok: false,
      error: 'La clave debe tener al menos 6 caracteres.',
    };
  }
  const hash = hashPassword(password.trim());
  await setAdminHash(hash);
  return { ok: true, token: issueSessionToken() };
}

export async function verifyAdminLogin(password: string): Promise<{ ok: boolean; error?: string; token?: string }> {
  const candidate = (password || '').trim();
  if (!candidate) {
    return { ok: false, error: 'Ingresa tu clave de administración.' };
  }

  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode) {
    const valid = crypto.timingSafeEqual(sha256(candidate), sha256(envPasscode));
    if (!valid) {
      return { ok: false, error: 'Clave de administración incorrecta.' };
    }
    return { ok: true, token: issueSessionToken() };
  }

  const storedHash = await getAdminHash();
  if (!storedHash) {
    return {
      ok: false,
      error: 'Aún no se ha configurado ninguna clave de administración.',
    };
  }

  const valid = verifyScryptHash(candidate, storedHash);
  if (!valid) {
    return { ok: false, error: 'Clave de administración incorrecta.' };
  }
  return { ok: true, token: issueSessionToken() };
}
