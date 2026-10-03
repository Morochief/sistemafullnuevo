/**
 * Hojas de Ruta Routes — Módulo de actividades/tareas por operario
 *
 * Patrón: Express Router independiente, montado en server.ts.
 * Endpoints Admin: /api/admin/hojas-ruta (CRUD + WhatsApp)
 * Endpoints Operario: /api/operario/tareas (solo SUS tareas, actualiza estado)
 *
 * Flujo:
 *   1. El admin genera una Hoja de Ruta desde una OT (botón explícito)
 *   2. Las tareas se autogeneran desde los items del presupuesto (mixto), el admin puede editar
 *   3. El admin asigna cada tarea a un operario (Colaborador)
 *   4. El operario ingresa con su Usuario (rol OPERADOR), ve SUS tareas, marca progreso + notas + foto
 *   5. Cuando todas las tareas están completas, la hoja de ruta pasa a "Cerrada"
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth, requireAdmin, requireWriteAccess, requireProduccionOrAdmin } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse } from '../../types.ts';
import crypto from 'crypto';

export const hojasRutaRouter = Router();

// ═══════════════════════════════════════════════════════════════
// ADMIN: Listar hojas de ruta con filtros + paginación + ordenamiento
// GET /api/admin/hojas-ruta?estado=&clienteId=&operarioId=&search=&page=&limit=&orderBy=&orderDir=
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.get('/', requireAuth, requireProduccionOrAdmin, async (req: Request, res: Response) => {
  try {
    const {
      estado,
      clienteId,
      operarioId,
      search,
      page = '1',
      limit = '20',
      orderBy = 'createdAt',
      orderDir = 'desc',
    } = req.query as Record<string, string>;

    const where: any = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (operarioId) {
      where.tareas = { some: { colaboradorId: operarioId } };
    }
    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [
          { clienteNombre: { contains: q, mode: 'insensitive' } },
          { proyecto: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Mapa de columnas válidas para ordenar (evita inyección)
    const validOrderBy: Record<string, string> = {
      createdAt: 'createdAt',
      fecha: 'fecha',
      clienteNombre: 'clienteNombre',
      proyecto: 'proyecto',
      estado: 'estado',
    };
    const sortField = validOrderBy[orderBy] || 'createdAt';
    const sortDir = orderDir === 'asc' ? 'asc' : 'desc';

    const [hojas, total] = await Promise.all([
      prisma.hojaRuta.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limitNum,
        include: {
          ordenTrabajo: { select: { id: true, estado: true } },
          _count: { select: { tareas: true } },
        },
      }),
      prisma.hojaRuta.count({ where }),
    ]);

    res.json({
      success: true,
      data: hojas,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error listing:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar hojas de ruta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Obtener una hoja de ruta con todas sus tareas
// GET /api/admin/hojas-ruta/:id
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.get('/:id', requireAuth, requireProduccionOrAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hoja = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        ordenTrabajo: true,
        tareas: {
          orderBy: { orden: 'asc' },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } },
        },
      },
    });

    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hoja de ruta no encontrada' } } as ApiResponse);
    }

    res.json({ success: true, data: hoja } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error get by id:', error);
    res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Error al obtener hoja de ruta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Generar hoja de ruta desde una OT (botón explícito)
// POST /api/admin/hojas-ruta
// Body: { ordenTrabajoId }
// Autogenera tareas desde los items del presupuesto (mixto), el admin edita después
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.post('/', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { ordenTrabajoId } = req.body;
    if (!ordenTrabajoId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_OT', message: 'Falta el id de la Orden de Trabajo' } } as ApiResponse);
    }

    // Verificar que la OT exista y traer presupuesto con items
    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id: ordenTrabajoId },
      include: {
        presupuesto: {
          include: { items: { orderBy: { orden: 'asc' } } },
        },
      },
    });

    if (!ot) {
      return res.status(404).json({ success: false, error: { code: 'OT_NOT_FOUND', message: 'Orden de Trabajo no encontrada' } } as ApiResponse);
    }

    // Verificar si ya existe una hoja de ruta para esta OT (relación 1:1)
    const existente = await prisma.hojaRuta.findUnique({
      where: { ordenTrabajoId },
    });
    if (existente) {
      return res.status(409).json({ success: false, error: { code: 'ALREADY_EXISTS', message: 'Esta OT ya tiene una hoja de ruta' } } as ApiResponse);
    }

    // Crear la hoja de ruta
    const hoja = await prisma.hojaRuta.create({
      data: {
        id: crypto.randomUUID(),
        ordenTrabajoId: ot.id,
        clienteId: ot.clienteId,
        clienteNombre: ot.clienteNombre,
        proyecto: ot.proyecto,
        fecha: new Date(),
        estado: 'Borrador',
        notas: ot.detallesTrabajo,
      },
    });

    // Autogenerar tareas desde los items del presupuesto (mixto)
    // El admin puede editar/agregar/quitar después
    if (ot.presupuesto?.items && ot.presupuesto.items.length > 0) {
      const tareas = ot.presupuesto.items.map((item, index) => ({
        id: crypto.randomUUID(),
        hojaRutaId: hoja.id,
        colaboradorId: null, // sin asignar — el admin asigna después
        operarioNombre: 'Sin asignar',
        orden: index,
        descripcion: item.descripcion,
        categoria: (item as any).categoria || 'Otro',
        cantidad: item.cantidad,
        unidad: 'u',
        estado: 'Pendiente',
        fechaAsignada: new Date(),
      }));
      await prisma.hojaRutaTarea.createMany({ data: tareas });
    } else {
      // Si no hay items, crear una tarea vacía para que el admin complete
      await prisma.hojaRutaTarea.create({
        data: {
          id: crypto.randomUUID(),
          hojaRutaId: hoja.id,
          operarioNombre: 'Sin asignar',
          orden: 0,
          descripcion: '',
          estado: 'Pendiente',
          fechaAsignada: new Date(),
        },
      });
    }

    const hojaCompleta = await prisma.hojaRuta.findUnique({
      where: { id: hoja.id },
      include: {
        tareas: {
          orderBy: { orden: 'asc' },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } },
        },
      },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'create_hoja_ruta',
      recurso: `/api/admin/hojas-ruta/${hoja.id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${hoja.id} creada para OT ${ot.id}`,
    });

    res.json({
      success: true,
      data: hojaCompleta,
      message: 'Hoja de ruta generada correctamente',
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error creating:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Error al generar hoja de ruta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Actualizar hoja de ruta (notas, estado) y sus tareas en bloque
// PUT /api/admin/hojas-ruta/:id
// Body: { estado?, notas?, tareas?: [{ id?, descripcion, colaboradorId, ... }] }
// ═════════════════════════════════════════════════════ que se conservan══════
hojasRutaRouter.put('/:id', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado, notas, tareas } = req.body;

    const hoja = await prisma.hojaRuta.findUnique({ where: { id } });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hoja de ruta no encontrada' } } as ApiResponse);
    }

    // Actualizar campos de la hoja
    const updateData: any = {};
    if (estado !== undefined) updateData.estado = estado;
    if (notas !== undefined) updateData.notas = notas;

    if (Object.keys(updateData).length > 0) {
      await prisma.hojaRuta.update({ where: { id }, data: updateData });
    }

    // Actualizar/reemplazar tareas si vienen en el body
    if (Array.isArray(tareas)) {
      // Resolver nombre del operario desde colaboradorId
      const colaboradorIds = tareas
        .map((t: any) => t.colaboradorId)
        .filter((cid: string | null) => cid);
      const colaboradores = await prisma.colaborador.findMany({
        where: { id: { in: colaboradorIds } },
        select: { id: true, nombre: true },
      });
      const colabMap = new Map(colaboradores.map((c) => [c.id, c.nombre]));

      // Borra las tareas existentes y recrea (simple y robusto para edición en bloque)
      await prisma.hojaRutaTarea.deleteMany({ where: { hojaRutaId: id } });
      if (tareas.length > 0) {
        await prisma.hojaRutaTarea.createMany({
          data: tareas.map((t: any, index: number) => ({
            id: crypto.randomUUID(),
            hojaRutaId: id,
            colaboradorId: t.colaboradorId || null,
            operarioNombre: t.colaboradorId ? (colabMap.get(t.colaboradorId) || 'Sin asignar') : (t.operarioNombre || 'Sin asignar'),
            orden: index,
            descripcion: t.descripcion || '',
            categoria: t.categoria || 'Otro',
            cantidad: t.cantidad ?? null,
            unidad: t.unidad || 'u',
            estado: t.estado || 'Pendiente',
            fechaAsignada: t.fechaAsignada ? new Date(t.fechaAsignada) : new Date(),
            notasOperario: t.notasOperario || null,
          })),
        });
      }
    }

    const hojaActualizada = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        ordenTrabajo: true,
        tareas: {
          orderBy: { orden: 'asc' },
          include: { colaborador: { select: { id: true, nombre: true, rol: true } } },
        },
      },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'update_hoja_ruta',
      recurso: `/api/admin/hojas-ruta/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} actualizada`,
    });

    res.json({ success: true, data: hojaActualizada, message: 'Hoja de ruta actualizada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error updating:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Error al actualizar hoja de ruta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Eliminar hoja de ruta
// DELETE /api/admin/hojas-ruta/:id
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.delete('/:id', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hoja = await prisma.hojaRuta.findUnique({ where: { id } });
    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hoja de ruta no encontrada' } } as ApiResponse);
    }

    await prisma.hojaRuta.delete({ where: { id } });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'delete_hoja_ruta',
      recurso: `/api/admin/hojas-ruta/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} eliminada`,
    });

    res.json({ success: true, message: 'Hoja de ruta eliminada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error deleting:', error);
    res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Error al eliminar hoja de ruta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Generar mensaje de WhatsApp por operario (formato real: agrupado por operario)
// POST /api/admin/hojas-ruta/:id/whatsapp
// Body: { operarioId?, telefono? }
//   - Sin operarioId: genera UN mensaje con todas las tareas agrupadas por operario
//   - Con operarioId: genera el mensaje solo de ese operario
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.post('/:id/whatsapp', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operarioId, telefono } = req.body || {};

    const hoja = await prisma.hojaRuta.findUnique({
      where: { id },
      include: {
        tareas: {
          orderBy: { orden: 'asc' },
          include: { colaborador: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!hoja) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hoja de ruta no encontrada' } } as ApiResponse);
    }

    // Filtrar tareas por operario si se especifica
    let tareas = hoja.tareas;
    if (operarioId) {
      tareas = tareas.filter((t) => t.colaboradorId === operarioId);
    }
    if (tareas.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_TASKS', message: 'No hay tareas para generar el mensaje' } } as ApiResponse);
    }

    // Agrupar por operarioNombre (igual que el formato real de WhatsApp)
    const porOperario = new Map<string, typeof tareas>();
    for (const t of tareas) {
      const key = t.operarioNombre || 'Sin asignar';
      if (!porOperario.has(key)) porOperario.set(key, []);
      porOperario.get(key)!.push(t);
    }

    const fmtFecha = (d: Date | null | undefined): string => {
      if (!d) return '—';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };

    // Armar el mensaje con el formato real que usan hoy
    const lineas: string[] = [];
    lineas.push(`*Hoja de Ruta — ${hoja.clienteNombre}*`);
    lineas.push(`Proyecto: ${hoja.proyecto}`);
    lineas.push(`Fecha: ${fmtFecha(hoja.fecha)}`);
    lineas.push('');

    for (const [operario, tareasOperario] of porOperario) {
      lineas.push(`⛔${operario}⛔`);
      for (const t of tareasOperario) {
        let linea = t.descripcion;
        if (t.cantidad) {
          linea += ` (Cant: ${Number(t.cantidad)} ${t.unidad || 'u'})`;
        }
        lineas.push(linea);
      }
      lineas.push('');
    }

    const mensaje = lineas.join('\n').trim();

    // Generar link de WhatsApp
    let whatsappUrl: string;
    if (telefono) {
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, '');
      whatsappUrl = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    } else {
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }

    // Marcar como enviada y pasar a 'Activa' si estaba en 'Borrador'
    await prisma.hojaRuta.update({
      where: { id },
      data: {
        enviadoWhatsapp: true,
        fechaEnvioWsp: new Date(),
        ...(hoja.estado === 'Borrador' ? { estado: 'Activa' } : {}),
      },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'send_hoja_ruta_whatsapp',
      recurso: `/api/admin/hojas-ruta/${id}/whatsapp`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Hoja de ruta ${id} enviada por WhatsApp${operarioId ? ' (operario: ' + operarioId + ')' : ''}`,
    });

    res.json({
      success: true,
      data: { mensaje, whatsappUrl, enviadoWhatsapp: true },
      message: 'Mensaje de WhatsApp generado',
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error generating whatsapp:', error);
    res.status(500).json({ success: false, error: { code: 'WSP_ERROR', message: 'Error al generar mensaje de WhatsApp' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Listar colaboradores disponibles para asignar (dropdown)
// GET /api/admin/hojas-ruta/meta/colaboradores
// ═══════════════════════════════════════════════════════════════
hojasRutaRouter.get('/meta/colaboradores', requireAuth, requireProduccionOrAdmin, async (req: Request, res: Response) => {
  try {
    const colaboradores = await prisma.colaborador.findMany({
      where: {},
      select: { id: true, nombre: true, rol: true, tarifaSugerida: true },
      orderBy: { nombre: 'asc' },
    });
    res.json({ success: true, data: colaboradores } as ApiResponse);
  } catch (error: any) {
    logger.error('[HOJAS_RUTA] Error listing colaboradores:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar colaboradores' } } as ApiResponse);
  }
});
