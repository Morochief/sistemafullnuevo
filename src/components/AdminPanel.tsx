/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Building2, 
  FolderGit2, 
  Users, 
  Database, 
  PenTool, 
  BadgeAlert,
  AlertOctagon,
  RefreshCw,
  FolderPlus,
  CheckCircle2,
  Clock,
  Calculator,
  FileText,
  Car
} from 'lucide-react';
import { DatabaseState, Cliente, Proyecto, Colaborador, RegistroItem } from '../types.ts';
import VehiculosAdminView from './VehiculosAdminView.tsx';
import ConfirmModal from './ConfirmModal.tsx';
import { useNotif } from '../context/NotifContext.tsx';
import UsuariosTab from './UsuariosTab.tsx';
import TimelineMarcaciones from './TimelineMarcaciones.tsx';
import AuditLogTab from './AuditLogTab.tsx';

interface AdminPanelProps {
  data: DatabaseState;
  onAddRegistro: (registro: any) => Promise<boolean>;
  onAddCliente: (cliente: Cliente) => void;
  onEditCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  onDeleteCliente: (id: string) => Promise<void>;
  onAddProyecto: (proyecto: Proyecto) => void;
  onEditProyecto: (id: string, data: Partial<Proyecto>) => Promise<void>;
  onDeleteProyecto: (id: string) => Promise<void>;
  onAddColaborador: (colaborador: Colaborador) => void;
  onEditColaborador: (id: string, data: Partial<Colaborador>) => Promise<void>;
  onDeleteColaborador: (id: string) => Promise<void>;
  onResetDatabase: () => void;
  onRefresh?: () => Promise<void>;
  initialVehicleEditId?: string | null;
  initialSubTab?: string;
}

// ============================================================================
// REUSABLE COMPONENTS - Compound Components Pattern
// ============================================================================

interface AdminSectionProps {
  title: string;
  icon: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'highlighted';
}

