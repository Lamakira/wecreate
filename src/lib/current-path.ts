/**
 * Whether a navigation destination is the page the visitor is currently on.
 *
 * `/` only matches itself; every other entry also matches its sub-pages, so a
 * Portfolio Project detail page still marks Portfolio as current.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
