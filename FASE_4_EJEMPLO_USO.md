# FASE 4: ORDENAMIENTO - Ejemplo de Uso

## 🎬 Demo Interactivo

### Escenario: Usuario ordena registros por Total

#### Estado Inicial (Defecto: Fecha descendente)
```
╔═══════════════════════════════════════════════════════════════╗
║  Concepto ⇅  │ Cliente ⇅  │ Fecha ⬇  │ ... │ Total ⇅         ║
╠═══════════════════════════════════════════════════════════════╣
║  MO         │ ACME Corp  │ 2024-03-15 │     │ Gs. 1,500,000   ║
║  Insumo     │ Tech Inc   │ 2024-03-14 │     │ Gs. 800,000     ║
║  MO         │ ACME Corp  │ 2024-03-13 │     │ Gs. 2,200,000   ║
║  Insumo     │ BuildCo    │ 2024-03-12 │     │ Gs. 450,000     ║
║  MO         │ Tech Inc   │ 2024-03-11 │     │ Gs. 1,900,000   ║
╚═══════════════════════════════════════════════════════════════╝
```

#### Paso 1: Usuario hace click en header "Total"
```javascript
// Se ejecuta handleSort('total')
sortField: 'fecha' → 'total'  // Cambia campo
sortOrder: 'desc' → 'desc'     // Mantiene descendente (defecto)
currentPage: X → 1             // Resetea a página 1
```

#### Resultado: Ordenado por Total descendente
```
╔═══════════════════════════════════════════════════════════════╗
║  Concepto ⇅  │ Cliente ⇅  │ Fecha ⇅  │ ... │ Total ⬇         ║
╠═══════════════════════════════════════════════════════════════╣
║  MO         │ ACME Corp  │ 2024-03-13 │     │ Gs. 2,200,000   ║
║  MO         │ Tech Inc   │ 2024-03-11 │     │ Gs. 1,900,000   ║
║  MO         │ ACME Corp  │ 2024-03-15 │     │ Gs. 1,500,000   ║
║  Insumo     │ Tech Inc   │ 2024-03-14 │     │ Gs. 800,000     ║
║  Insumo     │ BuildCo    │ 2024-03-12 │     │ Gs. 450,000     ║
╚═══════════════════════════════════════════════════════════════╝
          ↑ Mayor valor primero (descendente)
```

#### Paso 2: Usuario hace click nuevamente en "Total"
```javascript
// Se ejecuta handleSort('total')
sortField: 'total' → 'total'  // Mismo campo
sortOrder: 'desc' → 'asc'     // Toggle a ascendente
currentPage: X → 1             // Resetea a página 1
```

#### Resultado: Ordenado por Total ascendente
```
╔═══════════════════════════════════════════════════════════════╗
║  Concepto ⇅  │ Cliente ⇅  │ Fecha ⇅  │ ... │ Total ⬆         ║
╠═══════════════════════════════════════════════════════════════╣
║  Insumo     │ BuildCo    │ 2024-03-12 │     │ Gs. 450,000     ║
║  Insumo     │ Tech Inc   │ 2024-03-14 │     │ Gs. 800,000     ║
║  MO         │ ACME Corp  │ 2024-03-15 │     │ Gs. 1,500,000   ║
║  MO         │ Tech Inc   │ 2024-03-11 │     │ Gs. 1,900,000   ║
║  MO         │ ACME Corp  │ 2024-03-13 │     │ Gs. 2,200,000   ║
╚═══════════════════════════════════════════════════════════════╝
          ↑ Menor valor primero (ascendente)
```

---

## 🔄 Flujo de Datos Completo

### Ejemplo: 100 registros en base de datos

