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

### H. Evitar Dependencias Circulares de Módulos (ESM / esbuild)
- **Regla:** En proyectos empaquetados bajo ESM con esbuild, si un módulo dependiente (como `server-auth.ts`) requiere el singleton de Prisma (`prisma.ts`), el archivo principal (`server.ts`) debe colocar la importación de `prisma` al inicio del archivo (antes que los middlewares).
- **Solución:** Si se evalúan las rutas y middlewares antes de que se resuelva la inicialización de la base de datos por dependencias circulares, la constante `prisma` quedará como `undefined`, provocando errores `Cannot read properties of undefined` en tiempo de ejecución.

### I. Caching Seguro de Sesión en Memoria (Pérdida de Payload)
- **Regla:** Al cachear el estado de actividad del usuario en `requireAuth` para mitigar latencias, se debe guardar en la entrada de la caché la metadata de negocio completa (`nombre`, `rol`, `colaboradorId`).
- **Solución:** No confiar únicamente en los datos planos que vienen originalmente en la cookie JWT (los cuales pueden estar obsoletos o no tener campos como `colaboradorId` tras migraciones). La caché debe actuar como snapshot sincronizado del usuario en la base de datos para inyectarlo en `req.user` de forma consistente en cada petición recurrente.



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


## H. Subsistema de Marcaciones (Control Horario con Geocerca)

### Proposito
Permitir a empleados marcar entrada y salida solo si estan fisicamente dentro de la zona laboral (validado por GPS). Proporciona al admin un timeline auditable con deteccion de uso compartido de credenciales.

### Modelos de Datos (Prisma)
- **Marcacion**: id, usuario, tipo (ENTRADA|SALIDA), timestamp (server-side), lat/lng, precision, ip, dispositivoHash (SHA-256 de user-agent + IP), userAgent, origen (APP|API)
- **GeocercaConfig**: id, lat, lng, radioMetros, activo (una fila, id='default')

### Endpoints
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | /api/marcacion/config | Publico | Devuelve geocerca activa. Seed automatico si no existe |
| POST | /api/marcacion/entrada | requireAuth | Marca entrada. Valida geocerca y GPS. Guarda IP + hash dispositivo |
| POST | /api/marcacion/salida | requireAuth | Marca salida. Mismas validaciones |
| GET | /api/marcacion/mis-marcaciones | requireAuth | Historial del usuario (ultimas 50) |
| GET | /api/marcacion/admin/timeline | requireAdmin | Timeline completo con deteccion de anomalias (MULTIPLES_IPS, MULTIPLES_DISPOSITIVOS) |

### Frontend
- **MarcacionesUI.tsx** — Boton ENTRADA/SALIDA en el header (visible para todos los usuarios). Usa Geolocation API del navegador. Muestra historial de ultimas 5 marcaciones en dropdown. Cambia de color segun estado (azul = sin entrada, verde = entrada activa).
- **TimelineMarcaciones.tsx** — Pestana "Marcaciones" en AdminPanel (color ambar). Filtro por usuario, muestra IPs, coordenadas, y alertas de anomalias.

### Reglas de Negocio
1. **Geocerca como firewall** — no se puede marcar fuera de la zona. Sin excepcion.
2. **Timestamp del servidor** — el servidor estampa la hora, no el cliente.
3. **GPS requerido** — si el navegador no da permisos, no se puede marcar.
4. **Pares entrada-salida** — no se permite doble entrada sin salida, ni salida sin entrada previa.

### Deteccion de Credenciales Compartidas
El endpoint /api/marcacion/admin/timeline agrupa marcaciones por usuario y detecta:
- MULTIPLES_IPS: mismo usuario desde distintas IPs
- MULTIPLES_DISPOSITIVOS: mismo usuario con distinto dispositivoHash

### Seed Automatico
Al primer GET /api/marcacion/config si no existe geocerca, se crea con coordenadas del local y radio 100m.

### Coordenadas de Geocerca
- Lat: -25.320588291024226
- Lng: -57.62418119104182
- Radio: 100 metros


## I. Lecciones Aprendidas — Sesion de Debugging (Junio 2026)

### 1. esbuild + PrismaClient: Una Sola Instancia Compartida
**Problema:** esbuild renombra la segunda importacion de PrismaClient como "PrismaClient2" en el bundle. Como @prisma/client es externo (--packages=external), el alias no existe en el package, resultando en undefined.
**Regla:** NUNCA tener dos archivos con su propio `new PrismaClient()`. Crear un unico singleton en `src/lib/prisma.ts` y que todos los archivos importen `{ prisma }` desde ahi. Esto evita que esbuild renombre la clase y que se generen instancias duplicadas.
**Sintoma:** "Cannot read properties of undefined (reading 'findFirst')" en handlers que usan prisma en el bundle de produccion.

