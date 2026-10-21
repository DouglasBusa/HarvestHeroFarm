// Harvest Hero Farm v0.3 — free, no ads, no purchases, no voice. Pure canvas, no dependencies.
(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const TILE = 64, WW = 1024, WH = 1920; // 16 x 30 tiles
let vw = 0, vh = 0, dpr = 1, scale = 1;

// ================= Art (Artie's manifest; canvas fallback for anything missing) =================
const ART = {};
fetch('assets/art/manifest.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(m => {
  if (!m) return;
  const hi = (window.devicePixelRatio || 1) > 1.2;
  for (const e of (m.assets || m.files || [])) {
    if (!e.id || !e.file || ART[e.id]) continue;
    const img = new Image();
    img.onload = () => {
      ART[e.id] = {img, e, pix: !!(m.pixelArt || e.pixelArt), sc: img.naturalWidth / (e.width || img.naturalWidth), fw: e.frameWidth || e.width || img.naturalWidth, fh: e.frameHeight || e.height || img.naturalHeight,
        rows: (e.rows || [{action: 'default', frames: 1, fps: 1}]).map((r, i) => ({row: i, ...r}))};
      if (e.id.startsWith('icon-') || e.id.startsWith('upgrade-')) iconsDirty = true;
    };
    img.src = 'assets/art/' + (m.pixelArt || e.pixelArt ? e.file : (hi && e.file2x ? e.file2x : e.file));
  }
}).catch(() => {});
function findArt(id, action) {
  const a = ART[id];
  if (a) { if (!action) return [a, a.rows[0]]; const r = a.rows.find(r => r.action === action); return r ? [a, r] : null; }
  const i = id.lastIndexOf('-'); if (i < 0 || action) return null;
  return findArt(id.slice(0, i), id.slice(i + 1));
}
const has = (id, act) => !!findArt(id, act);
// bottom-centre anchored sprite. 128px character/tree frames have feet at ~y114 -> drop by that margin.
// Cozy pixel pack: native size x4 (x2 for Artie's big objects), positions snapped to the 2-world-px grid.
const PX2 = /^(tree-|log-pile$|barn$|house$|well$|bush-|stump$)/;
const pxScale = id => PX2.test(id) ? 2 : 4;
const snap = v => Math.round(v / 2) * 2;
function art(id, x, y, w, h, o = {}) {
  const f = findArt(id, o.action); if (!f) return false;
  const [a, row] = f, n = row.frames || 1;
  const fr = o.frame != null ? Math.min(n - 1, o.frame) : Math.floor((o.t || 0) * (row.fps || 8)) % n;
  if (a.pix && !o.fit) {
    const e = a.e, s = o.px || pxScale(e.id), fall = /-falling$/.test(e.id);
    const footN = o.foot === 0 ? 0 : a.fh === 32 ? 4 : a.fh === 16 && /^chicken/.test(e.id) ? 2 : 0;
    const ax = (e.anchorX ?? (fall ? e.pivotX : null) ?? a.fw / 2) * s, ay = (e.anchorY ?? (fall ? e.pivotY : null) ?? a.fh - footN) * s;
    ctx.save(); ctx.translate(snap(x), snap(y)); if (o.flip) ctx.scale(-1, 1); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(a.img, fr * a.fw, row.row * a.fh, a.fw, a.fh, -ax, -ay, a.fw * s, a.fh * s);
    ctx.restore(); return true;
  }
  const foot = o.foot != null ? o.foot : (a.fh === 128 ? 14 / 128 : 0);
  ctx.save(); ctx.translate(x, y + h * foot); if (o.flip) ctx.scale(-1, 1); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(a.img, fr * a.fw * a.sc, row.row * a.fh * a.sc, a.fw * a.sc, a.fh * a.sc, -w / 2, -h, w, h);
  ctx.restore(); return true;
}
const tile = (id, x, y, w = TILE, h = TILE) => art(id, x + w / 2, y + h, w, h, {foot: 0});
const iconSrc = id => ART[id] ? ART[id].img.src : null;
let iconsDirty = true;

// ================= Sound (soft synth, only after a tap) =================
let ac = null, soundOn = localStorage.getItem('hhf-sound') !== 'off';
function beep(freq, dur = .08, type = 'sine', vol = .08) {
  if (!ac || !soundOn) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
}
$('soundBtn').textContent = soundOn ? '🔊' : '🔈';
$('soundBtn').onclick = () => { soundOn = !soundOn; localStorage.setItem('hhf-sound', soundOn ? 'on' : 'off'); $('soundBtn').textContent = soundOn ? '🔊' : '🔈'; };

// ================= Game data =================
const CROPS = {
  // wheat: one stalk clump per 32px; other crops: Artie's 64px plot tiles (several plants each -> yield)
  wheat:   {lvl: 1, grow: 6,  price: 5,  xp: 1, emoji: '🌾', grid: 64, size: 64, yield: 3, name: 'Wheat'},
  carrot:  {lvl: 2, grow: 10, price: 8,  xp: 2, emoji: '🥕', grid: 64, size: 64, yield: 3, name: 'Carrots'},
  corn:    {lvl: 3, grow: 12, price: 12, xp: 3, emoji: '🌽', grid: 64, size: 64, yield: 3, name: 'Corn'},
  pumpkin: {lvl: 4, grow: 15, price: 20, xp: 5, emoji: '🎃', grid: 64, size: 64, yield: 2, name: 'Pumpkins'},
  cabbage: {lvl: 5, grow: 18, price: 26, xp: 6, emoji: '🥬', grid: 64, size: 64, yield: 2, name: 'Cabbages'},
};
const GOODS = {...CROPS, apple: {price: 6, emoji: '🍎', name: 'Apples'}, wood: {price: 4, emoji: '🪵', name: 'Wood'}};
const ICON = {coins: 'icon-coin', wheat: 'icon-wheat', carrot: 'icon-carrot', corn: 'icon-corn', pumpkin: 'icon-pumpkin', cabbage: 'icon-cabbage', apple: 'icon-apple', wood: 'icon-wood'};
const EMOJI = {coins: '🪙', ...Object.fromEntries(Object.entries(GOODS).map(([k, v]) => [k, v.emoji]))};
const iconFor = k => ART[ICON[k]] ? ICON[k] : (k === 'wood' && ART['icon-log'] ? 'icon-log' : null);
const UPG = {
  sickle: {name: 'Sickle', emoji: '✂️', desc: 'Harvest a wider path', vals: [30, 38, 46, 54, 64], prices: [60, 180, 450, 900], show: v => `reach ${v}`},
  axe:    {name: 'Axe', emoji: '🪓', desc: 'Chop trees faster', vals: [1, 1.4, 1.9, 2.5, 3.2], prices: [50, 150, 380, 800], show: v => `×${v} power`},
  boots:  {name: 'Boots', emoji: '👢', desc: 'Run faster', vals: [260, 300, 340, 380], prices: [80, 240, 600], show: v => `speed ${v}`},
  basket: {name: 'Basket', emoji: '🧺', desc: 'Carry more crops', vals: [30, 45, 60, 80, 100], prices: [50, 160, 400, 850], show: v => `holds ${v}`},
  stall:  {name: 'Stall', emoji: '🏪', desc: 'Customers pay more', vals: [0, .15, .3, .5, .75], prices: [120, 320, 700, 1400], show: v => `+${Math.round(v * 100)}% coins`},
};
const LEVELS = [0, 0, 250, 700, 1400, 2400];
const needXp = l => l < LEVELS.length ? LEVELS[l] : 2400 + 1300 * (l - 5);
const UNLOCK = {2: '🥕 The carrot field is open!', 3: '🌽 The corn field is open!', 4: '🎃 The pumpkin patch is open!', 5: '🥬 The cabbage patch is open!'};

