var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
var globalForPrisma, prisma;
var init_prisma = __esm({
  "src/lib/prisma.ts"() {
    globalForPrisma = globalThis;
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
    });
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = prisma;
    }
    process.on("beforeExit", async () => {
      await prisma.$disconnect();
    });
  }
});

// server-auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
function mapDbRolToUi(rol) {
  if (rol === Rol.ADMIN) return "Admin";
  if (rol === Rol.VISOR) return "Visor";
  return "Operario";
}
function mapUiRolToDb(rol) {
  const clean = String(rol).toLowerCase();
  if (clean === "admin") return Rol.ADMIN;
  if (clean === "visor") return Rol.VISOR;
  return Rol.OPERADOR;
}
async function seedInitialDataIfEmpty() {
  try {
    const colabCount = await prisma.colaborador.count();
    if (colabCount === 0) {
      logger.info("[SEED] Seeding default colaboradores...");
      const defaultColabs = [
        { id: "col_1", nombre: "Rodrigo G\xF3mez", tarifaSugerida: 350, rol: "T\xE9cnico de Ploteo" },
        { id: "col_2", nombre: "Kevin Delgado", tarifaSugerida: 400, rol: "Instalador Senior" },
        { id: "col_3", nombre: "Laura Ben\xEDtez", tarifaSugerida: 320, rol: "Ayudante de Taller" }
      ];
      for (const col of defaultColabs) {
        await prisma.colaborador.create({ data: col });
      }
    }
    const clientCount = await prisma.cliente.count();
    if (clientCount === 0) {
      logger.info("[SEED] Seeding default clientes...");
      const defaultClients = [
        { id: "cli_1", nombre: "Empresa 1 S.A.", codigo: "EMP1" },
        { id: "cli_2", nombre: "Estudio Alpha SL", codigo: "ALPH" },
        { id: "cli_3", nombre: "Distribuidora Global", codigo: "GLOB" }
      ];
      for (const cli of defaultClients) {
        await prisma.cliente.create({ data: cli });
      }
    }
    const projectCount = await prisma.proyecto.count();
    if (projectCount === 0) {
      logger.info("[SEED] Seeding default proyectos...");
      const defaultProjects = [
        { id: "pro_1", clienteId: "cli_1", nombre: "Ploteo de 2 Freezers Marca XXX", estado: "EN_PROCESO", fechaInicio: /* @__PURE__ */ new Date("2026-05-12") },
        { id: "pro_2", clienteId: "cli_2", nombre: "Carteler\xEDa Luminosa Local Central", estado: "PENDIENTE", fechaInicio: /* @__PURE__ */ new Date("2026-06-10") },
        { id: "pro_3", clienteId: "cli_1", nombre: "Mantenimiento de G\xF3ndolas Supermercado", estado: "COMPLETADO", fechaInicio: /* @__PURE__ */ new Date("2026-05-20") }
      ];
      for (const proj of defaultProjects) {
        await prisma.proyecto.create({ data: proj });
      }
    }
  } catch (err) {
    logger.error("[SEED] Error seeding data dependencies:", err.message);
  }
}
async function seedUsersIfEmpty() {
  try {
    await seedInitialDataIfEmpty();
    const count = await prisma.usuario.count();
    if (count > 0) {
      logger.info("[AUTH SEED] Users already exist in DB, skipping seed.");
      return;
    }
    logger.info("[AUTH SEED] No users found \u2014 seeding initial users...");
    const initialUsers = [
      { username: "admin", nombre: "Administrador", dbRol: Rol.ADMIN, password: "admin123", searchName: null },
      { username: "rodrigo", nombre: "Rodrigo", dbRol: Rol.OPERADOR, password: "rodrigo123", searchName: "Rodrigo" },
      { username: "ricardo", nombre: "Ricardo", dbRol: Rol.OPERADOR, password: "ricardo123", searchName: "Ricardo" },
      { username: "eduardo", nombre: "Eduardo", dbRol: Rol.OPERADOR, password: "eduardo123", searchName: "Eduardo" }
    ];
    for (const u of initialUsers) {
      let linkedColaboradorId = null;
      if (u.searchName) {
        const colab = await prisma.colaborador.findFirst({
          where: {
            nombre: { contains: u.searchName, mode: "insensitive" }
          }
        });
        if (colab) {
          linkedColaboradorId = colab.id;
        }
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(u.password, salt);
      await prisma.usuario.create({
        data: {
          username: u.username,
          nombre: u.nombre,
          rol: u.dbRol,
          passwordHash,
          colaboradorId: linkedColaboradorId,
          activo: true
        }
      });
      logger.info(`[AUTH SEED] Created user: ${u.username} (${u.dbRol}) linked to colab: ${linkedColaboradorId || "none"}`);
    }
    logger.info("[AUTH SEED] Seed complete.");
  } catch (err) {
    logger.error("[AUTH SEED] Error seeding users:", err.message);
  }
}
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}
function generateToken(payload) {
  const options = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Token inv\xE1lido o expirado");
  }
}
async function authenticateUser(usuario, password) {
  try {
    const user = await prisma.usuario.findFirst({
      where: {
        username: { equals: usuario, mode: "insensitive" },
        activo: true
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
      colaboradorId: user.colaboradorId ?? void 0
    };
  } catch (err) {
    logger.error("[AUTH] authenticateUser error:", err.message);
    return null;
  }
}
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      logger.info("[AUTH] REJECTED: Missing JWT cookie on", req.method, req.path);
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "Token de autenticaci\xF3n requerido"
        }
      });
    }
    logger.info("[AUTH] Cookie received for", req.method, req.path);
    const payload = verifyToken(token);
    const cacheKey = payload.usuario.toLowerCase();
    const cached = userActiveCache.get(cacheKey);
    const now = Date.now();
    let userDetails;
    const cacheStale = cached && !cached.nombre;
    if (cached && now - cached.checkedAt < CACHE_TTL_MS && !cacheStale) {
      userDetails = {
        activo: cached.activo,
        nombre: cached.nombre,
        rol: cached.rol,
        colaboradorId: cached.colaboradorId,
        cargo: cached.cargo,
        departamento: cached.departamento
      };
    } else {
      let userFromDb = null;
      try {
        userFromDb = await prisma.usuario.findFirst({
          where: {
            username: { equals: payload.usuario, mode: "insensitive" }
          }
        });
      } catch (dbError) {
        logger.warn("[AUTH] DB lookup failed for", payload.usuario, "- using JWT fallback. Error:", dbError.message);
      }
      if (userFromDb) {
        let cargo = null;
        let departamento = null;
        if (userFromDb.colaboradorId) {
          try {
            const colab = await prisma.colaborador.findUnique({
              where: { id: userFromDb.colaboradorId },
              select: { cargo: true, departamento: true }
            });
            cargo = colab?.cargo || null;
            departamento = colab?.departamento || null;
          } catch {
          }
        }
        userDetails = {
          activo: userFromDb.activo,
          nombre: userFromDb.nombre,
          rol: mapDbRolToUi(userFromDb.rol),
          colaboradorId: userFromDb.colaboradorId,
          cargo,
          departamento
        };
      } else {
        userDetails = {
          activo: true,
          nombre: payload.nombre || "",
          rol: payload.rol || "Operario",
          colaboradorId: payload.colaboradorId || null,
          cargo: payload.cargo || null,
          departamento: payload.departamento || null
        };
      }
      userActiveCache.set(cacheKey, {
        ...userDetails,
        checkedAt: now
      });
    }
    payload.nombre = userDetails.nombre;
    payload.rol = userDetails.rol;
    payload.colaboradorId = userDetails.colaboradorId;
    payload.cargo = userDetails.cargo;
    payload.departamento = userDetails.departamento;
    if (!userDetails.activo) {
      logger.info("[AUTH] REJECTED: User is inactive or deleted:", payload.usuario);
      return res.status(401).json({
        success: false,
        error: {
          code: "INACTIVE_USER",
          message: "El usuario ha sido desactivado"
        }
      });
    }
    logger.info("[AUTH] Token verified successfully - user:", payload.nombre, "rol:", payload.rol);
    req.user = payload;
    next();
  } catch (error) {
    logger.info("[AUTH] Token verification failed on", req.method, req.path, "- error:", error.message);
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: error.message || "Token inv\xE1lido"
      }
    });
  }
}
function requireAdmin(req, res, next) {
  const user = req.user;
  logger.info("[ADMIN CHECK] Checking admin access");
  logger.info("[ADMIN CHECK] User present:", !!user);
  if (user) {
    logger.info("[ADMIN CHECK] User role:", user.rol);
  }
  if (!user || user.rol !== "Admin") {
    logger.info("[ADMIN CHECK] REJECTED: Not admin");
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Acceso denegado: se requiere rol de Administrador"
      }
    });
  }
  logger.info("[ADMIN CHECK] PASSED: User is admin");
  next();
}
async function isUserJefeProduccion(user) {
  if (!user) return false;
  if (user.rol === "Admin") return true;
  const username = user.usuario?.toLowerCase() || "";
  if (username === "2908320") return true;
  const cargo = (user.cargo || "").toLowerCase();
  if (cargo.includes("jefe de produccion") || cargo.includes("produccion")) return true;
  return false;
}
async function isUserDiseno(user) {
  if (!user) return false;
  if (user.rol === "Admin") return true;
  const username = user.usuario?.toLowerCase() || "";
  if (username === "4958075") return true;
  const cargo = (user.cargo || "").toLowerCase();
  const dep = (user.departamento || "").toLowerCase();
  if (cargo.includes("dise\xF1") || dep.includes("dise\xF1")) return true;
  return false;
}
async function requireProduccionOrAdmin(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token de autenticaci\xF3n requerido" }
    });
  }
  if (await isUserJefeProduccion(user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: { code: "FORBIDDEN", message: "Acceso denegado: se requiere rol de Jefe de Producci\xF3n o Administrador" }
  });
}
async function requireDisenoOrProduccionOrAdmin(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token de autenticaci\xF3n requerido" }
    });
  }
  if (await isUserJefeProduccion(user) || await isUserDiseno(user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: { code: "FORBIDDEN", message: "Acceso denegado: se requiere rol de Dise\xF1o, Producci\xF3n o Administrador" }
  });
}
function requireWriteAccess(req, res, next) {
  const user = req.user;
  if (user && user.rol === "Visor") {
    logger.info("[WRITE CHECK] REJECTED: User role is Visor");
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Acceso denegado: el rol Visor no permite modificar datos"
      }
    });
  }
  next();
}
var DEFAULT_JWT_SECRET, JWT_SECRET, JWT_EXPIRES_IN, logger, userActiveCache, CACHE_TTL_MS;
var init_server_auth = __esm({
  "server-auth.ts"() {
    init_prisma();
    DEFAULT_JWT_SECRET = "yIUDXn0iEkb9gNPcO72XsdUmYLWv588BS0TPm39T59aFD4vFahdwsJADvcMM95p0";
    JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
    logger = {
      debug: (...args) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(...args);
        }
      },
      info: console.log,
      warn: console.warn,
      error: console.error
    };
    if (!process.env.JWT_SECRET) {
      logger.warn("[SECURITY] JWT_SECRET not found in environment, using default key. Set JWT_SECRET in production settings.");
    } else if (process.env.JWT_SECRET.length < 32) {
      logger.warn("[SECURITY] JWT_SECRET should be at least 32 characters long.");
    }
    userActiveCache = /* @__PURE__ */ new Map();
    CACHE_TTL_MS = 60 * 1e3;
  }
});

// src/server/config/logger.ts
var logger2;
var init_logger = __esm({
  "src/server/config/logger.ts"() {
    logger2 = {
      debug: (...args) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(...args);
        }
      },
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }
});

// src/server/shared.ts
function parseExcelDate(excelDate) {
  if (!excelDate) return (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
  if (typeof excelDate === "number") {
    const date = new Date((excelDate - (excelDate > 60 ? 2 : 1)) * 24 * 60 * 60 * 1e3 + (/* @__PURE__ */ new Date("1900-01-01")).getTime());
    return date.toISOString().substring(0, 10);
  }
  try {
    const parsedStr = String(excelDate).trim();
    if (parsedStr.includes("/") || parsedStr.includes("-")) {
      const parts = parsedStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    }
    const d = new Date(excelDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  } catch (e) {
  }
  return (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
}
function formatExcelTime(val) {
  if (val === void 0 || val === null || val === "") return "";
  const valStr = String(val).trim();
  if (valStr.includes(":")) {
    return valStr.substring(0, 5);
  }
  const num = parseFloat(valStr);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return valStr;
}
function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}
function convertPrismaToFrontend(prismaData) {
  const mapEstadoProyecto = (estado) => {
    if (estado === "EN_PROCESO") return "En Proceso";
    if (estado === "COMPLETADO") return "Completado";
    return "Pendiente";
  };
  return {
    clientes: prismaData.clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo,
      tokenPortal: c.tokenPortal || null,
      fechaCreacion: c.fechaCreacion.toISOString().substring(0, 10)
    })),
    proyectos: prismaData.proyectos.map((p) => ({
      id: p.id,
      clienteId: p.clienteId,
      nombre: p.nombre,
      estado: mapEstadoProyecto(p.estado),
      fechaInicio: p.fechaInicio.toISOString().substring(0, 10),
      activo: p.activo
    })),
    colaboradores: prismaData.colaboradores.map((c) => {
      const linkedUser = (prismaData.usuarios || []).find((u) => u.colaboradorId === c.id);
      return {
        id: c.id,
        nombre: c.nombre,
        tarifaSugerida: c.tarifaSugerida ? parseFloat(c.tarifaSugerida.toString()) : 0,
        rol: c.rol || void 0,
        ci: c.ci || void 0,
        cargo: c.cargo || void 0,
        departamento: c.departamento || void 0,
        jefeInmediato: c.jefeInmediato || void 0,
        usuario: linkedUser ? {
          id: linkedUser.id,
          username: linkedUser.username,
          nombre: linkedUser.nombre,
          email: linkedUser.email,
          rol: mapDbRolToUi(linkedUser.rol),
          activo: linkedUser.activo
        } : null
      };
    }),
    registros: prismaData.registros.map((r) => ({
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.clienteNombre,
      proyectoId: r.proyectoId,
      proyectoNombre: r.proyectoNombre,
      fecha: r.fecha.toISOString().substring(0, 10),
      concepto: r.concepto === "MO" ? "MO" : r.concepto === "INSUMO" ? "Insumo" : "Otros",
      descripcion: r.descripcion,
      colaboradorId: r.colaboradorId || void 0,
      hsInicio: r.hsInicio || void 0,
      hsFin: r.hsFin || void 0,
      hsTotal: r.hsTotal ? parseFloat(r.hsTotal.toString()) : void 0,
      cantidad: parseFloat(r.cantidad.toString()),
      precioUnitario: parseFloat(r.precioUnitario.toString()),
      total: parseFloat(r.total.toString()),
      origen: r.origen === "MANUAL" ? "Manual" : "Excel",
      fechaImportacion: r.fechaImportacion ? r.fechaImportacion.toISOString().substring(0, 10) : void 0
    })),
    registrosVehiculo: prismaData.registrosVehiculo.map((rv) => ({
      id: rv.id,
      clienteId: rv.clienteId,
      clienteNombre: rv.clienteNombre,
      proyectoId: rv.proyectoId,
      proyectoNombre: rv.proyectoNombre,
      fecha: rv.fecha.toISOString().substring(0, 10),
      kmInicial: parseFloat(rv.kmInicial.toString()),
      kmFinal: parseFloat(rv.kmFinal.toString()),
      distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()),
      distanciaGPS: rv.distanciaGPS ? parseFloat(rv.distanciaGPS.toString()) : void 0,
      combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : void 0,
      combustibleCosto: parseFloat(rv.combustibleCosto.toString()),
      total: parseFloat(rv.total.toString()),
      descripcion: rv.descripcion || void 0,
      alertaDiscrepancia: rv.alertaDiscrepancia,
      discrepancia: rv.discrepancia ? parseFloat(rv.discrepancia.toString()) : void 0,
      consumoPorKm: rv.consumoPorKm ? parseFloat(rv.consumoPorKm.toString()) : void 0,
      fotoOdometroInicio: rv.fotoOdometroInicio || void 0,
      fotoOdometroFin: rv.fotoOdometroFin || void 0,
      ubicacionInicio: rv.ubicacionInicio || void 0,
      ubicacionFin: rv.ubicacionFin || void 0,
      horaInicio: rv.horaInicio || void 0,
      horaFin: rv.horaFin || void 0,
      duracionMinutos: rv.duracionMinutos || void 0,
      usuario: rv.usuario || void 0,
      origen: rv.origen === "MANUAL" ? "Manual" : "Excel",
      fechaImportacion: rv.fechaImportacion ? rv.fechaImportacion.toISOString().substring(0, 10) : void 0
    })),
    timersActivos: (prismaData.timersActivos || []).map((t) => ({
      id: t.id,
      usuario: t.usuario,
      colaboradorId: t.colaboradorId || void 0,
      clienteId: t.clienteId,
      proyectoId: t.proyectoId,
      descripcion: t.descripcion,
      precioUnitario: parseFloat(t.precioUnitario.toString()),
      inicio: t.inicio.toISOString(),
      activo: t.activo,
      ultimaActualizacion: t.ultimaActualizacion.toISOString(),
      pausedTime: t.pausedTime,
      pauseHistory: t.pauseHistory,
      isPaused: t.isPaused,
      currentPauseStart: t.currentPauseStart?.toISOString()
    })),
    viajesActivos: (prismaData.viajesActivos || []).map((v) => ({
      id: v.id,
      usuario: v.usuario,
      clienteId: v.clienteId,
      proyectoId: v.proyectoId,
      inicio: v.inicio.toISOString(),
      ubicacionInicio: v.ubicacionInicio,
      fotoOdometroInicio: v.fotoOdometroInicio,
      kmInicial: parseFloat(v.kmInicial.toString()),
      descripcion: v.descripcion,
      activo: v.activo
    })),
    usuariosSinColaborador: (prismaData.usuarios || []).filter((u) => !u.colaboradorId).map((u) => ({
      id: u.id,
      username: u.username,
      nombre: u.nombre,
      email: u.email,
      rol: mapDbRolToUi(u.rol),
      activo: u.activo
    }))
  };
}
var csrfTokens, CSRF_TOKEN_EXPIRY, csrfCleanupTimer;
var init_shared = __esm({
  "src/server/shared.ts"() {
    init_server_auth();
    init_logger();
    csrfTokens = /* @__PURE__ */ new Map();
    CSRF_TOKEN_EXPIRY = 36e5;
    csrfCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, data] of csrfTokens.entries()) {
        if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
          csrfTokens.delete(sessionId);
        }
      }
    }, 6e5);
    if (csrfCleanupTimer && typeof csrfCleanupTimer.unref === "function") {
      csrfCleanupTimer.unref();
    }
  }
});

// server-audit.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
function auditLog(entry) {
  const record = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    usuario: entry.usuario,
    accion: entry.accion,
    recurso: entry.recurso,
    resultado: entry.resultado,
    ip: entry.ip,
    ...entry.detalle ? { detalle: entry.detalle } : {}
  };
  const line = JSON.stringify(record) + "\n";
  fs.appendFile(AUDIT_LOG_PATH, line, (err) => {
    if (err) {
      console.error("[AUDIT] Failed to write audit log entry:", err.message);
    }
  });
  try {
    const id = "aud" + Math.random().toString(36).substring(2, 11);
    prisma.auditEvent.create({
      data: { id, usuario: entry.usuario, accion: entry.accion, recurso: entry.recurso || null, resultado: entry.resultado, ip: entry.ip || null, detalle: entry.detalle || null }
    }).catch((e) => console.error("[AUDIT] DB error:", e.message));
  } catch (e) {
    console.error("[AUDIT] DB catch:", e.message);
  }
}
function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
var __filename, __dirname, AUDIT_LOG_PATH;
var init_server_audit = __esm({
  "server-audit.ts"() {
    init_prisma();
    __filename = fileURLToPath(import.meta.url);
    __dirname = dirname(__filename);
    AUDIT_LOG_PATH = path.join(__dirname, "audit.log");
  }
});

// src/server/routes/pedidos.routes.ts
var pedidos_routes_exports = {};
__export(pedidos_routes_exports, {
  guardarFotoEntregaStorage: () => guardarFotoEntregaStorage,
  pedidosRouter: () => pedidosRouter
});
import { Router as Router7 } from "express";
import { Decimal as Decimal2 } from "@prisma/client/runtime/library";
import path2 from "path";
import fs2 from "fs";
async function guardarFotoEntregaStorage(pedidoId, fotoBase64, tipo) {
  if (!fotoBase64 || !fotoBase64.startsWith("data:")) return fotoBase64;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const raw = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const storagePath = `entregas/${pedidoId}/${tipo}_${Date.now()}.jpg`;
      const { error } = await supabaseAdmin.storage.from("vehiculos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
      if (error) {
        logger2.warn("[PEDIDOS] Supabase storage upload warning:", error.message);
      } else {
        const { data } = supabaseAdmin.storage.from("vehiculos-fotos").getPublicUrl(storagePath);
        return data.publicUrl;
      }
    } catch (e) {
      logger2.error("[PEDIDOS] Error uploading to Supabase Storage:", e);
    }
  }
  const uploadsDir = path2.join(process.cwd(), "uploads", "entregas", pedidoId);
  await fs2.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `${tipo}_${Date.now()}.jpg`;
  await fs2.promises.writeFile(path2.join(uploadsDir, filename), buffer);
  return `/uploads/entregas/${pedidoId}/${filename}`;
}
var pedidosRouter;
var init_pedidos_routes = __esm({
  "src/server/routes/pedidos.routes.ts"() {
    init_prisma();
    init_server_auth();
    init_server_audit();
    init_logger();
    init_shared();
    pedidosRouter = Router7();
    pedidosRouter.get("/", requireAuth, requireDisenoOrProduccionOrAdmin, async (req, res) => {
      try {
        const { estado, clienteId } = req.query;
        const where = { archivado: false };
        if (estado) where.estado = String(estado);
        if (clienteId) where.clienteId = String(clienteId);
        const pedidos = await prisma.pedido.findMany({
          where,
          orderBy: { fechaSolicitud: "desc" },
          include: {
            cliente: { select: { nombre: true } },
            presupuestos: {
              select: { id: true, estado: true, total: true, proyecto: true },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        });
        res.json({
          success: true,
          data: pedidos.map((p) => ({
            id: p.id,
            clienteId: p.clienteId,
            clienteNombre: p.cliente.nombre,
            sucursalId: p.sucursalId,
            local: p.sucursalNombre,
            marca: p.marca,
            descripcion: p.descripcion,
            cantidad: Number(p.cantidad),
            tipo: p.tipo,
            prioridad: p.prioridad,
            estado: p.estado,
            fotoUrl: p.fotoUrl,
            fechaSolicitud: p.fechaSolicitud,
            fechaFin: p.fechaFin,
            facturaNumero: p.facturaNumero,
            registroId: p.registroId,
            presupuestoEstado: p.presupuestos?.length ? p.presupuestos[0].estado : null,
            presupuestoTotal: p.presupuestos?.length ? Number(p.presupuestos[0].total) : null,
            presupuestoProyecto: p.presupuestos?.length ? p.presupuestos[0].proyecto : null,
            fotoRemisionUrl: p.fotoRemisionUrl,
            fotoEntregaUrl: p.fotoEntregaUrl,
            fechaEntrega: p.fechaEntrega,
            receptorNombre: p.receptorNombre,
            contacto: p.contacto,
            proyecto: p.proyecto,
            fechaInicioDeseada: p.fechaInicioDeseada,
            fechaTope: p.fechaTope,
            comentarioCliente: p.comentarioCliente
          }))
        });
      } catch (error) {
        logger2.error("[PEDIDOS] Error listing:", error);
        res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar pedidos" } });
      }
    });
    pedidosRouter.put("/:id", requireAuth, requireDisenoOrProduccionOrAdmin, async (req, res) => {
      const { id } = req.params;
      const {
        sucursalId,
        descripcion,
        cantidad,
        fechaSolicitud,
        marca,
        tipo,
        prioridad,
        estado,
        fotoUrl,
        fechaFin,
        facturaNumero,
        fotoRemisionUrl,
        fotoEntregaUrl,
        fechaEntrega,
        receptorNombre,
        contacto,
        proyecto
      } = req.body || {};
      try {
        const existing = await prisma.pedido.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Pedido no encontrado" } });
        const data = {};
        if (sucursalId !== void 0) {
          const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, clienteId: existing.clienteId } });
          if (!sucursal) return res.status(400).json({ success: false, error: { code: "FORBIDDEN", message: "Sucursal no v\xE1lida para este cliente" } });
          data.sucursalId = sucursal.id;
          data.sucursalNombre = sucursal.nombre;
        }
        if (descripcion !== void 0) {
          const d = String(descripcion).trim().slice(0, 1e3);
          if (!d) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "La descripci\xF3n no puede estar vac\xEDa" } });
          data.descripcion = d;
        }
        if (cantidad !== void 0) {
          const cantNum = Number(cantidad);
          if (isNaN(cantNum) || cantNum <= 0) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "La cantidad debe ser mayor a 0" } });
          data.cantidad = new Decimal2(cantNum);
        }
        if (fechaSolicitud !== void 0) data.fechaSolicitud = fechaSolicitud ? new Date(String(fechaSolicitud)) : /* @__PURE__ */ new Date();
        if (marca !== void 0) data.marca = marca ? String(marca).slice(0, 50) : null;
        if (tipo !== void 0) data.tipo = String(tipo).slice(0, 50);
        if (prioridad !== void 0) data.prioridad = String(prioridad).slice(0, 20);
        if (estado !== void 0) data.estado = String(estado).slice(0, 30);
        if (fotoUrl !== void 0) data.fotoUrl = fotoUrl ? String(fotoUrl) : null;
        if (fechaFin !== void 0) data.fechaFin = fechaFin ? new Date(String(fechaFin)) : null;
        if (facturaNumero !== void 0) data.facturaNumero = facturaNumero ? String(facturaNumero).slice(0, 30) : null;
        if (contacto !== void 0) data.contacto = contacto ? String(contacto).slice(0, 200) : null;
        if (proyecto !== void 0) data.proyecto = proyecto ? String(proyecto).slice(0, 200) : null;
        if (fotoRemisionUrl !== void 0) {
          if (fotoRemisionUrl && fotoRemisionUrl.startsWith("data:")) {
            data.fotoRemisionUrl = await guardarFotoEntregaStorage(id, fotoRemisionUrl, "remision");
          } else {
            data.fotoRemisionUrl = fotoRemisionUrl ? String(fotoRemisionUrl) : null;
          }
        }
        if (fotoEntregaUrl !== void 0) {
          if (fotoEntregaUrl && fotoEntregaUrl.startsWith("data:")) {
            data.fotoEntregaUrl = await guardarFotoEntregaStorage(id, fotoEntregaUrl, "entrega");
          } else {
            data.fotoEntregaUrl = fotoEntregaUrl ? String(fotoEntregaUrl) : null;
          }
        }
        if (fechaEntrega !== void 0) data.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : null;
        if (receptorNombre !== void 0) data.receptorNombre = receptorNombre ? String(receptorNombre).slice(0, 100) : null;
        const updated = await prisma.pedido.update({ where: { id }, data });
        auditLog({ usuario: req.user.usuario, accion: "update_pedido", recurso: `/api/admin/pedidos/${id}`, resultado: "success", ip: getClientIp(req) });
        res.json({
          success: true,
          data: {
            id: updated.id,
            clienteId: updated.clienteId,
            sucursalId: updated.sucursalId,
            local: updated.sucursalNombre,
            marca: updated.marca,
            descripcion: updated.descripcion,
            cantidad: Number(updated.cantidad),
            tipo: updated.tipo,
            prioridad: updated.prioridad,
            estado: updated.estado,
            fotoUrl: updated.fotoUrl,
            fechaSolicitud: updated.fechaSolicitud,
            fechaFin: updated.fechaFin,
            facturaNumero: updated.facturaNumero,
            registroId: updated.registroId,
            fotoRemisionUrl: updated.fotoRemisionUrl,
            fotoEntregaUrl: updated.fotoEntregaUrl,
            fechaEntrega: updated.fechaEntrega,
            receptorNombre: updated.receptorNombre,
            contacto: updated.contacto,
            proyecto: updated.proyecto
          },
          message: "Pedido actualizado"
        });
      } catch (error) {
        logger2.error("[PEDIDOS] Error updating:", error);
        res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar pedido" } });
      }
    });
    pedidosRouter.post("/:id/fotos-entrega", requireAuth, requireDisenoOrProduccionOrAdmin, async (req, res) => {
      const { id } = req.params;
      const { tipo, fotoBase64, receptorNombre, fechaEntrega } = req.body || {};
      if (!tipo || tipo !== "remision" && tipo !== "entrega") {
        return res.status(400).json({ success: false, error: { code: "INVALID_TYPE", message: 'El tipo debe ser "remision" o "entrega"' } });
      }
      if (!fotoBase64) {
        return res.status(400).json({ success: false, error: { code: "MISSING_PHOTO", message: "Se requiere la foto en formato base64" } });
      }
      try {
        const pedido = await prisma.pedido.findUnique({ where: { id } });
        if (!pedido) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Pedido no encontrado" } });
        const photoUrl = await guardarFotoEntregaStorage(id, fotoBase64, tipo);
        const updateData = {};
        if (tipo === "remision") {
          updateData.fotoRemisionUrl = photoUrl;
        } else {
          updateData.fotoEntregaUrl = photoUrl;
        }
        if (receptorNombre) updateData.receptorNombre = String(receptorNombre).slice(0, 100);
        updateData.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : /* @__PURE__ */ new Date();
        if (pedido.estado !== "Entregado") {
          updateData.estado = "Entregado";
          if (!pedido.fechaFin) updateData.fechaFin = /* @__PURE__ */ new Date();
        }
        const updated = await prisma.pedido.update({
          where: { id },
          data: updateData
        });
        auditLog({
          usuario: req.user.usuario,
          accion: "subir_foto_entrega",
          recurso: `/api/admin/pedidos/${id}/fotos-entrega`,
          resultado: "success",
          ip: getClientIp(req),
          detalle: `Foto de ${tipo} subida para pedido ${id}`
        });
        res.json({
          success: true,
          data: {
            id: updated.id,
            fotoUrl: photoUrl,
            tipo,
            estado: updated.estado,
            fotoRemisionUrl: updated.fotoRemisionUrl,
            fotoEntregaUrl: updated.fotoEntregaUrl,
            fechaEntrega: updated.fechaEntrega,
            receptorNombre: updated.receptorNombre
          },
          message: `Foto de ${tipo} guardada correctamente`
        });
      } catch (error) {
        logger2.error("[PEDIDOS] Error uploading delivery photo:", error);
        res.status(500).json({ success: false, error: { code: "UPLOAD_ERROR", message: "Error al subir foto de entrega" } });
      }
    });
    pedidosRouter.post("/:id/convertir", requireAuth, requireAdmin, async (req, res) => {
      const { id } = req.params;
      try {
        const pedido = await prisma.pedido.findUnique({ where: { id } });
        if (!pedido) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Pedido no encontrado" } });
        if (pedido.registroId) return res.status(400).json({ success: false, error: { code: "ALREADY_CONVERTED", message: "Este pedido ya fue convertido a registro" } });
        const cliente = await prisma.cliente.findUnique({ where: { id: pedido.clienteId } });
        if (!cliente) return res.status(400).json({ success: false, error: { code: "MISSING_REFERENCES", message: "Cliente no encontrado" } });
        const nombreProyecto = pedido.proyecto && pedido.proyecto.trim() ? pedido.proyecto.trim().slice(0, 200) : pedido.descripcion.slice(0, 200);
        let proyecto = await prisma.proyecto.findFirst({ where: { clienteId: cliente.id, nombre: nombreProyecto, activo: true } });
        if (!proyecto) {
          proyecto = await prisma.proyecto.create({
            data: {
              id: generateId("pro"),
              clienteId: cliente.id,
              nombre: nombreProyecto,
              estado: "EN_PROCESO",
              fechaInicio: pedido.fechaInicioDeseada || /* @__PURE__ */ new Date()
            }
          });
        }
        const registroId = generateId("reg");
        await prisma.$transaction(async (tx) => {
          await tx.registro.create({
            data: {
              id: registroId,
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
              proyectoId: proyecto.id,
              proyectoNombre: proyecto.nombre,
              fecha: /* @__PURE__ */ new Date(),
              concepto: "INSUMO",
              descripcion: pedido.descripcion,
              cantidad: pedido.cantidad,
              precioUnitario: new Decimal2(0),
              total: new Decimal2(0),
              origen: "API",
              fechaImportacion: /* @__PURE__ */ new Date()
            }
          });
          await tx.pedido.update({
            where: { id: pedido.id },
            data: {
              registroId,
              proyecto: proyecto.nombre,
              estado: "Completado"
            }
          });
        });
        auditLog({
          usuario: req.user.usuario,
          accion: "convertir_pedido",
          recurso: `/api/admin/pedidos/${id}/convertir`,
          resultado: "success",
          ip: getClientIp(req),
          detalle: `Pedido ${id} -> Proyecto ${proyecto.id} -> Registro ${registroId}`
        });
        res.json({
          success: true,
          data: {
            registroId,
            proyectoId: proyecto.id,
            proyectoNombre: proyecto.nombre,
            clienteId: cliente.id,
            clienteNombre: cliente.nombre
          },
          message: "Pedido convertido a proyecto y registro correctamente"
        });
      } catch (error) {
        logger2.error("[PEDIDOS] Error converting:", error);
        res.status(500).json({ success: false, error: { code: "CONVERT_ERROR", message: "Error al convertir pedido" } });
      }
    });
  }
});

// server.ts
init_server_auth();
init_logger();
init_shared();
import dotenv from "dotenv";
import express from "express";
import path8 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname2 } from "path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

// src/server/routes/auth.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router } from "express";
import crypto2 from "crypto";

// src/server/config/rate-limiters.ts
import rateLimit from "express-rate-limit";
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 500,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Demasiados intentos de inicio de sesi\xF3n. Por favor, intent\xE1 nuevamente en 15 minutos."
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
var portalLimiter = rateLimit({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 30,
  // 30 requests per minute per IP
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Demasiadas solicitudes. Por favor, intent\xE1 nuevamente en un minuto."
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// src/server/routes/auth.routes.ts
init_server_auth();

// server-validation.ts
import { z } from "zod";
var LoginSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido").max(50),
  password: z.string().min(1, "Contrase\xF1a requerida")
});
var PasswordComplexitySchema = z.string().min(3, "La contrase\xF1a debe tener al menos 3 caracteres");
function sanitizeHTML(input) {
  if (typeof input !== "string") return input;
  return input.replace(/<[^>]*>/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var RegistroItemSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  proyectoId: z.string().min(1, "Proyecto requerido"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe estar en formato YYYY-MM-DD").optional(),
  concepto: z.enum(["MO", "Insumo", "Otros"]).optional(),
  descripcion: z.string().min(1, "Descripci\xF3n requerida").max(500, "Descripci\xF3n muy larga").transform(sanitizeHTML),
  colaboradorId: z.string().nullable().optional(),
  hsInicio: z.string().optional().transform((v) => v ? v.substring(0, 5) : v),
  hsFin: z.string().optional().transform((v) => v ? v.substring(0, 5) : v),
  hsTotal: z.number().nonnegative("Horas totales no pueden ser negativas").optional(),
  cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
  precioUnitario: z.number().nonnegative("Precio unitario no puede ser negativo"),
  total: z.number().nonnegative("Total no puede ser negativo")
});
var ClienteSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML),
  // SECURITY: Sanitize HTML/XSS
  codigo: z.string().max(20, "C\xF3digo muy largo").optional(),
  fechaCreacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
var ProyectoSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  nombre: z.string().min(1, "Nombre requerido").max(300, "Nombre muy largo").transform(sanitizeHTML),
  // SECURITY: Sanitize HTML/XSS
  presupuesto: z.number().nonnegative("Presupuesto no puede ser negativo").optional(),
  estado: z.enum(["Pendiente", "En Proceso", "Completado"]).optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
var ColaboradorSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML),
  // SECURITY: Sanitize HTML/XSS
  tarifaSugerida: z.number().positive("Tarifa debe ser positiva"),
  rol: z.string().max(100, "Rol muy largo").optional()
});
var DatabaseStateSchema = z.object({
  clientes: z.array(ClienteSchema.extend({ id: z.string() })),
  proyectos: z.array(ProyectoSchema.extend({ id: z.string() })),
  colaboradores: z.array(ColaboradorSchema.extend({ id: z.string() })),
  registros: z.array(z.any())
  // Flexible for registros
});
var GeminiEnrichSchema = z.object({
  entries: z.array(z.object({
    descripcion: z.string().transform(sanitizeHTML),
    // SECURITY: Sanitize HTML/XSS
    concepto: z.string().optional()
  })).min(1, "Al menos una entrada requerida")
});
var TimerStartSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  colaboradorId: z.string().min(1, "Colaborador requerido"),
  clienteId: z.string().min(1, "Cliente requerido"),
  proyectoId: z.string().min(1, "Proyecto requerido"),
  descripcion: z.string().min(1, "Descripci\xF3n requerida").max(500, "Descripci\xF3n muy larga").transform(sanitizeHTML),
  precioUnitario: z.number().positive("Precio unitario debe ser positivo")
});
var TimerStopSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  pausedTime: z.number().nonnegative("Tiempo pausado debe ser no negativo").optional(),
  pauseHistory: z.array(z.object({
    start: z.string(),
    end: z.string().nullable(),
    duration: z.number().nonnegative()
  })).optional()
});
var TimerPauseSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  tipo: z.enum(["descanso", "pausa"]).optional()
});
var TimerResumeSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido")
});
var TimerSyncSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  segundosTranscurridos: z.number().nonnegative("Segundos deben ser no negativos")
});
var ViajeStartSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  clienteId: z.string().min(1, "Cliente requerido"),
  proyectoId: z.string().min(1, "Proyecto requerido"),
  descripcion: z.string().max(500, "Descripci\xF3n muy larga").transform(sanitizeHTML),
  ubicacionInicio: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).nullable().optional(),
  fotoOdometroInicio: z.string().min(1, "Foto del od\xF3metro requerida"),
  kmInicial: z.number().positive("Kilometraje inicial debe ser positivo")
}).refine(
  (data) => {
    const esParticular = data.clienteId === "viaje_particular" || data.proyectoId === "viaje_particular";
    return esParticular || data.clienteId && data.proyectoId;
  },
  { message: "Cliente y proyecto requeridos para viajes no particulares" }
);
var ViajeStopSchema = z.object({
  usuario: z.string().min(1, "Usuario requerido"),
  ubicacionFin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).nullable().optional(),
  fotoOdometroFin: z.string().min(1, "Foto del od\xF3metro requerida"),
  kmFinal: z.number().positive("Kilometraje final debe ser positivo"),
  combustibleLitros: z.number().positive().optional(),
  combustibleCosto: z.number().positive("Costo de combustible requerido"),
  descripcion: z.string().max(500).transform(sanitizeHTML).optional()
});
var RegistroVehiculoUpdateSchema = z.object({
  kmInicial: z.number().positive("Kilometraje inicial debe ser positivo"),
  kmFinal: z.number().positive("Kilometraje final debe ser positivo"),
  total: z.number().positive("Total debe ser positivo"),
  descripcion: z.string().max(500).transform(sanitizeHTML),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe estar en formato YYYY-MM-DD").refine(
    (date) => {
      const inputDate = new Date(date);
      const today = /* @__PURE__ */ new Date();
      today.setHours(23, 59, 59, 999);
      return inputDate <= today;
    },
    { message: "La fecha no puede ser futura" }
  )
}).refine(
  (data) => data.kmFinal > data.kmInicial,
  { message: "Kilometraje final debe ser mayor que el inicial", path: ["kmFinal"] }
);
var RegistroVehiculoPatchSchema = z.object({
  kmInicial: z.number().positive("Kilometraje inicial debe ser positivo").optional(),
  kmFinal: z.number().positive("Kilometraje final debe ser positivo").optional(),
  total: z.number().positive("Total debe ser positivo").optional(),
  descripcion: z.string().max(500).transform(sanitizeHTML).optional(),
  fotoOdometroInicio: z.string().optional(),
  fotoOdometroFin: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe estar en formato YYYY-MM-DD").refine(
    (date) => {
      const inputDate = new Date(date);
      const today = /* @__PURE__ */ new Date();
      today.setHours(23, 59, 59, 999);
      return inputDate <= today;
    },
    { message: "La fecha no puede ser futura" }
  ).optional()
}).refine(
  (data) => {
    if (data.kmInicial !== void 0 && data.kmFinal !== void 0) {
      return data.kmFinal >= data.kmInicial;
    }
    return true;
  },
  { message: "Kilometraje final no puede ser menor que el inicial", path: ["kmFinal"] }
);
function validateSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code
      }))
    };
  }
  return {
    valid: true,
    data: result.data
  };
}
var RUC_REGEX = /^\d{6,8}-\d$/;
var rucField = z.string().regex(RUC_REGEX, "RUC inv\xE1lido (formato: 8 d\xEDgitos + guion + d\xEDgito verificador)").optional().or(z.literal(""));
var emailField = z.string().email("Correo inv\xE1lido").max(255, "Correo muy largo").optional().or(z.literal(""));
var CarteraClienteSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML),
  ruc: rucField.transform((v) => v ? v.trim() : null)
});
var CarteraClienteUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML).optional(),
  ruc: rucField.transform((v) => v ? v.trim() : null).optional(),
  activo: z.boolean().optional()
});
var CarteraContactoSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML),
  cargo: z.string().max(100, "Cargo muy largo").transform(sanitizeHTML).optional().or(z.literal("")),
  telefono: z.string().max(50, "Tel\xE9fono muy largo").optional().or(z.literal("")),
  email: emailField
});
var CarteraContactoUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200, "Nombre muy largo").transform(sanitizeHTML).optional(),
  cargo: z.string().max(100, "Cargo muy largo").transform(sanitizeHTML).optional().or(z.literal("")),
  telefono: z.string().max(50, "Tel\xE9fono muy largo").optional().or(z.literal("")),
  email: emailField.optional(),
  activo: z.boolean().optional()
});
var CarteraMarcaSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  nombre: z.string().min(1, "Nombre requerido").max(100, "Nombre muy largo").transform(sanitizeHTML)
});
var CarteraMarcaUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100, "Nombre muy largo").transform(sanitizeHTML).optional(),
  activo: z.boolean().optional()
});

// src/server/routes/auth.routes.ts
var authRouter = Router();
authRouter.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: "healthy", database: "connected", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    logger2.error("[HEALTH CHECK] Database connection failed:", err.message);
    return res.status(500).json({ status: "unhealthy", database: "disconnected", error: err.message });
  }
});
authRouter.get("/csrf-token", (req, res) => {
  let sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    sessionId = crypto2.randomBytes(32).toString("hex");
    res.cookie("sessionId", sessionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 36e5 });
  }
  const csrfToken = crypto2.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, { token: csrfToken, createdAt: Date.now() });
  res.json({ success: true, data: { csrfToken } });
});
authRouter.post("/auth/login", authLimiter, async (req, res) => {
  const validation = validateSchema(LoginSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos de login inv\xE1lidos", details: validation.errors } });
  const { usuario, password } = validation.data;
  const clientIp = getClientIp(req);
  try {
    const user = await authenticateUser(usuario, password);
    if (!user) {
      auditLog({ usuario, accion: "login", recurso: "/api/auth/login", resultado: "failure", ip: clientIp });
      return res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Usuario o contrase\xF1a incorrectos" } });
    }
    const token = generateToken({ usuario: user.usuario, nombre: user.nombre, rol: user.rol, colaboradorId: user.colaboradorId });
    res.cookie("jwt", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 12 * 60 * 60 * 1e3 });
    auditLog({ usuario: user.usuario, accion: "login", recurso: "/api/auth/login", resultado: "success", ip: clientIp });
    return res.status(200).json({ success: true, data: { user: { nombre: user.nombre, rol: user.rol, usuario: user.usuario, colaboradorId: user.colaboradorId || void 0 } } });
  } catch (error) {
    logger2.error("Login error:", error);
    return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Error al procesar login" } });
  }
});
authRouter.post("/auth/logout", (req, res) => {
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" };
  res.clearCookie("jwt", cookieOptions);
  res.clearCookie("sessionId", cookieOptions);
  res.json({ success: true, message: "Sesi\xF3n cerrada con \xE9xito" });
});
authRouter.get("/auth/me", requireAuth, (req, res) => {
  const user = req.user;
  return res.json({
    success: true,
    data: {
      user: {
        nombre: user.nombre,
        rol: user.rol,
        usuario: user.usuario,
        colaboradorId: user.colaboradorId || void 0,
        cargo: user.cargo || void 0,
        departamento: user.departamento || void 0
      }
    }
  });
});
authRouter.get("/auth/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.usuario.findMany({
      where: { activo: true },
      select: { username: true, nombre: true, rol: true },
      orderBy: { nombre: "asc" }
    });
    res.json({ success: true, data: users.map((u) => ({ username: u.username, nombre: u.nombre, rol: mapDbRolToUi(u.rol) })) });
  } catch (e) {
    logger2.error("Error listando usuarios:", e);
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: e.message || "Error" } });
  }
});

// src/server/routes/users.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router2 } from "express";
var usersRouter = Router2();
usersRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.usuario.findMany({ orderBy: { createdAt: "desc" } });
    const safeUsers = users.map((u) => ({ id: u.id, username: u.username, nombre: u.nombre, email: u.email, rol: mapDbRolToUi(u.rol), colaboradorId: u.colaboradorId, activo: u.activo, createdAt: u.createdAt }));
    return res.json({ success: true, data: safeUsers });
  } catch (err) {
    logger2.error("Error fetching users:", err);
    return res.status(500).json({ success: false, error: { message: "Error al obtener usuarios" } });
  }
});
usersRouter.post("/", requireAuth, requireAdmin, authLimiter, async (req, res) => {
  const { username, nombre, email, password, rol, colaboradorId } = req.body;
  if (!username || !nombre || !password || !rol) return res.status(400).json({ success: false, error: { message: "Datos obligatorios incompletos" } });
  if (!["Admin", "Operario", "Visor"].includes(rol)) return res.status(400).json({ success: false, error: { message: "Rol inv\xE1lido" } });
  const pwdValidation = PasswordComplexitySchema.safeParse(password);
  if (!pwdValidation.success) return res.status(400).json({ success: false, error: { message: pwdValidation.error.issues[0].message } });
  try {
    const existingUser = await prisma.usuario.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
    if (existingUser) return res.status(400).json({ success: false, error: { message: "El nombre de usuario ya est\xE1 registrado" } });
    if (colaboradorId) {
      const linkedUser = await prisma.usuario.findFirst({ where: { colaboradorId, activo: true } });
      if (linkedUser) return res.status(400).json({ success: false, error: { message: "Este colaborador ya tiene una cuenta activa vinculada" } });
    }
    const passwordHash = await hashPassword(password);
    const dbRol = mapUiRolToDb(rol);
    const newUser = await prisma.usuario.create({ data: { username: username.toLowerCase().trim(), nombre: nombre.trim(), email: email ? email.trim() : null, passwordHash, rol: dbRol, colaboradorId: colaboradorId || null, activo: true } });
    auditLog({ usuario: req.user?.usuario || "admin", accion: "create_user", recurso: `/api/users/${newUser.id}`, resultado: "success", ip: getClientIp(req) });
    return res.status(201).json({ success: true, data: { id: newUser.id, username: newUser.username, nombre: newUser.nombre, rol: mapDbRolToUi(newUser.rol), colaboradorId: newUser.colaboradorId } });
  } catch (err) {
    logger2.error("Error creating user:", err);
    return res.status(500).json({ success: false, error: { message: "Error al crear usuario" } });
  }
});
usersRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const hard = req.query.hard === "true";
  try {
    const user = await prisma.usuario.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: { message: "Usuario no encontrado" } });
    if (user.username.toLowerCase() === req.user?.usuario?.toLowerCase()) return res.status(400).json({ success: false, error: { message: "No puedes desactivar o eliminar tu propio usuario en sesi\xF3n" } });
    if (hard) {
      await prisma.usuario.delete({ where: { id } });
      userActiveCache.delete(user.username.toLowerCase());
      auditLog({ usuario: req.user?.usuario || "admin", accion: "delete_user_hard", recurso: `/api/users/${id}`, resultado: "success", ip: getClientIp(req) });
      return res.json({ success: true, message: "Usuario eliminado permanentemente de la base de datos" });
    }
    const updatedUser = await prisma.usuario.update({ where: { id }, data: { activo: !user.activo } });
    userActiveCache.delete(user.username.toLowerCase());
    auditLog({ usuario: req.user?.usuario || "admin", accion: updatedUser.activo ? "activate_user" : "deactivate_user", recurso: `/api/users/${id}`, resultado: "success", ip: getClientIp(req) });
    return res.json({ success: true, message: updatedUser.activo ? "Usuario activado con \xE9xito" : "Usuario desactivado con \xE9xito", data: { activo: updatedUser.activo } });
  } catch (err) {
    logger2.error("Error updating user active status:", err);
    return res.status(500).json({ success: false, error: { message: "Error al actualizar estado del usuario" } });
  }
});
usersRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, nombre, email, password, rol, colaboradorId } = req.body;
  try {
    const user = await prisma.usuario.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: { message: "Usuario no encontrado" } });
    const updateData = {};
    if (nombre) updateData.nombre = nombre.trim();
    if (email !== void 0) updateData.email = email ? email.trim() : null;
    if (rol) {
      if (!["Admin", "Operario", "Visor"].includes(rol)) return res.status(400).json({ success: false, error: { message: "Rol inv\xE1lido" } });
      updateData.rol = mapUiRolToDb(rol);
    }
    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      if (cleanUsername !== user.username) {
        const duplicate = await prisma.usuario.findFirst({ where: { username: { equals: cleanUsername, mode: "insensitive" } } });
        if (duplicate) return res.status(400).json({ success: false, error: { message: "El nombre de usuario ya est\xE1 registrado" } });
        updateData.username = cleanUsername;
      }
    }
    if (colaboradorId !== void 0) {
      const targetColaboradorId = colaboradorId || null;
      if (targetColaboradorId && targetColaboradorId !== user.colaboradorId) {
        const linked = await prisma.usuario.findFirst({ where: { colaboradorId: targetColaboradorId, activo: true, id: { not: id } } });
        if (linked) return res.status(400).json({ success: false, error: { message: "Este colaborador ya tiene una cuenta activa vinculada" } });
      }
      updateData.colaboradorId = targetColaboradorId;
    }
    if (password) {
      const pwdValidation = PasswordComplexitySchema.safeParse(password);
      if (!pwdValidation.success) return res.status(400).json({ success: false, error: { message: pwdValidation.error.issues[0].message } });
      updateData.passwordHash = await hashPassword(password);
    }
    const updatedUser = await prisma.usuario.update({ where: { id }, data: updateData });
    userActiveCache.delete(user.username.toLowerCase());
    if (updateData.username) userActiveCache.delete(updateData.username);
    auditLog({ usuario: req.user?.usuario || "admin", accion: "update_user", recurso: `/api/users/${id}`, resultado: "success", ip: getClientIp(req) });
    return res.json({ success: true, message: "Usuario actualizado con \xE9xito", data: { id: updatedUser.id, username: updatedUser.username, nombre: updatedUser.nombre, rol: mapDbRolToUi(updatedUser.rol), colaboradorId: updatedUser.colaboradorId } });
  } catch (err) {
    logger2.error("Error updating user:", err);
    return res.status(500).json({ success: false, error: { message: "Error al actualizar usuario" } });
  }
});

// src/server/routes/clientes.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router3 } from "express";
import crypto3 from "crypto";
var clientesRouter = Router3();
clientesRouter.post("/", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { nombre, codigo } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Nombre requerido" } });
  try {
    const cliente = await prisma.cliente.create({ data: { id: generateId("cli"), nombre: nombre.trim(), codigo: (codigo || nombre.substring(0, 4).toUpperCase()).trim(), fechaCreacion: /* @__PURE__ */ new Date() } });
    auditLog({ usuario: req.user.usuario, accion: "create_cliente", recurso: `/api/clientes/${cliente.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { ...cliente, tokenPortal: cliente.tokenPortal || null, fechaCreacion: cliente.fechaCreacion.toISOString().substring(0, 10) }, message: "Cliente creado" });
  } catch (error) {
    logger2.error("Error creating cliente:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear cliente" } });
  }
});
clientesRouter.put("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const { nombre, codigo, activarPortal, revocarPortal } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Nombre requerido" } });
  try {
    const existing = await prisma.cliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
    const data = { nombre: nombre.trim(), codigo: codigo ? codigo.trim() : existing.codigo };
    if (activarPortal === true && !existing.tokenPortal) data.tokenPortal = crypto3.randomUUID();
    if (revocarPortal === true && existing.tokenPortal) data.tokenPortal = null;
    const updated = await prisma.cliente.update({ where: { id }, data });
    auditLog({ usuario: req.user.usuario, accion: "update_cliente", recurso: `/api/clientes/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { ...updated, tokenPortal: updated.tokenPortal || null, fechaCreacion: updated.fechaCreacion.toISOString().substring(0, 10) }, message: "Cliente actualizado" });
  } catch (error) {
    logger2.error("Error updating cliente:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar cliente" } });
  }
});
clientesRouter.delete("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.cliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
    await prisma.cliente.delete({ where: { id } });
    auditLog({ usuario: req.user.usuario, accion: "delete_cliente", recurso: `/api/clientes/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Cliente eliminado" });
  } catch (error) {
    logger2.error("Error deleting cliente:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar cliente. Verific\xE1 que no tenga proyectos o registros asociados." } });
  }
});

// src/server/routes/proyectos.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router4 } from "express";
var proyectosRouter = Router4();
proyectosRouter.post("/", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(ProyectoSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para crear proyecto", details: validation.errors } });
  const { clienteId, nombre, estado, fechaInicio } = validation.data;
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return res.status(400).json({ success: false, error: { code: "INVALID_REFERENCE", message: "Cliente no encontrado" } });
    const existing = await prisma.proyecto.findFirst({ where: { clienteId, nombre: { equals: nombre.trim(), mode: "insensitive" } } });
    if (existing) return res.status(400).json({ success: false, error: { code: "DUPLICATE_NAME", message: "Ya existe un proyecto con ese nombre para este cliente" } });
    const estadoEnum = estado === "En Proceso" ? "EN_PROCESO" : estado === "Completado" ? "COMPLETADO" : "PENDIENTE";
    const proyecto = await prisma.proyecto.create({ data: { id: generateId("pro"), clienteId, nombre: nombre.trim(), estado: estadoEnum, fechaInicio: fechaInicio ? new Date(fechaInicio) : /* @__PURE__ */ new Date() } });
    auditLog({ usuario: req.user.usuario, accion: "create_proyecto", recurso: `/api/proyectos/${proyecto.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { ...proyecto, estado: proyecto.estado === "EN_PROCESO" ? "En Proceso" : proyecto.estado === "COMPLETADO" ? "Completado" : "Pendiente", fechaInicio: proyecto.fechaInicio.toISOString().substring(0, 10) }, message: "Proyecto creado" });
  } catch (error) {
    logger2.error("Error creating proyecto:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear proyecto" } });
  }
});
proyectosRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, estado, activo } = req.body;
  try {
    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) return res.status(404).json({ success: false, error: { message: "Proyecto no encontrado" } });
    const updateData = {};
    if (nombre !== void 0) updateData.nombre = nombre;
    if (activo !== void 0) updateData.activo = activo;
    if (estado !== void 0) {
      if (estado === "En Proceso") updateData.estado = "EN_PROCESO";
      else if (estado === "Completado") updateData.estado = "COMPLETADO";
      else if (estado === "Pendiente") updateData.estado = "PENDIENTE";
    }
    const updated = await prisma.proyecto.update({ where: { id }, data: updateData });
    auditLog({ usuario: req.user?.usuario || "admin", accion: "update_proyecto", recurso: `/api/proyectos/${id}`, resultado: "success", ip: getClientIp(req) });
    const estadoUI = updated.estado === "EN_PROCESO" ? "En Proceso" : updated.estado === "COMPLETADO" ? "Completado" : "Pendiente";
    res.json({ success: true, data: { id: updated.id, nombre: updated.nombre, activo: updated.activo, estado: estadoUI } });
  } catch (error) {
    logger2.error("Error al actualizar proyecto:", error);
    res.status(500).json({ success: false, error: { message: "Error interno del servidor" } });
  }
});
proyectosRouter.delete("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.proyecto.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Proyecto no encontrado" } });
    await prisma.proyecto.delete({ where: { id } });
    auditLog({ usuario: req.user.usuario, accion: "delete_proyecto", recurso: `/api/proyectos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Proyecto eliminado" });
  } catch (error) {
    logger2.error("Error deleting proyecto:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar proyecto. Verific\xE1 que no tenga registros asociados." } });
  }
});

// src/server/routes/colaboradores.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router5 } from "express";
import { Decimal } from "@prisma/client/runtime/library";
var colaboradoresRouter = Router5();
colaboradoresRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { nombre, rol, tarifaSugerida, crearAcceso, username, password, rolAcceso, email, ci, cargo, departamento, jefeInmediato } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Nombre requerido" } });
  if (crearAcceso) {
    if (!username || !password || !rolAcceso) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos de acceso incompletos" } });
    if (!["Admin", "Operario", "Visor"].includes(rolAcceso)) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Rol de acceso inv\xE1lido" } });
    const pwdValidation = PasswordComplexitySchema.safeParse(password);
    if (!pwdValidation.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: pwdValidation.error.issues[0].message } });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const colaborador = await tx.colaborador.create({ data: { id: generateId("col"), nombre: nombre.trim(), rol: rol?.trim() || null, tarifaSugerida: tarifaSugerida ? new Decimal(tarifaSugerida) : null, ci: ci?.trim() || null, cargo: cargo?.trim() || null, departamento: departamento?.trim() || null, jefeInmediato: jefeInmediato?.trim() || null } });
      let newUser = null;
      if (crearAcceso) {
        const cleanUser = username.toLowerCase().trim();
        const existingUser = await tx.usuario.findFirst({ where: { username: { equals: cleanUser, mode: "insensitive" } } });
        if (existingUser) throw new Error("El nombre de usuario ya est\xE1 registrado");
        const passwordHash = await hashPassword(password);
        const dbRol = mapUiRolToDb(rolAcceso);
        newUser = await tx.usuario.create({ data: { username: cleanUser, nombre: nombre.trim(), email: email ? email.trim() : null, passwordHash, rol: dbRol, colaboradorId: colaborador.id, activo: true } });
      }
      return { colaborador, usuario: newUser };
    });
    auditLog({ usuario: req.user.usuario, accion: "create_colaborador", recurso: `/api/colaboradores/${result.colaborador.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { ...result.colaborador, tarifaSugerida: result.colaborador.tarifaSugerida ? parseFloat(result.colaborador.tarifaSugerida.toString()) : 0, usuario: result.usuario ? { id: result.usuario.id, username: result.usuario.username, nombre: result.usuario.nombre, email: result.usuario.email, rol: mapDbRolToUi(result.usuario.rol), activo: result.usuario.activo } : null }, message: "Colaborador creado con \xE9xito" });
  } catch (error) {
    logger2.error("Error creating colaborador:", error);
    res.status(400).json({ success: false, error: { code: "CREATE_ERROR", message: error.message || "Error al crear colaborador" } });
  }
});
colaboradoresRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, rol, tarifaSugerida, hasAcceso, username, password, rolAcceso, email, activoAcceso, ci, cargo, departamento, jefeInmediato } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Nombre requerido" } });
  try {
    const existing = await prisma.colaborador.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Colaborador no encontrado" } });
    const result = await prisma.$transaction(async (tx) => {
      const updatedColaborador = await tx.colaborador.update({ where: { id }, data: { nombre: nombre.trim(), rol: rol?.trim() || existing.rol, tarifaSugerida: tarifaSugerida ? new Decimal(tarifaSugerida) : existing.tarifaSugerida, ci: ci?.trim() || existing.ci, cargo: cargo?.trim() || existing.cargo, departamento: departamento?.trim() || existing.departamento, jefeInmediato: jefeInmediato?.trim() || existing.jefeInmediato } });
      const existingUser = await tx.usuario.findFirst({ where: { colaboradorId: id } });
      let linkedUser = null;
      if (hasAcceso) {
        if (!username?.trim() || !rolAcceso) throw new Error("Datos de acceso incompletos");
        const cleanUser = username.toLowerCase().trim();
        if (existingUser) {
          if (cleanUser !== existingUser.username) {
            const dup = await tx.usuario.findFirst({ where: { username: { equals: cleanUser, mode: "insensitive" }, id: { not: existingUser.id } } });
            if (dup) throw new Error("El nombre de usuario ya est\xE1 registrado");
          }
          const updateData = { username: cleanUser, nombre: nombre.trim(), email: email ? email.trim() : null, rol: mapUiRolToDb(rolAcceso), activo: activoAcceso !== false };
          if (password) {
            const pwdValidation = PasswordComplexitySchema.safeParse(password);
            if (!pwdValidation.success) throw new Error(pwdValidation.error.issues[0].message);
            updateData.passwordHash = await hashPassword(password);
          }
          linkedUser = await tx.usuario.update({ where: { id: existingUser.id }, data: updateData });
          userActiveCache.delete(existingUser.username.toLowerCase());
          userActiveCache.delete(cleanUser);
        } else {
          if (!password) throw new Error("La contrase\xF1a es obligatoria para el nuevo acceso");
          const pwdValidation = PasswordComplexitySchema.safeParse(password);
          if (!pwdValidation.success) throw new Error(pwdValidation.error.issues[0].message);
          const dup = await tx.usuario.findFirst({ where: { username: { equals: cleanUser, mode: "insensitive" } } });
          if (dup) throw new Error("El nombre de usuario ya est\xE1 registrado");
          const passwordHash = await hashPassword(password);
          linkedUser = await tx.usuario.create({ data: { username: cleanUser, nombre: nombre.trim(), email: email ? email.trim() : null, passwordHash, rol: mapUiRolToDb(rolAcceso), colaboradorId: id, activo: true } });
        }
      } else {
        if (existingUser) {
          await tx.usuario.delete({ where: { id: existingUser.id } });
          userActiveCache.delete(existingUser.username.toLowerCase());
        }
      }
      return { colaborador: updatedColaborador, usuario: linkedUser };
    });
    auditLog({ usuario: req.user.usuario, accion: "update_colaborador", recurso: `/api/colaboradores/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { ...result.colaborador, tarifaSugerida: result.colaborador.tarifaSugerida ? parseFloat(result.colaborador.tarifaSugerida.toString()) : 0, usuario: result.usuario ? { id: result.usuario.id, username: result.usuario.username, nombre: result.usuario.nombre, email: result.usuario.email, rol: mapDbRolToUi(result.usuario.rol), activo: result.usuario.activo } : null }, message: "Colaborador actualizado con \xE9xito" });
  } catch (error) {
    logger2.error("Error updating colaborador:", error);
    res.status(400).json({ success: false, error: { code: "UPDATE_ERROR", message: error.message || "Error al actualizar colaborador" } });
  }
});
colaboradoresRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.colaborador.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Colaborador no encontrado" } });
    await prisma.$transaction(async (tx) => {
      const linkedUser = await tx.usuario.findFirst({ where: { colaboradorId: id } });
      if (linkedUser) {
        await tx.usuario.delete({ where: { id: linkedUser.id } });
        userActiveCache.delete(linkedUser.username.toLowerCase());
      }
      await tx.colaborador.delete({ where: { id } });
    });
    auditLog({ usuario: req.user.usuario, accion: "delete_colaborador", recurso: `/api/colaboradores/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Colaborador eliminado" });
  } catch (error) {
    logger2.error("Error deleting colaborador:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar colaborador." } });
  }
});

