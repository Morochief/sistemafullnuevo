# Plan Técnico: Detección Automática de Kilometraje y Consumo de Vehículo

## Resumen Ejecutivo

Este documento detalla la implementación de funcionalidad de **tracking de vehículos** para registrar automáticamente kilometraje y consumo de combustible en el módulo "Registro Operativo" existente. Se recomienda un enfoque **MVP híbrido manual-GPS** que reutiliza el patrón de timer existente, con opción de expansión futura a geocerca automática.

**Tiempo estimado MVP:** 2-3 semanas
**Complejidad:** Media
**Impacto:** Alto - reduce fricción operativa y mejora precisión de costos

---

## 1. ANÁLISIS DE OPCIONES

### Tabla Comparativa

| Criterio | **Opción A: Manual + GPS** | **Opción B: Geocerca Automática** | **Opción C: OBD-II Bluetooth** |
|----------|----------------------------|-----------------------------------|-------------------------------|
| **Complejidad** | 🟢 Baja | 🟡 Media-Alta | 🔴 Alta |
| **Hardware** | Ninguno (móvil) | Ninguno (móvil) | Dispositivo OBD-II ($20-80) |
| **Precisión KM** | GPS navegador (±10-50m) | GPS navegador (±10-50m) | Odómetro del vehículo (exacto) |
| **Fricción Usuario** | Click manual inicio/fin | Automático (pero necesita config) | Automático + pareado BT |
| **Consumo Batería** | Bajo (solo al capturar) | Medio-Alto (monitoreo continuo) | Bajo (BT LE) |
| **Offline** | ✅ Sí (caché + sync) | ⚠️ Parcial (necesita GPS activo) | ✅ Sí (si OBD-II tiene memoria) |
| **Costo Adicional** | $0 | $0 | $20-80 por vehículo |
| **Tiempo Impl.** | 2-3 semanas | 4-6 semanas | 6-8 semanas |
| **Mantenimiento** | Bajo | Medio (calibración geocercas) | Alto (soporte dispositivos) |
| **Escalabilidad** | Excelente | Buena | Limitada (por modelo de vehículo) |


### Opción A: Manual con Asistencia GPS (RECOMENDADA MVP)

#### ✅ Ventajas
- **Simplicidad:** Reutiliza patrón de timer existente (useTimer hook)
- **Sin hardware:** Usa GPS del navegador (API estándar HTML5)
- **Control del usuario:** Técnico decide cuándo inicia/termina el viaje
- **Offline-first:** Funciona igual que el timer actual (localStorage + sync)
- **Costo cero:** No requiere dispositivos adicionales
- **Compatibilidad:** Android/iOS/cualquier navegador moderno

#### ❌ Desventajas
- **Fricción manual:** Usuario debe recordar iniciar/detener
- **Precisión GPS:** ±10-50m según condiciones (suficiente para viajes largos)
- **No detecta olvidos:** Si el técnico olvida iniciar, no hay registro

#### 🛠️ Complejidad Técnica: **BAJA**
- Reutilización de 80% del código del timer
- API Geolocation estándar (ya disponible en navegadores)
- Sin dependencias externas complejas

#### 📦 Dependencias
- Geolocation API (navegador)
- OpenStreetMap Nominatim (reversa geocoding - opcional)
- Leaflet.js (mapas - opcional para visualización)

#### 💰 Costo: **$0**
#### ⏱️ Tiempo: **2-3 semanas**

---

### Opción B: Geocerca Automática

#### ✅ Ventajas
- **Automático:** Detecta entrada/salida de zona sin intervención
- **Sin olvidos:** Sistema registra todos los viajes
- **Datos enriquecidos:** Puede capturar ruta completa (GeoJSON)

#### ❌ Desventajas
- **Configuración inicial:** Cada cliente/obra necesita definir geocerca
- **Consumo batería:** Monitoreo GPS continuo drena batería móvil
- **Falsos positivos:** Puede detectar viajes no laborales cercanos
- **Complejidad:** Necesita service worker + background geolocation
- **Permisos:** Requiere "background location" (iOS restrictivo)

#### 🛠️ Complejidad Técnica: **MEDIA-ALTA**
- Service Worker para monitoreo background
- Algoritmo de detección entrada/salida de polígono
- Manejo de estados edge (GPS perdido, recarga app)

#### 📦 Dependencias
- Turf.js (cálculo geoespacial - point in polygon)
- Background Geolocation API (limitada en navegadores)
- PWA Service Worker

#### 💰 Costo: **$0** (software)
#### ⏱️ Tiempo: **4-6 semanas**


---

### Opción C: Integración OBD-II Bluetooth

#### ✅ Ventajas
- **Precisión exacta:** Lee odómetro real del vehículo
- **Datos ricos:** Consumo combustible, RPM, velocidad, temperatura
- **Automático:** Una vez pareado, captura datos sin intervención
- **Mantenimiento predictivo:** Detecta códigos de error del vehículo

#### ❌ Desventajas
- **Hardware requerido:** Dispositivo OBD-II por vehículo ($20-80)
- **Compatibilidad:** Solo vehículos post-1996 (EEUU) / post-2001 (Europa/Latam)
- **Pareado BT:** Usuario debe conectar dispositivo manualmente
- **Fragmentación:** Protocolos varían por marca/modelo de vehículo
- **Soporte técnico:** Equipo debe debuggear problemas de hardware
- **Web Bluetooth API:** Soporte limitado (Chrome/Edge, no Safari iOS)

#### 🛠️ Complejidad Técnica: **ALTA**
- Web Bluetooth API (experimental en algunos navegadores)
- Parseo de protocolos OBD-II (ELM327, ISO 15765-4, etc.)
- Manejo de timeouts, reconexiones, múltiples dispositivos

#### 📦 Dependencias
- Dispositivo OBD-II Bluetooth (ej: ELM327 compatible)
- Web Bluetooth API
- Librería OBD-II parser (ej: `obd-parser-serial-connection`)

#### 💰 Costo: **$20-80 por vehículo** (hardware)
#### ⏱️ Tiempo: **6-8 semanas**

---

## 2. RECOMENDACIÓN: Opción A (MVP) con Roadmap a Opción B

### Justificación

**Fase 1 (MVP - 2-3 semanas):** Implementar **Opción A** por:
- ✅ Reutiliza arquitectura probada (timer híbrido)
- ✅ Cero costo de hardware
- ✅ Rápido time-to-market
- ✅ Valida caso de uso real con usuarios

**Fase 2 (Expansión - 3-4 meses):** Migrar a **Opción B** si:
- ✔️ Usuarios adoptan Fase 1 exitosamente (>70% registros)
- ✔️ Se detectan >20% de olvidos manuales
- ✔️ Hay presupuesto para desarrollo adicional

**¿Por qué NO Opción C inmediatamente?**
- ❌ Inversión hardware sin validación de demanda
- ❌ Soporte técnico complejo para equipo pequeño
- ❌ Compatibilidad limitada (Safari iOS = 40% usuarios móviles)


---

## 3. DISEÑO DE UI/UX

### Decisión: Nuevo Tab "Vehículo" dentro de Registro Operativo

**Patrón actual:** RegistroOperativo.tsx tiene tabs "Mano de Obra" | "Insumos"

**Propuesta:** Agregar tercer tab "Vehículo" usando el sistema de **Compound Components** existente:

```
┌─────────────────────────────────────────────────────┐
│ Registro Operativo                                  │
├─────────────────────────────────────────────────────┤
│ Paso 1: Contexto del Registro [✓ Completo]        │
│ [Cliente: Empresa 1] [Proyecto: Ploteo] [Fecha]   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Paso 2: Seleccioná tipo de registro                │
├─────────────────────────────────────────────────────┤
│ [ Mano de Obra ] [ Insumos ] [🚗 Vehículo]        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🚗 Registro de Viaje en Vehículo                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Seleccionar Vehículo ▼]                           │
│  ○ Ford Ranger ABC-123 (12.5 km/L)                 │
│  ○ Fiat Ducato XYZ-789 (8.0 km/L)                  │
│                                                     │
│ ┌─────────────────────────────────────────┐        │
│ │  TIMER VIAJE: 00:00:00                  │        │
│ │  Distancia estimada: -- km              │        │
│ │  Consumo estimado: -- L                 │        │
│ │                                          │        │
│ │  📍 Ubicación inicial: (pendiente)      │        │
│ │  🎯 Ubicación final: (pendiente)        │        │
│ │                                          │        │
│ │  [▶ Iniciar Viaje]                      │        │
│ └─────────────────────────────────────────┘        │
│                                                     │
│ Notas del viaje (opcional):                        │
│ [_________________________________]                 │
│                                                     │
│ Costo combustible: Gs. 0                           │
│                                                     │
│        [Cancelar]      [📌 Registrar Viaje]        │
└─────────────────────────────────────────────────────┘
```

