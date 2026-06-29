// @vitest-environment node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import { prisma } from '../lib/prisma.ts';
import { generateToken } from '../../server-auth.ts';

describe('Vehicles API Integration (Supertest)', () => {
  let adminCookie: string;
  let csrfToken: string;
  let sessionCookie: string;
  
  let testClientId: string;
  let testProyectoId: string;
  const mockBase64Photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

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

    // Fetch existing client & project to link
    const cli = await prisma.cliente.findFirst();
    testClientId = cli ? cli.id : 'cli_default';
    const proj = await prisma.proyecto.findFirst({ where: { clienteId: testClientId } });
    testProyectoId = proj ? proj.id : 'proj_default';

    // Clean up any lingering active trip for 'admin' to prevent VIAJE_ACTIVO error
    await prisma.viajeActivo.deleteMany({ where: { usuario: 'admin' } });
  });

  it('POST /api/viaje/start - starts a vehicle trip', async () => {
    const res = await request(app)
      .post('/api/viaje/start')
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        usuario: 'admin', // Required by schema
        clienteId: testClientId,
        proyectoId: testProyectoId,
        kmInicial: 10000.5,
        descripcion: 'Viaje de prueba',
        ubicacionInicio: { lat: -25.2867, lng: -57.6111, nombre: 'Oficina Central' },
        fotoOdometroInicio: mockBase64Photo
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kmInicial).toBe(10000.5);

    // Verify trip is active in DB
    const activeTrip = await prisma.viajeActivo.findFirst({
      where: { usuario: 'admin', activo: true }
    });
    expect(activeTrip).not.toBeNull();
  }, 20000);

  it('POST /api/viaje/stop - stops active trip and saves vehicle record', async () => {
    const res = await request(app)
      .post('/api/viaje/stop')
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        usuario: 'admin', // Required by stop schema
        kmFinal: 10050.2,
        combustibleLitros: 15,
        combustibleCosto: 95000,
        descripcion: 'Finalización de viaje de prueba',
        ubicacionFin: { lat: -25.3211, lng: -57.5888, nombre: 'Obra Km 12' },
        fotoOdometroFin: mockBase64Photo
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify trip is marked inactive
    const activeTrip = await prisma.viajeActivo.findFirst({
      where: { usuario: 'admin', activo: true }
    });
    expect(activeTrip).toBeNull();
  }, 20000);
});