// src/server/routes/sucursales.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router6 } from "express";
var sucursalesRouter = Router6();
sucursalesRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clienteId } = req.query;
    const where = {};
    if (clienteId) where.clienteId = String(clienteId);
    const sucursales = await prisma.sucursal.findMany({ where, orderBy: { nombre: "asc" }, include: { cliente: { select: { nombre: true } } } });
    res.json({ success: true, data: sucursales.map((s) => ({ id: s.id, clienteId: s.clienteId, clienteNombre: s.cliente.nombre, nombre: s.nombre, ciudad: s.ciudad, activo: s.activo })) });
  } catch (error) {
    logger2.error("[SUCURSALES] Error listing:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar sucursales" } });
  }
});
sucursalesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { clienteId, nombre, ciudad } = req.body || {};
  const nombreLimpio = String(nombre || "").trim().slice(0, 100);
  if (!clienteId || !nombreLimpio) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Cliente y nombre son requeridos" } });
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
    const sucursal = await prisma.sucursal.create({ data: { id: generateId("suc"), clienteId, nombre: nombreLimpio, ciudad: ciudad ? String(ciudad).trim().slice(0, 100) : null } });
    auditLog({ usuario: req.user.usuario, accion: "create_sucursal", recurso: `/api/admin/sucursales/${sucursal.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { id: sucursal.id, clienteId, nombre: sucursal.nombre, ciudad: sucursal.ciudad, activo: true }, message: "Sucursal creada" });
  } catch (error) {
    logger2.error("[SUCURSALES] Error creating:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear sucursal" } });
  }
});
sucursalesRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, ciudad, activo } = req.body || {};
  try {
    const existing = await prisma.sucursal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Sucursal no encontrada" } });
    const data = {};
    if (nombre !== void 0) data.nombre = String(nombre).trim().slice(0, 100);
    if (ciudad !== void 0) data.ciudad = ciudad ? String(ciudad).trim().slice(0, 100) : null;
    if (activo !== void 0) data.activo = Boolean(activo);
    const updated = await prisma.sucursal.update({ where: { id }, data });
    auditLog({ usuario: req.user.usuario, accion: "update_sucursal", recurso: `/api/admin/sucursales/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { id: updated.id, clienteId: updated.clienteId, nombre: updated.nombre, ciudad: updated.ciudad, activo: updated.activo }, message: "Sucursal actualizada" });
  } catch (error) {
    logger2.error("[SUCURSALES] Error updating:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar sucursal" } });
  }
});
sucursalesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.sucursal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Sucursal no encontrada" } });
    await prisma.sucursal.update({ where: { id }, data: { activo: false } });
    auditLog({ usuario: req.user.usuario, accion: "delete_sucursal", recurso: `/api/admin/sucursales/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Sucursal desactivada" });
  } catch (error) {
    logger2.error("[SUCURSALES] Error deleting:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al desactivar sucursal" } });
  }
});

// server.ts
init_pedidos_routes();

// src/server/routes/portal.routes.ts
init_prisma();
init_server_audit();
init_logger();
import { Router as Router8 } from "express";
import { Decimal as Decimal3 } from "@prisma/client/runtime/library";
init_shared();
var portalRouter = Router8();
portalRouter.get("/:token", portalLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 8) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido" } });
  try {
    const cliente = await prisma.cliente.findUnique({ where: { tokenPortal: token } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido o expirado" } });
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10));
    const skip = (page - 1) * limit;
    const { search, estado, sucursalId } = req.query;
    const wherePedidos = { clienteId: cliente.id, archivado: false };
    if (estado && typeof estado === "string") {
      wherePedidos.estado = estado;
    }
    if (sucursalId && typeof sucursalId === "string") {
      wherePedidos.sucursalId = sucursalId;
    }
    if (search && typeof search === "string" && search.trim()) {
      wherePedidos.OR = [
        { descripcion: { contains: search.trim(), mode: "insensitive" } },
        { sucursalNombre: { contains: search.trim(), mode: "insensitive" } },
        { facturaNumero: { contains: search.trim(), mode: "insensitive" } }
      ];
    }
    const [sucursales, pedidos, total] = await Promise.all([
      prisma.sucursal.findMany({ where: { clienteId: cliente.id, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
      prisma.pedido.findMany({
        where: wherePedidos,
        orderBy: { fechaSolicitud: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          sucursalNombre: true,
          descripcion: true,
          cantidad: true,
          estado: true,
          prioridad: true,
          fotoUrl: true,
          fechaSolicitud: true,
          fechaFin: true,
          facturaNumero: true,
          fotoRemisionUrl: true,
          fotoEntregaUrl: true,
          fechaEntrega: true,
          receptorNombre: true
        }
      }),
      prisma.pedido.count({ where: wherePedidos })
    ]);
    res.json({
      success: true,
      data: {
        cliente: { id: cliente.id, nombre: cliente.nombre },
        sucursales: sucursales.map((l) => ({ id: l.id, nombre: l.nombre })),
        pedidos: pedidos.map((p) => ({
          id: p.id,
          local: p.sucursalNombre,
          descripcion: p.descripcion,
          cantidad: Number(p.cantidad),
          estado: p.estado,
          prioridad: p.prioridad,
          fotoUrl: p.fotoUrl,
          fechaSolicitud: p.fechaSolicitud,
          fechaFin: p.fechaFin,
          facturaNumero: p.facturaNumero,
          fotoRemisionUrl: p.fotoRemisionUrl,
          fotoEntregaUrl: p.fotoEntregaUrl,
          fechaEntrega: p.fechaEntrega,
          receptorNombre: p.receptorNombre
        })),
        paginacion: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
      }
    });
  } catch (error) {
    logger2.error("[PORTAL] Error fetching portal data:", error);
    res.status(500).json({ success: false, error: { code: "PORTAL_ERROR", message: "Error al obtener el portal" } });
  }
});
portalRouter.post("/:token/sucursal", portalLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 8) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido" } });
  const { nombre, ciudad } = req.body || {};
  const nombreLimpio = String(nombre || "").trim().slice(0, 100);
  if (!nombreLimpio) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "El nombre del local es requerido" } });
  try {
    const cliente = await prisma.cliente.findUnique({ where: { tokenPortal: token } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido o expirado" } });
    const duplicado = await prisma.sucursal.findFirst({ where: { clienteId: cliente.id, nombre: { equals: nombreLimpio, mode: "insensitive" } } });
    if (duplicado) return res.status(400).json({ success: false, error: { code: "DUPLICADO", message: "Ese local ya existe" } });
    const sucursal = await prisma.sucursal.create({ data: { id: generateId("suc"), clienteId: cliente.id, nombre: nombreLimpio, ciudad: ciudad ? String(ciudad).trim().slice(0, 100) : null } });
    auditLog({ usuario: "portal:" + cliente.nombre, accion: "create_sucursal", recurso: `/api/portal/${token}/sucursal`, resultado: "success", ip: getClientIp(req), detalle: `Sucursal ${sucursal.id}: ${nombreLimpio}` });
    res.status(201).json({ success: true, data: { id: sucursal.id, nombre: sucursal.nombre, ciudad: sucursal.ciudad }, message: "Local creado correctamente" });
  } catch (error) {
    logger2.error("[PORTAL] Error creating sucursal:", error);
    res.status(500).json({ success: false, error: { code: "PORTAL_ERROR", message: "Error al crear el local" } });
  }
});
portalRouter.post("/:token/pedido", portalLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 8) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido" } });
  const { sucursalId, descripcion, cantidad, foto } = req.body || {};
  if (!sucursalId || !descripcion?.trim()) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Local y descripci\xF3n son requeridos" } });
  const cantNum = Number(cantidad);
  if (isNaN(cantNum) || cantNum <= 0) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "La cantidad debe ser mayor a 0" } });
  const descripcionLimpia = String(descripcion).trim().slice(0, 1e3);
  try {
    const cliente = await prisma.cliente.findUnique({ where: { tokenPortal: token } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido o expirado" } });
    const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, clienteId: cliente.id, activo: true } });
    if (!sucursal) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Local no v\xE1lido para este cliente" } });
    let fotoUrl;
    if (foto && typeof foto === "string" && foto.startsWith("data:image")) {
      const pedidoId = generateId("ped");
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const base64 = foto.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const storagePath = `pedidos/${pedidoId}/foto.jpg`;
        const { error } = await supabaseAdmin.storage.from("pedidos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
        if (!error) {
          const { data } = supabaseAdmin.storage.from("pedidos-fotos").getPublicUrl(storagePath);
          fotoUrl = data.publicUrl;
        }
      }
    }
    const pedido = await prisma.pedido.create({ data: { id: generateId("ped"), clienteId: cliente.id, sucursalId: sucursal.id, sucursalNombre: sucursal.nombre, descripcion: descripcionLimpia, cantidad: new Decimal3(cantNum), estado: "Pendiente", fotoUrl } });
    auditLog({ usuario: "portal:" + cliente.nombre, accion: "create_pedido", recurso: `/api/portal/${token}/pedido`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { id: pedido.id, local: pedido.sucursalNombre, descripcion: pedido.descripcion, cantidad: Number(pedido.cantidad), estado: pedido.estado }, message: "Pedido creado correctamente" });
  } catch (error) {
    logger2.error("[PORTAL] Error creating pedido:", error);
    res.status(500).json({ success: false, error: { code: "PORTAL_ERROR", message: "Error al crear el pedido" } });
  }
});
portalRouter.get("/:token/presupuestos", portalLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 8) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido" } });
  try {
    const cliente = await prisma.cliente.findUnique({ where: { tokenPortal: token } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido o expirado" } });
    const presupuestos = await prisma.presupuesto.findMany({
      where: { clienteId: cliente.id, estado: { in: ["Enviado", "Aprobado", "Rechazado"] } },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { orden: "asc" } } }
    });
    res.json({ success: true, data: presupuestos.map((p) => ({
      id: p.id,
      proyecto: p.proyecto,
      contacto: p.contacto,
      fechaInicio: p.fechaInicio,
      fechaTope: p.fechaTope,
      estado: p.estado,
      total: Number(p.total),
      // markup y costoTotal son internos — no se exponen al cliente del portal
      venta1: p.venta1 != null ? Number(p.venta1) : null,
      venta2: p.venta2 != null ? Number(p.venta2) : null,
      comentarioCliente: p.comentarioCliente,
      respuestaCliente: p.respuestaCliente,
      fotos: p.fotos || [],
      fechaEnvio: p.fechaEnvio,
      fechaRespuesta: p.fechaRespuesta,
      createdAt: p.createdAt,
      items: p.items.map((it) => ({
        id: it.id,
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precioUnitario: Number(it.precioUnitario),
        total: Number(it.total),
        categoria: it.categoria || "Insumo",
        horas: it.horas != null ? Number(it.horas) : null,
        tarifa: it.tarifa != null ? Number(it.tarifa) : null
      }))
    })) });
  } catch (error) {
    logger2.error("[PORTAL] Error fetching presupuestos:", error);
    res.status(500).json({ success: false, error: { code: "PORTAL_ERROR", message: "Error al obtener presupuestos" } });
  }
});
portalRouter.post("/:token/presupuestos/:id/responder", portalLimiter, async (req, res) => {
  const { token, id } = req.params;
  const { respuesta, comentario } = req.body || {};
  if (!token || typeof token !== "string" || token.length < 8) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido" } });
  if (!respuesta || !["Aprobado", "Rechazado"].includes(respuesta)) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "respuesta debe ser 'Aprobado' o 'Rechazado'" } });
  }
  try {
    const cliente = await prisma.cliente.findUnique({ where: { tokenPortal: token } });
    if (!cliente) return res.status(404).json({ success: false, error: { code: "PORTAL_NOT_FOUND", message: "Link no v\xE1lido o expirado" } });
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    if (existing.clienteId !== cliente.id) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Este presupuesto no pertenece a su cuenta" } });
    if (existing.estado !== "Enviado") return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Este presupuesto ya fue respondido" } });
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        estado: respuesta,
        respuestaCliente: comentario || null,
        fechaRespuesta: /* @__PURE__ */ new Date()
      }
    });
    if (respuesta === "Aprobado" && existing.pedidoId) {
      await prisma.pedido.updateMany({
        where: { id: existing.pedidoId, estado: "Pendiente" },
        data: { estado: "En Proceso" }
      });
    }
    auditLog({ usuario: "portal:" + cliente.nombre, accion: "respond_presupuesto", recurso: `/api/portal/${token}/presupuestos/${id}/responder`, resultado: "success", ip: getClientIp(req), detalle: `Respuesta: ${respuesta}` });
    res.json({ success: true, data: { id: updated.id, estado: updated.estado }, message: respuesta === "Aprobado" ? "Presupuesto aprobado" : "Presupuesto rechazado" });
  } catch (error) {
    logger2.error("[PORTAL] Error responding presupuesto:", error);
    res.status(500).json({ success: false, error: { code: "PORTAL_ERROR", message: "Error al responder presupuesto" } });
  }
});

// src/server/routes/timer.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router9 } from "express";
import { Decimal as Decimal4 } from "@prisma/client/runtime/library";
var timerRouter = Router9();
timerRouter.post("/start", requireAuth, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(TimerStartSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para iniciar timer", details: validation.errors } });
  const { usuario, colaboradorId, clienteId, proyectoId, descripcion, precioUnitario } = validation.data;
  const clientIp = getClientIp(req);
  try {
    await prisma.timerActivo.updateMany({ where: { usuario, activo: true }, data: { activo: false, updatedAt: /* @__PURE__ */ new Date() } });
    const now = /* @__PURE__ */ new Date();
    const newTimer = await prisma.timerActivo.create({ data: { id: generateId("timer"), usuario, colaboradorId: colaboradorId || null, clienteId, proyectoId, descripcion, precioUnitario: new Decimal4(precioUnitario), inicio: now, activo: true, ultimaActualizacion: now, pausedTime: 0, pauseHistory: [], isPaused: false } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "timer_start", recurso: `/api/timer/${newTimer.id}`, resultado: "success", ip: clientIp });
    res.json({ success: true, data: { ...newTimer, precioUnitario: parseFloat(newTimer.precioUnitario.toString()), inicio: newTimer.inicio.toISOString(), ultimaActualizacion: newTimer.ultimaActualizacion.toISOString(), pauseHistory: newTimer.pauseHistory, currentPauseStart: newTimer.currentPauseStart?.toISOString() } });
  } catch (error) {
    logger2.error("Error starting timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_START_ERROR", message: "No se pudo iniciar el timer: " + error.message } });
  }
});
timerRouter.post("/stop", requireAuth, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(TimerStopSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para detener timer", details: validation.errors } });
  const { usuario, pausedTime, pauseHistory } = validation.data;
  const clientIp = getClientIp(req);
  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });
    if (!activeTimer) return res.status(404).json({ success: false, error: { code: "NO_ACTIVE_TIMER", message: "No hay timer activo para este usuario" } });
    const fin = /* @__PURE__ */ new Date();
    const duracionBruta = Math.floor((fin.getTime() - activeTimer.inicio.getTime()) / 1e3);
    let adjustedPausedTime = activeTimer.pausedTime ?? 0;
    let adjustedPauseHistory = activeTimer.pauseHistory ?? [];
    if (activeTimer.isPaused && activeTimer.currentPauseStart) {
      const currentPauseDuration = Math.floor((fin.getTime() - activeTimer.currentPauseStart.getTime()) / 1e3);
      adjustedPausedTime += currentPauseDuration;
      adjustedPauseHistory.push({ start: activeTimer.currentPauseStart.toISOString(), end: fin.toISOString(), duration: currentPauseDuration, tipo: activeTimer.currentPauseType || "descanso" });
    }
    const duracionSegundos = duracionBruta - adjustedPausedTime;
    await prisma.timerActivo.update({ where: { id: activeTimer.id }, data: { activo: false, pausedTime: adjustedPausedTime, pauseHistory: adjustedPauseHistory, isPaused: false, currentPauseStart: null, currentPauseType: null, ultimaActualizacion: fin } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "timer_stop", recurso: `/api/timer/${activeTimer.id}`, resultado: "success", ip: clientIp, detalle: `duracionSegundos=${duracionSegundos}, duracionBruta=${duracionBruta}, pausedTime=${adjustedPausedTime}` });
    res.json({ success: true, data: { timer: { ...activeTimer, activo: false }, duracionSegundos, duracionBruta, pausedTime: adjustedPausedTime, pauseHistory: adjustedPauseHistory, inicio: activeTimer.inicio.toISOString(), fin: fin.toISOString() } });
  } catch (error) {
    logger2.error("Error stopping timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_STOP_ERROR", message: "No se pudo detener el timer: " + error.message } });
  }
});
timerRouter.post("/pause", requireAuth, async (req, res) => {
  const validation = validateSchema(TimerPauseSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para pausar timer", details: validation.errors } });
  const { usuario, tipo } = validation.data;
  const pauseType = tipo || "descanso";
  const clientIp = getClientIp(req);
  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });
    if (!activeTimer) return res.status(404).json({ success: false, error: { code: "NO_ACTIVE_TIMER", message: "No hay timer activo para este usuario" } });
    if (activeTimer.isPaused) return res.status(400).json({ success: false, error: { code: "TIMER_ALREADY_PAUSED", message: "El timer ya est\xE1 pausado" } });
    const now = /* @__PURE__ */ new Date();
    const updated = await prisma.timerActivo.update({ where: { id: activeTimer.id }, data: { isPaused: true, currentPauseStart: now, currentPauseType: pauseType, ultimaActualizacion: now } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "timer_pause", recurso: `/api/timer/${activeTimer.id}`, resultado: "success", ip: clientIp, detalle: `tipo=${pauseType}` });
    res.json({ success: true, data: { ...updated, precioUnitario: parseFloat(updated.precioUnitario.toString()), inicio: updated.inicio.toISOString(), ultimaActualizacion: updated.ultimaActualizacion.toISOString(), currentPauseStart: updated.currentPauseStart?.toISOString(), currentPauseType: updated.currentPauseType, pauseHistory: updated.pauseHistory } });
  } catch (error) {
    logger2.error("Error pausing timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_PAUSE_ERROR", message: "No se pudo pausar el timer: " + error.message } });
  }
});
timerRouter.post("/resume", requireAuth, async (req, res) => {
  const validation = validateSchema(TimerResumeSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para reanudar timer", details: validation.errors } });
  const { usuario } = validation.data;
  const clientIp = getClientIp(req);
  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });
    if (!activeTimer) return res.status(404).json({ success: false, error: { code: "NO_ACTIVE_TIMER", message: "No hay timer activo para este usuario" } });
    if (!activeTimer.isPaused) return res.status(400).json({ success: false, error: { code: "TIMER_NOT_PAUSED", message: "El timer no est\xE1 pausado" } });
    const now = /* @__PURE__ */ new Date();
    const pauseDuration = activeTimer.currentPauseStart ? Math.floor((now.getTime() - activeTimer.currentPauseStart.getTime()) / 1e3) : 0;
    const newPausedTime = (activeTimer.pausedTime || 0) + pauseDuration;
    const pauseType = activeTimer.currentPauseType || "descanso";
    const newPauseHistory = [...activeTimer.pauseHistory || [], {
      start: activeTimer.currentPauseStart?.toISOString(),
      end: now.toISOString(),
      duration: pauseDuration,
      tipo: pauseType
    }];
    const updated = await prisma.timerActivo.update({ where: { id: activeTimer.id }, data: { isPaused: false, currentPauseStart: null, currentPauseType: null, pausedTime: newPausedTime, pauseHistory: newPauseHistory, ultimaActualizacion: now } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "timer_resume", recurso: `/api/timer/${activeTimer.id}`, resultado: "success", ip: clientIp, detalle: `pauseDuration=${pauseDuration}, tipo=${pauseType}, totalPaused=${newPausedTime}` });
    res.json({ success: true, data: { ...updated, precioUnitario: parseFloat(updated.precioUnitario.toString()), inicio: updated.inicio.toISOString(), ultimaActualizacion: updated.ultimaActualizacion.toISOString(), currentPauseStart: updated.currentPauseStart?.toISOString(), pauseHistory: updated.pauseHistory, pausedTime: updated.pausedTime } });
  } catch (error) {
    logger2.error("Error resuming timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_RESUME_ERROR", message: "No se pudo reanudar el timer: " + error.message } });
  }
});
timerRouter.get("/active/:usuario", requireAuth, async (req, res) => {
  try {
    const { usuario } = req.params;
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });
    if (!activeTimer) return res.json({ success: true, data: null });
    res.json({ success: true, data: { ...activeTimer, precioUnitario: parseFloat(activeTimer.precioUnitario.toString()), inicio: activeTimer.inicio.toISOString(), ultimaActualizacion: activeTimer.ultimaActualizacion.toISOString(), currentPauseStart: activeTimer.currentPauseStart?.toISOString(), currentPauseType: activeTimer.currentPauseType, pauseHistory: activeTimer.pauseHistory, pausedTime: activeTimer.pausedTime } });
  } catch (error) {
    logger2.error("Error fetching active timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_FETCH_ERROR", message: "No se pudo obtener el timer activo: " + error.message } });
  }
});
timerRouter.post("/sync", requireAuth, async (req, res) => {
  const validation = validateSchema(TimerSyncSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para sincronizar timer", details: validation.errors } });
  const { usuario } = validation.data;
  try {
    const activeTimer = await prisma.timerActivo.findFirst({ where: { usuario, activo: true } });
    if (!activeTimer) return res.json({ success: true, data: { activo: false, message: "Timer no encontrado o detenido" } });
    const updated = await prisma.timerActivo.update({ where: { id: activeTimer.id }, data: { ultimaActualizacion: /* @__PURE__ */ new Date() } });
    res.json({ success: true, data: { ...updated, precioUnitario: parseFloat(updated.precioUnitario.toString()), inicio: updated.inicio.toISOString(), ultimaActualizacion: updated.ultimaActualizacion.toISOString(), currentPauseStart: updated.currentPauseStart?.toISOString(), currentPauseType: updated.currentPauseType, pauseHistory: updated.pauseHistory, pausedTime: updated.pausedTime, isPaused: updated.isPaused } });
  } catch (error) {
    logger2.error("Error syncing timer", error);
    res.status(500).json({ success: false, error: { code: "TIMER_SYNC_ERROR", message: "No se pudo sincronizar el timer: " + error.message } });
  }
});

// src/server/routes/viaje.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router10 } from "express";
import { Decimal as Decimal5 } from "@prisma/client/runtime/library";
import fs3 from "fs";
import path3 from "path";
var viajeRouter = Router10();
function calcularDistanciaHaversine(origen, destino) {
  const R = 6371;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(destino.lat - origen.lat);
  const dLng = toRad(destino.lng - origen.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(origen.lat)) * Math.cos(toRad(destino.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
async function guardarFotosVehiculo(registroId, fotoBase64Inicio, fotoBase64Fin) {
  const isUrlOrPath = (str) => !str || str.startsWith("http") || str.startsWith("/uploads");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const uploadFoto = async (dataUrl, nombre) => {
      if (isUrlOrPath(dataUrl)) return dataUrl || "";
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const storagePath = `vehiculos/${registroId}/${nombre}.jpg`;
      const { error } = await supabaseAdmin.storage.from("vehiculos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
      const { data } = supabaseAdmin.storage.from("vehiculos-fotos").getPublicUrl(storagePath);
      return data.publicUrl;
    };
    return { inicio: await uploadFoto(fotoBase64Inicio, "odometro_inicio"), fin: await uploadFoto(fotoBase64Fin, "odometro_fin") };
  }
  const uploadsDir = path3.join(process.cwd(), "uploads", "vehiculos", registroId);
  const processLocalFoto = async (dataUrl, filename, relativePath) => {
    if (isUrlOrPath(dataUrl)) return dataUrl || "";
    await fs3.promises.mkdir(uploadsDir, { recursive: true });
    const raw = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    await fs3.promises.writeFile(path3.join(uploadsDir, filename), raw, "base64");
    return relativePath;
  };
  return {
    inicio: await processLocalFoto(fotoBase64Inicio, "odometro_inicio.jpg", `/uploads/vehiculos/${registroId}/odometro_inicio.jpg`),
    fin: await processLocalFoto(fotoBase64Fin, "odometro_fin.jpg", `/uploads/vehiculos/${registroId}/odometro_fin.jpg`)
  };
}
viajeRouter.post("/start", requireAuth, requireWriteAccess, async (req, res) => {
  const clientIp = getClientIp(req);
  const validation = validateSchema(ViajeStartSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para iniciar viaje", details: validation.errors } });
  const { usuario, ubicacionInicio, clienteId, proyectoId, descripcion, fotoOdometroInicio, kmInicial } = validation.data;
  try {
    const viajeExistente = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });
    if (viajeExistente) return res.status(400).json({ success: false, error: { code: "VIAJE_ACTIVO", message: "Ya ten\xE9s un viaje activo" } });
    const esParticular = clienteId === "viaje_particular" || proyectoId === "viaje_particular";
    if (!esParticular) {
      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) return res.status(400).json({ success: false, error: { code: "CLIENTE_NOT_FOUND", message: "El cliente seleccionado no existe o fue eliminado." } });
      const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
      if (!proyecto) return res.status(400).json({ success: false, error: { code: "PROYECTO_NOT_FOUND", message: "El proyecto seleccionado no existe o fue eliminado." } });
    }
    const nuevoViaje = await prisma.viajeActivo.create({
      data: {
        id: `viaje_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        usuario,
        clienteId,
        proyectoId,
        inicio: /* @__PURE__ */ new Date(),
        ubicacionInicio,
        fotoOdometroInicio: fotoOdometroInicio || "",
        kmInicial: new Decimal5(kmInicial),
        descripcion: descripcion || "Viaje en veh\xEDculo",
        activo: true
      }
    });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "viaje_start", recurso: `/api/viaje/${nuevoViaje.id}`, detalle: `proyectoId=${proyectoId}, clienteId=${clienteId}, kmInicial=${kmInicial}`, resultado: "success", ip: clientIp });
    res.json({ success: true, data: { ...nuevoViaje, kmInicial: parseFloat(nuevoViaje.kmInicial.toString()), inicio: nuevoViaje.inicio.toISOString() } });
  } catch (error) {
    logger2.error("Error starting viaje", error);
    res.status(500).json({ success: false, error: { code: "VIAJE_START_ERROR", message: "No se pudo iniciar el viaje: " + error.message } });
  }
});
viajeRouter.post("/cancel", requireAuth, requireWriteAccess, async (req, res) => {
  const { usuario } = req.body;
  if (!usuario) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Usuario requerido" } });
  try {
    const viajeActivo = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });
    if (!viajeActivo) return res.json({ success: true, data: { message: "No hab\xEDa viaje activo" } });
    await prisma.viajeActivo.update({ where: { id: viajeActivo.id }, data: { activo: false } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "viaje_cancel", recurso: `/api/viaje/${viajeActivo.id}`, detalle: "Viaje cancelado sin guardar", resultado: "success", ip: getClientIp(req) });
    return res.json({ success: true, data: { message: "Viaje cancelado" } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { code: "VIAJE_CANCEL_ERROR", message: error.message } });
  }
});
viajeRouter.post("/stop", requireAuth, requireWriteAccess, async (req, res) => {
  const clientIp = getClientIp(req);
  const validation = validateSchema(ViajeStopSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para finalizar viaje", details: validation.errors } });
  const { usuario, ubicacionFin, fotoOdometroFin, kmFinal, combustibleLitros, combustibleCosto, descripcion } = validation.data;
  try {
    const viajeActivo = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });
    if (!viajeActivo) return res.status(400).json({ success: false, error: { code: "NO_VIAJE_ACTIVO", message: "No hay viaje activo" } });
    const kmInicialNum = parseFloat(viajeActivo.kmInicial.toString());
    const ubicacionInicioGPS = viajeActivo.ubicacionInicio;
    const distanciaGPS = ubicacionInicioGPS?.lat != null && ubicacionInicioGPS?.lng != null && ubicacionFin?.lat != null && ubicacionFin?.lng != null ? calcularDistanciaHaversine(ubicacionInicioGPS, ubicacionFin) : null;
    const distanciaOdometro = kmFinal - kmInicialNum;
    const diferencia = distanciaGPS != null ? Math.abs(distanciaOdometro - distanciaGPS) : 0;
    const discrepanciaPorcentaje = distanciaGPS != null && distanciaGPS > 0 && distanciaOdometro > 0 ? diferencia / distanciaGPS * 100 : 0;
    const alertaDiscrepancia = discrepanciaPorcentaje > 20;
    const discrepanciaGuardada = Math.min(Math.round(discrepanciaPorcentaje * 10) / 10, 999.9);
    const consumoPorKm = combustibleLitros && distanciaOdometro > 0 ? Math.round(combustibleLitros / distanciaOdometro * 100) / 100 : void 0;
    const fin = /* @__PURE__ */ new Date();
    const duracionMinutos = Math.floor((fin.getTime() - viajeActivo.inicio.getTime()) / 6e4);
    const registroId = `regveh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fotosGuardadas = await guardarFotosVehiculo(registroId, viajeActivo.fotoOdometroInicio, fotoOdometroFin);
    const esParticular = viajeActivo.clienteId === "viaje_particular" || viajeActivo.proyectoId === "viaje_particular";
    const [cliente, proyecto] = esParticular ? [null, null] : await Promise.all([
      prisma.cliente.findUnique({ where: { id: viajeActivo.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: viajeActivo.proyectoId } })
    ]);
    const registroVehiculo = await prisma.registroVehiculo.create({
      data: {
        id: registroId,
        usuario: viajeActivo.usuario,
        clienteId: viajeActivo.clienteId,
        clienteNombre: esParticular ? "Viaje Particular" : cliente?.nombre || "",
        proyectoId: viajeActivo.proyectoId,
        proyectoNombre: esParticular ? "Uso Personal" : proyecto?.nombre || "",
        fecha: fin,
        kmInicial: viajeActivo.kmInicial,
        kmFinal: new Decimal5(kmFinal),
        distanciaOdometro: new Decimal5(Math.round(distanciaOdometro * 10) / 10),
        distanciaGPS: distanciaGPS != null ? new Decimal5(Math.round(distanciaGPS * 10) / 10) : null,
        combustibleLitros: combustibleLitros ? new Decimal5(combustibleLitros) : null,
        combustibleCosto: new Decimal5(combustibleCosto),
        total: new Decimal5(combustibleCosto),
        descripcion: descripcion || viajeActivo.descripcion,
        alertaDiscrepancia,
        discrepancia: new Decimal5(discrepanciaGuardada),
        ubicacionInicio: viajeActivo.ubicacionInicio,
        ubicacionFin,
        fotoOdometroInicio: fotosGuardadas.inicio,
        fotoOdometroFin: fotosGuardadas.fin,
        horaInicio: new Date(viajeActivo.inicio).toLocaleTimeString("es-AR", { hour12: false }),
        horaFin: fin.toLocaleTimeString("es-AR", { hour12: false }),
        duracionMinutos,
        consumoPorKm: consumoPorKm ? new Decimal5(consumoPorKm) : null,
        origen: "MANUAL",
        fechaImportacion: fin
      }
    });
    await prisma.viajeActivo.update({ where: { id: viajeActivo.id }, data: { activo: false } });
    auditLog({ usuario: req.user?.usuario || usuario, accion: "viaje_stop", recurso: `/api/viaje/${viajeActivo.id}`, detalle: `proyectoId=${viajeActivo.proyectoId}, distanciaGPS=${distanciaGPS != null ? distanciaGPS.toFixed(1) : "N/A"}, distanciaOdometro=${distanciaOdometro.toFixed(1)}, discrepancia=${discrepanciaPorcentaje.toFixed(1)}%, alerta=${alertaDiscrepancia}`, resultado: "success", ip: clientIp });
    res.json({
      success: true,
      data: {
        ...registroVehiculo,
        kmInicial: parseFloat(registroVehiculo.kmInicial.toString()),
        kmFinal: parseFloat(registroVehiculo.kmFinal.toString()),
        distanciaOdometro: parseFloat(registroVehiculo.distanciaOdometro.toString()),
        distanciaGPS: registroVehiculo.distanciaGPS ? parseFloat(registroVehiculo.distanciaGPS.toString()) : void 0,
        combustibleLitros: registroVehiculo.combustibleLitros ? parseFloat(registroVehiculo.combustibleLitros.toString()) : void 0,
        combustibleCosto: parseFloat(registroVehiculo.combustibleCosto.toString()),
        total: parseFloat(registroVehiculo.total.toString()),
        discrepancia: registroVehiculo.discrepancia ? parseFloat(registroVehiculo.discrepancia.toString()) : void 0,
        consumoPorKm: registroVehiculo.consumoPorKm ? parseFloat(registroVehiculo.consumoPorKm.toString()) : void 0,
        fecha: registroVehiculo.fecha.toISOString().substring(0, 10),
        fechaImportacion: registroVehiculo.fechaImportacion?.toISOString().substring(0, 10)
      },
      alertas: alertaDiscrepancia ? [{ tipo: "discrepancia", mensaje: `Diferencia de ${discrepanciaPorcentaje.toFixed(1)}% entre GPS y od\xF3metro` }] : []
    });
  } catch (error) {
    logger2.error("Error stopping viaje", error);
    res.status(500).json({ success: false, error: { code: "VIAJE_STOP_ERROR", message: "No se pudo finalizar el viaje: " + error.message } });
  }
});
viajeRouter.get("/active/:usuario", requireAuth, async (req, res) => {
  try {
    const { usuario } = req.params;
    if (req.user?.rol !== "Admin" && req.user?.usuario !== usuario) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "No autorizado" } });
    const viajeActivo = await prisma.viajeActivo.findFirst({ where: { usuario, activo: true } });
    if (!viajeActivo) return res.json({ success: true, data: null });
    res.json({ success: true, data: { ...viajeActivo, kmInicial: parseFloat(viajeActivo.kmInicial.toString()), inicio: viajeActivo.inicio.toISOString() } });
  } catch (error) {
    logger2.error("Error getting active viaje", error);
    res.status(500).json({ success: false, error: { code: "GET_VIAJE_ERROR", message: "Error al obtener viaje activo" } });
  }
});

// src/server/routes/vehiculo.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router11 } from "express";
import { Decimal as Decimal6 } from "@prisma/client/runtime/library";
import fs4 from "fs";
import path4 from "path";
var vehiculoRouter = Router11();
vehiculoRouter.get("/registros/:proyectoId", requireAuth, async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const registros = await prisma.registroVehiculo.findMany({ where: { proyectoId }, orderBy: { fecha: "desc" }, take: 10 });
    res.json({ success: true, data: registros.map((rv) => ({ ...rv, kmInicial: parseFloat(rv.kmInicial.toString()), kmFinal: parseFloat(rv.kmFinal.toString()), distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()), distanciaGPS: rv.distanciaGPS ? parseFloat(rv.distanciaGPS.toString()) : void 0, combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : void 0, combustibleCosto: parseFloat(rv.combustibleCosto.toString()), total: parseFloat(rv.total.toString()), discrepancia: rv.discrepancia ? parseFloat(rv.discrepancia.toString()) : void 0, consumoPorKm: rv.consumoPorKm ? parseFloat(rv.consumoPorKm.toString()) : void 0, fecha: rv.fecha.toISOString().substring(0, 10), fechaImportacion: rv.fechaImportacion?.toISOString().substring(0, 10) })) });
  } catch (error) {
    logger2.error("Error getting registros vehiculo", error);
    res.status(500).json({ success: false, error: { code: "GET_REGISTROS_ERROR", message: "Error al obtener registros" } });
  }
});
vehiculoRouter.get("/mis-registros", requireAuth, async (req, res) => {
  const userPayload = req.user;
  try {
    const whereClause = userPayload.rol === "Admin" ? {} : { usuario: userPayload.usuario };
    const registros = await prisma.registroVehiculo.findMany({ where: whereClause, orderBy: { fecha: "desc" } });
    res.json({ success: true, data: registros.map((rv) => ({ ...rv, kmInicial: parseFloat(rv.kmInicial.toString()), kmFinal: parseFloat(rv.kmFinal.toString()), distanciaOdometro: parseFloat(rv.distanciaOdometro.toString()), distanciaGPS: rv.distanciaGPS ? parseFloat(rv.distanciaGPS.toString()) : void 0, combustibleLitros: rv.combustibleLitros ? parseFloat(rv.combustibleLitros.toString()) : void 0, combustibleCosto: parseFloat(rv.combustibleCosto.toString()), total: parseFloat(rv.total.toString()), discrepancia: rv.discrepancia ? parseFloat(rv.discrepancia.toString()) : void 0, consumoPorKm: rv.consumoPorKm ? parseFloat(rv.consumoPorKm.toString()) : void 0, fecha: rv.fecha.toISOString().substring(0, 10), fechaImportacion: rv.fechaImportacion?.toISOString().substring(0, 10) })) });
  } catch (error) {
    logger2.error("Error reading user vehicle registros:", error);
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: "Error al leer registros de veh\xEDculo del usuario" } });
  }
});
vehiculoRouter.delete("/registro/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!id) return res.status(400).json({ success: false, error: { code: "MISSING_ID", message: "ID de registro requerido" } });
  try {
    const registro = await prisma.registroVehiculo.findUnique({ where: { id } });
    if (!registro) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Registro de veh\xEDculo no encontrado" } });
    await prisma.registroVehiculo.delete({ where: { id } });
    auditLog({ usuario: userPayload.usuario, accion: "delete_vehiculo_registro", recurso: `/api/vehiculo/registro/${id}`, resultado: "success", ip: clientIp, detalle: `Eliminado registro de veh\xEDculo: ${registro.proyectoNombre}` });
    res.json({ success: true, message: "Registro de veh\xEDculo eliminado con \xE9xito" });
  } catch (error) {
    logger2.error("Error deleting vehiculo registro:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar registro de veh\xEDculo" } });
  }
});
vehiculoRouter.put("/registro/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!id) return res.status(400).json({ success: false, error: { code: "MISSING_ID", message: "ID de registro requerido" } });
  const validation = validateSchema(RegistroVehiculoUpdateSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos del registro inv\xE1lidos", details: validation.errors } });
  const updatedData = validation.data;
  try {
    const existing = await prisma.registroVehiculo.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Registro de veh\xEDculo no encontrado" } });
    const distanciaOdometro = updatedData.kmFinal - updatedData.kmInicial;
    const existingDistanciaGPS = existing.distanciaGPS ? parseFloat(existing.distanciaGPS.toString()) : distanciaOdometro;
    const discrepancia = existingDistanciaGPS > 0 ? Math.abs((distanciaOdometro - existingDistanciaGPS) / existingDistanciaGPS) * 100 : 0;
    const alertaDiscrepancia = discrepancia > 20;
    const total = updatedData.total;
    const updated = await prisma.registroVehiculo.update({ where: { id }, data: { kmInicial: new Decimal6(updatedData.kmInicial), kmFinal: new Decimal6(updatedData.kmFinal), distanciaOdometro: new Decimal6(Math.round(distanciaOdometro * 10) / 10), combustibleCosto: new Decimal6(total), total: new Decimal6(total), discrepancia: new Decimal6(Math.round(discrepancia * 10) / 10), alertaDiscrepancia, descripcion: updatedData.descripcion, fecha: updatedData.fecha ? new Date(updatedData.fecha) : existing.fecha } });
    auditLog({ usuario: userPayload.usuario, accion: "update_vehiculo_registro", recurso: `/api/vehiculo/registro/${id}`, resultado: "success", ip: clientIp });
    res.json({ success: true, data: { ...updated, kmInicial: parseFloat(updated.kmInicial.toString()), kmFinal: parseFloat(updated.kmFinal.toString()), distanciaOdometro: parseFloat(updated.distanciaOdometro.toString()), combustibleCosto: parseFloat(updated.combustibleCosto.toString()), total: parseFloat(updated.total.toString()), fecha: updated.fecha.toISOString().substring(0, 10) }, message: "Registro de veh\xEDculo actualizado con \xE9xito" });
  } catch (error) {
    logger2.error("Error updating vehiculo registro:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar registro de veh\xEDculo" } });
  }
});
vehiculoRouter.patch("/registro/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  logger2.info("[PATCH VEHICULO] Request received, ID:", id, "User:", userPayload.usuario);
  if (!id) return res.status(400).json({ success: false, error: { code: "MISSING_ID", message: "ID de registro requerido" } });
  const validation = validateSchema(RegistroVehiculoPatchSchema, req.body);
  if (!validation.valid) {
    logger2.error("[PATCH VEHICULO] Validation errors:", JSON.stringify(validation.errors));
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos del registro inv\xE1lidos", details: validation.errors } });
  }
  const patchData = validation.data;
  try {
    const existing = await prisma.registroVehiculo.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Registro de veh\xEDculo no encontrado" } });
    const kmInicial = patchData.kmInicial ?? parseFloat(existing.kmInicial.toString());
    const kmFinal = patchData.kmFinal ?? parseFloat(existing.kmFinal.toString());
    const distanciaOdometro = kmFinal - kmInicial;
    const existingDistanciaGPS = existing.distanciaGPS ? parseFloat(existing.distanciaGPS.toString()) : distanciaOdometro;
    const discrepancia = existingDistanciaGPS > 0 ? Math.abs((distanciaOdometro - existingDistanciaGPS) / existingDistanciaGPS) * 100 : 0;
    const alertaDiscrepancia = discrepancia > 20;
    const total = patchData.total ?? parseFloat(existing.total.toString());
    let fotoInicio;
    let fotoFin;
    const uploadSingleFoto = async (base64, nombre) => {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const raw = base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(raw, "base64");
        const storagePath = `vehiculos/${id}/${nombre}.jpg`;
        const { error } = await supabaseAdmin.storage.from("vehiculos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
        if (error) throw new Error(`Storage upload failed: ${error.message}`);
        const { data } = supabaseAdmin.storage.from("vehiculos-fotos").getPublicUrl(storagePath);
        return data.publicUrl;
      }
      const uploadsDir = path4.join(process.cwd(), "uploads", "vehiculos", id);
      await fs4.promises.mkdir(uploadsDir, { recursive: true });
      await fs4.promises.writeFile(path4.join(uploadsDir, `${nombre}.jpg`), base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
      return `/uploads/vehiculos/${id}/${nombre}.jpg`;
    };
    if (patchData.fotoOdometroInicio?.startsWith("data:")) fotoInicio = await uploadSingleFoto(patchData.fotoOdometroInicio, "odometro_inicio");
    if (patchData.fotoOdometroFin?.startsWith("data:")) fotoFin = await uploadSingleFoto(patchData.fotoOdometroFin, "odometro_fin");
    const updated = await prisma.registroVehiculo.update({
      where: { id },
      data: {
        kmInicial: new Decimal6(kmInicial),
        kmFinal: new Decimal6(kmFinal),
        distanciaOdometro: new Decimal6(Math.round(distanciaOdometro * 10) / 10),
        combustibleCosto: new Decimal6(total),
        total: new Decimal6(total),
        discrepancia: new Decimal6(Math.round(discrepancia * 10) / 10),
        alertaDiscrepancia,
        ...patchData.descripcion !== void 0 && { descripcion: patchData.descripcion },
        ...patchData.fecha !== void 0 && { fecha: new Date(patchData.fecha) },
        ...fotoInicio !== void 0 && { fotoOdometroInicio: fotoInicio },
        ...fotoFin !== void 0 && { fotoOdometroFin: fotoFin }
      }
    });
    auditLog({ usuario: userPayload.usuario, accion: "patch_vehiculo_registro", recurso: `/api/vehiculo/registro/${id}`, resultado: "success", ip: clientIp });
    res.json({ success: true, data: { ...updated, kmInicial: parseFloat(updated.kmInicial.toString()), kmFinal: parseFloat(updated.kmFinal.toString()), distanciaOdometro: parseFloat(updated.distanciaOdometro.toString()), combustibleCosto: parseFloat(updated.combustibleCosto.toString()), total: parseFloat(updated.total.toString()), fecha: updated.fecha.toISOString().substring(0, 10) }, message: "Registro de veh\xEDculo actualizado con \xE9xito" });
  } catch (error) {
    logger2.error("Error patching vehiculo registro:", error);
    res.status(500).json({ success: false, error: { code: "PATCH_ERROR", message: "Error al actualizar registro de veh\xEDculo" } });
  }
});

// src/server/routes/cartera.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router12 } from "express";
var carteraRouter = Router12();
carteraRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { activo, search } = req.query;
    const where = {};
    if (activo !== void 0) where.activo = activo === "true";
    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [{ nombre: { contains: q, mode: "insensitive" } }, { ruc: { contains: q, mode: "insensitive" } }];
      }
    }
    const clientes = await prisma.carteraCliente.findMany({ where, orderBy: { nombre: "asc" }, include: { _count: { select: { contactos: true, marcas: true } } } });
    res.json({ success: true, data: clientes.map((c) => ({ id: c.id, nombre: c.nombre, ruc: c.ruc, activo: c.activo, fechaCreacion: c.createdAt.toISOString(), _count: c._count })) });
  } catch (error) {
    logger2.error("[CARTERA] Error listing cartera clientes:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar clientes de cartera" } });
  }
});
carteraRouter.post("/", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(CarteraClienteSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message, details: validation.errors } });
  const { nombre, ruc } = validation.data;
  try {
    if (ruc) {
      const dup = await prisma.carteraCliente.findUnique({ where: { ruc } });
      if (dup) return res.status(409).json({ success: false, error: { code: "DUPLICATE_RUC", message: `Ya existe un cliente con el RUC ${ruc}` } });
    }
    const cliente = await prisma.carteraCliente.create({ data: { id: generateId("carcli"), nombre, ruc } });
    auditLog({ usuario: req.user.usuario, accion: "create_cartera_cliente", recurso: `/api/admin/cartera/${cliente.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { id: cliente.id, nombre: cliente.nombre, ruc: cliente.ruc, activo: true }, message: "Cliente de cartera creado" });
  } catch (error) {
    logger2.error("[CARTERA] Error creating cartera cliente:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear cliente de cartera" } });
  }
});
carteraRouter.put("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const validation = validateSchema(CarteraClienteUpdateSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message } });
  const { nombre, ruc, activo } = validation.data;
  try {
    const existing = await prisma.carteraCliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente de cartera no encontrado" } });
    if (ruc && ruc !== existing.ruc) {
      const dup = await prisma.carteraCliente.findUnique({ where: { ruc } });
      if (dup && dup.id !== id) return res.status(409).json({ success: false, error: { code: "DUPLICATE_RUC", message: `Ya existe un cliente con el RUC ${ruc}` } });
    }
    const updated = await prisma.carteraCliente.update({ where: { id }, data: { ...nombre !== void 0 && { nombre }, ...ruc !== void 0 && { ruc }, ...activo !== void 0 && { activo } } });
    auditLog({ usuario: req.user.usuario, accion: "update_cartera_cliente", recurso: `/api/admin/cartera/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { id: updated.id, nombre: updated.nombre, ruc: updated.ruc, activo: updated.activo }, message: "Cliente de cartera actualizado" });
  } catch (error) {
    logger2.error("[CARTERA] Error updating cartera cliente:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar cliente de cartera" } });
  }
});
carteraRouter.delete("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.carteraCliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente de cartera no encontrado" } });
    await prisma.carteraCliente.delete({ where: { id } });
    auditLog({ usuario: req.user.usuario, accion: "delete_cartera_cliente", recurso: `/api/admin/cartera/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Cliente de cartera eliminado" });
  } catch (error) {
    logger2.error("[CARTERA] Error deleting cartera cliente:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar cliente de cartera" } });
  }
});
carteraRouter.get("/:id/contactos", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const contactos = await prisma.carteraContacto.findMany({ where: { clienteId: id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: contactos });
  } catch (error) {
    logger2.error("[CARTERA] Error listing contactos:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar contactos" } });
  }
});
carteraRouter.post("/:id/contactos", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const validation = validateSchema(CarteraContactoSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message } });
  try {
    const existing = await prisma.carteraCliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente de cartera no encontrado" } });
    const { nombre, cargo, telefono, email } = validation.data;
    const contacto = await prisma.carteraContacto.create({ data: { id: generateId("carcon"), clienteId: id, nombre, cargo: cargo || null, telefono: telefono || null, email: email || null } });
    auditLog({ usuario: req.user.usuario, accion: "create_cartera_contacto", recurso: `/api/admin/cartera/${id}/contactos`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: contacto, message: "Contacto creado" });
  } catch (error) {
    logger2.error("[CARTERA] Error creating contacto:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear contacto" } });
  }
});
carteraRouter.put("/contactos/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const validation = validateSchema(CarteraContactoUpdateSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message } });
  try {
    const existing = await prisma.carteraContacto.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Contacto no encontrado" } });
    const { nombre, cargo, telefono, email } = validation.data;
    const updated = await prisma.carteraContacto.update({ where: { id }, data: { ...nombre !== void 0 && { nombre }, ...cargo !== void 0 && { cargo }, ...telefono !== void 0 && { telefono }, ...email !== void 0 && { email } } });
    auditLog({ usuario: req.user.usuario, accion: "update_cartera_contacto", recurso: `/api/admin/cartera/contactos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: updated, message: "Contacto actualizado" });
  } catch (error) {
    logger2.error("[CARTERA] Error updating contacto:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar contacto" } });
  }
});
carteraRouter.delete("/contactos/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.carteraContacto.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Contacto no encontrado" } });
    await prisma.carteraContacto.delete({ where: { id } });
    auditLog({ usuario: req.user.usuario, accion: "delete_cartera_contacto", recurso: `/api/admin/cartera/contactos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Contacto eliminado" });
  } catch (error) {
    logger2.error("[CARTERA] Error deleting contacto:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar contacto" } });
  }
});
carteraRouter.get("/:id/marcas", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const marcas = await prisma.carteraMarca.findMany({ where: { clienteId: id }, orderBy: { nombre: "asc" } });
    res.json({ success: true, data: marcas });
  } catch (error) {
    logger2.error("[CARTERA] Error listing marcas:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar marcas" } });
  }
});
carteraRouter.post("/:id/marcas", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const validation = validateSchema(CarteraMarcaSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message } });
  try {
    const existing = await prisma.carteraCliente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente de cartera no encontrado" } });
    const { nombre } = validation.data;
    const marca = await prisma.carteraMarca.create({ data: { id: generateId("carmar"), clienteId: id, nombre } });
    auditLog({ usuario: req.user.usuario, accion: "create_cartera_marca", recurso: `/api/admin/cartera/${id}/marcas`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { id: marca.id, clienteId: marca.clienteId, clienteNombre: existing.nombre, nombre: marca.nombre, activo: marca.activo }, message: "Marca creada" });
  } catch (error) {
    logger2.error("[CARTERA] Error creating marca:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear marca" } });
  }
});
carteraRouter.put("/marcas/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  const validation = validateSchema(CarteraMarcaUpdateSchema, req.body || {});
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: validation.errors[0].message } });
  try {
    const existing = await prisma.carteraMarca.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Marca no encontrada" } });
    const { nombre, activo } = validation.data;
    const marca = await prisma.carteraMarca.update({ where: { id }, data: { ...nombre !== void 0 && { nombre }, ...activo !== void 0 && { activo } } });
    const cliente = await prisma.carteraCliente.findUnique({ where: { id: existing.clienteId } });
    auditLog({ usuario: req.user.usuario, accion: "update_cartera_marca", recurso: `/api/admin/cartera/marcas/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { id: marca.id, clienteId: marca.clienteId, clienteNombre: cliente?.nombre || "", nombre: marca.nombre, activo: marca.activo }, message: "Marca actualizada" });
  } catch (error) {
    logger2.error("[CARTERA] Error updating marca:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar marca" } });
  }
});
carteraRouter.delete("/marcas/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.carteraMarca.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Marca no encontrada" } });
    await prisma.carteraMarca.update({ where: { id }, data: { activo: false } });
    auditLog({ usuario: req.user.usuario, accion: "delete_cartera_marca", recurso: `/api/admin/cartera/marcas/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Marca desactivada" });
  } catch (error) {
    logger2.error("[CARTERA] Error deleting marca:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al desactivar marca" } });
  }
});

