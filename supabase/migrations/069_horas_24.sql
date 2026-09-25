-- 069 · Las horas del calendario, en 24 horas
--
-- `calendar_events.time` es texto libre y el formulario sugería "7:00 PM",
-- así que hay eventos guardados con AM/PM. La app ya los muestra en 24 horas
-- al leerlos (`to24h()` en lib/format.ts) y los guarda así desde ahora; esto
-- deja también la base pareja, para lo que la lee sin pasar por ahí (los
-- avisos de "mañana", las fotos del evento).
--
-- Solo toca un texto que sea una hora con AM/PM y nada más ("7 PM",
-- "7:00 p.m.", "10:30 am"). "Al atardecer" o "3:00 de la madrugada" quedan
-- igual. Se puede correr dos veces: la segunda no encuentra nada.

update calendar_events
set time =
  (
    (substring(time from '^\s*(\d{1,2})')::int % 12)
    + case when time ~* '[0-9]\s*p' then 12 else 0 end
  )::text
  || ':'
  || coalesce(substring(time from ':(\d{2})'), '00')
where time ~* '^\s*\d{1,2}(:\d{2})?\s*[ap]\.?\s*m\.?\s*$';
