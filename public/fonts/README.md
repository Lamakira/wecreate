# Brand typefaces

The two typefaces the approved design specifies, self-hosted so no third party
sits on the critical path of a Benin mobile connection.

| File                                     | Family           | Style   | Weights | Subset     |
| ---------------------------------------- | ---------------- | ------- | ------- | ---------- |
| `inter-latin.woff2`                      | Inter            | normal  | 300–700 | latin      |
| `inter-latin-ext.woff2`                  | Inter            | normal  | 300–700 | latin-ext  |
| `playfair-display-latin.woff2`           | Playfair Display | normal  | 400–700 | latin      |
| `playfair-display-latin-ext.woff2`       | Playfair Display | normal  | 400–700 | latin-ext  |
| `playfair-display-italic-latin.woff2`    | Playfair Display | italic  | 400–700 | latin      |
| `playfair-display-italic-latin-ext.woff2`| Playfair Display | italic  | 400–700 | latin-ext  |

All six are variable fonts, so one file covers every weight the design uses.

French is fully served by the `latin` subset — it includes `Œ`/`œ` (U+0152–0153)
along with every accented character the copy needs. `latin-ext` is declared with
its own `unicode-range` and is only downloaded if a page actually contains a
character outside `latin`.

## Licence

Both families are released under the SIL Open Font License 1.1, which permits
redistribution as part of this application. Retrieved from Google Fonts:

- Inter — https://fonts.google.com/specimen/Inter
- Playfair Display — https://fonts.google.com/specimen/Playfair+Display

## How they are loaded

`@font-face` declarations live in `src/app/globals.css` beside the design
tokens. Two rules matter:

- **`font-display: swap`** — text paints immediately in the fallback face and
  is re-rendered when the woff2 arrives. Nothing is ever invisible while a font
  loads.
- **A real fallback stack** — every `font-family` token names system faces after
  the brand ones. If these files are ever missing or blocked, the site renders in
  a documented fallback rather than breaking.

The two `latin` files are preloaded from the root layout so they are fetched in
parallel with the HTML instead of after the stylesheet resolves.

## Replacing them

If WeCreate licenses different production font files, drop the woff2 files here
under the same names and keep the `unicode-range` declarations in `globals.css`
in step with whatever the new files are subset to. Nothing else changes.
