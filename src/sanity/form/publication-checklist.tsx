import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";
import { ErrorOutlineIcon } from "@sanity/icons/ErrorOutline";
import { WarningOutlineIcon } from "@sanity/icons/WarningOutline";
import { Box, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import {
  useFormCallbacks,
  useFormValue,
  useValidationStatus,
  type FieldProps,
  type InputProps,
  type ObjectSchemaType,
  type Path,
  type SchemaType,
} from "sanity";

/**
 * A global form input, registered in `sanity.config.ts`. It renders every input
 * exactly as Sanity would, and puts one extra panel above the document root.
 *
 * Sanity already marks invalid fields, but only inside their own tab and only
 * once an editor scrolls to them. On a document with several field groups an
 * editor can press Publish, be refused, and have no idea which of the other
 * tabs holds the reason. The panel lists what is missing in one place, in
 * French, and takes the editor to the field.
 */
export function PublicationChecklistInput(props: InputProps) {
  return (
    <>
      {props.path.length === 0 ? (
        <PublicationChecklist schemaType={props.schemaType} />
      ) : null}
      {props.renderDefault(props)}
    </>
  );
}

/**
 * A global field wrapper, registered next to the input. It marks every field
 * with its path so the panel can find it on the page.
 *
 * Moving the cursor into a field is up to that field's input, and some never
 * take it: the Mux video input, for one, ignores Sanity's focus request, so a
 * click on « Vidéo » would open the right tab and leave the editor looking for
 * the field. With the mark, the panel scrolls to the field and highlights it
 * whether or not its input accepts focus.
 */
export function PublicationChecklistField(props: FieldProps) {
  return (
    <div data-checklist-path={pathKey(props.path)}>
      {props.renderDefault(props)}
    </div>
  );
}

const pathKey = (path: Path) => JSON.stringify(path);

/**
 * Scrolls to the field at `path`, or to the closest enclosing field that is on
 * the page (an array item's fields only render once the item is opened).
 * Retries for a few frames: a tab that was just selected renders on the next
 * pass, not synchronously.
 */
function revealField(path: Path, attemptsLeft = 10) {
  for (let length = path.length; length > 0; length--) {
    const field = document.querySelector<HTMLElement>(
      `[data-checklist-path="${CSS.escape(pathKey(path.slice(0, length)))}"]`,
    );
    if (!field) continue;
    field.scrollIntoView({ block: "center" });
    field.animate(
      [
        { boxShadow: "0 0 0 2px var(--card-focus-ring-color, #2276fc)" },
        { boxShadow: "0 0 0 2px transparent" },
      ],
      { duration: 1600, easing: "ease-out" },
    );
    return;
  }
  if (attemptsLeft > 0)
    requestAnimationFrame(() => revealField(path, attemptsLeft - 1));
}

type Entry = {
  key: string;
  path: Path;
  level: "error" | "warning";
  label: string;
  message: string;
  group: string | undefined;
};

function PublicationChecklist({ schemaType }: { schemaType: SchemaType }) {
  const documentId = useFormValue(["_id"]);
  const value = useFormValue([]);
  const { onFieldGroupSelect, onPathFocus } = useFormCallbacks();
  // The form itself validates against the id it holds (`value._id`, the draft
  // when there is one), so the panel and the field markers always agree.
  const { isValidating, validation } = useValidationStatus(
    typeof documentId === "string" ? documentId : "",
    schemaType.name,
    true,
  );

  // Validation re-runs on every keystroke; showing nothing meanwhile avoids a
  // panel that blinks between "all good" and the real list.
  if (isValidating) return null;

  const entries = buildEntries(schemaType, value, validation);
  const errors = entries.filter((entry) => entry.level === "error");
  const warnings = entries.filter((entry) => entry.level === "warning");

  if (entries.length === 0) {
    return (
      <Box marginBottom={4}>
        <Flex align="center" gap={2}>
          <Text size={1} muted>
            <CheckmarkCircleIcon />
          </Text>
          <Text size={1} muted>
            Tout est rempli : ce document peut être publié.
          </Text>
        </Flex>
      </Box>
    );
  }

  const goTo = (entry: Entry) => {
    if (entry.group) onFieldGroupSelect([], entry.group);
    // The field only exists in the DOM once its tab has rendered.
    setTimeout(() => {
      onPathFocus(entry.path);
      revealField(entry.path);
    }, 0);
  };

  return (
    <Stack space={3} marginBottom={4}>
      {errors.length > 0 ? (
        <Card padding={3} radius={2} border tone="critical">
          <Stack space={3}>
            <Text size={1} weight="semibold">
              {errors.length === 1
                ? "Il manque encore 1 élément pour publier"
                : `Il manque encore ${errors.length} éléments pour publier`}
            </Text>
            <Text size={1} muted>
              À compléter avant de publier
            </Text>
            <EntryList entries={errors} onSelect={goTo} />
          </Stack>
        </Card>
      ) : null}
      {warnings.length > 0 ? (
        <Card padding={3} radius={2} border tone="caution">
          <Stack space={3}>
            <Text size={1} weight="semibold">
              À vérifier
            </Text>
            <EntryList entries={warnings} onSelect={goTo} />
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}

function EntryList({
  entries,
  onSelect,
}: {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
}) {
  return (
    <Stack space={1}>
      {entries.map((entry) => (
        <Button
          key={entry.key}
          mode="bleed"
          tone={entry.level === "error" ? "critical" : "caution"}
          icon={entry.level === "error" ? ErrorOutlineIcon : WarningOutlineIcon}
          justify="flex-start"
          padding={2}
          onClick={() => onSelect(entry)}
          text={`${entry.label} : ${entry.message}`}
        />
      ))}
    </Stack>
  );
}

function buildEntries(
  rootType: SchemaType,
  rootValue: unknown,
  markers: ReadonlyArray<{ level: string; message: string; path: Path }>,
): Entry[] {
  // One entry per path, and an error outranks a warning on the same field.
  const byPath = new Map<string, Entry>();
  for (const marker of markers) {
    if (marker.level !== "error" && marker.level !== "warning") continue;
    const key = JSON.stringify(marker.path);
    const existing = byPath.get(key);
    if (existing && (existing.level === "error" || marker.level === "warning"))
      continue;

    const { label, type, value } = resolve(rootType, rootValue, marker.path);
    byPath.set(key, {
      key,
      path: marker.path,
      level: marker.level,
      label: withGroupTitle(rootType, marker.path, label),
      // Sanity's own wording for a missing value is English ("Required"); the
      // custom rules are already written in French and pass through untouched.
      message: isEmpty(value, type) ? "Champ vide" : marker.message,
      group: groupOf(rootType, marker.path),
    });
  }
  return [...byPath.values()];
}

type Resolved = { label: string; type: SchemaType | undefined; value: unknown };

/**
 * Walks a marker path through the schema and the current value together, so
 * the label comes from the schema's French titles and array items can be named
 * by their position rather than by an opaque `_key`.
 */
function resolve(
  rootType: SchemaType,
  rootValue: unknown,
  path: Path,
): Resolved {
  const labels: string[] = [];
  let type: SchemaType | undefined = rootType;
  let value: unknown = rootValue;

  for (const segment of path) {
    if (typeof segment === "string") {
      const field: { name: string; type: SchemaType } | undefined =
        type && "fields" in type
          ? (type as ObjectSchemaType).fields.find((f) => f.name === segment)
          : undefined;
      labels.push(field?.type.title ?? segment);
      type = field?.type;
      value = isRecord(value) ? value[segment] : undefined;
      continue;
    }

    const items: unknown[] = Array.isArray(value) ? value : [];
    const index =
      typeof segment === "number"
        ? segment
        : typeof segment === "object" && "_key" in segment
          ? items.findIndex(
              (item) => isRecord(item) && item._key === segment._key,
            )
          : -1;
    labels.push(index >= 0 ? `n° ${index + 1}` : "n° ?");
    value = index >= 0 ? items[index] : undefined;

    const members: SchemaType[] =
      type && "of" in type ? (type.of as SchemaType[]) : [];
    const itemType = isRecord(value) ? value._type : undefined;
    type = members.find((member) => member.name === itemType) ?? members[0];
  }

  return { label: labels.join(" › ") || "Document", type, value };
}

function rootGroups(rootType: SchemaType) {
  return "groups" in rootType
    ? ((rootType as ObjectSchemaType).groups ?? [])
    : [];
}

function groupOf(rootType: SchemaType, path: Path): string | undefined {
  const top = path[0];
  if (typeof top !== "string" || !("fields" in rootType)) return undefined;
  const groups = rootGroups(rootType);
  if (groups.length === 0) return undefined;

  const declared = (rootType as ObjectSchemaType).fields.find(
    (field) => field.name === top,
  )?.group;
  const names =
    declared === undefined
      ? []
      : Array.isArray(declared)
        ? declared
        : [declared];
  const isDefault = (name: string) =>
    groups.find((group) => group.name === name)?.default;
  return names.find((name) => !isDefault(name)) ?? names[0];
}

function withGroupTitle(
  rootType: SchemaType,
  path: Path,
  label: string,
): string {
  const name = groupOf(rootType, path);
  const title = rootGroups(rootType).find(
    (group) => group.name === name,
  )?.title;
  return title ? `${label} (${title})` : label;
}

const ASSET_TYPES = new Set(["image", "file", "mux.video"]);

function isEmpty(value: unknown, type: SchemaType | undefined): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value) && type && ASSET_TYPES.has(type.name)) {
    const asset = value.asset;
    return !(isRecord(asset) && typeof asset._ref === "string");
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
