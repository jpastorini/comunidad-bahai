/**
 * Qué hacer con cada hallazgo de la auditoría (059).
 *
 * El motor dice QUÉ ESTÁ MAL y contra qué norma; esto dice CÓMO SE
 * ARREGLA, en los términos de esta app: qué pantalla se abre, qué botón
 * se toca y en qué orden. Sin esto, la mitad de los hallazgos manda al
 * tesorero a leer el instructivo del MEC o a preguntar por WhatsApp.
 *
 * Es un mapa POR CÓDIGO y no un campo del hallazgo, por dos razones: el
 * remedio es de la CLASE de problema —los 23 gastos sin comprobante se
 * arreglan todos igual— y así no hay que repetir el mismo párrafo en
 * cada una de las 53 reglas, donde iría quedando desactualizado de a
 * uno. Lo específico de cada caso (fechas, montos, cuentas) ya está en
 * el `detail` que escribe la regla.
 *
 * Tres cosas del contenido, decididas mirando cómo se usa la pantalla:
 *
 *  · Empieza con el verbo. "Cerrá el mes en Cierres", no "se recomienda
 *    proceder al cierre". Quien lee esto tiene el libro abierto al lado.
 *  · Dice cuándo NO hay nada que corregir. Varias reglas (un mes
 *    reabierto, una cuenta dormida) son registros para el auditor y no
 *    errores: el remedio es despacharlos con la explicación, y decirlo
 *    evita que alguien invente un cambio en el libro para "arreglarlos".
 *  · Nombra el camino de un mes cerrado cada vez que aplica. El trigger
 *    de la 054 no deja tocar un asiento congelado, así que un remedio
 *    que diga "editá el movimiento" sin aclarar el contra-asiento manda
 *    a la persona contra una pared.
 *
 * Módulo PURO: lo importa la pantalla (cliente) y podría usarlo también
 * un informe. Ninguna entrada consulta nada.
 */

export type Remedy = {
  /** Los pasos, en palabras del tesorero. */
  fix: string;
  /** La pantalla donde se hace, cuando es una sola y clara. */
  where?: { href: string; label: string };
};

const CIERRES = { href: "/admin/tesoreria/libro/cierres", label: "Ir a Cierres" };
const LIBRO = { href: "/admin/tesoreria/libro", label: "Ir al Libro" };
const CATALOGO = { href: "/admin/tesoreria/catalogo", label: "Ir al Catálogo" };
const INFORMES = { href: "/admin/tesoreria/informes", label: "Ir a Informes" };
const ASAMBLEA = { href: "/admin/asamblea", label: "Datos de la Asamblea" };
const PRESUPUESTO = {
  href: "/admin/tesoreria/presupuesto",
  label: "Ir al Presupuesto",
};
const METAS = { href: "/admin/tesoreria/metas", label: "Ir a Metas" };
const CONCILIACION = {
  href: "/admin/tesoreria/conciliacion",
  label: "Ir a Conciliación",
};
const CREYENTES = { href: "/admin/miembros", label: "Ir a Creyentes" };

