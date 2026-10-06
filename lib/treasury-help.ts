/**
 * Los textos de ayuda de la Tesorería, en un solo lugar.
 *
 * Cada pantalla del panel lleva un "?" al lado del título (PageHeader
 * `help`) y los campos que más confunden llevan el suyo (Field `help`).
 * Están acá y no repartidos por las pantallas por la misma razón que los
 * remedios de la auditoría: se escriben una vez, en el mismo tono, y
 * cuando algo cambia se corrige en un solo archivo.
 *
 * El tono: en palabras del tesorero, dos o tres frases, empezando por
 * qué es y siguiendo por qué hacer. Nada de jerga de base de datos.
 * Módulo puro, sin imports: lo leen componentes de cliente y servidor.
 */

export const TREASURY_HELP = {
  screens: {
    guia:
      "Los pasos del ciclo de la Tesorería, en orden, para el mes que se está cerrando. Lo que la app puede comprobar aparece tildado; lo demás queda a tu criterio. Si recién agarrás el cargo, empezá por acá y seguí los links.",
    manual:
      "Este mismo texto de ayuda, todo junto y en el orden del menú, para imprimir o guardar en PDF el primer día. Si un «?» del panel cambia, cambia acá.",
    traspaso:
      "El acta que firman quien entrega y quien recibe cuando cambia el tesorero: los saldos del libro ese día, el efectivo de las cajas con su arqueo, hasta qué mes está cerrado, la serie de recibos, y la lista de lo que se entrega. Se firma en papel con un testigo y se archiva con el legajo.",
    libro:
      "El libro es la fuente de verdad: cada aporte y cada gasto es una línea, y el saldo se calcula solo. Los aportes llevan número de recibo (lo pone la app) y contribuyente; los gastos, su comprobante. Un mes cerrado no se toca: se corrige con un contra-asiento.",
    chat:
      "Lo que la gente le escribe al tesorero desde la app, en privado: avisos de giro, preguntas sobre su aporte. Tus respuestas salen con tu nombre. «Registrar en el libro» abre el alta ya con ese creyente elegido.",
    conciliacion:
      "Comparar el extracto de la plataforma (Prex, BROU) con el libro de esa cuenta. Importás el archivo que exporta la plataforma y la app aparea lo que coincide; lo que queda suelto de cada lado es un movimiento que falta o sobra. Es la única verificación externa del libro.",
    cajas:
      "El efectivo con fondo fijo y responsable. El responsable carga los gastos con comprobante desde la app y rinde; al aprobar la rendición los gastos entran al libro y la caja se repone. El arqueo (contar la plata) es lo que prueba que el efectivo está.",
    cierres:
      "Cerrar un mes lo congela: nada entra, cambia ni sale. Es lo que pide el MEC (sin correcciones ni tachaduras) y lo que hace definitivo al Libro de Caja impreso. Se cierra en orden, del más viejo al más nuevo, cuando todo está cargado y conciliado.",
    auditoria:
      "Reglas que revisan el libro, los cierres y los informes: huecos en la serie de recibos, meses sin cerrar, transferencias sin su otra pata, gastos sin comprobante. Corre al instante y no cambia nada. Cada hallazgo dice qué está mal, contra qué norma y cómo se arregla; lo que no aplica se despacha con un motivo, que queda guardado.",
    publicar:
      "Lo ÚNICO que la comunidad ve de la Tesorería, en la app y en la Fiesta. Calcular arma un borrador que solo vos ves; Compartir lo publica tal cual. No se recalcula solo: es una cifra oficial, con fecha, dicha por el tesorero.",
    compromisos:
      "Quién tiene un compromiso mensual con el Fondo y cómo viene el mes: a quién agradecer, a quién recordar, y de quién no se puede saber porque su contribuyente no está vinculado a la app. Los compromisos que te dicen de palabra se registran acá con «Registrar un compromiso». A quien usa la app el aviso del 10 le llega solo si lo pidió; a quien no, lo recordás vos, por WhatsApp si cargaste su teléfono.",
    presupuesto:
      "Lo que la Asamblea planea gastar en el ejercicio, por categoría; la suma es lo que tiene que entrar al Fondo. Cada línea se vincula a los rubros del libro con «Se ejecuta con», y así el tablero compara presupuesto contra ejecutado. Las metas son lo que la Asamblea se propuso lograr.",
    presupuestoDetalle:
      "Las categorías con su monto para el ejercicio. «Se ejecuta con» une cada línea a uno o varios rubros del libro; sin ese vínculo la línea se informa como «sin vincular», nunca como cero.",
    metas:
      "Lo que la Asamblea se propuso: juntar algo (meta de ingreso) o financiar algo (meta de gasto). Cada meta se mide por fondos o por rubros del libro, nunca mezclados. De acá salen las barras del tablero y las diapositivas del informe.",
    progreso:
      "El ejercicio en vivo: cuánto entró contra la pauta del presupuesto, mes a mes, por categoría y por meta. La marca vertical es el tiempo transcurrido: un 43 % ejecutado con la marca en el 65 % dice «vamos lentos». La comunidad ve esto solo cuando lo compartís desde Publicar.",
    informes:
      "El taller de los informes: el deck que se proyecta en la Fiesta (comunidad), la hoja que se adjunta al acta y la Asamblea aprueba (internos), y la Memoria y Balance anual. Las cifras se congelan al guardar: el informe que se presentó no cambia porque después se cargó algo.",
    informeNuevo:
      "Elegí a quién va: las fechas se completan solas, desde el día siguiente al último informe emitido para ese destinatario hasta hoy. Los atajos son los meses bahá'ís (el corte natural de la Fiesta) y el ejercicio estatutario del 18 de abril al 17 de abril para el balance. Después se completan los textos y se emite.",
    legajo:
      "Todo lo que un auditor pide, de un período, en una carpeta comprimida: el libro, el Libro de Caja de cada mes, recibos, comprobantes, extractos, auditoría, informes y la ficha de la Asamblea. Se arma en tu navegador y se descarga solo. Es confidencial: lleva nombres.",
    contribuyentes:
      "Quiénes aportan, según el libro. Cada ficha debería apuntar a su creyente de la app: es lo que hace que la persona vea sus aportes en «Mis aportes» y que Compromisos pueda decir quién aportó. Si dos fichas son la misma persona, se fusionan: los aportes pasan a una y la otra desaparece.",
    catalogo:
      "Las cuentas (dónde está la plata), los fondos (de quién es), las categorías y los rubros (en qué se usa) con que se carga el libro. Quitar elimina lo que nunca se usó y desactiva lo que sí: el historial no se pierde.",
    recibo:
      "Cómo sale el comprobante de contribución: quién firma (sale solo de la composición de la Asamblea), la firma escaneada y el color. Y los medios de pago que la comunidad ve en «Cómo aportar».",
    reciboHoja:
      "El recibo de este aporte, para imprimir o compartir por WhatsApp como imagen. Al compartirlo o imprimirlo queda marcado como emitido; un aporte con recibo emitido ya no se edita, se anula.",
    importar:
      "Cargar al libro un ejercicio entero desde la planilla con que se llevaba antes. «Ver qué entra» no guarda nada; «Importar» sí, y se puede deshacer. Se importa del más viejo al más nuevo: la apertura la trae solo el primero, los demás se verifican contra el cierre anterior.",
    registroInformes:
      "Los informes emitidos por la Tesorería, con su estado: aprobado cuando el tesorero anotó la reunión en que la Asamblea lo aprobó. Solo consulta.",
  },

  fields: {
    cuenta:
      "Dónde está la plata: Prex, BROU, la caja chica. Cada cuenta puede tener pesos y dólares a la vez; el saldo se lleva por cuenta y moneda.",
    fondo:
      "De quién es la plata: Fondo Local, Enseñanza, Ayuda Social… Dos movimientos de la misma cuenta pueden ser de fondos distintos y no se suman entre sí. El rubro suele sugerirlo solo.",
    rubro:
      "En qué se usa o de dónde viene: el rubro (subcategoría) arrastra su categoría y sugiere el fondo. Es lo que agrupa los informes; si falta uno, se crea en Catálogo.",
    recibo:
      "Todo aporte lleva número correlativo (lo pide la DGI). Si lo dejás vacío, la app pone el siguiente libre. Un recibo emitido no se edita: se anula y conserva su número.",
    contribuyente:
      "Quién aportó. Elegilo de la lista: si es un creyente de la app, le aparece en «Mis aportes», le llega el aviso con el recibo y el informe de compromisos lo reconoce. Escribir un nombre suelto sirve para alguien que no está en la app.",
    seudonimo:
      "Cómo figura en el papel del recibo («Familia Pérez») cuando no es el nombre del contribuyente. Es de este aporte, no de la persona: el libro sigue sabiendo quién aportó.",
    aportes:
      "Cuántos aportes agrupa esta línea. Sirve para la canasta de la Fiesta: varios aportes anónimos en un solo recibo, sin contribuyente.",
    cuentaExtracto:
      "La cuenta del libro que corresponde al archivo que vas a importar. La app avisa si el archivo parece de otra plataforma o de otra moneda, pero no bloquea.",
    destinatario:
      "Comunidad: el deck de diapositivas para la Fiesta, con link público. Asamblea: la hoja para el acta, que solo ven los miembros. Balance: la Memoria y Balance anual del ejercicio estatutario, que la comunidad puede leer desde el 17 de abril.",
    periodoInforme:
      "Ingresos y egresos son del período; los saldos son acumulados hasta la fecha de cierre. Un mes bahá'í es el corte natural del informe de la Fiesta.",
    estadoPresupuesto:
      "Borrador mientras la Asamblea lo discute; Activo el que rige el ejercicio (es el que mira el tablero); Cerrado cuando terminó el año.",
    montoPresupuesto:
      "Lo que la Asamblea planea gastar en esta categoría en el ejercicio. La suma de todas las categorías es la pauta: lo que tiene que entrar al Fondo.",
    cadenciaMeta:
      "Mensual: se compara contra el acumulado de los meses transcurridos. Anual: contra el ejercicio. Única: una sola vez, sin calendario.",
    direccionMeta:
      "Ingreso: juntar algo (se mide por lo recibido en los fondos o rubros vinculados). Gasto: financiar algo (se mide por lo gastado). Elegí fondos O rubros, no los dos: se contaría dos veces.",
    ejercicioMeta:
      "El ejercicio al que pertenece la meta. Vacío es permanente: se muestra todos los años.",
    nombreTesorero:
      "Dejalo vacío: el nombre sale solo del Tesorero/a declarado en Datos de la Asamblea, con vigencia, así un recibo viejo reimpreso conserva a quien lo firmó. Escribilo acá solo si querés forzar otro.",
    firma:
      "La firma escaneada, ideal en PNG con fondo transparente. Es de esta comunidad: la Nacional tiene la suya. Sin firma, el renglón queda en blanco para firmar a mano.",
    vincularContribuyente:
      "El creyente de la app al que pertenece esta ficha. Desde ese momento ve estos aportes en «Mis aportes», le llega el aviso de cada aporte nuevo con su recibo, y Compromisos lo reconoce. Una persona puede tener más de una ficha (a título personal y por su negocio) apuntando al mismo creyente.",
    fusionarContribuyente:
      "Mueve todos los aportes de esta ficha a la que elijas y elimina esta. Sirve para los dobles («Carlos Cardona» y «Sr. Carlos Cardona»). Los aportes de meses cerrados también se mueven: no cambia el hecho contable, solo a qué ficha apunta. No se puede deshacer.",
    calcular:
      "Arma la foto del Fondo hasta la fecha de corte y la guarda como borrador que solo vos ves. Calcular de nuevo la reemplaza. Para la Fiesta, el atajo es «hasta el fin del último mes bahá'í».",
    compartir:
      "Publica exactamente lo que estás viendo. Si entre Calcular y Compartir entra un movimiento, sale lo que revisaste. La Fiesta se queda con la foto vigente al iniciarla.",
  },
} as const;

