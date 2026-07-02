/**
 * Vista de Administración de Registros de Vehículo
 * Muestra todos los viajes con km, combustible, fotos y alertas
 * CRUD: Editar y Eliminar registros (Admin only)
 * Toggle: Listado (CRUD) vs Dashboard (Análisis)
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car,
  MapPin,
  Gauge,
  Fuel,
  Camera,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Filter,
  Eye,
  Edit2,
  Trash2,
  X,
  Save,
  BarChart3,
  List
} from 'lucide-react';
import { DatabaseState, RegistroVehiculo } from '../types';
import { authFetchJSON } from '../authFetch';
import VehiculosAnalysis from './vehiculos/VehiculosAnalysis';

interface Props {
  data: DatabaseState;
  onRefresh: () => Promise<void>;
  initialEditId?: string | null; // ID del registro a editar automáticamente
}

function formatGuaranies(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}

// ─── CUSTOM HOOK: useVehiculoCRUD ──────────────────────────────────────────

interface EditFormData {
  kmInicial: number;
  kmFinal: number;
  costoPorKm: number;
  total: number;
  descripcion: string;
  fecha: string;
  fotoOdometroInicio?: string; // base64 new photo or existing URL
  fotoOdometroFin?: string;
}

function useVehiculoCRUD(onRefresh: () => Promise<void>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const startEdit = useCallback((registro: RegistroVehiculo) => {
    const distancia = registro.kmFinal - registro.kmInicial;
    const costoPorKm = distancia > 0 && registro.total > 0
      ? Math.round(registro.total / distancia)
      : 1400;
    setEditingId(registro.id);
    setFormData({
      kmInicial: registro.kmInicial,
      kmFinal: registro.kmFinal,
      costoPorKm,
      total: registro.total,
      descripcion: registro.descripcion,
      fecha: registro.fecha,
      fotoOdometroInicio: registro.fotoOdometroInicio,
      fotoOdometroFin: registro.fotoOdometroFin,
    });
    setFeedback(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setFormData(null);
    setFeedback(null);
  }, []);

  const updateField = useCallback((field: keyof EditFormData, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  const submitEdit = useCallback(async () => {
    console.log('submitEdit called', { editingId, formData });
    
    if (!editingId || !formData) {
      console.log('submitEdit aborted: missing data', { editingId, formData });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const distancia = formData.kmFinal - formData.kmInicial;
      const total = distancia > 0 ? Math.round(distancia * formData.costoPorKm) : formData.total;

      console.log('Sending PATCH request...');
      await authFetchJSON(`/api/vehiculo/registro/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kmInicial: formData.kmInicial,
          kmFinal: formData.kmFinal,
          total,
          descripcion: formData.descripcion,
          fecha: formData.fecha,
          // Only send foto fields if they are new base64 data — skip existing URLs
          fotoOdometroInicio: formData.fotoOdometroInicio?.startsWith('data:') ? formData.fotoOdometroInicio : undefined,
          fotoOdometroFin: formData.fotoOdometroFin?.startsWith('data:') ? formData.fotoOdometroFin : undefined,
        })
      });

      console.log('PATCH successful');
      
      // Close modal BEFORE refresh to avoid re-render issues
      setEditingId(null);
      setFormData(null);
      setFeedback(null);
      
      console.log('Modal closed, now refreshing...');
      
      // Refresh data after closing
      await onRefresh();
      
      console.log('Refresh complete');

    } catch (error: any) {
      console.error('Error updating registro:', error);
      setFeedback({ 
        type: 'error', 
        message: error.message || 'Error al actualizar el registro' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [editingId, formData, onRefresh]);

  const startDelete = useCallback((id: string) => {
    setDeletingId(id);
    setFeedback(null);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeletingId(null);
    setFeedback(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingId) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await authFetchJSON(`/api/vehiculo/registro/${deletingId}`, {
        method: 'DELETE'
      });

      await onRefresh();
      setDeletingId(null);

    } catch (error: any) {
      console.error('Error deleting registro:', error);
      setFeedback({ 
        type: 'error', 
        message: error.message || 'Error al eliminar el registro' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [deletingId, onRefresh]);

  return {
    editingId,
    deletingId,
    formData,
    isSubmitting,
    feedback,
    startEdit,
    cancelEdit,
    updateField,
    submitEdit,
    startDelete,
    cancelDelete,
    confirmDelete
  };
}

const addCacheBuster = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  // Use a query parameter cache buster
  return `${url}${separator}t=${Date.now()}`;
};

export default function VehiculosAdminView({ data, onRefresh, initialEditId }: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');
  const [filtroAlerta, setFiltroAlerta] = useState<'todos' | 'alertas' | 'ok'>('todos');
  const [fotoModal, setFotoModal] = useState<{ url: string; tipo: string } | null>(null);
  const hasAutoOpenedRef = React.useRef(false); // Use ref instead of state to persist across re-renders
  
  const {
    editingId,
    deletingId,
    formData,
    isSubmitting,
    feedback,
    startEdit,
    cancelEdit,
    updateField,
    submitEdit,
    startDelete,
    cancelDelete,
    confirmDelete
  } = useVehiculoCRUD(onRefresh);
  
  // Debug: Log editingId changes
  React.useEffect(() => {
    console.log('editingId changed:', editingId);
  }, [editingId]);
  
  // Auto-abrir edición si se pasa initialEditId (solo una vez al montar)
  React.useEffect(() => {
    console.log('Auto-open effect triggered', { 
      initialEditId, 
      hasRegistros: !!data.registrosVehiculo, 
      hasAutoOpened: hasAutoOpenedRef.current,
      registrosLength: data.registrosVehiculo?.length 
    });
    
    if (initialEditId && data.registrosVehiculo && !hasAutoOpenedRef.current) {
      const registro = data.registrosVehiculo.find(r => r.id === initialEditId);
      console.log('Found registro:', !!registro);
      if (registro) {
        console.log('AUTO-OPENING MODAL for ID:', initialEditId);
        startEdit(registro);
        setViewMode('list');
        hasAutoOpenedRef.current = true; // Set ref to true
      }
    }
  }, [initialEditId, data.registrosVehiculo, startEdit]);
  
  const registrosVehiculo = (data.registrosVehiculo || []).sort((a, b) => 
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  const registrosFiltrados = registrosVehiculo.filter(r => {
    if (filtroAlerta === 'alertas') return r.alertaDiscrepancia;
    if (filtroAlerta === 'ok') return !r.alertaDiscrepancia;
    return true;
  });

  const totales = {
    viajes: registrosVehiculo.length,
    kmTotal: registrosVehiculo.reduce((acc, r) => acc + r.distanciaOdometro, 0),
    costoTotal: registrosVehiculo.reduce((acc, r) => acc + r.total, 0),
    costoPorKmPromedio: registrosVehiculo.reduce((acc, r) => acc + r.total, 0) /
      (registrosVehiculo.reduce((acc, r) => acc + r.distanciaOdometro, 0) || 1),
    alertas: registrosVehiculo.filter(r => r.alertaDiscrepancia).length
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas y toggle de vista */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Registro de Vehículos</h2>
              <p className="text-sm text-slate-400">Control de viajes, combustible y kilometraje</p>
            </div>
          </div>

          {/* Toggle: Listado vs Dashboard */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              Listado
            </button>
            <button
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
              <Car className="w-4 h-4" />
              <span className="uppercase font-mono">Total Viajes</span>
            </div>
            <div className="text-2xl font-bold text-white">{totales.viajes}</div>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs mb-2">
              <Gauge className="w-4 h-4" />
              <span className="uppercase font-mono">Km Totales</span>
            </div>
            <div className="text-2xl font-bold text-white">{totales.kmTotal.toFixed(1)}</div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs mb-2">
              <Fuel className="w-4 h-4" />
              <span className="uppercase font-mono">Costo/km Promedio</span>
            </div>
            <div className="text-2xl font-bold text-white">{formatGuaranies(totales.costoPorKmPromedio)}<span className="text-lg text-slate-400">/km</span></div>
          </div>

          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-violet-400 text-xs mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="uppercase font-mono">Costo Total</span>
            </div>
            <div className="text-xl font-bold text-white">{formatGuaranies(totales.costoTotal)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 flex items-center gap-3">
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtrar:
          </span>
          <div className="flex gap-2">
            {(['todos', 'alertas', 'ok'] as const).map(filtro => (
              <button
                key={filtro}
                onClick={() => setFiltroAlerta(filtro)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  filtroAlerta === filtro
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {filtro === 'todos' && `Todos (${totales.viajes})`}
                {filtro === 'alertas' && `Con Alertas (${totales.alertas})`}
                {filtro === 'ok' && `Sin Alertas (${totales.viajes - totales.alertas})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de viajes o Dashboard según el modo */}
      {viewMode === 'dashboard' ? (
        <VehiculosAnalysis data={data} />
      ) : (
        <div className="space-y-4">
          {registrosFiltrados.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <Car className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No hay registros de viajes</p>
            </div>
          ) : (
            registrosFiltrados.map((registro) => (
              <ViajeCard
                key={registro.id}
                registro={registro}
                onVerFoto={(url, tipo) => setFotoModal({ url, tipo })}
                onEdit={startEdit}
                onDelete={startDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de foto */}
      {fotoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-slate-900 rounded-2xl p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4">
              Odómetro {fotoModal.tipo}
            </h3>
            <img
              src={addCacheBuster(fotoModal.url)}
              alt={`Odómetro ${fotoModal.tipo}`}
              className="w-full rounded-lg"
            />
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && formData && (
        <EditModal
          registro={data.registrosVehiculo.find(r => r.id === editingId)!}
          formData={formData}
          isSubmitting={isSubmitting}
          feedback={feedback}
          onClose={cancelEdit}
          onUpdateField={updateField}
          onSubmit={submitEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <DeleteConfirmModal
          registro={data.registrosVehiculo.find(r => r.id === deletingId)!}
          isSubmitting={isSubmitting}
          feedback={feedback}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

interface ViajeCardProps {
  registro: RegistroVehiculo;
  onVerFoto: (url: string, tipo: string) => void;
  onEdit: (registro: RegistroVehiculo) => void;
  onDelete: (id: string) => void;
}

// ─── EDIT MODAL ────────────────────────────────────────────────────────────

function compressImage(base64: string, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

interface EditModalProps {
  registro: RegistroVehiculo;
  formData: EditFormData;
  isSubmitting: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  onClose: () => void;
  onUpdateField: (field: keyof EditFormData, value: any) => void;
  onSubmit: () => Promise<void>;
}

function EditModal({
  registro,
  formData,
  isSubmitting,
  feedback,
  onClose,
  onUpdateField,
  onSubmit
}: EditModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                <h2 className="text-xl font-bold text-white">Editar Registro de Vehículo</h2>
                <p className="text-xs text-slate-400 font-mono">{registro.proyectoNombre}</p>
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

          {/* Form */}
          <div className="space-y-4">
            {/* Fecha */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                Fecha
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => onUpdateField('fecha', e.target.value)}
                disabled={isSubmitting}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            {/* Kilometraje */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                  Km Inicial
                </label>
                <input
                  type="number"
                  value={formData.kmInicial}
                  onChange={(e) => onUpdateField('kmInicial', parseFloat(e.target.value))}
                  disabled={isSubmitting}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                  Km Final
                </label>
                <input
                  type="number"
                  value={formData.kmFinal}
                  onChange={(e) => onUpdateField('kmFinal', parseFloat(e.target.value))}
                  disabled={isSubmitting}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* Costo por Km */}
            <div className="mb-4">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                Costo por Km (Gs.)
              </label>
              <input
                type="number"
                step="100"
                value={formData.costoPorKm}
                onChange={(e) => onUpdateField('costoPorKm', parseFloat(e.target.value) || 0)}
                disabled={isSubmitting}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm"
              />
              {(() => {
                const dist = formData.kmFinal - formData.kmInicial;
                const total = dist > 0 ? Math.round(dist * formData.costoPorKm) : formData.total;
                return dist > 0 ? (
                  <p className="text-xs text-emerald-400 mt-1">
                    {dist.toFixed(1)} km × Gs. {formData.costoPorKm.toLocaleString()} ={' '}
                    <strong>Gs. {total.toLocaleString()}</strong>
                  </p>
                ) : null;
              })()}
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => onUpdateField('descripcion', e.target.value)}
                disabled={isSubmitting}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm min-h-[100px] resize-none"
                placeholder="Descripción del viaje..."
              />
            </div>

            {/* Fotos del Odómetro */}
            <div className="grid grid-cols-2 gap-4">
              {(['fotoOdometroInicio', 'fotoOdometroFin'] as const).map((field) => {
                const label = field === 'fotoOdometroInicio' ? 'Foto Inicio' : 'Foto Fin';
                const current = formData[field];
                return (
                  <div key={field}>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                      {label}
                    </label>
                    {current && (
                      <img
                        src={addCacheBuster(current)}
                        alt={label}
                        className="w-full h-24 object-cover rounded-lg mb-2 border border-white/10"
                      />
                    )}
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-400 transition">
                      <Camera className="w-4 h-4" />
                      <span>Cambiar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isSubmitting}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            const raw = ev.target?.result as string;
                            const compressed = await compressImage(raw);
                            onUpdateField(field, compressed);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Feedback */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">{feedback.message}</span>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  console.log('Guardar clicked'); // Debug log
                  onSubmit().catch(err => console.error('Submit error:', err));
                }}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-6 py-3 text-slate-400 hover:text-white hover:bg-white/10 font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── DELETE CONFIRM MODAL ──────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  registro: RegistroVehiculo;
  isSubmitting: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteConfirmModal({
  registro,
  isSubmitting,
  feedback,
  onClose,
  onConfirm
}: DeleteConfirmModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div 
          className="glass-panel rounded-3xl p-6 max-w-md w-full pointer-events-auto border-2 border-rose-500/30 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Confirmar Eliminación</h2>
              <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-6">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-slate-400 mb-1">Proyecto:</p>
              <p className="text-white font-semibold">{registro.proyectoNombre}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-slate-400 mb-1">Distancia:</p>
              <p className="text-white font-semibold">{registro.distanciaOdometro} km</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-slate-400 mb-1">Fecha:</p>
              <p className="text-white font-semibold">{formatDate(registro.fecha)}</p>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 text-rose-300 mb-4"
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">{feedback.message}</span>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-slate-400 hover:text-white hover:bg-white/10 font-semibold rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── VIAJE CARD ─────────────────────────────────────────────────────────────

function ViajeCard({ registro, onVerFoto, onEdit, onDelete }: ViajeCardProps) {
  const [expandido, setExpandido] = useState(false);
  const esParticular = registro.clienteNombre === 'Viaje Particular';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-2xl p-6 border-2 transition ${
        registro.alertaDiscrepancia
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              esParticular 
                ? 'bg-purple-500/10 border border-purple-500/20'
                : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              <Car className={`w-5 h-5 ${esParticular ? 'text-purple-400' : 'text-blue-400'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">
                {esParticular ? '🏠 Viaje Particular' : registro.proyectoNombre}
              </h3>
              <p className="text-sm text-slate-400">
                {!esParticular && `${registro.clienteNombre} • `}
                {formatDate(registro.fecha)}
              </p>
            </div>
            
            {/* Edit/Delete Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(registro)}
                className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 transition"
                title="Editar registro"
                aria-label={`Editar viaje ${esParticular ? 'particular' : registro.proyectoNombre} del ${formatDate(registro.fecha)}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(registro.id)}
                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition"
                title="Eliminar registro"
                aria-label={`Eliminar viaje ${esParticular ? 'particular' : registro.proyectoNombre} del ${formatDate(registro.fecha)}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alerta de discrepancia */}
          {registro.alertaDiscrepancia && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300">Discrepancia Detectada</p>
                <p className="text-[10px] text-amber-400/80">
                  {registro.discrepancia?.toFixed(1)}% diferencia entre GPS y odómetro
                </p>
              </div>
            </div>
          )}

          {/* Descripción */}
          {registro.descripcion && (
            <p className="text-sm text-slate-300 leading-relaxed">{registro.descripcion}</p>
          )}

          {/* Stats grid */}
          <div className="flex items-center gap-2 text-xs mt-3">
            <span className="px-2 py-1 bg-slate-800 rounded-lg font-mono text-slate-400">
              {formatDate(registro.fecha)}
            </span>
            <span className="px-2 py-1 bg-slate-800 rounded-lg font-mono text-slate-400">
              {registro.duracionMinutos} min
            </span>
          </div>
        </div>

        {/* Botón expandir */}
        <button
          onClick={() => setExpandido(!expandido)}
          className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-400 transition ml-4"
          aria-label={expandido ? 'Ocultar detalles del viaje' : 'Ver detalles del viaje'}
          aria-expanded={expandido}
        >
          {expandido ? 'Ocultar Detalles' : 'Ver Detalles'}
        </button>
      </div>

      {/* Detalles expandidos */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-white/10 space-y-4">
              {/* Ubicaciones GPS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase font-mono">Ubicación Inicio</span>
                  </div>
                  {registro.ubicacionInicio?.lat != null ? (
                    <>
                      <p className="text-xs text-slate-300 font-mono">
                        {registro.ubicacionInicio.lat.toFixed(6)}, {registro.ubicacionInicio.lng.toFixed(6)}
                      </p>
                      {registro.ubicacionInicio.nombre && (
                        <p className="text-[10px] text-slate-400 mt-1">{registro.ubicacionInicio.nombre}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Sin coordenadas GPS</p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">{registro.horaInicio}</p>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase font-mono">Ubicación Fin</span>
                  </div>
                  {registro.ubicacionFin?.lat != null ? (
                    <>
                      <p className="text-xs text-slate-300 font-mono">
                        {registro.ubicacionFin.lat.toFixed(6)}, {registro.ubicacionFin.lng.toFixed(6)}
                      </p>
                      {registro.ubicacionFin.nombre && (
                        <p className="text-[10px] text-slate-400 mt-1">{registro.ubicacionFin.nombre}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Sin coordenadas GPS</p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">{registro.horaFin}</p>
                </div>
              </div>

              {/* Distancias y Combustible */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-mono">GPS</span>
                  </div>
                  <p className="text-lg font-bold text-white">{registro.distanciaGPS != null ? registro.distanciaGPS.toFixed(1) : '-'} km</p>
                </div>

                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-mono">Odómetro</span>
                  </div>
                  <p className="text-lg font-bold text-white">{registro.distanciaOdometro != null ? registro.distanciaOdometro.toFixed(1) : '-'} km</p>
                </div>

                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                    <Fuel className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-mono">Costo/km</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {registro.total && registro.distanciaOdometro > 0
                      ? `${formatGuaranies(registro.total / registro.distanciaOdometro)}`
                      : formatGuaranies(registro.total)}
                  </p>
                </div>

                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 text-violet-400 mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-mono">Costo</span>
                  </div>
                  <p className="text-sm font-bold text-white">{formatGuaranies(registro.total)}</p>
                </div>
              </div>

              {/* Costo */}
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-bold text-violet-300">
                    Costo total: {formatGuaranies(registro.total)}
                    {registro.distanciaOdometro > 0 && (
                      <> — {formatGuaranies(Math.round(registro.total / registro.distanciaOdometro))}/km</>
                    )}
                  </span>
                </div>
              </div>

              {/* Fotos del Odómetro */}
              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-3">
                  <Camera className="w-4 h-4" />
                  <span className="text-sm font-bold">Fotos del Odómetro</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => onVerFoto(registro.fotoOdometroInicio, 'Inicio')}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition"
                  >
                    <img
                      src={addCacheBuster(registro.fotoOdometroInicio)}
                      alt="Odómetro Inicio"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white font-bold">Inicio: {registro.kmInicial} km</p>
                    </div>
                  </button>

                  <button
                    onClick={() => onVerFoto(registro.fotoOdometroFin, 'Fin')}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-emerald-500/50 transition"
                  >
                    <img
                      src={addCacheBuster(registro.fotoOdometroFin)}
                      alt="Odómetro Fin"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white font-bold">Fin: {registro.kmFinal} km</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Kilometraje detallado */}
              <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mb-1">Km Inicial</p>
                    <p className="text-xl font-bold text-white">{registro.kmInicial}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mb-1">Km Final</p>
                    <p className="text-xl font-bold text-white">{registro.kmFinal}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mb-1">Recorrido</p>
                    <p className="text-xl font-bold text-emerald-400">{registro.distanciaOdometro} km</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
