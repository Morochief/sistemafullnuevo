/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Load environment variables FIRST
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Mutex } from 'async-mutex';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { DatabaseState, Cliente, Proyecto, Colaborador, RegistroItem, ApiResponse, JWTPayload } from './src/types.ts';
import { 
  requireAuth, 
  requireAdmin, 
  authenticateUser, 
  generateToken,
  optionalAuth 
} from './server-auth.ts';
import { 
  LoginSchema,
  RegistroItemSchema,
  DatabaseStateSchema,
  GeminiEnrichSchema,
  TimerStartSchema,
  TimerStopSchema,
  TimerSyncSchema,
  TimerPauseSchema,
  TimerResumeSchema,
  ViajeStartSchema,
  ViajeStopSchema,
  RegistroVehiculoUpdateSchema,
  RegistroVehiculoPatchSchema,
  validateSchema 
} from './server-validation.ts';
import { auditLog, getClientIp } from './server-audit.ts';
import { prisma } from './src/lib/prisma.ts';
import { Decimal } from '@prisma/client/runtime/library';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Environment-aware logger (Phase 2 Fix #6)
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

// SECURITY Phase 2 Fix #3: CSRF token storage (in-memory for demo, use Redis in production)
const csrfTokens = new Map<string, { token: string; createdAt: number }>();
const CSRF_TOKEN_EXPIRY = 3600000; // 1 hour

// Clean up expired CSRF tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
      csrfTokens.delete(sessionId);
    }
  }
}, 600000);

// SECURITY Phase 2 Fix #2: Helmet - Security Headers
// CSP disabled in development to allow Vite HMR
const isProduction = process.env.NODE_ENV === 'production';
logger.info(`[HELMET] Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode - CSP ${isProduction ? 'ENABLED' : 'DISABLED'}`);

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // For Tailwind CSS + Google Fonts
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false, // Disable CSP in development for Vite HMR
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false, // Disable HSTS in development
  frameguard: { action: 'deny' }, // Prevent clickjacking
  noSniff: true, // Prevent MIME sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// SECURITY Phase 2 Fix #3: CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.APP_URL || `http://localhost:${PORT}`)
    : [`http://localhost:${PORT}`, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true, // IMPORTANT: Allow cookies to be sent
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Cookie parser for JWT cookies and CSRF (Phase 2 Fix #3 & #5)
app.use(cookieParser());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// SECURITY: Enforce HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
});

const dbPath = path.join(__dirname, 'database.json');

// Mutex for thread-safe database writes
const dbMutex = new Mutex();

// Initialize local JSON DB state
const initialData: DatabaseState = {
  clientes: [
    { id: 'cli_1', nombre: 'Empresa 1 S.A.', codigo: 'EMP1', fechaCreacion: '2026-05-10' },
    { id: 'cli_2', nombre: 'Estudio Alpha SL', codigo: 'ALPH', fechaCreacion: '2026-05-15' },
    { id: 'cli_3', nombre: 'Distribuidora Global', codigo: 'GLOB', fechaCreacion: '2026-06-01' }
  ],
  proyectos: [
    { id: 'pro_1', clienteId: 'cli_1', nombre: 'Ploteo de 2 Freezers Marca XXX', estado: 'En Proceso', fechaInicio: '2026-05-12' },
    { id: 'pro_2', clienteId: 'cli_2', nombre: 'Cartelería Luminosa Local Central', estado: 'Pendiente', fechaInicio: '2026-06-10' },
    { id: 'pro_3', clienteId: 'cli_1', nombre: 'Mantenimiento de Góndolas Supermercado', estado: 'Completado', fechaInicio: '2026-05-20' }
  ],
  colaboradores: [
    { id: 'col_1', nombre: 'Rodrigo Gómez', tarifaSugerida: 350, rol: 'Técnico de Ploteo' },
    { id: 'col_2', nombre: 'Kevin Delgado', tarifaSugerida: 400, rol: 'Instalador Senior' },
    { id: 'col_3', nombre: 'Laura Benítez', tarifaSugerida: 320, rol: 'Ayudante de Taller' }
  ],
  registros: [
    {
      id: 'reg_1',
      clienteId: 'cli_1',
      clienteNombre: 'Empresa 1 S.A.',
      proyectoId: 'pro_1',
      proyectoNombre: 'Ploteo de 2 Freezers Marca XXX',
      fecha: '2026-06-15',
      concepto: 'MO',
      descripcion: 'Rodrigo Gómez retiro y ploteado',
      colaboradorId: 'col_1',
      hsInicio: '08:00',
      hsFin: '12:00',
      hsTotal: 4,
      cantidad: 240, // 240 minutos
      precioUnitario: 350,
      total: 84000,
      origen: 'Excel',
      fechaImportacion: '2026-06-18'
    },
    {
      id: 'reg_2',
      clienteId: 'cli_1',
      clienteNombre: 'Empresa 1 S.A.',
      proyectoId: 'pro_1',
      proyectoNombre: 'Ploteo de 2 Freezers Marca XXX',
      fecha: '2026-06-15',
      concepto: 'Insumo',
      descripcion: 'Vinilo Impreso Premium Mate',
      cantidad: 5, // metros
      precioUnitario: 12000,
      total: 60000,
      origen: 'Manual',
      fechaImportacion: '2026-06-18'
    }
  ],
  timersActivos: [],
  registrosVehiculo: [],
  viajesActivos: []
};

// Help helper to read database state
function readDb(): DatabaseState {
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    logger.error('Error reading local db file, fallback to initial state', err);
  }
  return initialData;
}

// Help helper to write database state with mutex protection
async function writeDbSafe(data: DatabaseState): Promise<void> {
  const release = await dbMutex.acquire();
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error('Error writing local db file', err);
    throw err;
  } finally {
    release();
  }
}

// Safe atomic update with modifier function
async function updateDbSafe(modifier: (data: DatabaseState) => DatabaseState): Promise<DatabaseState> {
  const release = await dbMutex.acquire();
  try {
    const currentData = readDb();
    const newData = modifier(currentData);
    fs.writeFileSync(dbPath, JSON.stringify(newData, null, 2), 'utf8');
    return newData;
  } catch (err) {
    logger.error('Error updating db file', err);
    throw err;
  } finally {
    release();
  }
}

// Ensure database file exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
  // SECURITY: Set file permissions to 0o600 (read/write for owner only)
  try {
    fs.chmodSync(dbPath, 0o600);
    logger.info('[SECURITY] Database file permissions set to 0o600 (owner read/write only)');
  } catch (err) {
    logger.warn('[SECURITY WARNING] Could not set database file permissions:', err);
  }
}

// Setup Multer for upload handling
// SECURITY Phase 3 Fix #18: Enforce size/count limits and restrict to Excel files
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xls, .xlsx)'));
    }
  }
});

// SECURITY: Rate limiter for authentication endpoint
// QA Fix: Reduced dev limit from 100 to 20 for better security
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 20 attempts in dev, 5 in production
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de inicio de sesión. Por favor, intentá nuevamente en 15 minutos.'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// SECURITY Phase 2 Fix #3: CSRF Protection Middleware
function validateCSRF(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET requests (they should be idempotent)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionId = req.cookies?.sessionId;
  
  // DEBUG: More visible logging
  logger.info('[CSRF] Validating request:', req.method, req.path);
  logger.info('[CSRF] SessionId present:', !!sessionId);
  logger.info('[CSRF] CSRF Token present:', !!csrfToken);
  
  if (!sessionId || !csrfToken) {
    logger.info('[CSRF] REJECTED: Missing CSRF token or session ID');
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'Token CSRF requerido'
      }
    });
  }
  
  const storedToken = csrfTokens.get(sessionId);
  logger.info('[CSRF] Stored token found:', !!storedToken);
  
  if (!storedToken || storedToken.token !== csrfToken) {
    logger.info('[CSRF] REJECTED: Invalid CSRF token');
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Token CSRF inválido'
      }
    });
  }
  
  // Check if token expired
  if (Date.now() - storedToken.createdAt > CSRF_TOKEN_EXPIRY) {
    csrfTokens.delete(sessionId);
    logger.info('[CSRF] REJECTED: Expired CSRF token');
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_EXPIRED',
        message: 'Token CSRF expirado'
      }
    });
  }
  
  logger.info('[CSRF] PASSED validation');
  next();
}

// Apply CSRF protection to all API routes except login, logout, and CSRF token generation
app.use('/api', (req, res, next) => {
  // Skip CSRF for login, logout, and csrf-token endpoints
  if (req.path === '/auth/login' || req.path === '/auth/logout' || req.path === '/csrf-token') {
    return next();
  }
  validateCSRF(req, res, next);
});

// --- AUTHENTICATION ROUTES (PUBLIC) ---

/**
 * GET /api/csrf-token
 * SECURITY Phase 2 Fix #3: Generate CSRF token
 */
app.get('/api/csrf-token', (req, res) => {
  // Generate or reuse session ID
  let sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    sessionId = crypto.randomBytes(32).toString('hex');
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
  }
  
  // Generate CSRF token
  const csrfToken = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, { token: csrfToken, createdAt: Date.now() });
  
  res.json({
    success: true,
    data: { csrfToken }
  });
});

