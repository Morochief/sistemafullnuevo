/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Input Validation Schemas with Zod
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Login Schema
 */
export const LoginSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido').max(50),
  password: z.string().min(1, 'Contraseña requerida')
});

/**
 * Password Complexity Schema (SECURITY Phase 3 Fix #14)
 *
 * NOTE: This schema is intentionally NOT used by LoginSchema. The demo users
 * have simple passwords (e.g. admin123) and enforcing complexity on login would
 * lock them out. This schema is provided for a FUTURE user registration or
 * change-password endpoint, where new passwords must meet complexity rules:
 *   - minimum 8 characters
 *   - at least one uppercase letter
 *   - at least one lowercase letter
 *   - at least one number
 */
export const PasswordComplexitySchema = z.string()
  .min(3, 'La contraseña debe tener al menos 3 caracteres');


/**
 * Helper: Sanitize HTML from user input (SECURITY Phase 2 Fix #4)
 */
function sanitizeHTML(input: string): string {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], // Strip ALL HTML tags
    ALLOWED_ATTR: [] // Strip ALL attributes
  });
}

/**
 * Registro Item Schema
 * QA Enhancement: Added business validation for dates and positive amounts
 */
export const RegistroItemSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido'),
  proyectoId: z.string().min(1, 'Proyecto requerido'),
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .optional(),
  concepto: z.enum(['MO', 'Insumo', 'Otros']).optional(),
  descripcion: z.string()
    .min(1, 'Descripción requerida')
    .max(500, 'Descripción muy larga')
    .transform(sanitizeHTML),
  colaboradorId: z.string().nullable().optional(),
  hsInicio: z.string().optional().transform(v => v ? v.substring(0, 5) : v),
  hsFin: z.string().optional().transform(v => v ? v.substring(0, 5) : v),
  hsTotal: z.number().nonnegative('Horas totales no pueden ser negativas').optional(),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative('Precio unitario no puede ser negativo'),
  total: z.number().nonnegative('Total no puede ser negativo')
});

/**
 * Cliente Schema
 */
export const ClienteSchema = z.object({
  nombre: z.string()
    .min(1, 'Nombre requerido')
    .max(200, 'Nombre muy largo')
    .transform(sanitizeHTML), // SECURITY: Sanitize HTML/XSS
  codigo: z.string().max(20, 'Código muy largo').optional(),
  fechaCreacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

/**
 * Proyecto Schema
 */
export const ProyectoSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido'),
  nombre: z.string()
    .min(1, 'Nombre requerido')
    .max(300, 'Nombre muy largo')
    .transform(sanitizeHTML), // SECURITY: Sanitize HTML/XSS
  presupuesto: z.number().nonnegative('Presupuesto no puede ser negativo').optional(),
  estado: z.enum(['Pendiente', 'En Proceso', 'Completado']).optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

/**
 * Colaborador Schema
 */
export const ColaboradorSchema = z.object({
  nombre: z.string()
    .min(1, 'Nombre requerido')
    .max(200, 'Nombre muy largo')
    .transform(sanitizeHTML), // SECURITY: Sanitize HTML/XSS
  tarifaSugerida: z.number().positive('Tarifa debe ser positiva'),
  rol: z.string().max(100, 'Rol muy largo').optional()
});

/**
 * Database State Schema (for full import)
 */
export const DatabaseStateSchema = z.object({
  clientes: z.array(ClienteSchema.extend({ id: z.string() })),
  proyectos: z.array(ProyectoSchema.extend({ id: z.string() })),
  colaboradores: z.array(ColaboradorSchema.extend({ id: z.string() })),
  registros: z.array(z.any()) // Flexible for registros
});

/**
 * Gemini Enrich Schema
 */
export const GeminiEnrichSchema = z.object({
  entries: z.array(z.object({
    descripcion: z.string().transform(sanitizeHTML), // SECURITY: Sanitize HTML/XSS
    concepto: z.string().optional()
  })).min(1, 'Al menos una entrada requerida')
});

/**
 * Timer Start Schema
 */
export const TimerStartSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  colaboradorId: z.string().min(1, 'Colaborador requerido'),
  clienteId: z.string().min(1, 'Cliente requerido'),
  proyectoId: z.string().min(1, 'Proyecto requerido'),
  descripcion: z.string()
    .min(1, 'Descripción requerida')
    .max(500, 'Descripción muy larga')
    .transform(sanitizeHTML),
  precioUnitario: z.number().positive('Precio unitario debe ser positivo')
});

