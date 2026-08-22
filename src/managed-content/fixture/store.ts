import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_SITE_CONTENT } from "../default-content";
import { mergeContent, type DeepPartial } from "../merge";
import type { ContentPerspective, SiteContent } from "../types";

/**
 * The fixture provider's storage: a JSON file holding both revisions of
 * Managed Content.
 *
 * It is file-backed rather than in-memory so an acceptance test in one process
 * can seed or publish content that the application server in another process
 * then reads — the same separation the real Sanity dataset has.
 */
export interface FixtureDataset {
  published: SiteContent;
  drafts: SiteContent;
}

function datasetPath(): string {
  return (
    process.env.WECREATE_FIXTURE_FILE ??
    path.join(process.cwd(), ".wecreate", "fixture-content.json")
  );
}

function initialDataset(): FixtureDataset {
  return {
    published: structuredClone(DEFAULT_SITE_CONTENT),
    drafts: structuredClone(DEFAULT_SITE_CONTENT),
  };
}

/*
 * The `turbopackIgnore` comments below stop the bundler tracing this dynamic
 * path, which it would otherwise resolve by including the entire project —
 * every source file and the whole public folder — in the server bundle. Nothing
 * needs tracing here: the fixture file is created at run time by a development
 * or acceptance-test run and is never part of a production deployment.
 */

export async function readFixtureDataset(): Promise<FixtureDataset> {
  let stored: Partial<FixtureDataset>;
  try {
    const raw = await readFile(/* turbopackIgnore: true */ datasetPath(), "utf8");
    stored = JSON.parse(raw) as Partial<FixtureDataset>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return initialDataset();
    }
    throw error;
  }

  // Overlay what is on disk onto the baseline rather than trusting it whole.
  // The file outlives the code that wrote it — a checkout that changes the
  // content model would otherwise read a file missing the new fields and render
  // `undefined` deep inside a component.
  return {
    published: mergeContent(
      DEFAULT_SITE_CONTENT,
      stored.published as DeepPartial<SiteContent>,
    ),
    drafts: mergeContent(
      DEFAULT_SITE_CONTENT,
      stored.drafts as DeepPartial<SiteContent>,
    ),
  };
}

export async function writeFixtureDataset(
  dataset: FixtureDataset,
): Promise<void> {
  const file = datasetPath();
  await mkdir(/* turbopackIgnore: true */ path.dirname(file), { recursive: true });

  // Write to a sibling and rename into place. Rename is atomic within a
  // filesystem, so a page rendering concurrently with an edit either sees the
  // whole previous dataset or the whole new one — never a half-written file.
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporary,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8",
  );
  await rename(/* turbopackIgnore: true */ temporary, file);
}

/** Return the dataset to the shipped baseline. */
export async function resetFixtureDataset(): Promise<FixtureDataset> {
  const dataset = initialDataset();
  await writeFixtureDataset(dataset);
  return dataset;
}

/**
 * Edit the draft revision, leaving the published revision untouched. This is
 * the fixture equivalent of an editor typing into the Studio without pressing
 * publish.
 */
export async function patchFixtureDrafts(
  patch: DeepPartial<SiteContent>,
): Promise<FixtureDataset> {
  const dataset = await readFixtureDataset();
  const updated: FixtureDataset = {
    published: dataset.published,
    drafts: mergeContent(dataset.drafts, patch),
  };
  await writeFixtureDataset(updated);
  return updated;
}

/**
 * Promote the draft revision to published. The fixture equivalent of pressing
 * publish in the Studio; the caller is responsible for the cache revalidation
 * that a real publish webhook would trigger.
 */
export async function publishFixtureDrafts(): Promise<FixtureDataset> {
  const dataset = await readFixtureDataset();
  const updated: FixtureDataset = {
    published: structuredClone(dataset.drafts),
    drafts: dataset.drafts,
  };
  await writeFixtureDataset(updated);
  return updated;
}

/**
 * How many times the fixture has been read.
 *
 * File-backed for the same reason the dataset is: a `"use cache"` fill and
 * the test-hook route are not guaranteed to share a module instance, and
 * the acceptance suite observes cache hits through these numbers.
 */
export interface FixtureReadActivity {
  publishedReads: number;
  draftReads: number;
}

const EMPTY_ACTIVITY: FixtureReadActivity = {
  publishedReads: 0,
  draftReads: 0,
};

function activityPath(): string {
  const file = datasetPath();
  return file.endsWith(".json")
    ? `${file.slice(0, -".json".length)}.activity.json`
    : `${file}.activity.json`;
}

async function readActivity(): Promise<FixtureReadActivity> {
  try {
    const raw = await readFile(
      /* turbopackIgnore: true */ activityPath(),
      "utf8",
    );
    const stored = JSON.parse(raw) as Partial<FixtureReadActivity>;
    return {
      publishedReads: Number(stored.publishedReads) || 0,
      draftReads: Number(stored.draftReads) || 0,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...EMPTY_ACTIVITY };
    }
    throw error;
  }
}

async function writeActivity(activity: FixtureReadActivity): Promise<void> {
  const file = activityPath();
  await mkdir(/* turbopackIgnore: true */ path.dirname(file), {
    recursive: true,
  });
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporary,
    `${JSON.stringify(activity)}\n`,
    "utf8",
  );
  await rename(/* turbopackIgnore: true */ temporary, file);
}

export async function recordFixtureRead(
  perspective: ContentPerspective,
): Promise<void> {
  const activity = await readActivity();
  if (perspective === "published") {
    activity.publishedReads += 1;
  } else {
    activity.draftReads += 1;
  }
  await writeActivity(activity);
}

export async function fixtureReadActivity(): Promise<FixtureReadActivity> {
  return readActivity();
}

export async function resetFixtureReadActivity(): Promise<void> {
  await writeActivity({ ...EMPTY_ACTIVITY });
}
