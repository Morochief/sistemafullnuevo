import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Route, Plus, Trash2, X, Users, MessageSquare, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';
import Pagination from './Pagination.tsx';
import { useSortAndPaginate, getSortIcon, sortableHeaderClass } from '../lib/tableUtils.ts';
import { useNotif } from '../context/NotifContext.tsx';

interface HojaRutaTarea {
  id: string;
  hojaRutaId: string;
  colaboradorId: string | null;
  operarioNombre: string;
  orden: number;
  descripcion: string;
  categoria: string;
  cantidad: number | null;
  unidad: string | null;
  estado: string;
  tiempoEstimado?: string | null;
  fechaAsignada: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  notasOperario: string | null;
  fotoUrl: string | null;
  colaborador?: { id: string; nombre: string; rol: string | null } | null;
}

interface HojaRuta {
  id: string;
  ordenTrabajoId: string;
  clienteId: string;
  clienteNombre: string;
  proyecto: string;
  fecha: string;
  estado: string;
  notas: string | null;
  enviadoWhatsapp: boolean;
  fechaEnvioWsp: string | null;
  createdAt: string;
  ordenTrabajo?: { id: string; estado: string };
  tareas?: HojaRutaTarea[];
  _count?: { tareas: number };
}

interface OrdenTrabajoOption {
  id: string;
  clienteNombre: string;
  proyecto: string;
  estado: string;
}

const ESTADOS_HOJA = ['Borrador', 'Activa', 'Cerrada'];
const ESTADOS_TAREA = ['Pendiente', 'EnProgreso', 'Completada', 'Omitida'];

