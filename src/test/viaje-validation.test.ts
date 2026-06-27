/**
 * Tests for viaje (vehicle trip) validation and business logic
 *
 * Covers:
 * - ViajeStopSchema: valid inputs, missing GPS, missing fields
 * - Discrepancy calculation logic: with GPS, without GPS, edge cases
 * - alertaDiscrepancia threshold (>20%)
 */

import { describe, it, expect } from 'vitest';
import { validateSchema, ViajeStopSchema } from '../../server-validation';

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcDiscrepancia(
  distanciaOdometro: number,
  distanciaGPS: number | null
): { discrepanciaPorcentaje: number; alertaDiscrepancia: boolean } {
  if (distanciaGPS == null || distanciaGPS <= 0 || distanciaOdometro <= 0) {
    return { discrepanciaPorcentaje: 0, alertaDiscrepancia: false };
  }
  const diferencia = Math.abs(distanciaOdometro - distanciaGPS);
  const discrepanciaPorcentaje = (diferencia / distanciaGPS) * 100;
  return {
    discrepanciaPorcentaje,
    alertaDiscrepancia: discrepanciaPorcentaje > 20,
  };
}

// ─── ViajeStopSchema validation ─────────────────────────────────────────────

describe('ViajeStopSchema', () => {
  const baseValid = {
    usuario: 'rodrigo',
    fotoOdometroFin: 'data:image/jpeg;base64,/9j/abc123',
    kmFinal: 188203,
    combustibleCosto: 50000,
  };

  it('acepta un payload válido con GPS', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      ubicacionFin: { lat: -25.2837, lng: -57.5959 },
    });
    expect(result.valid).toBe(true);
    expect(result.data?.ubicacionFin?.lat).toBe(-25.2837);
  });

  it('acepta un payload válido sin GPS (ubicacionFin null)', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      ubicacionFin: null,
    });
    expect(result.valid).toBe(true);
    expect(result.data?.ubicacionFin).toBeNull();
  });

  it('acepta un payload válido sin GPS (ubicacionFin omitido)', () => {
    const result = validateSchema(ViajeStopSchema, baseValid);
    expect(result.valid).toBe(true);
    expect(result.data?.ubicacionFin).toBeUndefined();
  });

  it('acepta con combustibleLitros opcional', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      combustibleLitros: 4.5,
    });
    expect(result.valid).toBe(true);
    expect(result.data?.combustibleLitros).toBe(4.5);
  });

  it('rechaza si falta usuario', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      usuario: '',
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza si falta fotoOdometroFin', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      fotoOdometroFin: '',
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza si kmFinal es negativo', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      kmFinal: -1,
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza si combustibleCosto es 0', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      combustibleCosto: 0,
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza coordenadas GPS fuera de rango', () => {
    const result = validateSchema(ViajeStopSchema, {
      ...baseValid,
      ubicacionFin: { lat: 999, lng: -57.5959 },
    });
    expect(result.valid).toBe(false);
  });
});

// ─── Discrepancy calculation logic ──────────────────────────────────────────

describe('calcDiscrepancia', () => {
  it('sin alerta cuando GPS y odómetro coinciden', () => {
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(10, 10);
    expect(discrepanciaPorcentaje).toBe(0);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('sin alerta con diferencia menor al 20%', () => {
    // odómetro=11, GPS=10 → 10% diferencia
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(11, 10);
    expect(discrepanciaPorcentaje).toBeCloseTo(10, 1);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('con alerta cuando diferencia supera el 20%', () => {
    // odómetro=13, GPS=10 → 30% diferencia
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(13, 10);
    expect(discrepanciaPorcentaje).toBeCloseTo(30, 1);
    expect(alertaDiscrepancia).toBe(true);
  });

  it('exactamente 20% NO dispara alerta (threshold estricto >20)', () => {
    // odómetro=12, GPS=10 → exactamente 20%
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(12, 10);
    expect(discrepanciaPorcentaje).toBeCloseTo(20, 1);
    expect(alertaDiscrepancia).toBe(false); // >20, no >=20
  });

  it('sin alerta cuando GPS es null (sin coordenadas)', () => {
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(10, null);
    expect(discrepanciaPorcentaje).toBe(0);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('sin alerta cuando GPS es 0 (sin señal)', () => {
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(10, 0);
    expect(discrepanciaPorcentaje).toBe(0);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('viaje urbano real: odómetro 3km sin GPS → sin alerta', () => {
    const { alertaDiscrepancia } = calcDiscrepancia(3, null);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('odómetro 0 (km inicio = km fin) → sin alerta aunque haya GPS', () => {
    // km inicial = km final = 188200 → distanciaOdometro = 0 → no calcular discrepancia
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(0, 0.5);
    expect(discrepanciaPorcentaje).toBe(0);
    expect(alertaDiscrepancia).toBe(false);
  });

  it('maneja distancias con decimales', () => {
    // odómetro=5.5, GPS=5.0 → 10% diferencia → sin alerta
    const { discrepanciaPorcentaje, alertaDiscrepancia } = calcDiscrepancia(5.5, 5.0);
    expect(discrepanciaPorcentaje).toBeCloseTo(10, 1);
    expect(alertaDiscrepancia).toBe(false);
  });
});
