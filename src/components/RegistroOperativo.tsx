/**
 * RegistroOperativo — Sistema aFull v2.0 (REFACTORED)
 * 
 * REESTRUCTURACIÓN: Layout vertical progresivo con tabs para mejor claridad
 * - Paso 1: Contexto del Registro (Cliente, Proyecto, Fecha) → Card destacado arriba
 * - Paso 2: Tabs para separar "Mano de Obra" vs "Insumos"
 * 
 * Patrones aplicados:
 * - Compound Components (Tabs system)
 * - Custom Hooks (useTimer, useInsumos)
 * - AnimatePresence para transiciones suaves
 * - Estado visual claro con badges y locks
 * 
 * HYBRID TIMER: Servidor (database.json) + localStorage (caché temporal)
 */

import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Square,
  Clock,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  User,
  Briefcase,
  Building2,
  Plus,
  Send,
  Timer,
  DollarSign,
  Package,
  X,
  Lock,
  CheckCircle,
  Coffee,
  Pause,
  Car,
} from 'lucide-react';
import { DatabaseState, PauseRecord } from '../types.ts';
import { authFetchJSON } from '../authFetch.ts';
import VehiculoTab from './VehiculoTab.tsx';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface RegistroOperativoProps {
  data: DatabaseState;
  onAddRegistro: (registro: any) => Promise<boolean>;
  currentUser: { nombre: string; rol: string; usuario: string; colaboradorId?: string } | null;
}

