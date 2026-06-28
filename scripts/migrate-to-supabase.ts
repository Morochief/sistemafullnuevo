/**
 * Migration Script: database.json → Supabase PostgreSQL
 * 
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 * 
 * Prerequisites:
 *   1. Prisma schema must be pushed to Supabase: npx prisma db push
 *   2. .env.local must have valid DATABASE_URL and DIRECT_URL
 */

import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JsonData {
  clientes: any[];
  proyectos: any[];
  colaboradores: any[];
  registros: any[];
  registrosVehiculo?: any[];
}

async function migrateData() {
  console.log('🚀 Starting migration: database.json → Supabase PostgreSQL\n');

  try {
    // Read JSON file
    const jsonPath = path.join(__dirname, '../database.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`database.json not found at: ${jsonPath}`);
    }

    const jsonData: JsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log('📂 Loaded database.json');
    console.log(`   - ${jsonData.clientes?.length || 0} clientes`);
    console.log(`   - ${jsonData.proyectos?.length || 0} proyectos`);
    console.log(`   - ${jsonData.colaboradores?.length || 0} colaboradores`);
    console.log(`   - ${jsonData.registros?.length || 0} registros`);
    console.log(`   - ${jsonData.registrosVehiculo?.length || 0} registros vehículo\n`);

    // 1. Migrate Clientes
    if (jsonData.clientes && jsonData.clientes.length > 0) {
      console.log('📦 Migrating clientes...');
      for (const cliente of jsonData.clientes) {
        await prisma.cliente.upsert({
          where: { id: cliente.id },
          update: {
            nombre: cliente.nombre,
            codigo: cliente.codigo,
            fechaCreacion: new Date(cliente.fechaCreacion || cliente.fecha_creacion),
          },
          create: {
            id: cliente.id,
            nombre: cliente.nombre,
            codigo: cliente.codigo,
            fechaCreacion: new Date(cliente.fechaCreacion || cliente.fecha_creacion),
          },
        });
      }
      console.log(`✅ ${jsonData.clientes.length} clientes migrated\n`);
    }

    // 2. Migrate Proyectos
    if (jsonData.proyectos && jsonData.proyectos.length > 0) {
      console.log('📦 Migrating proyectos...');
      for (const proyecto of jsonData.proyectos) {
        // Map estado to enum
        let estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' = 'PENDIENTE';
        if (proyecto.estado === 'En Proceso') estado = 'EN_PROCESO';
        else if (proyecto.estado === 'Completado') estado = 'COMPLETADO';

        await prisma.proyecto.upsert({
          where: { id: proyecto.id },
          update: {
            clienteId: proyecto.clienteId,
            nombre: proyecto.nombre,
            estado,
            fechaInicio: new Date(proyecto.fechaInicio || proyecto.fecha_inicio),
          },
          create: {
            id: proyecto.id,
            clienteId: proyecto.clienteId,
            nombre: proyecto.nombre,
            estado,
            fechaInicio: new Date(proyecto.fechaInicio || proyecto.fecha_inicio),
          },
        });
      }
      console.log(`✅ ${jsonData.proyectos.length} proyectos migrated\n`);
    }

    // 3. Migrate Colaboradores
    if (jsonData.colaboradores && jsonData.colaboradores.length > 0) {
      console.log('📦 Migrating colaboradores...');
      for (const colaborador of jsonData.colaboradores) {
        await prisma.colaborador.upsert({
          where: { id: colaborador.id },
          update: {
            nombre: colaborador.nombre,
            tarifaSugerida: colaborador.tarifaSugerida ? String(colaborador.tarifaSugerida) : null,
            rol: colaborador.rol || null,
          },
          create: {
            id: colaborador.id,
            nombre: colaborador.nombre,
            tarifaSugerida: colaborador.tarifaSugerida ? String(colaborador.tarifaSugerida) : null,
            rol: colaborador.rol || null,
          },
        });
      }
      console.log(`✅ ${jsonData.colaboradores.length} colaboradores migrated\n`);
    }

    // 4. Migrate Registros
    if (jsonData.registros && jsonData.registros.length > 0) {
      console.log('📦 Migrating registros...');
      for (const registro of jsonData.registros) {
        // Skip header/garbage rows or invalid numbers
        const cantidadNum = parseFloat(registro.cantidad);
        const precioNum = parseFloat(registro.precioUnitario);
        if (isNaN(cantidadNum) || isNaN(precioNum) || !registro.clienteId || !registro.proyectoId) {
          continue;
        }

        // Map concepto to enum
        let concepto: 'MO' | 'INSUMO' | 'VEHICULO' = 'MO';
        if (registro.concepto === 'Insumo') concepto = 'INSUMO';
        else if (registro.concepto === 'Vehículo') concepto = 'VEHICULO';

        // Map origen to enum
        let origen: 'MANUAL' | 'EXCEL' | 'API' = 'MANUAL';
        if (registro.origen === 'Excel') origen = 'EXCEL';
        else if (registro.origen === 'API') origen = 'API';

        await prisma.registro.upsert({
          where: { id: registro.id },
          update: {
            clienteId: registro.clienteId,
            clienteNombre: registro.clienteNombre,
            proyectoId: registro.proyectoId,
            proyectoNombre: registro.proyectoNombre,
            fecha: new Date(registro.fecha),
            concepto,
            descripcion: registro.descripcion,
            colaboradorId: registro.colaboradorId || null,
            hsInicio: registro.hsInicio ? registro.hsInicio.substring(0, 5) : null,
            hsFin: registro.hsFin ? registro.hsFin.substring(0, 5) : null,
            hsTotal: registro.hsTotal ? String(registro.hsTotal) : null,
            cantidad: String(registro.cantidad),
            precioUnitario: String(registro.precioUnitario),
            total: String(registro.total),
            origen,
            fechaImportacion: registro.fechaImportacion ? new Date(registro.fechaImportacion) : null,
          },
          create: {
            id: registro.id,
            clienteId: registro.clienteId,
            clienteNombre: registro.clienteNombre,
            proyectoId: registro.proyectoId,
            proyectoNombre: registro.proyectoNombre,
            fecha: new Date(registro.fecha),
            concepto,
            descripcion: registro.descripcion,
            colaboradorId: registro.colaboradorId || null,
            hsInicio: registro.hsInicio ? registro.hsInicio.substring(0, 5) : null,
            hsFin: registro.hsFin ? registro.hsFin.substring(0, 5) : null,
            hsTotal: registro.hsTotal ? String(registro.hsTotal) : null,
            cantidad: String(registro.cantidad),
            precioUnitario: String(registro.precioUnitario),
            total: String(registro.total),
            origen,
            fechaImportacion: registro.fechaImportacion ? new Date(registro.fechaImportacion) : null,
          },
        });
      }
      console.log(`✅ ${jsonData.registros.length} registros migrated\n`);
    }

    // 5. Migrate Registros Vehículo
    if (jsonData.registrosVehiculo && jsonData.registrosVehiculo.length > 0) {
      console.log('📦 Migrating registros vehículo...');
      for (const regVeh of jsonData.registrosVehiculo) {
        // Map origen to enum
        let origen: 'MANUAL' | 'EXCEL' | 'API' = 'MANUAL';
        if (regVeh.origen === 'Excel') origen = 'EXCEL';
        else if (regVeh.origen === 'API') origen = 'API';

        await prisma.registroVehiculo.upsert({
          where: { id: regVeh.id },
          update: {
            clienteId: regVeh.clienteId,
            clienteNombre: regVeh.clienteNombre,
            proyectoId: regVeh.proyectoId,
            proyectoNombre: regVeh.proyectoNombre,
            fecha: new Date(regVeh.fecha),
            kmInicial: String(regVeh.kmInicial),
            kmFinal: String(regVeh.kmFinal),
            distanciaOdometro: String(regVeh.distanciaOdometro),
            combustibleLitros: regVeh.combustibleLitros ? String(regVeh.combustibleLitros) : null,
            combustibleCosto: String(regVeh.combustibleCosto),
            total: String(regVeh.total),
            descripcion: regVeh.descripcion || null,
            alertaDiscrepancia: regVeh.alertaDiscrepancia || false,
            origen,
            fechaImportacion: regVeh.fechaImportacion ? new Date(regVeh.fechaImportacion) : null,
          },
          create: {
            id: regVeh.id,
            clienteId: regVeh.clienteId,
            clienteNombre: regVeh.clienteNombre,
            proyectoId: regVeh.proyectoId,
            proyectoNombre: regVeh.proyectoNombre,
            fecha: new Date(regVeh.fecha),
            kmInicial: String(regVeh.kmInicial),
            kmFinal: String(regVeh.kmFinal),
            distanciaOdometro: String(regVeh.distanciaOdometro),
            combustibleLitros: regVeh.combustibleLitros ? String(regVeh.combustibleLitros) : null,
            combustibleCosto: String(regVeh.combustibleCosto),
            total: String(regVeh.total),
            descripcion: regVeh.descripcion || null,
            alertaDiscrepancia: regVeh.alertaDiscrepancia || false,
            origen,
            fechaImportacion: regVeh.fechaImportacion ? new Date(regVeh.fechaImportacion) : null,
          },
        });
      }
      console.log(`✅ ${jsonData.registrosVehiculo.length} registros vehículo migrated\n`);
    }

    console.log('🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Verify data in Supabase dashboard: https://app.supabase.com');
    console.log('  2. Test your application with the new database');
    console.log('  3. Backup database.json before removing it\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateData();
