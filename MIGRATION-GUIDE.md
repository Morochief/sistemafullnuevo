# 🚀 Guía de Migración a Supabase + Prisma

Este documento contiene los pasos exactos para migrar Sistema aFull de JSON local a Supabase PostgreSQL.

## ✅ Pre-requisitos Completados

- [x] Dependencias instaladas (`prisma`, `@prisma/client`, `@supabase/supabase-js`)
- [x] `.env.local` configurado con credenciales de Supabase
- [x] `prisma/schema.prisma` definido con todos los modelos
- [x] `src/lib/prisma.ts` - Cliente Prisma singleton
- [x] `src/lib/supabase.ts` - Cliente Supabase para frontend
- [x] `scripts/migrate-to-supabase.ts` - Script de migración de datos

---

## 📋 Pasos de Migración

### **PASO 1: Generar Cliente Prisma**

```bash
npx prisma generate
```

Esto genera los tipos TypeScript del schema.

---

### **PASO 2: Crear Tablas en Supabase**

```bash
npx prisma db push
```

Esto crea todas las tablas en Supabase basándose en `schema.prisma`.

---

### **PASO 3: Migrar Datos de JSON a Supabase**

```bash
npx tsx scripts/migrate-to-supabase.ts
```

---

### **PASO 4: Verificar Datos en Supabase**

Ve a: https://app.supabase.com/project/opscthfkeqlqyrfvafmv/editor

---

### **PASO 5: Actualizar `package.json`**

Agrega estos scripts:

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:migrate": "tsx scripts/migrate-to-supabase.ts"
  }
}
```

---

## 🔐 IMPORTANTE: Cambiar Contraseña

⚠️ Cambia la contraseña de Supabase en:
https://app.supabase.com/project/opscthfkeqlqyrfvafmv/settings/database

Luego actualiza `.env.local` con la nueva contraseña.

---

## 🔄 Próximo Paso: Refactor Backend

Actualizar `server.ts` para usar Prisma en lugar de JSON.

**Ejemplo:**
```typescript
import { prisma } from './src/lib/prisma';

app.get('/api/clientes', requireAuth, async (req, res) => {
  const clientes = await prisma.cliente.findMany();
  res.json({ success: true, data: clientes });
});
```
