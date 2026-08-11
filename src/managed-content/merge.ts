/**
 * A recursively optional view of `T`, with `null` allowed wherever `T` allows
 * it. Content arriving from a CMS is always partial: a fresh dataset has no
 * documents at all, and an editor may have filled in only some fields.
 */
export type DeepPartial<T> = T extends Array<infer Item>
  ? Array<Item>
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Overlay `patch` onto `base`, recursing into plain objects.
 *
 * Arrays replace wholesale rather than merging element-wise: an editor who
 * removes a navigation link means to remove it, not to keep a stale entry from
 * the defaults. `undefined` and `null` values in `patch` are treated as absent
 * so an unfilled CMS field falls back to the baseline instead of blanking the
 * page.
 */
export function mergeContent<T>(base: T, patch: DeepPartial<T> | undefined | null): T {
  if (patch === undefined || patch === null) {
    return base;
  }

  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      continue;
    }
    merged[key] = mergeContent(
      (base as Record<string, unknown>)[key],
      value as DeepPartial<unknown>,
    );
  }

  return merged as T;
}
