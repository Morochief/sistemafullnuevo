/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Authentication & Authorization Module — v2.0
 * Now backed by Supabase (via Prisma) instead of hardcoded users.
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from './src/types.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// JWT Secret - REQUIRED in .env - NO FALLBACK for security
const JWT_SECRET = process.env.JWT_SECRET;
// SECURITY Fix #15: JWT expiry configurable via env. Default '12h' (one work shift)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// SECURITY Phase 2 Fix #6: Environment-aware logger
const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
  info: console.log,
  warn: console.warn,
  error: console.error,
};

// SECURITY: Validate JWT_SECRET on startup
if (!JWT_SECRET || JWT_SECRET === 'CHANGE_THIS_IN_PRODUCTION_aFull_2026_Secret_Key' || JWT_SECRET.length < 32) {
  throw new Error(
    'SECURITY ERROR: JWT_SECRET must be set in .env file and must be at least 32 characters long. ' +
    'Generate one with: openssl rand -base64 32'
  );
}

import { Rol } from '@prisma/client';

/**
 * Helper to map DB Rol enum to UI string
 */
export function mapDbRolToUi(rol: Rol): 'Admin' | 'Operario' | 'Visor' {
  if (rol === Rol.ADMIN) return 'Admin';
  if (rol === Rol.VISOR) return 'Visor';
  return 'Operario';
}

/**
 * Helper to map UI string to DB Rol enum
 */
export function mapUiRolToDb(rol: string): Rol {
  const clean = String(rol).toLowerCase();
  if (clean === 'admin') return Rol.ADMIN;
  if (clean === 'visor') return Rol.VISOR;
  return Rol.OPERADOR;
}

/**
 * Seed initial users into the database if the table is empty.
 * Runs once on server startup.
 */
export async function seedUsersIfEmpty(): Promise<void> {
  try {
    const count = await prisma.usuario.count();
    if (count > 0) {
      logger.info('[AUTH SEED] Users already exist in DB, skipping seed.');
      return;
    }

    logger.info('[AUTH SEED] No users found — seeding initial users...');

    const initialUsers = [
      { username: 'admin', nombre: 'Administrador', dbRol: Rol.ADMIN, password: 'admin123', colaboradorId: null },
      { username: 'rodrigo', nombre: 'Rodrigo', dbRol: Rol.OPERADOR, password: 'rodrigo123', colaboradorId: 'col_kdsnf4jzk' },
      { username: 'ricardo', nombre: 'Ricardo', dbRol: Rol.OPERADOR, password: 'ricardo123', colaboradorId: 'col_mdtahyyln' },
      { username: 'eduardo', nombre: 'Eduardo', dbRol: Rol.OPERADOR, password: 'eduardo123', colaboradorId: 'col_y7j6hif9t' },
    ];

    for (const u of initialUsers) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(u.password, salt);
      await prisma.usuario.create({
        data: {
          username: u.username,
          nombre: u.nombre,
          rol: u.dbRol,
          passwordHash,
          colaboradorId: u.colaboradorId,
          activo: true,
        }
      });
      logger.info(`[AUTH SEED] Created user: ${u.username} (${u.dbRol})`);
    }

    logger.info('[AUTH SEED] Seed complete.');
  } catch (err: any) {
    logger.error('[AUTH SEED] Error seeding users:', err.message);
  }
}

/**
 * Generate hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET!, options);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET!) as JWTPayload;
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Authenticate user with credentials — reads from Supabase DB
 */
export async function authenticateUser(usuario: string, password: string): Promise<{
  usuario: string;
  nombre: string;
  rol: string;
  colaboradorId?: string;
} | null> {
  try {
    const user = await prisma.usuario.findFirst({
      where: {
        username: { equals: usuario, mode: 'insensitive' },
        activo: true,
      }
    });

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return {
      usuario: user.username,
      nombre: user.nombre,
      rol: mapDbRolToUi(user.rol),
      colaboradorId: user.colaboradorId ?? undefined,
    };
  } catch (err: any) {
    logger.error('[AUTH] authenticateUser error:', err.message);
    return null;
  }
}

// Memory cache for user active status checks (prevents DB saturation on every request)
export interface UserCacheEntry {
  activo: boolean;
  checkedAt: number;
}
export const userActiveCache = new Map<string, UserCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Express Middleware: Require Authentication
 * SECURITY Phase 2 Fix #5: Read JWT from httpOnly cookie instead of Authorization header
 * Also verifies user active status on DB (cached for 60s)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.jwt;
    
    if (!token) {
      logger.info('[AUTH] REJECTED: Missing JWT cookie on', req.method, req.path);
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token de autenticación requerido'
        }
      });
    }
    
    logger.info('[AUTH] Cookie received for', req.method, req.path);
    
    const payload = verifyToken(token);
    
    // Check if user is still active in DB
    const cacheKey = payload.usuario.toLowerCase();
    const cached = userActiveCache.get(cacheKey);
    const now = Date.now();
    
    let isUserActive = true;
    
    if (cached && (now - cached.checkedAt < CACHE_TTL_MS)) {
      isUserActive = cached.activo;
    } else {
      const userFromDb = await prisma.usuario.findFirst({
        where: {
          username: { equals: payload.usuario, mode: 'insensitive' }
        }
      });
      isUserActive = userFromDb ? userFromDb.activo : false;
      userActiveCache.set(cacheKey, { activo: isUserActive, checkedAt: now });
    }
    
    if (!isUserActive) {
      logger.info('[AUTH] REJECTED: User is inactive or deleted:', payload.usuario);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INACTIVE_USER',
          message: 'El usuario ha sido desactivado'
        }
      });
    }

    logger.info('[AUTH] Token verified successfully - user:', payload.nombre, 'rol:', payload.rol);
    
    (req as any).user = payload;
    next();
  } catch (error: any) {
    logger.info('[AUTH] Token verification failed on', req.method, req.path, '- error:', error.message);
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: error.message || 'Token inválido'
      }
    });
  }
}

/**
 * Express Middleware: Require Admin Role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JWTPayload;
  
  logger.info('[ADMIN CHECK] Checking admin access');
  logger.info('[ADMIN CHECK] User present:', !!user);
  if (user) {
    logger.info('[ADMIN CHECK] User role:', user.rol);
  }
  
  if (!user || user.rol !== 'Admin') {
    logger.info('[ADMIN CHECK] REJECTED: Not admin');
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acceso denegado: se requiere rol de Administrador'
      }
    });
  }
  
  logger.info('[ADMIN CHECK] PASSED: User is admin');
  next();
}

/**
 * Express Middleware: Optional Authentication
 * Attaches user if valid token present, but doesn't reject if missing
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.jwt;
    
    if (token) {
      const payload = verifyToken(token);
      (req as any).user = payload;
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  
  next();
}
