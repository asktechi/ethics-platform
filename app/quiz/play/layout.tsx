import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function QuizPlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-navy text-ivory">{children}</div>;
}
