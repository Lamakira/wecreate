import type { ReactNode } from "react";

interface LegalNoticeProps {
  /** What a test looks this notice up by. */
  testId: string;
  /** The opening phrase, set in white: what kind of notice this is. */
  label: string;
  children: ReactNode;
}

/**
 * A bordered aside above a legal text, saying something about the text rather
 * than being part of it.
 *
 * Three of them exist and they must not drift apart: a visitor scanning a legal
 * page reads the boxes before the prose, and a box that sits differently from
 * its neighbours reads as a different kind of statement than it is.
 */
export function LegalNotice({ testId, label, children }: LegalNoticeProps) {
  return (
    <p
      data-testid={testId}
      className="m-0 border border-wc-border p-5 text-body-sm font-light text-wc-soft"
    >
      <strong className="font-semibold text-wc-white">{label}</strong>{" "}
      {children}
    </p>
  );
}