// ================= World layout =================
const fields = [
  {x: 128, y: 448, w: 320, h: 256, crop: 'wheat'}, {x: 576, y: 448, w: 320, h: 256, crop: 'wheat'},
  {x: 128, y: 960, w: 320, h: 256, crop: 'wheat', treeLock: true}, {x: 576, y: 960, w: 320, h: 256, crop: 'wheat', treeLock: true},
  {x: 128, y: 1408, w: 320, h: 192, crop: 'carrot'}, {x: 576, y: 1408, w: 320, h: 192, crop: 'corn'},
  {x: 128, y: 1728, w: 320, h: 128, crop: 'pumpkin'}, {x: 576, y: 1728, w: 320, h: 128, crop: 'cabbage'},
];
fields.forEach(f => f.lvl = CROPS[f.crop].lvl);
const hedges = [{x: 0, y: 768, w: 416, h: 64}, {x: 608, y: 768, w: 416, h: 64}];
const walls = [...hedges,
  {x: 376, y: 226, w: 56, h: 30}, // crate
  {x: 64, y: 128, w: 192, h: 128}, // barn
  {x: 448, y: 120, w: 128, h: 70}, // stall
  {x: 446, y: 214, w: 132, h: 40}, // blue counter
  {x: 306, y: 206, w: 48, h: 40}, // windmill
  ...fields.map(f => ({x: f.x, y: f.y - 30, w: f.w, h: 14, fence: true})),
];
const crateSpot = {x: 404, y: 292}, stallSpot = {x: 512, y: 292}, shopSpot = {x: 160, y: 290}, WINDMILL = {x: 330, y: 252};
const isPath = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH && (((x === 448 || x === 512) && y >= 256) || (y === 320 && x >= 64 && x < 960));
function pathTile(x, y) {
  const n = !isPath(x, y - TILE), s = !isPath(x, y + TILE), w = !isPath(x - TILE, y), e = !isPath(x + TILE, y);
  if (n && w) return 'tile-path-corner-outer-nw'; if (n && e) return 'tile-path-corner-outer-ne';
  if (s && w) return 'tile-path-corner-outer-sw'; if (s && e) return 'tile-path-corner-outer-se';
  if (n) return 'tile-path-edge-n'; if (s) return 'tile-path-edge-s'; if (w) return 'tile-path-edge-w'; if (e) return 'tile-path-edge-e';
  return 'tile-dirt-path';
}
const TREE_SPOTS = [[462, 816, 'pine', 1], [562, 816, 'pine', 1], [928, 256, 'round'], [990, 640, 'fruit'], [34, 640, 'pine'],
  [990, 1100, 'round'], [34, 1100, 'fruit'], [330, 1300, 'pine'], [736, 1300, 'fruit'], [990, 1560, 'round'], [34, 1560, 'pine']];
const CHICK_ZONES = [{x: 700, y: 130, w: 280, h: 90}, {x: 40, y: 850, w: 360, h: 40}, {x: 640, y: 850, w: 340, h: 40}, {x: 60, y: 1240, w: 900, h: 40}];
const decor = [['well', 965, 1470, 80], ['flower-red', 290, 300, 26], ['flower-yellow', 700, 410, 26], ['flower-purple', 960, 420, 26], ['flower-white', 40, 900, 26],
  ['rock-1', 680, 905, 36], ['rock-2', 40, 400, 36], ['bush-1', 990, 900, 52], ['bush-2', 300, 1660, 48], ['flower-red', 880, 1250, 26], ['house', 820, 1900, 130], ['mailbox', 960, 1890, 0], ['villager', 690, 1880, 0], ['rock-2', 980, 1700, 0], ['bush-1', 40, 1900, 0]];

// ================= State =================
let S, plants, trees, customers, floats, parts, fx, flyers, pickups, chickens, player;
const SAVE_KEY = 'hhf-farm-v1';
const freshProgress = () => ({level: 1, xp: 0, coins: 0, inv: {wheat: 0, carrot: 0, corn: 0, pumpkin: 0, cabbage: 0, apple: 0, wood: 0}, upg: {sickle: 0, axe: 0, boots: 0, basket: 0, stall: 0}, gatesDown: false});
function loadFarm() { try { const p = JSON.parse(localStorage.getItem(SAVE_KEY)); if (p && p.level) { const f = freshProgress(); return {...f, ...p, inv: {...f.inv, ...p.inv}, upg: {...f.upg, ...p.upg}}; } } catch (e) {} return freshProgress(); }
function saveFarm() { if (!S || S.mode !== 'farm') return; const {level, xp, coins, inv, upg, gatesDown} = S; localStorage.setItem(SAVE_KEY, JSON.stringify({level, xp, coins, inv, upg, gatesDown})); }
const U = k => UPG[k].vals[S.upg[k]];
const carried = () => Object.keys(CROPS).reduce((a, k) => a + S.inv[k], 0) + S.inv.apple;

function reset(mode) {
  const prog = mode === 'farm' ? loadFarm() : freshProgress();
  S = {mode, ...prog, time: 0, left: 180, goal: 500, sellT: 0, crateT: 0, crateCoins: 0, running: true, paused: false, saveT: 0, levelQueue: []};
  plants = [];
  fields.forEach((f, fi) => { const g = CROPS[f.crop].grid, tileCrop = g === 64;
    for (let y = f.y + (tileCrop ? 50 : g * .75); y < f.y + f.h; y += g) for (let x = f.x + g / 2; x < f.x + f.w; x += g) plants.push({x, y, f: fi, crop: f.crop, ripe: true, t: 0, max: 1}); });
  trees = TREE_SPOTS.map(([x, y, kind, gate]) => ({x, y, kind, gate: !!gate, hp: 1000, max: 1000, shake: 0, fall: 0, hitT: 0, pop: 0, regrow: 0}));
  if (S.gatesDown) trees.filter(t => t.gate).forEach(t => { t.hp = 0; t.fall = 1; });
  customers = []; floats = []; parts = []; fx = []; flyers = []; pickups = [];
  chickens = Array.from({length: 4}, (_, i) => { const z = CHICK_ZONES[i]; return {z, x: z.x + Math.random() * z.w, y: z.y + Math.random() * z.h, tx: 0, ty: 0, st: 'idle', t: Math.random() * 2, face: -1, anim: 0}; });
  player = {x: 512, y: 380, face: 'down', dir: 1, moving: false, t: 0, chop: 0, harvestT: 0, cheerT: 0, target: null};
  cam.x = player.x; cam.y = player.y; inShop = true; // don't pop the shop at spawn
}
const fieldOpen = f => (!f.treeLock || S.gatesDown) && S.level >= f.lvl;
const fieldLevelLocked = f => S.level < f.lvl;

// ================= Input =================
const joy = {active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0};
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('pointerdown', e => {
  if (!S || !S.running || S.paused) return; e.preventDefault();
  joy.active = true; joy.id = e.pointerId; joy.bx = e.clientX; joy.by = e.clientY; joy.dx = joy.dy = 0;
  cv.setPointerCapture?.(e.pointerId); hideHint();
  const w = toWorld(e.clientX, e.clientY);
  for (const t of trees) if (t.hp > 0 && Math.hypot(w.x - t.x, w.y - (t.y - 50)) < 60 && Math.hypot(player.x - t.x, player.y - t.y) < 200) player.target = t;
});
cv.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return; e.preventDefault();
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy), R = 60;
  if (d > R) { joy.bx += dx * (1 - R / d); joy.by += dy * (1 - R / d); dx = e.clientX - joy.bx; dy = e.clientY - joy.by; }
  joy.dx = dx / R; joy.dy = dy / R;
});
const endJoy = e => { if (e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
document.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, {passive: false});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
const cam = {x: 512, y: 400, cx: 512, cy: 400};
const toWorld = (sx, sy) => ({x: (sx - vw / 2) / scale + cam.cx, y: (sy - vh / 2) / scale + cam.cy});
const toScreen = (x, y) => ({x: (x - cam.cx) * scale + vw / 2, y: (y - cam.cy) * scale + vh / 2});
let hintShown = false;
function showHint() { if (!localStorage.getItem('hhf-hint')) { $('hint').classList.remove('hidden'); hintShown = true; } }
function hideHint() { if (hintShown) { $('hint').classList.add('hidden'); localStorage.setItem('hhf-hint', '1'); hintShown = false; } }
let tipT = 0, tipMsg = '';
function tip(msg, secs = 2.2) { if (tipMsg === msg && tipT > 0) { tipT = secs; return; } tipMsg = msg; tipT = secs; $('tip').textContent = msg; $('tip').classList.remove('hidden'); }

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2.5); vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  const base = Math.max(.55, Math.min(1.5, Math.min(vw, vh) / 520));
  const k = Math.max(2, 2 * Math.round(2 * base * dpr)); scale = k / (4 * dpr); // 1 art px = k device px (x4) or k/2 (x2)
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); resize();
addEventListener('visibilitychange', () => { if (document.hidden) saveFarm(); });

