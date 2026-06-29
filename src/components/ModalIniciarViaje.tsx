import React, { useState, useRef } from 'react';
import { Camera, X, CheckCircle, Loader, Play } from 'lucide-react';
import { useNotif } from '../context/NotifContext';

interface Props {
  onClose: () => void;
  onStart: (data: any) => Promise<void>;
  selectedClienteId: string;
  selectedProyectoId: string;
}

const VIAJE_SIN_PROYECTO = 'viaje_particular';

function compressImage(base64: string, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

function useCameraCapture() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedKm, setExtractedKm] = useState<number | null>(null);
  
  const capturePhoto = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const base64 = await compressImage(raw);
      setPhoto(base64);
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };
  
  const reset = () => {
    setPhoto(null);
    setExtractedKm(null);
    setIsProcessing(false);
  };
  
  return { photo, extractedKm, isProcessing, capturePhoto, reset };
}

export default function ModalIniciarViaje({ onClose, onStart, selectedClienteId, selectedProyectoId }: Props) {
  const { showToast } = useNotif();
  const [descripcion, setDescripcion] = useState('');
  const [kmManual, setKmManual] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [esViajeParticular, setEsViajeParticular] = useState(!selectedProyectoId);
  const { photo, extractedKm, isProcessing, capturePhoto, reset } = useCameraCapture();
  const inputFileRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = async () => {
    if (!photo) {
      showToast('Tomá una foto del odómetro para continuar', 'warning');
      return;
    }
    
    const kmFinal = kmManual ? parseFloat(kmManual) : extractedKm;
    if (!kmFinal) {
      showToast('Ingresá el kilometraje manualmente', 'warning');
      return;
    }
    
    if (!esViajeParticular && (!selectedClienteId || !selectedProyectoId)) {
      showToast('Selecioná un proyecto o marcá como viaje particular', 'warning');
      return;
    }
    
    try {
      setSubmitting(true);
      await onStart({
        clienteId: esViajeParticular ? VIAJE_SIN_PROYECTO : selectedClienteId,
        proyectoId: esViajeParticular ? VIAJE_SIN_PROYECTO : selectedProyectoId,
        descripcion: descripcion || (esViajeParticular ? 'Viaje particular/personal' : 'Viaje en vehículo'),
        fotoOdometroInicio: photo,
        kmInicial: kmFinal
      });
      
      onClose();
    } catch (error) {
      showToast('Error al iniciar viaje', 'error');
      setSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-4">Iniciar Viaje</h3>
        
        {/* Checkbox para viaje particular */}
        {(!selectedClienteId || !selectedProyectoId) && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esViajeParticular}
                onChange={(e) => setEsViajeParticular(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-amber-300">
                Viaje particular/personal (sin proyecto asociado)
              </span>
            </label>
          </div>
        )}
        
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
          <label className="block text-sm text-slate-400 mb-2">
            Foto del odómetro (inicio) *
          </label>
          
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
              <img src={photo} alt="Odómetro" className="w-full h-40 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => { reset(); inputFileRef.current?.click(); }}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">
            Kilometraje inicial *
          </label>
          <input
            type="number"
            step="0.1"
            value={kmManual || extractedKm || ''}
            onChange={(e) => setKmManual(e.target.value)}
            placeholder="Ej: 45623.5"
            className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Visita a cliente..."
            rows={2}
            className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg"
          />
        </div>
        
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 px-4 bg-slate-700 text-white rounded-lg">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!photo || (!kmManual && !extractedKm) || submitting}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}
