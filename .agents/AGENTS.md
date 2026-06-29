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
  * Servidor Backend: Puerto `3000` por defecto en el código (`process.env.PORT || 3000`), o puerto `3100` si es configurado explícitamente en el archivo `.env.local` mediante la variable `PORT`.

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

Cuando sea necesario realizar tareas complejas, se delegará en los siguientes **roles conceptuales de subagentes** (configurando el prompt del sistema de la tarea según corresponda, sin requerir la presencia de archivos físicos en el repositorio):

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
    - `PUT /api/users/:id`: Actualiza perfiles de usuario, roles y/o contraseñas (hasheándolas con bcrypt).
    - `DELETE /api/users/:id`: Desactiva/activa una cuenta (soft toggle) e invalida inmediatamente la sesión en caché. Admite el parámetro query `?hard=true` para realizar una eliminación física permanente en la base de datos.


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

### F. Defensa en Progreso contra Inconsistencias de Base de Datos (Fail-Fast)
- **Regla:** En flujos asíncronos de dos fases (ej: iniciar viaje -> finalizar viaje), el backend debe validar la existencia física en DB de todas las llaves foráneas en la primera fase (`/api/viaje/start`).
- **Solución:** Prevenir que el flujo comience con IDs obsoletos o inválidos si el usuario vació tablas. Esto evita que el servidor explote con un error 500 por violaciones de FK (`P2003`) en la segunda fase (`/api/viaje/stop`), la cual es mucho más difícil de corregir reactivamente en el cliente.

### G. Coherencia de Seeding (Sincronización UI-DB)
- **Regla:** Al programar seeds automáticos por base de datos vacía, nunca se deben crear registros genéricos ficticios (ej: "Cliente General") si el frontend o los fixtures históricos tienen hardcodeados IDs específicos (`cli_1`, `pro_1`).
- **Solución:** Sintonizar los IDs sembrados de forma unívoca con el `initialData` del negocio original para garantizar que los dropdowns y consultas funcionen perfectamente tras limpiezas de base de datos.



## 7. Estrategia y Suite de Tests de Integración

Para blindar la lógica de negocio sin sobre-ingeniería (filosofía *Ponytail*), se cuenta con una suite de tests de integración que realiza llamadas HTTP reales usando `supertest` contra la base de datos de desarrollo (sin mockear Prisma).

### Matriz de Cobertura
| Suite | Flujo | Gap que Cierra |
| :--- | :--- | :--- |
| `users-integration.test.ts` | CRUD completo de usuarios con JWT + CSRF | Regresiones en payload (ej: colaboradorId null/undefined) |
| `auth-integration.test.ts` | Login exitoso/fallido y Logout | Fallas en entrega o limpieza de cookies JWT |
| `import-integration.test.ts` | Confirmar importación masiva en transacción | Integridad transaccional, errores en conteos de inserción |
| `vehiculos-integration.test.ts` | Viajes start/stop con fotos base64 | Fallas en subida de fotos a Supabase Storage y validaciones Zod |

### Directrices y Lecciones Aprendidas de Tests
1. **Aislamiento del Listener:** El inicio del servidor en `server.ts` está condicionado a `process.env.NODE_ENV !== 'test'`. Esto permite exportar `app` y que `supertest` realice peticiones sin causar conflictos de puertos ocupados.
2. **Ambiente de Ejecución:** Los tests de API deben correr bajo el ambiente de Node puro. Se debe incluir la directiva `// @vitest-environment node` en la cabecera del archivo de pruebas para evitar colisiones con variables globales del navegador simuladas por `jsdom`.
3. **Gestión de Timeouts:** Las pruebas que involucren criptografía (hasheo de contraseñas con bcrypt en creación) o llamadas de red externas reales (subida de fotos de odómetro a Supabase Storage) deben tener un timeout extendido (mínimo `15000`ms a `20000`ms) para evitar falsos negativos por latencia.
4. **Limpieza en Cascada (Cleanup):** Al finalizar los tests de integración (`afterAll`), se debe realizar el borrado en cascada respetando las restricciones de llave foránea (Foreign Keys) de Supabase (ej: primero eliminar registros, luego proyectos, luego el cliente temporal).