/**
 * POST /api/auth/login
 * Authenticate user and set JWT in httpOnly cookie (SECURITY Phase 2 Fix #5)
 * SECURITY: Rate limited to 5 attempts per 15 minutes
 */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const validation = validateSchema(LoginSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de login inválidos',
        details: validation.errors
      }
    } as ApiResponse);
  }
  
  const { usuario, password } = validation.data!;
  const clientIp = getClientIp(req);
  
  try {
    const user = await authenticateUser(usuario, password);
    
    if (!user) {
      // SECURITY Fix #17: Audit failed login
      auditLog({
        usuario,
        accion: 'login',
        recurso: '/api/auth/login',
        resultado: 'failure',
        ip: clientIp
      });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos'
        }
      } as ApiResponse);
    }
    
    const token = generateToken({
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      colaboradorId: user.colaboradorId // SECURITY Fix #16: carry colaboradorId in token
    });
    
    // SECURITY Phase 2 Fix #5: Set JWT in httpOnly cookie (not in response body)
    // SECURITY Fix #15: maxAge must match JWT expiry (default 12h)
    res.cookie('jwt', token, {
      httpOnly: true, // Cannot be accessed by JavaScript
      secure: process.env.NODE_ENV === 'production', // Only over HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Lax in dev for localhost
      maxAge: 12 * 60 * 60 * 1000 // 12 hours (matches JWT_EXPIRES_IN default)
    });
    
    // SECURITY Fix #17: Audit successful login
    auditLog({
      usuario: user.usuario,
      accion: 'login',
      recurso: '/api/auth/login',
      resultado: 'success',
      ip: clientIp
    });
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          nombre: user.nombre,
          rol: user.rol,
          usuario: user.usuario
        }
        // SECURITY: Token NOT returned in response body anymore
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al procesar login'
      }
    } as ApiResponse);
  }
});

/**
 * POST /api/auth/logout
 * SECURITY Phase 2 Fix #5: Clear JWT cookie
 */
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('jwt');
  res.clearCookie('sessionId');
  res.json({
    success: true,
    message: 'Sesión cerrada con éxito'
  });
});

// Helper to convert sheet date to YYYY-MM-DD
function parseExcelDate(excelDate: any): string {
  if (!excelDate) return new Date().toISOString().substring(0, 10);
  
  if (typeof excelDate === 'number') {
    // Offset standard for double epoch
    const date = new Date((excelDate - (excelDate > 60 ? 2 : 1)) * 24 * 60 * 60 * 1000 + new Date('1900-01-01').getTime());
    return date.toISOString().substring(0, 10);
  }
  
  // Clean text parsing
  try {
    const parsedStr = String(excelDate).trim();
    // Match standard YYYY-MM-DD or DD/MM/YYYY
    if (parsedStr.includes('/') || parsedStr.includes('-')) {
      const parts = parsedStr.split(/[-/]/);
      if (parts.length === 3) {
        // Check if DD/MM/YYYY (Latin) vs YYYY/MM/DD
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    const d = new Date(excelDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  } catch (e) {}

  return new Date().toISOString().substring(0, 10);
}

// Generate unique IDs
function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

// --- API ROUTES (PROTECTED) ---

// Helper function to convert Prisma data to frontend format
function convertPrismaToFrontend(prismaData: any): DatabaseState {
  // Helper to map Prisma enum to frontend format
  const mapEstadoProyecto = (estado: string): 'Pendiente' | 'En Proceso' | 'Completado' => {
    if (estado === 'EN_PROCESO') return 'En Proceso';
    if (estado === 'COMPLETADO') return 'Completado';
    return 'Pendiente';
  };

  return {
    clientes: prismaData.clientes.map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo,
      fechaCreacion: c.fechaCreacion.toISOString().substring(0, 10)
    })),
    proyectos: prismaData.proyectos.map((p: any) => ({
      id: p.id,
      clienteId: p.clienteId,
      nombre: p.nombre,
      estado: mapEstadoProyecto(p.estado),
      fechaInicio: p.fechaInicio.toISOString().substring(0, 10)
    })),
    colaboradores: prismaData.colaboradores.map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      tarifaSugerida: c.tarifaSugerida ? parseFloat(c.tarifaSugerida.toString()) : 0,
      rol: c.rol || undefined
    })),
    registros: prismaData.registros.map((r: any) => ({
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.clienteNombre,
      proyectoId: r.proyectoId,
      proyectoNombre: r.proyectoNombre,
      fecha: r.fecha.toISOString().substring(0, 10),
      concepto: r.concepto === 'MO' ? 'MO' : r.concepto === 'INSUMO' ? 'Insumo' : 'Otros',
      descripcion: r.descripcion,
      colaboradorId: r.colaboradorId || undefined,
      hsInicio: r.hsInicio || undefined,
      hsFin: r.hsFin || undefined,
      hsTotal: r.hsTotal ? parseFloat(r.hsTotal.toString()) : undefined,
      cantidad: parseFloat(r.cantidad.toString()),
      precioUnitario: parseFloat(r.precioUnitario.toString()),
      total: parseFloat(r.total.toString()),
      origen: r.origen === 'MANUAL' ? 'Manual' : 'Excel',
      fechaImportacion: r.fechaImportacion ? r.fechaImportacion.toISOString().substring(0, 10) : undefined
    })),
    registrosVehiculo: prismaData.registrosVehiculo.map((rv: any) => ({
      id: rv.id,
      clienteId: rv.clienteId,
      clienteNombre: rv.clienteNombre,
      proyectoId: rv.proyectoId,
      proyectoNombre: rv.proyectoNombre,
      fecha: rv.fecha.toISOString().substring(0, 10),
      kmInicial: parseFloat(rv.kmInicial.toString()),
      kmFinal: parseFloat(rv.kmFinal.toString()),
      distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()),
      combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : undefined,
      combustibleCosto: parseFloat(rv.combustibleCosto.toString()),
      total: parseFloat(rv.total.toString()),
      descripcion: rv.descripcion || undefined,
      alertaDiscrepancia: rv.alertaDiscrepancia,
      origen: rv.origen === 'MANUAL' ? 'Manual' : 'Excel',
      fechaImportacion: rv.fechaImportacion ? rv.fechaImportacion.toISOString().substring(0, 10) : undefined
    })),
    timersActivos: (prismaData.timersActivos || []).map((t: any) => ({
      id: t.id,
      usuario: t.usuario,
      colaboradorId: t.colaboradorId || undefined,
      clienteId: t.clienteId,
      proyectoId: t.proyectoId,
      descripcion: t.descripcion,
      precioUnitario: parseFloat(t.precioUnitario.toString()),
      inicio: t.inicio.toISOString(),
      activo: t.activo,
      ultimaActualizacion: t.ultimaActualizacion.toISOString(),
      pausedTime: t.pausedTime,
      pauseHistory: t.pauseHistory as any[],
      isPaused: t.isPaused,
      currentPauseStart: t.currentPauseStart?.toISOString(),
    })),
    viajesActivos: (prismaData.viajesActivos || []).map((v: any) => ({
      id: v.id,
      usuario: v.usuario,
      clienteId: v.clienteId,
      proyectoId: v.proyectoId,
      inicio: v.inicio.toISOString(),
      ubicacionInicio: v.ubicacionInicio,
      fotoOdometroInicio: v.fotoOdometroInicio,
      kmInicial: parseFloat(v.kmInicial.toString()),
      descripcion: v.descripcion,
      activo: v.activo,
    })),
  };
}

// Get active DB State for the application
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    // Fetch all data from Prisma in parallel
    const [clientes, proyectos, colaboradores, registros, registrosVehiculo, timersActivos, viajesActivos] = await Promise.all([
      prisma.cliente.findMany({
        orderBy: { fechaCreacion: 'desc' }
      }),
      prisma.proyecto.findMany({
        orderBy: { fechaInicio: 'desc' }
      }),
      prisma.colaborador.findMany({
        orderBy: { nombre: 'asc' }
      }),
      prisma.registro.findMany({
        orderBy: { fecha: 'desc' }
      }),
      prisma.registroVehiculo.findMany({
        orderBy: { fecha: 'desc' }
      }),
      prisma.timerActivo.findMany({ where: { activo: true } }),
      prisma.viajeActivo.findMany({ where: { activo: true } }),
    ]);

    const data = convertPrismaToFrontend({
      clientes,
      proyectos,
      colaboradores,
      registros,
      registrosVehiculo,
      timersActivos,
      viajesActivos,
    });

    res.json({
      success: true,
      data
    } as ApiResponse<DatabaseState>);
  } catch (error: any) {
    logger.error('Error reading data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Error al leer datos'
      }
    } as ApiResponse);
  }
});

