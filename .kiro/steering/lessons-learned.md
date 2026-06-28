---
inclusion: auto
description: Project-specific patterns, preferences, and lessons learned over time (user-editable)
---

# Lessons Learned

This file captures project-specific patterns, coding preferences, common pitfalls, and architectural decisions that emerge during development. It serves as a workaround for continuous learning by allowing you to document patterns manually.

**How to use this file:**
1. The `extract-patterns` hook will suggest patterns after agent sessions
2. Review suggestions and add genuinely useful patterns below
3. Edit this file directly to capture team conventions
4. Keep it focused on project-specific insights, not general best practices

---

## Project-Specific Patterns

*Document patterns unique to this project that the team should follow.*

### Unified Data View Pattern (Historial Operativo)
**Context**: Dashboard displays operational history combining MO (Labor), Insumos (Materials), and Vehículos (Vehicle trips).

**Pattern**: Create a unified array by mapping different data structures to a common interface before filtering/sorting/displaying.

**Implementation**:
```typescript
// Step 1: Map secondary data to match primary interface
const unifiedRegistros = useMemo(() => {
  const vehicleAsRegistros: RegistroItem[] = (data.registrosVehiculo || []).map(v => ({
    id: v.id,
    clienteId: v.clienteId,
    clienteNombre: v.clienteNombre,
    proyectoId: v.proyectoId,
    proyectoNombre: v.proyectoNombre,
    fecha: v.fecha,
    concepto: 'Vehículo' as any, // Type extension
    descripcion: `Viaje: ${v.proyectoNombre} - ${v.distanciaOdometro}km - ${v.combustibleLitros || 0}L`,
    cantidad: v.distanciaOdometro, // km
    precioUnitario: v.distanciaOdometro > 0 ? v.combustibleCosto / v.distanciaOdometro : 0,
    total: v.combustibleCosto,
    origen: v.origen,
    fechaImportacion: v.fechaImportacion
  }));
  
  // Step 2: Combine arrays
  return [...data.registros, ...vehicleAsRegistros];
}, [data.registros, data.registrosVehiculo]);

// Step 3: Use unified array for all filtering/sorting/display logic
const filteredRegistros = useMemo(() => {
  return unifiedRegistros.filter(r => {
    if (filterConcepto && r.concepto !== filterConcepto) return false;
    // ... other filters
    return true;
  });
}, [unifiedRegistros, filterConcepto, ...otherDeps]);
```

**UI Considerations**:
- Add filter button for new concept type with distinct color (pink for Vehículos)
- Handle concept-specific display in table cells (km vs hours vs units)
- Disable edit operations for read-only record types
- Update counter to reflect unified total count

**Benefits**:
- Single filtering/sorting/pagination logic
- Consistent UI experience across all record types
- Easy to add new record types in the future

### Example: API Error Handling
```typescript
// Always use our custom ApiError class for consistent error responses
throw new ApiError(404, 'Resource not found', { resourceId });
```

---

## Code Style Preferences

*Document team preferences that go beyond standard linting rules.*

### Data Refresh Callback Threading Pattern
**Issue**: CRUD operations in nested components fail when parent's data refresh function isn't passed through the component hierarchy.

**Pattern**: When adding CRUD operations (edit, delete) to a deeply nested component, ensure the data refresh callback is threaded through all intermediate components.

**Example Flow**:
```typescript
// Top-level (App.tsx)
const fetchDbState = async () => { /* reload data */ };
<AdminPanel onRefresh={fetchDbState} />

// Intermediate (AdminPanel.tsx)
interface AdminPanelProps {
  onRefresh?: () => Promise<void>;
}
<VehiculosAdminView onRefresh={onRefresh} />

// Leaf component (VehiculosAdminView.tsx)
const submitEdit = async () => {
  await authFetchJSON(/* update */);
  await onRefresh(); // ← Refresh parent data
};
```

**Checklist for CRUD components**:
- Add `onRefresh?: () => Promise<void>` to component props
- Pass `onRefresh` through all intermediate components
- Call `await onRefresh()` after successful create/update/delete
- Provide fallback: `onRefresh || (async () => {})` to prevent runtime errors

### Example: Import Organization
```typescript
// Group imports: external, internal, types
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { User } from '@/types';
```

---

## Kiro Hooks

### `install.sh` is additive-only — it won't update existing installations
The installer skips any file that already exists in the target (`if [ ! -f ... ]`). Running it against a folder that already has `.kiro/` will not overwrite or update hooks, agents, or steering files. To push updates to an existing project, manually copy the changed files or remove the target files first before re-running the installer.

### README.md mirrors hook configurations — keep them in sync
The hooks table and Example 5 in README.md document the action type (`runCommand` vs `askAgent`) and behavior of each hook. When changing a hook's `then.type` or behavior, update both the hook file and the corresponding README entries to avoid misleading documentation.

### Prefer `askAgent` over `runCommand` for file-event hooks
`runCommand` hooks on `fileEdited` or `fileCreated` events spawn a new terminal session every time they fire, creating friction. Use `askAgent` instead so the agent handles the task inline. Reserve `runCommand` for `userTriggered` hooks where a manual, isolated terminal run is intentional (e.g., `quality-gate`).

---

## Common Pitfalls

*Document mistakes that have been made and how to avoid them.*

### Express Middleware Chain: requireAuth + requireAdmin
**Issue**: Using only `requireAdmin` middleware causes 403 errors because `req.user` is undefined.

**Root Cause**: `requireAdmin` checks `req.user.rol === 'Admin'`, but `req.user` is only populated by the `requireAuth` middleware.

**Correct Pattern**:
```typescript
// ✅ CORRECT - Always chain requireAuth before requireAdmin
app.patch('/api/admin-only/:id', requireAuth, requireAdmin, handler);
app.delete('/api/admin-only/:id', requireAuth, requireAdmin, handler);

// ❌ WRONG - Missing requireAuth causes undefined req.user
app.patch('/api/admin-only/:id', requireAdmin, handler);
```

**Code Review Checklist**:
- Verify all admin-only endpoints have `requireAuth, requireAdmin` chain
- Never use `requireAdmin` as standalone middleware
- Same applies to any custom role-checking middleware that depends on `req.user`

### Example: Database Transactions
- Always wrap multiple database operations in a transaction
- Remember to handle rollback on errors
- Don't forget to close connections in finally blocks

---

## Architecture Decisions

*Document key architectural decisions and their rationale.*

### HMR Limitations: Express Route Definitions
**Issue**: Middleware changes on Express routes don't apply with HMR - require full server restart.

**What HMR reloads**:
- ✅ Handler function logic inside routes
- ✅ Imported utility functions
- ✅ Frontend React components

**What requires restart**:
- ❌ Route middleware chains (`app.get('/path', middleware1, middleware2, handler)`)
- ❌ Adding/removing/reordering middlewares
- ❌ Route path changes
- ❌ Security middleware configuration (rate limiters, CORS, helmet, CSRF)
- ❌ Global middleware like `express.json()`, `cookieParser()`

**Action**: After modifying route definitions, middleware chains, or security configurations in `server.ts`, always restart the dev server with `npm run dev` instead of relying on HMR.

### Testing with Framer Motion AnimatePresence
**Issue**: Tests fail to find rendered elements that are wrapped in `<AnimatePresence>` from Framer Motion, even though the component logic is correct.