// ================= Helpers =================
function float(x, y, text, color = '#fff', size = 26) { floats.push({x, y, text, color, size, life: 1}); }
function spawnFx(id, x, y) { if (has(id)) { fx.push({id, x, y, t: 0}); return true; } return false; }
function burst(x, y, color, n = 8, fxId) { if (fxId && spawnFx(fxId, x, y + 24)) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 140; parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: .7, color}); } }
function bump(k) { const el = document.querySelector(`#res [data-k="${k}"]`); if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function pillCenter(k) { const el = document.querySelector(`#res [data-k="${k}"]`); if (!el) return {x: vw - 40, y: 30}; const r = el.getBoundingClientRect(); return {x: r.left + 18, y: r.top + r.height / 2}; }
// screen-space flying icon (wheat -> counter, coins -> HUD)
function fly(k, from, to, delay = 0, done) { flyers.push({k, x0: from.x, y0: from.y, to, t: -delay, dur: .55, done}); }
let camShake = 0;
function collide(nx, ny) {
  const r = 16; let bumped = null;
  nx = Math.max(r, Math.min(WW - r, nx)); ny = Math.max(r + 40, Math.min(WH - r, ny));
  const rects = walls.concat(fields.filter(fieldLevelLocked).map(f => ({x: f.x, y: f.y, w: f.w, h: f.h, lock: f})));
  for (const w of rects) {
    const cx = Math.max(w.x, Math.min(w.x + w.w, nx)), cy = Math.max(w.y, Math.min(w.y + w.h, ny));
    const dx = nx - cx, dy = ny - cy, d = Math.hypot(dx, dy);
    if (d < r) { if (w.lock) bumped = w.lock; if (d === 0) { const e = [[nx - w.x, -1, 0], [w.x + w.w - nx, 1, 0], [ny - w.y, 0, -1], [w.y + w.h - ny, 0, 1]].sort((a, b) => a[0] - b[0])[0]; if (e[1]) nx = e[1] < 0 ? w.x - r : w.x + w.w + r; else ny = e[2] < 0 ? w.y - r : w.y + w.h + r; } else { nx = cx + dx / d * r; ny = cy + dy / d * r; } }
  }
  for (const t of trees) if (t.hp > 0) { const dx = nx - t.x, dy = ny - t.y, d = Math.hypot(dx, dy), m = r + 26; if (d < m && d > 0) { nx = t.x + dx / d * m; ny = t.y + dy / d * m; } }
  if (bumped) { tip(`🔒 Reach Level ${bumped.lvl} to farm ${CROPS[bumped.crop].name.toLowerCase()} here!`); if (!player.bumpT) { player.bumpT = .3; camShake = .1; beep(200, .08, 'sine', .04); } }
  return [nx, ny];
}
function addXp(n) {
  S.xp += n;
  while (S.xp >= needXp(S.level + 1)) { S.level++; S.levelQueue.push(S.level); }
  if (S.levelQueue.length && !S.paused) showLevelUp(S.levelQueue.shift());
}
function makeOrder() {
  const types = Object.keys(CROPS).filter(k => fields.some(f => f.crop === k && fieldOpen(f)));
  if (S.inv.apple > 0) types.push('apple'); if (S.inv.wood >= 3) types.push('wood'); // only things we hold right now
  const pick = [types[0]]; const extra = Math.min(types.length - 1, Math.floor(Math.random() * (S.level >= 2 ? 3 : 1)));
  const pool = types.slice(1).sort(() => Math.random() - .5); for (let i = 0; i < extra; i++) pick.push(pool[i]);
  if (pick.length > 1 && Math.random() < .3) pick.shift(); // not every order needs wheat
  const order = {}; let total = 4 + Math.floor(Math.random() * 4) + Math.min(6, S.level);
  pick.forEach((k, i) => { const n = i === pick.length - 1 ? total : Math.max(1, Math.floor(total * (.3 + Math.random() * .4))); order[k] = Math.max(1, n); total -= n; });
  for (const k in order) if (order[k] <= 0) delete order[k];
  return order;
}
function newCustomer() { const order = makeOrder(); return {x: 1090, y: 302, kind: Math.floor(Math.random() * 4), order, got: Object.fromEntries(Object.keys(order).map(k => [k, 0])), leaving: 0, stuck: 0, slot: 0}; }

// ================= Update =================
let inShop = false;
function update(dt) {
  S.time += dt; if (S.mode === 'endless') S.left -= dt;
  tipT -= dt; if (tipT <= 0 && tipMsg) { tipMsg = ''; $('tip').classList.add('hidden'); }
  player.bumpT = Math.max(0, (player.bumpT || 0) - dt);
  let mx = joy.dx, my = joy.dy;
  if (keys['a'] || keys['arrowleft']) mx -= 1; if (keys['d'] || keys['arrowright']) mx += 1;
  if (keys['w'] || keys['arrowup']) my -= 1; if (keys['s'] || keys['arrowdown']) my += 1;
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  player.moving = m > .1; const sp = U('boots');
  if (player.moving) { hideHint(); player.target = null;
    [player.x, player.y] = collide(player.x + mx * sp * dt, player.y + my * sp * dt);
    if (Math.abs(mx) > .1) player.dir = mx > 0 ? 1 : -1;
    player.face = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up'); player.t += dt; }
  if (player.target && !player.moving) { const t = player.target, dx = t.x - player.x, dy = t.y + 44 - player.y, d = Math.hypot(dx, dy);
    if (t.hp <= 0) player.target = null; else if (d > 50) { [player.x, player.y] = collide(player.x + dx / d * sp * dt, player.y + dy / d * sp * dt); player.t += dt; player.dir = dx > 0 ? 1 : -1; } }

  // harvest
  const cap = U('basket'), R = U('sickle');
  let full = carried() >= cap;
  for (const p of plants) {
    const f = fields[p.f]; if (!fieldOpen(f)) continue;
    if (p.ripe) { if (Math.abs(p.x - player.x) < R && Math.abs(p.y - player.y) < R) {
      if (full) { tip(`🧺 Basket full! Sell at the 🏪 stall or 📦 crate.`); continue; }
      const c = CROPS[p.crop], n = Math.min(c.yield, cap - carried()); p.ripe = false; p.t = p.max = c.grow * (.9 + Math.random() * .3);
      S.inv[p.crop] += n; full = carried() >= cap; player.harvestT = .35; addXp(c.xp * n); p.popT = .3;
      float(p.x, p.y - 20, `+${n}${n > 1 ? ' ' + c.emoji : ''}`, '#ffe066', n > 1 ? 26 : 22); burst(p.x, p.y, '#f4c542', 4, 'fx-wheat-bits'); bump(p.crop); beep(640 + Math.random() * 220, .05, 'triangle', .045); }
    } else if ((p.t -= dt) <= 0) { p.ripe = true; p.popT = .3; }
    if (p.popT > 0) p.popT -= dt;
  }
  // chop
  player.chop = Math.max(0, player.chop - dt);
  for (const t of trees) {
    t.shake = Math.max(0, t.shake - dt * 3); t.pop = Math.max(0, t.pop - dt * 4);
    if (t.hp <= 0) { t.fall = Math.min(1, t.fall + dt * 1.4);
      if (!t.gate && t.fall >= 1 && (t.regrow += dt) > 40 && Math.hypot(player.x - t.x, player.y - t.y) > 80) { t.hp = t.max; t.fall = 0; t.regrow = 0; t.pop = 1; spawnFx('fx-sparkle', t.x, t.y - 20); }
      continue; }
    if (t.kind === 'fruit' && (t.appleT = (t.appleT || 0) + dt) > 18) { t.appleT = 0;
      if (pickups.filter(q => q.k === 'apple' && Math.hypot(q.x - t.x, q.y - t.y) < 90).length < 3) pickups.push({k: 'apple', n: 1, x: t.x + (Math.random() * 60 - 30), y: t.y + 30 + Math.random() * 16, t: 0}); }
    if (Math.hypot(player.x - t.x, player.y - t.y) < 72) {
      if ((t.hitT -= dt) <= 0) { t.hitT = .32;
        const dmg = Math.max(1, Math.round((25 + Math.pow(Math.random(), 1.6) * 230) * U('axe')));
        t.hp = Math.max(0, t.hp - dmg); t.shake = 1; t.pop = 1; player.chop = .3; player.dir = t.x > player.x ? 1 : -1;
        float(t.x + (Math.random() * 60 - 30), t.y - 100, '-' + dmg, '#ff6b6b', 20); burst(t.x, t.y - 30, '#8d5a2b', 3, 'fx-wood-chips'); beep(170 + Math.random() * 40, .06, 'square', .03);
        if (t.hp === 0) {
          spawnFx('fx-dust', t.x, t.y + 10); spawnFx('fx-leaf', t.x, t.y - 50); burst(t.x, t.y - 50, '#4caf50', 16);
          camShake = .3; S.coins += 10; addXp(15); float(t.x, t.y - 150, 'TIMBER!', '#fff', 32); bump('coins'); beep(330, .3, 'triangle', .08);
          pickups.push({k: 'wood', n: 3, x: t.x + 34, y: t.y + 18, t: 0});
          if (t.kind === 'fruit') [-30, 0, 30].forEach((o, i) => pickups.push({k: 'apple', n: 1, x: t.x + o - 10, y: t.y + 40 + (i % 2) * 10, t: 0}));
          if (t.gate && trees.filter(g => g.gate).every(g => g.hp <= 0)) { S.gatesDown = true; float(512, 900, 'New fields opened! 🌾', '#ffe066', 32); fields.filter(f => f.treeLock).forEach(f => spawnFx('fx-sparkle', f.x + f.w / 2, f.y + f.h / 2)); beep(880, .4, 'sine', .08); }
        }
      }
    }
  }
  // pickups
  for (const p of pickups) { p.t += dt;
    if (p.t > .5 && Math.hypot(player.x - p.x, player.y - p.y) < 44) {
      if (p.k === 'apple' && carried() >= cap) { tip(`🧺 Basket full! Sell at the 🏪 stall or 📦 crate.`); continue; }
      p.gone = true; const k = p.k, n = p.n; addXp(3);
      fly(k, toScreen(p.x, p.y - 10), () => pillCenter(k), 0, () => { S.inv[k] += n; bump(k); });
      float(p.x, p.y - 30, `+${n} ${EMOJI[k]}`, '#fff', 22); beep(760, .08, 'triangle', .06); } }
  pickups = pickups.filter(p => !p.gone);

  // customers & selling
  let queue = customers.filter(c => !c.leaving);
  while (queue.length < 4) { const c = newCustomer(); c.x = 1090 + queue.length * 70; customers.push(c); queue.push(c); }
  queue.forEach((c, i) => { c.slot = i; const tx = 600 + i * 60; c.x += Math.sign(tx - c.x) * Math.min(Math.abs(tx - c.x), 170 * dt); });
  customers.forEach(c => { if (c.leaving) { c.leaving += dt; if (c.leaving > .7) c.x -= 190 * dt; } });
  customers = customers.filter(c => c.x > -90);
  const front = queue[0];
  const atStall = Math.hypot(player.x - stallSpot.x, player.y - stallSpot.y) < 62;
  if (atStall && front && Math.abs(front.x - 600) < 3) {
    if ((S.sellT -= dt) <= 0) {
      S.sellT = .11 / (1 + S.upg.stall * .3);
      const k = Object.keys(front.order).find(k => front.got[k] < front.order[k] && S.inv[k] > 0);
      if (k) { S.inv[k]--; front.got[k]++; front.stuck = 0; bump(k); addXp(1); beep(500 + Math.random() * 80, .04, 'sine', .035);
        fly(k, toScreen(player.x, player.y - 50), () => toScreen(512, 222), 0, () => burst(512, 220, '#ffe066', 3));
        if (Object.keys(front.order).every(q => front.got[q] >= front.order[q])) payCustomer(front, true);
      } else {
        // front customer can't take anything we hold
        front.stuck += .11;
        const missing = Object.keys(front.order).filter(q => front.got[q] < front.order[q]);
        const held = Object.keys(GOODS).filter(k => S.inv[k] > 0 && (k !== 'wood' || S.inv[k] >= 1));
        const other = queue.slice(1).find(c => Object.keys(c.order).some(q => c.got[q] < c.order[q] && S.inv[q] > 0));
        const isFull = carried() >= U('basket');
        if (other && front.stuck > .5) { // let a customer who wants what we have step up
          customers.splice(customers.indexOf(front), 1); customers.push(front); front.stuck = 0;
          float(front.x, front.y - 120, 'You go first! 😊', '#fff', 18);
        } else if (held.length && (isFull || front.stuck > 3)) swapOrder(front, missing, held);
        else if (!held.length && front.stuck > 8) swapOrder(front, missing, [Object.keys(CROPS).find(k => fields.some(f => f.crop === k && fieldOpen(f))) || 'wheat']);
        else tip(`This customer needs ${missing.map(q => `${EMOJI[q]}${front.order[q] - front.got[q]}`).join(' ')}` + (held.length ? ' — or use the 📦 crate!' : ' — go harvest!'));
      }
    }
  }
  // shipping crate: always buys anything you hold at half price
  if (Math.hypot(player.x - crateSpot.x, player.y - crateSpot.y) < 46) {
    if ((S.crateT -= dt) <= 0) { S.crateT = .08;
      const k = Object.keys(GOODS).find(k => S.inv[k] > 0);
      if (k) { S.inv[k]--; bump(k); S.crateCoins = (S.crateCoins || 0) + GOODS[k].price * .5; addXp(0.5);
        fly(k, toScreen(player.x, player.y - 50), () => toScreen(crateSpot.x, crateSpot.y - 40), 0);
        if (S.crateCoins >= 1) { const c = Math.floor(S.crateCoins); S.crateCoins -= c; S.coins += c; }
        if (Math.random() < .25) fly('coins', toScreen(crateSpot.x, crateSpot.y - 50), () => pillCenter('coins'), 0, () => bump('coins'));
        beep(420, .04, 'sine', .03);
      } else tip('📦 Shipping crate buys anything at ½ price');
    }
  }
  // barn upgrades
  const nearShop = Math.hypot(player.x - shopSpot.x, player.y - shopSpot.y) < 46;
  if (nearShop && !inShop) openShop(); inShop = nearShop;
  // chickens
  for (const c of chickens) {
    c.t -= dt; c.anim += dt; const z = c.z; const pd = Math.hypot(player.x - c.x, player.y - c.y);
    if (pd < 70) { const a = Math.atan2(c.y - player.y, c.x - player.x); c.tx = Math.max(z.x, Math.min(z.x + z.w, c.x + Math.cos(a) * 80)); c.ty = Math.max(z.y, Math.min(z.y + z.h, c.y + Math.sin(a) * 80)); c.st = 'walk'; c.t = 1; c.fast = true; }
    if (c.st === 'walk') { const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy), v = c.fast ? 150 : 45;
      if (d < 3) { c.st = Math.random() < .55 ? 'peck' : 'idle'; c.t = 1 + Math.random() * 2; c.fast = false; c.anim = 0; }
      else { c.x += dx / d * Math.min(d, v * dt); c.y += dy / d * Math.min(d, v * dt); if (Math.abs(dx) > 1) c.face = dx > 0 ? 1 : -1; } }
    else if (c.t <= 0) { c.st = 'walk'; c.anim = 0; c.tx = z.x + Math.random() * z.w; c.ty = z.y + Math.random() * z.h; }
  }
  floats.forEach(f => { f.y -= 50 * dt; f.life -= dt * .9; }); floats = floats.filter(f => f.life > 0);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < .4);
  camShake = Math.max(0, camShake - dt); player.harvestT = Math.max(0, player.harvestT - dt); player.cheerT = Math.max(0, player.cheerT - dt);
  if ((S.saveT += dt) > 3) { S.saveT = 0; saveFarm(); }
  if (S.mode === 'goal' && S.coins >= S.goal) endRound();
  if (S.mode === 'endless' && S.left <= 0) { S.left = 0; endRound(); }
}
function swapOrder(c, missing, held) {
  const pickFrom = held.slice().sort((a, b) => S.inv[b] - S.inv[a]);
  missing.forEach((q, i) => { const left = c.order[q] - c.got[q]; c.order[q] = c.got[q]; if (!c.order[q]) { delete c.order[q]; delete c.got[q]; }
    const sw = pickFrom[i % pickFrom.length]; c.order[sw] = (c.order[sw] || 0) + left; c.got[sw] = c.got[sw] || 0; });
  c.stuck = 0; float(c.x, c.y - 120, 'Changed my order! 🤔', '#fff', 18);
}
function payCustomer(c, complete = true) {
  if (!Object.keys(c.order).every(k => c.got[k] >= c.order[k])) return; // only full orders pay
  let base = 0; for (const k in c.got) base += c.got[k] * GOODS[k].price;
  const pay = Math.round(base * (1 + U('stall')) + (complete ? 3 + S.level : 0));
  c.leaving = .01; S.coins += pay; addXp(complete ? 5 : 2); player.cheerT = .8; camShake = .12;
  float(512, 196, `+${pay}`, '#ffd700', 36); spawnFx('fx-coin-sparkle', 512, 230);
  const from = toScreen(512, 210), n = Math.min(8, 2 + Math.floor(pay / 15));
  for (let i = 0; i < n; i++) fly('coins', {x: from.x + (Math.random() - .5) * 40, y: from.y + (Math.random() - .5) * 20}, () => pillCenter('coins'), i * .06, () => bump('coins'));
  beep(990, .15, 'triangle', .08); setTimeout(() => beep(1320, .15, 'triangle', .07), 90);
}

