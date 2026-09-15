import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function Phase75aLayout({ children }: { children: React.ReactNode }) {
  return children;
}