**Root Cause**: 
- AnimatePresence delays the DOM insertion/removal of elements for animation effects
- React Testing Library's default `waitFor` timeout (1000ms) is too short
- `getByText` queries execute synchronously and miss animated elements

**Pattern - Test Components with Animations**:
```typescript
// ❌ WRONG - Fails with AnimatePresence
const message = screen.getByText(/Error message/i);
expect(message).toBeInTheDocument();

// ✅ CORRECT - Use findByText (async) with extended timeout
const message = await screen.findByText(
  /Error message/i,
  {},
  { timeout: 5000 } // Increase from default 1000ms
);
expect(message).toBeInTheDocument();

// ✅ ALTERNATIVE - Increase waitFor timeout
await waitFor(() => {
  expect(screen.getByText(/Error message/i)).toBeInTheDocument();
}, { timeout: 5000 });

// ✅ WHEN MULTIPLE RENDERS - Use getAllByText
await waitFor(() => {
  const elements = screen.getAllByText(/Total: Gs\. 1\.000/i);
  expect(elements.length).toBeGreaterThan(0);
}, { timeout: 5000 });
```

**Pattern - Test Form Inputs with State Updates**:
```typescript
// ❌ WRONG - State may not propagate immediately
await user.type(input, '500');
expect(screen.getByText(/Total: 500/i)).toBeInTheDocument(); // May fail

// ✅ CORRECT - Add delay after input for React state propagation
await user.type(input, '500');
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms for state update
await waitFor(() => {
  expect(screen.getByText(/Total: 500/i)).toBeInTheDocument();
}, { timeout: 5000 });
```

**When to Apply**:
- Any component using `<AnimatePresence>` or `motion.*` components
- Feedback messages that appear/disappear dynamically
- Form validations with animated error states
- Modals or dialogs with entrance/exit animations

**Files Affected**:
- `RegistroOperativo.tsx` - Feedback messages in AnimatePresence
- `Dashboard.tsx` - Modal animations
- All test files testing animated components

**Debugging Tip**: If a test fails with "Unable to find element" but the component works in browser, check for AnimatePresence wrappers and increase test timeouts.

---

### Database Migration: JSON to PostgreSQL + Prisma ORM
**Decision**: Migrate from local `database.json` file to Supabase PostgreSQL using Prisma ORM.

**Context**: Original system used JSON file with mutex locks for concurrent writes. As data grew, this became a bottleneck and single point of failure.

**Migration Strategy**:
1. **Incremental Refactoring**: Refactor critical endpoints first (GET /api/data, CRUD registros) while keeping legacy endpoints (timers, vehicle, Excel import) on JSON temporarily
2. **Backward Compatibility**: Keep `readDb()`/`writeDb()` functions during transition for non-refactored endpoints
3. **Type Conversion Helper**: Create `convertPrismaToFrontend()` helper to map Prisma types (Decimal, Date, enums) to frontend format
4. **Enum Mapping**: Map Prisma SCREAMING_SNAKE_CASE enums to frontend "Title Case" strings

**Prisma Best Practices Learned**:
```typescript
// ✅ Use Decimal for financial precision
cantidad: new Decimal(rawItem.cantidad)
precioUnitario: new Decimal(rawItem.precioUnitario)
total: new Decimal(rawItem.total)

// ✅ Parallel queries for performance
const [clientes, proyectos, colaboradores, registros] = await Promise.all([
  prisma.cliente.findMany(),
  prisma.proyecto.findMany(),
  prisma.colaborador.findMany(),
  prisma.registro.findMany()
]);

// ✅ Handle nullable fields explicitly
colaboradorId: rawItem.colaboradorId || null, // Not undefined

// ✅ Convert Prisma results to frontend format
const data: DatabaseState = convertPrismaToFrontend(prismaData);
```

**Schema Design Decisions**:
- Use `Decimal` type for all financial fields (cantidad, precioUnitario, total) to prevent floating-point errors
- Store dates as `DateTime` in DB, convert to "YYYY-MM-DD" strings for frontend
- Use enums for concepto (MO/INSUMO/VEHICULO), estado (PENDIENTE/EN_PROCESO/COMPLETADO), origen (MANUAL/EXCEL)
- VARCHAR(50) for hsInicio/hsFin to handle decimal time values from Excel imports

**Migration Pitfalls Avoided**:
- ⚠️ Tests that mock `authFetchJSON` continue working - they pass data via props, not API calls
- ⚠️ Frontend receives same data structure via `convertPrismaToFrontend()` - no UI changes needed
- ⚠️ Audit logging, RBAC, and security validations preserved during migration
- ⚠️ `timersActivos` and `viajesActivos` kept as empty arrays for backward compatibility (not in Prisma schema yet)

**Cost Benefits**:
- Supabase Free Tier: $0/month for 500MB storage + 2GB bandwidth
- PostgreSQL connection pooling (better concurrency than file mutex)
- Auto backups and point-in-time recovery
- Upgrade path to $25/month paid tier when needed

**Rationale**: Supabase + Prisma provides production-grade scalability, type safety, and developer experience with minimal cost ($0 on free tier). Better than self-hosted PostgreSQL (ops overhead) or staying on JSON (scalability limits).

---

### Vitest Test Scope Pollution from ECC Subfolder
**Issue**: Running `vitest run` from the project root picks up ~170 test files inside the `ECC/` folder (an external tool repo installed as a subfolder), ballooning execution time from ~15s to 120s+.

**Root Cause**: Vitest's default glob pattern `**/*.test.*` traverses into `ECC/tests/` unless explicitly excluded.

**Fix**: Always run project-specific tests with an explicit path pattern:
```bash
# ✅ CORRECT — only project tests (~12 files, ~15s)
npx vitest run src/test/

# ✅ CORRECT — specific test file
npx vitest run src/test/Dashboard.test.tsx

# ❌ WRONG — picks up ECC/ tests too (~170 files, 120s+)
npx vitest run
```

**Alternative Fix**: Add `exclude` to `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/ECC/**']
  }
})
```

**When to Apply**: Any time you run tests, CI pipelines, or coverage reports.

---

### Pre-Migration Test Baseline: 8 Known Failing Tests
**Context**: After migrating to Supabase/Prisma, verified that the 8 failing tests are **preexisting bugs unrelated to the migration**.

**The 8 tests and their root causes**:
| Test | Root Cause |
|---|---|
| `Tab Navigation > should render all 3 tabs` | Ambiguous selector — 2 buttons match `/Mano de Obra/i`. Use `getAllByRole` |
| `Insumos Form > calculate total with multiple lines` | 2 elements match `Gs. 3.500` (line subtotal + grand total). Use `getAllByText` |
| `Insumos Form > validation error without descripcion` | AnimatePresence delay — use `findByText(..., {}, { timeout: 5000 })` |
| `Insumos Form > validation error with zero cantidad` | Same AnimatePresence delay pattern |
| `Form Submission > submit MO registro with timer data` | Timer state not propagated — `onAddRegistro` never called. Missing `act()` wrapper |
| `Edit Modal > populates modal fields` | Wrong registro opened — selector picks last item instead of first |
| `Edit Modal > validates required fields` | AnimatePresence delay on validation message |
| `Edit Modal > validates HH:MM format` | AnimatePresence delay on validation message |

**Key Insight**: These tests pass `data` via props to React components — they don't make real API calls. The Prisma/Supabase migration did not break any test.

---

