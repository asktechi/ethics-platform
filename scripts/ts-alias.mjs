import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function withExtension(base) {
  if (existsSync(base) && !base.endsWith("/")) return base;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  const index = join(base, "index.ts");
  if (existsSync(index)) return index;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const mapped = withExtension(join(process.cwd(), specifier.slice(2)));
    if (mapped) return nextResolve(pathToFileURL(mapped).href, context);
  }
  if (specifier.startsWith(".") && context.parentURL) {
    const parent = dirname(fileURLToPath(context.parentURL));
    const mapped = withExtension(join(parent, specifier));
    if (mapped) return nextResolve(pathToFileURL(mapped).href, context);
  }
  return nextResolve(specifier, context);
}