// ================= Draw =================
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function shadow(x, y, rx) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .4, 0, 0, 7); ctx.fill(); }
let view = {x0: 0, y0: 0, x1: WW, y1: WH};
const onScreen = (x, y, pad = 140) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad * 1.6;
function outlined(text, x, y, size, fill = '#fff', stroke = '#5a3412') { ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, size / 6); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
function drawGround() {
  for (let y = Math.max(0, Math.floor(view.y0 / TILE) * TILE); y < Math.min(WH, view.y1 + TILE); y += TILE) for (let x = Math.max(0, Math.floor(view.x0 / TILE) * TILE); x < Math.min(WW, view.x1 + TILE); x += TILE) {
    const p = isPath(x, y), h = ((x * 7 + y * 13) / TILE) % 5;
    if (has('ground-auto-00')) { // cozy marching-squares autotile: corner is grass only if all 4 cells around it are grass
      let id; if (p) id = 'dirt-' + (h % 3);
      else { const g = (dx, dy) => !isPath(x + dx * TILE, y + dy * TILE) && !isPath(x + dx * TILE, y) && !isPath(x, y + dy * TILE);
        const idx = (g(-1, -1) ? 8 : 0) | (g(1, -1) ? 4 : 0) | (g(-1, 1) ? 2 : 0) | (g(1, 1) ? 1 : 0);
        id = idx === 15 ? (h === 0 ? 'tile-grass-flowers' : 'tile-grass') : 'ground-auto-' + String(idx).padStart(2, '0'); }
      if (tile(id, x, y)) continue; }
    if (tile(p ? pathTile(x, y) : h === 0 ? 'tile-grass-flowers' : 'tile-grass', x, y)) continue;
    ctx.fillStyle = p ? '#e8c88a' : ((x + y) / TILE) % 2 ? '#86d35a' : '#7bc950'; ctx.fillRect(x, y, TILE, TILE);
  }
  fields.forEach(f => {
    if (!onScreen(f.x + f.w / 2, f.y + f.h / 2, 300)) return;
    if (has('wheat-plowed')) { for (let y = f.y; y < f.y + f.h; y += TILE) for (let x = f.x; x < f.x + f.w; x += TILE) tile('wheat-plowed', x, y); }
    else { ctx.fillStyle = '#a0683a'; rr(f.x, f.y, f.w, f.h, 14); ctx.fill(); ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 4; ctx.stroke(); }
    // fence along the top of every field, with a gate on level-locked ones
    const gx = f.x + f.w / 2 - 64, lvlLock = f.lvl > 1;
    const stone = lvlLock && has('stone-wall-0');
    for (let x = f.x; x < f.x + f.w; x += TILE) { if (lvlLock && x >= gx && x < gx + 128) continue; if (!tile(stone ? 'stone-wall-' + ((x / TILE) % 4) : 'fence-horizontal', x, f.y - TILE)) { ctx.fillStyle = '#b9783f'; ctx.fillRect(x, f.y - 30, TILE, 6); ctx.fillRect(x, f.y - 18, TILE, 6); ctx.fillRect(x + 4, f.y - 40, 8, 34); } }
    if (stone) { art('wall-end-left', f.x + 20, f.y, 0, 0, {foot: 0}); art('wall-end-right', f.x + f.w - 20, f.y, 0, 0, {foot: 0}); }
    if (lvlLock) { const lk = fieldLevelLocked(f); if (!tile(lk ? 'gate-locked' : 'gate-open', gx, f.y - TILE, 128, 64)) { ctx.fillStyle = lk ? '#b9783f' : '#d9a066'; ctx.fillRect(gx, f.y - 34, 128, 20); } }
    const locked = !fieldOpen(f);
    if (locked) { ctx.fillStyle = 'rgba(60,40,20,.35)'; ctx.fillRect(f.x, f.y, f.w, f.h);
      const txt = fieldLevelLocked(f) ? `🔒 Level ${f.lvl}` : '🔒 Chop the trees!';
      outlined(txt, f.x + f.w / 2, f.y + f.h / 2 + 4, 28); if (fieldLevelLocked(f)) outlined(CROPS[f.crop].emoji + ' ' + CROPS[f.crop].name, f.x + f.w / 2, f.y + f.h / 2 + 38, 20, '#ffe066'); }
  });
  hedges.forEach(w => {
    if (has('fence-horizontal')) { for (let x = w.x; x < w.x + w.w; x += TILE) tile('fence-horizontal', x, w.y);
      for (let x = w.x + 16; x < w.x + w.w; x += 96) art(x % 192 < 96 ? 'bush-1' : 'bush-2', x, w.y + 60, 48, 48, {foot: 0}); return; }
    ctx.fillStyle = '#3e8e3a'; rr(w.x, w.y, w.w, w.h, 20); ctx.fill(); });
  decor.forEach(([id, x, y, sz]) => onScreen(x, y) && art(id, x, y, sz, sz, {foot: 0}));
  // marker rings
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
  [stallSpot, shopSpot, crateSpot].forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y, 46, 20, 0, 0, 7); ctx.stroke(); }); ctx.setLineDash([]);
}
function cropStage(p) { if (p.ripe) return 'ripe'; const g = 1 - p.t / p.max; return g < .25 ? 'harvested' : g < .45 ? 'seed' : g < .7 ? 'sprout' : 'growing'; }
const STAGE_WHEAT = {seed: 'wheat-seed', sprout: 'wheat-sprout', growing: 'wheat-growing', harvested: 'wheat-stubble'};
function drawCrop(p, T) {
  const f = fields[p.f]; if (!fieldOpen(f) || !onScreen(p.x, p.y)) return;
  const c = CROPS[p.crop], sz = c.size, y = p.y + 14 - (p.popT > 0 ? Math.round(p.popT * 20) : 0);
  const stage = cropStage(p);
  if (p.crop === 'wheat') { if (stage === 'ripe' ? (art('wheat-ripe-sway', p.x, y, sz, sz, {t: T + p.x * .013, foot: 0}) || art('wheat-ripe', p.x, y, sz, sz, {foot: 0})) : art(STAGE_WHEAT[stage], p.x, y, sz, sz, {foot: 0})) return; }
  else if (stage === 'ripe' && p.crop === 'pumpkin' && art(['crop-pumpkin-ripe', 'crop-pumpkin-ripe-b', 'crop-pumpkin-ripe-c'][(p.x / 64 + p.y / 64 | 0) % 3], p.x, y, sz, sz, {foot: 0})) return;
  else if (art(`crop-${p.crop}-${stage}`, p.x, y, sz, sz, {foot: 0})) return;
  // canvas fallback
  const k = stage === 'ripe' ? 1 : stage === 'growing' ? .7 : stage === 'sprout' ? .45 : stage === 'seed' ? .2 : 0;
  if (k === 0) { ctx.fillStyle = '#c8a060'; ctx.fillRect(p.x - 6, p.y + 2, 12, 3); return; }
  if (p.crop === 'wheat') { ctx.strokeStyle = '#c99a1e'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 5, p.y + 8); ctx.lineTo(p.x + i * 6, p.y + 8 - 26 * k); ctx.stroke(); }
    if (k === 1) { ctx.fillStyle = '#f4c542'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(p.x + i * 6, p.y - 18, 4, 8, i * .3, 0, 7); ctx.fill(); } } }
  else if (p.crop === 'carrot') { ctx.fillStyle = '#4caf50'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(p.x + i * 5, p.y - 4 - 8 * k, 3, 10 * k, i * .4, 0, 7); ctx.fill(); }
    if (k === 1) { ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 2); ctx.lineTo(p.x + 7, p.y + 2); ctx.lineTo(p.x, p.y + 12); ctx.fill(); } }
  else if (p.crop === 'corn') { ctx.fillStyle = '#5cb85c'; ctx.fillRect(p.x - 2, p.y + 8 - 36 * k, 4, 36 * k); ctx.beginPath(); ctx.ellipse(p.x - 7, p.y - 10 * k, 3, 10 * k, -.6, 0, 7); ctx.ellipse(p.x + 7, p.y - 16 * k, 3, 10 * k, .6, 0, 7); ctx.fill();
    if (k === 1) { ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.ellipse(p.x + 6, p.y - 18, 4, 9, .3, 0, 7); ctx.fill(); } }
  else { ctx.fillStyle = '#5cb85c'; ctx.beginPath(); ctx.ellipse(p.x - 8, p.y, 10 * k, 5 * k, 0, 0, 7); ctx.fill();
    if (k >= .7) { const r = 14 * k; ctx.fillStyle = '#ff8f1f'; ctx.beginPath(); ctx.ellipse(p.x, p.y - r + 6, r * 1.2, r, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#d96b00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y - r + 6, r * .5, r, 0, 0, 7); ctx.stroke(); ctx.fillStyle = '#6b8e23'; ctx.fillRect(p.x - 2, p.y - 2 * r + 2, 4, 6); } }
}
function treeShape(x, y, kind) {
  if (art('tree-' + kind, x, y, 128, 128)) return;
  ctx.fillStyle = '#8d5a2b'; ctx.fillRect(x - 10, y - 50, 20, 52);
  ctx.fillStyle = kind === 'pine' ? '#2e7d5b' : '#2e7d32'; ctx.beginPath(); ctx.arc(x, y - 75, 42, 0, 7); ctx.fill();
  ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x - 18, y - 90, 28, 0, 7); ctx.arc(x + 20, y - 85, 26, 0, 7); ctx.fill();
  if (kind === 'fruit') { ctx.fillStyle = '#e53935'; [[-20, -70], [15, -95], [22, -62]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a, y + b, 5, 0, 7); ctx.fill(); }); }
}
function drawTree(t) {
  if (!onScreen(t.x, t.y)) return;
  const id = 'tree-' + t.kind;
  if (t.hp <= 0) {
    if (!art(id + '-stump', t.x, t.y, 128, 128)) { ctx.fillStyle = '#8d5a2b'; ctx.beginPath(); ctx.ellipse(t.x, t.y, 18, 9, 0, 0, 7); ctx.fill(); }
    if (t.fall < 1) { const fr = Math.min(3, Math.floor(t.fall * 4)), alpha = t.fall > .7 ? 1 - (t.fall - .7) / .3 : 1;
      if (!art(id + '-falling', t.x, t.y, 128, 128, {frame: fr, alpha})) { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.fall * 1.5); ctx.globalAlpha = 1 - t.fall; treeShape(0, 0, t.kind); ctx.restore(); } }
    return; }
  shadow(t.x, t.y + 4, 34);
  const grow = t.pop > 0 && t.hp === t.max ? 1 - t.pop * .4 : 1;
  if (!(t.shake > 0 && art(id + '-shake', t.x, t.y, 128, 128, {t: performance.now() / 1000}))) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(grow, grow); treeShape(has(id) ? 0 : Math.sin(performance.now() / 25) * 5 * t.shake, 0, t.kind); ctx.restore(); }
}
function drawTreeNumber(t) {
  if (t.hp <= 0 || !(t.hp < t.max || Math.hypot(player.x - t.x, player.y - t.y) < 140)) return;
  const s = 1 + .5 * t.pop;
  ctx.save(); ctx.translate(t.x, t.y - 136); ctx.scale(s, s); outlined(String(t.hp), 0, 0, 40, t.hp < 300 ? '#ffdf5e' : '#fff'); ctx.restore();
}
function drawBuildings(T) {}
function drawBarn() { const x = 60, y = 110;
  if (!art('barn', x + 100, y + 150, 210, 210, {foot: 0})) {
    shadow(x + 100, y + 152, 110); ctx.fillStyle = '#d32f2f'; ctx.fillRect(x, y + 40, 200, 110);
    ctx.fillStyle = '#8e1b1b'; ctx.beginPath(); ctx.moveTo(x - 15, y + 45); ctx.lineTo(x + 100, y - 30); ctx.lineTo(x + 215, y + 45); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 70, y + 80, 60, 70); ctx.fillStyle = '#b71c1c'; ctx.fillRect(x + 76, y + 86, 48, 64); }
  outlined('🛠 UPGRADES', 160, 98, 18);
}
function drawStall() { const x = 432, y = 100;
  if (!art('market-stall', 512, y + 100, 170, 170, {foot: 0})) {
    shadow(512, y + 92, 90); ctx.fillStyle = '#a1662f'; ctx.fillRect(x, y + 40, 160, 55); ctx.fillStyle = '#6b4423'; ctx.fillRect(x + 4, y - 20, 8, 60); ctx.fillRect(x + 148, y - 20, 8, 60);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ff7043'; ctx.fillRect(x - 10 + i * 22.5, y - 30, 22.5, 25); } }
  outlined('🏪 MARKET', 512, 86, 20);
}
function drawCounter() { // blue sell counter in front of the stall
  if (art('market-counter-blue', 512, 262, 150, 150, {foot: 0})) return;
  shadow(512, 258, 80); ctx.fillStyle = '#4a90e2'; rr(444, 212, 136, 48, 10); ctx.fill(); ctx.strokeStyle = '#2f6db5'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(444, 212, 136, 8); outlined('SELL', 512, 248, 20, '#fff', '#2f6db5');
}
function drawCrate() { const {x, y} = crateSpot, cy = y - 34;
  if (art('crate', x, cy + 4, 72, 64, {foot: 0})) { outlined('📦 CRATE', x, cy - 70, 15); outlined('½ price', x, cy + 26, 12, '#ffe066'); return; }
  shadow(x, cy + 4, 34); ctx.fillStyle = '#c98b4c'; rr(x - 30, cy - 34, 60, 38, 6); ctx.fill(); ctx.strokeStyle = '#8d5a2b'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 30, cy - 21); ctx.lineTo(x + 30, cy - 21); ctx.moveTo(x - 30, cy - 9); ctx.lineTo(x + 30, cy - 9); ctx.stroke();
  outlined('📦 CRATE', x, cy - 44, 15); outlined('½ price', x, cy + 26, 12, '#ffe066'); }