### Driving the 30s Timer Guard in RegistroOperativo Tests
**Issue**: `handleSubmitMO` has a guard `if (timerSeconds < 30) return` and, while running, the cliente/proyecto selects are `disabled={timerRunning}`. This makes the MO submit flow nearly impossible to test with real or fake timers — fake timers + `userEvent` hang during the initial render.

**Pattern**: Pre-seed `localStorage` with a *completed* (stopped) timer. The `useTimer` hook initializes `timerSeconds`, `timerStart`, and `timerEnd` lazily from these keys on mount, so the guard passes and the selects stay enabled (timer not running).

```typescript
const now = new Date();
localStorage.setItem('afull_timer_admin_running', 'false');   // not running → selects enabled
localStorage.setItem('afull_timer_admin_paused', 'false');
localStorage.setItem('afull_timer_admin_seconds', '60');      // >= 30 → guard passes
localStorage.setItem('afull_timer_admin_start', new Date(now.getTime() - 60000).toISOString());
localStorage.setItem('afull_timer_admin_end', now.toISOString()); // timerEnd set → submit enabled
```

**Key**: The localStorage key prefix is `afull_timer_${currentUser.usuario}` (e.g. `afull_timer_admin`). Set these in the test body (after the `beforeEach` `localStorage.clear()`).

**Avoid**: `vi.useFakeTimers()` to advance the timer — it makes `userEvent` interactions hang in JSDOM.

### Always Restore Real Timers in afterEach
**Issue**: When a test calls `vi.useFakeTimers()` and throws before its cleanup line, fake timers leak into the next tests, causing unrelated `userEvent.type`/`selectOptions` calls to hang with "Test timed out in 5000ms".

**Fix**: Put the restore in `afterEach` so it runs even when a test fails:
```typescript
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers(); // harmless if timers were never faked; prevents cross-test leaks
});
```

### Disabled-Button Validation Is Tested by Asserting `toBeDisabled()`
**Issue**: The Insumos submit button is `disabled={insumosSubmitting || validLines.length === 0}`. Tests that expected clicking it to surface a validation message ("Ingresá al menos un insumo...") fail — the click never fires because the button is disabled.

**Pattern**: When the UX prevents invalid submission via a disabled button (rather than an error message), assert the disabled state directly:
```typescript
const submitButton = screen.getByRole('button', { name: /Registrar \d+ Insumo/i });
expect(submitButton).toBeDisabled();
```
The `validLines` filter requires `descripcion.trim() && cantidad > 0 && precioUnitario > 0`, so missing description OR zero quantity both keep the button disabled.

### Default Dashboard Sort Affects `getAllBy*` Index Order
**Issue**: The Dashboard table sorts by `fecha` descending by default. `getAllByLabelText(/Editar registro de MO/i)[0]` returns the *newest* record (reg3/proj3), not the first one defined in mock data (reg1/proj1).

**Fix**: Target a specific row by its full aria-label which embeds `proyectoNombre`:
```typescript
// aria-label format: `Editar registro de ${reg.concepto} - ${reg.proyectoNombre}`
const editButton = screen.getByLabelText('Editar registro de MO - Proyecto Alpha');
```

### Verify Validation Message Text Against the Component, Not Assumptions
**Issue**: Two Dashboard edit-modal tests asserted message text that did not match the component. The component renders `"Descripción requerida"` (not "La descripción es requerida") and `"Formato inválido. Use HH:MM (ej: 01:30)"` (not "Formato HH:MM inválido"). Use loose regexes (`/Descripción requerida/i`, `/Formato inválido/i`) anchored to the actual `validateEditForm` strings.

### Delegating Full Backend Migrations to Sub-Agents
**Context**: When migrating many endpoints at once (e.g., 14 endpoints from database.json → Prisma), doing it step-by-step in the main chat is slow and consumes context window. The `general-task-execution` sub-agent handles this better.

**Pattern**: Use `context-gatherer` first to map ALL the work (what endpoints exist, what schema changes are needed, what the existing migration pattern looks like), then hand the complete spec to `general-task-execution` with explicit instructions for each step.

**What to include in the sub-agent prompt**:
1. The exact Prisma schema additions needed (copy-paste ready)
2. The established migration pattern from already-migrated endpoints
3. Per-endpoint pseudo-code showing the Prisma equivalent
4. The bash commands to run after schema changes (`prisma db push`, `prisma generate`)
5. The verification commands (`vitest run src/test/`, `tsc --noEmit`)

**What NOT to do**: Don't ask the sub-agent to "figure out the pattern" — give it the pattern explicitly. The sub-agent reads `server.ts` and the context files you provide, but having the pattern spelled out in the prompt cuts execution time significantly.

### JSON Fields in Prisma for Complex Embedded Structures
**Issue**: The `ViajeActivo` model needs `ubicacionInicio` (GPS lat/lng), `pauseHistory` (array of PauseRecord), and similar — complex objects that don't need to be queried by their inner fields.

**Decision**: Store as `Json` type in Prisma instead of creating separate related models. This avoids over-engineering while preserving full data fidelity.

**Pattern**:
```prisma
// Prisma schema
pauseHistory    Json    @default("[]") @map("pause_history")
ubicacionInicio Json    @map("ubicacion_inicio")
```
```typescript
// Writing: pass the object directly — Prisma serializes it
await prisma.timerActivo.create({ data: { pauseHistory: [] } });

// Reading: cast to the TypeScript type
const history = timer.pauseHistory as PauseRecord[];
const ubicacion = viaje.ubicacionInicio as { lat: number; lng: number };
```

**When to use**: Embedded objects always read/written together with the parent, never queried individually.

**When NOT to use**: If you need `WHERE ubicacion.lat > x` — use a proper related model instead.

### Deployment: Render Web Service (Full-Stack Express + React)
**Context**: Este proyecto es full-stack en un solo repo (Express `server.ts` + React/Vite `src/`). Vercel NO aplica — requiere Next.js o SPA pura. Render Web Service es la opción correcta.

**Configuración de Render**:
| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `node dist/server.cjs` |
| Root Directory | *(vacío)* |

**Variables de entorno requeridas en Render**:
```
DATABASE_URL  = (Supabase pooled connection string)
DIRECT_URL    = (Supabase direct URL)
JWT_SECRET    = (string largo y aleatorio)
NODE_ENV      = production
PORT          = 3000
```

**Nota**: `DATABASE_URL` y `DIRECT_URL` están en `.env.local` — NO commitear este archivo. Cargarlos manualmente en Render environment variables.

**Build script ya configurado correctamente** en `package.json`:
```json
"build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
```
Genera `dist/index.html` (frontend) y `dist/server.cjs` (backend) en un solo paso.

### uploads/vehiculos/ Must Be in .gitignore
**Issue**: Las fotos de odómetro (base64 → archivos JPG) se guardan en `uploads/vehiculos/<registroId>/` en el servidor. Al hacer el primer `git add .` estas fotos se incluyeron en el commit, subiendo archivos binarios innecesarios al repo.

**Fix aplicado**: `uploads/vehiculos/` agregado a `.gitignore` y removido del tracking con `git rm -r --cached uploads/vehiculos/`.

**Advertencia de producción**: El filesystem de Render es **efímero** — las fotos se pierden en cada deploy. Si las fotos de odómetro son datos importantes, migrar a Supabase Storage o Cloudinary antes de ir a producción real.