// GET /api/registros/mis-registros - Get current user's registros
app.get('/api/registros/mis-registros', requireAuth, async (req, res) => {
  const userPayload = req.user!;
  
  try {
    // Filter registros for current user (by colaboradorId) using Prisma
    const registros = await prisma.registro.findMany({
      where: {
        concepto: 'MO',
        colaboradorId: userPayload.colaboradorId
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    // Convert to frontend format
    const userRegistros = registros.map(r => ({
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.clienteNombre,
      proyectoId: r.proyectoId,
      proyectoNombre: r.proyectoNombre,
      fecha: r.fecha.toISOString().substring(0, 10),
      concepto: 'MO' as const,
      descripcion: r.descripcion,
      colaboradorId: r.colaboradorId || undefined,
      hsInicio: r.hsInicio || undefined,
      hsFin: r.hsFin || undefined,
      hsTotal: r.hsTotal ? parseFloat(r.hsTotal.toString()) : undefined,
      cantidad: parseFloat(r.cantidad.toString()),
      precioUnitario: parseFloat(r.precioUnitario.toString()),
      total: parseFloat(r.total.toString()),
      origen: r.origen === 'MANUAL' ? 'Manual' as const : 'Excel' as const,
      fechaImportacion: r.fechaImportacion ? r.fechaImportacion.toISOString().substring(0, 10) : undefined
    }));
    
    res.json({
      success: true,
      data: userRegistros
    } as ApiResponse<RegistroItem[]>);
  } catch (error: any) {
    logger.error('Error reading user registros:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Error al leer registros del usuario'
      }
    } as ApiResponse);
  }
});

// Update standard DB State with custom changes
// NOTE: This endpoint is deprecated in favor of individual CRUD operations
// Kept for backward compatibility but should not be used with Prisma
app.post('/api/save-state', requireAuth, async (req, res) => {
  const validation = validateSchema(DatabaseStateSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Estado de base de datos inválido',
        details: validation.errors
      }
    } as ApiResponse);
  }
  
  try {
    // DEPRECATED: This endpoint should not be used with Prisma
    // Use individual CRUD endpoints instead (/api/registros, /api/clientes, etc.)
    logger.warn('[DEPRECATED] /api/save-state called - use individual CRUD endpoints instead');
    
    res.status(501).json({
      success: false,
      error: {
        code: 'DEPRECATED_ENDPOINT',
        message: 'Este endpoint está deprecado. Use los endpoints CRUD individuales (/api/registros, /api/clientes, etc.)'
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error in deprecated save-state:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WRITE_ERROR',
        message: 'Error al guardar estado'
      }
    } as ApiResponse);
  }
});

// Add a single registro manually
app.post('/api/registros', requireAuth, async (req, res) => {
  const validation = validateSchema(RegistroItemSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos del registro inválidos',
        details: validation.errors
      }
    } as ApiResponse);
  }
  
  const rawItem = validation.data!;
  const userPayload = req.user!; // From JWT token
  const clientIp = getClientIp(req);
  
  try {
    // Verify client and project exist
    const [client, project] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: rawItem.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: rawItem.proyectoId } })
    ]);
    
    if (!client || !project) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Cliente o proyecto no encontrado'
        }
      } as ApiResponse);
    }
    
    // SECURITY Fix #16: Non-admin users can only register hours for themselves
    if (rawItem.concepto === 'MO' && rawItem.colaboradorId && userPayload.rol !== 'Admin') {
      if (rawItem.colaboradorId !== userPayload.colaboradorId) {
        // SECURITY Fix #17: Audit unauthorized registro attempt
        auditLog({
          usuario: userPayload.usuario,
          accion: 'create_registro',
          recurso: '/api/registros',
          resultado: 'failure',
          ip: clientIp,
          detalle: 'Intento de registrar horas de otro colaborador'
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tenés permiso para registrar horas de otros colaboradores'
          }
        } as ApiResponse);
      }
    }

    // Convert concepto to Prisma enum format
    let conceptoEnum: 'MO' | 'INSUMO' | 'VEHICULO' = 'MO';
    if (rawItem.concepto === 'Insumo') {
      conceptoEnum = 'INSUMO';
    } else if (rawItem.concepto === 'MO') {
      conceptoEnum = 'MO';
    }

    // Create new registro using Prisma
    const newRegistro = await prisma.registro.create({
      data: {
        id: generateId('reg'),
        clienteId: rawItem.clienteId,
        clienteNombre: client.nombre,
        proyectoId: rawItem.proyectoId,
        proyectoNombre: project.nombre,
        fecha: new Date(rawItem.fecha || new Date().toISOString().substring(0, 10)),
        concepto: conceptoEnum,
        descripcion: rawItem.descripcion,
        colaboradorId: rawItem.colaboradorId || null,
        hsInicio: rawItem.hsInicio || null,
        hsFin: rawItem.hsFin || null,
        hsTotal: rawItem.hsTotal ? new Decimal(rawItem.hsTotal) : null,
        cantidad: new Decimal(rawItem.cantidad),
        precioUnitario: new Decimal(rawItem.precioUnitario),
        total: new Decimal(rawItem.total),
        origen: 'MANUAL',
        fechaImportacion: new Date()
      }
    });

    // Convert to frontend format
    const newItem: RegistroItem = {
      id: newRegistro.id,
      clienteId: newRegistro.clienteId,
      clienteNombre: newRegistro.clienteNombre,
      proyectoId: newRegistro.proyectoId,
      proyectoNombre: newRegistro.proyectoNombre,
      fecha: newRegistro.fecha.toISOString().substring(0, 10),
      concepto: newRegistro.concepto === 'INSUMO' ? 'Insumo' : 'MO',
      descripcion: newRegistro.descripcion,
      colaboradorId: newRegistro.colaboradorId || undefined,
      hsInicio: newRegistro.hsInicio || undefined,
      hsFin: newRegistro.hsFin || undefined,
      hsTotal: newRegistro.hsTotal ? parseFloat(newRegistro.hsTotal.toString()) : undefined,
      cantidad: parseFloat(newRegistro.cantidad.toString()),
      precioUnitario: parseFloat(newRegistro.precioUnitario.toString()),
      total: parseFloat(newRegistro.total.toString()),
      origen: 'Manual',
      fechaImportacion: newRegistro.fechaImportacion ? newRegistro.fechaImportacion.toISOString().substring(0, 10) : undefined
    };
    
    // SECURITY Fix #17: Audit registro creation
    auditLog({
      usuario: userPayload.usuario,
      accion: 'create_registro',
      recurso: `/api/registros/${newItem.id}`,
      resultado: 'success',
      ip: clientIp
    });
    
    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Registro creado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error creating registro:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: 'Error al crear registro'
      }
    } as ApiResponse);
  }
});

// Delete timesheet/supplies record
app.delete('/api/registros/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ID',
        message: 'ID de registro requerido'
      }
    } as ApiResponse);
  }
  
  try {
    // Check if registro exists before deleting
    const registro = await prisma.registro.findUnique({
      where: { id }
    });
    
    if (!registro) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Registro no encontrado'
        }
      } as ApiResponse);
    }
    
    // Delete the registro
    await prisma.registro.delete({
      where: { id }
    });
    
    // SECURITY Fix #17: Audit registro deletion
    auditLog({
      usuario: userPayload.usuario,
      accion: 'delete_registro',
      recurso: `/api/registros/${id}`,
      resultado: 'success',
      ip: clientIp
    });
    
    res.json({
      success: true,
      message: 'Registro eliminado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error deleting registro:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Error al eliminar registro'
      }
    } as ApiResponse);
  }
});

// Update/Edit a registro (PUT endpoint)
app.put('/api/registros/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ID',
        message: 'ID de registro requerido'
      }
    } as ApiResponse);
  }
  
  const validation = validateSchema(RegistroItemSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos del registro inválidos',
        details: validation.errors
      }
    } as ApiResponse);
  }
  
  const updatedData = validation.data!;
  
  try {
    // Fetch existing registro
    const existingRegistro = await prisma.registro.findUnique({
      where: { id }
    });
    
    if (!existingRegistro) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Registro no encontrado'
        }
      } as ApiResponse);
    }
    
    // Verify client and project exist
    const [client, project] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: updatedData.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: updatedData.proyectoId } })
    ]);
    
    if (!client || !project) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Cliente o proyecto no encontrado'
        }
      } as ApiResponse);
    }
    
    // SECURITY: Admin can edit any registro, non-admin can only edit their own MO
    if (existingRegistro.concepto === 'MO' && userPayload.rol !== 'Admin') {
      if (existingRegistro.colaboradorId !== userPayload.colaboradorId) {
        auditLog({
          usuario: userPayload.usuario,
          accion: 'update_registro',
          recurso: `/api/registros/${id}`,
          resultado: 'failure',
          ip: clientIp,
          detalle: 'Intento de editar horas de otro colaborador'
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tenés permiso para editar horas de otros colaboradores'
          }
        } as ApiResponse);
      }
    }
    
    // Calculate hsTotal if concepto is MO and cantidad changed
    let hsTotal = updatedData.hsTotal;
    if (updatedData.concepto === 'MO' && updatedData.cantidad > 0) {
      hsTotal = parseFloat((updatedData.cantidad / 60).toFixed(2));
    }
    
    // Convert concepto to Prisma enum format
    let conceptoEnum: 'MO' | 'INSUMO' | 'VEHICULO' = 'MO';
    if (updatedData.concepto === 'Insumo') {
      conceptoEnum = 'INSUMO';
    } else if (updatedData.concepto === 'MO') {
      conceptoEnum = 'MO';
    }
    
    // Update the registro with Prisma
    const updatedRegistro = await prisma.registro.update({
      where: { id },
      data: {
        clienteId: updatedData.clienteId,
        clienteNombre: client.nombre,
        proyectoId: updatedData.proyectoId,
        proyectoNombre: project.nombre,
        fecha: new Date(updatedData.fecha || existingRegistro.fecha),
        concepto: conceptoEnum,
        descripcion: updatedData.descripcion,
        colaboradorId: updatedData.colaboradorId || existingRegistro.colaboradorId,
        hsInicio: updatedData.hsInicio || existingRegistro.hsInicio,
        hsFin: updatedData.hsFin || existingRegistro.hsFin,
        hsTotal: hsTotal ? new Decimal(hsTotal) : existingRegistro.hsTotal,
        cantidad: new Decimal(updatedData.cantidad),
        precioUnitario: new Decimal(updatedData.precioUnitario),
        total: new Decimal(updatedData.total)
      }
    });
    
    // Convert to frontend format
    const responseData: RegistroItem = {
      id: updatedRegistro.id,
      clienteId: updatedRegistro.clienteId,
      clienteNombre: updatedRegistro.clienteNombre,
      proyectoId: updatedRegistro.proyectoId,
      proyectoNombre: updatedRegistro.proyectoNombre,
      fecha: updatedRegistro.fecha.toISOString().substring(0, 10),
      concepto: updatedRegistro.concepto === 'INSUMO' ? 'Insumo' : 'MO',
      descripcion: updatedRegistro.descripcion,
      colaboradorId: updatedRegistro.colaboradorId || undefined,
      hsInicio: updatedRegistro.hsInicio || undefined,
      hsFin: updatedRegistro.hsFin || undefined,
      hsTotal: updatedRegistro.hsTotal ? parseFloat(updatedRegistro.hsTotal.toString()) : undefined,
      cantidad: parseFloat(updatedRegistro.cantidad.toString()),
      precioUnitario: parseFloat(updatedRegistro.precioUnitario.toString()),
      total: parseFloat(updatedRegistro.total.toString()),
      origen: updatedRegistro.origen === 'MANUAL' ? 'Manual' : 'Excel',
      fechaImportacion: updatedRegistro.fechaImportacion ? updatedRegistro.fechaImportacion.toISOString().substring(0, 10) : undefined
    };
    
    // SECURITY: Audit registro update
    auditLog({
      usuario: userPayload.usuario,
      accion: 'update_registro',
      recurso: `/api/registros/${id}`,
      resultado: 'success',
      ip: clientIp
    });
    
    res.json({
      success: true,
      data: responseData,
      message: 'Registro actualizado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error updating registro:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'Error al actualizar registro'
      }
    } as ApiResponse);
  }
});

