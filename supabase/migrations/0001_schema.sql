-- =====================================================================
--  AULA NORTE LMS · Esquema inicial (idempotente: se puede ejecutar varias veces)
--  Incluye: tablas, índices, RLS, funciones seguras, triggers y Storage.
--  Ejecutar en Supabase → SQL Editor (o con `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
do $$ begin create type public.app_role as enum ('admin','instructor','student'); exception when duplicate_object then null; end $$;
do $$ begin create type public.course_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.course_level as enum ('basico','intermedio','avanzado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.enrollment_status as enum ('pending','active','revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','paid','partial','cancelled','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash','transfer','qr'); exception when duplicate_object then null; end $$;
do $$ begin create type public.resource_kind as enum ('pdf','presentation','image','file','link','text'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  phone       text,
  avatar_url  text,
  bio         text,
  specialty   text,
  role        public.app_role not null default 'student',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  icon       text not null default 'gestion',
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  short_description text not null default '',
  description       text not null default '',
  category_id       uuid references public.categories(id) on delete set null,
  level             public.course_level not null default 'basico',
  duration_label    text not null default '',
  price             numeric(10,2) not null default 0 check (price >= 0),
  currency          text not null default 'BOB',
  cover_url         text,
  objectives        text[] not null default '{}',
  requirements      text[] not null default '{}',
  audience          text not null default '',
  status            public.course_status not null default 'draft',
  featured          boolean not null default false,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  published_at      timestamptz
);

create table if not exists public.course_instructors (
  course_id     uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (course_id, instructor_id)
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  description text not null default '',
  position    int  not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  youtube_id   text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  content      text not null default '',
  duration_min int  not null default 5 check (duration_min >= 0),
  position     int  not null default 0,
  required     boolean not null default true,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.lesson_resources (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  name         text not null,
  kind         public.resource_kind not null default 'file',
  url          text,
  storage_path text,
  description  text not null default '',
  created_at   timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);

create table if not exists public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  status           public.enrollment_status not null default 'active',
  enrolled_at      timestamptz not null default now(),
  completed_at     timestamptz,
  last_lesson_id   uuid references public.lessons(id) on delete set null,
  last_activity_at timestamptz,
  unique (student_id, course_id)
);

create table if not exists public.lesson_progress (
  student_id   uuid not null references public.profiles(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table if not exists public.certificates (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  code          text not null unique,
  issued_at     timestamptz not null default now(),
  revoked       boolean not null default false
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  kind       text not null default 'info',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id) on delete set null,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete restrict,
  amount        numeric(10,2) not null default 0 check (amount >= 0),
  currency      text not null default 'BOB',
  method        public.payment_method not null default 'cash',
  status        public.payment_status not null default 'paid',
  reference     text,
  notes         text,
  receipt_path  text,
  paid_at       date not null default current_date,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id                smallint primary key default 1 check (id = 1),
  academy_name      text not null default 'Aula Norte',
  tagline           text not null default 'Formación práctica para el mundo digital',
  description       text not null default 'Somos una academia online enfocada en formación práctica. Cada curso combina clases en video, materiales descargables y un certificado al finalizar.',
  hero_title        text not null default 'Aprende nuevas habilidades. Transforma tu futuro.',
  hero_subtitle     text not null default 'Formación práctica en negocios digitales, marketing, tecnología e inteligencia artificial.',
  brand_color       text not null default '#308CA2' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url          text,
  whatsapp          text not null default '59170000000',
  contact_email     text not null default '',
  instagram         text,
  facebook          text,
  cert_signer_name  text not null default 'Dirección Académica',
  cert_signer_title text not null default 'Aula Norte',
  cert_text         text not null default 'ha completado satisfactoriamente el curso',
  enroll_cta_label  text not null default 'Inscribirme por WhatsApp',
  updated_at        timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.activity_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Código de instalación (solo accesible desde el servidor)
create table if not exists private.setup (
  id        smallint primary key default 1 check (id = 1),
  code_hash text
);

-- Categorías base
insert into public.categories (name, slug, icon, position) values
  ('Marketing',   'marketing',   'marketing',   1),
  ('Gestión',     'gestion',     'gestion',     2),
  ('Diseño',      'diseno',      'diseno',      3),
  ('Finanzas',    'finanzas',    'finanzas',    4),
  ('Tecnología',  'tecnologia',  'tecnologia',  5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------
create index if not exists profiles_role_idx          on public.profiles(role);
create index if not exists courses_status_idx         on public.courses(status, published_at desc);
create index if not exists courses_category_idx       on public.courses(category_id);
create index if not exists course_instructors_ins_idx on public.course_instructors(instructor_id);
create index if not exists modules_course_idx         on public.modules(course_id, position);
create index if not exists lessons_module_idx         on public.lessons(module_id, position);
create index if not exists lessons_course_idx         on public.lessons(course_id);
create index if not exists resources_lesson_idx       on public.lesson_resources(lesson_id);
create index if not exists resources_course_idx       on public.lesson_resources(course_id);
create index if not exists enrollments_course_idx     on public.enrollments(course_id);
create index if not exists enrollments_student_idx    on public.enrollments(student_id);
create index if not exists progress_course_idx        on public.lesson_progress(course_id, student_id);
create index if not exists certificates_student_idx   on public.certificates(student_id);
create index if not exists notifications_user_idx     on public.notifications(user_id, read, created_at desc);
create index if not exists payments_student_idx       on public.payments(student_id);
create index if not exists payments_course_idx        on public.payments(course_id);
create index if not exists payments_enrollment_idx    on public.payments(enrollment_id);
create index if not exists logs_created_idx           on public.activity_logs(created_at desc);

-- ---------------------------------------------------------------------
-- 4. Funciones auxiliares (SECURITY DEFINER, search_path fijo)
-- ---------------------------------------------------------------------
create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','instructor') and active)
$$;

create or replace function public.is_instructor_of(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_instructors ci
    join public.profiles p on p.id = ci.instructor_id
    where ci.course_id = p_course and ci.instructor_id = auth.uid() and p.active and p.role = 'instructor')
$$;

create or replace function public.is_staff_of(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_instructor_of(p_course)
$$;

create or replace function public.has_enrollment(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.student_id = auth.uid() and e.course_id = p_course and e.status = 'active' and p.active)
$$;

create or replace function public.can_access_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff_of(p_course) or public.has_enrollment(p_course)
$$;

create or replace function public.is_student_of_instructor(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    join public.course_instructors ci on ci.course_id = e.course_id
    where e.student_id = p_student and ci.instructor_id = auth.uid())
$$;

create or replace function private.log(p_actor uuid, p_action text, p_entity text, p_id uuid, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.activity_logs (actor_id, action, entity, entity_id, meta) values (p_actor, p_action, p_entity, p_id, p_meta)
$$;

create or replace function private.new_cert_code() returns text
language sql volatile as $$
  select 'ANL-' || to_char(now(), 'YYYY') || '-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8))
$$;

-- ---------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------
-- 5.1 Alta de usuario → perfil (SIEMPRE con rol "student")
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  perform private.log(new.id, 'user.registered', 'profile', new.id, '{}');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 5.2 Un usuario NO puede cambiar su rol, estado ni correo; no se puede quitar el último admin
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role is distinct from old.role or new.active is distinct from old.active
       or new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'No tienes permiso para modificar estos campos';
    end if;
  end if;
  if old.role = 'admin' and (new.role <> 'admin' or not new.active) then
    if not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
      raise exception 'Debe existir al menos un administrador activo';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles for each row execute function public.protect_profile();

-- 5.3 Cursos: fecha de publicación y registro
create or replace function public.t_course_publish() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
drop trigger if exists course_publish_trg on public.courses;
create trigger course_publish_trg before insert or update on public.courses for each row execute function public.t_course_publish();

create or replace function private.t_course_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    perform private.log(auth.uid(), 'course.published', 'course', new.id, jsonb_build_object('title', new.title));
  end if;
  return new;
end $$;
drop trigger if exists course_log_trg on public.courses;
create trigger course_log_trg after update on public.courses for each row execute function private.t_course_log();

-- 5.4 Inscripciones: aviso al estudiante + registro
create or replace function private.t_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from public.courses where id = new.course_id;
  if tg_op = 'INSERT' then
    perform private.log(auth.uid(), 'enrollment.created', 'enrollment', new.id, jsonb_build_object('course', v_title, 'student', new.student_id));
    if new.status = 'active' then
      insert into public.notifications (user_id, title, body, kind)
      values (new.student_id, 'Acceso habilitado', 'Ya puedes ingresar al curso "' || coalesce(v_title, '') || '".', 'enrollment');
    end if;
  elsif new.status = 'active' and old.status is distinct from 'active' then
    insert into public.notifications (user_id, title, body, kind)
    values (new.student_id, 'Acceso habilitado', 'Ya puedes ingresar al curso "' || coalesce(v_title, '') || '".', 'enrollment');
  end if;
  return new;
end $$;
drop trigger if exists enrollment_trg on public.enrollments;
create trigger enrollment_trg after insert or update on public.enrollments for each row execute function private.t_enrollment();

-- 5.5 Pagos: sincroniza el acceso con el estado del pago + registro
create or replace function private.t_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform private.log(auth.uid(), 'payment.created', 'payment', new.id, jsonb_build_object('amount', new.amount, 'status', new.status));
  end if;
  if new.enrollment_id is not null then
    if new.status in ('paid', 'partial') then
      update public.enrollments set status = 'active' where id = new.enrollment_id and status = 'pending';
    elsif new.status in ('cancelled', 'refunded') then
      update public.enrollments set status = 'revoked' where id = new.enrollment_id and status <> 'revoked';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payment_trg on public.payments;
create trigger payment_trg after insert or update on public.payments for each row execute function private.t_payment();

-- ---------------------------------------------------------------------
-- 6. Progreso y certificados (única vía de escritura: funciones RPC)
-- ---------------------------------------------------------------------
create or replace function private.refresh_enrollment(p_student uuid, p_course uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_total int; v_done int; v_enr uuid; v_code text; v_completed boolean; v_title text;
begin
  select count(*) into v_total from public.lessons where course_id = p_course and published and required;
  select count(*) into v_done from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.student_id = p_student and lp.course_id = p_course and l.published and l.required;
  select id into v_enr from public.enrollments where student_id = p_student and course_id = p_course;
  v_completed := v_total > 0 and v_done >= v_total;

  if v_enr is not null then
    if v_completed then
      update public.enrollments set completed_at = coalesce(completed_at, now()) where id = v_enr;
      select code into v_code from public.certificates where enrollment_id = v_enr;
      if v_code is null then
        v_code := private.new_cert_code();
        insert into public.certificates (enrollment_id, student_id, course_id, code) values (v_enr, p_student, p_course, v_code);
        select title into v_title from public.courses where id = p_course;
        insert into public.notifications (user_id, title, body, kind)
        values (p_student, 'Certificado disponible', 'Completaste "' || coalesce(v_title, '') || '". Ya puedes descargar tu certificado.', 'certificate');
        perform private.log(p_student, 'certificate.issued', 'certificate', null, jsonb_build_object('code', v_code, 'course', v_title));
      end if;
    else
      update public.enrollments set completed_at = null where id = v_enr;
    end if;
  end if;

  return jsonb_build_object('total', v_total, 'done', v_done,
    'percent', case when v_total = 0 then 0 else round(100.0 * v_done / v_total) end,
    'completed', v_completed, 'certificate_code', v_code);
end $$;

create or replace function public.set_lesson_progress(p_lesson uuid, p_done boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  select course_id into v_course from public.lessons where id = p_lesson and published;
  if v_course is null then raise exception 'Lección no disponible'; end if;
  if not public.has_enrollment(v_course) then raise exception 'No tienes acceso a este curso'; end if;
  if p_done then
    insert into public.lesson_progress (student_id, lesson_id, course_id) values (v_uid, p_lesson, v_course) on conflict do nothing;
  else
    delete from public.lesson_progress where student_id = v_uid and lesson_id = p_lesson;
  end if;
  update public.enrollments set last_lesson_id = p_lesson, last_activity_at = now() where student_id = v_uid and course_id = v_course;
  return private.refresh_enrollment(v_uid, v_course);
end $$;

create or replace function public.touch_lesson(p_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.lessons where id = p_lesson and published;
  if v_course is not null and public.has_enrollment(v_course) then
    update public.enrollments set last_lesson_id = p_lesson, last_activity_at = now()
    where student_id = auth.uid() and course_id = v_course;
  end if;
end $$;

create or replace function public.enroll_free(p_course uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if not exists (select 1 from public.courses where id = p_course and status = 'published' and price = 0) then
    raise exception 'Este curso no es gratuito o no está disponible';
  end if;
  insert into public.enrollments (student_id, course_id, status) values (auth.uid(), p_course, 'active')
  on conflict (student_id, course_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.enrollments where student_id = auth.uid() and course_id = p_course; end if;
  return v_id;
end $$;

create or replace function public.reissue_certificate(p_cert uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede reemitir certificados'; end if;
  v_code := private.new_cert_code();
  update public.certificates set code = v_code, issued_at = now(), revoked = false where id = p_cert;
  perform private.log(auth.uid(), 'certificate.reissued', 'certificate', p_cert, jsonb_build_object('code', v_code));
  return v_code;
end $$;

create or replace function public.duplicate_course(p_course uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; m record; v_mod uuid;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede duplicar cursos'; end if;
  insert into public.courses (slug, title, short_description, description, category_id, level, duration_label, price, currency,
                              cover_url, objectives, requirements, audience, status, featured, created_by)
  select slug || '-copia-' || substr(gen_random_uuid()::text, 1, 4), title || ' (copia)', short_description, description,
         category_id, level, duration_label, price, currency, cover_url, objectives, requirements, audience, 'draft', false, auth.uid()
  from public.courses where id = p_course returning id into v_new;
  if v_new is null then raise exception 'Curso no encontrado'; end if;
  for m in select * from public.modules where course_id = p_course order by position loop
    insert into public.modules (course_id, title, description, position, published)
    values (v_new, m.title, m.description, m.position, m.published) returning id into v_mod;
    insert into public.lessons (module_id, course_id, title, description, youtube_id, content, duration_min, position, required, published)
    select v_mod, v_new, title, description, youtube_id, content, duration_min, position, required, published
    from public.lessons where module_id = m.id;
  end loop;
  return v_new;
end $$;

-- ---------------------------------------------------------------------
-- 7. Funciones públicas de solo lectura
-- ---------------------------------------------------------------------
create or replace function public.lms_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('installed', true, 'has_admin', exists (select 1 from public.profiles where role = 'admin'))
$$;

-- Programa académico público (sin exponer videos ni materiales)
create or replace function public.course_outline(p_course uuid)
returns table (module_id uuid, module_title text, module_position int, lesson_id uuid, lesson_title text,
               lesson_position int, duration_min int, required boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, m.position, l.id, l.title, l.position, l.duration_min, l.required
  from public.courses c
  join public.modules m on m.course_id = c.id and m.published
  left join public.lessons l on l.module_id = m.id and l.published
  where c.id = p_course and (c.status = 'published' or public.is_staff_of(p_course))
  order by m.position, l.position
$$;

create or replace function public.verify_certificate(p_code text)
returns table (student_name text, course_title text, issued_at timestamptz, academy text, revoked boolean)
language sql stable security definer set search_path = public as $$
  select p.full_name, c.title, ce.issued_at, (select academy_name from public.platform_settings where id = 1), ce.revoked
  from public.certificates ce
  join public.profiles p on p.id = ce.student_id
  join public.courses c on c.id = ce.course_id
  where upper(ce.code) = upper(trim(p_code))
$$;

create or replace view public.public_instructors as
  select id, full_name, avatar_url, bio, specialty from public.profiles where role = 'instructor' and active;

-- ---------------------------------------------------------------------
-- 8. Instalación segura del primer administrador
--    El instalador genera un código de un solo uso; solo quien lo conoce
--    (quien ejecutó el SQL) puede convertirse en el primer administrador.
-- ---------------------------------------------------------------------
create or replace function private.set_setup_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then return; end if;
  insert into private.setup (id, code_hash) values (1, extensions.crypt(p_code, extensions.gen_salt('bf')))
  on conflict (id) do update set code_hash = excluded.code_hash;
end $$;

create or replace function public.claim_first_admin(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  perform pg_advisory_xact_lock(7001);
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'La plataforma ya tiene un administrador';
  end if;
  select code_hash into v_hash from private.setup where id = 1;
  if v_hash is null or extensions.crypt(coalesce(p_code, ''), v_hash) <> v_hash then
    raise exception 'Código de instalación inválido';
  end if;
  update public.profiles set role = 'admin' where id = auth.uid();
  update private.setup set code_hash = null where id = 1;
  perform private.log(auth.uid(), 'platform.installed', 'profile', auth.uid(), '{}');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 9. Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function public.claim_first_admin(text), public.set_lesson_progress(uuid, boolean), public.touch_lesson(uuid),
  public.enroll_free(uuid), public.reissue_certificate(uuid), public.duplicate_course(uuid) from public, anon, authenticated;
grant execute on function public.claim_first_admin(text), public.set_lesson_progress(uuid, boolean), public.touch_lesson(uuid),
  public.enroll_free(uuid), public.reissue_certificate(uuid), public.duplicate_course(uuid) to authenticated;
grant execute on function public.lms_status(), public.course_outline(uuid), public.verify_certificate(text) to anon, authenticated;
grant select on public.public_instructors to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.courses           enable row level security;
alter table public.course_instructors enable row level security;
alter table public.modules           enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_resources  enable row level security;
alter table public.enrollments       enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.certificates      enable row level security;
alter table public.notifications     enable row level security;
alter table public.payments          enable row level security;
alter table public.platform_settings enable row level security;
alter table public.activity_logs     enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_select_instructor on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_select_own        on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin      on public.profiles for select using (public.is_admin());
create policy profiles_select_instructor on public.profiles for select using (public.is_student_of_instructor(id));
create policy profiles_update_own        on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin      on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- categories
drop policy if exists categories_read on public.categories;
drop policy if exists categories_admin on public.categories;
create policy categories_read  on public.categories for select using (true);
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- courses
drop policy if exists courses_read on public.courses;
drop policy if exists courses_admin on public.courses;
create policy courses_read on public.courses for select
  using (status = 'published' or public.is_staff_of(id) or public.has_enrollment(id));
create policy courses_admin on public.courses for all using (public.is_admin()) with check (public.is_admin());

-- course_instructors
drop policy if exists ci_read on public.course_instructors;
drop policy if exists ci_admin on public.course_instructors;
create policy ci_read on public.course_instructors for select
  using (instructor_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));
create policy ci_admin on public.course_instructors for all using (public.is_admin()) with check (public.is_admin());

-- modules
drop policy if exists modules_read on public.modules;
drop policy if exists modules_staff on public.modules;
create policy modules_read  on public.modules for select using (public.is_staff_of(course_id) or (published and public.has_enrollment(course_id)));
create policy modules_staff on public.modules for all using (public.is_staff_of(course_id)) with check (public.is_staff_of(course_id));

-- lessons
drop policy if exists lessons_read on public.lessons;
drop policy if exists lessons_staff on public.lessons;
create policy lessons_read  on public.lessons for select using (public.is_staff_of(course_id) or (published and public.has_enrollment(course_id)));
create policy lessons_staff on public.lessons for all using (public.is_staff_of(course_id)) with check (public.is_staff_of(course_id));

-- lesson_resources
drop policy if exists resources_read on public.lesson_resources;
drop policy if exists resources_staff on public.lesson_resources;
create policy resources_read on public.lesson_resources for select
  using (public.is_staff_of(course_id)
         or (public.has_enrollment(course_id) and exists (select 1 from public.lessons l where l.id = lesson_id and l.published)));
create policy resources_staff on public.lesson_resources for all using (public.is_staff_of(course_id)) with check (public.is_staff_of(course_id));

-- enrollments (solo el administrador escribe)
drop policy if exists enrollments_read on public.enrollments;
drop policy if exists enrollments_admin on public.enrollments;
create policy enrollments_read  on public.enrollments for select using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));
create policy enrollments_admin on public.enrollments for all using (public.is_admin()) with check (public.is_admin());

-- lesson_progress (solo lectura: se escribe por RPC)
drop policy if exists progress_read on public.lesson_progress;
create policy progress_read on public.lesson_progress for select using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));

-- certificates
drop policy if exists certs_read on public.certificates;
drop policy if exists certs_admin on public.certificates;
create policy certs_read  on public.certificates for select using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));
create policy certs_admin on public.certificates for all using (public.is_admin()) with check (public.is_admin());

-- notifications
drop policy if exists notif_read on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notif_admin on public.notifications;
create policy notif_read   on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_admin  on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- payments
drop policy if exists payments_read on public.payments;
drop policy if exists payments_admin on public.payments;
create policy payments_read  on public.payments for select using (student_id = auth.uid() or public.is_admin());
create policy payments_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- platform_settings
drop policy if exists settings_read on public.platform_settings;
drop policy if exists settings_admin on public.platform_settings;
create policy settings_read  on public.platform_settings for select using (true);
create policy settings_admin on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

-- activity_logs
drop policy if exists logs_read on public.activity_logs;
create policy logs_read on public.activity_logs for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 11. Storage
--   branding / covers / avatars → públicos (lectura); materials / receipts → privados
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('branding',  'branding',  true),
  ('covers',    'covers',    true),
  ('avatars',   'avatars',   true),
  ('materials', 'materials', false),
  ('receipts',  'receipts',  false)
on conflict (id) do nothing;

drop policy if exists lms_branding_write on storage.objects;
drop policy if exists lms_covers_write on storage.objects;
drop policy if exists lms_avatars_write on storage.objects;
drop policy if exists lms_materials_read on storage.objects;
drop policy if exists lms_materials_write on storage.objects;
drop policy if exists lms_receipts_all on storage.objects;

create policy lms_branding_write on storage.objects for all
  using (bucket_id = 'branding' and public.is_admin()) with check (bucket_id = 'branding' and public.is_admin());
create policy lms_covers_write on storage.objects for all
  using (bucket_id = 'covers' and public.is_admin()) with check (bucket_id = 'covers' and public.is_admin());
create policy lms_avatars_write on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy lms_materials_read on storage.objects for select
  using (bucket_id = 'materials' and public.can_access_course(public.try_uuid((storage.foldername(name))[1])));
create policy lms_materials_write on storage.objects for all
  using (bucket_id = 'materials' and public.is_staff_of(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'materials' and public.is_staff_of(public.try_uuid((storage.foldername(name))[1])));
create policy lms_receipts_all on storage.objects for all
  using (bucket_id = 'receipts' and public.is_admin()) with check (bucket_id = 'receipts' and public.is_admin());
