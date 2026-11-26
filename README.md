# Aula Norte LMS

Plataforma LMS (React + TypeScript + Vite + Tailwind + React Router + Supabase) convertida desde el prototipo aprobado
(`docs/prototipo-aprobado.html`). Mantiene su identidad visual, navegación y flujos.

## Instalación (3 acciones)

```bash
npm install
npm run dev          # abre http://localhost:5173  → te lleva solo al asistente /instalar
```

1. **Project URL** de Supabase (Project Settings → API).
2. **Publishable / anon key** (la clave *pública*; el asistente rechaza la `service_role`).
3. **Crear el administrador** (nombre, correo, contraseña, confirmación).

Entre el paso 1 y el 3 el asistente te pide **un clic de copiar/pegar**: pegar un script SQL en el *SQL Editor* de
Supabase y pulsar *Run* (ver "Limitación honesta"). El script crea tablas, índices, RLS, funciones, triggers y buckets
de Storage, y trae opcionalmente 6 cursos de ejemplo.

> Alternativa por CLI: `supabase db push` con `supabase/migrations/0001_schema.sql`.

### Opcional pero recomendado: crear usuarios desde el panel
Para que el administrador pueda crear estudiantes/instructores (sin que se registren solos):

```bash
supabase login && supabase link --project-ref TU_REF
supabase functions deploy admin-create-user
```
Sin esto todo funciona igual: la persona se registra en `/registro` y tú la inscribes en *Inscripciones y pagos*.

### Publicar el sitio
`npm run build` genera `dist/`. Define en tu hosting (Vercel, Netlify, Cloudflare Pages…):
```
VITE_SUPABASE_URL=...        VITE_SUPABASE_ANON_KEY=...
```
(o completa `public/config.js`). El asistente guarda la configuración solo en el navegador del administrador;
por eso al final te muestra exactamente qué variables definir. Las rutas SPA ya están resueltas (`vercel.json`, `public/_redirects`).
En Supabase → Authentication → URL Configuration agrega la URL de tu sitio (necesaria para recuperar contraseña).

## Limitación honesta de la instalación

Con la clave pública, un navegador **no puede ni debe** crear tablas ni políticas (eso exige privilegios de administrador de base de datos;
la única forma de hacerlo desde el navegador sería exponer la `service_role`, lo que está prohibido). Por eso el DDL se ejecuta una vez
desde el SQL Editor, y el resto (conexión, verificación, primer administrador) es automático. No hay mecanismo más simple que sea seguro.

**Cómo se protege la creación del primer administrador:** el asistente genera un código aleatorio de un solo uso, lo incrusta en el
script SQL (se guarda *hasheado* en `private.setup`, un esquema inaccesible desde la API) y la función `claim_first_admin(code)`
solo promueve al llamante si el código coincide, no existe ya un administrador y bajo bloqueo transaccional. Tras usarse, el código se borra.
Un visitante que manipule peticiones no puede convertirse en administrador.

## Seguridad (resumen)
- RLS activo en todas las tablas; roles `admin | instructor | student` en `profiles.role`.
- Un trigger impide que un usuario cambie su propio rol, estado o correo y que se elimine al último admin.
- Todo alta de usuario nace como `student` (el trigger ignora cualquier "rol" enviado por el cliente).
- El progreso y los certificados **solo** se escriben vía funciones `SECURITY DEFINER` (`set_lesson_progress`): el cliente no puede
  insertarse progreso ni certificados directamente. Progreso = obligatorias completadas / obligatorias × 100; al llegar a 100 %
  se marca el curso, se registra la fecha, se emite el certificado y se notifica.
- Videos y materiales no se exponen al público: el programa público sale de `course_outline()` (solo títulos y duraciones).
  Los materiales están en un bucket **privado** con URL firmadas de 2 min y política por curso. Comprobantes: bucket privado solo admin.
- Pagos: el estado sincroniza el acceso por trigger (Pagado/Parcial → activo; Cancelado/Reembolsado → revocado).
- `service_role` solo existe dentro de la Edge Function, nunca en el frontend.

## Estructura
```
supabase/migrations/0001_schema.sql   Esquema, RLS, funciones, triggers, Storage (idempotente)
supabase/demo_data.sql                Cursos de ejemplo (opcional)
supabase/functions/admin-create-user  Edge Function (crear usuarios como admin)
src/lib/                              config, auth, settings, hooks, utilidades, tipos
src/components/                       Layout, ui, CourseCard, Certificate (vista + PDF)
src/pages/{public,student,instructor,admin,setup}
```

## Mapa de pantallas
Público: `/` `/cursos` `/cursos/:slug` `/nosotros` `/contacto` `/verificar/:código` ·
Acceso: `/ingresar` `/registro` `/recuperar` `/restablecer` · `/instalar` ·
Estudiante: `/estudiante` `/estudiante/certificados` `/estudiante/perfil` `/aula/:slug` ·
Instructor: `/instructor` `/instructor/cursos/:id` ·
Admin: `/admin` (resumen), `cursos`, `cursos/:id` (editor), `estudiantes`, `estudiantes/:id`, `instructores`, `categorias`, `pagos`, `reportes`, `configuracion`.

## Estado de verificación
- `tsc --noEmit` y `vite build`: sin errores.
- El SQL se ejecutó en PostgreSQL 16 (esquemas `auth`/`storage` simulados): corre limpio, es idempotente, y se probaron
  escalada de privilegios, reclamo de admin (código válido/ inválido/ repetido/ anónimo), aislamiento anon/estudiante,
  progreso→certificado→notificación, pago→acceso, duplicado de curso y protección del último admin.
- **No** se probó contra un proyecto Supabase real ni con clics en navegador: haz una pasada completa tras instalar
  (especialmente Storage, correo de recuperación y la Edge Function).

## Fuera de alcance de esta versión (por diseño del documento)
Pasarelas de pago, suscripciones, cupones, quizzes, reseñas (las tablas futuras no se crearon; el esquema está preparado para añadirlas).
Pendientes menores: envío de avisos administrativos masivos, reordenar con arrastrar-y-soltar (hoy flechas ↑↓), exportación Excel (hoy CSV).
