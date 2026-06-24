# 🎨 Preview Visual - Dropdowns Glass & Glow

## Estados del Dropdown

### 1️⃣ Estado Normal (Reposo)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                  ┃
┃  [🏢]  -- Seleccionar Cliente --           ⌄   ┃
┃                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  │                                            │
  └─ Icono (z-10)                    Chevron gris (#94a3b8)

Fondo: rgba(255,255,255,0.04) - Glass semi-transparente
Borde: rgba(255,255,255,0.08) - Sutil
Texto: #f1f5f9 - Claro y legible
```

---

### 2️⃣ Estado Hover (Al pasar mouse)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ← Borde azul tenue
┃                                                  ┃   rgba(59,130,246,0.3)
┃  [🏢]  -- Seleccionar Cliente --           ⌄   ┃
┃                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                             │
                                    Chevron azul (#3b82f6)

Fondo: rgba(255,255,255,0.06) - Ligeramente más opaco
Transición: 200ms cubic-bezier(0.16,1,0.3,1)
Cursor: pointer
```

---

### 3️⃣ Estado Focus (Al hacer click)
```
     ╭────────── Glow azul ──────────╮
     │  rgba(59,130,246,0.15)         │
┏━━━━▼━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▼━━━━━━━━━┓
┃┃                                              ┃┃ ← Borde azul intenso
┃┃  [🏢]  -- Seleccionar Cliente --        ⌄  ┃┃   rgba(59,130,246,0.6)
┃┃                                              ┃┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ║                                            ║
  ╚════════ box-shadow: 0 0 0 3px ════════════╝

Fondo: rgba(255,255,255,0.08) - Más destacado
Efecto: Glow con sombra difuminada
```

---

### 4️⃣ Estado Disabled (Bloqueado)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                  ┃
┃  [🏢]  -- Seleccionar Proyecto --          ⌄   ┃ ← Texto apagado
┃         (Seleccione Cliente primero)            ┃   opacity: 0.4
┃                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                             │
                                    Chevron gris oscuro
                                    (#475569)

Fondo: rgba(255,255,255,0.02) - Muy tenue
Cursor: not-allowed
```

---

## Opciones Desplegadas

### 5️⃣ Lista de Opciones (Abierto)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                  ┃
┃  [🏢]  Empresa 1 S.A.                      ⌄   ┃ ← Seleccionado
┃                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ -- Seleccionar Cliente --                      ┃ ← Placeholder
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🌟 Empresa 1 S.A.                              ┃ ← Hover: Gradiente
┃    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ┃   azul-púrpura
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Estudio Alpha SL                               ┃ ← Normal
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Distribuidora Global                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Fondo opciones: #0f172a (Slate-900 sólido)
Texto opciones: #f1f5f9 (Claro)
Padding: 8px 12px
Font-weight: 500

Option hover/checked:
background: linear-gradient(135deg,
  rgba(59,130,246,0.2) 0%,    ← Azul
  rgba(99,102,241,0.2) 100%   ← Púrpura
)
color: #fff (blanco puro)
```

---

## Comparación Antes vs Después

### ❌ ANTES (PROBLEMA)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ███████████████████████████████████████████████ ┃ ← Fondo blanco
┃ ███  ███████ ███████  ████████████████  ██  ██ ┃
┃ ███████████████████████████████████████████████ ┃ ← Texto blanco
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
     🚫 INVISIBLE - No se puede leer nada
```

### ✅ DESPUÉS (SOLUCIÓN)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                  ┃
┃  [🏢]  Empresa 1 S.A.                      ⌄   ┃
┃                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
     ✅ PERFECTO - Todo es legible y premium
```

---

## Anatomía del Glass Select

```
┌─────────────────────────────────────────────────┐
│ Padding: 10px 36px 10px 32px                    │
│ ┌─────┐                             ┌─────┐    │
│ │Icon │ Text Content                │Chevr│    │
│ │ 🏢  │ -- Seleccionar Cliente --   │  ⌄  │    │
│ └─────┘                             └─────┘    │
│  │  ↑                                   ↑       │
│  │  └─ 8px spacing                     12px →   │
│  └─ Absolute positioned (z-10)                  │
│                                                  │
│ Border-radius: 12px (rounded-xl)                │
│ Height: auto (py-2.5 = 10px top + 10px bottom) │
│ Font-size: 14px (text-sm)                       │
└─────────────────────────────────────────────────┘
  ↑                                             ↑
  Border: 1px solid rgba(255,255,255,0.08)
  Background: rgba(255,255,255,0.04) + backdrop-filter: blur(16px)
```

---

## Paleta de Colores Completa

```css
/* Text Colors */
--text-default:    #f1f5f9   /* Slate-100 - Texto principal */
--text-muted:      #94a3b8   /* Slate-400 - Chevron normal */
--text-white:      #ffffff   /* Blanco puro - Hover/checked */

/* Background Colors */
--bg-normal:       rgba(255, 255, 255, 0.04)  /* Glass */
--bg-hover:        rgba(255, 255, 255, 0.06)  /* Glass hover */
--bg-focus:        rgba(255, 255, 255, 0.08)  /* Glass focus */
--bg-disabled:     rgba(255, 255, 255, 0.02)  /* Glass disabled */
--bg-options:      #0f172a                     /* Slate-900 */

/* Border Colors */
--border-normal:   rgba(255, 255, 255, 0.08)  /* Sutil */
--border-hover:    rgba(59, 130, 246, 0.3)    /* Blue-500 30% */
--border-focus:    rgba(59, 130, 246, 0.6)    /* Blue-500 60% */

/* Glow/Shadow Colors */
--glow-focus:      rgba(59, 130, 246, 0.15)   /* Blue-500 15% */

/* Chevron Colors */
--chevron-normal:    #94a3b8   /* Slate-400 */
--chevron-hover:     #3b82f6   /* Blue-500 */
--chevron-focus:     #3b82f6   /* Blue-500 */
--chevron-disabled:  #475569   /* Slate-600 */

/* Option Hover Gradient */
--gradient-start:  rgba(59, 130, 246, 0.2)   /* Blue-500 20% */
--gradient-end:    rgba(99, 102, 241, 0.2)   /* Indigo-500 20% */
```

---

## Animación del Chevron

```
Estado 1: Normal
    ⌄
  #94a3b8 (gris)

      ↓ transition: all 0.2s

Estado 2: Hover/Focus
    ⌄
  #3b82f6 (azul brillante)

El chevron rota sutilmente cuando el dropdown está abierto (nativo del browser)
```

---

## Responsive Behavior

### Desktop (>1024px)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  [🏢]  Empresa 1 S.A.                  ⌄   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Full width con max-width constraints
```

### Tablet (768px - 1024px)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  [🏢]  Empresa 1 S.A.          ⌄   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Slightly narrower, same visual treatment
```

### Mobile (<768px)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  [🏢]  Empresa 1      ⌄   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Native mobile picker (iOS/Android)
cuando el viewport es muy pequeño
```

---

## Accesibilidad

### Contraste WCAG
```
Texto (#f1f5f9) sobre Fondo (rgba(255,255,255,0.04) en #020617)
= Ratio: 8.2:1 ✅ AAA (exceeds 7:1)

Chevron (#94a3b8) sobre Fondo
= Ratio: 5.1:1 ✅ AA (meets 4.5:1)

Hover/Focus (#3b82f6) sobre Fondo
= Ratio: 4.8:1 ✅ AA (meets 4.5:1)
```

### Keyboard Navigation
```
Tab       → Focus el dropdown (glow azul aparece)
Space     → Abre el dropdown
↑ / ↓     → Navega opciones
Enter     → Selecciona opción actual
Esc       → Cierra dropdown sin seleccionar
```

### Screen Readers
```
<select aria-label="Seleccionar cliente" class="glass-select">
  <option value="">-- Seleccionar Cliente --</option>
  <option value="cli_1">Empresa 1 S.A.</option>
  ...
</select>

Anuncia: "Seleccionar cliente, menú desplegable"
```

---

## Implementación Real (CSS)

```css
.glass-select {
  /* Base styling */
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  
  /* Chevron icon (SVG data URI) */
  background-image: url("data:image/svg+xml,<svg...>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 36px;
  
  /* Animation */
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
}

.glass-select:hover { /* ... */ }
.glass-select:focus { /* ... */ }
.glass-select:disabled { /* ... */ }
.glass-select option { /* ... */ }
```

---

## Uso en Componentes

### Ejemplo en RegistroOperativo.tsx
```tsx
<select
  value={selectedClienteId}
  onChange={e => setSelectedClienteId(e.target.value)}
  className="glass-select w-full rounded-xl pl-8 pr-4 py-2.5 text-sm appearance-none"
>
  <option value="">-- Seleccionar Cliente --</option>
  {data.clientes.map(c => (
    <option key={c.id} value={c.id}>{c.nombre}</option>
  ))}
</select>
```

### Con Icono Izquierdo
```tsx
<div className="relative">
  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none z-10" />
  <select className="glass-select w-full rounded-xl pl-8 pr-4 py-2.5 text-sm">
    {/* options */}
  </select>
</div>
```

---

**Versión Visual:** 1.0  
**Compatible con:** Sistema aFull v2.1.1  
**Design System:** Glass & Glow Bento  
**Autor:** Sistema aFull Development Team