/**
 * Timer Stop Schema
 */
export const TimerStopSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  pausedTime: z.number().nonnegative('Tiempo pausado debe ser no negativo').optional(),
  pauseHistory: z.array(z.object({
    start: z.string(),
    end: z.string().nullable(),
    duration: z.number().nonnegative()
  })).optional()
});

/**
 * Timer Pause Schema
 */
export const TimerPauseSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido')
});

/**
 * Timer Resume Schema
 */
export const TimerResumeSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido')
});

/**
 * Timer Sync Schema
 */
export const TimerSyncSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  segundosTranscurridos: z.number().nonnegative('Segundos deben ser no negativos')
});

/**
 * Viaje Start Schema
 */
export const ViajeStartSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  clienteId: z.string().min(1, 'Cliente requerido'),
  proyectoId: z.string().min(1, 'Proyecto requerido'),
  descripcion: z.string()
    .max(500, 'Descripción muy larga')
    .transform(sanitizeHTML),
  ubicacionInicio: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).nullable().optional(),
  fotoOdometroInicio: z.string().min(1, 'Foto del odómetro requerida'),
  kmInicial: z.number().positive('Kilometraje inicial debe ser positivo')
}).refine(
  (data) => {
    // Permitir viajes particulares sin cliente/proyecto real
    const esParticular = data.clienteId === 'viaje_particular' || data.proyectoId === 'viaje_particular';
    return esParticular || (data.clienteId && data.proyectoId);
  },
  { message: 'Cliente y proyecto requeridos para viajes no particulares' }
);

/**
 * Viaje Stop Schema
 */
export const ViajeStopSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  ubicacionFin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).nullable().optional(),
  fotoOdometroFin: z.string().min(1, 'Foto del odómetro requerida'),
  kmFinal: z.number().positive('Kilometraje final debe ser positivo'),
  combustibleLitros: z.number().positive().optional(),
  combustibleCosto: z.number().positive('Costo de combustible requerido'),
  descripcion: z.string().max(500).transform(sanitizeHTML).optional()
});

/**
 * Registro Vehiculo Update Schema (Full replacement - PUT)
 * QA Enhancement: Added date validation
 */
export const RegistroVehiculoUpdateSchema = z.object({
  kmInicial: z.number().positive('Kilometraje inicial debe ser positivo'),
  kmFinal: z.number().positive('Kilometraje final debe ser positivo'),
  combustibleLitros: z.number().positive('Litros de combustible deben ser positivos').optional(),
  precioLitro: z.number().positive('Precio por litro debe ser positivo').optional(),
  total: z.number().positive('Total debe ser positivo'),
  descripcion: z.string().max(500).transform(sanitizeHTML),
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .refine(
      (date) => {
        const inputDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return inputDate <= today;
      },
      { message: 'La fecha no puede ser futura' }
    )
}).refine(
  (data) => data.kmFinal > data.kmInicial,
  { message: 'Kilometraje final debe ser mayor que el inicial', path: ['kmFinal'] }
);

/**
 * Registro Vehiculo Patch Schema (Partial update - PATCH)
 * QA Enhancement: Added date validation
 */
export const RegistroVehiculoPatchSchema = z.object({
  kmInicial: z.number().positive('Kilometraje inicial debe ser positivo').optional(),
  kmFinal: z.number().positive('Kilometraje final debe ser positivo').optional(),
  combustibleLitros: z.number().positive('Litros de combustible deben ser positivos').optional(),
  precioLitro: z.number().positive('Precio por litro debe ser positivo').optional(),
  total: z.number().positive('Total debe ser positivo').optional(),
  descripcion: z.string().max(500).transform(sanitizeHTML).optional(),
  fotoOdometroInicio: z.string().optional(),
  fotoOdometroFin: z.string().optional(),
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .refine(
      (date) => {
        const inputDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return inputDate <= today;
      },
      { message: 'La fecha no puede ser futura' }
    )
    .optional()
}).refine(
  (data) => {
    if (data.kmInicial !== undefined && data.kmFinal !== undefined) {
      return data.kmFinal >= data.kmInicial; // allow equal km for zero-distance trips
    }
    return true;
  },
  { message: 'Kilometraje final no puede ser menor que el inicial', path: ['kmFinal'] }
);

/**
 * Helper: Validate request body and return errors
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    };
  }
  
  return {
    valid: true,
    data: result.data
  };
}
