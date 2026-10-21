# Changelog

## v0.2 — 2026-10-20
- Artie's art batch v1: farmer with 4-direction walk/carry, harvest, chop and cheer animations; 4 customers (walk, waiting, happy);
  round/pine/fruit trees with shake, falling and stump; wheat growth stages for regrowth; autotiled dirt paths; plowed soil; fence + bush hedge;
  barn, market stall, decor props; fx sprites; HUD icons.
- Loader reads Artie's manifest (assets list, @2x, row indices); canvas art remains as fallback.
- Customers pause to cheer before leaving. Cache bust v=2.

## v0.1 — 2026-10-20
- First playable: farm map with 4 wheat fields (2 locked behind trees), barn, market stall.
- Drag-anywhere floating joystick (touch + mouse), WASD/arrow keys; "DRAG TO MOVE" hint on first play.
- Walk-through wheat harvesting with +1 floats, particles, regrowth.
- Tree chopping (walk up or tap): 1000 HP countdown, damage numbers, shake, falling tree; the 3 gate trees open the bottom fields.
- Market with 3-customer queue; stand on the marked spot to sell; coins, happy customers.
- Goal mode (500 coins, timer, star rating, best time) and Endless mode (3 min, high score) via localStorage.
- Soft synth sound effects (after first tap, mute button). No voice, no ads, no purchases, no install prompts.
- Optional sprite swapping via assets/art/manifest.json (see ART.md).