### Flujo de Usuario (UX Completo)

#### Caso 1: Viaje Exitoso
```
1. Técnico abre "Registro Operativo"
2. Selecciona Cliente + Proyecto (contexto requerido)
3. Click en tab "Vehículo"
4. Selecciona vehículo de lista (ej: "Ford Ranger ABC-123")
5. Click "▶ Iniciar Viaje"
   → Navegador solicita permiso de ubicación
   → Captura GPS inicial + timestamp
   → Timer empieza a correr (igual que timer MO)
6. Técnico conduce a obra
7. Al llegar, click "■ Finalizar Viaje"
   → Captura GPS final + timestamp
   → Calcula distancia (Haversine)
   → Estima consumo (distancia / eficiencia del vehículo)
8. Review de datos:
   - Distancia: 23.4 km
   - Tiempo: 00:32:15
   - Consumo estimado: 1.87 L
   - Costo: Gs. 10,450 (precio combustible configurado)
9. Click "Registrar Viaje"
   → Guarda en database.json
   → Resetea timer
```


#### Caso 2: Pausa Durante el Viaje
```
1-6. (igual que Caso 1)
7. Técnico hace parada intermedia (ej: cargar combustible)
8. Click "⏸ Pausar Viaje"
   → Timer se pausa (NO captura GPS aún)
   → Registro de pausa = { inicio: timestamp, fin: null }
9. Después de 10 minutos, click "▶ Reanudar Viaje"
   → Timer continúa
   → Pausa se cierra: { inicio: X, fin: Y, duracion: 600s }
10. Click "■ Finalizar Viaje"
    → Calcula distancia NETA (considerando pausas para cálculo de velocidad promedio)
```

#### Caso 3: Sin Permiso de GPS
```
1-4. (igual que Caso 1)
5. Click "▶ Iniciar Viaje"
   → Navegador solicita permiso de ubicación
   → Usuario RECHAZA permiso
   ⚠️ Modal de error:
      "GPS necesario para registrar viajes"
      "Activá permisos de ubicación en configuración"
      [Cerrar] [Ir a Configuración]
6. Usuario puede:
   - Activar GPS y reintentar
   - Cancelar y usar Mano de Obra/Insumos normalmente
```

#### Caso 4: GPS Perdido Durante Viaje
```
1-6. (igual que Caso 1)
7. Durante el viaje, el GPS se pierde (túnel, zona sin señal)
8. Al finalizar viaje:
   → Sistema usa ÚLTIMA ubicación conocida
   → Muestra advertencia:
      "⚠️ Señal GPS intermitente - distancia aproximada"
   → Permite edición manual de KM antes de registrar
```

### Mockup ASCII del Componente

```
┌─────────────────────────────────────────────────────────────┐
│ 🚗 VIAJE ACTIVO                                            │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Ford Ranger ABC-123                        [■ Finalizar]││
│ │                                            [⏸ Pausar]   ││
│ ├─────────────────────────────────────────────────────────┤│
│ │ ⏱️  Tiempo transcurrido:    01:23:45                    ││
│ │ 📍 Distancia (en tiempo real): ~34.2 km                 ││
│ │ ⛽ Consumo estimado:        ~2.74 L                     ││
│ │ 💰 Costo estimado:          Gs. 15,300                  ││
│ ├─────────────────────────────────────────────────────────┤│
│ │ Inicio:  Av. España 1234, Asunción                      ││
│ │ Actual:  (actualizando...)                              ││
│ │                                                          ││
│ │ Pausas: 1 (total 5 min)                                 ││
│ │   • 10:34-10:39 — Parada combustible                    ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Estados Visuales

| Estado | Color | Icono | Badge |
|--------|-------|-------|-------|
| Sin iniciar | Gris | 🚗 | - |
| Activo | Verde | ▶️ | "EN CURSO" |
| Pausado | Amarillo | ⏸️ | "PAUSADO 5min" |
| Finalizado | Azul | ✓ | "LISTO" |
| Error GPS | Rojo | ⚠️ | "GPS PERDIDO" |


---

## 4. MODELO DE DATOS

### Opción Elegida: Nueva Entidad `ViajesVehiculo` + Extend `RegistroItem`

**Decisión:** Crear tabla separada `ViajesVehiculo` para datos específicos de GPS/ruta, y agregar `concepto: 'Vehiculo'` a `RegistroItem` para mantener consistencia contable.

### 4.1 Nueva Entidad: `Vehiculo`

```typescript
// src/types.ts
export interface Vehiculo {
  id: string;
  patente: string; // "ABC-123"
  marca: string; // "Ford"
  modelo: string; // "Ranger XLT"
  anio?: number; // 2020
  eficienciaKmL: number; // 12.5 (km por litro)
  estado: 'Activo' | 'Mantenimiento' | 'Inactivo';
  notas?: string;
}
```

### 4.2 Nueva Entidad: `ViajeVehiculo`

```typescript
// src/types.ts
export interface ViajeVehiculo {
  id: string;
  vehiculoId: string;
  usuarioId: string; // Usuario que condujo
  clienteId: string;
  proyectoId: string;
  fecha: string; // YYYY-MM-DD
  
  // Timestamps
  inicio: string; // ISO timestamp
  fin: string | null; // ISO timestamp (null si activo)
  duracionSegundos: number; // Tiempo total (sin pausas)
  
  // Geolocalización
  ubicacionInicio: GeoPoint;
  ubicacionFin: GeoPoint | null;
  distanciaKm: number; // Calculada (Haversine)
  
  // Consumo
  consumoLitros: number; // distanciaKm / eficienciaKmL
  precioCombustiblePorLitro: number; // Configurado en sistema
  costoTotal: number; // consumoLitros * precioCombustiblePorLitro
  
  // Pausas (reutiliza estructura del timer)
  pausedTime: number; // Total acumulado en segundos
  pauseHistory: PauseRecord[];
  isPaused: boolean;
  currentPauseStart?: string;
  
  // Opcional
  ruta?: GeoJSON; // Para Fase 2 (tracking continuo)
  notas?: string;
  
  // Estado
  activo: boolean; // true = viaje en curso
  registroId?: string; // Link a RegistroItem cuando se finaliza
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number; // Precisión en metros (del GPS)
  timestamp: string; // ISO timestamp de captura
  direccion?: string; // Geocoding reverso (opcional)
}
```

### 4.3 Extensión de `RegistroItem`

```typescript
// src/types.ts
export interface RegistroItem {
  // ... campos existentes
  concepto: 'MO' | 'Insumo' | 'Otros' | 'Vehiculo'; // ← NUEVO valor
  
  // Campos específicos para Vehiculo
  vehiculoId?: string;
  viajeId?: string; // Referencia a ViajeVehiculo
  distanciaKm?: number;
  consumoLitros?: number;
}
```

### 4.4 Actualización de `DatabaseState`

```typescript
// src/types.ts
export interface DatabaseState {
  clientes: Cliente[];
  proyectos: Proyecto[];
  colaboradores: Colaborador[];
  registros: RegistroItem[];
  timersActivos: TimerActivo[];
  