function AdminSection({ title, icon, description, children, variant = 'default' }: AdminSectionProps) {
  const isHighlighted = variant === 'highlighted';
  
  return (
    <div className={`glass-panel rounded-3xl p-6 space-y-4 ${
      isHighlighted ? 'border-2 border-blue-500/30 bg-blue-500/5' : ''
    }`}>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h3>
        {description && (
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface DataCardProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: 'emerald' | 'cyan' | 'pink' | 'blue' };
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function DataCard({ title, subtitle, badge, icon, children }: DataCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    pink: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-4 rounded-2xl bg-white/3 border border-white/5 hover:bg-white/5 transition-all"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-slate-400">{icon}</span>}
            <h5 className="font-semibold text-white text-sm">{title}</h5>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 font-mono">{subtitle}</p>
          )}
          {children}
        </div>
        {badge && (
          <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-1.5 rounded-lg border ${colorClasses[badge.color]} shrink-0`}>
            {badge.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}

interface FormSectionHeaderProps {
  step: number;
  title: string;
  icon: React.ReactNode;
  required?: boolean;
}

function FormSectionHeader({ step, title, icon, required }: FormSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-white/5">
      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-sm border border-blue-500/20">
        {step}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <span className="text-blue-400">{icon}</span>
        <h4 className="text-sm font-bold text-white uppercase tracking-wide">
          {title}
        </h4>
        {required && (
          <span className="text-[10px] bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
            REQUERIDO *
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// REGISTRO MANUAL FORM - Structured with clear sections
// ============================================================================

interface RegistroManualFormProps {
  data: DatabaseState;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitPending: boolean;
  formError: string | null;
  selectedClienteId: string;
  setSelectedClienteId: (id: string) => void;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  concepto: 'MO' | 'Insumo' | 'Otros';
  setConcepto: (c: 'MO' | 'Insumo' | 'Otros') => void;
  fecha: string;
  setFecha: (f: string) => void;
  descripcion: string;
  setDescripcion: (d: string) => void;
  selectedColaboradorId: string;
  handleColaboradorSelect: (id: string) => void;
  hours: string;
  setHours: (h: string) => void;
  quantity: string;
  setQuantity: (q: string) => void;
  precioUnitario: string;
  setPrecioUnitario: (p: string) => void;
}

function RegistroManualForm({
  data,
  onSubmit,
  isSubmitPending,
  formError,
  selectedClienteId,
  setSelectedClienteId,
  selectedProyectoId,
  setSelectedProyectoId,
  concepto,
  setConcepto,
  fecha,
  setFecha,
  descripcion,
  setDescripcion,
  selectedColaboradorId,
  handleColaboradorSelect,
  hours,
  setHours,
  quantity,
  setQuantity,
  precioUnitario,
  setPrecioUnitario
}: RegistroManualFormProps) {

  const filteredProjects = useMemo(() => {
    if (!selectedClienteId) return [];
    return data.proyectos.filter(p => p.clienteId === selectedClienteId);
  }, [selectedClienteId, data.proyectos]);

  // Real-time calculation
  const totalLiquidacion = useMemo(() => {
    const finalCantidad = concepto === 'MO' ? parseFloat(hours) * 60 : parseFloat(quantity);
    const finalPrecio = parseFloat(precioUnitario) || 0;
    return Math.round(finalCantidad * finalPrecio);
  }, [concepto, hours, quantity, precioUnitario]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminSection
        title="Registrar Parte Diario / Gasto Manual"
        icon={<PenTool className="w-5 h-5 text-blue-400" />}
        description="Inserta información individual alternativamente al cargador de Excel."
      >
        <form onSubmit={onSubmit} className="space-y-6">
          
          {/* SECTION 1: Contexto del Registro */}
          <div className="space-y-4">
            <FormSectionHeader 
              step={1} 
              title="Contexto del Registro" 
              icon={<Building2 className="w-4 h-4" />}
              required
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-11">
              {/* Cliente */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  Cliente Mapeado
                  <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={selectedClienteId}
                  onChange={(e) => {
                    setSelectedClienteId(e.target.value);
                    setSelectedProyectoId('');
                  }}
                  className="w-full glass-select rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="">-- Seleccionar --</option>
                  {data.clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Proyecto */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  Proyecto Asociado
                  <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  disabled={!selectedClienteId}
                  value={selectedProyectoId}
                  onChange={(e) => setSelectedProyectoId(e.target.value)}
                  className="w-full glass-select rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="">-- {selectedClienteId ? 'Seleccionar' : 'Falta marcar cliente'} --</option>
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Fecha del Registro
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Tipo de Operación */}
          <div className="space-y-4">
            <FormSectionHeader 
              step={2} 
              title="Tipo de Operación" 
              icon={<Calculator className="w-4 h-4" />}
              required
            />
            
            <div className="pl-11">
              <label className="text-xs font-mono text-slate-300 mb-2 block">Concepto del Gasto</label>
              <div className="grid grid-cols-3 gap-3">
                {(['MO', 'Insumo', 'Otros'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setConcepto(option);
                      if(option !== 'MO') {
                        setPrecioUnitario('12500');
                      } else {
                        setPrecioUnitario('350');
                      }
                    }}
                    className={`text-sm font-bold py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      concepto === option 
                        ? 'bg-violet-600 text-white border-2 border-violet-400 shadow-lg shadow-violet-500/20' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/8 border border-white/10'
                    }`}
                  >
                    {concepto === option && <CheckCircle2 className="w-4 h-4" />}
                    {option === 'MO' ? 'Mano Obra' : option === 'Insumo' ? 'Insumos / Mat.' : 'Otros'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: Detalles Específicos */}
          <div className="space-y-4">
            <FormSectionHeader 
              step={3} 
              title="Detalles Específicos" 
              icon={<FileText className="w-4 h-4" />}
              required
            />
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={concepto}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11"
              >
                {concepto === 'MO' ? (
                  <>
                    {/* Colaborador */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">Colaborador Técnico</label>
                      <select
                        value={selectedColaboradorId}
                        onChange={(e) => handleColaboradorSelect(e.target.value)}
                        className="w-full glass-select rounded-xl px-4 py-2.5 text-sm"
                      >
                        <option value="">-- Operario no clasificado --</option>
                        {data.colaboradores.map(col => (
                          <option key={col.id} value={col.id}>{col.nombre} ({col.rol})</option>
                        ))}
                      </select>
                    </div>

                    {/* Horas */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">Tiempo de Dedicación (Horas)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.5"
                          required
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          className="w-full glass-input rounded-xl px-4 py-2 text-sm text-right"
                        />
                        <span className="text-slate-400 font-mono text-xs select-none shrink-0">hs</span>
                      </div>
                    </div>

                    {/* Precio por Minuto */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-mono text-slate-300">Precio por Minuto (Tarifa Gs.)</label>
                      <div className="flex gap-2 items-center">
                        <span className="text-slate-500 font-mono text-xs font-semibold shrink-0">Gs.</span>
                        <input
                          type="number"
                          required
                          value={precioUnitario}
                          onChange={(e) => setPrecioUnitario(e.target.value)}
                          className="w-full glass-input rounded-xl px-4 py-2 text-sm text-right"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Cantidad */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">Cantidad (Metros / Unidades / Kilos)</label>
                      <input
                        type="number"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-2 text-sm text-right"
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">Precio Unitario de Venta (Gs.)</label>
                      <div className="flex gap-2 items-center">
                        <span className="text-slate-500 font-mono text-xs font-semibold shrink-0">Gs.</span>
                        <input
                          type="number"
                          required
                          value={precioUnitario}
                          onChange={(e) => setPrecioUnitario(e.target.value)}
                          className="w-full glass-input rounded-xl px-4 py-2 text-sm text-right"
                        />
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* SECTION 4: Resumen y Confirmación */}
          <div className="space-y-4">
            <FormSectionHeader 
              step={4} 
              title="Resumen y Confirmación" 
              icon={<CheckCircle2 className="w-4 h-4" />}
              required
            />
            
            <div className="space-y-4 pl-11">
              {/* Total Liquidación - DESTACADO */}
              <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 p-5 rounded-2xl border-2 border-blue-500/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300 font-bold">Total Liquidación Estimado</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-tight">
                      {concepto === 'MO' 
                        ? `Cálculo: ${hours} hs × 60 min × Gs. ${precioUnitario}/min`
                        : `Cálculo: ${quantity} unidades × Gs. ${precioUnitario} c/u`
                      }
                    </p>
                  </div>
                  <div className="text-2xl font-mono font-bold text-white">
                    Gs. {totalLiquidacion.toLocaleString('es-PY')}
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-medium flex items-center gap-1.5">
                  Descripción detallada del Trabajo
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  placeholder="Ej: Rodrigo retiro vinilos y procedió con el ploteado del freezer delantero derecho del cliente..."
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full glass-input rounded-2xl px-4 py-3 text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {formError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2"
            >
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSubmitPending}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-sm text-white rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer flex justify-center items-center gap-2 border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando en Servidor...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar y Guardar en Historial
              </>
            )}
          </button>
        </form>
      </AdminSection>
    </motion.div>
  );
}

// ============================================================================
// CLIENTES TAB - Simplified management interface
// ============================================================================

interface ClientesTabProps {
  data: DatabaseState;
  newClientName: string;
  setNewClientName: (name: string) => void;
  newClientCode: string;
  setNewClientCode: (code: string) => void;
  onCreateClient: (e: React.FormEvent) => void;
  onEditCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  onDeleteCliente: (id: string) => Promise<void>;
}

function ClientesTab({
  data,
  newClientName,
  setNewClientName,
  newClientCode,
  setNewClientCode,
  onCreateClient,
  onEditCliente,
  onDeleteCliente,
}: ClientesTabProps) {
  const { requestConfirm } = useNotif();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCodigo, setEditCodigo] = useState('');

  const startEdit = (c: Cliente) => {
    setEditingId(c.id);
    setEditNombre(c.nombre);
    setEditCodigo(c.codigo || '');
  };
  const cancelEdit = () => setEditingId(null);
  const submitEdit = async () => {
    if (!editNombre.trim()) return;
    await onEditCliente(editingId!, { nombre: editNombre.trim(), codigo: editCodigo.trim() });
    setEditingId(null);
  };
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Creation Form */}
      <AdminSection
        title="Registrar Nuevo Cliente Frecuente"
        icon={<FolderPlus className="w-5 h-5 text-emerald-400" />}
        description="Agrega una nueva razón social a tu cartera de clientes"
        variant="highlighted"
      >
        <form onSubmit={onCreateClient} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Razón Social / Nombre *</label>
            <input
              type="text"
              required
              placeholder="Ej: Unilever Argentina"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Código Identificador</label>
            <input
              type="text"
              placeholder="Ej: UNIL"
              value={newClientCode}
              onChange={(e) => setNewClientCode(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:bg-emerald-500 font-bold text-xs text-white rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar Cliente
            </button>
          </div>
        </form>
      </AdminSection>

      {/* List */}
      <AdminSection
        title={`Base de Clientes Disponibles (${data.clientes.length})`}
        icon={<Building2 className="w-5 h-5 text-emerald-400" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.clientes.map(c => (
            <div key={c.id}>
              {editingId === c.id ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white/5 border border-emerald-500/30 space-y-3">
                  <input value={editNombre} onChange={e => setEditNombre(e.target.value)} placeholder="Nombre" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                  <input value={editCodigo} onChange={e => setEditCodigo(e.target.value)} placeholder="Código" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={submitEdit} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all">Guardar</button>
                    <button onClick={cancelEdit} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg transition-all">Cancelar</button>
                  </div>
                </motion.div>
              ) : (
                <DataCard
                  title={c.nombre}
                  subtitle={`ID: ${c.id} | Código: ${c.codigo || 'S/N'}`}
                  badge={{ label: 'Vigente', color: 'emerald' }}
                  icon={<Building2 className="w-4 h-4" />}
                >
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => startEdit(c)} className="text-[10px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/20 transition-all">Editar</button>
                    <button onClick={() => requestConfirm(`¿Eliminar cliente?`, `Se eliminarán todos los proyectos y registros de "${c.nombre}".`, 'danger', () => onDeleteCliente(c.id), 'Eliminar')} className="text-[10px] px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/20 transition-all">Eliminar</button>
                  </div>
                </DataCard>
              )}
            </div>
          ))}
        </div>
      </AdminSection>
    </motion.div>
  );
}

// ============================================================================
// PROYECTOS TAB - Simplified management interface
// ============================================================================

interface ProyectosTabProps {
  data: DatabaseState;
  newProjClientId: string;
  setNewProjClientId: (id: string) => void;
  newProjName: string;
  setNewProjName: (name: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
  onEditProyecto: (id: string, data: Partial<Proyecto>) => Promise<void>;
  onDeleteProyecto: (id: string) => Promise<void>;
}

function ProyectosTab({
  data,
  newProjClientId,
  setNewProjClientId,
  newProjName,
  setNewProjName,
  onCreateProject,
  onEditProyecto,
  onDeleteProyecto,
}: ProyectosTabProps) {
  const { requestConfirm } = useNotif();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEstado, setEditEstado] = useState<'Pendiente' | 'En Proceso' | 'Completado'>('En Proceso');
  const [editActivo, setEditActivo] = useState(true);

  const startEdit = (p: Proyecto) => { 
    setEditingId(p.id); 
    setEditNombre(p.nombre); 
    setEditEstado(p.estado); 
    setEditActivo(p.activo !== false);
  };
  const cancelEdit = () => setEditingId(null);
  const submitEdit = async () => {
    if (!editNombre.trim()) return;
    await onEditProyecto(editingId!, { nombre: editNombre.trim(), estado: editEstado, activo: editActivo });
    setEditingId(null);
  };
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Creation Form */}
      <AdminSection
        title="Registrar Nuevo Proyecto Operativo"
        icon={<FolderPlus className="w-5 h-5 text-cyan-400" />}
        description="Crea un proyecto y asócialo a un cliente existente"
        variant="highlighted"
      >
        <form onSubmit={onCreateProject} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Razón Social Mapeada *</label>
            <select
              required
              value={newProjClientId}
              onChange={(e) => setNewProjClientId(e.target.value)}
              className="w-full glass-select rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">-- Seleccionar --</option>
              {data.clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Nombre exacto del Proyecto *</label>
            <input
              type="text"
              required
              placeholder="Ej: Campaña Supermercados 2026"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:bg-cyan-500 font-bold text-xs text-white rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <FolderGit2 className="w-4 h-4" />
              Abrir Proyecto
            </button>
          </div>
        </form>
      </AdminSection>

      {/* List */}
      <AdminSection
        title={`Proyectos en Cartera (${data.proyectos.length})`}
        icon={<FolderGit2 className="w-5 h-5 text-cyan-400" />}
      >
        <div className="space-y-3">
          {data.proyectos.map(p => {
            const client = data.clientes.find(c => c.id === p.clienteId);
            return (
              <div key={p.id}>
                {editingId === p.id ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white/5 border border-cyan-500/30 space-y-3">
                    <input value={editNombre} onChange={e => setEditNombre(e.target.value)} placeholder="Nombre del proyecto" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                    <select value={editEstado} onChange={e => setEditEstado(e.target.value as any)} className="w-full glass-select rounded-xl px-3 py-2 text-sm">
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Completado">Completado</option>
                    </select>
                    <div className="flex items-center gap-2 py-1">
                      <input 
                        type="checkbox" 
                        id="editActivo" 
                        checked={editActivo} 
                        onChange={e => setEditActivo(e.target.checked)} 
                        className="rounded border-white/10 bg-slate-800 text-cyan-600 focus:ring-cyan-500" 
                      />
                      <label htmlFor="editActivo" className="text-xs text-slate-300 font-mono cursor-pointer select-none">Proyecto Activo (mostrar en registros)</label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={submitEdit} className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all">Guardar</button>
                      <button onClick={cancelEdit} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg transition-all">Cancelar</button>
                    </div>
                  </motion.div>
                ) : (
                  <DataCard
                    title={p.nombre}
                    subtitle={`Cliente: ${client ? client.nombre : 'Desconocido'}`}
                    badge={{ 
                      label: p.activo === false ? 'Finalizado' : p.estado, 
                      color: p.activo === false ? 'rose' : 'cyan' 
                    }}
                    icon={<FolderGit2 className="w-4 h-4" />}
                  >
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => startEdit(p)} className="text-[10px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/20 transition-all">Editar</button>
                      <button onClick={() => requestConfirm(`¿Eliminar proyecto?`, `Se eliminarán todos los registros asociados a "${p.nombre}".`, 'danger', () => onDeleteProyecto(p.id), 'Eliminar')} className="text-[10px] px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/20 transition-all">Eliminar</button>
                    </div>
                  </DataCard>
                )}
              </div>
            );
          })}
        </div>
      </AdminSection>
    </motion.div>
  );
}

// ============================================================================
// COLABORADORES TAB - Simplified management interface
// ============================================================================

interface ColaboradoresTabProps {
  data: DatabaseState;
  newColabName: string;
  setNewColabName: (name: string) => void;
  newColabRol: string;
  setNewColabRol: (rol: string) => void;
  newColabTarif: string;
  setNewColabTarif: (tarif: string) => void;
  onCreateCollaborator: (e: React.FormEvent) => void;
  onEditColaborador: (id: string, data: Partial<Colaborador>) => Promise<void>;
  onDeleteColaborador: (id: string) => Promise<void>;
}

function ColaboradoresTab({
  data,
  newColabName,
  setNewColabName,
  newColabRol,
  setNewColabRol,
  newColabTarif,
  setNewColabTarif,
  onCreateCollaborator,
  onEditColaborador,
  onDeleteColaborador,
}: ColaboradoresTabProps) {
  const { requestConfirm } = useNotif();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('');
  const [editTarifa, setEditTarifa] = useState('');

  const startEdit = (c: Colaborador) => { setEditingId(c.id); setEditNombre(c.nombre); setEditRol(c.rol || ''); setEditTarifa(String(c.tarifaSugerida)); };
  const cancelEdit = () => setEditingId(null);
  const submitEdit = async () => {
    if (!editNombre.trim()) return;
    await onEditColaborador(editingId!, { nombre: editNombre.trim(), rol: editRol.trim(), tarifaSugerida: parseFloat(editTarifa) || 350 });
    setEditingId(null);
  };
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Creation Form */}
      <AdminSection
        title="Agregar Colaborador / Contratista"
        icon={<Plus className="w-5 h-5 text-pink-400" />}
        description="Registra un nuevo trabajador o contratista al sistema"
        variant="highlighted"
      >
        <form onSubmit={onCreateCollaborator} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Nombre Completo *</label>
            <input
              type="text"
              required
              placeholder="Ej: Marcelo Spósito"
              value={newColabName}
              onChange={(e) => setNewColabName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Rol / Especialización</label>
            <input
              type="text"
              placeholder="Ej: Montador de Estructuras"
              value={newColabRol}
              onChange={(e) => setNewColabRol(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-mono">Tarifa por Minuto *</label>
            <input
              type="number"
              required
              value={newColabTarif}
              onChange={(e) => setNewColabTarif(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:bg-pink-500 font-bold text-xs text-white rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Dar de Alta
            </button>
          </div>
        </form>
      </AdminSection>

      {/* List */}
      <AdminSection
        title={`Listado de Contratistas (${data.colaboradores.length})`}
        icon={<Users className="w-5 h-5 text-pink-400" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.colaboradores.map(c => (
            <div key={c.id}>
              {editingId === c.id ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white/5 border border-pink-500/30 space-y-3">
                  <input value={editNombre} onChange={e => setEditNombre(e.target.value)} placeholder="Nombre" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                  <input value={editRol} onChange={e => setEditRol(e.target.value)} placeholder="Rol" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                  <input type="number" value={editTarifa} onChange={e => setEditTarifa(e.target.value)} placeholder="Tarifa/min" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={submitEdit} className="flex-1 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg transition-all">Guardar</button>
                    <button onClick={cancelEdit} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg transition-all">Cancelar</button>
                  </div>
                </motion.div>
              ) : (
                <DataCard
                  title={c.nombre}
                  subtitle={c.rol || 'Operario'}
                  badge={{ label: 'Activo', color: 'pink' }}
                  icon={<Users className="w-4 h-4" />}
                >
                  <div className="text-[10px] text-pink-300 font-mono mt-2">
                    Tarifa: Gs. {c.tarifaSugerida || 350}/min (~Gs. {((c.tarifaSugerida || 350) * 60).toLocaleString('es-PY')}/hora)
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => startEdit(c)} className="text-[10px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/20 transition-all">Editar</button>
                    <button onClick={() => requestConfirm(`¿Eliminar colaborador?`, `Se eliminará a "${c.nombre}" permanentemente.`, 'danger', () => onDeleteColaborador(c.id), 'Eliminar')} className="text-[10px] px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/20 transition-all">Eliminar</button>
                  </div>
                </DataCard>
              )}
            </div>
          ))}
        </div>
      </AdminSection>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT - AdminPanel with improved state management
// ============================================================================

export default function AdminPanel({
  data,
  onAddRegistro,
  onAddCliente,
  onEditCliente,
  onDeleteCliente,
  onAddProyecto,
  onEditProyecto,
  onDeleteProyecto,
  onAddColaborador,
  onEditColaborador,
  onDeleteColaborador,
  onResetDatabase,
  onRefresh,
  initialVehicleEditId,
  initialSubTab
}: AdminPanelProps) {
  const { showToast, requestConfirm } = useNotif();
  // Tabs for the administration panel - usar initialSubTab si existe
  const [activeSubTab, setActiveSubTab] = useState<'registro' | 'clientes' | 'proyectos' | 'colaboradores' | 'vehiculos' | 'usuarios' | 'marcaciones' | 'auditlog'>(
    (initialSubTab as any) || 'registro'
  );

  // --- 1. Manual Recording Form State ---
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [concepto, setConcepto] = useState<'MO' | 'Insumo' | 'Otros'>('MO');
  const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');
  
  // Sizing quantities inside form
  const [hours, setHours] = useState('5');
  const [quantity, setQuantity] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('350');
  
  const [isSubmitPending, setIsSubmitPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- 2. Create Client State ---
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');

  // --- 3. Create Project State ---
  const [newProjClientId, setNewProjClientId] = useState('');
  const [newProjName, setNewProjName] = useState('');

  // --- 4. Create Collaborator State ---
  const [newColabName, setNewColabName] = useState('');
  const [newColabTarif, setNewColabTarif] = useState('350');
  const [newColabRol, setNewColabRol] = useState('Operario');

  // Handle collaborator selection tariff updates
  const handleColaboradorSelect = (id: string) => {
    setSelectedColaboradorId(id);
    const colab = data.colaboradores.find(col => col.id === id);
    if (colab) {
      setPrecioUnitario(String(colab.tarifaSugerida));
    }
  };

  // Submit manual registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedClienteId || !selectedProyectoId || !descripcion) {
      setFormError('Por favor completa todos los campos mandatorios.');
      return;
    }

    setIsSubmitPending(true);
    
    // Compute total & minutes mapping
    const finalCantidad = concepto === 'MO' ? parseFloat(hours) * 60 : parseFloat(quantity);
    const finalPrecio = parseFloat(precioUnitario) || 0;
    const computedTotal = finalCantidad * finalPrecio;

    const success = await onAddRegistro({
      clienteId: selectedClienteId,
      proyectoId: selectedProyectoId,
      concepto,
      fecha,
      descripcion,
      colaboradorId: concepto === 'MO' ? selectedColaboradorId : undefined,
      hsInicio: concepto === 'MO' ? '08:00' : undefined,
      hsFin: concepto === 'MO' ? '13:00' : undefined,
      hsTotal: concepto === 'MO' ? parseFloat(hours) : undefined,
      cantidad: finalCantidad,
      precioUnitario: finalPrecio,
      total: computedTotal
    });

    setIsSubmitPending(false);

    if (success) {
      // Clear fields
      setDescripcion('');
      setFormError(null);
      showToast('Registro guardado con éxito', 'success');
    } else {
      setFormError('Ocurrió un error al guardar el registro en la base de datos.');
    }
  };

  // Create client
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    onAddCliente({
      id: `cli_${Math.random().toString(36).substring(2, 7)}`,
      nombre: newClientName,
      codigo: newClientCode || newClientName.substring(0, 4).toUpperCase(),
      fechaCreacion: new Date().toISOString().substring(0, 10)
    });
    setNewClientName('');
    setNewClientCode('');
    showToast('Cliente creado con éxito', 'success');
  };

  // Create project
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName || !newProjClientId) return;
    onAddProyecto({
      id: `pro_${Math.random().toString(36).substring(2, 7)}`,
      clienteId: newProjClientId,
      nombre: newProjName,
      estado: 'En Proceso',
      fechaInicio: new Date().toISOString().substring(0, 10)
    });
    setNewProjName('');
    showToast('Proyecto creado con éxito', 'success');
  };

  // Create Worker
  const handleCreateCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColabName) return;
    onAddColaborador({
      id: `col_${Math.random().toString(36).substring(2, 7)}`,
      nombre: newColabName,
      tarifaSugerida: parseFloat(newColabTarif) || 350,
      rol: newColabRol
    });
    setNewColabName('');
    setNewColabTarif('350');
    setNewColabRol('Operario');
    showToast('Colaborador creado en base de datos', 'success');
  };

  return (
    <div id="admin_control_view" className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
      
      {/* Sidebar navigation tabs for admin view */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 font-mono">Bases del Sistema</h3>
        <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
          
          <button
            onClick={() => setActiveSubTab('registro')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'registro' 
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Nueva Carga Directa</span>
          </button>

          <button
            onClick={() => setActiveSubTab('clientes')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'clientes' 
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Clientes de Cartera ({data.clientes.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('proyectos')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'proyectos' 
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Proyectos Registrados ({data.proyectos.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('colaboradores')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'colaboradores' 
                ? 'bg-pink-600/20 text-pink-300 border border-pink-500/30' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Colaboradores ({data.colaboradores.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('vehiculos')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'vehiculos' 
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Vehículos ({(data.registrosVehiculo || []).length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('usuarios')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'usuarios' 
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Usuarios de Acceso</span>
          </button>

          <button
            onClick={() => setActiveSubTab('marcaciones')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'marcaciones' 
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Marcaciones</span>
          </button>

          <button
            onClick={() => setActiveSubTab('auditlog')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
              activeSubTab === 'auditlog' 
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold' 
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Accesos</span>
          </button>

        </nav>

        {/* Global actions - Reset dataset */}
        <div className="pt-8 border-t border-white/5">
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-medium">
              <BadgeAlert className="w-4 h-4" />
              <span>Zona de Peligro</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ¿Deseas vaciar la base de datos temporal e importar datos de prueba iniciales del sistema?
            </p>
            <button
              onClick={() => {
                requestConfirm(
                  '¿Restaurar Base de Datos?',
                  '¿Seguro que deseas reiniciar los datos al estado de fábrica de la plataforma? Se perderán las planillas cargadas.',
                  'danger',
                  onResetDatabase
                );
              }}
              className="w-full py-2 bg-rose-600/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Restaurar Base</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form/Administration Body */}
      <div className="lg:col-span-3">
        <AnimatePresence mode="wait">
          {activeSubTab === 'registro' && (
            <RegistroManualForm
              key="registro"
              data={data}
              onSubmit={handleRegisterSubmit}
              isSubmitPending={isSubmitPending}
              formError={formError}
              selectedClienteId={selectedClienteId}
              setSelectedClienteId={setSelectedClienteId}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              concepto={concepto}
              setConcepto={setConcepto}
              fecha={fecha}
              setFecha={setFecha}
              descripcion={descripcion}
              setDescripcion={setDescripcion}
              selectedColaboradorId={selectedColaboradorId}
              handleColaboradorSelect={handleColaboradorSelect}
              hours={hours}
              setHours={setHours}
              quantity={quantity}
              setQuantity={setQuantity}
              precioUnitario={precioUnitario}
              setPrecioUnitario={setPrecioUnitario}
            />
          )}

          {activeSubTab === 'clientes' && (
            <ClientesTab
              key="clientes"
              data={data}
              newClientName={newClientName}
              setNewClientName={setNewClientName}
              newClientCode={newClientCode}
              setNewClientCode={setNewClientCode}
              onCreateClient={handleCreateClient}
              onEditCliente={onEditCliente}
              onDeleteCliente={onDeleteCliente}
            />
          )}

          {activeSubTab === 'proyectos' && (
            <ProyectosTab
              key="proyectos"
              data={data}
              newProjClientId={newProjClientId}
              setNewProjClientId={setNewProjClientId}
              newProjName={newProjName}
              setNewProjName={setNewProjName}
              onCreateProject={handleCreateProject}
              onEditProyecto={onEditProyecto}
              onDeleteProyecto={onDeleteProyecto}
            />
          )}

          {activeSubTab === 'colaboradores' && (
            <ColaboradoresTab
              key="colaboradores"
              data={data}
              newColabName={newColabName}
              setNewColabName={setNewColabName}
              newColabRol={newColabRol}
              setNewColabRol={setNewColabRol}
              newColabTarif={newColabTarif}
              setNewColabTarif={setNewColabTarif}
              onCreateCollaborator={handleCreateCollaborator}
              onEditColaborador={onEditColaborador}
              onDeleteColaborador={onDeleteColaborador}
            />
          )}

          {activeSubTab === 'vehiculos' && (
            <VehiculosAdminView
              key="vehiculos"
              data={data}
              onRefresh={onRefresh || (async () => {})}
              initialEditId={initialVehicleEditId}
            />
          )}

          {activeSubTab === 'usuarios' && (
            <UsuariosTab
              key="usuarios"
              colaboradores={data.colaboradores}
            />
          )}

          {activeSubTab === 'marcaciones' && (
            <TimelineMarcaciones key="marcaciones" />
          )}

          {activeSubTab === 'auditlog' && (
            <AuditLogTab key="auditlog" />
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
