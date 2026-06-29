// @vitest-environment node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import { prisma } from '../lib/prisma.ts';
import { generateToken } from '../../server-auth.ts';

describe('Users API Integration (Supertest)', () => {
  let adminCookie: string;
  let csrfToken: string;
  let sessionCookie: string;
  let testUserId: string;
  const testUsername = 'testuser_' + Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Generate valid admin JWT token
    const token = generateToken({
      usuario: 'admin',
      nombre: 'Administrador',
      rol: 'Admin'
    });
    adminCookie = `jwt=${token}`;

    // 2. Request CSRF token to establish session cookie
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.data.csrfToken;
    
    // Extract sessionId cookie
    const rawCookies = csrfRes.headers['set-cookie'] || [];
    const sessionCookieMatch = rawCookies.find((c: string) => c.startsWith('sessionId='));
    sessionCookie = sessionCookieMatch ? sessionCookieMatch.split(';')[0] : '';
  });

  it('GET /api/users - requires authentication', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('POST /api/users - creates a new user under admin authority', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        username: testUsername,
        nombre: 'Usuario Prueba',
        email: 'prueba@sistema.com',
        password: 'Password123',
        rol: 'Operario'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(testUsername);
    expect(res.body.data.rol).toBe('Operario');
    
    testUserId = res.body.data.id;
  }, 15000);

  it('GET /api/users - returns users list excluding password hashes', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    
    // Check passwordHash does not leak
    const createdUser = res.body.data.find((u: any) => u.id === testUserId);
    expect(createdUser).toBeDefined();
    expect(createdUser.passwordHash).toBeUndefined();
  });

  it('PUT /api/users/:id - updates user profile and mappings', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}`)
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        nombre: 'Usuario Modificado',
        rol: 'Visor'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Usuario Modificado');
    expect(res.body.data.rol).toBe('Visor');
  });

  it('DELETE /api/users/:id - toggles active state', async () => {
    const res = await request(app)
      .delete(`/api/users/${testUserId}`)
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activo).toBe(false);
  });

  it('DELETE /api/users/:id?hard=true - physically removes the user', async () => {
    const res = await request(app)
      .delete(`/api/users/${testUserId}?hard=true`)
      .set('Cookie', [adminCookie, sessionCookie])
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    // Verify removal in DB
    const dbUser = await prisma.usuario.findUnique({ where: { id: testUserId } });
    expect(dbUser).toBeNull();
  });
});
