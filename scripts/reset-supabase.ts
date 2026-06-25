/**
 * Script de reset completo de Supabase
 * Elimina todos los datos en el orden correcto (respetando FK constraints)
 * 
 * Uso: npx tsx scripts/reset-supabase.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetSupabase() {
  console.log('⚠️  RESET COMPLETO DE SUPABASE');
  console.log('================================');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');
  console.log('');

  try {
    console.log('🗑️  Eliminando registros...');
    const r1 = await prisma.registro.deleteMany({});
    console.log(`   ✓ ${r1.count} registros eliminados`);

    console.log('🗑️  Eliminando registros de vehículo...');
    const r2 = await prisma.registroVehiculo.deleteMany({});
    console.log(`   ✓ ${r2.count} registros vehículo eliminados`);

    console.log('🗑️  Eliminando timers activos...');
    const r3 = await prisma.timerActivo.deleteMany({});
    console.log(`   ✓ ${r3.count} timers eliminados`);

    console.log('🗑️  Eliminando viajes activos...');
    const r4 = await prisma.viajeActivo.deleteMany({});
    console.log(`   ✓ ${r4.count} viajes eliminados`);

    console.log('🗑️  Eliminando proyectos...');
    const r5 = await prisma.proyecto.deleteMany({});
    console.log(`   ✓ ${r5.count} proyectos eliminados`);

    console.log('🗑️  Eliminando colaboradores...');
    const r6 = await prisma.colaborador.deleteMany({});
    console.log(`   ✓ ${r6.count} colaboradores eliminados`);

    console.log('🗑️  Eliminando clientes...');
    const r7 = await prisma.cliente.deleteMany({});
    console.log(`   ✓ ${r7.count} clientes eliminados`);

    console.log('');
    console.log('✅ Supabase limpiado completamente.');
    console.log('   Ya podés importar el Excel desde cero.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetSupabase();
