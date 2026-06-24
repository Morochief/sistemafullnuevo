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
  AlertCircle,
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

interface VehiculoTabProps {
  selectedClienteId: string;
  selectedProyectoId: string;
  currentUser: { nombre: string; rol: string; usuario: string } | null;
  contextComplete: boolean;
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

// Hook para captura de foto con OCR
function useCameraCapture() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedKm, setExtractedKm] = useState<number | null>(null);
  
  const capturePhoto = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
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
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);
  
  return { location, error, getCurrentLocation };
}

// Hook para viaje
function useViaje({ currentUser }: { currentUser: any }) {
  const [viajeActivo, setViajeActivo] = useState(false);
  const [ubicacionInicio, setUbicacionInicio] = useState<any>(null);
  const [horaInicio, setHoraInicio] = useState<Date | null>(null);
  const [duracionSegundos, setDuracionSegundos] = useState(0);
  const [kmInicio, setKmInicio] = useState<number | null>(null);
  
  const { getCurrentLocation } = useGPS();
  
  useEffect(() => {
    if (!viajeActivo || !horaInicio) return;
    
    const interval = setInterval(() => {
      const ahora = new Date();
      const segundos = Math.floor((ahora.getTime() - horaInicio.getTime()) / 1000);
      setDuracionSegundos(segundos);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [viajeActivo, horaInicio]);
  
  const iniciarViaje = async (contextData: any) => {
    try {
      const coords = await getCurrentLocation();
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
    } catch (error) {
      console.error('Error iniciando viaje:', error);
      throw error;
    }
  };
  
  const finalizarViaje = async (dataFin: any) => {
    try {
      const coordsFin = await getCurrentLocation();
      
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
      return response;
    } catch (error) {
      console.error('Error finalizando viaje:', error);
      throw error;
    }
  };
  
  return {
    viajeActivo,
    ubicacionInicio,
    horaInicio,
    duracionSegundos,
    kmInicio,
    iniciarViaje,
    finalizarViaje
  };
}

export default function VehiculoTab({ 
  selectedClienteId, 
  selectedProyectoId, 
  currentUser, 
  contextComplete 
}: VehiculoTabProps) {
  const {
    viajeActivo,
    horaInicio,
    duracionSegundos,
    kmInicio,
    iniciarViaje,
    finalizarViaje
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
