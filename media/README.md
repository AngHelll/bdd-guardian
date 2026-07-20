# Brand assets (ForgeOne Opción B)

| File | Role |
|------|------|
| `guardian.svg` | Monochrome silhouette (`currentColor`) — map pin + linked nodes inside a shield |
| `icon-marketplace.svg` | Marketplace tile source — navy gradient + cool light glyph |
| `../icon.png` | Published 128×128 PNG (export from `icon-marketplace.svg`) |

## Export `icon.png`

From repo root (requires network once for `@resvg/resvg-js`):

```bash
node scripts/export-marketplace-icon.js
```

Palette (parity with BDD Pilot Opción B):

- Background: `#1a2332` → `#0d1219`
- Glyph: `#e8eef6`
- Corner radius: `rx="22"`

Legacy ladybug mascot: `docs/assets/icon-ladybug-legacy.png`.
