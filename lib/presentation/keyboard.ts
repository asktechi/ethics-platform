import type { BusEvent } from "@/lib/presentation/types";

export type HostUiAction =
  | { kind: "bus"; event: BusEvent }
  | { kind: "grid" }
  | { kind: "fullscreen" }
  | { kind: "exit-fullscreen" }
  | { kind: "rehearsal" }
  | { kind: "toggle-prompter" }
  | { kind: "confirm-end" };

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[role="dialog"]')) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Map presenter key events to bus events or chrome actions.
 * Clickers emit Space / PageDown as ordinary keydown.
 * Phase 4.5 voice advance will skip this file and call dispatch({ type: "NEXT" }).
 */
export function mapHostKey(event: KeyboardEvent): HostUiAction | null {
  if (isEditableTarget(event.target)) return null;

  const key = event.key;
  if (key === " " || key === "Spacebar" || key === "ArrowRight" || key === "PageDown") {
    return { kind: "bus", event: { type: "NEXT" } };
  }
  if (key === "ArrowLeft" || key === "PageUp") {
    return { kind: "bus", event: { type: "PREV" } };
  }
  if (key === "g" || key === "G") return { kind: "grid" };
  if (key === "p" || key === "P") return { kind: "toggle-prompter" };
  if (key === "f" || key === "F") return { kind: "fullscreen" };
  if (key === "r" || key === "R") return { kind: "rehearsal" };
  if (key === "Escape") return { kind: "exit-fullscreen" };
  if ((event.metaKey || event.ctrlKey) && (key === "e" || key === "E")) {
    return { kind: "confirm-end" };
  }
  return null;
}