  // NUEVO
  vehiculos: Vehiculo[];
  viajesActivos: ViajeVehiculo[];
}
```


### 4.5 Ejemplo de Datos

#### Vehiculos en database.json
```json
{
  "vehiculos": [
    {
      "id": "veh_1",
      "patente": "ABC-123",
      "marca": "Ford",
      "modelo": "Ranger XLT",
      "anio": 2020,
      "eficienciaKmL": 12.5,
      "estado": "Activo",
      "notas": "Vehículo de ploteo grande"
    },
    {
      "id": "veh_2",
      "patente": "XYZ-789",
      "marca": "Fiat",
      "modelo": "Ducato Cargo",
      "anio": 2018,
      "eficienciaKmL": 8.0,
      "estado": "Activo"
    }
  ]
}
```

#### Viaje Activo en viajesActivos
```json
{
  "viajesActivos": [
    {
      "id": "viaje_abc123",
      "vehiculoId": "veh_1",
      "usuarioId": "user_demo",
      "clienteId": "cli_1",
      "proyectoId": "pro_1",
      "fecha": "2026-12-15",
      "inicio": "2026-12-15T08:30:00.000Z",
      "fin": null,
      "duracionSegundos": 1856,
      "ubicacionInicio": {
        "lat": -25.296389,
        "lng": -57.633611,
        "accuracy": 12.5,
        "timestamp": "2026-12-15T08:30:00.000Z",
        "direccion": "Av. España 1234, Asunción"
      },
      "ubicacionFin": null,
      "distanciaKm": 0,
      "consumoLitros": 0,
      "precioCombustiblePorLitro": 5600,
      "costoTotal": 0,
      "pausedTime": 0,
      "pauseHistory": [],
      "isPaused": false,
      "activo": true
    }
  ]
}
```

#### Viaje Finalizado → RegistroItem
```json
{
  "registros": [
    {
      "id": "reg_viaje_001",
      "clienteId": "cli_1",
      "clienteNombre": "Empresa 1 S.A.",
      "proyectoId": "pro_1",
      "proyectoNombre": "Ploteo de 2 Freezers",
      "fecha": "2026-12-15",
      "concepto": "Vehiculo",
      "descripcion": "Viaje Ford Ranger ABC-123 → Obra en San Lorenzo",
      "vehiculoId": "veh_1",
      "viajeId": "viaje_abc123",
      "distanciaKm": 23.4,
      "consumoLitros": 1.87,
      "cantidad": 23.4,
      "precioUnitario": 5600,
      "total": 10472,
      "origen": "Manual",
      "fechaImportacion": "2026-12-15"
    }
  ]
}
```


---

## 5. ARQUITECTURA TÉCNICA

### 5.1 Frontend: Custom Hook `useViajeVehiculo`

**Patrón:** Reutilizar lógica de `useTimer` con adaptaciones para GPS

```typescript
// src/hooks/useViajeVehiculo.ts
interface UseViajeOptions {
  currentUser: { usuario: string } | null;
  precioCombustiblePorLitro: number; // Configuración global
}

interface ViajeState {
  viajeActivo: ViajeVehiculo | null;
  duracionSegundos: number;
  distanciaKm: number;
  consumoLitros: number;
  costoTotal: number;
  isPaused: boolean;
  gpsError: string | null;
}

function useViajeVehiculo({ currentUser, precioCombustiblePorLitro }: UseViajeOptions) {
  const [state, setState] = useState<ViajeState>({
    viajeActivo: null,
    duracionSegundos: 0,
    distanciaKm: 0,
    consumoLitros: 0,
    costoTotal: 0,
    isPaused: false,
    gpsError: null
  });

  // Timer effect (igual que useTimer)
  useEffect(() => {
    if (state.viajeActivo && !state.isPaused) {
      const interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          duracionSegundos: prev.duracionSegundos + 1
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.viajeActivo, state.isPaused]);

  // Sync con servidor cada 30 segundos
  useEffect(() => {
    if (!state.viajeActivo || !currentUser) return;
    
    const syncInterval = setInterval(async () => {
      await authFetchJSON('/api/viaje/sync', {
        method: 'POST',
        body: JSON.stringify({
          usuario: currentUser.usuario,
          duracionSegundos: state.duracionSegundos
        })
      });
    }, 30000);
    
    return () => clearInterval(syncInterval);
  }, [state.viajeActivo, state.duracionSegundos]);

  const handleStartViaje = async (data: {
    vehiculoId: string;
    clienteId: string;
    proyectoId: string;
    eficienciaKmL: number;
  }) => {
    try {
      // Solicitar permiso GPS
      const position = await getCurrentPosition();
      
      const ubicacionInicio: GeoPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      // Llamada al servidor
      const response = await authFetchJSON<{ success: boolean; data: ViajeVehiculo }>(
        '/api/viaje/start',
        {
          method: 'POST',
          body: JSON.stringify({
            usuario: currentUser?.usuario,
            vehiculoId: data.vehiculoId,
            clienteId: data.clienteId,
            proyectoId: data.proyectoId,
            ubicacionInicio,
            precioCombustiblePorLitro
          })
        }
      );

      if (response.success) {
        setState(prev => ({
          ...prev,
          viajeActivo: response.data,
          duracionSegundos: 0,
          gpsError: null
        }));
        
        // Persistir en localStorage (híbrido)
        localStorage.setItem('viaje_activo', JSON.stringify(response.data));
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, gpsError: error.message }));
    }
  };

  const handleStopViaje = async () => {
    if (!state.viajeActivo) return;

    try {
      // Capturar GPS final
      const position = await getCurrentPosition();
      
      const ubicacionFin: GeoPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      // Calcular distancia (Haversine)
      const distancia = calculateDistance(
        state.viajeActivo.ubicacionInicio,
        ubicacionFin
      );

      const response = await authFetchJSON<{ success: boolean; data: ViajeVehiculo }>(
        '/api/viaje/stop',
        {
          method: 'POST',
          body: JSON.stringify({
            usuario: currentUser?.usuario,
            ubicacionFin,
            distanciaKm: distancia
          })
        }
      );

      if (response.success) {
        setState({
          viajeActivo: null,
          duracionSegundos: 0,
          distanciaKm: response.data.distanciaKm,
          consumoLitros: response.data.consumoLitros,
          costoTotal: response.data.costoTotal,
          isPaused: false,
          gpsError: null
        });
        
        localStorage.removeItem('viaje_activo');
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, gpsError: error.message }));
    }
  };

  // Pausar/Reanudar (idéntico a useTimer)
  const handlePauseViaje = async () => { /* ... */ };
  const handleResumeViaje = async () => { /* ... */ };

  return {
    ...state,
    handleStartViaje,
    handleStopViaje,
    handlePauseViaje,
    handleResumeViaje
  };
}

// Helper: Obtener posición GPS
async function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS no disponible en este navegador'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Permiso de ubicación denegado'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Ubicación no disponible'));
            break;
          case error.TIMEOUT:
            reject(new Error('Timeout al obtener ubicación'));
            break;
          default:
            reject(new Error('Error desconocido de GPS'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Helper: Calcular distancia Haversine
function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
    Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```


### 5.2 Backend: Endpoints del Servidor

#### POST /api/viaje/start
```typescript
// server.ts
import { z } from 'zod';

const ViajeStartSchema = z.object({
  usuario: z.string(),
  vehiculoId: z.string(),
  clienteId: z.string(),
  proyectoId: z.string(),
  ubicacionInicio: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string()
  }),
  precioCombustiblePorLitro: z.number()
});

app.post('/api/viaje/start', requireAuth, async (req, res) => {
  const validation = validateSchema(ViajeStartSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' }
    });
  }

  const data = validation.data!;
  const userPayload = req.user!;

  try {
    // Validar que no haya viaje activo
    const dbData = readDb();
    const viajeActivo = dbData.viajesActivos.find(
      v => v.usuarioId === userPayload.usuario && v.activo
    );

    if (viajeActivo) {
      return res.status(409).json({
        success: false,
        error: { code: 'VIAJE_ACTIVO', message: 'Ya tenés un viaje activo' }
      });
    }

    // Crear nuevo viaje
    const nuevoViaje: ViajeVehiculo = {
      id: generateId('viaje'),
      vehiculoId: data.vehiculoId,
      usuarioId: userPayload.usuario,
      clienteId: data.clienteId,
      proyectoId: data.proyectoId,
      fecha: new Date().toISOString().substring(0, 10),
      inicio: new Date().toISOString(),
      fin: null,
      duracionSegundos: 0,
      ubicacionInicio: data.ubicacionInicio,
      ubicacionFin: null,
      distanciaKm: 0,
      consumoLitros: 0,
      precioCombustiblePorLitro: data.precioCombustiblePorLitro,
      costoTotal: 0,
      pausedTime: 0,
      pauseHistory: [],
      isPaused: false,
      activo: true
    };

    const newState = await updateDbSafe(db => {
      db.viajesActivos.push(nuevoViaje);
      return db;
    });

    // Audit log
    auditLog({
      usuario: userPayload.usuario,
      accion: 'start_viaje',
      recurso: `/api/viaje/${nuevoViaje.id}`,
      resultado: 'success',
      ip: getClientIp(req)
    });

    res.status(201).json({
      success: true,
      data: nuevoViaje
    });
  } catch (error: any) {
    logger.error('Error starting viaje:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al iniciar viaje' }
    });
  }
});
```

#### POST /api/viaje/stop
```typescript
const ViajeStopSchema = z.object({
  usuario: z.string(),
  ubicacionFin: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string()
  }),
  distanciaKm: z.number()
});

