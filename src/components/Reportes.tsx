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
  ChevronDown,
  X,
  Printer,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Percent,
  Building2,
  FolderGit2,
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
      concepto: 'Vehículo' as any,
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

  // --- FILTER LOGIC ---
  const filteredRegistros = useMemo(() => {
    return unifiedRegistros.filter(r => {
      if (filterCliente && r.clienteId !== filterCliente) return false;
      if (filterProyecto && r.proyectoId !== filterProyecto) return false;
      if (filterConcepto && r.concepto !== filterConcepto) return false;
      if (filterFechaDesde && r.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && r.fecha > filterFechaHasta) return false;
      return true;
    });
  }, [unifiedRegistros, filterCliente, filterProyecto, filterConcepto, filterFechaDesde, filterFechaHasta]);

  const totalFiltrado = useMemo(() => filteredRegistros.reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);
  const totalMOFiltrado = useMemo(() => filteredRegistros.filter(r => r.concepto === 'MO').reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);
  const totalInsumoFiltrado = useMemo(() => filteredRegistros.filter(r => r.concepto === 'Insumo').reduce((acc, r) => acc + r.total, 0), [filteredRegistros]);

  const clearFilters = () => {
    setFilterCliente('');
    setFilterProyecto('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterConcepto('');
  };

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    const exportData = filteredRegistros.map(r => ({
      'Cliente': r.clienteNombre,
      'Proyecto': r.proyectoNombre,
      'Fecha': r.fecha,
      'Concepto': r.concepto,
      'Descripción': r.descripcion,
      'Hs Inicio': r.hsInicio || '',
      'Hs Fin': r.hsFin || '',
      'Hs Total': r.hsTotal || '',
      'Cantidad': r.cantidad,
      'Precio Unitario': r.precioUnitario,
      'Total': r.total,
      'Origen': r.origen,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');

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
  const proyectoFactura = data.proyectos.find(p => p.id === selectedProyectoFactura);
  const clienteFactura = proyectoFactura ? data.clientes.find(c => c.id === proyectoFactura.clienteId) : null;

  const registrosFactura = useMemo(() => {
    if (!selectedProyectoFactura) return [];
    return unifiedRegistros.filter(r => r.proyectoId === selectedProyectoFactura);
  }, [unifiedRegistros, selectedProyectoFactura]);

  const costoBaseFactura = useMemo(() => registrosFactura.reduce((acc, r) => acc + r.total, 0), [registrosFactura]);
  const markupDecimal = customMarkup / 100;
  const montoMarkup = costoBaseFactura * markupDecimal;
  const precioVentaFactura = costoBaseFactura + montoMarkup;

  const moFactura = registrosFactura.filter(r => r.concepto === 'MO').reduce((a, r) => a + r.total, 0);
  const insumosFactura = registrosFactura.filter(r => r.concepto === 'Insumo').reduce((a, r) => a + r.total, 0);
  const vehiculosFactura = registrosFactura.filter(r => r.concepto === 'Vehículo').reduce((a, r) => a + r.total, 0);
  const otrosFactura = registrosFactura.filter(r => r.concepto === 'Otros').reduce((a, r) => a + r.total, 0);

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
        <nav className="flex bg-[#0f172a]/50 border border-white/5 p-1 rounded-xl">
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
            <div className="glass-panel rounded-2xl p-6">
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
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-xs"
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
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-xs"
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
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-xs"
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
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-xs"
                  />
                </div>

                {/* Filter: Fecha Hasta */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={filterFechaHasta}
                    onChange={e => setFilterFechaHasta(e.target.value)}
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Total Filtrado</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalFiltrado)}</p>
                  <p className="text-xs text-slate-500">{filteredRegistros.length} registros</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-blue-400">Mano de Obra</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalMOFiltrado)}</p>
                  <p className="text-xs text-slate-500">
                    {totalFiltrado > 0 ? ((totalMOFiltrado / totalFiltrado) * 100).toFixed(0) : 0}% del total
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Insumos</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatGuaranies(totalInsumoFiltrado)}</p>
                  <p className="text-xs text-slate-500">
                    {totalFiltrado > 0 ? ((totalInsumoFiltrado / totalFiltrado) * 100).toFixed(0) : 0}% del total
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                  <Calculator className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-3 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleExportExcel}
                disabled={filteredRegistros.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 border border-white/10 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Exportar a Excel (.xlsx)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePrint}
                disabled={filteredRegistros.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl glass-panel hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white font-semibold text-sm border-white/10 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Guardar PDF
              </motion.button>
            </div>

            {/* Registros Table */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                Vista Previa del Reporte ({filteredRegistros.length} registros)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400 text-xs uppercase font-mono tracking-wider">
                      <th className="pb-3 font-medium">Concepto</th>
                      <th className="pb-3 font-medium">Cliente / Proyecto</th>
                      <th className="pb-3 font-medium">Fecha</th>
                      <th className="pb-3 font-medium">Descripción</th>
                      <th className="pb-3 font-medium text-right">Cant.</th>
                      <th className="pb-3 font-medium text-right">P. Unit.</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegistros.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 text-sm font-mono">
                          Sin registros para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      filteredRegistros.map(reg => (
                        <tr key={reg.id} className="border-b border-white/5 hover:bg-white/2 text-sm transition-colors">
                          <td className="py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                              reg.concepto === 'MO'
                                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            }`}>
                              {reg.concepto}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-white text-xs truncate max-w-[180px]">{reg.clienteNombre}</div>
                            <div className="text-slate-400 text-[10px] truncate max-w-[180px]">{reg.proyectoNombre}</div>
                          </td>
                          <td className="py-3 text-xs font-mono text-slate-300">{reg.fecha}</td>
                          <td className="py-3 text-xs text-slate-300 max-w-[200px] truncate">{reg.descripcion}</td>
                          <td className="py-3 text-right font-mono text-slate-300 text-xs">
                            {reg.concepto === 'MO' && reg.cantidad ? formatMinutosToHHMM(reg.cantidad) : Math.round(reg.cantidad).toLocaleString('es-PY')}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-300 text-xs">
                            {formatGuaranies(reg.precioUnitario)}
                          </td>
                          <td className="py-3 text-right font-mono text-white font-semibold text-xs">
                            {formatGuaranies(reg.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredRegistros.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-white/10">
                        <td colSpan={6} className="pt-3 text-right text-xs font-mono text-slate-400 pr-2">TOTAL</td>
                        <td className="pt-3 text-right font-mono text-white font-bold">{formatGuaranies(totalFiltrado)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
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
            {/* Config Panel */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
                <Calculator className="w-4 h-4 text-amber-400" />
                Configurar Simulación de Pre-Factura
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Seleccionar Proyecto
                  </label>
                  <select
                    value={selectedProyectoFactura}
                    onChange={e => setSelectedProyectoFactura(e.target.value)}
                    className="glass-select w-full rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="">-- Seleccionar Proyecto --</option>
                    {data.proyectos.map(p => {
                      const cliente = data.clientes.find(c => c.id === p.clienteId);
                      return (
                        <option key={p.id} value={p.id}>
                          [{cliente?.nombre || '?'}] {p.nombre}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Markup / Rentabilidad (%)
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
                      className="glass-select w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 font-mono">
                    Markup global actual: {(markupRate * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Pre-Factura Preview */}
            {!selectedProyectoFactura ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Seleccioná un proyecto para generar la pre-factura</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel rounded-3xl p-8 space-y-6"
                id="prefactura-content"
              >
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b border-white/10 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Pre-Factura</p>
                        <p className="text-xs font-mono text-slate-500">#{Date.now().toString().slice(-6)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{new Date().toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">Cliente</p>
                    <p className="font-bold text-white text-sm">{clienteFactura?.nombre || 'N/A'}</p>
                    <p className="text-xs text-slate-400 mt-2">Proyecto</p>
                    <p className="text-xs text-slate-300 max-w-[200px] text-right">{proyectoFactura?.nombre}</p>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="space-y-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Desglose de Costos</p>
                  {[
                    { label: 'Mano de Obra (MO)', value: moFactura, color: 'text-blue-400' },
                    { label: 'Insumos y Materiales', value: insumosFactura, color: 'text-cyan-400' },
                    { label: 'Vehículos', value: vehiculosFactura, color: 'text-amber-400' },
                    { label: 'Otros', value: otrosFactura, color: 'text-slate-400' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className={`text-sm ${item.color}`}>{item.label}</span>
                      <span className="font-mono text-white text-sm">{formatGuaranies(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-300 font-medium">Subtotal Costos</span>
                    <span className="font-mono font-bold text-white">{formatGuaranies(costoBaseFactura)}</span>
                  </div>
                </div>

                {/* Markup Calculation */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Percent className="w-3 h-3" /> Aplicación de Markup ({customMarkup}%)
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Costo Base</span>
                    <span className="font-mono text-slate-300">{formatGuaranies(costoBaseFactura)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">+ Markup ({customMarkup}%)</span>
                    <span className="font-mono text-amber-300">+ {formatGuaranies(montoMarkup)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-amber-500/20 pt-3">
                    <span className="text-white">PRECIO DE VENTA</span>
                    <span className="font-mono text-amber-400 text-xl">{formatGuaranies(precioVentaFactura)}</span>
                  </div>
                </div>

                {/* Items Detail */}
                {registrosFactura.length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                      Detalle de {registrosFactura.length} ítems
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {registrosFactura.map(r => (
                        <div key={r.id} className="flex justify-between text-xs text-slate-400 py-1.5 border-b border-white/5">
                          <span className="truncate max-w-[60%]">{r.descripcion}</span>
                          <span className="font-mono shrink-0">{formatGuaranies(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 border border-white/10 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Generar PDF
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onMarkupChange(markupDecimal)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl glass-panel hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm border-white/10 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar Markup Global
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



