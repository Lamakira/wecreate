import { expect, type Page } from "@playwright/test";

/** What the page tells a crawler, or `""` when it says nothing. */
export async function robotsMeta(page: Page): Promise<string> {
  const metas = page.locator('meta[name="robots"]');
  const count = await metas.count();
  if (count === 0) {
    return "";
  }
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await metas.nth(index).getAttribute("content")) ?? "");
  }
  return values.join(", ");
}

/** Every Schema.org graph the page emitted. */
export async function jsonLdGraphs(
  page: Page,
): Promise<Array<Record<string, unknown>>> {
  const scripts = page.locator('script[type="application/ld+json"]');
  const count = await scripts.count();
  const graphs: Array<Record<string, unknown>> = [];
  for (let index = 0; index < count; index += 1) {
    const text = (await scripts.nth(index).textContent()) ?? "{}";
    graphs.push(JSON.parse(text) as Record<string, unknown>);
  }
  return graphs;
}

export function graphOfType(
  graphs: Array<Record<string, unknown>>,
  type: string,
): Record<string, unknown> {
  const match = graphs.find((graph) => graph["@type"] === type);
  expect(match, `expected a ${type} graph`).toBeTruthy();
  return match!;
}
