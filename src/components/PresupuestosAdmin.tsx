import { useCallback, useEffect, useState } from 'react';
import { authFetchJSON } from '../authFetch.ts';
import { Cliente, Pedido, Presupuesto, PresupuestoItem, Proyecto, PRESUPUESTO_CATEGORIAS, PresupuestoCategoria, OrdenTrabajo } from '../types.ts';
import { useSortAndPaginate, getSortIcon, sortableHeaderClass } from '../lib/tableUtils.ts';
import Pagination from './Pagination.tsx';
import CalculadoraAdhesivoModal, { CalculoAdhesivoResultado } from './CalculadoraAdhesivoModal.tsx';
import FormulaInputPopover from './FormulaInputPopover.tsx';
import { Calculator, FileText, Printer, MoreVertical, Edit2, Play, Send, Check, XCircle, Trash2, ClipboardList } from 'lucide-react';

interface PresupuestosAdminProps {
  clientes: Cliente[];
  pedidos: Pedido[];
  proyectos: Proyecto[];
  onConvertido: () => void;
}

const ESTADOS = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado', 'En Proceso'] as const;

const CATEGORIA_LABEL: Record<PresupuestoCategoria, string> = {
  Insumo: 'Insumo',
  Adquisicion: 'Adquisicion',
  ManoDeObra: 'Mano de Obra',
  Entrega: 'Entrega',
};

