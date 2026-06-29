import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Shield, UserX, UserCheck, Key, ShieldAlert, Edit2, Trash2, ArrowLeft, Plus } from 'lucide-react';
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
  
  // Mode State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

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

  // Enter edit mode
  const startEdit = (u: AppUser) => {
    setEditingUser(u);
    setNombre(u.nombre);
    setUsername(u.username);
    setPassword(''); // Leave password blank unless updating
    setEmail(u.email || '');
    setRol(u.rol);
    setColaboradorId(u.colaboradorId || '');
  };

  // Exit edit mode
  const cancelEdit = () => {
    setEditingUser(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setEmail('');
    setRol('Operario');
    setColaboradorId('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !username || !rol) {
      showToast('Completá todos los campos obligatorios', 'warning');
      return;
    }

    // If creating, password is required
    if (!editingUser && !password) {
      showToast('La contraseña es obligatoria para nuevos usuarios', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      
      const endpoint = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const payload: any = {
        nombre,
        username,
        email: email || undefined,
        rol,
        colaboradorId: colaboradorId || undefined
      };

      // Only pass password if it was entered
      if (password) {
        payload.password = password;
      }

      const res = await authFetchJSON(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.success) {
        showToast(editingUser ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito', 'success');
        cancelEdit();
        fetchUsers();
      } else {
        showToast(res.error?.message || 'Error al procesar la solicitud', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de red', 'error');
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

  const handleHardDeleteUser = async (id: string, username: string) => {
    requestConfirm(
      `¿Eliminar permanentemente a ${username}?`,
      `Esta acción es irreversible y removerá el acceso de login físicamente.`,
      'danger',
      async () => {
        try {
          const res = await authFetchJSON(`/api/users/${id}?hard=true`, { method: 'DELETE' });
          if (res.success) {
            showToast(res.message || 'Usuario eliminado con éxito', 'success');
            fetchUsers();
            if (editingUser?.id === id) cancelEdit();
          } else {
            showToast(res.error?.message || 'Error al eliminar usuario', 'error');
          }
        } catch (err: any) {
          showToast(err.message || 'Error de red', 'error');
        }
      },
      'Eliminar'
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Create / Edit user form */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex-1 max-w-md h-fit relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
          
          <div className="flex items-center gap-2.5 mb-4 relative z-10">
            <div className={`p-2 rounded-xl border ${editingUser ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              {editingUser ? <Edit2 className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {editingUser ? 'Editar Acceso' : 'Crear Acceso de Login'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {editingUser ? `Modificando credenciales de @${editingUser.username}` : 'Asignar credenciales a un colaborador'}
              </p>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Nombre Completo *</label>
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
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Usuario (Login) *</label>
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
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  {editingUser ? 'Nueva Clave' : 'Contraseña *'}
                </label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder={editingUser ? 'Sin cambiar' : 'Min 8 chars, 1 num'} 
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                  required={!editingUser}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Correo Electrónico</label>
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
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Rol *</label>
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
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Colaborador</label>
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

            <div className="flex gap-2 pt-2">
              {editingUser && (
                <button 
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-3 border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Cancelar
                </button>
              )}
              <button 
                type="submit" 
                disabled={submitting}
                className={`flex-1 py-3 text-white font-bold rounded-xl text-sm border border-white/10 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
                  editingUser 
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                }`}
              >
                {editingUser 
                  ? (submitting ? 'Actualizando...' : 'Actualizar Acceso') 
                  : (submitting ? 'Creando Acceso...' : 'Crear Acceso')
                }
              </button>
            </div>
          </form>
        </div>

        {/* Users list */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-blue-500/5 pointer-events-none" />
          
          <h3 className="text-lg font-bold text-white mb-4 relative z-10 tracking-wide">Usuarios Registrados ({users.length})</h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 relative z-10">
              <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
              <span className="text-xs font-medium font-mono">Cargando cuentas...</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center py-12 text-sm relative z-10">No hay cuentas de usuario creadas.</p>
          ) : (
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1 relative z-10">
              {users.map(u => {
                const colabName = colaboradores.find(c => c.id === u.colaboradorId)?.nombre || 'Sin Vinculación';
                const isCurrentEdit = editingUser?.id === u.id;
                
                return (
                  <div 
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all flex justify-between items-center ${
                      isCurrentEdit
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : u.activo 
                        ? 'bg-white/5 border-white/5 hover:border-white/10' 
                        : 'bg-rose-500/5 border-rose-500/10 opacity-70'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
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

                    <div className="flex gap-2 shrink-0">
                      {/* Edit Button */}
                      <button
                        onClick={() => startEdit(u)}
                        className="p-2.5 rounded-xl border bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center"
                        title="Editar Usuario"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Deactivate/Activate Button */}
                      <button
                        onClick={() => handleToggleUserActive(u.id, u.activo, u.username)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                          u.activo
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                        title={u.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
                      >
                        {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>

                      {/* Hard Delete Button */}
                      <button
                        onClick={() => handleHardDeleteUser(u.id, u.username)}
                        className="p-2.5 rounded-xl border bg-rose-950/20 border-rose-500/25 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
