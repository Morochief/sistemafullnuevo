/**
 * Auth Routes — login, logout, CSRF token, health check
 * Extraído de server.ts como parte del refactor a Express Routers.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth, requireAdmin, requireWriteAccess, hashPassword as hashPwd, mapDbRolToUi, mapUiRolToDb, userActiveCache } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse, JWTPayload, DatabaseState, RegistroItem } from '../../types.ts';
import { Decimal } from '@prisma/client/runtime/library';


import crypto from 'crypto';
import { csrfTokens } from '../shared.ts';
import { authLimiter } from '../config/rate-limiters.ts';
import { authenticateUser, generateToken } from '../../../server-auth.ts';
import { validateSchema, LoginSchema } from '../../../server-validation.ts';

export const authRouter = Router();

authRouter.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('[HEALTH CHECK] Database connection failed:', err.message);
    return res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

authRouter.get('/csrf-token', (req: Request, res: Response) => {
  let sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    sessionId = crypto.randomBytes(32).toString('hex');
    res.cookie('sessionId', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600000 });
  }
  const csrfToken = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, { token: csrfToken, createdAt: Date.now() });
  res.json({ success: true, data: { csrfToken } });
});

authRouter.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
  const validation = validateSchema(LoginSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos de login inválidos', details: validation.errors } } as ApiResponse);
  const { usuario, password } = validation.data!;
  const clientIp = getClientIp(req);
  try {
    const user = await authenticateUser(usuario, password);
    if (!user) {
      auditLog({ usuario, accion: 'login', recurso: '/api/auth/login', resultado: 'failure', ip: clientIp });
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' } } as ApiResponse);
    }
    const token = generateToken({ usuario: user.usuario, nombre: user.nombre, rol: user.rol, colaboradorId: user.colaboradorId });
    res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
    auditLog({ usuario: user.usuario, accion: 'login', recurso: '/api/auth/login', resultado: 'success', ip: clientIp });
    return res.status(200).json({ success: true, data: { user: { nombre: user.nombre, rol: user.rol, usuario: user.usuario, colaboradorId: user.colaboradorId || undefined } } } as ApiResponse);
  } catch (error: any) {
    logger.error('Login error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al procesar login' } } as ApiResponse);
  }
});

authRouter.post('/auth/logout', (req: Request, res: Response) => {
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const };
  res.clearCookie('jwt', cookieOptions);
  res.clearCookie('sessionId', cookieOptions);
  res.json({ success: true, message: 'Sesión cerrada con éxito' });
});

authRouter.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as JWTPayload;
  return res.json({
    success: true,
    data: {
      user: {
        nombre: user.nombre,
        rol: user.rol,
        usuario: user.usuario,
        colaboradorId: user.colaboradorId || undefined,
        cargo: user.cargo || undefined,
        departamento: user.departamento || undefined,
      },
    },
  });
});

// GET /auth/users - Listar todos los usuarios (admin) para asignar a hojas de ruta
authRouter.get('/auth/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.usuario.findMany({
      where: { activo: true },
      select: { username: true, nombre: true, rol: true },
      orderBy: { nombre: 'asc' }
    });
    res.json({ success: true, data: users.map(u => ({ username: u.username, nombre: u.nombre, rol: mapDbRolToUi(u.rol) })) });
  } catch (e: any) {
    logger.error('Error listando usuarios:', e);
    res.status(500).json({ success: false, error: { code: 'READ_ERROR', message: e.message || 'Error' } });
  }
});
