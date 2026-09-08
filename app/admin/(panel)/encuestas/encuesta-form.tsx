import { PollFields } from "@/components/admin/comunicados/PollFields";
import { Button, Card, Field, Select, TextArea } from "@/components/admin/ui";
import type { Message, MessagePoll } from "@/lib/types";
import { upsertEncuestaAction } from "./actions";

type Props = {
  /** El comunicado que lleva la encuesta (al editar). */
  message?: Message;
  poll?: MessagePoll | null;
  pollParticipants?: number;
};

/**
 * El formulario de Encuestas: la pregunta primero, y lo demás alrededor.
 * Usa los mismos campos (`PollFields`) y la misma `savePoll()` que el
 * formulario de Comunicados; lo que cambia es el orden y qué se pide.
 */
export function EncuestaForm({ message, poll = null, pollParticipants = 0 }: Props) {
  return (
    <form action={upsertEncuestaAction}>
      {message && <input type="hidden" name="id" value={message.id} />}

      <Card>
        <PollFields poll={poll} participants={pollParticipants} alwaysOn />
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
          Quién vota y qué acompaña a la pregunta
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          La encuesta llega como un comunicado: el aviso dice “La Asamblea pregunta:
          …” y en la app se ve como una tarjeta con la pregunta y las opciones.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Quién vota"
            name="audience"
            hint="Los Amigos de la Fe solo ven (y reciben) las encuestas marcadas para toda la comunidad."
          >
            <Select id="audience" name="audience" defaultValue={message?.audience ?? "creyentes"}>
              <option value="creyentes">Solo creyentes</option>
              <option value="todos">Toda la comunidad, incluidos Amigos de la Fe</option>
            </Select>
          </Field>
          <Field
            label="Texto de acompañamiento"
            name="intro"
            hint="Opcional. Un párrafo de contexto que se muestra arriba de la pregunta."
          >
            <TextArea
              id="intro"
              name="intro"
              rows={4}
              defaultValue={message?.full_text ?? ""}
              placeholder="La Asamblea está organizando la reunión devocional del mes y quiere saber qué día les queda mejor."
            />
          </Field>
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href={message ? `/admin/encuestas/${message.id}` : "/admin/encuestas"}>
          Cancelar
        </Button>
        <Button type="submit">{message ? "Guardar cambios" : "Publicar encuesta"}</Button>
      </div>
    </form>
  );
}
