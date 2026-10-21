# Changelog

## v0.3.2 — 2026-10-20
- Fix softlock: a full basket plus a customer who wants something you can't get no longer gets stuck.
  - 📦 Shipping crate next to the stall always buys anything you hold at ½ price.
  - A customer further back in line who wants what you hold steps up ("You go first!").
  - The front customer swaps missing items to things you hold: right away if your basket is full, otherwise after 3 s (8 s if you hold nothing).
  - Orders only include apples or wood if you hold them right now; fruit trees keep dropping apples over time.
- A full basket just skips harvesting and shows "Sell at the stall or crate". The game loop is protected with try/catch. Cache bust v=5.

## v0.3.1 — 2026-10-20
- Fix: carrots, corn and pumpkins now use Artie's 64px plot tiles (one plot = several plants, +3/+2 per harvest). They visibly cycle harvested → seed → sprout → growing → ripe with a pop, and only ripe plots can be harvested.
- Fix: customers only pay (and show the heart) when every item is fully delivered. Partial deliveries are tracked per item.
  Orders only include crops from fields you can reach; missing items bounce in red; after 8 s stuck, the customer changes the missing items to something you can grow (no reward until done).
- Queue spacing tightened so all 4 customers fit on portrait; queue bubbles are staggered. Cache bust v=4.

## v0.3 — 2026-10-20
- My Farm mode: saved progress (level, XP, coins, crops, upgrades, opened gates) with a "New farm" reset. Goal Challenge and 3-Minute Rush start fresh.
- Crops by level: wheat (Lv1), carrots (Lv2), corn (Lv3), pumpkins (Lv4); each has its own fields, grow time, price, icon and counter. Fruit trees drop apples.
- XP + levels with an XP bar, a level-up popup and confetti. Level fields have locked gates with "Level N" signs and a gentle bump + tip.
- Upgrades shop (walk into the barn ring or tap 🛠): Sickle, Axe, Boots, Basket (adds a carry limit), Stall.
- Big outlined tree countdown that drops in uneven chunks with a pop on every hit; felled trees drop log piles (wood).
- Resource badges at the top right with bump animations; blue sell counter; customers order mixes; crops fly to the counter and coins fly to the badge.
- Artie v1.1 art: blue-overalls farmer, windmill, chickens (wander, peck, run from the farmer), crops, gates, icons. More fences.
- Fix: the farmer's legs are no longer hidden in the crops. Cache bust v=3.

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
