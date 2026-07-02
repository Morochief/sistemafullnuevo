/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MisRegistros — Vista personal de registros del usuario
 * 
 * FUNCIONALIDAD:
 * - Muestra registros del usuario actual filtrados por colaboradorId
 * - Permite editar descripción y proyecto asignado
 * - Campos sensibles (horas, precios, fecha, total) son read-only
 * - Modal de edición con validación y feedback visual
 * - Animaciones glass-panel aesthetic con Framer Motion
 * 
 * PATRONES:
 * - Custom Hook (useEditRegistro para lógica de edición)
 * - Compound Components (Modal, Card)
 * - AnimatePresence para transiciones
 * - Memoization para performance
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cardVariants, cardTransition } from '../lib/animations.ts';
import {
  Calendar,
  Clock,
  DollarSign,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Package,
  User,
  Briefcase,
  Building2,
  Save,
  FileText,
  Car,
  MapPin,
  Gauge,
  Fuel,
  AlertTriangle,
} from 'lucide-react';
import { DatabaseState, RegistroItem, RegistroVehiculo } from '../types.ts';
import { authFetchJSON } from '../authFetch.ts';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface MisRegistrosProps {
  data: DatabaseState;
  currentUser: { nombre: string; rol: string; usuario: string };
  onRefresh: () => Promise<void>;
}

