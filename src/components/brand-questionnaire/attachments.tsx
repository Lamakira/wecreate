import type { ChangeEvent } from "react";

import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_REFUSAL_MESSAGES,
  attachmentRefusal,
  type AttachmentRefusal,
} from "@/brand-questionnaire/questions";
import { CAPTION } from "@/components/brand-questionnaire/fields";

/** "12 Ko" under a megabyte, "2,4 Mo" above it. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })} Mo`;
}

/**
 * The file question: the picker, what it refused, and what is attached.
 *
 * A pick is judged as a whole against the files already attached, before
 * anything is added: if it would cross a cap, none of it is kept and the client
 * is told why, so the list never holds a file the server would then refuse.
 */
export function Attachments({
  files,
  refusal,
  onFiles,
  onRefusal,
}: {
  files: readonly File[];
  refusal: AttachmentRefusal | null;
  onFiles: (files: File[]) => void;
  onRefusal: (refusal: AttachmentRefusal | null) => void;
}) {
  function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Cleared either way, so the same file can be chosen again after a refusal.
    event.target.value = "";
    if (picked.length === 0) return;
    const reason = attachmentRefusal([...files, ...picked]);
    if (reason) {
      onRefusal(reason);
      return;
    }
    onRefusal(null);
    onFiles([...files, ...picked]);
  }

  return (
    <div>
      <label htmlFor="q-attachments" className={`block ${CAPTION}`}>
        Inspirations · logo actuel, images, captures
      </label>
      <input
        id="q-attachments"
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        aria-describedby="hint-attachments"
        onChange={pick}
        className="mt-2.5 block w-full border border-dashed border-wc-muted-on-light px-4 py-4 text-body-sm font-light text-wc-ink file:mr-4 file:border-0 file:bg-wc-pure file:px-4 file:py-2 file:text-micro file:font-semibold file:tracking-18 file:text-wc-white file:uppercase"
      />
      <p
        id="hint-attachments"
        className="m-0 mt-2 text-body-sm font-light text-wc-muted-on-light"
      >
        Jusqu&apos;à 5 fichiers, 10 Mo au total. Images ou PDF.
      </p>
      {refusal ? (
        <p
          role="alert"
          data-testid="attachment-error"
          className="m-0 mt-2 text-body-sm font-semibold text-wc-error"
        >
          {ATTACHMENT_REFUSAL_MESSAGES[refusal]}
        </p>
      ) : null}
      {files.length > 0 ? (
        <ul
          data-testid="attachment-list"
          className="m-0 mt-3 flex list-none flex-col gap-2 p-0"
        >
          {files.map((file, index) => (
            <li
              key={`${index}-${file.name}-${file.lastModified}`}
              className="flex items-center justify-between gap-3 border border-wc-line-light px-4 py-2.5 text-body-sm"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {`${file.name} · ${formatFileSize(file.size)}`}
              </span>
              <button
                type="button"
                aria-label={`Retirer ${file.name}`}
                onClick={() => {
                  onRefusal(null);
                  onFiles(files.filter((_, at) => at !== index));
                }}
                className="shrink-0 border-b border-wc-muted-on-light text-body-sm text-wc-pure"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