function drawWindmill(T) { const {x, y} = WINDMILL;
  shadow(x, y - 2, 46);
  if (art('windmill', x, y, 176, 176, {action: 'spin', t: T, foot: 0})) return;
  if (art('windmill-base', x, y, 176, 176, {foot: 0})) { const s = 176 / 192, px = x, py = y - 176 + 64 * s;
    if (ART['windmill-blades']) { const a = ART['windmill-blades'], bw = 144 * s; ctx.save(); ctx.translate(px, py); ctx.rotate(T * 1.6); ctx.drawImage(a.img, -bw / 2, -bw / 2, bw, bw); ctx.restore(); } return; }
  ctx.fillStyle = '#f3e0c0'; ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 18, y - 110); ctx.lineTo(x + 18, y - 110); ctx.lineTo(x + 30, y); ctx.fill();
  ctx.fillStyle = '#d9534f'; ctx.beginPath(); ctx.moveTo(x - 24, y - 108); ctx.lineTo(x, y - 140); ctx.lineTo(x + 24, y - 108); ctx.fill();
  ctx.fillStyle = '#8d5a2b'; rr(x - 10, y - 30, 20, 30, 8); ctx.fill();
  ctx.save(); ctx.translate(x, y - 112); ctx.rotate(T * 1.6);
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#b9783f'; ctx.fillRect(-3, 0, 6, 62); ctx.fillStyle = '#fff4dc'; ctx.fillRect(3, 14, 16, 46); ctx.strokeStyle = '#b9783f'; ctx.lineWidth = 2; ctx.strokeRect(3, 14, 16, 46); }
  ctx.restore(); ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.arc(x, y - 112, 7, 0, 7); ctx.fill();
}
function drawChicken(c) {
  if (!onScreen(c.x, c.y)) return;
  shadow(c.x, c.y + 1, 12);
  if (art('chicken', c.x, c.y, 46, 46, {action: c.st, t: c.anim, flip: c.face > 0, foot: 7 / 64})) return;
  const peck = c.st === 'peck' ? Math.max(0, Math.sin(c.anim * 10)) * 7 : 0, b = c.st === 'walk' ? Math.abs(Math.sin(c.anim * 14)) * 2 : 0;
  ctx.save(); ctx.translate(c.x, c.y - b); ctx.scale(-c.face, 1);
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-3, 0); ctx.moveTo(3, -6); ctx.lineTo(3, 0); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -14, 13, 10, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(18, -26); ctx.lineTo(14, -12); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, -24 + peck, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(-10, -32 + peck, 3, 0, 7); ctx.arc(-7, -31 + peck, 2.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.moveTo(-16, -25 + peck); ctx.lineTo(-22, -22 + peck); ctx.lineTo(-16, -20 + peck); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(-12, -26 + peck, 2, 2); ctx.restore();
}
function drawPickup(p, T) { const bob = Math.sin(T * 5 + p.x) * 3;
  if (p.k === 'wood') { if (!art('log-pile', p.x, p.y + bob, 64, 64)) { ctx.fillStyle = '#a0662f'; for (let i = 0; i < 3; i++) { rr(p.x - 22 + i * 4, p.y - 12 - i * 9 + bob, 40, 10, 5); ctx.fill(); } } }
  else if (!art('apple', p.x, p.y + bob, 24, 24, {foot: 0})) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🍎', p.x, p.y + bob); }
}
const shirt = ['#42a5f5', '#ab47bc', '#ff7043', '#26a69a'], hair = ['#5d4037', '#212121', '#ffb300', '#8d4925'];
function drawCustomer(c, T) { const x = c.x, y = c.y, id = 'customer-' + (c.kind + 1);
  shadow(x, y + 2, 16);
  const settled = !c.leaving && Math.abs(c.x - (600 + c.slot * 60)) < 4;
  const act = c.leaving ? (c.leaving < .7 ? 'happy' : 'walk-left') : settled ? 'waiting' : 'walk-left';
  if (!art(id, x, y, 84, 84, {t: T, action: act})) { const b = settled ? 0 : Math.abs(Math.sin(T * 8 + c.x)) * 3;
    ctx.fillStyle = shirt[c.kind]; rr(x - 13, y - 38 - b, 26, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x, y - 50 - b, 13, 0, 7); ctx.fill();
    ctx.fillStyle = hair[c.kind]; ctx.beginPath(); ctx.arc(x, y - 54 - b, 13, 3.3, 6.1); ctx.fill();
    ctx.fillStyle = '#555'; ctx.fillRect(x - 10, y - 8, 8, 10); ctx.fillRect(x + 2, y - 8, 8, 10); }
  if (c.leaving) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💖', x, y - 84 - c.leaving * 20); return; }
  if (!settled) return;
  const items = Object.keys(c.order).filter(k => c.got[k] < c.order[k]); if (!items.length) return;
  const w = items.length * 46 + 10, bx = x - w / 2, by = y - 112 - (c.slot % 2) * 32;
  ctx.fillStyle = '#fff'; rr(bx, by, w, 30, 12); ctx.fill(); ctx.strokeStyle = c.slot === 0 ? '#4a90e2' : '#d9a066'; ctx.lineWidth = c.slot === 0 ? 3 : 2; ctx.stroke();
  items.forEach((k, i) => { const miss = S.inv[k] <= 0 && c.slot === 0, bo = miss ? -Math.abs(Math.sin(T * 6)) * 5 : 0; const ix = bx + 8 + i * 46; const ic = iconFor(k);
    if (miss) { ctx.fillStyle = 'rgba(255,90,90,.25)'; rr(ix - 3, by + 2, 44, 26, 8); ctx.fill(); } ctx.save(); ctx.translate(0, bo);
    if (!(ic && art(ic, ix + 10, by + 26, 24, 24, {foot: 0, fit: true}))) { ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(EMOJI[k], ix + 10, by + 22); }
    ctx.fillStyle = '#4a2f14'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(c.order[k] - c.got[k], ix + 23, by + 21); ctx.restore(); });
}
function drawPlayer(T) { const {x, y, dir} = player, mv = player.moving;
  shadow(x, y + 2, 20);
  const sheet = has('farmer-blue') ? 'farmer-blue' : has('farmer') ? 'farmer' : null;
  const n = carried();
  if (sheet) {
    const act = player.chop > 0 || (player.target && !mv) ? 'chop' : player.harvestT > 0 && !mv ? 'harvest' : player.cheerT > 0 && !mv ? 'cheer'
      : mv ? (n > 0 ? 'carry-' : 'walk-') + player.face : 'idle';
    art(sheet, x, y, 100, 100, {t: mv ? player.t : T, action: act, flip: (act === 'chop' || act === 'harvest' || act === 'cheer') && dir < 0});
  } else {
    const b = mv ? Math.abs(Math.sin(player.t * 12)) * 4 : 0, leg = mv ? Math.sin(player.t * 12) * 6 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = '#1e5aa8'; ctx.fillRect(-10 + leg, -14, 8, 14); ctx.fillRect(2 - leg, -14, 8, 14);
    ctx.fillStyle = '#5d4037'; ctx.fillRect(-12 + leg, -2, 11, 5); ctx.fillRect(1 - leg, -2, 11, 5);
    ctx.translate(0, -b); ctx.fillStyle = '#fff4dc'; rr(-14, -44, 28, 24, 8); ctx.fill();
    ctx.fillStyle = '#1e88e5'; rr(-13, -34, 26, 22, 6); ctx.fill(); ctx.fillRect(-10, -44, 5, 12); ctx.fillRect(5, -44, 5, 12);
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(0, -56, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(3, -59, 3, 4); ctx.fillRect(-4, -59, 3, 4);
    ctx.fillStyle = '#8d5a2b'; ctx.beginPath(); ctx.ellipse(0, -66, 24, 6, 0, 0, 7); ctx.fill(); rr(-13, -82, 26, 16, 6); ctx.fill();
    ctx.restore(); }
  if (n > 0) { const cap = U('basket'); ctx.fillStyle = n >= cap ? '#ffcdd2' : '#fff'; rr(x - 30, y - 118, 60, 24, 10); ctx.fill(); ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4a2f14'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`🧺 ${n}/${cap}`, x, y - 101); }
}
function draw(T) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  const hw = vw / 2 / scale, hh = vh / 2 / scale;
  cam.x += (player.x - cam.x) * .15; cam.y += (player.y - cam.y) * .15;
  cam.cx = WW < hw * 2 ? WW / 2 : Math.max(hw, Math.min(WW - hw, cam.x)); cam.cy = WH < hh * 2 ? WH / 2 : Math.max(hh, Math.min(WH - hh, cam.y));
  view = {x0: cam.cx - hw, y0: cam.cy - hh, x1: cam.cx + hw, y1: cam.cy + hh};
  ctx.fillStyle = '#5aa83c'; ctx.fillRect(0, 0, vw, vh);
  const sk = camShake > 0 ? (Math.random() - .5) * 10 * camShake / .3 : 0;
  const z = scale * dpr; ctx.setTransform(z, 0, 0, z, Math.round(vw / 2 * dpr - cam.cx * z + sk * dpr), Math.round(vh / 2 * dpr - cam.cy * z + sk * dpr)); ctx.imageSmoothingEnabled = false;
  drawGround();
  const list = [];
  // crops sort slightly "behind" their row so the farmer's legs stay visible in the field
  plants.forEach(p => list.push([p.y - 24, () => drawCrop(p, T)]));
  trees.forEach(t => list.push([t.y, () => drawTree(t)]));
  customers.forEach(c => list.push([c.y, () => drawCustomer(c, T)]));
  chickens.forEach(c => list.push([c.y, () => drawChicken(c)]));
  pickups.forEach(p => list.push([p.y, () => drawPickup(p, T)]));
  list.push([256, drawBarn], [200, drawStall], [262, drawCounter], [crateSpot.y - 30, drawCrate], [WINDMILL.y, () => drawWindmill(T)], [player.y, () => drawPlayer(T)]);
  list.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  trees.forEach(drawTreeNumber);
  fx.forEach(f => art(f.id, f.x, f.y, 64, 64, {frame: Math.floor(f.t * 10), foot: 0}));
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / .7); ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }); ctx.globalAlpha = 1;
  floats.forEach(f => { ctx.globalAlpha = Math.min(1, f.life * 2); outlined(f.text, f.x, f.y, f.size, f.color, '#4a2f14'); }); ctx.globalAlpha = 1;
  // screen space: flyers + joystick
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  flyers.forEach(f => { if (f.t < 0) return; const to = typeof f.to === 'function' ? f.to() : f.to, k = Math.min(1, f.t / f.dur), e = k * k * (3 - 2 * k);
    const x = f.x0 + (to.x - f.x0) * e, y = f.y0 + (to.y - f.y0) * e - Math.sin(k * Math.PI) * 60; const ic = iconFor(f.k);
    if (!(ic && art(ic, x, y + 14, 32, 32, {foot: 0, fit: true}))) { ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(EMOJI[f.k], x, y + 8); } });
  if (joy.active) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, 60, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 60, joy.by + joy.dy * 60, 26, 0, 7); ctx.fill(); }
}
function updateFlyers(dt) { flyers.forEach(f => { f.t += dt; if (f.t >= f.dur && !f.fin) { f.fin = true; f.done && f.done(); } }); flyers = flyers.filter(f => !f.fin); }