// PATCH /api/registros/:id - Partial update (only descripcion and proyectoId)
// User can only edit their own registros
app.patch('/api/registros/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ID',
        message: 'ID de registro requerido'
      }
    } as ApiResponse);
  }
  
  // Validate only editable fields
  const { descripcion, proyectoId } = req.body;
  
  if (!descripcion || typeof descripcion !== 'string' || descripcion.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Descripción requerida y debe ser un texto válido'
      }
    } as ApiResponse);
  }
  
  if (!proyectoId || typeof proyectoId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Proyecto requerido'
      }
    } as ApiResponse);
  }
  
  try {
    // Fetch existing registro
    const existingRegistro = await prisma.registro.findUnique({
      where: { id }
    });
    
    if (!existingRegistro) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Registro no encontrado'
        }
      } as ApiResponse);
    }
    
    // SECURITY: Users can only edit their own MO registros
    if (existingRegistro.concepto === 'MO' && userPayload.rol !== 'Admin') {
      if (existingRegistro.colaboradorId !== userPayload.colaboradorId) {
        auditLog({
          usuario: userPayload.usuario,
          accion: 'patch_registro',
          recurso: `/api/registros/${id}`,
          resultado: 'failure',
          ip: clientIp,
          detalle: 'Intento de editar registro de otro colaborador'
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tenés permiso para editar registros de otros colaboradores'
          }
        } as ApiResponse);
      }
    }
    
    // Validate proyecto exists and belongs to same client
    const project = await prisma.proyecto.findUnique({
      where: { id: proyectoId }
    });
    
    if (!project) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Proyecto no encontrado'
        }
      } as ApiResponse);
    }
    
    if (project.clienteId !== existingRegistro.clienteId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'El proyecto debe pertenecer al mismo cliente'
        }
      } as ApiResponse);
    }
    
    // Update only editable fields using Prisma
    const updatedRegistro = await prisma.registro.update({
      where: { id },
      data: {
        descripcion: descripcion.trim(),
        proyectoId: proyectoId,
        proyectoNombre: project.nombre
      }
    });
    
    // Convert to frontend format
    const responseData: RegistroItem = {
      id: updatedRegistro.id,
      clienteId: updatedRegistro.clienteId,
      clienteNombre: updatedRegistro.clienteNombre,
      proyectoId: updatedRegistro.proyectoId,
      proyectoNombre: updatedRegistro.proyectoNombre,
      fecha: updatedRegistro.fecha.toISOString().substring(0, 10),
      concepto: updatedRegistro.concepto === 'INSUMO' ? 'Insumo' : 'MO',
      descripcion: updatedRegistro.descripcion,
      colaboradorId: updatedRegistro.colaboradorId || undefined,
      hsInicio: updatedRegistro.hsInicio || undefined,
      hsFin: updatedRegistro.hsFin || undefined,
      hsTotal: updatedRegistro.hsTotal ? parseFloat(updatedRegistro.hsTotal.toString()) : undefined,
      cantidad: parseFloat(updatedRegistro.cantidad.toString()),
      precioUnitario: parseFloat(updatedRegistro.precioUnitario.toString()),
      total: parseFloat(updatedRegistro.total.toString()),
      origen: updatedRegistro.origen === 'MANUAL' ? 'Manual' : 'Excel',
      fechaImportacion: updatedRegistro.fechaImportacion ? updatedRegistro.fechaImportacion.toISOString().substring(0, 10) : undefined
    };
    
    // SECURITY: Audit registro partial update
    auditLog({
      usuario: userPayload.usuario,
      accion: 'patch_registro',
      recurso: `/api/registros/${id}`,
      resultado: 'success',
      ip: clientIp
    });
    
    res.json({
      success: true,
      data: responseData,
      message: 'Registro actualizado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error patching registro:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PATCH_ERROR',
        message: 'Error al actualizar registro'
      }
    } as ApiResponse);
  }
});

// Clear DB back to default (ADMIN ONLY)
app.post('/api/clear', requireAuth, requireAdmin, async (req, res) => {
  const clientIp = getClientIp(req);
  const userPayload = req.user!;
  try {
    await writeDbSafe(initialData);
    // SECURITY Fix #17: Audit database clear (high-impact admin action)
    auditLog({
      usuario: userPayload.usuario,
      accion: 'clear_database',
      recurso: '/api/clear',
      resultado: 'success',
      ip: clientIp
    });
    res.json({
      success: true,
      message: 'Base de datos restaurada a valores muestra'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error clearing database:', error);
    auditLog({
      usuario: userPayload.usuario,
      accion: 'clear_database',
      recurso: '/api/clear',
      resultado: 'failure',
      ip: clientIp
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'CLEAR_ERROR',
        message: 'Error al restaurar base de datos'
      }
    } as ApiResponse);
  }
});

// MAIN CORE ENDPOINT: Parser of Uploaded Excel File
// SECURITY Phase 3 Fix #18: Wrap multer to return clear errors for size/type violations
function uploadSingleExcel(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'El archivo excede el tamaño máximo permitido (5MB)'
            }
          } as ApiResponse);
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: `Error al subir el archivo: ${err.message}`
          }
        } as ApiResponse);
      }
      // fileFilter rejection or other error
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: err.message || 'Archivo inválido'
        }
      } as ApiResponse);
    }
    next();
  });
}

