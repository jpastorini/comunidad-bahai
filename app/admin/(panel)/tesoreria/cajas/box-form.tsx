import { Button, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import type { CashBox } from "@/lib/treasury-cash";
import type { LedgerCatalog } from "@/lib/treasury-ledger";
import { saveCashBoxAction } from "./actions";

/**
 * Alta y edición de una caja chica: un formulario plano al server action.
 * En el alta, la cuenta puede ser una del catálogo que todavía no es caja
 * (tu "Caja Chica Tesorero") o una nueva con nombre ("Caja chica
 * Secretaría"), que se crea en el catálogo al guardar.
 */
export function BoxForm({
  catalog,
  box,
  takenAccountIds,
}: {
  catalog: LedgerCatalog;
  box?: CashBox | null;
  /** Cuentas que ya son caja chica (no se ofrecen para otra). */
  takenAccountIds: Set<string>;
}) {
  const accounts = catalog.accounts.filter(
    (a) => a.is_active && (!takenAccountIds.has(a.id) || a.id === box?.account_id)
  );
  const members = [...catalog.members].sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? "", "es")
  );

  return (
    <form action={saveCashBoxAction} className="flex flex-col gap-4">
      {box && <input type="hidden" name="id" value={box.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Cuenta de la caja" name="account_id" required={!box}>
          <div className="flex flex-col gap-2">
            <Select
              id="account_id"
              name="account_id"
              defaultValue={box?.account_id ?? ""}
              disabled={!!box}
              aria-label="Cuenta"
            >
              <option value="">{box ? "—" : "— Crear una cuenta nueva con el nombre de abajo —"}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {box ? (
              <input type="hidden" name="account_id" value={box.account_id} />
            ) : (
              <TextInput
                name="new_account_name"
                placeholder="Nombre de la cuenta nueva: Caja chica Secretaría"
                aria-label="Nombre de la cuenta nueva"
              />
            )}
          </div>
        </Field>

        <Field label="Responsable" name="holder_profile_id">
          <div className="flex items-center gap-2">
            <Select id="holder_profile_id" name="holder_profile_id" defaultValue={box?.holder_profile_id ?? ""}>
              <option value="">— Sin responsable en la app (la maneja el tesorero) —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? "Sin nombre"}
                </option>
              ))}
            </Select>
            <HelpTip
              title="Responsable"
              text="La persona que maneja el efectivo. Ve solo esta caja en la app (Mi caja chica): carga los gastos con la foto del comprobante y rinde. No ve el libro ni otras cajas. No hace falta que sea de la Asamblea ni que tenga el permiso de Tesorería."
            />
          </div>
        </Field>

        <Field label="Fondo fijo en pesos" name="fixed_uyu">
          <div className="flex items-center gap-2">
            <TextInput
              id="fixed_uyu"
              name="fixed_uyu"
              inputMode="decimal"
              placeholder="5.000"
              defaultValue={box && box.fixed_uyu > 0 ? String(box.fixed_uyu) : ""}
            />
            <HelpTip
              title="Fondo fijo"
              text="El monto que la caja tiene que tener cuando está completa. La caja gasta, rinde, y se le repone exactamente lo gastado: así vuelve siempre al fondo fijo. Es el esquema que un auditor espera (fondo fijo o «imprest»). Si la caja no maneja una moneda, dejalo en cero."
            />
          </div>
        </Field>

        <Field label="Fondo fijo en dólares" name="fixed_usd">
          <TextInput
            id="fixed_usd"
            name="fixed_usd"
            inputMode="decimal"
            placeholder="0"
            defaultValue={box && box.fixed_usd > 0 ? String(box.fixed_usd) : ""}
          />
        </Field>

        <Field label="Se repone desde" name="source_account_id">
          <div className="flex items-center gap-2">
            <Select id="source_account_id" name="source_account_id" defaultValue={box?.source_account_id ?? ""}>
              <option value="">— Elegir al aprobar cada rendición —</option>
              {catalog.accounts
                .filter((a) => a.is_active && a.id !== box?.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
            <HelpTip
              title="Cuenta de origen"
              text="De dónde sale la plata para reponer la caja (Prex, BROU). Al aprobar una rendición, la app carga la transferencia desde esta cuenta a la caja por lo gastado, en un solo paso."
            />
          </div>
        </Field>

        <Field label="Fondo que gasta por defecto" name="default_fund_id">
          <div className="flex items-center gap-2">
            <Select id="default_fund_id" name="default_fund_id" defaultValue={box?.default_fund_id ?? ""}>
              <option value="">— El que sugiera el rubro de cada gasto —</option>
              {catalog.funds
                .filter((f) => f.is_active)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </Select>
            <HelpTip
              title="Fondo"
              text="La plata del libro está «coloreada» por fondo (Local, Enseñanza, Clases de Niños…). Una caja de la Secretaría gasta del Fondo Local; la de un coordinador de instituto, de Enseñanza. Si el rubro del gasto ya sugiere un fondo, manda el rubro."
            />
          </div>
        </Field>
      </div>

      <Field label="Notas" name="notes" hint="opcional">
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={box?.notes ?? ""}
          placeholder="Para qué es esta caja, dónde se guarda, acuerdos con el responsable…"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit">{box ? "Guardar cambios" : "Crear la caja chica"}</Button>
      </div>
    </form>
  );
}
