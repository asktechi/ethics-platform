"use client";

import { createContext, useContext, type ReactNode } from "react";
import { brandTokens } from "@/lib/theme/tokens";

const PaletteContext = createContext(brandTokens);

export function PaletteProvider({ children }: { children: ReactNode }) {
  return (
    <PaletteContext.Provider value={brandTokens}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  return useContext(PaletteContext);
}