app.post('/api/import-excel', requireAuth, uploadSingleExcel, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convert to row objects in raw form
    const rawRows = xlsx.utils.sheet_to_json<any>(worksheet);

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'La hoja de cálculo está vacía.' });
    }

    const [dbClientes, dbProyectos, dbColaboradores] = await Promise.all([
      prisma.cliente.findMany(),
      prisma.proyecto.findMany(),
      prisma.colaborador.findMany(),
    ]);
    const importedItems: any[] = [];

    // Maintain cache of local runtime entities to prevent multiple redundant additions
    const tempClientes = dbClientes.map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo,
      fechaCreacion: c.fechaCreacion.toISOString().substring(0, 10)
    }));
    const tempProyectos = dbProyectos.map((p: any) => ({
      id: p.id,
      clienteId: p.clienteId,
      nombre: p.nombre,
      estado: p.estado === 'EN_PROCESO' ? 'En Proceso' : p.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente',
      fechaInicio: p.fechaInicio.toISOString().substring(0, 10)
    }));
    const tempColaboradores = dbColaboradores.map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      tarifaSugerida: c.tarifaSugerida ? parseFloat(c.tarifaSugerida.toString()) : 0,
      rol: c.rol || undefined
    }));
    const initialClientesCount = tempClientes.length;
    const initialProyectosCount = tempProyectos.length;
    const initialColaboradoresCount = tempColaboradores.length;

    for (const row of rawRows) {
      // Clean and normalize sheet column mappings
      const clientName = (row['Cliente'] || row['cliente'] || '').toString().trim();
      const projectName = (row['Proyecto'] || row['proyecto'] || row['Proyectos'] || '').toString().trim();
      const fechaRaw = row['Fecha'] || row['fecha'] || row['Fec'];
      const concepto = (row['Concepto'] || row['concepto'] || 'MO').toString().trim().toUpperCase() === 'MO' ? 'MO' : 'Insumo';
      // IMPORTANTE: Excel puede tener "Descripción " con espacio al final
      const descripcion = (row['Descripción'] || row['Descripción '] || row['descripcion'] || row['Descripcion'] || '').toString().trim();
      
      const hsInicio = row['Hs Inicio'] || row['hs_inicio'] || row['Inicio'] || '';
      const hsFin = row['Hs Fin'] || row['hs_fin'] || row['Fin'] || '';
      const hsExcelRaw = row['Hs Total'] || row['hs_total'] || row['HsTotal'] || '';
      
      // Quantities and prices
      const cantidad = parseFloat(row['Cantidad'] || row['cantidad'] || row['Cant'] || 0);
      const precioUnitario = parseFloat(row['Precio Unitario'] || row['precio_unitario'] || row['Precio'] || row['Tarifa'] || 0);
      const computedTotal = parseFloat(row['Total'] || row['total'] || 0);
      
      // CÁLCULO DE HORAS TOTALES:
      // Tu fórmula Excel: =ENTERO(HORA(H3)*60+MINUTO(H3))
      // - "Cantidad" contiene los minutos (65, 98, 135)
      // - "Hs Total" contiene fracción de día de Excel (0.04513888 = 01:05)
      // 
      // CONVERSIÓN: 65 minutos = 1.08 horas (no 1:05)
      // Pero 1:05 en formato tiempo = 1 hora y 5 minutos = 65 minutos
      // Entonces: 65 minutos / 60 = 1.08 horas ✅
      let hsTotal = 0;
      
      if (concepto === 'MO' && cantidad > 0) {
        // Usar "Cantidad" (minutos) y convertir a horas
        hsTotal = parseFloat((cantidad / 60).toFixed(2));
      }

      // Skip row if client and project are completely empty
      if (!clientName && !projectName && !descripcion) continue;

      // MAPEO INTELIGENTE: Look up or create Client
      let targetClient = tempClientes.find(c => c.nombre.toLowerCase() === clientName.toLowerCase());
      if (!targetClient && clientName) {
        targetClient = {
          id: generateId('cli'),
          nombre: clientName,
          codigo: clientName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'C'),
          fechaCreacion: new Date().toISOString().substring(0, 10)
        };
        tempClientes.push(targetClient);
      }

      // MAPEO INTELIGENTE: Look up or create Project
      let targetProject = null;
      if (targetClient && projectName) {
        targetProject = tempProyectos.find(
          p => p.nombre.toLowerCase() === projectName.toLowerCase() && p.clienteId === targetClient!.id
        );
        if (!targetProject) {
          targetProject = {
            id: generateId('pro'),
            clienteId: targetClient.id,
            nombre: projectName,
            estado: 'En Proceso' as const,
            fechaInicio: parseExcelDate(fechaRaw)
          };
          tempProyectos.push(targetProject);
        }
      }

      // MAPEO INTELIGENTE: Look up or extract Colaborador from description if Concepto is MO (Mano de Obra)
      let targetColaborador = null;
      if (concepto === 'MO' && descripcion) {
        // Try extracting common names e.g., "Rodrigo retiro", "Kevin instalando"
        // Splitting description word-by-word to see if a Colaborador name is matched
        const descWords = descripcion.toLowerCase().split(/\s+/);
        targetColaborador = tempColaboradores.find(col => {
          const names = col.nombre.toLowerCase().split(/\s+/);
          // if first name exists in description words
          return names.length > 0 && descWords.includes(names[0]);
        });

        // Exact match or creation
        if (!targetColaborador) {
          // If no match, we can assume the first word or full description could be a new colaborador name if it looks like a person.
          // For simplicity, if description length is short, use it as a custom name, or create the worker Rodrigo/Kevin/Laura
          const prospectiveWorkerName = descripcion.split(' ')[0] || 'Colaborador';
          
          // Let's see if we have someone similar. If not, create
          const normalizedName = prospectiveWorkerName.charAt(0).toUpperCase() + prospectiveWorkerName.slice(1).toLowerCase();
          
          // Double check if created
          targetColaborador = tempColaboradores.find(c => c.nombre.startsWith(normalizedName));
          if (!targetColaborador) {
            targetColaborador = {
              id: generateId('col'),
              nombre: normalizedName + ' ' + (descripcion.split(' ')[1] || ''),
              tarifaSugerida: precioUnitario || 350,
              rol: 'Operario Externo'
            };
            tempColaboradores.push(targetColaborador);
          }
        }
      }

      const finalFecha = parseExcelDate(fechaRaw);
      
      // Calculate Total if zero
      const calculatedTotal = computedTotal || (cantidad * precioUnitario) || 0;

      importedItems.push({
        sheetRow: row, // reference back
        clienteNombre: clientName || (targetClient ? targetClient.nombre : 'Cliente Desconocido'),
        clienteId: targetClient ? targetClient.id : 'temp_cli',
        proyectoNombre: projectName || (targetProject ? targetProject.nombre : 'Proyecto General'),
        proyectoId: targetProject ? targetProject.id : 'temp_pro',
        fecha: finalFecha,
        concepto,
        descripcion,
        colaboradorId: targetColaborador ? targetColaborador.id : undefined,
        colaboradorNombre: targetColaborador ? targetColaborador.nombre : undefined,
        hsInicio: hsInicio ? String(hsInicio) : undefined,
        hsFin: hsFin ? String(hsFin) : undefined,
        hsTotal: hsTotal > 0 ? hsTotal : undefined,
        cantidad: cantidad, // Minutes from Excel "Cantidad" column
        precioUnitario: precioUnitario || (targetColaborador ? targetColaborador.tarifaSugerida : 0),
        total: calculatedTotal
      });
    }

    res.json({
      success: true,
      summary: {
        totalRowsRead: rawRows.length,
        itemsImported: importedItems.length,
        tempClientesDetected: tempClientes.length - initialClientesCount,
        tempProyectosDetected: tempProyectos.length - initialProyectosCount,
        tempColaboradoresDetected: tempColaboradores.length - initialColaboradoresCount
      },
      parsedItems: importedItems,
      // Provide preview version of modified DB collections for confirmation in UI
      updatedDbState: {
        clientes: tempClientes,
        proyectos: tempProyectos,
        colaboradores: tempColaboradores
      }
    });

  } catch (err: any) {
    console.error('Error processing Excel file', err);
    res.status(500).json({ error: `Error de procesado de archivo Excel: ${err.message}` });
  }
});