```
┌─────────────────────────────────────────────────────────┐
│ data.registros (100 items)                              │
│ - Todos los registros sin filtrar                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ FASE 1: Filtros
┌─────────────────────────────────────────────────────────┐
│ filteredRegistros (45 items)                            │
│ - Filtro: Cliente = "ACME Corp"                         │
│ - Filtro: Fecha desde = "2024-01-01"                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├──→ FASE 2: Métricas (usa filteredRegistros)
                   │    - totalHours, totalCost, charts
                   │
                   ↓ FASE 4: Ordenamiento
┌─────────────────────────────────────────────────────────┐
│ sortedRegistros (45 items)                              │
│ - Campo: 'total'                                         │
│ - Orden: 'desc'                                          │
│ - Resultado: Mayor a menor valor                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ FASE 3: Paginación
┌─────────────────────────────────────────────────────────┐
│ paginatedRegistros (25 items)                           │
│ - Página actual: 1                                       │
│ - Items por página: 25                                   │
│ - Mostrando: registros 1-25 de 45                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ RENDER
┌─────────────────────────────────────────────────────────┐
│ <table> con 25 filas visibles                           │
│ - Ordenadas por Total descendente                       │
│ - Filtradas por ACME Corp                               │
│ - Paginación: [1] 2 >                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Estados Visuales de los Headers

### 1. Header NO Ordenable (Descripción)
```html
<th className="pb-3 font-medium">
  Descripción / Detalle
  <!-- Sin icono, sin cursor pointer -->
</th>
```
**Apariencia**: Texto gris normal, sin hover effect

---

### 2. Header Ordenable INACTIVO (sin hover)
```html
<th className="... group">
  <div className="flex items-center gap-1.5">
    <span>Concepto</span>
    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
           ⬆ gris claro, poco visible
  </div>
</th>
```
**Apariencia**: 
- Texto: `#94a3b8` (slate-400)
- Icono: `#64748b` (slate-500)
- Cursor: pointer
- Sin cambio visual

---

### 3. Header Ordenable INACTIVO (con hover)
```html
<th className="... hover:text-slate-200 ... group">
  <div className="flex items-center gap-1.5">
    <span>Concepto</span>
    <ArrowUpDown className="... group-hover:text-blue-400" />
           ⬆ azul al hacer hover
  </div>
</th>
```
**Apariencia**: 
- Texto: `#e2e8f0` (slate-200) - más claro
- Icono: `#60a5fa` (blue-400) - azul visible
- Cursor: pointer
- Feedback visual: "Puedes ordenar por esta columna"

---

### 4. Header Ordenable ACTIVO (Ascendente)
```html
<th className="... cursor-pointer ...">
  <div className="flex items-center gap-1.5">
    <span>Total</span>
    <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
         ⬆ flecha hacia arriba azul brillante
  </div>
</th>
```
**Apariencia**: 
- Texto: `#94a3b8` (slate-400)
- Icono: `#60a5fa` (blue-400) - ArrowUp visible
- Estado: Claramente ordenando ascendente
- Al hacer hover: Texto se aclara

---

### 5. Header Ordenable ACTIVO (Descendente)
```html
<th className="... cursor-pointer ...">
  <div className="flex items-center gap-1.5">
    <span>Total</span>
    <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
         ⬆ flecha hacia abajo azul brillante
  </div>
</th>
```
**Apariencia**: 
- Texto: `#94a3b8` (slate-400)
- Icono: `#60a5fa` (blue-400) - ArrowDown visible
- Estado: Claramente ordenando descendente
- Al hacer hover: Texto se aclara

---

## 📱 Responsive Behavior

### Desktop (> 1024px)
```
┌──────────────────────────────────────────────────────────────────┐
│  Concepto ⇅ │ Cliente ⬇ │ Fecha ⇅ │ Descripción │ ... │ Total ⇅ │
│  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -   │
│  MO         │ ACME     │ 2024-03 │ Juan Pérez  │     │ Gs. 1.5M │
└──────────────────────────────────────────────────────────────────┘
```
**Todos los headers visibles, iconos alineados a la derecha del texto**

