-- Aula Norte LMS: reparar URLs de YouTube en los 6 cursos de demostración.
-- Ejecutar una sola vez en Supabase SQL Editor. No crea ni duplica registros.
-- Video A: YouTube Developers Live (ID de ejemplo de la documentación oficial).
-- Video B: Big Buck Bunny (Blender, Creative Commons).

with demo_lessons as (
  select l.id,
         row_number() over (partition by c.id order by m.position, l.position) as lesson_no
  from public.lessons l
  join public.modules m on m.id = l.module_id
  join public.courses c on c.id = l.course_id
  where c.slug in (
    'marketing-digital-estrategico',
    'excel-gestion-de-negocios',
    'liderazgo-equipos-remotos',
    'fotografia-producto-celular',
    'finanzas-emprendedor',
    'presentaciones-persuasivas'
  )
)
update public.lessons l
set youtube_id = case when d.lesson_no % 2 = 1 then 'M7lc1UVf-VE' else 'YE7VzlLtp-4' end
from demo_lessons d
where l.id = d.id;

-- Verificación: muestra el curso, la lección y el enlace resultante.
select c.title as curso, l.title as leccion,
       'https://www.youtube.com/watch?v=' || l.youtube_id as youtube_url
from public.lessons l
join public.courses c on c.id = l.course_id
where c.slug in (
  'marketing-digital-estrategico', 'excel-gestion-de-negocios',
  'liderazgo-equipos-remotos', 'fotografia-producto-celular',
  'finanzas-emprendedor', 'presentaciones-persuasivas'
)
order by c.title, l.position;