### Render Environment Variables — Cuáles van y cuáles no
**Context**: El proyecto tiene variables en `.env.local` mezcladas: algunas son para Prisma/backend, otras son solo para el frontend Vite en desarrollo.

**Solo estas 4 van a Render** (producción):
```
DATABASE_URL   → pooler con pgbouncer=true (queries de app)
DIRECT_URL     → pooler sin pgbouncer (migraciones Prisma)
JWT_SECRET     → generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
NODE_ENV       → production
```

**PORT no va** — Render lo inyecta automáticamente. `server.ts` ya tiene el fallback correcto:
```typescript
const PORT = Number(process.env.PORT) || 3000
```

**Estas NO van a Render** (solo dev/frontend):
```
VITE_SUPABASE_URL        → solo Vite en desarrollo
VITE_SUPABASE_ANON_KEY   → solo Vite en desarrollo
SUPABASE_URL             → no usado por el backend (usa Prisma directo)
SUPABASE_PUBLISHABLE_KEY → no usado por el backend
SUPABASE_SECRET_KEY      → no usado por el backend
SUPABASE_JWKS_URL        → no usado por el backend
PORT                     → NO configurar en Render, lo asigna la plataforma
```

**Razón**: Prisma solo necesita `DATABASE_URL` y `DIRECT_URL`. El cliente Supabase JS (`src/lib/supabase.ts`) solo corre en el frontend y usa las variables `VITE_*` que Vite inyecta en build time.

### Server Bundle Must Use ESM Format (not CJS)
**Issue**: El build original usaba `--format=cjs` para esbuild. En CJS, `import.meta.url` es `undefined`, causando que `fileURLToPath(import.meta.url)` tire `ERR_INVALID_ARG_TYPE` al arrancar el servidor en producción.

**Fix aplicado en `package.json`**:
```json
"build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.mjs",
"start": "node dist/server.mjs"
```

**Start Command en Render**: `node dist/server.mjs` (no `dist/server.cjs`)

**Razón**: El proyecto tiene `"type": "module"` en `package.json` y usa `import.meta.url` para resolver `__filename`/`__dirname` (patrón ESM). Con `--format=esm`, `import.meta` funciona nativamente. Con `--format=cjs`, queda vacío y crashea.

### CSP Production Config Must Include Google Fonts
**Issue**: En producción el CSP de Helmet bloquea Google Fonts con el error `"style-src 'self' 'unsafe-inline'"`. Las fuentes de `index.html` se cargan desde `fonts.googleapis.com` (CSS) y `fonts.gstatic.com` (archivos de fuente).

**Fix en `server.ts` CSP directives**:
```typescript
styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
```

**Nota**: El error `/api/data 401` en la consola del browser es **esperado y correcto** — el frontend llama al endpoint antes de que haya sesión. Desaparece al hacer login. No es un bug.

### Inline Edit Pattern for Admin Tabs (sin modal)
**Context**: Los tabs de Clientes, Proyectos y Colaboradores en AdminPanel usan un patrón de edición inline en lugar de modal separado — más simple para entidades pequeñas donde el formulario tiene 2-3 campos.

**Patrón**:
```tsx
// Estado local en el tab component
const [editingId, setEditingId] = useState<string | null>(null);
const [editNombre, setEditNombre] = useState('');

const startEdit = (item: Entity) => { setEditingId(item.id); setEditNombre(item.nombre); };
const cancelEdit = () => setEditingId(null);
const submitEdit = async () => {
  await onEdit(editingId!, { nombre: editNombre.trim() });
  setEditingId(null);
};

// En el render de cada card:
{editingId === item.id ? (
  <motion.div ...> {/* form inline */} </motion.div>
) : (
  <DataCard ...>
    <div className="flex gap-2 mt-2">
      <button onClick={() => startEdit(item)}>Editar</button>
      <button onClick={() => { if(confirm(`¿Eliminar "${item.nombre}"?`)) onDelete(item.id); }}>Eliminar</button>
    </div>
  </DataCard>
)}
```

**Cuándo usar inline vs modal**:
- **Inline**: entidades simples con 2-3 campos (Clientes, Colaboradores, Proyectos)
- **Modal** (patrón VehiculosAdminView): entidades complejas con muchos campos, cálculos derivados, o lógica de negocio pesada

**Colores por entidad** (convención del proyecto):
- Clientes: `emerald` — border-emerald-500/30, bg-emerald-600
- Proyectos: `cyan` — border-cyan-500/30, bg-cyan-600
- Colaboradores: `pink` — border-pink-500/30, bg-pink-600
- Vehículos: `violet` — border-violet-500/30

### Excel Import: ID Mapping Pattern (local IDs → backend IDs)
**Issue**: `ExcelImporter` genera IDs locales temporales (`cli_xyz`, `pro_abc`) para clientes y proyectos nuevos detectados en el Excel. Si se pasan directamente a `POST /api/registros`, las FK fallan porque esos IDs no existen en Supabase.

**Patrón correcto** — crear en secuencia y mapear IDs:
```typescript
const clienteIdMap = new Map<string, string>(); // localId → realId
const proyectoIdMap = new Map<string, string>();

// 1. Crear clientes nuevos, capturar ID real
for (const cliente of newFullDbState.clientes) {
  if (existeEnDb(cliente.id)) {
    clienteIdMap.set(cliente.id, cliente.id); // ya existe, ID es válido
  } else {
    const res = await authFetchJSON('/api/clientes', { method: 'POST', body: ... });
    clienteIdMap.set(cliente.id, res.data.id); // local → real
  }
}

// 2. Crear proyectos usando ID real del cliente
for (const proyecto of newFullDbState.proyectos) {
  const realClienteId = clienteIdMap.get(proyecto.clienteId) || proyecto.clienteId;
  const res = await authFetchJSON('/api/proyectos', { method: 'POST', body: { clienteId: realClienteId, ... } });
  proyectoIdMap.set(proyecto.id, res.data.id);
}

// 3. Crear registros usando IDs reales de ambos
for (const item of registrosNuevos) {
  await authFetchJSON('/api/registros', { method: 'POST', body: {
    clienteId: clienteIdMap.get(item.clienteId) || item.clienteId,
    proyectoId: proyectoIdMap.get(item.proyectoId) || item.proyectoId,
    ...
  }});
}
```

**Cuando usar**: Cualquier flujo que crea entidades con dependencias en cadena (A → B → C) donde los IDs del frontend son temporales hasta que el backend los persiste.

### /api/save-state Está Deprecado — No Usar
**Issue**: El endpoint `POST /api/save-state` retorna **501 NOT_IMPLEMENTED**. Cualquier código que lo llame silenciosamente falla — los datos aparecen en UI (memoria React) pero desaparecen al recargar.

**Regla**: Nunca usar `handleSaveState()` para persistir datos. Usar siempre los endpoints CRUD individuales:
- Clientes → `POST/PUT/DELETE /api/clientes`
- Proyectos → `POST/PUT/DELETE /api/proyectos`
- Colaboradores → `POST/PUT/DELETE /api/colaboradores`
- Registros → `POST/PUT/DELETE /api/registros`

### Testing Handlers in App.tsx — Límite de Testabilidad con Mocks Estáticos
**Issue**: Los handlers en `App.tsx` (como `handleImportConfirmed`) solo se activan a través de callbacks pasados a componentes hijo. Si el componente está mockeado como un div estático, el handler nunca se ejecuta en tests — los tests solo verifican precondiciones, no el comportamiento real.

