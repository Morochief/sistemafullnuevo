import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { modalVariants, modalSpring } from '../lib/animations.ts';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020617]/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="glass-panel p-6 rounded-3xl max-w-sm w-[90%] border border-white/10 shadow-2xl relative z-10 flex flex-col gap-4 text-center"
          >
            {/* Icon */}
            <div className="mx-auto p-3 rounded-full bg-white/5 border border-white/10">
              {type === 'danger' && <AlertTriangle className="w-6 h-6 text-rose-500 animate-pulse" />}
              {type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-500" />}
              {type === 'info' && <Info className="w-6 h-6 text-blue-500" />}
            </div>

            {/* Title & Message */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold transition-all cursor-pointer shadow-lg ${
                  type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                    : type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
