import type { Metadata } from "next";
import { LegalSection, LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos de Uso · Comunidad Bahá'í",
  description:
    "Condiciones de uso de la app de la Comunidad Bahá'í: acceso, contenido y conducta.",
};

export default function TerminosPage() {
  return (
    <LegalShell
      title="Términos de Uso"
      intro="Al usar esta app aceptás estas condiciones. Son simples y buscan cuidar el carácter respetuoso y comunitario del espacio."
    >
      <LegalSection heading="Qué es esta app">
        <p>
          Es una herramienta privada para la vida de la Comunidad Bahá'í: un
          lugar para enterarte de actividades, ver el calendario y las Fiestas,
          compartir fotos, acceder a materiales y comunicarte con la Secretaría
          de tu Asamblea Espiritual Local. No es un servicio comercial.
        </p>
      </LegalSection>

      <LegalSection heading="Acceso a tu cuenta">
        <p>
          El acceso es para creyentes de la comunidad. Iniciás sesión con tu
          cuenta de Google. Sos responsable de mantener tu acceso seguro. La
          Asamblea de tu localidad y el administrador pueden gestionar o
          suspender cuentas cuando sea necesario para el buen funcionamiento de
          la comunidad.
        </p>
      </LegalSection>

      <LegalSection heading="Contenido que compartís">
        <p>
          Sos responsable de las fotos, comentarios y mensajes que publicás.
          Al compartir contenido te comprometés a que:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            tenés derecho a compartirlo y no infringís derechos de terceros;
          </li>
          <li>
            las personas que aparecen en las fotos están de acuerdo, y en el
            caso de menores contás con el consentimiento de sus padres o
            tutores;
          </li>
          <li>
            el contenido es respetuoso y acorde al espíritu de la comunidad.
          </li>
        </ul>
        <p>
          Conservás la titularidad de tus fotos; al subirlas, autorizás a la app
          a mostrarlas a los creyentes de la comunidad. Podés pedir que se baje
          una foto en cualquier momento.
        </p>
      </LegalSection>

      <LegalSection heading="Conducta esperada">
        <p>
          Se espera un trato respetuoso y cordial, en sintonía con los
          principios bahá'ís. No se permite contenido ofensivo, discriminatorio,
          comercial, ni ajeno a los fines de la comunidad. El contenido
          inapropiado puede ser removido por la Asamblea o el administrador.
        </p>
      </LegalSection>

      <LegalSection heading="Disponibilidad del servicio">
        <p>
          Hacemos lo posible por mantener la app funcionando, pero se ofrece
          "tal cual", sin garantías de disponibilidad ininterrumpida. Puede
          haber interrupciones por mantenimiento o por causas ajenas a nuestro
          control.
        </p>
      </LegalSection>

      <LegalSection heading="Cambios y contacto">
        <p>
          Podemos actualizar estos términos cuando cambien las funciones de la
          app; la fecha de la última actualización figura al inicio. Para
          cualquier consulta escribí a {LEGAL.responsible} a{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="font-medium text-terra hover:underline"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
