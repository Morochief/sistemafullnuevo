# Sistema aFull - Agent Specification & Environment Rules

Este documento define la base de conocimiento, las reglas de arquitectura y las directrices operativas que deben seguir todos los agentes de IA que colaboren en este proyecto.

---

## 1. Información General del Proyecto

**Sistema aFull** es una plataforma de automatización operativa diseñada para gestionar:
* **Registros de Horas / Mano de Obra (MO)** de colaboradores.
* **Registros de Insumos y Costos** asociados a proyectos y clientes.
* **Registro y Control de Vehículos** (kilometraje inicial/final, discrepancias por GPS, consumo y fotos de odómetro).
* **Importación y Enriquecimiento de Datos** desde archivos Excel utilizando IA (Gemini).

### Arquitectura Técnica:
* **Frontend**: React 19, Vite, TailwindCSS (Vite plugin), Lucide Icons, Framer Motion.
* **Backend**: Node.js Express (ESM format), TypeScript, Prisma ORM.
* **Base de Datos**: PostgreSQL alojado en Supabase (con pooler de transacciones en puerto 6543 y directo en 5432).
* **Almacenamiento**: Supabase Storage (Bucket: `vehiculos-fotos`).

---

## 2. Convenciones del Entorno de Desarrollo

* **Variables de Entorno**:
  * Para desarrollo local, las credenciales se cargan desde `.env.local`.
  * En producción (Render/Vercel), las credenciales se inyectan a través del panel de control.
  * **CRITICAL**: El servidor de Express siempre debe cargar `.env.local` antes que `.env` para asegurar que las variables de Supabase estén disponibles localmente.
* **Puertos por Defecto**:
  * Servidor Backend: Puerto `3100` (cargado localmente desde `.env.local`).
  * Puerto `3000` suele ser usado por servicios locales de Docker, o como fallback/puerto en producción.

---

## 3. Matriz de Restricciones del Agente (ALWAYS / ASK / NEVER)

| SIEMPRE (ALWAYS) | PREGUNTAR (ASK) | NUNCA (NEVER) |
| :--- | :--- | :--- |
| Cargar `.env.local` antes de `.env` en scripts y servidores backend. | Ejecutar migraciones destructivas en la base de datos (`prisma migrate`). | Subir una URL pública (e.g. `http...` o `/uploads...`) a la función `guardarFotosVehiculo`. |
| Traducir explícitamente enums de Base de Datos a valores de UI (ej: mapDbRolToUi / mapUiRolToDb) al interactuar con Prisma. | | Insertar strings arbitrarios directamente en columnas mapeadas a Enums en Prisma. |
| Añadir un *Cache Buster* (`?t=timestamp`) al renderizar URLs de Supabase Storage en el frontend. | Realizar `git push` directo a la rama `main` en producción. | Omitir `preventDefault()` en controladores de envío de formularios. |
| Correr el compilador/typecheck (`npm run build`) después de cada cambio en los archivos. | Modificar esquemas de bases de datos (`schema.prisma`). | Dejar llamadas a APIs del servidor sin protección de autorización (`requireAuth`). |
| Invalidar inmediatamente la caché de sesión (`userActiveCache.delete`) al desactivar o modificar un usuario. | Cambiar la configuración de variables de entorno globales. | Guardar contraseñas o datos sensibles sin encriptación previa. |
| Comprimir y optimizar imágenes en cliente antes de enviarlas al servidor. | | |

---

## 4. Agentes Especializados (Subagents)

Cuando sea necesario realizar tareas complejas, se delegará en los siguientes roles especializados:

* **`db-guardian`**: Especializado en Prisma, migraciones seguras y rendimiento de queries de bases de datos.
* **`ui-auditor`**: Especializado en responsive design, transiciones fluidas de UI (Framer Motion) y optimización de renderizados.
* **`security-inspector`**: Especializado en sanitización de inputs, protección CSRF y autenticación segura con cookies httpOnly.

---

## 5. Documentación de Subsistemas Clave

