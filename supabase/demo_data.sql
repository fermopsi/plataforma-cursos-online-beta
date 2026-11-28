-- =====================================================================
--  Datos de ejemplo OPCIONALES: 6 cursos publicados con módulos y lecciones.
--  Requiere haber ejecutado 0001_schema.sql. Se puede ejecutar varias veces.
--  Puedes borrar los cursos desde el panel cuando quieras.
-- =====================================================================
do $$
declare
  c record; v_course uuid; v_mod uuid; i int; j int;
  mod_titles text[] := array['Fundamentos', 'Aplicación'];
  les_titles text[] := array['Bienvenida al curso', 'Conceptos clave', 'Caso práctico guiado',
                             'Planificación paso a paso', 'Herramientas y plantillas', 'Proyecto final'];
begin
  for c in select * from (values
    ('marketing-digital-estrategico',   'Marketing digital estratégico',            'marketing', 'intermedio', '12 h', 350, true,  'Diseña y mide campañas que traen clientes reales.'),
    ('excel-gestion-de-negocios',       'Excel para la gestión de negocios',        'gestion',   'basico',     '8 h',  180, true,  'Domina fórmulas, tablas dinámicas y paneles.'),
    ('liderazgo-equipos-remotos',       'Liderazgo de equipos remotos',             'gestion',   'avanzado',   '10 h', 420, true,  'Herramientas para guiar equipos a distancia.'),
    ('fotografia-producto-celular',     'Fotografía de producto con celular',       'diseno',    'basico',     '6 h',  0,   false, 'Luz, encuadre y edición para vender más.'),
    ('finanzas-emprendedor',            'Finanzas personales y del emprendedor',    'finanzas',  'intermedio', '9 h',  260, false, 'Ordena tu flujo de caja y toma mejores decisiones.'),
    ('presentaciones-persuasivas',      'Diseño de presentaciones persuasivas',     'diseno',    'intermedio', '5 h',  140, false, 'Cuenta ideas con claridad y presencia visual.')
  ) as t(slug, title, cat, lvl, dur, price, feat, descr)
  loop
    if exists (select 1 from public.courses where slug = c.slug) then continue; end if;

    insert into public.courses (slug, title, short_description, description, category_id, level, duration_label, price,
                                status, featured, audience, objectives, requirements)
    values (c.slug, c.title, c.descr, c.descr || ' Un curso práctico con clases en video, materiales descargables y certificado.',
            (select id from public.categories where slug = c.cat), c.lvl::public.course_level, c.dur, c.price,
            'published', c.feat, 'Personas interesadas en ' || lower((select name from public.categories where slug = c.cat)) || '.',
            array['Aplicar los conceptos clave con casos reales', 'Trabajar con plantillas y recursos descargables',
                  'Seguir un plan paso a paso, a tu ritmo', 'Obtener un certificado con código verificable'],
            array['Un dispositivo con conexión a internet'])
    returning id into v_course;

    for i in 1..2 loop
      insert into public.modules (course_id, title, position) values (v_course, mod_titles[i], i) returning id into v_mod;
      for j in 1..3 loop
        insert into public.lessons (module_id, course_id, title, description, youtube_id, duration_min, position)
        values (v_mod, v_course, les_titles[(i - 1) * 3 + j], 'Mira el video y revisa el material de apoyo.', case when ((i - 1) * 3 + j) % 2 = 1 then 'M7lc1UVf-VE' else 'YE7VzlLtp-4' end, 6 + (j - 1) * 3, j);
      end loop;
    end loop;
  end loop;
end $$;


-- Actualiza también las lecciones de cursos demo ya existentes.
-- Esto corrige instalaciones que ejecutaron una versión anterior del seed.
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
