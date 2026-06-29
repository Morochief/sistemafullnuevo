import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, MapPin, AlertTriangle, Users, Search, Filter, ShieldAlert } from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';

interface MarcacionTimeline {
  id: string;
  usuario: string;
  tipo: 'ENTRADA' | 'SALIDA';
  timestamp: string;
  lat: number | null;
  lng: number | null;
  ip: string | null;
  dispositivoHash: string | null;
  origen: string;
  alertas: string[];
}

export default function TimelineMarcaciones() {
  const [data, setData] = useState<MarcacionTimeline[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchTimeline(); }, []);

  async function fetchTimeline() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroUsuario) params.set('usuario', filtroUsuario);
      params.set('limite', '100');
      const res = await authFetchJSON(`/api/marcacion/admin/timeline?${params}`);
      if (res.success) setData(res.data || []);
      else setError('Error al obtener timeline');
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally { setLoading(false); }
  }

  function formatDateTime(ts: string) {
    try { return new Date(ts).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ts; }
  }

  const usuariosUnicos = [...new Set(data.map(m => m.usuario))];
  const usuariosConAlertas = [...new Set(data.filter(m => m.alertas.length > 0).map(m => m.usuario))];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Timeline de Marcaciones</h3>
        </div>
        {usuariosConAlertas.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Anomalías detectadas</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar por usuario..."
            value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            list="usuarios-list"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <datalist id="usuarios-list">
            {usuariosUnicos.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>
        <motion.button
          onClick={fetchTimeline}
          whileTap={{ scale: 0.95 }}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5" />
          Filtrar
        </motion.button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-blue-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs">No hay marcaciones registradas</div>
      ) : (
        <div className="space-y-1">
          {data.map((m, i) => {
            const tieneAlertas = m.alertas.length > 0;
            return (
              <div key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                tieneAlertas ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-white/5 hover:bg-white/10'
              }`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  m.tipo === 'ENTRADA' ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">{m.usuario}</span>
                    <span className={`font-semibold ${
                      m.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-red-400'
                    }`}>{m.tipo}</span>
                    <span className="text-slate-500">{formatDateTime(m.timestamp)}</span>
                    {m.origen === 'API' && (
                      <span className="px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[9px] font-mono">API</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                    {m.lat && m.lng && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                      </span>
                    )}
                    {m.ip && <span className="font-mono">IP: {m.ip}</span>}
                  </div>
                </div>
                {tieneAlertas && (
                  <div className="flex items-center gap-1 shrink-0">
                    {m.alertas.includes('MULTIPLES_IPS') && (
                      <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        IPs distintas
                      </span>
                    )}
                    {m.alertas.includes('MULTIPLES_DISPOSITIVOS') && (
                      <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Disp. distintos
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
