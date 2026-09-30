-- 076 · La tabla `treasury` vieja queda solo con los medios de pago
--
-- `treasury` es la ficha del schema inicial: una fila por localidad con
-- el período, la meta, lo recaudado (a mano), las líneas del "Informe
-- mensual" (a mano) y los medios de pago. Todo menos lo último se
-- jubiló por etapas: el tablero de Progreso (042) reemplazó la meta y lo
-- recaudado, Publicar (066) reemplazó el informe mensual, y el
-- formulario que las escribía se fue el 2026-09-29. Lo único que la
-- comunidad sigue leyendo de acá es `methods`, en "Cómo aportar" de
-- /tesoreria, editado desde Recibo y medios de pago.
--
-- Se tiran las columnas muertas para que nadie las vuelva a leer creyendo
-- que dicen algo. La tabla y su RLS (012) quedan como están: mover
-- `methods` a otra tabla sería churn sin beneficio.

alter table public.treasury
  drop column if exists goal_amount,
  drop column if exists current_amount,
  drop column if exists contributions,
  drop column if exists period;

comment on table public.treasury is
  'Medios de pago que ve la comunidad en "Cómo aportar", una fila por localidad. Lo demás de la ficha vieja se jubiló (042, 066, 076).';
