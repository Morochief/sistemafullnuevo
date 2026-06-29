/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Users, 
  Clock, 
  Wallet, 
  TrendingUp, 
  Layers, 
  FileSpreadsheet, 
  Hammer,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,  // FASE 5: Icono para búsqueda global
  Edit  // Icono para editar
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
  Area 
} from 'recharts';
import { DatabaseState, RegistroItem } from '../types.ts';
import VehiculosStats from './vehiculos/VehiculosStats.tsx';

// Función de formateo para Guaraníes paraguayos
function formatGuaranies(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

// Función para convertir minutos a formato HH:MM
function formatMinutosToHHMM(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Función para convertir HH:MM a minutos
function parseHHMMToMinutos(hhmm: string): number {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return 0;
  const horas = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return horas * 60 + mins;
}

interface DashboardProps {
  data: DatabaseState;
  onNavigateImport: () => void;
  onDeleteRegistro: (id: string) => void;
  onEditRegistro: (id: string, updatedData: any) => Promise<boolean>;
  onNavigateToVehicleEdit?: (vehicleId: string) => void;
}

const COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#10b981', '#14b8a6', '#f43f5e'];

// FASE 4: Tipos para ordenamiento
type SortField = 'fecha' | 'clienteNombre' | 'proyectoNombre' | 'concepto' | 'total' | 'precioUnitario' | 'cantidad';
type SortOrder = 'asc' | 'desc';

export default function Dashboard({ data, onNavigateImport, onDeleteRegistro, onEditRegistro, onNavigateToVehicleEdit }: DashboardProps) {
  
  // Estado para el modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroItem | null>(null);
  const [editForm, setEditForm] = useState({
    clienteId: '',
    proyectoId: '',
    fecha: '',
    concepto: 'MO' as 'MO' | 'Insumo',
    descripcion: '',
    cantidad: '',
    cantidadDisplay: '', // Para HH:MM en MO
    precioUnitario: '',
    total: ''
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // FASE 1: Estados de filtros
  const [filterCliente, setFilterCliente] = useState('');
  const [filterProyecto, setFilterProyecto] = useState('');
  const [filterConcepto, setFilterConcepto] = useState<'' | 'MO' | 'Insumo' | 'Vehículo'>(''); // '', 'MO', 'Insumo', 'Vehículo'
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

  // FASE 5: Estado de búsqueda global
  const [searchQuery, setSearchQuery] = useState('');

  // FASE 3: Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // FASE 4: Estados de ordenamiento (fecha descendente por defecto = más recientes primero)
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Ref para scroll automático al top de la tabla
  const tableRef = useRef<HTMLDivElement>(null);

  // Handler para abrir modal de edición
  const handleOpenEditModal = (registro: RegistroItem) => {
    setEditingRegistro(registro);
    
    // Si es MO, mostrar cantidad como HH:MM
    const cantidadDisplay = registro.concepto === 'MO' 
      ? formatMinutosToHHMM(registro.cantidad)
      : registro.cantidad.toString();
    
    setEditForm({
      clienteId: registro.clienteId,
      proyectoId: registro.proyectoId,
      fecha: registro.fecha,
      concepto: registro.concepto,
      descripcion: registro.descripcion,
      cantidad: registro.cantidad.toString(),
      cantidadDisplay: cantidadDisplay,
      precioUnitario: registro.precioUnitario.toString(),
      total: registro.total.toString()
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  // Handler para cerrar modal
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRegistro(null);
    setEditForm({
      clienteId: '',
      proyectoId: '',
      fecha: '',
      concepto: 'MO',
      descripcion: '',
      cantidad: '',
      cantidadDisplay: '',
      precioUnitario: '',
      total: ''
    });
    setEditFormErrors({});
  };

  // Handler para cambios en el formulario de edición
  const handleEditFormChange = (field: string, value: any) => {
    const newForm = { ...editForm, [field]: value };
    
    // Limpiar error del campo modificado
    if (editFormErrors[field]) {
      const newErrors = { ...editFormErrors };
      delete newErrors[field];
      setEditFormErrors(newErrors);
    }
    
    // Si cambia el concepto, resetear cantidad
    if (field === 'concepto') {
      newForm.cantidad = '';
      newForm.cantidadDisplay = '';
      newForm.total = '';
    }
    
    // Si cambia cantidadDisplay (HH:MM) para MO, convertir a minutos
    if (field === 'cantidadDisplay' && newForm.concepto === 'MO') {
      const minutos = parseHHMMToMinutos(value);
      newForm.cantidad = minutos.toString();
    }
    
    // Si cambia cantidad para Insumo
    if (field === 'cantidad' && newForm.concepto === 'Insumo') {
      newForm.cantidadDisplay = value;
    }
    
    // Recalcular total automáticamente
    if ((field === 'cantidad' || field === 'cantidadDisplay' || field === 'precioUnitario') && 
        newForm.cantidad && newForm.precioUnitario) {
      const cantidad = parseFloat(newForm.cantidad);
      const precio = parseFloat(newForm.precioUnitario);
      if (!isNaN(cantidad) && !isNaN(precio)) {
        newForm.total = (cantidad * precio).toString();
      }
    }
    
    setEditForm(newForm);
  };

  // Validar formulario de edición
  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editForm.clienteId) errors.clienteId = 'Cliente requerido';
    if (!editForm.proyectoId) errors.proyectoId = 'Proyecto requerido';
    if (!editForm.fecha) errors.fecha = 'Fecha requerida';
    if (!editForm.descripcion.trim()) errors.descripcion = 'Descripción requerida';
    
    if (editForm.concepto === 'MO') {
      // Validar formato HH:MM
      const hhmmRegex = /^(\d{1,2}):([0-5]\d)$/;
      if (!hhmmRegex.test(editForm.cantidadDisplay)) {
        errors.cantidadDisplay = 'Formato inválido. Use HH:MM (ej: 01:30)';
      } else {
        const minutos = parseHHMMToMinutos(editForm.cantidadDisplay);
        if (minutos <= 0) {
          errors.cantidadDisplay = 'Debe ser mayor a 00:00';
        }
      }
    } else {
      const cant = parseFloat(editForm.cantidad);
      if (isNaN(cant) || cant <= 0) {
        errors.cantidad = 'Cantidad debe ser mayor a 0';
      }
    }
    
    const precio = parseFloat(editForm.precioUnitario);
    if (isNaN(precio) || precio < 0) {
      errors.precioUnitario = 'Precio debe ser mayor o igual a 0';
    }
    
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handler para guardar cambios
  const handleSaveEdit = async () => {
    if (!editingRegistro) return;
    
    if (!validateEditForm()) return;
    
    const updatedData = {
      clienteId: editForm.clienteId,
      proyectoId: editForm.proyectoId,
      fecha: editForm.fecha,
      concepto: editForm.concepto,
      descripcion: editForm.descripcion.trim(),
      cantidad: parseFloat(editForm.cantidad),
      precioUnitario: parseFloat(editForm.precioUnitario),
      total: parseFloat(editForm.total)
    };
    
    const success = await onEditRegistro(editingRegistro.id, updatedData);
    
    if (success) {
      handleCloseEditModal();
    }
  };
  
  // Función para limpiar filtros
  const clearFilters = () => {
    setFilterCliente('');
    setFilterProyecto('');
    setFilterConcepto('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
  };

  // Verificar si hay filtros activos
  const hasActiveFilters = filterCliente || filterProyecto || filterConcepto || filterFechaDesde || filterFechaHasta;

  // UNIFIED VIEW: Combinar registros MO/Insumo con registros de Vehículos
  const unifiedRegistros = useMemo(() => {
    // Map vehicle records to match RegistroItem interface
    const vehicleAsRegistros: RegistroItem[] = (data.registrosVehiculo || []).map(v => ({
      id: v.id,
      clienteId: v.clienteId,
      clienteNombre: v.clienteNombre,
      proyectoId: v.proyectoId,
      proyectoNombre: v.proyectoNombre,
      fecha: v.fecha,
      concepto: 'Vehículo' as any, // Extended type
      descripcion: `Viaje: ${v.proyectoNombre} - ${v.distanciaOdometro}km - ${v.combustibleLitros || 0}L`,
      cantidad: v.distanciaOdometro, // km traveled
      precioUnitario: v.distanciaOdometro > 0 ? v.combustibleCosto / v.distanciaOdometro : 0,
      total: v.combustibleCosto,
      origen: v.origen,
      fechaImportacion: v.fechaImportacion
    }));
    
    // Combine both arrays
    return [...data.registros, ...vehicleAsRegistros];
  }, [data.registros, data.registrosVehiculo]);

  // FASE 1: Lógica de filtrado (ahora usa unifiedRegistros)
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

  // FASE 5: Lógica de búsqueda global con useMemo
  const searchedRegistros = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredRegistros;
    }
    
    const query = searchQuery.toLowerCase();
    
    return filteredRegistros.filter(r => {
      return (
        r.clienteNombre.toLowerCase().includes(query) ||
        r.proyectoNombre.toLowerCase().includes(query) ||
        r.descripcion.toLowerCase().includes(query) ||
        r.concepto.toLowerCase().includes(query)
      );
    });
  }, [filteredRegistros, searchQuery]);

  // FASE 3: Resetear página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCliente, filterProyecto, filterConcepto, filterFechaDesde, filterFechaHasta]);

  // FASE 5: Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // FASE 4: Resetear página cuando cambia el ordenamiento
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortOrder]);

  // FASE 4: Handler de ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cambiar orden si es el mismo campo
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo: orden descendente por defecto
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // FASE 4: Lógica de ordenamiento con useMemo (ACTUALIZADA FASE 5: usa searchedRegistros)
  const sortedRegistros = useMemo(() => {
    const sorted = [...searchedRegistros].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Manejo especial para campos numéricos
      if (sortField === 'total' || sortField === 'precioUnitario') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      
      // Manejo especial para cantidad/horas (considerar hsTotal para MO)
      if (sortField === 'cantidad') {
        aVal = a.concepto === 'MO' && a.hsTotal ? a.hsTotal : a.cantidad;
        bVal = b.concepto === 'MO' && b.hsTotal ? b.hsTotal : b.cantidad;
      }
      
      // Comparación para strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal, 'es-PY')
          : bVal.localeCompare(aVal, 'es-PY');
      }
      
      // Comparación para números
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    return sorted;
  }, [searchedRegistros, sortField, sortOrder]);

  // FASE 3: Lógica de paginación (ACTUALIZADA FASE 4: ahora usa sortedRegistros en lugar de filteredRegistros)
  const paginatedRegistros = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedRegistros.slice(startIndex, endIndex);
  }, [sortedRegistros, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedRegistros.length / itemsPerPage);

  // FASE 3: Scroll automático al cambiar página
  useEffect(() => {
    if (tableRef.current && currentPage > 1) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // FASE 3: Handlers de paginación
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Resetear a página 1 al cambiar items por página
  };

  // FASE 3: Generar números de página para mostrar (máximo 5 con ...)
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    
    // Siempre mostrar primera página
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    // Páginas alrededor de la página actual
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    // Siempre mostrar última página
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  // FASE 2: Métricas calculadas desde registros filtrados (se actualizan con filtros)
  const totalHours = useMemo(() => {
    return filteredRegistros
      .filter(r => r.concepto === 'MO' && r.hsTotal)
      .reduce((acc, r) => acc + (r.hsTotal || 0), 0);
  }, [filteredRegistros]);
  
  // Calcular total de minutos de MO para mostrar en formato HH:MM
  const totalMinutosMO = useMemo(() => {
    return filteredRegistros
      .filter(r => r.concepto === 'MO' && r.cantidad)
      .reduce((acc, r) => acc + (r.cantidad || 0), 0);
  }, [filteredRegistros]);

  const totalCost = useMemo(() => {
    return filteredRegistros.reduce((acc, r) => acc + r.total, 0);
  }, [filteredRegistros]);

  const totalMO = useMemo(() => {
    return filteredRegistros
      .filter(r => r.concepto === 'MO')
      .reduce((acc, r) => acc + r.total, 0);
  }, [filteredRegistros]);

  const totalInsumos = useMemo(() => {
    return filteredRegistros
      .filter(r => r.concepto === 'Insumo')
      .reduce((acc, r) => acc + r.total, 0);
  }, [filteredRegistros]);

  const clientsCount = data.clientes.length;
  const projectsCount = data.proyectos.length;
  const activeProjectsCount = data.proyectos.filter(p => p.estado === 'En Proceso').length;

  // FASE 2: Gráficos calculados desde registros filtrados
  const clientCostData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRegistros.forEach(r => {
      map[r.clienteNombre] = (map[r.clienteNombre] || 0) + r.total;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [filteredRegistros]);

  // 3. Prepare Data for Charts: Hours per Project
  const projectHoursData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRegistros
      .filter(r => r.concepto === 'MO' && r.hsTotal)
      .forEach(r => {
        map[r.proyectoNombre] = (map[r.proyectoNombre] || 0) + (r.hsTotal || 0);
      });
    return Object.entries(map)
      .map(([name, hours]) => ({ 
        name: name.length > 25 ? name.substring(0, 22) + '...' : name, 
        horas: parseFloat(hours.toFixed(1)) 
      }))
      .filter(item => item.horas > 0);
  }, [filteredRegistros]);

  // 4. Monthly or Daily trend data (cumulative costs) - FILTRADO
  const costTrendData = useMemo(() => {
    const map: Record<string, number> = {};
    const sorted = [...filteredRegistros].sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    // Accumulate or sum per day
    sorted.forEach(r => {
      const day = r.fecha;
      map[day] = (map[day] || 0) + r.total;
    });

    let runningSum = 0;
    return Object.entries(map).map(([fecha, dailySum]) => {
      runningSum += dailySum;
      return {
        fecha: fecha.substring(5), // MM-DD
        total: runningSum,
        diario: dailySum
      };
    });
  }, [filteredRegistros]);

  return (
    <div id="dashboard_view" className="relative space-y-8">
      {/* 1. Page Header with CTA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 relative">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-sans font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
          >
            Panel de Operaciones
          </motion.h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualización bento de Mano de Obra, Insumos e Importación Inteligente.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateImport}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-medium text-sm text-white shadow-lg shadow-blue-500/25 border border-white/10 transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Importar Excel</span>
        </motion.button>
      </div>

      {/* 2. Bento Grid Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        
        {/* Metric 1: Total Hours */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel glass-panel-hover p-6 rounded-2xl flex items-center justify-between relative"
        >
          {hasActiveFilters && (
            <div className="absolute top-2 right-2">
              <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                Filtrado
              </span>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono tracking-wider text-blue-400">Total Mano de Obra</span>
            <div className="text-3xl font-bold tracking-tight text-white">
              {formatMinutosToHHMM(totalMinutosMO)}
            </div>
            <p className="text-xs text-slate-400">Formato HH:MM (horas:minutos)</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Metric 2: Total Cost */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel glass-panel-hover p-6 rounded-2xl flex items-center justify-between relative"
        >
          {hasActiveFilters && (
            <div className="absolute top-2 right-2">
              <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                Filtrado
              </span>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400">Costo Acumulado Gral</span>
            <div className="text-3xl font-bold tracking-tight text-white">
              {formatGuaranies(totalCost)}
            </div>
            <p className="text-xs text-slate-400">
              MO ({formatGuaranies(totalMO)}) + Insumos ({formatGuaranies(totalInsumos)})
            </p>
          </div>
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
            <Wallet className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Metric 3: Active Projects */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel glass-panel-hover p-6 rounded-2xl flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono tracking-wider text-pink-400">Proyectos Activos</span>
            <div className="text-3xl font-bold tracking-tight text-white">
              {activeProjectsCount} <span className="text-lg font-normal text-slate-400">/ {projectsCount}</span>
            </div>
            <p className="text-xs text-slate-400">En etapa de ejecución directa</p>
          </div>
          <div className="p-3 bg-pink-500/10 rounded-xl border border-pink-500/20 text-pink-400">
            <Briefcase className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Metric 4: Direct Clients */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel glass-panel-hover p-6 rounded-2xl flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono tracking-wider text-emerald-400">Clientes Cartera</span>
            <div className="text-3xl font-bold tracking-tight text-white">
              {clientsCount}
            </div>
            <p className="text-xs text-slate-400">Empresas registradas</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </motion.div>

      </div>

      {/* 2.5. Métricas de Vehículos */}
      {data.registrosVehiculo && data.registrosVehiculo.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-white">Métricas de Vehículos</h2>
            <span className="text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded">
              {data.registrosVehiculo.length} {data.registrosVehiculo.length === 1 ? 'viaje' : 'viajes'}
            </span>
          </div>
          <VehiculosStats registrosVehiculo={data.registrosVehiculo} />
        </motion.div>
      )}

      {/* 3. Bento Grid - Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Chart A: Cost Trend Over Time (High-Contrast Area) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="glass-panel p-6 rounded-2xl lg:col-span-2 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-sans font-medium text-base text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span>Evolución Financiera Acumulada</span>
              </h3>
              <span className="text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-md">
                {hasActiveFilters ? '🔍 Filtrado' : 'Gasto Acumulado'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6 font-sans">
              {hasActiveFilters 
                ? 'Visualización de datos filtrados según criterios seleccionados.'
                : 'Visualice el avance de costos e insumos por día en la plataforma.'
              }
            </p>
          </div>
          <div className="h-64 w-full" style={{ minWidth: 0 }}>
            {costTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
                No hay datos acumulados para graficar
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <AreaChart data={costTrendData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="fecha" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => `Gs. ${Math.round(val).toLocaleString('es-PY')}`} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px' }}
                    formatter={(value: any) => [formatGuaranies(parseFloat(value)), 'Costo Total']}
                    cursor={{ stroke: 'rgba(59, 130, 246, 0.5)', strokeWidth: 2 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Chart B: Cost Distribution by Client (Pie Chart) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6 rounded-2xl flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-sans font-medium text-base text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Costos por Cliente</span>
              </h3>
              {hasActiveFilters && (
                <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                  Filtrado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              {hasActiveFilters 
                ? 'Distribución filtrada del presupuesto.'
                : 'Participación en el presupuesto operativo total.'
              }
            </p>
          </div>
          <div className="h-48 w-full relative flex items-center justify-center" style={{ minWidth: 0 }}>
            {clientCostData.length === 0 ? (
              <div className="text-slate-500 text-xs font-mono">No hay datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={192}>
                <PieChart>
                  <Pie
                    data={clientCostData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {clientCostData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px' }}
                    formatter={(value: any) => [formatGuaranies(parseFloat(value)), 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute flex flex-col items-center">
              <span className="text-xs font-mono text-slate-400">Presupuesto</span>
              <span className="text-sm font-bold text-white">{formatGuaranies(totalCost)}</span>
            </div>
          </div>
          <div className="space-y-2 mt-4 max-h-32 overflow-y-auto pr-1">
            {clientCostData.map((item, index) => {
              const percentage = ((item.value / totalCost) * 100).toFixed(0);
              return (
                <div key={item.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-slate-300 truncate">{item.name}</span>
                  </div>
                  <span className="font-mono font-medium text-slate-400 shrink-0">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Chart C: Hours per Project (Bar Chart) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="glass-panel p-6 rounded-2xl lg:col-span-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-sans font-medium text-base text-white flex items-center gap-2">
                <Hammer className="w-5 h-5 text-pink-400" />
                <span>Consumo de Horas de Mano de Obra por Proyecto</span>
              </h3>
              {hasActiveFilters && (
                <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                  Filtrado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6 font-sans">
              {hasActiveFilters
                ? 'Horas de MO filtradas según criterios seleccionados.'
                : 'Visualización comparativa de dedicación (MO) en horas reales de colaboradores.'
              }
            </p>
          </div>
          <div className="h-60 w-full" style={{ minWidth: 0 }}>
            {projectHoursData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
                No hay horas de Mano de Obra registradas aún
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                <BarChart data={projectHoursData} margin={{ left: -10, right: 10, top: 10, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} angle={-15} textAnchor="end" interval={0} height={45} />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => `${val}h`} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px' }}
                    formatter={(value: any) => [`${value} horas`, 'Mano de Obra']}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  />
                  <Bar dataKey="horas" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

      </div>

      {/* 4. Recent Journal / Log Entries Table */}
      <motion.div 
        ref={tableRef}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel p-6 rounded-2xl relative z-10"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="font-sans font-semibold text-lg text-white">Historial Operativo Reciente</h3>
            <p className="text-xs text-slate-400">Últimos registros cargados, partes diarios de horas e insumos de proyectos.</p>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <span className="text-xs font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Filter className="w-3 h-3" />
                Filtros activos
              </span>
            )}
            {/* FASE 5: Badge de búsqueda activa */}
            {searchQuery && (
              <span className="text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                Búsqueda activa
              </span>
            )}
            {/* FASE 5: Contador actualizado con información de búsqueda */}
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              {searchQuery 
                ? `${searchedRegistros.length} resultado${searchedRegistros.length !== 1 ? 's' : ''} de búsqueda (${filteredRegistros.length} filtrado${filteredRegistros.length !== 1 ? 's' : ''})`
                : `${filteredRegistros.length} de ${unifiedRegistros.length} registros`
              }
            </span>
          </div>
        </div>

        {/* FASE 1: Panel de Filtros */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Filtros de Búsqueda</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Limpiar Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro Cliente */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Cliente</label>
              <select
                value={filterCliente}
                onChange={(e) => setFilterCliente(e.target.value)}
                className="px-3 py-2 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              >
                <option value="">Todos los clientes</option>
                {data.clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Filtro Proyecto */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Proyecto</label>
              <select
                value={filterProyecto}
                onChange={(e) => setFilterProyecto(e.target.value)}
                className="px-3 py-2 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              >
                <option value="">Todos los proyectos</option>
                {data.proyectos
                  .filter(p => !filterCliente || p.clienteId === filterCliente)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
              </select>
            </div>

            {/* Filtro Fecha Desde */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Fecha Desde</label>
              <input
                type="date"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
                className="px-3 py-2 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              />
            </div>

            {/* Filtro Fecha Hasta */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Fecha Hasta</label>
              <input
                type="date"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
                className="px-3 py-2 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Filtro Concepto (Botones) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Concepto</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterConcepto('')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  filterConcepto === ''
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterConcepto('MO')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  filterConcepto === 'MO'
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                Mano de Obra
              </button>
              <button
                onClick={() => setFilterConcepto('Insumo')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  filterConcepto === 'Insumo'
                    ? 'bg-cyan-600 text-white border border-cyan-500'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                Insumos
              </button>
              <button
                onClick={() => setFilterConcepto('Vehículo')}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  filterConcepto === 'Vehículo'
                    ? 'bg-pink-600 text-white border border-pink-500'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                Vehículos
              </button>
            </div>
          </div>
        </div>

        {/* FASE 5: Input de búsqueda global */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Búsqueda Global
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en Cliente, Proyecto, Descripción, Concepto..."
                className="w-full pl-10 pr-10 py-2.5 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-slate-400 mt-1">
                Buscando: <span className="text-blue-300 font-medium">"{searchQuery}"</span>
                {' '}- {searchedRegistros.length} resultado{searchedRegistros.length !== 1 ? 's' : ''} encontrado{searchedRegistros.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 text-xs uppercase font-mono tracking-wider">
                {/* FASE 4: Header Concepto - Ordenable */}
                <th 
                  className="pb-3 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('concepto')}
                  aria-sort={sortField === 'concepto' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Concepto</span>
                    {sortField === 'concepto' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* FASE 4: Header Cliente/Proyecto - Ordenable */}
                <th 
                  className="pb-3 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('clienteNombre')}
                  aria-sort={sortField === 'clienteNombre' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cliente / Proyecto</span>
                    {sortField === 'clienteNombre' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* FASE 4: Header Fecha - Ordenable */}
                <th 
                  className="pb-3 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('fecha')}
                  aria-sort={sortField === 'fecha' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Fecha</span>
                    {sortField === 'fecha' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Header Descripción - NO Ordenable */}
                <th className="pb-3 font-medium">Descripción / Detalle</th>

                {/* FASE 4: Header Cant/Horas - Ordenable */}
                <th 
                  className="pb-3 font-medium text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('cantidad')}
                  aria-sort={sortField === 'cantidad' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Cant / Horas</span>
                    {sortField === 'cantidad' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* FASE 4: Header P. Unitario - Ordenable */}
                <th 
                  className="pb-3 font-medium text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('precioUnitario')}
                  aria-sort={sortField === 'precioUnitario' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>P. Unitario</span>
                    {sortField === 'precioUnitario' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* FASE 4: Header Total - Ordenable */}
                <th 
                  className="pb-3 font-medium text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                  onClick={() => handleSort('total')}
                  aria-sort={sortField === 'total' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total</span>
                    {sortField === 'total' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Header Origen - NO Ordenable */}
                <th className="pb-3 font-medium text-center">Origen</th>

                {/* Header Acciones - NO Ordenable */}
                <th className="pb-3 font-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRegistros.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-sm font-mono">
                    {hasActiveFilters 
                      ? '🔍 No se encontraron registros con los filtros aplicados. Intenta ajustar los criterios.'
                      : 'Ningún registro en el historial. ¡Importe un archivo Excel o agregue manualmente!'
                    }
                  </td>
                </tr>
              ) : (
                paginatedRegistros.map((reg) => (
                  <tr key={reg.id} className="border-b border-white/5 hover:bg-white/2 text-sm transition-colors admin-row">
                    <td className="py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-mono font-semibold ${
                        reg.concepto === 'MO' 
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' 
                          : reg.concepto === 'Vehículo'
                          ? 'bg-pink-500/10 text-pink-300 border border-pink-500/20'
                          : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      }`}>
                        {reg.concepto}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="font-sans font-medium text-white truncate max-w-[200px]" title={reg.clienteNombre}>
                        {reg.clienteNombre}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]" title={reg.proyectoNombre}>
                        {reg.proyectoNombre}
                      </div>
                    </td>
                    <td className="py-4 text-xs font-mono text-slate-300">
                      {reg.fecha}
                    </td>
                    <td className="py-4">
                      <p className="text-slate-300 font-sans break-all max-w-[280px]" title={reg.descripcion}>
                        {reg.descripcion}
                      </p>
                    </td>
                    <td className="py-4 text-right font-mono text-slate-300">
                      {reg.concepto === 'MO' && reg.cantidad 
                        ? formatMinutosToHHMM(reg.cantidad)
                        : reg.concepto === 'Vehículo'
                        ? `${Math.round(reg.cantidad)} km`
                        : Math.round(reg.cantidad).toLocaleString('es-PY')
                      }
                    </td>
                    <td className="py-4 text-right font-mono text-slate-300">
                      {formatGuaranies(reg.precioUnitario)}
                    </td>
                    <td className="py-4 text-right font-mono text-white font-semibold">
                      {formatGuaranies(reg.total)}
                    </td>
                    <td className="py-4 text-center">
                      <span className={`inline-block text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full ${
                        reg.origen === 'Excel' 
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      }`}>
                        {reg.origen}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            if (reg.concepto === 'Vehículo' && onNavigateToVehicleEdit) {
                              onNavigateToVehicleEdit(reg.id);
                            } else {
                              handleOpenEditModal(reg);
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                          title={reg.concepto === 'Vehículo' ? 'Ir al módulo de vehículos para editar' : 'Editar este registro'}
                          aria-label={`Editar registro de ${reg.concepto} - ${reg.proyectoNombre}`}
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </button>
                        <span className="text-slate-600">|</span>
                        <button 
                          onClick={() => onDeleteRegistro(reg.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                          title="Eliminar este ítem"
                          aria-label={`Eliminar registro de ${reg.concepto} - ${reg.proyectoNombre}`}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FASE 3: UI de Paginación (ACTUALIZADA FASE 4: usa sortedRegistros) */}
        {sortedRegistros.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Indicador de registros */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm font-mono text-slate-400">
                Mostrando{' '}
                <span className="text-white font-semibold">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>
                {' - '}
                <span className="text-white font-semibold">
                  {Math.min(currentPage * itemsPerPage, sortedRegistros.length)}
                </span>
                {' '}de{' '}
                <span className="text-white font-semibold">
                  {sortedRegistros.length}
                </span>
                {' '}registros
              </div>

              {/* Selector de registros por página */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">Registros por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-3 py-1.5 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  aria-label="Registros por página"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Controles de paginación */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* Botón Anterior */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 1
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white border border-white/10 cursor-pointer'
                }`}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              {/* Números de página */}
              {getPageNumbers().map((pageNum, index) => {
                if (pageNum === '...') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-3 py-2 text-slate-500 text-sm font-mono"
                    >
                      ...
                    </span>
                  );
                }

                const isCurrentPage = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum as number)}
                    className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                      isCurrentPage
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border border-blue-500 shadow-lg shadow-blue-500/25'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 cursor-pointer'
                    }`}
                    aria-label={`Página ${pageNum}`}
                    aria-current={isCurrentPage ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Botón Siguiente */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === totalPages
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white border border-white/10 cursor-pointer'
                }`}
                aria-label="Página siguiente"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de Edición */}
      <AnimatePresence>
        {isEditModalOpen && editingRegistro && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseEditModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="glass-panel p-6 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Editar Registro</h2>
                  <button
                    onClick={handleCloseEditModal}
                    className="text-slate-400 hover:text-white transition-colors"
                    aria-label="Cerrar modal"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                  {/* Cliente */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-cliente" className="text-sm font-medium text-slate-300">Cliente *</label>
                    <select
                      id="edit-cliente"
                      value={editForm.clienteId}
                      onChange={(e) => handleEditFormChange('clienteId', e.target.value)}
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.clienteId ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer`}
                    >
                      <option value="">Seleccionar cliente</option>
                      {data.clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {editFormErrors.clienteId && (
                      <span className="text-xs text-rose-400">{editFormErrors.clienteId}</span>
                    )}
                  </div>

                  {/* Proyecto */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-proyecto" className="text-sm font-medium text-slate-300">Proyecto *</label>
                    <select
                      id="edit-proyecto"
                      value={editForm.proyectoId}
                      onChange={(e) => handleEditFormChange('proyectoId', e.target.value)}
                      disabled={!editForm.clienteId}
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.proyectoId ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="">Seleccionar proyecto</option>
                      {data.proyectos
                        .filter(p => p.clienteId === editForm.clienteId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                    {editFormErrors.proyectoId && (
                      <span className="text-xs text-rose-400">{editFormErrors.proyectoId}</span>
                    )}
                  </div>

                  {/* Fecha */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-fecha" className="text-sm font-medium text-slate-300">Fecha *</label>
                    <input
                      id="edit-fecha"
                      type="date"
                      value={editForm.fecha}
                      onChange={(e) => handleEditFormChange('fecha', e.target.value)}
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.fecha ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors`}
                    />
                    {editFormErrors.fecha && (
                      <span className="text-xs text-rose-400">{editFormErrors.fecha}</span>
                    )}
                  </div>

                  {/* Concepto */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-concepto" className="text-sm font-medium text-slate-300">Concepto *</label>
                    <select
                      id="edit-concepto"
                      value={editForm.concepto}
                      onChange={(e) => handleEditFormChange('concepto', e.target.value as 'MO' | 'Insumo')}
                      className="px-3 py-2 bg-[#0f172a]/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                    >
                      <option value="MO">Mano de Obra (MO)</option>
                      <option value="Insumo">Insumo</option>
                    </select>
                  </div>

                  {/* Descripción */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-descripcion" className="text-sm font-medium text-slate-300">Descripción *</label>
                    <textarea
                      id="edit-descripcion"
                      value={editForm.descripcion}
                      onChange={(e) => handleEditFormChange('descripcion', e.target.value)}
                      rows={3}
                      placeholder="Detalle del trabajo o insumo"
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.descripcion ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors resize-none`}
                    />
                    {editFormErrors.descripcion && (
                      <span className="text-xs text-rose-400">{editFormErrors.descripcion}</span>
                    )}
                  </div>

                  {/* Cantidad (MO: HH:MM / Insumo: número) */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-cantidad" className="text-sm font-medium text-slate-300">
                      {editForm.concepto === 'MO' ? 'Horas (HH:MM) *' : 'Cantidad *'}
                    </label>
                    <input
                      id="edit-cantidad"
                      type="text"
                      value={editForm.cantidadDisplay}
                      onChange={(e) => {
                        if (editForm.concepto === 'MO') {
                          handleEditFormChange('cantidadDisplay', e.target.value);
                        } else {
                          handleEditFormChange('cantidad', e.target.value);
                        }
                      }}
                      placeholder={editForm.concepto === 'MO' ? '01:30' : '5'}
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.cantidadDisplay || editFormErrors.cantidad ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors`}
                    />
                    {(editFormErrors.cantidadDisplay || editFormErrors.cantidad) && (
                      <span className="text-xs text-rose-400">
                        {editFormErrors.cantidadDisplay || editFormErrors.cantidad}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {editForm.concepto === 'MO' 
                        ? 'Formato: HH:MM (ejemplo: 01:30 para 1 hora y 30 minutos)'
                        : 'Cantidad numérica (ejemplo: 5 para 5 metros o 5 unidades)'}
                    </span>
                  </div>

                  {/* Precio Unitario */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-precio" className="text-sm font-medium text-slate-300">Precio Unitario (Gs.) *</label>
                    <input
                      id="edit-precio"
                      type="number"
                      value={editForm.precioUnitario}
                      onChange={(e) => handleEditFormChange('precioUnitario', e.target.value)}
                      placeholder="22750"
                      min="0"
                      step="1"
                      className={`px-3 py-2 bg-[#0f172a]/50 border ${editFormErrors.precioUnitario ? 'border-rose-500' : 'border-white/10'} rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors`}
                    />
                    {editFormErrors.precioUnitario && (
                      <span className="text-xs text-rose-400">{editFormErrors.precioUnitario}</span>
                    )}
                  </div>

                  {/* Total (calculado) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-300">Total (Gs.)</label>
                    <div 
                      className="px-3 py-2 bg-slate-800/50 border border-white/5 rounded-lg text-sm text-slate-300 font-mono"
                      aria-label="Total calculado"
                      data-testid="edit-total"
                    >
                      {editForm.total ? formatGuaranies(parseFloat(editForm.total)) : 'Gs. 0'}
                    </div>
                    <span className="text-xs text-slate-400">
                      Calculado automáticamente: Cantidad × Precio Unitario
                    </span>
                  </div>
                </div>

                {/* Footer con botones */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                  <button
                    onClick={handleCloseEditModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 border border-white/10 transition-all cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
