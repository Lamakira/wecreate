"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Rendered element. Defaults to a `div`. */
  as?: "div" | "li";
}

/**
 * Fades content in once, the first time it scrolls into view.
 *
 * Decoration layered on content that is already there. The hidden start state
 * is applied to the DOM node from an effect rather than rendered on the server,
 * so a visitor without JavaScript — or one whose observer never fires — sees the
 * content immediately instead of a permanently blank section.
 *
 * It touches classes directly rather than going through React state: the fade
 * is a visual effect on one element with no bearing on what React renders, and
 * driving it through state would re-render every revealed element twice.
 */
export function Reveal({ children, className, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    element.classList.add("wc-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("wc-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
