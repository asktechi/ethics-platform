"use client";

import { useEffect, useState } from "react";
import { generateAudienceQrDataUrl } from "@/lib/presentation/qr";

export function AudienceQr({
  url,
  size = 180,
  label = "Audience QR",
}: {
  url: string;
  size?: number;
  label?: string;
}) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    generateAudienceQrDataUrl(url)
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "QR failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">{label}</p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Audience QR code" className="mt-2 bg-ivory p-2" width={size} height={size} />
      ) : error ? (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      ) : (
        <div className="mt-2 h-40 w-40 animate-pulse bg-white/10" />
      )}
    </div>
  );
}
