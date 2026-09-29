import { redirect } from "next/navigation";

/**
 * "Tesorería" en el menú cae en el Libro, que es la herramienta diaria del
 * tesorero. Las demás pantallas de la sección son los sub-ítems del menú;
 * no hay hub de botones. De la tabla `treasury` vieja solo sobreviven los
 * medios de pago, que se editan en Recibo y medios de pago.
 */
export default function AdminTesoreriaPage() {
  redirect("/admin/tesoreria/libro");
}