// ================= HUD =================
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
let hudKeys = '';
function hud() {
  const keysShown = ['coins', ...Object.keys(CROPS).filter(k => CROPS[k].lvl <= S.level), ...(S.inv.apple > 0 ? ['apple'] : []), 'wood'];
  const sig = keysShown.join() + (iconsDirty ? '!' : '');
  if (sig !== hudKeys) { iconsDirty = false; hudKeys = keysShown.join();
    $('res').innerHTML = keysShown.map(k => { const ic = iconFor(k); return `<div class="pill${k === 'coins' ? ' coin' : ''}" data-k="${k}">${ic ? `<img class="icon" src="${iconSrc(ic)}" alt="">` : EMOJI[k]}<span></span></div>`; }).join(''); }
  keysShown.forEach(k => { const el = document.querySelector(`#res [data-k="${k}"] span`); const v = String(k === 'coins' ? S.coins : S.inv[k]); if (el && el.textContent !== v) el.textContent = v; });
  const lo = needXp(S.level), hi = needXp(S.level + 1);
  $('lvl').textContent = 'Lv ' + S.level; $('xpFill').style.width = Math.min(100, (S.xp - lo) / (hi - lo) * 100) + '%';
  $('timePill').classList.toggle('hidden', S.mode === 'farm');
  $('time').textContent = fmt(S.mode === 'goal' ? S.time : Math.max(0, S.left));
  if (S.mode === 'goal') { $('goalFill').style.width = Math.min(100, S.coins / S.goal * 100) + '%'; $('goalText').textContent = `${S.coins} / ${S.goal} coins`; }
}

