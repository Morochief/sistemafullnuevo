/**
 * Reportería & Pre-Facturación Module - Sistema aFull
 * Glass & Glow Bento Aesthetic
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileDown,
  Filter,
  Receipt,
  TrendingUp,
  Calculator,
  Printer,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Percent,
  Package,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DatabaseState, RegistroItem } from '../types.ts';

interface ReportesProps {
  data: DatabaseState;
  markupRate: number;
  onMarkupChange: (rate: number) => void;
}

function formatGuaranies(value: number): string {
  // Formato paraguayo: Gs. 180.000 (sin decimales, punto para miles)
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

// Función para convertir minutos a formato HH:MM
function formatMinutosToHHMM(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export default function Reportes({ data, markupRate, onMarkupChange }: ReportesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'reportes' | 'prefactura'>('reportes');

  // Filtros
  const [filterCliente, setFilterCliente] = useState('');
  const [filterProyecto, setFilterProyecto] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterConcepto, setFilterConcepto] = useState('');

  // Pre-factura
  const [filterClienteFactura, setFilterClienteFactura] = useState('');
  const [selectedProyectoFactura, setSelectedProyectoFactura] = useState('');
  const [customMarkup, setCustomMarkup] = useState(markupRate * 100);

  // --- UNIFIED DATA: MO/Insumos + Vehículos ---
  const unifiedRegistros = useMemo(() => {
    const vehicleAsRegistros: RegistroItem[] = (data.registrosVehiculo || []).map(v => ({
      id: v.id,
      clienteId: v.clienteId,
      clienteNombre: v.clienteNombre,
      proyectoId: v.proyectoId,
      proyectoNombre: v.proyectoNombre,
      fecha: v.fecha,
      concepto: 'Vehículo',
      descripcion: `Viaje: ${v.proyectoNombre} - ${v.distanciaOdometro}km`,
      cantidad: v.distanciaOdometro,
      precioUnitario: v.distanciaOdometro > 0 ? Math.round(v.total / v.distanciaOdometro) : 0,
      total: v.total,
      hsInicio: undefined,
      hsFin: undefined,
      hsTotal: undefined,
      origen: v.origen,
      fechaImportacion: v.fechaImportacion,
    }));
    return [...data.registros, ...vehicleAsRegistros];
  }, [data.registros, data.registrosVehiculo]);

  // --- FILTER LOGIC (ITEM 15: Sincronización robusta ID y Nombre) ---
  const filteredRegistros = useMemo(() => {
    const selectedClienteObj = data.clientes.find(c => c.id === filterCliente);
    const selectedProyectoObj = data.proyectos.find(p => p.id === filterProyecto);

    return unifiedRegistros.filter(r => {
      if (filterCliente) {
        const matchesId = r.clienteId === filterCliente;
        const matchesName = selectedClienteObj && r.clienteNombre.trim().toLowerCase() === selectedClienteObj.nombre.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (filterProyecto) {
        const matchesId = r.proyectoId === filterProyecto;
        const matchesName = selectedProyectoObj && r.proyectoNombre.trim().toLowerCase() === selectedProyectoObj.nombre.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (filterConcepto && r.concepto !== filterConcepto) return false;
      if (filterFechaDesde && r.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && r.fecha > filterFechaHasta) return false;
      return true;
    });
  }, [unifiedRegistros, filterCliente, filterProyecto, filterConcepto, filterFechaDesde, filterFechaHasta, data.clientes, data.proyectos]);

  const totalFiltrado = useMemo(() => filteredRegistros.reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);
  const totalMOFiltrado = useMemo(() => filteredRegistros.filter(r => r.concepto === 'MO').reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);
  const totalInsumoFiltrado = useMemo(() => filteredRegistros.filter(r => r.concepto === 'Insumo').reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);

  // --- DESGLOSE DE INSUMOS POR PROYECTO & PROMEDIO (ITEM 16) ---
  const insumosPorProyecto = useMemo(() => {
    const map = new Map<string, {
      proyectoId: string;
      proyectoNombre: string;
      clienteNombre: string;
      totalInsumos: number;
      cantidadItems: number;
    }>();

    filteredRegistros
      .filter(r => r.concepto === 'Insumo')
      .forEach(r => {
        const key = r.proyectoId || r.proyectoNombre;
        const current = map.get(key) || {
          proyectoId: r.proyectoId,
          proyectoNombre: r.proyectoNombre,
          clienteNombre: r.clienteNombre,
          totalInsumos: 0,
          cantidadItems: 0,
        };
        current.totalInsumos += r.total;
        current.cantidadItems += 1;
        map.set(key, current);
      });

    return Array.from(map.values())
      .filter(item => item.totalInsumos > 0)
      .sort((a, b) => b.totalInsumos - a.totalInsumos);
  }, [filteredRegistros]);

  const totalInsumosTodosProyectos = useMemo(() => {
    return insumosPorProyecto.reduce((acc, p) => acc + p.totalInsumos, 0);
  }, [insumosPorProyecto]);

  const promedioInsumosPorProyecto = useMemo(() => {
    if (insumosPorProyecto.length === 0) return 0;
    return totalInsumosTodosProyectos / insumosPorProyecto.length;
  }, [insumosPorProyecto, totalInsumosTodosProyectos]);

  const clearFilters = () => {
    setFilterCliente('');
    setFilterProyecto('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterConcepto('');
  };

  // --- EXPORT TO EXCEL ---
  const sanitizeCell = (value: any): any => {
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
    return value;
  };

  const handleExportExcel = () => {
    const exportData = filteredRegistros.map(r => ({
      'Cliente': sanitizeCell(r.clienteNombre),
      'Proyecto': sanitizeCell(r.proyectoNombre),
      'Fecha': sanitizeCell(r.fecha),
      'Concepto': sanitizeCell(r.concepto),
      'Descripción': sanitizeCell(r.descripcion),
      'Hs Inicio': sanitizeCell(r.hsInicio || ''),
      'Hs Fin': sanitizeCell(r.hsFin || ''),
      'Hs Total': sanitizeCell(r.hsTotal || ''),
      'Cantidad': r.cantidad,
      'Precio Unitario': r.precioUnitario,
      'Total': r.total,
      'Origen': sanitizeCell(r.origen),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');

    // Item 16: Agregar pestaña resumen de insumos por proyecto si existen
    if (insumosPorProyecto.length > 0) {
      const insumosData = insumosPorProyecto.map(item => ({
        'Proyecto': sanitizeCell(item.proyectoNombre),
        'Cliente': sanitizeCell(item.clienteNombre),
        'Ítems de Insumo': item.cantidadItems,
        'Total Insumos (Gs.)': item.totalInsumos,
        '% del Total Insumos': Number(((item.totalInsumos / Math.max(1, totalInsumosTodosProyectos)) * 100).toFixed(1))
      }));
      const wsInsumos = XLSX.utils.json_to_sheet(insumosData);
      XLSX.utils.book_append_sheet(wb, wsInsumos, 'Insumos por Proyecto');
    }

    // Auto-fit columns
    const maxWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(r => String((r as any)[key] || '').length))
    }));
    ws['!cols'] = maxWidths;

    const filename = `reporte_afull_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // --- EXPORT TO PRINT (PDF) ---
  const handlePrint = () => window.print();

  // --- PRE-FACTURA LOGIC ---
  const clientesMap = useMemo(() => new Map(data.clientes.map(c => [c.id, c])), [data.clientes]);
  const proyectoFactura = data.proyectos.find(p => p.id === selectedProyectoFactura);
  const clienteFactura = proyectoFactura ? clientesMap.get(proyectoFactura.clienteId) || null : null;

  const registrosFactura = useMemo(() => {
    if (!selectedProyectoFactura) return [];
    const proj = data.proyectos.find(p => p.id === selectedProyectoFactura);
    return unifiedRegistros.filter(r => {
      const matchId = r.proyectoId === selectedProyectoFactura;
      const matchName = proj && r.proyectoNombre.trim().toLowerCase() === proj.nombre.trim().toLowerCase();
      return matchId || matchName;
    });
  }, [unifiedRegistros, selectedProyectoFactura, data.proyectos]);

  const costoBaseFactura = useMemo(() => registrosFactura.reduce((acc, r) => acc + r.total, 0), [registrosFactura]);
  const markupDecimal = customMarkup / 100;
  const montoMarkup = costoBaseFactura * markupDecimal;
  const precioVentaFactura = costoBaseFactura + montoMarkup;

  const facturaBreakdown = useMemo(() => {
    let mo = 0, ins = 0, veh = 0, otros = 0;
    for (const r of registrosFactura) {
      if (r.concepto === 'MO') mo += r.total;
      else if (r.concepto === 'Insumo') ins += r.total;
      else if (r.concepto === 'Vehículo') veh += r.total;
      else otros += r.total;
    }
    return { moFactura: mo, insumosFactura: ins, vehiculosFactura: veh, otrosFactura: otros };
  }, [registrosFactura]);

  const { moFactura, insumosFactura, vehiculosFactura, otrosFactura } = facturaBreakdown;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Reportería & Facturación
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Exportá reportes filtrados y generá pre-facturas con markup configurable.
          </p>
        </div>

        {/* Sub-tabs */}
        <nav className="flex bg-[#0f172a]/50 border border-white/5 p-1 rounded-md">
          <button
            onClick={() => setActiveSubTab('reportes')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'reportes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => setActiveSubTab('prefactura')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'prefactura'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Pre-Factura</span>
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {/* =================== TAB: REPORTES =================== */}
        {activeSubTab === 'reportes' && (
          <motion.div
            key="reportes"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Filter Panel */}
            <div className="glass-panel rounded-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-400" /> Filtros Avanzados
                </h3>
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Limpiar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {/* Filter: Cliente */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Cliente</label>
                  <select
                    value={filterCliente}
                    onChange={e => { setFilterCliente(e.target.value); setFilterProyecto(''); }}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-xs"
                  >
                    <option value="">Todos los Clientes</option>
                    {data.clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Filter: Proyecto */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Proyecto</label>
                  <select
                    value={filterProyecto}
                    onChange={e => setFilterProyecto(e.target.value)}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-xs"
                  >
                    <option value="">Todos los Proyectos</option>
                    {data.proyectos
                      .filter(p => !filterCliente || p.clienteId === filterCliente)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                  </select>
                </div>

                {/* Filter: Concepto */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Concepto</label>
                  <select
                    value={filterConcepto}
                    onChange={e => setFilterConcepto(e.target.value)}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-xs"
                  >
                    <option value="">Todos</option>
                    <option value="MO">Mano de Obra</option>
                    <option value="Insumo">Insumos</option>
                    <option value="Vehículo">Vehículos</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Filter: Fecha Desde */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={filterFechaDesde}
                    onChange={e => setFilterFechaDesde(e.target.value)}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-xs"
                  />
                </div>

                {/* Filter: Fecha Hasta */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={filterFechaHasta}
                    onChange={e => setFilterFechaHasta(e.target.value)}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel rounded-md p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Total Filtrado</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalFiltrado)}</p>
                  <p className="text-xs text-slate-500">{filteredRegistros.length} registros</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="glass-panel rounded-md p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-orange-400">Mano de Obra</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalMOFiltrado)}</p>
                  <p className="text-xs text-slate-500">
                    {totalFiltrado > 0 ? ((totalMOFiltrado / totalFiltrado) * 100).toFixed(0) : 0}% del total
                  </p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-md border border-orange-500/20 text-orange-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="glass-panel rounded-md p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Insumos</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalInsumoFiltrado)}</p>
                  <p className="text-xs text-slate-500">
                    {totalFiltrado > 0 ? ((totalInsumoFiltrado / totalFiltrado) * 100).toFixed(0) : 0}% del total
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-md border border-amber-500/20 text-amber-400">
                  <Calculator className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Item 16: Desglose de Insumos por Proyecto y Promedio */}
            <div className="glass-panel rounded-md p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-amber-500/10 rounded-md border border-amber-500/20 text-amber-400">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Desglose de Insumos y Costos por Proyecto
                    </h3>
                    <p className="text-xs text-slate-400">
                      Consumo de materiales por obra y promedio general calculado.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-md">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Proyectos con Insumos
                    </span>
                    <span className="text-base font-bold text-white font-mono">
                      {insumosPorProyecto.length}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                      Promedio por Proyecto
                    </span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {formatGuaranies(promedioInsumosPorProyecto)}
                    </span>
                  </div>
                </div>
              </div>

              {insumosPorProyecto.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-mono">
                  No hay registros de insumos para los filtros seleccionados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 text-xs uppercase font-mono tracking-wider">
                        <th className="py-2.5 px-3">Proyecto / Cliente</th>
                        <th className="py-2.5 px-3 text-center w-[120px]">Ítems Insumo</th>
                        <th className="py-2.5 px-3 text-right w-[160px]">Total Insumos</th>
                        <th className="py-2.5 px-3 text-right w-[140px]">% del Total Insumos</th>
                        <th className="py-2.5 px-3 w-[180px]">Proporción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans text-xs">
                      {insumosPorProyecto.map(item => {
                        const pct = totalInsumosTodosProyectos > 0 
                          ? (item.totalInsumos / totalInsumosTodosProyectos) * 100 
                          : 0;
                        return (
                          <tr key={item.proyectoId || item.proyectoNombre} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{item.proyectoNombre}</div>
                              <div className="text-[11px] text-slate-400">Cliente: {item.clienteNombre}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-300">
                              {item.cantidadItems}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                              {formatGuaranies(item.totalInsumos)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              {pct.toFixed(1)}%
                            </td>
                            <td className="py-3 px-3">
                              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                                <div 
                                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/[0.02] font-mono text-xs font-bold">
                        <td className="py-3 px-3 text-slate-300">
                          TOTAL INSUMOS ({insumosPorProyecto.length} proyectos)
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {insumosPorProyecto.reduce((acc, p) => acc + p.cantidadItems, 0)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-400">
                          {formatGuaranies(totalInsumosTodosProyectos)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">100%</td>
                        <td className="py-3 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex gap-3 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleExportExcel}
                disabled={filteredRegistros.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-md bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-orange-500/20 border border-white/10 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Exportar a Excel (.xlsx)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePrint}
                disabled={filteredRegistros.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-md glass-panel hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white font-semibold text-sm border-white/10 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Guardar PDF
              </motion.button>
            </div>

            {/* Registros Table */}
            <div className="glass-panel rounded-xl p-6 shadow-xl">
              <h3 className="text-sm font-semibold text-white mb-4">
                Vista Previa del Reporte ({filteredRegistros.length} registros)
              </h3>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f14]/80 backdrop-blur-sm shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#090a0f] text-slate-400 text-xs uppercase font-mono tracking-wider">
                        <th className="px-4 py-3.5 font-medium whitespace-nowrap w-[120px]">Concepto</th>
                        <th className="px-4 py-3.5 font-medium min-w-[200px]">Cliente / Proyecto</th>
                        <th className="px-4 py-3.5 font-medium whitespace-nowrap w-[130px]">Fecha</th>
                        <th className="px-4 py-3.5 font-medium min-w-[280px]">Descripción</th>
                        <th className="px-4 py-3.5 font-medium text-right whitespace-nowrap w-[120px]">Cant.</th>
                        <th className="px-4 py-3.5 font-medium text-right whitespace-nowrap w-[140px]">P. Unit.</th>
                        <th className="px-4 py-3.5 font-medium text-right whitespace-nowrap w-[150px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans">
                      {filteredRegistros.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm font-mono">
                            Sin registros para los filtros seleccionados
                          </td>
                        </tr>
                      ) : (
                        filteredRegistros.map(reg => (
                          <tr key={reg.id} className="hover:bg-white/[0.03] text-sm transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold ${
                                reg.concepto === 'MO'
                                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {reg.concepto}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle min-w-[200px]">
                              <div className="font-semibold text-white text-xs leading-snug line-clamp-1" title={reg.clienteNombre}>{reg.clienteNombre}</div>
                              <div className="text-[11px] text-slate-400 leading-snug flex items-center gap-1 mt-0.5 line-clamp-1" title={reg.proyectoNombre}>
                                <span className="text-slate-600">↳</span>
                                {reg.proyectoNombre}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                              <span className="inline-block text-xs font-mono text-slate-300 bg-white/[0.03] px-2.5 py-1 rounded border border-white/5">
                                {reg.fecha}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle min-w-[280px]">
                              <p className="text-xs text-slate-200 leading-relaxed break-words line-clamp-2 hover:line-clamp-none transition-all cursor-default" title={reg.descripcion}>
                                {reg.descripcion}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-slate-300 text-xs whitespace-nowrap align-middle">
                              {reg.concepto === 'MO' && reg.cantidad ? formatMinutosToHHMM(reg.cantidad) : Math.round(reg.cantidad).toLocaleString('es-PY')}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-slate-300 text-xs whitespace-nowrap align-middle">
                              {formatGuaranies(reg.precioUnitario)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-white font-bold text-xs whitespace-nowrap align-middle">
                              {formatGuaranies(reg.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredRegistros.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-white/10 bg-white/[0.02]">
                          <td colSpan={6} className="px-4 py-3.5 text-right text-xs font-mono text-slate-400 font-medium">TOTAL GENERAL</td>
                          <td className="px-4 py-3.5 text-right font-mono text-white font-bold text-sm whitespace-nowrap">{formatGuaranies(totalFiltrado)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* =================== TAB: PRE-FACTURA =================== */}
        {activeSubTab === 'prefactura' && (
          <motion.div
            key="prefactura"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Config Panel (Item 15: Sincronización Cliente -> Proyecto) */}
            <div className="glass-panel rounded-md p-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
                <Calculator className="w-4 h-4 text-amber-400" />
                Configurar Simulación de Pre-Factura
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Selector de Cliente */}
                <div>
                  <label htmlFor="prefactura-filtro-cliente" className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                    1. Filtrar por Cliente
                  </label>
                  <select
                    id="prefactura-filtro-cliente"
                    aria-label="Filtrar por Cliente"
                    value={filterClienteFactura}
                    onChange={e => {
                      const newCliente = e.target.value;
                      setFilterClienteFactura(newCliente);
                      if (newCliente) {
                        const proj = data.proyectos.find(p => p.id === selectedProyectoFactura);
                        if (proj && proj.clienteId !== newCliente) {
                          setSelectedProyectoFactura('');
                        }
                      }
                    }}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-sm"
                  >
                    <option value="">-- Todos los Clientes --</option>
                    {data.clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Selector de Proyecto (Filtrado según cliente elegido) */}
                <div>
                  <label htmlFor="prefactura-selector-proyecto" className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                    2. Seleccionar Proyecto
                  </label>
                  <select
                    id="prefactura-selector-proyecto"
                    aria-label="Seleccionar Proyecto"
                    value={selectedProyectoFactura}
                    onChange={e => {
                      const newProjId = e.target.value;
                      setSelectedProyectoFactura(newProjId);
                      if (newProjId) {
                        const proj = data.proyectos.find(p => p.id === newProjId);
                        if (proj && proj.clienteId) {
                          setFilterClienteFactura(proj.clienteId);
                        }
                      }
                    }}
                    className="glass-select w-full rounded-md px-3 py-2.5 text-sm"
                  >
                    <option value="">-- Seleccionar Proyecto --</option>
                    {data.proyectos
                      .filter(p => !filterClienteFactura || p.clienteId === filterClienteFactura)
                      .map(p => {
                        const cliente = clientesMap.get(p.clienteId);
                        return (
                          <option key={p.id} value={p.id}>
                            {cliente ? `[${cliente.nombre}] ` : ''}{p.nombre}
                          </option>
                        );
                      })}
                  </select>
                </div>

                {/* 3. Markup Rate */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                    3. Markup / Rentabilidad (%)
                  </label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={customMarkup}
                      onChange={e => setCustomMarkup(Math.max(0, parseFloat(e.target.value) || 0))}
                      min="0"
                      max="500"
                      step="5"
                      className="glass-select w-full rounded-md pl-9 pr-4 py-2.5 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                    Markup global actual: {(markupRate * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Pre-Factura Preview */}
            {!selectedProyectoFactura ? (
              <div className="glass-panel rounded-md p-12 text-center">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Seleccioná un proyecto para generar la pre-factura</p>
              </div>
            ) : (
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel rounded-md p-8 space-y-6 shadow-xl"
                  id="prefactura-content"
                >
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start border-b border-white/10 pb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-md flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">PRE-FACTURA DE LIQUIDACIÓN</p>
                          <p className="text-xs font-mono text-slate-400">Comprobante Interno #{Date.now().toString().slice(-6)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">Fecha Emisión: {new Date().toLocaleDateString('es-PY')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase font-mono tracking-wider mb-0.5">Cliente</p>
                      <p className="font-bold text-white text-base">{clienteFactura?.nombre || 'N/A'}</p>
                      <p className="text-xs text-slate-400 uppercase font-mono tracking-wider mt-2 mb-0.5">Proyecto</p>
                      <p className="text-sm font-semibold text-slate-200 max-w-[280px] text-right">{proyectoFactura?.nombre}</p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="space-y-3">
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Resumen Consolidado de Costos</p>
                    {[
                      { label: 'Mano de Obra (MO)', value: moFactura, color: 'text-orange-400' },
                      { label: 'Insumos y Materiales', value: insumosFactura, color: 'text-amber-400' },
                      { label: 'Vehículos y Logística', value: vehiculosFactura, color: 'text-pink-400' },
                      { label: 'Otros Gastos', value: otrosFactura, color: 'text-slate-400' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className={`text-sm ${item.color}`}>{item.label}</span>
                        <span className="font-mono text-white text-sm font-semibold">{formatGuaranies(item.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 border-t border-white/10">
                      <span className="text-sm text-slate-200 font-semibold">Subtotal Costos Operativos</span>
                      <span className="font-mono font-bold text-white text-base">{formatGuaranies(costoBaseFactura)}</span>
                    </div>
                  </div>

                  {/* Markup Calculation */}
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-5 space-y-3">
                    <p className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> Aplicación de Margen Comercial / Rentabilidad ({customMarkup}%)
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Costo Base Liquidado</span>
                      <span className="font-mono text-slate-300">{formatGuaranies(costoBaseFactura)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">+ Margen Comercial ({customMarkup}%)</span>
                      <span className="font-mono text-amber-400 font-semibold">+ {formatGuaranies(montoMarkup)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-amber-500/20 pt-3">
                      <span className="text-white uppercase tracking-wider">PRECIO TOTAL SUGERIDO AL CLIENTE</span>
                      <span className="font-mono text-amber-400 text-2xl font-bold">{formatGuaranies(precioVentaFactura)}</span>
                    </div>
                  </div>

                  {/* Items Detail Table (Item 17: Pre-factura limpia y completa) */}
                  {registrosFactura.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        Detalle de {registrosFactura.length} ítems
                      </p>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto border border-white/10 rounded-md bg-white/[0.01]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 font-mono">
                              <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Tipo</th>
                              <th className="py-2.5 px-3 min-w-[200px]">Descripción / Tarea</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">Cant / Hs</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">P. Unitario</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-sans">
                            {registrosFactura.map(r => (
                              <tr key={r.id} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">{r.fecha}</td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className="font-mono font-semibold text-[11px] text-amber-400">{r.concepto}</span>
                                </td>
                                <td className="py-2 px-3 text-slate-200">{r.descripcion}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                                  {r.concepto === 'MO' && r.cantidad ? formatMinutosToHHMM(r.cantidad) : Math.round(r.cantidad).toLocaleString('es-PY')}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                                  {formatGuaranies(r.precioUnitario)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                                  {formatGuaranies(r.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Action Buttons (Excluded from print) */}
                <div className="flex gap-3 pt-2 no-print">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-3 rounded-md bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 border border-white/10 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir / Guardar PDF (A4)
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onMarkupChange(markupDecimal)}
                    className="flex items-center gap-2 px-5 py-3 rounded-md glass-panel hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm border-white/10 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar Markup Global
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



