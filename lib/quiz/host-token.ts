export function hostTokenStorageKey(sessionId: string) {
  return `quiz-host-token:${sessionId}`;
}

export function readHostToken(sessionId: string) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(hostTokenStorageKey(sessionId));
}

export function writeHostToken(sessionId: string, token: string) {
  window.sessionStorage.setItem(hostTokenStorageKey(sessionId), token);
}
