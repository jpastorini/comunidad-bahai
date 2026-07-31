import type { Metadata } from "next";
import { LegalSection, LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidad · Comunidad Bahá'í",
  description:
    "Cómo recopilamos, usamos y protegemos tus datos en la app de la Comunidad Bahá'í.",
};

export default function PrivacidadPage() {
  return (
    <LegalShell
      title="Política de Privacidad"
      intro={`Esta app es una herramienta privada para la vida comunitaria bahá'í. ${LEGAL.responsible} es responsable de su operación. Acá te explicamos, en lenguaje claro, qué datos usamos y por qué. Solo recopilamos lo necesario para que la comunidad funcione, y nunca vendemos tu información.`}
    >
      <LegalSection heading="Quién es responsable">
        <p>
          El responsable del tratamiento de los datos es {LEGAL.responsible},
          que administra esta aplicación al servicio de la Comunidad Bahá'í y
          sus Asambleas Espirituales Locales. Para cualquier consulta sobre tus
          datos podés escribir a{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="font-medium text-terra hover:underline"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Qué datos recopilamos">
        <p>Cuando iniciás sesión y usás la app, podemos guardar:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Tu cuenta de Google:</strong> nombre, dirección de correo y
            foto de perfil. Usamos únicamente los permisos básicos de Google
            (nombre, email y foto); no accedemos a tus contactos, calendario,
            correos ni a ningún otro dato de tu cuenta.
          </li>
          <li>
            <strong>Tu perfil en la comunidad:</strong> la localidad a la que
            pertenecés y tu rol (creyente o Asamblea).
          </li>
          <li>
            <strong>Contenido que compartís:</strong> fotos que subís a la
            galería (con su descripción), reacciones y comentarios, y los
            mensajes que enviás por el chat con la Secretaría.
          </li>
          <li>
            <strong>Notificaciones:</strong> si las activás, guardamos la
            suscripción de tu dispositivo para poder enviarte avisos.
          </li>
          <li>
            <strong>Tesorería:</strong> si la Asamblea lo gestiona, información
            de presupuesto y aportes, visible solo para quienes tienen ese rol.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Para qué los usamos">
        <p>
          Usamos tus datos solo para que la app cumpla su función: identificarte
          al ingresar, mostrarte el contenido de tu localidad, permitirte
          compartir fotos y comunicarte con la Secretaría, y enviarte
          notificaciones que pediste recibir. No usamos tus datos para
          publicidad ni para ningún fin ajeno a la vida de la comunidad.
        </p>
        <p>
          La base para tratar estos datos es tu consentimiento al crear la
          cuenta y al usar cada función (por ejemplo, marcás una casilla de
          consentimiento antes de subir fotos de otras personas).
        </p>
      </LegalSection>

      <LegalSection heading="Quién puede ver tu información">
        <p>
          El contenido de la comunidad (fotos, comentarios, calendario) es
          visible para los creyentes autenticados de tu localidad. El chat con
          la Secretaría lo ven solo vos y las personas de la Asamblea
          autorizadas a responder. Tu perfil y datos de cuenta los gestiona la
          Asamblea de tu localidad y el administrador de la app.
        </p>
        <p>
          No compartimos tus datos con terceros con fines comerciales. Solo se
          procesan a través de los proveedores de infraestructura que hacen
          funcionar la app (ver abajo).
        </p>
      </LegalSection>

      <LegalSection heading="Dónde se guardan (proveedores)">
        <p>
          La app se apoya en servicios de terceros que actúan como encargados
          del tratamiento, bajo sus propias políticas de seguridad:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Google</strong> — inicio de sesión (autenticación).
          </li>
          <li>
            <strong>Supabase</strong> — base de datos, almacenamiento de fotos y
            gestión de cuentas.
          </li>
          <li>
            <strong>Vercel</strong> — alojamiento de la aplicación.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cuánto tiempo los conservamos">
        <p>
          Conservamos tus datos mientras tu cuenta esté activa y formes parte de
          la comunidad. Si pedís dar de baja tu cuenta, eliminamos tu perfil y
          el contenido asociado, salvo lo que debamos conservar por un motivo
          legítimo o que ya forme parte del registro histórico de la comunidad
          de forma anónima.
        </p>
      </LegalSection>

      <LegalSection heading="Tus derechos">
        <p>
          Podés solicitar acceder, corregir o eliminar tus datos, así como
          retirar tu consentimiento, escribiendo a{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="font-medium text-terra hover:underline"
          >
            {LEGAL.contactEmail}
          </a>{" "}
          o hablando con la Secretaría por el chat de la app. Si subiste una
          foto y querés que se baje, también podés pedirlo por esos medios.
        </p>
      </LegalSection>

      <LegalSection heading="Menores de edad">
        <p>
          Si se comparten fotos de niñas o niños, quien las sube debe contar con
          el consentimiento de sus padres, madres o tutores. La app pide
          confirmar esto antes de cada publicación.
        </p>
      </LegalSection>

      <LegalSection heading="Cambios a esta política">
        <p>
          Podemos actualizar este texto si cambian las funciones de la app. La
          fecha de la última actualización figura al inicio de la página. Te
          avisaremos de cambios importantes por los canales de la comunidad.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