**Dos caminos para cobertura completa**:

**Opción A** (rápida, sin refactoring): Agregar un `data-testid` al botón de confirmación real del componente hijo y en el mock del test activar el handler con datos de prueba:
```tsx
// Mock con botón funcional que activa el handler con datos de prueba
vi.mock('../components/ExcelImporter', () => ({
  default: ({ onImportConfirmed }: any) => (
    <button data-testid="confirmar-importacion" onClick={() => onImportConfirmed(newDbStateConDatosNuevos)}>
      Confirmar
    </button>
  )
}));
// En el test:
await user.click(screen.getByTestId('confirmar-importacion'));
await waitFor(() => expect(authFetchJSON).toHaveBeenCalledWith('/api/clientes', ...));
```

**Opción B** (correcta a largo plazo): Extraer el handler a función pura exportable en `src/lib/importHelpers.ts` para poder testearlo directamente sin React.

**Cuando aplicar**: Cualquier handler de App.tsx con lógica compleja (mapeos, secuencias de API calls) cuyo componente hijo esté mockeado estáticamente.

### Zod Schema Constraints That Reject Excel Data
**Issue**: El schema `RegistroItemSchema` tiene validaciones estrictas que los datos del Excel frecuentemente violan, causando 400/500 silenciosos:

| Campo | Constraint Zod | Caso Excel problemático |
|---|---|---|
| `cantidad` | `.positive()` — debe ser > 0 | Filas con cantidad vacía o 0 |
| `precioUnitario` | `.positive()` — debe ser > 0 | Colaboradores sin tarifa asignada |
| `total` | `.positive()` — debe ser > 0 | Filas donde `cantidad * precio = 0` |
| `descripcion` | `.min(1)` — requerida | Filas vacías o solo espacios |
| `fecha` | no puede ser futura | Fechas de presupuesto/planificación |
| `concepto` | `enum(['MO','Insumo','Otros'])` | Valores distintos del Excel |

**Validación defensiva antes de enviar al backend**:
```typescript
// Saltar antes de enviar — no crashear toda la importación
if (!item.cantidad || item.cantidad <= 0) { errores++; continue; }
if (!item.precioUnitario || item.precioUnitario <= 0) { errores++; continue; }
const total = item.total > 0 ? item.total : item.cantidad * item.precioUnitario;
if (total <= 0) { errores++; continue; }
const conceptoValido: 'MO' | 'Insumo' | 'Otros' =
  item.concepto === 'MO' ? 'MO' : item.concepto === 'Insumo' ? 'Insumo' : 'Otros';
```

**Regla**: Siempre aplicar esta validación defensiva en cualquier flujo que envíe datos de origen externo (Excel, API externa, CSV) a `POST /api/registros`.

### /api/clear Must Delete from Supabase, Not database.json
**Issue**: El endpoint `POST /api/clear` llamaba a `writeDbSafe(initialData)` que escribe en `database.json` local. En producción (Render), ese archivo es efímero y no afecta Supabase. El botón "Restaurar Base" de la UI parecía funcionar pero no borraba nada en Supabase.

**Fix correcto** — usar Prisma `deleteMany` en orden FK:
```typescript
await prisma.registro.deleteMany({});
await prisma.registroVehiculo.deleteMany({});
await prisma.timerActivo.deleteMany({});
await prisma.viajeActivo.deleteMany({});
await prisma.proyecto.deleteMany({});    // después de registros (FK)
await prisma.colaborador.deleteMany({});
await prisma.cliente.deleteMany({});     // último (padre de todo)
```

**Script local de emergencia**: `scripts/reset-supabase.ts` — correr con `npx tsx scripts/reset-supabase.ts` cuando se necesite limpiar Supabase desde la máquina local sin esperar redeploy.

**Regla**: Cualquier operación destructiva sobre datos debe usar Prisma, nunca `writeDbSafe()`. Las funciones `readDb()`, `writeDb()`, `writeDbSafe()` son legacy de `database.json` y no afectan Supabase.

### Excel Import Deduplication Must Use Name, Not Local ID
**Issue**: `ExcelImporter` genera IDs locales aleatorios en cada ejecución (`cli_gun27gx75`, `cli_mk63u17qr`, etc.). Comparar por `id` para detectar duplicados siempre falla — cada importación crea nuevos clientes/proyectos aunque ya existan en Supabase.

**Fix**: Usar nombre como clave de deduplicación:
```typescript
// ✅ CORRECTO — deduplicar por nombre normalizado
const clientesPorNombre = new Map(dbState.clientes.map(c => [c.nombre.toLowerCase().trim(), c.id]));
if (clientesPorNombre.has(cliente.nombre.toLowerCase().trim())) {
  clienteIdMap.set(cliente.id, clientesPorNombre.get(nombre)!); // reusar ID real
}

// ✅ CORRECTO — proyectos: deduplicar por "clienteId_real::nombre"
const proyectosPorNombre = new Map(
  dbState.proyectos.map(p => [`${p.clienteId}::${p.nombre.toLowerCase().trim()}`, p.id])
);

// ❌ INCORRECTO — siempre falla porque IDs locales nunca coinciden
const existentes = new Set(dbState.clientes.map(c => c.id));
if (existentes.has(cliente.id)) { ... } // nunca true
```

**Regla general**: En cualquier flujo de importación desde fuente externa, la deduplicación de entidades debe hacerse por **atributos de negocio únicos** (nombre, código, combinación nombre+padre), nunca por IDs sintéticos generados localmente.

### RegistroItemSchema No Debe Rechazar Fechas Futuras
**Issue**: `RegistroItemSchema` tenía un `.refine()` que rechazaba fechas futuras con `"La fecha no puede ser futura"`. Los registros del Excel pueden tener fechas de planificación o presupuesto perfectamente válidas — el schema los rechazaba con 400/500.

**Fix**: Eliminar el refine de fecha futura en `RegistroItemSchema`. Solo mantener el regex de formato:
```typescript
// ✅ CORRECTO — solo validar formato
fecha: z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
  .optional(),
```

**Excepción**: Los schemas de vehículo (`RegistroVehiculoUpdateSchema`, `RegistroVehiculoPatchSchema`) conservan la restricción de fecha futura — son para edición manual donde sí tiene sentido.

### Prisma P2000: VARCHAR Overflow desde Excel
**Issue**: El error `P2000 — The provided value for the column is too long for the column's type` aparece cuando el Excel tiene valores de hora como `"08:00:00"` (8 chars) pero el schema Prisma define `hsInicio`/`hsFin` como `VARCHAR(5)` para formato `"HH:MM"`.

**Fix en dos capas**:
```typescript
// 1. server-validation.ts — truncar en Zod antes de que llegue al endpoint
hsInicio: z.string().optional().transform(v => v ? v.substring(0, 5) : v),
hsFin: z.string().optional().transform(v => v ? v.substring(0, 5) : v),

// 2. server.ts — truncar en el insert como segunda defensa
hsInicio: rawItem.hsInicio ? rawItem.hsInicio.substring(0, 5) : null,
hsFin: rawItem.hsFin ? rawItem.hsFin.substring(0, 5) : null,
```

**Campos con restricciones de longitud en el schema**:
| Campo | Tipo | Límite |
|---|---|---|
| `hsInicio` | `VARCHAR(5)` | `"HH:MM"` |
| `hsFin` | `VARCHAR(5)` | `"HH:MM"` |
| `id` | `VARCHAR(50)` | generados internamente |

