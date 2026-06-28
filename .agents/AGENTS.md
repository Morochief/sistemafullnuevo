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
  * Servidor Backend: Puerto `3100` (configurado en `.env`).
  * Puerto `3000` suele estar ocupado por otros servicios locales de Docker.

---

## 3. Matriz de Restricciones del Agente (ALWAYS / ASK / NEVER)

| SIEMPRE (ALWAYS) | PREGUNTAR (ASK) | NUNCA (NEVER) |
| :--- | :--- | :--- |
| Cargar `.env.local` antes de `.env` en scripts y servidores backend. | Ejecutar migraciones destructivas en la base de datos (`prisma migrate`). | Subir una URL pública (e.g. `http...` o `/uploads...`) a la función `guardarFotosVehiculo`. |
| Añadir un *Cache Buster* (`?t=timestamp`) al renderizar URLs de Supabase Storage en el frontend. | Realizar `git push` directo a la rama `main` en producción. | Omitir `preventDefault()` en controladores de envío de formularios. |
| Correr el Linter/Compilador (`npm run lint`) después de cada cambio en los archivos. | Modificar esquemas de bases de datos (`schema.prisma`). | Dejar llamadas a APIs del servidor sin protección de autorización (`requireAuth`). |
| Comprimir y optimizar imágenes en cliente antes de enviarlas al servidor. | Cambiar la configuración de variables de entorno globales. | Guardar contraseñas o datos sensibles sin encriptación previa. |

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