// ================= Shop =================
function openShop() { S.paused = true; joy.active = false; renderShop(); $('shop').classList.remove('hidden'); }
function renderShop() {
  $('shopCoins').textContent = S.coins;
  $('shopList').innerHTML = Object.entries(UPG).map(([k, u]) => { const lv = S.upg[k], max = u.vals.length - 1, price = u.prices[lv];
    const ic = ART['upgrade-' + k] ? `<img src="${ART['upgrade-' + k].img.src}" width="48" height="48" alt="">` : u.emoji;
    return `<div class="upg"><div class="ic">${ic}</div><div class="info"><div class="nm">${u.name} <span class="dots">${'★'.repeat(lv)}${'☆'.repeat(max - lv)}</span></div>
      <div class="ef">${u.desc}: ${u.show(u.vals[lv])}${lv < max ? ' → <b>' + u.show(u.vals[lv + 1]) + '</b>' : ' (max!)'}</div></div>
      ${lv < max ? `<button data-u="${k}" ${S.coins < price ? 'disabled' : ''}>🪙 ${price}</button>` : '<button disabled>MAX</button>'}</div>`; }).join('');
  $('shopList').querySelectorAll('button[data-u]').forEach(b => b.onclick = () => { const k = b.dataset.u, price = UPG[k].prices[S.upg[k]];
    if (S.coins < price) return; S.coins -= price; S.upg[k]++; saveFarm(); beep(880, .12, 'triangle', .08); setTimeout(() => beep(1175, .15, 'triangle', .08), 100); renderShop(); });
}
$('shopBtn').onclick = () => S && S.running && openShop();
$('shopClose').onclick = () => { $('shop').classList.add('hidden'); S.paused = false; };