interface InsumoLine {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatGuaranies(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
}

// ─── TABS CONTEXT (Compound Component Pattern) ─────────────────────────────

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function Tabs({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="space-y-5">
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
      {children}
    </div>
  );
}

function Tab({ id, icon: Icon, children, badge }: { 
  id: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode;
  badge?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const isActive = context.activeTab === id;

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(id)}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
      {badge && (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          isActive ? 'bg-white/20' : 'bg-white/10'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== id) return null;

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── CUSTOM HOOKS ───────────────────────────────────────────────────────────

/**
 * Custom Hook: useTimer
 * Maneja toda la lógica del timer híbrido (localStorage + servidor) con soporte de pausas
 */
interface UseTimerOptions {
  currentUser: { nombre: string; rol: string; usuario: string } | null;
}

function useTimer({ currentUser }: UseTimerOptions) {
  const timerPrefix = `afull_timer_${currentUser?.usuario || 'guest'}`;
  const timerKeyRunning = `${timerPrefix}_running`;
  const timerKeyStart = `${timerPrefix}_start`;
  const timerKeyEnd = `${timerPrefix}_end`;
  const timerKeySeconds = `${timerPrefix}_seconds`;
  const timerKeyPaused = `${timerPrefix}_paused`;
  const timerKeyPausedTime = `${timerPrefix}_pausedTime`;
  const timerKeyPauseStart = `${timerPrefix}_pauseStart`;
  const timerKeyPauseHistory = `${timerPrefix}_pauseHistory`;

  const [timerRunning, setTimerRunning] = useState<boolean>(() => {
    try { return localStorage.getItem(timerKeyRunning) === 'true'; } catch { return false; }
  });
  const [timerStart, setTimerStart] = useState<Date | null>(() => {
    try { const saved = localStorage.getItem(timerKeyStart); return saved ? new Date(saved) : null; } catch { return null; }
  });
  const [timerEnd, setTimerEnd] = useState<Date | null>(() => {
    try { const saved = localStorage.getItem(timerKeyEnd); return saved ? new Date(saved) : null; } catch { return null; }
  });
  const [timerSeconds, setTimerSeconds] = useState<number>(() => {
    try {
      const isRunning = localStorage.getItem(timerKeyRunning) === 'true';
      const isPaused = localStorage.getItem(timerKeyPaused) === 'true';
      const start = localStorage.getItem(timerKeyStart);
      const pausedTime = parseInt(localStorage.getItem(timerKeyPausedTime) || '0', 10);
      
      if (isRunning && start && !isPaused) {
        const elapsed = Math.floor((new Date().getTime() - new Date(start).getTime()) / 1000);
        return elapsed - pausedTime;
      }
      const savedSecs = localStorage.getItem(timerKeySeconds);
      return savedSecs ? parseInt(savedSecs, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Estados de pausa
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    try { return localStorage.getItem(timerKeyPaused) === 'true'; } catch { return false; }
  });
  const [pausedTime, setPausedTime] = useState<number>(() => {
    try { const saved = localStorage.getItem(timerKeyPausedTime); return saved ? parseInt(saved, 10) : 0; } catch { return 0; }
  });
  const [pauseStart, setPauseStart] = useState<Date | null>(() => {
    try { const saved = localStorage.getItem(timerKeyPauseStart); return saved ? new Date(saved) : null; } catch { return null; }
  });
  const [pauseHistory, setPauseHistory] = useState<PauseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(timerKeyPauseHistory);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persistir estados en localStorage
  useEffect(() => {
    localStorage.setItem(timerKeyRunning, String(timerRunning));
    if (timerStart) localStorage.setItem(timerKeyStart, timerStart.toISOString());
    else localStorage.removeItem(timerKeyStart);
    if (timerEnd) localStorage.setItem(timerKeyEnd, timerEnd.toISOString());
    else localStorage.removeItem(timerKeyEnd);
    localStorage.setItem(timerKeySeconds, String(timerSeconds));
    localStorage.setItem(timerKeyPaused, String(isPaused));
    localStorage.setItem(timerKeyPausedTime, String(pausedTime));
    if (pauseStart) localStorage.setItem(timerKeyPauseStart, pauseStart.toISOString());
    else localStorage.removeItem(timerKeyPauseStart);
    localStorage.setItem(timerKeyPauseHistory, JSON.stringify(pauseHistory));
  }, [timerRunning, timerStart, timerEnd, timerSeconds, isPaused, pausedTime, pauseStart, pauseHistory, 
      timerKeyRunning, timerKeyStart, timerKeyEnd, timerKeySeconds, timerKeyPaused, timerKeyPausedTime, 
      timerKeyPauseStart, timerKeyPauseHistory]);

  // Timer principal: solo corre cuando está running y NO pausado
  useEffect(() => {
    if (timerRunning && !isPaused) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, isPaused]);

  useEffect(() => {
    if (!currentUser) return;

    const loadActiveTimer = async () => {
      try {
        const response = await authFetchJSON<{ success: boolean; data: any }>(
          `/api/timer/active/${currentUser.usuario}`
        );

        if (response.success && response.data) {
          const serverTimer = response.data;
          const serverStart = new Date(serverTimer.inicio);
          const now = new Date();
          
          // Calculate elapsed time considering pauses
          const grossElapsed = Math.floor((now.getTime() - serverStart.getTime()) / 1000);
          const serverPausedTime = serverTimer.pausedTime || 0;
          const netElapsed = grossElapsed - serverPausedTime;

          const localStart = localStorage.getItem(timerKeyStart);
          const useServerTimer = !localStart || new Date(serverTimer.inicio) > new Date(localStart);

          if (useServerTimer && serverTimer.activo) {
            setTimerStart(serverStart);
            setTimerSeconds(netElapsed);
            setTimerRunning(true);
            
            // Restore pause state from server
            setPausedTime(serverPausedTime);
            setPauseHistory(serverTimer.pauseHistory || []);
            setIsPaused(serverTimer.isPaused || false);
            
            if (serverTimer.isPaused && serverTimer.currentPauseStart) {
              setPauseStart(new Date(serverTimer.currentPauseStart));
            } else {
              setPauseStart(null);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load active timer from server:', error);
      }
    };

    loadActiveTimer();
  }, [currentUser]);

  useEffect(() => {
    if (!timerRunning || !currentUser) return;

    const syncInterval = setInterval(async () => {
      try {
        const response = await authFetchJSON<{ success: boolean; data: any }>(
          '/api/timer/sync',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario: currentUser.usuario,
              segundosTranscurridos: timerSeconds
            })
          }
        );

        if (response.success && response.data) {
          // Check if timer was stopped on server
          if (!response.data.activo) {
            handleStopTimer();
            return;
          }

          // Sync pause state from server
          const serverTimer = response.data;
          
          if (serverTimer.isPaused !== isPaused) {
            // Pause state changed on server
            setIsPaused(serverTimer.isPaused || false);
            
            if (serverTimer.isPaused && serverTimer.currentPauseStart) {
              setPauseStart(new Date(serverTimer.currentPauseStart));
            } else {
              setPauseStart(null);
            }
          }

          // Sync pause time and history from server
          if (serverTimer.pausedTime !== undefined) {
            setPausedTime(serverTimer.pausedTime);
          }
          
          if (serverTimer.pauseHistory) {
            setPauseHistory(serverTimer.pauseHistory);
          }
        }
      } catch (error) {
        console.error('Timer sync failed:', error);
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [timerRunning, timerSeconds, currentUser, isPaused]);

  const handleStartTimer = useCallback(async (contextData: {
    colaboradorId: string;
    clienteId: string;
    proyectoId: string;
    descripcion: string;
    precioUnitario: number;
  }) => {
    const now = new Date();
    
    setTimerStart(now);
    setTimerEnd(null);
    setTimerSeconds(0);
    setTimerRunning(true);
    setIsPaused(false);
    setPausedTime(0);
    setPauseStart(null);
    setPauseHistory([]);

    if (currentUser) {
      try {
        await authFetchJSON('/api/timer/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario: currentUser.usuario,
            ...contextData
          })
        });
      } catch (error) {
        console.error('Failed to start timer on server:', error);
      }
    }
  }, [currentUser]);

  const handlePauseTimer = useCallback(async () => {
    if (!timerRunning || isPaused) return;

    const now = new Date();
    setPauseStart(now);
    setIsPaused(true);

    // Call server to persist pause state
    if (currentUser) {
      try {
        await authFetchJSON('/api/timer/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: currentUser.usuario })
        });
      } catch (err) {
        console.error('Failed to pause timer on server:', err);
        // Continue with local pause even if server fails (hybrid fallback)
      }
    }
  }, [timerRunning, isPaused, currentUser]);

  const handleResumeTimer = useCallback(async () => {
    if (!timerRunning || !isPaused || !pauseStart) return;

    const now = new Date();
    const pauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);

    // Call server to persist resume state
    if (currentUser) {
      try {
        const response = await authFetchJSON<{ success: boolean; data: any }>(
          '/api/timer/resume',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: currentUser.usuario })
          }
        );

        if (response.success && response.data) {
          // Use server-calculated values as source of truth
          const serverPausedTime = response.data.totalPausedTime || 0;
          const serverTimer = response.data.timer;

          setPausedTime(serverPausedTime);
          
          if (serverTimer?.pauseHistory) {
            setPauseHistory(serverTimer.pauseHistory);
          }
        }
      } catch (err) {
        console.error('Failed to resume timer on server:', err);
        // Fallback to local calculation if server fails
        const newPausedTime = pausedTime + pauseDuration;
        setPausedTime(newPausedTime);

        const newPauseRecord: PauseRecord = {
          start: pauseStart.toISOString(),
          end: now.toISOString(),
          duration: pauseDuration
        };
        setPauseHistory(prev => [...prev, newPauseRecord]);
      }
    } else {
      // No user, use local only
      const newPausedTime = pausedTime + pauseDuration;
      setPausedTime(newPausedTime);

      const newPauseRecord: PauseRecord = {
        start: pauseStart.toISOString(),
        end: now.toISOString(),
        duration: pauseDuration
      };
      setPauseHistory(prev => [...prev, newPauseRecord]);
    }

    // Reset pause state
    setIsPaused(false);
    setPauseStart(null);
  }, [timerRunning, isPaused, pauseStart, pausedTime, currentUser]);

  const handleStopTimer = useCallback(async () => {
    const endTime = new Date();
    
    // Si estaba en pausa, primero cerrar la pausa actual
    if (isPaused && pauseStart) {
      const pauseDuration = Math.floor((endTime.getTime() - pauseStart.getTime()) / 1000);
      setPausedTime(prev => prev + pauseDuration);
      setPauseHistory(prev => [...prev, {
        start: pauseStart.toISOString(),
        end: endTime.toISOString(),
        duration: pauseDuration
      }]);
    }

    setTimerRunning(false);
    setTimerEnd(endTime);
    setIsPaused(false);
    setPauseStart(null);

    if (currentUser) {
      try {
        const response = await authFetchJSON<{ success: boolean; data: any }>(
          '/api/timer/stop',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario: currentUser.usuario,
              pausedTime: pausedTime,
              pauseHistory: pauseHistory
            })
          }
        );

        if (response.success && response.data) {
          const serverDuration = response.data.duracionSegundos;
          setTimerSeconds(serverDuration);
        }
      } catch (error) {
        console.error('Failed to stop timer on server:', error);
      }
    }
  }, [currentUser, isPaused, pauseStart, pausedTime, pauseHistory]);

  const handleResetTimer = useCallback(() => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerStart(null);
    setTimerEnd(null);
    setIsPaused(false);
    setPausedTime(0);
    setPauseStart(null);
    setPauseHistory([]);
  }, []);

  return {
    timerRunning,
    timerStart,
    timerEnd,
    timerSeconds,
    isPaused,
    pausedTime,
    pauseStart,
    pauseHistory,
    handleStartTimer,
    handleStopTimer,
    handleResetTimer,
    handlePauseTimer,
    handleResumeTimer,
  };
}