---

### Tablet/Mobile (< 1024px)
```
┌─────────────────────────────────┐
│ ← scroll horizontal →           │
│ Concepto ⇅ │ Cliente ⬇ │ ... │ │
│ - - - - - - - - - - - - - - - │ │
│ MO         │ ACME     │ ... │ │
└─────────────────────────────────┘
```
**Tabla con scroll horizontal activado (min-width: 700px)**
**Iconos mantienen funcionalidad completa**

---

## 🧪 Casos de Prueba

### Test 1: Ordenamiento básico
```typescript
// Estado inicial
sortField = 'fecha'
sortOrder = 'desc'

// Acción: Click en "Total"
handleSort('total')

// Resultado esperado
sortField = 'total'   // ✅ Cambió campo
sortOrder = 'desc'    // ✅ Mantiene descendente
currentPage = 1       // ✅ Resetea página
```

### Test 2: Toggle ascendente/descendente
```typescript
// Estado inicial
sortField = 'total'
sortOrder = 'desc'

// Acción: Click nuevamente en "Total"
handleSort('total')

// Resultado esperado
sortField = 'total'   // ✅ Mismo campo
sortOrder = 'asc'     // ✅ Toggle a ascendente
currentPage = 1       // ✅ Resetea página
```

### Test 3: Cambio a otro campo
```typescript
// Estado inicial
sortField = 'total'
sortOrder = 'asc'

// Acción: Click en "Fecha"
handleSort('fecha')

// Resultado esperado
sortField = 'fecha'   // ✅ Cambió a fecha
sortOrder = 'desc'    // ✅ Nuevo campo siempre desc
currentPage = 1       // ✅ Resetea página
```

### Test 4: Ordenamiento de cantidad/horas (caso especial)
```typescript
// Registros
const registros = [
  { concepto: 'MO', cantidad: 100, hsTotal: 5.5 },   // Usa hsTotal
  { concepto: 'Insumo', cantidad: 200, hsTotal: undefined }, // Usa cantidad
  { concepto: 'MO', cantidad: 50, hsTotal: 3.2 },    // Usa hsTotal
]

// Acción: handleSort('cantidad')
// Resultado esperado (desc):
// 1. Insumo (200)
// 2. MO (5.5 horas)
// 3. MO (3.2 horas)
```

---

## 💡 Tips de Uso

### Para Desarrolladores:
1. **Agregar nueva columna ordenable**:
   ```typescript
   // 1. Agregar campo a type
   type SortField = '...' | 'nuevoCampo';
   
   // 2. Agregar header clickeable
   <th onClick={() => handleSort('nuevoCampo')}>
     {/* Iconos */}
   </th>
   
   // 3. Lógica de ordenamiento se maneja automáticamente
   ```

2. **Cambiar orden por defecto**:
   ```typescript
   // En los estados iniciales
   const [sortField, setSortField] = useState<SortField>('total'); // ⬅️ Cambiar aquí
   const [sortOrder, setSortOrder] = useState<SortOrder>('asc');   // ⬅️ O aquí
   ```

3. **Debug**:
   ```typescript
   console.log('Ordenando por:', sortField, sortOrder);
   console.log('Total registros ordenados:', sortedRegistros.length);
   ```

### Para Usuarios Finales:
1. **Identificar columnas ordenables**: Busca el icono ⇅ (dos flechas)
2. **Ver columna activa**: Icono azul (⬆ o ⬇)
3. **Alternar orden**: Click nuevamente en el mismo header
4. **Resetear a defecto**: Recargar página (vuelve a Fecha desc)

---

## 🎓 Conceptos Clave

