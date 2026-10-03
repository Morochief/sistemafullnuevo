import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  MessageSquare, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Clock, 
  Calendar,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';
import { OrdenTrabajo } from '../types.ts';
import Pagination from './Pagination.tsx';
import { useSortAndPaginate, getSortIcon, sortableHeaderClass } from '../lib/tableUtils.ts';
import { useNotif } from '../context/NotifContext.tsx';

const ESTADOS_OT = ['Generada', 'Enviada', 'En Proceso', 'Completada', 'Cancelada'];

const badgeEstadoOT: Record<string, string> = {
  Generada: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  Enviada: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'En Proceso': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Completada: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Cancelada: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function OrdenesTrabajoAdmin() {
  const { showToast, requestConfirm } = useNotif();
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');

  // Edición y Detalle
  const [otEditando, setOtEditando] = useState<OrdenTrabajo | null>(null);
  const [otForm, setOtForm] = useState({
    detallesTrabajo: '',
    comentarioCliente: '',
    contacto: '',
    fechaInicio: '',
    fechaTope: '',
    estado: 'Generada',
  });
  const [saving, setSaving] = useState(false);

  // Modal WhatsApp
  const [whatsappModal, setWhatsappModal] = useState<{
    otId: string;
    telefono: string;
    mensaje: string;
    whatsappUrl: string;
    enviado: boolean;
  } | null>(null);

  // Modal Nueva OT Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [clientesList, setClientesList] = useState<{ id: string; nombre: string }[]>([]);
  const [manualForm, setManualForm] = useState({
    clienteId: '',
    proyecto: '',
    contacto: '',
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaTope: '',
    detallesTrabajo: '',
    comentarioCliente: '',
    telefono: '',
  });
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    authFetchJSON<{ success: boolean; data: any[] }>('/api/clientes')
      .then(res => {
        if (res.success && res.data) setClientesList(res.data);
      })
      .catch(() => {});
  }, []);

  const handleCrearOTManual = async () => {
    if (!manualForm.clienteId || !manualForm.proyecto.trim() || !manualForm.detallesTrabajo.trim()) {
      showToast('Completá Cliente, Proyecto y Detalles del trabajo', 'error');
      return;
    }
    setManualSaving(true);
    try {
      const res = await authFetchJSON<{ success: boolean; data: any; error?: any }>(
        '/api/admin/ordenes-trabajo/manual',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manualForm),
        }
      );
      if (res.success) {
        showToast('Orden de Trabajo manual creada con éxito', 'success');
        setShowManualModal(false);
        setManualForm({
          clienteId: '',
          proyecto: '',
          contacto: '',
          fechaInicio: new Date().toISOString().slice(0, 10),
          fechaTope: '',
          detallesTrabajo: '',
          comentarioCliente: '',
          telefono: '',
        });
        await loadOrdenesTrabajo();
      } else {
        showToast(res.error?.message || 'Error al crear Orden de Trabajo', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error al conectar con el servidor', 'error');
    } finally {
      setManualSaving(false);
    }
  };

  const loadOrdenesTrabajo = useCallback(async () => {
    setLoading(true);
    try {
      const json = await authFetchJSON<{ success: boolean; data: OrdenTrabajo[] }>(
        '/api/admin/presupuestos/ordenes-trabajo'
      );
      setOrdenes(json.data || []);
    } catch (e: any) {
      showToast(e.message || 'Error al cargar órdenes de trabajo', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrdenesTrabajo();
  }, [loadOrdenesTrabajo]);

  // Filtrado
  const ordenesFiltradas = ordenes.filter((ot) => {
    if (filtroEstado && ot.estado !== filtroEstado) return false;
    if (filtroSearch.trim()) {
      const q = filtroSearch.toLowerCase();
      const matchCli = ot.clienteNombre?.toLowerCase().includes(q);
      const matchProy = ot.proyecto?.toLowerCase().includes(q);
      const matchDet = ot.detallesTrabajo?.toLowerCase().includes(q);
      return matchCli || matchProy || matchDet;
    }
    return true;
  });

  type OtSortField = 'createdAt' | 'clienteNombre' | 'estado';
  const table = useSortAndPaginate<OrdenTrabajo, OtSortField>(ordenesFiltradas, {
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc',
    defaultItemsPerPage: 15,
  });

  const handleAbrirEditar = (ot: OrdenTrabajo) => {
    setOtEditando(ot);
    setOtForm({
      detallesTrabajo: ot.detallesTrabajo || '',
      comentarioCliente: ot.comentarioCliente || '',
      contacto: ot.contacto || '',
      fechaInicio: ot.fechaInicio ? ot.fechaInicio.slice(0, 10) : '',
      fechaTope: ot.fechaTope ? ot.fechaTope.slice(0, 10) : '',
      estado: ot.estado || 'Generada',
    });
  };

  const handleGuardarEdicion = async () => {
    if (!otEditando) return;
    setSaving(true);
    try {
      await authFetchJSON(`/api/admin/presupuestos/ordenes-trabajo/${otEditando.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          detallesTrabajo: otForm.detallesTrabajo,
          comentarioCliente: otForm.comentarioCliente,
          contacto: otForm.contacto,
          fechaInicio: otForm.fechaInicio || null,
          fechaTope: otForm.fechaTope || null,
          estado: otForm.estado,
        }),
      });
      showToast('Orden de trabajo actualizada correctamente', 'success');
      setOtEditando(null);
      loadOrdenesTrabajo();
    } catch (e: any) {
      showToast(e.message || 'Error al guardar cambios', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = (ot: OrdenTrabajo) => {
    requestConfirm(
      'Eliminar Orden de Trabajo',
      `¿Estás seguro de eliminar la OT de ${ot.clienteNombre} (${ot.proyecto})? Esta acción no se puede deshacer.`,
      'danger',
      async () => {
        try {
          await authFetchJSON(`/api/admin/presupuestos/ordenes-trabajo/${ot.id}`, { method: 'DELETE' });
          showToast('Orden de trabajo eliminada', 'info');
          if (otEditando?.id === ot.id) setOtEditando(null);
          loadOrdenesTrabajo();
        } catch (e: any) {
          showToast(e.message || 'Error al eliminar', 'error');
        }
      },
      'Eliminar Definitivamente'
    );
  };

  const handleAbrirWhatsApp = (ot: OrdenTrabajo) => {
    const textoMensaje = ot.mensajeWhatsapp || `*ORDEN DE TRABAJO*\nCliente: ${ot.clienteNombre}\nProyecto: ${ot.proyecto}\n\nDetalles:\n${ot.detallesTrabajo}`;
    const encMsg = encodeURIComponent(textoMensaje);
    const url = `https://wa.me/?text=${encMsg}`;

    setWhatsappModal({
      otId: ot.id,
      telefono: '',
      mensaje: textoMensaje,
      whatsappUrl: url,
      enviado: ot.enviadoWhatsapp,
    });
  };

  const handleMarcarEnviadaWsp = async (otId: string) => {
    try {
      await authFetchJSON(`/api/admin/presupuestos/ordenes-trabajo/${otId}/marcar-enviado`, { method: 'POST' });
      setWhatsappModal((prev) => (prev ? { ...prev, enviado: true } : null));
      loadOrdenesTrabajo();
      showToast('Marcada como enviada por WhatsApp', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error al marcar estado', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Corporativo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-500" />
            Órdenes de Trabajo (OT)
          </h2>
          <p className="text-xs text-slate-400">
            Control de ejecución, taller, fechas límites y despacho de pedidos aprobados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setManualForm({
                clienteId: '',
                proyecto: '',
                contacto: '',
                fechaInicio: new Date().toISOString().slice(0, 10),
                fechaTope: '',
                detallesTrabajo: '',
                comentarioCliente: '',
                telefono: '',
              });
              setShowManualModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva OT Manual</span>
          </button>

          <button
            onClick={loadOrdenesTrabajo}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-md bg-[#111318] border border-white/10 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, proyecto o detalles..."
            value={filtroSearch}
            onChange={(e) => setFiltroSearch(e.target.value)}
            className="w-full glass-input pl-9 pr-3 py-2 rounded-md text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="glass-select px-3 py-2 rounded-md text-xs"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_OT.map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Órdenes de Trabajo */}
      <div className="rounded-xl border border-white/10 bg-[#111318]/80 backdrop-blur-sm overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1050px] border-collapse">
            <thead className="bg-[#090a0f] text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className={`px-4 py-3.5 whitespace-nowrap ${sortableHeaderClass('createdAt', table.sortField)}`} onClick={() => table.handleSort('createdAt')}>
                  Fecha {getSortIcon('createdAt', table.sortField, table.sortOrder)}
                </th>
                <th className={`px-4 py-3.5 min-w-[180px] ${sortableHeaderClass('clienteNombre', table.sortField)}`} onClick={() => table.handleSort('clienteNombre')}>
                  Cliente {getSortIcon('clienteNombre', table.sortField, table.sortOrder)}
                </th>
                <th className="px-4 py-3.5 min-w-[220px]">Proyecto</th>
                <th className="px-4 py-3.5 whitespace-nowrap w-[150px]">Fechas Trabajo</th>
                <th className={`px-4 py-3.5 whitespace-nowrap ${sortableHeaderClass('estado', table.sortField)}`} onClick={() => table.handleSort('estado')}>
                  Estado {getSortIcon('estado', table.sortField, table.sortOrder)}
                </th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap w-[110px]">WhatsApp</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap w-[180px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-500" />
                    Cargando órdenes de trabajo...
                  </td>
                </tr>
              )}
              {!loading && table.paginatedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-500 font-mono">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    No se encontraron órdenes de trabajo registradas con los filtros actuales.
                  </td>
                </tr>
              )}
              {table.paginatedData.map((ot) => (
                <tr key={ot.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs font-mono text-slate-300 align-middle">
                    {formatFecha(ot.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-white align-middle min-w-[180px]">
                    <div className="truncate max-w-[200px]" title={ot.clienteNombre}>{ot.clienteNombre}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-300 align-middle min-w-[220px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">{ot.proyecto}</div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5" title={ot.detallesTrabajo}>{ot.detallesTrabajo}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-300 font-mono align-middle">
                    {ot.fechaInicio ? (
                      <div className="text-[11px] space-y-0.5">
                        <span className="block">Ini: {formatFecha(ot.fechaInicio)}</span>
                        {ot.fechaTope && <span className="block text-amber-400/90 font-medium">Tope: {formatFecha(ot.fechaTope)}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider font-mono ${badgeEstadoOT[ot.estado] || badgeEstadoOT.Generada}`}>
                      {ot.estado}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center align-middle">
                    {ot.enviadoWhatsapp ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enviada
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[11px] font-mono">Pendiente</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleAbrirWhatsApp(ot)}
                        className="p-1.5 rounded-md border border-white/10 bg-white/5 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        title="Enviar / Consultar por WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAbrirEditar(ot)}
                        className="p-1.5 rounded-md border border-white/10 bg-white/5 text-slate-300 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/10 transition-colors cursor-pointer"
                        title="Editar Orden de Trabajo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(ot)}
                        className="p-1.5 rounded-md border border-white/10 bg-white/5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar Orden de Trabajo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {!loading && ordenesFiltradas.length > 0 && (
        <Pagination
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          itemsPerPage={table.itemsPerPage}
          totalItems={ordenesFiltradas.length}
          pageNumbers={table.pageNumbers}
          onPageChange={table.setCurrentPage}
          onItemsPerPageChange={table.setItemsPerPage}
        />
      )}

      {/* Modal de Edición de OT */}
      <AnimatePresence>
        {otEditando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOtEditando(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-white/10 bg-[#111318] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-orange-500" />
                    Editar Orden de Trabajo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {otEditando.clienteNombre} · <span className="text-orange-300 font-semibold">{otEditando.proyecto}</span>
                  </p>
                </div>
                <button onClick={() => setOtEditando(null)} className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                    Detalles del trabajo a realizar *
                  </label>
                  <textarea
                    rows={4}
                    value={otForm.detallesTrabajo}
                    onChange={(e) => setOtForm({ ...otForm, detallesTrabajo: e.target.value })}
                    className="w-full glass-input p-3 rounded-md text-xs leading-relaxed"
                    placeholder="Instrucciones para taller / operarios..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                    Comentarios del cliente (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={otForm.comentarioCliente}
                    onChange={(e) => setOtForm({ ...otForm, comentarioCliente: e.target.value })}
                    className="w-full glass-input p-3 rounded-md text-xs leading-relaxed"
                    placeholder="Indicaciones especiales..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Contacto de referencia
                    </label>
                    <input
                      type="text"
                      value={otForm.contacto}
                      onChange={(e) => setOtForm({ ...otForm, contacto: e.target.value })}
                      className="w-full glass-input px-3 py-2 rounded-md text-xs"
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Estado operativo
                    </label>
                    <select
                      value={otForm.estado}
                      onChange={(e) => setOtForm({ ...otForm, estado: e.target.value })}
                      className="w-full glass-select px-3 py-2 rounded-md text-xs"
                    >
                      {ESTADOS_OT.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Fecha de Inicio
                    </label>
                    <input
                      type="date"
                      value={otForm.fechaInicio}
                      onChange={(e) => setOtForm({ ...otForm, fechaInicio: e.target.value })}
                      className="w-full glass-input px-3 py-2 rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Fecha Límite / Culminación
                    </label>
                    <input
                      type="date"
                      value={otForm.fechaTope}
                      onChange={(e) => setOtForm({ ...otForm, fechaTope: e.target.value })}
                      className="w-full glass-input px-3 py-2 rounded-md text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => setOtEditando(null)}
                  className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarEdicion}
                  disabled={saving || !otForm.detallesTrabajo.trim()}
                  className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm border border-orange-500/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Envío por WhatsApp */}
      <AnimatePresence>
        {whatsappModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setWhatsappModal(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-md border border-white/10 bg-[#111318] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Despacho por WhatsApp</h3>
                    <p className="text-xs text-slate-400">Notificar al equipo o cliente</p>
                  </div>
                </div>
                <button onClick={() => setWhatsappModal(null)} className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Mensaje generado para la Orden de Trabajo
                </label>
                <pre className="p-3.5 rounded-md bg-[#0b0c10] border border-white/10 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {whatsappModal.mensaje}
                </pre>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(whatsappModal.mensaje);
                      showToast('Mensaje copiado al portapapeles', 'info');
                    }}
                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                  >
                    Copiar Mensaje
                  </button>
                  {!whatsappModal.enviado && (
                    <button
                      onClick={() => handleMarcarEnviadaWsp(whatsappModal.otId)}
                      className="px-3 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/20 transition-colors cursor-pointer"
                    >
                      Marcar como enviada
                    </button>
                  )}
                </div>

                <a
                  href={whatsappModal.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleMarcarEnviadaWsp(whatsappModal.otId)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir WhatsApp Web
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Nueva OT Manual */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4" onClick={() => setShowManualModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-md border border-white/10 bg-[#111318] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Nueva Orden de Trabajo Manual</h3>
                    <p className="text-xs text-slate-400">Cargar una OT directa para el taller sin presupuesto previo</p>
                  </div>
                </div>
                <button onClick={() => setShowManualModal(false)} className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-orange-300 mb-1">Cliente *</label>
                  <select
                    value={manualForm.clienteId}
                    onChange={(e) => setManualForm(f => ({ ...f, clienteId: e.target.value }))}
                    className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                  >
                    <option value="">Seleccioná un cliente...</option>
                    {clientesList.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#111318]">{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-orange-300 mb-1">Proyecto / Obra *</label>
                  <input
                    type="text"
                    placeholder="Ej: Letrero Corp, Fachada Alucobond, etc."
                    value={manualForm.proyecto}
                    onChange={(e) => setManualForm(f => ({ ...f, proyecto: e.target.value }))}
                    className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-orange-300 mb-1">Contacto</label>
                    <input
                      type="text"
                      placeholder="Nombre del contacto"
                      value={manualForm.contacto}
                      onChange={(e) => setManualForm(f => ({ ...f, contacto: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-orange-300 mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="text"
                      placeholder="Ej: 595981234567"
                      value={manualForm.telefono}
                      onChange={(e) => setManualForm(f => ({ ...f, telefono: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-orange-300 mb-1">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={manualForm.fechaInicio}
                      onChange={(e) => setManualForm(f => ({ ...f, fechaInicio: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-orange-300 mb-1">Fecha para Culminar</label>
                    <input
                      type="date"
                      value={manualForm.fechaTope}
                      onChange={(e) => setManualForm(f => ({ ...f, fechaTope: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-orange-300 mb-1">Detalles del Trabajo *</label>
                  <textarea
                    rows={4}
                    placeholder="Instrucciones del trabajo, medidas, materiales a utilizar..."
                    value={manualForm.detallesTrabajo}
                    onChange={(e) => setManualForm(f => ({ ...f, detallesTrabajo: e.target.value }))}
                    className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-orange-300 mb-1">Comentarios del Cliente</label>
                  <textarea
                    rows={2}
                    placeholder="Instrucciones o requerimientos específicos del cliente..."
                    value={manualForm.comentarioCliente}
                    onChange={(e) => setManualForm(f => ({ ...f, comentarioCliente: e.target.value }))}
                    className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500/60"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  disabled={manualSaving}
                  className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCrearOTManual}
                  disabled={manualSaving}
                  className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {manualSaving ? 'Creando...' : 'Crear Orden de Trabajo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