const badgeEstadoHoja: Record<string, string> = {
  Borrador: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Activa: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Cerrada: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const badgeEstadoTarea: Record<string, string> = {
  Pendiente: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  EnProgreso: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Completada: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Omitida: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function calcularPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function HojasRutaAdmin() {
  const { showToast, requestConfirm } = useNotif();
  const [hojas, setHojas] = useState<HojaRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageNumbers = calcularPageNumbers(page, totalPages);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');
  const [selectedHoja, setSelectedHoja] = useState<HojaRuta | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [otsDisponibles, setOtsDisponibles] = useState<OrdenTrabajoOption[]>([]);
  const [otSeleccionada, setOtSeleccionada] = useState('');
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [colaboradores, setColaboradores] = useState<{ id: string; nombre: string; rol?: string }[]>([]);

  const fetchHojas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroSearch) params.set('search', filtroSearch);
      const res = await authFetchJSON(`/api/admin/hojas-ruta?${params}`);
      if (res.success) {
        setHojas(res.data || []);
        setTotal(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        setError('Error al cargar hojas de ruta');
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filtroEstado, filtroSearch]);

  async function fetchOTs() {
    try {
      const res = await authFetchJSON('/api/admin/presupuestos/ordenes-trabajo');
      if (res.success) {
        // Solo mostrar OTs que no tengan ya una hoja de ruta (la API valida después)
        setOtsDisponibles(res.data || []);
      }
    } catch {}
  }

  async function fetchColaboradores() {
    try {
      const res = await authFetchJSON('/api/data');
      if (res.success && res.data?.colaboradores) {
        setColaboradores(res.data.colaboradores.map((c: any) => ({ id: c.id, nombre: c.nombre, rol: c.rol })));
      }
    } catch {}
  }

  useEffect(() => { fetchHojas(); }, [fetchHojas]);
  useEffect(() => { fetchOTs(); fetchColaboradores(); }, []);

  async function fetchHojaDetalle(id: string) {
    try {
      const res = await authFetchJSON(`/api/admin/hojas-ruta/${id}`);
      if (res.success) setSelectedHoja(res.data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar detalle');
    }
  }

  async function crearHoja() {
    if (!otSeleccionada) { setError('Seleccioná una OT'); return; }
    try {
      const res = await authFetchJSON('/api/admin/hojas-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenTrabajoId: otSeleccionada }),
      });
      if (res.success) {
        setShowCreateModal(false);
        setOtSeleccionada('');
        await fetchHojas();
        setSelectedHoja(res.data);
      } else {
        setError(res.error?.message || 'Error al crear hoja');
      }
    } catch (e: any) {
      setError(e.message || 'Error al crear hoja');
    }
  }

  async function guardarHoja(hoja: HojaRuta) {
    try {
      const res = await authFetchJSON(`/api/admin/hojas-ruta/${hoja.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: hoja.estado,
          notas: hoja.notas,
          tareas: (hoja.tareas || []).map(t => ({
            id: t.id,
            colaboradorId: t.colaboradorId,
            operarioNombre: t.operarioNombre,
            descripcion: t.descripcion,
            categoria: t.categoria,
            cantidad: t.cantidad,
            unidad: t.unidad,
            estado: t.estado,
            tiempoEstimado: t.tiempoEstimado,
            notasOperario: t.notasOperario,
          })),
        }),
      });
      if (res.success) {
        setSelectedHoja(res.data);
        showToast('Cambios y asignaciones guardados correctamente', 'success');
        await fetchHojas();
      } else {
        showToast(res.error?.message || 'Error al guardar', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error al guardar', 'error');
    }
  }

  async function eliminarHoja(id: string) {
    requestConfirm(
      'Eliminar Hoja de Ruta',
      '¿Estás seguro de que deseas eliminar esta hoja de ruta y todas sus tareas asignadas?',
      'danger',
      async () => {
        try {
          await authFetchJSON(`/api/admin/hojas-ruta/${id}`, { method: 'DELETE' });
          setSelectedHoja(null);
          showToast('Hoja de ruta eliminada', 'success');
          await fetchHojas();
        } catch (e: any) {
          showToast(e.message || 'Error al eliminar', 'error');
        }
      },
      'Eliminar Hoja'
    );
  }

  async function cambiarEstadoRapido(hoja: HojaRuta, nuevoEstado: string) {
    try {
      const res = await authFetchJSON(`/api/admin/hojas-ruta/${hoja.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.success) {
        if (selectedHoja?.id === hoja.id) {
          setSelectedHoja(res.data);
        }
        await fetchHojas();
      }
    } catch (e: any) {
      setError(e.message || 'Error al cambiar estado');
    }
  }

  async function generarWhatsapp(hojaId: string, telefono?: string) {
    try {
      const res = await authFetchJSON(`/api/admin/hojas-ruta/${hojaId}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefono || undefined }),
      });
      if (res.success) {
        setWhatsappMsg(res.data.mensaje);
        setWhatsappUrl(res.data.whatsappUrl);
        setShowWhatsappModal(true);
        if (selectedHoja?.id === hojaId) {
          setSelectedHoja({ ...selectedHoja, enviadoWhatsapp: true, estado: selectedHoja.estado === 'Borrador' ? 'Activa' : selectedHoja.estado });
        }
        await fetchHojas();
      }
    } catch (e: any) {
      setError(e.message || 'Error al generar WhatsApp');
    }
  }

  function updateTareaCampos(tareaId: string, updates: Partial<HojaRutaTarea>) {
    if (!selectedHoja) return;
    const tareas = (selectedHoja.tareas || []).map(t =>
      t.id === tareaId ? { ...t, ...updates } : t
    );
    setSelectedHoja({ ...selectedHoja, tareas });
  }

  function updateTarea(hojaId: string, tareaId: string, campo: string, valor: any) {
    updateTareaCampos(tareaId, { [campo]: valor });
  }

  function agregarTarea() {
    if (!selectedHoja) return;
    const nuevaTarea: HojaRutaTarea = {
      id: crypto.randomUUID(),
      hojaRutaId: selectedHoja.id,
      colaboradorId: null,
      operarioNombre: 'Sin asignar',
      orden: (selectedHoja.tareas || []).length,
      descripcion: '',
      categoria: 'Montaje',
      cantidad: 1,
      unidad: 'u',
      estado: 'Pendiente',
      tiempoEstimado: '',
      fechaAsignada: new Date().toISOString(),
      fechaInicio: null,
      fechaFin: null,
      notasOperario: null,
      fotoUrl: null,
    };
    setSelectedHoja({ ...selectedHoja, tareas: [...(selectedHoja.tareas || []), nuevaTarea] });
  }

  function eliminarTarea(tareaId: string) {
    if (!selectedHoja) return;
    const tareas = (selectedHoja.tareas || []).filter(t => t.id !== tareaId);
    setSelectedHoja({ ...selectedHoja, tareas });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Hojas de Ruta</h3>
          <span className="text-[10px] text-slate-500">({total})</span>
        </div>
        <motion.button
          onClick={() => { setShowCreateModal(true); fetchOTs(); }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Generar desde OT
        </motion.button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
          className="bg-[#090a0f] border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_HOJA.map(e => <option key={e} value={e} className="bg-[#111318]">{e}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar por cliente o proyecto..."
          value={filtroSearch}
          onChange={e => { setFiltroSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] bg-[#090a0f] border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
        />
        <motion.button
          onClick={fetchHojas}
          whileTap={{ scale: 0.95 }}
          className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
        >
          Filtrar
        </motion.button>
      </div>

      {/* Lista de hojas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        </div>
      ) : hojas.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs">
          <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No hay hojas de ruta. Generá una desde una Orden de Trabajo.
        </div>
      ) : (
        <div className="space-y-2.5">
          {hojas.map(h => (
            <div
              key={h.id}
              className="bg-[#111318]/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-orange-500/40 shadow-sm transition-all cursor-pointer"
              onClick={() => fetchHojaDetalle(h.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-white text-xs">{h.clienteNombre}</span>
                    <span className="text-[11px] text-slate-400 font-medium">— {h.proyecto}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeEstadoHoja[h.estado] || badgeEstadoHoja['Borrador']}`}>
                      {h.estado}
                    </span>
                    {h.enviadoWhatsapp && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <Send className="w-2.5 h-2.5" />
                        Enviado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3.5 text-[11px] text-slate-400 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatFecha(h.fecha)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Users className="w-3 h-3 text-slate-500" />
                      {h._count?.tareas || h.tareas?.length || 0} tareas
                    </span>
                    {h.ordenTrabajo && (
                      <span className="text-slate-500 font-mono text-[10px] bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                        OT: {h.ordenTrabajo.estado}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {h.estado === 'Borrador' && (
                    <button
                      onClick={() => cambiarEstadoRapido(h, 'Activa')}
                      title="Activar hoja de ruta"
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-md cursor-pointer transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Activar
                    </button>
                  )}
                  {h.estado === 'Activa' && (
                    <button
                      onClick={() => cambiarEstadoRapido(h, 'Cerrada')}
                      title="Cerrar hoja de ruta"
                      className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold rounded-md cursor-pointer transition shadow-sm"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          onPageChange={setPage}
          itemsPerPage={limit}
          onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
          totalItems={total}
        />
      )}

      {/* Modal de detalle/edición */}
      <AnimatePresence>
        {selectedHoja && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedHoja(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111318] border border-white/10 rounded-md shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header del modal */}
              <div className="sticky top-0 bg-[#111318] border-b border-white/10 px-5 py-3 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedHoja.clienteNombre}</h3>
                  <p className="text-[10px] text-slate-400">{selectedHoja.proyecto}</p>
                </div>
                <button onClick={() => setSelectedHoja(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Estado y notas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Estado</label>
                    <select
                      value={selectedHoja.estado}
                      onChange={e => setSelectedHoja({ ...selectedHoja, estado: e.target.value })}
                      className="w-full mt-1 bg-[#090a0f] border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition"
                    >
                      {ESTADOS_HOJA.map(e => <option key={e} value={e} className="bg-[#111318]">{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Fecha</label>
                    <div className="mt-1 text-xs text-slate-300 py-2">{formatFecha(selectedHoja.fecha)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Notas</label>
                  <textarea
                    value={selectedHoja.notas || ''}
                    onChange={e => setSelectedHoja({ ...selectedHoja, notas: e.target.value })}
                    rows={2}
                    className="w-full mt-1 bg-[#090a0f] border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition"
                  />
                </div>

                {/* Tareas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Tareas ({selectedHoja.tareas?.length || 0})</label>
                    <button
                      type="button"
                      onClick={agregarTarea}
                      className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-semibold px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Tarea
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(selectedHoja.tareas || []).map((t, i) => (
                      <div key={t.id} className="bg-[#090a0f] border border-white/10 rounded-md p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-slate-500 font-mono mt-1.5">{i + 1}.</span>
                          <textarea
                            value={t.descripcion}
                            onChange={e => updateTarea(selectedHoja.id, t.id, 'descripcion', e.target.value)}
                            placeholder="Descripción de la tarea (admite saltos de línea con Enter)"
                            rows={Math.min(6, Math.max(2, (t.descripcion || '').split('\n').length))}
                            className="flex-1 bg-[#111318] border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition resize-y font-sans leading-relaxed"
                          />
                          <select
                            value={t.estado}
                            onChange={e => updateTarea(selectedHoja.id, t.id, 'estado', e.target.value)}
                            className="bg-[#111318] border border-white/10 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            {ESTADOS_TAREA.map(e => <option key={e} value={e} className="bg-[#111318]">{e}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => eliminarTarea(t.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pl-5">
                          <select
                            value={t.colaboradorId || ''}
                            onChange={e => {
                              const colab = colaboradores.find(c => c.id === e.target.value);
                              updateTareaCampos(t.id, {
                                colaboradorId: e.target.value || null,
                                operarioNombre: colab?.nombre || 'Sin asignar',
                              });
                            }}
                            className="bg-[#111318] border border-white/10 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none flex-1 min-w-[120px]"
                          >
                            <option value="" className="bg-[#111318]">Sin asignar</option>
                            {colaboradores.map(c => (
                              <option key={c.id} value={c.id} className="bg-[#111318]">{c.nombre}</option>
                            ))}
                          </select>
                          <select
                            value={t.categoria}
                            onChange={e => updateTarea(selectedHoja.id, t.id, 'categoria', e.target.value)}
                            className="bg-[#111318] border border-white/10 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            <option value="Montaje" className="bg-[#111318]">Montaje</option>
                            <option value="Instalación" className="bg-[#111318]">Instalación</option>
                            <option value="Logística" className="bg-[#111318]">Logística</option>
                            <option value="Diseño" className="bg-[#111318]">Diseño</option>
                            <option value="Otro" className="bg-[#111318]">Otro</option>
                          </select>
                          <div className="flex items-center gap-1 bg-[#111318] border border-white/10 rounded-md px-2 py-0.5">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <input
                              type="text"
                              value={t.tiempoEstimado || ''}
                              onChange={e => updateTarea(selectedHoja.id, t.id, 'tiempoEstimado', e.target.value)}
                              placeholder="Tiempo est. (ej: 2h)"
                              className="bg-transparent text-[10px] text-white w-24 focus:outline-none"
                            />
                          </div>
                          {t.notasOperario && (
                            <span className="text-[9px] text-slate-500 italic truncate max-w-[150px]" title={t.notasOperario}>
                              "{t.notasOperario}"
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5 flex-wrap">
                  <button
                    onClick={() => guardarHoja(selectedHoja)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                  >
                    Guardar cambios
                  </button>
                  {selectedHoja.estado === 'Borrador' && (
                    <button
                      onClick={() => {
                        const updated = { ...selectedHoja, estado: 'Activa' };
                        setSelectedHoja(updated);
                        guardarHoja(updated);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Activar Hoja
                    </button>
                  )}
                  {selectedHoja.estado === 'Activa' && (
                    <button
                      onClick={() => {
                        const updated = { ...selectedHoja, estado: 'Cerrada' };
                        setSelectedHoja(updated);
                        guardarHoja(updated);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-md cursor-pointer transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Cerrar Hoja
                    </button>
                  )}
                  <button
                    onClick={() => generarWhatsapp(selectedHoja.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700/80 hover:bg-emerald-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => eliminarHoja(selectedHoja.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-md cursor-pointer transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de creación desde OT */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111318] border border-orange-500/30 rounded-md shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Route className="w-4 h-4 text-orange-400" />
                  Nueva Hoja de Ruta
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-slate-400">
                  Seleccioná una Orden de Trabajo para generar la hoja de ruta con sus tareas precargadas:
                </p>
                {otsDisponibles.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 bg-[#090a0f] rounded-md border border-white/5">
                    No hay OTs pendientes de hoja de ruta.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {otsDisponibles.map(ot => (
                      <button
                        key={ot.id}
                        onClick={() => setOtSeleccionada(ot.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors cursor-pointer border ${
                          otSeleccionada === ot.id
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                            : 'bg-[#090a0f] border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-semibold">{ot.clienteNombre}</div>
                        <div className="text-[10px] text-slate-500">{ot.proyecto}</div>
                        <div className="text-[9px] text-slate-600">Estado: {ot.estado}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={crearHoja}
                    disabled={!otSeleccionada}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generar Hoja
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold rounded-md cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de WhatsApp */}
      <AnimatePresence>
        {showWhatsappModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWhatsappModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111318] border border-emerald-500/30 rounded-md shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Mensaje de WhatsApp
                </h3>
                <button onClick={() => setShowWhatsappModal(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <pre className="bg-[#090a0f] border border-white/10 rounded-md p-3 text-[11px] text-slate-300 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                  {whatsappMsg}
                </pre>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Abrir WhatsApp
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
