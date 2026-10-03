/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cliente {
  id: string;
  nombre: string;
  codigo?: string;
  tokenPortal?: string | null;
  activarPortal?: boolean;
  revocarPortal?: boolean;
  fechaCreacion: string;
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  presupuesto?: number;
  estado: 'Pendiente' | 'En Proceso' | 'Completado';
  fechaInicio: string;
  activo?: boolean;
}

export interface Colaborador {
  id: string;
  nombre: string;
  tarifaSugerida: number; // Precio por minuto o por hora
  rol?: string;
  ci?: string;
  cargo?: string;
  departamento?: string;
  jefeInmediato?: string;
  usuario?: {
    id: string;
    username: string;
    nombre: string;
    email: string | null;
    rol: 'Admin' | 'Operario' | 'Visor';
    activo: boolean;
  } | null;
}

export interface Permiso {
  id: string;
  colaboradorId: string;
  nombreSolicitante: string;
  cargo?: string | null;
  ci?: string | null;
  departamento?: string | null;
  jefeInmediato?: string | null;
  tipoPermiso: string;
  motivo?: string | null;
  modoTiempo: 'horas' | 'dias';
  horaInicio?: string | null;
  horaFin?: string | null;
  fechaHora?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  estado: 'Pendiente' | 'AprobadoJefe' | 'Aprobado' | 'Rechazado';
  jefeDecision?: string | null;
  jefeComentario?: string | null;
  jefeFecha?: string | null;
  rrhhDecision?: string | null;
  rrhhComentario?: string | null;
  rrhhDescontarSalario?: boolean | null;
  rrhhFecha?: string | null;
  creadoPor: string;
  createdAt: string;
  updatedAt: string;
  colaborador?: {
    id: string;
    nombre: string;
    ci?: string | null;
    cargo?: string | null;
    departamento?: string | null;
    jefeInmediato?: string | null;
    rol?: string | null;
  };
}

export interface RegistroItem {
  id: string;
  clienteId: string;
  clienteNombre: string;
  proyectoId: string;
  proyectoNombre: string;
  fecha: string; // YYYY-MM-DD
  concepto: 'MO' | 'Insumo' | 'Otros' | 'Vehículo';
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
  modoInsumo?: 'UNIDAD' | 'METRO' | 'DIMENSION' | 'PORCENTAJE' | 'FACTURA' | string | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  desperdicioCalculado?: boolean | null;
  porcentajeUsado?: number | null;
  facturaCompraId?: string | null;
  prorrateoGrupoId?: string | null;
  porcentajeProrrateo?: number | null;
}

export interface FacturaCompraItem {
  id: string;
  facturaNumero: string;
  proveedor: string;
  fecha: string;
  descripcion: string;
  cantidadComprada: number;
  cantidadUsada: number;
  cantidadDisponible: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  notas?: string | null;
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
  usuariosSinColaborador?: {
    id: string;
    username: string;
    nombre: string;
    email: string | null;
    rol: 'Admin' | 'Operario' | 'Visor';
    activo: boolean;
  }[];
}

// ─── Portal de Pedidos para Clientes ────────────────────────────────

export interface Pedido {
  id: string;
  clienteId: string;
  clienteNombre: string;
  sucursalId: string;
  local: string;
  marca?: string | null;
  descripcion: string;
  cantidad: number;
  tipo?: string | null;
  prioridad?: string | null;
  estado: string;
  fotoUrl?: string | null;
  fechaSolicitud: string;
  fechaFin?: string | null;
  facturaNumero?: string | null;
  registroId?: string | null;
  presupuestoEstado?: string | null;
  presupuestoTotal?: number | null;
  presupuestoProyecto?: string | null;
  archivado?: boolean;
  archivadoAt?: string | null;
  // Campos de Remisión y Entrega (POD)
  fotoRemisionUrl?: string | null;
  fotoEntregaUrl?: string | null;
  fechaEntrega?: string | null;
  receptorNombre?: string | null;
  contacto?: string | null;
  proyecto?: string | null;
  fechaInicioDeseada?: string | null;
  fechaTope?: string | null;
  comentarioCliente?: string | null;
}

export interface Sucursal {
  id: string;
  clienteId: string;
  clienteNombre: string;
  nombre: string;
  ciudad?: string | null;
  activo: boolean;
}

