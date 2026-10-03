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

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cardVariants, cardTransition } from '../lib/animations.ts';
import {
  Play,
  Square,
  ShoppingCart,
  CheckCircle,
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
  Coffee,
  Pause,
  Car,
  Clock,
  Users,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';
import { DatabaseState, PauseRecord } from '../types.ts';
import VehiculoTab from './VehiculoTab.tsx';
import CalculadoraAdhesivoModal, { CalculoAdhesivoResultado } from './CalculadoraAdhesivoModal.tsx';
import InsumosCosteoTabs, { InsumoAgregado } from './InsumosCosteoTabs.tsx';
import { ModoInsumo, calcularDuracionHoras } from '../lib/insumosCosteo.ts';
import { Calculator } from 'lucide-react';
import { useNotif } from '../context/NotifContext.tsx';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface RegistroOperativoProps {
  data: DatabaseState;
  onAddRegistro: (registro: any) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
  currentUser: { nombre: string; rol: string; usuario: string; colaboradorId?: string } | null;
}

interface InsumoLine {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total?: number;
  modoInsumo?: ModoInsumo;
  unidad?: string;
  anchoCm?: number;
  altoCm?: number;
  desperdicioCalculado?: boolean;
  porcentajeUsado?: number;
  facturaCompraId?: string;
  facturaNumero?: string;
}

interface DistribucionClienteItem {
  id: string;
  clienteId: string;
  proyectoId: string;
  porcentaje: number;
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

function FeedbackBanner({ feedback }: { feedback: { type: 'success' | 'error'; msg: string } | null }) {
  if (!feedback) return null;
  return (
    <AnimatePresence mode="wait">
      {feedback && (
        <motion.div
          key={feedback.msg}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
          }`}
        >
          {feedback.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />
          }
          <span>{feedback.msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
    <div className="flex gap-1.5 p-1 bg-[#111318] rounded-md border border-white/7">
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
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-semibold transition-all cursor-pointer ${
        isActive
          ? 'bg-orange-600 text-white shadow-sm'
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
  onRestoreContext?: (ctx: {
    clienteId?: string;
    proyectoId?: string;
    colaboradorId?: string;
    descripcion?: string;
    precioUnitario?: number;
  }) => void;
}

function useTimer({ currentUser, onRestoreContext }: UseTimerOptions) {
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
  const serverStartRef = useRef<Date | null>(null);
  const serverPausedTimeRef = useRef<number>(0);

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

  // Timer principal: recalcula contra el timestamp del servidor para evitar drift.
  // En lugar de setTimerSeconds(s => s + 1) que acumula error, usamos la diferencia
  // entre ahora y timerStart, restando el tiempo pausado acumulado.
  useEffect(() => {
    if (timerRunning && !isPaused && timerStart) {
      serverStartRef.current = timerStart;
      serverPausedTimeRef.current = pausedTime;
      // Recalcular inmediatamente
      const now = new Date();
      const elapsed = Math.max(0, Math.floor((now.getTime() - timerStart.getTime()) / 1000) - pausedTime);
      setTimerSeconds(elapsed);
      // Tick cada segundo recalculando contra el reloj del sistema
      timerRef.current = setInterval(() => {
        const n = new Date();
        const e = Math.max(0, Math.floor((n.getTime() - serverStartRef.current!.getTime()) / 1000) - serverPausedTimeRef.current);
        setTimerSeconds(e);
      }, 1000);
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
              setCurrentPauseType(serverTimer.currentPauseType || 'descanso');
            } else {
              setPauseStart(null);
              setCurrentPauseType(null);
            }

            if (onRestoreContext) {
              onRestoreContext({
                clienteId: serverTimer.clienteId,
                proyectoId: serverTimer.proyectoId,
                colaboradorId: serverTimer.colaboradorId,
                descripcion: serverTimer.descripcion,
                precioUnitario: serverTimer.precioUnitario,
              });
            }
          }
        }
      } catch (error) {
        // Failed to load timer - will retry on next mount
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
              setCurrentPauseType(serverTimer.currentPauseType || 'descanso');
            } else {
              setPauseStart(null);
              setCurrentPauseType(null);
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
        // Timer sync failed silently
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
    setCurrentPauseType(null);

    if (currentUser) {
      try {
        localStorage.setItem(`${timerPrefix}_context`, JSON.stringify(contextData));
        await authFetchJSON('/api/timer/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario: currentUser.usuario,
            ...contextData
          })
        });
      } catch (error) {
        // Timer start failed - state was already updated locally
      }
    }
  }, [currentUser, timerPrefix]);

  const [currentPauseType, setCurrentPauseType] = useState<'descanso' | 'pausa' | null>(null);

  const handlePauseTimer = useCallback(async (tipo: 'descanso' | 'pausa' = 'descanso') => {
    if (!timerRunning || isPaused) return;

    const now = new Date();
    setPauseStart(now);
    setIsPaused(true);
    setCurrentPauseType(tipo);

    // Call server to persist pause state
    if (currentUser) {
      try {
        await authFetchJSON('/api/timer/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: currentUser.usuario, tipo })
        });
      } catch (err) {
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
          // El servidor devuelve el timer actualizado con pausedTime y pauseHistory ya calculados
          const serverData = response.data;
          setPausedTime(serverData.pausedTime || 0);

          if (serverData.pauseHistory) {
            setPauseHistory(serverData.pauseHistory);
          }
        }
      } catch (err) {
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
    setCurrentPauseType(null);
  }, [timerRunning, isPaused, pauseStart, pausedTime, currentUser]);

  const handleStopTimer = useCallback(async () => {
    const endTime = new Date();

    // Si estaba en pausa, primero cerrar la pausa actual localmente para el display
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
    setCurrentPauseType(null);

    if (currentUser) {
      try {
        // El servidor es la fuente de verdad: recalcula duracionSegundos
        // usando su propio inicio + pausedTime + pauseHistory persistidos.
        const response = await authFetchJSON<{ success: boolean; data: any }>(
          '/api/timer/stop',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario: currentUser.usuario,
              // Mandamos solo como hint; el server recalcula desde su estado
              pausedTime: isPaused && pauseStart
                ? pausedTime + Math.floor((endTime.getTime() - pauseStart.getTime()) / 1000)
                : pausedTime,
              pauseHistory: pauseHistory
            })
          }
        );

        if (response.success && response.data) {
          // Usar la duración calculada por el servidor (fuente de verdad)
          const serverDuration = response.data.duracionSegundos;
          setTimerSeconds(serverDuration);
          // Sincronizar también el pausedTime final del servidor
          if (response.data.pausedTime != null) {
            setPausedTime(response.data.pausedTime);
          }
          if (response.data.pauseHistory) {
            setPauseHistory(response.data.pauseHistory);
          }
        }
      } catch (error) {
        // Failed to stop timer - local state already cleaned up
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
    setCurrentPauseType(null);
    try {
      localStorage.removeItem(`${timerPrefix}_context`);
    } catch {}
  }, [timerPrefix]);

  return {
    timerRunning,
    timerStart,
    timerEnd,
    timerSeconds,
    isPaused,
    pausedTime,
    pauseStart,
    pauseHistory,
    currentPauseType,
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
function useInsumos(isOperario: boolean = false) {
  const [insumoLines, setInsumoLines] = useState<InsumoLine[]>([
    { id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 },
  ]);

  const addInsumoLine = useCallback(() => {
    setInsumoLines(prev => [...prev, { id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 }]);
  }, []);

  const addInsumoLineCustom = useCallback((descripcion: string, cantidad: number, precioUnitario: number = 0) => {
    setInsumoLines(prev => {
      // Si la primera línea está vacía, reemplazarla
      if (prev.length === 1 && !prev[0].descripcion.trim() && prev[0].cantidad <= 1) {
        return [{ id: prev[0].id, descripcion, cantidad, precioUnitario }];
      }
      return [...prev, { id: generateId('ins'), descripcion, cantidad, precioUnitario }];
    });
  }, []);

  const addInsumoAgregado = useCallback((item: InsumoAgregado) => {
    setInsumoLines(prev => {
      const isFirstEmpty =
        prev.length === 1 && !prev[0].descripcion.trim() && prev[0].cantidad <= 1 && prev[0].precioUnitario === 0;

      const newLine: InsumoLine = {
        id: item.id || generateId('ins'),
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total,
        modoInsumo: item.modoInsumo,
        unidad: item.unidad,
        anchoCm: item.anchoCm,
        altoCm: item.altoCm,
        desperdicioCalculado: item.desperdicioCalculado,
        porcentajeUsado: item.porcentajeUsado,
        facturaCompraId: item.facturaCompraId,
        facturaNumero: item.facturaNumero,
      };

      if (isFirstEmpty) {
        return [newLine];
      }
      return [...prev, newLine];
    });
  }, []);

  const removeInsumoLine = useCallback((id: string) => {
    setInsumoLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const updateInsumoLine = useCallback((id: string, field: keyof InsumoLine, value: string | number) => {
    setInsumoLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const updateInsumoLineCampos = useCallback((id: string, campos: Partial<InsumoLine>) => {
    setInsumoLines(prev => prev.map(l => l.id === id ? { ...l, ...campos } : l));
  }, []);

  const resetInsumos = useCallback(() => {
    setInsumoLines([{ id: generateId('ins'), descripcion: '', cantidad: 1, precioUnitario: 0 }]);
  }, []);

  const totalInsumos = insumoLines.reduce((acc, l) => {
    if (l.total != null && l.total > 0) return acc + l.total;
    return acc + (l.cantidad * l.precioUnitario);
  }, 0);

  const validLines = insumoLines.filter(l => 
    l.descripcion.trim() && 
    l.cantidad > 0 && 
    (isOperario ? true : (l.precioUnitario > 0 || (l.total != null && l.total > 0)))
  );

  return {
    insumoLines,
    addInsumoLine,
    addInsumoLineCustom,
    addInsumoAgregado,
    removeInsumoLine,
    updateInsumoLine,
    updateInsumoLineCampos,
    resetInsumos,
    totalInsumos,
    validLines,
  };
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function RegistroOperativo({ data, onAddRegistro, onRefresh, currentUser }: RegistroOperativoProps) {
  const { showToast } = useNotif();
  const isOperario = currentUser?.rol === 'Operario' || currentUser?.rol === 'OPERADOR' || Boolean(currentUser?.rol?.toUpperCase().includes('OPER'));

  // ══════════════════════════════════════════════════════
  //  SHARED CONTEXT STATE
  // ══════════════════════════════════════════════════════

  // Persist context in localStorage so it survives reconnects / server spin-up delays
  const ctxPrefix = `afull_ctx_${currentUser?.usuario || 'guest'}`;

  const [selectedClienteId, setSelectedClienteId] = useState(() => {
    try { return localStorage.getItem(`${ctxPrefix}_clienteId`) || ''; } catch { return ''; }
  });
  const [selectedProyectoId, setSelectedProyectoId] = useState(() => {
    try { return localStorage.getItem(`${ctxPrefix}_proyectoId`) || ''; } catch { return ''; }
  });

  // Keep localStorage in sync
  useEffect(() => {
    try {
      if (selectedClienteId) localStorage.setItem(`${ctxPrefix}_clienteId`, selectedClienteId);
      else localStorage.removeItem(`${ctxPrefix}_clienteId`);
      if (selectedProyectoId) localStorage.setItem(`${ctxPrefix}_proyectoId`, selectedProyectoId);
      else localStorage.removeItem(`${ctxPrefix}_proyectoId`);
    } catch {}
  }, [selectedClienteId, selectedProyectoId, ctxPrefix]);

  const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));

  // ══════════════════════════════════════════════════════
  //  MULTI-CLIENT PRORRATEO STATE
  // ══════════════════════════════════════════════════════
  const [esMultiCliente, setEsMultiCliente] = useState(false);
  const [distribucionClientes, setDistribucionClientes] = useState<DistribucionClienteItem[]>([
    { id: 'dist_1', clienteId: '', proyectoId: '', porcentaje: 50 },
    { id: 'dist_2', clienteId: '', proyectoId: '', porcentaje: 50 },
  ]);

  const sumaPorcentajes = useMemo(() => {
    return distribucionClientes.reduce((acc, d) => acc + (Number(d.porcentaje) || 0), 0);
  }, [distribucionClientes]);

  const distribucionValida = useMemo(() => {
    if (!esMultiCliente) return true;
    if (distribucionClientes.length < 2) return false;
    if (Math.abs(sumaPorcentajes - 100) > 0.1) return false;
    return distribucionClientes.every(d => d.clienteId && d.proyectoId && d.porcentaje > 0);
  }, [esMultiCliente, distribucionClientes, sumaPorcentajes]);

  const handleAddDistribucionCliente = () => {
    const restante = Math.max(0, 100 - sumaPorcentajes);
    setDistribucionClientes(prev => [
      ...prev,
      {
        id: generateId('dist'),
        clienteId: '',
        proyectoId: '',
        porcentaje: restante > 0 ? restante : 10,
      }
    ]);
  };

  const handleRemoveDistribucionCliente = (id: string) => {
    if (distribucionClientes.length <= 2) return;
    setDistribucionClientes(prev => prev.filter(d => d.id !== id));
  };

  const handleUpdateDistribucionCliente = (
    id: string,
    field: 'clienteId' | 'proyectoId' | 'porcentaje',
    value: any
  ) => {
    setDistribucionClientes(prev =>
      prev.map(d => {
        if (d.id !== id) return d;
        if (field === 'clienteId') {
          const firstProj = data.proyectos.find(p => p.clienteId === value && p.activo !== false);
          return {
            ...d,
            clienteId: value,
            proyectoId: firstProj ? firstProj.id : '',
          };
        }
        return { ...d, [field]: value };
      })
    );
  };

  // ══════════════════════════════════════════════════════
  //  MODALIDAD DE HORARIO (Timer vs Turno Manual)
  // ══════════════════════════════════════════════════════
  const [modoHorario, setModoHorario] = useState<'timer' | 'manual'>('timer');
  const [manualHsInicio, setManualHsInicio] = useState('08:00');
  const [manualHsFin, setManualHsFin] = useState('12:30');

  const duracionManual = useMemo(() => {
    return calcularDuracionHoras(manualHsInicio, manualHsFin);
  }, [manualHsInicio, manualHsFin]);

  const proyectosFiltrados = useMemo(() => data.proyectos.filter(
    p => (!selectedClienteId || p.clienteId === selectedClienteId) && p.activo !== false
  ), [data.proyectos, selectedClienteId]);

  const contextComplete = esMultiCliente
    ? distribucionValida
    : !!(selectedClienteId && selectedProyectoId);

  // Validate persisted IDs still exist in DB (they may have been deleted or deactivated)
  useEffect(() => {
    if (data.clientes.length === 0) return; // data not loaded yet
    if (selectedClienteId && !data.clientes.find(c => c.id === selectedClienteId)) {
      setSelectedClienteId('');
      setSelectedProyectoId('');
    } else if (selectedProyectoId && data.proyectos.length > 0) {
      const proj = data.proyectos.find(p => p.id === selectedProyectoId);
      if (!proj || proj.activo === false) {
        setSelectedProyectoId('');
      }
    }
  }, [data.clientes, data.proyectos, selectedClienteId, selectedProyectoId]);

  // ══════════════════════════════════════════════════════
  //  TIMER & MANO DE OBRA
  // ══════════════════════════════════════════════════════

  const [selectedColaboradorId, setSelectedColaboradorId] = useState(() => {
    try { return localStorage.getItem(`${ctxPrefix}_colaboradorId`) || ''; } catch { return ''; }
  });
  const [moDescripcion, setMoDescripcion] = useState(() => {
    try { return localStorage.getItem(`${ctxPrefix}_moDescripcion`) || ''; } catch { return ''; }
  });
  const [moPrecioUnitario, setMoPrecioUnitario] = useState(() => {
    try { return localStorage.getItem(`${ctxPrefix}_moPrecioUnitario`) || ''; } catch { return ''; }
  });

  useEffect(() => {
    try {
      if (selectedColaboradorId) localStorage.setItem(`${ctxPrefix}_colaboradorId`, selectedColaboradorId);
      else localStorage.removeItem(`${ctxPrefix}_colaboradorId`);
      if (moDescripcion) localStorage.setItem(`${ctxPrefix}_moDescripcion`, moDescripcion);
      else localStorage.removeItem(`${ctxPrefix}_moDescripcion`);
      if (moPrecioUnitario) localStorage.setItem(`${ctxPrefix}_moPrecioUnitario`, moPrecioUnitario);
      else localStorage.removeItem(`${ctxPrefix}_moPrecioUnitario`);
    } catch {}
  }, [selectedColaboradorId, moDescripcion, moPrecioUnitario, ctxPrefix]);

  const handleRestoreContext = useCallback((ctx: {
    clienteId?: string;
    proyectoId?: string;
    colaboradorId?: string;
    descripcion?: string;
    precioUnitario?: number;
  }) => {
    if (ctx.clienteId) setSelectedClienteId(ctx.clienteId);
    if (ctx.proyectoId) setSelectedProyectoId(ctx.proyectoId);
    if (ctx.colaboradorId) setSelectedColaboradorId(ctx.colaboradorId);
    if (ctx.descripcion) setMoDescripcion(ctx.descripcion);
    if (ctx.precioUnitario !== undefined && ctx.precioUnitario > 0) {
      setMoPrecioUnitario(String(ctx.precioUnitario));
    }
  }, []);

  const {
    timerRunning,
    timerStart,
    timerEnd,
    timerSeconds,
    isPaused,
    pausedTime,
    pauseStart,
    pauseHistory,
    currentPauseType,
    handleStartTimer,
    handleStopTimer,
    handleResetTimer,
    handlePauseTimer,
    handleResumeTimer,
  } = useTimer({ currentUser, onRestoreContext: handleRestoreContext });

  const [moSubmitting, setMoSubmitting] = useState(false);
  const [moFeedback, setMoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const canChangeColaborador = currentUser?.rol === 'Admin';
  
  const currentUserColaborador = useMemo(() => currentUser 
    ? data.colaboradores.find(
        col => {
          if (!col?.nombre || !currentUser?.nombre) return false;
          const colName = col.nombre.toLowerCase();
          const userName = currentUser.nombre.toLowerCase();
          return colName.includes(userName) || userName.includes(colName);
        }
      )
    : null, [currentUser, data.colaboradores]);

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
          col => {
            if (!col?.nombre || !currentUser?.nombre) return false;
            const colName = col.nombre.toLowerCase();
            const userName = currentUser.nombre.toLowerCase();
            return colName.includes(userName) || userName.includes(colName);
          }
        );
        if (colaborador) {
          setSelectedColaboradorId(colaborador.id);
          setMoPrecioUnitario(String(colaborador.tarifaSugerida));
        } else {
          // Ningún match por ID ni por nombre — el botón "Iniciar Tarea" quedará bloqueado
          // Ningún match por ID ni por nombre — el botón "Iniciar Tarea" quedará bloqueado
        }
      } else if (!selectedColaboradorId) {
        const colaborador = data.colaboradores.find(
          col => {
            if (!col?.nombre || !currentUser?.nombre) return false;
            const colName = col.nombre.toLowerCase();
            const userName = currentUser.nombre.toLowerCase();
            return colName.includes(userName) || userName.includes(colName);
          }
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

  const minutosRegistrados = modoHorario === 'manual'
    ? duracionManual.minutos
    : Math.floor(timerSeconds / 60);

  const horasTotales = modoHorario === 'manual'
    ? duracionManual.horasDecimal
    : parseFloat((timerSeconds / 3600).toFixed(2));

  const tarifaMin = parseFloat(moPrecioUnitario) || 0;
  const costoMO = minutosRegistrados * tarifaMin;

  const handleSubmitMO = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!contextComplete) {
      setMoFeedback({ type: 'error', msg: 'Seleccioná Cliente y Proyecto antes de registrar.' });
      return;
    }
    if (modoHorario === 'timer' && timerSeconds <= 0 && !timerEnd) {
      setMoFeedback({ type: 'error', msg: 'El timer debe haber iniciado y finalizado.' });
      return;
    }
    if (modoHorario === 'manual' && (!duracionManual.valido || duracionManual.minutos <= 0)) {
      setMoFeedback({ type: 'error', msg: 'Ingresá un horario de inicio y fin válido.' });
      return;
    }
    if (!selectedColaboradorId && !moDescripcion.trim()) {
      setMoFeedback({ type: 'error', msg: 'Seleccioná un colaborador o ingresá una descripción.' });
      return;
    }

    const colaborador = data.colaboradores.find(c => c.id === selectedColaboradorId);
    const hsInicio = modoHorario === 'manual' ? manualHsInicio : (timerStart ? formatTime(timerStart) : undefined);
    const hsFin = modoHorario === 'manual' ? manualHsFin : (timerEnd ? formatTime(timerEnd) : undefined);

    setMoSubmitting(true);
    setMoFeedback(null);

    if (esMultiCliente) {
      try {
        const res = await authFetchJSON<{ success: boolean; data: any; error?: any }>('/api/registros/prorrateo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            distribucion: distribucionClientes.map(d => ({
              clienteId: d.clienteId,
              proyectoId: d.proyectoId,
              porcentaje: Number(d.porcentaje),
            })),
            registroBase: {
              fecha,
              concepto: 'MO',
              descripcion: moDescripcion || (colaborador ? colaborador.nombre : 'Tarea sin descripción'),
              colaboradorId: selectedColaboradorId || undefined,
              hsInicio,
              hsFin,
              hsTotal: horasTotales,
              cantidad: Math.max(1, minutosRegistrados),
              precioUnitario: tarifaMin,
              total: Math.max(tarifaMin, costoMO),
            }
          })
        });

        setMoSubmitting(false);
        if (res.success) {
          showToast('Horas de mano de obra prorrateadas registradas con éxito', 'success');
          setMoFeedback({
            type: 'success',
            msg: `✓ Registrado prorrateo: ${modoHorario === 'manual' ? duracionManual.duracionTexto + ' hs' : formatDuration(timerSeconds)}${!isOperario ? ` — ${formatGuaranies(costoMO)}` : ''}`
          });
          if (modoHorario === 'timer') handleResetTimer();
          setMoDescripcion('');
          if (onRefresh) await onRefresh();
        } else {
          showToast(res.error?.message || 'Error al guardar prorrateo', 'error');
          setMoFeedback({ type: 'error', msg: res.error?.message || 'Error al guardar prorrateo.' });
        }
      } catch (err: any) {
        setMoSubmitting(false);
        showToast('Error al conectar con el servidor', 'error');
        setMoFeedback({ type: 'error', msg: err?.message || 'Error al conectar con el servidor.' });
      }
    } else {
      const ok = await onAddRegistro({
        clienteId: selectedClienteId,
        proyectoId: selectedProyectoId,
        fecha,
        concepto: 'MO',
        descripcion: moDescripcion || (colaborador ? colaborador.nombre : 'Tarea sin descripción'),
        colaboradorId: selectedColaboradorId || undefined,
        hsInicio,
        hsFin,
        hsTotal: horasTotales,
        cantidad: Math.max(1, minutosRegistrados),
        precioUnitario: tarifaMin,
        total: Math.max(tarifaMin, costoMO),
      });

      setMoSubmitting(false);
      if (ok) {
        showToast('Horas de mano de obra registradas con éxito', 'success');
        setMoFeedback({
          type: 'success',
          msg: `✓ Registrado: ${modoHorario === 'manual' ? duracionManual.duracionTexto + ' hs' : formatDuration(timerSeconds)}${!isOperario ? ` — ${formatGuaranies(costoMO)}` : ''}`
        });
        if (modoHorario === 'timer') handleResetTimer();
        setMoDescripcion('');
      } else {
        showToast('Error al guardar registro de mano de obra', 'error');
        setMoFeedback({ type: 'error', msg: 'Error al guardar. Verificá los campos e intentá nuevamente.' });
      }
    }
  };

  // ══════════════════════════════════════════════════════
  //  INSUMOS
  // ══════════════════════════════════════════════════════

  const {
    insumoLines,
    addInsumoLine,
    addInsumoLineCustom,
    addInsumoAgregado,
    removeInsumoLine,
    updateInsumoLine,
    updateInsumoLineCampos,
    resetInsumos,
    totalInsumos,
    validLines,
  } = useInsumos(isOperario);

  // Catálogo reactivo de insumos históricos y sugerencias frecuentes (Item 11)
  const catalogoInsumos = useMemo(() => {
    const map = new Map<string, { descripcion: string; precioUnitario: number; count: number }>();
    (data.registros || []).forEach((r) => {
      if (r.concepto === 'Insumo' && r.descripcion?.trim()) {
        const desc = r.descripcion.trim();
        const key = desc.toLowerCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { descripcion: desc, precioUnitario: r.precioUnitario || 0, count: 1 });
        } else {
          existing.count += 1;
          if (r.precioUnitario && r.precioUnitario > 0) {
            existing.precioUnitario = r.precioUnitario;
          }
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [data.registros]);

  const insumosFrecuentes = useMemo(() => {
    return catalogoInsumos.slice(0, 6);
  }, [catalogoInsumos]);

  const [showCalculadoraAdhesivo, setShowCalculadoraAdhesivo] = useState(false);
  const [showCosteoTabs, setShowCosteoTabs] = useState(false);
  const [insumosSubmitting, setInsumosSubmitting] = useState(false);
  const [insumosFeedback, setInsumosFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleAplicarCalculoAdhesivo = (res: CalculoAdhesivoResultado) => {
    if (res.lineasDesglosadas && res.lineasDesglosadas.length > 1) {
      for (const linea of res.lineasDesglosadas) {
        addInsumoLineCustom(linea.descripcion, linea.cantidad, linea.precioUnitario);
      }
    } else {
      addInsumoLineCustom(res.resumenTexto, res.areaTotalM2, res.precioUnitarioGs || 0);
    }
  };

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
      setInsumosFeedback({
        type: 'error',
        msg: isOperario
          ? 'Ingresá al menos un insumo con descripción y cantidad.'
          : 'Ingresá al menos un insumo con descripción y precio.'
      });
      return;
    }

    setInsumosSubmitting(true);
    setInsumosFeedback(null);

    if (esMultiCliente) {
      let allOk = true;
      for (const line of validLines) {
        try {
          const res = await authFetchJSON<{ success: boolean; data: any; error?: any }>('/api/registros/prorrateo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              distribucion: distribucionClientes.map(d => ({
                clienteId: d.clienteId,
                proyectoId: d.proyectoId,
                porcentaje: Number(d.porcentaje),
              })),
              registroBase: {
                fecha,
                concepto: 'Insumo',
                descripcion: line.descripcion,
                cantidad: line.cantidad,
                precioUnitario: line.precioUnitario,
                total: line.total != null && line.total > 0 ? line.total : line.cantidad * line.precioUnitario,
                modoInsumo: line.modoInsumo,
                anchoCm: line.anchoCm,
                altoCm: line.altoCm,
                desperdicioCalculado: line.desperdicioCalculado,
                porcentajeUsado: line.porcentajeUsado,
                facturaCompraId: line.facturaCompraId,
              }
            })
          });
          if (!res.success) allOk = false;
        } catch {
          allOk = false;
        }
      }

      setInsumosSubmitting(false);
      if (allOk) {
        showToast(`${validLines.length} insumo(s) prorrateados con éxito`, 'success');
        setInsumosFeedback({
          type: 'success',
          msg: `✓ ${validLines.length} insumo(s) prorrateados${!isOperario ? ` — Total: ${formatGuaranies(totalInsumos)}` : ''}`
        });
        resetInsumos();
        if (onRefresh) await onRefresh();
      } else {
        showToast('Algunos insumos no se pudieron guardar', 'error');
        setInsumosFeedback({ type: 'error', msg: 'Algunos insumos no se pudieron guardar en prorrateo.' });
      }
    } else {
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
          total: line.total != null && line.total > 0 ? line.total : line.cantidad * line.precioUnitario,
          modoInsumo: line.modoInsumo,
          anchoCm: line.anchoCm,
          altoCm: line.altoCm,
          desperdicioCalculado: line.desperdicioCalculado,
          porcentajeUsado: line.porcentajeUsado,
          facturaCompraId: line.facturaCompraId,
        });
        if (!ok) allOk = false;
      }

      setInsumosSubmitting(false);
      if (allOk) {
        showToast(`${validLines.length} insumo(s) registrados con éxito`, 'success');
        setInsumosFeedback({
          type: 'success',
          msg: `✓ ${validLines.length} insumo(s) registrados${!isOperario ? ` — Total: ${formatGuaranies(totalInsumos)}` : ''}`
        });
        resetInsumos();
      } else {
        showToast('Algunos insumos no se pudieron guardar', 'error');
        setInsumosFeedback({ type: 'error', msg: 'Algunos insumos no se pudieron guardar.' });
      }
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
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Registro Operativo
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Completá el contexto primero, luego seleccioná Mano de Obra o Insumos en las pestañas.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════
          PASO 1: CONTEXTO DEL REGISTRO (Destacado arriba)
          ══════════════════════════════════════════════════════ */}
      <div
        className={`glass-panel rounded-md p-5 border transition-all ${
          contextComplete
            ? 'border-emerald-500/40'
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

        {/* Checkbox Multi-Cliente */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/7">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={esMultiCliente}
              onChange={e => setEsMultiCliente(e.target.checked)}
              disabled={timerRunning}
              className="w-4 h-4 rounded border-white/20 bg-black/40 text-orange-600 focus:ring-orange-500/30 accent-orange-600 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              Repartir esta actividad entre varios clientes (por porcentaje)
            </span>
          </label>

          {esMultiCliente && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                Math.abs(sumaPorcentajes - 100) < 0.1
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : sumaPorcentajes < 100
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {Math.abs(sumaPorcentajes - 100) < 0.1
                  ? '✓ 100% Asignado'
                  : sumaPorcentajes < 100
                  ? `Falta asignar ${(100 - sumaPorcentajes).toFixed(1)}% (Total: ${sumaPorcentajes}%)`
                  : `Excede por ${(sumaPorcentajes - 100).toFixed(1)}% (Total: ${sumaPorcentajes}%)`}
              </span>
            </div>
          )}
        </div>

        {esMultiCliente ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Asigná el porcentaje de participación para cada cliente. El costo y tiempo se distribuirán automáticamente según los porcentajes definidos.
            </p>

            <div className="space-y-2">
              {distribucionClientes.map((dist, idx) => {
                const proyectosDelCliente = data.proyectos.filter(
                  p => p.clienteId === dist.clienteId && p.activo !== false
                );
                return (
                  <div
                    key={dist.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white/5 rounded-md p-2.5 border border-white/5"
                  >
                    {/* Cliente */}
                    <div className="md:col-span-5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Cliente {idx + 1}
                      </label>
                      <select
                        value={dist.clienteId}
                        onChange={e => handleUpdateDistribucionCliente(dist.id, 'clienteId', e.target.value)}
                        className="glass-select w-full rounded-md px-3 py-2 text-xs"
                      >
                        <option value="">— Seleccionar Cliente —</option>
                        {data.clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Proyecto */}
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Proyecto
                      </label>
                      <select
                        value={dist.proyectoId}
                        onChange={e => handleUpdateDistribucionCliente(dist.id, 'proyectoId', e.target.value)}
                        disabled={!dist.clienteId}
                        className="glass-select w-full rounded-md px-3 py-2 text-xs disabled:opacity-50"
                      >
                        <option value="">— Seleccionar Proyecto —</option>
                        {proyectosDelCliente.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Porcentaje */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Porcentaje (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          value={dist.porcentaje}
                          onChange={e => handleUpdateDistribucionCliente(dist.id, 'porcentaje', parseFloat(e.target.value) || 0)}
                          className="glass-input w-full rounded-md px-3 py-2 text-xs text-right pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">%</span>
                      </div>
                    </div>

                    {/* Botón Eliminar */}
                    <div className="md:col-span-1 flex items-end justify-center pt-3 md:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveDistribucionCliente(dist.id)}
                        disabled={distribucionClientes.length <= 2}
                        className="p-2 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer transition-colors"
                        title="Eliminar cliente del prorrateo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddDistribucionCliente}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-white/15 text-xs text-slate-300 hover:text-orange-400 hover:border-orange-500/30 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar otro Cliente
              </button>

              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-slate-400">Fecha:</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="glass-input rounded-md px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cliente */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
                Cliente
                <span className="text-rose-400">*</span>
                {timerRunning && <Lock className="w-3 h-3 text-amber-400" />}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <select
                  value={selectedClienteId}
                  onChange={e => { setSelectedClienteId(e.target.value); setSelectedProyectoId(''); }}
                  onKeyDown={handleKeyDown}
                  disabled={timerRunning || !!timerEnd}
                  className={`glass-select w-full rounded-md pl-10 pr-4 py-2.5 text-sm ${
                    timerRunning || timerEnd ? 'opacity-50 cursor-not-allowed' : ''
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
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
                Proyecto
                <span className="text-rose-400">*</span>
                {timerRunning && <Lock className="w-3 h-3 text-amber-400" />}
              </label>
              <select
                value={selectedProyectoId}
                onChange={e => setSelectedProyectoId(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selectedClienteId || timerRunning || !!timerEnd}
                className={`glass-select w-full rounded-md px-4 py-2.5 text-sm ${
                  !selectedClienteId || timerRunning || timerEnd ? 'opacity-50 cursor-not-allowed' : ''
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
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                onKeyDown={handleKeyDown}
                className="glass-input w-full rounded-md px-4 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {!contextComplete && (
          <p className="mt-3 text-xs text-amber-400/80 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {esMultiCliente
              ? 'Completá los clientes, proyectos y asegurate de que los porcentajes sumen exactamente 100%.'
              : 'Seleccioná Cliente y Proyecto para poder registrar operaciones.'}
          </p>
        )}
      </div>

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
              {timerRunning && <span className="ml-1.5 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />}
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
            <div className="glass-panel rounded-md p-6 space-y-6">
              
              {/* Selector de Modo: Timer en Vivo vs Carga Rápida Manual */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/7">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-orange-400" />
                  Modalidad de Horario
                </span>
                <div className="flex gap-1 p-1 bg-[#111318] rounded-md border border-white/7">
                  <button
                    type="button"
                    onClick={() => setModoHorario('timer')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                      modoHorario === 'timer'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    Timer en Vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoHorario('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                      modoHorario === 'manual'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Carga Rápida de Turno
                  </button>
                </div>
              </div>

              {modoHorario === 'timer' ? (
                /* Timer Display Grande */
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative flex items-center justify-center">
                    <div className={`w-40 h-40 rounded-md flex flex-col items-center justify-center transition-colors ${
                      timerRunning && !isPaused
                        ? 'bg-orange-500/10 border border-orange-500/40'
                        : isPaused
                        ? 'bg-amber-500/10 border border-amber-500/40'
                        : timerEnd
                        ? 'bg-emerald-500/10 border border-emerald-500/40'
                        : 'bg-white/5 border border-white/10'
                    }`}>
                      <span
                        className={`font-mono text-3xl font-bold tracking-tight tabular-nums ${
                          timerRunning && !isPaused 
                            ? 'text-orange-400' 
                            : isPaused 
                            ? 'text-amber-400' 
                            : timerEnd 
                            ? 'text-emerald-400' 
                            : 'text-slate-400'
                        }`}
                      >
                        {formatDuration(timerSeconds)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
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
                      <div
                        className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs ${
                          currentPauseType === 'pausa'
                            ? 'bg-slate-800 text-slate-300 border border-slate-700'
                            : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {currentPauseType === 'pausa' ? (
                          <Pause className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <Coffee className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="font-mono font-medium">
                          {currentPauseType === 'pausa' ? 'Pausa' : 'Descanso'}
                        </span>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Timestamps */}
                  {(timerStart || timerEnd) && (
                    <div className="flex gap-6 text-xs font-mono">
                      {timerStart && (
                        <div className="flex flex-col items-center">
                          <span className="text-slate-500 uppercase tracking-wider text-[9px]">Inicio</span>
                          <span className="text-orange-400 font-semibold text-xs">{formatTime(timerStart)}</span>
                        </div>
                      )}
                      {timerEnd && (
                        <div className="flex flex-col items-center">
                          <span className="text-slate-500 uppercase tracking-wider text-[9px]">Fin</span>
                          <span className="text-emerald-400 font-semibold text-xs">{formatTime(timerEnd)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aviso mobile: colaborador no asignado aún */}
                  {!timerRunning && !timerEnd && contextComplete && !selectedColaboradorId && !canChangeColaborador && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5 mb-1">
                      <span>⏳</span>
                      <span>Cargando tu colaborador… si tarda, recargá la página.</span>
                    </div>
                  )}

                  {/* Botones del Timer */}
                  <div className="flex gap-2">
                    {!timerRunning && !timerEnd && (
                      <button
                        type="button"
                        onClick={onStartTimer}
                        disabled={!contextComplete || (!selectedColaboradorId && !canChangeColaborador)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm border border-orange-500/30 transition-colors cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Iniciar Tarea
                      </button>
                    )}

                    {timerRunning && !isPaused && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePauseTimer('pausa')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-white/10 transition-colors cursor-pointer"
                          title="Pausa corta"
                        >
                          <Pause className="w-4 h-4" />
                          Pausa
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePauseTimer('descanso')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-sm border border-amber-500/30 transition-colors cursor-pointer"
                          title="Descanso / Almuerzo"
                        >
                          <Coffee className="w-4 h-4" />
                          Descanso
                        </button>

                        <button
                          type="button"
                          onClick={handleStopTimer}
                          className="flex items-center gap-1.5 px-5 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-sm border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          <Square className="w-4 h-4 fill-white" />
                          Finalizar
                        </button>
                      </>
                    )}

                    {timerRunning && isPaused && (
                      <>
                        <button
                          type="button"
                          onClick={handleResumeTimer}
                          className="flex items-center gap-1.5 px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          Reanudar
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleStopTimer}
                          className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-sm border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          <Square className="w-4 h-4 fill-white" />
                          Finalizar
                        </button>
                      </>
                    )}

                    {(timerRunning || timerEnd) && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleResetTimer}
                        className="p-3 rounded-md glass-panel hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                        title="Reiniciar timer"
                      >
                        <X className="w-5 h-5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              ) : (
                /* Modo Manual: Hora Inicio y Hora Fin */
                <div className="bg-[#111318]/60 border border-white/10 rounded-md p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        Hora Inicio (HH:MM)
                      </label>
                      <input
                        type="time"
                        value={manualHsInicio}
                        onChange={e => setManualHsInicio(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="glass-input w-full rounded-md px-4 py-2.5 text-sm font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        Hora Fin (HH:MM)
                      </label>
                      <input
                        type="time"
                        value={manualHsFin}
                        onChange={e => setManualHsFin(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="glass-input w-full rounded-md px-4 py-2.5 text-sm font-mono text-white"
                      />
                    </div>
                  </div>

                  {/* Badge de Duración Calculada */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-white/5 border border-white/7">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Duración calculada:</span>
                      <span className="font-mono text-base font-bold text-orange-400">
                        {duracionManual.duracionTexto} hs
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        ({duracionManual.minutos} minutos)
                      </span>
                      {manualHsFin < manualHsInicio && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Cruce medianoche
                        </span>
                      )}
                    </div>

                    {!isOperario && tarifaMin > 0 && duracionManual.valido && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Costo Mano de Obra</span>
                        <span className="font-mono font-bold text-white text-base">
                          {formatGuaranies(duracionManual.minutos * tarifaMin)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vista Previa del Costo */}
              <AnimatePresence>
                {timerSeconds > 0 && currentUser?.rol !== 'Operario' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-md px-6 py-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 block mb-1">Vista Previa del Costo</span>
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
                {/* Colaborador - hidden for Operario */}
                {currentUser?.rol !== 'Operario' && (<div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-2">
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events none z-10" />
                      <select
                        value={selectedColaboradorId}
                        onChange={e => setSelectedColaboradorId(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="glass-select w-full rounded-md pl-10 pr-4 py-2.5 text-sm"
                      >
                        <option value="">— Sin asignar —</option>
                        {data.colaboradores.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} {currentUser?.rol !== 'Operario' ? `(${formatGuaranies(c.tarifaSugerida)}/min)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events none z-10" />
                      <div className="w-full rounded-md pl-10 pr-4 py-2.5 text-sm text-white bg-[#0b0c10] border border-white/10 flex items-center gap-2">
                        <span className="flex-1">
                          {currentUser?.nombre || 'Usuario actual'}
                        </span>
                        {currentUser?.rol !== 'Operario' && currentUserColaborador && (
                          <span className="text-xs text-slate-400 font-mono">
                            {formatGuaranies(currentUserColaborador.tarifaSugerida)}/min
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>)}

                {/* Descripción */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block">
                    Descripción de la tarea
                  </label>
                  <input
                    type="text"
                    value={moDescripcion}
                    onChange={e => setMoDescripcion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="ej: Instalación de vinilo en fachada..."
                    className="glass-input w-full rounded-md px-4 py-2.5 text-sm"
                  />
                </div>

                {/* Tarifa */}
                {currentUser?.rol !== 'Operario' && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-2">
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
                        className={`w-full rounded-md pl-10 pr-4 py-2.5 text-sm ${
                          canChangeColaborador 
                            ? 'glass-input' 
                            : 'bg-[#0b0c10] border border-white/5 text-slate-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>
                )}
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
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleSubmitMO}
                disabled={moSubmitting || (modoHorario === 'timer' ? (timerSeconds === 0 && !timerEnd) : (!duracionManual.valido || duracionManual.minutos <= 0))}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-md bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-xl shadow-orange-500/20 border border-white/10 transition-all cursor-pointer"
              >
                {moSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {esMultiCliente ? 'Registrar Horas Prorrateadas' : 'Registrar Horas de Mano de Obra'}
                  </>
                )}
              </motion.button>
            </div>
          </TabPanel>

          {/* ══════════════════════════════════════════════════════
              TAB PANEL: INSUMOS
              ══════════════════════════════════════════════════════ */}
          <TabPanel id="insumos">
            <div className="glass-panel rounded-md p-5 space-y-4">
              
              {/* Header con total */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">Materiales y Gastos Operativos</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isOperario
                      ? 'Agregá líneas de insumos con cantidad o usá la calculadora'
                      : 'Agregá líneas de insumos con cantidad y precio'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCosteoTabs(!showCosteoTabs)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                      showCosteoTabs
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    }`}
                    title="Costeo ágil de taller: Por unidad, Por metro, Por dimensión AxA, Por porcentaje y Desde factura"
                  >
                    <Layers className="w-4 h-4 text-amber-400" />
                    {showCosteoTabs ? 'Cerrar 5 Modos ▲' : '⚡ 5 Modos de Insumo ▼'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCalculadoraAdhesivo(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-medium transition-colors cursor-pointer"
                    title="Calcular metros cuadrados, lonas y desperdicio"
                  >
                    <Calculator className="w-4 h-4" />
                    📐 Calcular Lonas / Desperdicio
                  </button>
                  <AnimatePresence>
                    {!isOperario && totalInsumos > 0 && (
                      <div
                        className="bg-orange-500/10 border border-orange-500/30 rounded px-3 py-1 text-right"
                      >
                        <p className="text-[9px] font-mono uppercase text-orange-400 tracking-wider">Total</p>
                        <p className="font-mono font-bold text-white text-sm">{formatGuaranies(totalInsumos)}</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Panel Desplegable: 5 Modos de Insumos de Taller */}
              <AnimatePresence>
                {showCosteoTabs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden mb-3"
                  >
                    <InsumosCosteoTabs
                      isOperario={isOperario}
                      onAgregar={(insumo) => {
                        addInsumoAgregado(insumo);
                        showToast(`Insumo agregado: ${insumo.descripcion.substring(0, 30)}...`, 'success');
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sugerencias de insumos frecuentes (Item 11) */}
              {insumosFrecuentes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md bg-[#090a0f]/60 border border-white/5">
                  <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-orange-400" /> Insumos frecuentes:
                  </span>
                  {insumosFrecuentes.map((item) => (
                    <button
                      key={item.descripcion}
                      type="button"
                      onClick={() => {
                        const lastLine = insumoLines[insumoLines.length - 1];
                        if (lastLine && !lastLine.descripcion.trim()) {
                          updateInsumoLineCampos(lastLine.id, {
                            descripcion: item.descripcion,
                            precioUnitario: item.precioUnitario,
                          });
                        } else {
                          addInsumoLineCustom(item.descripcion, 1, item.precioUnitario);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 hover:bg-orange-500/20 text-slate-300 hover:text-orange-300 border border-white/10 hover:border-orange-500/30 transition-colors cursor-pointer"
                      title={item.precioUnitario > 0 ? `Precio sugerido: Gs. ${item.precioUnitario.toLocaleString('es-PY')}` : 'Seleccionar insumo'}
                    >
                      <span>{item.descripcion}</span>
                      {!isOperario && item.precioUnitario > 0 && (
                        <span className="text-[10px] text-orange-400/90 font-semibold">({formatGuaranies(item.precioUnitario)})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Datalist global para autocompletar insumos */}
              <datalist id="datalist-insumos-sugeridos">
                {catalogoInsumos.map((item) => (
                  <option key={item.descripcion} value={item.descripcion}>
                    {!isOperario && item.precioUnitario > 0 ? `Gs. ${Math.round(item.precioUnitario).toLocaleString('es-PY')}` : ''}
                  </option>
                ))}
              </datalist>

              {/* Tabla de insumos */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 px-2">
                  <span className={`${isOperario ? 'col-span-9' : 'col-span-5'} text-[9px] font-mono uppercase tracking-wider text-slate-600`}>Descripción</span>
                  <span className={`${isOperario ? 'col-span-3' : 'col-span-2'} text-[9px] font-mono uppercase tracking-wider text-slate-600 text-center`}>Cantidad</span>
                  {!isOperario && (
                    <>
                      <span className="col-span-3 text-[9px] font-mono uppercase tracking-wider text-slate-600 text-right">Precio Unit. (Gs.)</span>
                      <span className="col-span-2 text-[9px] font-mono uppercase tracking-wider text-slate-600 text-right">Subtotal</span>
                    </>
                  )}
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {insumoLines.map((line, idx) => {
                      const subtotal = line.total != null && line.total > 0 ? line.total : line.cantidad * line.precioUnitario;
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
                          <div className={isOperario ? 'col-span-9' : 'col-span-5'}>
                            {line.modoInsumo && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {line.modoInsumo === 'UNIDAD' && 'Unidad'}
                                  {line.modoInsumo === 'METRO' && 'Metro lineal'}
                                  {line.modoInsumo === 'DIMENSION' && 'Dimensión AxA'}
                                  {line.modoInsumo === 'PORCENTAJE' && 'Porcentaje'}
                                  {line.modoInsumo === 'FACTURA' && `Factura #${line.facturaNumero || ''}`}
                                </span>
                                {line.unidad && (
                                  <span className="text-[9px] font-mono text-slate-400">
                                    ({line.unidad})
                                  </span>
                                )}
                              </div>
                            )}
                            <input
                              type="text"
                              role="textbox"
                              list="datalist-insumos-sugeridos"
                              value={line.descripcion}
                              onChange={(e) => {
                                const val = e.target.value;
                                const match = catalogoInsumos.find((c) => c.descripcion.toLowerCase() === val.trim().toLowerCase());
                                if (match && match.precioUnitario > 0 && (!line.precioUnitario || line.precioUnitario === 0)) {
                                  updateInsumoLineCampos(line.id, {
                                    descripcion: val,
                                    precioUnitario: match.precioUnitario,
                                  });
                                } else {
                                  updateInsumoLine(line.id, 'descripcion', val);
                                }
                              }}
                              onKeyDown={handleKeyDown}
                              placeholder={`Insumo ${idx + 1}...`}
                              className="glass-input w-full rounded-md px-3 py-2.5 text-sm border-0 focus:ring-2 focus:ring-orange-500/30"
                            />
                          </div>
                          {/* Cantidad */}
                          <div className={isOperario ? 'col-span-3 flex items-center gap-2' : 'col-span-2'}>
                            <input
                              type="number"
                              value={line.cantidad}
                              onChange={e => updateInsumoLine(line.id, 'cantidad', parseFloat(e.target.value) || 0)}
                              onKeyDown={handleKeyDown}
                              min="0"
                              step="any"
                              className="glass-input w-full rounded-lg px-2.5 py-2.5 text-sm text-center border-0 focus:ring-2 focus:ring-amber-500/30"
                            />
                            {isOperario && insumoLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeInsumoLine(line.id)}
                                aria-label="Eliminar línea"
                                className="text-slate-600 hover:text-rose-400 transition-colors p-1 shrink-0 rounded hover:bg-rose-500/10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {/* Precio & Subtotal (Admin/Visor only) */}
                          {!isOperario && (
                            <>
                              {/* Precio */}
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  value={line.precioUnitario || ''}
                                  onChange={e => updateInsumoLine(line.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                                  onKeyDown={handleKeyDown}
                                  placeholder="0"
                                  min="0"
                                  className="glass-input w-full rounded-lg px-2.5 py-2.5 text-sm text-right border-0 focus:ring-2 focus:ring-amber-500/30"
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
                                    aria-label="Eliminar línea"
                                    className="text-slate-600 hover:text-rose-400 transition-colors p-1 shrink-0 rounded hover:bg-rose-500/10"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Botón agregar línea */}
                <button
                  type="button"
                  onClick={addInsumoLine}
                  className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-orange-400 transition-colors py-2.5 border border-dashed border-white/10 hover:border-orange-500/30 rounded-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Agregar ítem de insumo
                </button>
              </div>

              {/* Total final */}
              <div className="border-t border-white/7 pt-3 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">
                  {validLines.length} de {insumoLines.length} línea(s) válida(s)
                </span>
                {!isOperario && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Total a Registrar</span>
                    <span className="font-mono font-bold text-white text-lg">
                      {formatGuaranies(totalInsumos)}
                    </span>
                  </div>
                )}
              </div>

              {/* Feedback Insumos */}
              <AnimatePresence mode="wait">
                {insumosFeedback && (
                  <div
                    className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${
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
                  </div>
                )}
              </AnimatePresence>

              {/* Botón Registrar Insumos */}
              <button
                type="button"
                onClick={handleSubmitInsumos}
                disabled={insumosSubmitting || validLines.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm border border-orange-500/30 transition-colors cursor-pointer"
              >
                {insumosSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    {esMultiCliente
                      ? `Registrar ${validLines.length} Insumo(s) Prorrateados`
                      : `Registrar ${validLines.length} Insumo(s)`}
                  </>
                )}
              </button>
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
              onRefresh={onRefresh}
            />
          </TabPanel>

        </Tabs>
      </motion.div>

      {/* Calculadora de Lonas, Impresión y Desperdicio para Edu/Operario */}
      <CalculadoraAdhesivoModal
        isOpen={showCalculadoraAdhesivo}
        onClose={() => setShowCalculadoraAdhesivo(false)}
        onAplicar={handleAplicarCalculoAdhesivo}
        titulo="Calculadora de Lonas, Impresión y Desperdicio"
        ocultarPrecios={isOperario}
      />
    </form>
  );
}
