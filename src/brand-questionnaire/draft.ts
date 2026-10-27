/**
 * The questionnaire draft, kept in the client's own browser (issue #57).
 *
 * A questionnaire is five steps long and carries photographs. A client who
 * reloads the page, or whose phone discards the tab, should find it where they
 * left it rather than start again — so the answers, the step and the attached
 * files are written to IndexedDB on this device as they change.
 *
 * **This does not break "nothing is stored" (parent decision 3, #55).** WeCreate
 * stores nothing: the draft never leaves the client's browser, it is filed under
 * an opaque key that cannot be traced to a person, it is not sent anywhere until
 * the client presses *Envoyer*, and it is deleted the moment a send succeeds.
 * It is the browser's memory of what the client typed, the same as a form field
 * the browser would otherwise refill.
 *
 * **It must never be load-bearing.** IndexedDB is missing in some private
 * windows and throws in others, and a quota can run out mid-write. Every call
 * here resolves quietly in those cases, so the questionnaire still works — it
 * just does not survive a reload.
 *
 * Answers and files are separate records on purpose: answers change on every
 * keystroke and are tiny, files change only when one is added or removed and
 * can weigh megabytes, so a keystroke must never rewrite a photograph.
 *
 * Browser only: nothing here may run on the server.
 */
import {
  LAST_STEP,
  normalizeAnswers,
  type BrandAnswers,
  type StepIndex,
} from "@/brand-questionnaire/questions";

const DATABASE = "wecreate-questionnaire";
const STORE = "drafts";

interface AnswersRecord {
  step: number;
  answers: unknown;
}

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

interface FilesRecord {
  files: StoredFile[];
}

export interface Draft {
  step: StepIndex;
  answers: BrandAnswers;
  files: File[];
}

const answersKey = (draftKey: string) => `${draftKey}:answers`;
const filesKey = (draftKey: string) => `${draftKey}:files`;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB is blocked"));
  });
}

/** One transaction, closed afterwards; resolves with what `work` asked for. */
async function transact(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest[],
): Promise<unknown[]> {
  const database = await openDatabase();
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const requests = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(requests.map((r) => r.result));
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

function asStep(value: unknown): StepIndex {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= LAST_STEP
    ? (value as StepIndex)
    : 0;
}

/** The saved draft for this key, or nothing when there is none or none can be read. */
export async function loadDraft(draftKey: string): Promise<Draft | undefined> {
  try {
    const [storedAnswers, storedFiles] = await transact("readonly", (store) => [
      store.get(answersKey(draftKey)),
      store.get(filesKey(draftKey)),
    ]);
    const answersRecord = storedAnswers as AnswersRecord | undefined;
    const filesRecord = storedFiles as FilesRecord | undefined;
    if (!answersRecord && !filesRecord) return undefined;

    const files = (filesRecord?.files ?? []).flatMap((stored) =>
      stored && stored.blob instanceof Blob
        ? [
            new File([stored.blob], String(stored.name), {
              type: String(stored.type),
              lastModified: Number(stored.lastModified) || Date.now(),
            }),
          ]
        : [],
    );

    return {
      step: asStep(answersRecord?.step),
      answers: normalizeAnswers(answersRecord?.answers),
      files,
    };
  } catch {
    return undefined;
  }
}

/** Remember the answers and the step. Called on every change; cheap. */
export async function saveAnswers(
  draftKey: string,
  step: StepIndex,
  answers: BrandAnswers,
): Promise<void> {
  try {
    const record: AnswersRecord = { step, answers };
    await transact("readwrite", (store) => [
      store.put(record, answersKey(draftKey)),
    ]);
  } catch {
    // No storage, or no room: the questionnaire works without it.
  }
}

/** Remember the attached files. Called only when the list itself changes. */
export async function saveFiles(
  draftKey: string,
  files: readonly File[],
): Promise<void> {
  try {
    const record: FilesRecord = {
      files: files.map((file) => ({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        blob: file.slice(0, file.size, file.type),
      })),
    };
    await transact("readwrite", (store) => [
      store.put(record, filesKey(draftKey)),
    ]);
  } catch {
    // As above.
  }
}

/** Forget everything kept for this key: the answers have been sent. */
export async function clearDraft(draftKey: string): Promise<void> {
  try {
    await transact("readwrite", (store) => [
      store.delete(answersKey(draftKey)),
      store.delete(filesKey(draftKey)),
    ]);
  } catch {
    // As above.
  }
}