app.post('/api/viaje/stop', requireAuth, async (req, res) => {
  const validation = validateSchema(ViajeStopSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' }
    });
  }

  const data = validation.data!;
  const userPayload = req.user!;

  try {
    const dbData = readDb();
    const viajeIndex = dbData.viajesActivos.findIndex(
      v => v.usuarioId === userPayload.usuario && v.activo
    );

    if (viajeIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_VIAJE_ACTIVO', message: 'No hay viaje activo' }
      });
    }

    const viaje = dbData.viajesActivos[viajeIndex];

    // Cerrar viaje
    const fin = new Date();
    const duracionTotal = Math.floor(
      (fin.getTime() - new Date(viaje.inicio).getTime()) / 1000
    );
    const duracionNeta = duracionTotal - (viaje.pausedTime || 0);

    // Obtener eficiencia del vehículo
    const vehiculo = dbData.vehiculos.find(v => v.id === viaje.vehiculoId);
    const eficienciaKmL = vehiculo?.eficienciaKmL || 10; // Default

    const consumoLitros = parseFloat((data.distanciaKm / eficienciaKmL).toFixed(2));
    const costoTotal = Math.round(consumoLitros * viaje.precioCombustiblePorLitro);

    const viajeCompleto: ViajeVehiculo = {
      ...viaje,
      fin: fin.toISOString(),
      duracionSegundos: duracionNeta,
      ubicacionFin: data.ubicacionFin,
      distanciaKm: data.distanciaKm,
      consumoLitros,
      costoTotal,
      activo: false
    };

    // Crear RegistroItem asociado
    const cliente = dbData.clientes.find(c => c.id === viaje.clienteId);
    const proyecto = dbData.proyectos.find(p => p.id === viaje.proyectoId);

    const nuevoRegistro: RegistroItem = {
      id: generateId('reg'),
      clienteId: viaje.clienteId,
      clienteNombre: cliente?.nombre || 'Desconocido',
      proyectoId: viaje.proyectoId,
      proyectoNombre: proyecto?.nombre || 'Desconocido',
      fecha: viaje.fecha,
      concepto: 'Vehiculo',
      descripcion: `Viaje ${vehiculo?.marca} ${vehiculo?.patente} - ${data.distanciaKm.toFixed(1)} km`,
      vehiculoId: viaje.vehiculoId,
      viajeId: viaje.id,
      distanciaKm: data.distanciaKm,
      consumoLitros,
      cantidad: data.distanciaKm,
      precioUnitario: viaje.precioCombustiblePorLitro,
      total: costoTotal,
      origen: 'Manual',
      fechaImportacion: new Date().toISOString().substring(0, 10)
    };

    const newState = await updateDbSafe(db => {
      // Remover de viajesActivos
      db.viajesActivos.splice(viajeIndex, 1);
      // Agregar registro
      db.registros.unshift(nuevoRegistro);
      return db;
    });

    // Audit log
    auditLog({
      usuario: userPayload.usuario,
      accion: 'stop_viaje',
      recurso: `/api/viaje/${viaje.id}`,
      resultado: 'success',
      ip: getClientIp(req),
      detalle: `${data.distanciaKm} km, ${consumoLitros} L`
    });

    res.json({
      success: true,
      data: viajeCompleto,
      registro: nuevoRegistro
    });
  } catch (error: any) {
    logger.error('Error stopping viaje:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al finalizar viaje' }
    });
  }
});
```


#### POST /api/viaje/sync (Sincronización periódica)
```typescript
const ViajeSyncSchema = z.object({
  usuario: z.string(),
  duracionSegundos: z.number()
});

