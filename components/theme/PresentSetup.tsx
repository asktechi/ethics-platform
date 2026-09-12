"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveAllClassSlidesAction,
  loadPresentSetupAction,
  saveRunSettingsAction,
  startPresentationAction,
} from "@/app/(app)/_actions/presentation.actions";
import { ThemeReel } from "@/components/theme/ThemeReel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemePalette, ThemeReelItem } from "@/lib/themes/types";
import type { Json } from "@/types/db";
import type { PresentationRun } from "@/types/db.helpers";

export function PresentSetup({ classId }: { classId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<PresentationRun | null>(null);
  const [counts, setCounts] = useState({ total: 0, approved: 0, draft: 0 });
  const [reel, setReel] = useState<ThemeReelItem[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [wpm, setWpm] = useState(130);
  const [usePools, setUsePools] = useState(true);
  const [themeMode, setThemeMode] = useState<"shuffle" | "locked">("shuffle");
  const [lockedThemeId, setLockedThemeId] = useState<string>("");
  const [themes, setThemes] = useState<Array<{ id: string; name: string; palette_json: Json }>>([]);
  const [origin, setOrigin] = useState("");
  const router = useRouter();

  useEffect(() => {
    setOrigin(window.location.origin);
    startTransition(async () => {
      const result = await loadPresentSetupAction({ classId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRun(result.run);
      setCounts(result.counts);
      setSeconds(result.settings.seconds_per_slide);
      setWpm(result.settings.teleprompter_wpm);
      setUsePools(result.settings.use_image_pools);
      setThemeMode(result.settings.theme_mode);
      setLockedThemeId(result.settings.locked_theme_id ?? "");
      setThemes(result.themes as Array<{ id: string; name: string; palette_json: Json }>);
      setReel(
        result.assignments.map((row) => {
          const slide = result.slides.find((item) => item.id === row.slide_id);
          return {
            slide_id: row.slide_id,
            title: slide?.title ?? "Untitled slide",
            body: slide?.body ?? "",
            status: slide?.status ?? "draft",
            theme_id: "",
            theme_name: row.theme_json.name ?? "Theme",
            theme_json: row.theme_json as ThemePalette,
            image_url: row.image_url,
            image_attribution: row.image_attribution,
            override: false,
          };
        }),
      );
    });
  }, [classId]);

  const hostUrl = run ? `${origin}/class/${classId}/present/${run.run_id}/host` : "";
  const audienceUrl = run ? `${origin}/present/${run.run_id}/audience` : "";
  const qrSrc = useMemo(() => {
    if (!audienceUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(audienceUrl)}`;
  }, [audienceUrl]);

  function saveSettings() {
    if (!run) return;
    startTransition(async () => {
      const result = await saveRunSettingsAction({
        classId,
        runId: run.id,
        settings: {
          seconds_per_slide: seconds,
          teleprompter_wpm: wpm,
          use_image_pools: usePools,
          theme_mode: themeMode,
          locked_theme_id: themeMode === "locked" ? lockedThemeId || null : null,
        },
      });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          Slide readiness
        </p>
        <p className="mt-2 font-display text-2xl text-ivory">
          {counts.total} slides · {counts.approved} approved · {counts.draft} drafts
        </p>
        {counts.draft > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gold">
              {counts.draft} slides are still drafts. Approve them before students see the deck.
            </p>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveAllClassSlidesAction({ classId });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setCounts((prev) => ({
                    total: prev.total,
                    approved: prev.total,
                    draft: 0,
                  }));
                })
              }
            >
              Approve all and continue
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ivory/60">All current slides are approved.</p>
        )}
      </section>

      <Tabs defaultValue="settings">
        <TabsList className="bg-transparent">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="share">Share</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4 space-y-4 border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seconds">Time per slide (seconds, 0 = manual)</Label>
              <Input
                id="seconds"
                type="number"
                min={0}
                value={seconds}
                onChange={(event) => setSeconds(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wpm">Teleprompter WPM</Label>
              <Input
                id="wpm"
                type="number"
                min={60}
                value={wpm}
                onChange={(event) => setWpm(Number(event.target.value) || 130)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ivory">
            <input
              type="checkbox"
              checked={usePools}
              onChange={(event) => setUsePools(event.target.checked)}
            />
            Use locked concept image pools
          </label>
          <div className="space-y-2">
            <Label htmlFor="theme-mode">Theme</Label>
            <select
              id="theme-mode"
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value as "shuffle" | "locked")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-ivory"
            >
              <option value="shuffle">Shuffle (never repeat last 5)</option>
              <option value="locked">Lock one professional palette for every slide</option>
            </select>
          </div>
          {themeMode === "locked" ? (
            <div className="space-y-2">
              <Label htmlFor="locked-theme">Locked palette</Label>
              <select
                id="locked-theme"
                value={lockedThemeId}
                onChange={(event) => setLockedThemeId(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-ivory"
              >
                <option value="">Choose a theme</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={saveSettings} disabled={pending || !run}>
            Save settings
          </Button>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <ThemeReel items={reel} limit={0} />
        </TabsContent>

        <TabsContent value="share" className="mt-4 space-y-4 border border-border bg-card p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Host (auth-gated)</p>
            <p className="mt-1 break-all font-mono text-xs text-ivory">{hostUrl || "Loading…"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Audience (open)</p>
            <p className="mt-1 break-all font-mono text-xs text-ivory">{audienceUrl || "Loading…"}</p>
          </div>
          {qrSrc ? (
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Audience QR</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Audience QR code" className="mt-2 h-40 w-40 bg-ivory p-2" />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <Button
        type="button"
        className="bg-gold text-navy hover:bg-gold/90"
        disabled={pending || !run}
        onClick={() => {
          if (!run) return;
          startTransition(async () => {
            const result = await startPresentationAction({ classId, runId: run.id });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/class/${classId}/present/${result.publicRunId}/host`);
          });
        }}
      >
        Start presentation
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
