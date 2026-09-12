import { BookOpen, GraduationCap, Layers3, Library } from "lucide-react";

export const levels = [
  { href: "/dashboard", label: "Level I", hint: "Foundations", icon: GraduationCap },
  { href: "/dashboard", label: "Level II", hint: "Application", icon: Layers3 },
  { href: "/dashboard", label: "Level III", hint: "Portfolio", icon: BookOpen },
] as const;

export const recentClasses: {
  href: string;
  title: string;
  meta: string;
}[] = [];

export const questionBank = {
  href: "/dashboard",
  label: "Question Bank",
  icon: Library,
} as const;
