import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { modalVariants, modalSpring } from '../lib/animations.ts';
import { Camera, X, CheckCircle, Square, AlertCircle } from 'lucide-react';
import { useNotif } from '../context/NotifContext';

interface Props {
  onClose: () => void;
  onFinish: (data: any) => Promise<any>;
  kmInicio: number;
  duracionSegundos: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function useCameraCapture() {
  const [photo, setPhoto] = useState<string | null>(null);
  
  const capturePhoto = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhoto(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const reset = () => setPhoto(null);
  return { photo, capturePhoto, reset };
}

export default function ModalFinalizarViaje({ onClose, onFinish, kmInicio, duracionSegundos }: Props) {
  const { showToast } = useNotif();
  const [kmFinal, setKmFinal] = useState('');
  const [combustibleLitros, setCombustibleLitros] = useState('');
  const [combustibleCosto, setCombustibleCosto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { photo, capturePhoto, reset } = useCameraCapture();
  const inputFileRef = useRef<HTMLInputElement>(null);
  
  const distanciaOdometro = kmFinal ? parseFloat(kmFinal) - kmInicio : 0;
  
  const handleSubmit = async () => {
    if (!photo) {
      showToast('Tomá una foto del odómetro final', 'warning');
      return;
    }
    
    if (!kmFinal || !combustibleCosto) {
      showToast('Completá todos los campos obligatorios', 'warning');
      return;
    }
    
    try {
      setSubmitting(true);
      const result = await onFinish({
        fotoOdometroFin: photo,
        kmFinal: parseFloat(kmFinal),
        combustibleLitros: combustibleLitros ? parseFloat(combustibleLitros) : undefined,
        combustibleCosto: parseFloat(combustibleCosto)
      });
      
      if (result.alertas && result.alertas.length > 0) {
        showToast(result.alertas[0].mensaje, 'warning');
      }
      
      onClose();
    } catch (error) {
      showToast('Error al finalizar viaje', 'error');
      setSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="glass-panel rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-white mb-4">Finalizar Viaje</h3>
        
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div><span className="text-slate-400">Duración:</span> {formatDuration(duracionSegundos)}</div>
            <div><span className="text-slate-400">Km inicial:</span> {kmInicio.toLocaleString()}</div>
          </div>
        </div>
        
        <input
          ref={inputFileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) capturePhoto(file);
          }}
        />
        
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Foto del odómetro (final) *</label>
          
          {!photo ? (
            <button
              type="button"
              onClick={() => inputFileRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition"
            >
              <Camera className="w-8 h-8 text-slate-500" />
              <span className="text-sm text-slate-400">Tomar foto</span>
            </button>
          ) : (
            <div className="relative">
              <img src={photo} alt="Odómetro final" className="w-full h-40 object-cover rounded-lg" />
              <button type="button" onClick={() => { reset(); inputFileRef.current?.click(); }} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Kilometraje final *</label>
          <input type="number" step="0.1" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} placeholder="Ej: 45668.7" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm" />
          {distanciaOdometro > 0 && (
            <p className="text-xs text-emerald-400 mt-1">Distancia: {distanciaOdometro.toFixed(1)} km</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Combustible (L)</label>
            <input type="number" step="0.1" value={combustibleLitros} onChange={(e) => setCombustibleLitros(e.target.value)} placeholder="15.5" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Costo (Gs) *</label>
            <input type="number" step="1000" value={combustibleCosto} onChange={(e) => setCombustibleCosto(e.target.value)} placeholder="85000" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm" />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-semibold transition-all cursor-pointer">Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={!photo || !kmFinal || !combustibleCosto || submitting} className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 border border-white/10 transition-all cursor-pointer">
            <CheckCircle className="w-4 h-4" /> Guardar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
