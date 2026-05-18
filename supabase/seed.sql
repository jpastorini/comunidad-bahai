-- Seed de demostración para Supabase. Coincide con lib/seed-data.ts.
-- Ejecutar después de schema.sql desde el SQL Editor.

insert into public.messages (date, title, excerpt, is_new) values
  ('2026-04-20', 'Mensaje del Riḍván 2026',
   'A los bahá''ís del mundo — En este momento decisivo de la historia humana, la luz de la Revelación brilla con intensidad...',
   true),
  ('2026-01-01', 'Mensaje a los Bahá''ís del Mundo',
   'Queridísimos amigos — Al comenzar un nuevo año, dirigimos nuestros pensamientos a la magnitud de la tarea que tenéis ante vosotros...',
   false),
  ('2025-11-26', 'Mensaje del Día de la Alianza',
   'Queridos amigos — El Convenio constituye la fuerza que sostiene la unidad de la Causa y guía a los creyentes...',
   false),
  ('2025-04-20', 'Mensaje del Riḍván 2025',
   'A los bahá''ís del mundo — Las fuerzas transformadoras desencadenadas por la Revelación de Bahá''u''lláh continúan...',
   false),
  ('2024-11-28', 'Sobre el Plan de Nueve Años',
   'Queridísimos amigos — Con sentimientos de profunda gratitud por las labores que se realizan en todos los continentes...',
   false);

insert into public.activities (type, title, detail, starts_at, place) values
  ('estudio',    'Círculo de Estudio',     'Libro 7, Unidad 2',   '2026-05-22 19:00', 'Casa Rodríguez'),
  ('devocional', 'Reunión Devocional',     'Oraciones y música',  '2026-05-24 10:00', 'Casa García'),
  ('ninos',      'Clase de Niños',         'Grado 2, Lección 5',  '2026-05-23 16:00', 'Centro Comunitario'),
  ('jovenes',    'Grupo de Prejuniors',    'Caminando el sendero', '2026-05-27 17:30', 'Casa López');

insert into public.calendar_events (day, month, year, title, time, color) values
  (22, 5, 2026, 'Círculo de Estudio',   '7:00 PM', '#2A3F8F'),
  (23, 5, 2026, 'Clase de Niños',       '4:00 PM', '#6A8B5F'),
  (24, 5, 2026, 'Reunión Devocional',   '10:00 AM','#7E44B8'),
  (27, 5, 2026, 'Grupo de Prejuniors',  '5:30 PM', '#C4A235');

insert into public.study_materials (kind, number, title, completed, current) values
  ('ruhi', 1, 'Reflexiones sobre la vida del espíritu',  true,  false),
  ('ruhi', 2, 'Levantándose para servir',                true,  false),
  ('ruhi', 3, 'Enseñando clases de niños (Grado 1)',     true,  false),
  ('ruhi', 4, 'Las manifestaciones gemelas',             true,  false),
  ('ruhi', 5, 'Liberando los poderes de los prejóvenes', false, false),
  ('ruhi', 6, 'Enseñando la Causa',                       true,  false),
  ('ruhi', 7, 'Caminando juntos en un sendero de servicio', false, true),
  ('ruhi', 8, 'El Convenio de Bahá''u''lláh',             false, false);

insert into public.study_materials (kind, title, subtitle) values
  ('oraciones', 'Oraciones selectas', 'Compilación'),
  ('escritos',  'Palabras Ocultas',   'Escritos sagrados'),
  ('escritos',  'Kitáb-i-Íqán',       'Escritos sagrados');

insert into public.teaching_goals (label, current, goal, color, cycle) values
  ('Círculos de estudio',   3, 5, '#2A3F8F', 'Mayo 2026'),
  ('Devocionales',          4, 6, '#7E44B8', 'Mayo 2026'),
  ('Clases de niños',       2, 4, '#6A8B5F', 'Mayo 2026'),
  ('Grupos de prejuniors',  1, 3, '#C4A235', 'Mayo 2026');

insert into public.service_needs (title, description, urgency) values
  ('Tutores para Libro 1',       'Se necesitan 2 tutores para un nuevo círculo de estudio', 'alta'),
  ('Anfitrión devocional',       'Hogar para reuniones devocionales los domingos',          'media'),
  ('Maestro clase de niños',     'Grado 3, los sábados por la tarde',                       'alta'),
  ('Transporte para ancianos',   'Llevar a 2 amigos a las reuniones semanales',             'media'),
  ('Músicos para devocional',    'Acompañamiento musical para las reuniones',               'baja');

insert into public.treasury (goal_amount, current_amount, period, contributions, methods) values
  (5000, 3250, 'Año 2026',
   '[{"label":"Ingresos del mes","amount":450},{"label":"Fondo Nacional","amount":150},{"label":"Fondo Continental","amount":50},{"label":"Fondo Local","amount":250}]'::jsonb,
   '[{"type":"Transferencia","description":"Datos bancarios","letter":"T"},{"type":"Efectivo","description":"En reunión","letter":"E"}]'::jsonb);

-- Para hacer admin a un usuario tras su primer login con magic link:
--   update public.profiles set role = 'admin' where email = 'tu@correo.com';
--
-- Para darle el tag de chat o de tesorería:
--   update public.profiles
--   set can_respond_chat = true, can_manage_treasury = true
--   where email = 'tu@correo.com';
