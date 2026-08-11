import Image from "next/image";

import type { MediaFrameContent } from "@/managed-content/types";

const SURFACES = {
  /** Grey gradient on a dark section. */
  dark: "bg-[linear-gradient(140deg,#1A1A1A,#3A3A3A_50%,#0F0F0F)]",
  /** Slightly lighter variant used by the universe cards. */
  "dark-soft": "bg-[linear-gradient(150deg,#1A1A1A,#333_55%,#111)]",
  /** Grey gradient on a white section. */
  light: "bg-[linear-gradient(135deg,#EEE,#BBB_55%,#DDD)]",
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
  surface = "dark",
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
          className="font-mono text-micro tracking-18 text-wc-muted-2"
        >
          {media.placeholderLabel}
        </span>
      )}
    </div>
  );
}