const badgeEstado: Record<string, string> = {
  Borrador: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Enviado: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Aprobado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Rechazado: 'bg-red-500/15 text-red-300 border-red-500/30',
  'En Proceso': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

function formatGs(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

function compressImagePresupuesto(base64: string, maxWidth = 1200, quality = 0.75): Promise<string> {
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

function formatFecha(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

interface ItemForm {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  categoria: PresupuestoCategoria;
  horas: string;
  tarifa: string;
}

interface PresupuestoForm {
  pedidoId: string;
  clienteId: string;
  proyecto: string;
  contacto: string;
  fechaInicio: string;
  fechaTope: string;
  markup: string;
  comentarioCliente: string;
  venta2: string;
  fotos: string[];
  items: ItemForm[];
}

const formVacio: PresupuestoForm = {
  pedidoId: '',
  clienteId: '',
  proyecto: '',
  contacto: '',
  fechaInicio: '',
  fechaTope: '',
  markup: '35',
  comentarioCliente: '',
  venta2: '',
  fotos: [],
  items: [{ descripcion: '', cantidad: '', precioUnitario: '', categoria: 'Insumo', horas: '', tarifa: '' }],
};

export default function PresupuestosAdmin({ clientes, pedidos, proyectos, onConvertido }: PresupuestosAdminProps) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<PresupuestoForm>(formVacio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modoProyecto, setModoProyecto] = useState<'existente' | 'nuevo'>('existente');
  const [detalle, setDetalle] = useState<Presupuesto | null>(null);
  const [saving, setSaving] = useState(false);
  const [otData, setOtData] = useState<{ otId: string; mensaje: string; whatsappUrl: string; estado: string; enviadoWhatsapp: boolean; presupuestoId?: string } | null>(null);
  const [otLoading, setOtLoading] = useState(false);
  const [otTelefono, setOtTelefono] = useState('');
  const [ordenesTrabajo, setOrdenesTrabajo] = useState<OrdenTrabajo[]>([]);
  const [otEditando, setOtEditando] = useState<OrdenTrabajo | null>(null);
  const [otForm, setOtForm] = useState<{ detallesTrabajo: string; comentarioCliente: string; contacto: string; fechaInicio: string; fechaTope: string; estado: string }>({
    detallesTrabajo: '',
    comentarioCliente: '',
    contacto: '',
    fechaInicio: '',
    fechaTope: '',
    estado: 'Generada',
  });
  const [otSaving, setOtSaving] = useState(false);
  const [otEditMode, setOtEditMode] = useState<'generar' | 'editar' | 'lista'>('generar');
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [otPresupuestoSeleccionado, setOtPresupuestoSeleccionado] = useState<Presupuesto | null>(null);
  const [otSelectedItemIds, setOtSelectedItemIds] = useState<string[]>([]);
  const [showCalculadoraAdhesivo, setShowCalculadoraAdhesivo] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);

  const isMaterialItem = (it: PresupuestoItem) =>
    it.categoria === 'Insumo' || it.categoria === 'Adquisicion' || !['ManoDeObra', 'Entrega'].includes(it.categoria);

  const buildDetallesTrabajoTexto = (pedidoDesc?: string, items?: PresupuestoItem[], selectedIds?: string[]) => {
    const parts: string[] = [];
    if (pedidoDesc) {
      parts.push(pedidoDesc);
    }
    const filteredItems = (items || []).filter((it) => !selectedIds || selectedIds.includes(it.id));
    if (filteredItems.length > 0) {
      if (parts.length > 0) parts.push('');
      parts.push('Materiales e insumos a utilizar:');
      for (const item of filteredItems) {
        parts.push(`• ${item.descripcion} (Cant: ${item.cantidad})`);
      }
    }
    return parts.join('\n');
  };

  const handleAplicarCalculoAdhesivo = (res: CalculoAdhesivoResultado) => {
    if (res.lineasDesglosadas && res.lineasDesglosadas.length > 1) {
      const newItems = res.lineasDesglosadas.map((l) => ({
        descripcion: l.descripcion,
        cantidad: String(l.cantidad),
        precioUnitario: String(l.precioUnitario),
        categoria: 'Insumo' as PresupuestoCategoria,
        horas: '',
        tarifa: '',
      }));
      setForm((f) => ({ ...f, items: [...f.items, ...newItems] }));
    } else {
      setForm((f) => ({
        ...f,
        items: [
          ...f.items,
          {
            descripcion: res.resumenTexto,
            cantidad: String(res.areaTotalM2),
            precioUnitario: String(res.precioUnitarioGs || ''),
            categoria: 'Insumo',
            horas: '',
            tarifa: '',
          },
        ],
      }));
    }
  };

  type PresupuestoSortField = 'createdAt' | 'clienteNombre' | 'total' | 'markup' | 'estado';
  const table = useSortAndPaginate<Presupuesto, PresupuestoSortField>(presupuestos, {
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc',
    resetDeps: [filtroEstado, filtroCliente],
  });

  const loadPresupuestos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroCliente) params.set('clienteId', filtroCliente);
      const qs = params.toString();
      const json = await authFetchJSON<{ success: boolean; data: Presupuesto[] }>(
        `/api/admin/presupuestos${qs ? `?${qs}` : ''}`
      );
      setPresupuestos(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar presupuestos');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroCliente]);

  useEffect(() => {
    loadPresupuestos();
  }, [loadPresupuestos]);

  // ─── Helpers de items ───
  // costoTotal = suma de todos los items
  const totalCosto = (items: ItemForm[]) =>
    items.reduce((sum, it) => {
      const cant = parseFloat(it.cantidad) || 0;
      const pu = parseFloat(it.precioUnitario) || 0;
      return sum + cant * pu;
    }, 0);

  // venta1 = costoTotal × (1 + markup/100)
  const totalConMarkup = (items: ItemForm[], markup: string) => {
    const subtotal = totalCosto(items);
    const mk = parseFloat(markup) || 0;
    return mk > 0 ? subtotal * (1 + mk / 100) : subtotal;
  };

  // Subtotales por categoria
  const subtotalCategoria = (items: ItemForm[], cat: PresupuestoCategoria) =>
    items.filter((it) => it.categoria === cat).reduce((sum, it) => {
      const cant = parseFloat(it.cantidad) || 0;
      const pu = parseFloat(it.precioUnitario) || 0;
      return sum + cant * pu;
    }, 0);

  // ─── Acciones CRUD ───
  const handleCrear = async () => {
    if (!form.pedidoId || !form.clienteId || !form.proyecto?.trim() || form.items.length === 0) {
      setError('Pedido, cliente, proyecto e items son obligatorios');
      return;
    }

    // Normalizar items de Mano de Obra si se cargaron horas y tarifa
    const normalizedItems = form.items.map((it) => {
      let cant = parseFloat(it.cantidad);
      let pu = parseFloat(it.precioUnitario);
      if (it.categoria === 'ManoDeObra') {
        if ((isNaN(cant) || cant <= 0) && it.horas) {
          cant = parseFloat(it.horas);
        }
        if ((isNaN(pu) || pu <= 0) && it.tarifa) {
          pu = parseFloat(it.tarifa);
        }
      }
      return {
        ...it,
        cantidad: String(isNaN(cant) ? 0 : cant),
        precioUnitario: String(isNaN(pu) ? 0 : pu),
      };
    });

    if (normalizedItems.some((it) => !it.descripcion?.trim() || parseFloat(it.cantidad) <= 0 || parseFloat(it.precioUnitario) <= 0)) {
      setError('Todos los items deben tener descripción, cantidad y precio válidos (> 0)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        pedidoId: form.pedidoId,
        clienteId: form.clienteId,
        proyecto: form.proyecto,
        contacto: form.contacto || undefined,
        fechaInicio: form.fechaInicio || undefined,
        fechaTope: form.fechaTope || undefined,
        markup: parseFloat(form.markup) || 0,
        comentarioCliente: form.comentarioCliente || undefined,
        venta2: form.venta2 ? parseFloat(form.venta2) : undefined,
        fotos: form.fotos.length > 0 ? form.fotos : undefined,
        items: normalizedItems.map((it) => {
          const item: any = {
            descripcion: it.descripcion.trim(),
            cantidad: parseFloat(it.cantidad),
            precioUnitario: parseFloat(it.precioUnitario),
            categoria: it.categoria,
          };
          if (it.categoria === 'ManoDeObra') {
            item.horas = it.horas ? parseFloat(it.horas) : parseFloat(it.cantidad);
            item.tarifa = it.tarifa ? parseFloat(it.tarifa) : parseFloat(it.precioUnitario);
          }
          return item;
        }),
      };
      if (editandoId) {
        await authFetchJSON(`/api/admin/presupuestos/${editandoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await authFetchJSON('/api/admin/presupuestos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setMostrarForm(false);
      setForm(formVacio);
      setEditandoId(null);
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al guardar presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (p: Presupuesto) => {
    setEditandoId(p.id);
    const coincide = proyectos.some(
      (proy) => proy.clienteId === p.clienteId && proy.nombre.trim().toLowerCase() === (p.proyecto || '').trim().toLowerCase()
    );
    setModoProyecto(coincide ? 'existente' : 'nuevo');
    setForm({
      pedidoId: p.pedidoId,
      clienteId: p.clienteId,
      proyecto: p.proyecto,
      contacto: p.contacto || '',
      fechaInicio: p.fechaInicio ? p.fechaInicio.substring(0, 10) : '',
      fechaTope: p.fechaTope ? p.fechaTope.substring(0, 10) : '',
      markup: String(p.markup),
      comentarioCliente: p.comentarioCliente || '',
      venta2: p.venta2 ? String(p.venta2) : '',
      fotos: (p as any).fotos || [],
      items: (p.items || []).map((it) => ({
        descripcion: it.descripcion,
        cantidad: String(it.cantidad),
        precioUnitario: String(it.precioUnitario),
        categoria: (it.categoria || 'Insumo') as PresupuestoCategoria,
        horas: it.horas ? String(it.horas) : '',
        tarifa: it.tarifa ? String(it.tarifa) : '',
      })),
    });
    setMostrarForm(true);
  };

  const handleEnviar = async (id: string) => {
    setSaving(true);
    try {
      await authFetchJSON(`/api/admin/presupuestos/${id}/enviar`, { method: 'POST' });
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al enviar presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const handleResponder = async (id: string, respuesta: 'Aprobado' | 'Rechazado') => {
    setSaving(true);
    try {
      await authFetchJSON(`/api/admin/presupuestos/${id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta }),
      });
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al registrar respuesta');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertir = async (id: string) => {
    setSaving(true);
    try {
      await authFetchJSON(`/api/admin/presupuestos/${id}/convertir`, { method: 'POST' });
      onConvertido();
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al convertir presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirModalOT = (presupuesto: Presupuesto) => {
    // Pre-cargar los datos del presupuesto en el formulario del modal
    const matIds = (presupuesto.items || [])
      .filter(isMaterialItem)
      .map((it) => it.id);
    const finalSelectedIds = matIds.length > 0 ? matIds : (presupuesto.items || []).map((it) => it.id);
    setOtSelectedItemIds(finalSelectedIds);

    const detallesTexto = buildDetallesTrabajoTexto(presupuesto.pedido?.descripcion, presupuesto.items, finalSelectedIds);

    setOtForm({
      detallesTrabajo: detallesTexto || 'Sin detalles especificados',
      comentarioCliente: presupuesto.comentarioCliente || '',
      contacto: presupuesto.contacto || '',
      fechaInicio: presupuesto.fechaInicio ? presupuesto.fechaInicio.slice(0, 10) : '',
      fechaTope: presupuesto.fechaTope ? presupuesto.fechaTope.slice(0, 10) : '',
      estado: 'Generada',
    });
    setOtEditMode('generar');
    setOtEditando(null);
    setOtData(null);
    setOtTelefono('');
    setOtPresupuestoSeleccionado(presupuesto);
    setOtModalOpen(true);
  };

  const handleGenerarOT = async (id: string) => {
    setOtLoading(true);
    setError(null);
    try {
      const body: any = {};
      if (otTelefono.trim()) body.telefono = otTelefono.trim();
      if (otForm.detallesTrabajo.trim()) body.detallesTrabajo = otForm.detallesTrabajo.trim();
      if (otForm.comentarioCliente.trim()) body.comentarioCliente = otForm.comentarioCliente.trim();
      const json = await authFetchJSON<{ success: boolean; data: { otId: string; mensaje: string; whatsappUrl: string; estado: string; enviadoWhatsapp: boolean } }>(
        `/api/admin/presupuestos/${id}/orden-trabajo`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setOtData({ ...json.data, presupuestoId: id });
      loadOrdenesTrabajo();
    } catch (e: any) {
      setError(e.message || 'Error al generar Orden de Trabajo');
    } finally {
      setOtLoading(false);
    }
  };

  const loadOrdenesTrabajo = useCallback(async () => {
    try {
      const json = await authFetchJSON<{ success: boolean; data: OrdenTrabajo[] }>(`/api/admin/presupuestos/ordenes-trabajo`);
      setOrdenesTrabajo(json.data || []);
    } catch (e: any) {
      // silencioso — no bloquear la vista principal
    }
  }, []);

  useEffect(() => {
    loadOrdenesTrabajo();
  }, [loadOrdenesTrabajo]);

  const handleEditarOT = (ot: OrdenTrabajo) => {
    setOtEditando(ot);
    setOtEditMode('editar');
    setOtForm({
      detallesTrabajo: ot.detallesTrabajo || '',
      comentarioCliente: ot.comentarioCliente || '',
      contacto: ot.contacto || '',
      fechaInicio: ot.fechaInicio ? ot.fechaInicio.slice(0, 10) : '',
      fechaTope: ot.fechaTope ? ot.fechaTope.slice(0, 10) : '',
      estado: ot.estado || 'Generada',
    });
    setOtData(null);
  };

  const handleGuardarEdicionOT = async () => {
    if (!otEditando) return;
    setOtSaving(true);
    setError(null);
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
      setOtEditando(null);
      setOtEditMode('generar');
      loadOrdenesTrabajo();
    } catch (e: any) {
      setError(e.message || 'Error al editar Orden de Trabajo');
    } finally {
      setOtSaving(false);
    }
  };

  const handleEliminarOT = async (otId: string) => {
    if (!confirm('¿Eliminar esta Orden de Trabajo? Esta acción no se puede deshacer.')) return;
    try {
      await authFetchJSON(`/api/admin/presupuestos/ordenes-trabajo/${otId}`, { method: 'DELETE' });
      loadOrdenesTrabajo();
      if (otEditando?.id === otId) {
        setOtEditando(null);
        setOtEditMode('generar');
      }
    } catch (e: any) {
      setError(e.message || 'Error al eliminar Orden de Trabajo');
    }
  };

  const handleMarcarOTEnviada = async (otId: string) => {
    try {
      await authFetchJSON(`/api/admin/presupuestos/ordenes-trabajo/${otId}/marcar-enviado`, { method: 'POST' });
      setOtData((prev) => prev ? { ...prev, enviadoWhatsapp: true, estado: 'Enviada' } : prev);
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al marcar OT como enviada');
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este presupuesto? Solo se pueden eliminar borradores.')) return;
    setSaving(true);
    try {
      await authFetchJSON(`/api/admin/presupuestos/${id}`, { method: 'DELETE' });
      loadPresupuestos();
    } catch (e: any) {
      setError(e.message || 'Error al eliminar presupuesto');
    } finally {
      setSaving(false);
    }
  };

  // ─── Items del formulario ───
  const addItem = (categoria: PresupuestoCategoria = 'Insumo') =>
    setForm((f) => ({ ...f, items: [...f.items, { descripcion: '', cantidad: '', precioUnitario: '', categoria, horas: '', tarifa: '' }] }));

  const removeItem = (index: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

  const updateItem = (index: number, campo: keyof ItemForm, value: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [campo]: value } : it)),
    }));

  // ─── Fotos del presupuesto ───
  const handleAddFotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nuevas: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const base64: string = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const compressed = await compressImagePresupuesto(base64);
      nuevas.push(compressed);
    }
    setForm((f) => ({ ...f, fotos: [...f.fotos, ...nuevas].slice(0, 10) }));
  };

  const handleRemoveFoto = (index: number) =>
    setForm((f) => ({ ...f, fotos: f.fotos.filter((_, i) => i !== index) }));

  // ─── Pedidos activos del cliente seleccionado (excluye Completado/Entregado y los que ya tienen presupuesto) ───
  const ESTADOS_INACTIVOS = ['Completado', 'Entregado'];
  const pedidosDisponibles = pedidos.filter(
    (p) => p.clienteId === form.clienteId
      && !ESTADOS_INACTIVOS.includes(p.estado)
      && !presupuestos.some((pre) => pre.pedidoId === p.id)
  );

  // ─── Proyectos activos del cliente seleccionado ───
  const proyectosDisponibles = proyectos.filter(
    (p) => p.clienteId === form.clienteId && p.activo !== false
  );

  const selectCls = 'w-full min-w-0 rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500 transition truncate';
  const inputCls = 'w-full min-w-0 rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500 transition';

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Filtros + Nuevo */}
      <div className="flex flex-wrap items-center gap-3">
        <select className={selectCls} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select className={selectCls} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button
          onClick={() => loadPresupuestos()}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
        >
          Refrescar
        </button>
        <button
          onClick={() => { setForm(formVacio); setEditandoId(null); setModoProyecto('existente'); setMostrarForm(true); }}
          className="ml-auto rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20"
        >
          + Nuevo Presupuesto
        </button>
      </div>

      {/* Formulario crear/editar */}
      {mostrarForm && (
        <div className="rounded-md border border-white/10 bg-[#111318] p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white">
            {editandoId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </h3>

          {/* Selección de cliente → pedidos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 min-w-0">
              <label htmlFor="presupuesto-cliente" className="text-xs font-mono text-slate-400">Cliente *</label>
              <select
                id="presupuesto-cliente"
                className={selectCls}
                value={form.clienteId}
                onChange={(e) => {
                  const newCliId = e.target.value;
                  const proys = proyectos.filter((p) => p.clienteId === newCliId && p.activo !== false);
                  setForm({ ...form, clienteId: newCliId, pedidoId: '', proyecto: '' });
                  setModoProyecto(proys.length > 0 ? 'existente' : 'nuevo');
                }}
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 min-w-0">
              <label htmlFor="presupuesto-pedido" className="text-xs font-mono text-slate-400">Pedido *</label>
              <select
                id="presupuesto-pedido"
                className={selectCls}
                value={form.pedidoId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const ped = pedidos.find((p) => p.id === selectedId);
                  setForm((prev) => {
                    const next = { ...prev, pedidoId: selectedId };
                    if (ped) {
                      if (ped.contacto) next.contacto = ped.contacto;
                      if (ped.fechaSolicitud) {
                        try {
                          next.fechaInicio = new Date(ped.fechaSolicitud).toISOString().substring(0, 10);
                        } catch {}
                      }
                      if (ped.fechaFin) {
                        try {
                          next.fechaTope = new Date(ped.fechaFin).toISOString().substring(0, 10);
                        } catch {}
                      }
                      const pedProyLimpio = (ped.proyecto || '').trim();
                      const coincide = pedProyLimpio && proyectosDisponibles.some(
                        (p) => p.nombre.trim().toLowerCase() === pedProyLimpio.toLowerCase()
                      );
                      if (coincide) {
                        setModoProyecto('existente');
                        next.proyecto = pedProyLimpio;
                      } else if (pedProyLimpio) {
                        setModoProyecto('nuevo');
                        next.proyecto = pedProyLimpio;
                      } else if (ped.descripcion && ped.descripcion.trim()) {
                        setModoProyecto('nuevo');
                        next.proyecto = ped.descripcion.trim().slice(0, 60);
                      }
                    }
                    return next;
                  });
                }}
                disabled={!form.clienteId}
              >
                <option value="">{form.clienteId ? 'Seleccionar pedido activo...' : 'Primero elegir cliente'}</option>
                {(editandoId
                  ? pedidos.filter((p) => p.clienteId === form.clienteId && (!ESTADOS_INACTIVOS.includes(p.estado) || p.id === form.pedidoId))
                  : pedidosDisponibles
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.estado}] {p.descripcion?.substring(0, 40)} — {p.local || 'Sin local'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <label htmlFor="presupuesto-proyecto" className="text-xs font-mono text-slate-400">Proyecto *</label>
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-md border border-white/5">
                  <button
                    type="button"
                    onClick={() => setModoProyecto('existente')}
                    disabled={proyectosDisponibles.length === 0}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition cursor-pointer ${
                      modoProyecto === 'existente'
                        ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40'
                        : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                    title={proyectosDisponibles.length === 0 ? 'El cliente no tiene proyectos existentes' : 'Elegir proyecto existente'}
                  >
                    📁 Existente ({proyectosDisponibles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoProyecto('nuevo')}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition cursor-pointer ${
                      modoProyecto === 'nuevo'
                        ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✨ Nuevo
                  </button>
                </div>
              </div>

              {modoProyecto === 'existente' ? (
                <select
                  id="presupuesto-proyecto"
                  className={selectCls}
                  value={form.proyecto}
                  onChange={(e) => setForm({ ...form, proyecto: e.target.value })}
                  disabled={!form.clienteId}
                >
                  <option value="">{form.clienteId ? 'Seleccionar proyecto activo...' : 'Primero elegir cliente'}</option>
                  {proyectosDisponibles.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre}{p.estado ? ` [${p.estado}]` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-1">
                  <input
                    id="presupuesto-proyecto"
                    type="text"
                    className={inputCls}
                    placeholder="Ej: Renovación Cartelería Fachada 2026"
                    value={form.proyecto}
                    onChange={(e) => setForm({ ...form, proyecto: e.target.value })}
                    disabled={!form.clienteId}
                  />
                  <p className="text-[10px] text-slate-500 font-mono">
                    💡 Se creará automáticamente en Proyectos cuando el presupuesto sea aprobado.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Contacto</label>
              <input className={inputCls} value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Fecha Inicio</label>
              <input type="date" className={inputCls} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Fecha Tope</label>
              <input type="date" className={inputCls} value={form.fechaTope} onChange={(e) => setForm({ ...form, fechaTope: e.target.value })} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-400">Markup (%)</label>
                <span className="text-[11px] font-mono text-emerald-400 font-medium">
                  {(() => {
                    const m = parseFloat(form.markup) || 0;
                    const margin = (m / (100 + m)) * 100;
                    return `≈ ${margin.toFixed(1)}% margen`;
                  })()}
                </span>
              </div>
              <input type="number" step="0.1" className={inputCls} value={form.markup} onChange={(e) => setForm({ ...form, markup: e.target.value })} />
              <div className="flex items-center gap-1 pt-1 overflow-x-auto pb-0.5">
                {[
                  { label: '35% (26% marg.)', markup: '35' },
                  { label: '43% (30% marg.)', markup: '43' },
                  { label: '50% (33% marg.)', markup: '50' },
                  { label: '100% (50% marg.)', markup: '100' },
                ].map((preset) => (
                  <button
                    key={preset.markup}
                    type="button"
                    onClick={() => setForm({ ...form, markup: preset.markup })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition border ${
                      form.markup === preset.markup
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items por categoría */}
          <div className="space-y-4">
            {PRESUPUESTO_CATEGORIAS.map((cat) => (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wide text-orange-300">{CATEGORIA_LABEL[cat]}</label>
                  <div className="flex items-center gap-2">
                    {cat === 'Insumo' && (
                      <button
                        type="button"
                        onClick={() => setShowCalculadoraAdhesivo(true)}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 transition hover:bg-amber-500/20 flex items-center gap-1"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        📐 Lonas / Desperdicio
                      </button>
                    )}
                    <button onClick={() => addItem(cat)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10">
                      + {CATEGORIA_LABEL[cat]}
                    </button>
                  </div>
                </div>
                {form.items.map((it, i) => (
                  it.categoria === cat && (
                    <div key={i} className={`grid ${cat === 'ManoDeObra' ? 'grid-cols-12' : 'grid-cols-12'} gap-2`}>
                      <input
                        className={`${inputCls} col-span-4`}
                        placeholder="Descripción"
                        value={it.descripcion}
                        onChange={(e) => updateItem(i, 'descripcion', e.target.value)}
                      />
                      {cat === 'ManoDeObra' ? (
                        <>
                          <div className="col-span-2 flex items-center gap-1">
                            <input
                              className={`${inputCls} flex-1`}
                              type="number"
                              step="0.01"
                              placeholder="Horas"
                              value={it.horas}
                              onChange={(e) => {
                                updateItem(i, 'horas', e.target.value);
                                const tarifa = form.items[i].tarifa;
                                if (e.target.value && tarifa) {
                                  updateItem(i, 'cantidad', e.target.value);
                                  updateItem(i, 'precioUnitario', tarifa);
                                }
                              }}
                            />
                            <FormulaInputPopover
                              currentValue={parseFloat(it.horas) || undefined}
                              onApply={(val) => {
                                const valStr = String(val);
                                updateItem(i, 'horas', valStr);
                                const tarifa = form.items[i].tarifa;
                                if (tarifa) {
                                  updateItem(i, 'cantidad', valStr);
                                  updateItem(i, 'precioUnitario', tarifa);
                                }
                              }}
                              unidadMedida="hs"
                            />
                          </div>
                          <input
                            className={`${inputCls} col-span-2`}
                            type="number"
                            placeholder="Tarifa/hora"
                            value={it.tarifa}
                            onChange={(e) => {
                              updateItem(i, 'tarifa', e.target.value);
                              const horas = form.items[i].horas;
                              if (e.target.value && horas) {
                                updateItem(i, 'precioUnitario', e.target.value);
                                updateItem(i, 'cantidad', horas);
                              }
                            }}
                          />
                          <input
                            className={`${inputCls} col-span-3`}
                            type="number"
                            placeholder="Total (Gs.)"
                            value={it.cantidad && it.precioUnitario ? String((parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0)) : ''}
                            readOnly
                          />
                        </>
                      ) : (
                        <>
                          <div className="col-span-2 flex items-center gap-1">
                            <input
                              className={`${inputCls} flex-1`}
                              type="number"
                              step="0.001"
                              placeholder="Cant."
                              value={it.cantidad}
                              onChange={(e) => updateItem(i, 'cantidad', e.target.value)}
                            />
                            <FormulaInputPopover
                              currentValue={parseFloat(it.cantidad) || undefined}
                              onApply={(val) => updateItem(i, 'cantidad', String(val))}
                            />
                          </div>
                          <input
                            className={`${inputCls} col-span-3`}
                            type="number"
                            placeholder="Precio unit. (Gs.)"
                            value={it.precioUnitario}
                            onChange={(e) => updateItem(i, 'precioUnitario', e.target.value)}
                          />
                          <div className="col-span-2 text-right font-mono text-sm text-slate-300 flex items-center justify-end">
                            {formatGs((parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0))}
                          </div>
                        </>
                      )}
                      <button
                        onClick={() => removeItem(i)}
                        className="col-span-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2 text-xs text-red-400 transition hover:bg-red-500/15"
                      >
                        ✕
                      </button>
                    </div>
                  )
                ))}
                {/* Subtotal por categoría */}
                {form.items.some((it) => it.categoria === cat) && (
                  <div className="flex justify-end gap-2 text-xs text-slate-400">
                    <span>Subtotal {CATEGORIA_LABEL[cat]}:</span>
                    <span className="font-mono font-semibold text-slate-300">{formatGs(subtotalCategoria(form.items, cat))}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-white/10 pt-3">
            <div className="text-right">
              <span className="text-xs text-slate-400">Costo Total: </span>
              <span className="text-sm font-semibold text-slate-200">{formatGs(totalCosto(form.items))}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">
                Markup {form.markup || 0}% (Margen {(((parseFloat(form.markup) || 0) / (100 + (parseFloat(form.markup) || 0))) * 100).toFixed(1)}%):{' '}
              </span>
              <span className="text-sm font-semibold text-amber-300">{formatGs(totalConMarkup(form.items, form.markup) - totalCosto(form.items))}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Venta 1 (calculada): </span>
              <span className="text-sm font-bold text-slate-200">{formatGs(totalConMarkup(form.items, form.markup))}</span>
            </div>
          </div>

          {/* Venta 2 (precio final redondeado) */}
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="text-right space-y-1">
              <label className="text-xs font-mono text-slate-400">Venta 2 (precio final, opcional)</label>
              <input
                type="number"
                className={`${inputCls} w-48 text-right`}
                placeholder="Gs. (redondeo final)"
                value={form.venta2}
                onChange={(e) => setForm({ ...form, venta2: e.target.value })}
              />
            </div>
            {form.venta2 && (
              <div className="text-right">
                <span className="text-xs text-slate-400">Diferencia: </span>
                <span className="text-sm font-semibold text-orange-300">{formatGs(parseFloat(form.venta2) - totalConMarkup(form.items, form.markup))}</span>
              </div>
            )}
          </div>

          {/* Fotos del presupuesto */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400">Fotos del presupuesto (opcional, máx. 10)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleAddFotos(e.target.files)}
              className="hidden"
              id="presupuesto-fotos-input"
            />
            <div className="flex flex-wrap gap-2">
              {form.fotos.map((foto, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-white/10">
                  <img src={foto} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveFoto(i)}
                    className="absolute right-1 top-1 rounded bg-red-500/90 p-1 text-white hover:bg-red-600"
                    title="Quitar foto"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.fotos.length < 10 && (
                <label
                  htmlFor="presupuesto-fotos-input"
                  className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-600 text-slate-500 transition hover:border-orange-500 hover:text-orange-400"
                >
                  <div className="text-center">
                    <svg className="mx-auto h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[10px]">Agregar</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setMostrarForm(false); setForm(formVacio); setEditandoId(null); }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={saving}
              className="rounded-lg border border-orange-500/30 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/25 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear Presupuesto'}
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111318]/80 backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1050px] border-collapse">
            <thead className="bg-[#090a0f] text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className={`px-4 py-3.5 whitespace-nowrap ${sortableHeaderClass('createdAt', table.sortField)}`} onClick={() => table.handleSort('createdAt')}>Fecha {getSortIcon('createdAt', table.sortField, table.sortOrder)}</th>
                <th className={`px-4 py-3.5 min-w-[180px] ${sortableHeaderClass('clienteNombre', table.sortField)}`} onClick={() => table.handleSort('clienteNombre')}>Cliente {getSortIcon('clienteNombre', table.sortField, table.sortOrder)}</th>
                <th className="px-4 py-3.5 min-w-[200px]">Proyecto</th>
                <th className={`px-4 py-3.5 text-right whitespace-nowrap ${sortableHeaderClass('total', table.sortField)}`} onClick={() => table.handleSort('total')}>Costo {getSortIcon('total', table.sortField, table.sortOrder)}</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Venta</th>
                <th className={`px-4 py-3.5 text-center whitespace-nowrap ${sortableHeaderClass('markup', table.sortField)}`} onClick={() => table.handleSort('markup')}>Markup {getSortIcon('markup', table.sortField, table.sortOrder)}</th>
                <th className={`px-4 py-3.5 whitespace-nowrap ${sortableHeaderClass('estado', table.sortField)}`} onClick={() => table.handleSort('estado')}>Estado {getSortIcon('estado', table.sortField, table.sortOrder)}</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-400 font-mono">Cargando presupuestos...</td>
                </tr>
              )}
              {!loading && presupuestos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-400 font-mono">No hay presupuestos con los filtros seleccionados.</td>
                </tr>
              )}
              {table.paginatedData.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-300 font-mono align-middle">{formatFecha(p.createdAt)}</td>
                  <td className="px-4 py-3.5 font-medium text-white align-middle min-w-[180px]">
                    <div className="truncate max-w-[200px]" title={p.clienteNombre}>{p.clienteNombre}</div>
                  </td>
                  <td className="px-4 py-3.5 align-middle min-w-[200px]">
                    <button
                      onClick={async () => {
                        try {
                          const json = await authFetchJSON<{ success: boolean; data: Presupuesto }>(`/api/admin/presupuestos/${p.id}`);
                          setDetalle(json.data);
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                      className="text-left text-slate-300 hover:text-orange-400 font-medium transition cursor-pointer line-clamp-1"
                      title={p.proyecto}
                    >
                      {p.proyecto}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-slate-400 align-middle">{formatGs(Number(p.costoTotal ?? p.total))}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold text-orange-400 align-middle">
                    {p.venta2 != null ? formatGs(Number(p.venta2)) : formatGs(Number(p.venta1 ?? p.total))}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-slate-400 align-middle whitespace-nowrap">{Number(p.markup)}%</td>
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${badgeEstado[p.estado] || badgeEstado['Borrador']}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle">
                    <div className="relative inline-flex items-center justify-end gap-1.5">
                      {/* Botón Imprimir / PDF Formal */}
                      <button
                        onClick={() => window.open(`/api/admin/presupuestos/${p.id}/pdf`, '_blank')}
                        className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 transition hover:bg-orange-500/20 flex items-center gap-1"
                        title="Ver e imprimir Presupuesto Formal en PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        PDF
                      </button>

                      {/* Acción contextual destacada */}
                      {(p.estado === 'Aprobado' || p.estado === 'En Proceso') && (
                        <button
                          onClick={() => handleAbrirModalOT(p)}
                          disabled={otLoading}
                          className="rounded-md border border-orange-500/40 bg-orange-500/20 px-2.5 py-1 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30 disabled:opacity-50 flex items-center gap-1"
                          title="Generar Orden de Trabajo y enviar por WhatsApp"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-orange-400" />
                          OT
                        </button>
                      )}
                      {p.estado === 'Borrador' && (
                        <button
                          onClick={() => handleEnviar(p.id)}
                          disabled={saving}
                          className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Enviar
                        </button>
                      )}

                      {/* Menú desplegable contextual */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuAbiertoId(menuAbiertoId === p.id ? null : p.id)}
                          className={`p-1.5 rounded-md border transition ${
                            menuAbiertoId === p.id
                              ? 'border-orange-500/50 bg-orange-500/20 text-orange-300'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Más opciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuAbiertoId === p.id && (
                          <>
                            {/* Backdrop transparente para cerrar al hacer clic afuera */}
                            <div
                              className="fixed inset-0 z-20 cursor-default"
                              onClick={() => setMenuAbiertoId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-md border border-white/10 bg-[#111318] p-1 shadow-2xl z-30 flex flex-col text-left">
                              {p.estado !== 'En Proceso' && (
                                <button
                                  onClick={() => {
                                    setMenuAbiertoId(null);
                                    handleEditar(p);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-sm transition text-left"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                  Editar Presupuesto
                                </button>
                              )}
                              {p.estado === 'Aprobado' && (
                                <button
                                  onClick={() => {
                                    setMenuAbiertoId(null);
                                    handleConvertir(p.id);
                                  }}
                                  disabled={saving}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-orange-300 hover:text-orange-200 hover:bg-orange-500/15 rounded-sm transition text-left disabled:opacity-50"
                                >
                                  <Play className="w-3.5 h-3.5 text-orange-400" />
                                  Iniciar (En Proceso)
                                </button>
                              )}
                              {p.estado === 'Enviado' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setMenuAbiertoId(null);
                                      handleResponder(p.id, 'Aprobado');
                                    }}
                                    disabled={saving}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15 rounded-sm transition text-left disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    Aprobar Presupuesto
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMenuAbiertoId(null);
                                      handleResponder(p.id, 'Rechazado');
                                    }}
                                    disabled={saving}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-sm transition text-left disabled:opacity-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    Rechazar Presupuesto
                                  </button>
                                </>
                              )}
                              {p.estado === 'Rechazado' && (
                                <button
                                  onClick={() => {
                                    setMenuAbiertoId(null);
                                    handleEnviar(p.id);
                                  }}
                                  disabled={saving}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-orange-300 hover:text-orange-200 hover:bg-orange-500/15 rounded-sm transition text-left disabled:opacity-50"
                                >
                                  <Send className="w-3.5 h-3.5 text-orange-400" />
                                  Reenviar Presupuesto
                                </button>
                              )}
                              {p.estado === 'Borrador' && (
                                <button
                                  onClick={() => {
                                    setMenuAbiertoId(null);
                                    handleEliminar(p.id);
                                  }}
                                  disabled={saving}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-sm transition text-left disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  Eliminar Presupuesto
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && presupuestos.length > 0 && (
        <Pagination
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          itemsPerPage={table.itemsPerPage}
          totalItems={presupuestos.length}
          pageNumbers={table.pageNumbers}
          onPageChange={table.setCurrentPage}
          onItemsPerPageChange={table.setItemsPerPage}
        />
      )}

      {/* Modal de detalle */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetalle(null)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-md border border-white/10 bg-[#111318] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{detalle.proyecto}</h2>
                <p className="text-sm text-slate-400">{detalle.clienteNombre}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(`/api/admin/presupuestos/${detalle.id}/pdf`, '_blank')}
                  className="flex items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/25 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / PDF Formal
                </button>
                <button onClick={() => setDetalle(null)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10">
                  Cerrar ✕
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400">Estado: </span>
                <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${badgeEstado[detalle.estado]}`}>{detalle.estado}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400">Markup: </span>
                <span className="text-slate-200">{Number(detalle.markup)}%</span>
              </div>
              <div>
                <span className="text-xs text-slate-400">Enviado: </span>
                <span className="text-slate-200">{formatFecha(detalle.fechaEnvio)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400">Respuesta: </span>
                <span className="text-slate-200">{formatFecha(detalle.fechaRespuesta)}</span>
              </div>
            </div>

            {detalle.contacto && (
              <p className="mb-2 text-sm text-slate-300"><span className="text-xs text-slate-400">Contacto: </span>{detalle.contacto}</p>
            )}
            {detalle.comentarioCliente && (
              <p className="mb-2 text-sm text-slate-300"><span className="text-xs text-slate-400">Comentario: </span>{detalle.comentarioCliente}</p>
            )}
            {detalle.respuestaCliente && (
              <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                <span className="text-xs text-slate-400">Respuesta del cliente: </span>{detalle.respuestaCliente}
              </p>
            )}

            {/* Items agrupados por categoría */}
            <div className="space-y-4">
              {PRESUPUESTO_CATEGORIAS.map((cat) => {
                const itemsCat = (detalle.items || []).filter((it) => (it.categoria || 'Insumo') === cat);
                if (itemsCat.length === 0) return null;
                const subtotalCat = itemsCat.reduce((sum, it) => sum + Number(it.total), 0);
                return (
                  <div key={cat} className="overflow-hidden rounded-xl border border-white/10 bg-[#090a0f]">
                    <div className="bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-orange-300 border-b border-white/10">
                      {CATEGORIA_LABEL[cat]}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                        <thead className="text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/5 bg-white/[0.01]">
                          <tr>
                            <th className="px-4 py-2.5">Descripción</th>
                            {cat === 'ManoDeObra' ? (
                              <>
                                <th className="px-4 py-2.5 text-center">Horas</th>
                                <th className="px-4 py-2.5 text-right">Tarifa</th>
                              </>
                            ) : (
                              <>
                                <th className="px-4 py-2.5 text-center">Cant.</th>
                                <th className="px-4 py-2.5 text-right">P. Unit.</th>
                              </>
                            )}
                            <th className="px-4 py-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {itemsCat.sort((a, b) => a.orden - b.orden).map((it) => (
                            <tr key={it.id} className="bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                              <td className="px-4 py-2.5 text-slate-200">{it.descripcion}</td>
                              {cat === 'ManoDeObra' ? (
                                <>
                                  <td className="px-4 py-2.5 text-center text-slate-300 font-mono whitespace-nowrap">{it.horas != null ? Number(it.horas) : Number(it.cantidad)}</td>
                                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">{formatGs(it.tarifa != null ? Number(it.tarifa) : Number(it.precioUnitario))}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2.5 text-center text-slate-300 font-mono whitespace-nowrap">{Number(it.cantidad)}</td>
                                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">{formatGs(Number(it.precioUnitario))}</td>
                                </>
                              )}
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">{formatGs(Number(it.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10 bg-white/5">
                            <td colSpan={3} className="px-4 py-2.5 text-right text-xs text-slate-400 font-medium">Subtotal {CATEGORIA_LABEL[cat]}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-200 whitespace-nowrap">{formatGs(subtotalCat)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen costo → venta */}
            <div className="mt-4 space-y-1.5 rounded-md border border-white/10 bg-white/5 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Costo Total</span>
                <span className="font-mono font-semibold text-slate-200">{formatGs(Number(detalle.costoTotal ?? detalle.total))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Markup ({Number(detalle.markup)}%)</span>
                <span className="font-mono text-amber-300">+{formatGs(Number(detalle.costoTotal ?? detalle.total) * Number(detalle.markup) / 100)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Venta 1 (calculada)</span>
                <span className="font-mono font-bold text-slate-100">{formatGs(Number(detalle.venta1 ?? detalle.total))}</span>
              </div>
              {detalle.venta2 != null && (
                <div className="flex justify-between text-sm border-t border-white/10 pt-1.5">
                  <span className="text-orange-300 font-medium">Venta 2 (final)</span>
                  <span className="font-mono font-bold text-orange-300">{formatGs(Number(detalle.venta2))}</span>
                </div>
              )}
            </div>

            {/* Fotos del presupuesto */}
            {(detalle as any).fotos && (detalle as any).fotos.length > 0 && (
              <div className="mt-4 space-y-2">
                <span className="text-xs font-mono text-slate-400">Fotos</span>
                <div className="grid grid-cols-4 gap-2">
                  {(detalle as any).fotos.map((foto: string, fi: number) => (
                    <a key={fi} href={foto} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-white/10 hover:border-orange-500/40 transition">
                      <img src={foto} alt={`Foto ${fi + 1}`} className="h-20 w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {detalle.pedido && (
              <p className="mt-4 text-xs text-slate-400">
                Pedido origen: {detalle.pedido.descripcion} — {detalle.pedido.sucursalNombre || 'Sin local'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Orden de Trabajo — Generar / Editar / Lista */}
      {(otData || otEditando || otModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-md border border-orange-500/20 bg-[#111318] p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {otEditMode === 'editar' ? 'Editar Orden de Trabajo' : 'Generar Orden de Trabajo'}
                </h2>
                <p className="text-sm text-slate-400">
                  {otEditMode === 'editar' && otEditando
                    ? `${otEditando.clienteNombre} · ${otEditando.proyecto}`
                    : otData
                    ? `${otPresupuestoSeleccionado?.clienteNombre || otEditando?.clienteNombre || 'Cliente'} · ${otPresupuestoSeleccionado?.proyecto || otEditando?.proyecto || 'Proyecto'}`
                    : otPresupuestoSeleccionado
                    ? `${otPresupuestoSeleccionado.clienteNombre} · ${otPresupuestoSeleccionado.proyecto}`
                    : 'Complete los detalles del trabajo'}
                </p>
              </div>
              <button
                onClick={() => { setOtData(null); setOtEditando(null); setOtModalOpen(false); setOtEditMode('generar'); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10"
              >
                Cerrar ✕
              </button>
            </div>

            {/* Datos del cliente (solo lectura) */}
            {otEditMode === 'editar' && otEditando && (
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <span className="text-xs font-mono text-slate-500">Cliente</span>
                  <p className="text-sm text-slate-200">{otEditando.clienteNombre}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-500">Proyecto</span>
                  <p className="text-sm text-slate-200">{otEditando.proyecto}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-500">Contacto</span>
                  <p className="text-sm text-slate-200">{otEditando.contacto || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-500">Estado</span>
                  <p className="text-sm text-slate-200">{otEditando.estado}</p>
                </div>
              </div>
            )}
            {otEditMode === 'generar' && otPresupuestoSeleccionado && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <span className="text-xs font-mono text-slate-500">Cliente</span>
                  <p className="text-sm font-semibold text-slate-200">{otPresupuestoSeleccionado.clienteNombre}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-500">Proyecto</span>
                  <p className="text-sm font-semibold text-slate-200">{otPresupuestoSeleccionado.proyecto}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-500">Contacto</span>
                  <p className="text-sm text-slate-200">{otPresupuestoSeleccionado.contacto || '—'}</p>
                </div>
              </div>
            )}

            {/* Selector de Materiales a pasar a la OT (Item 10) */}
            {otEditMode === 'generar' && otPresupuestoSeleccionado && (otPresupuestoSeleccionado.items || []).length > 0 && (
              <div className="mb-4 rounded-md border border-orange-500/20 bg-[#090a0f] p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                      Materiales a incluir en la OT
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ({otSelectedItemIds.length} de {otPresupuestoSeleccionado.items?.length || 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const matIds = (otPresupuestoSeleccionado.items || []).filter(isMaterialItem).map((i) => i.id);
                        setOtSelectedItemIds(matIds);
                        setOtForm((f) => ({
                          ...f,
                          detallesTrabajo: buildDetallesTrabajoTexto(otPresupuestoSeleccionado.pedido?.descripcion, otPresupuestoSeleccionado.items, matIds) || 'Sin detalles especificados',
                        }));
                      }}
                      className="px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition-colors"
                      title="Seleccionar solo insumos y materiales (excluye mano de obra)"
                    >
                      Solo Materiales
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = (otPresupuestoSeleccionado.items || []).map((i) => i.id);
                        setOtSelectedItemIds(allIds);
                        setOtForm((f) => ({
                          ...f,
                          detallesTrabajo: buildDetallesTrabajoTexto(otPresupuestoSeleccionado.pedido?.descripcion, otPresupuestoSeleccionado.items, allIds) || 'Sin detalles especificados',
                        }));
                      }}
                      className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtSelectedItemIds([]);
                        setOtForm((f) => ({
                          ...f,
                          detallesTrabajo: buildDetallesTrabajoTexto(otPresupuestoSeleccionado.pedido?.descripcion, otPresupuestoSeleccionado.items, []) || 'Sin detalles especificados',
                        }));
                      }}
                      className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-white/5">
                  {otPresupuestoSeleccionado.items?.map((it) => {
                    const isChecked = otSelectedItemIds.includes(it.id);
                    const isMat = isMaterialItem(it);
                    return (
                      <label
                        key={it.id}
                        className="flex items-center justify-between gap-3 pt-1.5 pb-1 px-1.5 rounded hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const nextIds = isChecked
                                ? otSelectedItemIds.filter((id) => id !== it.id)
                                : [...otSelectedItemIds, it.id];
                              setOtSelectedItemIds(nextIds);
                              setOtForm((f) => ({
                                ...f,
                                detallesTrabajo: buildDetallesTrabajoTexto(otPresupuestoSeleccionado.pedido?.descripcion, otPresupuestoSeleccionado.items, nextIds) || 'Sin detalles especificados',
                              }));
                            }}
                            className="rounded border-white/20 bg-black/40 text-orange-500 focus:ring-0 cursor-pointer"
                          />
                          <span className={`text-xs truncate ${isChecked ? 'text-slate-200' : 'text-slate-500'}`}>
                            {it.descripcion}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                          <span className="text-slate-400">Cant: {it.cantidad}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${isMat ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                            {it.categoria}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Campos editables */}
            <div className="space-y-4">
              {/* Detalles del trabajo */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-orange-300">Detalles del trabajo</label>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60 min-h-[120px]"
                  value={otForm.detallesTrabajo}
                  onChange={(e) => setOtForm((f) => ({ ...f, detallesTrabajo: e.target.value }))}
                  placeholder="Describa los detalles del trabajo a realizar…"
                />
                <p className="mt-1 text-xs text-slate-500">Se autocompleta con la descripción del pedido e items del presupuesto. Puede editarlo libremente.</p>
              </div>

              {/* Comentarios del cliente */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-orange-300">Comentarios del cliente (opcional)</label>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60 min-h-[60px]"
                  value={otForm.comentarioCliente}
                  onChange={(e) => setOtForm((f) => ({ ...f, comentarioCliente: e.target.value }))}
                  placeholder="Comentarios o instrucciones especiales del cliente…"
                />
              </div>

              {/* Contacto y fechas (solo en modo editar) */}
              {otEditMode === 'editar' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-orange-300">Contacto</label>
                    <input
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60"
                      value={otForm.contacto}
                      onChange={(e) => setOtForm((f) => ({ ...f, contacto: e.target.value }))}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-orange-300">Estado</label>
                    <select
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60"
                      value={otForm.estado}
                      onChange={(e) => setOtForm((f) => ({ ...f, estado: e.target.value }))}
                    >
                      <option value="Generada">Generada</option>
                      <option value="Enviada">Enviada</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Completada">Completada</option>
                      <option value="Cancelada">Cancelada</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-orange-300">Fecha de inicio</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60"
                      value={otForm.fechaInicio}
                      onChange={(e) => setOtForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-orange-300">Fecha para culminar</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60"
                      value={otForm.fechaTope}
                      onChange={(e) => setOtForm((f) => ({ ...f, fechaTope: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vista previa del mensaje (solo en modo generar) */}
            {otData && (
              <div className="mt-4 mb-4">
                <label className="mb-1 block text-xs font-mono text-slate-400">Vista previa del mensaje</label>
                <pre className="whitespace-pre-wrap rounded-md border border-white/10 bg-[#090a0f] px-4 py-3 text-sm text-slate-200">{otData.mensaje}</pre>
              </div>
            )}

            {/* Teléfono (en modo generar y después de generar) */}
            {(otData || (otEditMode === 'generar' && otPresupuestoSeleccionado)) && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-mono text-slate-400">Teléfono del destinatario (opcional)</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-white/10 bg-[#090a0f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/60"
                    value={otTelefono}
                    onChange={(e) => setOtTelefono(e.target.value)}
                    placeholder="Ej: 595981234567 (sin + ni espacios)"
                  />
                  {otData && (
                    <button
                      onClick={() => otData.presupuestoId && handleGenerarOT(otData.presupuestoId)}
                      disabled={otLoading}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {otLoading ? '...' : 'Actualizar'}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">Si no cargás un número, se abre WhatsApp Web sin destinatario definido.</p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {/* Modo generar — botón para generar la OT */}
              {otEditMode === 'generar' && !otData && otPresupuestoSeleccionado && (
                <button
                  onClick={() => handleGenerarOT(otPresupuestoSeleccionado.id)}
                  disabled={otLoading}
                  className="rounded-md border border-orange-500/40 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/30 disabled:opacity-50"
                >
                  {otLoading ? 'Generando…' : 'Generar OT'}
                </button>
              )}
              {otEditMode === 'editar' && (
                <>
                  <button
                    onClick={handleGuardarEdicionOT}
                    disabled={otSaving}
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {otSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  {otEditando && (
                    <button
                      onClick={() => handleEliminarOT(otEditando.id)}
                      className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      Eliminar OT
                    </button>
                  )}
                </>
              )}
              {otData && (
                <>
                  <a
                    href={otData.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleMarcarOTEnviada(otData.otId)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.13c-.24.68-1.42 1.31-1.96 1.31-.53 0-1.22.05-2.04-.27-.47-.19-1.08-.41-1.86-.81-3.27-1.59-5.4-5.28-5.56-5.5-.16-.22-1.33-1.77-1.33-3.38s.85-2.41 1.15-2.74c.3-.33.65-.41.86-.41s.43 0 .62.01c.2.01.47-.08.73.56.24.64.82 2.21.89 2.37.07.16.12.35.02.56-.09.22-.14.35-.27.54-.14.19-.29.42-.41.56-.14.14-.28.29-.12.57.16.27.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.21 1.37.27.14.43.11.59-.06.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.58.75 1.85.89.27.14.45.21.52.33.07.12.07.68-.17 1.36z"/></svg>
                    Abrir WhatsApp
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(otData.mensaje); }}
                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    Copiar mensaje
                  </button>
                  {otData.enviadoWhatsapp && (
                    <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      ✓ Enviada por WhatsApp
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calculadora de Adhesivo y Desperdicio */}
      <CalculadoraAdhesivoModal
        isOpen={showCalculadoraAdhesivo}
        onClose={() => setShowCalculadoraAdhesivo(false)}
        onAplicar={handleAplicarCalculoAdhesivo}
        titulo="Calculadora de Lonas, Impresión y Desperdicio para Presupuesto"
      />
    </div>
  );
}
