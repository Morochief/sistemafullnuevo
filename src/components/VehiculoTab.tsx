/**
 * VehiculoTab - Registro de viajes con GPS y foto del odómetro
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Camera,
  X,
  CheckCircle,
  Loader,
  Play,
  Square,
  Car,
  Gauge,
  Activity,
  Clock
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { authFetchJSON } from '../authFetch';
import ModalIniciarViaje from './ModalIniciarViaje';
import ModalFinalizarViaje from './ModalFinalizarViaje';
import { useNotif } from '../context/NotifContext';

interface VehiculoTabProps {
  selectedClienteId: string;
  selectedProyectoId: string;
  currentUser: { nombre: string; rol: string; usuario: string } | null;
  contextComplete: boolean;
  onRefresh?: () => Promise<void>;
}

// Opción especial para viajes sin proyecto
const VIAJE_SIN_PROYECTO = 'viaje_particular';

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

// ─── Image compression helper ───────────────────────────────────────────────
// Resize to max 1200px wide and compress to JPEG 75% — readable for odometer
// digits but ~70-80% smaller than a typical phone photo.
function compressImage(base64: string, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; } // fallback: return original if canvas unavailable
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // fallback on load error
    img.src = base64;
  });
}

// Hook para captura de foto con OCR
function useCameraCapture() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedKm, setExtractedKm] = useState<number | null>(null);
  
  const capturePhoto = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      // Compress before storing/sending — keeps odometer digits readable at ~70% smaller size
      const base64 = await compressImage(raw);
      setPhoto(base64);
      
      setIsProcessing(true);
      try {
        const { data } = await Tesseract.recognize(file, 'spa', {
          tessedit_char_whitelist: '0123456789.'
        });
        const kmMatch = data.text.match(/\d+\.?\d*/);
        const km = kmMatch ? parseFloat(kmMatch[0]) : null;
        setExtractedKm(km);
      } catch (error) {
        console.error('OCR failed:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);
  
  const reset = useCallback(() => {
    setPhoto(null);
    setExtractedKm(null);
    setIsProcessing(false);
  }, []);
  
  return { photo, extractedKm, isProcessing, capturePhoto, reset };
}

// Hook para GPS
function useGPS() {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const getCurrentLocation = useCallback(() => {
    return new Promise<{lat: number; lng: number}>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('GPS no disponible en este dispositivo');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(coords);
          resolve(coords);
        },
        (error) => {
          setError(error.message);
          reject(error.message);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  }, []);
  
  return { location, error, getCurrentLocation };
}

// Hook para viaje — hybrid persistence (localStorage + server, igual que useTimer)
function useViaje({ currentUser }: { currentUser: any }) {
  const viajePrefix = `afull_viaje_${currentUser?.usuario || 'guest'}`;
  const viajeKeyActivo    = `${viajePrefix}_activo`;
  const viajeKeyInicio    = `${viajePrefix}_inicio`;
  const viajeKeyKmInicio  = `${viajePrefix}_kmInicio`;
  const viajeKeyUbicacion = `${viajePrefix}_ubicacion`;

  // Layer 1 — localStorage (instant, survives refresh)
  const [viajeActivo, setViajeActivo] = useState<boolean>(() => {
    try { return localStorage.getItem(viajeKeyActivo) === 'true'; } catch { return false; }
  });
  const [ubicacionInicio, setUbicacionInicio] = useState<any>(() => {
    try { const s = localStorage.getItem(viajeKeyUbicacion); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [horaInicio, setHoraInicio] = useState<Date | null>(() => {
    try { const s = localStorage.getItem(viajeKeyInicio); return s ? new Date(s) : null; } catch { return null; }
  });
  const [kmInicio, setKmInicio] = useState<number | null>(() => {
    try { const s = localStorage.getItem(viajeKeyKmInicio); return s ? parseFloat(s) : null; } catch { return null; }
  });
  const [duracionSegundos, setDuracionSegundos] = useState(0);

  const { getCurrentLocation } = useGPS();

  // Sync localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem(viajeKeyActivo, String(viajeActivo));
      if (horaInicio) localStorage.setItem(viajeKeyInicio, horaInicio.toISOString());
      else localStorage.removeItem(viajeKeyInicio);
      if (kmInicio != null) localStorage.setItem(viajeKeyKmInicio, String(kmInicio));
      else localStorage.removeItem(viajeKeyKmInicio);
      if (ubicacionInicio) localStorage.setItem(viajeKeyUbicacion, JSON.stringify(ubicacionInicio));
      else localStorage.removeItem(viajeKeyUbicacion);
    } catch {}
  }, [viajeActivo, horaInicio, kmInicio, ubicacionInicio, viajeKeyActivo, viajeKeyInicio, viajeKeyKmInicio, viajeKeyUbicacion]);

  // Layer 2 — Server restore on mount
  useEffect(() => {
    if (!currentUser) return;
    const loadActiveViaje = async () => {
      try {
        const res = await authFetchJSON<{ success: boolean; data: any }>(`/api/viaje/active/${currentUser.usuario}`);
        if (res.success && res.data) {
          const serverViaje = res.data;
          const localStart = localStorage.getItem(viajeKeyInicio);
          const useServer = !localStart || new Date(serverViaje.inicio) >= new Date(localStart);
          if (useServer && serverViaje.activo) {
            setViajeActivo(true);
            setHoraInicio(new Date(serverViaje.inicio));
            setKmInicio(serverViaje.kmInicial);
            setUbicacionInicio(serverViaje.ubicacionInicio || null);
          }
        } else if (res.success && !res.data) {
          // No viaje activo en servidor — limpiar TODO el estado local incluyendo localStorage
          setViajeActivo(false);
          setHoraInicio(null);
          setKmInicio(null);
          setUbicacionInicio(null);
          try {
            localStorage.removeItem(viajeKeyActivo);
            localStorage.removeItem(viajeKeyInicio);
            localStorage.removeItem(viajeKeyKmInicio);
            localStorage.removeItem(viajeKeyUbicacion);
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load active viaje from server:', e);
      }
    };
    loadActiveViaje();
  }, [currentUser]);

  // Duration counter
  useEffect(() => {
    if (!viajeActivo || !horaInicio) return;
    const interval = setInterval(() => {
      setDuracionSegundos(Math.floor((new Date().getTime() - horaInicio.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [viajeActivo, horaInicio]);

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(viajeKeyActivo);
      localStorage.removeItem(viajeKeyInicio);
      localStorage.removeItem(viajeKeyKmInicio);
      localStorage.removeItem(viajeKeyUbicacion);
    } catch {}
  };

  const iniciarViaje = async (contextData: any) => {
    let coords = null;
    try { coords = await getCurrentLocation(); } catch {}
    const now = new Date();

    setUbicacionInicio(coords);
    setHoraInicio(now);
    setViajeActivo(true);
    setKmInicio(contextData.kmInicial);

    await authFetchJSON('/api/viaje/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: currentUser.usuario,
        ubicacionInicio: coords,
        ...contextData
      })
    });
  };

  const finalizarViaje = async (dataFin: any) => {
    let coordsFin = null;
    try { coordsFin = await getCurrentLocation(); } catch {}

    const response = await authFetchJSON('/api/viaje/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: currentUser.usuario,
        ubicacionFin: coordsFin,
        ...dataFin
      })
    });

    setViajeActivo(false);
    setHoraInicio(null);
    setKmInicio(null);
    setUbicacionInicio(null);
    setDuracionSegundos(0);
    clearLocalStorage();
    if (onRefresh && response?.success) await onRefresh();
    return response;
  };

  const cancelarViaje = async () => {
    await authFetchJSON('/api/viaje/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: currentUser.usuario })
    });
    setViajeActivo(false);
    setHoraInicio(null);
    setKmInicio(null);
    setUbicacionInicio(null);
    setDuracionSegundos(0);
    clearLocalStorage();
  };

  return {
    viajeActivo,
    ubicacionInicio,
    horaInicio,
    duracionSegundos,
    kmInicio,
    iniciarViaje,
    finalizarViaje,
    cancelarViaje,
    forceCleanState: () => {
      setViajeActivo(false);
      setHoraInicio(null);
      setKmInicio(null);
      setUbicacionInicio(null);
      setDuracionSegundos(0);
      clearLocalStorage();
    },
  };
}

