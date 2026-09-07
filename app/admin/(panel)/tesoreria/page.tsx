import { redirect } from "next/navigation";

/**
 * "Tesorería" en el menú cae en el Libro, que es la herramienta diaria del
 * tesorero. Las demás pantallas de la sección son los sub-ítems del menú;
 * no hay hub de botones. El formulario viejo de la tabla `treasury` quedó
 * en /admin/tesoreria/aportar ("Cómo aportar") hasta que se jubile.
 */
export default function AdminTesoreriaPage() {
  redirect("/admin/tesoreria/libro");
}
