-- ═════════════════════════════════════════════════════════════════
-- 083 · El recibo de una estructura, también en la copia del creyente.
--
-- Las estructuras (082) emiten recibos INTERNOS: sin RUT ni domicilio
-- fiscal, con el nombre del Comité y la Asamblea de la que depende
-- (decidido con el usuario el 2026-10-24). Del lado del tesorero eso lo
-- resuelve `getReceiptLegal()` leyendo `localities`. La copia del
-- creyente sale de `my_receipt()`, que devolvía solo el NOMBRE de la
-- localidad del asiento, y desde la 082 el nombre ya no la identifica
-- (dos Asambleas pueden tener cada una su "Comité de Juventud").
--
-- Mismo cuerpo que la 060, con cuatro campos más: la localidad del
-- asiento (id y tipo) y la Asamblea de la que depende si es una
-- estructura (nombre y tipo, para armar "Asamblea Espiritual Local de
-- los Bahá'ís de …"). Devuelve jsonb, así que agregar campos no cambia
-- la firma y nadie que lo lea se rompe.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
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
    'locality_id', e.locality_id,
    'locality_name', l.name,
    'locality_kind', l.kind,
    'parent_locality_name', pl.name,
    'parent_locality_kind', pl.kind,
    'voided_at', e.voided_at,
    'registered_name', a.registered_name,
    'rut', a.rut,
    'fiscal_address', a.fiscal_address,
    -- La apariencia del recibo es la de la comunidad que lo EMITIÓ, no la
    -- de quien lo abre: un aporte al Fondo Nacional se ve azul aunque lo
    -- mire un creyente de Montevideo.
    'theme', coalesce(rs.theme, 'terracota'),
    'signature_path', rs.signature_path,
    'treasurer_title', rs.treasurer_title,
    'treasurer_name', public.receipt_signer_name(
      e.locality_id, e.entry_date, e.receipt_issued_by
    )
  )
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  left join public.localities pl on pl.id = l.parent_id
  left join public.assembly_records a on a.locality_id = e.locality_id
  left join public.treasury_receipt_settings rs on rs.locality_id = e.locality_id
  where e.id = entry_id
    and auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;