**Regla**: Cuando Prisma tira `P2000` y `column_name: "(not available)"`, revisar los campos `VARCHAR` de longitud pequeña. El Excel puede tener `"08:00:00"` donde el schema espera `"08:00"`.

### Prisma P2003: FK Violation por colaboradorId local en importación Excel
**Issue**: El `ExcelImporter` detecta colaboradores de las descripciones y les asigna IDs locales temporales (`col_xyz`). Al crear registros, esos IDs no existen en la tabla `colaboradores` de Supabase → `P2003 Foreign key constraint violated: registros_colaborador_id_fkey`.

**Patrón de resolución** — mismo que clientes/proyectos, extendido a colaboradores:
```typescript
const colaboradorIdMap = new Map<string, string>(); // localId → realId (o '' si falla)
const colaboradoresPorNombre = new Map(dbState.colaboradores.map(c => [c.nombre.toLowerCase().trim(), c.id]));

for (const colab of newFullDbState.colaboradores) {
  if (colaboradoresExistentesIds.has(colab.id)) {
    colaboradorIdMap.set(colab.id, colab.id);
  } else if (colaboradoresPorNombre.has(colab.nombre.toLowerCase().trim())) {
    colaboradorIdMap.set(colab.id, colaboradoresPorNombre.get(...)!);
  } else {
    const res = await authFetchJSON('/api/colaboradores', { method: 'POST', ... });
    colaboradorIdMap.set(colab.id, res.data.id);
  }
}

// Al crear el registro — colaboradorId es nullable:
const mappedColabId = rawColabId ? colaboradorIdMap.get(rawColabId) : '';
const realColaboradorId = mappedColabId || null; // '' o undefined → null (no FK violation)
```

**Regla**: En importación Excel, TODAS las FK deben resolverse antes de crear registros:
1. `clienteId` → `clienteIdMap` (requerido)
2. `proyectoId` → `proyectoIdMap` (requerido)
3. `colaboradorId` → `colaboradorIdMap` → `null` si no resuelve (campo opcional en Registro)

### Zod: Campos Opcionales que Pueden Ser null Explícito
**Issue**: `.optional()` en Zod acepta `undefined` pero NO `null`. Si el frontend envía `colaboradorId: null` en JSON, Zod tira `"Invalid input: expected string, received null"`.

**Fix**: Usar `.nullable().optional()` para campos que pueden ser `string | null | undefined`:
```typescript
// ✅ CORRECTO — acepta string, null, o undefined
colaboradorId: z.string().nullable().optional(),

// ❌ INCORRECTO — rechaza null con "expected string, received null"
colaboradorId: z.string().optional(),
```

**Cuándo aplica**: Cualquier campo FK opcional (como `colaboradorId`) donde el frontend puede enviar `null` explícitamente cuando la entidad no se pudo resolver en el mapeo de importación Excel.

**Diferencia clave**:
- `.optional()` → `string | undefined` (no puede estar presente, pero si está debe ser string)
- `.nullable()` → `string | null`
- `.nullable().optional()` → `string | null | undefined`

### Excel con Filas de Encabezado Repetidas en el Medio
**Issue**: El Excel de Kevin tiene filas de encabezado repetidas intercaladas (`"Cliente" | "Proyecto" | "Fecha" | ...`). El parser `xlsx.utils.sheet_to_json()` las lee como datos reales — causan errores en la importación.

**Fix en `server.ts`** — agregar filtro después del skip de filas vacías:
```typescript
if (!clientName && !projectName && !descripcion) continue;
// Skip header rows repeated in the middle of the Excel
if (clientName.toLowerCase() === 'cliente' || projectName.toLowerCase() === 'proyecto') continue;
```

**Diagnóstico local**:
```javascript
const sospechosas = rows.filter(r => parseFloat(r['Cantidad'] || 0) < 0.001);
// Si tienen strings como "Cantidad", "Cliente" → son encabezados repetidos
```

### Render Free Tier Spin-Down Destroys In-Memory CSRF Tokens
**Issue**: El `csrfTokens` Map en `server.ts` vive en memoria del proceso. Render Free tier "duerme" el servidor después de inactividad y al despertar crea un proceso nuevo — todos los tokens CSRF se pierden. Cualquier browser que tenía un token del proceso anterior recibe `CSRF_TOKEN_INVALID` en todas las requests POST.

**Síntomas**: Funciona desde desktop (sesión activa reciente) pero falla desde mobile o después de períodos de inactividad.

**Fix a largo plazo**: Mover los CSRF tokens a Supabase o usar un esquema stateless (HMAC del sessionId firmado con JWT_SECRET).

**Fix rápido**: Cambiar `sameSite: 'strict'` a `sameSite: 'lax'` en el cookie de `sessionId` en producción — `strict` puede bloquear cookies en mobile browsers en navegación cross-site.

**Ubicación**: `server.ts` → función `validateCSRF()` y `app.get('/api/csrf-token')`.

### CSRF Retry Pattern for In-Memory Token Storage
**Issue**: `authFetch.ts` cachea el CSRF token en una variable de módulo. En mobile, cuando el OS suspende y reactiva el tab, o cuando Render Free reinicia el servidor (perdiendo el Map en memoria), el token cacheado queda inválido → 403 en todas las requests POST sin retry.

**Fix en `authFetch.ts`** — retry automático una sola vez:
```typescript
// Si el servidor responde 403 CSRF, limpiar cache y reintentar UNA vez
if (response.status === 403) {
  const errorBody = await response.clone().json().catch(() => ({}));
  const code = errorBody.error?.code;
  if (code === 'CSRF_TOKEN_INVALID' || code === 'CSRF_TOKEN_MISSING' || code === 'CSRF_TOKEN_EXPIRED') {
    csrfToken = null; // limpiar cache
    const newToken = await fetchCSRFToken();
    headers.set('X-CSRF-Token', newToken);
    return fetch(url, { ...options, headers, credentials: 'include' }); // retry una vez
  }
}
```

**Regla**: El retry debe ser máximo 1 vez. Si el segundo intento también falla 403, dejar que el error suba al caller — no crear loops.

---

## Notes

- Keep entries concise and actionable
- Remove patterns that are no longer relevant
- Update patterns as the project evolves
- Focus on what's unique to this project

### JWT Cookie sameSite Must Be 'lax' in All Environments
**Issue**: El cookie JWT usaba `sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'`. En producción (Render), quedaba `'strict'`, que impide que browsers mobile envíen el cookie cuando el usuario accede desde un link externo (WhatsApp, email, Safari ITP).

**Fix**: Usar `'lax'` en todos los entornos:
```typescript
// ✅ CORRECTO
res.cookie('jwt', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // lax en todos los entornos — protege CSRF pero funciona en mobile
  maxAge: 12 * 60 * 60 * 1000
});
```

**Diferencia clave**:
- `'strict'`: el cookie NUNCA se envía desde navegación cross-site (rompe mobile)
- `'lax'`: el cookie se envía en navegación de nivel superior pero NO en sub-requests cross-site — protección CSRF suficiente
- `'none'`: siempre se envía (requiere `Secure: true`, solo HTTPS)

**Regla**: Para apps con usuarios móviles, usar `sameSite: 'lax'`. `'strict'` rompe acceso desde links de WhatsApp, email, etc.