export const AUDIT_REMEDIES: Record<string, Remedy> = {
  // ── A · Cierres e inmutabilidad ──────────────────────────────────
  MES_SIN_CERRAR: {
    fix: "Revisá que el mes esté completo —todos los movimientos cargados y el extracto conciliado—, imprimí el Libro de Caja para archivarlo y cerralo. Los meses se cierran en orden: si hay varios pendientes, empezá por el más viejo.",
    where: CIERRES,
  },
  CIERRE_DESCUADRADO: {
    fix: "Abrí el Libro de Caja de ese mes y buscá el movimiento que cambió (la auditoría lo suele reportar aparte, como «se tocó después de cerrar»). Si el cambio era correcto, reabrí el mes con motivo y volvé a cerrarlo, para que el saldo congelado vuelva a coincidir; si no lo era, corregilo con un contra-asiento en el mes abierto.",
    where: CIERRES,
  },
  CIERRE_FUERA_DE_ORDEN: {
    fix: "Cerrá el mes anterior que quedó salteado. Un mes abierto entre dos cerrados se puede seguir editando hacia atrás, y eso descuadra al que vino después.",
    where: CIERRES,
  },
  REABIERTO_SIN_RECERRAR: {
    fix: "Terminá la corrección por la que se reabrió el mes y volvé a cerrarlo. Mientras siga abierto, ese período no tiene cierre válido y los meses siguientes tampoco se pueden cerrar.",
    where: CIERRES,
  },
  MES_REABIERTO: {
    fix: "No hay nada que corregir en el libro: es un registro que un auditor va a querer ver enumerado. Despachalo con «No aplica» escribiendo por qué se reabrió el mes, y queda documentado con fecha y nombre.",
  },
  MOVIMIENTO_EN_MES_CERRADO: {
    fix: "Compará el movimiento con el Libro de Caja que se imprimió al cerrar. Si hoy dice otra cosa, el camino correcto es dejar el original como está y corregir con un contra-asiento en el mes abierto (se crea desde el propio movimiento, con «Revertir»). Nunca se edita hacia atrás: eso es lo que la norma llama tachadura.",
    where: LIBRO,
  },
  CONTRA_ASIENTO_SIN_MOTIVO: {
    fix: "El motivo es lo que explica la corrección ante una inspección. Si el mes del contra-asiento sigue abierto, abrilo en el Libro y escribí en la descripción qué corrige y por qué; si ya está cerrado, dejá la explicación acá con «No aplica».",
    where: LIBRO,
  },
  CONTRA_ASIENTO_DESCUADRADO: {
    fix: "Abrí las dos filas y compará: cuenta, moneda, rubro y fondo tienen que ser los mismos, y el monto el mismo con el signo cambiado. Si el mes del contra-asiento está abierto, corregilo; si está cerrado, cargá un tercer asiento por la diferencia aclarando que ajusta la corrección anterior.",
    where: LIBRO,
  },
  REVERSION_DUPLICADA: {
    fix: "Dos correcciones sobre el mismo original desvían el saldo por el monto de más. Dejá una sola: borrá la sobrante si su mes está abierto, o revertila a su vez si ya se cerró.",
    where: LIBRO,
  },

  // ── B · Recibos ──────────────────────────────────────────────────
  RECIBO_HUECO: {
    fix: "Un hueco en la serie solo se explica con un recibo anulado, que conserva su número. Averiguá qué pasó con ese número: si el aporte existió y no se cargó, cargalo con él; si el papel se arruinó o se descartó, cargá el movimiento y anulalo con motivo. Si el hueco viene de la planilla vieja, despachalo con «No aplica» explicándolo.",
    where: LIBRO,
  },
  RECIBO_DUPLICADO: {
    fix: "Dos personas quedaron con el mismo comprobante. Dejá el número en el movimiento que corresponde y dale al otro el siguiente libre; si los dos papeles ya se entregaron, anulá el segundo con motivo y emitile uno nuevo a esa persona.",
    where: LIBRO,
  },
  APORTE_SIN_RECIBO: {
    fix: "Abrí el movimiento en el Libro y guardalo con el número de recibo vacío: el sistema le asigna el siguiente de la serie. Después emitilo y entregalo.",
    where: LIBRO,
  },
  ANULADO_SIN_MOTIVO: {
    fix: "El motivo se pide al anular, así que este viene de antes o de una carga directa, y sobre un anulado ya no se puede completar. Despachalo con «No aplica» escribiendo acá por qué se anuló: queda con fecha y nombre.",
  },
  RECIBO_EMITIDO_MODIFICADO: {
    fix: "El papel que tiene el creyente ya no coincide con el libro. Anulá ese recibo con motivo y volvé a cargar el aporte con los datos correctos: sale con el número siguiente. Entregale el recibo nuevo y avisale que el anterior quedó sin efecto.",
    where: LIBRO,
  },
  SERIE_NO_CRONOLOGICA: {
    fix: "Casi siempre es una fecha mal tipeada. Abrí los dos movimientos, confirmá contra el papel cuál es la fecha real y corregí el que esté mal. Si su mes ya está cerrado, la corrección va por contra-asiento.",
    where: LIBRO,
  },
  RECIBO_SIN_CONTRIBUYENTE: {
    fix: "Abrí el movimiento y elegí al contribuyente con el buscador; si es un creyente de la app, elegilo de la lista en vez de escribir el nombre a mano, así el aporte le aparece en «Mis aportes». Si era la canasta de la Fiesta, dejalo sin nombre y declará cuántos aportes reúne.",
    where: LIBRO,
  },
  COLECTA_SIN_CONTEO: {
    fix: "Abrí el movimiento y completá cuántos aportes reúne. Es lo que convierte una cifra sin nombre en una colecta explicable ante una inspección.",
    where: LIBRO,
  },
  ANULADO_NUNCA_EMITIDO: {
    fix: "No es un error: anular deja el número ocupado, que es lo que pide una numeración correlativa. Si el papel nunca salió, despachalo con «No aplica» aclarándolo.",
  },

  // ── C · Transferencias y coherencia del asiento ──────────────────
  TRANSFERENCIA_HUERFANA: {
    fix: "Una transferencia son dos asientos atados. Si de verdad fue un cambio de caja, borrá la pata suelta y cargala de nuevo con el botón «Transferencia», que crea las dos juntas. Si no era transferencia sino un ingreso o un gasto, cambiale el rubro.",
    where: LIBRO,
  },
  TRANSFERENCIA_DESCUADRADA: {
    fix: "Dentro de la misma moneda, las dos patas tienen que sumar cero. Revisá los montos contra el comprobante: si la diferencia es la comisión del giro, esa va como un gasto aparte (rubro «Gastos por transferencia»), nunca adentro de la transferencia.",
    where: LIBRO,
  },
  TRANSFERENCIA_MULTIPATA: {
    fix: "Dejá dos asientos por operación: borrar una pata se lleva la otra, y con tres o más quedan restos. Separalo en las transferencias que realmente fueron, cada una con su par.",
    where: LIBRO,
  },
  ASIENTO_SIN_FONDO: {
    fix: "Abrí el movimiento y elegí a qué fondo pertenece (Local, Enseñanza, Ayuda Social…). Sin fondo, la plata desaparece de los totales por fondo y el informe deja de cuadrar contra los totales por cuenta.",
    where: LIBRO,
  },
  RUBRO_INCOHERENTE: {
    fix: "Abrí el movimiento y volvé a elegir la subcategoría: al guardar, la categoría se copia de ella y queda alineada. Si el rubro cambió de categoría hace poco, conviene crear uno nuevo en la categoría correcta y desactivar el viejo.",
    where: LIBRO,
  },
  SIGNO_ATIPICO: {
    fix: "Confirmá el signo contra el comprobante: un rubro de gastos con monto positivo suele ser un ingreso cargado con el rubro equivocado. Si es una devolución legítima, dejalo como está y despachalo con «No aplica» aclarándolo.",
    where: LIBRO,
  },
  DESCRIPCION_VACIA: {
    fix: "Abrí el movimiento y escribí el concepto: es una de las cinco columnas del Libro Mayor de Caja y es lo que se lee en una inspección. Si el mes ya está cerrado no se puede completar; anotalo para no repetirlo y despachá el hallazgo.",
    where: LIBRO,
  },
  FECHA_FUERA_DEL_EJERCICIO: {
    fix: "O la fecha está mal tipeada, o el ejercicio quedó mal al cargar. Abrí el movimiento y guardalo con la fecha correcta: el ejercicio se deduce de la fecha del movimiento, no de la pantalla en la que estabas.",
    where: LIBRO,
  },
  APERTURA_DUPLICADA: {
    fix: "Dejá un solo saldo de apertura por cuenta, moneda y fondo: los demás suman dos veces la misma plata. Borrá los sobrantes, o revertilos si su mes ya está cerrado.",
    where: LIBRO,
  },
  APERTURA_FALTANTE: {
    fix: "Cargá el saldo con el que cerró la cuenta el ejercicio anterior, fechado el primer día de Riḍván y marcado como saldo de apertura. Si en vez de eso vas a importar el ejercicio anterior completo, no lo cargues: los movimientos del año viejo YA SON la apertura del nuevo y estarías contando el saldo dos veces.",
    where: LIBRO,
  },
  RUBRO_INACTIVO: {
    fix: "El movimiento no se toca: el historial necesita el rubro con el que se cargó. Si el rubro se sigue usando, reactivalo en el Catálogo; si se dio de baja a propósito, despachá el hallazgo con la explicación.",
    where: CATALOGO,
  },

  // ── D · Comprobantes ─────────────────────────────────────────────
  GASTO_SIN_COMPROBANTE: {
    fix: "Buscá la factura o el ticket y adjuntalo al movimiento desde el Libro: el panel de comprobantes aparece al abrir un gasto y acepta fotos y PDF. Si el gasto no tiene respaldo posible, dejá el motivo escrito en la descripción y despachá el hallazgo; el respaldo documental es lo que más se mira en una inspección.",
    where: LIBRO,
  },
  COMPROBANTES_NO_SUMAN: {
    fix: "Fijate si falta adjuntar otra factura del mismo gasto, o si alguna trae un ítem que no corresponde. Si el desglose está bien y la diferencia se explica, despachalo: acá se avisa, no se bloquea.",
    where: LIBRO,
  },
  COMPROBANTE_HUERFANO: {
    fix: "El archivo ya no está en el depósito. Volvé a subir el comprobante al movimiento y borrá el adjunto roto; si no aparece el original, dejá anotado en la descripción qué respaldaba.",
    where: LIBRO,
  },

  // ── E · Saldos y cuentas ─────────────────────────────────────────
  CONCILIACION_ROTA: {
    fix: "La diferencia es plata sin fondo asignado: filtrá el Libro por «sin fondo» y completá el fondo de cada movimiento. Los dos totales tienen que dar lo mismo moneda por moneda, y la hoja del informe lo muestra en rojo hasta que coincidan.",
    where: LIBRO,
  },
  SALDO_NEGATIVO: {
    fix: "Una caja en rojo delata un ingreso que falta cargar o un gasto fechado antes de tiempo. Mirá los movimientos de esa cuenta alrededor de esa fecha y corregí la fecha o cargá lo que falta. Si es una cuenta bancaria, cotejala con el extracto en Conciliación.",
    where: CONCILIACION,
  },
  CUENTA_DORMIDA: {
    fix: "Dos respuestas sirven y ninguna es urgente: si la cuenta dejó de usarse, desactivala en el Catálogo; si debería tener movimientos, buscá qué se está registrando en otra cuenta.",
    where: CATALOGO,
  },

  // ── F · Informes y balance anual ─────────────────────────────────
  INFORME_DESACTUALIZADO: {
    fix: "Abrí el informe y volvé a guardarlo: las cifras se recalculan desde el libro. Si ya se presentó en la Fiesta tal como está, dejalo y despachá el hallazgo; el snapshot congelado es justamente lo que se presentó.",
    where: INFORMES,
  },
  SNAPSHOT_INCOMPLETO: {
    fix: "Abrí el informe y guardalo de nuevo: los totales por rubro se calculan al guardar y este es anterior a esa versión. Sin eso, las secciones de ingresos y egresos de la hoja interna salen vacías.",
    where: INFORMES,
  },
  PERIODO_SIN_INFORME: {
    fix: "Armá el informe de ese mes desde Informes → Nuevo; los atajos de período son los meses bahá'ís. Es el que se proyecta en la Fiesta.",
    where: INFORMES,
  },
  BALANCE_FALTANTE: {
    fix: "Creá un informe con destinatario «Memoria y Balance» y el preset del ejercicio estatutario (18 abr → 17 abr), completá la memoria, la cotización de cierre y las tres firmas, y publicalo. Desde el 17 de abril las copias tienen que estar a disposición de todos los bahá'ís (Agregado 3 del art. XI).",
    where: INFORMES,
  },
  BALANCE_SIN_COTIZACION: {
    fix: "Abrí el balance y declará la cotización del dólar al cierre, con su fecha y su fuente (BROU o BCU). Sin ella la hoja no totaliza en pesos: sumar dos monedas solo se puede con un tipo de cambio dicho y firmado.",
    where: INFORMES,
  },
  BALANCE_SIN_FIRMAS: {
    fix: "Abrí el balance y completá las tres firmas —Coordinador/a, Secretario/a y Tesorero/a—, que el editor propone desde la composición de la Asamblea del ejercicio. Las pide el artículo VII del estatuto.",
    where: INFORMES,
  },
  INFORME_SIN_APROBACION: {
    fix: "Cuando la Asamblea lo apruebe en reunión, abrí el informe y cargá la fecha de esa reunión y el N.º de acta: con eso figura como aprobado. Hoy se tipea en el editor; todavía no hay botón de aprobar.",
    where: INFORMES,
  },
  BORRADOR_OLVIDADO: {
    fix: "Terminalo y publicalo, o borralo si quedó de una prueba. Un borrador viejo no lo ve nadie y ensucia la lista.",
    where: INFORMES,
  },

  // ── G · Institucional ────────────────────────────────────────────
  SIN_DATOS_FISCALES: {
    fix: "Cargá el nombre registrado, el RUT y el domicilio fiscal en Datos de la Asamblea. Los pide la Res. DGI 688/992 y salen impresos en cada recibo, en el Libro de Caja y en el balance; afecta también a los recibos ya emitidos, así que conviene reimprimir los que se puedan.",
    where: ASAMBLEA,
  },
  SIN_COMPOSICION: {
    fix: "Cargá quiénes integran la Asamblea de este ejercicio y sus cuatro cargos en Datos de la Asamblea; el editor propone la composición del ejercicio anterior. De ahí sale además el nombre que firma los recibos y el balance.",
    where: ASAMBLEA,
  },
  TESORERO_SIN_TAG: {
    fix: "Dale el permiso de Tesorería a quien figura como Tesorero/a, desde su ficha en Creyentes. El permiso es por comunidad: si además atiende la Tesorería Nacional, hay que marcárselo con esa comunidad puesta.",
    where: CREYENTES,
  },
  SIN_ESTATUTOS: {
    fix: "Subí el PDF de los estatutos en Datos de la Asamblea. Es el documento que se pide en cualquier trámite y conviene tenerlo ahí, no en el archivo de alguien.",
    where: ASAMBLEA,
  },

  // ── Presupuesto y metas ──────────────────────────────────────────
  SIN_PRESUPUESTO: {
    fix: "Cargá el presupuesto del ejercicio y asegurate de que tenga el año declarado: si queda vacío, el tablero de progreso no lo encuentra aunque exista. La suma de las líneas es la meta de ingresos del año.",
    where: PRESUPUESTO,
  },
  LINEA_SIN_VINCULAR: {
    fix: "Abrí la línea y elegí en «Se ejecuta con» el rubro del libro que la ejecuta: una categoría entera o una subcategoría, según la línea. Sin eso se informa como no comparable y el total ejecutado deja de significar algo.",
    where: PRESUPUESTO,
  },
  EJECUTADO_A_MANO: {
    fix: "Borrá la cifra tipeada: con la línea vinculada, el ejecutado se calcula solo desde el libro. Dejar las dos hace que dos pantallas digan números distintos sobre lo mismo.",
    where: PRESUPUESTO,
  },
  META_SIN_VINCULO: {
    fix: "Abrí la meta y decile con qué se mide: el fondo, la categoría o la subcategoría del libro de donde salen las cifras. Si no hay forma de medirla con plata, sacale el monto y dejala con su etiqueta de estado.",
    where: METAS,
  },

  // ── H · Contribuyentes ───────────────────────────────────────────
  CONTRIBUYENTE_DUPLICADO: {
    fix: "La misma persona en dos fichas parte su historial en dos. Mientras no haya pantalla para fusionarlas, dejá una sola vinculada al creyente y, desde el Libro, reasigná a ella los movimientos de la otra; después desactivá la que quedó vacía. Si son dos personas distintas con nombres parecidos, despachalo con «No aplica».",
    where: LIBRO,
  },
  CONTRIBUYENTE_SIN_PERFIL: {
    fix: "Abrí un movimiento de esa persona y usá «¿Es un creyente de la app? Vincular…» para apuntar la ficha a su perfil. Recién con el vínculo puede ver sus aportes y bajar sus recibos desde el teléfono.",
    where: LIBRO,
  },
};

/** El remedio de un código, si lo tiene. Una regla nueva sin entrada acá
 *  no rompe nada: la tarjeta sale sin la nota. */
export function remedyFor(code: string): Remedy | null {
  return AUDIT_REMEDIES[code] ?? null;
}
