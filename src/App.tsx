/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * App.tsx — Sistema aFull v2.0
 * Updated: Added Login module + Reportería & Pre-Facturación tab
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  ShieldCheck, 
  FileSpreadsheet, 
  HardHat,
  Infinity,
  ShieldAlert,
  BarChart2,
  LogOut,
  User as UserIcon,
  ClipboardList,
  Folder,
} from 'lucide-react';
import { DatabaseState, Cliente, Proyecto, Colaborador } from './types.ts';
import { authFetch, authFetchJSON, clearCSRFToken } from './authFetch.ts';
import Dashboard from './components/Dashboard.tsx';
import ExcelImporter from './components/ExcelImporter.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import Reportes from './components/Reportes.tsx';
import Login from './components/Login.tsx';
import RegistroOperativo from './components/RegistroOperativo.tsx';
import MisRegistros from './components/MisRegistros.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

type TabType = 'dashboard' | 'registro' | 'import' | 'admin' | 'reportes' | 'misregistros';

interface SessionUser {
  nombre: string;
  rol: string;
  usuario: string;
}

const MARKUP_RATE_KEY = 'afull_markup_rate';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dbState, setDbState] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [markupRate, setMarkupRate] = useState<number>(0.35);
  
  // Navigation state for deep-linking to specific records
  const [vehicleEditId, setVehicleEditId] = useState<string | null>(null);
  const [adminSubTab, setAdminSubTab] = useState<string | null>(null);
  
  // Clear vehicle edit ID after it's been used (after navigating to admin panel)
  useEffect(() => {
    if (vehicleEditId && activeTab === 'admin') {
      // Clear after delay to ensure child component has received and used the prop
      const timer = setTimeout(() => {
        console.log('Clearing navigation state');
        setVehicleEditId(null);
        setAdminSubTab(null);
      }, 500); // Increased to 500ms
      return () => clearTimeout(timer);
    }
  }, [vehicleEditId, activeTab]);

  // SECURITY Phase 2 Fix #5: Check if user is authenticated by trying to fetch data
  // Session is now maintained via httpOnly cookie, not sessionStorage
  useEffect(() => {
    const savedMarkup = localStorage.getItem(MARKUP_RATE_KEY);
    if (savedMarkup) {
      setMarkupRate(parseFloat(savedMarkup));
    }
    
    // Try to fetch data to check if user has valid session cookie
    checkAuthStatus();
  }, []);

  // Check if user is authenticated by attempting to fetch data
  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data', {
        credentials: 'include' // Include httpOnly cookie
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // User is authenticated via cookie, but we don't have user info yet
          // We'll get it after first successful data fetch
          setDbState(result.data);
          // Set minimal session to indicate user is logged in
          // Full user info will be populated on login
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
    } catch (error) {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch DB state
  const fetchDbState = async () => {
    if (!session) return;
    
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/data', {
        credentials: 'include' // SECURITY Phase 2 Fix #5: Use cookie auth
      });
      
      if (response.status === 401) {
        // Token invalid/expired - logout
        handleLogout();
        return;
      }
      
      if (!response.ok) throw new Error('Error al conectar con la base del Sistema aFull.');
      
      const result = await response.json();
      setDbState(result.data || result); // Support both formats
    } catch (err: any) {
      setFetchError(err.message || 'Error de red.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchDbState();
    } else {
      setLoading(false);
    }
  }, [session]);

  // RBAC: Redirect non-admin users away from restricted tabs
  useEffect(() => {
    if (session && session.rol !== 'Admin') {
      // Non-admin users can access 'registro' y 'misregistros'
      const allowedTabs: TabType[] = ['registro', 'misregistros'];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('registro');
      }
    }
  }, [activeTab, session]);

  // --- AUTH HANDLERS ---
  const handleLoginSuccess = (user: SessionUser) => {
    setSession(user);
    // RBAC: Non-admin users start on 'registro' tab
    if (user.rol !== 'Admin') {
      setActiveTab('registro');
    }
    // SECURITY Phase 2 Fix #5: Don't store token - it's in httpOnly cookie
    // Just store user info for display
  };

  const handleLogout = async () => {
    // SECURITY Phase 2 Fix #5: Call logout endpoint to clear httpOnly cookie
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      // Continue logout even if server call fails
    }
    
    clearCSRFToken(); // Clear CSRF token cache
    setSession(null);
    setDbState(null);
    setActiveTab('dashboard');
  };

  const handleMarkupChange = (rate: number) => {
    setMarkupRate(rate);
    localStorage.setItem(MARKUP_RATE_KEY, rate.toString());
  };
  
  // Navigation handler for editing vehicle records from Dashboard
  const handleNavigateToVehicleEdit = (vehicleId: string) => {
    setVehicleEditId(vehicleId);
    setAdminSubTab('vehiculos');
    setActiveTab('admin');
  };
  
  // Clear navigation state when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'admin') {
      setVehicleEditId(null);
      setAdminSubTab(null);
    }
  };

  // --- DATA HANDLERS ---
  const handleDeleteRegistro = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetch(`/api/registros/${id}`, { method: 'DELETE' });
      // Force new array reference to trigger React re-render
      const updatedRegistros = dbState.registros.filter(r => r.id !== id);
      setDbState({ 
        ...dbState, 
        registros: updatedRegistros 
      });
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar registro: ' + (err.message || ''));
    }
  };

  const handleEditRegistro = async (id: string, updatedData: any): Promise<boolean> => {
    if (!dbState) return false;
    try {
      const resData = await authFetchJSON(`/api/registros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      if (resData.success && resData.data) {
        // Update the registro in the local state
        const updatedRegistros = dbState.registros.map(r => 
          r.id === id ? resData.data : r
        );
        setDbState({ ...dbState, registros: updatedRegistros });
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(err);
      // Check if it's an auth error
      if (err.message && (err.message.includes('401') || err.message.includes('autenticación'))) {
        alert('Sesión expirada. Por favor, vuelve a iniciar sesión.');
        handleLogout();
      } else {
        alert('Error al actualizar registro: ' + (err.message || ''));
      }
      return false;
    }
  };

  const handleResetDatabase = async () => {
    try {
      await authFetch('/api/clear', { method: 'POST' });
      await fetchDbState();
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error(err);
      alert('Error al reiniciar base de datos: ' + (err.message || ''));
    }
  };

  const handleSaveState = async (updatedDb: DatabaseState): Promise<boolean> => {
    try {
      await authFetch('/api/save-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb)
      });
      setDbState(updatedDb);
      return true;
    } catch (err: any) {
      console.error(err);
      alert('Error de sincronización con el servidor: ' + (err.message || ''));
      return false;
    }
  };

  const handleAddManualRegistro = async (newItemRaw: any): Promise<boolean> => {
    try {
      const resData = await authFetchJSON('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemRaw)
      });
      
      if (resData.success && resData.data && dbState) {
        setDbState({ ...dbState, registros: [resData.data, ...dbState.registros] });
        return true;
      }
      return false;
    } catch (err: any) {
      // Check if it's an auth error
      if (err.message && (err.message.includes('401') || err.message.includes('autenticación'))) {
        alert('Sesión expirada. Por favor, vuelve a iniciar sesión.');
        handleLogout();
      } else {
        alert('Error al crear registro: ' + (err.message || ''));
      }
      return false;
    }
  };

  const handleAddClienteObj = async (newCliente: Cliente) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newCliente.nombre, codigo: newCliente.codigo })
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, clientes: [...dbState.clientes, res.data] });
      }
    } catch (err: any) {
      alert('Error al crear cliente: ' + (err.message || ''));
    }
  };

  const handleEditClienteObj = async (id: string, data: Partial<Cliente>) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, clientes: dbState.clientes.map(c => c.id === id ? res.data : c) });
      }
    } catch (err: any) {
      alert('Error al actualizar cliente: ' + (err.message || ''));
    }
  };

  const handleDeleteClienteObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/clientes/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, clientes: dbState.clientes.filter(c => c.id !== id) });
    } catch (err: any) {
      alert('Error al eliminar cliente: ' + (err.message || ''));
    }
  };

  const handleAddProyectoObj = async (newProyecto: Proyecto) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: newProyecto.clienteId, nombre: newProyecto.nombre, estado: newProyecto.estado, fechaInicio: newProyecto.fechaInicio })
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, proyectos: [...dbState.proyectos, res.data] });
      }
    } catch (err: any) {
      alert('Error al crear proyecto: ' + (err.message || ''));
    }
  };

  const handleEditProyectoObj = async (id: string, data: Partial<Proyecto>) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON(`/api/proyectos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, proyectos: dbState.proyectos.map(p => p.id === id ? res.data : p) });
      }
    } catch (err: any) {
      alert('Error al actualizar proyecto: ' + (err.message || ''));
    }
  };

  const handleDeleteProyectoObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/proyectos/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, proyectos: dbState.proyectos.filter(p => p.id !== id) });
    } catch (err: any) {
      alert('Error al eliminar proyecto: ' + (err.message || ''));
    }
  };

  const handleAddColaboradorObj = async (newColaborador: Colaborador) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newColaborador.nombre, rol: newColaborador.rol, tarifaSugerida: newColaborador.tarifaSugerida })
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, colaboradores: [...dbState.colaboradores, res.data] });
      }
    } catch (err: any) {
      alert('Error al crear colaborador: ' + (err.message || ''));
    }
  };

  const handleEditColaboradorObj = async (id: string, data: Partial<Colaborador>) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON(`/api/colaboradores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, colaboradores: dbState.colaboradores.map(c => c.id === id ? res.data : c) });
      }
    } catch (err: any) {
      alert('Error al actualizar colaborador: ' + (err.message || ''));
    }
  };

  const handleDeleteColaboradorObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/colaboradores/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, colaboradores: dbState.colaboradores.filter(c => c.id !== id) });
    } catch (err: any) {
      alert('Error al eliminar colaborador: ' + (err.message || ''));
    }
  };

  const handleImportConfirmed = async (newFullDbState: DatabaseState) => {
    if (!dbState) return;

    let errores = 0;
    let guardados = 0;

    try {
      // Mapas de IDs locales (generados por ExcelImporter) → IDs reales del backend
      const clienteIdMap = new Map<string, string>();
      const proyectoIdMap = new Map<string, string>();

      // 1. Clientes: los existentes mapean a sí mismos; los nuevos capturan el ID real del backend
      const clientesExistentes = new Map(dbState.clientes.map(c => [c.id, c.id]));
      for (const cliente of newFullDbState.clientes) {
        if (clientesExistentes.has(cliente.id)) {
          clienteIdMap.set(cliente.id, cliente.id);
        } else {
          try {
            const res = await authFetchJSON('/api/clientes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nombre: cliente.nombre, codigo: cliente.codigo })
            });
            clienteIdMap.set(cliente.id, res.success && res.data ? res.data.id : cliente.id);
          } catch { errores++; clienteIdMap.set(cliente.id, cliente.id); }
        }
      }

      // 2. Proyectos: usar el ID real del cliente al crear
      const proyectosExistentes = new Map(dbState.proyectos.map(p => [p.id, p.id]));
      for (const proyecto of newFullDbState.proyectos) {
        if (proyectosExistentes.has(proyecto.id)) {
          proyectoIdMap.set(proyecto.id, proyecto.id);
        } else {
          const realClienteId = clienteIdMap.get(proyecto.clienteId) || proyecto.clienteId;
          try {
            const res = await authFetchJSON('/api/proyectos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clienteId: realClienteId, nombre: proyecto.nombre, estado: proyecto.estado, fechaInicio: proyecto.fechaInicio })
            });
            proyectoIdMap.set(proyecto.id, res.success && res.data ? res.data.id : proyecto.id);
          } catch { errores++; proyectoIdMap.set(proyecto.id, proyecto.id); }
        }
      }

      // 3. Registros nuevos: sustituir IDs locales por IDs reales
      const registrosExistentes = new Set(dbState.registros.map(r => r.id));
      const registrosNuevos = newFullDbState.registros.filter(r => !registrosExistentes.has(r.id));

      for (const item of registrosNuevos) {
        const realClienteId = clienteIdMap.get(item.clienteId) || item.clienteId;
        const realProyectoId = proyectoIdMap.get(item.proyectoId) || item.proyectoId;

        // Validación defensiva: saltar registros con datos inválidos que Zod rechazaría
        if (!realClienteId || !realProyectoId) { errores++; continue; }
        if (!item.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) { errores++; continue; }
        if (!item.cantidad || item.cantidad <= 0) { errores++; continue; }
        if (!item.precioUnitario || item.precioUnitario <= 0) { errores++; continue; }
        const total = item.total > 0 ? item.total : item.cantidad * item.precioUnitario;
        if (total <= 0) { errores++; continue; }
        // Normalizar concepto — el backend acepta solo 'MO', 'Insumo', 'Otros'
        const conceptoValido: 'MO' | 'Insumo' | 'Otros' =
          item.concepto === 'MO' ? 'MO' : item.concepto === 'Insumo' ? 'Insumo' : 'Otros';

        try {
          await authFetchJSON('/api/registros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: realClienteId,
              proyectoId: realProyectoId,
              fecha: item.fecha,
              concepto: conceptoValido,
              descripcion: item.descripcion || 'Sin descripción',
              colaboradorId: item.colaboradorId,
              hsInicio: item.hsInicio,
              hsFin: item.hsFin,
              hsTotal: item.hsTotal,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              total
            })
          });
          guardados++;
        } catch { errores++; }
      }

      // 4. Recargar datos desde Supabase
      await fetchDbState();

      if (errores === 0) {
        alert(`✅ Importación exitosa: ${guardados} registros guardados en Supabase.`);
      } else {
        alert(`⚠️ Importación parcial: ${guardados} guardados, ${errores} errores. Revisá los datos e intentá de nuevo.`);
      }
      setActiveTab('dashboard');
    } catch (err: any) {
      alert('Error al importar: ' + (err.message || ''));
    }
  };

  // ================================
  //  RENDER STATES
  // ================================

  // Not logged in → Show Login
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Loading data after login
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#020617] text-slate-300 relative overflow-hidden">
        <div className="glow-orb-primary -top-12 -left-12" />
        <div className="glow-orb-secondary -bottom-12 -right-12" />
        <div className="glass-panel p-8 rounded-3xl flex flex-col items-center gap-4 text-center max-w-sm relative z-10">
          <Infinity className="w-12 h-12 text-blue-500 animate-pulse" />
          <h1 className="font-sans font-bold text-xl text-white tracking-wide">Sistema aFull</h1>
          <p className="text-xs text-slate-400 font-mono tracking-wider animate-pulse">Sincronizando base de datos...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError || !dbState) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#020617] text-slate-300 relative overflow-hidden">
        <div className="glow-orb-primary -top-12 -left-12" />
        <div className="glass-panel p-8 rounded-3xl text-center max-w-lg space-y-4 relative z-10">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Error de Conexión</h1>
          <p className="text-red-300 text-sm">{fetchError || 'Fallo al inicializar base de datos local'}</p>
          <button
            onClick={fetchDbState}
            className="px-6 py-2 bg-blue-600 font-bold hover:bg-blue-500 rounded-xl text-white text-xs cursor-pointer transition-colors"
          >
            Re-intentar Sincronización
          </button>
        </div>
      </div>
    );
  }

  // ================================
  //  MAIN APP SHELL
  // ================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full bg-[#020617] relative pb-16 overflow-x-hidden">
      
      {/* Ambient Glow Orbs */}
      <div className="glow-orb-primary -top-32 left-1/4" />
      <div className="glow-orb-secondary bottom-1/4 -right-1/4" />
      <div className="glow-orb-primary bottom-0 left-10" />

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#020617]/65 border-b border-white/5 py-3 px-6 mb-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <HardHat className="w-4.5 h-4.5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm uppercase font-mono tracking-widest font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Sistema aFull
              </span>
              <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">
                Módulo de Automatización Operativa
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="flex bg-[#0f172a]/50 border border-white/5 p-1 rounded-xl overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Panel', icon: Tv, adminOnly: true },
              { id: 'registro', label: 'Registro', icon: ClipboardList, adminOnly: false },
              { id: 'misregistros', label: 'Mis Registros', icon: Folder, adminOnly: false, hideForAdmin: true, badge: dbState?.registros.filter(r => {
                const user = session;
                if (!user) return false;
                const colaborador = dbState?.colaboradores.find(
                  col => col.nombre.toLowerCase().includes(user.nombre.toLowerCase()) ||
                         user.nombre.toLowerCase().includes(col.nombre.toLowerCase())
                );
                return r.concepto === 'MO' && r.colaboradorId === colaborador?.id && r.fecha === new Date().toISOString().substring(0, 10);
              }).length || 0 },
              { id: 'import', label: 'Importar', icon: FileSpreadsheet, adminOnly: true },
              { id: 'reportes', label: 'Reportes', icon: BarChart2, adminOnly: true },
              { id: 'admin', label: 'Administración', icon: ShieldCheck, adminOnly: true },
            ]
            .filter(tab => {
              // RBAC: Non-admin users only see "Registro" and "Mis Registros" tabs
              if (session.rol !== 'Admin') {
                return !tab.adminOnly; // Only show tabs where adminOnly is false
              }
              // Admin ve todo MENOS los tabs marcados como hideForAdmin
              // ("Mis Registros" es redundante para el admin, que gestiona todo en Administración)
              if ('hideForAdmin' in tab && tab.hideForAdmin) {
                return false;
              }
              return true; // Admin sees everything else
            })
            .map(tab => {
              const Icon = tab.icon;
              const showBadge = tab.badge !== undefined && tab.badge > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {showBadge && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Session Badge + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] font-bold text-white leading-none">{session.nombre}</p>
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">{session.rol}</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <Dashboard
                data={dbState}
                onNavigateImport={() => setActiveTab('import')}
                onDeleteRegistro={handleDeleteRegistro}
                onEditRegistro={handleEditRegistro}
                onNavigateToVehicleEdit={handleNavigateToVehicleEdit}
              />
            </motion.div>
          )}

          {activeTab === 'registro' && (
            <motion.div
              key="registro_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <RegistroOperativo
                data={dbState}
                onAddRegistro={handleAddManualRegistro}
                currentUser={session}
              />
            </motion.div>
          )}

          {activeTab === 'misregistros' && (
            <motion.div
              key="misregistros_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <MisRegistros
                data={dbState}
                currentUser={session}
                onRefresh={fetchDbState}
              />
            </motion.div>
          )}

          {activeTab === 'import' && (
            <motion.div
              key="import_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <ExcelImporter
                currentDb={dbState}
                onImportConfirmed={handleImportConfirmed}
                onCancel={() => setActiveTab('dashboard')}
              />
            </motion.div>
          )}

          {activeTab === 'reportes' && (
            <motion.div
              key="reportes_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <Reportes
                data={dbState}
                markupRate={markupRate}
                onMarkupChange={handleMarkupChange}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && (
            <motion.div
              key="admin_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <AdminPanel
                data={dbState}
                onAddRegistro={handleAddManualRegistro}
                onAddCliente={handleAddClienteObj}
                onEditCliente={handleEditClienteObj}
                onDeleteCliente={handleDeleteClienteObj}
                onAddProyecto={handleAddProyectoObj}
                onEditProyecto={handleEditProyectoObj}
                onDeleteProyecto={handleDeleteProyectoObj}
                onAddColaborador={handleAddColaboradorObj}
                onEditColaborador={handleEditColaboradorObj}
                onDeleteColaborador={handleDeleteColaboradorObj}
                onResetDatabase={handleResetDatabase}
                onRefresh={fetchDbState}
                initialVehicleEditId={vehicleEditId}
                initialSubTab={adminSubTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </ErrorBoundary>
  );
}
