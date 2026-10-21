# Harvest Hero Farm - cozy pixel-art pack

Drop-in replacement for `../assets/art/`. Same ids, states and sprite-sheet rows (action, row, frames, fps). The old pack is untouched.

## Rendering (important)
- Set `ctx.imageSmoothingEnabled = false` (and CSS `image-rendering: pixelated` on the canvas).
- Draw at an integer scale only. Each asset ships native (`file`) and @3x (`file3x`).
- **Native size = old pack size / 4** for every id not listed below. So drawing native ×4 reproduces the old pixel sizes and layout exactly (tile 16 → 64, frame 32 → 128). Drawing ×3 gives 48 px tiles.
- Manifest gives `width/height` and `frameWidth/frameHeight` at native size, plus `*3x` sizes, `scale`, `pixelArt: true`.
- Pivots/anchors are native: frames bottom-center, feet at (16,28-29). Windmill pivot (24,16), anchor (24,45). Blades pivot (18,18).

## Ids that changed size (native, vs old/4)

- `tree-round`: 60x74 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `tree-round-shake`: 180x74 native (old 384x128). Anchor bottom-center / see anchorX, anchorY
- `tree-round-falling`: 536x104 native (old 512x128). Anchor bottom-center / see anchorX, anchorY
- `tree-round-stump`: 60x74 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `tree-pine`: 40x72 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `tree-pine-shake`: 120x72 native (old 384x128). Anchor bottom-center / see anchorX, anchorY
- `tree-pine-falling`: 448x92 native (old 512x128). Anchor bottom-center / see anchorX, anchorY
- `tree-pine-stump`: 40x72 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `tree-fruit`: 56x72 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `tree-fruit-shake`: 168x72 native (old 384x128). Anchor bottom-center / see anchorX, anchorY
- `tree-fruit-falling`: 512x100 native (old 512x128). Anchor bottom-center / see anchorX, anchorY
- `tree-fruit-stump`: 56x72 native (old 128x128). Anchor bottom-center / see anchorX, anchorY
- `log-pile`: 30x22 native (old 128x128). Anchor bottom-center
- `barn`: 96x84 native (old 192x192). Anchor bottom-center
- `house`: 118x92 native (old 160x160). Anchor bottom-center
- `bush-1`: 28x22 native (old 64x64). Anchor bottom-center
- `bush-2`: 28x22 native (old 64x64). Anchor bottom-center
- `well`: 46x60 native (old 96x96). Anchor bottom-center

These are the big cozy objects (house, barn, well, trees, bushes, log pile), kept at cozy-test detail. They are larger relative to tiles than before, so check placement/collision. Trees: shake, falling and stump frames share the tree's frame size and base point; `-falling` frames are wider/taller and fall right around `pivotX/pivotY` at full size (not 80%).

## Other notes
- `chicken` faces left; mirror for right.
- Crops/wheat are opaque 16x16 tiles with tilled soil included. Corn is short to fit one tile; tall 16x32 corn is in `crop-corn-tall-0..4`.
- `farmer` = straw hat, green overalls; `farmer-blue` = brown hat, blue overalls. Customers 1-4 are recolors of the same body (no up-walk row, matching the old layout).
- `coin-counter` text area is x16-44, y4-11 native.

## New cozy-only ids
`villager`, `ground-auto-00`, `ground-auto-01`, `ground-auto-02`, `ground-auto-03`, `ground-auto-04`, `ground-auto-05`, `ground-auto-06`, `ground-auto-07`, `ground-auto-08`, `ground-auto-09`, `ground-auto-10`, `ground-auto-11`, `ground-auto-12`, `ground-auto-13`, `ground-auto-14`, `ground-auto-15`, `dirt-0`, `dirt-1`, `dirt-2`, `soil-tilled`, `crop-cabbage-seed`, `crop-cabbage-sprout`, `crop-cabbage-growing`, `crop-cabbage-ripe`, `crop-cabbage-harvested`, `crop-corn-tall-0`, `crop-corn-tall-1`, `crop-corn-tall-2`, `crop-corn-tall-3`, `crop-corn-tall-4`, `crop-pumpkin-ripe-b`, `crop-pumpkin-ripe-c`, `stump`, `stone-wall-0`, `stone-wall-1`, `stone-wall-2`, `stone-wall-3`, `wall-end-left`, `wall-end-right`, `mailbox`, `crate`

Built by `../build.py` (reuses `../../cozy-test/make.py`). Previews in `../previews/`.