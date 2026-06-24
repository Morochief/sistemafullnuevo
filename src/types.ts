/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cliente {
  id: string;
  nombre: string;
  codigo?: string;
  fechaCreacion: string;
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  presupuesto?: number;
  estado: 'Pendiente' | 'En Proceso' | 'Completado';
  fechaInicio: string;
}

export interface Colaborador {
  id: string;
  nombre: string;
  tarifaSugerida: number; // Precio por minuto o por hora
  rol?: string;
}

export interface RegistroItem {
  id: string;
  clienteId: string;
  clienteNombre: string;
  proyectoId: string;
  proyectoNombre: string;
  fecha: string; // YYYY-MM-DD
  concepto: 'MO' | 'Insumo' | 'Otros';
  descripcion: string; // Nombre del colaborador o detalle
  colaboradorId?: string; // Mapeado
  hsInicio?: string; // Formato hh:mm o fracción
  hsFin?: string;
  hsTotal?: number;
  cantidad: number; // Por ejemplo, minutos o unidades de insumo
  precioUnitario: number;
  total: number;
  origen: 'Manual' | 'Excel';
  fechaImportacion?: string;
}

export interface PauseRecord {
  start: string; // ISO timestamp
  end: string | null; // ISO timestamp (null if pause is active)
  duration: number; // seconds
}

export interface TimerActivo {
  id: string;
  usuario: string;
  colaboradorId: string;
  clienteId: string;
  proyectoId: string;
  descripcion: string;
  precioUnitario: number;
  inicio: string; // ISO timestamp
  activo: boolean;
  ultimaActualizacion: string; // ISO timestamp
  pausedTime?: number; // Total accumulated paused time in seconds
  pauseHistory?: PauseRecord[]; // Array of pause records
  isPaused?: boolean; // Current pause state
  currentPauseStart?: string; // ISO timestamp of current pause start (if paused)
}

export interface RegistroVehiculo {
  id: string;
  usuario: string; // Usuario que creó el registro (operario)
  clienteId: string;
  clienteNombre: string;
  proyectoId: string;
  proyectoNombre: string;
  fecha: string;
  concepto: 'Vehículo';
  
  // Ubicación GPS
  ubicacionInicio: { lat: number; lng: number; nombre?: string };
  ubicacionFin: { lat: number; lng: number; nombre?: string };
  distanciaGPS: number; // km calculados por GPS
  
  // Odómetro (control cruzado)
  kmInicial: number;
  kmFinal: number;
  distanciaOdometro: number;
  fotoOdometroInicio: string; // Ruta del archivo
  fotoOdometroFin: string;
  
  // Control de discrepancias
  discrepancia?: number; // % diferencia entre GPS y odómetro
  alertaDiscrepancia?: boolean;
  
  // Combustible
  combustibleLitros?: number;
  combustibleCosto: number;
  consumoPorKm?: number;
  
  // Timer
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  
  // Observaciones
  descripcion: string;
  
  total: number;
  origen: 'Manual' | 'Excel';
  fechaImportacion?: string;
}

export interface ViajeActivo {
  id: string;
  usuario: string;
  proyectoId: string;
  clienteId: string;
  inicio: string;
  ubicacionInicio: { lat: number; lng: number };
  fotoOdometroInicio: string;
  kmInicial: number;
  descripcion: string;
  activo: boolean;
}

export interface DatabaseState {
  clientes: Cliente[];
  proyectos: Proyecto[];
  colaboradores: Colaborador[];
  registros: RegistroItem[];
  registrosVehiculo: RegistroVehiculo[];
  timersActivos: TimerActivo[];
  viajesActivos: ViajeActivo[];
}

// Authentication & Authorization Types
export interface User {
  usuario: string;
  nombre: string;
  rol: 'Admin' | 'Operario' | 'Técnico';
  passwordHash: string;
  colaboradorId?: string; // SECURITY Fix #16: Link demo user to a Colaborador for exact-match authorization
}

export interface JWTPayload {
  usuario: string;
  nombre: string;
  rol: string;
  colaboradorId?: string; // SECURITY Fix #16: Carried in token for exact-match authorization
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    nombre: string;
    rol: string;
    usuario: string;
  };
  error?: string;
}

// Normalized API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}
