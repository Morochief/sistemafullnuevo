/**
 * Presupuestos Routes — Módulo de cotizaciones de aFull al cliente
 *
 * Patrón: Express Router independiente, montado en server.ts.
 * Todos los endpoints son Admin-only (requireAuth + requireAdmin).
 *
 * Flujo del módulo:
 *   1. El cliente crea un Pedido enriquecido desde el portal
 *   2. aFull genera un Presupuesto (Borrador) con items y markup
 *   3. aFull envía el presupuesto al cliente (estado: Enviado)
 *   4. El cliente lo aprueba o rechaza desde el portal
 *   5. Al aprobarlo, se convierte en Registro operativo
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth, requireAdmin, requireWriteAccess, requireProduccionOrAdmin } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse } from '../../types.ts';
import fs from 'fs';
import path from 'path';
import { LOGO_AFULL_DATA_URI } from '../logoAfull.ts';

export const presupuestosRouter = Router();

// ─── Helper: subir fotos de presupuesto (base64 → Supabase o local) ───────────
async function guardarFotosPresupuesto(presupuestoId: string, fotosBase64: string[]): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const isDataUrl = (s: string) => s && s.startsWith('data:');
  if (!fotosBase64 || fotosBase64.length === 0) return [];
  const resultados: string[] = [];
  for (let i = 0; i < fotosBase64.length; i++) {
    const dataUrl = fotosBase64[i];
    if (!isDataUrl(dataUrl)) { resultados.push(dataUrl); continue; }
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const raw = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(raw, 'base64');
      const storagePath = `presupuestos/${presupuestoId}/foto_${i}.jpg`;
      const { error } = await supabaseAdmin.storage.from('vehiculos-fotos').upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
      const { data } = supabaseAdmin.storage.from('vehiculos-fotos').getPublicUrl(storagePath);
      resultados.push(data.publicUrl);
    } else {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'presupuestos', presupuestoId);
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const raw = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      await fs.promises.writeFile(path.join(uploadsDir, `foto_${i}.jpg`), raw, 'base64');
      resultados.push(`/uploads/presupuestos/${presupuestoId}/foto_${i}.jpg`);
    }
  }
  return resultados;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos
// Listar presupuestos con filtros opcionales
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { estado, clienteId, search } = req.query as { estado?: string; clienteId?: string; search?: string };

    const where: any = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [
          { clienteNombre: { contains: q, mode: 'insensitive' } },
          { proyecto: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const presupuestos = await prisma.presupuesto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { orderBy: { orden: 'asc' } },
        pedido: { select: { id: true, descripcion: true, sucursalNombre: true } },
      },
    });

    res.json({ success: true, data: presupuestos } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error listing:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar presupuestos' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos/ordenes-trabajo
// Listar todas las Ordenes de Trabajo con filtros opcionales
// DEBE ir antes de GET /:id para que Express no capture "ordenes-trabajo" como id
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/ordenes-trabajo', requireAuth, requireProduccionOrAdmin, async (req: Request, res: Response) => {
  try {
    const { estado, clienteId, search } = req.query as { estado?: string; clienteId?: string; search?: string };

    const where: any = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (search) {
      where.OR = [
        { clienteNombre: { contains: search, mode: 'insensitive' } },
        { proyecto: { contains: search, mode: 'insensitive' } },
      ];
    }

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: ordenes } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error listing OTs:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al listar Ordenes de Trabajo' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos/ordenes-trabajo/manual
// Crear una OT de forma manual directamente
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/ordenes-trabajo/manual', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { clienteId, proyecto, contacto, fechaInicio, fechaTope, detallesTrabajo, comentarioCliente, telefono } = req.body || {};
    if (!clienteId || !proyecto || !detallesTrabajo) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cliente, Proyecto y Detalles del trabajo son obligatorios' } } as ApiResponse);
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cliente no encontrado' } } as ApiResponse);
    }

    const fmtFecha = (d: string | null | undefined): string => {
      if (!d) return '—';
      try {
        const dateObj = new Date(d);
        const dia = String(dateObj.getDate()).padStart(2, '0');
        const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
        const anio = String(dateObj.getFullYear()).slice(-2);
        return `${dia}/${mes}/${anio}`;
      } catch {
        return d;
      }
    };

    const lineas: string[] = [
      `Cliente: ${cliente.nombre}`,
      `Contacto: ${contacto || '—'}`,
      `Proyecto: ${proyecto}`,
      `Fecha de inicio: ${fmtFecha(fechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(fechaTope)}`,
      '',
      'Detalles del trabajo',
      detallesTrabajo,
    ];
    if (comentarioCliente) {
      lineas.push('', 'Comentarios de Cliente', comentarioCliente);
    }
    const mensaje = lineas.join('\n');

    let whatsappUrl = '';
    if (telefono) {
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, '');
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
          sucursalId: 'manual',
          sucursalNombre: 'Casa Central',
          descripcion: `OT Manual: ${proyecto}`,
          cantidad: 1,
          tipo: 'Trabajo Directo',
          estado: 'Aprobado',
          contacto: contacto || null,
          proyecto,
          comentarioCliente: comentarioCliente || null,
        },
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
          estado: 'Aprobado',
          total: 0,
          markup: 0,
          comentarioCliente: comentarioCliente || null,
        },
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
          estado: 'Generada',
          mensajeWhatsapp: mensaje,
        }
      });
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'create_manual_ot',
      recurso: `/api/admin/presupuestos/ordenes-trabajo/${ot.id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `OT manual ${ot.id} creada para cliente ${cliente.nombre}`,
    });

    res.json({ success: true, data: { ...ot, whatsappUrl }, message: 'Orden de Trabajo creada exitosamente' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error creating manual OT:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Error al crear Orden de Trabajo: ' + error.message } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos/ordenes-trabajo/:id
// Obtener una OT específica por id
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/ordenes-trabajo/:id', requireAuth, requireProduccionOrAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Orden de Trabajo no encontrada' } } as ApiResponse);
    }
    res.json({ success: true, data: ot } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error getting OT:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al obtener Orden de Trabajo' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos/:id
// Obtener un presupuesto con items y relaciones
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        pedido: true,
        cliente: { select: { id: true, nombre: true } },
      },
    });

    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    res.json({ success: true, data: presupuesto } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error fetching:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Error al obtener presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos
// Crear un nuevo presupuesto (estado Borrador) con items
// Body: { pedidoId, clienteId, proyecto, contacto?, fechaInicio?, fechaTope?, markup?, comentarioCliente?, items: [{ descripcion, cantidad, precioUnitario }] }
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
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
      items,
    } = req.body;

    // Validar campos obligatorios
    if (!pedidoId || !clienteId || !proyecto || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'pedidoId, clienteId, proyecto e items son obligatorios' },
      } as ApiResponse);
    }

    // Verificar que el pedido existe
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } } as ApiResponse);
    }

    // Verificar que el cliente existe y obtener su nombre
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cliente no encontrado' } } as ApiResponse);
    }

    // Procesar items: cantidad, precioUnitario y total.
    // Para items de ManoDeObra, el total se calcula como horas × tarifa.
    const computedItems = items.map((item: any, index: number) => {
      const categoria = item.categoria || 'Insumo';
      let cantidad = Number(item.cantidad);
      let precioUnitario = Number(item.precioUnitario);

      // Si es ManoDeObra y tiene horas+tarifa, calcular a partir de esos campos
      if (categoria === 'ManoDeObra' && item.horas != null && item.tarifa != null) {
        cantidad = Number(item.horas);
        precioUnitario = Number(item.tarifa);
      }

      const total = cantidad * precioUnitario;
      return {
        descripcion: item.descripcion,
        cantidad,
        precioUnitario,
        total,
        orden: index,
        categoria,
        horas: categoria === 'ManoDeObra' && item.horas != null ? Number(item.horas) : null,
        tarifa: categoria === 'ManoDeObra' && item.tarifa != null ? Number(item.tarifa) : null,
      };
    });

    // costoTotal = suma de todos los items (insumos + MO + entrega + adquisicion)
    const costoTotal = computedItems.reduce((sum: number, item: any) => sum + item.total, 0);
    const finalMarkup = markup !== undefined ? Number(markup) : 0.35;

    // venta1 = costoTotal × (1 + markup/100) si markup > 0
    // venta2 = precio final redondeado (lo define el usuario)
    const venta1 = finalMarkup > 0 ? costoTotal * (1 + finalMarkup / 100) : costoTotal;
    // total (legacy) = venta1 para compatibilidad con codigo existente
    const total = venta1;

    // Crear presupuesto con items en una transaccion
    // Generar ID antes del create para poder subir fotos con ese ID
    const presupuestoId = crypto.randomUUID();

    // Subir fotos si vienen (base64 → storage)
    let fotosGuardadas: string[] = [];
    if (fotos && Array.isArray(fotos) && fotos.length > 0) {
      try {
        fotosGuardadas = await guardarFotosPresupuesto(presupuestoId, fotos);
      } catch (err: any) {
        logger.error('[PRESUPUESTOS] Error uploading photos:', err);
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
        estado: 'Borrador',
        total,
        markup: finalMarkup,
        costoTotal,
        venta1,
        venta2: null,
        comentarioCliente: comentarioCliente || null,
        fotos: fotosGuardadas,
        items: {
          create: computedItems.map((item: any) => ({
            id: crypto.randomUUID(),
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            total: item.total,
            orden: item.orden,
            categoria: item.categoria,
            horas: item.horas,
            tarifa: item.tarifa,
          })),
        },
      },
      include: { items: true },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'create_presupuesto',
      recurso: `/api/admin/presupuestos/${presupuesto.id}`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.status(201).json({ success: true, data: presupuesto, message: 'Presupuesto creado' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error creating:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Error al crear presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/admin/presupuestos/:id
// Actualizar un presupuesto en estado Borrador (items, datos)
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.put('/:id', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    // Permitir editar en cualquier estado, pero si ya fue convertido a registro, no tocar
    if (existing.registroId) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_CONVERTED', message: 'No se puede editar un presupuesto ya convertido a registro' } } as ApiResponse);
    }

    const { proyecto, contacto, fechaInicio, fechaTope, markup, comentarioCliente, fotos, items, venta2 } = req.body;

    // Si vienen items nuevos, recalcular y reemplazar
    let total = Number(existing.total);
    let costoTotal = existing.costoTotal != null ? Number(existing.costoTotal) : null;
    let venta1 = existing.venta1 != null ? Number(existing.venta1) : null;
    if (items && Array.isArray(items) && items.length > 0) {
      // Eliminar items existentes y crear nuevos
      await prisma.presupuestoItem.deleteMany({ where: { presupuestoId: id } });

      const computedItems = items.map((item: any, index: number) => {
        const categoria = item.categoria || 'Insumo';
        let cantidad = Number(item.cantidad);
        let precioUnitario = Number(item.precioUnitario);

        // Si es ManoDeObra y tiene horas+tarifa, calcular a partir de esos campos
        if (categoria === 'ManoDeObra' && item.horas != null && item.tarifa != null) {
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
          horas: categoria === 'ManoDeObra' && item.horas != null ? Number(item.horas) : null,
          tarifa: categoria === 'ManoDeObra' && item.tarifa != null ? Number(item.tarifa) : null,
        };
      });

      costoTotal = computedItems.reduce((sum: number, item: any) => sum + item.total, 0);
      const mk = markup !== undefined ? Number(markup) : Number(existing.markup);
      venta1 = mk > 0 ? Number(costoTotal) * (1 + mk / 100) : Number(costoTotal);
      total = Number(venta1);

      await prisma.presupuestoItem.createMany({ data: computedItems });
    }

    // Subir fotos nuevas si vienen (base64 → storage)
    let fotosParaGuardar: string[] | undefined;
    if (fotos !== undefined) {
      if (Array.isArray(fotos) && fotos.length > 0) {
        // Mezclar fotos existentes (URLs) con nuevas (base64)
        const fotosExistentes = (existing.fotos as string[]) || [];
        const nuevasBase64 = fotos.filter((f: string) => f.startsWith('data:'));
        const urlsExistentes = fotos.filter((f: string) => !f.startsWith('data:'));
        let subidas: string[] = [];
        if (nuevasBase64.length > 0) {
          try {
            subidas = await guardarFotosPresupuesto(id, nuevasBase64);
          } catch (err: any) {
            logger.error('[PRESUPUESTOS] Error uploading photos on edit:', err);
          }
        }
        fotosParaGuardar = [...urlsExistentes, ...subidas];
      } else if (Array.isArray(fotos) && fotos.length === 0) {
        // Array vacío = borrar todas
        fotosParaGuardar = [];
      }
    }

    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        proyecto: proyecto || undefined,
        contacto: contacto !== undefined ? contacto : undefined,
        fechaInicio: fechaInicio !== undefined ? (fechaInicio ? new Date(fechaInicio) : null) : undefined,
        fechaTope: fechaTope !== undefined ? (fechaTope ? new Date(fechaTope) : null) : undefined,
        markup: markup !== undefined ? Number(markup) : undefined,
        comentarioCliente: comentarioCliente !== undefined ? comentarioCliente : undefined,
        total,
        costoTotal: costoTotal != null ? costoTotal : undefined,
        venta1: venta1 != null ? venta1 : undefined,
        venta2: venta2 !== undefined ? (venta2 ? Number(venta2) : null) : undefined,
        fotos: fotosParaGuardar,
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'update_presupuesto',
      recurso: `/api/admin/presupuestos/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({ success: true, data: updated, message: 'Presupuesto actualizado' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error updating:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Error al actualizar presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos/:id/enviar
// Enviar presupuesto al cliente (cambia estado Borrador → Enviado)
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/:id/enviar', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    if (existing.estado !== 'Borrador' && existing.estado !== 'Rechazado') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Solo se pueden enviar presupuestos en estado Borrador o Rechazado' } } as ApiResponse);
    }

    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        estado: 'Enviado',
        fechaEnvio: new Date(),
        respuestaCliente: null,
        fechaRespuesta: null,
      },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'send_presupuesto',
      recurso: `/api/admin/presupuestos/${id}/enviar`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({ success: true, data: updated, message: 'Presupuesto enviado al cliente' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error sending:', error);
    res.status(500).json({ success: false, error: { code: 'SEND_ERROR', message: 'Error al enviar presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos/:id/responder
// Registrar la respuesta del cliente (Aprobado/Rechazado + comentario)
// Body: { respuesta: 'Aprobado' | 'Rechazado', comentario?: string }
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/:id/responder', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { respuesta, comentario } = req.body;

    if (!respuesta || !['Aprobado', 'Rechazado'].includes(respuesta)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: "respuesta debe ser 'Aprobado' o 'Rechazado'" } } as ApiResponse);
    }

    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    if (existing.estado !== 'Enviado') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Solo se puede responder a presupuestos en estado Enviado' } } as ApiResponse);
    }

    const updated = await prisma.presupuesto.update({
      where: { id },
      data: {
        estado: respuesta,
        respuestaCliente: comentario || null,
        fechaRespuesta: new Date(),
      },
    });

    // Si el cliente aprobó el presupuesto, mover el pedido a "En Proceso"
    if (respuesta === 'Aprobado' && existing.pedidoId) {
      await prisma.pedido.updateMany({
        where: { id: existing.pedidoId, estado: 'Pendiente' },
        data: { estado: 'En Proceso' },
      });
    }

    auditLog({
      usuario: req.user!.usuario,
      accion: 'respond_presupuesto',
      recurso: `/api/admin/presupuestos/${id}/responder`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({ success: true, data: updated, message: `Presupuesto ${respuesta.toLowerCase()}` } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error responding:', error);
    res.status(500).json({ success: false, error: { code: 'RESPOND_ERROR', message: 'Error al registrar respuesta' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos/:id/convertir
// Convertir un presupuesto Aprobado en un Registro operativo
// Crea un Registro en la tabla registros y lo vincula al presupuesto
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/:id/convertir', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: { items: true, cliente: true, pedido: true },
    });

    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    if (presupuesto.estado !== 'Aprobado') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Solo se pueden convertir presupuestos Aprobados' } } as ApiResponse);
    }

    if (presupuesto.registroId) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_CONVERTED', message: 'Este presupuesto ya fue convertido a registro' } } as ApiResponse);
    }

    // Buscar o crear un proyecto para el cliente basado en el campo "proyecto" del presupuesto
    let proyecto = await prisma.proyecto.findFirst({
      where: { clienteId: presupuesto.clienteId, nombre: presupuesto.proyecto },
    });

    if (!proyecto) {
      proyecto = await prisma.proyecto.create({
        data: {
          id: crypto.randomUUID(),
          clienteId: presupuesto.clienteId,
          nombre: presupuesto.proyecto,
          estado: 'PENDIENTE',
          fechaInicio: presupuesto.fechaInicio || new Date(),
        },
      });
    }

    // NO importar items del presupuesto como registros.
    // El presupuesto queda como referencia; los operarios cargan su mano de obra real
    // manualmente desde el Registro Operativo (timer, uno por uno).
    const updated = await prisma.presupuesto.update({
      where: { id },
      data: { estado: 'En Proceso' },
    });

    // Mover el pedido a "En Proceso"
    if (presupuesto.pedidoId) {
      await prisma.pedido.updateMany({
        where: { id: presupuesto.pedidoId },
        data: { estado: 'En Proceso' },
      });
    }

    auditLog({
      usuario: req.user!.usuario,
      accion: 'convert_presupuesto',
      recurso: `/api/admin/presupuestos/${id}/convertir`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      data: { presupuesto: updated },
      message: `Presupuesto "${presupuesto.proyecto}" pasado a En Proceso. Los operarios cargan mano de obra desde Registro Operativo.`,
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error converting:', error);
    res.status(500).json({ success: false, error: { code: 'CONVERT_ERROR', message: 'Error al convertir presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos/by-pedido/:pedidoId
// Obtener presupuestos asociados a un pedido específico
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/by-pedido/:pedidoId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { pedidoId } = req.params;
  try {
    const presupuestos = await prisma.presupuesto.findMany({
      where: { pedidoId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    res.json({ success: true, data: presupuestos } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error fetching by pedido:', error);
    res
      .status(500)
      .json({ success: false, error: { code: 'FETCH_ERROR', message: 'Error al obtener presupuestos del pedido' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/presupuestos/:id/pdf
// Generar vista HTML formal imprimible en PDF para el cliente
// Con formato fiel a la muestra: Logo aFULL, Título, Datos,
// Detalles con viñetas, Total I.V.A. incluido, Bocetos y Footer comercial
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.get('/:id/pdf', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        pedido: true,
        cliente: true,
      },
    });

    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    // Formatear fecha en texto formal en español (ej: "17 de agosto de 2026")
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fechaObj = presupuesto.createdAt ? new Date(presupuesto.createdAt) : new Date();
    const fechaFormal = `${fechaObj.getDate()} de ${meses[fechaObj.getMonth()]} de ${fechaObj.getFullYear()}`;

    // Total a mostrar al cliente: venta2 si existe, de lo contrario total (venta1)
    const montoTotal = Number(presupuesto.venta2 ?? presupuesto.total);
    const montoFormateado = 'Gs. ' + Math.round(montoTotal).toLocaleString('es-PY');

    // Detalles con viñetas (guiones)
    let detallesHtml = '';
    if (presupuesto.items && presupuesto.items.length > 0) {
      detallesHtml = presupuesto.items.map((it) => {
        const cantStr = Number(it.cantidad) > 1 ? ` (${Number(it.cantidad)})` : '';
        return `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">${it.descripcion}${cantStr}</div></div>`;
      }).join('');
    } else if (presupuesto.pedido?.descripcion) {
      detallesHtml = `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">${presupuesto.pedido.descripcion}</div></div>`;
    } else {
      detallesHtml = `<div class="detalle-item"><span class="bullet">-</span> <div class="detalle-texto">Trabajos generales de publicidad e impresión según especificaciones.</div></div>`;
    }

    // Bocetos / fotos
    const fotos = (presupuesto.fotos as string[]) || [];
    let bocetosHtml = '';
    if (fotos.length > 0) {
      bocetosHtml = `
        <div class="seccion-bocetos">
          <h3 class="subtitulo">Bocetos</h3>
          <div class="bocetos-grid">
            ${fotos.map((f, i) => `<div class="boceto-card"><img src="${f}" alt="Boceto ${i + 1}" /></div>`).join('')}
          </div>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto — ${presupuesto.clienteNombre} — ${presupuesto.proyecto}</title>
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
    <div class="fila-dato"><strong>Contacto:</strong> ${presupuesto.contacto || 'Responsable designado'}</div>
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

    res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error generating PDF:', error);
    res.status(500).json({ success: false, error: { code: 'PDF_ERROR', message: 'Error al generar documento PDF' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/admin/presupuestos/:id
// Eliminar un presupuesto (solo si está en estado Borrador)
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.delete('/:id', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.presupuesto.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    if (existing.estado !== 'Borrador') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Solo se pueden eliminar presupuestos en estado Borrador' } } as ApiResponse);
    }

    // Items se eliminan automáticamente por onDelete: Cascade
    await prisma.presupuesto.delete({ where: { id } });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'delete_presupuesto',
      recurso: `/api/admin/presupuestos/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({ success: true, message: 'Presupuesto eliminado' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error deleting:', error);
    res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Error al eliminar presupuesto' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/presupuestos/:id/orden-trabajo
// Generar una Orden de Trabajo (OT) a partir de un presupuesto aprobado
// Devuelve el texto formateado + link de WhatsApp (wa.me)
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/:id/orden-trabajo', requireAuth, requireAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: { items: true, pedido: true, cliente: true },
    });

    if (!presupuesto) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } } as ApiResponse);
    }

    if (presupuesto.estado !== 'Aprobado') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Solo se pueden generar OT de presupuestos Aprobados' } } as ApiResponse);
    }

    // Armar el texto de la OT
    const fmtFecha = (d: Date | null | undefined): string => {
      if (!d) return '—';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };

    // Detalles del trabajo: descripción del pedido + items del presupuesto
    // El admin puede sobreescribir los detalles y comentarios desde el body
    const detallesParts: string[] = [];
    if (presupuesto.pedido?.descripcion) {
      detallesParts.push(presupuesto.pedido.descripcion);
    }
    if (presupuesto.items.length > 0) {
      detallesParts.push('');
      for (const item of presupuesto.items) {
        detallesParts.push(`• ${item.descripcion} (Cant: ${Number(item.cantidad)})`);
      }
    }
    const detallesTrabajoDefault = detallesParts.join('\n') || 'Sin detalles especificados';
    const comentarioClienteDefault = presupuesto.comentarioCliente || presupuesto.pedido?.comentarioCliente || null;

    // Permitir que el admin envíe detalles y comentarios personalizados
    const detallesTrabajo = (req.body?.detallesTrabajo?.trim?.() || '') || detallesTrabajoDefault;
    const comentarioCliente = req.body?.comentarioCliente?.trim?.() ? req.body.comentarioCliente.trim() : comentarioClienteDefault;

    // Armar el mensaje con el formato solicitado
    const lineas: string[] = [
      `Cliente: ${presupuesto.clienteNombre}`,
      `Contacto: ${presupuesto.contacto || '—'}`,
      `Proyecto: ${presupuesto.proyecto}`,
      `Fecha de inicio: ${fmtFecha(presupuesto.fechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(presupuesto.fechaTope)}`,
      '',
      'Detalles del trabajo',
      detallesTrabajo,
    ];

    if (comentarioCliente) {
      lineas.push('', 'Comentarios de Cliente', comentarioCliente);
    }

    const mensaje = lineas.join('\n');

    // Buscar si ya existe una OT para este presupuesto
    let ot = await prisma.ordenTrabajo.findUnique({
      where: { presupuestoId: id },
    });

    if (ot) {
      // Actualizar el mensaje y los campos editables
      ot = await prisma.ordenTrabajo.update({
        where: { id: ot.id },
        data: {
          detallesTrabajo,
          comentarioCliente,
          mensajeWhatsapp: mensaje,
        },
      });
    } else {
      // Crear nueva OT
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
          estado: 'Generada',
          mensajeWhatsapp: mensaje,
        },
      });
    }

    // Generar el link de WhatsApp (wa.me)
    // El número es opcional — si no hay número, se usa wa.me/?text= que abre WhatsApp Web
    const { telefono } = req.body || {};
    let whatsappUrl: string;
    if (telefono) {
      // Limpiar el número: solo dígitos, sin +, espacios ni guiones
      const numeroLimpio = String(telefono).replace(/[^0-9]/g, '');
      whatsappUrl = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    } else {
      // Sin número: wa.me sin número abre WhatsApp Web con el mensaje listo
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }

    auditLog({
      usuario: req.user!.usuario,
      accion: 'generate_ot',
      recurso: `/api/admin/presupuestos/${id}/orden-trabajo`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `OT ${ot.id} generada para presupuesto ${id}`,
    });

    res.json({
      success: true,
      data: {
        otId: ot.id,
        mensaje,
        whatsappUrl,
        estado: ot.estado,
        enviadoWhatsapp: ot.enviadoWhatsapp,
      },
      message: 'Orden de Trabajo generada correctamente',
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error generating OT:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al generar Orden de Trabajo' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/admin/ordenes-trabajo/:id
// Editar una OT existente (detalles, comentarios, contacto, fechas, estado)
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.put('/ordenes-trabajo/:id', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Orden de Trabajo no encontrada' } } as ApiResponse);
    }

    // Campos editables
    const { detallesTrabajo, comentarioCliente, contacto, fechaInicio, fechaTope, estado } = req.body || {};
    const data: any = {};
    if (detallesTrabajo !== undefined) data.detallesTrabajo = detallesTrabajo;
    if (comentarioCliente !== undefined) data.comentarioCliente = comentarioCliente?.trim() || null;
    if (contacto !== undefined) data.contacto = contacto?.trim() || null;
    if (fechaInicio !== undefined) {
      data.fechaInicio = fechaInicio ? new Date(fechaInicio) : null;
    }
    if (fechaTope !== undefined) {
      data.fechaTope = fechaTope ? new Date(fechaTope) : null;
    }
    if (estado !== undefined) data.estado = estado;

    // Recalcular el mensaje de WhatsApp si se cambiaron detalles o comentarios
    const fmtFecha = (d: Date | null | undefined): string => {
      if (!d) return '—';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = String(d.getFullYear()).slice(-2);
      return `${dia}/${mes}/${anio}`;
    };

    const nuevosDetalles = data.detallesTrabajo !== undefined ? data.detallesTrabajo : existing.detallesTrabajo;
    const nuevoComentario = data.comentarioCliente !== undefined ? data.comentarioCliente : existing.comentarioCliente;
    const nuevoContacto = data.contacto !== undefined ? data.contacto : existing.contacto;
    const nuevaFechaInicio = data.fechaInicio !== undefined ? data.fechaInicio : existing.fechaInicio;
    const nuevaFechaTope = data.fechaTope !== undefined ? data.fechaTope : existing.fechaTope;

    const lineas: string[] = [
      `Cliente: ${existing.clienteNombre}`,
      `Contacto: ${nuevoContacto || '—'}`,
      `Proyecto: ${existing.proyecto}`,
      `Fecha de inicio: ${fmtFecha(nuevaFechaInicio)}`,
      `Fecha para culminar: ${fmtFecha(nuevaFechaTope)}`,
      '',
      'Detalles del trabajo',
      nuevosDetalles,
    ];
    if (nuevoComentario) {
      lineas.push('', 'Comentarios de Cliente', nuevoComentario);
    }
    data.mensajeWhatsapp = lineas.join('\n');

    const updated = await prisma.ordenTrabajo.update({
      where: { id },
      data,
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'edit_ot',
      recurso: `/api/admin/ordenes-trabajo/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `OT ${id} editada`,
    });

    res.json({ success: true, data: updated, message: 'Orden de Trabajo actualizada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error editing OT:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al editar Orden de Trabajo' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/admin/ordenes-trabajo/:id
// Eliminar una OT existente
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.delete('/ordenes-trabajo/:id', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Orden de Trabajo no encontrada' } } as ApiResponse);
    }

    await prisma.ordenTrabajo.delete({ where: { id } });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'delete_ot',
      recurso: `/api/admin/ordenes-trabajo/${id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `OT ${id} eliminada`,
    });

    res.json({ success: true, message: 'Orden de Trabajo eliminada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error deleting OT:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al eliminar Orden de Trabajo' } } as ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/ordenes-trabajo/:id/marcar-enviado
// Marcar una OT como enviada por WhatsApp
// ═══════════════════════════════════════════════════════════════
presupuestosRouter.post('/ordenes-trabajo/:id/marcar-enviado', requireAuth, requireProduccionOrAdmin, requireWriteAccess, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Orden de Trabajo no encontrada' } } as ApiResponse);
    }

    const updated = await prisma.ordenTrabajo.update({
      where: { id },
      data: { enviadoWhatsapp: true, fechaEnvioWsp: new Date(), estado: 'Enviada' },
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'mark_ot_sent',
      recurso: `/api/admin/ordenes-trabajo/${id}/marcar-enviado`,
      resultado: 'success',
      ip: getClientIp(req),
    });

    res.json({ success: true, data: updated, message: 'OT marcada como enviada' } as ApiResponse);
  } catch (error: any) {
    logger.error('[PRESUPUESTOS] Error marking OT sent:', error);
    res.status(500).json({ success: false, error: { code: 'OT_ERROR', message: 'Error al marcar OT como enviada' } } as ApiResponse);
  }
});
