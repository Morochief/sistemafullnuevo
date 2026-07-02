/**
 * VehiculosStats - Cards con métricas clave de vehículos para Dashboard principal
 * Muestra: combustible total, gasto total, km totales, y alertas
 */

import React, { useMemo } from 'react';
import { Fuel, DollarSign, Gauge, AlertTriangle } from 'lucide-react';
import { RegistroVehiculo } from '../../types';

interface VehiculosStatsProps {
  registrosVehiculo: RegistroVehiculo[];
}

function formatGuaranies(value: number): string {
  return 'Gs. ' + Math.round(value).toLocaleString('es-PY');
}

export default function VehiculosStats({ registrosVehiculo }: VehiculosStatsProps) {
  
  const stats = useMemo(() => {
    const totalGasto = registrosVehiculo.reduce((acc, r) => 
      acc + r.total, 0
    );
    
    const totalKm = registrosVehiculo.reduce((acc, r) => 
      acc + r.distanciaOdometro, 0
    );
    
    const totalAlertas = registrosVehiculo.filter(r => 
      r.alertaDiscrepancia
    ).length;
    
    const promedioCostoPorKm = totalKm > 0 ? totalGasto / totalKm : 0;
    
    return {
      totalGasto,
      totalKm,
      totalAlertas,
      promedioCostoPorKm
    };
  }, [registrosVehiculo]);
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Card: Costo/km Promedio */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
            Costo/km Promedio
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatGuaranies(stats.promedioCostoPorKm)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            En {registrosVehiculo.length} {registrosVehiculo.length === 1 ? 'viaje' : 'viajes'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <Fuel className="w-6 h-6 text-cyan-400" />
        </div>
      </div>
      
      {/* Card: Gasto Total */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-blue-400">
            Gasto Total
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatGuaranies(stats.totalGasto)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            En {registrosVehiculo.length} {registrosVehiculo.length === 1 ? 'viaje' : 'viajes'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <DollarSign className="w-6 h-6 text-blue-400" />
        </div>
      </div>
      
      {/* Card: Kilómetros Totales */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-pink-400">
            Kilómetros
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.totalKm.toLocaleString('es-PY')} km
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.totalKm > 0 && stats.totalGasto > 0
              ? `${formatGuaranies(stats.totalGasto / stats.totalKm)}/km`
              : 'Sin datos'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center">
          <Gauge className="w-6 h-6 text-pink-400" />
        </div>
      </div>
      
      {/* Card: Alertas de Discrepancia */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-orange-400">
            Alertas
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.totalAlertas}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {registrosVehiculo.length > 0
              ? `${((stats.totalAlertas / registrosVehiculo.length) * 100).toFixed(0)}% del total`
              : 'Sin registros'}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          stats.totalAlertas > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'
        }`}>
          <AlertTriangle className={`w-6 h-6 ${
            stats.totalAlertas > 0 ? 'text-orange-400' : 'text-emerald-400'
          }`} />
        </div>
      </div>
      
    </div>
  );
}
