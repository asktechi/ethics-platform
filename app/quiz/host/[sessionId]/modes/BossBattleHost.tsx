"use client";

import {
  BossOutcomeScreen,
  BossPortrait,
  CombatLog,
  HpBar,
  PhaseOverlay,
  hpBarColor,
} from "@/components/quiz/BossChrome";
import { HostQuestionView } from "@/app/quiz/host/[sessionId]/HostQuestionView";
import { HostSidePanel } from "@/app/quiz/host/[sessionId]/HostSidePanel";
import { Button } from "@/components/ui/button";
import type { BestAnswer } from "@/components/quiz/BestAnswerPanel";
import type { LivePlayer } from "@/components/quiz/Leaderboard";
import type { BossCombatView } from "@/lib/data/bosses";
import type { HostExtraPanelProps } from "@/lib/games/modes/types";
import type { QuizHostQuestion } from "@/lib/quiz/types";

export function BossBattleHost({
  sessionId,
  questions,
  index,
  phase,
  remaining,
  timePerQ,
  paused,
  counts,
  players,
  changedIds,
  joins,
  best,
  combat,
  overlay,
  templateId,
  onPrev,
  onNext,
  onReveal,
  onEnd,
  onForceVictory,
  onForceDefeat,
  message,
}: {
  sessionId: string;
  questions: QuizHostQuestion[];
  index: number;
  phase: string;
  remaining: number;
  timePerQ: number;
  paused: boolean;
  counts: Record<string, number>;
  players: LivePlayer[];
  changedIds: Set<string>;
  joins: string[];
  best: BestAnswer | null;
  combat: BossCombatView | null;
  overlay: { phase: number; taunt: string } | null;
  templateId?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onReveal: () => void;
  onEnd: () => void;
  onForceVictory: () => void;
  onForceDefeat: () => void;
  message?: string | null;
}) {
  const question = questions[index];
  const boss = combat?.boss;
  const palette = boss?.palette_json ?? {};
  const max = combat?.boss_max_hp ?? boss?.max_hp ?? 400;
  const hp = combat?.boss_hp ?? max;
  const ratio = max <= 0 ? 0 : hp / max;
  const playMode = combat?.play_mode ?? "co-op";
  const ended = combat?.outcome === "victory" || combat?.outcome === "defeat";

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: `${palette.bg ?? "#1a1025"}` }}>
      {combat && ended ? (
        <BossOutcomeScreen
          combat={combat}
          players={players}
          responses={[]}
          sessionId={sessionId}
          templateId={templateId}
          role="host"
        />
      ) : null}
      <PhaseOverlay
        open={Boolean(overlay)}
        phase={overlay?.phase ?? combat?.phase ?? 1}
        taunt={overlay?.taunt ?? ""}
        accent={palette.accent ?? "#E63946"}
        emoji={boss?.portrait_emoji}
        url={boss?.portrait_url}
        name={boss?.name ?? "Boss"}
      />
      <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
        <BossPortrait emoji={boss?.portrait_emoji} url={boss?.portrait_url} name={boss?.name ?? "Boss"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl">{boss?.name ?? "Boss Battle"}</h2>
            <span className="border border-white/20 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]">
              Phase {combat?.phase ?? 1} / 3
            </span>
          </div>
          <p className="text-sm text-ivory/60">{boss?.subtitle}</p>
          <div className="mt-2">
            <HpBar label="Boss HP" current={hp} max={max} color={hpBarColor(ratio, palette.hpBar)} />
          </div>
          {playMode === "co-op" && combat?.party_hp != null ? (
            <div className="mt-2">
              <HpBar
                label="Party HP"
                current={combat.party_hp}
                max={combat.party_max_hp}
                color="#38BDF8"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_320px]">
        <HostQuestionView
          question={question}
          phase={phase}
          counts={counts}
          remaining={remaining}
          timePerQ={timePerQ}
          paused={paused}
        />
        <HostSidePanel
          players={players}
          changedIds={changedIds}
          joins={joins}
          question={question}
          counts={counts}
          revealed={phase === "reveal"}
          best={best}
          extra={<CombatLog entries={combat?.log ?? []} />}
          onHighlight={() => undefined}
        />
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
        <Button variant="outline" disabled={index === 0 || phase === "reveal" || ended} onClick={onPrev}>
          Previous
        </Button>
        <Button variant="outline" disabled={phase === "reveal" || ended} onClick={onReveal}>
          Reveal
        </Button>
        <Button
          className="bg-gold text-navy hover:bg-gold/90"
          disabled={phase !== "reveal" || ended}
          onClick={onNext}
        >
          Next
        </Button>
        <Button variant="ghost" onClick={onEnd}>
          End
        </Button>
        <Button variant="outline" onClick={onForceVictory}>
          Force victory
        </Button>
        <Button variant="outline" onClick={onForceDefeat}>
          Force defeat
        </Button>
        {message ? <p className="ml-auto text-sm text-ivory/60">{message}</p> : null}
      </footer>
    </div>
  );
}