// src/server/routes/import.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router13 } from "express";
import { Decimal as Decimal7 } from "@prisma/client/runtime/library";
import * as xlsx from "xlsx";
import multer2 from "multer";
import { GoogleGenAI } from "@google/genai";

// src/server/config/upload.ts
import multer from "multer";
var storage = multer.memoryStorage();
var upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    // 5MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos Excel (.xls, .xlsx)"));
    }
  }
});
var uploadSingleExcel = upload.single("file");

// src/server/routes/import.routes.ts
var importRouter = Router13();
function uploadSingleExcel2(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer2.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ success: false, error: { code: "FILE_TOO_LARGE", message: "El archivo excede el tama\xF1o m\xE1ximo permitido (5MB)" } });
        }
        return res.status(400).json({ success: false, error: { code: "UPLOAD_ERROR", message: `Error al subir el archivo: ${err.message}` } });
      }
      return res.status(400).json({ success: false, error: { code: "INVALID_FILE_TYPE", message: err.message || "Archivo inv\xE1lido" } });
    }
    next();
  });
}
function normalizeHeader(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}
function getRowValue(row, aliases) {
  const normAliases = aliases.map(normalizeHeader);
  for (const [key, val] of Object.entries(row)) {
    const normKey = normalizeHeader(key);
    if (normAliases.some((alias) => normKey === alias || normKey.includes(alias) || alias.includes(normKey))) {
      if (val !== void 0 && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }
  return "";
}
function normalizeEntityName(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?c\.?i\.?|e\.?i\.?r\.?l\.?|s\.?a\.?s\.?)\b/gi, "").replace(/[^a-z0-9]/g, "").trim();
}
importRouter.post("/import-excel", requireAuth, requireWriteAccess, uploadSingleExcel2, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se subi\xF3 ning\xFAn archivo" });
  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet);
    if (rawRows.length === 0) return res.status(400).json({ error: "La hoja de c\xE1lculo est\xE1 vac\xEDa." });
    const [dbClientes, dbProyectos, dbColaboradores] = await Promise.all([
      prisma.cliente.findMany(),
      prisma.proyecto.findMany(),
      prisma.colaborador.findMany()
    ]);
    const tempClientes = dbClientes.map((c) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo, fechaCreacion: c.fechaCreacion.toISOString().substring(0, 10) }));
    const tempProyectos = dbProyectos.map((p) => ({ id: p.id, clienteId: p.clienteId, nombre: p.nombre, estado: p.estado === "EN_PROCESO" ? "En Proceso" : p.estado === "COMPLETADO" ? "Completado" : "Pendiente", fechaInicio: p.fechaInicio.toISOString().substring(0, 10) }));
    const tempColaboradores = dbColaboradores.map((c) => ({ id: c.id, nombre: c.nombre, tarifaSugerida: c.tarifaSugerida ? parseFloat(c.tarifaSugerida.toString()) : 0, rol: c.rol || void 0 }));
    const initialClientesCount = tempClientes.length;
    const initialProyectosCount = tempProyectos.length;
    const initialColaboradoresCount = tempColaboradores.length;
    const importedItems = [];
    for (const row of rawRows) {
      const clientName = String(getRowValue(row, ["Cliente", "Razon Social", "Raz\xF3n Social", "Empresa", "Cliente/Empresa", "Nombre Cliente", "Cuenta"])).trim();
      const projectName = String(getRowValue(row, ["Proyecto", "Proyectos", "Obra", "OT", "Orden", "Nombre Proyecto"])).trim();
      const fechaRaw = getRowValue(row, ["Fecha", "Fec", "Dia", "D\xEDa", "Date"]);
      const conceptoRaw = String(getRowValue(row, ["Concepto", "Tipo", "Rubro", "Categoria", "Categor\xEDa"])).trim().toUpperCase();
      const concepto = conceptoRaw === "MO" || conceptoRaw === "MANO DE OBRA" ? "MO" : "Insumo";
      const descripcion = String(getRowValue(row, ["Descripcion", "Descripci\xF3n", "Detalle", "Tarea", "Item", "Observacion", "Observaci\xF3n"])).trim();
      const hsInicio = getRowValue(row, ["Hs Inicio", "Hora Inicio", "Inicio", "Desde", "Entrada", "Hs. Inicio"]);
      const hsFin = getRowValue(row, ["Hs Fin", "Hora Fin", "Fin", "Hasta", "Salida", "Hs. Fin"]);
      const cantidad = parseFloat(getRowValue(row, ["Cantidad", "Cant", "Cant.", "Minutos", "Horas", "Hs", "QTY"])) || 0;
      const precioUnitario = parseFloat(getRowValue(row, ["Precio Unitario", "Tarifa", "Precio", "Costo Unitario", "P. Unitario", "Tarifa/Hora", "Unitario"])) || 0;
      const computedTotal = parseFloat(getRowValue(row, ["Total", "Importe", "Monto", "Subtotal"])) || 0;
      let hsTotal = 0;
      if (concepto === "MO" && cantidad > 0) hsTotal = parseFloat((cantidad / 60).toFixed(2));
      if (!clientName && !projectName && !descripcion) continue;
      if (clientName.toLowerCase() === "cliente" || projectName.toLowerCase() === "proyecto") continue;
      let targetClient = tempClientes.find((c) => {
        const nc = normalizeEntityName(c.nombre);
        const ni = normalizeEntityName(clientName);
        if (!nc || !ni) return false;
        return nc === ni || ni.length >= 4 && (nc.includes(ni) || ni.includes(nc));
      });
      if (!targetClient && clientName) {
        targetClient = { id: generateId("cli"), nombre: clientName, codigo: clientName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "C"), fechaCreacion: (/* @__PURE__ */ new Date()).toISOString().substring(0, 10) };
        tempClientes.push(targetClient);
      }
      let targetProject = null;
      if (targetClient && projectName) {
        targetProject = tempProyectos.find((p) => {
          if (p.clienteId !== targetClient.id) return false;
          const np = normalizeEntityName(p.nombre);
          const nip = normalizeEntityName(projectName);
          return np === nip || nip.length >= 4 && (np.includes(nip) || nip.includes(np));
        });
        if (!targetProject) {
          targetProject = { id: generateId("pro"), clienteId: targetClient.id, nombre: projectName, estado: "En Proceso", fechaInicio: parseExcelDate(fechaRaw) };
          tempProyectos.push(targetProject);
        }
      }
      let targetColaborador = null;
      if (concepto === "MO" && descripcion) {
        const descWords = descripcion.toLowerCase().split(/\s+/);
        targetColaborador = tempColaboradores.find((col) => {
          const names = col.nombre.toLowerCase().split(/\s+/);
          return names.length > 0 && descWords.includes(names[0]);
        });
        if (!targetColaborador) {
          const prospectiveWorkerName = descripcion.split(" ")[0] || "Colaborador";
          const normalizedName = prospectiveWorkerName.charAt(0).toUpperCase() + prospectiveWorkerName.slice(1).toLowerCase();
          targetColaborador = tempColaboradores.find((c) => c.nombre.startsWith(normalizedName));
          if (!targetColaborador) {
            targetColaborador = { id: generateId("col"), nombre: normalizedName + " " + (descripcion.split(" ")[1] || ""), tarifaSugerida: precioUnitario || 350, rol: "Operario Externo" };
            tempColaboradores.push(targetColaborador);
          }
        }
      }
      const finalFecha = parseExcelDate(fechaRaw);
      const calculatedTotal = computedTotal || cantidad * precioUnitario || 0;
      importedItems.push({
        sheetRow: row,
        clienteNombre: clientName || (targetClient ? targetClient.nombre : "Cliente Desconocido"),
        clienteId: targetClient ? targetClient.id : "temp_cli",
        proyectoNombre: projectName || (targetProject ? targetProject.nombre : "Proyecto General"),
        proyectoId: targetProject ? targetProject.id : "temp_pro",
        fecha: finalFecha,
        concepto,
        descripcion,
        colaboradorId: targetColaborador ? targetColaborador.id : void 0,
        colaboradorNombre: targetColaborador ? targetColaborador.nombre : void 0,
        hsInicio: hsInicio ? formatExcelTime(hsInicio) : void 0,
        hsFin: hsFin ? formatExcelTime(hsFin) : void 0,
        hsTotal: hsTotal > 0 ? hsTotal : void 0,
        cantidad,
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
      updatedDbState: { clientes: tempClientes, proyectos: tempProyectos, colaboradores: tempColaboradores }
    });
  } catch (err) {
    logger2.error("Error processing Excel file", err);
    res.status(500).json({ error: `Error de procesado de archivo Excel: ${err.message}` });
  }
});
importRouter.post("/import/confirm", requireAuth, requireWriteAccess, async (req, res) => {
  const { clientes, proyectos, registros } = req.body;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!Array.isArray(clientes) || !Array.isArray(proyectos) || !Array.isArray(registros)) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos de importaci\xF3n inv\xE1lidos" } });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const dbClientes = await tx.cliente.findMany({});
      const clientesPorNombre = new Map(dbClientes.map((c) => [c.nombre.toLowerCase().trim(), c.id]));
      const clienteIdMap = /* @__PURE__ */ new Map();
      const clienteNombreMap = new Map(dbClientes.map((c) => [c.id, c.nombre]));
      for (const c of clientes) {
        const nombreNorm = c.nombre.toLowerCase().trim();
        if (clientesPorNombre.has(nombreNorm)) {
          clienteIdMap.set(c.id, clientesPorNombre.get(nombreNorm));
        } else {
          const created = await tx.cliente.create({ data: { id: generateId("cli"), nombre: c.nombre.trim(), codigo: c.codigo ? c.codigo.trim() : generateId("cli").substring(0, 8).toUpperCase() } });
          clienteIdMap.set(c.id, created.id);
          clientesPorNombre.set(nombreNorm, created.id);
          clienteNombreMap.set(created.id, created.nombre);
        }
      }
      const dbProyectos = await tx.proyecto.findMany({});
      const proyectosPorNombre = new Map(dbProyectos.map((p) => [`${p.clienteId}::${p.nombre.toLowerCase().trim()}`, p.id]));
      const proyectoIdMap = /* @__PURE__ */ new Map();
      const proyectoNombreMap = new Map(dbProyectos.map((p) => [p.id, p.nombre]));
      for (const p of proyectos) {
        const realClienteId = clienteIdMap.get(p.clienteId) || p.clienteId;
        const key = `${realClienteId}::${p.nombre.toLowerCase().trim()}`;
        if (proyectosPorNombre.has(key)) {
          proyectoIdMap.set(p.id, proyectosPorNombre.get(key));
        } else {
          const estadoEnum = p.estado === "En Proceso" ? "EN_PROCESO" : p.estado === "Completado" ? "COMPLETADO" : "PENDIENTE";
          const created = await tx.proyecto.create({ data: { id: generateId("pro"), clienteId: realClienteId, nombre: p.nombre.trim(), estado: estadoEnum, fechaInicio: p.fechaInicio ? new Date(p.fechaInicio) : /* @__PURE__ */ new Date() } });
          proyectoIdMap.set(p.id, created.id);
          proyectosPorNombre.set(key, created.id);
          proyectoNombreMap.set(created.id, created.nombre);
        }
      }
      const validRegistrosData = [];
      let errores = 0;
      for (const r of registros) {
        const realClienteId = clienteIdMap.get(r.clienteId) || r.clienteId;
        const realProyectoId = proyectoIdMap.get(r.proyectoId) || r.proyectoId;
        const realClienteNombre = clienteNombreMap.get(realClienteId);
        const realProyectoNombre = proyectoNombreMap.get(realProyectoId);
        if (!realClienteId || !realProyectoId || !realClienteNombre || !realProyectoNombre) {
          errores++;
          continue;
        }
        let parsedFecha;
        if (r.fecha instanceof Date) {
          parsedFecha = r.fecha;
        } else if (typeof r.fecha === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.fecha)) {
          parsedFecha = new Date(r.fecha.substring(0, 10));
        } else {
          parsedFecha = /* @__PURE__ */ new Date();
        }
        const cantidad = Number(r.cantidad) || 0;
        const precioUnitario = Number(r.precioUnitario) || 0;
        if (cantidad <= 0 || precioUnitario <= 0) {
          errores++;
          continue;
        }
        const total = Number(r.total) > 0 ? Number(r.total) : cantidad * precioUnitario;
        const conceptoRaw = (r.concepto || "").trim().toLowerCase();
        let conceptoValido;
        if (conceptoRaw === "mo" || conceptoRaw === "mano de obra") conceptoValido = "MO";
        else if (conceptoRaw === "insumo" || conceptoRaw === "insumos" || conceptoRaw === "materiales") conceptoValido = "INSUMO";
        else if (conceptoRaw === "vehiculo" || conceptoRaw === "veh\xEDculo" || conceptoRaw === "km") conceptoValido = "VEHICULO";
        else conceptoValido = "INSUMO";
        validRegistrosData.push({
          id: generateId("reg"),
          clienteId: realClienteId,
          clienteNombre: realClienteNombre,
          proyectoId: realProyectoId,
          proyectoNombre: realProyectoNombre,
          fecha: parsedFecha,
          concepto: conceptoValido,
          descripcion: r.descripcion || null,
          colaboradorId: null,
          hsInicio: r.hsInicio ? String(r.hsInicio).substring(0, 5) : null,
          hsFin: r.hsFin ? String(r.hsFin).substring(0, 5) : null,
          hsTotal: r.hsTotal ? Number(r.hsTotal) : null,
          cantidad: new Decimal7(cantidad),
          precioUnitario: new Decimal7(precioUnitario),
          total: new Decimal7(total),
          origen: "EXCEL",
          fechaImportacion: /* @__PURE__ */ new Date()
        });
      }
      let guardados = 0;
      const CHUNK_SIZE = 500;
      for (let i = 0; i < validRegistrosData.length; i += CHUNK_SIZE) {
        const chunk = validRegistrosData.slice(i, i + CHUNK_SIZE);
        const res2 = await tx.registro.createMany({ data: chunk });
        guardados += res2.count;
      }
      return { guardados, errores };
    }, { maxWait: 2e4, timeout: 6e4 });
    auditLog({ usuario: userPayload.usuario, accion: "confirm_bulk_import", recurso: "/api/import/confirm", resultado: "success", ip: clientIp });
    res.json({ success: true, data: result, message: `Importaci\xF3n procesada: ${result.guardados} guardados, ${result.errores} errores.` });
  } catch (error) {
    logger2.error("Error in bulk import transaction:", error);
    auditLog({ usuario: userPayload.usuario, accion: "confirm_bulk_import", recurso: "/api/import/confirm", resultado: "failure", ip: clientIp });
    res.status(500).json({ success: false, error: { code: "IMPORT_ERROR", message: "Error al procesar la transacci\xF3n de importaci\xF3n masiva" } });
  }
});
importRouter.post("/gemini-enrich", requireAuth, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(GeminiEnrichSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Datos inv\xE1lidos para enriquecimiento", details: validation.errors } });
  const { entries } = validation.data;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "DISABLED_NOT_NEEDED" || apiKey.length < 20) {
    return res.status(503).json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "El servicio de IA no est\xE1 configurado. Continu\xE1 usando el sistema sin esta funci\xF3n." } });
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Eres el asistente inteligente del Sistema aFull. Recibes un arreglo de descripciones de tareas operativas o compras de insumos registradas de forma informal.
Tu meta es parsear esta lista y devolver un objeto JSON con una clasificaci\xF3n inteligente para cada elemento:
1. Extraer nombre de persona (si refiere a Mano de Obra / colaborador).
2. Categor\xEDa (MO o Insumo o Herramientas o Log\xEDstica).
3. Sugerencia de precio unitario sugerido (si el actual es 0) basado en valores t\xEDpicos (MO: 350-500 por min, Insumos dependiente del tipo).

Lista de entradas:
${JSON.stringify(entries.map((e, index) => ({ index, text: e.descripcion, concepto: e.concepto })))}

Devuelve \xDANICAMENTE un arreglo JSON con el siguiente formato:
[
  { "index": 0, "colaboradorSugerido": "Rodrigo G\xF3mez", "categoriaSugerida": "MO", "precioSugerido": 350 }
]`;
    const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt });
    const text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ success: false, error: { code: "AI_PARSE_ERROR", message: "La IA no devolvi\xF3 un JSON v\xE1lido" } });
    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger2.error("Error in Gemini enrichment:", error);
    res.status(500).json({ success: false, error: { code: "AI_ERROR", message: "Error al procesar enriquecimiento con IA" } });
  }
});

// src/server/routes/presupuestos.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router14 } from "express";
import fs5 from "fs";
import path5 from "path";

// src/server/logoAfull.ts
var LOGO_AFULL_DATA_URI = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUkAAACACAYAAACGGptgAAAY+ElEQVR4Xu2dC5QcVZnHOwngA0VINoSEyUx3h3lP9WCysgvLQ1REPSzrugQQSKa7B3GzKOz6YPUAigKCvFwWUfC5govAsoIrh6eAoLxUNCgLaBSFgLwhyyMkme6e/X/MtFb+6e7qr291dfX09zvnfwbSdf/3u7fuvfW6dSuRMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMIwtmdwnsRX/m2EYhjFNMdd96uTyxBz+d8MwjI6nkOs+opBPr55MJGbzb4ZhGB1NabxrbiGbXFvIJX/MvxmGYXQ0OHOcVcimby2NL5mcyKa+yb8bhmF0NKWVyXcWcqlNMkgWsz1n8O+GYRgdy+SKhd0T+fQrMkCKCvlUnrcxDMPoSOQyuziW/EZ5gHxV2e49eDvDMIyOpDTWPV7IpYubD5LpXt7OMAyj45gcS7y2kEs+vNkACfF2hmEYHYe8VVPMdl/PAyQGzbW8rWEYRscxObbzW7e4zJ4aJO/jbQ3DMDqK0uE7dxWy6XU8QIqK2dTNvL1hGEZHUcwl/5MHxz8NkvnUt3h7wzCMjqGQTS3ngZEGyS9wGsMwjI5gMpGYM5FPP84D42bKp0/gdIZhGDMeWdWnmEtdu8WgSCqMJ8c4rWEYxoynlO15Hw+IlVTI9hzGactMLp//hlJ20eKNK1OZJi/MO8fzvC5ob2h5JpM5ZXR09FL8/SF0P/TIrrvuOhkkpHkSXluzuR9s89+cTiPEsgY2s9jXhZGRkd05H61Qb+9nXz/Dw8N7cBqtkMfH2TdqEMNSjksr7MOT2dfoMCb/7k3b4zL7JR4QK6mYTX973UFdc0srFs0r5ZccWMwv+bwsnVYY3zx9YUVyBefjwCw01G2hETT6szFIPMkNuRHJgJoIWBcTg+Q9nE4jxHoXe7oCz4M5H60GBwffwb5+UDeHchqthoaGDmTfqEFdvZfj0gpt7iD2NTqMYj55CQ+GtTSRnVoNqKZyyYM5n0aQAQGN9BY564OK3IBdBL/bOD9CBue6zkqrCfGHPhsA9fEZzker/v7+JPv6kbMnTqMVBuI3s2/UoK6O47i0GhgY2J19jQ6ilOs+qJBLTWwxyDkIfvdPHrDw9ZxXvaBRLsXgcg4a+GPcYMMU8jif8yZmY7BYz+k0wmXrsWzqCmK6ivPRqqen57Xs6wcHkO9xGq3S6fSO7Bs1aEMXcVxaYbDvYV+jQ5BL5ol86hke5FyEy+7n5d4k51UHW8vgiAHgEm6kzRLyOoSD8IMO5nEarTBIvoV9XcEA9hDnoxEODnezJ+OaB+r2/9izFSAOp9slSD+xyy67vIZ9jQ6hmE1eXcinSzzQuaiY7/ks5xPEokWL5qHj/ggNssCNtJnCGULN1YwQz6c4jVaJkB/agNdhACtxPhoh/Vls6qevr+8vXPPA8eVS9m0FrrdoUI7b2dPoECYDJo03omKu5wbNVxSHhobegEb4dTnr4MbZbCHP5zgeBtus5nQaoWyr2dMVnJm+k/PRCgeHvdjXD8q9P6fRCge9HPtGDepqlOPSSu7/sq/RAZRyO80vjCcf4UHORYV8auPGbPdSzqsaaMAHoAH+nhtlVMJAUPMMQS6xOI1WOIu5gn1dweDzEc5HI8S0YWBgYB77+kEen+B0GsnZGw6Au7Bv1KB9HcmxaQWPZexrdAAFXGbzIOeiVy/Zc93jnE8lFi5c+Ho0vIu5MUYtxPBljs0PBtEUp9EKHqewryvwvJzz0Qjpn1iwYMG27OvHdW4o6nYdDjLbsW/UII6vcWwaoa5e6e/vfyP7GjOc0sqefcsf9ApLE9nkmsmhxDacFyP3ANHwHna93xWGEMcnOT4/8sCF02iFch7Bvq4g7ls5H42Qfs2yZctqTqDH4PJjTqcRyr026Ol5FKCsP+TYNEI9PBaHchgRUsovXjSRS6/nQc5FhWz62VI+GThFAoPOIWh0T3NDbJUQz99yjH4Q60GcRit5M4Z9XUHH/y3no5EMsuzJoOx/4HQaIY97EwGT9KMA5fhfjk0jpJe1U+u+x27MAErjqVU8yP1psMulixhAn8NZ5lpcPhf492rC9sdzPsQcDEgrcHaxkRthK9XX15fhQP1kQphMnUqlFrCvK6jHFzkfjdDxz2ZPBts4zQ3FwSH0e7GNgH34HMemEcpxE3saM5yJsfTby1N+JrKpNcV86rLCyuTHSvme3eWp9OSnE7OnFrpIn8mDYSUVcj2B8+3Q4Y6Lw+U1K2juG+K+g9NohA76Anu6MjAwMML5aIW4ap5BDw0N7clptML+Pop9o2bu3LnbubY71NXn2ddoEeiwXdgheXTMc6Hr8d93QKuxk39NutObekXvChzlTsR/y1SOmp3dj3wetjTeNTdo8YnCeOowHhAraXKsu+aTP8R3Eje8OAh1+wDHyqCOX+J0GiGPK9nTFdTnsZyPVoir5kMb5HE8p9EKHh77Rg3KuYrj0gpXQG9lXyMi5GYwBrn90BHPxM5cwztHI7THl+FxI/4eFda0i1IueQwPiJufQaaLOAutOX8MMX2aY42Lgi45BwcHhzmNVpmAB0ONkHF/aPMwezLyNg6n00jaI3u2AsRxKcemVRye0HccMnkalb8cO/CPvEPCEryvTKfT3QmHG+elXOp4Hhg3GySzyV/VOBudJQ9pOK5qwoGiiJgflYNFVEJ+yzloP7J6DcepkVzm9ff3h302JYttOE26R7mDvk+0les9TwyyP2fTFjAL5djAsWkk7YRNjSaDBjqGHfe4632SeoQdvB66AWes23Mc9YCzxAt5YCxrIpvcUFrRM8hpyqCT7IOyTnBMlSRxYtt3d3V1vY59WgniOoVj1Ug6KA4US9jXBXkIJPXFeWmEur6Aff309vbu7Dq4YP9/h32jBu1p7qjjg0LpP+xrNAlZkgoVfg3vhCiETvEUOuuRCeX7w8V8+vs8OJaFAbTqu9neFHVP88G2/8QeccBznOyO/b0u6K0WLfDrc+348rYO+/pBWxlE7HUd4KoJ6U9l36hBDH2u5UBd/zv7Gk3A9bItDE1fzp4kb7pwfNUo5JO38+Aokm9uTx6QqOgjT4vRMOt+Ioxtf8secQGx/Yzj1UgOTkFPz7XISuGuVyHyKij7+sE2+3EarTAQH86+UTM4OPhX0u45No2wD49mXyNkUMkncMW3UojnMo6xGoXx1O+2GCDzyY2lFYv6eNsy6Bzf4jxrCQPR5ewRF2SQ43g1QvrQL9XQ6Y/mfLSqY6HdT3IareKwQC3icJ4FILeN2NcIj1noJGe7XhqFLXSAAnb8v3Gwlaj02mJxrOd0mULE2wrykEJbXmx/JvvEAZxtLeZYtUI9f4p9XUGb+i7noxHSr08EPMxD3NdxOq3i8EQYZb2A49IKV4Hy8NNoBmhoOa/OBxdRCwPTKxgE/oZj9iMrBPEAWcj1/IS3KwPP7b0GXmNDPYX+XnMYjITw/Ri5NGZfVxDXo5yPRthH17Mng22cnp7H5RaK57i6FNp04DJ6RoOMhPAVuyiEo/18jr1M6fDupf4BciKX3FAa6646sHoNfkMkaE3DViFPZzlWjeSBAXu6Iovgcj5aoeNXfeAmYD+mOY1WKPuF7Bs18+fPl2l2W8SmUTNulxjToJHcyxUeR6ER/DPHXgaX2kdsdhY51vMJ3qYMLklkqsUr7F+PNA+SIkTm1z3AsWrUjLMp7K+9OB+t4FHz64hyD47TaIU8PsC+UYMY/prj0goeoX+XyEi8unPO4sp2kTydkw6Hvw/ir9NbOSx4PlttkCrkkx//82V2co18bpa3KeM1OFUG5fkde8UBWWfRc5zoj/S3sK8rcguH89FI7kfjgLYr+/qRAyen00jaK/LYjX2jBjGMcWxaDQ8P78u+hjvbeCF92Q8N+nZ4jVVax05W08Hvt3GaRiQdj/2FiVzPeVMDZOrF0hFdVV9zlEtAxLmOfesR8v4S+8UBlzKVhcHiEvZ1BZ6ncT4aoUyboC729YM8zuV0GqFdbpK5nOwbNSjnmRybRlJX/YB9DUfQQE7lytZq+szxw+xdCWzrvLIO0lf8HnQxl7pFVgoq5tNf5N/8oDE1vEI2yrkK2jZqIeygxWad78vhQHYc+7qScfyErNwSCVqNHHncwOk0Qvr1svIO+0aNHKQ4No3QBl5uxhJ3HQ0qdYdG78v5hUZ2MnvXQNZovIo9NEJ+FZ9YY4C8q5BN3z15VPUBZcmSJYtHHV9fa4VQ5kO5LH7w+wpOoxX2yz+wryuIy+k+Kc7c72JPJuO+mK8sbFFxiliUoF3+imPTCOVYlwg4mBpKZPIsV7RW2DE/C1pSn0GaHTMOn2DF4P4Ue8o8yEI2+dNNucV78m9+0OnyrmeyrRDiHuCy+EF9fpvTaDU0NLQT+7riOS6CK5eg7OknjCfCqNuKVyZRM+q4QAfq6qfsaTiCSj0JO+YFF+Hso66PaDFI+zjvZI3YTxbcLa1MruR/J+ZgMHmYveIu1NUGLgiDjv4kp9MoU8dnarWEMa1MXtNjXz/DIXymFvVb8R53lKCuMhyXVujP/8K+hiOygk06nX6Ti2BTbdmxmqBTvsA7WSP2qwc0onewTzsIHehHXBY/ch+K02iFgeI69nUF+/gYzkcjeRCRCHjTBtuczum0kpV32DdqUI4PcFxawWNv9jXalDCW2WfPekCnPYN92kFo/OdyWfzg92WcRisMkmexryue4+uIctbPngzi/gGn0wh5PMuerQAHwis4No1QDy+xp9GmyArknuN8Prmfyb71MOp4Y7xVQn3JknFVwe/LOY1W8DiMfR2Zjfr+OeejkdzvZlNia+Txa06nEdL/kk1bwGzP8euIGGQfYlMjeraW+Y8ykVvEl91lyVqErOk5fAd6DU7gZqHzrOXggpBv8bBPuyhogjA6uvOqTcMhfxNF2griWsv5aCRnouzrR24XoS04zfHNxGCBWulPKKvT++0ox23sa0QAOs5bcIQ6GTvw5tGpt2celkYpD13koU0FOX2Aql7VcYaxBSjHR9mnXSQLynJ5/Lheqk3nEepq5NNvAD3P+WiE9Kezrx85KHvuT8/PY9+omS6H6wId/8W+RhOQqTyyuCkGu4u8kN7CaYZkUODYg0B5bmGfdlF/f/8buTx+XC85RdVe9WwUWa6L89BKnlyzrx8vnHedW/4J2cHBwV6OSyvU1cfY1wiX2ajk/XE0up8rP47yAubOMTL4YyBxmnDcKuGA8Bsujx9ZRZzTaCX7nX1dwT46kvPRamBgYCH7+sE+/Qyn0Uqm3rBv1KD+V3JcWuGg9Db2NUIEO+lGeRjCFR9XjSjXc5QJx57je82tEvbLGVweP3JLhNNolWnCh+zh+T3ORyO5R8eeDMru9JlaEXu2ArRnp9cRRUGvbhoNIpdEaMy/4QqPu4JWhWHky4vtdBDwS25/cHn8YDAZ4zRaoZPux76uuB6UENNN7OknpDNo9b3tZuBaV0gfOFXKaAC5Ue85TjtohRDzJu39szAuZ1ohlHViesJ+VTKOn5AVLVu2rGYeWhDTjpyHVij759jXTxj3PHG5/nX2jRpZRJrj0grluJR9DXfkQ+53cmW3g0Ya+IA8Ou1X2acdhLifCbqMyoSwilPYgyQGuKWch1ZewCK4+H1vTqMV6u4Y9o2awcHBN3NcWsmBkn0NR3AWeSFXdLsIneNrXJ4gRhzfa26V0PjXBC0egm0aXvatrLAHSblnzHloJYMg+/oZCeF7PvB4L/tGjcTAcWmF/nwI+xoOTE/sdpqT1UrJpTOXqRYo6w7soZVczkhDbIH25/IwcsnI8TagUfZ1AR3/fyrkoZJM/mdfP2gHJ3MarXAWN8y+UYNyOM/fRX23/FO4MwpUaKTvL6MTF6HnRBiwXubftYKH6iNcGGhG2UMr5DnGvnEhjHuS8PgC+zZKb2/vIPtrhXgeYV8G7fhaTqdVHBa2CONKoL+/fxH7Gg0iU2FGQ1xLETv4QQwgJ+Hv28qa/prhnErC72Fc5vf6yxTE0NDQuyp4qDQc8it7YRLGICltIugBUb0gnivZX6vRgK8jCq63UOShJXu2AsThPDeZPQ0HRkL4qpwIHeHW4anX2FSrOSPdjeyllUznYd9aZByX6xLhSJ1k37iA8h3K8TYiDEwfYm8t6PCHwWcje2sEj02yCAp7+wnjPXzU21fZN2pQju0yjlPT5NYG+xoOSEfgStYKO3VNd3f3DuxdD+gAT7OfRl4dE4wZxPsV9tFIOn1i6kw4loQxFUYk5RwcHKz5sKQW8qAFde18OwVxrJWFK9jfD/I6kNNphVhD/1SFFpxo7MFxaYVy2OuIYYLGdR5XslZoxB9k33oYGBhwfs8WR82vsG8QKPMv2EcjOWtmz7jhOS49VxZ8nkd5ZSXwmgvdElvJQyb2alSI4cucAYN2cCKn00juk8u3jtg3alBvqzg2jeQ2SRy+8jijQAO8mitaK3i8nX3rAemuZy+t0IHfxb5BuF7OZNpgDhpidH6trSx4TUB3yqILnA8jZ7HYrz+RS2T2aUTo9BsyU1+GrAnyu4zTaoT0L8vMATkgNEsy/zERcLDBdt/k2DRC+vXNLgcOSH+ZiPGVVOig0Ku5orWCh/pFemkwnvuSVvJFu5qNjvFCWLHbC5ivFwcQ4/s5blfBUwbL+/H3u/h7Hv4eO63PQRePOi6oW0nokN/hslUC8dzOaeMmxPhI0G2DUcdV1aMQ9vWj2jfc2prREJbUws5fxb61wJFucDSEdSaRr3oFaXS6PPtoJPfpgubrxYHe3t6dwzqba5WwfydwZrobl60SmTb4mBtivJfjZjKOn9uNQugDDyQa/I5VW4Kd8iBXglbojE8FvSpXph+EMUCKMOCplkcTkOZL7KORlDWsqTHNBvv2HLlHxWVoF8nZKZepGpw2jkJ5vsFxM2H1jWYK5eis98IzIUzBEcllmJwhsn8Z+WSDPGRBI3D6ImJZ4oOzDPXEX6T7PntphPSBl0xxQb6Z7TmuJtNKyf1NLlMlZM4qp42j0P4P5tj9oG0Nc5o4CuX4CMc+o0EnuogroVFhoCxAN0AnQx8VYcefir/XQK/w9i7KNLjeIcp7H3tphHzb6WPvs9Cg224hD9TxJsT9j1yYamCfnsYecdT0SxVVGQ1hOl4U6uvrG+DYZzRojB/mSoi70InWNzpdw3Ofl3kBe8Ydr82Wv8NgcQ2XoRae45SuKIQY/8hxM14Isz2aLbkdwHHPeLBj9uKKiLOwk4q4vHofl6MeMLj2sZ9WmRhMONbSLpejItTvavmqIpehGvKUFWmeYZ+4Ce32To6dmN0m5biHA5/xyGrOcpTjyoir0JAuR9g1lwqrhuuTbVHQJVNcwT4+mssSN2HfPo59pLqUw/YL0HFfZK+4yQtYzk/aVTs8tEGMnfkFRnk7Qs7QuELiJnSiOzh2DZ77hOPH2LONkI/dnyv3+7hccZDULWJLcdBByNslXhtMdUKMJ3DsfmTdA/TBDZwubkI5Ahcamam8BjvoIa6QZmm0gWkp6EAPIs66L8MqgXyfYF+NXAfpOIAzr/Mzjm8chS3E9Pt58+bV/ERuNbwQViOPQsMBn8JF29yN08RRI8oP7s0ocEQewY56jiulGcool87C9jc0Mt3Hj6wUhA71PHtrVO/bH3EH9bCcy9Yqye2TdDq9I8dYLyjLmewZRwWtGtUOt0NE2g/uzThwtFs56risVZAw0HwQHeMc/vdKkntNman3pJ3fE5Wn4Z7jAr+jdaxp2C7IvT+vhU9TsV/XIf9jNQ9pKgGPm9k7bpKTD46bwf64gtPFUa77a0aARndQM+6NwPNZHIX2lDzQQW7j32nbIra5B2e3Szm+RpEjoOt9VxxEVrBvu4PO+SHU9R+4rM0S9sFLyPM6ebmAY2mArdg/jkKfupoDZ7BNZPugUWG/3cVxdyqz+vr6UthpT3ElNSoZ8GQx0XIGte6J4bdfYjCS76uE+m4oypPlvLSaqUtQydmBXIKj7pv6nSN0spum33tXLUpSDXnYwXnEUSj3v3LsfsJYMDgKoX2cz7F3NNMfB/us57BSDyr1AXlyjrO4bcq+smABbfM0dBW0Cnl5/hjCBNYXc3xa+csxE5HBEvtrX9TVaejYzg/yvKlVg27H36PrWWZNC2J8D+cZN8lDSqjmQ5sw1lWNQtiXDc1PnvHIAxM0xhOxo3+Axv4oV5xfo1PvZf8Clfkf2Pbd7CWkUqkFUtnynjcax0L+vVkgtn0l30blNbhmZjsjAxv2fQ7ll3fur0Ud3A3dh/9/Av+/mTJTS6jJOpLXQ2fh/+XguBN7hgny6eL9FDeh/v4+6PMi6AuLOV0c1a5zhFvBrMzU4pvykOc4ERrCPkHfIDEMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzCaxf8DiOGyF4TG4f0AAAAASUVORK5CYII=`;

