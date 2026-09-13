"use client";

import { create } from "zustand";
import {
  defaultGameFilter,
  defaultGameSettings,
  type GameMode,
  type WizardState,
} from "@/lib/games/types";

const empty: WizardState = {
  classId: "",
  name: "",
  description: "",
  tags: [],
  source: "pool",
  poolId: "",
  filter: defaultGameFilter(),
  mode: "jeopardy",
  settings: defaultGameSettings(),
};

type WizardStore = WizardState & {
  step: number;
  setStep: (step: number) => void;
  patch: (partial: Partial<WizardState>) => void;
  hydrate: (state: Partial<WizardState>) => void;
  reset: () => void;
};

export const useGameWizard = create<WizardStore>((set) => ({
  ...empty,
  step: 1,
  setStep: (step) => set({ step }),
  patch: (partial) => set(partial),
  hydrate: (state) => set({ ...empty, ...state, step: 1 }),
  reset: () => set({ ...empty, step: 1, mode: "jeopardy" as GameMode, settings: defaultGameSettings(), filter: defaultGameFilter() }),
}));