export type TreasuryHelpScreen = keyof typeof TREASURY_HELP.screens;
export type TreasuryHelpField = keyof typeof TREASURY_HELP.fields;

/** Las pantallas en el orden del menú, para el manual imprimible. */
export const SCREEN_INDEX: Array<{
  key: TreasuryHelpScreen;
  label: string;
  href: string;
  section: string;
}> = [
  { key: "guia", label: "Guía del mes", href: "/admin/tesoreria/guia", section: "Empezar" },
  { key: "traspaso", label: "Traspaso", href: "/admin/tesoreria/traspaso", section: "Empezar" },
  { key: "libro", label: "Libro", href: "/admin/tesoreria/libro", section: "Todos los días" },
  { key: "chat", label: "Mensajes", href: "/admin/tesoreria/chat", section: "Todos los días" },
  { key: "conciliacion", label: "Conciliación", href: "/admin/tesoreria/conciliacion", section: "Todos los días" },
  { key: "cajas", label: "Cajas chicas", href: "/admin/tesoreria/cajas", section: "Cada mes" },
  { key: "cierres", label: "Cierres", href: "/admin/tesoreria/libro/cierres", section: "Cada mes" },
  { key: "auditoria", label: "Auditoría", href: "/admin/tesoreria/auditoria", section: "Cada mes" },
  { key: "publicar", label: "Publicar", href: "/admin/tesoreria/publicar", section: "Cada mes" },
  { key: "compromisos", label: "Compromisos", href: "/admin/tesoreria/compromisos", section: "Cada mes" },
  { key: "presupuesto", label: "Presupuesto y metas", href: "/admin/tesoreria/presupuesto", section: "El ejercicio" },
  { key: "metas", label: "Metas de la Asamblea", href: "/admin/tesoreria/metas", section: "El ejercicio" },
  { key: "progreso", label: "Progreso", href: "/admin/tesoreria/progreso", section: "El ejercicio" },
  { key: "informes", label: "Informes", href: "/admin/tesoreria/informes", section: "El ejercicio" },
  { key: "legajo", label: "Legajo para el auditor", href: "/admin/tesoreria/legajo", section: "El ejercicio" },
  { key: "catalogo", label: "Catálogo", href: "/admin/tesoreria/catalogo", section: "Ajustes" },
  { key: "contribuyentes", label: "Contribuyentes", href: "/admin/tesoreria/contribuyentes", section: "Ajustes" },
  { key: "recibo", label: "Recibo y medios de pago", href: "/admin/tesoreria/recibo/ajustes", section: "Ajustes" },
  { key: "importar", label: "Importar un ejercicio", href: "/admin/tesoreria/libro/importar", section: "Ajustes" },
];

/** A qué pantalla pertenece cada campo con ayuda, para agruparlos en el manual. */
export const FIELD_SCREEN: Record<TreasuryHelpField, TreasuryHelpScreen> = {
  cuenta: "libro",
  fondo: "libro",
  rubro: "libro",
  recibo: "libro",
  contribuyente: "libro",
  seudonimo: "libro",
  aportes: "libro",
  cuentaExtracto: "conciliacion",
  destinatario: "informes",
  periodoInforme: "informes",
  estadoPresupuesto: "presupuesto",
  montoPresupuesto: "presupuesto",
  cadenciaMeta: "metas",
  direccionMeta: "metas",
  ejercicioMeta: "metas",
  nombreTesorero: "recibo",
  firma: "recibo",
  calcular: "publicar",
  compartir: "publicar",
  vincularContribuyente: "contribuyentes",
  fusionarContribuyente: "contribuyentes",
};
