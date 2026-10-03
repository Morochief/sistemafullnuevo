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
  Infinity as InfinityIcon,
  ShieldAlert,
  BarChart2,
  LogOut,
  User as UserIcon,
  ClipboardList,
  Folder,
  ShoppingCart,
  FileText,
  Route,
  CheckSquare,
  Menu,
  ChevronLeft,
  X,
  RefreshCw,
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
import PedidosAdmin from './components/PedidosAdmin.tsx';
import PresupuestosAdmin from './components/PresupuestosAdmin.tsx';
import OrdenesTrabajoAdmin from './components/OrdenesTrabajoAdmin.tsx';
import HojasRutaAdmin from './components/HojasRutaAdmin.tsx';
import MisTareas from './components/MisTareas.tsx';
import { NotifProvider, useNotif } from './context/NotifContext.tsx';

type TabType = 'dashboard' | 'registro' | 'import' | 'admin' | 'reportes' | 'misregistros' | 'pedidos' | 'presupuestos' | 'ordenestrabajo' | 'hojasruta' | 'mistareas';

const VALID_TABS: TabType[] = [
  'dashboard',
  'registro',
  'import',
  'admin',
  'reportes',
  'misregistros',
  'pedidos',
  'presupuestos',
  'ordenestrabajo',
  'hojasruta',
  'mistareas'
];

interface SessionUser {
  nombre: string;
  rol: string;
  usuario: string;
  colaboradorId?: string;
}

const MARKUP_RATE_KEY = 'afull_markup_rate';
const ACTIVE_TAB_KEY = 'afull_active_tab';

