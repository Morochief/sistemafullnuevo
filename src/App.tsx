/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * App.tsx — Sistema aFull v2.0
 * Updated: Added Login module + Reportería & Pre-Facturación tab
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { pageVariants, pageTransition, cardVariants, cardTransition } from './src/lib/animations.ts';
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
import MarcacionesUI from './components/MarcacionesUI.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { NotifProvider, useNotif } from './context/NotifContext.tsx';

type TabType = 'dashboard' | 'registro' | 'import' | 'admin' | 'reportes' | 'misregistros';

interface SessionUser {
  nombre: string;
  rol: string;
  usuario: string;
  colaboradorId?: string;
}

const MARKUP_RATE_KEY = 'afull_markup_rate';

function AppInner() {
  const { showToast } = useNotif();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dbState, setDbState] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [markupRate, setMarkupRate] = useState<number>(0.35);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
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
      // First restore user session from JWT cookie
      const meResponse = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!meResponse.ok) {
        // No valid session cookie — show login
        setSession(null);
        setLoading(false);
        return;
      }

      const meResult = await meResponse.json();
      if (!meResult.success || !meResult.data?.user) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Session is valid — restore it
      setSession(meResult.data.user);

      // Then load app data
      const response = await fetch('/api/data', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDbState(result.data);
        }
        // If /api/data fails, session is still valid — user stays logged in
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
      showToast('Error al eliminar registro: ' + (err.message || ''), 'error');
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
        showToast('Sesión expirada. Por favor, vuelve a iniciar sesión.', 'error');
        handleLogout();
      } else {
        showToast('Error al actualizar registro: ' + (err.message || ''), 'error');
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
      showToast('Error al reiniciar base de datos: ' + (err.message || ''), 'error');
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
      showToast('Error de sincronización con el servidor: ' + (err.message || ''), 'error');
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
        showToast('Sesión expirada. Por favor, vuelve a iniciar sesión.', 'error');
        handleLogout();
      } else {
        showToast('Error al crear registro: ' + (err.message || ''), 'error');
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
      showToast('Error al crear cliente: ' + (err.message || ''), 'error');
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
      showToast('Error al actualizar cliente: ' + (err.message || ''), 'error');
    }
  };

  const handleDeleteClienteObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/clientes/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, clientes: dbState.clientes.filter(c => c.id !== id) });
    } catch (err: any) {
      showToast('Error al eliminar cliente: ' + (err.message || ''), 'error');
    }
  };

  const handleAddProyectoObj = async (newProyecto: Proyecto) => {
    if (!dbState) return;
    const res = await authFetchJSON('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: newProyecto.clienteId, nombre: newProyecto.nombre, estado: newProyecto.estado, fechaInicio: newProyecto.fechaInicio })
    });
    if (res.success && res.data) {
      setDbState({ ...dbState, proyectos: [...dbState.proyectos, res.data] });
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
      showToast('Error al actualizar proyecto: ' + (err.message || ''), 'error');
    }
  };

  const handleDeleteProyectoObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/proyectos/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, proyectos: dbState.proyectos.filter(p => p.id !== id) });
    } catch (err: any) {
      showToast('Error al eliminar proyecto: ' + (err.message || ''), 'error');
    }
  };

  const handleAddColaboradorObj = async (newColaborador: any) => {
    if (!dbState) return;
    try {
      const res = await authFetchJSON('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newColaborador)
      });
      if (res.success && res.data) {
        setDbState({ ...dbState, colaboradores: [...dbState.colaboradores, res.data] });
      }
    } catch (err: any) {
      showToast('Error al crear colaborador: ' + (err.message || ''), 'error');
    }
  };

  const handleEditColaboradorObj = async (id: string, data: any) => {
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
      showToast('Error al actualizar colaborador: ' + (err.message || ''), 'error');
    }
  };

  const handleDeleteColaboradorObj = async (id: string) => {
    if (!dbState) return;
    try {
      await authFetchJSON(`/api/colaboradores/${id}`, { method: 'DELETE' });
      setDbState({ ...dbState, colaboradores: dbState.colaboradores.filter(c => c.id !== id) });
    } catch (err: any) {
      showToast('Error al eliminar colaborador: ' + (err.message || ''), 'error');
    }
  };

  const handleImportConfirmed = async (newFullDbState: DatabaseState) => {
    if (!dbState) return;

    setIsImporting(true);
    setProgress(10);

    let progressInterval: any;

    try {
      // Simulate progress progression up to 90%
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 8) + 2;
        });
      }, 250);

      const resData = await authFetchJSON('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientes: newFullDbState.clientes,
          proyectos: newFullDbState.proyectos,
          registros: newFullDbState.registros
        })
      });

      clearInterval(progressInterval);

      if (resData.success && resData.data) {
        setProgress(100);
        // Short delay so the user sees completion state
        await new Promise(resolve => setTimeout(resolve, 800));

        const { guardados, errores } = resData.data;
        // Recargar datos desde Supabase
        await fetchDbState();

        if (errores === 0) {
          showToast(`Importación exitosa: ${guardados} registros guardados en Supabase.`, 'success');
        } else {
          showToast(`Importación parcial: ${guardados} guardados, ${errores} errores.`, 'warning');
        }
        setActiveTab('dashboard');
      } else {
        throw new Error(resData.error?.message || 'Error en la respuesta del servidor');
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      showToast('Error al importar: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setIsImporting(false);
      setProgress(0);
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
            <div className="h-9 w-9 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img src="/Logo-AFULL-_1_.svg" alt="aFull Logo" className="w-6 h-6 object-contain" />
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
              { id: 'misregistros', label: 'Mis Registros', icon: Folder, adminOnly: false, hideForAdmin: true, badge: (dbState?.registros || []).filter(r => {
                const user = session;
                if (!user || !user.nombre) return false;
                const colaborador = (dbState?.colaboradores || []).find(
                  col => {
                    if (!col || !col.nombre) return false;
                    const colName = col.nombre.toLowerCase();
                    const userName = user.nombre.toLowerCase();
                    return colName.includes(userName) || userName.includes(colName);
                  }
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

          {/* Marcaciones UI */}
          <div className="flex items-center">
            {session.usuario && (
              <MarcacionesUI usuario={session.usuario} showToast={showToast} />
            )}
          </div>

          {/* User Session Badge + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] font-bold text-white leading-none">{session.nombre || session.usuario || 'Usuario'}</p>
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">{session.rol || 'Operario'}</p>
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
                onRefresh={fetchDbState}
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
                isSaving={isImporting}
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
      
      {/* Glassmorphic Loader Overlay */}
      <AnimatePresence>
        {isImporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617]/85 backdrop-blur-xl select-none"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
            
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-panel p-8 rounded-3xl flex flex-col items-center gap-6 text-center max-w-sm w-[90%] relative z-10 border border-white/10 shadow-2xl shadow-blue-500/5"
            >
              {/* Premium HSL Spinner */}
              <div className="relative w-20 h-20">
                {/* Glowing Background Ring */}
                <div className="absolute inset-0 rounded-full border border-blue-500/20 blur-[2px]" />
                
                {/* Animated Inner Spinner */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="w-full h-full rounded-full border-2 border-transparent border-t-blue-500 border-r-indigo-500"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))'
                  }}
                />

                {/* Center Core */}
                <div className="absolute inset-[3px] rounded-full bg-[#020617]/90 flex items-center justify-center border border-white/5">
                  <span className="font-mono text-xs font-bold text-blue-400">{Math.min(100, Math.round(progress))}%</span>
                </div>
              </div>

              {/* Progress and status message */}
              <div className="w-full space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-sans font-bold text-lg text-white tracking-wide">
                    Procesando Importación
                  </h3>
                  <p className="text-xs text-slate-400 font-medium min-h-[1.5rem] tracking-wide transition-all duration-300">
                    {progress < 30 && "Validando estructura de datos..."}
                    {progress >= 30 && progress < 65 && "Procesando transacciones en base de datos..."}
                    {progress >= 65 && progress < 90 && "Sincronizando información..."}
                    {progress >= 90 && progress < 100 && "Finalizando tareas de importación..."}
                    {progress >= 100 && "¡Sincronización exitosa!"}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "tween", ease: "easeInOut" }}
                    style={{
                      boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)'
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NotifProvider>
        <AppInner />
      </NotifProvider>
    </ErrorBoundary>
  );
}
