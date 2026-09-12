export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatFinish(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function splitContrastBody(body: string): [string, string] {
  const blocks = body.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2);
    return [blocks.slice(0, mid).join("\n\n"), blocks.slice(mid).join("\n\n")];
  }
  const dash = body.split(/\s+[—–]\s+|;\s+/);
  if (dash.length >= 2) {
    return [dash[0].trim(), dash.slice(1).join(" — ").trim()];
  }
  const words = body.split(/\s+/);
  if (words.length < 4) return [body, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export const BODY_CHAR_LIMIT = 220;

export function truncateSlideBody(body: string, slideId: string) {
  if (body.length <= BODY_CHAR_LIMIT) return body;
  console.warn(
    `[presentation] Slide ${slideId} body is ${body.length} chars (limit ${BODY_CHAR_LIMIT}). Truncating — edit the slide, not the renderer.`,
  );
  return `${body.slice(0, BODY_CHAR_LIMIT - 1).trimEnd()}…`;
}
