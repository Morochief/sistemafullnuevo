import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogIn, LogOut, Search, ShieldAlert } from 'lucide-react';
import { authFetchJSON } from '../authFetch.ts';

interface AuditEvent {
  id: string;
  usuario: string;
  accion: string;
  recurso: string | null;
  resultado: string;
  ip: string | null;
  createdAt: string;
}

export default function AuditLogTab() {
  const [data, setData] = useState<AuditEvent[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogins(); }, []);

  async function fetchLogins() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroUsuario) params.set('usuario', filtroUsuario);
      params.set('limite', '100');
      const res = await authFetchJSON(`/api/audit/logins?${params}`);
      if (res.success) setData(res.data || []);
    } catch {} finally { setLoading(false); }
  }

  function formatDateTime(ts: string) {
    try { return new Date(ts).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  }

  const usuarios = [...new Set(data.map(e => e.usuario))];
  const failedLogins = data.filter(e => e.accion === 'login' && e.resultado === 'failure');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Historial de Inicios de Sesion</h3>
        </div>
        {failedLogins.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] font-bold text-rose-400">{failedLogins.length} fallidos</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input type="text" placeholder="Filtrar por usuario..." value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            className="w-full glass-input rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500" />
        </div>
        <motion.button onClick={fetchLogins} whileTap={{ scale: 0.95 }}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer">
          Filtrar
        </motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs">Sin actividad de inicio de sesion</div>
      ) : (
        <div className="space-y-1">
          {data.map(e => (
            <div key={e.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors ${
              e.resultado === 'failure' ? 'bg-rose-500/5 border border-rose-500/20' : 'bg-white/5 hover:bg-white/10'
            }`}>
              {e.accion === 'login' ? (
                e.resultado === 'success'
                  ? <LogIn className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{e.usuario}</span>
                  <span className={`font-semibold ${
                    e.accion === 'login' && e.resultado === 'success' ? 'text-emerald-400' :
                    e.accion === 'login' && e.resultado === 'failure' ? 'text-rose-400' :
                    'text-slate-400'
                  }`}>
                    {e.accion === 'login' ? (e.resultado === 'success' ? 'Ingreso' : 'Rechazado') : 'Salida'}
                  </span>
                  <span className="text-slate-500">{formatDateTime(e.createdAt)}</span>
                </div>
                {e.ip && <div className="text-[10px] text-slate-500 font-mono mt-0.5">IP: {e.ip}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
