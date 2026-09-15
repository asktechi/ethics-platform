"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSlideAction } from "@/app/(app)/_actions/material.actions";
import type { Slide } from "@/types/db.helpers";

const LAYOUTS = [
  "hook",
  "point",
  "contrast",
  "scenario",
  "question",
  "reveal",
  "cue",
] as const;

type SlideLayout = (typeof LAYOUTS)[number];

export function SlideEditorDrawer({
  classId,
  slide,
  open,
  onOpenChange,
  onSaved,
}: {
  classId: string;
  slide: Slide | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cue, setCue] = useState("");
  const [speakerNote, setSpeakerNote] = useState("");
  const [layout, setLayout] = useState<SlideLayout>("point");
  const [imagePrompt, setImagePrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preference, setPreference] = useState<"auto" | "pool" | "ai" | "none">("auto");
  const [imageBusy, setImageBusy] = useState(false);
  const [poolHint, setPoolHint] = useState<string | null>(null);

  useEffect(() => {
    if (!slide) return;
    setTitle(slide.title ?? "");
    setBody(slide.body ?? "");
    setCue(slide.cue ?? "");
    setSpeakerNote(slide.speaker_note ?? "");
    setLayout((slide.layout as SlideLayout | null) ?? "point");
    setImagePrompt(slide.image_prompt ?? "");
    setPreference((slide.image_preference as typeof preference | undefined) ?? "auto");
    setPreviewUrl(null);
    setPoolHint(null);
    setError(null);
    void fetch(`/api/slides/${slide.id}/image`)
      .then((response) => response.json())
      .then((json: { url?: string | null; preference?: typeof preference; poolHint?: string | null }) => {
        if (json.url) setPreviewUrl(json.url);
        if (json.preference) setPreference(json.preference);
        setPoolHint(json.poolHint ?? null);
      })
      .catch(() => undefined);
  }, [slide]);

  function save() {
    if (!slide) return;
    startTransition(async () => {
      const result = await updateSlideAction({
        slideId: slide.id,
        classId,
        title,
        body,
        cue,
        speaker_note: speakerNote,
        layout,
        image_prompt: imagePrompt,
        image_preference: preference,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit slide</SheetTitle>
          <SheetDescription>
            Speaker notes, layout, and optional AI background. Generate an image from the prompt, or keep the curated pool / gradient.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slide-title">Title</Label>
            <Input
              id="slide-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-body">Body</Label>
            <Textarea
              id="slide-body"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-cue">Cue</Label>
            <Input
              id="slide-cue"
              value={cue}
              onChange={(event) => setCue(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-note">Speaker note</Label>
            <Textarea
              id="slide-note"
              rows={4}
              value={speakerNote}
              onChange={(event) => setSpeakerNote(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-layout">Layout</Label>
            <select
              id="slide-layout"
              value={layout}
              onChange={(event) => setLayout(event.target.value as SlideLayout)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-ivory"
            >
              {LAYOUTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-image-prompt">Image prompt</Label>
            <Textarea
              id="slide-image-prompt"
              rows={3}
              value={imagePrompt}
              onChange={(event) => setImagePrompt(event.target.value)}
            />
          </div>
          <div className="space-y-3 border border-white/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Slide image</p>
            <div className="aspect-video overflow-hidden bg-navy">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-ivory/40">
                  Gradient fallback (no image)
                </p>
              )}
            </div>
            {poolHint ? (
              <p className="text-xs text-ivory/50" data-pool-hint="true">
                {poolHint}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(["auto", "pool", "ai", "none"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={preference === value ? "default" : "outline"}
                  onClick={() => {
                    setPreference(value);
                    if (!slide) return;
                    if (value === "none") {
                      setPreviewUrl(null);
                      void fetch(`/api/slides/${slide.id}/image`, { method: "DELETE" });
                      return;
                    }
                    void fetch(`/api/slides/${slide.id}/image`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ preference: value }),
                    });
                  }}
                >
                  {value === "auto"
                    ? "Auto"
                    : value === "pool"
                      ? "Use curated pool"
                      : value === "ai"
                        ? "Use AI image"
                        : "Use none"}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={imageBusy || !slide}
              onClick={() => {
                if (!slide) return;
                setImageBusy(true);
                void fetch(`/api/slides/${slide.id}/generate-image`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt: imagePrompt }),
                })
                  .then(async (response) => {
                    const json = (await response.json()) as { url?: string; error?: string };
                    if (!response.ok) throw new Error(json.error ?? "Generation failed");
                    if (json.url) setPreviewUrl(json.url);
                  })
                  .catch((caught: unknown) =>
                    setError(caught instanceof Error ? caught.message : "Generation failed"),
                  )
                  .finally(() => setImageBusy(false));
              }}
            >
              {imageBusy ? "Generating…" : "Generate AI image"}
            </Button>
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save slide"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
