const KEY = "quiz-student-code";

export function readStudentCode() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function writeStudentCode(value: string) {
  if (!value.trim()) return;
  window.localStorage.setItem(KEY, value.trim().toUpperCase());
}
