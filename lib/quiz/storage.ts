import type { PlayerIdentity } from "@/lib/quiz/types";

export function quizStorageKey(sessionId: string) {
  return `quiz:${sessionId}`;
}

export function readPlayerIdentity(sessionId: string): PlayerIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(quizStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerIdentity;
    if (!parsed.participant_token || parsed.session_id !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlayerIdentity(identity: PlayerIdentity) {
  window.localStorage.setItem(quizStorageKey(identity.session_id), JSON.stringify(identity));
}
