# Plan Técnico: Módulo de Vehículo

## Resumen Ejecutivo

Agregar funcionalidad para registrar **kilometraje y consumo de combustible** del vehículo de la empresa dentro del módulo "Registro Operativo".

---

## Enfoque Recomendado: GPS + Foto del Odómetro

### Ventajas de esta opción:
- **GPS del dispositivo** para ubicación automática
- **Foto del odómetro** para control cruzado y auditoría
- **OCR opcional** para extraer km automáticamente de la foto
- **No requiere hardware externo** (OBD-II, dispositivos Bluetooth)
- **Funciona en móviles y tablets** que ya tienen GPS y cámara
- **Trazabilidad completa** con evidencia visual
- **Compatible con el sistema híbrido** (localStorage + servidor)

---

## Arquitectura Propuesta

### 1. Nuevo Tab "Vehículo" en el módulo Registro

```
┌─────────────────────────────────────────┐
│  [Mano de Obra] [Insumos] [Vehículo]    │
└─────────────────────────────────────────┘
```

### 2. Flujo de Uso

```
1. Usuario selecciona tab "Vehículo"

2. Click en "Iniciar Viaje" 
   → Captura ubicación GPS inicial (lat/lng)
   → Solicita foto del odómetro (INICIO)
   → OCR extrae km iniciales (opcional/manual)
   → Inicia timer de viaje
   
3. Durante el viaje: muestra tiempo transcurrido

4. Click en "Finalizar Viaje"
   → Captura ubicación GPS final
   → Solicita foto del odómetro (FIN)
   → OCR extrae km finales (opcional/manual)
   → Calcula distancia GPS vs Odómetro (control cruzado)
   → Usuario ingresa combustible gastado (litros/Gs)
   
5. Guarda registro con:
   - Distancia GPS (km)
   - Distancia Odómetro (km) + fotos de evidencia
   - Combustible (litros/Gs)
   - Proyecto asociado
   - Fecha/hora inicio-fin
   - Alertas si hay diferencia > 20% entre GPS y odómetro
```

---

## Cambios en Base de Datos

### Actualizar `types.ts`:

```typescript
export interface RegistroVehiculo {
  id: string;
  clienteId: string;
  proyectoId: string;
  fecha: string;
  concepto: 'Vehículo';
  
  // Ubicación GPS
  ubicacionInicio: { lat: number; lng: number; nombre?: string };
  ubicacionFin: { lat: number; lng: number; nombre?: string };
  distanciaGPS: number; // km calculados por GPS
  
  // Odómetro (control cruzado)
  kmInicial: number; // Del odómetro
  kmFinal: number;
  distanciaOdometro: number; // kmFinal - kmInicial
  fotoOdometroInicio: string; // Base64 o URL de la imagen
  fotoOdometroFin: string; // Base64 o URL de la imagen
  
  // Control de discrepancias
  discrepancia?: number; // % diferencia entre GPS y odómetro
  alertaDiscrepancia?: boolean; // true si diferencia > 20%
  
  // Combustible
  combustibleLitros?: number;
  combustibleCosto: number; // Gs
  consumoPorKm?: number; // Litros/km
  
  // Timer
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  
  // Observaciones
  descripcion: string; // Ej: "Visita a cliente X"
  
  total: number; // Costo total del viaje
}

export interface ViajeActivo {
  id: string;
  usuario: string;
  proyectoId: string;
  clienteId: string;
  inicio: string; // ISO timestamp
  ubicacionInicio: { lat: number; lng: number };
  activo: boolean;
}
```

### Actualizar `DatabaseState`:

```typescript
export interface DatabaseState {
  clientes: Cliente[];
  proyectos: Proyecto[];
  colaboradores: Colaborador[];
  registros: RegistroItem[];
  registrosVehiculo: RegistroVehiculo[]; // NUEVO
  timersActivos: TimerActivo[];
  viajesActivos: ViajeActivo[]; // NUEVO
}
```

---

## APIs y Tecnologías Recomendadas

### 1. Geolocalización GPS
**API Nativa del Navegador** (Gratuita)
```javascript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy // metros
    };
  },
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 10000 }
);
```

**Alternativa: Google Geolocation API**
- URL: `https://www.googleapis.com/geolocation/v1/geolocate`
- Costo: Gratis hasta 40,000 requests/mes
- Más preciso en interiores con triangulación WiFi

### 2. Cálculo de Distancia

**Opción A: Fórmula Haversine** (Recomendado - Gratuita)
- Cálculo matemático directo entre 2 coordenadas
- Sin límites de uso
- Precisión: ±0.5% en distancias < 500km
- Ideal para nuestro caso