export interface PortalData {
  cliente: { id: string; nombre: string };
  sucursales: { id: string; nombre: string }[];
  pedidos: {
    id: string;
    local: string;
    descripcion: string;
    cantidad: number;
    estado: string;
    prioridad?: string | null;
    fotoUrl?: string | null;
    fechaSolicitud: string;
    fechaFin?: string | null;
    facturaNumero?: string | null;
    fotoRemisionUrl?: string | null;
    fotoEntregaUrl?: string | null;
    fechaEntrega?: string | null;
    receptorNombre?: string | null;
  }[];
  paginacion: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PortalPedidoInput {
  sucursalId: string;
  descripcion: string;
  cantidad: number;
  foto?: string | null;
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
  cargo?: string | null;
  departamento?: string | null;
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

// ─── Presupuestos (cotización de aFull al cliente) ──────────────────

export const PRESUPUESTO_CATEGORIAS = ['Insumo', 'Adquisicion', 'ManoDeObra', 'Entrega'] as const;
export type PresupuestoCategoria = typeof PRESUPUESTO_CATEGORIAS[number];

export interface PresupuestoItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  orden: number;
  categoria: PresupuestoCategoria;
  horas?: number | null;
  tarifa?: number | null;
}

export interface Presupuesto {
  id: string;
  pedidoId: string;
  clienteId: string;
  clienteNombre: string;
  proyecto: string;
  contacto?: string | null;
  fechaInicio?: string | null;
  fechaTope?: string | null;
  estado: 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'En Proceso';
  total: number;
  markup: number;
  costoTotal?: number | null;
  venta1?: number | null;
  venta2?: number | null;
  comentarioCliente?: string | null;
  respuestaCliente?: string | null;
  fotos?: string[];
  fechaEnvio?: string | null;
  fechaRespuesta?: string | null;
  registroId?: string | null;
  createdAt: string;
  items?: PresupuestoItem[];
  pedido?: { id: string; descripcion: string; sucursalNombre: string } | null;
}

// ─── Ordenes de Trabajo (OT generadas desde presupuestos aprobados) ──

export interface OrdenTrabajo {
  id: string;
  presupuestoId: string;
  clienteId: string;
  clienteNombre: string;
  proyecto: string;
  contacto?: string | null;
  fechaInicio?: string | null;
  fechaTope?: string | null;
  detallesTrabajo: string;
  comentarioCliente?: string | null;
  estado: string;
  enviadoWhatsapp: boolean;
  fechaEnvioWsp?: string | null;
  mensajeWhatsapp?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hojas de Ruta y Tareas de Operarios ───────────────────────────

export interface HojaRutaTarea {
  id: string;
  hojaRutaId: string;
  colaboradorId?: string | null;
  operarioNombre: string;
  orden: number;
  descripcion: string;
  categoria: string;
  cantidad?: number | null;
  unidad?: string | null;
  estado: string;
  tiempoEstimado?: string | null;
  fechaAsignada: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  notasOperario?: string | null;
  fotoUrl?: string | null;
  colaborador?: { id: string; nombre: string; rol: string | null } | null;
}

export interface HojaRuta {
  id: string;
  ordenTrabajoId: string;
  clienteId: string;
  clienteNombre: string;
  proyecto: string;
  fecha: string;
  estado: string;
  notas?: string | null;
  enviadoWhatsapp: boolean;
  fechaEnvioWsp?: string | null;
  createdAt: string;
  updatedAt?: string;
  tareas?: HojaRutaTarea[];
  ordenTrabajo?: { id: string; estado: string };
  _count?: { tareas: number };
}

// ─── Cartera de Clientes (módulo separado del Cliente operativo) ───

export interface CarteraCliente {
  id: string;
  nombre: string;
  ruc?: string | null;
  activo: boolean;
  fechaCreacion: string;
  _count?: {
    contactos: number;
    marcas: number;
  };
}

export interface CarteraContacto {
  id: string;
  clienteId: string;
  clienteNombre: string;
  nombre: string;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  activo: boolean;
}

export interface CarteraMarca {
  id: string;
  clienteId: string;
  clienteNombre: string;
  nombre: string;
  activo: boolean;
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
