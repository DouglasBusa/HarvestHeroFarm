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

## Ids the game uses
| id | drawn size (world px) | notes |
|---|---|---|
| tile-grass, tile-path | 64×64 | ground tiles |
| player-idle / player-walk / player-chop (or `player` + rows idle/walk/chop) | 64×84 | farmer in overalls + straw hat |
| wheat-ripe | 30×40 | crop on a 32px grid inside fields |
| wheat-cut | 30×20 | stubble while regrowing |
| tree | 110×140 | also used for the falling animation |
| tree-stump | 50×30 | |
| barn | 220×220 | |
| market-stall | 180×160 | |
| customer-1, customer-2, customer-3 | 50×70 | may be animated (row 0 used) |
| coin | — | reserved (coins currently drawn as 🪙 text) |
