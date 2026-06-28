import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

// Replicate the transactional logic from the endpoint
async function executeBulkImportTransaction(payload: {
  clientes: any[];
  proyectos: any[];
  registros: any[];
}) {
  const { clientes, proyectos, registros } = payload;

  return await prisma.$transaction(async (tx) => {
    // 1. Clientes: verify by name
    const dbClientes = await tx.cliente.findMany({});
    const clientesPorNombre = new Map(dbClientes.map(c => [c.nombre.toLowerCase().trim(), c.id]));
    const clienteIdMap = new Map<string, string>();
    const clienteNombreMap = new Map<string, string>(dbClientes.map(c => [c.id, c.nombre]));
    
    for (const c of clientes) {
      const nombreNorm = c.nombre.toLowerCase().trim();
      if (clientesPorNombre.has(nombreNorm)) {
        clienteIdMap.set(c.id, clientesPorNombre.get(nombreNorm)!);
      } else {
        const created = await tx.cliente.create({
          data: {
            id: generateId('cli'),
            nombre: c.nombre.trim(),
            codigo: c.codigo ? c.codigo.trim() : generateId('cli').substring(0, 8).toUpperCase()
          }
        });
        clienteIdMap.set(c.id, created.id);
        clientesPorNombre.set(nombreNorm, created.id);
        clienteNombreMap.set(created.id, created.nombre);
      }
    }

    // 2. Proyectos: verify by name + clienteId
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
        const created = await tx.proyecto.create({
          data: {
            id: generateId('pro'),
            clienteId: realClienteId,
            nombre: p.nombre.trim(),
            estado: estadoEnum,
            fechaInicio: p.fechaInicio ? new Date(p.fechaInicio) : new Date()
          }
        });
        proyectoIdMap.set(p.id, created.id);
        proyectosPorNombre.set(key, created.id);
        proyectoNombreMap.set(created.id, created.nombre);
      }
    }

    // 3. Insert all new Records
    let guardados = 0;
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
      if (!r.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) { errores++; continue; }
      if (!r.cantidad || r.cantidad <= 0) { errores++; continue; }
      if (!r.precioUnitario || r.precioUnitario <= 0) { errores++; continue; }
      
      const total = r.total > 0 ? r.total : r.cantidad * r.precioUnitario;
      
      // Map concepto to Prisma Concepto enum
      const conceptoRaw = (r.concepto || '').trim().toLowerCase();
      let conceptoValido: 'MO' | 'INSUMO' | 'VEHICULO';
      if (conceptoRaw === 'mo' || conceptoRaw === 'mano de obra') {
        conceptoValido = 'MO';
      } else if (conceptoRaw === 'insumo' || conceptoRaw === 'insumos' || conceptoRaw === 'materiales') {
        conceptoValido = 'INSUMO';
      } else if (conceptoRaw === 'vehiculo' || conceptoRaw === 'vehículo' || conceptoRaw === 'km') {
        conceptoValido = 'VEHICULO';
      } else {
        conceptoValido = 'INSUMO';
      }

      await tx.registro.create({
        data: {
          id: generateId('reg'),
          clienteId: realClienteId,
          clienteNombre: realClienteNombre,
          proyectoId: realProyectoId,
          proyectoNombre: realProyectoNombre,
          fecha: new Date(r.fecha),
          concepto: conceptoValido,
          descripcion: r.descripcion || 'Sin descripción',
          colaboradorId: null,
          hsInicio: r.hsInicio || null,
          hsFin: r.hsFin || null,
          hsTotal: r.hsTotal || null,
          cantidad: new Decimal(r.cantidad),
          precioUnitario: new Decimal(r.precioUnitario),
          total: new Decimal(total),
          origen: 'EXCEL',
          fechaImportacion: new Date()
        }
      });
      guardados++;
    }

    return { guardados, errores };
  });
}