// src/server/routes/presupuestos.routes.ts
var presupuestosRouter = Router14();
async function guardarFotosPresupuesto(presupuestoId, fotosBase64) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const isDataUrl = (s) => s && s.startsWith("data:");
  if (!fotosBase64 || fotosBase64.length === 0) return [];
  const resultados = [];
  for (let i = 0; i < fotosBase64.length; i++) {
    const dataUrl = fotosBase64[i];
    if (!isDataUrl(dataUrl)) {
      resultados.push(dataUrl);
      continue;
    }
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const raw = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");
      const storagePath = `presupuestos/${presupuestoId}/foto_${i}.jpg`;
      const { error } = await supabaseAdmin.storage.from("vehiculos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
      const { data } = supabaseAdmin.storage.from("vehiculos-fotos").getPublicUrl(storagePath);
      resultados.push(data.publicUrl);
    } else {
      const uploadsDir = path5.join(process.cwd(), "uploads", "presupuestos", presupuestoId);
      await fs5.promises.mkdir(uploadsDir, { recursive: true });
      const raw = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      await fs5.promises.writeFile(path5.join(uploadsDir, `foto_${i}.jpg`), raw, "base64");
      resultados.push(`/uploads/presupuestos/${presupuestoId}/foto_${i}.jpg`);
    }
  }
  return resultados;
}
presupuestosRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { estado, clienteId, search } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [
          { clienteNombre: { contains: q, mode: "insensitive" } },
          { proyecto: { contains: q, mode: "insensitive" } }
        ];
      }
    }
    const presupuestos = await prisma.presupuesto.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: { orderBy: { orden: "asc" } },
        pedido: { select: { id: true, descripcion: true, sucursalNombre: true } }
      }
    });
    res.json({ success: true, data: presupuestos });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error listing:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar presupuestos" } });
  }
});
presupuestosRouter.get("/ordenes-trabajo", requireAuth, requireProduccionOrAdmin, async (req, res) => {
  try {
    const { estado, clienteId, search } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (search) {
      where.OR = [
        { clienteNombre: { contains: search, mode: "insensitive" } },
        { proyecto: { contains: search, mode: "insensitive" } }
      ];
    }
    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, data: ordenes });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error listing OTs:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al listar Ordenes de Trabajo" } });
  }
});
presupuestosRouter.post("/ordenes-trabajo/manual", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  try {
    const { clienteId, proyecto, contacto, fechaInicio, fechaTope, detallesTrabajo, comentarioCliente, telefono } = req.body || {};
    if (!clienteId || !proyecto || !detallesTrabajo) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Cliente, Proyecto y Detalles del trabajo son obligatorios" } });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
    }
    const fmtFecha = (d) => {
      if (!d) return "\u2014";
      try {
        const dateObj = new Date(d);
        const dia = String(dateObj.getDate()).padStart(2, "0");
        const mes = String(dateObj.getMonth() + 1).padStart(2, "0");
        const anio = String(dateObj.getFullYear()).slice(-2);
        return `${dia}/${mes}/${anio}`;
      } catch {
        return d;
      }
    };
    const lineas = [
      `Cliente: ${cliente.nombre}`,
      `Contacto: ${contacto || "\u2014"}`,
      `Proyecto: ${proyecto}`,
      `Fecha de inicio: ${fmtFecha(fechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(fechaTope)}`,
      "",
      "Detalles del trabajo",
      detallesTrabajo
    ];
    if (comentarioCliente) {
      lineas.push("", "Comentarios de Cliente", comentarioCliente);
    }
    const mensaje = lineas.join("\n");
    let whatsappUrl = "";
    if (telefono) {
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, "");
      whatsappUrl = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }
    const ot = await prisma.$transaction(async (tx) => {
      const pedId = crypto.randomUUID();
      await tx.pedido.create({
        data: {
          id: pedId,
          clienteId,
          sucursalId: "manual",
          sucursalNombre: "Casa Central",
          descripcion: `OT Manual: ${proyecto}`,
          cantidad: 1,
          tipo: "Trabajo Directo",
          estado: "Aprobado",
          contacto: contacto || null,
          proyecto,
          comentarioCliente: comentarioCliente || null
        }
      });
      const pId = crypto.randomUUID();
      await tx.presupuesto.create({
        data: {
          id: pId,
          pedidoId: pedId,
          clienteId,
          clienteNombre: cliente.nombre,
          proyecto,
          contacto: contacto || null,
          fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
          fechaTope: fechaTope ? new Date(fechaTope) : null,
          estado: "Aprobado",
          total: 0,
          markup: 0,
          comentarioCliente: comentarioCliente || null
        }
      });
      return await tx.ordenTrabajo.create({
        data: {
          id: crypto.randomUUID(),
          presupuestoId: pId,
          clienteId,
          clienteNombre: cliente.nombre,
          proyecto,
          contacto: contacto || null,
          fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
          fechaTope: fechaTope ? new Date(fechaTope) : null,
          detallesTrabajo,
          comentarioCliente: comentarioCliente || null,
          estado: "Generada",
          mensajeWhatsapp: mensaje
        }
      });
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "create_manual_ot",
      recurso: `/api/admin/presupuestos/ordenes-trabajo/${ot.id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `OT manual ${ot.id} creada para cliente ${cliente.nombre}`
    });
    res.json({ success: true, data: { ...ot, whatsappUrl }, message: "Orden de Trabajo creada exitosamente" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error creating manual OT:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear Orden de Trabajo: " + error.message } });
  }
});
presupuestosRouter.get("/ordenes-trabajo/:id", requireAuth, requireProduccionOrAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Orden de Trabajo no encontrada" } });
    }
    res.json({ success: true, data: ot });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error getting OT:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al obtener Orden de Trabajo" } });
  }
});
presupuestosRouter.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: "asc" } },
        pedido: true,
        cliente: { select: { id: true, nombre: true } }
      }
    });
    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    res.json({ success: true, data: presupuesto });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error fetching:", error);
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: "Error al obtener presupuesto" } });
  }
});
presupuestosRouter.post("/", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  try {
    const {
      pedidoId,
      clienteId,
      proyecto,
      contacto,
      fechaInicio,
      fechaTope,
      markup,
      comentarioCliente,
      fotos,
      items
    } = req.body;
    if (!pedidoId || !clienteId || !proyecto || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "pedidoId, clienteId, proyecto e items son obligatorios" }
      });
    }
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Pedido no encontrado" } });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
    }
    const computedItems = items.map((item, index) => {
      const categoria = item.categoria || "Insumo";
      let cantidad = Number(item.cantidad);
      let precioUnitario = Number(item.precioUnitario);
      if (categoria === "ManoDeObra" && item.horas != null && item.tarifa != null) {
        cantidad = Number(item.horas);
        precioUnitario = Number(item.tarifa);
      }
      const total2 = cantidad * precioUnitario;
      return {
        descripcion: item.descripcion,
        cantidad,
        precioUnitario,
        total: total2,
        orden: index,
        categoria,
        horas: categoria === "ManoDeObra" && item.horas != null ? Number(item.horas) : null,
        tarifa: categoria === "ManoDeObra" && item.tarifa != null ? Number(item.tarifa) : null
      };
    });
    const costoTotal = computedItems.reduce((sum, item) => sum + item.total, 0);
    const finalMarkup = markup !== void 0 ? Number(markup) : 0.35;
    const venta1 = finalMarkup > 0 ? costoTotal * (1 + finalMarkup / 100) : costoTotal;
    const total = venta1;
    const presupuestoId = crypto.randomUUID();
    let fotosGuardadas = [];
    if (fotos && Array.isArray(fotos) && fotos.length > 0) {
      try {
        fotosGuardadas = await guardarFotosPresupuesto(presupuestoId, fotos);
      } catch (err) {
        logger2.error("[PRESUPUESTOS] Error uploading photos:", err);
      }
    }
    const presupuesto = await prisma.presupuesto.create({
      data: {
        id: presupuestoId,
        pedidoId,
        clienteId,
        clienteNombre: cliente.nombre,
        proyecto,
        contacto: contacto || null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaTope: fechaTope ? new Date(fechaTope) : null,
        estado: "Borrador",
        total,
        markup: finalMarkup,
        costoTotal,
        venta1,
        venta2: null,
        comentarioCliente: comentarioCliente || null,
        fotos: fotosGuardadas,
        items: {
          create: computedItems.map((item) => ({
            id: crypto.randomUUID(),
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            total: item.total,
            orden: item.orden,
            categoria: item.categoria,
            horas: item.horas,
            tarifa: item.tarifa
          }))
        }
      },
      include: { items: true }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "create_presupuesto",
      recurso: `/api/admin/presupuestos/${presupuesto.id}`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.status(201).json({ success: true, data: presupuesto, message: "Presupuesto creado" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error creating:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear presupuesto" } });
  }
});
presupuestosRouter.put("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (existing.registroId) {
      return res.status(400).json({ success: false, error: { code: "ALREADY_CONVERTED", message: "No se puede editar un presupuesto ya convertido a registro" } });
    }
    const { proyecto, contacto, fechaInicio, fechaTope, markup, comentarioCliente, fotos, items, venta2 } = req.body;
    let total = Number(existing.total);
    let costoTotal = existing.costoTotal != null ? Number(existing.costoTotal) : null;
    let venta1 = existing.venta1 != null ? Number(existing.venta1) : null;
    if (items && Array.isArray(items) && items.length > 0) {
      await prisma.presupuestoItem.deleteMany({ where: { presupuestoId: id } });
      const computedItems = items.map((item, index) => {
        const categoria = item.categoria || "Insumo";
        let cantidad = Number(item.cantidad);
        let precioUnitario = Number(item.precioUnitario);
        if (categoria === "ManoDeObra" && item.horas != null && item.tarifa != null) {
          cantidad = Number(item.horas);
          precioUnitario = Number(item.tarifa);
        }
        const totalItem = cantidad * precioUnitario;
        return {
          id: crypto.randomUUID(),
          presupuestoId: id,
          descripcion: item.descripcion,
          cantidad,
          precioUnitario,
          total: totalItem,
          orden: index,
          categoria,
          horas: categoria === "ManoDeObra" && item.horas != null ? Number(item.horas) : null,
          tarifa: categoria === "ManoDeObra" && item.tarifa != null ? Number(item.tarifa) : null
        };
      });
      costoTotal = computedItems.reduce((sum, item) => sum + item.total, 0);
      const mk = markup !== void 0 ? Number(markup) : Number(existing.markup);
      venta1 = mk > 0 ? Number(costoTotal) * (1 + mk / 100) : Number(costoTotal);
      total = Number(venta1);
      await prisma.presupuestoItem.createMany({ data: computedItems });
    }
    let fotosParaGuardar;
    if (fotos !== void 0) {
      if (Array.isArray(fotos) && fotos.length > 0) {
        const fotosExistentes = existing.fotos || [];
        const nuevasBase64 = fotos.filter((f) => f.startsWith("data:"));
        const urlsExistentes = fotos.filter((f) => !f.startsWith("data:"));
        let subidas = [];
        if (nuevasBase64.length > 0) {
          try {
            subidas = await guardarFotosPresupuesto(id, nuevasBase64);
          } catch (err) {
            logger2.error("[PRESUPUESTOS] Error uploading photos on edit:", err);
          }
        }
        fotosParaGuardar = [...urlsExistentes, ...subidas];
      } else if (Array.isArray(fotos) && fotos.length === 0) {
        fotosParaGuardar = [];
      }
    }
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        proyecto: proyecto || void 0,
        contacto: contacto !== void 0 ? contacto : void 0,
        fechaInicio: fechaInicio !== void 0 ? fechaInicio ? new Date(fechaInicio) : null : void 0,
        fechaTope: fechaTope !== void 0 ? fechaTope ? new Date(fechaTope) : null : void 0,
        markup: markup !== void 0 ? Number(markup) : void 0,
        comentarioCliente: comentarioCliente !== void 0 ? comentarioCliente : void 0,
        total,
        costoTotal: costoTotal != null ? costoTotal : void 0,
        venta1: venta1 != null ? venta1 : void 0,
        venta2: venta2 !== void 0 ? venta2 ? Number(venta2) : null : void 0,
        fotos: fotosParaGuardar
      },
      include: { items: { orderBy: { orden: "asc" } } }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "update_presupuesto",
      recurso: `/api/admin/presupuestos/${id}`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, data: updated, message: "Presupuesto actualizado" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error updating:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar presupuesto" } });
  }
});
presupuestosRouter.post("/:id/enviar", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (existing.estado !== "Borrador" && existing.estado !== "Rechazado") {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Solo se pueden enviar presupuestos en estado Borrador o Rechazado" } });
    }
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        estado: "Enviado",
        fechaEnvio: /* @__PURE__ */ new Date(),
        respuestaCliente: null,
        fechaRespuesta: null
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "send_presupuesto",
      recurso: `/api/admin/presupuestos/${id}/enviar`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, data: updated, message: "Presupuesto enviado al cliente" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error sending:", error);
    res.status(500).json({ success: false, error: { code: "SEND_ERROR", message: "Error al enviar presupuesto" } });
  }
});
presupuestosRouter.post("/:id/responder", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const { respuesta, comentario } = req.body;
    if (!respuesta || !["Aprobado", "Rechazado"].includes(respuesta)) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "respuesta debe ser 'Aprobado' o 'Rechazado'" } });
    }
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (existing.estado !== "Enviado") {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Solo se puede responder a presupuestos en estado Enviado" } });
    }
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        estado: respuesta,
        respuestaCliente: comentario || null,
        fechaRespuesta: /* @__PURE__ */ new Date()
      }
    });
    if (respuesta === "Aprobado" && existing.pedidoId) {
      await prisma.pedido.updateMany({
        where: { id: existing.pedidoId, estado: "Pendiente" },
        data: { estado: "En Proceso" }
      });
    }
    auditLog({
      usuario: req.user.usuario,
      accion: "respond_presupuesto",
      recurso: `/api/admin/presupuestos/${id}/responder`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, data: updated, message: `Presupuesto ${respuesta.toLowerCase()}` });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error responding:", error);
    res.status(500).json({ success: false, error: { code: "RESPOND_ERROR", message: "Error al registrar respuesta" } });
  }
});
presupuestosRouter.post("/:id/convertir", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: { items: true, cliente: true, pedido: true }
    });
    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (presupuesto.estado !== "Aprobado") {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Solo se pueden convertir presupuestos Aprobados" } });
    }
    if (presupuesto.registroId) {
      return res.status(400).json({ success: false, error: { code: "ALREADY_CONVERTED", message: "Este presupuesto ya fue convertido a registro" } });
    }
    let proyecto = await prisma.proyecto.findFirst({
      where: { clienteId: presupuesto.clienteId, nombre: presupuesto.proyecto }
    });
    if (!proyecto) {
      proyecto = await prisma.proyecto.create({
        data: {
          id: crypto.randomUUID(),
          clienteId: presupuesto.clienteId,
          nombre: presupuesto.proyecto,
          estado: "PENDIENTE",
          fechaInicio: presupuesto.fechaInicio || /* @__PURE__ */ new Date()
        }
      });
    }
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: { estado: "En Proceso" }
    });
    if (presupuesto.pedidoId) {
      await prisma.pedido.updateMany({
        where: { id: presupuesto.pedidoId },
        data: { estado: "En Proceso" }
      });
    }
    auditLog({
      usuario: req.user.usuario,
      accion: "convert_presupuesto",
      recurso: `/api/admin/presupuestos/${id}/convertir`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({
      success: true,
      data: { presupuesto: updated },
      message: `Presupuesto "${presupuesto.proyecto}" pasado a En Proceso. Los operarios cargan mano de obra desde Registro Operativo.`
    });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error converting:", error);
    res.status(500).json({ success: false, error: { code: "CONVERT_ERROR", message: "Error al convertir presupuesto" } });
  }
});
presupuestosRouter.get("/by-pedido/:pedidoId", requireAuth, requireAdmin, async (req, res) => {
  const { pedidoId } = req.params;
  try {
    const presupuestos = await prisma.presupuesto.findMany({
      where: { pedidoId },
      orderBy: { createdAt: "desc" },
      include: { items: true }
    });
    res.json({ success: true, data: presupuestos });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error fetching by pedido:", error);
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: "Error al obtener presupuestos del pedido" } });
  }
});
presupuestosRouter.get("/:id/pdf", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: "asc" } },
        pedido: true,
        cliente: true
      }
    });
    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const fechaObj = presupuesto.createdAt ? new Date(presupuesto.createdAt) : /* @__PURE__ */ new Date();
    const fechaFormal = `${fechaObj.getDate()} de ${meses[fechaObj.getMonth()]} de ${fechaObj.getFullYear()}`;
    const montoTotal = Number(presupuesto.venta2 ?? presupuesto.total);
    const montoFormateado = "Gs. " + Math.round(montoTotal).toLocaleString("es-PY");
    let detallesHtml = "";
    if (presupuesto.items && presupuesto.items.length > 0) {
      detallesHtml = presupuesto.items.map((it) => {
        const cantStr = Number(it.cantidad) > 1 ? ` (${Number(it.cantidad)})` : "";
        return `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">${it.descripcion}${cantStr}</div></div>`;
      }).join("");
    } else if (presupuesto.pedido?.descripcion) {
      detallesHtml = `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">${presupuesto.pedido.descripcion}</div></div>`;
    } else {
      detallesHtml = `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">Trabajos generales de publicidad e impresi\xF3n seg\xFAn especificaciones.</div></div>`;
    }
    const fotos = presupuesto.fotos || [];
    let bocetosHtml = "";
    if (fotos.length > 0) {
      bocetosHtml = `
        <div class="seccion-bocetos">
          <h3 class="subtitulo">Bocetos</h3>
          <div class="bocetos-grid">
            ${fotos.map((f, i) => `<div class="boceto-card"><img src="${f}" alt="Boceto ${i + 1}" /></div>`).join("")}
          </div>
        </div>
      `;
    }
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto \u2014 ${presupuesto.clienteNombre} \u2014 ${presupuesto.proyecto}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    background: #fff;
    padding: 24mm 22mm;
    max-width: 210mm;
    margin: 0 auto;
    font-size: 11pt;
    line-height: 1.45;
  }
  .header-logo {
    margin-bottom: 25px;
  }
  .logo-img {
    height: 38px;
    object-fit: contain;
  }
  .titulo-doc {
    text-align: center;
    font-size: 17pt;
    font-weight: bold;
    margin-bottom: 30px;
    letter-spacing: 0.5px;
  }
  .datos-principales {
    margin-bottom: 25px;
  }
  .fila-dato {
    margin-bottom: 12px;
    font-size: 11pt;
  }
  .fila-dato strong {
    font-weight: bold;
    display: inline-block;
    min-width: 90px;
  }
  .seccion-detalles {
    margin-top: 20px;
    margin-bottom: 25px;
  }
  .seccion-detalles .titulo-detalles {
    font-weight: bold;
    margin-bottom: 12px;
  }
  .detalle-item {
    display: flex;
    align-items: flex-start;
    margin-bottom: 14px;
    padding-left: 15px;
  }
  .detalle-item .bullet {
    margin-right: 12px;
    font-weight: bold;
  }
  .detalle-texto {
    flex: 1;
  }
  .total-caja {
    margin-top: 25px;
    margin-bottom: 35px;
    font-size: 12pt;
    font-weight: bold;
  }
  .seccion-bocetos {
    margin-top: 20px;
    margin-bottom: 35px;
  }
  .subtitulo {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 14px;
  }
  .bocetos-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .boceto-card {
    border-radius: 4px;
    overflow: hidden;
    background: #f4f4f4;
    max-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .boceto-card img {
    width: 100%;
    height: 100%;
    max-height: 180px;
    object-fit: cover;
  }
  .footer-comercial {
    margin-top: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8f8f8;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e2e2e2;
  }
  .footer-info {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    gap: 15px;
  }
  .footer-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14pt;
  }
  .footer-textos .nombre {
    color: #d97706;
    font-weight: bold;
    font-size: 11pt;
    line-height: 1.1;
  }
  .footer-textos .cargo {
    font-size: 8.5pt;
    color: #666;
  }
  .footer-contacto {
    text-align: right;
    font-size: 9pt;
    color: #444;
    padding-right: 20px;
  }
  .footer-badge-afull {
    background: #ea580c;
    color: #fff;
    padding: 16px 24px;
    font-weight: bold;
    font-size: 14pt;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
  }
  @media print {
    body { padding: 0; }
    .footer-comercial { page-break-inside: avoid; }
    .bocetos-grid { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header-logo">
    <img src="${LOGO_AFULL_DATA_URI}" alt="aFULL" class="logo-img" />
  </div>

  <div class="titulo-doc">Presupuesto</div>

  <div class="datos-principales">
    <div class="fila-dato"><strong>Cliente:</strong> ${presupuesto.clienteNombre}</div>
    <div class="fila-dato"><strong>Contacto:</strong> ${presupuesto.contacto || "Responsable designado"}</div>
    <div class="fila-dato"><strong>Fecha:</strong> ${fechaFormal}</div>
    <div class="fila-dato"><strong>Proyecto:</strong> ${presupuesto.proyecto}</div>
  </div>

  <div class="seccion-detalles">
    <div class="titulo-detalles">Detalles:</div>
    ${detallesHtml}
  </div>

  <div class="total-caja">
    Total de los trabajos: ${montoFormateado} I.V.A. incluido.
  </div>

  ${bocetosHtml}

  <div class="footer-comercial">
    <div class="footer-info">
      <div class="footer-avatar">JL</div>
      <div class="footer-textos">
        <div class="nombre">Juan<br>Lisboa</div>
        <div class="cargo">Ejecutivo Senior</div>
      </div>
    </div>
    <div class="footer-contacto">
      <div>+595 981 266166</div>
      <div>afullpy@gmail.com</div>
    </div>
    <div class="footer-badge-afull">
      aFULL
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error generating PDF:", error);
    res.status(500).json({ success: false, error: { code: "PDF_ERROR", message: "Error al generar documento PDF" } });
  }
});
presupuestosRouter.delete("/:id", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (existing.estado !== "Borrador") {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Solo se pueden eliminar presupuestos en estado Borrador" } });
    }
    await prisma.presupuesto.delete({ where: { id } });
    auditLog({
      usuario: req.user.usuario,
      accion: "delete_presupuesto",
      recurso: `/api/admin/presupuestos/${id}`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, message: "Presupuesto eliminado" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error deleting:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar presupuesto" } });
  }
});
presupuestosRouter.post("/:id/orden-trabajo", requireAuth, requireAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: { items: true, pedido: true, cliente: true }
    });
    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Presupuesto no encontrado" } });
    }
    if (presupuesto.estado !== "Aprobado") {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Solo se pueden generar OT de presupuestos Aprobados" } });
    }
    const fmtFecha = (d) => {
      if (!d) return "\u2014";
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };
    const detallesParts = [];
    if (presupuesto.pedido?.descripcion) {
      detallesParts.push(presupuesto.pedido.descripcion);
    }
    if (presupuesto.items.length > 0) {
      detallesParts.push("");
      for (const item of presupuesto.items) {
        detallesParts.push(`\u2022 ${item.descripcion} (Cant: ${Number(item.cantidad)})`);
      }
    }
    const detallesTrabajoDefault = detallesParts.join("\n") || "Sin detalles especificados";
    const comentarioClienteDefault = presupuesto.comentarioCliente || presupuesto.pedido?.comentarioCliente || null;
    const detallesTrabajo = req.body?.detallesTrabajo?.trim?.() || "" || detallesTrabajoDefault;
    const comentarioCliente = req.body?.comentarioCliente?.trim?.() ? req.body.comentarioCliente.trim() : comentarioClienteDefault;
    const lineas = [
      `Cliente: ${presupuesto.clienteNombre}`,
      `Contacto: ${presupuesto.contacto || "\u2014"}`,
      `Proyecto: ${presupuesto.proyecto}`,
      `Fecha de inicio: ${fmtFecha(presupuesto.fechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(presupuesto.fechaTope)}`,
      "",
      "Detalles del trabajo",
      detallesTrabajo
    ];
    if (comentarioCliente) {
      lineas.push("", "Comentarios de Cliente", comentarioCliente);
    }
    const mensaje = lineas.join("\n");
    let ot = await prisma.ordenTrabajo.findUnique({
      where: { presupuestoId: id }
    });
    if (ot) {
      ot = await prisma.ordenTrabajo.update({
        where: { id: ot.id },
        data: {
          detallesTrabajo,
          comentarioCliente,
          mensajeWhatsapp: mensaje
        }
      });
    } else {
      ot = await prisma.ordenTrabajo.create({
        data: {
          id: crypto.randomUUID(),
          presupuestoId: id,
          clienteId: presupuesto.clienteId,
          clienteNombre: presupuesto.clienteNombre,
          proyecto: presupuesto.proyecto,
          contacto: presupuesto.contacto,
          fechaInicio: presupuesto.fechaInicio,
          fechaTope: presupuesto.fechaTope,
          detallesTrabajo,
          comentarioCliente,
          estado: "Generada",
          mensajeWhatsapp: mensaje
        }
      });
    }
    const { telefono } = req.body || {};
    let whatsappUrl;
    if (telefono) {
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, "");
      whatsappUrl = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }
    auditLog({
      usuario: req.user.usuario,
      accion: "generate_ot",
      recurso: `/api/admin/presupuestos/${id}/orden-trabajo`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `OT ${ot.id} generada para presupuesto ${id}`
    });
    res.json({
      success: true,
      data: {
        otId: ot.id,
        mensaje,
        whatsappUrl,
        estado: ot.estado,
        enviadoWhatsapp: ot.enviadoWhatsapp
      },
      message: "Orden de Trabajo generada correctamente"
    });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error generating OT:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al generar Orden de Trabajo" } });
  }
});
presupuestosRouter.put("/ordenes-trabajo/:id", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Orden de Trabajo no encontrada" } });
    }
    const { detallesTrabajo, comentarioCliente, contacto, fechaInicio, fechaTope, estado } = req.body || {};
    const data = {};
    if (detallesTrabajo !== void 0) data.detallesTrabajo = detallesTrabajo;
    if (comentarioCliente !== void 0) data.comentarioCliente = comentarioCliente?.trim() || null;
    if (contacto !== void 0) data.contacto = contacto?.trim() || null;
    if (fechaInicio !== void 0) {
      data.fechaInicio = fechaInicio ? new Date(fechaInicio) : null;
    }
    if (fechaTope !== void 0) {
      data.fechaTope = fechaTope ? new Date(fechaTope) : null;
    }
    if (estado !== void 0) data.estado = estado;
    const fmtFecha = (d) => {
      if (!d) return "\u2014";
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };
    const nuevosDetalles = data.detallesTrabajo !== void 0 ? data.detallesTrabajo : existing.detallesTrabajo;
    const nuevoComentario = data.comentarioCliente !== void 0 ? data.comentarioCliente : existing.comentarioCliente;
    const nuevoContacto = data.contacto !== void 0 ? data.contacto : existing.contacto;
    const nuevaFechaInicio = data.fechaInicio !== void 0 ? data.fechaInicio : existing.fechaInicio;
    const nuevaFechaTope = data.fechaTope !== void 0 ? data.fechaTope : existing.fechaTope;
    const lineas = [
      `Cliente: ${existing.clienteNombre}`,
      `Contacto: ${nuevoContacto || "\u2014"}`,
      `Proyecto: ${existing.proyecto}`,
      `Fecha de inicio: ${fmtFecha(nuevaFechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(nuevaFechaTope)}`,
      "",
      "Detalles del trabajo",
      nuevosDetalles
    ];
    if (nuevoComentario) {
      lineas.push("", "Comentarios de Cliente", nuevoComentario);
    }
    data.mensajeWhatsapp = lineas.join("\n");
    const updated = await prisma.ordenTrabajo.update({
      where: { id },
      data
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "edit_ot",
      recurso: `/api/admin/ordenes-trabajo/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `OT ${id} editada`
    });
    res.json({ success: true, data: updated, message: "Orden de Trabajo actualizada" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error editing OT:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al editar Orden de Trabajo" } });
  }
});
presupuestosRouter.delete("/ordenes-trabajo/:id", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Orden de Trabajo no encontrada" } });
    }
    await prisma.ordenTrabajo.delete({ where: { id } });
    auditLog({
      usuario: req.user.usuario,
      accion: "delete_ot",
      recurso: `/api/admin/ordenes-trabajo/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `OT ${id} eliminada`
    });
    res.json({ success: true, message: "Orden de Trabajo eliminada" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error deleting OT:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al eliminar Orden de Trabajo" } });
  }
});
presupuestosRouter.post("/ordenes-trabajo/:id/marcar-enviado", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Orden de Trabajo no encontrada" } });
    }
    const updated = await prisma.ordenTrabajo.update({
      where: { id },
      data: { enviadoWhatsapp: true, fechaEnvioWsp: /* @__PURE__ */ new Date(), estado: "Enviada" }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "mark_ot_sent",
      recurso: `/api/admin/ordenes-trabajo/${id}/marcar-enviado`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, data: updated, message: "OT marcada como enviada" });
  } catch (error) {
    logger2.error("[PRESUPUESTOS] Error marking OT sent:", error);
    res.status(500).json({ success: false, error: { code: "OT_ERROR", message: "Error al marcar OT como enviada" } });
  }
});

