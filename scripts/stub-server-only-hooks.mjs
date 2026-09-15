import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const empty = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "empty.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: empty };
  }
  return nextResolve(specifier, context);
}