**Opción B: Google Distance Matrix API**
- URL: `https://maps.googleapis.com/maps/api/distancematrix/json`
- Costo: $5 USD por 1000 requests (después de 40,000 gratis/mes)
- Calcula distancia real por carreteras
- Incluye tiempo estimado de viaje

**Recomendación**: Usar Haversine para la mayoría de casos, Distance Matrix solo si se requiere ruta exacta.

### 3. Captura de Foto del Odómetro

**HTML5 Camera API** (Nativa - Gratuita)
```html
<input 
  type="file" 
  accept="image/*" 
  capture="environment"
  onChange={handleCapture}
/>
```

**MediaDevices API** (Más control)
```javascript
navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: "environment" } 
})
.then(stream => {
  videoRef.current.srcObject = stream;
});
```

### 4. OCR para Extraer Kilometraje de la Foto

**Opción A: Tesseract.js** (Recomendado - Gratuita, Cliente-side)
- Librería JavaScript de OCR en el navegador
- No requiere servidor externo
- Funciona offline después de cargar
- Instalación: `npm install tesseract.js`

```javascript
import Tesseract from 'tesseract.js';

const extractKmFromImage = async (imageFile) => {
  const { data: { text } } = await Tesseract.recognize(
    imageFile,
    'spa', // español
    { 
      logger: m => console.log(m),
      tessedit_char_whitelist: '0123456789.' // Solo números
    }
  );
  
  // Extraer número del texto (ej: "123456.7 km" → 123456.7)
  const kmMatch = text.match(/\d+\.?\d*/);
  return kmMatch ? parseFloat(kmMatch[0]) : null;
};
```

**Opción B: Google Cloud Vision API**
- URL: `https://vision.googleapis.com/v1/images:annotate`
- Costo: $1.50 USD por 1000 imágenes (primeras 1000 gratis/mes)
- Mayor precisión que Tesseract
- Requiere clave API

```javascript
const extractKmWithGoogleVision = async (base64Image) => {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      })
    }
  );
  
  const data = await response.json();
  return data.responses[0].fullTextAnnotation.text;
};
```

**Opción C: Tu API actual de Google Gemini** (Ya la tenés integrada!)
```javascript
// Podés usar el Gemini que ya tenés en el proyecto
const extractKmWithGemini = async (base64Image) => {
  const response = await fetch('/api/gemini/vision', {
    method: 'POST',
    body: JSON.stringify({
      image: base64Image,
      prompt: 'Extrae solo el número del kilometraje visible en este odómetro. Responde únicamente con el número, sin texto adicional.'
    })
  });
  
  const data = await response.json();
  return parseFloat(data.text.match(/\d+\.?\d*/)[0]);
};
```

**Recomendación**: 
1. **Tesseract.js** para MVP (gratis, offline)
2. **Google Gemini** si querés mejor precisión (ya tenés la integración)

### 5. Almacenamiento de Imágenes

**Opción A: Base64 en database.json** (Simple, para MVP)
```typescript
fotoOdometroInicio: string; // "data:image/jpeg;base64,/9j/4AAQ..."
```
- Límite: ~500KB por imagen (comprimida)
- Sin costos adicionales
- Búsqueda más lenta con muchas imágenes

**Opción B: Sistema de archivos local**
```typescript
// Guardar en /uploads/vehiculos/{registroId}/
fotoOdometroInicio: string; // "/uploads/vehiculos/reg_123/inicio.jpg"
```
- Mejor rendimiento
- Fácil backup
- Requiere servir archivos estáticos

**Opción C: Cloud Storage (Futuro)**
- Google Cloud Storage
- AWS S3
- Cloudinary (tiene plan gratuito)

**Recomendación**: Opción B (archivos locales) para producción

### 6. Geocoding Inverso (Opcional)

**API para convertir coordenadas en direcciones legibles**

```javascript
// Google Geocoding API
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
);
// Resultado: "Av. España 1234, Asunción, Paraguay"
```