export default function VehiculoTab({ selectedClienteId, selectedProyectoId, currentUser, contextComplete, onRefresh }: VehiculoTabProps) {
  const { requestConfirm } = useNotif();
  const {
    viajeActivo,
    horaInicio,
    duracionSegundos,
    kmInicio,
    iniciarViaje,
    finalizarViaje,
    cancelarViaje,
    forceCleanState,
  } = useViaje({ currentUser });

  const [mostrarModalInicio, setMostrarModalInicio] = useState(false);
  const [mostrarModalFin, setMostrarModalFin] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Car className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Registro de Viaje</h3>
      </div>

      {!viajeActivo ? (
        <div className="space-y-3">
          <button
            onClick={() => setMostrarModalInicio(true)}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <MapPin className="w-5 h-5" /> Iniciar Viaje
          </button>
          
          {!contextComplete && (
            <p className="text-xs text-amber-400 text-center">
              Tip: Podés iniciar un viaje sin proyecto (para uso personal)
            </p>
          )}</div>
      ) : (
        <div className="glass-panel rounded-xl p-6 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="font-semibold">Viaje en curso</span>
          </div>
          
          <div className="font-mono text-3xl text-white mb-4">
            {formatDuration(duracionSegundos)}
          </div>
          
          <div className="p-3 bg-white/5 rounded-lg text-sm space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span>Inicio: {horaInicio ? formatTime(horaInicio) : '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Gauge className="w-4 h-4" />
              <span>Km inicial: {kmInicio?.toLocaleString()}</span>
            </div>
          </div>
          
          <button
            onClick={() => setMostrarModalFin(true)}
            className="w-full mt-4 py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            <Square className="w-4 h-4" /> Finalizar Viaje
          </button>
          <button
            onClick={() => {
              requestConfirm(
                '¿Cancelar viaje?',
                'Los datos del viaje actual no serán guardados.',
                'warning',
                cancelarViaje,
                'Sí, cancelar'
              );
            }}
            className="w-full mt-2 py-2 px-6 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-sm flex items-center justify-center gap-2 transition"
          >
            <X className="w-4 h-4" /> Cancelar viaje (descartar)
          </button>
        </div>
      )}

      {mostrarModalInicio && (
        <ModalIniciarViaje
          onClose={() => setMostrarModalInicio(false)}
          onStart={iniciarViaje}
          selectedClienteId={selectedClienteId}
          selectedProyectoId={selectedProyectoId}
        />
      )}

      {mostrarModalFin && (
        <ModalFinalizarViaje
          onClose={() => setMostrarModalFin(false)}
          onFinish={finalizarViaje}
          kmInicio={kmInicio || 0}
          duracionSegundos={duracionSegundos}
        />
      )}
    </div>
  );
}
