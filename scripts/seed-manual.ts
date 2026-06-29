import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function run() {
  console.log('Borrando usuarios huérfanos con strings inválidos...');
  // Borrar usuarios para evitar conflicto con los tipos enum
  await prisma.usuario.deleteMany();

  console.log('Seeding usuarios iniciales con enums correctos...');
  const initialUsers = [
    { username: 'admin', nombre: 'Administrador', dbRol: Rol.ADMIN, password: 'admin123', colaboradorId: null },
    { username: 'rodrigo', nombre: 'Rodrigo', dbRol: Rol.OPERADOR, password: 'rodrigo123', colaboradorId: 'col_kdsnf4jzk' },
    { username: 'ricardo', nombre: 'Ricardo', dbRol: Rol.OPERADOR, password: 'ricardo123', colaboradorId: 'col_mdtahyyln' },
    { username: 'eduardo', nombre: 'Eduardo', dbRol: Rol.OPERADOR, password: 'eduardo123', colaboradorId: 'col_y7j6hif9t' },
  ];

  for (const u of initialUsers) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);
    await prisma.usuario.create({
      data: {
        username: u.username,
        nombre: u.nombre,
        rol: u.dbRol,
        passwordHash,
        colaboradorId: u.colaboradorId,
        activo: true,
      }
    });
    console.log(`Usuario creado correctamente: ${u.username} con enum ${u.dbRol}`);
  }
  console.log('Reparación de la DB finalizada.');
}

run()
  .catch(err => console.error('Error durante la reparación:', err))
  .finally(() => prisma.$disconnect());