// src/server/routes/hojasRuta.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router15 } from "express";
import crypto4 from "crypto";
var hojasRutaRouter = Router15();
hojasRutaRouter.get("/", requireAuth, requireProduccionOrAdmin, async (req, res) => {
  try {
    const {
      estado,
      clienteId,
      operarioId,
      search,
      page = "1",
      limit = "20",
      orderBy = "createdAt",
      orderDir = "desc"
    } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (operarioId) {
      where.tareas = { some: { colaboradorId: operarioId } };
    }
    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [
          { clienteNombre: { contains: q, mode: "insensitive" } },
          { proyecto: { contains: q, mode: "insensitive" } }
        ];
      }
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const validOrderBy = {
      createdAt: "createdAt",
      fecha: "fecha",
      clienteNombre: "clienteNombre",
      proyecto: "proyecto",
      estado: "estado"
    };
    const sortField = validOrderBy[orderBy] || "createdAt";
    const sortDir = orderDir === "asc" ? "asc" : "desc";
    const [hojas, total] = await Promise.all([
      prisma.hojaRuta.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limitNum,
        include: {
          ordenTrabajo: { select: { id: true, estado: true } },
          _count: { select: { tareas: true } }
        }
      }),
      prisma.hojaRuta.count({ where })
    ]);
    res.json({
      success: true,
      data: hojas,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error listing:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar hojas de ruta" } });
  }
});
hojasRutaRouter.get("/:id", requireAuth, requireProduccionOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const hoja = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        ordenTrabajo: true,
        tareas: {
          orderBy: { orden: "asc" },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } }
        }
      }
    });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Hoja de ruta no encontrada" } });
    }
    res.json({ success: true, data: hoja });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error get by id:", error);
    res.status(500).json({ success: false, error: { code: "GET_ERROR", message: "Error al obtener hoja de ruta" } });
  }
});
hojasRutaRouter.post("/", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  try {
    const { ordenTrabajoId } = req.body;
    if (!ordenTrabajoId) {
      return res.status(400).json({ success: false, error: { code: "MISSING_OT", message: "Falta el id de la Orden de Trabajo" } });
    }
    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id: ordenTrabajoId },
      include: {
        presupuesto: {
          include: { items: { orderBy: { orden: "asc" } } }
        }
      }
    });
    if (!ot) {
      return res.status(404).json({ success: false, error: { code: "OT_NOT_FOUND", message: "Orden de Trabajo no encontrada" } });
    }
    const existente = await prisma.hojaRuta.findUnique({
      where: { ordenTrabajoId }
    });
    if (existente) {
      return res.status(409).json({ success: false, error: { code: "ALREADY_EXISTS", message: "Esta OT ya tiene una hoja de ruta" } });
    }
    const hoja = await prisma.hojaRuta.create({
      data: {
        id: crypto4.randomUUID(),
        ordenTrabajoId: ot.id,
        clienteId: ot.clienteId,
        clienteNombre: ot.clienteNombre,
        proyecto: ot.proyecto,
        fecha: /* @__PURE__ */ new Date(),
        estado: "Borrador",
        notas: ot.detallesTrabajo
      }
    });
    if (ot.presupuesto?.items && ot.presupuesto.items.length > 0) {
      const tareas = ot.presupuesto.items.map((item, index) => ({
        id: crypto4.randomUUID(),
        hojaRutaId: hoja.id,
        colaboradorId: null,
        // sin asignar — el admin asigna después
        operarioNombre: "Sin asignar",
        orden: index,
        descripcion: item.descripcion,
        categoria: item.categoria || "Otro",
        cantidad: item.cantidad,
        unidad: "u",
        estado: "Pendiente",
        fechaAsignada: /* @__PURE__ */ new Date()
      }));
      await prisma.hojaRutaTarea.createMany({ data: tareas });
    } else {
      await prisma.hojaRutaTarea.create({
        data: {
          id: crypto4.randomUUID(),
          hojaRutaId: hoja.id,
          operarioNombre: "Sin asignar",
          orden: 0,
          descripcion: "",
          estado: "Pendiente",
          fechaAsignada: /* @__PURE__ */ new Date()
        }
      });
    }
    const hojaCompleta = await prisma.hojaRuta.findUnique({
      where: { id: hoja.id },
      include: {
        tareas: {
          orderBy: { orden: "asc" },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } }
        }
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "create_hoja_ruta",
      recurso: `/api/admin/hojas-ruta/${hoja.id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${hoja.id} creada para OT ${ot.id}`
    });
    res.json({
      success: true,
      data: hojaCompleta,
      message: "Hoja de ruta generada correctamente"
    });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error creating:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al generar hoja de ruta" } });
  }
});
hojasRutaRouter.put("/:id", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas, tareas } = req.body;
    const hoja = await prisma.hojaRuta.findUnique({ where: { id } });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Hoja de ruta no encontrada" } });
    }
    const updateData = {};
    if (estado !== void 0) updateData.estado = estado;
    if (notas !== void 0) updateData.notas = notas;
    if (Object.keys(updateData).length > 0) {
      await prisma.hojaRuta.update({ where: { id }, data: updateData });
    }
    if (Array.isArray(tareas)) {
      const colaboradorIds = tareas.map((t) => t.colaboradorId).filter((cid) => cid);
      const colaboradores = await prisma.colaborador.findMany({
        where: { id: { in: colaboradorIds } },
        select: { id: true, nombre: true }
      });
      const colabMap = new Map(colaboradores.map((c) => [c.id, c.nombre]));
      await prisma.hojaRutaTarea.deleteMany({ where: { hojaRutaId: id } });
      if (tareas.length > 0) {
        await prisma.hojaRutaTarea.createMany({
          data: tareas.map((t, index) => ({
            id: crypto4.randomUUID(),
            hojaRutaId: id,
            colaboradorId: t.colaboradorId || null,
            operarioNombre: t.colaboradorId ? colabMap.get(t.colaboradorId) || "Sin asignar" : t.operarioNombre || "Sin asignar",
            orden: index,
            descripcion: t.descripcion || "",
            categoria: t.categoria || "Otro",
            cantidad: t.cantidad ?? null,
            unidad: t.unidad || "u",
            estado: t.estado || "Pendiente",
            fechaAsignada: t.fechaAsignada ? new Date(t.fechaAsignada) : /* @__PURE__ */ new Date(),
            notasOperario: t.notasOperario || null
          }))
        });
      }
    }
    const hojaActualizada = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        ordenTrabajo: true,
        tareas: {
          orderBy: { orden: "asc" },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } }
        }
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "update_hoja_ruta",
      recurso: `/api/admin/hojas-ruta/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} actualizada`
    });
    res.json({ success: true, data: hojaActualizada, message: "Hoja de ruta actualizada" });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error updating:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar hoja de ruta" } });
  }
});
hojasRutaRouter.delete("/:id", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const hoja = await prisma.hojaRuta.findUnique({ where: { id } });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Hoja de ruta no encontrada" } });
    }
    await prisma.hojaRuta.delete({ where: { id } });
    auditLog({
      usuario: req.user.usuario,
      accion: "delete_hoja_ruta",
      recurso: `/api/admin/hojas-ruta/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} eliminada`
    });
    res.json({ success: true, message: "Hoja de ruta eliminada" });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error deleting:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar hoja de ruta" } });
  }
});
hojasRutaRouter.post("/:id/whatsapp", requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { operarioId, telefono } = req.body || {};
    const hoja = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        tareas: {
          orderBy: { orden: "asc" },
          include: { colaborador: { select: { id: true, nombre: true } } }
        }
      }
    });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Hoja de ruta no encontrada" } });
    }
    let tareas = hoja.tareas;
    if (operarioId) {
      tareas = tareas.filter((t) => t.colaboradorId === operarioId);
    }
    if (tareas.length === 0) {
      return res.status(400).json({ success: false, error: { code: "NO_TASKS", message: "No hay tareas para generar el mensaje" } });
    }
    const porOperario = /* @__PURE__ */ new Map();
    for (const t of tareas) {
      const key = t.operarioNombre || "Sin asignar";
      if (!porOperario.has(key)) porOperario.set(key, []);
      porOperario.get(key).push(t);
    }
    const fmtFecha = (d) => {
      if (!d) return "\u2014";
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };
    const lineas = [];
    lineas.push(`*Hoja de Ruta \u2014 ${hoja.clienteNombre}*`);
    lineas.push(`Proyecto: ${hoja.proyecto}`);
    lineas.push(`Fecha: ${fmtFecha(hoja.fecha)}`);
    lineas.push("");
    for (const [operario, tareasOperario] of porOperario) {
      lineas.push(`\u26D4${operario}\u26D4`);
      for (const t of tareasOperario) {
        let linea = t.descripcion;
        if (t.cantidad) {
          linea += ` (Cant: ${Number(t.cantidad)} ${t.unidad || "u"})`;
        }
        lineas.push(linea);
      }
      lineas.push("");
    }
    const mensaje = lineas.join("\n").trim();
    let whatsappUrl;
    if (telefono) {
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, "");
      whatsappUrl = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }
    await prisma.hojaRuta.update({
      where: { id },
      data: {
        enviadoWhatsapp: true,
        fechaEnvioWsp: /* @__PURE__ */ new Date(),
        ...hoja.estado === "Borrador" ? { estado: "Activa" } : {}
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "send_hoja_ruta_whatsapp",
      recurso: `/api/admin/hojas-ruta/${id}/whatsapp`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} enviada por WhatsApp${operarioId ? " (operario: " + operarioId + ")" : ""}`
    });
    res.json({
      success: true,
      data: { mensaje, whatsappUrl, enviadoWhatsapp: true },
      message: "Mensaje de WhatsApp generado"
    });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error generating whatsapp:", error);
    res.status(500).json({ success: false, error: { code: "WSP_ERROR", message: "Error al generar mensaje de WhatsApp" } });
  }
});
hojasRutaRouter.get("/meta/colaboradores", requireAuth, requireProduccionOrAdmin, async (req, res) => {
  try {
    const colaboradores = await prisma.colaborador.findMany({
      where: {},
      select: { id: true, nombre: true, rol: true, tarifaSugerida: true },
      orderBy: { nombre: "asc" }
    });
    res.json({ success: true, data: colaboradores });
  } catch (error) {
    logger2.error("[HOJAS_RUTA] Error listing colaboradores:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar colaboradores" } });
  }
});

// src/server/routes/operario.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router16 } from "express";
import fs6 from "fs";
import path6 from "path";
var operarioRouter = Router16();
async function guardarFotoEvidenciaTarea(tareaId, fotoBase64) {
  if (!fotoBase64 || !fotoBase64.startsWith("data:")) return fotoBase64;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const raw = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (supabaseUrl && supabaseServiceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const storagePath = `tareas/${tareaId}/evidencia_${Date.now()}.jpg`;
    const { error } = await supabaseAdmin.storage.from("vehiculos-fotos").upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      logger2.warn("[OPERARIO] Fallback to local storage:", error.message);
    } else {
      const { data } = supabaseAdmin.storage.from("vehiculos-fotos").getPublicUrl(storagePath);
      return data.publicUrl;
    }
  }
  const uploadsDir = path6.join(process.cwd(), "uploads", "tareas", tareaId);
  await fs6.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `evidencia_${Date.now()}.jpg`;
  await fs6.promises.writeFile(path6.join(uploadsDir, filename), buffer);
  return `/uploads/tareas/${tareaId}/${filename}`;
}
async function resolveOperarioColaborador(user) {
  if (user.colaboradorId) {
    const colab = await prisma.colaborador.findUnique({ where: { id: user.colaboradorId }, select: { id: true, nombre: true } });
    if (colab) return colab;
  }
  const dbUser = await prisma.usuario.findUnique({
    where: { username: user.usuario },
    select: { colaboradorId: true, nombre: true }
  });
  if (dbUser?.colaboradorId) {
    const colab = await prisma.colaborador.findUnique({ where: { id: dbUser.colaboradorId }, select: { id: true, nombre: true } });
    if (colab) return colab;
  }
  const targetNombre = dbUser?.nombre || user.nombre;
  if (targetNombre) {
    const colab = await prisma.colaborador.findFirst({
      where: {
        OR: [
          { nombre: { equals: targetNombre, mode: "insensitive" } },
          { nombre: { contains: targetNombre, mode: "insensitive" } }
        ]
      },
      select: { id: true, nombre: true }
    });
    if (colab) return colab;
  }
  return { id: null, nombre: targetNombre || null };
}
operarioRouter.get("/tareas", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const operario = await resolveOperarioColaborador(user);
    const orConditions = [];
    if (operario.id) orConditions.push({ colaboradorId: operario.id });
    if (operario.nombre) orConditions.push({ operarioNombre: { contains: operario.nombre, mode: "insensitive" } });
    if (user.rol !== "ADMIN" && orConditions.length === 0) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    }
    const { fecha, estado, page = "1", limit = "50" } = req.query;
    const where = {};
    if (user.rol !== "ADMIN" && orConditions.length > 0) {
      where.OR = orConditions;
    }
    if (estado) where.estado = estado;
    if (fecha) {
      const dia = new Date(fecha);
      const diaSig = new Date(dia);
      diaSig.setDate(diaSig.getDate() + 1);
      where.fechaAsignada = { gte: dia, lt: diaSig };
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;
    const [tareas, total] = await Promise.all([
      prisma.hojaRutaTarea.findMany({
        where,
        orderBy: [{ fechaAsignada: "desc" }, { orden: "asc" }],
        skip,
        take: limitNum,
        include: {
          hojaRuta: {
            select: { id: true, clienteNombre: true, proyecto: true, fecha: true, estado: true }
          }
        }
      }),
      prisma.hojaRutaTarea.count({ where })
    ]);
    res.json({
      success: true,
      data: tareas,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger2.error("[OPERARIO] Error listing tareas:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar tareas" } });
  }
});
operarioRouter.get("/tareas/hoy", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const operario = await resolveOperarioColaborador(user);
    const orConditions = [];
    if (operario.id) orConditions.push({ colaboradorId: operario.id });
    if (operario.nombre) orConditions.push({ operarioNombre: { contains: operario.nombre, mode: "insensitive" } });
    if (user.rol !== "ADMIN" && orConditions.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const hoy = /* @__PURE__ */ new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const where = {
      fechaAsignada: { gte: hoy, lt: manana }
    };
    if (user.rol !== "ADMIN" && orConditions.length > 0) {
      where.OR = orConditions;
    }
    const tareas = await prisma.hojaRutaTarea.findMany({
      where,
      orderBy: [{ orden: "asc" }, { fechaAsignada: "desc" }],
      include: {
        hojaRuta: {
          select: { id: true, clienteNombre: true, proyecto: true, fecha: true }
        }
      }
    });
    res.json({ success: true, data: tareas });
  } catch (error) {
    logger2.error("[OPERARIO] Error listing tareas hoy:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar tareas de hoy" } });
  }
});
operarioRouter.put("/tareas/:tareaId", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { tareaId } = req.params;
    const { estado, notasOperario, fotoUrl } = req.body;
    const operario = await resolveOperarioColaborador(user);
    const tarea = await prisma.hojaRutaTarea.findUnique({
      where: { id: tareaId }
    });
    if (!tarea) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Tarea no encontrada" } });
    }
    const isOwner = user.rol === "ADMIN" || operario.id && tarea.colaboradorId === operario.id || operario.nombre && tarea.operarioNombre?.toLowerCase().includes(operario.nombre.toLowerCase());
    if (!isOwner) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Esta tarea no est\xE1 asignada a usted" } });
    }
    const estadosValidos = ["Pendiente", "EnProgreso", "Completada", "Omitida"];
    const nuevoEstado = estado || tarea.estado;
    if (!estadosValidos.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Estado no v\xE1lido" } });
    }
    const updateData = { estado: nuevoEstado };
    if (notasOperario !== void 0) updateData.notasOperario = notasOperario;
    if (fotoUrl !== void 0) {
      if (fotoUrl && fotoUrl.startsWith("data:")) {
        updateData.fotoUrl = await guardarFotoEvidenciaTarea(tareaId, fotoUrl);
      } else {
        updateData.fotoUrl = fotoUrl;
      }
    }
    if (nuevoEstado === "EnProgreso" && !tarea.fechaInicio) {
      updateData.fechaInicio = /* @__PURE__ */ new Date();
    }
    if (nuevoEstado === "Completada" && !tarea.fechaFin) {
      updateData.fechaFin = /* @__PURE__ */ new Date();
    }
    if (nuevoEstado !== "Completada" && nuevoEstado !== "Omitida") {
      if (tarea.fechaFin) updateData.fechaFin = null;
    }
    const actualizada = await prisma.hojaRutaTarea.update({
      where: { id: tareaId },
      data: updateData
    });
    if (nuevoEstado === "EnProgreso") {
      const hojaPadre = await prisma.hojaRuta.findUnique({
        where: { id: tarea.hojaRutaId },
        select: { estado: true }
      });
      if (hojaPadre && hojaPadre.estado === "Borrador") {
        await prisma.hojaRuta.update({
          where: { id: tarea.hojaRutaId },
          data: { estado: "Activa" }
        });
      }
    }
    if (nuevoEstado === "Completada" || nuevoEstado === "Omitida") {
      const tareasHoja = await prisma.hojaRutaTarea.findMany({
        where: { hojaRutaId: tarea.hojaRutaId },
        select: { estado: true }
      });
      const todasCerradas = tareasHoja.every((t) => t.estado === "Completada" || t.estado === "Omitida");
      if (todasCerradas && tareasHoja.length > 0) {
        await prisma.hojaRuta.update({
          where: { id: tarea.hojaRutaId },
          data: { estado: "Cerrada" }
        });
      }
    }
    auditLog({
      usuario: user.usuario,
      accion: "update_tarea_operario",
      recurso: `/api/operario/tareas/${tareaId}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Tarea ${tareaId} actualizada a estado ${nuevoEstado}`
    });
    res.json({ success: true, data: actualizada, message: "Tarea actualizada" });
  } catch (error) {
    logger2.error("[OPERARIO] Error updating tarea:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al actualizar tarea" } });
  }
});
operarioRouter.get("/pedidos-activos", requireAuth, async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { archivado: false },
      orderBy: { fechaSolicitud: "desc" },
      take: 100,
      select: {
        id: true,
        descripcion: true,
        sucursalNombre: true,
        marca: true,
        estado: true,
        proyecto: true,
        fotoRemisionUrl: true,
        fotoEntregaUrl: true,
        cliente: { select: { id: true, nombre: true } }
      }
    });
    res.json({
      success: true,
      data: pedidos.map((p) => ({
        id: p.id,
        descripcion: p.descripcion,
        local: p.sucursalNombre,
        marca: p.marca,
        estado: p.estado,
        proyecto: p.proyecto,
        fotoRemisionUrl: p.fotoRemisionUrl,
        fotoEntregaUrl: p.fotoEntregaUrl,
        clienteId: p.cliente.id,
        clienteNombre: p.cliente.nombre
      }))
    });
  } catch (error) {
    logger2.error("[OPERARIO] Error listing pedidos activos:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar pedidos" } });
  }
});
operarioRouter.post("/entregas/foto", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { pedidoId, tipo, fotoBase64, receptorNombre, fechaEntrega } = req.body || {};
    if (!pedidoId) {
      return res.status(400).json({ success: false, error: { code: "MISSING_PEDIDO", message: "Se requiere el ID del pedido" } });
    }
    if (!tipo || tipo !== "remision" && tipo !== "entrega") {
      return res.status(400).json({ success: false, error: { code: "INVALID_TYPE", message: 'El tipo debe ser "remision" o "entrega"' } });
    }
    if (!fotoBase64) {
      return res.status(400).json({ success: false, error: { code: "MISSING_PHOTO", message: "Se requiere la foto en formato base64" } });
    }
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Pedido no encontrado" } });
    }
    const { guardarFotoEntregaStorage: guardarFotoEntregaStorage2 } = await Promise.resolve().then(() => (init_pedidos_routes(), pedidos_routes_exports));
    const photoUrl = await guardarFotoEntregaStorage2(pedidoId, fotoBase64, tipo);
    const updateData = {};
    if (tipo === "remision") {
      updateData.fotoRemisionUrl = photoUrl;
    } else {
      updateData.fotoEntregaUrl = photoUrl;
    }
    if (receptorNombre) updateData.receptorNombre = String(receptorNombre).slice(0, 100);
    updateData.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : /* @__PURE__ */ new Date();
    if (pedido.estado !== "Entregado") {
      updateData.estado = "Entregado";
      if (!pedido.fechaFin) updateData.fechaFin = /* @__PURE__ */ new Date();
    }
    const updated = await prisma.pedido.update({
      where: { id: pedidoId },
      data: updateData
    });
    auditLog({
      usuario: user.usuario,
      accion: "operario_subir_entrega",
      recurso: `/api/operario/entregas/foto`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Operario ${user.usuario} subi\xF3 foto de ${tipo} para pedido ${pedidoId}`
    });
    res.json({
      success: true,
      data: {
        id: updated.id,
        fotoUrl: photoUrl,
        tipo,
        estado: updated.estado,
        fotoRemisionUrl: updated.fotoRemisionUrl,
        fotoEntregaUrl: updated.fotoEntregaUrl,
        fechaEntrega: updated.fechaEntrega,
        receptorNombre: updated.receptorNombre
      },
      message: `Foto de ${tipo === "remision" ? "remisi\xF3n" : "entrega"} guardada correctamente`
    });
  } catch (error) {
    logger2.error("[OPERARIO] Error uploading entrega photo:", error);
    res.status(500).json({ success: false, error: { code: "UPLOAD_ERROR", message: "Error al subir foto de entrega" } });
  }
});

// src/server/routes/data.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router17 } from "express";
var dataRouter = Router17();
dataRouter.get("/data", requireAuth, async (req, res) => {
  try {
    const [clientes, proyectos, colaboradores, registros, registrosVehiculo, timersActivos, viajesActivos, usuarios] = await Promise.all([
      prisma.cliente.findMany({ orderBy: { fechaCreacion: "desc" } }),
      prisma.proyecto.findMany({ orderBy: { fechaInicio: "desc" } }),
      prisma.colaborador.findMany({ orderBy: { nombre: "asc" } }),
      prisma.registro.findMany({ orderBy: { fecha: "desc" } }),
      prisma.registroVehiculo.findMany({ orderBy: { fecha: "desc" } }),
      prisma.timerActivo.findMany({ where: { activo: true } }),
      prisma.viajeActivo.findMany({ where: { activo: true } }),
      prisma.usuario.findMany()
    ]);
    const data = convertPrismaToFrontend({
      clientes,
      proyectos,
      colaboradores,
      registros,
      registrosVehiculo,
      timersActivos,
      viajesActivos,
      usuarios
    });
    res.json({ success: true, data });
  } catch (error) {
    logger2.error("Error reading data:", error);
    res.status(500).json({
      success: false,
      error: { code: "READ_ERROR", message: "Error al leer datos" }
    });
  }
});
dataRouter.post("/clear", requireAuth, requireAdmin, async (req, res) => {
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  try {
    await prisma.$transaction([
      prisma.registro.deleteMany({}),
      prisma.registroVehiculo.deleteMany({}),
      prisma.timerActivo.deleteMany({}),
      prisma.viajeActivo.deleteMany({}),
      prisma.proyecto.deleteMany({}),
      prisma.colaborador.deleteMany({}),
      prisma.cliente.deleteMany({})
    ]);
    auditLog({
      usuario: userPayload.usuario,
      accion: "clear_database",
      recurso: "/api/clear",
      resultado: "success",
      ip: clientIp
    });
    res.json({
      success: true,
      message: "Base de datos limpiada completamente en Supabase"
    });
  } catch (error) {
    console.error("Error clearing database:", error);
    auditLog({
      usuario: userPayload.usuario,
      accion: "clear_database",
      recurso: "/api/clear",
      resultado: "failure",
      ip: clientIp
    });
    res.status(500).json({
      success: false,
      error: { code: "CLEAR_ERROR", message: "Error al restaurar base de datos" }
    });
  }
});
dataRouter.post("/admin/cleanup-duplicates", requireAuth, requireAdmin, async (req, res) => {
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  const dryRun = req.body?.dryRun !== false;
  try {
    const report = {
      dryRun,
      clientesDuplicados: [],
      registrosReasignados: 0,
      eliminados: { clientes: 0, proyectos: 0 }
    };
    const todosClientes = await prisma.cliente.findMany({
      include: { _count: { select: { registros: true, proyectos: true } } }
    });
    const clientesPorNombre = /* @__PURE__ */ new Map();
    for (const c of todosClientes) {
      const key = c.nombre.toLowerCase().trim();
      if (!clientesPorNombre.has(key)) clientesPorNombre.set(key, []);
      clientesPorNombre.get(key).push(c);
    }
    for (const [_nombre, grupo] of clientesPorNombre) {
      if (grupo.length <= 1) continue;
      const ganador = grupo.reduce((best, c) => {
        const scoreB = best._count.registros + best._count.registrosVehiculo;
        const scoreC = c._count.registros + c._count.registrosVehiculo;
        return scoreC > scoreB ? c : best;
      });
      const perdedores = grupo.filter((c) => c.id !== ganador.id);
      report.clientesDuplicados.push({
        nombre: ganador.nombre,
        conservando: { id: ganador.id, registros: ganador._count.registros },
        eliminando: perdedores.map((p) => ({ id: p.id, registros: p._count.registros }))
      });
      if (!dryRun) {
        for (const perdedor of perdedores) {
          const r1 = await prisma.registro.updateMany({
            where: { clienteId: perdedor.id },
            data: { clienteId: ganador.id, clienteNombre: ganador.nombre }
          });
          report.registrosReasignados += r1.count;
          await prisma.registroVehiculo.updateMany({
            where: { clienteId: perdedor.id },
            data: { clienteId: ganador.id, clienteNombre: ganador.nombre }
          });
          const proyectosPerdedor = await prisma.proyecto.findMany({ where: { clienteId: perdedor.id } });
          const proyectosGanador = await prisma.proyecto.findMany({ where: { clienteId: ganador.id } });
          for (const proj of proyectosPerdedor) {
            const equiv = proyectosGanador.find(
              (p) => p.nombre.toLowerCase().trim() === proj.nombre.toLowerCase().trim()
            );
            if (equiv) {
              await prisma.registro.updateMany({
                where: { proyectoId: proj.id },
                data: { proyectoId: equiv.id, proyectoNombre: equiv.nombre }
              });
              await prisma.registroVehiculo.updateMany({
                where: { proyectoId: proj.id },
                data: { proyectoId: equiv.id, proyectoNombre: equiv.nombre }
              });
              await prisma.proyecto.delete({ where: { id: proj.id } });
              report.eliminados.proyectos++;
            } else {
              await prisma.proyecto.update({
                where: { id: proj.id },
                data: { clienteId: ganador.id }
              });
            }
          }
          await prisma.cliente.delete({ where: { id: perdedor.id } });
          report.eliminados.clientes++;
        }
      }
    }
    auditLog({
      usuario: userPayload.usuario,
      accion: "cleanup_duplicates",
      recurso: "/api/admin/cleanup-duplicates",
      resultado: "success",
      ip: clientIp,
      detalle: `dryRun=${dryRun}, duplicados=${report.clientesDuplicados.length}`
    });
    res.json({ success: true, data: report });
  } catch (error) {
    logger2.error("Error in cleanup-duplicates:", error);
    res.status(500).json({
      success: false,
      error: { code: "CLEANUP_ERROR", message: error.message }
    });
  }
});

// src/server/routes/registros.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router18 } from "express";
import { Decimal as Decimal8 } from "@prisma/client/runtime/library";
init_shared();
var registrosRouter = Router18();
function esUsuarioOperario(user) {
  if (!user || !user.rol) return false;
  const r = String(user.rol).toUpperCase();
  return r === "OPERADOR" || r === "OPERARIO" || r.includes("OPER");
}
registrosRouter.get("/mis-registros", requireAuth, async (req, res) => {
  const userPayload = req.user;
  const isOperario = esUsuarioOperario(userPayload);
  try {
    const registros = await prisma.registro.findMany({
      where: { concepto: "MO", colaboradorId: userPayload.colaboradorId },
      orderBy: { fecha: "desc" }
    });
    const userRegistros = registros.map((r) => ({
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.clienteNombre,
      proyectoId: r.proyectoId,
      proyectoNombre: r.proyectoNombre,
      fecha: r.fecha.toISOString().substring(0, 10),
      concepto: "MO",
      descripcion: r.descripcion,
      colaboradorId: r.colaboradorId || void 0,
      hsInicio: r.hsInicio || void 0,
      hsFin: r.hsFin || void 0,
      hsTotal: r.hsTotal ? parseFloat(r.hsTotal.toString()) : void 0,
      cantidad: parseFloat(r.cantidad.toString()),
      precioUnitario: isOperario ? 0 : parseFloat(r.precioUnitario.toString()),
      total: isOperario ? 0 : parseFloat(r.total.toString()),
      origen: r.origen === "MANUAL" ? "Manual" : "Excel",
      fechaImportacion: r.fechaImportacion ? r.fechaImportacion.toISOString().substring(0, 10) : void 0
    }));
    res.json({ success: true, data: userRegistros });
  } catch (error) {
    logger2.error("Error reading user registros:", error);
    res.status(500).json({
      success: false,
      error: { code: "READ_ERROR", message: "Error al leer registros del usuario" }
    });
  }
});
registrosRouter.post("/", requireAuth, requireWriteAccess, async (req, res) => {
  const validation = validateSchema(RegistroItemSchema, req.body);
  if (!validation.valid) {
    logger2.error("[DEBUG /api/registros] Zod validation failed:", JSON.stringify({
      errors: validation.errors,
      body: {
        clienteId: req.body?.clienteId,
        proyectoId: req.body?.proyectoId,
        fecha: req.body?.fecha,
        concepto: req.body?.concepto,
        cantidad: req.body?.cantidad,
        precioUnitario: req.body?.precioUnitario,
        total: req.body?.total,
        descripcion: req.body?.descripcion?.substring(0, 30)
      }
    }));
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Datos del registro invalidos", details: validation.errors }
    });
  }
  const rawItem = validation.data;
  const userPayload = req.user;
  const clientIp = getClientIp(req);
  try {
    const [client, project] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: rawItem.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: rawItem.proyectoId } })
    ]);
    if (!client || !project) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REFERENCE", message: "Cliente o proyecto no encontrado" }
      });
    }
    if (rawItem.concepto === "MO" && rawItem.colaboradorId && userPayload.rol !== "Admin") {
      if (rawItem.colaboradorId !== userPayload.colaboradorId) {
        auditLog({
          usuario: userPayload.usuario,
          accion: "create_registro",
          recurso: "/api/registros",
          resultado: "failure",
          ip: clientIp,
          detalle: "Intento de registrar horas de otro colaborador"
        });
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "No tenes permiso para registrar horas de otros colaboradores" }
        });
      }
    }
    let conceptoEnum = "MO";
    if (rawItem.concepto === "Insumo") conceptoEnum = "INSUMO";
    else if (rawItem.concepto === "MO") conceptoEnum = "MO";
    const isOperario = esUsuarioOperario(userPayload);
    let precioUnitarioCalculado = rawItem.precioUnitario;
    let totalCalculado = rawItem.total;
    if (conceptoEnum === "INSUMO" && (isOperario || !precioUnitarioCalculado || precioUnitarioCalculado === 0)) {
      try {
        const desc = rawItem.descripcion.trim();
        const baseNombre = desc.includes("\u2014") ? desc.split("\u2014")[0].trim() : desc;
        const esMerma = /merma|desperdicio/i.test(desc);
        const insumoDb = await prisma.insumo.findFirst({
          where: {
            activo: true,
            OR: [
              { nombre: { equals: baseNombre, mode: "insensitive" } },
              { nombre: { contains: baseNombre, mode: "insensitive" } }
            ]
          },
          orderBy: { nombre: "asc" }
        });
        if (insumoDb) {
          const costoUnit = esMerma && insumoDb.costoDesperdicio != null && Number(insumoDb.costoDesperdicio) > 0 ? Number(insumoDb.costoDesperdicio) : Number(insumoDb.costo);
          precioUnitarioCalculado = costoUnit;
          totalCalculado = Math.round(rawItem.cantidad * costoUnit);
        } else if (isOperario && (!precioUnitarioCalculado || precioUnitarioCalculado === 0)) {
          const palabras = baseNombre.split(" ").filter((w) => w.length > 3);
          if (palabras.length > 0) {
            const fallbackInsumo = await prisma.insumo.findFirst({
              where: {
                activo: true,
                OR: palabras.map((w) => ({ nombre: { contains: w, mode: "insensitive" } }))
              }
            });
            if (fallbackInsumo) {
              const costoUnit = esMerma && fallbackInsumo.costoDesperdicio != null && Number(fallbackInsumo.costoDesperdicio) > 0 ? Number(fallbackInsumo.costoDesperdicio) : Number(fallbackInsumo.costo);
              precioUnitarioCalculado = costoUnit;
              totalCalculado = Math.round(rawItem.cantidad * costoUnit);
            }
          }
        }
      } catch (lookupErr) {
        logger2.warn("[REGISTROS] Error al resolver costo de insumo desde cat\xE1logo:", lookupErr);
      }
    }
    const newRegistro = await prisma.registro.create({
      data: {
        id: generateId("reg"),
        clienteId: rawItem.clienteId,
        clienteNombre: client.nombre,
        proyectoId: rawItem.proyectoId,
        proyectoNombre: project.nombre,
        fecha: new Date(rawItem.fecha || (/* @__PURE__ */ new Date()).toISOString().substring(0, 10)),
        concepto: conceptoEnum,
        descripcion: rawItem.descripcion,
        colaboradorId: rawItem.colaboradorId || null,
        hsInicio: rawItem.hsInicio ? rawItem.hsInicio.substring(0, 5) : null,
        hsFin: rawItem.hsFin ? rawItem.hsFin.substring(0, 5) : null,
        hsTotal: rawItem.hsTotal ? new Decimal8(rawItem.hsTotal) : null,
        cantidad: new Decimal8(rawItem.cantidad),
        precioUnitario: new Decimal8(precioUnitarioCalculado),
        total: new Decimal8(totalCalculado),
        origen: "MANUAL",
        modoInsumo: req.body?.modoInsumo || null,
        anchoCm: req.body?.anchoCm != null ? new Decimal8(req.body.anchoCm) : null,
        altoCm: req.body?.altoCm != null ? new Decimal8(req.body.altoCm) : null,
        desperdicioCalculado: Boolean(req.body?.desperdicioCalculado),
        porcentajeUsado: req.body?.porcentajeUsado != null ? new Decimal8(req.body.porcentajeUsado) : null,
        facturaCompraId: req.body?.facturaCompraId || null,
        prorrateoGrupoId: req.body?.prorrateoGrupoId || null,
        porcentajeProrrateo: req.body?.porcentajeProrrateo != null ? new Decimal8(req.body.porcentajeProrrateo) : null,
        fechaImportacion: /* @__PURE__ */ new Date()
      }
    });
    if (req.body?.facturaCompraId) {
      try {
        await prisma.facturaCompra.update({
          where: { id: req.body.facturaCompraId },
          data: { cantidadUsada: { increment: rawItem.cantidad } }
        });
      } catch (fErr) {
        logger2.warn("[REGISTROS] Error updating facturaCompra cantidadUsada:", fErr);
      }
    }
    const newItem = {
      id: newRegistro.id,
      clienteId: newRegistro.clienteId,
      clienteNombre: newRegistro.clienteNombre,
      proyectoId: newRegistro.proyectoId,
      proyectoNombre: newRegistro.proyectoNombre,
      fecha: newRegistro.fecha.toISOString().substring(0, 10),
      concepto: newRegistro.concepto === "INSUMO" ? "Insumo" : "MO",
      descripcion: newRegistro.descripcion,
      colaboradorId: newRegistro.colaboradorId || void 0,
      hsInicio: newRegistro.hsInicio || void 0,
      hsFin: newRegistro.hsFin || void 0,
      hsTotal: newRegistro.hsTotal ? parseFloat(newRegistro.hsTotal.toString()) : void 0,
      cantidad: parseFloat(newRegistro.cantidad.toString()),
      precioUnitario: isOperario ? 0 : parseFloat(newRegistro.precioUnitario.toString()),
      total: isOperario ? 0 : parseFloat(newRegistro.total.toString()),
      origen: "Manual",
      fechaImportacion: newRegistro.fechaImportacion ? newRegistro.fechaImportacion.toISOString().substring(0, 10) : void 0
    };
    auditLog({
      usuario: userPayload.usuario,
      accion: "create_registro",
      recurso: `/api/registros/${newItem.id}`,
      resultado: "success",
      ip: clientIp
    });
    res.status(201).json({
      success: true,
      data: newItem,
      message: "Registro creado con exito"
    });
  } catch (error) {
    logger2.error("[DEBUG] Error creating registro:", error?.message);
    logger2.error("[DEBUG] Prisma error details:", JSON.stringify({
      code: error?.code,
      meta: error?.meta,
      message: error?.message
    }));
    res.status(500).json({
      success: false,
      error: { code: "CREATE_ERROR", message: "Error al crear registro" }
    });
  }
});
registrosRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_ID", message: "ID de registro requerido" }
    });
  }
  try {
    const registro = await prisma.registro.findUnique({ where: { id } });
    if (!registro) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Registro no encontrado" }
      });
    }
    await prisma.registro.delete({ where: { id } });
    auditLog({
      usuario: userPayload.usuario,
      accion: "delete_registro",
      recurso: `/api/registros/${id}`,
      resultado: "success",
      ip: clientIp
    });
    res.json({ success: true, message: "Registro eliminado con exito" });
  } catch (error) {
    console.error("Error deleting registro:", error);
    res.status(500).json({
      success: false,
      error: { code: "DELETE_ERROR", message: "Error al eliminar registro" }
    });
  }
});
registrosRouter.put("/:id", requireAuth, requireWriteAccess, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_ID", message: "ID de registro requerido" }
    });
  }
  const validation = validateSchema(RegistroItemSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Datos del registro invalidos", details: validation.errors }
    });
  }
  const updatedData = validation.data;
  try {
    const existingRegistro = await prisma.registro.findUnique({ where: { id } });
    if (!existingRegistro) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Registro no encontrado" }
      });
    }
    const [client, project] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: updatedData.clienteId } }),
      prisma.proyecto.findUnique({ where: { id: updatedData.proyectoId } })
    ]);
    if (!client || !project) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REFERENCE", message: "Cliente o proyecto no encontrado" }
      });
    }
    if (existingRegistro.concepto === "MO" && userPayload.rol !== "Admin") {
      if (existingRegistro.colaboradorId !== userPayload.colaboradorId) {
        auditLog({
          usuario: userPayload.usuario,
          accion: "update_registro",
          recurso: `/api/registros/${id}`,
          resultado: "failure",
          ip: clientIp,
          detalle: "Intento de editar horas de otro colaborador"
        });
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "No tenes permiso para editar horas de otros colaboradores" }
        });
      }
    }
    let hsTotal = updatedData.hsTotal;
    if (updatedData.concepto === "MO" && updatedData.cantidad > 0) {
      hsTotal = parseFloat((updatedData.cantidad / 60).toFixed(2));
    }
    let conceptoEnum = "MO";
    if (updatedData.concepto === "Insumo") conceptoEnum = "INSUMO";
    else if (updatedData.concepto === "MO") conceptoEnum = "MO";
    const isOperario = esUsuarioOperario(userPayload);
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
        hsTotal: hsTotal ? new Decimal8(hsTotal) : existingRegistro.hsTotal,
        cantidad: new Decimal8(updatedData.cantidad),
        precioUnitario: isOperario ? existingRegistro.precioUnitario : new Decimal8(updatedData.precioUnitario),
        total: isOperario ? existingRegistro.total : new Decimal8(updatedData.total)
      }
    });
    const responseData = {
      id: updatedRegistro.id,
      clienteId: updatedRegistro.clienteId,
      clienteNombre: updatedRegistro.clienteNombre,
      proyectoId: updatedRegistro.proyectoId,
      proyectoNombre: updatedRegistro.proyectoNombre,
      fecha: updatedRegistro.fecha.toISOString().substring(0, 10),
      concepto: updatedRegistro.concepto === "INSUMO" ? "Insumo" : "MO",
      descripcion: updatedRegistro.descripcion,
      colaboradorId: updatedRegistro.colaboradorId || void 0,
      hsInicio: updatedRegistro.hsInicio || void 0,
      hsFin: updatedRegistro.hsFin || void 0,
      hsTotal: updatedRegistro.hsTotal ? parseFloat(updatedRegistro.hsTotal.toString()) : void 0,
      cantidad: parseFloat(updatedRegistro.cantidad.toString()),
      precioUnitario: isOperario ? 0 : parseFloat(updatedRegistro.precioUnitario.toString()),
      total: isOperario ? 0 : parseFloat(updatedRegistro.total.toString()),
      origen: updatedRegistro.origen === "MANUAL" ? "Manual" : "Excel",
      fechaImportacion: updatedRegistro.fechaImportacion ? updatedRegistro.fechaImportacion.toISOString().substring(0, 10) : void 0
    };
    auditLog({
      usuario: userPayload.usuario,
      accion: "update_registro",
      recurso: `/api/registros/${id}`,
      resultado: "success",
      ip: clientIp
    });
    res.json({ success: true, data: responseData, message: "Registro actualizado con exito" });
  } catch (error) {
    logger2.error("Error updating registro:", error);
    res.status(500).json({
      success: false,
      error: { code: "UPDATE_ERROR", message: "Error al actualizar registro" }
    });
  }
});
registrosRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const clientIp = getClientIp(req);
  const userPayload = req.user;
  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_ID", message: "ID de registro requerido" }
    });
  }
  const { descripcion, proyectoId } = req.body;
  if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Descripcion requerida y debe ser un texto valido" }
    });
  }
  if (!proyectoId || typeof proyectoId !== "string") {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Proyecto requerido" }
    });
  }
  try {
    const existingRegistro = await prisma.registro.findUnique({ where: { id } });
    if (!existingRegistro) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Registro no encontrado" }
      });
    }
    if (existingRegistro.concepto === "MO" && userPayload.rol !== "Admin") {
      if (existingRegistro.colaboradorId !== userPayload.colaboradorId) {
        auditLog({
          usuario: userPayload.usuario,
          accion: "patch_registro",
          recurso: `/api/registros/${id}`,
          resultado: "failure",
          ip: clientIp,
          detalle: "Intento de editar registro de otro colaborador"
        });
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "No tenes permiso para editar registros de otros colaboradores" }
        });
      }
    }
    const project = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!project) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REFERENCE", message: "Proyecto no encontrado" }
      });
    }
    if (project.clienteId !== existingRegistro.clienteId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REFERENCE", message: "El proyecto debe pertenecer al mismo cliente" }
      });
    }
    const updatedRegistro = await prisma.registro.update({
      where: { id },
      data: { descripcion: descripcion.trim(), proyectoId, proyectoNombre: project.nombre }
    });
    const isOperario = esUsuarioOperario(userPayload);
    const responseData = {
      id: updatedRegistro.id,
      clienteId: updatedRegistro.clienteId,
      clienteNombre: updatedRegistro.clienteNombre,
      proyectoId: updatedRegistro.proyectoId,
      proyectoNombre: updatedRegistro.proyectoNombre,
      fecha: updatedRegistro.fecha.toISOString().substring(0, 10),
      concepto: updatedRegistro.concepto === "INSUMO" ? "Insumo" : "MO",
      descripcion: updatedRegistro.descripcion,
      colaboradorId: updatedRegistro.colaboradorId || void 0,
      hsInicio: updatedRegistro.hsInicio || void 0,
      hsFin: updatedRegistro.hsFin || void 0,
      hsTotal: updatedRegistro.hsTotal ? parseFloat(updatedRegistro.hsTotal.toString()) : void 0,
      cantidad: parseFloat(updatedRegistro.cantidad.toString()),
      precioUnitario: isOperario ? 0 : parseFloat(updatedRegistro.precioUnitario.toString()),
      total: isOperario ? 0 : parseFloat(updatedRegistro.total.toString()),
      origen: updatedRegistro.origen === "MANUAL" ? "Manual" : "Excel",
      fechaImportacion: updatedRegistro.fechaImportacion ? updatedRegistro.fechaImportacion.toISOString().substring(0, 10) : void 0
    };
    auditLog({
      usuario: userPayload.usuario,
      accion: "patch_registro",
      recurso: `/api/registros/${id}`,
      resultado: "success",
      ip: clientIp
    });
    res.json({ success: true, data: responseData, message: "Registro actualizado con exito" });
  } catch (error) {
    logger2.error("Error patching registro:", error);
    res.status(500).json({
      success: false,
      error: { code: "PATCH_ERROR", message: "Error al actualizar registro" }
    });
  }
});
registrosRouter.post("/prorrateo", requireAuth, requireWriteAccess, async (req, res) => {
  const { distribucion, registroBase } = req.body || {};
  if (!Array.isArray(distribucion) || distribucion.length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_DISTRIBUTION", message: "Se requieren al menos 2 clientes para prorratear" }
    });
  }
  const suma = distribucion.reduce((acc, d) => acc + (Number(d.porcentaje) || 0), 0);
  if (Math.abs(suma - 100) > 0.1) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_PERCENTAGE", message: `La suma de los porcentajes debe ser exactamente 100% (suma actual: ${suma}%)` }
    });
  }
  if (!registroBase || !registroBase.descripcion || !registroBase.concepto) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_BASE", message: "Faltan datos del registro base" }
    });
  }
  const userPayload = req.user;
  const isOperario = esUsuarioOperario(userPayload);
  const clientIp = getClientIp(req);
  const grupoId = generateId("grp");
  const conceptoEnum = String(registroBase.concepto).toUpperCase() === "INSUMO" ? "INSUMO" : "MO";
  const cantTotal = Number(registroBase.cantidad) || 0;
  const precioUnit = Number(registroBase.precioUnitario) || 0;
  const totalBase = Number(registroBase.total) || Math.round(cantTotal * precioUnit);
  const hsTotalNum = registroBase.hsTotal != null ? Number(registroBase.hsTotal) : null;
  try {
    const creados = [];
    await prisma.$transaction(async (tx) => {
      let acumuladoCant = 0;
      let acumuladoTotal = 0;
      let acumuladoHs = 0;
      for (let i = 0; i < distribucion.length; i++) {
        const dist = distribucion[i];
        const isLast = i === distribucion.length - 1;
        const pct = Number(dist.porcentaje);
        const cli = await tx.cliente.findUnique({ where: { id: dist.clienteId } });
        const pro = await tx.proyecto.findUnique({ where: { id: dist.proyectoId } });
        if (!cli || !pro) {
          throw new Error(`Cliente o Proyecto inv\xE1lido en la distribuci\xF3n (${dist.clienteId}/${dist.proyectoId})`);
        }
        let cantPart;
        let totalPart;
        let hsPart = null;
        if (isLast) {
          cantPart = Math.max(0, Math.round((cantTotal - acumuladoCant) * 1e3) / 1e3);
          totalPart = Math.max(0, totalBase - acumuladoTotal);
          if (hsTotalNum != null) {
            hsPart = Math.max(0, Math.round((hsTotalNum - acumuladoHs) * 100) / 100);
          }
        } else {
          cantPart = Math.round(cantTotal * pct / 100 * 1e3) / 1e3;
          acumuladoCant += cantPart;
          totalPart = Math.round(totalBase * pct / 100);
          acumuladoTotal += totalPart;
          if (hsTotalNum != null) {
            hsPart = Math.round(hsTotalNum * pct / 100 * 100) / 100;
            acumuladoHs += hsPart;
          }
        }
        const reg = await tx.registro.create({
          data: {
            id: generateId("reg"),
            clienteId: cli.id,
            clienteNombre: cli.nombre,
            proyectoId: pro.id,
            proyectoNombre: pro.nombre,
            fecha: new Date(registroBase.fecha || (/* @__PURE__ */ new Date()).toISOString().substring(0, 10)),
            concepto: conceptoEnum,
            descripcion: `[Prorrateo ${pct}%] ${registroBase.descripcion}`,
            colaboradorId: registroBase.colaboradorId || null,
            hsInicio: registroBase.hsInicio ? String(registroBase.hsInicio).substring(0, 5) : null,
            hsFin: registroBase.hsFin ? String(registroBase.hsFin).substring(0, 5) : null,
            hsTotal: hsPart != null ? new Decimal8(hsPart) : null,
            cantidad: new Decimal8(cantPart),
            precioUnitario: new Decimal8(precioUnit),
            total: new Decimal8(totalPart),
            origen: "MANUAL",
            modoInsumo: registroBase.modoInsumo || null,
            anchoCm: registroBase.anchoCm != null ? new Decimal8(registroBase.anchoCm) : null,
            altoCm: registroBase.altoCm != null ? new Decimal8(registroBase.altoCm) : null,
            desperdicioCalculado: Boolean(registroBase.desperdicioCalculado),
            porcentajeUsado: registroBase.porcentajeUsado != null ? new Decimal8(registroBase.porcentajeUsado) : null,
            facturaCompraId: registroBase.facturaCompraId || null,
            prorrateoGrupoId: grupoId,
            porcentajeProrrateo: new Decimal8(pct),
            fechaImportacion: /* @__PURE__ */ new Date()
          }
        });
        creados.push({
          id: reg.id,
          clienteId: reg.clienteId,
          clienteNombre: reg.clienteNombre,
          proyectoId: reg.proyectoId,
          proyectoNombre: reg.proyectoNombre,
          fecha: reg.fecha.toISOString().substring(0, 10),
          concepto: reg.concepto === "INSUMO" ? "Insumo" : "MO",
          descripcion: reg.descripcion,
          colaboradorId: reg.colaboradorId || void 0,
          hsInicio: reg.hsInicio || void 0,
          hsFin: reg.hsFin || void 0,
          hsTotal: reg.hsTotal ? parseFloat(reg.hsTotal.toString()) : void 0,
          cantidad: parseFloat(reg.cantidad.toString()),
          precioUnitario: isOperario ? 0 : parseFloat(reg.precioUnitario.toString()),
          total: isOperario ? 0 : parseFloat(reg.total.toString()),
          origen: "Manual"
        });
      }
      if (registroBase.facturaCompraId && cantTotal > 0) {
        await tx.facturaCompra.update({
          where: { id: registroBase.facturaCompraId },
          data: { cantidadUsada: { increment: cantTotal } }
        });
      }
    });
    auditLog({
      usuario: userPayload.usuario,
      accion: "crear_prorrateo",
      recurso: `/api/registros/prorrateo`,
      resultado: "success",
      ip: clientIp,
      detalle: `Prorrateo de ${distribucion.length} clientes para grupo ${grupoId}`
    });
    res.status(201).json({
      success: true,
      message: `Actividad prorrateada exitosamente entre ${distribucion.length} clientes`,
      data: creados
    });
  } catch (error) {
    logger2.error("[REGISTROS PRORRATEO] Error:", error);
    res.status(500).json({
      success: false,
      error: { code: "PRORRATEO_ERROR", message: error.message || "Error al prorratear actividad" }
    });
  }
});