### Demo Users Must Have Real Supabase IDs After Migration
**Issue**: Los `DEMO_USERS` en `server-auth.ts` tenían `colaboradorId: 'col_1'` / `'col_2'` (IDs legacy JSON). Tras migrar a Supabase/Prisma esos IDs no existen → el JWT lleva un ID inválido → `RegistroOperativo.tsx` no encuentra el colaborador → `selectedColaboradorId` vacío → botón "Iniciar Tarea" bloqueado.

**Síntoma clásico**: funciona con Admin (sin `colaboradorId`), falla con Operario/Técnico.

**Cómo obtener IDs reales** (PowerShell):
```powershell
Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' } | ForEach-Object {
  $env:DATABASE_URL = $_.Substring('DATABASE_URL='.Length).Trim('"')
}
npx tsx scripts/check-colaboradores.ts
```

**Checklist post-migración**:
1. Verificar que `colaboradorId` en `DEMO_USERS` coincida con IDs reales en Supabase
2. Si los nombres difieren, el fallback por nombre en `RegistroOperativo.tsx` también falla
3. IDs actuales: Rodrigo → `col_kdsnf4jzk`; Kevin → sin colaborador en DB (crear desde Admin)

### Login Component Must Forward All User Fields from Server Response
**Issue**: `Login.tsx` llamaba `onLoginSuccess({ nombre, rol, usuario })` — sin `colaboradorId`. El servidor devolvía `colaboradorId` correctamente en `result.data.user`, pero el componente lo descartaba silenciosamente. Resultado: `currentUser.colaboradorId` siempre `undefined` en toda la app, aunque el JWT y la DB estuvieran correctos.

**Síntoma clásico**: Warning en console `colaboradorId: "undefined"` en `RegistroOperativo` aunque `server-auth.ts` tuviera el ID correcto. Difícil de rastrear porque servidor, JWT y DB estaban todos bien — el bug era solo en el "cable" entre Login.tsx y App.tsx.

**Regla**: Al agregar cualquier campo nuevo a la respuesta del login, verificar los 6 puntos del pipeline completo:

```typescript
// Login.tsx DEBE pasar todos los campos de result.data.user:
onLoginSuccess({
  nombre: user.nombre,
  rol: user.rol,
  usuario: user.usuario,
  colaboradorId: user.colaboradorId || undefined  // ← el más fácil de olvidar
});
```

**Checklist al agregar campos al JWT/login response**:
1. `server-auth.ts` → DEMO_USERS tiene el campo
2. `server.ts` → `generateToken()` incluye el campo
3. `server.ts` → respuesta del login incluye el campo en `data.user`
4. `Login.tsx` → `onLoginSuccess` pasa el campo ← **el más fácil de olvidar**
5. `App.tsx` → `SessionUser` interface incluye el campo
6. Componente consumidor → usa el campo correctamente

### Session Restoration on Page Reload Requires /api/auth/me
**Issue**: `checkAuthStatus` en `App.tsx` llamaba `/api/data` al recargar y cargaba `dbState`, pero **nunca seteaba `session`**. Con `session = null`, la app mostraba el Login aunque el JWT cookie fuera válido — el usuario tenía que loguearse en cada refresh.

**Root cause**: El JWT vive en un httpOnly cookie (no accesible desde JS), así que `session` solo se puede restaurar llamando al servidor para que lo lea y devuelva la info del usuario.

**Fix — dos partes**:

1. `server.ts` — `GET /api/auth/me` protegido con `requireAuth`:
```typescript
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user as JWTPayload;
  return res.json({ success: true, data: { user: { nombre, rol, usuario, colaboradorId } } });
});
```

2. `App.tsx` — `checkAuthStatus` llama `/api/auth/me` primero:
```typescript
const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
if (!meResponse.ok) { setSession(null); return; } // JWT inválido → Login
setSession(meResult.data.user); // JWT válido → restaurar sesión
// Cargar datos después — fallo de /api/data NO limpia session
```

**Regla crítica**: Fallo de `/api/data` NO debe limpiar `session`. Son cosas distintas: autenticación (JWT) vs carga de datos (DB). Si la DB falla pero el JWT es válido → mostrar error de carga, no el Login.

### Render Requires trust proxy=1 for express-rate-limit
**Issue**: En producción en Render, `express-rate-limit` lanza `ValidationError: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` porque Render agrega el header `X-Forwarded-For` pero Express no confía en el proxy.

**Fix** — agregar después de `app.use(cors(...))`:
```typescript
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Render adds exactly one proxy hop
}
```

**Nota de seguridad**: Usar `1` (no `true`). `true` confiaría en cualquier proxy y permitiría falsificar IPs. `1` solo confía en el primer proxy (Render), correcto para deployments de un nivel.

**Side effect positivo**: El redirect HTTPS también lee `x-forwarded-proto` — sin `trust proxy`, ese redirect tampoco funciona correctamente en Render.

### Persist UI Context in localStorage to Survive Server Reconnects
**Issue**: Render Free tier duerme el servidor tras 15 min de inactividad. Al reconectar, React remonta componentes y pierde estado local (`selectedClienteId`, `selectedProyectoId`). El timer sobrevivía (ya persistido en localStorage) pero el contexto se perdía.

**Patrón**: Inicializar con lazy `useState` desde localStorage y sincronizar con `useEffect`:
```typescript
const ctxPrefix = `afull_ctx_${currentUser?.usuario || 'guest'}`;
const [selectedClienteId, setSelectedClienteId] = useState(() => {
  try { return localStorage.getItem(`${ctxPrefix}_clienteId`) || ''; } catch { return ''; }
});
useEffect(() => {
  try {
    if (selectedClienteId) localStorage.setItem(`${ctxPrefix}_clienteId`, selectedClienteId);
    else localStorage.removeItem(`${ctxPrefix}_clienteId`);
  } catch {}
}, [selectedClienteId, ctxPrefix]);
```

**Validación obligatoria** al cargar datos:
```typescript
useEffect(() => {
  if (data.clientes.length === 0) return; // esperar a que cargue
  if (selectedClienteId && !data.clientes.find(c => c.id === selectedClienteId)) {
    setSelectedClienteId(''); setSelectedProyectoId(''); // limpiar si fue eliminado
  }
}, [data.clientes, data.proyectos]);
```

**Regla**: Siempre usar prefijo por usuario (`afull_ctx_${usuario}_`) — sin prefijo, dos usuarios en el mismo browser compartirían el estado guardado.

**Cuándo aplicar**: Selectores de "contexto de trabajo" que el usuario configura una vez y usa toda la sesión. No aplicar a estados transitorios (feedback, loading, modales).

### GPS Fields Must Be Optional in Zod Schemas and Handlers
**Issue**: `ViajeStopSchema` tenía `ubicacionFin` requerido. En mobile sin GPS disponible, el frontend enviaba `null` → Zod rechazaba con 400 → "Error al finalizar viaje". El usuario no podía guardar el viaje aunque tuviera los datos del odómetro.

**Patrón — dos capas consistentes**:

1. **Zod schema** — GPS siempre opcional:
```typescript
ubicacionFin: z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
}).nullable().optional(), // GPS puede no estar disponible en mobile
```

2. **Handler** — null guard antes de Haversine:
```typescript
const distanciaGPS = (ubicacionInicioGPS?.lat != null && ubicacionFin?.lat != null)
  ? calcularDistanciaHaversine(ubicacionInicioGPS, ubicacionFin)
  : null;
// alertaDiscrepancia = false cuando no hay GPS
const alertaDiscrepancia = distanciaGPS != null && discrepanciaPorcentaje > 20;
```

