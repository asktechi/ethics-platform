"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { searchUnsplashAction } from "@/app/(app)/_actions/theme.actions";
import { UnsplashGrid } from "@/components/theme/UnsplashGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UnsplashImage } from "@/lib/integrations/unsplash.types";

type ImageTab = "none" | "pool" | "ai";

type PendingPreview = {
  imageId: string;
  url: string;
};

export function SlideImageTabs({
  slideId,
  imagePrompt,
  onImagePromptChange,
  preference,
  onPreferenceChange,
}: {
  slideId: string;
  imagePrompt: string;
  onImagePromptChange: (value: string) => void;
  preference: ImageTab;
  onPreferenceChange: (value: ImageTab) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [stockUrl, setStockUrl] = useState<string | null>(null);
  const [stockAttribution, setStockAttribution] = useState<string | null>(null);
  const [preview, setPreview] = useState<PendingPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(imagePrompt);
  const [results, setResults] = useState<UnsplashImage[]>([]);
  const [monthSpend, setMonthSpend] = useState(0);
  const [monthCap, setMonthCap] = useState(5);
  const [costEach, setCostEach] = useState(0.04);
  const [model, setModel] = useState("gpt-image-1");
  const [poolHint, setPoolHint] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/slides/${slideId}/image`)
      .then((response) => response.json())
      .then(
        (json: {
          url?: string | null;
          pending?: { imageId: string; url: string } | null;
          preference?: ImageTab;
          prompt?: string;
          stockUrl?: string | null;
          stockAttribution?: string | null;
          monthSpend?: number;
          monthCap?: number;
          costEach?: number;
          model?: string;
          poolHint?: string | null;
          error?: string;
        }) => {
          if (json.error) return;
          setAttachedUrl(json.url ?? null);
          setPreview(json.pending ?? null);
          setStockUrl(json.stockUrl ?? null);
          setStockAttribution(json.stockAttribution ?? null);
          setMonthSpend(json.monthSpend ?? 0);
          setMonthCap(json.monthCap ?? 5);
          setCostEach(json.costEach ?? 0.04);
          setModel(json.model ?? "gpt-image-1");
          setPoolHint(json.poolHint ?? null);
          if (json.preference === "pool" || json.preference === "ai" || json.preference === "none") {
            onPreferenceChange(json.preference);
          }
          if (json.prompt && !imagePrompt) onImagePromptChange(json.prompt);
          if (json.prompt && !query) setQuery(json.prompt);
        },
      )
      .catch(() => undefined);
    // Load once per slide; parent owns prompt edits after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (stockUrl) {
      const hit = results.find((item) => item.url === stockUrl);
      if (hit) ids.add(hit.id);
    }
    return ids;
  }, [results, stockUrl]);

  function setTab(next: ImageTab) {
    onPreferenceChange(next);
    void fetch(`/api/slides/${slideId}/image`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference: next }),
    }).catch(() => undefined);
  }

  function searchStock() {
    startTransition(async () => {
      const result = await searchUnsplashAction({
        query: query.trim() || imagePrompt.trim() || "professional ethics",
        count: 24,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setResults(result.images);
    });
  }

  async function pickStock(image: UnsplashImage) {
    setBusy(true);
    setError(null);
    try {
      const attribution = `${image.photographer} / Unsplash`;
      const response = await fetch(`/api/slides/${slideId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stock",
          stock_image_url: image.url,
          stock_attribution: attribution,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save stock photo");
      setStockUrl(image.url);
      setStockAttribution(attribution);
      onPreferenceChange("pool");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save stock photo");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setConfirmOpen(false);
    try {
      const response = await fetch(`/api/slides/${slideId}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, confirm: true, attach: false }),
      });
      const json = (await response.json()) as {
        imageId?: string;
        url?: string;
        error?: string;
        monthSpend?: number;
      };
      if (!response.ok) throw new Error(json.error ?? "Generation failed");
      if (json.imageId && json.url) setPreview({ imageId: json.imageId, url: json.url });
      if (typeof json.monthSpend === "number") setMonthSpend(json.monthSpend);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyPreview() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/slides/${slideId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", imageId: preview.imageId }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not attach image");
      setAttachedUrl(preview.url);
      setPreview(null);
      onPreferenceChange("ai");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach image");
    } finally {
      setBusy(false);
    }
  }

  async function discardPreview() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/slides/${slideId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard", imageId: preview.imageId }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not discard image");
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not discard image");
    } finally {
      setBusy(false);
    }
  }

  const overCap = monthSpend + costEach > monthCap + 1e-9;

  return (
    <div className="space-y-3 border border-white/10 p-3" data-slide-image-tabs="true">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Slide image</p>
      <Tabs
        value={preference}
        onValueChange={(value) => setTab(value as ImageTab)}
      >
        <TabsList className="grid h-auto w-full grid-cols-3 bg-transparent">
          <TabsTrigger value="none" data-image-tab="none">
            No image
          </TabsTrigger>
          <TabsTrigger value="pool" data-image-tab="stock">
            Stock photo
          </TabsTrigger>
          <TabsTrigger value="ai" data-image-tab="ai">
            AI generated
          </TabsTrigger>
        </TabsList>

        <TabsContent value="none" className="mt-4 space-y-3">
          <div
            className="aspect-video overflow-hidden"
            data-gradient-preview="true"
            style={{
              background:
                "linear-gradient(148deg, #071018 0%, #0B1B2B 42%, #16324a 68%, #C9A22744 100%)",
              boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)",
            }}
          >
            <p className="flex h-full items-center justify-center text-xs uppercase tracking-[0.16em] text-ivory/70">
              Using theme gradient
            </p>
          </div>
          <p className="text-xs text-ivory/55">
            This slide presents on the designed theme gradient. No photo is required.
          </p>
        </TabsContent>

        <TabsContent value="pool" className="mt-4 space-y-3">
          {stockUrl ? (
            <div className="aspect-video overflow-hidden bg-navy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stockUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div
              className="aspect-video overflow-hidden"
              style={{
                background:
                  "linear-gradient(148deg, #071018 0%, #0B1B2B 46%, #C9A22733 100%)",
              }}
            >
              <p className="flex h-full items-center justify-center text-xs text-ivory/55">
                Using theme gradient until you pick a photo
              </p>
            </div>
          )}
          {stockAttribution ? (
            <p className="text-xs text-ivory/50">{stockAttribution}</p>
          ) : null}
          {poolHint ? (
            <p className="text-xs text-ivory/50" data-pool-hint="true">
              {poolHint}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Unsplash"
              aria-label="Stock photo search"
            />
            <Button type="button" variant="outline" disabled={pending} onClick={searchStock}>
              {pending ? "Searching…" : "Search"}
            </Button>
          </div>
          <UnsplashGrid images={results} selectedIds={selectedIds} onToggle={pickStock} />
          <p className="text-xs text-ivory/45">Unsplash is free. Picking a photo attaches it to this slide only.</p>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="slide-image-prompt">Prompt</Label>
            <Textarea
              id="slide-image-prompt"
              rows={3}
              value={imagePrompt}
              onChange={(event) => onImagePromptChange(event.target.value)}
            />
          </div>
          {preview ? (
            <div className="space-y-3" data-ai-preview="true">
              <div className="aspect-video overflow-hidden bg-navy">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-ivory/55">
                Stored, not attached. The slide still uses the theme gradient until you use this image.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void applyPreview()}>
                  Use this image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || overCap}
                  onClick={() => setConfirmOpen(true)}
                >
                  {`Regenerate (another $${costEach.toFixed(2)})`}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void discardPreview()}>
                  Discard
                </Button>
              </div>
            </div>
          ) : attachedUrl && preference === "ai" ? (
            <div className="aspect-video overflow-hidden bg-navy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachedUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div
              className="aspect-video overflow-hidden"
              style={{
                background:
                  "linear-gradient(148deg, #071018 0%, #0B1B2B 46%, #C9A22733 100%)",
              }}
            >
              <p className="flex h-full items-center justify-center text-xs text-ivory/55">
                Using theme gradient
              </p>
            </div>
          )}
          {!preview ? (
            <Button type="button" variant="outline" disabled={busy || overCap} onClick={() => setConfirmOpen(true)}>
              {busy ? "Generating…" : "Generate image"}
            </Button>
          ) : null}
          {overCap ? (
            <p className="text-sm text-amber-200" data-ai-cap="true">
              AI image budget reached for this class this month. Use stock photos or raise the cap.
            </p>
          ) : (
            <p className="text-xs text-ivory/45">
              gpt-image-1 · ~${costEach.toFixed(2)} each · this month ${monthSpend.toFixed(2)} / $
              {monthCap.toFixed(2)}
            </p>
          )}
        </TabsContent>
      </Tabs>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="z-[200]" data-ai-cost-confirm="true">
          <DialogHeader>
            <DialogTitle>Generate AI image for this slide?</DialogTitle>
            <DialogDescription>
              One image. Nothing is attached until you click Use this image.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm text-ivory/80">
            <li>Model: {model}</li>
            <li>Cost: ~${costEach.toFixed(2)} (USD)</li>
            <li>Estimated time: ~15-30 seconds</li>
            <li>Running total this month: ${monthSpend.toFixed(2)}</li>
          </ul>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setTab("pool");
                setQuery(imagePrompt || query);
              }}
            >
              Try free stock photo first
            </Button>
            <Button type="button" disabled={busy || overCap} onClick={() => void generate()}>
              {`Generate AI image ($${costEach.toFixed(2)})`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