app.post('/api/viaje/sync', requireAuth, async (req, res) => {
  const validation = validateSchema(ViajeSyncSchema, req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' }
    });
  }

  const { usuario, duracionSegundos } = validation.data!;
  const userPayload = req.user!;

  try {
    const dbData = readDb();
    const viaje = dbData.viajesActivos.find(
      v => v.usuarioId === userPayload.usuario && v.activo
    );

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_VIAJE_ACTIVO', message: 'No hay viaje activo' }
      });
    }

    // Solo actualizar timestamp (no modificar datos críticos)
    const newState = await updateDbSafe(db => {
      const v = db.viajesActivos.find(v => v.id === viaje.id);
      if (v) {
        v.duracionSegundos = duracionSegundos;
      }
      return db;
    });

    res.json({
      success: true,
      data: viaje
    });
  } catch (error: any) {
    logger.error('Error syncing viaje:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al sincronizar viaje' }
    });
  }
});
```

#### GET /api/viaje/active/:usuario (Recuperar viaje activo)
```typescript
app.get('/api/viaje/active/:usuario', requireAuth, async (req, res) => {
  const { usuario } = req.params;
  const userPayload = req.user!;

  // SECURITY: Solo puede ver su propio viaje (o Admin)
  if (userPayload.usuario !== usuario && userPayload.rol !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No autorizado' }
    });
  }

  try {
    const dbData = readDb();
    const viaje = dbData.viajesActivos.find(
      v => v.usuarioId === usuario && v.activo
    );

    res.json({
      success: true,
      data: viaje || null
    });
  } catch (error: any) {
    logger.error('Error getting active viaje:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al obtener viaje' }
    });
  }
});
```

#### POST /api/viaje/pause y POST /api/viaje/resume
```typescript
// Idéntico a /api/timer/pause y /api/timer/resume
// Reutilizar lógica de PauseRecord
```


### 5.3 Dependencias y Librerías

#### Frontend
```json
{
  "dependencies": {
    // YA INSTALADAS
    "react": "^18.x",
    "framer-motion": "^11.x",
    "lucide-react": "^0.x",
    
    // NUEVAS (opcional - Fase 2)
    "leaflet": "^1.9.4",              // Mapas interactivos
    "react-leaflet": "^4.2.1",        // Wrapper React para Leaflet
    "@turf/turf": "^6.5.0"            // Cálculos geoespaciales
  }
}
```

**Nota:** Leaflet y Turf son **opcionales** para MVP. Solo necesarios si se quiere:
- Visualizar ruta en mapa (Leaflet)
- Cálculo avanzado de rutas/áreas (Turf)

Para MVP, el cálculo Haversine es suficiente (implementado manualmente).

#### Backend
```json
{
  "dependencies": {
    // YA INSTALADAS
    "express": "^4.x",
    "zod": "^3.x",
    "jsonwebtoken": "^9.x",
    
    // NUEVAS (opcional - geocoding reverso)
    "node-fetch": "^3.3.2"            // Llamadas a OpenStreetMap Nominatim
  }
}
```

### 5.4 APIs Externas (Opcional - Fase 2)

#### OpenStreetMap Nominatim (Geocoding Reverso)
**Propósito:** Convertir coordenadas GPS a direcciones legibles

```typescript
// src/services/geocoding.ts
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Sistema-aFull/1.0' // Requerido por OSM
        }
      }
    );

    if (!response.ok) throw new Error('Geocoding failed');

    const data = await response.json();
    return data.display_name || `${lat}, ${lng}`;
  } catch (error) {
    // Fallback a coordenadas
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
```

**Limitación:** Nominatim tiene rate limit de 1 req/s. Para uso intensivo, considerar:
- Mapbox Geocoding API (50,000 gratis/mes)
- Google Maps Geocoding API ($5 por 1000 llamadas)
- Caché local de direcciones frecuentes

**Para MVP:** No implementar geocoding reverso, mostrar solo coordenadas.


---

## 6. SEGURIDAD Y PRIVACIDAD

### 6.1 Permisos de Geolocalización

#### Solicitud de Permiso
```typescript
// Mostrar modal ANTES de solicitar permiso
const solicitarPermisoGPS = async (): Promise<boolean> => {
  // 1. Mostrar modal explicativo
  const acepta = await mostrarModalPermiso({
    titulo: "Permiso de Ubicación Necesario",
    mensaje: "Para registrar viajes automáticamente, necesitamos acceso a tu ubicación GPS. Solo se captura al iniciar y finalizar el viaje.",
    botones: ["Activar GPS", "Cancelar"]
  });

  if (!acepta) return false;

  // 2. Solicitar permiso al navegador
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    
    if (result.state === 'granted') {
      return true;
    } else if (result.state === 'prompt') {
      // El navegador pedirá permiso
      await getCurrentPosition(); // Trigger del diálogo
      return true;
    } else {
      // denied
      mostrarInstruccionesActivacion();
      return false;
    }
  } catch (error) {
    logger.error('Permission check failed:', error);
    return false;
  }
};
```

#### Manejo de Permisos Denegados
- **Android Chrome:** Usuario puede ir a Configuración > Sitios > [app] > Permisos > Ubicación
- **iOS Safari:** Configuración > Safari > Ubicación > Permitir
- **Desktop:** Icono de candado en barra de dirección → Permisos → Ubicación

### 6.2 Almacenamiento de Coordenadas GPS

#### Minimización de Datos
```typescript
// SOLO guardar:
interface GeoPoint {
  lat: number;        // Requerido
  lng: number;        // Requerido
  accuracy: number;   // Útil para validación
  timestamp: string;  // Auditoría
  // NO GUARDAR:
  // - altitude, altitudeAccuracy (innecesario)
  // - heading, speed (privacidad excesiva)
}
```

#### Anonimización en Logs
```typescript
// server-audit.ts
function auditLog(entry: AuditEntry) {
  // Si el detalle contiene coordenadas, truncar precisión
  if (entry.detalle && entry.detalle.includes('lat')) {
    entry.detalle = entry.detalle.replace(
      /lat: (-?\d+\.\d{6})\d*/g,
      'lat: $1...' // Truncar después de 6 decimales (±10cm)
    );
  }
  
  fs.appendFileSync('audit.log', JSON.stringify(entry) + '\n');
}
```

### 6.3 GDPR / Compliance Privacidad

#### Consideraciones
1. **Transparencia:** Informar al usuario QUÉ datos se capturan y POR QUÉ
2. **Minimización:** Solo capturar GPS en inicio/fin de viaje (no tracking continuo)
3. **Consentimiento:** Modal de permiso explícito antes de solicitar GPS
4. **Derecho al olvido:** Permitir eliminar viajes históricos

#### Implementación
```typescript
// components/PrivacyConsent.tsx
export function PrivacyConsentModal() {
  return (
    <Modal>
      <h2>Uso de Ubicación GPS</h2>
      <p>
        Para registrar viajes de vehículos, capturamos tu ubicación GPS <strong>solo al iniciar y finalizar el viaje</strong>.
      </p>
      <ul>
        <li>✓ No rastreamos tu ubicación en tiempo real</li>
        <li>✓ Los datos solo se usan para calcular distancia</li>
        <li>✓ Podés eliminar viajes históricos cuando quieras</li>
      </ul>
      <button onClick={aceptar}>Entendido, Activar GPS</button>
      <button onClick={rechazar}>No Activar</button>
    </Modal>
  );
}
```

### 6.4 Autorización: ¿Quién puede registrar viajes?

#### Opción 1: Solo usuarios autenticados (Recomendada)
```typescript
// Cualquier usuario logueado puede registrar viajes de cualquier vehículo
// → Flexible para equipos pequeños
app.post('/api/viaje/start', requireAuth, async (req, res) => {
  // No validar rol específico
});
```

#### Opción 2: Solo Admin + Técnicos (Restrictiva)
```typescript
// Solo roles con permiso explícito
app.post('/api/viaje/start', requireAuth, async (req, res) => {
  const userPayload = req.user!;
  
  if (!['Admin', 'Técnico'].includes(userPayload.rol)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Solo técnicos pueden registrar viajes' }
    });
  }
  
  // ...
});
```

**Recomendación:** Opción 1 para MVP (menos fricción), migrar a Opción 2 si se detecta abuso.


---

## 7. CASOS DE USO DETALLADOS

### Caso de Uso 1: Viaje Simple (Happy Path)

**Actores:** Técnico de campo (Kevin Delgado)
**Precondiciones:** Usuario autenticado, GPS activado, vehículo registrado

#### Flujo
1. Kevin abre "Registro Operativo" en su móvil
2. Selecciona:
   - Cliente: "Empresa 1 S.A."
   - Proyecto: "Ploteo de 2 Freezers"
   - Fecha: (hoy, por defecto)
3. Click en tab "🚗 Vehículo"
4. Selecciona vehículo: "Ford Ranger ABC-123"
5. Click "▶ Iniciar Viaje"
   - Sistema captura GPS: -25.296389, -57.633611 (Taller en Asunción)
   - Timer empieza: 00:00:00
6. Kevin conduce hacia la obra en San Lorenzo (25 km)
7. Después de 35 minutos, llega a la obra
8. Click "■ Finalizar Viaje"
   - Sistema captura GPS: -25.342778, -57.540556 (Obra en San Lorenzo)
   - Calcula distancia: 23.4 km (Haversine)
   - Calcula consumo: 23.4 / 12.5 = 1.87 L
   - Calcula costo: 1.87 * 5600 = Gs. 10,472
9. Pantalla de confirmación:
   ```
   Viaje Finalizado
   
   Vehículo: Ford Ranger ABC-123
   Distancia: 23.4 km
   Tiempo: 00:35:12
   Consumo: 1.87 L
   Costo combustible: Gs. 10,472
   
   [Editar] [Confirmar Registro]
   ```
10. Click "Confirmar Registro"
11. Sistema guarda en `registros` con `concepto: 'Vehiculo'`
12. Toast de éxito: "✓ Viaje registrado correctamente"

**Postcondiciones:** 
- Registro creado en database.json
- Viaje removido de `viajesActivos`
- Timer reseteado

---

### Caso de Uso 2: Viaje con Parada Intermedia

**Actores:** Técnico Rodrigo Gómez
**Precondiciones:** Viaje iniciado

#### Flujo
1-6. (igual que Caso 1)
7. Rodrigo necesita cargar combustible en estación de servicio
8. Click "⏸ Pausar Viaje"
   - Timer se pausa en 00:18:34
   - GPS NO se captura (pausa solo afecta timer)
9. Rodrigo carga combustible (10 minutos)
10. Click "▶ Reanudar Viaje"
    - Timer continúa: 00:18:34 → 00:18:35 → ...
11. Continúa hacia obra
12. Click "■ Finalizar Viaje"
    - Distancia: 23.4 km (igual, no se afecta por pausa)
    - Tiempo NETO: 00:35:12 (sin contar los 10 min de pausa)
    - Tiempo BRUTO: 00:45:12
13. Pantalla muestra:
    ```
    Pausas: 1
      • 09:15-09:25 (10 min) - Parada combustible
    ```

**Postcondiciones:** `pauseHistory` registra la parada en el viaje

---

### Caso de Uso 3: GPS Perdido Durante Viaje

**Actores:** Técnico Laura Benítez
**Precondiciones:** Viaje iniciado, señal GPS débil

#### Flujo
1-6. (igual que Caso 1)
7. Laura entra a túnel / zona sin señal GPS
8. Sistema detecta pérdida de señal (timeout >30 segundos)
9. Muestra banner amarillo: "⚠️ Señal GPS perdida - última ubicación conocida"
10. Laura continúa conduciendo
11. Sale del túnel, señal GPS vuelve
12. Banner desaparece: "✓ GPS restablecido"
13. Click "■ Finalizar Viaje"
    - Si GPS está disponible: captura normalmente
    - Si GPS sigue perdido: usa última ubicación conocida + muestra alerta
14. Pantalla de confirmación:
    ```
    ⚠️ Advertencia: Señal GPS intermitente
    
    Distancia aproximada: ~23.4 km
    (Basada en última ubicación conocida)
    
    [Editar Manualmente] [Confirmar]
    ```
15. Laura puede:
    - Editar manualmente la distancia (ej: mirar odómetro del vehículo)
    - Confirmar con estimación automática

**Postcondiciones:** Registro incluye flag `gpsIntermitente: true`


---

### Caso de Uso 4: Usuario Olvida Finalizar Viaje

**Actores:** Técnico Kevin (olvida detener timer)
**Precondiciones:** Viaje activo hace 12 horas

#### Flujo
1. Kevin inició viaje ayer a las 8:00 AM
2. Llegó a obra a las 8:35 AM pero olvidó "Finalizar Viaje"
3. Al día siguiente (9:00 AM), abre la app
4. Sistema detecta viaje activo >12 horas
5. Muestra modal bloqueante:
   ```
   ⚠️ Viaje Activo Detectado
   
   Iniciaste un viaje hace 25 horas:
   Vehículo: Ford Ranger ABC-123
   Cliente: Empresa 1 S.A.
   Inicio: 15/12/2026 08:00
   
   ¿Qué querés hacer?
   
   [Finalizar Ahora] [Editar Hora de Fin] [Cancelar Viaje]
   ```
6. Kevin selecciona "Editar Hora de Fin"
7. Modal permite ajustar:
   - Hora de finalización: 08:35 (ayer)
   - Ubicación final: (última conocida o manual)
   - Distancia: 23.4 km (GPS capturado)
8. Click "Confirmar"
9. Sistema registra viaje con timestamps corregidos

**Postcondiciones:** Viaje registrado con datos históricos correctos

**Prevención Futura:** 
- Notificación push después de 2 horas de viaje activo (Fase 2)
- Auto-finalización después de 24 horas (con alerta al Admin)

---

### Caso de Uso 5: Múltiples Técnicos, Mismo Vehículo

**Actores:** Rodrigo y Kevin (comparten vehículo)
**Precondiciones:** Ambos autenticados

#### Flujo
1. Rodrigo inicia viaje con "Ford Ranger ABC-123" a las 8:00 AM
2. Kevin intenta iniciar otro viaje con el mismo vehículo a las 8:05 AM
3. Sistema detecta vehículo en uso:
   ```
   ⚠️ Vehículo No Disponible
   
   Ford Ranger ABC-123 está actualmente en uso por Rodrigo Gómez.
   
   Viaje iniciado: Hoy 08:00
   Proyecto: Ploteo de 2 Freezers
   
   [Usar Otro Vehículo] [Ver Estado]
   ```
4. Kevin selecciona "Usar Otro Vehículo" → "Fiat Ducato XYZ-789"
5. Inicia su propio viaje sin conflicto

**Postcondiciones:** 
- Cada usuario solo puede tener 1 viaje activo a la vez
- Cada vehículo solo puede tener 1 viaje activo a la vez

**Validación Backend:**
```typescript
// Validar vehículo disponible
const viajeEnCurso = dbData.viajesActivos.find(
  v => v.vehiculoId === data.vehiculoId && v.activo
);

