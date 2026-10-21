# Art swapping (for Artie)

Everything is drawn with canvas code by default. Drop sprites into `assets/art/` with a
`manifest.json` (same style as EzBake4Kids) and they replace the built-in drawings by id.
Missing manifest / missing ids / failed images fall back to the canvas art automatically.

## Spec
- World grid: **64×64 px tiles** (map is 16×22 tiles). Ground tiles 64×64 (+ `png@2x` 128×128).
- Sprite frames: **128×128**, top-down 3/4 view, facing **right** (game mirrors for left).
- Sprite sheets: PNG, **one action per row**, frames left→right.
- Sprites are drawn **anchored bottom-centre** on the object's ground point.
- Folders: `characters/ crops/ trees/ market/ tiles/ props/ ui/ effects/`.

## manifest.json
```json
{ "files": [
  { "id": "player", "file": "characters/player.png", "format": "png",
    "width": 512, "height": 384, "frameWidth": 128, "frameHeight": 128,
    "rows": [ {"action": "idle", "frames": 2, "fps": 4},
              {"action": "walk", "frames": 4, "fps": 10},
              {"action": "chop", "frames": 3, "fps": 12} ] },
  { "id": "tile-grass", "file": "tiles/png@2x/tile-grass.png", "format": "png@2x", "width": 64, "height": 64 }
]}
```
- `id` = file name without extension. When an id appears more than once, `png@2x` > `png` > `svg` wins.
- `width/height/frameWidth/frameHeight` are in 1× units; @2x files are scaled automatically.
- An id like `player-walk` is found either as its own file, or as row `action: "walk"` of id `player`.
- No `rows` = single frame.

## Ids the game uses (Artie batch v1 is in `assets/art/`)
| what | ids / rows | drawn at (world px) |
|---|---|---|
| ground | tile-grass, tile-grass-flowers, tile-dirt-path, tile-path-edge-n/e/s/w, tile-path-corner-outer-nw/ne/se/sw (autotiled) | 64×64 |
| fields | wheat-plowed (soil), wheat-ripe-sway (ripe, falls back to wheat-ripe), regrow: wheat-stubble → wheat-seed → wheat-sprout → wheat-growing | soil 64, crops 44×44 on a 32px grid |
| farmer | `farmer` rows idle, walk-down/up/left/right, carry-* (while holding wheat), harvest, chop, cheer (after a sale) | 100×100, feet anchor y≈114/128 |
| customers | customer-1..4 rows walk-left (arrive/leave), waiting (in queue), happy (on paying) | 84×84 |
| trees | tree-{round,pine,fruit}, -shake (while chopped), -falling (frames 0-3, fades on last frame), -stump | 128×128 |
| buildings | barn, market-stall | 210, 180 |
| hedge | fence-horizontal + bush-1/bush-2 | 64 |
| decor | well, flower-*, rock-1/2, bush-1/2 | various |
| fx | fx-wheat-bits (harvest), fx-wood-chips (chop), fx-leaf + fx-dust (tree falls), fx-coin-sparkle (sale), fx-sparkle (fields unlock) | 64×64, 0.4s |
| HUD | icon-wheat, icon-coin (also in bubbles) | 20-24 |

Loader reads Artie's `{assets:[...]}` (or `{files:[...]}`) manifest; uses `file2x` on high-DPI screens; row index from `rows[].row`.
Unused for now: house, apple, log-pile, coin, coin-stack, price-tag, speech-bubble-*, water tiles, sun/cloud, inventory slots, action buttons.