// SMART GEMINI AI ENRICHMENT (Optional smart extractions on descriptors)
app.post('/api/gemini-enrich', requireAuth, async (req, res) => {
  const validation = validateSchema(GeminiEnrichSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos para enriquecimiento',
        details: validation.errors
      }
    } as ApiResponse);
  }
  
  const { entries } = validation.data!;

  const apiKey = process.env.GEMINI_API_KEY;
  // SECURITY: Gemini API is OPTIONAL - return friendly message if not configured
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'DISABLED_NOT_NEEDED' || apiKey.length < 20) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'El servicio de IA no está configurado. Continuá usando el sistema sin esta función.'
      }
    } as ApiResponse);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Eres el asistente inteligente del Sistema aFull. Recibes un arreglo de descripciones de tareas operativas o compras de insumos registradas de forma informal.
      Tu meta es parsear esta lista y devolver un objeto JSON con una clasificación inteligente para cada elemento:
      1. Extraer nombre de persona (si refiere a Mano de Obra / colaborador).
      2. Categoría (MO o Insumo o Herramientas o Logística).
      3. Sugerencia de precio unitario sugerido (si el actual es 0) basado en valores típicos (MO: 350-500 por min, Insumos dependiente del tipo).
      
      Lista de entradas:
      ${JSON.stringify(entries.map((e, index) => ({ index, text: e.descripcion, concepto: e.concepto })))}
      
      Devuelve ÚNICAMENTE un arreglo JSON con el siguiente formato:
      [
        { "index": 0, "colaboradorSugerido": "Rodrigo Gómez", "categoriaSugerida": "MO", "precioSugerido": 350 }
      ]
    `;

    // Modern SDK model query
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const replyText = response.text || '[]';
    const cleanJson = JSON.parse(replyText.trim());
    res.json({
      success: true,
      data: { enrichments: cleanJson }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Gemini API query failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GEMINI_ERROR',
        message: 'No se pudo consultar a Gemini: ' + error.message
      }
    } as ApiResponse);
  }
});

// ══════════════════════════════════════════════════════
//  TIMER ENDPOINTS - Hybrid Server + localStorage System
// ══════════════════════════════════════════════════════

/**
 * POST /api/timer/start
 * Start a new timer for the user
 */
app.post('/api/timer/start', requireAuth, async (req, res) => {
  const validation = validateSchema(TimerStartSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para iniciar timer', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario, colaboradorId, clienteId, proyectoId, descripcion, precioUnitario } = validation.data!;
  const clientIp = getClientIp(req);

  try {
    // Desactivar timers previos del usuario
    await prisma.timerActivo.updateMany({
      where: { usuario, activo: true },
      data: { activo: false, updatedAt: new Date() }
    });

    // Crear nuevo timer
    const now = new Date();
    const newTimer = await prisma.timerActivo.create({
      data: {
        id: generateId('timer'),
        usuario,
        colaboradorId: colaboradorId || null,
        clienteId,
        proyectoId,
        descripcion,
        precioUnitario: new Decimal(precioUnitario),
        inicio: now,
        activo: true,
        ultimaActualizacion: now,
        pausedTime: 0,
        pauseHistory: [],
        isPaused: false,
      }
    });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'timer_start',
      recurso: `/api/timer/${newTimer.id}`,
      resultado: 'success',
      ip: clientIp
    });

    res.json({
      success: true,
      data: {
        ...newTimer,
        precioUnitario: parseFloat(newTimer.precioUnitario.toString()),
        inicio: newTimer.inicio.toISOString(),
        ultimaActualizacion: newTimer.ultimaActualizacion.toISOString(),
        pauseHistory: newTimer.pauseHistory as any[],
        currentPauseStart: newTimer.currentPauseStart?.toISOString(),
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error starting timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_START_ERROR', message: 'No se pudo iniciar el timer: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * POST /api/timer/stop
 * Stop the active timer for the user
 */
app.post('/api/timer/stop', requireAuth, async (req, res) => {
  const validation = validateSchema(TimerStopSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para detener timer', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario, pausedTime, pauseHistory } = validation.data!;
  const clientIp = getClientIp(req);

  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });

    if (!activeTimer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_ACTIVE_TIMER', message: 'No hay timer activo para este usuario' }
      } as ApiResponse);
    }

    const fin = new Date();
    const duracionBruta = Math.floor((fin.getTime() - activeTimer.inicio.getTime()) / 1000);

    // Use pausedTime from request (from localStorage) or from server state
    const finalPausedTime = pausedTime ?? activeTimer.pausedTime ?? 0;
    const finalPauseHistory: any[] = pauseHistory ?? (activeTimer.pauseHistory as any[]) ?? [];

    // If timer was paused when stopped, close the current pause
    let adjustedPausedTime = finalPausedTime;
    let adjustedPauseHistory = [...finalPauseHistory];

    if (activeTimer.isPaused && activeTimer.currentPauseStart) {
      const currentPauseDuration = Math.floor((fin.getTime() - activeTimer.currentPauseStart.getTime()) / 1000);
      adjustedPausedTime += currentPauseDuration;
      adjustedPauseHistory.push({
        start: activeTimer.currentPauseStart.toISOString(),
        end: fin.toISOString(),
        duration: currentPauseDuration
      });
    }

    const duracionSegundos = duracionBruta - adjustedPausedTime;

    await prisma.timerActivo.update({
      where: { id: activeTimer.id },
      data: {
        activo: false,
        pausedTime: adjustedPausedTime,
        pauseHistory: adjustedPauseHistory,
        isPaused: false,
        currentPauseStart: null,
        ultimaActualizacion: fin,
      }
    });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'timer_stop',
      recurso: `/api/timer/${activeTimer.id}`,
      resultado: 'success',
      ip: clientIp,
      detalle: `duracionSegundos=${duracionSegundos}, pausedTime=${adjustedPausedTime}`
    });

    res.json({
      success: true,
      data: {
        timer: { ...activeTimer, activo: false },
        duracionSegundos,
        duracionBruta,
        pausedTime: adjustedPausedTime,
        pauseHistory: adjustedPauseHistory,
        inicio: activeTimer.inicio.toISOString(),
        fin: fin.toISOString()
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error stopping timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_STOP_ERROR', message: 'No se pudo detener el timer: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * POST /api/timer/pause
 * Pause the active timer for the user
 */
app.post('/api/timer/pause', requireAuth, async (req, res) => {
  const validation = validateSchema(TimerPauseSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para pausar timer', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario } = validation.data!;
  const clientIp = getClientIp(req);

  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });

    if (!activeTimer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_ACTIVE_TIMER', message: 'No hay timer activo para este usuario' }
      } as ApiResponse);
    }

    if (activeTimer.isPaused) {
      return res.status(400).json({
        success: false,
        error: { code: 'TIMER_ALREADY_PAUSED', message: 'El timer ya está pausado' }
      } as ApiResponse);
    }

    const now = new Date();
    const updated = await prisma.timerActivo.update({
      where: { id: activeTimer.id },
      data: { isPaused: true, currentPauseStart: now, ultimaActualizacion: now }
    });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'timer_pause',
      recurso: `/api/timer/${activeTimer.id}`,
      resultado: 'success',
      ip: clientIp
    });

    res.json({
      success: true,
      data: {
        ...updated,
        precioUnitario: parseFloat(updated.precioUnitario.toString()),
        inicio: updated.inicio.toISOString(),
        ultimaActualizacion: updated.ultimaActualizacion.toISOString(),
        currentPauseStart: updated.currentPauseStart?.toISOString(),
        pauseHistory: updated.pauseHistory as any[],
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error pausing timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_PAUSE_ERROR', message: 'No se pudo pausar el timer: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * POST /api/timer/resume
 * Resume the paused timer for the user
 */
app.post('/api/timer/resume', requireAuth, async (req, res) => {
  const validation = validateSchema(TimerResumeSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para reanudar timer', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario } = validation.data!;
  const clientIp = getClientIp(req);

  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });

    if (!activeTimer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_ACTIVE_TIMER', message: 'No hay timer activo para este usuario' }
      } as ApiResponse);
    }

    if (!activeTimer.isPaused || !activeTimer.currentPauseStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'TIMER_NOT_PAUSED', message: 'El timer no está pausado' }
      } as ApiResponse);
    }

    const now = new Date();
    const pauseDuration = Math.floor((now.getTime() - activeTimer.currentPauseStart.getTime()) / 1000);
    const newPausedTime = activeTimer.pausedTime + pauseDuration;
    const newPauseHistory = [
      ...(activeTimer.pauseHistory as any[]),
      { start: activeTimer.currentPauseStart.toISOString(), end: now.toISOString(), duration: pauseDuration }
    ];

    const updated = await prisma.timerActivo.update({
      where: { id: activeTimer.id },
      data: {
        isPaused: false,
        currentPauseStart: null,
        pausedTime: newPausedTime,
        pauseHistory: newPauseHistory,
        ultimaActualizacion: now,
      }
    });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'timer_resume',
      recurso: `/api/timer/${activeTimer.id}`,
      resultado: 'success',
      ip: clientIp,
      detalle: `pauseDuration=${pauseDuration}`
    });

    res.json({
      success: true,
      data: {
        timer: {
          ...updated,
          precioUnitario: parseFloat(updated.precioUnitario.toString()),
          inicio: updated.inicio.toISOString(),
          ultimaActualizacion: updated.ultimaActualizacion.toISOString(),
          pauseHistory: updated.pauseHistory as any[],
        },
        pauseDuration,
        totalPausedTime: newPausedTime,
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error resuming timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_RESUME_ERROR', message: 'No se pudo reanudar el timer: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * GET /api/timer/active/:usuario
 * Get the active timer for a user
 */
app.get('/api/timer/active/:usuario', requireAuth, async (req, res) => {
  try {
    const { usuario } = req.params;
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });

    if (!activeTimer) {
      return res.json({ success: true, data: null } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        ...activeTimer,
        precioUnitario: parseFloat(activeTimer.precioUnitario.toString()),
        inicio: activeTimer.inicio.toISOString(),
        ultimaActualizacion: activeTimer.ultimaActualizacion.toISOString(),
        currentPauseStart: activeTimer.currentPauseStart?.toISOString(),
        pauseHistory: activeTimer.pauseHistory as any[],
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error fetching active timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_FETCH_ERROR', message: 'No se pudo obtener el timer activo: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * POST /api/timer/sync
 * Sync timer state (keep-alive and state check)
 */
app.post('/api/timer/sync', requireAuth, async (req, res) => {
  const validation = validateSchema(TimerSyncSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para sincronizar timer', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario } = validation.data!;

  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });

    if (!activeTimer) {
      return res.json({ success: true, data: { activo: false, message: 'Timer no encontrado o detenido' } } as ApiResponse);
    }

    const updated = await prisma.timerActivo.update({
      where: { id: activeTimer.id },
      data: { ultimaActualizacion: new Date() }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        precioUnitario: parseFloat(updated.precioUnitario.toString()),
        inicio: updated.inicio.toISOString(),
        ultimaActualizacion: updated.ultimaActualizacion.toISOString(),
        currentPauseStart: updated.currentPauseStart?.toISOString(),
        pauseHistory: updated.pauseHistory as any[],
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error syncing timer', error);
    res.status(500).json({
      success: false,
      error: { code: 'TIMER_SYNC_ERROR', message: 'No se pudo sincronizar el timer: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * VEHICLE TRIP ROUTES
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Haversine formula to calculate distance between two GPS coordinates
 */
function calcularDistanciaHaversine(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): number {
  const R = 6371; // Radio de la Tierra en km
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  const dLat = toRad(destino.lat - origen.lat);
  const dLng = toRad(destino.lng - origen.lng);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(origen.lat)) * 
    Math.cos(toRad(destino.lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
}

/**
 * Save vehicle photos to filesystem
 */
async function guardarFotosVehiculo(
  registroId: string,
  fotoBase64Inicio: string,
  fotoBase64Fin: string
): Promise<{ inicio: string; fin: string }> {
  const uploadsDir = path.join(__dirname, 'uploads', 'vehiculos', registroId);
  
  // Crear directorio si no existe
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  
  // Extraer el contenido base64 (remover "data:image/jpeg;base64,")
  const extraerBase64 = (dataUrl: string) => {
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
  };
  
  const base64Inicio = extraerBase64(fotoBase64Inicio);
  const base64Fin = extraerBase64(fotoBase64Fin);
  
  // Guardar archivos
  const rutaInicio = path.join(uploadsDir, 'odometro_inicio.jpg');
  const rutaFin = path.join(uploadsDir, 'odometro_fin.jpg');
  
  await fs.promises.writeFile(rutaInicio, base64Inicio, 'base64');
  await fs.promises.writeFile(rutaFin, base64Fin, 'base64');
  
  // Retornar rutas relativas para la BD
  return {
    inicio: `/uploads/vehiculos/${registroId}/odometro_inicio.jpg`,
    fin: `/uploads/vehiculos/${registroId}/odometro_fin.jpg`
  };
}

/**
 * POST /api/viaje/start
 * Start a new vehicle trip
 */
app.post('/api/viaje/start', requireAuth, async (req, res) => {
  const clientIp = getClientIp(req);
  const validation = validateSchema(ViajeStartSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para iniciar viaje', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario, ubicacionInicio, clienteId, proyectoId, descripcion, fotoOdometroInicio, kmInicial } = validation.data!;

  try {
    // Verificar si ya hay viaje activo
    const viajeExistente = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });
    if (viajeExistente) {
      return res.status(400).json({
        success: false,
        error: { code: 'VIAJE_ACTIVO', message: 'Ya tenés un viaje activo' }
      } as ApiResponse);
    }

    const nuevoViaje = await prisma.viajeActivo.create({
      data: {
        id: `viaje_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        usuario,
        clienteId,
        proyectoId,
        inicio: new Date(),
        ubicacionInicio: ubicacionInicio,
        fotoOdometroInicio: fotoOdometroInicio || '',
        kmInicial: new Decimal(kmInicial),
        descripcion: descripcion || 'Viaje en vehículo',
        activo: true,
      }
    });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'viaje_start',
      recurso: `/api/viaje/${nuevoViaje.id}`,
      detalle: `proyectoId=${proyectoId}, clienteId=${clienteId}, kmInicial=${kmInicial}`,
      resultado: 'success',
      ip: clientIp
    });

    res.json({
      success: true,
      data: {
        ...nuevoViaje,
        kmInicial: parseFloat(nuevoViaje.kmInicial.toString()),
        inicio: nuevoViaje.inicio.toISOString(),
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error starting viaje', error);
    res.status(500).json({
      success: false,
      error: { code: 'VIAJE_START_ERROR', message: 'No se pudo iniciar el viaje: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * POST /api/viaje/stop
 * Stop active vehicle trip
 */
app.post('/api/viaje/stop', requireAuth, async (req, res) => {
  const clientIp = getClientIp(req);
  const validation = validateSchema(ViajeStopSchema, req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para finalizar viaje', details: validation.errors }
    } as ApiResponse);
  }

  const { usuario, ubicacionFin, fotoOdometroFin, kmFinal, combustibleLitros, combustibleCosto, descripcion } = validation.data!;

  try {
    const viajeActivo = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });

    if (!viajeActivo) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_VIAJE_ACTIVO', message: 'No hay viaje activo' }
      } as ApiResponse);
    }

    const kmInicialNum = parseFloat(viajeActivo.kmInicial.toString());
    const distanciaGPS = calcularDistanciaHaversine(viajeActivo.ubicacionInicio as any, ubicacionFin);
    const distanciaOdometro = kmFinal - kmInicialNum;
    const diferencia = Math.abs(distanciaOdometro - distanciaGPS);
    const discrepanciaPorcentaje = distanciaGPS > 0 ? (diferencia / distanciaGPS) * 100 : 0;
    const alertaDiscrepancia = discrepanciaPorcentaje > 20;
    const consumoPorKm = combustibleLitros && distanciaOdometro > 0
      ? Math.round((combustibleLitros / distanciaOdometro) * 100) / 100
      : undefined;

    const fin = new Date();
    const duracionMinutos = Math.floor((fin.getTime() - viajeActivo.inicio.getTime()) / 60000);

    const registroId = `regveh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fotosGuardadas = await guardarFotosVehiculo(registroId, viajeActivo.fotoOdometroInicio, fotoOdometroFin);

    const esParticular = viajeActivo.clienteId === 'viaje_particular' || viajeActivo.proyectoId === 'viaje_particular';
    const [cliente, proyecto] = esParticular ? [null, null] : await Promise.all([
      prisma.cliente.findUnique({ where: { id: viajeActivo.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: viajeActivo.proyectoId } })
    ]);

    const registroVehiculo = await prisma.registroVehiculo.create({
      data: {
        id: registroId,
        usuario: viajeActivo.usuario,
        clienteId: viajeActivo.clienteId,
        clienteNombre: esParticular ? 'Viaje Particular' : (cliente?.nombre || ''),
        proyectoId: viajeActivo.proyectoId,
        proyectoNombre: esParticular ? 'Uso Personal' : (proyecto?.nombre || ''),
        fecha: fin,
        kmInicial: viajeActivo.kmInicial,
        kmFinal: new Decimal(kmFinal),
        distanciaOdometro: new Decimal(Math.round(distanciaOdometro * 10) / 10),
        distanciaGPS: new Decimal(Math.round(distanciaGPS * 10) / 10),
        combustibleLitros: combustibleLitros ? new Decimal(combustibleLitros) : null,
        combustibleCosto: new Decimal(combustibleCosto),
        total: new Decimal(combustibleCosto),
        descripcion: descripcion || viajeActivo.descripcion,
        alertaDiscrepancia,
        discrepancia: new Decimal(Math.round(discrepanciaPorcentaje * 10) / 10),
        ubicacionInicio: viajeActivo.ubicacionInicio as any,
        ubicacionFin: ubicacionFin,
        fotoOdometroInicio: fotosGuardadas.inicio,
        fotoOdometroFin: fotosGuardadas.fin,
        horaInicio: new Date(viajeActivo.inicio).toLocaleTimeString('es-AR', { hour12: false }),
        horaFin: fin.toLocaleTimeString('es-AR', { hour12: false }),
        duracionMinutos,
        consumoPorKm: consumoPorKm ? new Decimal(consumoPorKm) : null,
        origen: 'MANUAL',
        fechaImportacion: fin,
      }
    });

    // Desactivar el viaje activo
    await prisma.viajeActivo.update({ where: { id: viajeActivo.id }, data: { activo: false } });

    auditLog({
      usuario: req.user?.usuario || usuario,
      accion: 'viaje_stop',
      recurso: `/api/viaje/${viajeActivo.id}`,
      detalle: `proyectoId=${viajeActivo.proyectoId}, distanciaGPS=${distanciaGPS.toFixed(1)}, distanciaOdometro=${distanciaOdometro.toFixed(1)}, discrepancia=${discrepanciaPorcentaje.toFixed(1)}%, alerta=${alertaDiscrepancia}`,
      resultado: 'success',
      ip: clientIp,
    });

    res.json({
      success: true,
      data: {
        ...registroVehiculo,
        kmInicial: parseFloat(registroVehiculo.kmInicial.toString()),
        kmFinal: parseFloat(registroVehiculo.kmFinal.toString()),
        distanciaOdometro: parseFloat(registroVehiculo.distanciaOdometro.toString()),
        distanciaGPS: registroVehiculo.distanciaGPS ? parseFloat(registroVehiculo.distanciaGPS.toString()) : undefined,
        combustibleLitros: registroVehiculo.combustibleLitros ? parseFloat(registroVehiculo.combustibleLitros.toString()) : undefined,
        combustibleCosto: parseFloat(registroVehiculo.combustibleCosto.toString()),
        total: parseFloat(registroVehiculo.total.toString()),
        discrepancia: registroVehiculo.discrepancia ? parseFloat(registroVehiculo.discrepancia.toString()) : undefined,
        consumoPorKm: registroVehiculo.consumoPorKm ? parseFloat(registroVehiculo.consumoPorKm.toString()) : undefined,
        fecha: registroVehiculo.fecha.toISOString().substring(0, 10),
        fechaImportacion: registroVehiculo.fechaImportacion?.toISOString().substring(0, 10),
      },
      alertas: alertaDiscrepancia ? [{ tipo: 'discrepancia', mensaje: `Diferencia de ${discrepanciaPorcentaje.toFixed(1)}% entre GPS y odómetro` }] : []
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error stopping viaje', error);
    res.status(500).json({
      success: false,
      error: { code: 'VIAJE_STOP_ERROR', message: 'No se pudo finalizar el viaje: ' + error.message }
    } as ApiResponse);
  }
});

/**
 * GET /api/viaje/active/:usuario
 * Get active trip for a user
 */
app.get('/api/viaje/active/:usuario', requireAuth, async (req, res) => {
  try {
    const { usuario } = req.params;

    // Verificar autorización
    if (req.user?.rol !== 'Admin' && req.user?.usuario !== usuario) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'No autorizado' }
      } as ApiResponse);
    }

    const viajeActivo = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });

    if (!viajeActivo) {
      return res.json({ success: true, data: null } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        ...viajeActivo,
        kmInicial: parseFloat(viajeActivo.kmInicial.toString()),
        inicio: viajeActivo.inicio.toISOString(),
      }
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting active viaje', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_VIAJE_ERROR', message: 'Error al obtener viaje activo' }
    } as ApiResponse);
  }
});

/**
 * GET /api/vehiculo/registros/:proyectoId
 * Get vehicle trip history for a project
 */
app.get('/api/vehiculo/registros/:proyectoId', requireAuth, async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const registros = await prisma.registroVehiculo.findMany({
      where: { proyectoId },
      orderBy: { fecha: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: registros.map(rv => ({
        ...rv,
        kmInicial: parseFloat(rv.kmInicial.toString()),
        kmFinal: parseFloat(rv.kmFinal.toString()),
        distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()),
        distanciaGPS: rv.distanciaGPS ? parseFloat(rv.distanciaGPS.toString()) : undefined,
        combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : undefined,
        combustibleCosto: parseFloat(rv.combustibleCosto.toString()),
        total: parseFloat(rv.total.toString()),
        discrepancia: rv.discrepancia ? parseFloat(rv.discrepancia.toString()) : undefined,
        consumoPorKm: rv.consumoPorKm ? parseFloat(rv.consumoPorKm.toString()) : undefined,
        fecha: rv.fecha.toISOString().substring(0, 10),
        fechaImportacion: rv.fechaImportacion?.toISOString().substring(0, 10),
      }))
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting registros vehiculo', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_REGISTROS_ERROR', message: 'Error al obtener registros' }
    } as ApiResponse);
  }
});

/**
 * GET /api/vehiculo/mis-registros
 * Get vehicle records filtered by current user (operario view)
 */
app.get('/api/vehiculo/mis-registros', requireAuth, async (req, res) => {
  const userPayload = req.user!;

  try {
    const whereClause = userPayload.rol === 'Admin' ? {} : { usuario: userPayload.usuario };
    const registros = await prisma.registroVehiculo.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' }
    });

    res.json({
      success: true,
      data: registros.map(rv => ({
        ...rv,
        kmInicial: parseFloat(rv.kmInicial.toString()),
        kmFinal: parseFloat(rv.kmFinal.toString()),
        distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()),
        distanciaGPS: rv.distanciaGPS ? parseFloat(rv.distanciaGPS.toString()) : undefined,
        combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : undefined,
        combustibleCosto: parseFloat(rv.combustibleCosto.toString()),
        total: parseFloat(rv.total.toString()),
        discrepancia: rv.discrepancia ? parseFloat(rv.discrepancia.toString()) : undefined,
        consumoPorKm: rv.consumoPorKm ? parseFloat(rv.consumoPorKm.toString()) : undefined,
        fecha: rv.fecha.toISOString().substring(0, 10),
        fechaImportacion: rv.fechaImportacion?.toISOString().substring(0, 10),
      }))
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error reading user vehicle registros:', error);
    res.status(500).json({
      success: false,
      error: { code: 'READ_ERROR', message: 'Error al leer registros de vehículo del usuario' }
    } as ApiResponse);
  }
});

/**
 * DELETE /api/vehiculo/registro/:id
 * Admin only - Delete vehicle record
 */
app.delete('/api/vehiculo/registro/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'ID de registro requerido' }
    } as ApiResponse);
  }

  try {
    const registro = await prisma.registroVehiculo.findUnique({ where: { id } });

    if (!registro) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registro de vehículo no encontrado' }
      } as ApiResponse);
    }

    await prisma.registroVehiculo.delete({ where: { id } });

    auditLog({
      usuario: userPayload.usuario,
      accion: 'delete_vehiculo_registro',
      recurso: `/api/vehiculo/registro/${id}`,
      resultado: 'success',
      ip: clientIp,
      detalle: `Eliminado registro de vehículo: ${registro.proyectoNombre}`
    });

    res.json({ success: true, message: 'Registro de vehículo eliminado con éxito' } as ApiResponse);
  } catch (error: any) {
    logger.error('Error deleting vehiculo registro:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Error al eliminar registro de vehículo' }
    } as ApiResponse);
  }
});

/**
 * PUT /api/vehiculo/registro/:id
 * Admin only - Full replacement of vehicle record
 */
app.put('/api/vehiculo/registro/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'ID de registro requerido' }
    } as ApiResponse);
  }

  const validation = validateSchema(RegistroVehiculoUpdateSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos del registro inválidos', details: validation.errors }
    } as ApiResponse);
  }

  const updatedData = validation.data!;

  try {
    const existing = await prisma.registroVehiculo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registro de vehículo no encontrado' }
      } as ApiResponse);
    }

    const distanciaOdometro = updatedData.kmFinal - updatedData.kmInicial;
    const existingDistanciaGPS = existing.distanciaGPS ? parseFloat(existing.distanciaGPS.toString()) : distanciaOdometro;
    const discrepancia = existingDistanciaGPS > 0
      ? Math.abs((distanciaOdometro - existingDistanciaGPS) / existingDistanciaGPS) * 100
      : 0;
    const alertaDiscrepancia = discrepancia > 20;
    const consumoPorKm = updatedData.combustibleLitros && distanciaOdometro > 0
      ? updatedData.combustibleLitros / distanciaOdometro
      : undefined;
    let total = updatedData.total;
    if (updatedData.precioLitro && updatedData.combustibleLitros) {
      total = updatedData.precioLitro * updatedData.combustibleLitros;
    }

    const updated = await prisma.registroVehiculo.update({
      where: { id },
      data: {
        kmInicial: new Decimal(updatedData.kmInicial),
        kmFinal: new Decimal(updatedData.kmFinal),
        distanciaOdometro: new Decimal(Math.round(distanciaOdometro * 10) / 10),
        combustibleLitros: updatedData.combustibleLitros ? new Decimal(updatedData.combustibleLitros) : null,
        combustibleCosto: new Decimal(total),
        total: new Decimal(total),
        consumoPorKm: consumoPorKm ? new Decimal(Math.round(consumoPorKm * 10000) / 10000) : null,
        discrepancia: new Decimal(Math.round(discrepancia * 10) / 10),
        alertaDiscrepancia,
        descripcion: updatedData.descripcion,
        fecha: updatedData.fecha ? new Date(updatedData.fecha) : existing.fecha,
      }
    });

    auditLog({
      usuario: userPayload.usuario,
      accion: 'update_vehiculo_registro',
      recurso: `/api/vehiculo/registro/${id}`,
      resultado: 'success',
      ip: clientIp
    });

    res.json({
      success: true,
      data: {
        ...updated,
        kmInicial: parseFloat(updated.kmInicial.toString()),
        kmFinal: parseFloat(updated.kmFinal.toString()),
        distanciaOdometro: parseFloat(updated.distanciaOdometro.toString()),
        combustibleCosto: parseFloat(updated.combustibleCosto.toString()),
        total: parseFloat(updated.total.toString()),
        fecha: updated.fecha.toISOString().substring(0, 10),
      },
      message: 'Registro de vehículo actualizado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error updating vehiculo registro:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Error al actualizar registro de vehículo' }
    } as ApiResponse);
  }
});

/**
 * PATCH /api/vehiculo/registro/:id
 * Admin only - Partial update of vehicle record (editable fields only)
 */
app.patch('/api/vehiculo/registro/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;

  logger.info('[PATCH VEHICULO] Request received, ID:', id, 'User:', userPayload.usuario);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'ID de registro requerido' }
    } as ApiResponse);
  }

  const validation = validateSchema(RegistroVehiculoPatchSchema, req.body);
  if (!validation.valid) {
    logger.error('[PATCH VEHICULO] Validation errors:', JSON.stringify(validation.errors));
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos del registro inválidos', details: validation.errors }
    } as ApiResponse);
  }

  const patchData = validation.data!;

  try {
    const existing = await prisma.registroVehiculo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registro de vehículo no encontrado' }
      } as ApiResponse);
    }

    const kmInicial = patchData.kmInicial ?? parseFloat(existing.kmInicial.toString());
    const kmFinal = patchData.kmFinal ?? parseFloat(existing.kmFinal.toString());
    const combustibleLitros = patchData.combustibleLitros ?? (existing.combustibleLitros ? parseFloat(existing.combustibleLitros.toString()) : undefined);
    const distanciaOdometro = kmFinal - kmInicial;
    const existingDistanciaGPS = existing.distanciaGPS ? parseFloat(existing.distanciaGPS.toString()) : distanciaOdometro;
    const discrepancia = existingDistanciaGPS > 0
      ? Math.abs((distanciaOdometro - existingDistanciaGPS) / existingDistanciaGPS) * 100
      : 0;
    const alertaDiscrepancia = discrepancia > 20;
    const consumoPorKm = combustibleLitros && distanciaOdometro > 0
      ? combustibleLitros / distanciaOdometro
      : undefined;
    let total = patchData.total ?? parseFloat(existing.total.toString());
    if (patchData.precioLitro && combustibleLitros) {
      total = patchData.precioLitro * combustibleLitros;
    }

    const updated = await prisma.registroVehiculo.update({
      where: { id },
      data: {
        kmInicial: new Decimal(kmInicial),
        kmFinal: new Decimal(kmFinal),
        distanciaOdometro: new Decimal(Math.round(distanciaOdometro * 10) / 10),
        combustibleLitros: combustibleLitros ? new Decimal(combustibleLitros) : null,
        combustibleCosto: new Decimal(total),
        total: new Decimal(total),
        consumoPorKm: consumoPorKm ? new Decimal(Math.round(consumoPorKm * 10000) / 10000) : null,
        discrepancia: new Decimal(Math.round(discrepancia * 10) / 10),
        alertaDiscrepancia,
        ...(patchData.descripcion !== undefined && { descripcion: patchData.descripcion }),
        ...(patchData.fecha !== undefined && { fecha: new Date(patchData.fecha) }),
      }
    });

    auditLog({
      usuario: userPayload.usuario,
      accion: 'patch_vehiculo_registro',
      recurso: `/api/vehiculo/registro/${id}`,
      resultado: 'success',
      ip: clientIp
    });

    res.json({
      success: true,
      data: {
        ...updated,
        kmInicial: parseFloat(updated.kmInicial.toString()),
        kmFinal: parseFloat(updated.kmFinal.toString()),
        distanciaOdometro: parseFloat(updated.distanciaOdometro.toString()),
        combustibleCosto: parseFloat(updated.combustibleCosto.toString()),
        total: parseFloat(updated.total.toString()),
        fecha: updated.fecha.toISOString().substring(0, 10),
      },
      message: 'Registro de vehículo actualizado con éxito'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error patching vehiculo registro:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PATCH_ERROR', message: 'Error al actualizar registro de vehículo' }
    } as ApiResponse);
  }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SECURITY Phase 2 Fix #7: Global Error Handler - Sanitize error messages
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('[ERROR HANDLER]', err);
  
  // In production, hide stack traces and sensitive details
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isDevelopment ? err.message : 'Error interno del servidor',
      ...(isDevelopment && err.stack && { stack: err.stack })
    }
  } as ApiResponse);
});

// Integrate Vite Dev Server Middleware or serve compiled Client Static Files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Sistema aFull] Server running securely on http://localhost:${PORT}`);
  });
}

startServer();