function AppInner() {
  const { showToast } = useNotif();

  // Responsive state for mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Restore last active tab on refresh (F5)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
    if (saved && VALID_TABS.includes(saved as TabType)) {
      return saved as TabType;
    }
    return 'dashboard';
  });
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

  // Cache de pedidos para el modulo de presupuestos
  const [pedidosCache, setPedidosCache] = useState<any[]>([]);

  // Persist active tab so F5 stays on the same module
  useEffect(() => {
    if (session) {
      sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab, session]);
  
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

  // Check if user is authenticated by attempting to fetch data with resilient timeout
  const checkAuthStatus = async () => {
    setLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for mobile networks

    try {
      // First restore user session from JWT cookie
      const meResponse = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: controller.signal
      });

      // Solo cerrar sesión si el servidor respondió 401 explícitamente.
      // Otros errores (red, 500, servidor reiniciándose) NO cierran sesión.
      if (meResponse.status === 401) {
        setSession(null);
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      if (!meResponse.ok) {
        // Error de red o servidor caído — mantener sesión existente, no cerrar
        setSession(null);
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      const meResult = await meResponse.json();
      if (!meResult.success || !meResult.data?.user) {
        setSession(null);
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      const currentUser = meResult.data.user;
      setSession(currentUser);

      // Si el usuario no es Admin y está en una pestaña no permitida, mandar a registro
      const isJefe = currentUser.rol === 'Admin' || (currentUser as any).cargo?.toLowerCase().includes('jefe de produccion') || (currentUser as any).cargo?.toLowerCase().includes('produccion') || currentUser.usuario === '2908320';
      const isDis = currentUser.rol === 'Admin' || (currentUser as any).departamento?.toLowerCase().includes('diseñ') || (currentUser as any).cargo?.toLowerCase().includes('diseñ') || currentUser.usuario === '4958075';
      const allowedTabsForNonAdmin = ['registro', 'mistareas', 'misregistros'];
      if (isJefe) allowedTabsForNonAdmin.push('ordenestrabajo', 'hojasruta', 'pedidos');
      if (isDis) allowedTabsForNonAdmin.push('pedidos');

      if (currentUser.rol !== 'Admin' && !allowedTabsForNonAdmin.includes(activeTab)) {
        setActiveTab('registro');
      }

      // Then load app data
      const response = await fetch('/api/data', {
        credentials: 'include',
        signal: controller.signal
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDbState(result.data);
        } else {
          setFetchError(result.error?.message || 'Error al procesar datos iniciales');
        }
      } else {
        setFetchError('Error de conexión al cargar base de datos');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setFetchError('La conexión tardó demasiado tiempo. Verificá tu señal de internet móvil.');
      } else {
        setSession(null);
      }
    } finally {
      clearTimeout(timeoutId);
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
        // Verificar si el token realmente expiró o es un error transitorio
        // (servidor reiniciándose, DB caída). Reintentar /api/auth/me una sola vez.
        const meCheck = await fetch('/api/auth/me', { credentials: 'include' });
        if (meCheck.ok) {
          // El token sigue siendo válido — fue un error transitorio.
          // No cerrar sesión, solo marcar error de carga.
          setFetchError('Error temporal al cargar datos. Reintentá en un momento.');
          setLoading(false);
          return;
        }
        // El token realmente expiró — cerrar sesión.
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
      // Non-admin users can access 'registro', 'misregistros' y 'mistareas'
      const allowedTabs: TabType[] = ['registro', 'misregistros', 'mistareas'];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('registro');
      }
    }
  }, [activeTab, session]);

  // Cargar pedidos cuando se entra al tab presupuestos
  useEffect(() => {
    if (session && activeTab === 'presupuestos') {
      authFetchJSON<{ success: boolean; data: any[] }>('/api/admin/pedidos')
        .then((json) => setPedidosCache(json.data || []))
        .catch(() => {});
    }
  }, [session, activeTab]);

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
    sessionStorage.removeItem(ACTIVE_TAB_KEY);
    setSession(null);
    setDbState(null);
    setActiveTab('dashboard');
  };

  // Helper: Verifica si la sesión realmente expiró antes de cerrar.
  // Evita logouts espúreos por errores transitorios (servidor reiniciándose, DB caída).
  const isSessionExpired = async (): Promise<boolean> => {
    try {
      const me = await fetch('/api/auth/me', { credentials: 'include' });
      // Si /api/auth/me responde OK, el token sigue válido — no cerrar sesión.
      return !me.ok;
    } catch {
      // Si no podemos contactar al servidor, asumir que sigue activa (no cerrar).
      return false;
    }
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
      const endpoint = id.startsWith('regveh_') ? `/api/vehiculo/registro/${id}` : `/api/registros/${id}`;
      await authFetch(endpoint, { method: 'DELETE' });
      // Force new array reference to trigger React re-render
      const updatedRegistros = dbState.registros.filter(r => r.id !== id);
      const updatedRegistrosVehiculo = id.startsWith('regveh_')
        ? dbState.registrosVehiculo.filter(r => r.id !== id)
        : dbState.registrosVehiculo;
      setDbState({ 
        ...dbState, 
        registros: updatedRegistros,
        registrosVehiculo: updatedRegistrosVehiculo,
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
        const expired = await isSessionExpired();
        if (expired) {
          showToast('Sesión expirada. Por favor, vuelve a iniciar sesión.', 'error');
          handleLogout();
        } else {
          showToast('Error temporal del servidor. Reintentá en un momento.', 'warning');
        }
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
        const expired = await isSessionExpired();
        if (expired) {
          showToast('Sesión expirada. Por favor, vuelve a iniciar sesión.', 'error');
          handleLogout();
        } else {
          showToast('Error temporal del servidor. Reintentá en un momento.', 'warning');
        }
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

      // Only send newly imported records (not existing historical records in DB)
      const existingIds = new Set((dbState?.registros || []).map(r => r.id));
      const onlyNewRegistros = newFullDbState.registros.filter(r => !existingIds.has(r.id));
      const registrosToSend = onlyNewRegistros.length > 0 ? onlyNewRegistros : newFullDbState.registros;

      const resData = await authFetchJSON('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientes: newFullDbState.clientes,
          proyectos: newFullDbState.proyectos,
          registros: registrosToSend
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
  // (pero durante la restauración de sesión mostramos el splash, no el login)
  if (!session && !loading) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Loading data after login / restoring session on refresh
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090a0f] text-slate-300 relative p-4">
        <div className="glass-panel p-8 rounded-xl flex flex-col items-center gap-3 text-center max-w-xs border border-white/10 shadow-lg">
          <InfinityIcon className="w-10 h-10 text-orange-500 animate-pulse" />
          <h1 className="font-sans font-semibold text-lg text-white tracking-tight">Sistema aFull</h1>
          <p className="text-xs text-slate-400 font-mono animate-pulse">Sincronizando base de datos...</p>
          <div className="pt-3 flex flex-col gap-2 w-full border-t border-white/5 mt-2">
            <button
              onClick={() => { setLoading(false); checkAuthStatus(); }}
              className="text-[11px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
            >
              ¿Tarda mucho? Reintentar
            </button>
            <button
              onClick={handleLogout}
              className="text-[11px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError || !dbState) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090a0f] text-slate-300 relative p-4">
        <div className="glass-panel p-8 rounded-xl text-center max-w-md space-y-4 border border-rose-500/20">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Error de Conexión</h1>
          <p className="text-red-300 text-xs">{fetchError || 'Fallo al inicializar base de datos local'}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button
              onClick={fetchDbState}
              className="px-5 py-2 bg-orange-600 font-medium hover:bg-orange-500 rounded-md text-white text-xs cursor-pointer transition-colors"
            >
              Re-intentar Sincronización
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white text-xs cursor-pointer transition-colors border border-white/10"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Elementos de navegación agrupados para el Sidebar Corporativo
  const navItems = [
    {
      group: 'OPERACIONES',
      items: [
        { id: 'registro', label: 'Registro Operativo', icon: ClipboardList, adminOnly: false },
        { id: 'mistareas', label: 'Mis Tareas', icon: CheckSquare, adminOnly: false, hideForAdmin: true },
        { 
          id: 'misregistros', 
          label: 'Mis Registros', 
          icon: Folder, 
          adminOnly: false, 
          hideForAdmin: true, 
          badge: (dbState?.registros || []).filter(r => {
            const user = session;
            if (!user || !user.nombre) return false;
            const colaborador = (dbState?.colaboradores || []).find(col => {
              if (!col || !col.nombre) return false;
              const colName = col.nombre.toLowerCase();
              const userName = user.nombre.toLowerCase();
              return colName.includes(userName) || userName.includes(colName);
            });
            return r.concepto === 'MO' && r.colaboradorId === colaborador?.id && r.fecha === new Date().toISOString().substring(0, 10);
          }).length || 0 
        },
      ]
    },
    {
      group: 'GESTIÓN COMERCIAL',
      items: [
        { id: 'presupuestos', label: 'Presupuestos', icon: FileText, adminOnly: true },
        { id: 'ordenestrabajo', label: 'Órdenes de Trabajo', icon: ClipboardList, adminOnly: true },
        { id: 'pedidos', label: 'Pedidos de Clientes', icon: ShoppingCart, adminOnly: true },
        { id: 'hojasruta', label: 'Hojas de Ruta', icon: Route, adminOnly: true },
      ]
    },
    {
      group: 'ADMINISTRACIÓN & MÉTRICAS',
      items: [
        { id: 'dashboard', label: 'Panel de Control', icon: Tv, adminOnly: true },
        { id: 'reportes', label: 'Reportes y Costos', icon: BarChart2, adminOnly: true },
        { id: 'import', label: 'Importar Excel', icon: FileSpreadsheet, adminOnly: true },
        { id: 'admin', label: 'Configuración Admin', icon: ShieldCheck, adminOnly: true },
      ]
    }
  ];

  // ================================
  //  MAIN APP SHELL (ENTERPRISE SIDEBAR + TOPBAR)
  // ================================
  return (
    <div className="min-h-screen w-full bg-[#090a0f] flex text-slate-200">
      
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR CORPORATIVO */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0d0e14] border-r border-white/7 transition-all duration-200 flex flex-col ${
        isMobile
          ? (sidebarOpen ? 'w-72 translate-x-0 shadow-2xl' : 'w-72 -translate-x-full pointer-events-none')
          : (sidebarOpen ? 'w-64' : 'w-16')
      }`}>
        {/* Sidebar Header / Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-white/7 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 shrink-0 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              <img src="/Logo-AFULL-_1_.svg" alt="aFull Logo" className="w-5 h-5 object-contain" />
            </div>
            {(sidebarOpen || isMobile) && (
              <div className="truncate">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Sistema aFull</span>
                <p className="text-[9px] text-slate-400 font-mono tracking-tight uppercase">Plataforma Operativa</p>
              </div>
            )}
          </div>
          {isMobile ? (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navItems.map((section, idx) => {
            const isJefeProduccion = session.rol === 'Admin' || 
              (session as any).cargo?.toLowerCase().includes('jefe de produccion') || 
              (session as any).cargo?.toLowerCase().includes('produccion') ||
              session.usuario === '2908320';

            const isDiseno = session.rol === 'Admin' || 
              (session as any).departamento?.toLowerCase().includes('diseñ') || 
              (session as any).cargo?.toLowerCase().includes('diseñ') || 
              session.usuario === '4958075';

            // Filtrar items según rol RBAC
            const visibleItems = section.items.filter(item => {
              // Si es Admin: ve todo excepto lo marcado como hideForAdmin (Mis Tareas, Mis Registros)
              if (session.rol === 'Admin') {
                if ('hideForAdmin' in item && item.hideForAdmin) {
                  return false;
                }
                return true;
              }

              // Jefe de Producción (Item 14): OTs, Hojas de Ruta, Pedidos, Registro Operativo, Mis Tareas, Mis Registros
              if (isJefeProduccion) {
                if (['registro', 'mistareas', 'misregistros', 'ordenestrabajo', 'hojasruta', 'pedidos'].includes(item.id)) {
                  return true;
                }
                return false;
              }

              // Nachi / Diseño (Item 13): Mis Tareas, Pedidos, Registro Operativo, Mis Registros
              if (isDiseno) {
                if (['registro', 'mistareas', 'misregistros', 'pedidos'].includes(item.id)) {
                  return true;
                }
                return false;
              }

              // Operario general / otros
              return !item.adminOnly;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                {(sidebarOpen || isMobile) && (
                  <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    {section.group}
                  </div>
                )}
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const showBadge = item.badge !== undefined && item.badge > 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as TabType);
                        if (isMobile) {
                          setSidebarOpen(false);
                        }
                      }}
                      title={!sidebarOpen && !isMobile ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-orange-600 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {(sidebarOpen || isMobile) && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {(sidebarOpen || isMobile) && showBadge && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded ${
                          isActive ? 'bg-white/20 text-white' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Usuario & Logout */}
        <div className="p-2 border-t border-white/7 shrink-0 bg-[#0b0c11]">
          {(sidebarOpen || isMobile) ? (
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/3">
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs shrink-0">
                  {session.nombre ? session.nombre.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-white truncate">{session.nombre || session.usuario}</p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">{session.rol}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs" title={session.nombre || session.usuario}>
                {session.nombre ? session.nombre.charAt(0).toUpperCase() : 'U'}
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
        isMobile ? 'pl-0' : (sidebarOpen ? 'pl-64' : 'pl-16')
      }`}>
        
        {/* TOPBAR MINIMALISTA */}
        <header className="sticky top-0 z-30 h-14 bg-[#090a0f]/90 backdrop-blur-md border-b border-white/7 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
            {/* Hamburger button on mobile / tablet */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 -ml-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Abrir menú de navegación"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5 text-orange-400" />
            </button>

            <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase tracking-wider hidden sm:inline">Módulo:</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider truncate max-w-[150px] xs:max-w-none">
              {activeTab === 'dashboard' && 'Panel de Control'}
              {activeTab === 'registro' && 'Registro Operativo'}
              {activeTab === 'misregistros' && 'Mis Registros'}
              {activeTab === 'pedidos' && 'Pedidos de Clientes'}
              {activeTab === 'presupuestos' && 'Presupuestos Comerciales'}
              {activeTab === 'ordenestrabajo' && 'Órdenes de Trabajo'}
              {activeTab === 'hojasruta' && 'Hojas de Ruta'}
              {activeTab === 'mistareas' && 'Mis Tareas y Montajes'}
              {activeTab === 'import' && 'Importación de Planillas Excel'}
              {activeTab === 'reportes' && 'Reportes y Costos'}
              {activeTab === 'admin' && 'Panel de Administración'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Marcaciones UI con Geocerca */}
            {session.usuario && (
              <MarcacionesUI usuario={session.usuario} showToast={showToast} />
            )}
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto">
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

          {activeTab === 'pedidos' && (
            <motion.div
              key="pedidos_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <PedidosAdmin
                clientes={dbState?.clientes || []}
                onConvertido={fetchDbState}
              />
            </motion.div>
          )}

          {activeTab === 'presupuestos' && (
            <motion.div
              key="presupuestos_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <PresupuestosAdmin
                clientes={dbState?.clientes || []}
                pedidos={pedidosCache}
                proyectos={dbState?.proyectos || []}
                onConvertido={fetchDbState}
              />
            </motion.div>
          )}

          {activeTab === 'ordenestrabajo' && (
            <motion.div
              key="ordenestrabajo_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <OrdenesTrabajoAdmin />
            </motion.div>
          )}

          {activeTab === 'hojasruta' && (
            <motion.div
              key="hojasruta_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <HojasRutaAdmin />
            </motion.div>
          )}

          {activeTab === 'mistareas' && (
            <motion.div
              key="mistareas_tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
            >
              <MisTareas />
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
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a]/85 backdrop-blur-xl select-none"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-transparent to-amber-500/10 pointer-events-none" />
            
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-panel p-8 rounded-md flex flex-col items-center gap-6 text-center max-w-sm w-[90%] relative z-10 border border-white/10 shadow-2xl shadow-orange-500/5"
            >
              {/* Spinner */}
              <div className="relative w-20 h-20">
                {/* Ring */
                }
                <div className="absolute inset-0 rounded-full border border-orange-500/20 blur-[2px]" />
                
                {/* Animated Inner Spinner */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="w-full h-full rounded-full border-2 border-transparent border-t-orange-500 border-r-amber-500"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(234, 88, 12, 0.5))'
                  }}
                />

                {/* Center Core */}
                <div className="absolute inset-[3px] rounded-full bg-[#0a0a0a]/90 flex items-center justify-center border border-white/5">
                  <span className="font-mono text-xs font-bold text-orange-400">{Math.min(100, Math.round(progress))}%</span>
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
                    className="h-full bg-orange-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "tween", ease: "easeInOut" }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
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
