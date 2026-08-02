# NEXUS brand system

NEXUS is a competitive chess product built around clarity, precision, and visible progression. The identity should feel premium and analytical without becoming cold or visually noisy.

## Identity

- **Product name:** NEXUS Chess
- **Primary line:** Play. Think. Evolve.
- **Short name:** NEXUS
- **Mark:** crowned `N` monogram in an inset rounded square
- **Core idea:** the crown represents mastery; the `N` and connected geometry represent players, positions, and analysis meeting in one place

Always write the product name as `NEXUS Chess` in prose. Use `NEXUS` alone only when space is limited or the chess context is already obvious.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Nexus lime | `#c7f64b` | Primary action, selected state, analysis signal |
| Canvas | `#080a08` | Main product background |
| Mark black | `#0b0e0b` | Logo ground and high-contrast surfaces |
| Ink | `#f3f4ec` | Primary text and ivory-piece reference |
| Graphite | `#151915` | Panels and secondary surfaces |
| Signal blue | `#77a8ff` | Online, data, and secondary analysis accents |

Lime is an indicator, not a page background. Reserve it for high-value actions, current selections, engine data, and the brand mark.

## Typography and voice

- **Product UI:** Geist Sans
- **Data, clocks, and labels:** Geist Mono
- **Voice:** direct, composed, specific, encouraging
- Prefer `Depth 18 · 3 lines` over vague copy such as `Powerful analysis`.
- Prefer `You make the first move` over `White selected`.
- Never claim a bot rating or engine result that the software does not enforce.

## Asset inventory

| Asset | Use |
| --- | --- |
| `public/brand/nexus-mark.svg` | Canonical app mark, favicon, manifest icon, repository avatar |
| `app/icon.svg` | Framework-managed application icon using the canonical mark |
| `public/brand/nexus-social-card.png` | Open Graph, social sharing, and primary repository preview |
| `public/brand/nexus-arena-showcase.png` | Product storytelling, repository showcase, release presentation |

The social card and showcase artwork are source-controlled release assets. Do not replace them with generic chess photography or unrelated starter graphics.

## Mark usage

- Keep clear space equal to at least one quarter of the mark width.
- Use the full square mark at 24 px or larger.
- Do not rotate, stretch, recolor individual paths, add unrelated gradients, or detach the crown.
- On dark surfaces use the canonical black-and-lime artwork.
- When a monochrome treatment is required, preserve the mark silhouette and strong contrast.

## Product imagery

NEXUS imagery should show recognizable chess pieces, one standard 8×8 board, disciplined composition, graphite/ivory materials, and restrained lime analysis light. Avoid fantasy battles, neon overload, fake text, multiple boards, and distorted chess geometry.

The current arena showcase was generated specifically for this repository with the built-in image generation workflow, then checked into `public/brand/` so builds and documentation remain reproducible.
