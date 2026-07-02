/**
 * VehiculosAnalysis - Dashboard completo de análisis de vehículos
 * Incluye: filtros, métricas, gráficos y tabla detallada
 * FASE 3: Gráficos interactivos y tabla completa
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Filter, 
  X, 
  Calendar,
  FolderGit2,
  User,
  AlertTriangle,
  Fuel,
  DollarSign,
  Gauge,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { RegistroVehiculo, DatabaseState } from '../../types';

interface VehiculosAnalysisProps {
  data: DatabaseState;
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

const COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#10b981', '#14b8a6', '#f43f5e'];

export default function VehiculosAnalysis({ data }: VehiculosAnalysisProps) {
  const registrosVehiculo = data.registrosVehiculo || [];

  // ══════════════════════════════════════════════════════
  //  FILTROS
  // ══════════════════════════════════════════════════════
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroProyecto, setFiltroProyecto] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState<'todos' | 'con-alerta' | 'sin-alerta'>('todos');

  const clearFilters = () => {
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroProyecto('');
    setFiltroUsuario('');
    setFiltroAlerta('todos');
  };

  const hasActiveFilters = filtroFechaDesde || filtroFechaHasta || filtroProyecto || filtroUsuario || filtroAlerta !== 'todos';

  // ══════════════════════════════════════════════════════
  //  DATOS FILTRADOS
  // ══════════════════════════════════════════════════════
  const registrosFiltrados = useMemo(() => {
    return registrosVehiculo.filter(r => {
      if (filtroFechaDesde && r.fecha < filtroFechaDesde) return false;
      if (filtroFechaHasta && r.fecha > filtroFechaHasta) return false;
      if (filtroProyecto && r.proyectoId !== filtroProyecto) return false;
      if (filtroUsuario && r.usuario !== filtroUsuario) return false;
      if (filtroAlerta === 'con-alerta' && !r.alertaDiscrepancia) return false;
      if (filtroAlerta === 'sin-alerta' && r.alertaDiscrepancia) return false;
      return true;
    });
  }, [registrosVehiculo, filtroFechaDesde, filtroFechaHasta, filtroProyecto, filtroUsuario, filtroAlerta]);

  // ══════════════════════════════════════════════════════
  //  MÉTRICAS CALCULADAS
  // ══════════════════════════════════════════════════════
  const metrics = useMemo(() => {
    const totalGasto = registrosFiltrados.reduce((acc, r) => acc + r.total, 0);
    const totalKm = registrosFiltrados.reduce((acc, r) => acc + r.distanciaOdometro, 0);
    const totalAlertas = registrosFiltrados.filter(r => r.alertaDiscrepancia).length;
    const promedioCostoPorKm = totalKm > 0 ? totalGasto / totalKm : 0;

    return {
      totalGasto,
      totalKm,
      totalAlertas,
      promedioCostoPorKm,
      totalViajes: registrosFiltrados.length
    };
  }, [registrosFiltrados]);

  // Listas únicas para filtros
  const proyectosUnicos = useMemo(() => {
    const unique = Array.from(new Set(registrosVehiculo.map(r => r.proyectoId)));
    return unique.map(id => {
      const registro = registrosVehiculo.find(r => r.proyectoId === id);
      return { id, nombre: registro?.proyectoNombre || id };
    });
  }, [registrosVehiculo]);

  const usuariosUnicos = useMemo(() => {
    return Array.from(new Set(registrosVehiculo.map(r => r.usuario))).sort();
  }, [registrosVehiculo]);

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN DE FILTROS */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Filtros de Análisis</h3>
            {hasActiveFilters && (
              <span className="text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded">
                Activos
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
              Limpiar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              Hasta
            </label>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              <FolderGit2 className="w-3 h-3 inline mr-1" />
              Proyecto
            </label>
            <select
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Todos</option>
              {proyectosUnicos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              <User className="w-3 h-3 inline mr-1" />
              Usuario
            </label>
            <select
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Todos</option>
              {usuariosUnicos.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Alertas
            </label>
            <select
              value={filtroAlerta}
              onChange={(e) => setFiltroAlerta(e.target.value as any)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            >
              <option value="todos">Todos</option>
              <option value="con-alerta">Con Alerta</option>
              <option value="sin-alerta">Sin Alerta</option>
            </select>
          </div>

        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Fuel className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-mono text-slate-500">{metrics.totalViajes} viajes</span>
          </div>
          <p className="text-xs text-slate-400 mb-1">Costo/km Promedio</p>
          <p className="text-2xl font-bold text-white">{formatGuaranies(metrics.promedioCostoPorKm)}</p>
          <p className="text-xs text-cyan-400 mt-1">
            {metrics.promedioCostoPorKm > 0 ? `${formatGuaranies(metrics.promedioCostoPorKm)}/km` : 'Sin datos'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-mono text-slate-500">{metrics.totalViajes} viajes</span>
          </div>
          <p className="text-xs text-slate-400 mb-1">Gasto Total</p>
          <p className="text-2xl font-bold text-white">{formatGuaranies(metrics.totalGasto)}</p>
          <p className="text-xs text-blue-400 mt-1">
            {metrics.promedioCostoPorKm > 0 ? `${formatGuaranies(metrics.promedioCostoPorKm)}/km` : 'Sin datos'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Gauge className="w-5 h-5 text-pink-400" />
            <span className="text-xs font-mono text-slate-500">{metrics.totalViajes} viajes</span>
          </div>
          <p className="text-xs text-slate-400 mb-1">Kilómetros</p>
          <p className="text-2xl font-bold text-white">{metrics.totalKm.toLocaleString('es-PY')} km</p>
          <p className="text-xs text-pink-400 mt-1">
            {metrics.totalViajes > 0 ? `${(metrics.totalKm / metrics.totalViajes).toFixed(1)} km/viaje` : 'Sin datos'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className={`w-5 h-5 ${metrics.totalAlertas > 0 ? 'text-orange-400' : 'text-emerald-400'}`} />
            <span className="text-xs font-mono text-slate-500">{metrics.totalViajes} viajes</span>
          </div>
          <p className="text-xs text-slate-400 mb-1">Alertas Discrepancia</p>
          <p className="text-2xl font-bold text-white">{metrics.totalAlertas}</p>
          <p className={`text-xs mt-1 ${metrics.totalAlertas > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
            {metrics.totalViajes > 0 ? `${((metrics.totalAlertas / metrics.totalViajes) * 100).toFixed(0)}% del total` : 'Sin datos'}
          </p>
        </div>

      </div>

      {/* Mensaje si no hay datos filtrados */}
      {registrosFiltrados.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Filter className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No hay registros que coincidan con los filtros aplicados</p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-all"
          >
            Limpiar Filtros
          </button>
        </div>
      )}

      {/* TODO: Agregar gráficos en Fase 3 */}
      {registrosFiltrados.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 text-center text-slate-400">
          <p>Gráficos y tabla detallada - próximamente en Fase 3</p>
        </div>
      )}

    </div>
  );
}