**Checklist al agregar campos GPS a un endpoint**:
1. Schema Zod: `.nullable().optional()`
2. Handler: guard `?.lat != null` antes de calcular distancia
3. Campo Prisma: `Decimal?` (nullable)
4. UI: mostrar "Sin coordenadas GPS" cuando el valor es null

### Render Filesystem Is Ephemeral — Use Supabase Storage for Uploads
**Issue**: Las fotos de odómetro se guardaban en `uploads/vehiculos/` en el filesystem de Render. Cada deploy borra esos archivos — las fotos desaparecen y las URLs en la DB apuntan a 404.

**Solución**: Migrar `guardarFotosVehiculo()` en `server.ts` para subir a Supabase Storage.

**Plan**:
1. Crear bucket `vehiculos-fotos` en Supabase dashboard (Storage → New bucket → public)
2. Agregar en Render: `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (service_role key, NO anon)
3. Reemplazar `guardarFotosVehiculo()` para subir con `supabaseAdmin.storage.from('vehiculos-fotos').upload()`

**Regla**: Nunca guardar uploads en el filesystem en Render. Todo archivo persistente va a Supabase Storage, S3, o Cloudinary. El filesystem de Render se borra en cada deploy.

### Decimal Field Precision Must Account for Worst-Case Values
**Issue**: `discrepancia` era `Decimal(5,2)` — max 999.99. Cuando el GPS producía valores absurdos, `discrepanciaPorcentaje` podía ser miles de %, causando error PostgreSQL `22003 numeric field overflow`.

**Fix doble**:
1. **Schema** — usar `Decimal(8,2)` para métricas derivadas de fuentes externas (GPS, sensores)
2. **Código** — capear antes de guardar: `Math.min(valor, 999.9)`

**Diagnóstico**: Error PostgreSQL `22003` con `"A field with precision X, scale Y must round to absolute value less than 10^(X-Y)"` → el campo Decimal es demasiado pequeño.

**Guía de dimensionamiento**:
- Porcentajes/métricas derivadas de sensores: `Decimal(8,2)` mínimo
- Precios/totales en Gs: `Decimal(15,2)`
- `Decimal(5,2)` solo para valores con máximo garantizado conocido

### Supabase Storage Bucket Must Be Public for Direct Image URLs
**Issue**: El bucket `vehiculos-fotos` estaba creado y los uploads funcionaban, pero era **privado**. Las URLs `https://...supabase.co/storage/v1/object/public/...` retornaban 403. Las fotos salían rotas en la UI.

**Fix**: Supabase dashboard → Storage → `vehiculos-fotos` → Edit bucket → habilitar "Public bucket".

**Diagnóstico**: `npx tsx scripts/test-supabase-storage.ts` — lista buckets, verifica public/private, hace upload de prueba, reporta estado completo.

**Regla**: Al crear buckets para assets públicos (fotos, imágenes), siempre habilitarlos como **public** en el momento de creación. Los buckets privados requieren signed URLs con expiración — innecesario para fotos de odómetro.

### convertPrismaToFrontend Must Include All Fields — Silent Omission Causes Missing Data
**Issue**: `convertPrismaToFrontend()` mapeaba `registrosVehiculo` pero omitía silenciosamente `fotoOdometroInicio`, `fotoOdometroFin`, `ubicacionInicio`, `ubicacionFin`, `distanciaGPS`, `discrepancia`, etc. El frontend recibía `undefined` aunque los datos estuvieran correctamente en Supabase.

**Síntoma clásico**: Datos existen en la DB y las URLs devuelven 200, pero la UI muestra vacío/roto — sin errores en consola.

**Checklist al agregar un campo nuevo a un modelo Prisma**:
1. Schema Prisma + `db push`
2. Escribir al campo en el endpoint que lo crea/actualiza
3. ✅ **Incluirlo en `convertPrismaToFrontend()`** ← el más fácil de olvidar
4. Agregar al tipo TypeScript en `src/types.ts`

**Diagnóstico**: Si un campo existe en DB pero no aparece en UI → verificar `convertPrismaToFrontend()` antes de investigar el frontend.

### Never Pass Existing Storage URLs as Base64 Input to Upload Functions
**Issue**: Al editar fotos en el PATCH, se pasaba la URL de Supabase existente (`https://...supabase.co/...`) a `guardarFotosVehiculo()` como si fuera base64. `Buffer.from(url, 'base64')` produce datos basura que sobreescribían la foto que no había cambiado — foto corrupta silenciosa.

**Regla**: Siempre verificar `startsWith('data:')` antes de procesar como base64:

```typescript
// ✅ Backend — solo procesar si es base64 nuevo
if (patchData.fotoOdometroInicio?.startsWith('data:')) {
  fotoInicio = await uploadSingleFoto(patchData.fotoOdometroInicio, 'nombre');
}

// ✅ Frontend — solo enviar si es base64 nuevo, no URL existente
fotoOdometroInicio: formData.fotoOdometroInicio?.startsWith('data:') ? formData.fotoOdometroInicio : undefined
```

**Cuándo aplica**: Cualquier endpoint de edición que acepta fotos opcionales. El `formData` puede mezclar URLs existentes (del fetch previo) con base64 nuevos (del input file). Diferenciarlos con `startsWith('data:')` es el patrón correcto.

### Supabase/CDN Image Caching (404 Cache Buster)
**Issue**: Al previsualizar fotos rotas (no cargadas), el navegador o la CDN cachea el error 404 por largo tiempo (`max-age=3600`). Al subir una foto nueva con la misma URL, el navegador sigue mostrando la imagen rota por la caché.

**Fix**: Usar una función helper `addCacheBuster` en el frontend para añadir un query parameter dinámico (`?t=timestamp`) a las imágenes que provengan del storage externo:
```typescript
const addCacheBuster = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};
```

### CSRF Concurrent Fetching Promise Cache
**Issue**: Si una página dispara peticiones mutantes (POST/PUT/DELETE) simultáneas sin token CSRF, cada una solicita su propio token. Cada llamada a `/api/csrf-token` invalida el token anterior en el servidor, causando que las primeras peticiones fallen con 403 (Token inválido) tras reintentar.

**Fix**: Cachear el **Promise** del fetch del token CSRF en lugar de solo la cadena de texto del token. Esto colapsa las llamadas paralelas en una sola solicitud real:
```typescript
let csrfTokenPromise: Promise<string> | null = null;
let csrfToken: string | null = null;

async function fetchCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfTokenPromise) return csrfTokenPromise;
  
  csrfTokenPromise = (async () => {
    try {
      const response = await fetch('/api/csrf-token', { credentials: 'include' });
      // parse and save
    } finally {
      csrfTokenPromise = null;
    }
  })();
  return csrfTokenPromise;
}
```

### Transaction Batching for Bulk Imports (Excel)
**Issue**: Insertar registros secuencialmente desde el frontend mediante bucles de peticiones POST individuales (ej. 200 filas de Excel) congela la UI por latencia, puede agotar el pool de conexiones de base de datos de Render/Supabase, y carece de atomicidad (fallas parciales).

**Fix**: Consolidar la importación masiva en un único endpoint transaccional `/api/import/confirm` en el servidor usando `prisma.$transaction`. Esto reduce el tiempo de confirmación a menos de 500ms y asegura consistencia atómica.