### 2. prisma generate en Build Script
**Problema:** Render ejecuta npm run build, pero si el script no incluye `prisma generate`, el Prisma Client empaquetado NO tiene los modelos agregados al schema despues de la instalacion inicial.
**Regla:** El script build en package.json DEBE empezar con `prisma generate && ...` para asegurar que el cliente tenga todos los modelos del schema actual.
**Sintoma:** `prisma.ModeloNuevo` es undefined en produccion aunque el schema local tenga el modelo.

### 3. Cache de requireAuth con nombre Stale
**Problema:** La cache de 60s en requireAuth almacena `activo/checkedAt`. Si un JWT se firmo sin `nombre` en el payload (codigo anterior), la cache quedaba con `nombre: undefined` y nunca refrescaba porque el cache hit no volvia a consultar DB.
**Regla:** Invalidar la cache si `nombre` (u otros campos de sesion) estan vacios: `const cacheStale = cached && !cached.nombre;`. En cache hit con nombre vacio, forzar DB fetch.
**Sintoma:** `user: undefined` en logs de auth aunque el usuario exista en DB.

### 4. Safe Checks en .toLowerCase()
**Problema:** Cualquier `.toLowerCase()` sobre `user.nombre`, `col.nombre` o `currentUser.nombre` crashea si el valor es undefined. El safe check `col.nombre ?` no protege si `col` mismo es undefined (como cuando `dbState?.colaboradores` es undefined).
**Regla:** Siempre usar: `(dbState?.colaboradores || []).find(col => { if (!col?.nombre || !currentUser?.nombre) return false; ... })`. Nunca asumir que un array existe ni que un elemento tiene todas las propiedades.

### 5. ErrorBoundary con Boton de Cerrar Sesion
**Problema:** Si la app crashea durante la carga inicial (ej: session invalida), el ErrorBoundary atrapa el error pero solo ofrece "Reintentar" o "Recargar Pagina". Ambos llevan al mismo crash. El usuario queda atrapado en un bucle infinito sin poder limpiar su cookie JWT.
**Regla:** El ErrorBoundary SIEMPRE debe incluir un boton "Cerrar Sesion" que llame a `POST /api/auth/logout` y redirija a /.

### 6. Insercion de Codigo Grande con Node Scripts
**Problema:** Los Scripts de Node que modifican archivos grandes (3000+ lineas) usando reemplazos de texto exactos fallan silenciosamente por diferencias minimas de whitespace, encoding (CRLF vs LF), o caracteres especiales.
**Regla:** Para modificaciones grandes, usar scritps .mjs en archivos separados (no -e inline) y verificar con Select-String que los cambios se aplicaron. Mejor aun: hacer los cambios manualmente o con herramientas disenadas para AST en vez de texto plano.

### 7. Bundle Hash de Produccion
**Problema:** Al debuggear errores de produccion, el bundle hash del JS cambia con cada build. Los errores del bundle anterior pueden confundirse con el actual si Render no termino de desplegar.
**Regla:** Verificar el hash del bundle (index-XXXX.js) en los logs del navegador contra el hash del ultimo build local. Si no coinciden, el deploy no se completo.

### 8. prisma db push para Tablas Nuevas
**Problema:** Agregar modelos nuevos al schema.prisma y hacer prisma generate NO crea las tablas en la base de datos. prisma generate solo genera el cliente TypeScript. Las tablas en Supabase/PostgreSQL se crean con prisma db push.
**Regla:** Despues de agregar modelos nuevos al schema:
1. `npx prisma generate` (cliente local)
2. `npx prisma db push --accept-data-loss` (crea las tablas en Supabase)
3. El build script en package.json debe incluir `prisma generate &&` para Render.
**Sintoma:** "The table public.X does not exist" en produccion. Las queries fallan aunque el schema local este correcto.

### 9. Verificacion de Geocerca (403 FUERA_DE_ZONA)
**Problema:** El endpoint /api/marcacion/entrada devuelve 403 FUERA_DE_ZONA. Esto NO es un error - el sistema de geocerca esta funcionando. El usuario debe estar fisicamente dentro del radio (100m) del local para marcar.
**Regla:** Para probar sin estar en el local:
- Aumentar radioMetros en tabla geocerca_config via DB
- O desactivar la geocerca (activo = false)
- O mockear GPS en DevTools del navegador > Sensors > Location
El sistema RECHAZA marcaciones fuera de zona por diseno.

