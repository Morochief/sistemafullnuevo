import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock JWT_SECRET before importing server-auth using vi.hoisted
const { hashPassword, verifyPassword, generateToken, verifyToken, findUserByUsername, authenticateUser, requireAuth, requireAdmin } = await (async () => {
  process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_purposes_minimum_32_chars_long';
  return await import('../../server-auth');
})();

describe('server-auth', () => {
  describe('Password Hashing', () => {
    it('hashes password successfully', async () => {
      const hash = await hashPassword('myPassword');
      expect(hash).toBeTruthy();
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('verifies correct password', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('correct');
      const isValid = await verifyPassword('wrong', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    it('generates valid token', () => {
      const token = generateToken({ usuario: 'admin', nombre: 'Admin', rol: 'Admin' });
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
    });

    it('verifies valid token', () => {
      const token = generateToken({ usuario: 'admin', nombre: 'Admin', rol: 'Admin' });
      const decoded = verifyToken(token);
      expect(decoded.usuario).toBe('admin');
    });

    it('throws on invalid token', () => {
      expect(() => verifyToken('invalid')).toThrow();
    });
  });

  describe('User Lookup', () => {
    it('finds user by username', () => {
      const user = findUserByUsername('admin');
      expect(user?.usuario).toBe('admin');
    });

    it('returns undefined for non-existent user', () => {
      const user = findUserByUsername('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('Authentication', () => {
    it('authenticates valid credentials', async () => {
      const user = await authenticateUser('admin', 'admin123');
      expect(user?.usuario).toBe('admin');
    });

    it('rejects invalid password', async () => {
      const user = await authenticateUser('admin', 'wrong');
      expect(user).toBeNull();
    });
  });

  describe('requireAuth Middleware', () => {
    it('passes with valid token', () => {
      const token = generateToken({ usuario: 'admin', nombre: 'Admin', rol: 'Admin' });
      const mockReq = { cookies: { jwt: token }, method: 'GET', path: '/test' } as any;
      const mockRes = {} as Response;
      const mockNext = vi.fn();
      
      requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('rejects without token', () => {
      const mockReq = { cookies: {}, method: 'GET', path: '/test' } as any;
      const jsonMock = vi.fn();
      const mockRes = { status: vi.fn().mockReturnValue({ json: jsonMock }) } as any;
      const mockNext = vi.fn();
      
      requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin Middleware', () => {
    it('passes for Admin', () => {
      const mockReq = { user: { rol: 'Admin' } } as any;
      const mockRes = {} as Response;
      const mockNext = vi.fn();
      
      requireAdmin(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('rejects non-Admin', () => {
      const mockReq = { user: { rol: 'Operario' } } as any;
      const jsonMock = vi.fn();
      const mockRes = { status: vi.fn().mockReturnValue({ json: jsonMock }) } as any;
      const mockNext = vi.fn();
      
      requireAdmin(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
