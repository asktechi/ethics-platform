"use client";

import { useEffect } from "react";
import { useGameWizard } from "@/lib/games/wizard-store";
import type { WizardState } from "@/lib/games/types";

export function EditHydrator({ state }: { state: Partial<WizardState> }) {
  const hydrate = useGameWizard((store) => store.hydrate);
  useEffect(() => {
    hydrate({ ...state, mode: state.mode ?? "jeopardy", modeConfig: state.modeConfig ?? {} });
  }, [hydrate, state]);
  return null;
}