### 10. Secuencia Completa para Agregar un Nuevo Subsistema
Basado en la experiencia de agregar el subsistema de Marcaciones:
1. Schema: Agregar modelos a schema.prisma
2. prisma generate (cliente local)
3. prisma db push (tablas en Supabase)
4. Endpoints: Agregar rutas en server.ts
5. Build: Verificar que server.mjs se genera sin errores de esbuild
6. prisma generate en build script (para Render)
7. Frontend: Componente + integracion
8. Lecciones: Documentar problemas encontrados en AGENTS.md
**Errores comunes:** esbuild renombra PrismaClient duplicado, cache de requireAuth con datos stale, tablas no creadas en Supabase, .toLowerCase() sin safe checks.

### 11. UI/UX Consistency Audit — Hallazgos Clave
**Problema:** 17 componentes con estilos inconsistentes — botones con 3 radios distintos, inputs con clases inline en vez del sistema glass, labels con 3 formatos de texto diferentes, 4 easing curves distintas para animaciones.
**Regla:** Antes de tocar UI, auditar todos los componentes revisando:
1. className patterns: glass-panel, glass-input, glass-select deben usarse en TODOS los componentes
2. Button radii: estandarizar a rounded-xl para botones
3. Labels: text-xs font-mono uppercase tracking-wider text-slate-400, un solo formato
4. Gradients: botones primarios siempre from-blue-600 to-indigo-600, nunca hex hardcodeados
5. ErrorBoundary: debe seguir el mismo glass design system
6. Mobile: no usar hidden md:flex para elementos funcionales como botones de accion

### 12. Shared Animation Config
**Problema:** 4 easing curves diferentes en componentes: duration:0.22, [0.22,1,0.36,1], [0.16,1,0.3,1], y spring(stiffness:300,damping:25).
**Regla:** Una config compartida:
- Tabs/paginas: { duration: 0.22 } con opacity:0, y:15
- Modales: type: spring, stiffness: 300, damping: 25 con scale:0.95, y:20
- Tarjetas/metricas: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } con opacity:0, y:20

### 13. Bottom Navigation para Mobile
**Problema:** En mobile, las tabs compiten por espacio en el header con logo, badge de usuario, boton de marcacion y logout.
**Regla:** Para mobile (<768px), mover navegacion a barra inferior fija (bottom nav) estilo app nativa. Header solo con logo + acciones de usuario.

### 14. Mobile Metrics Grid
**Problema:** VehiculosAdminView usa grid-cols-2 en mobile mientras Dashboard usa grid-cols-1. Inconsistencia en grillas de metricas.
**Regla:** Todas las grillas de metricas: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4.

### 15. prisma db push --accept-data-loss Resetea Valores de Columna
**Problema:** Ejecutar `prisma db push --accept-data-loss` sobre una tabla existente (ej: `usuarios.rol`) **recrea la columna con su valor default**. Si la columna tiene un default (`@default(OPERADOR)`), todos los registros existentes se sobrescriben con ese default, independientemente del valor que tuvieran antes.
**Regla:** Despues de cualquier `prisma db push --accept-data-loss`, verificar y restaurar los valores de las columnas afectadas:
1. Consultar los valores actuales: `prisma.usuario.findMany({ select: { username: true, rol: true } })`
2. Restaurar los valores correctos via query directa o desde el codigo de seed
3. El log "Users already exist in DB, skipping seed" significa que el seed NO se ejecuta, incluso si los datos estan corruptos. Considerar agregar un check de integridad que compare los valores esperados vs reales.

### 16. Shared Animation Config y Bottom Nav
**Problema:** Al crear `src/lib/animations.ts` para estandarizar animaciones, los scripts de Node que modifican App.tsx fallan porque las cadenas de texto exactas (como strings con saltos de linea) no coinciden con el archivo real debido a diferencias de whitespace, CRLF vs LF, o encoding.
**Regla:** Para modificar App.tsx (+3000 lineas), NO usar scripts de reemplazo de texto. Usar herramientas que operen sobre AST (como jscodeshift) o hacer los cambios a mano. Alternativa: extraer las variantes de motion a un archivo compartido es correcto, pero la integracion debe verificarse con git diff antes de commitear.

### 17. Bottom Nav para Mobile con RBAC
**Regla:** La navegacion inferior (bottom nav) en mobile debe replicar exactamente las mismas reglas RBAC que la navegacion superior. Si el admin ve ciertos tabs arriba, debe ver los mismos abajo. Usar el mismo array de tabs y el mismo filtro `.filter()` para evitar desincronizacion.
**Implementacion:** `{tabs.filter(tab => { ... }).map(tab => <button>...)}` — mismo array, mismo filtro, distinto render (iconos verticales vs texto horizontal).

