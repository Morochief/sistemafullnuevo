import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

// ─── Toast types ─────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Confirm types ────────────────────────────────────────────────────────────

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotifContextValue {
  showToast: (message: string, type?: ToastType) => void;
  requestConfirm: (
    title: string,
    message: string,
    type: 'danger' | 'warning' | 'info',
    onConfirm: () => void,
    confirmText?: string
  ) => void;
}

const NotifContext = createContext<NotifContextValue>({
  showToast: () => {},
  requestConfirm: () => {}
});

export function useNotif() {
  return useContext(NotifContext);
}

// ─── Toast icon helper ────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (type === 'error')   return <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let _idCounter = 0;

export function NotifProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {}
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_idCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const requestConfirm = useCallback((
    title: string,
    message: string,
    type: 'danger' | 'warning' | 'info',
    onConfirm: () => void,
    confirmText?: string
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <NotifContext.Provider value={{ showToast, requestConfirm }}>
      {children}

      {/* ── Toast Stack (bottom-right) ── */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl glass-panel border border-white/10 shadow-2xl max-w-xs w-full backdrop-blur-xl"
            >
              <ToastIcon type={t.type} />
              <p className="text-xs text-slate-200 leading-relaxed flex-1">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </NotifContext.Provider>
  );
}
