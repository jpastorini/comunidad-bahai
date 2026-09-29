import { redirect } from "next/navigation";

/**
 * "Cómo aportar" se fusionó con los ajustes del recibo: los medios de
 * pago se editan en Recibo y medios de pago. Las cifras a mano y el
 * "Informe mensual" que vivían acá se jubilaron con la 066 (el estado del
 * Fondo se calcula y se comparte desde Publicar).
 */
export default function AportarRedirect() {
  redirect("/admin/tesoreria/recibo/ajustes#medios-de-pago");
}
