// @vitest-environment node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';

describe('Auth API Integration (Supertest)', () => {
  let csrfToken: string;
  let sessionCookie: string;

  beforeAll(async () => {
    // Get CSRF and session
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.data.csrfToken;
    const rawCookies = csrfRes.headers['set-cookie'] || [];
    const sessionCookieMatch = rawCookies.find((c: string) => c.startsWith('sessionId='));
    sessionCookie = sessionCookieMatch ? sessionCookieMatch.split(';')[0] : '';
  });

  it('POST /api/auth/login - fails with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', [sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        usuario: 'admin',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login - succeeds with correct credentials and returns cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', [sessionCookie])
      .set('x-csrf-token', csrfToken)
      .send({
        usuario: 'admin',
        password: 'admin123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.rol).toBe('Admin');
    
    // Should return JWT cookie
    const rawCookies = res.headers['set-cookie'] || [];
    const jwtCookie = rawCookies.find((c: string) => c.startsWith('jwt='));
    expect(jwtCookie).toBeDefined();
  });

  it('POST /api/auth/logout - clears authentication cookies', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rawCookies = res.headers['set-cookie'] || [];
    // Cookies should be set with empty values or expired date (1970)
    const jwtCookie = rawCookies.find((c: string) => c.startsWith('jwt='));
    expect(jwtCookie).toBeDefined();
    expect(jwtCookie).toContain('1970');
  });
});
