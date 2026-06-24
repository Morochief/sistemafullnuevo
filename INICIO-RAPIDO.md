# 🚀 Inicio Rápido - Sistema aFull v2.1

## 1️⃣ Instalación

```bash
npm install
```

## 2️⃣ Configuración (Opcional)

```bash
# Copiar archivo de ejemplo
copy .env.example .env

# Editar .env y configurar (OPCIONAL para desarrollo):
# - GEMINI_API_KEY (solo si usarás enriquecimiento AI)
# - JWT_SECRET (usa el default para desarrollo local)
```

## 3️⃣ Iniciar Servidor de Desarrollo

```bash
npm run dev
```

El servidor arrancará en: **http://localhost:3000**

## 4️⃣ Credenciales de Acceso

### Pantalla de Login:

| Usuario  | Contraseña  | Rol       | Permisos                          |
|----------|-------------|-----------|-----------------------------------|
| admin    | admin123    | Admin     | ✅ Acceso completo + Reseteo BD   |
| kevin    | kevin123    | Operario  | ✅ Registro de horas e insumos    |
| rodrigo  | rodrigo123  | Técnico   | ✅ Registro de horas e insumos    |

## 5️⃣ Flujo de Prueba

### A. Login
1. Abrí http://localhost:3000
2. Ingresá: `admin` / `admin123`
3. Click en "Ingresar al Sistema"

### B. Dashboard
- Verás métricas del sistema (horas MO, costos, proyectos activos)
- Gráficos interactivos con Recharts

### C. Registro Operativo (Tab "Registro")
1. **Mano de Obra (MO):**
   - Seleccioná Cliente y Proyecto
   - Click "Iniciar Tarea"
   - Esperá unos segundos (el cronómetro corre)
   - Click "Finalizar Tarea"
   - Completá los datos (Colaborador, Descripción, Tarifa)
   - Click "Registrar Mano de Obra"

2. **Insumos:**
   - Seleccioná Cliente y Proyecto
   - Agregá filas con (+)
   - Completá Descripción, Cantidad, Precio Unitario
   - Click "Registrar Todos los Insumos"

### D. Importación Excel (Tab "Flujo Kevin")
1. Arrastrá un archivo Excel (.xlsx)
2. El sistema detecta automáticamente:
   - Clientes nuevos
   - Proyectos nuevos
   - Colaboradores mencionados
3. (Opcional) Click "Enriquecer con IA" si configuraste GEMINI_API_KEY
4. Click "Confirmar Importación"

### E. Reportes & Pre-Factura (Tab "Reportes")
1. **Exportar:** Filtrá por Cliente/Proyecto/Fecha y exportá a Excel
2. **Pre-Factura:**
   - Seleccioná un Proyecto
   - Ajustá el % de Markup (default: 35%)
   - El sistema calcula: Costo Base + Markup = Precio de Venta
   - Click "Generar PDF" (usa window.print)

### F. Administración (Tab "Directorio")
- Alta de Clientes, Proyectos, Colaboradores
- Registro manual de operaciones
- **PELIGRO (solo Admin):** Resetear BD a datos de muestra

## 6️⃣ Verificar Seguridad Implementada

### Test JWT Authentication:

#### 1. Sin Token (debe fallar):
```bash
curl http://localhost:3000/api/data
```
**Esperado:** `{"success":false,"error":{"code":"MISSING_TOKEN","message":"..."}}`

#### 2. Login y obtener Token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"usuario\":\"admin\",\"password\":\"admin123\"}"
```
**Esperado:** `{"success":true,"data":{"token":"eyJ...","user":{...}}}`

#### 3. Con Token (debe funcionar):
```bash
curl http://localhost:3000/api/data \
  -H "Authorization: Bearer [PEGAR_TOKEN_AQUI]"
```
**Esperado:** Datos de la BD

### Test Validación con Zod:

```bash
# Intento de crear registro con datos inválidos
curl -X POST http://localhost:3000/api/registros \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d "{\"clienteId\":\"\",\"total\":-100}"
```
**Esperado:** `400 Bad Request` con detalles de los campos inválidos

### Test Role-Based Access:

```bash
# 1. Login como kevin (Operario)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"usuario\":\"kevin\",\"password\":\"kevin123\"}"

# 2. Intentar resetear BD (requiere Admin)
curl -X POST http://localhost:3000/api/clear \
  -H "Authorization: Bearer [TOKEN_KEVIN]"
```
**Esperado:** `403 Forbidden` porque kevin NO es Admin

## 7️⃣ Estructura de Archivos Nuevos

```
sistema-afull-googleia/
├── server-auth.ts              ← 🆕 Módulo de autenticación JWT
├── server-validation.ts        ← 🆕 Schemas Zod de validación
├── src/
│   ├── authFetch.ts            ← 🆕 Helper para fetch autenticado
│   └── types.ts                ← ⚡ Actualizado con tipos de Auth + ApiResponse
├── server.ts                   ← ⚡ Actualizado con auth + mutex + validación
├── .env.example                ← ⚡ Actualizado con JWT_SECRET
├── MEJORAS-IMPLEMENTADAS.md    ← 🆕 Documentación de cambios
└── INICIO-RAPIDO.md            ← 🆕 Esta guía
```

## 8️⃣ Scripts Disponibles

```bash
npm run dev        # Desarrollo (HMR activo)
npm run build      # Compilar para producción
npm start          # Servidor de producción
npm run lint       # Verificar TypeScript
npm run clean      # Limpiar dist/
```

## 9️⃣ Troubleshooting

### ❌ Error: "MISSING_TOKEN"
**Problema:** El frontend no está enviando el token JWT  
**Solución:** Hacé logout y volvé a loguearte

### ❌ Error: "INVALID_TOKEN"
**Problema:** Token expirado (24hs) o corrupto  
**Solución:** Hacé logout y volvé a loguearte

### ❌ Error: "FORBIDDEN"
**Problema:** Tu usuario no tiene permisos para esa acción  
**Solución:** Usá el usuario `admin` para acciones administrativas

### ❌ Error al importar Excel
**Problema:** Archivo corrupto o formato no soportado  
**Solución:** Verificá que sea .xlsx, .xls o .csv válido

### ❌ "API Key de Gemini no configurada"
**Problema:** GEMINI_API_KEY no está en .env  
**Solución:** O agregala en .env, o no uses la función "Enriquecer con IA"

## 🔟 Backup Manual de BD

La BD está en `database.json`. Antes de cualquier operación masiva:

```bash
# Crear backup
copy database.json database.backup.json

# Restaurar desde backup
copy database.backup.json database.json
```

## 1️⃣1️⃣ Próximos Pasos

- [ ] Configurar JWT_SECRET único para producción
- [ ] Habilitar HTTPS en producción
- [ ] Configurar rate limiting
- [ ] Migrar a PostgreSQL (si el volumen crece >10K registros)
- [ ] Agregar logs estructurados con winston

---

**¿Dudas?** Revisá `DOCUMENTATION.md` o `MEJORAS-IMPLEMENTADAS.md`

**Versión:** 2.1.0  
**Última actualización:** 2026-06-18
