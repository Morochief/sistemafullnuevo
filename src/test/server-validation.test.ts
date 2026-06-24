import { describe, it, expect } from 'vitest';
import { 
  validateSchema,
  RegistroVehiculoPatchSchema,
  LoginSchema 
} from '../../server-validation';

describe('Server Validation', () => {
  describe('LoginSchema', () => {
    it('validates correct login data', () => {
      const result = validateSchema(LoginSchema, {
        usuario: 'admin',
        password: 'admin123'
      });
      
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        usuario: 'admin',
        password: 'admin123'
      });
    });

    it('rejects empty usuario', () => {
      const result = validateSchema(LoginSchema, {
        usuario: '',
        password: 'admin123'
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('RegistroVehiculoPatchSchema', () => {
    it('validates correct vehicle registro patch', () => {
      const result = validateSchema(RegistroVehiculoPatchSchema, {
        kmInicial: 1000,
        kmFinal: 1150,
        combustibleLitros: 10,
        precioLitro: 6500,
        total: 65000,
        descripcion: 'Viaje a cliente',
        fecha: '2026-06-23'
      });
      
      expect(result.valid).toBe(true);
    });
  });
});