interface EditFormData {
  descripcion: string;
  proyectoId: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatGuaranies(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-AR', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '—';
  return timeStr;
}

function getConceptoBadge(concepto: string) {
  switch (concepto) {
    case 'MO':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Insumo':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    case 'Otros':
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

// ─── CUSTOM HOOK: useEditRegistro ──────────────────────────────────────────

interface UseEditRegistroReturn {
  isEditing: boolean;
  editingId: string | null;
  formData: EditFormData;
  isSubmitting: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  startEdit: (registro: RegistroItem) => void;
  cancelEdit: () => void;
  updateField: (field: keyof EditFormData, value: string) => void;
  submitEdit: () => Promise<void>;
}

function useEditRegistro(
  data: DatabaseState,
  onRefresh: () => Promise<void>
): UseEditRegistroReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    descripcion: '',
    proyectoId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const startEdit = useCallback((registro: RegistroItem) => {
    setEditingId(registro.id);
    setFormData({
      descripcion: registro.descripcion,
      proyectoId: registro.proyectoId,
    });
    setIsEditing(true);
    setFeedback(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ descripcion: '', proyectoId: '' });
    setFeedback(null);
  }, []);

  const updateField = useCallback((field: keyof EditFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editingId) return;

    // Validación
    if (!formData.descripcion.trim()) {
      setFeedback({ type: 'error', message: 'La descripción no puede estar vacía.' });
      return;
    }

    if (!formData.proyectoId) {
      setFeedback({ type: 'error', message: 'Debe seleccionar un proyecto.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // Obtener el registro original para enviar datos completos
      const originalRegistro = data.registros.find(r => r.id === editingId);
      if (!originalRegistro) {
        throw new Error('Registro no encontrado');
      }

      // Enviar PATCH con solo los campos editables
      await authFetchJSON(`/api/registros/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: formData.descripcion.trim(),
          proyectoId: formData.proyectoId,
        }),
      });

      setFeedback({ type: 'success', message: '✓ Cambios guardados con éxito' });
      
      // Refrescar datos
      await onRefresh();
      
      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        cancelEdit();
      }, 1500);

    } catch (error: any) {
      console.error('Error al actualizar registro:', error);
      setFeedback({ 
        type: 'error', 
        message: error.message || 'Error al guardar los cambios. Intentá nuevamente.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [editingId, formData, data.registros, onRefresh, cancelEdit]);

  return {
    isEditing,
    editingId,
    formData,
    isSubmitting,
    feedback,
    startEdit,
    cancelEdit,
    updateField,
    submitEdit,
  };
}

// ─── MODAL COMPONENT ────────────────────────────────────────────────────────

interface EditModalProps {
  isOpen: boolean;
  registro: RegistroItem | null;
  formData: EditFormData;
  isSubmitting: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  proyectos: DatabaseState['proyectos'];
  onClose: () => void;
  onUpdateField: (field: keyof EditFormData, value: string) => void;
  onSubmit: () => Promise<void>;
  showPrices: boolean;
}

function EditModal({
  isOpen,
  registro,
  formData,
  isSubmitting,
  feedback,
  proyectos,
  onClose,
  onUpdateField,
  onSubmit,
  showPrices,
}: EditModalProps) {
  if (!isOpen || !registro) return null;

  // Filtrar proyectos del mismo cliente (solo activos, más el seleccionado por coherencia histórica)
  const proyectosFiltrados = proyectos.filter(
    p => p.clienteId === registro.clienteId && (p.activo !== false || p.id === registro.proyectoId)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div 
              className="glass-panel rounded-3xl p-6 max-w-2xl w-full pointer-events-auto border-2 border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30">
                    <Edit2 className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Editar Registro</h2>
                    <p className="text-xs text-slate-400 font-mono">ID: {registro.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Campos No Editables (Solo lectura con Lock) */}
              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Campos Protegidos (No Editables)
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Fecha:</span>
                      <p className="text-white font-mono">{formatDate(registro.fecha)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Concepto:</span>
                      <p className="text-white font-semibold">{registro.concepto}</p>
                    </div>
                    {registro.concepto === 'MO' && (
                      <>
                        <div>
                          <span className="text-slate-500 text-xs">Horas Trabajadas:</span>
                          <p className="text-white font-mono">{registro.hsTotal?.toFixed(2) || '—'} hs</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs">Horario:</span>
                          <p className="text-white font-mono">
                            {formatTime(registro.hsInicio)} - {formatTime(registro.hsFin)}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-slate-500 text-xs">Cantidad:</span>
                      <p className="text-white font-mono">{registro.cantidad}</p>
                    </div>
                    {showPrices && (
                      <>
                        <div>
                          <span className="text-slate-500 text-xs">Precio Unitario:</span>
                          <p className="text-white font-mono">{formatGuaranies(registro.precioUnitario)}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 text-xs">Total:</span>
                          <p className="text-white font-bold text-lg">{formatGuaranies(registro.total)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Campos Editables */}
              <div className="space-y-4 mb-6">
                {/* Descripción */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => onUpdateField('descripcion', e.target.value)}
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm min-h-[100px] resize-none"
                    placeholder="Descripción del trabajo realizado..."
                    disabled={isSubmitting}
                  />
                </div>

                {/* Proyecto */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    Proyecto
                  </label>
                  <select
                    value={formData.proyectoId}
                    onChange={(e) => onUpdateField('proyectoId', e.target.value)}
                    className="glass-select w-full rounded-xl px-4 py-3 text-sm"
                    disabled={isSubmitting}
                  >
                    <option value="">— Seleccionar Proyecto —</option>
                    {proyectosFiltrados.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.estado})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1 ml-1">
                    Solo proyectos de {registro.clienteNombre}
                  </p>
                </div>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3 rounded-xl flex items-center gap-2 mb-4 ${
                      feedback.type === 'success'
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium">{feedback.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Save className="w-4 h-4" />
                      </motion.div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-3 text-slate-400 hover:text-white hover:bg-white/10 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── REGISTRO CARD ──────────────────────────────────────────────────────────

interface RegistroCardProps {
  registro: RegistroItem;
  onEdit: (registro: RegistroItem) => void;
}

const RegistroCard = React.memo<RegistroCardProps>(({ registro, onEdit }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-xl p-5 hover:border-blue-500/30 transition-all group"
    >
      {/* Header: Concepto Badge + Edit Button */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${getConceptoBadge(registro.concepto)}`}>
            {registro.concepto === 'MO' ? (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Mano de Obra
              </span>
            ) : registro.concepto === 'Insumo' ? (
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Insumo
              </span>
            ) : (
              <span>Otros</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEdit(registro)}
          className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"
          title="Editar registro"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Descripción */}
        <div>
          <p className="text-white font-medium text-sm leading-relaxed">
            {registro.descripcion}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(registro.fecha)}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">{registro.clienteNombre}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 col-span-2">
            <Briefcase className="w-3.5 h-3.5" />
            <span className="truncate">{registro.proyectoNombre}</span>
          </div>

          {registro.concepto === 'MO' && (
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{registro.hsTotal?.toFixed(2) || '—'} horas</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-400">
            <Package className="w-3.5 h-3.5" />
            <span>Cantidad: {registro.cantidad}</span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total</span>
          <span className="text-white font-bold text-lg font-mono">
            {formatGuaranies(registro.total)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

RegistroCard.displayName = 'RegistroCard';

// ─── REGISTRO VEHICULO CARD ─────────────────────────────────────────────────

interface RegistroVehiculoCardProps {
  registro: RegistroVehiculo;
}

const RegistroVehiculoCard = React.memo<RegistroVehiculoCardProps>(({ registro }) => {
  const esParticular = registro.clienteNombre === 'Viaje Particular';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-panel rounded-xl p-5 transition-all group ${
        registro.alertaDiscrepancia ? 'border-2 border-amber-500/30 bg-amber-500/5' : 'hover:border-blue-500/30'
      }`}
    >
      {/* Header: Concepto Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${
            esParticular 
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
          }`}>
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" />
              Vehículo {esParticular && '(Particular)'}
            </span>
          </div>
          
          {registro.alertaDiscrepancia && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300">Alerta</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Descripción */}
        <div>
          <p className="text-white font-medium text-sm leading-relaxed">
            {registro.descripcion}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(registro.fecha)}</span>
          </div>

          {!esParticular && (
            <>
              <div className="flex items-center gap-2 text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate">{registro.clienteNombre}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-400 col-span-2">
                <Briefcase className="w-3.5 h-3.5" />
                <span className="truncate">{registro.proyectoNombre}</span>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-slate-400">
            <Gauge className="w-3.5 h-3.5" />
            <span>{registro.distanciaOdometro} km</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{registro.duracionMinutos} min</span>
          </div>

          {registro.combustibleLitros && (
            <div className="flex items-center gap-2 text-slate-400">
              <Fuel className="w-3.5 h-3.5" />
              <span>{registro.combustibleLitros} litros</span>
            </div>
          )}

          {registro.consumoPorKm && (
            <div className="flex items-center gap-2 text-slate-400">
              <Gauge className="w-3.5 h-3.5" />
              <span>{registro.consumoPorKm.toFixed(2)} L/km</span>
            </div>
          )}
        </div>

        {registro.alertaDiscrepancia && (
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-[10px] text-amber-300">
              <strong>Discrepancia detectada:</strong> {registro.discrepancia?.toFixed(1)}% diferencia entre GPS y odómetro
            </p>
          </div>
        )}

        {/* Total */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Combustible</span>
          <span className="text-white font-bold text-lg font-mono">
            {formatGuaranies(registro.total)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

RegistroVehiculoCard.displayName = 'RegistroVehiculoCard';

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function MisRegistros({ data, currentUser, onRefresh }: MisRegistrosProps) {
  // Estado local para registros del servidor
  const [registros, setRegistros] = useState<RegistroItem[]>([]);
  const [registrosVehiculo, setRegistrosVehiculo] = useState<RegistroVehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    isEditing,
    editingId,
    formData,
    isSubmitting,
    feedback,
    startEdit,
    cancelEdit,
    updateField,
    submitEdit,
  } = useEditRegistro(data, onRefresh);

  // Fetch registros del servidor
  useEffect(() => {
    const fetchRegistros = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch both regular and vehicle registros in parallel
        const [registrosResponse, vehiculoResponse] = await Promise.all([
          authFetchJSON<{ success: boolean; data: RegistroItem[] }>('/api/registros/mis-registros'),
          authFetchJSON<{ success: boolean; data: RegistroVehiculo[] }>('/api/vehiculo/mis-registros')
        ]);

        if (registrosResponse.success && registrosResponse.data) {
          setRegistros(registrosResponse.data);
        } else {
          setRegistros([]);
        }

        if (vehiculoResponse.success && vehiculoResponse.data) {
          setRegistrosVehiculo(vehiculoResponse.data);
        } else {
          setRegistrosVehiculo([]);
        }
      } catch (err: any) {
        console.error('Error fetching registros:', err);
        setError(err.message || 'Error al cargar los registros');
        setRegistros([]);
        setRegistrosVehiculo([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRegistros();
  }, []);

  // Re-fetch cuando se refresque desde el padre
  useEffect(() => {
    const refetchRegistros = async () => {
      try {
        const [registrosResponse, vehiculoResponse] = await Promise.all([
          authFetchJSON<{ success: boolean; data: RegistroItem[] }>('/api/registros/mis-registros'),
          authFetchJSON<{ success: boolean; data: RegistroVehiculo[] }>('/api/vehiculo/mis-registros')
        ]);

        if (registrosResponse.success && registrosResponse.data) {
          setRegistros(registrosResponse.data);
        }

        if (vehiculoResponse.success && vehiculoResponse.data) {
          setRegistrosVehiculo(vehiculoResponse.data);
        }
      } catch (err) {
        console.error('Error refetching registros:', err);
      }
    };

    // Solo re-fetch si no estamos en el mount inicial
    if (!loading) {
      refetchRegistros();
    }
  }, [data.registros, data.registrosVehiculo]); // Watch both

  // Buscar el colaborador SOLO para mostrar la tarifa en el badge (no bloquea el render).
  // El servidor ya filtra los registros por el colaboradorId del JWT, así que la
  // identidad del usuario viene de `currentUser` (nombre / rol) y este lookup es opcional.
  const currentUserColaborador = useMemo(() => {
    return data.colaboradores.find(
      col => {
        if (!col?.nombre || !currentUser?.nombre) return false;
        const colName = col.nombre.toLowerCase();
        const userName = currentUser.nombre.toLowerCase();
        return colName.includes(userName) || userName.includes(colName);
      }
    );
  }, [data.colaboradores, currentUser.nombre]);

  // Usar los registros del servidor (ya filtrados)
  const misRegistros = registros;
  const misRegistrosVehiculo = registrosVehiculo;

  // Combinar ambos tipos de registros y agrupar por fecha (más recientes primero)
  const registrosPorFecha = useMemo(() => {
    const grupos = new Map<string, { regular: RegistroItem[]; vehiculo: RegistroVehiculo[] }>();

    // Agregar registros regulares
    misRegistros.forEach(registro => {
      const fecha = registro.fecha;
      if (!grupos.has(fecha)) {
        grupos.set(fecha, { regular: [], vehiculo: [] });
      }
      grupos.get(fecha)!.regular.push(registro);
    });

    // Agregar registros de vehículo
    misRegistrosVehiculo.forEach(registro => {
      const fecha = registro.fecha;
      if (!grupos.has(fecha)) {
        grupos.set(fecha, { regular: [], vehiculo: [] });
      }
      grupos.get(fecha)!.vehiculo.push(registro);
    });

    // Ordenar fechas descendente
    return Array.from(grupos.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [misRegistros, misRegistrosVehiculo]);

  // Total acumulado (incluye vehículos)
  const totalAcumulado = useMemo(() => {
    const totalRegular = misRegistros.reduce((acc, r) => acc + r.total, 0);
    const totalVehiculo = misRegistrosVehiculo.reduce((acc, r) => acc + r.total, 0);
    return totalRegular + totalVehiculo;
  }, [misRegistros, misRegistrosVehiculo]);

  // Registro siendo editado
  const editingRegistro = useMemo(() => {
    return misRegistros.find(r => r.id === editingId) || null;
  }, [misRegistros, editingId]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Mis Registros
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Cargando registros...
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-12 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 mx-auto mb-4"
          >
            <Clock className="w-12 h-12 text-blue-400" />
          </motion.div>
          <p className="text-slate-400 text-sm">Cargando tus registros...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Mis Registros
            </h1>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error al cargar registros</h2>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Mis Registros
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualizá y editá tus registros de mano de obra
          </p>
        </div>

        {/* Stats Badge */}
        <div className="glass-panel rounded-xl px-6 py-3 flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total Registros</p>
            <p className="text-2xl font-bold text-white">{misRegistros.length + misRegistrosVehiculo.length}</p>
          </div>
          {currentUser?.rol !== 'Operario' && (
            <>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total Acumulado</p>
                <p className="text-xl font-bold text-emerald-400 font-mono">{formatGuaranies(totalAcumulado)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Info Badge */}
      <div className="glass-panel rounded-xl p-4 flex items-center gap-3 border-2 border-blue-500/20">
        <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30">
          <User className="w-5 h-5 text-blue-300" />
        </div>
        <div>
          <p className="text-white font-semibold">{currentUser.nombre}</p>
          <p className="text-xs text-slate-400">
            {currentUser.rol}
            {currentUserColaborador?.tarifaSugerida != null && (
              <> • Tarifa: {formatGuaranies(currentUserColaborador.tarifaSugerida)}/min</>
            )}
          </p>
        </div>
      </div>

      {/* Registros agrupados por fecha */}
      {registrosPorFecha.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No tenés registros todavía</h2>
          <p className="text-slate-400 text-sm">
            Empezá a registrar tu trabajo desde la pestaña "Registro Operativo"
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {registrosPorFecha.map(([fecha, registros]) => {
            const totalRegistros = registros.regular.length + registros.vehiculo.length;
            
            return (
              <div key={fecha}>
                {/* Fecha Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4" />
                    <h2 className="font-semibold text-lg">{formatDate(fecha)}</h2>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                  <span className="text-xs text-slate-500 font-mono">
                    {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Registros Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {/* Regular registros */}
                    {registros.regular.map(registro => (
                      <RegistroCard
                        key={registro.id}
                        registro={registro}
                        onEdit={startEdit}
                        showPrices={currentUser?.rol !== 'Operario'}
                      />
                    ))}
                    
                    {/* Vehicle registros */}
                    {registros.vehiculo.map(registro => (
                      <RegistroVehiculoCard
                        key={registro.id}
                        registro={registro}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <EditModal
        isOpen={isEditing}
        registro={editingRegistro}
        formData={formData}
        isSubmitting={isSubmitting}
        feedback={feedback}
        proyectos={data.proyectos}
        onClose={cancelEdit}
        onUpdateField={updateField}
        onSubmit={submitEdit}
        showPrices={currentUser?.rol !== 'Operario'}
      />
    </div>
  );
}
