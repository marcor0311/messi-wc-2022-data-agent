"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

export default function MuseumPhoto({ src, alt, className, sizes = "100vw", preload = false }: {
  src: StaticImageData | string; alt: string; className?: string; sizes?: string; preload?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`photo-fallback ${className ?? ""}`} role="img" aria-label={alt}>
    <span>La fotografía no está disponible.<br />La historia continúa.</span>
  </div>;
  return <Image src={src} alt={alt} fill sizes={sizes} preload={preload}
    placeholder={typeof src === "string" ? "empty" : "blur"} unoptimized={typeof src === "string"}
    className={className} onError={() => setFailed(true)} />;
}
