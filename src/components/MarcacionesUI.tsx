import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MapPin, AlertTriangle, CheckCircle, XCircle, ChevronDown, History } from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';

interface Marcacion {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  timestamp: string;
  lat: number | null;
  lng: number | null;
  precision: number | null;
}

interface MarcacionesUIProps {
  usuario: string;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function MarcacionesUI({ usuario, showToast }: MarcacionesUIProps) {
  const [loading, setLoading] = useState(false);
  const [ultima, setUltima] = useState<Marcacion | null>(null);
  const [historial, setHistorial] = useState<Marcacion[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const tieneEntradaActiva = ultima?.tipo === 'ENTRADA';

  useEffect(() => {
    fetchUltimaMarcacion();
  }, [usuario]);

  async function fetchUltimaMarcacion() {
    try {
      const res = await authFetchJSON('/api/marcacion/mis-marcaciones?limite=5');
      if (res.success && res.data?.length > 0) {
        setUltima(res.data[0]);
        setHistorial(res.data);
      }
    } catch {}
  }

  function getGPS(): Promise<{ lat: number; lng: number; precision: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        }),
        (err) => {
          const msgs: Record<number, string> = {
            1: 'Permiso de ubicación denegado',
            2: 'Señal GPS no disponible',
            3: 'Tiempo de espera agotado',
          };
          reject(new Error(msgs[err.code] || 'Error de GPS'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }

  async function handleMarcar() {
    setLoading(true);
    setGeoError(null);
    try {
      const gps = await getGPS();
      const endpoint = tieneEntradaActiva ? '/api/marcacion/salida' : '/api/marcacion/entrada';
      const res = await authFetchJSON(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gps),
      });
      if (res.success) {
        showToast(tieneEntradaActiva ? 'Salida registrada' : 'Entrada registrada', 'success');
        await fetchUltimaMarcacion();
      }
    } catch (err: any) {
      const msg = err.message || 'Error al marcar';
      if (msg.includes('GPS') || msg.includes('Geolocalización') || msg.includes('Permiso') || msg.includes('denegado')) {
        setGeoError(msg);
      }
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  function formatTime(ts: string) {
    try { return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }
  function formatDate(ts: string) {
    try { return new Date(ts).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }); } catch { return ''; }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <motion.button
          onClick={handleMarcar}
          disabled={loading}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
            tieneEntradaActiva
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
          } ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title={tieneEntradaActiva ? 'Marcar salida' : 'Marcar entrada'}
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <Clock className="w-3 h-3" />
          )}
          <span>{tieneEntradaActiva ? 'SALIDA' : 'ENTRADA'}</span>
        </motion.button>
        {historial.length > 0 && (
          <motion.button
            onClick={() => setShowHistorial(!showHistorial)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showHistorial ? 'rotate-180' : ''}`} />
          </motion.button>
        )}
      </div>
      {geoError && (
        <div className="absolute top-full right-0 mt-1 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 text-[10px] text-red-400 whitespace-nowrap z-50 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />
          {geoError}
        </div>
      )}
      <AnimatePresence>
        {showHistorial && historial.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 min-w-[200px] overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
              <History className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Últimas</span>
            </div>
            {historial.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {m.tipo === 'ENTRADA' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className={m.tipo === 'ENTRADA' ? 'text-emerald-300' : 'text-red-300'}>{m.tipo}</span>
                </div>
                <div className="text-slate-500">
                  {formatDate(m.timestamp)} {formatTime(m.timestamp)}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
