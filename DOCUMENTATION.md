# Sistema aFull — Documentación Técnica Completa
> **Versión:** 2.0.0 · **Fecha:** 2026-06-18 · **Stack:** React 19 + Vite 6 + Express 4 + TypeScript 5.8

---

## ?? Índice

1. [Visión General](#1-visión-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [Módulos del Frontend](#5-módulos-del-frontend)
6. [API del Backend Express](#6-api-del-backend-express)
7. [Modelo de Datos](#7-modelo-de-datos)
8. [Flujo de Datos End-to-End](#8-flujo-de-datos-end-to-end)
9. [Sistema de Autenticación](#9-sistema-de-autenticación)
10. [Guía de Onboarding para Nuevos Devs](#10-guía-de-onboarding-para-nuevos-devs)
11. [Architecture Decision Records ADRs](#11-architecture-decision-records-adrs)
12. [Roadmap y Próximos Pasos](#12-roadmap-y-próximos-pasos)

---

## 1. Visión General

**Sistema aFull** es una plataforma de **gestión operativa automatizada** diseñada para empresas de servicios (instalación de vinilos, ploteo, cartelería). Su objetivo principal es **reemplazar completamente la carga manual de planillas Excel** (históricamente gestionadas en el archivo `Kevin.xlsx`) con un sistema web en tiempo real.

### Problema que resuelve
Antes del sistema, un operador debía:
1. Abrir Excel manualmente al finalizar cada jornada
2. Registrar hora de inicio/fin de cada tarea por colaborador
3. Calcular horas totales y costos manualmente
4. Consolidar insumos usados en otra planilla
5. Exportar todo a PDF para facturar al cliente

**Sistema aFull automatiza los pasos 1-4 en tiempo real** y genera reportes y pre-facturas en 1 clic.

### Usuarios objetivo
| Rol | Acceso | Funciones |
|-----|--------|-----------|
| admin | Completo | Todos los módulos + reseteo de BD |
| kevin / rodrigo | Operativo | Registro de horas e insumos |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Runtime Frontend | React | 19.0.1 | Concurrent features, Server Components ready |
| Build Tool | Vite | 6.2.3 | HMR instantáneo, soporte ESM nativo |
| Backend | Express | 4.21.2 | API REST liviana, integración Vite middleware |
| Lenguaje | TypeScript | 5.8 | Tipado end-to-end compartido (mismo types.ts) |
| Estilos | Tailwind CSS v4 | 4.1.14 | Utility-first, @theme custom tokens |
| Animaciones | Motion (motion/react) | 12.23.24 | Animaciones productivas con AnimatePresence |
| Gráficos | Recharts | 3.8.1 | Composable, compatible con Recharts v3 |
| Excel Parser | xlsx (SheetJS) | 0.18.5 | Parseo de .xlsx/.xls/.csv sin binarios nativos |
| IA | Google GenAI SDK | 2.4.0 | Enriquecimiento de descripciones informales |
| Dev Server | tsx | 4.21.0 | Ejecución directa de TypeScript sin compilación |
| Persistencia | JSON file (database.json) | — | Sin deps externas, portátil, migrable |

---

## 3. Arquitectura del Sistema

```
BROWSER (Puerto 3000)
  React SPA (Vite)
    Login ? App Shell ? [5 Módulos]
      |
      | fetch() HTTP
      |
  Express Server (server.ts)
    Middleware:
      express.json()           (body parsing)
      multer()                 (file upload)
      vite.middlewares         (dev: HMR + SPA)
    Routes:
      GET  /api/data           ? readDb()
      POST /api/registros      ? writeDb()
      DEL  /api/registros/:id  ? writeDb()
      POST /api/save-state     ? writeDb()
      POST /api/import-excel   ? xlsx.read() + writeDb()
      POST /api/gemini-enrich  ? GoogleGenAI.generate()
      POST /api/clear          ? writeDb(initialData)
    Persistencia:
      database.json            (JSON file DB)
```

### Patrón de comunicación
- El frontend React **nunca escribe en disco directamente**.
- Todo cambio de estado pasa por `fetch('/api/...')` ? Express ? `writeDb()`.
- El estado reactivo de React se sincroniza optimisticamente: se actualiza el estado local primero y se confirma con el servidor.

---

## 4. Estructura de Archivos

```
sistema-afull-googleia/
¦
+-- server.ts                   ? Backend: Express + API REST + Vite middleware
+-- database.json               ? Base de datos (auto-generada al primer arranque)
+-- .env                        ? Variables de entorno (GEMINI_API_KEY)
+-- .env.example                ? Template de variables
+-- package.json                ? Dependencias y scripts
+-- vite.config.ts              ? Configuración de Vite (SPA mode)
+-- tsconfig.json               ? Configuración TypeScript
¦
+-- src/
¦   +-- main.tsx                ? Entry point React (ReactDOM.createRoot)
¦   +-- App.tsx                 ? Shell principal: Auth + Router por tabs + Estado global
¦   +-- index.css               ? Design system: Glass & Glow Bento (Tailwind v4)
¦   +-- types.ts                ? Interfaces TypeScript compartidas frontend/backend
¦   ¦
¦   +-- components/
¦       +-- Login.tsx             ? Pantalla de autenticación Glass & Glow
¦       +-- Dashboard.tsx         ? Panel operativo con métricas y gráficos Recharts
¦       +-- RegistroOperativo.tsx ? Timer MO + Carga de Insumos (MÓDULO CENTRAL)
¦       +-- ExcelImporter.tsx     ? Importador Drag & Drop del Excel Kevin
¦       +-- Reportes.tsx          ? Reportería filtrada + Pre-Facturación con Markup
¦       +-- AdminPanel.tsx        ? CRUD de Clientes, Proyectos, Colaboradores
¦
+-- assets/                     ? Recursos estáticos
```

---

## 5. Módulos del Frontend

### 5.1 Login.tsx — Autenticación
**Ruta visual:** Pantalla inicial (sin autenticación)

| Aspecto | Detalle |
|---------|---------|
| Tipo | Client-side auth (demo) |
| Persistencia | sessionStorage — se limpia al cerrar el browser |
| Usuarios demo | admin/admin123, kevin/kevin123, rodrigo/rodrigo123 |
| Estado guardado | { nombre, rol, token } serializado en JSON |
| Diseño | Glass panel centrado, logo animado, hint de credenciales |

**Flujo:**
```
Usuario ingresa credenciales
    ? Validación contra array DEMO_USERS
    ? Genera token fake: btoa(usuario:rol:timestamp)
    ? onLoginSuccess({ nombre, rol, token })
    ? App.tsx guarda en sessionStorage y carga datos
```

---

### 5.2 Dashboard.tsx — Panel Operativo
**Tab:** "Panel" (icono: Tv)

**Métricas calculadas (useMemo):**
| Métrica | Fórmula |
|---------|---------|
| Total Horas MO | Suma de registros[concepto=MO].hsTotal |
| Costo Acumulado | Suma de todos los registros.total |
| Proyectos Activos | proyectos filtrados por estado="En Proceso" |
| Clientes Cartera | clientes.length |

**Gráficos (Recharts):**
- AreaChart — Evolución financiera acumulada por día
- PieChart — Distribución de costos por cliente
- BarChart — Horas MO por proyecto

---

### 5.3 RegistroOperativo.tsx — Módulo Central ?
**Tab:** "Registro" (icono: ClipboardList)

Este es el módulo que reemplaza directamente el workflow del Excel Kevin.

#### Panel A — Mano de Obra (Timer)

Estados del Timer:
- LISTO ? botón "Iniciar Tarea"
- EN CURSO ? cronómetro live + ring azul giratorio
- FINALIZADO ? timestamps de inicio/fin + botón "Registrar"

Cálculo de costo en vivo:
```
costoMO = Math.round(timerSeconds / 60) × precioUnitario
```

Auto-fill tarifa: Al seleccionar un colaborador del dropdown, se autocompleta moPrecioUnitario con su tarifaSugerida.

#### Panel B — Insumos

- Lista dinámica de filas (agregar/eliminar con animación popLayout)
- Cada fila: descripcion + cantidad + precioUnitario ? subtotal calculado
- Submit en bloque: itera las filas válidas y hace POST por cada una

---

### 5.4 ExcelImporter.tsx — Flujo Kevin
**Tab:** "Flujo Kevin" (icono: FileSpreadsheet)

**Flujo de importación:**
```
1. Drag & Drop o selector de archivo (.xlsx / .xls / .csv)
2. POST /api/import-excel (multipart/form-data)
3. Server parsea con xlsx.read() ? extracción heurística
4. Response: { parsedItems, summary, updatedDbState }
5. UI muestra previsualización de filas detectadas
6. Opcional: POST /api/gemini-enrich para enriquecer descripciones
7. Botón "Confirmar Importación" ? POST /api/save-state
```

---

### 5.5 Reportes.tsx — Reportería & Pre-Facturación
**Tab:** "Reportes" (icono: BarChart2)

Sub-tab Exportar: Filtros por Cliente, Proyecto, Concepto, Fecha. Exporta a .xlsx o PDF.

Sub-tab Pre-Factura:
```
Costo Base = Suma de registros del proyecto seleccionado
Markup     = Costo Base × (% configurable)
Precio Venta = Costo Base + Markup
```

---

### 5.6 AdminPanel.tsx — Directorio BD
**Tab:** "Directorio" (icono: SlidersHorizontal)

| Sub-tab | Función |
|---------|---------|
| Registro manual | Formulario completo (alternativa al timer) |
| Clientes | Alta de nuevos clientes |
| Proyectos | Alta de proyectos asociados a clientes |
| Colaboradores | Alta de colaboradores con tarifa sugerida |
| Peligro | Reseteo de BD a datos iniciales |

---

## 6. API del Backend Express

Todos los endpoints corren en http://localhost:3000

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | /api/data | Retorna DatabaseState completa |
| POST | /api/registros | Agrega un registro individual |
| DELETE | /api/registros/:id | Elimina registro por ID |
| POST | /api/save-state | Reemplaza BD completa (importación masiva) |
| POST | /api/import-excel | Parsea archivo Excel, retorna preview |
| POST | /api/gemini-enrich | Enriquece descripciones con Gemini AI |
| POST | /api/clear | Resetea BD a datos iniciales |

---

## 7. Modelo de Datos

Definido en src/types.ts (compartido frontend/backend):

```typescript
interface Cliente {
  id: string;           // "cli_abc123"
  nombre: string;       // "Empresa 1 S.A."
  codigo?: string;      // "EMP1"
  fechaCreacion: string; // "2026-06-18"
}

interface Proyecto {
  id: string;
  clienteId: string;    // FK ? Cliente.id
  nombre: string;
  presupuesto?: number;
  estado: 'Pendiente' | 'En Proceso' | 'Completado';
  fechaInicio: string;
}

interface Colaborador {
  id: string;
  nombre: string;
  tarifaSugerida: number; // Tarifa por minuto
  rol?: string;
}

interface RegistroItem {
  id: string;
  clienteId: string;
  clienteNombre: string;    // Denormalizado
  proyectoId: string;
  proyectoNombre: string;   // Denormalizado
  fecha: string;            // "YYYY-MM-DD"
  concepto: 'MO' | 'Insumo' | 'Otros';
  descripcion: string;
  colaboradorId?: string;
  hsInicio?: string;        // "09:30"
  hsFin?: string;           // "11:45"
  hsTotal?: number;         // horas decimales
  cantidad: number;         // minutos (MO) o unidades (Insumos)
  precioUnitario: number;
  total: number;
  origen: 'Manual' | 'Excel Kevin';
  fechaImportacion?: string;
}
```

### Relaciones
```
Cliente (1) ---- (N) Proyecto
Proyecto (1) ---- (N) RegistroItem
Colaborador (1) ---- (N) RegistroItem [solo MO]
```

---

## 8. Flujo de Datos End-to-End

### Flujo A: Registro de Horas con Timer
```
1. Seleccionar Cliente + Proyecto
2. Iniciar Timer ? tick cada 1 segundo
3. Finalizar Timer ? calcular horas y costo
4. Completar formulario (Colaborador, Descripción, Tarifa)
5. POST /api/registros ? Express valida + writeDb()
6. Estado local actualizado optimisticamente
7. Timer se resetea
```

### Flujo B: Importación Excel Kevin
```
1. Drag & Drop archivo Excel
2. POST /api/import-excel (multipart)
3. Servidor parsea filas y resuelve entidades
4. Preview en UI con detección de nuevos Clientes/Proyectos/Colaboradores
5. Opcional: enriquecimiento Gemini AI
6. POST /api/save-state confirma importación
7. Redirección al Dashboard
```

### Flujo C: Pre-Factura
```
1. Seleccionar Proyecto
2. Ajustar % Markup
3. Sistema calcula automáticamente: Costo Base + Markup = Precio de Venta
4. Imprimir / Generar PDF con window.print()
5. Guardar Markup en localStorage
```

---

## 9. Sistema de Autenticación

**Estado actual:** Auth demo client-side. Sin validación en servidor.

```
Login ? sessionStorage.setItem("afull_session", JSON.stringify(user))
App.tsx ? useEffect: sessionStorage.getItem("afull_session")
Logout ? sessionStorage.removeItem + setSession(null)
```

**AVISO:** Para producción real se requiere JWT validation en Express middleware (ver ADR-0003).

---

## 10. Guía de Onboarding para Nuevos Devs

### Setup inicial
```bash
cd "sistema-afull-googleia"
cp .env.example .env
# Editar .env: GEMINI_API_KEY=tu-clave-real (opcional)
npm install
npm run lint     # Verificar TypeScript
npm run dev      # ? http://localhost:3000
```

### Credenciales demo
- admin / admin123
- kevin / kevin123
- rodrigo / rodrigo123

### Scripts disponibles
| Comando | Descripción |
|---------|-------------|
| npm run dev | Servidor de desarrollo (HMR activo) |
| npm run build | Compilar frontend + backend |
| npm start | Servidor de producción |
| npm run lint | Verificar TypeScript sin compilar |
| npm run clean | Limpiar directorio dist/ |

### Mapa de archivos por necesidad
| Necesito cambiar... | Archivo |
|---------------------|---------|
| API / lógica de negocio | server.ts |
| Datos iniciales / seed | server.ts ? initialData (línea 30) |
| Tipos de datos | src/types.ts |
| Navegación y estado global | src/App.tsx |
| Design system | src/index.css |
| Timer de MO + Insumos | src/components/RegistroOperativo.tsx |
| Dashboard con gráficos | src/components/Dashboard.tsx |
| Importador Excel | src/components/ExcelImporter.tsx |
| Reportes y pre-facturas | src/components/Reportes.tsx |
| Pantalla de login | src/components/Login.tsx |

---

## 11. Architecture Decision Records (ADRs)

### ADR-0001: Express + Vite sobre Next.js
**Fecha:** 2026-06-18 | **Status:** accepted

**Contexto:** El proyecto fue generado por Google AI Studio con Express + Vite. Evaluamos migrar a Next.js.

**Decisión:** Mantener Express + Vite standalone para sistema-afull-googleia.

**Por qué no Next.js:** Sistema interno sin SEO; Next.js agrega complejidad sin beneficio operativo real.

**Consecuencias:**
- (+) Deploy más simple (un proceso Node.js)
- (+) Sin overhead de hidratación SSR
- (-) No deployable en Vercel sin adaptaciones serverless

---

### ADR-0002: JSON file como base de datos
**Fecha:** 2026-06-18 | **Status:** accepted

**Contexto:** Se necesita persistencia simple para ~100 registros/semana.

**Decisión:** Usar database.json leído/escrito con fs.readFileSync/writeFileSync.

**Por qué no PostgreSQL/Prisma:** Over-engineering para el volumen actual. Migración planificada en v3.0.

**Por qué no SQLite:** Requiere binarios nativos, problemas en Windows.

**Consecuencias:**
- (+) Zero infrastructure, funciona out-of-the-box
- (+) database.json auditable, copiable y restaurable manualmente
- (-) Sin transacciones (riesgo de corrupción en escrituras concurrentes)
- (-) Performance degrada si supera ~50.000 filas

---

### ADR-0003: Auth client-side sin validación en servidor
**Fecha:** 2026-06-18 | **Status:** accepted (temporal)

**Decisión:** Login solo client-side con sessionStorage. Los endpoints no validan tokens.

**Mitigación:** Sistema desplegado solo en LAN, no expuesto a internet.

**Consecuencias:**
- (+) Implementación rápida y sin fricción
- (-) Cualquier usuario con la URL accede a la API directamente
- Marcado para revisión en v3.0 con JWT en Express middleware

---

### ADR-0004: Cherry-pick de lógica Google Studio
**Fecha:** 2026-06-18 | **Status:** accepted

**Decisión:** Mantener la arquitectura Express de Google Studio y mejorar sus componentes, en lugar de portar todo a Next.js.

**Consecuencias:**
- (+) Preservamos la lógica heurística de detección de colaboradores e IA Gemini
- (-) Dos codebases conviven temporalmente (app-unificada + sistema-afull-googleia)

---

## 12. Roadmap y Próximos Pasos

### v2.1 (Próxima iteración)
- [ ] Auth real con JWT en Express middleware
- [ ] Detección de duplicados en importación Excel
- [ ] Notificaciones toast reemplazando alert() nativo
- [ ] Paginación en tabla del historial operativo

### v2.2
- [ ] Exportación PDF real con jspdf o puppeteer
- [ ] Modo offline con Service Worker
- [ ] Soporte multi-usuario con lock optimista

### v3.0 (Migración a Producción)
- [ ] Migrar a PostgreSQL + Prisma
- [ ] Unificar con app-unificada (Next.js App Router)
- [ ] Deploy en Vercel + Supabase
- [ ] PWA móvil para registro de horas desde el campo

---

*Documentación generada con las skills architecture-decision-records, code-tour y codebase-onboarding del framework ECC.*
