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

## Ids the game uses (Artie v1.1 is in `assets/art/`)
| what | ids / rows | drawn at (world px) |
|---|---|---|
| ground | tile-grass, tile-grass-flowers, tile-dirt-path, tile-path-edge-*, tile-path-corner-outer-* (autotiled) | 64×64 |
| fields | wheat-plowed (all fields), fence-horizontal along each field top, gate-locked / gate-open (level fields) | 64, gate 128×64 |
| wheat | wheat-ripe-sway (fallback wheat-ripe), regrow wheat-stubble → wheat-seed → wheat-sprout → wheat-growing | 44 on 32px grid |
| carrot / corn / pumpkin | crop-{carrot,corn,pumpkin}-{harvested,seed,sprout,growing,ripe} | 44 / 46 / 56 (pumpkin on 48px grid) |
| farmer | `farmer-blue` (fallback `farmer`) rows idle, walk-*, carry-* (holding crops), harvest, chop, cheer | 100×100 |
| customers | customer-1..4 rows walk-left, waiting, happy | 84×84 |
| trees | tree-{round,pine,fruit}, -shake, -falling (fade on last frame), -stump; log-pile + apple drops | 128 |
| market | market-stall + market-counter-blue (sell counter) | 170, 150 |
| windmill | `windmill` row spin (fallback windmill-base + windmill-blades rotated at pivot 96,64) | 176 |
| chickens | `chicken` rows idle/walk/peck, faces left (mirrored for right) | 46 |
| props | barn, house, well, bush-1/2, flower-*, rock-1/2 | various |
| fx | fx-wheat-bits, fx-wood-chips, fx-leaf, fx-dust, fx-coin-sparkle, fx-sparkle | 64 |
| HUD | icon-coin, icon-wheat, icon-carrot, icon-corn, icon-pumpkin, icon-apple, icon-wood (fallback icon-log); upgrade-{sickle,axe,boots,basket,stall} in the shop | 20-48 |

Not used yet: water tiles, sun/cloud, speech-bubble-*, coin/coin-stack, price-tag, inventory slots, action buttons.