### useMemo vs useEffect
```typescript
// ❌ INCORRECTO: useEffect para ordenamiento
useEffect(() => {
  const sorted = [...filteredRegistros].sort(...);
  setSortedRegistros(sorted);
}, [filteredRegistros, sortField, sortOrder]);

// ✅ CORRECTO: useMemo para ordenamiento
const sortedRegistros = useMemo(() => {
  return [...filteredRegistros].sort(...);
}, [filteredRegistros, sortField, sortOrder]);
```
**Razón**: useMemo es para cálculos derivados, useEffect es para side effects

### Inmutabilidad en sort()
```typescript
// ❌ INCORRECTO: Muta el array original
const sortedRegistros = filteredRegistros.sort(...);

// ✅ CORRECTO: Crea copia antes de ordenar
const sortedRegistros = [...filteredRegistros].sort(...);
```
**Razón**: Array.sort() muta in-place, necesitamos preservar filteredRegistros

### localeCompare para strings
```typescript
// ❌ INCORRECTO: Comparación básica (no maneja acentos)
aVal < bVal ? -1 : 1

// ✅ CORRECTO: Comparación con locale
aVal.localeCompare(bVal, 'es-PY')
```
**Razón**: localeCompare maneja correctamente:
- Acentos: "Ñandú" vs "Naranja"
- Mayúsculas: "ACME" vs "acme"
- Caracteres especiales: "José" vs "Jose"

---

## 🚀 Performance

### Análisis de Complejidad

#### Ordenamiento:
- **Complejidad**: O(n log n) - algoritmo de ordenamiento nativo de JS
- **n**: Cantidad de registros filtrados (típicamente < 1000)
- **Cuándo se ejecuta**: Solo cuando cambian filteredRegistros, sortField o sortOrder
- **Optimización**: useMemo previene re-cálculos innecesarios

#### Ejemplo con 1000 registros:
```
Operación                 | Sin useMemo    | Con useMemo
--------------------------|----------------|-------------
Cada render (promedio)    | 1000 log 1000  | 0 (cached)
Cambio de filtro          | 1000 log 1000  | 1000 log 1000
Cambio de página          | 1000 log 1000  | 0 (cached)
Cambio de ordenamiento    | 1000 log 1000  | 1000 log 1000
```

#### Re-renders Evitados:
```typescript
// Sin useMemo: Ordena en cada render
function Dashboard() {
  const sortedRegistros = [...filteredRegistros].sort(...); // ⬅️ Cada render
  return <Table data={sortedRegistros} />;
}

// Con useMemo: Ordena solo cuando necesario
function Dashboard() {
  const sortedRegistros = useMemo(() => {
    return [...filteredRegistros].sort(...);
  }, [filteredRegistros, sortField, sortOrder]); // ⬅️ Solo cuando cambian deps
  return <Table data={sortedRegistros} />;
}
```

---

## 📊 Métricas de Implementación

- **Líneas de código agregadas**: ~200
- **Imports nuevos**: 3 (ArrowUp, ArrowDown, ArrowUpDown)
- **Estados nuevos**: 2 (sortField, sortOrder)
- **Funciones nuevas**: 1 (handleSort)
- **useMemo nuevos**: 1 (sortedRegistros)
- **useEffect nuevos**: 1 (reset page on sort)
- **Headers modificados**: 6 (ordenables) + 3 (no ordenables)
- **Errores TypeScript**: 0
- **Warnings**: 0

---

## ✅ Checklist Final

- [x] Ordenamiento funcional en 6 columnas
- [x] Iconos dinámicos (ArrowUp, Down, UpDown)
- [x] Hover states implementados
- [x] Toggle ASC/DESC funcional
- [x] Integración con filtros (Fase 1)
- [x] Integración con paginación (Fase 3)
- [x] Métricas no afectadas (Fase 2)
- [x] Reseteo de página automático
- [x] Accesibilidad (aria-sort)
- [x] Performance optimizada (useMemo)
- [x] TypeScript sin errores
- [x] Build exitoso
- [x] Documentación completa

---

**✨ FASE 4: ORDENAMIENTO - Implementación Completa y Funcional ✨**
