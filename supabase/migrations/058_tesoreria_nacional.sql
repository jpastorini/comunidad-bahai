-- ═════════════════════════════════════════════════════════════════
-- 058 · Tesorería nacional: la firma del recibo sale de la membresía.
--
-- Último paso del Usuario Nacional (055 pertenencia, 056 el tenant,
-- 057 los comunicados). Casi todo lo que faltaba resultó ser TypeScript
-- —el buscador de contribuyentes de todo el país no necesita ninguna
-- función nueva, porque la policy de lectura de `profiles` es
-- `using (true)` desde el schema inicial—, así que acá queda una sola
-- cosa, y es un arrastre de la 055.
--
-- ⚠️ EL PROBLEMA. `my_receipt()` (054) deduce quién firma el recibo
-- cuando nadie lo marcó emitido: el primer tesorero de la localidad del
-- asiento. Lo buscaba en `profiles`, o sea en el SOMBRERO PUESTO:
--
--     where p.locality_id = e.locality_id and p.can_manage_treasury
--
-- Con la 055 eso dejó de significar lo que dice. El tesorero nacional
-- tiene el tag de Tesorería en la Comunidad Nacional y NO en su AEL, y
-- `profiles` solo describe la comunidad que tiene puesta en ese momento:
-- mientras ande con el sombrero de Montevideo, la consulta no lo
-- encuentra y el recibo de un aporte al Fondo Nacional sale sin firma.
-- Peor todavía, la firma dependería de qué sombrero tenga puesto un
-- tercero cuando el creyente abre el papel, que no es una propiedad del
-- recibo.
--
-- La corrección es la misma regla de la 056: "quién pertenece a esta
-- comunidad, y con qué tags" se le pregunta a `profile_localities`.
-- El resto de la función queda igual.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create or replace function public.my_receipt(entry_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'entry_date', e.entry_date,
    'currency', e.currency,
    'amount', e.amount,
    'receipt_number', e.receipt_number,
    'receipt_name', e.receipt_name,
    'contributor_name', c.name,
    'fund_name', f.name,
    'subcategory_name', s.name,
    'locality_name', l.name,
    'voided_at', e.voided_at,
    -- Los datos fiscales van impresos en TODO recibo, así que no son
    -- reservados: son los mismos que lee el contribuyente en el papel.
    -- Salen de la localidad DEL ASIENTO, no de la de quien mira, así que
    -- un aporte al Fondo Nacional imprime el nombre y el RUT de la AEN.
    'registered_name', a.registered_name,
    'rut', a.rut,
    'fiscal_address', a.fiscal_address,
    'treasurer_name', coalesce(
      (select p.full_name from public.profiles p where p.id = e.receipt_issued_by),
      -- Por MEMBRESÍA (055/058): el tag de Tesorería es de la comunidad
      -- del asiento, no del sombrero que esa persona tenga puesto hoy.
      (select p.full_name
         from public.profile_localities m
         join public.profiles p on p.id = m.profile_id
        where m.locality_id = e.locality_id
          and m.can_manage_treasury
          and p.disabled_at is null
        order by (m.role = 'admin') desc, p.created_at
        limit 1)
    )
  )
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  left join public.assembly_records a on a.locality_id = e.locality_id
  where e.id = entry_id
    and auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- Quién firma hoy los recibos de cada comunidad, por membresía.
--   -- Antes de esta migración, la Comunidad Nacional salía vacía si su
--   -- tesorero andaba con el sombrero de su AEL puesto.
--   select l.name,
--          (select p.full_name
--             from public.profile_localities m
--             join public.profiles p on p.id = m.profile_id
--            where m.locality_id = l.id
--              and m.can_manage_treasury
--              and p.disabled_at is null
--            order by (m.role = 'admin') desc, p.created_at
--            limit 1) as firma
--   from public.localities l
--   order by l.name;
-- ═════════════════════════════════════════════════════════════════
