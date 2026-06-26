/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Authentication & Authorization Module
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { JWTPayload, User } from './src/types.ts';

// JWT Secret - REQUIRED in .env - NO FALLBACK for security
const JWT_SECRET = process.env.JWT_SECRET;
// SECURITY Fix #15: JWT expiry configurable via env. Default '12h' (one work shift)
// instead of '7d' to limit the window of a stolen token while avoiding annoying logouts.
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

// Demo users with hashed passwords
// In production, these would be in a proper database with unique salts
const DEMO_USERS: User[] = [
  {
    usuario: 'admin',
    nombre: 'Administrador',
    rol: 'Admin',
    // Password: admin123
    passwordHash: '$2b$10$9G18RkiUzdzmHjbGydo/eeFXjO9OD.z6RzgQAK9JeJhp845Kkg0Im'
    // Admin: no colaboradorId (can register hours for anyone)
  },
  {
    usuario: 'ricardo',
    nombre: 'Ricardo',
    rol: 'Operario',
    // Password: ricardo123
    passwordHash: '$2b$10$6ya9KoSOkWcSJvMaRMqV9e1WVkp.ta9jjbJv60NWzHSktrs98ScE.',
    colaboradorId: 'col_mdtahyyln' // DB: "Richard entrega"
  },
  {
    usuario: 'rodrigo',
    nombre: 'Rodrigo',
    rol: 'Técnico',
    // Password: rodrigo123
    passwordHash: '$2b$10$tcWnyrzrzIrwRDCdv08Td.8em1BTvH.GGkPUpfkHzsTzVvrpqLtna',
    colaboradorId: 'col_kdsnf4jzk' // DB: "Rodrigo retiro"
  },
  {
    usuario: 'eduardo',
    nombre: 'Edu',
    rol: 'Operario',
    // Password: eduardo123
    passwordHash: '$2b$10$DMLZnmntJJRo5edHsV5Hru3xJKMDdAu5rHC/GHxYL4ogG91zEhrLm',
    colaboradorId: 'col_y7j6hif9t' // DB: "Edu montaje"
  }
];

/**
 * Generate hashed password (for seeding users)
 * Usage: node -e "require('./server-auth.ts').hashPassword('mypassword')"
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
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Find user by username
 */
export function findUserByUsername(usuario: string): User | undefined {
  return DEMO_USERS.find(u => u.usuario.toLowerCase() === usuario.toLowerCase());
}

/**
 * Authenticate user with credentials
 */
export async function authenticateUser(usuario: string, password: string): Promise<User | null> {
  const user = findUserByUsername(usuario);
  
  if (!user) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  return isValid ? user : null;
}

/**
 * Express Middleware: Require Authentication
 * SECURITY Phase 2 Fix #5: Read JWT from httpOnly cookie instead of Authorization header
 * Usage: app.get('/api/protected', requireAuth, handler)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // SECURITY: Read token from httpOnly cookie (Phase 2 Fix #5)
    const token = req.cookies?.jwt;
    
    // DETAILED LOGGING: Check if cookie exists
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
    logger.info('[AUTH] Token verified successfully - user:', payload.nombre, 'rol:', payload.rol);
    
    // Attach user info to request
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
 * Usage: app.post('/api/admin-only', requireAuth, requireAdmin, handler)
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
 * SECURITY Phase 2 Fix #5: Read JWT from httpOnly cookie
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