// src/server/routes/marcacion.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router19 } from "express";
import crypto5 from "crypto";
import { Decimal as Decimal9 } from "@prisma/client/runtime/library";
var marcacionRouter = Router19();
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function genMarcacionId() {
  return "mar" + Math.random().toString(36).substring(2, 11);
}
function hashDispositivo(ua, cip) {
  return crypto5.createHash("sha256").update((ua || "") + "|" + (cip || "")).digest("hex");
}
marcacionRouter.get("/config", async (req, res) => {
  try {
    let config = await prisma.geocercaConfig.findFirst({ where: { activo: true } });
    if (!config) {
      config = await prisma.geocercaConfig.create({
        data: { lat: -25.320588291024226, lng: -57.62418119104182, radioMetros: 100, activo: true }
      });
    }
    res.json({ success: true, data: { lat: Number(config.lat), lng: Number(config.lng), radioMetros: config.radioMetros } });
  } catch (error) {
    logger2.error("Error fetching geocerca config:", error);
    res.status(500).json({ success: false, error: { code: "CONFIG_ERROR", message: "Error al obtener geocerca" } });
  }
});
marcacionRouter.post("/entrada", requireAuth, requireWriteAccess, async (req, res) => {
  const { lat, lng, precision, modo, motivoRemoto, hojaRutaId } = req.body;
  const up = req.user;
  const cip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";
  if (typeof lat !== "number" || typeof lng !== "number")
    return res.status(400).json({ success: false, error: { code: "GPS_REQUIRED", message: "Coordenadas requeridas" } });
  const esRemoto = modo === "REMOTO";
  try {
    let fueraDeZona = false;
    if (!esRemoto) {
      const cfg = await prisma.geocercaConfig.findFirst({ where: { activo: true } });
      if (!cfg) return res.status(500).json({ success: false, error: { code: "NO_CONFIG", message: "Sin geocerca" } });
      fueraDeZona = distanciaMetros(lat, lng, Number(cfg.lat), Number(cfg.lng)) > cfg.radioMetros;
      if (fueraDeZona)
        return res.status(422).json({ success: false, error: { code: "FUERA_DE_ZONA", message: "Fuera de zona laboral. Si arrancas desde casa, activ\xE1 el modo remoto." } });
    } else if (!motivoRemoto || !motivoRemoto.trim()) {
      return res.status(400).json({ success: false, error: { code: "MOTIVO_REQUERIDO", message: "Debes indicar un motivo para la marcaci\xF3n remota" } });
    }
    const ult = await prisma.marcacion.findFirst({ where: { usuario: up.usuario }, orderBy: { timestamp: "desc" } });
    if (ult && ult.tipo === "ENTRADA")
      return res.status(409).json({ success: false, error: { code: "YA_MARCADO", message: "Ya tenes entrada sin salida" } });
    const dh = hashDispositivo(ua, cip);
    const origen = esRemoto ? "REMOTO" : "APP";
    const m = await prisma.marcacion.create({
      data: { id: genMarcacionId(), usuario: up.usuario, tipo: "ENTRADA", lat: new Decimal9(lat), lng: new Decimal9(lng), precision: precision ? new Decimal9(precision) : null, ip: cip, dispositivoHash: dh, userAgent: ua, origen, motivoRemoto: esRemoto ? motivoRemoto.trim() : null }
    });
    auditLog({ usuario: up.usuario, accion: esRemoto ? "marcacion_entrada_remota" : "marcacion_entrada", recurso: "/api/marcacion/entrada", resultado: "success", ip: cip });
    let replicados = [];
    if (hojaRutaId) {
      const operarios = await prisma.hojaRutaMarcacionOperario.findMany({ where: { hojaRutaId } });
      for (const op of operarios) {
        if (op.usuario === up.usuario) continue;
        const ultOp = await prisma.marcacion.findFirst({ where: { usuario: op.usuario }, orderBy: { timestamp: "desc" } });
        if (ultOp && ultOp.tipo === "ENTRADA") continue;
        await prisma.marcacion.create({
          data: { id: genMarcacionId(), usuario: op.usuario, tipo: "ENTRADA", lat: new Decimal9(lat), lng: new Decimal9(lng), precision: precision ? new Decimal9(precision) : null, ip: cip, dispositivoHash: dh, userAgent: ua, origen: "HOJA_RUTA", hojaRutaId, marcadoPor: up.usuario }
        });
        replicados.push(op.usuario);
      }
      auditLog({ usuario: up.usuario, accion: "marcacion_entrada_hoja_ruta", recurso: "/api/marcacion/entrada", resultado: "success", ip: cip, detalle: `Replicada a ${replicados.join(", ")}` });
    }
    res.status(201).json({ success: true, data: { id: m.id, timestamp: m.timestamp, origen, replicados } });
  } catch (e) {
    logger2.error("Error marcando entrada:", e);
    res.status(500).json({ success: false, error: { code: "MARCACION_ERROR", message: e.message || "Error" } });
  }
});
marcacionRouter.post("/salida", requireAuth, requireWriteAccess, async (req, res) => {
  const { lat, lng, precision, modo, motivoRemoto, hojaRutaId } = req.body;
  const up = req.user;
  const cip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";
  if (typeof lat !== "number" || typeof lng !== "number")
    return res.status(400).json({ success: false, error: { code: "GPS_REQUIRED", message: "Coordenadas requeridas" } });
  const esRemoto = modo === "REMOTO";
  try {
    if (!esRemoto) {
      const cfg = await prisma.geocercaConfig.findFirst({ where: { activo: true } });
      if (!cfg) return res.status(500).json({ success: false, error: { code: "NO_CONFIG", message: "Sin geocerca" } });
      if (distanciaMetros(lat, lng, Number(cfg.lat), Number(cfg.lng)) > cfg.radioMetros)
        return res.status(422).json({ success: false, error: { code: "FUERA_DE_ZONA", message: "Fuera de zona laboral. Si terminas desde otro lado, activ\xE1 el modo remoto." } });
    } else if (!motivoRemoto || !motivoRemoto.trim()) {
      return res.status(400).json({ success: false, error: { code: "MOTIVO_REQUERIDO", message: "Debes indicar un motivo para la marcaci\xF3n remota" } });
    }
    const ult = await prisma.marcacion.findFirst({ where: { usuario: up.usuario }, orderBy: { timestamp: "desc" } });
    if (!ult || ult.tipo !== "ENTRADA")
      return res.status(409).json({ success: false, error: { code: "SIN_ENTRADA", message: "Sin entrada registrada" } });
    const dh = hashDispositivo(ua, cip);
    const origen = esRemoto ? "REMOTO" : "APP";
    const m = await prisma.marcacion.create({
      data: { id: genMarcacionId(), usuario: up.usuario, tipo: "SALIDA", lat: new Decimal9(lat), lng: new Decimal9(lng), precision: precision ? new Decimal9(precision) : null, ip: cip, dispositivoHash: dh, userAgent: ua, origen, motivoRemoto: esRemoto ? motivoRemoto.trim() : null }
    });
    auditLog({ usuario: up.usuario, accion: esRemoto ? "marcacion_salida_remota" : "marcacion_salida", recurso: "/api/marcacion/salida", resultado: "success", ip: cip });
    let replicados = [];
    if (hojaRutaId) {
      const operarios = await prisma.hojaRutaMarcacionOperario.findMany({ where: { hojaRutaId } });
      for (const op of operarios) {
        if (op.usuario === up.usuario) continue;
        const ultOp = await prisma.marcacion.findFirst({ where: { usuario: op.usuario }, orderBy: { timestamp: "desc" } });
        if (!ultOp || ultOp.tipo !== "ENTRADA") continue;
        await prisma.marcacion.create({
          data: { id: genMarcacionId(), usuario: op.usuario, tipo: "SALIDA", lat: new Decimal9(lat), lng: new Decimal9(lng), precision: precision ? new Decimal9(precision) : null, ip: cip, dispositivoHash: dh, userAgent: ua, origen: "HOJA_RUTA", hojaRutaId, marcadoPor: up.usuario }
        });
        replicados.push(op.usuario);
      }
      auditLog({ usuario: up.usuario, accion: "marcacion_salida_hoja_ruta", recurso: "/api/marcacion/salida", resultado: "success", ip: cip, detalle: `Replicada a ${replicados.join(", ")}` });
    }
    res.status(201).json({ success: true, data: { id: m.id, timestamp: m.timestamp, origen, replicados } });
  } catch (e) {
    logger2.error("Error marcando salida:", e);
    res.status(500).json({ success: false, error: { code: "MARCACION_ERROR", message: e.message || "Error" } });
  }
});
marcacionRouter.get("/mis-marcaciones", requireAuth, async (req, res) => {
  const up = req.user;
  const { desde, hasta, limite } = req.query;
  try {
    const w = { usuario: up.usuario };
    if (desde || hasta) {
      w.timestamp = {};
      if (desde) w.timestamp.gte = new Date(desde);
      if (hasta) w.timestamp.lte = new Date(hasta);
    }
    const ms = await prisma.marcacion.findMany({ where: w, orderBy: { timestamp: "desc" }, take: limite ? parseInt(limite) : 50 });
    res.json({ success: true, data: ms.map((m) => ({ id: m.id, tipo: m.tipo, timestamp: m.timestamp, lat: m.lat ? Number(m.lat) : null, lng: m.lng ? Number(m.lng) : null, precision: m.precision ? Number(m.precision) : null, origen: m.origen, motivoRemoto: m.motivoRemoto, hojaRutaId: m.hojaRutaId, marcadoPor: m.marcadoPor })) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: "Error" } });
  }
});
marcacionRouter.get("/admin/timeline", requireAuth, requireAdmin, async (req, res) => {
  const { usuario, desde, hasta, limite } = req.query;
  try {
    const w = {};
    if (usuario) w.usuario = { contains: usuario, mode: "insensitive" };
    if (desde || hasta) {
      w.timestamp = {};
      if (desde) w.timestamp.gte = new Date(desde);
      if (hasta) w.timestamp.lte = new Date(hasta);
    }
    const ms = await prisma.marcacion.findMany({ where: w, orderBy: { timestamp: "desc" }, take: limite ? parseInt(limite) : 200 });
    const ips = {};
    const ds = {};
    for (const m of ms) {
      if (!ips[m.usuario]) ips[m.usuario] = /* @__PURE__ */ new Set();
      if (!ds[m.usuario]) ds[m.usuario] = /* @__PURE__ */ new Set();
      if (m.ip) ips[m.usuario].add(m.ip);
      if (m.dispositivoHash) ds[m.usuario].add(m.dispositivoHash);
    }
    res.json({ success: true, data: ms.map((m) => ({ id: m.id, usuario: m.usuario, tipo: m.tipo, timestamp: m.timestamp, lat: m.lat ? Number(m.lat) : null, lng: m.lng ? Number(m.lng) : null, ip: m.ip, dispositivoHash: m.dispositivoHash, origen: m.origen, motivoRemoto: m.motivoRemoto, hojaRutaId: m.hojaRutaId, marcadoPor: m.marcadoPor, alertas: [...ips[m.usuario]?.size > 1 ? ["MULTIPLES_IPS"] : [], ...ds[m.usuario]?.size > 1 ? ["MULTIPLES_DISPOSITIVOS"] : []] })) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: "Error" } });
  }
});
marcacionRouter.get("/hojas-ruta", requireAuth, async (req, res) => {
  const up = req.user;
  try {
    let hojas;
    if (up.rol === "Admin") {
      hojas = await prisma.hojaRutaMarcacion.findMany({ include: { operarios: true }, orderBy: { createdAt: "desc" } });
    } else {
      hojas = await prisma.hojaRutaMarcacion.findMany({
        where: { operarios: { some: { usuario: up.usuario } } },
        include: { operarios: true },
        orderBy: { createdAt: "desc" }
      });
    }
    res.json({ success: true, data: hojas.map((h) => ({ id: h.id, nombre: h.nombre, descripcion: h.descripcion, estado: h.estado, creadaPor: h.creadaPor, createdAt: h.createdAt, operarios: h.operarios.map((o) => ({ usuario: o.usuario, rol: o.rol })) })) });
  } catch (e) {
    logger2.error("Error listando hojas de ruta:", e);
    res.status(500).json({ success: false, error: { code: "READ_ERROR", message: e.message || "Error" } });
  }
});
marcacionRouter.post("/hojas-ruta", requireAuth, requireAdmin, async (req, res) => {
  const up = req.user;
  const { nombre, descripcion, operarios } = req.body;
  if (!nombre || !nombre.trim())
    return res.status(400).json({ success: false, error: { code: "NOMBRE_REQUERIDO", message: "Nombre requerido" } });
  if (!operarios || !Array.isArray(operarios) || operarios.length === 0)
    return res.status(400).json({ success: false, error: { code: "OPERARIOS_REQUERIDOS", message: "Debe asignar al menos un operario" } });
  try {
    const hoja = await prisma.hojaRutaMarcacion.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        creadaPor: up.usuario,
        operarios: { create: operarios.map((u) => ({ usuario: u, rol: "OPERARIO" })) }
      },
      include: { operarios: true }
    });
    auditLog({ usuario: up.usuario, accion: "hoja_ruta_marcacion_creada", recurso: "/api/marcacion/hojas-ruta", resultado: "success", ip: getClientIp(req), detalle: hoja.nombre });
    res.status(201).json({ success: true, data: { id: hoja.id, nombre: hoja.nombre, descripcion: hoja.descripcion, estado: hoja.estado, operarios: hoja.operarios.map((o) => ({ usuario: o.usuario, rol: o.rol })) } });
  } catch (e) {
    logger2.error("Error creando hoja de ruta:", e);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: e.message || "Error" } });
  }
});
marcacionRouter.put("/hojas-ruta/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, estado, operarios } = req.body;
  try {
    if (operarios && Array.isArray(operarios)) {
      await prisma.hojaRutaMarcacionOperario.deleteMany({ where: { hojaRutaId: id } });
      if (operarios.length > 0) {
        await prisma.hojaRutaMarcacionOperario.createMany({ data: operarios.map((u) => ({ hojaRutaId: id, usuario: u, rol: "OPERARIO" })) });
      }
    }
    const hoja = await prisma.hojaRutaMarcacion.update({
      where: { id },
      data: { nombre: nombre?.trim(), descripcion: descripcion?.trim(), estado },
      include: { operarios: true }
    });
    res.json({ success: true, data: { id: hoja.id, nombre: hoja.nombre, descripcion: hoja.descripcion, estado: hoja.estado, operarios: hoja.operarios.map((o) => ({ usuario: o.usuario, rol: o.rol })) } });
  } catch (e) {
    logger2.error("Error actualizando hoja de ruta:", e);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: e.message || "Error" } });
  }
});
marcacionRouter.delete("/hojas-ruta/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.hojaRutaMarcacion.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    logger2.error("Error eliminando hoja de ruta:", e);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: e.message || "Error" } });
  }
});

// src/server/routes/audit.routes.ts
init_prisma();
init_server_auth();
init_logger();
import { Router as Router20 } from "express";
var auditRouter = Router20();
auditRouter.get("/logins", requireAuth, requireAdmin, async (req, res) => {
  const { usuario, desde, hasta, limite } = req.query;
  try {
    const where = { accion: { in: ["login", "logout"] } };
    if (usuario) where.usuario = usuario;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }
    const events = await prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limite ? parseInt(limite) : 100
    });
    res.json({ success: true, data: events.map((e) => ({
      id: e.id,
      usuario: e.usuario,
      accion: e.accion,
      recurso: e.recurso,
      resultado: e.resultado,
      ip: e.ip,
      detalle: e.detalle,
      createdAt: e.createdAt
    })) });
  } catch (err) {
    logger2.error("Error fetching audit log:", err);
    res.status(500).json({ success: false, error: { code: "AUDIT_ERROR", message: "Error al obtener logs" } });
  }
});

// src/server/routes/permisos.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
init_shared();
import { Router as Router21 } from "express";
var permisosRouter = Router21();
var TIPOS_PERMISO = [
  "Permiso para retirarme antes de horario",
  'Licencia por nacimiento (Art. 62 "j"; Ley 5508/16)',
  "Permiso por razones de estudios",
  "Licencia por matrimonio (Ley 3384/07)",
  "Permiso para llegar fuera de mi horario",
  "Licencia por fallecimiento familiar directo",
  "Licencia por motivos de salud",
  "Licencia por defunci\xF3n (Ley 3384/07)",
  "Otros",
  "Licencia por maternidad/lactancia (Art. 133 CT) Ley 5508/16"
];
permisosRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { estado, colaboradorId } = req.query;
    const where = {};
    if (estado && typeof estado === "string") where.estado = estado;
    if (colaboradorId && typeof colaboradorId === "string") where.colaboradorId = colaboradorId;
    const permisos = await prisma.permiso.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { colaborador: { select: { id: true, nombre: true, ci: true, cargo: true, departamento: true, jefeInmediato: true, rol: true } } }
    });
    res.json({ success: true, data: permisos.map((p) => ({
      id: p.id,
      colaboradorId: p.colaboradorId,
      nombreSolicitante: p.nombreSolicitante,
      cargo: p.cargo,
      ci: p.ci,
      departamento: p.departamento,
      jefeInmediato: p.jefeInmediato,
      tipoPermiso: p.tipoPermiso,
      motivo: p.motivo,
      modoTiempo: p.modoTiempo,
      horaInicio: p.horaInicio,
      horaFin: p.horaFin,
      fechaHora: p.fechaHora?.toISOString() || null,
      fechaDesde: p.fechaDesde?.toISOString() || null,
      fechaHasta: p.fechaHasta?.toISOString() || null,
      estado: p.estado,
      jefeDecision: p.jefeDecision,
      jefeComentario: p.jefeComentario,
      jefeFecha: p.jefeFecha?.toISOString() || null,
      rrhhDecision: p.rrhhDecision,
      rrhhComentario: p.rrhhComentario,
      rrhhDescontarSalario: p.rrhhDescontarSalario,
      rrhhFecha: p.rrhhFecha?.toISOString() || null,
      creadoPor: p.creadoPor,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      colaborador: p.colaborador
    })) });
  } catch (error) {
    logger2.error("[PERMISOS] Error listing:", error);
    res.status(500).json({ success: false, error: { code: "LIST_ERROR", message: "Error al listar permisos" } });
  }
});
permisosRouter.post("/", requireAuth, async (req, res) => {
  const { colaboradorId, tipoPermiso, motivo, modoTiempo, horaInicio, horaFin, fechaHora, fechaDesde, fechaHasta } = req.body;
  if (!colaboradorId) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Colaborador requerido" } });
  if (!tipoPermiso) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Tipo de permiso requerido" } });
  if (!TIPOS_PERMISO.includes(tipoPermiso)) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Tipo de permiso inv\xE1lido" } });
  try {
    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } });
    if (!colaborador) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Colaborador no encontrado" } });
    const permiso = await prisma.permiso.create({
      data: {
        id: generateId("perm"),
        colaboradorId,
        nombreSolicitante: colaborador.nombre,
        cargo: colaborador.cargo || colaborador.rol || null,
        ci: colaborador.ci,
        departamento: colaborador.departamento,
        jefeInmediato: colaborador.jefeInmediato,
        tipoPermiso,
        motivo: motivo?.trim() || null,
        modoTiempo: modoTiempo === "dias" ? "dias" : "horas",
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,
        fechaHora: fechaHora ? new Date(fechaHora) : null,
        fechaDesde: fechaDesde ? new Date(fechaDesde) : null,
        fechaHasta: fechaHasta ? new Date(fechaHasta) : null,
        estado: "Pendiente",
        creadoPor: req.user.usuario
      }
    });
    auditLog({ usuario: req.user.usuario, accion: "create_permiso", recurso: `/api/permisos/${permiso.id}`, resultado: "success", ip: getClientIp(req) });
    res.status(201).json({ success: true, data: { id: permiso.id }, message: "Solicitud de permiso creada" });
  } catch (error) {
    logger2.error("[PERMISOS] Error creating:", error);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: "Error al crear solicitud de permiso" } });
  }
});
permisosRouter.put("/:id/jefe", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { decision, comentario } = req.body;
  if (!decision || !["Aprobado", "Rechazado"].includes(decision)) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Decisi\xF3n inv\xE1lida (Aprobado o Rechazado)" } });
  }
  try {
    const existing = await prisma.permiso.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Permiso no encontrado" } });
    if (existing.jefeDecision) return res.status(400).json({ success: false, error: { code: "ALREADY_DECIDED", message: "El jefe ya tom\xF3 decisi\xF3n sobre este permiso" } });
    const newEstado = decision === "Aprobado" ? "AprobadoJefe" : "Rechazado";
    const updated = await prisma.permiso.update({
      where: { id },
      data: { jefeDecision: decision, jefeComentario: comentario?.trim() || null, jefeFecha: /* @__PURE__ */ new Date(), estado: newEstado }
    });
    auditLog({ usuario: req.user.usuario, accion: `jefe_${decision.toLowerCase()}_permiso`, recurso: `/api/permisos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { id: updated.id, estado: updated.estado }, message: `Permiso ${decision === "Aprobado" ? "aprobado por jefe" : "rechazado por jefe"}` });
  } catch (error) {
    logger2.error("[PERMISOS] Error jefe decision:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al procesar decisi\xF3n" } });
  }
});
permisosRouter.put("/:id/rrhh", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { decision, comentario, descontarSalario } = req.body;
  if (!decision || !["Aprobado", "Rechazado"].includes(decision)) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Decisi\xF3n inv\xE1lida (Aprobado o Rechazado)" } });
  }
  try {
    const existing = await prisma.permiso.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Permiso no encontrado" } });
    if (!existing.jefeDecision || existing.jefeDecision !== "Aprobado") {
      return res.status(400).json({ success: false, error: { code: "Jefe_PENDIENTE", message: "El jefe inmediato debe aprobar primero" } });
    }
    if (existing.rrhhDecision) return res.status(400).json({ success: false, error: { code: "ALREADY_DECIDED", message: "RR.HH. ya tom\xF3 decisi\xF3n sobre este permiso" } });
    const newEstado = decision === "Aprobado" ? "Aprobado" : "Rechazado";
    const updated = await prisma.permiso.update({
      where: { id },
      data: {
        rrhhDecision: decision,
        rrhhComentario: comentario?.trim() || null,
        rrhhDescontarSalario: descontarSalario !== void 0 ? !!descontarSalario : null,
        rrhhFecha: /* @__PURE__ */ new Date(),
        estado: newEstado
      }
    });
    auditLog({ usuario: req.user.usuario, accion: `rrhh_${decision.toLowerCase()}_permiso`, recurso: `/api/permisos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, data: { id: updated.id, estado: updated.estado }, message: `Permiso ${decision === "Aprobado" ? "aprobado por RR.HH." : "rechazado por RR.HH."}` });
  } catch (error) {
    logger2.error("[PERMISOS] Error RRHH decision:", error);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: "Error al procesar decisi\xF3n" } });
  }
});
permisosRouter.get("/:id/pdf", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const permiso = await prisma.permiso.findUnique({ where: { id }, include: { colaborador: true } });
    if (!permiso) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Permiso no encontrado" } });
    const fechaSolicitud = (/* @__PURE__ */ new Date()).toLocaleDateString("es-PY");
    const formatFecha = (d) => d ? d.toLocaleDateString("es-PY") : "___/___/____";
    const paresCheckboxes = [
      ["Permiso para retirarme antes de horario", "", 'Licencia por nacimiento (Art. 62, "j"; Ley 5508/16)', ""],
      ["Permiso por razones de estudios", "", "Licencia por matrimonio (Ley 3384/07)", ""],
      ["Permiso para llegar fuera de mi horario", "", "Licencia por fallecimiento familiar directo", ""],
      ["Licencia por motivos de salud (aclarar)", "", "Licencia por defunci\xF3n (Ley 3384/07)", ""],
      ["Otros (Aclarar):", "", "Licencia por maternidad/lactancia (Art. 133 CT) Ley 5508/16", ""]
    ];
    const marcar = (label) => permiso.tipoPermiso === label || permiso.tipoPermiso.startsWith(label.split("(")[0].trim()) ? "\u2611" : "\u2610";
    const otrosText = permiso.tipoPermiso === "Otros" ? `<span style="border-bottom:1px solid #000;display:inline-block;min-width:150px;">${permiso.motivo || ""}</span>` : "";
    const tablaSolicitudes = paresCheckboxes.map(([izq, , der]) => `
      <tr>
        <td class="chk">${marcar(izq)}</td>
        <td>${izq}</td>
        <td class="chk">${marcar(der)}</td>
        <td>${der}${izq === "Otros (Aclarar):" && marcar(izq) === "\u2611" ? " " + otrosText : ""}</td>
      </tr>`).join("");
    const datosSolicitante = [
      ["Fecha:", fechaSolicitud],
      ["Nombre y Apellido:", permiso.nombreSolicitante || ""],
      ["Cargo:", permiso.cargo || ""],
      ["C.I.Nro.:", permiso.ci || ""],
      ["Departamento:", permiso.departamento || ""],
      ["Jefe inmediato:", permiso.jefeInmediato || ""]
    ].map(([label, valor]) => `
      <p class="linea-dato"><span class="campo">${label}</span>
        <span style="border-bottom:1px solid #000;display:inline-block;min-width:280px;">${valor || ""}</span></p>`).join("");
    const tiempoHoras = permiso.modoTiempo === "horas" ? `
      <p style="margin:2px 0;"><span class="campo">En caso de horas:</span>
        &nbsp;desde las <span class="sub">${permiso.horaInicio || "___:___"}</span> hs.
        &nbsp;Hasta las <span class="sub">${permiso.horaFin || "___:___"}</span> hs.,
        del d\xEDa <span class="sub">${formatFecha(permiso.fechaHora)}</span>. -</p>` : "";
    const tiempoDias = permiso.modoTiempo === "dias" ? `
      <p style="margin:2px 0;"><span class="campo">En caso de d\xEDas:</span>
        &nbsp;&nbsp;&nbsp;desde el d\xEDa <span class="sub">${formatFecha(permiso.fechaDesde)}</span>
        &nbsp;hasta el d\xEDa <span class="sub">${formatFecha(permiso.fechaHasta)}</span>. -</p>` : "";
    const rrhhSection = permiso.rrhhDecision || permiso.estado === "Aprobado" ? `
      <p class="titulo-seccion">PARA USO EXCLUSIVO DE RRHH.</p>
      <table class="tabla-rrhh">
        <tr>
          <td class="chk">${permiso.rrhhDescontarSalario === true ? "\u2611" : "\u2610"}</td>
          <td><strong>SI</strong> ser\xE1 descontada del salario</td>
          <td class="chk">${permiso.rrhhDescontarSalario === false ? "\u2611" : "\u2610"}</td>
          <td><strong>NO</strong> ser\xE1 descontada del salario</td>
        </tr>
      </table>
      <p style="font-size:10px;margin:4px 0 0;">Decisi\xF3n RR.HH.: <strong>${permiso.rrhhDecision || "Pendiente"}</strong>
      ${permiso.rrhhComentario ? ` \u2014 Comentario: ${permiso.rrhhComentario}` : ""}
      ${permiso.rrhhFecha ? ` \u2014 Fecha: ${permiso.rrhhFecha.toLocaleDateString("es-PY")}` : ""}</p>` : "";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>SOLICITUD DE PERMISO \u2014 ${permiso.nombreSolicitante}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #000; max-width: 210mm; margin: 0 auto; padding: 14mm 16mm; font-size: 11pt; line-height: 1.35; background:#fff; }
  table { border-collapse: collapse; }
  /* Encabezado: logo | t\xEDtulo | c\xF3digo/versi\xF3n/hoja */
  .header-table { width: 100%; border: 1px solid #000; }
  .header-table td { border: 1px solid #000; vertical-align: middle; }
  .logo-cell { width: 24%; text-align: center; padding: 4px 6px; }
  .logo-cell img { max-height: 18mm; max-width: 100%; }
  .title-cell { width: 52%; text-align: center; font-weight: bold; font-size: 15pt; letter-spacing: 1px; padding: 4px; }
  .meta-cell { width: 24%; font-size: 10pt; font-weight: bold; padding: 4px 10px; text-align: left; }
  .meta-cell div { border-bottom: 1px solid #000; padding: 3px 0; }
  /* T\xEDtulos de secci\xF3n subrayados (como el .docx) */
  .titulo-seccion { font-weight: bold; text-decoration: underline; margin: 14px 0 6px; font-size: 11.5pt; }
  .sub { border-bottom: 1px solid #000; display: inline-block; min-width: 90px; text-align: center; }
  /* Procedimiento numerado */
  ol.procedimiento { margin: 4px 0 8px 22px; padding: 0; }
  ol.procedimiento li { margin-bottom: 3px; }
  /* Datos del solicitante: cada l\xEDnea label + espacio */
  .linea-dato { margin: 2px 0; }
  .campo { font-weight: normal; }
  /* Tabla de solicitudes (checkbox + texto) */
  .tabla-opciones, .tabla-rrhh { width: 100%; border: 1px solid #000; margin: 8px 0; }
  .tabla-opciones td, .tabla-rrhh td { border: 1px solid #000; padding: 5px 8px; vertical-align: middle; }
  .tabla-opciones .chk, .tabla-rrhh .chk { width: 22px; text-align: center; font-size: 13pt; }
  /* Firmas */
  .firma-linea { margin: 6px 0; font-size: 11pt; }
  .firma-caja { display: inline-block; width: 45mm; border-bottom: 1px solid #000; height: 14pt; }
  /* Leyenda */
  .leyenda { margin-top: 14px; font-size: 8pt; line-height: 1.5; }
  .leyenda strong { font-size: 8.5pt; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="logo-cell" rowspan="3"><img src="${LOGO_AFULL_DATA_URI}" alt="aFULL"></td>
      <td class="title-cell" rowspan="3">SOLICITUD DE PERMISO</td>
      <td class="meta-cell"><div>C\xF3digo: 001</div></td>
    </tr>
    <tr><td class="meta-cell"><div>Versi\xF3n: 00</div></td></tr>
    <tr><td class="meta-cell"><div>Hoja: 1/1</div></td></tr>
  </table>

  <p class="titulo-seccion">PROCEDIMIENTO.</p>
  <ol class="procedimiento">
    <li>Deber\xE1 presentarse dentro de las 24 horas del usufructo, caso contrario ser\xE1 considerada ausencia injustificada con descuento de salario.</li>
    <li>En caso de ausencia por razones de salud, se deber\xE1 adjuntar reposo o certificado m\xE9dico.</li>
    <li>En casos de notificaciones judiciales para audiencias, acompa\xF1ar c\xE9dula de notificaci\xF3n.</li>
    <li>En los casos de nacimientos, acompa\xF1ar Certificado de Nacido Vivo (M.S.P. y B.S.) y Certificado de Nacimiento (Registro Civil).</li>
    <li>En todos los casos se deber\xE1 especificar los motivos de la solicitud, caso contrario ser\xE1 considerado como ausencia injustificada pasible de descuento del salario.</li>
    <li>La solicitud debe estar firmada por el Jefe inmediato, el solicitante y archivarse en su legajo.</li>
  </ol>

  <p class="titulo-seccion">DATOS DEL SOLICITANTE.</p>
  ${datosSolicitante}

  <p style="margin:8px 0 4px;">Quien suscribe, se dirige a ustedes con el objeto de solicitar:</p>
  <table class="tabla-opciones">
    ${tablaSolicitudes}
  </table>

  <p class="titulo-seccion">TIEMPO A SER USUFRUCTUADO.</p>
  ${tiempoHoras}
  ${tiempoDias}

  <p style="margin:10px 0;">Sin otro particular, y esperando respuesta favorable, me despido de ustedes muy atentamente,</p>

  <p class="firma-linea">Firma del solicitante (1): <span class="firma-caja"></span>
    &nbsp;&nbsp;&nbsp;Firma jefe inmediato (2): <span class="firma-caja"></span></p>
  <p class="firma-linea">RR.HH. (3): <span class="firma-caja" style="width:80mm;"></span></p>

  ${rrhhSection}

  <div class="leyenda">
    <strong>Licencias dispuestas por ley.</strong><br>
    \u2022 Maternidad (Ley 5508/16) <em>18 semanas.</em><br>
    \u2022 Lactancia (Art. 133/136 CT) <em>1,5 horas por d\xEDa.</em><br>
    \u2022 Matrimonio (Ley 3384/07, Art. 62 "j" CT) <em>3 d\xEDas.</em><br>
    \u2022 Nacimiento de hijos (Ley 5508/16) <em>2 semanas.</em><br>
    \u2022 Defunci\xF3n de c\xF3nyuge, padres, hijos, abuelos, y/o hermanos (Ley 3384/07, Art. 62 "j" CT) <em>3 d\xEDas.</em><br>
    \u2022 Obligaciones legales (audiencias, votaci\xF3n, etc.) Art. 62 "h". <em>Seg\xFAn necesidad.</em><br>
    \u2022 Preaviso (Art. 89 CT) <em>2 horas diarias o 1 d\xEDa a la semana.</em>
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    logger2.error("[PERMISOS] Error generating PDF:", error);
    res.status(500).json({ success: false, error: { code: "PDF_ERROR", message: "Error al generar documento" } });
  }
});
permisosRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.permiso.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Permiso no encontrado" } });
    if (existing.estado !== "Pendiente") return res.status(400).json({ success: false, error: { code: "LOCKED", message: "No se puede eliminar un permiso ya procesado" } });
    await prisma.permiso.delete({ where: { id } });
    auditLog({ usuario: req.user.usuario, accion: "delete_permiso", recurso: `/api/permisos/${id}`, resultado: "success", ip: getClientIp(req) });
    res.json({ success: true, message: "Solicitud de permiso eliminada" });
  } catch (error) {
    logger2.error("[PERMISOS] Error deleting:", error);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: "Error al eliminar permiso" } });
  }
});