describe('Import Confirm Transactional Logic', () => {
  const testSuffix = Math.random().toString(36).substring(2, 7);
  const testClientName = `Test Client ${testSuffix}`;
  const testProjectName = `Test Project ${testSuffix}`;
  let existingClientId: string;
  let existingProjectId: string;

  beforeAll(async () => {
    // Setup pre-existing records to test mapping and existing entities
    const client = await prisma.cliente.create({
      data: {
        id: generateId('cli'),
        nombre: testClientName,
        codigo: 'TCLI1'
      }
    });
    existingClientId = client.id;

    const project = await prisma.proyecto.create({
      data: {
        id: generateId('pro'),
        clienteId: client.id,
        nombre: testProjectName,
        estado: 'EN_PROCESO',
        fechaInicio: new Date()
      }
    });
    existingProjectId = project.id;
  });

  afterAll(async () => {
    // Clean up our test records
    await prisma.registro.deleteMany({
      where: {
        descripcion: {
          contains: testSuffix
        }
      }
    });
    await prisma.proyecto.deleteMany({
      where: {
        nombre: testProjectName
      }
    });
    await prisma.cliente.deleteMany({
      where: {
        nombre: testClientName
      }
    });
  });

  it('successfully processes import and maps to existing clients/projects', async () => {
    const payload = {
      clientes: [
        { id: 'temp_cli_1', nombre: testClientName, codigo: 'TCLI1' },
        { id: 'temp_cli_2', nombre: `New Client ${testSuffix}`, codigo: 'NCLI1' }
      ],
      proyectos: [
        { id: 'temp_pro_1', clienteId: 'temp_cli_1', nombre: testProjectName, estado: 'En Proceso' },
        { id: 'temp_pro_2', clienteId: 'temp_cli_2', nombre: `New Project ${testSuffix}`, estado: 'En Proceso' }
      ],
      registros: [
        {
          clienteId: 'temp_cli_1',
          proyectoId: 'temp_pro_1',
          fecha: '2026-06-28',
          concepto: 'Mano de Obra',
          cantidad: 8,
          precioUnitario: 100,
          total: 800,
          descripcion: `Test record 1 ${testSuffix}`
        },
        {
          clienteId: 'temp_cli_2',
          proyectoId: 'temp_pro_2',
          fecha: '2026-06-28',
          concepto: 'Insumo',
          cantidad: 2,
          precioUnitario: 50,
          total: 100,
          descripcion: `Test record 2 ${testSuffix}`
        }
      ]
    };

    const result = await executeBulkImportTransaction(payload);
    
    expect(result.guardados).toBe(2);
    expect(result.errores).toBe(0);

    // Verify records are actually created
    const createdRecords = await prisma.registro.findMany({
      where: {
        descripcion: {
          contains: testSuffix
        }
      }
    });
    expect(createdRecords.length).toBe(2);
    
    // Check Concepto mappings
    const moRecord = createdRecords.find(r => r.descripcion.includes('record 1'));
    expect(moRecord?.concepto).toBe('MO');
    expect(moRecord?.clienteId).toBe(existingClientId);
    expect(moRecord?.proyectoId).toBe(existingProjectId);

    const insumoRecord = createdRecords.find(r => r.descripcion.includes('record 2'));
    expect(insumoRecord?.concepto).toBe('INSUMO');
    expect(insumoRecord?.clienteNombre).toBe(`New Client ${testSuffix}`);
  });

  it('skips invalid records but does not crash the transaction', async () => {
    const payload = {
      clientes: [],
      proyectos: [],
      registros: [
        {
          clienteId: existingClientId,
          proyectoId: existingProjectId,
          fecha: '2026-06-28',
          concepto: 'mo',
          cantidad: 5,
          precioUnitario: 100,
          total: 500,
          descripcion: `Valid record ${testSuffix}`
        },
        {
          clienteId: 'non-existent-client-id',
          proyectoId: 'non-existent-project-id',
          fecha: '2026-06-28',
          concepto: 'mo',
          cantidad: 5,
          precioUnitario: 100,
          total: 500,
          descripcion: `Invalid record ${testSuffix}`
        }
      ]
    };

    const result = await executeBulkImportTransaction(payload);
    expect(result.guardados).toBe(1);
    expect(result.errores).toBe(1);
  });

  it('rolls back the transaction completely if a database level error occurs', async () => {
    const payload = {
      clientes: [
        { id: 'temp_cli_err', nombre: `Error Client ${testSuffix}` }
      ],
      proyectos: [],
      registros: []
    };

    // We will inject a database violation inside the transaction or simulate an error
    try {
      await prisma.$transaction(async (tx) => {
        // Create the client
        await tx.cliente.create({
          data: {
            id: generateId('cli'),
            nombre: `Error Client ${testSuffix}`,
            codigo: 'TCLIERR'
          }
        });

        // Deliberately throw an error to simulate constraint violation or crash
        throw new Error('Forced rollback');
      });
    } catch (err: any) {
      expect(err.message).toBe('Forced rollback');
    }

    // Verify that the client was NOT created
    const foundClient = await prisma.cliente.findFirst({
      where: {
        nombre: `Error Client ${testSuffix}`
      }
    });
    expect(foundClient).toBeNull();
  });
});
