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

---

## Notes

- Keep entries concise and actionable
- Remove patterns that are no longer relevant
- Update patterns as the project evolves
- Focus on what's unique to this project