/**
 * Custom Hook: useInsumos
 * Maneja toda la lógica de las líneas de insumos
 */
function useInsumos() {
  const [insumoLines, setInsumoLines] = useState<InsumoLine[]>([
    { id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 },
  ]);

  const addInsumoLine = useCallback(() => {
    setInsumoLines(prev => [...prev, { id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 }]);
  }, []);

  const removeInsumoLine = useCallback((id: string) => {
    setInsumoLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const updateInsumoLine = useCallback((id: string, field: keyof InsumoLine, value: string | number) => {
    setInsumoLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const resetInsumos = useCallback(() => {
    setInsumoLines([{ id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 }]);
  }, []);

  const totalInsumos = insumoLines.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario), 0);
  const validLines = insumoLines.filter(l => l.descripcion.trim() && l.cantidad > 0 && l.precioUnitario > 0);

  return {
    insumoLines,
    addInsumoLine,
    removeInsumoLine,
    updateInsumoLine,
    resetInsumos,
    totalInsumos,
    validLines,
  };
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function RegistroOperativo({ data, onAddRegistro, currentUser }: RegistroOperativoProps) {

  // ══════════════════════════════════════════════════════
  //  SHARED CONTEXT STATE
  // ══════════════════════════════════════════════════════

  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));

  const proyectosFiltrados = data.proyectos.filter(
    p => !selectedClienteId || p.clienteId === selectedClienteId
  );

  const contextComplete = !!(selectedClienteId && selectedProyectoId);

  // ══════════════════════════════════════════════════════
  //  TIMER & MANO DE OBRA
  // ══════════════════════════════════════════════════════

  const {
    timerRunning,
    timerStart,
    timerEnd,
    timerSeconds,
    isPaused,
    pausedTime,
    pauseStart,
    pauseHistory,
    handleStartTimer,
    handleStopTimer,
    handleResetTimer,
    handlePauseTimer,
    handleResumeTimer,
  } = useTimer({ currentUser });

  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');
  const [moDescripcion, setMoDescripcion] = useState('');
  const [moPrecioUnitario, setMoPrecioUnitario] = useState('');
  const [moSubmitting, setMoSubmitting] = useState(false);
  const [moFeedback, setMoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const canChangeColaborador = currentUser?.rol === 'Admin';
  
  const currentUserColaborador = currentUser 
    ? data.colaboradores.find(
        col => col.nombre.toLowerCase().includes(currentUser.nombre.toLowerCase()) ||
               currentUser.nombre.toLowerCase().includes(col.nombre.toLowerCase())
      )
    : null;

  useEffect(() => {
    if (currentUser && data.colaboradores.length > 0) {
      if (currentUser.rol !== 'Admin') {
        // Primero intentar match exacto por colaboradorId (más confiable)
        if (currentUser.colaboradorId) {
          const col = data.colaboradores.find(c => c.id === currentUser.colaboradorId);
          if (col) {
            setSelectedColaboradorId(col.id);
            setMoPrecioUnitario(String(col.tarifaSugerida));
            return;
          }
        }
        // Fallback: match por nombre (por si el colaboradorId no está disponible aún)
        const colaborador = data.colaboradores.find(
          col => col.nombre.toLowerCase().includes(currentUser.nombre.toLowerCase()) ||
                 currentUser.nombre.toLowerCase().includes(col.nombre.toLowerCase())
        );
        if (colaborador) {
          setSelectedColaboradorId(colaborador.id);
          setMoPrecioUnitario(String(colaborador.tarifaSugerida));
        } else {
          // Ningún match por ID ni por nombre — el botón "Iniciar Tarea" quedará bloqueado
          console.warn(
            `[RegistroOperativo] No se encontró colaborador para el usuario "${currentUser.usuario}" ` +
            `(nombre: "${currentUser.nombre}", colaboradorId: "${currentUser.colaboradorId}"). ` +
            `IDs disponibles: ${data.colaboradores.map(c => `${c.id}="${c.nombre}"`).join(', ')}`
          );
        }
      } else if (!selectedColaboradorId) {
        const colaborador = data.colaboradores.find(
          col => col.nombre.toLowerCase().includes(currentUser.nombre.toLowerCase()) ||
                 currentUser.nombre.toLowerCase().includes(col.nombre.toLowerCase())
        );
        if (colaborador) {
          setSelectedColaboradorId(colaborador.id);
          setMoPrecioUnitario(String(colaborador.tarifaSugerida));
        }
      }
    }
  }, [currentUser, data.colaboradores]);

  useEffect(() => {
    if (selectedColaboradorId) {
      const col = data.colaboradores.find(c => c.id === selectedColaboradorId);
      if (col) setMoPrecioUnitario(String(col.tarifaSugerida));
    }
  }, [selectedColaboradorId, data.colaboradores]);

  const onStartTimer = async () => {
    if (!contextComplete || !selectedColaboradorId) {
      setMoFeedback({ type: 'error', msg: 'Completá Cliente, Proyecto y Colaborador antes de iniciar el timer.' });
      return;
    }

    await handleStartTimer({
      colaboradorId: selectedColaboradorId,
      clienteId: selectedClienteId,
      proyectoId: selectedProyectoId,
      descripcion: moDescripcion || 'Tarea en progreso',
      precioUnitario: parseFloat(moPrecioUnitario) || 0
    });

    setMoFeedback(null);
  };

  const minutosRegistrados = Math.round(timerSeconds / 60);
  const tarifaMin = parseFloat(moPrecioUnitario) || 0;
  const costoMO = minutosRegistrados * tarifaMin;
  const horasTotales = parseFloat((timerSeconds / 3600).toFixed(2));

  const handleSubmitMO = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!contextComplete) {
      setMoFeedback({ type: 'error', msg: 'Seleccioná Cliente y Proyecto antes de registrar.' });
      return;
    }
    if (timerSeconds < 30) {
      setMoFeedback({ type: 'error', msg: 'El timer debe registrar al menos 30 segundos.' });
      return;
    }
    if (!selectedColaboradorId && !moDescripcion.trim()) {
      setMoFeedback({ type: 'error', msg: 'Seleccioná un colaborador o ingresá una descripción.' });
      return;
    }

    const colaborador = data.colaboradores.find(c => c.id === selectedColaboradorId);
    setMoSubmitting(true);

    const ok = await onAddRegistro({
      clienteId: selectedClienteId,
      proyectoId: selectedProyectoId,
      fecha,
      concepto: 'MO',
      descripcion: moDescripcion || (colaborador ? colaborador.nombre : 'Tarea sin descripción'),
      colaboradorId: selectedColaboradorId || undefined,
      hsInicio: timerStart ? formatTime(timerStart) : undefined,
      hsFin: timerEnd ? formatTime(timerEnd) : undefined,
      hsTotal: horasTotales,
      cantidad: minutosRegistrados,
      precioUnitario: tarifaMin,
      total: costoMO,
    });

    setMoSubmitting(false);
    if (ok) {
      setMoFeedback({ type: 'success', msg: `✓ Registrado: ${formatDuration(timerSeconds)} — ${formatGuaranies(costoMO)}` });
      handleResetTimer();
      setMoDescripcion('');
    } else {
      setMoFeedback({ type: 'error', msg: 'Error al guardar. Verificá los campos e intentá nuevamente.' });
    }
  };

  // ══════════════════════════════════════════════════════
  //  INSUMOS
  // ══════════════════════════════════════════════════════

  const {
    insumoLines,
    addInsumoLine,
    removeInsumoLine,
    updateInsumoLine,
    resetInsumos,
    totalInsumos,
    validLines,
  } = useInsumos();

  const [insumosSubmitting, setInsumosSubmitting] = useState(false);
  const [insumosFeedback, setInsumosFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSubmitInsumos = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!contextComplete) {
      setInsumosFeedback({ type: 'error', msg: 'Seleccioná Cliente y Proyecto antes de registrar.' });
      return;
    }
    if (validLines.length === 0) {
      setInsumosFeedback({ type: 'error', msg: 'Ingresá al menos un insumo con descripción y precio.' });
      return;
    }

    setInsumosSubmitting(true);
    setInsumosFeedback(null);
    let allOk = true;

    for (const line of validLines) {
      const ok = await onAddRegistro({
        clienteId: selectedClienteId,
        proyectoId: selectedProyectoId,
        fecha,
        concepto: 'Insumo',
        descripcion: line.descripcion,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        total: line.cantidad * line.precioUnitario,
      });
      if (!ok) allOk = false;
    }

    setInsumosSubmitting(false);
    if (allOk) {
      setInsumosFeedback({ type: 'success', msg: `✓ ${validLines.length} insumo(s) registrados — Total: ${formatGuaranies(totalInsumos)}` });
      resetInsumos();
    } else {
      setInsumosFeedback({ type: 'error', msg: 'Algunos insumos no se pudieron guardar.' });
    }
  };

  // ══════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ══════════════════════════════════════════════════════

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    const preventEnterSubmit = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    document.addEventListener('keydown', preventEnterSubmit, true);
    return () => document.removeEventListener('keydown', preventEnterSubmit, true);
  }, []);

  const handleComponentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // ══════════════════════════════════════════════════════
  //  RENDER - LAYOUT VERTICAL PROGRESIVO
  // ══════════════════════════════════════════════════════

  return (
    <form onSubmit={handleComponentFormSubmit} className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Registro Operativo
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Completá el contexto primero, luego seleccioná Mano de Obra o Insumos en las pestañas.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════
          PASO 1: CONTEXTO DEL REGISTRO (Destacado arriba)
          ══════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`glass-panel rounded-2xl p-6 border-2 transition-all ${
          contextComplete
            ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/10'
            : 'border-white/10'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-white">Paso 1: Contexto del Registro</h2>
          </div>
          {contextComplete ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono">
              <CheckCircle className="w-4 h-4" />
              <span>Completo</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4" />
              <span>Requerido</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cliente */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-1.5">
              Cliente
              <span className="text-rose-400">*</span>
              {timerRunning && <Lock className="w-3 h-3 text-amber-400" title="Bloqueado durante timer activo" />}
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                value={selectedClienteId}
                onChange={e => { setSelectedClienteId(e.target.value); setSelectedProyectoId(''); }}
                onKeyDown={handleKeyDown}
                disabled={timerRunning}
                className={`glass-select w-full rounded-xl pl-10 pr-4 py-3 text-sm ${
                  timerRunning ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="">— Seleccionar Cliente —</option>
                {data.clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Proyecto */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-1.5">
              Proyecto
              <span className="text-rose-400">*</span>
              {timerRunning && <Lock className="w-3 h-3 text-amber-400" title="Bloqueado durante timer activo" />}
            </label>
            <select
              value={selectedProyectoId}
              onChange={e => setSelectedProyectoId(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedClienteId || timerRunning}
              className={`glass-select w-full rounded-xl px-4 py-3 text-sm ${
                !selectedClienteId || timerRunning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">— Seleccionar Proyecto —</option>
              {proyectosFiltrados.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              onKeyDown={handleKeyDown}
              className="glass-input w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
        </div>

        {!contextComplete && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 text-xs text-amber-400/80 flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Seleccioná Cliente y Proyecto para poder registrar operaciones.
          </motion.p>
        )}
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          PASO 2: TABS PARA MANO DE OBRA VS INSUMOS
          ══════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Tabs defaultTab="mano-obra">
          <TabList>
            <Tab id="mano-obra" icon={Timer}>
              Mano de Obra
              {timerRunning && <span className="ml-1.5 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />}
            </Tab>
            <Tab id="insumos" icon={ShoppingCart} badge={validLines.length > 0 ? String(validLines.length) : undefined}>
              Insumos
            </Tab>
            <Tab id="vehiculo" icon={Car}>
              Vehículo
            </Tab>
          </TabList>

          {/* ══════════════════════════════════════════════════════
              TAB PANEL: MANO DE OBRA
              ══════════════════════════════════════════════════════ */}
          <TabPanel id="mano-obra">
            <div className="glass-panel rounded-3xl p-6 space-y-6">
              
              {/* Timer Display Grande */}
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="relative flex items-center justify-center">
                  {timerRunning && !isPaused && (
                    <motion.div
                      className="absolute w-48 h-48 rounded-full border-2 border-transparent"
                      style={{
                        borderTopColor: 'rgba(59,130,246,0.8)',
                        borderRightColor: 'rgba(99,102,241,0.4)',
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                    />
                  )}
                  <div className={`w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 ${
                    timerRunning && !isPaused
                      ? 'bg-blue-500/10 border-2 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)]'
                      : isPaused
                      ? 'bg-amber-500/10 border-2 border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)]'
                      : timerEnd
                      ? 'bg-emerald-500/10 border-2 border-emerald-500/30'
                      : 'bg-white/5 border-2 border-white/10'
                  }`}>
                    <motion.span
                      key={timerSeconds}
                      className={`font-mono text-4xl font-bold tracking-tight tabular-nums ${
                        timerRunning && !isPaused 
                          ? 'text-blue-300' 
                          : isPaused 
                          ? 'text-amber-300' 
                          : timerEnd 
                          ? 'text-emerald-300' 
                          : 'text-slate-400'
                      }`}
                    >
                      {formatDuration(timerSeconds)}
                    </motion.span>
                    <span className="text-[10px] font-mono text-slate-600 mt-2 uppercase tracking-widest">
                      {timerRunning && !isPaused 
                        ? 'EN CURSO' 
                        : isPaused 
                        ? 'EN DESCANSO' 
                        : timerEnd 
                        ? 'FINALIZADO' 
                        : 'LISTO'}
                    </span>
                  </div>
                </div>

                {/* Chip de pausa activa */}
                <AnimatePresence>
                  {isPaused && pauseStart && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2"
                    >
                      <Pause className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-mono text-amber-300">
                        En descanso desde {formatTime(pauseStart)}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chip de resumen de pausas (cuando está finalizado) */}
                <AnimatePresence>
                  {timerEnd && pauseHistory.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 bg-slate-500/10 border border-slate-500/30 rounded-xl px-4 py-2"
                    >
                      <Coffee className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-mono text-slate-300">
                        Total pausas: {formatDuration(pausedTime)} ({pauseHistory.length} descanso{pauseHistory.length > 1 ? 's' : ''})
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Timestamps */}
                {(timerStart || timerEnd) && (
                  <div className="flex gap-6 text-xs font-mono">
                    {timerStart && (
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 uppercase tracking-wider text-[9px]">Inicio</span>
                        <span className="text-blue-400 font-bold text-sm">{formatTime(timerStart)}</span>
                      </div>
                    )}
                    {timerEnd && (
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 uppercase tracking-wider text-[9px]">Fin</span>
                        <span className="text-emerald-400 font-bold text-sm">{formatTime(timerEnd)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Aviso mobile: colaborador no asignado aún (race condition en red lenta) */}
                {!timerRunning && !timerEnd && contextComplete && !selectedColaboradorId && !canChangeColaborador && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-1">
                    <span className="text-amber-400">⏳</span>
                    <span>Cargando tu colaborador… si tarda, recargá la página.</span>
                  </div>
                )}

                {/* Botones del Timer */}
                <div className="flex gap-3">
                  {!timerRunning && !timerEnd && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onStartTimer}
                      disabled={!contextComplete || (!selectedColaboradorId && !canChangeColaborador)}
                      className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-blue-500/25 border border-white/10 transition-all"
                    >
                      <Play className="w-5 h-5 fill-white" />
                      Iniciar Tarea
                    </motion.button>
                  )}

                  {timerRunning && !isPaused && (
                    <>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handlePauseTimer}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 border border-white/10 transition-all"
                      >
                        <Coffee className="w-5 h-5" />
                        Descanso
                      </motion.button>
                      
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStopTimer}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm shadow-lg shadow-rose-500/25 border border-white/10 transition-all"
                      >
                        <Square className="w-5 h-5 fill-white" />
                        Finalizar
                      </motion.button>
                    </>
                  )}

                  {timerRunning && isPaused && (
                    <>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleResumeTimer}
                        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-green-500/25 border border-white/10 transition-all"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        Reanudar
                      </motion.button>
                      
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStopTimer}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm shadow-lg shadow-rose-500/25 border border-white/10 transition-all"
                      >
                        <Square className="w-5 h-5 fill-white" />
                        Finalizar
                      </motion.button>
                    </>
                  )}

                  {(timerRunning || timerEnd) && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleResetTimer}
                      className="p-3.5 rounded-2xl glass-panel hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all"
                      title="Reiniciar timer"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Vista Previa del Costo */}
              <AnimatePresence>
                {timerSeconds > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-2 border-blue-500/20 rounded-2xl px-6 py-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 block mb-1">Vista Previa del Costo</span>
                        <span className="font-mono text-3xl font-bold text-white">{formatGuaranies(costoMO)}</span>
                      </div>
                      <div className="text-right text-sm font-mono text-slate-400 space-y-1">
                        <div>{minutosRegistrados} min × {formatGuaranies(tarifaMin)}/min</div>
                        <div className="text-slate-600 text-xs">{horasTotales} hs totales</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Formulario MO */}
              <div className="space-y-4 pt-2">
                {/* Colaborador */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-2">
                    Colaborador
                    {!canChangeColaborador && (
                      <span className="text-amber-400 text-[9px] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Solo tu usuario
                      </span>
                    )}
                  </label>
                  {canChangeColaborador ? (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
                      <select
                        value={selectedColaboradorId}
                        onChange={e => setSelectedColaboradorId(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="glass-select w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                      >
                        <option value="">— Sin asignar —</option>
                        {data.colaboradores.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({formatGuaranies(c.tarifaSugerida)}/min)</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                      <div className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-white bg-slate-800/70 border-2 border-white/10 flex items-center gap-2">
                        <span className="flex-1">
                          {currentUser?.nombre || 'Usuario actual'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {currentUserColaborador && `${formatGuaranies(currentUserColaborador.tarifaSugerida)}/min`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block">
                    Descripción de la tarea
                  </label>
                  <input
                    type="text"
                    value={moDescripcion}
                    onChange={e => setMoDescripcion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="ej: Instalación de vinilo en fachada..."
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                {/* Tarifa */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-2">
                    Tarifa por minuto (Gs.)
                    {!canChangeColaborador && (
                      <span className="text-slate-600 text-[9px] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Autocompletado
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type="number"
                      value={moPrecioUnitario}
                      onChange={e => canChangeColaborador && setMoPrecioUnitario(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="350"
                      min="0"
                      disabled={!canChangeColaborador}
                      className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm ${
                        canChangeColaborador 
                          ? 'glass-input' 
                          : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Feedback MO */}
              <AnimatePresence mode="wait">
                {moFeedback && (
                  <motion.div
                    key={moFeedback.msg}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                      moFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
                    }`}
                  >
                    {moFeedback.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertCircle className="w-4 h-4 shrink-0" />
                    }
                    <span>{moFeedback.msg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón Registrar MO */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitMO}
                disabled={moSubmitting || (timerSeconds === 0 && !timerEnd)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-xl shadow-blue-500/20 border border-white/10 transition-all"
              >
                {moSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Registrar Horas de Mano de Obra
                  </>
                )}
              </motion.button>
            </div>
          </TabPanel>

          {/* ══════════════════════════════════════════════════════
              TAB PANEL: INSUMOS
              ══════════════════════════════════════════════════════ */}
          <TabPanel id="insumos">
            <div className="glass-panel rounded-3xl p-6 space-y-5">
              
              {/* Header con total */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-lg">Materiales y Gastos Operativos</h3>
                  <p className="text-xs text-slate-500 mt-1">Agregá líneas de insumos con cantidad y precio</p>
                </div>
                <AnimatePresence>
                  {totalInsumos > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-2 text-right"
                    >
                      <p className="text-[9px] font-mono uppercase text-cyan-500 tracking-wider">Total</p>
                      <p className="font-mono font-bold text-cyan-300 text-lg">{formatGuaranies(totalInsumos)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tabla de insumos */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 px-2">
                  <span className="col-span-5 text-[9px] font-mono uppercase tracking-wider text-slate-600">Descripción</span>
                  <span className="col-span-2 text-[9px] font-mono uppercase tracking-wider text-slate-600 text-center">Cantidad</span>
                  <span className="col-span-3 text-[9px] font-mono uppercase tracking-wider text-slate-600 text-right">Precio Unit. (Gs.)</span>
                  <span className="col-span-2 text-[9px] font-mono uppercase tracking-wider text-slate-600 text-right">Subtotal</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {insumoLines.map((line, idx) => {
                      const subtotal = line.cantidad * line.precioUnitario;
                      return (
                        <motion.div
                          key={line.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="grid grid-cols-12 gap-2 items-center bg-white/5 rounded-xl p-2 border border-white/5 hover:border-white/10 transition-colors"
                        >
                          {/* Descripción */}
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={line.descripcion}
                              onChange={e => updateInsumoLine(line.id, 'descripcion', e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder={`Insumo ${idx + 1}...`}
                              className="glass-input w-full rounded-lg px-3 py-2.5 text-sm border-0 focus:ring-2 focus:ring-cyan-500/30"
                            />
                          </div>
                          {/* Cantidad */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={line.cantidad}
                              onChange={e => updateInsumoLine(line.id, 'cantidad', parseFloat(e.target.value) || 0)}
                              onKeyDown={handleKeyDown}
                              min="0"
                              step="0.5"
                              className="glass-input w-full rounded-lg px-2.5 py-2.5 text-sm text-center border-0 focus:ring-2 focus:ring-cyan-500/30"
                            />
                          </div>
                          {/* Precio */}
                          <div className="col-span-3">
                            <input
                              type="number"
                              value={line.precioUnitario || ''}
                              onChange={e => updateInsumoLine(line.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                              onKeyDown={handleKeyDown}
                              placeholder="0"
                              min="0"
                              className="glass-input w-full rounded-lg px-2.5 py-2.5 text-sm text-right border-0 focus:ring-2 focus:ring-cyan-500/30"
                            />
                          </div>
                          {/* Subtotal + delete */}
                          <div className="col-span-2 flex items-center justify-end gap-2 pr-1">
                            <span className="font-mono text-sm text-slate-300 text-right shrink-0">
                              {subtotal > 0 ? formatGuaranies(subtotal) : '—'}
                            </span>
                            {insumoLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeInsumoLine(line.id)}
                                className="text-slate-600 hover:text-rose-400 transition-colors p-1 shrink-0 rounded hover:bg-rose-500/10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Botón agregar línea */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={addInsumoLine}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-cyan-400 transition-colors py-3 border-2 border-dashed border-white/10 hover:border-cyan-500/30 rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  Agregar ítem de insumo
                </motion.button>
              </div>

              {/* Total final */}
              <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                <span className="text-sm text-slate-500 font-mono">
                  {validLines.length} de {insumoLines.length} línea(s) válida(s)
                </span>
                <div className="text-right">
                  <span className="text-xs text-slate-600 block mb-1">Total a Registrar</span>
                  <span className="font-mono font-bold text-white text-2xl">
                    {formatGuaranies(totalInsumos)}
                  </span>
                </div>
              </div>

              {/* Feedback Insumos */}
              <AnimatePresence mode="wait">
                {insumosFeedback && (
                  <motion.div
                    key={insumosFeedback.msg}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                      insumosFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
                    }`}
                  >
                    {insumosFeedback.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertCircle className="w-4 h-4 shrink-0" />
                    }
                    <span>{insumosFeedback.msg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón Registrar Insumos */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitInsumos}
                disabled={insumosSubmitting || validLines.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-xl shadow-cyan-500/20 border border-white/10 transition-all"
              >
                {insumosSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    Registrar {validLines.length} Insumo(s)
                  </>
                )}
              </motion.button>
            </div>
          </TabPanel>

          {/* ══════════════════════════════════════════════════════
              TAB PANEL: VEHÍCULO
              ══════════════════════════════════════════════════════ */}
          <TabPanel id="vehiculo">
            <VehiculoTab
              selectedClienteId={selectedClienteId}
              selectedProyectoId={selectedProyectoId}
              currentUser={currentUser}
              contextComplete={contextComplete}
            />
          </TabPanel>

        </Tabs>
      </motion.div>
    </form>
  );
}
