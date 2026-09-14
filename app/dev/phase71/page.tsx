"use client";

import { BossOutcomeScreen } from "@/components/quiz/BossChrome";
import { CaseStudyHostEndLinks, HostCloseToGames, HostEndNavBar, PlayerEndNavBar } from "@/components/quiz/EndNavBar";
import type { BossCombatView } from "@/lib/games/boss-view";

const mockCombat: BossCombatView = {
  boss_hp: 0,
  boss_max_hp: 400,
  party_hp: 120,
  party_max_hp: 200,
  phase: 3,
  outcome: "victory",
  play_mode: "co-op",
  taunt: null,
  log: [],
  defeat_reason: null,
  boss: {
    id: "fixture",
    slug: "ethics-hydra",
    name: "Ethics Hydra",
    subtitle: "Fixture boss",
    portrait_emoji: "♛",
    portrait_url: null,
    max_hp: 400,
    standard_id: null,
    phase_1_taunts: [],
    phase_2_taunts: [],
    phase_3_taunts: [],
    victory_line: "The hydra falls.",
    defeat_line: "The hydra stands.",
    palette_json: { accent: "#E63946", bg: "#1a1025", hpBar: "#DC2626" },
  },
};

export default function Phase71PreviewPage() {
  return (
    <main className="min-h-screen space-y-10 bg-navy p-6 text-ivory">
      <h1 className="font-display text-3xl text-gold">Phase 7.1 end-screen fixtures</h1>

      <section className="relative border border-white/10 p-6">
        <h2 className="mb-4 font-display text-xl">Host summary</h2>
        <div className="flex justify-end">
          <HostCloseToGames />
        </div>
        <p className="text-ivory/70">Podium and analytics live on the real summary route.</p>
        <HostEndNavBar templateId="template-fixture" instanceId="instance-fixture" />
      </section>

      <section className="border border-white/10 p-6">
        <h2 className="mb-4 font-display text-xl">Player final</h2>
        <p className="text-center font-display text-3xl">180 pts</p>
        <PlayerEndNavBar joinCode="ABC12" allowReplay />
      </section>

      <section className="border border-white/10 p-6">
        <h2 className="mb-4 font-display text-xl">Session detail header</h2>
        <HostEndNavBar templateId={null} instanceId="instance-fixture" />
      </section>

      <section className="relative min-h-[420px] overflow-hidden border border-white/10">
        <h2 className="p-4 font-display text-xl">Boss victory</h2>
        <BossOutcomeScreen
          combat={mockCombat}
          players={[{ id: "p1", display_name: "Ava", score: 90 }]}
          responses={[{ ms_taken: 1200 }]}
          sessionId="session-fixture"
          templateId="template-fixture"
          instanceId="instance-fixture"
          role="host"
        />
      </section>

      <section className="border border-[#2A9D8F]/40 bg-[#2A9D8F]/10 p-8 text-center">
        <p className="font-display text-3xl text-[#2A9D8F]">Case complete</p>
        <CaseStudyHostEndLinks templateId="template-fixture" />
      </section>
    </main>
  );
}