// src/server/routes/insumos.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router22 } from "express";
import path7 from "path";
import fs7 from "fs";
import XLSX from "xlsx";
import { z as z2 } from "zod";
var insumosRouter = Router22();
var insumosCache = [];
var categoriasCache = [];
var lastLoadedTime = 0;
function cargarInsumosDesdeExcel() {
  const rutaArchivo = path7.resolve(process.cwd(), "insumos.xlsx");
  if (!fs7.existsSync(rutaArchivo)) {
    logger2.warn(`[INSUMOS] No se encontr\xF3 el archivo en: ${rutaArchivo}`);
    return { insumos: [], categorias: [] };
  }
  try {
    const workbook = XLSX.readFile(rutaArchivo);
    const primeraHoja = workbook.SheetNames[0] || "Hoja1";
    const worksheet = workbook.Sheets[primeraHoja];
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    const items = rawData.map((row, idx) => {
      const nombre = String(row["Insumo"] || "").trim();
      if (!nombre) return null;
      const costoRaw = row["Costo"];
      const costo = typeof costoRaw === "number" ? Math.round(costoRaw) : parseFloat(String(costoRaw).replace(",", ".")) || 0;
      const unidadMedida = String(row["Unidad Medida"] || "unidad").trim();
      let categoria = String(row["Unidad"] || "General").trim();
      if (categoria === "electricidad") categoria = "Electricidad";
      if (categoria === "Impresi\xF3n") categoria = "Impresiones";
      if (categoria === "N/A" || categoria === "169000") categoria = "General";
      let proveedor = void 0;
      if (/serimax/i.test(nombre)) proveedor = "Serimax";
      else if (/altatec/i.test(nombre)) proveedor = "Altatec";
      const esLona = /lona/i.test(nombre);
      const esImpresion = /impresi|lona|vinil|adhesiv|microperf|rollup|banner/i.test(categoria + " " + nombre);
      return {
        id: `ins_${idx + 1}`,
        nombre,
        costo,
        unidadMedida,
        categoria,
        proveedor,
        esLona,
        esImpresion
      };
    }).filter((item) => item !== null);
    for (const item of items) {
      if (item.esImpresion && !/desperdicio|merma/i.test(item.nombre)) {
        const matchingWaste = items.find((other) => {
          if (!/desperdicio|merma/i.test(other.nombre)) return false;
          if (item.proveedor && other.proveedor) {
            return item.proveedor.toLowerCase() === other.proveedor.toLowerCase() && (item.esLona && other.esLona || !item.esLona && !other.esLona);
          }
          if (/esmerilado/i.test(item.nombre) && /esmerilado/i.test(other.nombre)) return true;
          if (/transparente/i.test(item.nombre) && /transparente/i.test(other.nombre)) return true;
          if (item.esLona && other.esLona) return true;
          return false;
        });
        if (matchingWaste) {
          item.costoDesperdicio = matchingWaste.costo;
        }
      }
    }
    const categoriasSet = /* @__PURE__ */ new Set();
    items.forEach((i) => {
      if (i.categoria) categoriasSet.add(i.categoria);
    });
    const categorias = Array.from(categoriasSet).sort((a, b) => a.localeCompare(b));
    insumosCache = items;
    categoriasCache = categorias;
    lastLoadedTime = Date.now();
    logger2.info(`[INSUMOS] ${items.length} insumos cargados exitosamente desde insumos.xlsx (${categorias.length} categor\xEDas)`);
    return { insumos: items, categorias };
  } catch (error) {
    logger2.error("[INSUMOS] Error al leer insumos.xlsx:", error);
    return { insumos: [], categorias: [] };
  }
}
function esUsuarioOperario2(user) {
  if (!user || !user.rol) return false;
  const r = String(user.rol).toUpperCase();
  return r === "OPERADOR" || r === "OPERARIO" || r.includes("OPER");
}
function formatInsumoDb(i, isOperario = false) {
  return {
    id: i.id,
    nombre: i.nombre,
    costo: isOperario ? 0 : Number(i.costo),
    unidadMedida: i.unidad,
    categoria: i.categoria,
    proveedor: i.proveedor || void 0,
    costoDesperdicio: isOperario ? void 0 : i.costoDesperdicio != null ? Number(i.costoDesperdicio) : void 0,
    esLona: Boolean(i.esLona),
    esImpresion: Boolean(i.esImpresion),
    anchoEstandar: i.anchoEstandar != null ? Number(i.anchoEstandar) : void 0,
    altoEstandar: i.altoEstandar != null ? Number(i.altoEstandar) : void 0,
    activo: Boolean(i.activo),
    notas: i.notas || void 0,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt
  };
}
async function seedInsumosIfEmpty() {
  try {
    const count = await prisma.insumo.count();
    if (count > 0) {
      return;
    }
    logger2.info("[INSUMOS SEED] Tabla vac\xEDa. Sembrando 261 insumos desde insumos.xlsx en PostgreSQL...");
    const { insumos } = cargarInsumosDesdeExcel();
    if (insumos.length === 0) return;
    await prisma.insumo.createMany({
      data: insumos.map((item) => ({
        id: item.id,
        codigo: item.id,
        nombre: item.nombre,
        categoria: item.categoria,
        proveedor: item.proveedor || null,
        unidad: item.unidadMedida || "m2",
        costo: item.costo,
        costoDesperdicio: item.costoDesperdicio ?? null,
        esLona: !!item.esLona,
        esImpresion: !!item.esImpresion,
        activo: true
      })),
      skipDuplicates: true
    });
    logger2.info(`[INSUMOS SEED] ${insumos.length} insumos importados exitosamente a la base de datos.`);
  } catch (err) {
    logger2.error("[INSUMOS SEED] Error durante la semilla de insumos:", err.message);
  }
}
var insumoSchema = z2.object({
  nombre: z2.string().min(2, "El nombre debe tener al menos 2 caracteres").max(255),
  categoria: z2.string().min(1, "La categor\xEDa es requerida").max(100),
  costo: z2.number().nonnegative("El costo debe ser mayor o igual a 0"),
  costoDesperdicio: z2.number().nonnegative().optional().nullable(),
  proveedor: z2.string().max(100).optional().nullable(),
  unidad: z2.string().default("m2").optional(),
  esLona: z2.boolean().default(false).optional(),
  esImpresion: z2.boolean().default(false).optional(),
  anchoEstandar: z2.number().optional().nullable(),
  altoEstandar: z2.number().optional().nullable(),
  activo: z2.boolean().default(true).optional(),
  notas: z2.string().optional().nullable()
});
insumosRouter.get("/", requireAuth, async (req, res) => {
  try {
    await seedInsumosIfEmpty();
    const { search, categoria, activo, limit, page } = req.query;
    const whereClause = {};
    if (activo === "all") {
    } else if (activo === "false") {
      whereClause.activo = false;
    } else {
      whereClause.activo = true;
    }
    if (categoria && typeof categoria === "string" && categoria !== "Todas") {
      whereClause.categoria = { equals: categoria, mode: "insensitive" };
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { proveedor: { contains: q, mode: "insensitive" } },
        { categoria: { contains: q, mode: "insensitive" } }
      ];
    }
    const total = await prisma.insumo.count({ where: whereClause });
    const maxLimit = limit ? parseInt(String(limit), 10) : void 0;
    const currentPage = page ? Math.max(1, parseInt(String(page), 10)) : 1;
    const skip = maxLimit ? (currentPage - 1) * maxLimit : void 0;
    const itemsDb = await prisma.insumo.findMany({
      where: whereClause,
      orderBy: { nombre: "asc" },
      take: maxLimit,
      skip
    });
    const distinctCats = await prisma.insumo.findMany({
      select: { categoria: true },
      distinct: ["categoria"],
      where: { activo: true },
      orderBy: { categoria: "asc" }
    });
    const categorias = distinctCats.map((c) => c.categoria).filter(Boolean);
    const isOperario = esUsuarioOperario2(req.user);
    res.json({
      success: true,
      data: {
        insumos: itemsDb.map((i) => formatInsumoDb(i, isOperario)),
        categorias,
        total,
        origen: "POSTGRESQL"
      }
    });
  } catch (error) {
    logger2.error("Error al obtener insumos desde BD:", error);
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: "Error al consultar cat\xE1logo de insumos en la base de datos" }
    });
  }
});
insumosRouter.get("/lonas", requireAuth, async (req, res) => {
  try {
    await seedInsumosIfEmpty();
    const itemsDb = await prisma.insumo.findMany({
      where: {
        activo: true,
        OR: [
          { esLona: true },
          { esImpresion: true },
          { categoria: { in: ["Impresiones", "Ploteo", "Carteleria"] } }
        ]
      },
      orderBy: { nombre: "asc" }
    });
    const isOperario = esUsuarioOperario2(req.user);
    res.json({
      success: true,
      data: itemsDb.map((i) => formatInsumoDb(i, isOperario))
    });
  } catch (error) {
    logger2.error("Error al obtener lonas desde BD:", error);
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: "Error al consultar insumos de lonas" }
    });
  }
});
insumosRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const item = await prisma.insumo.findUnique({
      where: { id: req.params.id }
    });
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Insumo no encontrado" }
      });
    }
    const isOperario = esUsuarioOperario2(req.user);
    res.json({ success: true, data: formatInsumoDb(item, isOperario) });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: error.message } });
  }
});
insumosRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = insumoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Datos de insumo inv\xE1lidos"
        }
      });
    }
    const data = parsed.data;
    const nuevoId = `ins_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const esLona = data.esLona ?? /lona/i.test(data.nombre);
    const esImpresion = data.esImpresion ?? /impresi|lona|vinil|adhesiv|microperf|rollup|banner/i.test(data.categoria + " " + data.nombre);
    const created = await prisma.insumo.create({
      data: {
        id: nuevoId,
        codigo: nuevoId,
        nombre: data.nombre.trim(),
        categoria: data.categoria.trim(),
        proveedor: data.proveedor ? data.proveedor.trim() : null,
        unidad: data.unidad || "m2",
        costo: data.costo,
        costoDesperdicio: data.costoDesperdicio ?? null,
        esLona,
        esImpresion,
        anchoEstandar: data.anchoEstandar ?? null,
        altoEstandar: data.altoEstandar ?? null,
        activo: data.activo !== false,
        notas: data.notas ? data.notas.trim() : null
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "crear_insumo",
      recurso: `/api/insumos/${created.id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Insumo creado: ${created.nombre} (${created.categoria}) - Costo: ${created.costo}`
    });
    res.status(201).json({
      success: true,
      message: "Insumo creado exitosamente en la base de datos",
      data: formatInsumoDb(created)
    });
  } catch (error) {
    logger2.error("Error al crear insumo:", error);
    res.status(500).json({
      success: false,
      error: { code: "CREATE_ERROR", message: error.message || "Error al crear insumo" }
    });
  }
});
insumosRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.insumo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Insumo no encontrado" }
      });
    }
    const partialSchema = insumoSchema.partial();
    const parsed = partialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Datos de actualizaci\xF3n inv\xE1lidos"
        }
      });
    }
    const data = parsed.data;
    const updated = await prisma.insumo.update({
      where: { id },
      data: {
        ...data.nombre !== void 0 && { nombre: data.nombre.trim() },
        ...data.categoria !== void 0 && { categoria: data.categoria.trim() },
        ...data.proveedor !== void 0 && { proveedor: data.proveedor ? data.proveedor.trim() : null },
        ...data.unidad !== void 0 && { unidad: data.unidad },
        ...data.costo !== void 0 && { costo: data.costo },
        ...data.costoDesperdicio !== void 0 && { costoDesperdicio: data.costoDesperdicio },
        ...data.esLona !== void 0 && { esLona: data.esLona },
        ...data.esImpresion !== void 0 && { esImpresion: data.esImpresion },
        ...data.anchoEstandar !== void 0 && { anchoEstandar: data.anchoEstandar },
        ...data.altoEstandar !== void 0 && { altoEstandar: data.altoEstandar },
        ...data.activo !== void 0 && { activo: data.activo },
        ...data.notas !== void 0 && { notas: data.notas ? data.notas.trim() : null }
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "editar_insumo",
      recurso: `/api/insumos/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Insumo actualizado: ${updated.nombre} - Costo: ${updated.costo}`
    });
    res.json({
      success: true,
      message: "Insumo actualizado exitosamente",
      data: formatInsumoDb(updated)
    });
  } catch (error) {
    logger2.error("Error al actualizar insumo:", error);
    res.status(500).json({
      success: false,
      error: { code: "UPDATE_ERROR", message: error.message || "Error al actualizar insumo" }
    });
  }
});
insumosRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.insumo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Insumo no encontrado" }
      });
    }
    const hard = req.query.hard === "true";
    if (hard) {
      await prisma.insumo.delete({ where: { id } });
      auditLog({
        usuario: req.user.usuario,
        accion: "eliminar_insumo_fisico",
        recurso: `/api/insumos/${id}`,
        resultado: "success",
        ip: getClientIp(req),
        detalle: `Insumo eliminado permanentemente: ${existing.nombre}`
      });
      return res.json({
        success: true,
        message: "Insumo eliminado permanentemente de la base de datos",
        data: { id, deleted: true }
      });
    }
    const nuevoEstado = !existing.activo;
    const toggled = await prisma.insumo.update({
      where: { id },
      data: { activo: nuevoEstado }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: nuevoEstado ? "activar_insumo" : "desactivar_insumo",
      recurso: `/api/insumos/${id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Insumo ${nuevoEstado ? "activado" : "desactivado"}: ${existing.nombre}`
    });
    res.json({
      success: true,
      message: nuevoEstado ? "Insumo activado exitosamente" : "Insumo desactivado",
      data: formatInsumoDb(toggled)
    });
  } catch (error) {
    logger2.error("Error al alternar estado de insumo:", error);
    res.status(500).json({
      success: false,
      error: { code: "DELETE_ERROR", message: error.message || "Error al modificar insumo" }
    });
  }
});
insumosRouter.post("/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { insumos } = cargarInsumosDesdeExcel();
    if (insumos.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: "FILE_NOT_FOUND", message: "No se encontr\xF3 el archivo insumos.xlsx en la ra\xEDz" }
      });
    }
    let insertados = 0;
    let actualizados = 0;
    for (const item of insumos) {
      const existing = await prisma.insumo.findUnique({ where: { id: item.id } });
      if (existing) {
        await prisma.insumo.update({
          where: { id: item.id },
          data: {
            nombre: item.nombre,
            categoria: item.categoria,
            proveedor: item.proveedor || null,
            unidad: item.unidadMedida || "m2",
            costo: item.costo,
            costoDesperdicio: item.costoDesperdicio ?? null,
            esLona: !!item.esLona,
            esImpresion: !!item.esImpresion
          }
        });
        actualizados++;
      } else {
        await prisma.insumo.create({
          data: {
            id: item.id,
            codigo: item.id,
            nombre: item.nombre,
            categoria: item.categoria,
            proveedor: item.proveedor || null,
            unidad: item.unidadMedida || "m2",
            costo: item.costo,
            costoDesperdicio: item.costoDesperdicio ?? null,
            esLona: !!item.esLona,
            esImpresion: !!item.esImpresion,
            activo: true
          }
        });
        insertados++;
      }
    }
    auditLog({
      usuario: req.user.usuario,
      accion: "sync_insumos_excel_db",
      recurso: "/api/insumos/sync",
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Sincronizados en PostgreSQL: ${insertados} creados, ${actualizados} actualizados`
    });
    res.json({
      success: true,
      message: `Base de datos sincronizada: ${insertados} insumos creados, ${actualizados} actualizados`,
      data: { insertados, actualizados, total: insumos.length }
    });
  } catch (error) {
    logger2.error("Error sincronizando insumos con DB:", error);
    res.status(500).json({
      success: false,
      error: { code: "SYNC_ERROR", message: "Error al sincronizar insumos.xlsx con la base de datos" }
    });
  }
});

// src/server/routes/facturasCompra.routes.ts
init_prisma();
init_server_auth();
init_server_audit();
init_logger();
import { Router as Router23 } from "express";
import { z as z3 } from "zod";
var facturasCompraRouter = Router23();
var facturaCompraSchema = z3.object({
  facturaNumero: z3.string().min(1, "El n\xFAmero de factura es obligatorio").max(50),
  proveedor: z3.string().min(1, "El proveedor es obligatorio").max(100),
  fecha: z3.string().optional(),
  descripcion: z3.string().min(1, "La descripci\xF3n es obligatoria").max(255),
  cantidadComprada: z3.number().positive("La cantidad debe ser mayor a 0"),
  unidad: z3.string().default("u"),
  precioUnitario: z3.number().nonnegative("El precio unitario no puede ser negativo"),
  total: z3.number().nonnegative().optional(),
  notas: z3.string().optional()
});
function formatFacturaCompra(f) {
  const comprada = Number(f.cantidadComprada) || 0;
  const usada = Number(f.cantidadUsada) || 0;
  const disponible = Math.max(0, Math.round((comprada - usada) * 1e3) / 1e3);
  return {
    id: f.id,
    facturaNumero: f.facturaNumero,
    proveedor: f.proveedor,
    fecha: f.fecha ? new Date(f.fecha).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    descripcion: f.descripcion,
    cantidadComprada: comprada,
    cantidadUsada: usada,
    cantidadDisponible: disponible,
    unidad: f.unidad,
    precioUnitario: Number(f.precioUnitario) || 0,
    total: Number(f.total) || 0,
    notas: f.notas || null,
    createdAt: f.createdAt
  };
}
facturasCompraRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { disponibles } = req.query;
    const facturas = await prisma.facturaCompra.findMany({
      orderBy: { fecha: "desc" },
      take: 100
    });
    let resultado = facturas.map(formatFacturaCompra);
    if (disponibles === "true") {
      resultado = resultado.filter((f) => f.cantidadDisponible > 0);
    }
    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    logger2.error("[FACTURAS COMPRA] Error fetching:", error);
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: error.message || "Error al obtener facturas" }
    });
  }
});
facturasCompraRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = facturaCompraSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Datos inv\xE1lidos" }
      });
    }
    const {
      facturaNumero,
      proveedor,
      fecha,
      descripcion,
      cantidadComprada,
      unidad,
      precioUnitario,
      total,
      notas
    } = parsed.data;
    const id = `fac_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const totalCalculado = total ?? Math.round(cantidadComprada * precioUnitario);
    const created = await prisma.facturaCompra.create({
      data: {
        id,
        facturaNumero: facturaNumero.trim(),
        proveedor: proveedor.trim(),
        fecha: fecha ? new Date(fecha) : /* @__PURE__ */ new Date(),
        descripcion: descripcion.trim(),
        cantidadComprada,
        cantidadUsada: 0,
        unidad: unidad.trim(),
        precioUnitario,
        total: totalCalculado,
        notas: notas ? notas.trim() : null
      }
    });
    auditLog({
      usuario: req.user.usuario,
      accion: "crear_factura_compra",
      recurso: `/api/facturas-compra/${created.id}`,
      resultado: "success",
      ip: getClientIp(req),
      detalle: `Factura ${created.facturaNumero} (${created.proveedor}) - ${created.descripcion}`
    });
    res.status(201).json({
      success: true,
      data: formatFacturaCompra(created),
      message: "Factura de compra registrada exitosamente"
    });
  } catch (error) {
    logger2.error("[FACTURAS COMPRA] Error creating:", error);
    res.status(500).json({
      success: false,
      error: { code: "CREATE_ERROR", message: error.message || "Error al registrar factura" }
    });
  }
});
facturasCompraRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.facturaCompra.findUnique({
      where: { id },
      include: { _count: { select: { registros: true } } }
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Factura no encontrada" }
      });
    }
    if (existing._count.registros > 0 || Number(existing.cantidadUsada) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "IN_USE",
          message: "No se puede eliminar la factura porque ya tiene consumos asignados a proyectos"
        }
      });
    }
    await prisma.facturaCompra.delete({ where: { id } });
    auditLog({
      usuario: req.user.usuario,
      accion: "eliminar_factura_compra",
      recurso: `/api/facturas-compra/${id}`,
      resultado: "success",
      ip: getClientIp(req)
    });
    res.json({ success: true, message: "Factura eliminada" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "DELETE_ERROR", message: error.message }
    });
  }
});

// src/server/jobs/pedidosRetention.ts
init_prisma();
init_logger();
var RETENTION_DAYS = Number(process.env.PEDIDOS_RETENTION_DAYS) || 90;
var INTERVAL_MS = Number(process.env.PEDIDOS_RETENTION_INTERVAL_MS) || 24 * 60 * 60 * 1e3;
var ESTADOS_TERMINALES = ["Completado", "Entregado"];
var intervalHandle = null;
async function archivarPedidosAntiguos() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1e3);
  try {
    const resultado = await prisma.pedido.updateMany({
      where: {
        archivado: false,
        estado: { in: ESTADOS_TERMINALES },
        updatedAt: { lt: cutoff }
      },
      data: {
        archivado: true,
        archivadoAt: /* @__PURE__ */ new Date()
      }
    });
    if (resultado.count > 0) {
      logger2.info(
        `[RETENTION] ${resultado.count} pedido(s) archivado(s) (estados: ${ESTADOS_TERMINALES.join(", ")}, antig\xFCedad > ${RETENTION_DAYS} d\xEDas)`
      );
    }
    return resultado.count;
  } catch (error) {
    logger2.error("[RETENTION] Error archivando pedidos antiguos:", error);
    return 0;
  }
}
function startPedidosRetentionJob() {
  if (intervalHandle) {
    logger2.warn("[RETENTION] Job de retenci\xF3n ya est\xE1 corriendo");
    return;
  }
  archivarPedidosAntiguos().catch(
    (e) => logger2.error("[RETENTION] Error en ejecuci\xF3n inicial:", e)
  );
  intervalHandle = setInterval(() => {
    archivarPedidosAntiguos().catch(
      (e) => logger2.error("[RETENTION] Error en ejecuci\xF3n peri\xF3dica:", e)
    );
  }, INTERVAL_MS);
  logger2.info(
    `[RETENTION] Job de retenci\xF3n de pedidos iniciado (cada ${Math.round(INTERVAL_MS / 36e5)}h, archivar > ${RETENTION_DAYS} d\xEDas)`
  );
}

// server.ts
dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres.opscthfkeqlqyrfvafmv:Mjjagkaz012.@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = "postgresql://postgres.opscthfkeqlqyrfvafmv:Mjjagkaz012.@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = "https://opscthfkeqlqyrfvafmv.supabase.co";
}
if (!process.env.SUPABASE_SERVICE_KEY) {
  process.env.SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wc2N0aGZrZXFscXlyZnZhZm12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ2NDQyNiwiZXhwIjoyMDk3MDQwNDI2fQ.Q1W1CNoqzb4GGr-wIgOm7RZakp-Ue74DsvgHeQhs2q0";
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "yIUDXn0iEkb9gNPcO72XsdUmYLWv588BS0TPm39T59aFD4vFahdwsJADvcMM95p0";
}
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var app = express();
app.set("trust proxy", 1);
var PORT = Number(process.env.PORT) || 3e3;
var isProduction = process.env.NODE_ENV === "production";
logger2.info(`[HELMET] Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode - CSP ${isProduction ? "ENABLED" : "DISABLED"}`);
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  } : false,
  hsts: isProduction ? { maxAge: 31536e3, includeSubDomains: true, preload: true } : false,
  frameguard: { action: "deny" },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
var corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    if (process.env.APP_URL && origin === process.env.APP_URL) return callback(null, true);
    if (origin.endsWith(".vercel.app") || origin.includes("localhost")) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    if (proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
});
function validateCSRF(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const csrfToken = req.headers["x-csrf-token"];
  const sessionId = req.cookies?.sessionId;
  if (!sessionId || !csrfToken) {
    return res.status(403).json({ success: false, error: { code: "CSRF_TOKEN_MISSING", message: "Token CSRF requerido" } });
  }
  const storedToken = csrfTokens.get(sessionId);
  if (!storedToken || storedToken.token !== csrfToken) {
    return res.status(403).json({ success: false, error: { code: "CSRF_TOKEN_INVALID", message: "Token CSRF invalido" } });
  }
  next();
}
app.use("/api", (req, res, next) => {
  if (req.path === "/auth/login" || req.path === "/auth/logout" || req.path === "/csrf-token" || req.path.startsWith("/portal/")) {
    return next();
  }
  validateCSRF(req, res, next);
});
app.use("/api", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/proyectos", proyectosRouter);
app.use("/api/colaboradores", colaboradoresRouter);
app.use("/api/admin/sucursales", sucursalesRouter);
app.use("/api/admin/pedidos", pedidosRouter);
app.use("/api/portal", portalRouter);
app.use("/api/timer", timerRouter);
app.use("/api/viaje", viajeRouter);
app.use("/api/vehiculo", vehiculoRouter);
app.use("/api/admin/cartera", carteraRouter);
app.use("/api", importRouter);
app.use("/api/admin/presupuestos", presupuestosRouter);
app.use("/api/admin/ordenes-trabajo", presupuestosRouter);
app.use("/api/admin/hojas-ruta", hojasRutaRouter);
app.use("/api/operario", operarioRouter);
app.use("/api", dataRouter);
app.use("/api/registros", registrosRouter);
app.use("/api/marcacion", marcacionRouter);
app.use("/api/audit", auditRouter);
app.use("/api/permisos", permisosRouter);
app.use("/api/insumos", insumosRouter);
app.use("/api/facturas-compra", facturasCompraRouter);
app.use("/uploads", express.static(path8.join(__dirname2, "uploads")));
app.use((err, req, res, next) => {
  logger2.error("[ERROR HANDLER]", err);
  const isDevelopment = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: isDevelopment ? err.message : "Error interno del servidor",
      ...isDevelopment && err.stack && { stack: err.stack }
    }
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
    const fs8 = await import("fs");
    app.get("/portal/:token", async (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      try {
        let raw = fs8.readFileSync(path8.resolve(process.cwd(), "portal.html"), "utf-8");
        raw = await vite.transformIndexHtml(req.url, raw);
        res.status(200).set({ "Content-Type": "text/html" }).end(raw);
      } catch (e) {
        res.status(500).end(e.message);
      }
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res) => {
      try {
        let raw = fs8.readFileSync(path8.resolve(process.cwd(), "index.html"), "utf-8");
        raw = await vite.transformIndexHtml(req.url, raw);
        res.status(200).set({ "Content-Type": "text/html" }).end(raw);
      } catch (e) {
        res.status(500).end(e.message);
      }
    });
  } else {
    const distPath = path8.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/portal/:token", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(path8.join(distPath, "portal.html"));
    });
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path8.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", async () => {
    logger2.info(`[Sistema aFull] Server running securely on http://localhost:${PORT}`);
    await seedUsersIfEmpty();
    await seedInsumosIfEmpty();
    startPedidosRetentionJob();
  });
}
var isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (process.env.NODE_ENV !== "test" && !isServerless) {
  startServer();
}

// src/server/vercel-entry.ts
function handler(req, res) {
  try {
    const matchedPath = req.headers["x-matched-path"];
    if (matchedPath && typeof matchedPath === "string" && matchedPath.startsWith("/api")) {
      req.url = matchedPath;
    }
    return app(req, res);
  } catch (err) {
    console.error("[VERCEL HANDLER ERROR]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: false,
        error: {
          code: "VERCEL_HANDLER_ERROR",
          message: err?.message || "Error processing serverless request",
          stack: err?.stack
        }
      }));
    }
  }
}
export {
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Authentication & Authorization Module — v2.0
 * Now backed by Supabase (via Prisma) instead of hardcoded users.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SECURITY Phase 3 Fix #17: Audit Logging Module
 *
 * Writes one JSON object per line (JSON Lines format) to audit.log.
 * Uses fs.appendFile (async) which performs an atomic append on the OS level,
 * avoiding race conditions between concurrent writes without an explicit mutex.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Input Validation Schemas with Zod
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sistema aFull - Server Entry Point (modular)
 * Refactor: monolito de 5080 lineas -> 14 routers modulares en src/server/routes/
 */