if (viajeEnCurso) {
  return res.status(409).json({
    success: false,
    error: {
      code: 'VEHICULO_EN_USO',
      message: `Vehículo en uso por ${viajeEnCurso.usuarioId}`,
      details: { viajeId: viajeEnCurso.id }
    }
  });
}
```


---

## 8. DIAGRAMA DE ARQUITECTURA

### Arquitectura General (Textual)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RegistroOperativo.tsx                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Tabs:                                                │   │
│  │   [Mano de Obra] [Insumos] [🚗 Vehículo]           │   │
│  │                                                      │   │
│  │ TabPanel id="vehiculo":                             │   │
│  │   ┌──────────────────────────────────────────┐     │   │
│  │   │ useViajeVehiculo hook                     │     │   │
│  │   │  ├─ Timer (useState + useEffect)          │     │   │
│  │   │  ├─ GPS (Geolocation API)                 │     │   │
│  │   │  ├─ LocalStorage (híbrido)                │     │   │
│  │   │  └─ Server Sync (fetch cada 30s)          │     │   │
│  │   └──────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            │ HTTP (fetch)                    │
│                            ▼                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                BACKEND (Express.js + TypeScript)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  API Endpoints:                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/viaje/start                                 │  │
│  │   ├─ Validación (Zod)                                 │  │
│  │   ├─ requireAuth middleware                           │  │
│  │   ├─ Crear ViajeVehiculo                              │  │
│  │   └─ Guardar en viajesActivos[]                       │  │
│  │                                                        │  │
│  │ POST /api/viaje/stop                                  │  │
│  │   ├─ Calcular distancia (Haversine)                   │  │
│  │   ├─ Calcular consumo (distancia / eficiencia)        │  │
│  │   ├─ Crear RegistroItem                               │  │
│  │   └─ Mover a registros[], borrar de viajesActivos[]   │  │
│  │                                                        │  │
│  │ POST /api/viaje/sync                                  │  │
│  │   └─ Actualizar duracionSegundos                      │  │
│  │                                                        │  │
│  │ GET /api/viaje/active/:usuario                        │  │
│  │   └─ Recuperar viaje activo (al recargar página)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            │ Mutex (async-mutex)             │
│                            ▼                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (database.json)                   │
├─────────────────────────────────────────────────────────────┤
│  {                                                           │
│    "vehiculos": [...],           ← Catálogo de vehículos    │
│    "viajesActivos": [...],       ← Viajes en curso          │
│    "registros": [                ← Viajes finalizados       │
│      { concepto: "Vehiculo", ... }                           │
│    ],                                                        │
│    "clientes": [...],                                        │
│    "proyectos": [...],                                       │
│    ...                                                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                EXTERNAL APIs (Opcional - Fase 2)             │
├─────────────────────────────────────────────────────────────┤
│  OpenStreetMap Nominatim                                     │
│    → Geocoding reverso (coordenadas → dirección)             │
│                                                              │
│  Leaflet.js                                                  │
│    → Visualización de mapas interactivos                     │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos: Inicio de Viaje

```
Usuario                 Frontend                Backend              Database
  │                        │                       │                    │
  │ Click "Iniciar Viaje" │                       │                    │
  ├──────────────────────>│                       │                    │
  │                        │ navigator.geolocation │                    │
  │                        │  .getCurrentPosition()│                    │
  │<───────────────────────┤                       │                    │
  │ (GPS: -25.296, -57.633)│                       │                    │
  │                        │                       │                    │
  │                        │ POST /api/viaje/start │                    │
  │                        ├──────────────────────>│                    │
  │                        │  { vehiculoId,        │                    │
  │                        │    clienteId,         │                    │
  │                        │    proyectoId,        │                    │
  │                        │    ubicacionInicio }  │                    │
  │                        │                       │                    │
  │                        │                       │ Validar permisos   │
  │                        │                       │ Crear ViajeVehiculo│
  │                        │                       ├───────────────────>│
  │                        │                       │ viajesActivos.push │
  │                        │                       │<───────────────────┤
  │                        │                       │                    │
  │                        │<──────────────────────┤                    │
  │                        │ { success: true,      │                    │
  │                        │   data: viaje }       │                    │
  │                        │                       │                    │
  │<───────────────────────┤                       │                    │
  │ Toast: "Viaje iniciado"│                       │                    │
  │ Timer: 00:00:01...     │                       │                    │
  │                        │ (Sync cada 30s)       │                    │
  │                        ├──────────────────────>│                    │
  │                        │ POST /api/viaje/sync  │                    │