// ================= Level up =================
function showLevelUp(l) {
  S.paused = true; joy.active = false;
  $('luTitle').textContent = `Level ${l}! 🎉`;
  $('luText').innerHTML = (UNLOCK[l] || '🎁 Customers order more and tip extra!') + '<br><small>Keep farming to reach the next level.</small>';
  const cf = $('confetti'); cf.innerHTML = '';
  for (let i = 0; i < 60; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + 'vw'; s.style.background = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#c77dff'][i % 6]; s.style.animationDelay = Math.random() * .8 + 's'; s.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; cf.appendChild(s); }
  $('levelUp').classList.remove('hidden'); saveFarm();
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .18, 'triangle', .08), i * 110));
}
$('luOk').onclick = () => { $('levelUp').classList.add('hidden'); S.paused = false; hudKeys = ''; if (S.levelQueue.length) showLevelUp(S.levelQueue.shift()); };

// ================= Flow =================
let last = 0;
function loop(ts) { const T = ts / 1000, dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (S && S.running && !S.paused) { try { update(dt); } catch (e) { console.warn('update error', e); } }
  if (S) { try { updateFlyers(dt); if (S.running) hud(); draw(T); } catch (e) { console.warn('draw error', e); } }
  requestAnimationFrame(loop); }
function start(mode) {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } ac?.resume?.();
  reset(mode); hudKeys = '';
  ['startScreen', 'endScreen', 'shop', 'levelUp'].forEach(i => $(i).classList.add('hidden'));
  $('hud').classList.remove('hidden'); $('goalBar').classList.toggle('hidden', mode !== 'goal');
  showHint(); beep(523, .12, 'triangle', .07);
}
function endRound() {
  if (!S.running) return; S.running = false; joy.active = false; saveFarm();
  ['hud', 'hint', 'tip', 'shop', 'levelUp'].forEach(i => $(i).classList.add('hidden'));
  let stars = 1, title = 'Great job!', text;
  if (S.mode === 'farm') { title = 'Farm saved! 🚜'; stars = Math.min(3, Math.max(1, S.level - 1)); text = `Level ${S.level} · ${S.coins} coins. Your farm will be waiting for you!`; $('replayBtn').textContent = '🚜 Keep Farming'; }
  else if (S.mode === 'goal') { $('replayBtn').textContent = '🔁 Play Again';
    if (S.coins >= S.goal) { stars = S.time < 150 ? 3 : S.time < 240 ? 2 : 1;
      const best = +localStorage.getItem('hhf-best-goal') || 0, nb = !best || S.time < best; if (nb) localStorage.setItem('hhf-best-goal', S.time.toFixed(1));
      text = `You earned ${S.coins} coins in ${fmt(S.time)}!` + (nb ? ' 🏆 New best time!' : ''); title = 'Goal reached! 🎉';
    } else { stars = 0; title = 'Nice farming!'; text = `You earned ${S.coins} coins. Try again to reach ${S.goal}!`; } }
  else { $('replayBtn').textContent = '🔁 Play Again';
    const best = +localStorage.getItem('hhf-best-endless') || 0, nb = S.coins > best; if (nb) localStorage.setItem('hhf-best-endless', S.coins);
    stars = S.coins >= 800 ? 3 : S.coins >= 400 ? 2 : 1; title = nb ? 'New high score! 🏆' : 'Time\'s up!'; text = `You earned ${S.coins} coins!` + (nb ? '' : ` Best: ${best}`); }
  $('endTitle').textContent = title; $('endText').textContent = text; $('stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  $('endScreen').classList.remove('hidden'); beep(784, .3, 'triangle', .08); refreshMenu();
}
function refreshMenu() {
  $('bestEndless').textContent = localStorage.getItem('hhf-best-endless') || 0; const g = localStorage.getItem('hhf-best-goal'); $('bestGoal').textContent = g ? fmt(+g) : '—';
  const p = loadFarm(); $('farmInfo').textContent = `Level ${p.level} · 🪙 ${p.coins} · keeps your progress`;
}
let newFarmArm = 0;
$('newFarmBtn').onclick = () => {
  if (Date.now() - newFarmArm > 3000) { newFarmArm = Date.now(); $('newFarmBtn').textContent = '⚠️ Tap again to start a brand-new farm'; setTimeout(() => { $('newFarmBtn').textContent = '🌱 New farm (start over)'; }, 3000); return; }
  localStorage.removeItem(SAVE_KEY); newFarmArm = 0; $('newFarmBtn').textContent = '✅ New farm ready!'; refreshMenu();
};
$('farmBtn').onclick = () => start('farm'); $('goalBtn').onclick = () => start('goal'); $('endlessBtn').onclick = () => start('endless');
$('replayBtn').onclick = () => start(S.mode);
$('menuBtn').onclick = () => { $('endScreen').classList.add('hidden'); $('startScreen').classList.remove('hidden'); };
$('quitBtn').onclick = () => endRound();
refreshMenu(); reset('goal'); S.running = false; requestAnimationFrame(loop);
// hooks for automated tests
window.HHF = {cropStage: p => cropStage(p), get plants() { return plants; }, ART, CROPS, UPG, needXp, get S() { return S; }, get player() { return player; }, get trees() { return trees; }, get fields() { return fields; }, get chickens() { return chickens; },
  get customers() { return customers; }, get pickups() { return pickups; }, stallSpot, shopSpot, crateSpot, fieldOpen: f => fieldOpen(f), save: saveFarm};
})();
