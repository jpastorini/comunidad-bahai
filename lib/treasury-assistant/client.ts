import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** El cliente de la API, uno por proceso. */
let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/** Files API: las imágenes y los PDF adjuntos se nombran por su id. */
export const FILES_BETA = "files-api-2025-04-14";
