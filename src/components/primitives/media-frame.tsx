import Image from "next/image";

import type { MediaFrameContent } from "@/managed-content/types";

const SURFACES = {
  /** Placeholder gradient on the ground. */
  ground: "bg-(image:--wc-placeholder)",
  /** Slightly lighter variant used by the universe cards. */
  "ground-soft": "bg-(image:--wc-placeholder-soft)",
  /** Placeholder gradient on an inverted band. */
  inverse: "bg-(image:--wc-placeholder-inverse)",
} as const;

interface MediaFrameProps {
  media: MediaFrameContent;
  surface?: keyof typeof SURFACES;
  sizes?: string;
  className?: string;
}

/**
 * A media slot that always reserves its declared aspect ratio.
 *
 * With a real image it renders one; without, it renders the labelled grey
 * placeholder from the design handoff. Either way the layout is identical, so
 * dropping in real media later cannot shift the page (and cannot cost us CLS).
 */
export function MediaFrame({
  media,
  surface = "ground",
  sizes = "(max-width: 768px) 100vw, 33vw",
  className,
}: MediaFrameProps) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${SURFACES[surface]} ${className ?? ""}`}
      style={{ aspectRatio: media.ratio }}
    >
      {media.imageUrl ? (
        <Image
          src={media.imageUrl}
          alt={media.alternativeText}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono text-micro tracking-18 text-wc-text-muted"
        >
          {media.placeholderLabel}
        </span>
      )}
    </div>
  );
}
