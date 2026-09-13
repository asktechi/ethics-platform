import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { PaletteProvider } from "@/components/brand/palette-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ethics Platform",
  description:
    "Personal teaching platform for CFA Institute ethics instruction, Levels I–III.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <PaletteProvider>{children}</PaletteProvider>
      </body>
    </html>
  );
}
