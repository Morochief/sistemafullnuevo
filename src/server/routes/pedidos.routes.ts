/**
 * Pedidos Admin Routes — Gestión de pedidos del portal de clientes — Admin
 * Extraído de server.ts como parte del refactor a Express Routers.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth, requireAdmin, requireDisenoOrProduccionOrAdmin } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse } from '../../types.ts';
import { Decimal } from '@prisma/client/runtime/library';
import { generateId } from '../shared.ts';
import path from 'path';
import fs from 'fs';

export const pedidosRouter = Router();

/**
 * Helper para guardar foto de remisión o entrega en Supabase Storage (o local fallback)
 */
export async function guardarFotoEntregaStorage(pedidoId: string, fotoBase64: string, tipo: 'remision' | 'entrega'): Promise<string> {
  if (!fotoBase64 || !fotoBase64.startsWith('data:')) return fotoBase64;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const raw = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const storagePath = `entregas/${pedidoId}/${tipo}_${Date.now()}.jpg`;
      const { error } = await supabaseAdmin.storage
        .from('vehiculos-fotos')
        .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        logger.warn('[PEDIDOS] Supabase storage upload warning:', error.message);
      } else {
        const { data } = supabaseAdmin.storage.from('vehiculos-fotos').getPublicUrl(storagePath);
        return data.publicUrl;
      }
    } catch (e: any) {
      logger.error('[PEDIDOS] Error uploading to Supabase Storage:', e);
    }
  }

  // Fallback local
  const uploadsDir = path.join(process.cwd(), 'uploads', 'entregas', pedidoId);
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `${tipo}_${Date.now()}.jpg`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/entregas/${pedidoId}/${filename}`;
}

pedidosRouter.get('/', requireAuth, requireDisenoOrProduccionOrAdmin, async (req: Request, res: Response) => {
  try {
    const { estado, clienteId } = req.query as { estado?: string; clienteId?: string };
    const where: any = { archivado: false };
    if (estado) where.estado = String(estado);
    if (clienteId) where.clienteId = String(clienteId);
    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { fechaSolicitud: 'desc' },
      include: {
        cliente: { select: { nombre: true } },
        presupuestos: {
          select: { id: true, estado: true, total: true, proyecto: true },
          orderBy: { createdAt: 'desc' },
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
        comentarioCliente: p.comentarioCliente,
      }))
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[PEDIDOS] Error listing:', error);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Error al listar pedidos' } } as ApiResponse);
  }
});

pedidosRouter.put('/:id', requireAuth, requireDisenoOrProduccionOrAdmin, async (req: Request, res: Response) => {
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
    proyecto,
  } = req.body || {};

  try {
    const existing = await prisma.pedido.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } } as ApiResponse);
    const data: any = {};
    if (sucursalId !== undefined) {
      const sucursal = await prisma.sucursal.findFirst({ where: { id: sucursalId, clienteId: existing.clienteId } });
      if (!sucursal) return res.status(400).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sucursal no válida para este cliente' } } as ApiResponse);
      data.sucursalId = sucursal.id; data.sucursalNombre = sucursal.nombre;
    }
    if (descripcion !== undefined) {
      const d = String(descripcion).trim().slice(0, 1000);
      if (!d) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'La descripción no puede estar vacía' } } as ApiResponse);
      data.descripcion = d;
    }
    if (cantidad !== undefined) {
      const cantNum = Number(cantidad);
      if (isNaN(cantNum) || cantNum <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'La cantidad debe ser mayor a 0' } } as ApiResponse);
      data.cantidad = new Decimal(cantNum);
    }
    if (fechaSolicitud !== undefined) data.fechaSolicitud = fechaSolicitud ? new Date(String(fechaSolicitud)) : new Date();
    if (marca !== undefined) data.marca = marca ? String(marca).slice(0, 50) : null;
    if (tipo !== undefined) data.tipo = String(tipo).slice(0, 50);
    if (prioridad !== undefined) data.prioridad = String(prioridad).slice(0, 20);
    if (estado !== undefined) data.estado = String(estado).slice(0, 30);
    if (fotoUrl !== undefined) data.fotoUrl = fotoUrl ? String(fotoUrl) : null;
    if (fechaFin !== undefined) data.fechaFin = fechaFin ? new Date(String(fechaFin)) : null;
    if (facturaNumero !== undefined) data.facturaNumero = facturaNumero ? String(facturaNumero).slice(0, 30) : null;
    if (contacto !== undefined) data.contacto = contacto ? String(contacto).slice(0, 200) : null;
    if (proyecto !== undefined) data.proyecto = proyecto ? String(proyecto).slice(0, 200) : null;

    // POD fields
    if (fotoRemisionUrl !== undefined) {
      if (fotoRemisionUrl && fotoRemisionUrl.startsWith('data:')) {
        data.fotoRemisionUrl = await guardarFotoEntregaStorage(id, fotoRemisionUrl, 'remision');
      } else {
        data.fotoRemisionUrl = fotoRemisionUrl ? String(fotoRemisionUrl) : null;
      }
    }
    if (fotoEntregaUrl !== undefined) {
      if (fotoEntregaUrl && fotoEntregaUrl.startsWith('data:')) {
        data.fotoEntregaUrl = await guardarFotoEntregaStorage(id, fotoEntregaUrl, 'entrega');
      } else {
        data.fotoEntregaUrl = fotoEntregaUrl ? String(fotoEntregaUrl) : null;
      }
    }
    if (fechaEntrega !== undefined) data.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : null;
    if (receptorNombre !== undefined) data.receptorNombre = receptorNombre ? String(receptorNombre).slice(0, 100) : null;

    const updated = await prisma.pedido.update({ where: { id }, data });
    auditLog({ usuario: req.user!.usuario, accion: 'update_pedido', recurso: `/api/admin/pedidos/${id}`, resultado: 'success', ip: getClientIp(req) });
    
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
        proyecto: updated.proyecto,
      },
      message: 'Pedido actualizado'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[PEDIDOS] Error updating:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Error al actualizar pedido' } } as ApiResponse);
  }
});

// POST /api/admin/pedidos/:id/fotos-entrega — Subir fotos de remisión o entrega
pedidosRouter.post('/:id/fotos-entrega', requireAuth, requireDisenoOrProduccionOrAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tipo, fotoBase64, receptorNombre, fechaEntrega } = req.body || {};

  if (!tipo || (tipo !== 'remision' && tipo !== 'entrega')) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'El tipo debe ser "remision" o "entrega"' } });
  }
  if (!fotoBase64) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_PHOTO', message: 'Se requiere la foto en formato base64' } });
  }

  try {
    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } });

    const photoUrl = await guardarFotoEntregaStorage(id, fotoBase64, tipo);
    const updateData: any = {};
    if (tipo === 'remision') {
      updateData.fotoRemisionUrl = photoUrl;
    } else {
      updateData.fotoEntregaUrl = photoUrl;
    }
    if (receptorNombre) updateData.receptorNombre = String(receptorNombre).slice(0, 100);
    updateData.fechaEntrega = fechaEntrega ? new Date(String(fechaEntrega)) : new Date();

    // Si ya tiene entrega o remisión, marcar como Entregado si estaba en estado previo
    if (pedido.estado !== 'Entregado') {
      updateData.estado = 'Entregado';
      if (!pedido.fechaFin) updateData.fechaFin = new Date();
    }

    const updated = await prisma.pedido.update({
      where: { id },
      data: updateData
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'subir_foto_entrega',
      recurso: `/api/admin/pedidos/${id}/fotos-entrega`,
      resultado: 'success',
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
        receptorNombre: updated.receptorNombre,
      },
      message: `Foto de ${tipo} guardada correctamente`
    });
  } catch (error: any) {
    logger.error('[PEDIDOS] Error uploading delivery photo:', error);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: 'Error al subir foto de entrega' } });
  }
});

// POST /api/admin/pedidos/:id/convertir — Convertir pedido en proyecto y registro operativo
pedidosRouter.post('/:id/convertir', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } } as ApiResponse);
    if (pedido.registroId) return res.status(400).json({ success: false, error: { code: 'ALREADY_CONVERTED', message: 'Este pedido ya fue convertido a registro' } } as ApiResponse);
    const cliente = await prisma.cliente.findUnique({ where: { id: pedido.clienteId } });
    if (!cliente) return res.status(400).json({ success: false, error: { code: 'MISSING_REFERENCES', message: 'Cliente no encontrado' } } as ApiResponse);

    // Priorizar nombre de proyecto definido en el pedido, o usar la descripción
    const nombreProyecto = (pedido.proyecto && pedido.proyecto.trim())
      ? pedido.proyecto.trim().slice(0, 200)
      : pedido.descripcion.slice(0, 200);

    let proyecto = await prisma.proyecto.findFirst({ where: { clienteId: cliente.id, nombre: nombreProyecto, activo: true } });
    if (!proyecto) {
      proyecto = await prisma.proyecto.create({
        data: {
          id: generateId('pro'),
          clienteId: cliente.id,
          nombre: nombreProyecto,
          estado: 'EN_PROCESO',
          fechaInicio: pedido.fechaInicioDeseada || new Date()
        }
      });
    }

    const registroId = generateId('reg');
    await prisma.$transaction(async (tx) => {
      await tx.registro.create({
        data: {
          id: registroId,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          proyectoId: proyecto!.id,
          proyectoNombre: proyecto!.nombre,
          fecha: new Date(),
          concepto: 'INSUMO',
          descripcion: pedido.descripcion,
          cantidad: pedido.cantidad,
          precioUnitario: new Decimal(0),
          total: new Decimal(0),
          origen: 'API',
          fechaImportacion: new Date()
        }
      });
      await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          registroId,
          proyecto: proyecto!.nombre,
          estado: 'Completado'
        }
      });
    });

    auditLog({
      usuario: req.user!.usuario,
      accion: 'convertir_pedido',
      recurso: `/api/admin/pedidos/${id}/convertir`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `Pedido ${id} -> Proyecto ${proyecto!.id} -> Registro ${registroId}`
    });

    res.json({
      success: true,
      data: {
        registroId,
        proyectoId: proyecto!.id,
        proyectoNombre: proyecto!.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
      },
      message: 'Pedido convertido a proyecto y registro correctamente'
    } as ApiResponse);
  } catch (error: any) {
    logger.error('[PEDIDOS] Error converting:', error);
    res.status(500).json({ success: false, error: { code: 'CONVERT_ERROR', message: 'Error al convertir pedido' } } as ApiResponse);
  }
});