### Flujo de Fotos de Vehículos
1. **Inicio de Viaje**: El usuario toma una foto del odómetro. El frontend la comprime y la envía al endpoint `/api/viaje/start`, el cual la almacena en base64 en la tabla `ViajeActivo`.
2. **Fin de Viaje**: El usuario toma la foto final. El frontend envía la foto final en base64 junto con los datos del viaje al endpoint `/api/viaje/stop`.
3. **Procesamiento de Fotos**: El servidor invoca `guardarFotosVehiculo()`. Esta función toma las fotos en base64, las decodifica a binario y las sube a Supabase Storage bajo la ruta `vehiculos/<registroId>/odometro_[inicio/fin].jpg`. Retorna las URLs públicas deterministas de las fotos.
4. **Paridad de URL**: Dado que las URLs de Supabase son deterministas, no cambian aunque se actualice la foto física. Por lo tanto, el frontend debe usar el *Cache Buster* (`?t=timestamp`) para evitar que el navegador cargue fotos antiguas de la caché o páginas de error 404 previas.

### Gestión de Usuarios y Roles (RBAC)
1. **Roles Soportados (Prisma Enum)**:
   - **`ADMIN`**: Acceso total al panel de administración, reportes, importaciones y creación/desactivación de cuentas.
   - **`OPERADOR`**: Registro de horas y control de viajes. No puede ver datos de administración general.
   - **`VISOR`**: Vista de solo lectura. Útil para auditoría y visualización de reportes, sin privilegios de edición o borrado.
2. **Endpoints de Administración (Admin-Only + rate limited)**:
    - `GET /api/users`: Retorna lista de cuentas sin contraseñas.
    - `POST /api/users`: Crea nuevo usuario validando contraseña con `PasswordComplexitySchema`.
    - `DELETE /api/users/:id`: Toggle de estado `activo` (soft delete) con invalidación inmediata de `userActiveCache`.

---

## 6. Lecciones Aprendidas & Decisiones de Diseño

### A. Interfaz y Diálogos de Notificación (Eliminación de Nativos)
- **Regla:** Queda estrictamente prohibido el uso de `alert()` o `confirm()` nativos del navegador.
- **Solución:** Utilizar el provider global `NotifProvider` y sus métodos `showToast(msg, type)` y `requestConfirm(title, msg, type, callback, confirmText)`.
- **Estilos:** Toda notificación o modal debe usar el estilo glassmorphic (`glass-panel`, `glass-input`, `glass-select`) y transiciones de muelle (spring) con `motion/react` para mantener una estética premium coherente.

### B. Sincronización de Tipos y Enums (Prisma/PostgreSQL)
- **Regla:** Cuando se interactúe con enums nativos de base de datos (ej. Rol en la tabla de usuarios), nunca se deben insertar strings libres o realizar conversiones implícitas en crudo en el backend.
- **Solución:** Implementar funciones helper explícitas de traducción bidireccional (ej. `mapDbRolToUi` y `mapUiRolToDb`) para asegurar que el backend se comunique con la DB usando los tipos exactos de Prisma, evitando crasheos en tiempo de ejecución.

### C. Caché de Sesión de Usuario y Seguridad
- **Regla:** Al cachear en memoria el estado de actividad de un usuario para proteger endpoints pesados o recurrentes (ej. `requireAuth` con TTL de 60s), cualquier mutación que deshabilite, edite o elimine un usuario debe invalidar inmediatamente la caché.
- **Solución:** Ejecutar de forma explícita `userActiveCache.delete(username)` en los endpoints de mutación (`PUT`, `DELETE`) para garantizar la revocación inmediata de acceso sin esperar la expiración del TTL.

### D. Filosofía de Desarrollo Minimalista (Ponytail)
- **Regla:** Seguir la escalera de PonyTail antes de escribir código: YAGNI -> Reutilizar -> Usar stdlib -> Usar APIs nativas -> Usar dependencias ya instaladas -> Escribir el mínimo diff posible.
- **Seguridad:** No escatimar en validaciones de seguridad (ej. `PasswordComplexitySchema` y sanitización CSRF) bajo el pretexto de simplificar código.

### E. Procedimiento de Rollback en Despliegues (Producción)
- **Fallo en Base de Datos / Migración Fallida:**
  1. Restaurar backup de la base de datos Supabase desde el panel de control.
  2. Revertir el esquema y migrations locales corriendo `git checkout <commit_anterior_estable> prisma/`.
  3. Ejecutar `npx prisma db push` para asegurar que el motor de la base de datos vuelva a estar en sincronía con el esquema anterior estable.
- **Fallo en Servidor Backend:**
  1. En el panel de control de **Render**, ir a la sección **Deploys**.
  2. Identificar el último deploy estable y hacer clic en **Rollback** para redesplegar el build anterior exitoso.

