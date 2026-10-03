/**
 * Import Routes — Importación Excel + Gemini AI enrichment
 * Extraído de server.ts como parte del refactor a Express Routers.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { requireAuth, requireWriteAccess } from '../../../server-auth.ts';
import { auditLog, getClientIp } from '../../../server-audit.ts';
import { logger } from '../config/logger.ts';
import { ApiResponse } from '../../types.ts';
import { Decimal } from '@prisma/client/runtime/library';
import * as xlsx from 'xlsx';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { generateId, parseExcelDate, formatExcelTime } from '../shared.ts';
import { upload } from '../config/upload.ts';
import { validateSchema, GeminiEnrichSchema } from '../../../server-validation.ts';

export const importRouter = Router();

// Wrap multer to return clear errors for size/type violations
function uploadSingleExcel(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'El archivo excede el tamaño máximo permitido (5MB)' } } as ApiResponse);
        }
        return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: `Error al subir el archivo: ${err.message}` } } as ApiResponse);
      }
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: err.message || 'Archivo inválido' } } as ApiResponse);
    }
    next();
  });
}

function normalizeHeader(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getRowValue(row: any, aliases: string[]): any {
  const normAliases = aliases.map(normalizeHeader);
  for (const [key, val] of Object.entries(row)) {
    const normKey = normalizeHeader(key);
    if (normAliases.some(alias => normKey === alias || normKey.includes(alias) || alias.includes(normKey))) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }
  return '';
}

function normalizeEntityName(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?c\.?i\.?|e\.?i\.?r\.?l\.?|s\.?a\.?s\.?)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// POST /api/import-excel — Parse uploaded Excel file
importRouter.post('/import-excel', requireAuth, requireWriteAccess, uploadSingleExcel, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json<any>(worksheet);
    if (rawRows.length === 0) return res.status(400).json({ error: 'La hoja de cálculo está vacía.' });

    const [dbClientes, dbProyectos, dbColaboradores] = await Promise.all([
      prisma.cliente.findMany(),
      prisma.proyecto.findMany(),
      prisma.colaborador.findMany(),
    ]);

    const tempClientes = dbClientes.map((c: any) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo, fechaCreacion: c.fechaCreacion.toISOString().substring(0, 10) }));
    const tempProyectos = dbProyectos.map((p: any) => ({ id: p.id, clienteId: p.clienteId, nombre: p.nombre, estado: p.estado === 'EN_PROCESO' ? 'En Proceso' : p.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente', fechaInicio: p.fechaInicio.toISOString().substring(0, 10) }));
    const tempColaboradores = dbColaboradores.map((c: any) => ({ id: c.id, nombre: c.nombre, tarifaSugerida: c.tarifaSugerida ? parseFloat(c.tarifaSugerida.toString()) : 0, rol: c.rol || undefined }));
    const initialClientesCount = tempClientes.length;
    const initialProyectosCount = tempProyectos.length;
    const initialColaboradoresCount = tempColaboradores.length;
    const importedItems: any[] = [];

    for (const row of rawRows) {
      const clientName = String(getRowValue(row, ['Cliente', 'Razon Social', 'Razón Social', 'Empresa', 'Cliente/Empresa', 'Nombre Cliente', 'Cuenta'])).trim();
      const projectName = String(getRowValue(row, ['Proyecto', 'Proyectos', 'Obra', 'OT', 'Orden', 'Nombre Proyecto'])).trim();
      const fechaRaw = getRowValue(row, ['Fecha', 'Fec', 'Dia', 'Día', 'Date']);
      const conceptoRaw = String(getRowValue(row, ['Concepto', 'Tipo', 'Rubro', 'Categoria', 'Categoría'])).trim().toUpperCase();
      const concepto = conceptoRaw === 'MO' || conceptoRaw === 'MANO DE OBRA' ? 'MO' : 'Insumo';
      const descripcion = String(getRowValue(row, ['Descripcion', 'Descripción', 'Detalle', 'Tarea', 'Item', 'Observacion', 'Observación'])).trim();
      const hsInicio = getRowValue(row, ['Hs Inicio', 'Hora Inicio', 'Inicio', 'Desde', 'Entrada', 'Hs. Inicio']);
      const hsFin = getRowValue(row, ['Hs Fin', 'Hora Fin', 'Fin', 'Hasta', 'Salida', 'Hs. Fin']);
      const cantidad = parseFloat(getRowValue(row, ['Cantidad', 'Cant', 'Cant.', 'Minutos', 'Horas', 'Hs', 'QTY'])) || 0;
      const precioUnitario = parseFloat(getRowValue(row, ['Precio Unitario', 'Tarifa', 'Precio', 'Costo Unitario', 'P. Unitario', 'Tarifa/Hora', 'Unitario'])) || 0;
      const computedTotal = parseFloat(getRowValue(row, ['Total', 'Importe', 'Monto', 'Subtotal'])) || 0;
      let hsTotal = 0;
      if (concepto === 'MO' && cantidad > 0) hsTotal = parseFloat((cantidad / 60).toFixed(2));

      if (!clientName && !projectName && !descripcion) continue;
      if (clientName.toLowerCase() === 'cliente' || projectName.toLowerCase() === 'proyecto') continue;

      let targetClient = tempClientes.find(c => {
        const nc = normalizeEntityName(c.nombre);
        const ni = normalizeEntityName(clientName);
        if (!nc || !ni) return false;
        return nc === ni || (ni.length >= 4 && (nc.includes(ni) || ni.includes(nc)));
      });

      if (!targetClient && clientName) {
        targetClient = { id: generateId('cli'), nombre: clientName, codigo: clientName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'C'), fechaCreacion: new Date().toISOString().substring(0, 10) };
        tempClientes.push(targetClient);
      }

      let targetProject = null;
      if (targetClient && projectName) {
        targetProject = tempProyectos.find(p => {
          if (p.clienteId !== targetClient!.id) return false;
          const np = normalizeEntityName(p.nombre);
          const nip = normalizeEntityName(projectName);
          return np === nip || (nip.length >= 4 && (np.includes(nip) || nip.includes(np)));
        });

        if (!targetProject) {
          targetProject = { id: generateId('pro'), clienteId: targetClient.id, nombre: projectName, estado: 'En Proceso' as const, fechaInicio: parseExcelDate(fechaRaw) };
          tempProyectos.push(targetProject);
        }
      }

      let targetColaborador = null;
      if (concepto === 'MO' && descripcion) {
        const descWords = descripcion.toLowerCase().split(/\s+/);
        targetColaborador = tempColaboradores.find(col => {
          const names = col.nombre.toLowerCase().split(/\s+/);
          return names.length > 0 && descWords.includes(names[0]);
        });
        if (!targetColaborador) {
          const prospectiveWorkerName = descripcion.split(' ')[0] || 'Colaborador';
          const normalizedName = prospectiveWorkerName.charAt(0).toUpperCase() + prospectiveWorkerName.slice(1).toLowerCase();
          targetColaborador = tempColaboradores.find(c => c.nombre.startsWith(normalizedName));
          if (!targetColaborador) {
            targetColaborador = { id: generateId('col'), nombre: normalizedName + ' ' + (descripcion.split(' ')[1] || ''), tarifaSugerida: precioUnitario || 350, rol: 'Operario Externo' };
            tempColaboradores.push(targetColaborador);
          }
        }
      }

      const finalFecha = parseExcelDate(fechaRaw);
      const calculatedTotal = computedTotal || (cantidad * precioUnitario) || 0;
      importedItems.push({
        sheetRow: row,
        clienteNombre: clientName || (targetClient ? targetClient.nombre : 'Cliente Desconocido'),
        clienteId: targetClient ? targetClient.id : 'temp_cli',
        proyectoNombre: projectName || (targetProject ? targetProject.nombre : 'Proyecto General'),
        proyectoId: targetProject ? targetProject.id : 'temp_pro',
        fecha: finalFecha,
        concepto,
        descripcion,
        colaboradorId: targetColaborador ? targetColaborador.id : undefined,
        colaboradorNombre: targetColaborador ? targetColaborador.nombre : undefined,
        hsInicio: hsInicio ? formatExcelTime(hsInicio) : undefined,
        hsFin: hsFin ? formatExcelTime(hsFin) : undefined,
        hsTotal: hsTotal > 0 ? hsTotal : undefined,
        cantidad: cantidad,
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
  } catch (err: any) {
    logger.error('Error processing Excel file', err);
    res.status(500).json({ error: `Error de procesado de archivo Excel: ${err.message}` });
  }
});

// POST /api/import/confirm — Confirm bulk Excel import in a single transaction
importRouter.post('/import/confirm', requireAuth, requireWriteAccess, async (req: Request, res: Response) => {
  const { clientes, proyectos, registros } = req.body;
  const clientIp = getClientIp(req);
  const userPayload = req.user!;
  if (!Array.isArray(clientes) || !Array.isArray(proyectos) || !Array.isArray(registros)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos de importación inválidos' } } as ApiResponse);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const dbClientes = await tx.cliente.findMany({});
      const clientesPorNombre = new Map(dbClientes.map(c => [c.nombre.toLowerCase().trim(), c.id]));
      const clienteIdMap = new Map<string, string>();
      const clienteNombreMap = new Map<string, string>(dbClientes.map(c => [c.id, c.nombre]));
      for (const c of clientes) {
        const nombreNorm = c.nombre.toLowerCase().trim();
        if (clientesPorNombre.has(nombreNorm)) {
          clienteIdMap.set(c.id, clientesPorNombre.get(nombreNorm)!);
        } else {
          const created = await tx.cliente.create({ data: { id: generateId('cli'), nombre: c.nombre.trim(), codigo: c.codigo ? c.codigo.trim() : generateId('cli').substring(0, 8).toUpperCase() } });
          clienteIdMap.set(c.id, created.id);
          clientesPorNombre.set(nombreNorm, created.id);
          clienteNombreMap.set(created.id, created.nombre);
        }
      }
      const dbProyectos = await tx.proyecto.findMany({});
      const proyectosPorNombre = new Map(dbProyectos.map(p => [`${p.clienteId}::${p.nombre.toLowerCase().trim()}`, p.id]));
      const proyectoIdMap = new Map<string, string>();
      const proyectoNombreMap = new Map<string, string>(dbProyectos.map(p => [p.id, p.nombre]));
      for (const p of proyectos) {
        const realClienteId = clienteIdMap.get(p.clienteId) || p.clienteId;
        const key = `${realClienteId}::${p.nombre.toLowerCase().trim()}`;
        if (proyectosPorNombre.has(key)) {
          proyectoIdMap.set(p.id, proyectosPorNombre.get(key)!);
        } else {
          const estadoEnum = p.estado === 'En Proceso' ? 'EN_PROCESO' as const : p.estado === 'Completado' ? 'COMPLETADO' as const : 'PENDIENTE' as const;
          const created = await tx.proyecto.create({ data: { id: generateId('pro'), clienteId: realClienteId, nombre: p.nombre.trim(), estado: estadoEnum, fechaInicio: p.fechaInicio ? new Date(p.fechaInicio) : new Date() } });
          proyectoIdMap.set(p.id, created.id);
          proyectosPorNombre.set(key, created.id);
          proyectoNombreMap.set(created.id, created.nombre);
        }
      }
      const validRegistrosData: any[] = [];
      let errores = 0;
      for (const r of registros) {
        const realClienteId = clienteIdMap.get(r.clienteId) || r.clienteId;
        const realProyectoId = proyectoIdMap.get(r.proyectoId) || r.proyectoId;
        const realClienteNombre = clienteNombreMap.get(realClienteId);
        const realProyectoNombre = proyectoNombreMap.get(realProyectoId);
        if (!realClienteId || !realProyectoId || !realClienteNombre || !realProyectoNombre) { errores++; continue; }
        
        let parsedFecha: Date;
        if (r.fecha instanceof Date) {
          parsedFecha = r.fecha;
        } else if (typeof r.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.fecha)) {
          parsedFecha = new Date(r.fecha.substring(0, 10));
        } else {
          parsedFecha = new Date();
        }

        const cantidad = Number(r.cantidad) || 0;
        const precioUnitario = Number(r.precioUnitario) || 0;
        if (cantidad <= 0 || precioUnitario <= 0) { errores++; continue; }
        const total = Number(r.total) > 0 ? Number(r.total) : cantidad * precioUnitario;
        const conceptoRaw = (r.concepto || '').trim().toLowerCase();
        let conceptoValido: 'MO' | 'INSUMO' | 'VEHICULO';
        if (conceptoRaw === 'mo' || conceptoRaw === 'mano de obra') conceptoValido = 'MO';
        else if (conceptoRaw === 'insumo' || conceptoRaw === 'insumos' || conceptoRaw === 'materiales') conceptoValido = 'INSUMO';
        else if (conceptoRaw === 'vehiculo' || conceptoRaw === 'vehículo' || conceptoRaw === 'km') conceptoValido = 'VEHICULO';
        else conceptoValido = 'INSUMO';

        validRegistrosData.push({
          id: generateId('reg'),
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
          cantidad: new Decimal(cantidad),
          precioUnitario: new Decimal(precioUnitario),
          total: new Decimal(total),
          origen: 'EXCEL',
          fechaImportacion: new Date()
        });
      }

      let guardados = 0;
      const CHUNK_SIZE = 500;
      for (let i = 0; i < validRegistrosData.length; i += CHUNK_SIZE) {
        const chunk = validRegistrosData.slice(i, i + CHUNK_SIZE);
        const res = await tx.registro.createMany({ data: chunk });
        guardados += res.count;
      }
      return { guardados, errores };
    }, { maxWait: 20000, timeout: 60000 });
    auditLog({ usuario: userPayload.usuario, accion: 'confirm_bulk_import', recurso: '/api/import/confirm', resultado: 'success', ip: clientIp });
    res.json({ success: true, data: result, message: `Importación procesada: ${result.guardados} guardados, ${result.errores} errores.` } as ApiResponse);
  } catch (error: any) {
    logger.error('Error in bulk import transaction:', error);
    auditLog({ usuario: userPayload.usuario, accion: 'confirm_bulk_import', recurso: '/api/import/confirm', resultado: 'failure', ip: clientIp });
    res.status(500).json({ success: false, error: { code: 'IMPORT_ERROR', message: 'Error al procesar la transacción de importación masiva' } } as ApiResponse);
  }
});

// POST /api/gemini-enrich — Smart Gemini AI enrichment
importRouter.post('/gemini-enrich', requireAuth, requireWriteAccess, async (req: Request, res: Response) => {
  const validation = validateSchema(GeminiEnrichSchema, req.body);
  if (!validation.valid) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos para enriquecimiento', details: validation.errors } } as ApiResponse);
  const { entries } = validation.data!;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'DISABLED_NOT_NEEDED' || apiKey.length < 20) {
    return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'El servicio de IA no está configurado. Continuá usando el sistema sin esta función.' } } as ApiResponse);
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Eres el asistente inteligente del Sistema aFull. Recibes un arreglo de descripciones de tareas operativas o compras de insumos registradas de forma informal.\nTu meta es parsear esta lista y devolver un objeto JSON con una clasificación inteligente para cada elemento:\n1. Extraer nombre de persona (si refiere a Mano de Obra / colaborador).\n2. Categoría (MO o Insumo o Herramientas o Logística).\n3. Sugerencia de precio unitario sugerido (si el actual es 0) basado en valores típicos (MO: 350-500 por min, Insumos dependiente del tipo).\n\nLista de entradas:\n${JSON.stringify(entries.map((e: any, index: number) => ({ index, text: e.descripcion, concepto: e.concepto })))}\n\nDevuelve ÚNICAMENTE un arreglo JSON con el siguiente formato:\n[\n  { "index": 0, "colaboradorSugerido": "Rodrigo Gómez", "categoriaSugerida": "MO", "precioSugerido": 350 }\n]`;
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ success: false, error: { code: 'AI_PARSE_ERROR', message: 'La IA no devolvió un JSON válido' } } as ApiResponse);
    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: suggestions } as ApiResponse);
  } catch (error: any) {
    logger.error('Error in Gemini enrichment:', error);
    res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'Error al procesar enriquecimiento con IA' } } as ApiResponse);
  }
});
