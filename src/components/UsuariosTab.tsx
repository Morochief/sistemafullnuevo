import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Shield, UserX, UserCheck, Key, ShieldAlert } from 'lucide-react';
import { Colaborador } from '../types.ts';
import { useNotif } from '../context/NotifContext.tsx';
import { authFetchJSON } from '../authFetch.ts';

interface Props {
  colaboradores: Colaborador[];
}

interface AppUser {
  id: string;
  username: string;
  nombre: string;
  email: string | null;
  rol: 'Admin' | 'Operario' | 'Visor';
  colaboradorId: string | null;
  activo: boolean;
  createdAt: string;
}

export default function UsuariosTab({ colaboradores }: Props) {
  const { showToast, requestConfirm } = useNotif();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<'Admin' | 'Operario' | 'Visor'>('Operario');
  const [colaboradorId, setColaboradorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authFetchJSON('/api/users');
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err: any) {
      showToast('Error al cargar usuarios: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !username || !password || !rol) {
      showToast('Completá todos los campos obligatorios', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await authFetchJSON('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          username,
          password,
          email: email || undefined,
          rol,
          colaboradorId: colaboradorId || undefined
        })
      });

      if (res.success) {
        showToast('Usuario creado con éxito', 'success');
        // Reset form
        setNombre('');
        setUsername('');
        setPassword('');
        setEmail('');
        setRol('Operario');
        setColaboradorId('');
        fetchUsers();
      } else {
        showToast(res.error?.message || 'Error al crear usuario', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de red al crear usuario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUserActive = async (id: string, active: boolean, username: string) => {
    const actionText = active ? 'desactivar' : 'activar';
    requestConfirm(
      `¿Confirmas ${actionText} a ${username}?`,
      `El usuario ya no podrá iniciar sesión en la plataforma.`,
      active ? 'danger' : 'info',
      async () => {
        try {
          const res = await authFetchJSON(`/api/users/${id}`, { method: 'DELETE' });
          if (res.success) {
            showToast(res.message || `Usuario actualizado con éxito`, 'success');
            fetchUsers();
          } else {
            showToast(res.error?.message || 'Error al actualizar usuario', 'error');
          }
        } catch (err: any) {
          showToast(err.message || 'Error de red', 'error');
        }
      },
      active ? 'Desactivar' : 'Activar'
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Create user form */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex-1 max-w-md h-fit">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">Crear Acceso de Login</h3>
              <p className="text-xs text-slate-500 font-medium">Asignar credenciales a un colaborador</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre Completo *</label>
              <input 
                type="text" 
                value={nombre} 
                onChange={e => setNombre(e.target.value)} 
                placeholder="Ej: Rodrigo Fernández" 
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Usuario (Login) *</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} 
                  placeholder="rodrigo" 
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña *</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Min 8 chars, 1 num" 
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Correo Electrónico (Opcional)</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="rodrigo@sistema.com" 
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rol *</label>
                <select 
                  value={rol} 
                  onChange={e => setRol(e.target.value as any)} 
                  className="glass-select w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="Operario">Operario</option>
                  <option value="Admin">Administrador</option>
                  <option value="Visor">Visor</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Colaborador Vinculado</label>
                <select 
                  value={colaboradorId} 
                  onChange={e => setColaboradorId(e.target.value)} 
                  className="glass-select w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Ninguno / Particular</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm border border-white/10 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? 'Creando Acceso...' : 'Crear Acceso de Login'}
            </button>
          </form>
        </div>

        {/* Users list */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex-1">
          <h3 className="text-lg font-bold text-white mb-4">Usuarios Registrados ({users.length})</h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
              <span className="text-xs font-medium font-mono">Cargando cuentas...</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center py-12 text-sm">No hay cuentas de usuario creadas.</p>
          ) : (
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {users.map(u => {
                const colabName = colaboradores.find(c => c.id === u.colaboradorId)?.nombre || 'Sin Vinculación';
                return (
                  <div 
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all flex justify-between items-center ${
                      u.activo 
                        ? 'bg-white/5 border-white/5 hover:border-white/10' 
                        : 'bg-rose-500/5 border-rose-500/10 opacity-70'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${u.activo ? 'text-white' : 'text-slate-400'}`}>{u.nombre}</span>
                        <span className="text-xs font-mono bg-white/5 text-slate-400 px-2 py-0.5 rounded-md border border-white/5">
                          @{u.username}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          u.rol === 'Admin' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : u.rol === 'Visor'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {u.rol}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Colaborador: <span className="font-semibold text-slate-300">{colabName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleUserActive(u.id, u.activo, u.username)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        u.activo
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={u.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
                    >
                      {u.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