```


---

## 9. ROADMAP DE IMPLEMENTACIÓN

### FASE 1: MVP - Manual + GPS (2-3 semanas)

#### Semana 1: Backend + Modelo de Datos
**Objetivo:** Infraestructura básica funcional

- [ ] **Día 1-2: Modelo de Datos**
  - Definir interfaces TypeScript (`Vehiculo`, `ViajeVehiculo`, `GeoPoint`)
  - Actualizar `DatabaseState` con `vehiculos[]` y `viajesActivos[]`
  - Migrar `database.json` con vehículos de ejemplo
  - Agregar `concepto: 'Vehiculo'` a `RegistroItem`

- [ ] **Día 3-4: Endpoints Backend**
  - `POST /api/viaje/start` (crear viaje + capturar GPS)
  - `POST /api/viaje/stop` (finalizar viaje + cálculo Haversine)
  - `POST /api/viaje/sync` (sincronización periódica)
  - `GET /api/viaje/active/:usuario` (recuperar viaje activo)
  - Schemas Zod para validación

- [ ] **Día 5: Testing Backend**
  - Test manual con Postman/Thunder Client
  - Validar cálculo Haversine (comparar con Google Maps)
  - Validar cálculo de consumo (litros = km / eficiencia)

#### Semana 2: Frontend - Custom Hook + UI
**Objetivo:** Componente funcional sin pulido visual

- [ ] **Día 6-7: Custom Hook `useViajeVehiculo`**
  - Implementar lógica de timer (reutilizar `useTimer`)
  - Integración con Geolocation API
  - Manejo de errores GPS
  - Persistencia híbrida (localStorage + servidor)

- [ ] **Día 8-9: Componente UI Básico**
  - Nuevo tab "Vehículo" en `RegistroOperativo.tsx`
  - Select de vehículos
  - Botones Iniciar/Pausar/Finalizar
  - Display de timer + distancia + consumo

- [ ] **Día 10: Integración y Testing**
  - Flujo completo: iniciar → pausar → reanudar → finalizar
  - Validar sincronización con servidor
  - Probar recarga de página (recuperar estado)

#### Semana 3: Pulido + Testing de Usuario
**Objetivo:** UX lista para producción

- [ ] **Día 11-12: UX/UI Polish**
  - Animaciones con Framer Motion
  - Estados visuales (activo/pausado/error)
  - Modal de permisos GPS
  - Feedback visual (toasts, spinners)

- [ ] **Día 13-14: Testing Real**
  - Probar en móviles Android/iOS reales
  - Viaje en vehículo real (comparar con odómetro)
  - Edge cases: GPS perdido, batería baja, app cerrada

- [ ] **Día 15: Deploy MVP**
  - Merge a rama principal
  - Deploy a producción
  - Documentación para usuarios

**Entregable Fase 1:**
- ✅ Tab "Vehículo" funcional
- ✅ Captura GPS inicio/fin
- ✅ Cálculo automático de distancia y consumo
- ✅ Persistencia en `database.json`
- ✅ Soporte para pausas


---

### FASE 2: Expansión - Geocerca Automática (3-4 meses después)

**Condiciones para iniciar Fase 2:**
- ✔️ MVP usado por >80% de técnicos
- ✔️ >100 viajes registrados
- ✔️ Detección de >20% de olvidos (viajes no finalizados)
- ✔️ Feedback positivo de usuarios

#### Funcionalidades Adicionales
- [ ] **Geocerca por Cliente/Proyecto**
  - Interface Admin para definir polígonos (ej: radio de 500m de obra)
  - Detección automática entrada/salida
  - Service Worker para monitoreo background

- [ ] **Tracking Continuo de Ruta**
  - Capturar waypoints cada 2 minutos (solo si app abierta)
  - Almacenar ruta completa en formato GeoJSON
  - Visualización en mapa (Leaflet.js)

- [ ] **Geocoding Reverso**
  - Integración con OpenStreetMap Nominatim
  - Mostrar direcciones legibles en vez de coordenadas
  - Caché local de direcciones frecuentes

- [ ] **Alertas Proactivas**
  - Notificación push si viaje activo >2 horas
  - Sugerencia de finalizar viaje al detectar entrada a geocerca de taller
  - Auto-finalización después de 24 horas con alerta a Admin

- [ ] **Análisis de Eficiencia**
  - Dashboard de consumo por vehículo
  - Comparación distancia GPS vs odómetro (calibración)
  - Detección de rutas ineficientes

**Tiempo estimado:** 6-8 semanas desarrollo + 2 semanas testing

---

### FASE 3: OBD-II Bluetooth (Evaluación futura)

**Solo si:**
- ✔️ Fase 2 implementada y estable
- ✔️ Presupuesto para dispositivos hardware ($20-80 × N vehículos)
- ✔️ Equipo técnico capacitado para soporte de hardware

#### Funcionalidades
- Lectura directa de odómetro del vehículo
- Consumo real de combustible (no estimado)
- Códigos de error y mantenimiento predictivo
- Telemetría: RPM, velocidad, temperatura motor

**Tiempo estimado:** 3-4 meses desarrollo + pruebas piloto

---

## 10. DECISIONES TÉCNICAS Y JUSTIFICACIONES

### 10.1 ¿Por qué reutilizar el patrón de Timer?

**Decisión:** Crear `useViajeVehiculo` basado en `useTimer`

**Justificación:**
- ✅ **Código probado:** Timer híbrido ya funciona (localStorage + servidor)
- ✅ **Consistencia UX:** Usuarios ya conocen flujo iniciar/pausar/finalizar
- ✅ **Menos bugs:** Reutilizar lógica de pausas reduce casos edge
- ✅ **Velocidad:** 60% menos tiempo de desarrollo

**Alternativa descartada:** Implementar desde cero con arquitectura diferente
- ❌ Tiempo de desarrollo >2x
- ❌ Riesgo de introducir bugs nuevos
- ❌ UX inconsistente con resto de app

---

### 10.2 ¿Por qué Haversine en vez de API de rutas?

**Decisión:** Calcular distancia con fórmula Haversine (línea recta)

**Justificación:**
- ✅ **Offline-first:** No depende de internet
- ✅ **Sin costos:** APIs de rutas (Google Maps, Mapbox) tienen límites de uso
- ✅ **Velocidad:** Cálculo instantáneo
- ✅ **Suficiente precisión:** Para viajes largos (>5km), diferencia <10%

**Comparación:**
| Método | Viaje Real 25km | Distancia Calculada | Error |
|--------|-----------------|---------------------|-------|
| Haversine | 25.0 km | 23.4 km | -6.4% |
| Google Maps API | 25.0 km | 25.2 km | +0.8% |

**Para MVP:** Haversine es suficiente. En Fase 2 se puede ofrecer "corrección manual" si el usuario detecta discrepancia.

---

### 10.3 ¿Por qué no usar Web Bluetooth API para OBD-II en MVP?

**Decisión:** Posponer OBD-II a Fase 3 (evaluación futura)

**Justificación:**
- ❌ **Compatibilidad limitada:** Safari iOS no soporta Web Bluetooth
- ❌ **Hardware requerido:** $20-80 por vehículo sin validación de demanda
- ❌ **Complejidad:** Parseo de protocolos OBD-II varía por marca/modelo
- ❌ **Soporte técnico:** Equipo debe debuggear problemas de hardware

**Estrategia:** Validar caso de uso con MVP manual antes de invertir en hardware.


---

### 10.4 ¿Tabla separada `viajesActivos` o flag en `registros`?

**Decisión:** Mantener `viajesActivos[]` separado de `registros[]`

**Justificación:**
- ✅ **Claridad:** Viajes activos tienen estado mutable (timer corriendo)
- ✅ **Performance:** Queries de "viajes activos" no escanean todo `registros[]`
- ✅ **Auditabilidad:** Viajes finalizados son inmutables en `registros[]`

**Flujo:**
```
Usuario inicia viaje → Push a viajesActivos[]
Usuario finaliza viaje → Pop de viajesActivos[], Push a registros[]
```

**Alternativa descartada:** Flag `activo: boolean` en `registros[]`
- ❌ Mezcla registros históricos con estado temporal
- ❌ Queries menos eficientes (filter por activo = true)

---

### 10.5 ¿Por qué capturar GPS solo al inicio/fin y no tracking continuo?

**Decisión:** MVP solo captura 2 puntos GPS (inicio + fin)

**Justificación:**
- ✅ **Batería:** Tracking continuo drena batería móvil rápidamente
- ✅ **Privacidad:** Minimiza datos sensibles (solo puntos A→B, no ruta completa)
- ✅ **Simplicidad:** Menos complejidad en frontend/backend
- ✅ **Almacenamiento:** 2 coordenadas vs array de 100+ waypoints

**Para Fase 2:** Si usuarios demandan visualización de ruta:
- Implementar tracking opcional (opt-in)
- Almacenar waypoints cada 2 minutos (solo si app abierta)
- Formato GeoJSON para compatibilidad con mapas

---

## 11. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **GPS no disponible en móviles viejos** | Media | Alto | Permitir entrada manual de KM como fallback |
| **Usuarios olvidan finalizar viaje** | Alta | Medio | Modal de alerta después de 2 horas + auto-stop en 24h |
| **Precisión GPS insuficiente (zona urbana densa)** | Media | Bajo | Mostrar accuracy en UI + permitir corrección manual |
| **Batería se agota durante viaje** | Baja | Alto | Persistencia híbrida (localStorage) recupera estado |
| **Rechazo de permisos GPS por usuarios** | Media | Alto | Modal explicativo ANTES de solicitar permiso |
| **Cálculo Haversine impreciso para rutas sinuosas** | Media | Bajo | En Fase 2, integrar API de rutas (opcional) |
| **Múltiples técnicos usan mismo vehículo simultáneamente** | Baja | Medio | Validación backend: 1 viaje activo por vehículo |

### Plan de Contingencia: Entrada Manual de KM

**Si GPS falla completamente:**
1. Mostrar modal: "GPS no disponible - ¿Querés ingresar KM manualmente?"
2. Usuario ingresa KM del odómetro al inicio/fin
3. Sistema calcula consumo normalmente
4. Registro incluye flag `origen: 'Manual'` (no GPS)

```typescript
// Fallback UI
if (gpsError) {
  return (
    <div>
      <p>⚠️ GPS no disponible</p>
      <label>KM Inicial (odómetro):</label>
      <input type="number" onChange={e => setKmInicial(e.target.value)} />
      
      <label>KM Final (odómetro):</label>
      <input type="number" onChange={e => setKmFinal(e.target.value)} />
      
      <p>Distancia: {kmFinal - kmInicial} km</p>
    </div>
  );
}
```


---

## 12. MÉTRICAS DE ÉXITO (KPIs)

### Fase 1 (MVP - 3 meses post-lanzamiento)

| Métrica | Objetivo | Actual | Status |
|---------|----------|--------|--------|
| **Adopción** | >70% de técnicos usan tab Vehículo | - | 🟡 Pendiente |
| **Viajes registrados** | >100 viajes en 3 meses | - | 🟡 Pendiente |
| **Tasa de finalización** | >90% viajes finalizados correctamente | - | 🟡 Pendiente |
| **Precisión GPS** | Accuracy promedio <50m | - | 🟡 Pendiente |
| **Diferencia vs Odómetro** | <10% error en distancia | - | 🟡 Pendiente |
| **Tiempo de registro** | <2 minutos por viaje (vs 5 min manual anterior) | - | 🟡 Pendiente |
| **Satisfacción de usuarios** | NPS >50 | - | 🟡 Pendiente |

### Indicadores de Problema

**🔴 Alerta Roja - Requiere acción inmediata:**
- Tasa de finalización <70% (muchos viajes no finalizados)
- Error de distancia >20% (GPS muy impreciso)
- Adopción <30% después de 1 mes (rechazo de usuarios)

**🟡 Alerta Amarilla - Monitorear:**
- Tasa de corrección manual >30% (GPS poco confiable)
- Tiempo promedio de viaje >4 horas (posibles olvidos)

### Dashboard de Monitoreo (Sugerido para Admin)

```
┌──────────────────────────────────────────────┐
│ Estadísticas de Viajes (Últimos 30 días)    │
├──────────────────────────────────────────────┤
│ Total viajes:               156              │
│ Viajes finalizados:         142 (91%)        │
│ Viajes en curso:            3                │
│ Viajes abandonados:         11 (7%)          │
│                                              │
│ Distancia total:            3,421 km         │
│ Consumo total:              285 L            │
│ Costo combustible:          Gs. 1,596,000    │
│                                              │
│ Top vehículos:                               │
│  1. Ford Ranger ABC-123:    1,234 km         │
│  2. Fiat Ducato XYZ-789:    987 km           │
│                                              │
│ Precisión GPS promedio:     32m              │
│ Accuracy <50m:              87%              │
└──────────────────────────────────────────────┘
```

---

## 13. CONFIGURACIÓN DEL SISTEMA

### Variables de Configuración (Admin)

```typescript
// config/vehiculo.config.ts
export const VEHICULO_CONFIG = {
  // Precio combustible (Guaraníes por litro)
  precioCombustiblePorLitro: 5600,
  
  // Alertas
  alertaViajeActivoHoras: 2,        // Alerta después de 2 horas
  autoStopViajeHoras: 24,            // Auto-finalizar después de 24 horas
  
  // GPS
  gpsTimeoutSegundos: 10,            // Timeout para captura GPS
  gpsAccuracyMaxima: 100,            // Rechazar si accuracy >100m
  
  // Permisos
  rolesPermitidos: ['Admin', 'Técnico', 'Operario'],
  
  // Geocoding (Fase 2)
  geocodingEnabled: false,
  geocodingProvider: 'nominatim',    // 'nominatim' | 'mapbox' | 'google'
  
  // Tracking continuo (Fase 2)
  trackingContinuoEnabled: false,
  waypointIntervalMinutos: 2
};
```

### Pantalla de Configuración (Admin)

```
┌────────────────────────────────────────────────┐
│ Configuración de Vehículos                     │
├────────────────────────────────────────────────┤
│                                                │
│ Precio Combustible:                            │
│ [5600] Gs/L                                    │
│                                                │
│ Alertas:                                       │
│ ☑ Alertar viaje activo después de [2] horas   │
│ ☑ Auto-finalizar después de [24] horas        │
│                                                │
│ GPS:                                           │
│ Timeout: [10] segundos                         │
│ Accuracy máxima aceptable: [100] metros        │
│                                                │
│ Permisos:                                      │
│ ☑ Admin   ☑ Técnico   ☑ Operario              │
│                                                │
│ Geocoding (dirección legible):                │
│ ☐ Activar geocoding reverso                   │
│   Provider: [OpenStreetMap Nominatim ▼]       │
│                                                │
│        [Cancelar]      [Guardar Cambios]      │
└────────────────────────────────────────────────┘
```


---

## 14. DOCUMENTACIÓN PARA USUARIOS

### Manual de Usuario: Registro de Viajes en Vehículo

#### ¿Cómo registrar un viaje?

**Paso 1: Preparación (antes de salir)**
1. Abrí "Registro Operativo" en tu móvil
2. Seleccioná Cliente y Proyecto (requerido)
3. Tocá el tab "🚗 Vehículo"

**Paso 2: Iniciar viaje**
1. Seleccioná el vehículo que vas a usar (ej: Ford Ranger ABC-123)
2. Tocá "▶ Iniciar Viaje"
3. La app va a pedirte permiso para usar tu ubicación → tocá "Permitir"
4. El timer va a empezar a correr (00:00:01, 00:00:02...)

**Paso 3: Durante el viaje**
- Si hacés una parada (cargar combustible, almorzar), tocá "⏸ Pausar Viaje"
- Cuando continúes, tocá "▶ Reanudar Viaje"
- El timer no cuenta el tiempo pausado

**Paso 4: Al llegar a destino**
1. Tocá "■ Finalizar Viaje"
2. La app va a calcular automáticamente:
   - Distancia recorrida (km)
   - Consumo de combustible (litros)
   - Costo total
3. Revisá los datos
4. Si todo está correcto, tocá "Registrar Viaje"

**Listo!** El viaje quedó guardado en tu historial.

---

#### Preguntas Frecuentes (FAQ)

**¿Por qué la app pide acceso a mi ubicación?**
Para calcular la distancia del viaje automáticamente. Solo capturamos tu ubicación al INICIO y al FIN del viaje, no durante todo el trayecto.

**¿Funciona sin internet?**
Sí, el registro funciona offline. Los datos se guardan en tu dispositivo y se sincronizan con el servidor cuando tengas conexión.

**¿Qué pasa si olvido finalizar el viaje?**
Después de 2 horas, la app te va a enviar una alerta. Podés finalizar el viaje y ajustar la hora manualmente.

**¿Qué hago si el GPS no funciona?**
Podés ingresar manualmente los kilómetros leyendo el odómetro del vehículo al inicio y al final del viaje.

**¿Puedo editar un viaje después de registrarlo?**
Sí, desde tu historial de registros podés editar la descripción y el proyecto. La distancia y el consumo NO se pueden editar (solo Admin).

**¿Qué pasa si dos técnicos usan el mismo vehículo?**
Solo uno puede tener un viaje activo a la vez. Si otro técnico intenta usar el mismo vehículo, la app le va a avisar que está en uso.

**¿El cálculo de consumo es exacto?**
Es una estimación basada en la eficiencia configurada del vehículo (ej: 12.5 km/L para la Ford Ranger). El consumo real puede variar según condiciones de tráfico, carga, etc.

**¿Cómo se calcula la distancia?**
La app usa las coordenadas GPS del inicio y el fin para calcular la distancia en línea recta (fórmula Haversine). Para viajes largos (>5km) la diferencia con la ruta real es <10%.

---

## 15. CHECKLIST PRE-DEPLOY

### Backend
- [ ] Interfaces TypeScript definidas (`Vehiculo`, `ViajeVehiculo`, `GeoPoint`)
- [ ] `database.json` migrado con `vehiculos[]` y `viajesActivos[]`
- [ ] Endpoints implementados y testeados:
  - [ ] `POST /api/viaje/start`
  - [ ] `POST /api/viaje/stop`
  - [ ] `POST /api/viaje/sync`
  - [ ] `GET /api/viaje/active/:usuario`
- [ ] Schemas Zod para validación
- [ ] Autorización (requireAuth middleware)
- [ ] Audit logs para eventos de viaje
- [ ] Cálculo Haversine validado (comparar con Google Maps)
- [ ] Manejo de errores (GPS perdido, viaje no encontrado, etc.)

### Frontend
- [ ] Custom hook `useViajeVehiculo` implementado
- [ ] Tab "Vehículo" agregado a `RegistroOperativo.tsx`
- [ ] UI funcional:
  - [ ] Select de vehículos
  - [ ] Botón "Iniciar Viaje" (con captura GPS)
  - [ ] Timer en tiempo real
  - [ ] Botón "Pausar/Reanudar"
  - [ ] Botón "Finalizar Viaje"
  - [ ] Pantalla de confirmación con resumen
- [ ] Manejo de permisos GPS:
  - [ ] Modal explicativo antes de solicitar
  - [ ] Instrucciones si permiso denegado
- [ ] Manejo de errores:
  - [ ] GPS no disponible → fallback manual
  - [ ] Señal perdida → usar última ubicación conocida
- [ ] Animaciones con Framer Motion
- [ ] Feedback visual (toasts, spinners)
- [ ] Persistencia híbrida (localStorage + servidor)

### Testing
- [ ] Testing en móviles reales (Android + iOS)
- [ ] Viaje completo en vehículo real (comparar con odómetro)
- [ ] Edge cases:
  - [ ] GPS perdido durante viaje
  - [ ] Recarga de página durante viaje activo
  - [ ] Múltiples pausas
  - [ ] Viaje olvidado (>24 horas)
  - [ ] Batería baja
- [ ] Performance (consumo batería, lag en UI)

### Documentación
- [ ] Manual de usuario en español
- [ ] FAQ para soporte
- [ ] Comentarios en código (JSDoc)
- [ ] README actualizado con nueva funcionalidad

### Seguridad
- [ ] Permisos de roles validados
- [ ] Audit logs funcionando
- [ ] Datos GPS mínimos (sin over-collection)
- [ ] Anonimización en logs (truncar coordenadas)

