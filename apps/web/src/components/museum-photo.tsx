import { getImageProps, type StaticImageData } from "next/image";

/** Optimized image markup on the server; one delegated error handler per museum. */
export default function MuseumPhoto({ src, alt, className, sizes = "100vw", preload = false }: {
  src: StaticImageData | string; alt: string; className?: string; sizes?: string; preload?: boolean;
}) {
  const { props } = getImageProps({ src, alt, fill: true, sizes,
    unoptimized: typeof src === "string", loading: preload ? "eager" : "lazy",
    fetchPriority: preload ? "high" : "auto", className,
  });
  return <span className="museum-photo">
    {preload ? <link rel="preload" as="image" imageSrcSet={props.srcSet} imageSizes={props.sizes} fetchPriority="high" /> : null}
    {/* getImageProps supplies responsive optimized URLs without image state/hydration. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img {...props} />
    <span className="photo-fallback" role="img" aria-label={alt}>
      La fotografía no está disponible.<br />La historia continúa.
    </span>
  </span>;
}
