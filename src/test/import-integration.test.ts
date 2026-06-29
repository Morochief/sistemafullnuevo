// @vitest-environment node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import { prisma } from '../lib/prisma.ts';
import { generateToken } from '../../server-auth.ts';

describe('Import API Integration (Supertest)', () => {
  let adminCookie: string;
  let csrfToken: string;
  let sessionCookie: string;
  
  const testClientName = 'Cliente Import Test ' + Math.random().toString(36).substring(2, 7);
  const testProjName = 'Proyecto Import Test ' + Math.random().toString(36).substring(2, 7);

  beforeAll(async () => {
    // Generate valid admin JWT token
    const token = generateToken({
      usuario: 'admin',
      nombre: 'Administrador',
      rol: 'Admin'
    });
    adminCookie = `jwt=${token}`;

    // Get CSRF and session
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.data.csrfToken;
    const rawCookies = csrfRes.headers['set-cookie'] || [];
    const sessionCookieMatch = rawCookies.find((c: string) => c.startsWith('sessionId='));
    sessionCookie = sessionCookieMatch ? sessionCookieMatch.split(';')[0] : '';
  });

  afterAll(async () => {
    // Cascade cleanup to respect foreign key constraints
    const client = await prisma.cliente.findFirst({ where: { nombre: testClientName } });
    if (client) {
      // 1. Delete associated registrations
      await prisma.registro.deleteMany({ where: { clienteId: client.id } });
      // 2. Delete associated projects
      await prisma.proyecto.deleteMany({ where: { clienteId: client.id } });
      // 3. Delete the client itself
      await prisma.cliente.delete({ where: { id: client.id } });
    }
  });

  it('POST /api/import/confirm - processes bulk import transaction successfully', async () => {
    // Mock payload resembling Excel parse result
    const payload = {
      clientes: [
        { id: 'temp_cli_1', nombre: testClientName, codigo: 'TC1' }
      ],
      proyectos: [
        { id: 'temp_proj_1', clienteId: 'temp_cli_1', nombre: testProjName, estado: 'En Proceso', fechaInicio: '2026-06-01' }
      ],
      registros: [
        {
          id: 'temp_reg_1',
          clienteId: 'temp_cli_1',
          proyectoId: 'temp_proj_1',
          fecha: '2026-06-28',
          concepto: 'Insumo',
          descripcion: 'Tornillos y tuercas',
          cantidad: 10,
          precioUnitario: 500,
          total: 5000
        }
      ]
    };

    const res = await request(app)
      .post('/api/import/confirm')
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.guardados).toBe(1);
    expect(res.body.data.errores).toBe(0);

    // Verify database side persistence
    const savedClient = await prisma.cliente.findFirst({ where: { nombre: testClientName } });
    expect(savedClient).not.toBeNull();

    const savedProj = await prisma.proyecto.findFirst({ where: { nombre: testProjName } });
    expect(savedProj).not.toBeNull();
    expect(savedProj?.clienteId).toBe(savedClient?.id);
  }, 20000);
});
