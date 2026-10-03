/**
 * Operario Routes — Vista de tareas del operario logueado
 *
 * El operario ingresa con su Usuario (rol OPERADOR), vinculado a un Colaborador.
 * Ve solo SUS tareas (filtradas por colaboradorId del usuario).
 * Puede: marcar estado (Pendiente/EnProgreso/Completada/Omitida), agregar notas, subir foto.
 *
 * Endpoints: /api/operario/tareas
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse } from '../../types.ts';
import fs from 'fs';
import path from 'path';

export const operarioRouter = Router();

// Helper: guardar foto de evidencia de tarea (base64 -> Supabase Storage o local)
async function guardarFotoEvidenciaTarea(tareaId: string, fotoBase64: string): Promise<string> {
  if (!fotoBase64 || !fotoBase64.startsWith('data:')) return fotoBase64;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const raw = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');

  if (supabaseUrl && supabaseServiceKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const storagePath = `tareas/${tareaId}/evidencia_${Date.now()}.jpg`;
    const { error } = await supabaseAdmin.storage.from('vehiculos-fotos').upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      logger.warn('[OPERARIO] Fallback to local storage:', error.message);
    } else {
      const { data } = supabaseAdmin.storage.from('vehiculos-fotos').getPublicUrl(storagePath);
      return data.publicUrl;
    }
  }

  const uploadsDir = path.join(process.cwd(), 'uploads', 'tareas', tareaId);
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `evidencia_${Date.now()}.jpg`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/tareas/${tareaId}/${filename}`;
}

async function resolveOperarioColaborador(user: { usuario: string; nombre?: string; rol?: string; colaboradorId?: string | null }) {
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
          { nombre: { equals: targetNombre, mode: 'insensitive' } },
          { nombre: { contains: targetNombre, mode: 'insensitive' } },
        ]
      },
      select: { id: true, nombre: true }
    });
    if (colab) return colab;
  }

  return { id: null, nombre: targetNombre || null };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/operario/tareas
// Listar las tareas del operario logueado (filtradas por colaboradorId o nombre)
// Query: ?fecha=YYYY-MM-DD (filtro por día), ?estado=, ?page=, ?limit=
// ═══════════════════════════════════════════════════════════════
operarioRouter.get('/tareas', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const operario = await resolveOperarioColaborador(user);
    const orConditions: any[] = [];
    if (operario.id) orConditions.push({ colaboradorId: operario.id });
    if (operario.nombre) orConditions.push({ operarioNombre: { contains: operario.nombre, mode: 'insensitive' } });

    if (user.rol !== 'ADMIN' && orConditions.length === 0) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } as ApiResponse);
    }

    const { fecha, estado, page = '1', limit = '50' } = req.query as Record<string, string>;

    const where: any = {};
    if (user.rol !== 'ADMIN' && orConditions.length > 0) {
      where.OR = orConditions;
    }
    if (estado) where.estado = estado;

    // Filtro por día: si viene fecha, filtra tareas asignadas ese día
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
        orderBy: [{ fechaAsignada: 'desc' }, { orden: 'asc' }],
        skip,
        take: limitNum,
        include: {
          hojaRuta: {
            select: { id: true, clienteNombre: true, proyecto: true, fecha: true, estado: true },
          },
        },
      }),
      prisma.hojaRutaTarea.count({ where }),
    ]);

    res.json({
      success: true,
      data: tareas,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[OPERARIO] Error listing tareas:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar tareas' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/operario/tareas/hoy
// Atajo: las tareas del día de hoy para el operario logueado
// ═══════════════════════════════════════════════════════════════
operarioRouter.get('/tareas/hoy', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const operario = await resolveOperarioColaborador(user);
    const orConditions: any[] = [];
    if (operario.id) orConditions.push({ colaboradorId: operario.id });
    if (operario.nombre) orConditions.push({ operarioNombre: { contains: operario.nombre, mode: 'insensitive' } });

    if (user.rol !== 'ADMIN' && orConditions.length === 0) {
      return res.json({ success: true, data: [] } as ApiResponse);
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const where: any = {
      fechaAsignada: { gte: hoy, lt: manana },
    };
    if (user.rol !== 'ADMIN' && orConditions.length > 0) {
      where.OR = orConditions;
    }

    const tareas = await prisma.hojaRutaTarea.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { fechaAsignada: 'desc' }],
      include: {
        hojaRuta: {
          select: { id: true, clienteNombre: true, proyecto: true, fecha: true },
        },
      },
    });

    res.json({ success: true, data: tareas } as ApiResponse);
  } catch (error: any) {
    logger.error('[OPERARIO] Error listing tareas hoy:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar tareas de hoy' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/operario/tareas/:tareaId
// El operario actualiza el estado de SU tarea + notas + foto
// Solo puede actualizar tareas asignadas a él (verificación de propiedad)
// ═══════════════════════════════════════════════════════════════
operarioRouter.put('/tareas/:tareaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { tareaId } = req.params;
    const { estado, notasOperario, fotoUrl } = req.body;

    const operario = await resolveOperarioColaborador(user);

    // Verificar que la tarea exista
    const tarea = await prisma.hojaRutaTarea.findUnique({
      where: { id: tareaId },
    });
    if (!tarea) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tarea no encontrada' } } as ApiResponse);
    }

    const isOwner = user.rol === 'ADMIN' ||
      (operario.id && tarea.colaboradorId === operario.id) ||
      (operario.nombre && tarea.operarioNombre?.toLowerCase().includes(operario.nombre.toLowerCase()));

    if (!isOwner) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Esta tarea no está asignada a usted' } } as ApiResponse);
    }

    // Validar estado permitido
    const estadosValidos = ['Pendiente', 'EnProgreso', 'Completada', 'Omitida'];
    const nuevoEstado = estado || tarea.estado;
    if (!estadosValidos.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Estado no válido' } } as ApiResponse);
    }

    // Actualizar timestamps según el estado
    const updateData: any = { estado: nuevoEstado };
    if (notasOperario !== undefined) updateData.notasOperario = notasOperario;
    if (fotoUrl !== undefined) {
      if (fotoUrl && fotoUrl.startsWith('data:')) {
        updateData.fotoUrl = await guardarFotoEvidenciaTarea(tareaId, fotoUrl);
      } else {
        updateData.fotoUrl = fotoUrl;
      }
    }

    if (nuevoEstado === 'EnProgreso' && !tarea.fechaInicio) {
      updateData.fechaInicio = new Date();
    }
    if (nuevoEstado === 'Completada' && !tarea.fechaFin) {
      updateData.fechaFin = new Date();
    }
    if (nuevoEstado !== 'Completada' && nuevoEstado !== 'Omitida') {
      // Si revierte el estado, limpiar fechaFin
      if (tarea.fechaFin) updateData.fechaFin = null;
    }

    const actualizada = await prisma.hojaRutaTarea.update({
      where: { id: tareaId },
      data: updateData,
    });

    // Si la tarea se inicia y la hoja está en 'Borrador', activarla automáticamente
    if (nuevoEstado === 'EnProgreso') {
      const hojaPadre = await prisma.hojaRuta.findUnique({
        where: { id: tarea.hojaRutaId },
        select: { estado: true },
      });
      if (hojaPadre && hojaPadre.estado === 'Borrador') {
        await prisma.hojaRuta.update({
          where: { id: tarea.hojaRutaId },
          data: { estado: 'Activa' },
        });
      }
    }

    // Si todas las tareas de la hoja están completadas/omitidas, cerrar la hoja automáticamente
    if (nuevoEstado === 'Completada' || nuevoEstado === 'Omitida') {
      const tareasHoja = await prisma.hojaRutaTarea.findMany({
        where: { hojaRutaId: tarea.hojaRutaId },
        select: { estado: true },
      });
      const todasCerradas = tareasHoja.every((t) => t.estado === 'Completada' || t.estado === 'Omitida');
      if (todasCerradas && tareasHoja.length > 0) {
        await prisma.hojaRuta.update({
          where: { id: tarea.hojaRutaId },
          data: { estado: 'Cerrada' },
        });
      }
    }

    auditLog({
      usuario: user.usuario,
      accion: 'update_tarea_operario',
      recurso: `/api/operario/tareas/${tareaId}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Tarea ${tareaId} actualizada a estado ${nuevoEstado}`,
    });

    res.json({ success: true, data: actualizada, message: 'Tarea actualizada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[OPERARIO] Error updating tarea:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Error al actualizar tarea' } } as ApiResponse);
  }
});

// GET /api/operario/pedidos-activos — Listado de pedidos activos para subir remisión o entrega
operarioRouter.get('/pedidos-activos', requireAuth, async (req: Request, res: Response) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { archivado: false },
      orderBy: { fechaSolicitud: 'desc' },
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
      data: pedidos.map(p => ({
        id: p.id,
        descripcion: p.descripcion,
        local: p.sucursalNombre,
        marca: p.marca,
        estado: p.estado,
        proyecto: p.proyecto,
        fotoRemisionUrl: p.fotoRemisionUrl,
        fotoEntregaUrl: p.fotoEntregaUrl,
        clienteId: p.cliente.id,
        clienteNombre: p.cliente.nombre,
      }))
    });
  } catch (error: any) {
    logger.error('[OPERARIO] Error listing pedidos activos:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar pedidos' } });
  }
});

// POST /api/operario/entregas/foto — Subida de foto de remisión o entrega desde perfil de operario
operarioRouter.post('/entregas/foto', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { pedidoId, tipo, fotoBase64, receptorNombre, fechaEntrega } = req.body || {};

    if (!pedidoId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PEDIDO', message: 'Se requiere el ID del pedido' } });
    }
    if (!tipo || (tipo !== 'remision' && tipo !== 'entrega')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'El tipo debe ser "remision" o "entrega"' } });
    }
    if (!fotoBase64) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PHOTO', message: 'Se requiere la foto en formato base64' } });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } });
    }

    const { guardarFotoEntregaStorage } = await import('./pedidos.routes.ts');
    const photoUrl = await guardarFotoEntregaStorage(pedidoId, fotoBase64, tipo);

    const updateData: any = {};
    if (tipo === 'remision') {
      updateData.fotoRemisionUrl = photoUrl;
    } else {
      updateData.fotoEntregaUrl = photoUrl;
    }
    if (receptorNombre) updateData.receptorNombre = String(receptorNombre).slice(0, 100);
    updateData.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : new Date();

    if (pedido.estado !== 'Entregado') {
      updateData.estado = 'Entregado';
      if (!pedido.fechaFin) updateData.fechaFin = new Date();
    }

    const updated = await prisma.pedido.update({
      where: { id: pedidoId },
      data: updateData
    });

    auditLog({
      usuario: user.usuario,
      accion: 'operario_subir_entrega',
      recurso: `/api/operario/entregas/foto`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Operario ${user.usuario} subió foto de ${tipo} para pedido ${pedidoId}`
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
        receptorNombre: updated.receptorNombre,
      },
      message: `Foto de ${tipo === 'remision' ? 'remisión' : 'entrega'} guardada correctamente`
    });
  } catch (error: any) {
    logger.error('[OPERARIO] Error uploading entrega photo:', error);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: 'Error al subir foto de entrega' } });
  }
});