### 18. Encoding UTF-8 en Strings de Columna Excel
**Problema:** El caracter `ó` en `Descripción` se guardó como `DescripciÃ³n` en server.ts (UTF-8 bytes `0xC3 0xB3` interpretados como Latin-1). El import de Excel buscaba la columna `'Descripción'` con el string corrupto, nunca encontraba match, y todas las descripciones caían al fallback `'Sin descripción'`.
**Regla:** En Node.js/TypeScript, NUNCA confiar en que los acentos y caracteres UTF-8 se guarden correctamente al editar archivos via scripts de reemplazo de texto. El encoding del archivo puede ser UTF-8 BOM, UTF-8 sin BOM, o Latin-1, y el editor/script puede interpretarlo incorrectamente.
- Para verificar: `hexdump -C server.ts | grep -i "descrip"` y buscar los bytes correctos (Ã³ = 0xC3 0xB3 para ó). Si aparecen como 0xC3 0x83 0xC2 0xB3, estan doblemente encodeados.
- Para arreglar: usar un script .mjs (no inline -e) que lea y escriba con encoding explícito UTF-8.
- Prevenir: Usar `row['Descripci\\u00f3n']` en vez del caracter literal, o definir los nombres de columna en una constante al inicio del archivo.
**Sintoma:** Al importar Excel, todas las descripciones aparecen como "Sin descripciÃ³n" aunque el Excel tenga descripciones reales.

### 19. Vinculacion Usuario-Colaborador: IDs Huérfanos despues de db push
**Problema:** El seed de usuarios asigna `colaboradorId` basado en `prisma.colaborador.findFirst({ where: { nombre: { contains: searchName } } })`. Si los colaboradores se recrearon (ej: despues de `prisma db push --accept-data-loss` o un clear de DB), los IDs generados en el seed NO coinciden con los IDs reales de los colaboradores en la DB. El usuario queda vinculado a un ID que no existe.
**Regla:** Despues de cualquier operacion que pueda cambiar IDs en la DB (`db push`, `clear`, restore), verificar las vinculaciones:
```
const users = await prisma.usuario.findMany({ select: { username: true, colaboradorId: true }});
const cols = await prisma.colaborador.findMany({ select: { id: true, nombre: true }});
// Verificar que cada colaboradorId de usuario exista en cols
```
Si hay IDs huerfanos, re-vincular manualmente:
```
const c = await prisma.colaborador.findFirst({ where: { nombre: { contains: 'Rodrigo' } }});
await prisma.usuario.update({ where: { username: 'rodrigo' }, data: { colaboradorId: c.id }});
```
**Sintoma:** "No tenes permiso para registrar horas de otros colaboradores" (403) aunque el usuario sea el colaborador correcto. "Sin Vinculacion" en la lista de usuarios aunque se haya seleccionado un colaborador en el formulario de edicion.

### 20. Verificar Integracion con git diff Antes de Commiteary
**Problema:** Los scripts de Node que modifican archivos grandes (3000+ lineas) usando reemplazos de texto exactos fallan silenciosamente. El script se ejecuta, no tira error, pero el archivo no se modifica porque el patron de busqueda no coincide exactamente (diferencia de whitespace, CRLF vs LF, encoding, o escape de caracteres). El desarrollador commitea y sube el cambio, pero el archivo nunca se actualizo.
**Regla:** Despues de ejecutar cualquier script de modificacion de archivos via Node:
1. Verificar con `git diff --stat` que los archivos esperados aparezcan como modificados
2. Verificar con `git diff HEAD -- <archivo>` que los cambios especificos esten
3. Si no hay diff, el script fallo silenciosamente. Usar `findstr /N "texto-esperado"` (Windows) para confirmar que el patron existe en el archivo
4. Alternativa: en vez de scripts con replace(), usar herramientas AST o edicion directa con edit_file
**Sintoma:** Se sube un commit con "feat: add X to component" pero el componente en produccion no tiene X. El diff del commit muestra 0 cambios en el componente esperado.

### 21. Leer el Archivo Real Antes de Reemplazar Texto
**Problema:** Al intentar modificar `server-audit.ts` via script de Node, se uso un patron de busqueda basado en como se recordaba el archivo (con `const timestamp = ...` y `logLine`), pero el archivo REAL tenia una implementacion diferente (con `const record = { timestamp: ... }` y `JSON.stringify`). El script se ejecuto sin error, pero no reemplazo nada porque el patron no existia.
**Regla:** Antes de escribir un script de reemplazo de texto:
1. `cat server-audit.ts` para ver el contenido EXACTO del archivo (no confiar en la memoria)
2. Copiar y pegar el texto exacto a buscar (incluyendo saltos de linea y espacios)
3. Despues de ejecutar, verificar con `git diff` que el archivo cambio
4. Alternativa mas segura: leer el archivo, buscar el contenido real con `c.includes('texto')`, y solo entonces reemplazar
**Sintoma:** El commit muestra pocos cambios (ej: 1 linea) cuando deberia mostrar muchos. La funcionalidad nueva no aparece en produccion aunque el codigo se haya deployado.