**Alternativa gratuita: Nominatim (OpenStreetMap)**
```javascript
const response = await fetch(
  `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
);
```

---

## Implementación Frontend

### Nuevo componente: `VehiculoTab.tsx`

```typescript
// Hook para captura de foto con OCR
function useCameraCapture() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedKm, setExtractedKm] = useState<number | null>(null);
  
  const capturePhoto = useCallback(async (file: File) => {
    // Convertir a base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPhoto(base64);
      
      // Intentar OCR automático
      setIsProcessing(true);
      try {
        // Opción 1: Usar Tesseract.js
        const { data } = await Tesseract.recognize(file, 'spa', {
          tessedit_char_whitelist: '0123456789.'
        });
        const kmMatch = data.text.match(/\d+\.?\d*/);
        const km = kmMatch ? parseFloat(kmMatch[0]) : null;
        setExtractedKm(km);
        
        // Opción 2: Usar Gemini (comentado)
        /*
        const response = await authFetchJSON('/api/gemini/extract-km', {
          method: 'POST',
          body: JSON.stringify({ image: base64 })
        });
        setExtractedKm(response.km);
        */
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

// Hook personalizado para GPS
function useGPS() {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
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

// Hook para viaje de vehículo
function useViaje({ currentUser }) {
  const [viajeActivo, setViajeActivo] = useState(false);
  const [ubicacionInicio, setUbicacionInicio] = useState(null);
  const [horaInicio, setHoraInicio] = useState(null);
  const [duracionSegundos, setDuracionSegundos] = useState(0);
  const [fotoInicio, setFotoInicio] = useState<string | null>(null);
  const [kmInicio, setKmInicio] = useState<number | null>(null);
  
  const { getCurrentLocation } = useGPS();
  
  const iniciarViaje = async (contextData: {
    clienteId: string;
    proyectoId: string;
    descripcion: string;
    fotoOdometro: string;
    kmInicial: number;
  }) => {
    try {
      const coords = await getCurrentLocation();
      const now = new Date();
      
      setUbicacionInicio(coords);
      setHoraInicio(now);
      setViajeActivo(true);
      setFotoInicio(contextData.fotoOdometro);
      setKmInicio(contextData.kmInicial);
      
      // Guardar en servidor
      await authFetchJSON('/api/viaje/start', {
        method: 'POST',
        body: JSON.stringify({
          usuario: currentUser.usuario,
          ubicacionInicio: coords,
          fotoOdometroInicio: contextData.fotoOdometro,
          kmInicial: contextData.kmInicial,
          ...contextData
        })
      });
    } catch (error) {
      console.error('Error iniciando viaje:', error);
      throw error;
    }
  };
  
  const finalizarViaje = async (dataFin: {
    fotoOdometroFin: string;
    kmFinal: number;
    combustibleLitros?: number;
    combustibleCosto: number;
  }) => {
    try {
      const coordsFin = await getCurrentLocation();
      
      // Enviar todo al servidor
      const response = await authFetchJSON('/api/viaje/stop', {
        method: 'POST',
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
  
  // Timer effect
  useEffect(() => {
    if (!viajeActivo || !horaInicio) return;
    
    const interval = setInterval(() => {
      const ahora = new Date();
      const segundos = Math.floor((ahora.getTime() - horaInicio.getTime()) / 1000);
      setDuracionSegundos(segundos);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [viajeActivo, horaInicio]);
  
  return {
    viajeActivo,
    ubicacionInicio,
    duracionSegundos,
    fotoInicio,
    kmInicio,
    iniciarViaje,
    finalizarViaje
  };
}
```

### UI del Tab Vehículo:

```tsx
<TabPanel id="vehiculo">
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center gap-2">
      <Car className="w-5 h-5 text-blue-400" />
      <h3>Registro de Viaje</h3>
    </div>
    
    {/* Estado: Sin viaje activo */}
    {!viajeActivo ? (
      <ModalIniciarViaje 
        onStart={iniciarViaje}
        contextComplete={contextComplete}
      />
    ) : (
      /* Estado: Viaje en curso */
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Viaje en curso</span>
        </div>
        
        {/* Timer */}
        <div className="mt-2 font-mono text-2xl">
          {formatDuration(duracionSegundos)}
        </div>
        
        {/* Info inicio */}
        <div className="mt-3 p-2 bg-white/5 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-3 h-3" />
            <span>Inicio: {formatTime(horaInicio)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 mt-1">
            <Gauge className="w-3 h-3" />
            <span>Km inicial: {kmInicio?.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Botón finalizar */}
        <button 
          onClick={() => setMostrarModalFin(true)} 
          className="btn-danger mt-3 w-full"
        >
          <Square className="w-4 h-4" /> Finalizar Viaje
        </button>
      </div>
    )}
    
    {/* Historial reciente */}
    <div className="glass-panel p-4">
      <h4 className="text-sm text-slate-400 mb-2">Últimos viajes del proyecto</h4>
      <HistorialViajes proyectoId={selectedProyectoId} />
    </div>
  </div>
</TabPanel>
```

### Modal Iniciar Viaje:

```tsx
function ModalIniciarViaje({ onStart, contextComplete }) {
  const [mostrar, setMostrar] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [kmManual, setKmManual] = useState('');
  const { photo, extractedKm, isProcessing, capturePhoto, reset } = useCameraCapture();
  const inputFileRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = async () => {
    if (!photo) {
      alert('Tomá una foto del odómetro');
      return;
    }
    
    const kmFinal = kmManual ? parseFloat(kmManual) : extractedKm;
    if (!kmFinal) {
      alert('Ingresá el kilometraje manualmente');
      return;
    }
    
    try {
      await onStart({
        clienteId: selectedClienteId,
        proyectoId: selectedProyectoId,
        descripcion: descripcion || 'Viaje en vehículo',
        fotoOdometro: photo,
        kmInicial: kmFinal
      });
      
      setMostrar(false);
      reset();
    } catch (error) {
      alert('Error al iniciar viaje');
    }
  };
  
  return (
    <>
      <button 
        onClick={() => setMostrar(true)} 
        className="btn-primary w-full"
        disabled={!contextComplete}
      >
        <MapPin className="w-4 h-4" /> Iniciar Viaje
      </button>
      
      {mostrar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-4">Iniciar Viaje</h3>
            
            {/* Input oculto para cámara */}
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
            
            {/* Zona de foto */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Foto del odómetro (inicio)
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
                  <img 
                    src={photo} 
                    alt="Odómetro" 
                    className="w-full h-40 object-cover rounded-lg"
                  />
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
            
            {/* OCR automático */}
            {isProcessing && (
              <div className="mb-3 text-center text-sm text-blue-400">
                <Loader className="w-4 h-4 animate-spin inline mr-2" />
                Leyendo kilometraje...
              </div>
            )}
            
            {extractedKm && (
              <div className="mb-3 p-2 bg-emerald-500/20 border border-emerald-500/30 rounded text-sm text-emerald-300">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Kilometraje detectado: <strong>{extractedKm.toLocaleString()}</strong>
              </div>
            )}
            
            {/* Input manual (override) */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Kilometraje inicial {extractedKm && '(verificar o corregir)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={kmManual || extractedKm || ''}
                onChange={(e) => setKmManual(e.target.value)}
                placeholder="Ej: 45623.5"
                className="input-field"
              />
            </div>
            
            {/* Descripción opcional */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Descripción del viaje (opcional)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Visita a cliente para instalación..."
                rows={2}
                className="input-field"
              />
            </div>
            
            {/* Botones */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMostrar(false); reset(); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary flex-1"
                disabled={!photo || (!kmManual && !extractedKm)}
              >
                <Play className="w-4 h-4" /> Iniciar Viaje
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Modal al finalizar viaje:

```tsx
function ModalFinalizarViaje({ onFinish, viajeData }) {
  const [mostrar, setMostrar] = useState(false);
  const [kmManual, setKmManual] = useState('');
  const [combustibleLitros, setCombustibleLitros] = useState('');
  const [combustibleCosto, setCombustibleCosto] = useState('');
  const [descripcionFinal, setDescripcionFinal] = useState('');
  const { photo, extractedKm, isProcessing, capturePhoto, reset } = useCameraCapture();
  const inputFileRef = useRef<HTMLInputElement>(null);
  
  const [distanciaCalculada, setDistanciaCalculada] = useState<number | null>(null);
  const [discrepancia, setDiscrepancia] = useState<number | null>(null);
  
  // Calcular distancia GPS y discrepancia
  useEffect(() => {
    if (extractedKm || kmManual) {
      const kmFinal = parseFloat(kmManual) || extractedKm;
      const distanciaOdometro = kmFinal - viajeData.kmInicio;
      
      // Simular cálculo GPS (en realidad vendría del servidor)
      const distanciaGPS = 45.2; // Este valor vendría de la API
      setDistanciaCalculada(distanciaGPS);
      
      // Calcular discrepancia
      const diff = Math.abs(distanciaOdometro - distanciaGPS);
      const porcentaje = (diff / distanciaGPS) * 100;
      setDiscrepancia(porcentaje);
    }
  }, [kmManual, extractedKm, viajeData.kmInicio]);
  
  const handleSubmit = async () => {
    if (!photo) {
      alert('Tomá una foto del odómetro final');
      return;
    }
    
    const kmFinal = parseFloat(kmManual) || extractedKm;
    if (!kmFinal) {
      alert('Ingresá el kilometraje final');
      return;
    }
    
    if (!combustibleCosto) {
      alert('Ingresá el costo de combustible');
      return;
    }
    
    try {
      await onFinish({
        fotoOdometroFin: photo,
        kmFinal,
        combustibleLitros: combustibleLitros ? parseFloat(combustibleLitros) : undefined,
        combustibleCosto: parseFloat(combustibleCosto),
        descripcion: descripcionFinal
      });
      
      setMostrar(false);
      reset();
    } catch (error) {
      alert('Error al finalizar viaje');
    }
  };
  
  return (
    <>
      <button 
        onClick={() => setMostrar(true)} 
        className="btn-danger w-full"
      >
        <Square className="w-4 h-4" /> Finalizar Viaje
      </button>
      
      {mostrar && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Finalizar Viaje</h3>
            
            {/* Resumen del viaje */}
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400">Inicio:</span>
                  <span className="ml-2 text-white">{formatTime(viajeData.horaInicio)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Duración:</span>
                  <span className="ml-2 text-white">{formatDuration(viajeData.duracion)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Km inicial:</span>
                  <span className="ml-2 text-white">{viajeData.kmInicio.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Distancia GPS:</span>
                  <span className="ml-2 text-emerald-400">{distanciaCalculada || '...'} km</span>
                </div>
              </div>
            </div>
            
            {/* Input oculto para cámara */}
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
            
            {/* Foto odómetro final */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Foto del odómetro (final) *
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
                  <img 
                    src={photo} 
                    alt="Odómetro final" 
                    className="w-full h-40 object-cover rounded-lg"
                  />
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
            
            {/* OCR automático */}
            {isProcessing && (
              <div className="mb-3 text-center text-sm text-blue-400">
                <Loader className="w-4 h-4 animate-spin inline mr-2" />
                Leyendo kilometraje...
              </div>
            )}
            
            {extractedKm && (
              <div className="mb-3 p-2 bg-emerald-500/20 border border-emerald-500/30 rounded text-sm text-emerald-300">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Kilometraje detectado: <strong>{extractedKm.toLocaleString()}</strong>
              </div>
            )}
            
            {/* Kilometraje final */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Kilometraje final * {extractedKm && '(verificar o corregir)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={kmManual || extractedKm || ''}
                onChange={(e) => setKmManual(e.target.value)}
                placeholder="Ej: 45668.7"
                className="input-field"
              />
            </div>
            
            {/* Alerta de discrepancia */}
            {discrepancia !== null && discrepancia > 20 && (
              <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-amber-300">Discrepancia detectada</div>
                    <div className="text-amber-200 mt-1">
                      La diferencia entre el odómetro ({(parseFloat(kmManual) || extractedKm) - viajeData.kmInicio} km) 
                      y GPS ({distanciaCalculada} km) es de {discrepancia.toFixed(1)}%.
                      Verificá que el kilometraje sea correcto.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Combustible */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Combustible (litros)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={combustibleLitros}
                  onChange={(e) => setCombustibleLitros(e.target.value)}
                  placeholder="Ej: 15.5"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Costo combustible (Gs) *
                </label>
                <input
                  type="number"
                  step="1000"
                  value={combustibleCosto}
                  onChange={(e) => setCombustibleCosto(e.target.value)}
                  placeholder="Ej: 85000"
                  className="input-field"
                />
              </div>
            </div>
            
            {/* Descripción final */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Notas adicionales
              </label>
              <textarea
                value={descripcionFinal}
                onChange={(e) => setDescripcionFinal(e.target.value)}
                placeholder="Cualquier observación sobre el viaje..."
                rows={2}
                className="input-field"
              />
            </div>
            
            {/* Resumen calculado */}
            {combustibleLitros && (kmManual || extractedKm) && (
              <div className="mb-4 p-3 bg-slate-700/50 rounded-lg text-sm">
                <div className="font-semibold text-slate-300 mb-2">Resumen calculado</div>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div>
                    Distancia recorrida: 
                    <span className="text-white ml-2">
                      {((parseFloat(kmManual) || extractedKm) - viajeData.kmInicio).toFixed(1)} km
                    </span>
                  </div>
                  <div>
                    Consumo: 
                    <span className="text-white ml-2">
                      {(parseFloat(combustibleLitros) / ((parseFloat(kmManual) || extractedKm) - viajeData.kmInicio)).toFixed(2)} L/km
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Botones */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMostrar(false); reset(); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary flex-1"
                disabled={!photo || (!kmManual && !extractedKm) || !combustibleCosto}
              >
                <CheckCircle className="w-4 h-4" /> Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## Backend: Nuevas Rutas API

### `POST /api/viaje/start`
```typescript
app.post('/api/viaje/start', requireAuth, async (req, res) => {
  const { 
    usuario, 
    ubicacionInicio, 
    clienteId, 
    proyectoId, 
    descripcion,
    fotoOdometroInicio,
    kmInicial 
  } = req.body;
  
  // Verificar si ya hay viaje activo
  const viajeActivo = data.viajesActivos.find(v => v.usuario === usuario && v.activo);
  if (viajeActivo) {
    return res.json({ success: false, error: 'Ya tenés un viaje activo' });
  }
  
  const nuevoViaje: ViajeActivo = {
    id: generateId('viaje'),
    usuario,
    clienteId,
    proyectoId,
    inicio: new Date().toISOString(),
    ubicacionInicio,
    fotoOdometroInicio,
    kmInicial,
    descripcion,
    activo: true
  };
  
  data.viajesActivos.push(nuevoViaje);
  await saveDatabase();
  
  // Log de auditoría
  auditLog({
    usuario,
    accion: 'viaje_start',
    recurso: `/api/viaje/${nuevoViaje.id}`,
    detalles: { proyectoId, clienteId, kmInicial },
    resultado: 'success',
    ip: getClientIp(req)
  });
  
  res.json({ success: true, data: nuevoViaje });
});
```

### `POST /api/viaje/stop`
```typescript
app.post('/api/viaje/stop', requireAuth, async (req, res) => {
  const { 
    usuario, 
    ubicacionFin, 
    fotoOdometroFin,
    kmFinal,
    combustibleLitros, 
    combustibleCosto, 
    descripcion 
  } = req.body;
  
  const viajeActivo = data.viajesActivos.find(v => v.usuario === usuario && v.activo);
  if (!viajeActivo) {
    return res.json({ success: false, error: 'No hay viaje activo' });
  }
  
  // Calcular distancia GPS con Haversine
  const distanciaGPS = calcularDistanciaHaversine(
    viajeActivo.ubicacionInicio,
    ubicacionFin
  );
  
  // Calcular distancia por odómetro
  const distanciaOdometro = kmFinal - viajeActivo.kmInicial;
  
  // Detectar discrepancia
  const diferencia = Math.abs(distanciaOdometro - distanciaGPS);
  const discrepanciaPorcentaje = (diferencia / distanciaGPS) * 100;
  const alertaDiscrepancia = discrepanciaPorcentaje > 20;
  
  const fin = new Date();
  const duracionMinutos = Math.floor(
    (fin.getTime() - new Date(viajeActivo.inicio).getTime()) / 60000
  );
  
  // Calcular consumo por km
  const consumoPorKm = combustibleLitros 
    ? combustibleLitros / distanciaOdometro 
    : undefined;
  
  // Guardar fotos en el sistema de archivos
  const registroId = generateId('regveh');
  const fotosGuardadas = await guardarFotosVehiculo(
    registroId,
    viajeActivo.fotoOdometroInicio,
    fotoOdometroFin
  );
  
  // Crear registro
  const registroVehiculo: RegistroVehiculo = {
    id: registroId,
    clienteId: viajeActivo.clienteId,
    clienteNombre: data.clientes.find(c => c.id === viajeActivo.clienteId)?.nombre || '',
    proyectoId: viajeActivo.proyectoId,
    proyectoNombre: data.proyectos.find(p => p.id === viajeActivo.proyectoId)?.nombre || '',
    fecha: fin.toISOString().split('T')[0],
    concepto: 'Vehículo',
    
    // GPS
    ubicacionInicio: viajeActivo.ubicacionInicio,
    ubicacionFin,
    distanciaGPS: Math.round(distanciaGPS * 10) / 10,
    
    // Odómetro
    kmInicial: viajeActivo.kmInicial,
    kmFinal,
    distanciaOdometro: Math.round(distanciaOdometro * 10) / 10,
    fotoOdometroInicio: fotosGuardadas.inicio, // Ruta del archivo
    fotoOdometroFin: fotosGuardadas.fin,
    
    // Discrepancia
    discrepancia: Math.round(discrepanciaPorcentaje * 10) / 10,
    alertaDiscrepancia,
    
    // Combustible
    combustibleLitros,
    combustibleCosto,
    consumoPorKm: consumoPorKm ? Math.round(consumoPorKm * 100) / 100 : undefined,
    
    // Timer
    horaInicio: new Date(viajeActivo.inicio).toLocaleTimeString('es-AR', { hour12: false }),
    horaFin: fin.toLocaleTimeString('es-AR', { hour12: false }),
    duracionMinutos,
    
    // Descripción
    descripcion: descripcion || viajeActivo.descripcion || 'Viaje en vehículo',
    
    total: combustibleCosto,
    origen: 'Manual',
    fechaImportacion: new Date().toISOString()
  };
  
  data.registrosVehiculo = data.registrosVehiculo || [];
  data.registrosVehiculo.push(registroVehiculo);
  viajeActivo.activo = false;
  
  await saveDatabase();
  
  // Log de auditoría
  auditLog({
    usuario,
    accion: 'viaje_stop',
    recurso: `/api/viaje/${viajeActivo.id}`,
    detalles: { 
      proyectoId: viajeActivo.proyectoId,
      distanciaGPS,
      distanciaOdometro,
      discrepancia: discrepanciaPorcentaje,
      alertaDiscrepancia 
    },
    resultado: 'success',
    ip: getClientIp(req),
    metadata: alertaDiscrepancia ? { alerta: 'Discrepancia > 20%' } : undefined
  });
  
  res.json({ 
    success: true, 
    data: registroVehiculo,
    alertas: alertaDiscrepancia ? [{
      tipo: 'discrepancia',
      mensaje: `Diferencia de ${discrepanciaPorcentaje.toFixed(1)}% entre GPS y odómetro`
    }] : []
  });
});
```

### Función auxiliar: Calcular distancia con Haversine

```typescript
function calcularDistanciaHaversine(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): number {
  const R = 6371; // Radio de la Tierra en km
  
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  const dLat = toRad(destino.lat - origen.lat);
  const dLng = toRad(destino.lng - origen.lng);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(origen.lat)) * 
    Math.cos(toRad(destino.lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distancia en km
}
```

### Función auxiliar: Guardar fotos en el sistema de archivos

```typescript
import fs from 'fs/promises';
import path from 'path';

async function guardarFotosVehiculo(
  registroId: string,
  fotoBase64Inicio: string,
  fotoBase64Fin: string
): Promise<{ inicio: string; fin: string }> {
  const uploadsDir = path.join(__dirname, 'uploads', 'vehiculos', registroId);
  
  // Crear directorio si no existe
  await fs.mkdir(uploadsDir, { recursive: true });
  
  // Extraer el contenido base64 (remover "data:image/jpeg;base64,")
  const extraerBase64 = (dataUrl: string) => {
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
  };
  
  const base64Inicio = extraerBase64(fotoBase64Inicio);
  const base64Fin = extraerBase64(fotoBase64Fin);
  
  // Guardar archivos
  const rutaInicio = path.join(uploadsDir, 'odometro_inicio.jpg');
  const rutaFin = path.join(uploadsDir, 'odometro_fin.jpg');
  
  await fs.writeFile(rutaInicio, base64Inicio, 'base64');
  await fs.writeFile(rutaFin, base64Fin, 'base64');
  
  // Retornar rutas relativas para la BD
  return {
    inicio: `/uploads/vehiculos/${registroId}/odometro_inicio.jpg`,
    fin: `/uploads/vehiculos/${registroId}/odometro_fin.jpg`
  };
}

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### `GET /api/viaje/active/:usuario`
```typescript
app.get('/api/viaje/active/:usuario', requireAuth, (req, res) => {
  try {
    const { usuario } = req.params;
    
    // Verificar autorización
    if (req.user?.rol !== 'Admin' && req.user?.usuario !== usuario) {
      return res.status(403).json({ 
        success: false, 
        error: 'No autorizado' 
      });
    }
    
    const viajeActivo = data.viajesActivos.find(
      v => v.usuario === usuario && v.activo
    );
    
    if (viajeActivo) {
      res.json({ success: true, data: viajeActivo });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener viaje activo' 
    });
  }
});
```

### Ruta adicional: Ver historial de viajes
```typescript
app.get('/api/vehiculo/registros/:proyectoId', requireAuth, (req, res) => {
  try {
    const { proyectoId } = req.params;
    
    const registros = (data.registrosVehiculo || [])
      .filter(r => r.proyectoId === proyectoId)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10); // Últimos 10
    
    res.json({ success: true, data: registros });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener registros' 
    });
  }
});
```

---

## Visualización en Panel de Admin

### Actualizar `PanelCostos.tsx` para incluir viajes:

```tsx
// Filtro adicional
<select>
  <option value="all">Todos los conceptos</option>
  <option value="MO">Mano de Obra</option>
  <option value="Insumo">Insumos</option>
  <option value="Vehículo">Vehículo</option>
</select>

// Tabla con columnas específicas para vehículos
{concepto === 'Vehículo' && (
  <>
    <td>{registro.distanciaCalculada} km</td>
    <td>{registro.combustibleLitros || '-'} L</td>
    <td>{formatGuaranies(registro.combustibleCosto)}</td>
  </>
)}
```

---

## Checklist de Implementación

### Fase 1: Dependencias y Estructura Base (1 día)
- [ ] Instalar `tesseract.js`: `npm install tesseract.js`
- [ ] Actualizar `types.ts` con interfaces nuevas
- [ ] Agregar `registrosVehiculo` y `viajesActivos` a `database.json`
- [ ] Crear directorio `uploads/vehiculos/` para fotos
- [ ] Crear validaciones en `server-validation.ts`

### Fase 2: Backend (2-3 días)
- [ ] Función `calcularDistanciaHaversine()`
- [ ] Función `guardarFotosVehiculo()` con sistema de archivos
- [ ] Ruta `POST /api/viaje/start` con foto y km inicial
- [ ] Ruta `POST /api/viaje/stop` con foto, km final y discrepancia
- [ ] Ruta `GET /api/viaje/active/:usuario`
- [ ] Ruta `GET /api/vehiculo/registros/:proyectoId`
- [ ] Servir archivos estáticos: `app.use('/uploads', express.static(...))`
- [ ] Logs de auditoría para viajes

### Fase 3: Frontend - Hooks y Utilidades (2 días)
- [ ] Hook `useGPS()` con permisos
- [ ] Hook `useCameraCapture()` con OCR Tesseract
- [ ] Hook `useViaje()` con timer integrado
- [ ] Componente `ModalIniciarViaje` con captura de foto
- [ ] Componente `ModalFinalizarViaje` con detección de discrepancias
- [ ] Componente `HistorialViajes` para ver últimos registros

### Fase 4: Integración en Registro Operativo (1-2 días)
- [ ] Agregar tab "Vehículo" en sistema de tabs existente
- [ ] Integrar hooks en `RegistroOperativo.tsx`
- [ ] Gestión de permisos (solo ver propios viajes)
- [ ] Estados de loading y errores
- [ ] Validaciones de formulario

### Fase 5: Admin Panel (1-2 días)
- [ ] Columnas específicas para concepto "Vehículo" en tabla
- [ ] Mostrar fotos del odómetro (lightbox/modal)
- [ ] Indicador visual de discrepancias
- [ ] Filtro por tipo de registro
- [ ] Exportación a Excel con datos de vehículo
- [ ] Vista de mapa (opcional) con ruta GPS

### Fase 6: Testing y Ajustes (1-2 días)
- [ ] Probar en móvil/tablet con GPS real
- [ ] Verificar cálculo de distancia Haversine
- [ ] Probar OCR con fotos reales de odómetros
- [ ] Persistencia híbrida (localStorage + servidor)
- [ ] Autorización (solo ver propios viajes)
- [ ] Manejo de errores (GPS no disponible, foto borrosa, etc.)
- [ ] Optimización de tamaño de imágenes (compresión)

---

## Mejoras Futuras (Opcional)

1. **Mapa visual del recorrido** (Google Maps embed con polyline)
2. **Mejorar OCR con pre-procesamiento** (contraste, nitidez, threshold)
3. **OCR con Google Gemini Vision** (mejor precisión que Tesseract)
4. **Compresión automática de imágenes** (reducir tamaño antes de guardar)
5. **Integración OBD-II** (para flotas con dispositivos Bluetooth)
6. **Alertas de consumo excesivo** (IA detecta anomalías)
7. **Geocoding inverso** (mostrar direcciones en vez de coordenadas)
8. **Notificaciones push** al admin cuando hay discrepancia > 30%
9. **Dashboard de métricas de flota** (consumo promedio, km totales, costos)
10. **Exportar ruta a Google Maps** (botón para ver recorrido en Maps)

---

## Notas Importantes

- **Permisos GPS**: Solicitar permiso al usuario la primera vez (HTTPS requerido)
- **Permisos Cámara**: El navegador pedirá acceso a la cámara automáticamente
- **Compresión de fotos**: Considerar comprimir imágenes antes de guardar (target: ~200KB)
- **Fallback manual**: Si GPS o cámara fallan, permitir ingreso manual de km
- **Privacidad**: Solo guardar coordenadas inicio/fin, no trayectoria completa
- **Seguridad**: Validar formato de imágenes en backend (evitar uploads maliciosos)
- **Backup**: Incluir carpeta `uploads/` en estrategia de backup
- **OCR Accuracy**: Tesseract funciona mejor con buena iluminación y enfoque
- **Costo**: Todo gratis excepto si usás Google Distance Matrix API (opcional)
- **Discrepancias**: Normal hasta 15% por GPS drift; > 20% requiere verificación

---

## Resultado Esperado

El usuario podrá:
1. Iniciar un viaje desde el módulo Registro
2. Ver tiempo transcurrido en tiempo real
3. Finalizar viaje y obtener distancia automática
4. Ingresar combustible consumido
5. Ver historial de viajes por proyecto
6. Admin puede ver todos los viajes en el panel

**Tiempo estimado total: 8-12 días de desarrollo**

**Stack tecnológico:**
- GPS: Navigator API (nativo del navegador)
- Cámara: HTML5 File Input / MediaDevices API
- OCR: Tesseract.js (cliente) o Google Gemini Vision (servidor)
- Distancia: Fórmula Haversine (matemática)
- Fotos: Sistema de archivos local (`/uploads/vehiculos/`)
- Control cruzado: Comparación GPS vs Odómetro con alertas automáticas

