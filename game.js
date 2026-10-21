// Harvest Hero Farm — free, no ads, no purchases. Pure canvas, no dependencies.
(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const WW = 1024, WH = 1408; // 16 x 22 tiles of 64px
let vw = 0, vh = 0, dpr = 1, scale = 1;

// ---------- Optional art (assets/art/manifest.json, Artie's format; see ART.md) ----------
const ART = {}, TILE = 64;
fetch('assets/art/manifest.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(m => {
  if (!m) return;
  const list = m.assets || m.files || [];
  const hi = (window.devicePixelRatio || 1) > 1.2;
  for (const e of list) {
    if (!e.id || !e.file || ART[e.id]) continue;
    const img = new Image();
    img.onload = () => {
      const sc = img.naturalWidth / (e.width || img.naturalWidth);
      ART[e.id] = {img, e, sc, fw: (e.frameWidth || e.width || img.naturalWidth), fh: (e.frameHeight || e.height || img.naturalHeight),
        rows: (e.rows || [{action: 'default', frames: 1, fps: 1}]).map((r, i) => ({row: i, ...r}))};
      if (e.id.startsWith('icon-')) hudIcons();
    };
    img.src = 'assets/art/' + (hi && e.file2x ? e.file2x : e.file);
  }
}).catch(() => {});
// Look up "id" directly, else "base" + row action (e.g. player-walk -> id "player", row action "walk").
function findArt(id, action) {
  const a = ART[id];
  if (a) { if (!action) return [a, a.rows[0]]; const r = a.rows.find(r => r.action === action); return r ? [a, r] : null; }
  const i = id.lastIndexOf('-'); if (i < 0 || action) return null;
  return findArt(id.slice(0, i), id.slice(i + 1));
}
const has = (id, act) => !!findArt(id, act);
// Draw sprite anchored bottom-centre at (x,y). Artie's 128px frames have feet at ~y114, so we drop by that margin.
// opts: {t: time for animation, frame: explicit frame, flip, action, alpha, foot: fraction of frame below feet}
function art(id, x, y, w, h, o = {}) {
  const f = findArt(id, o.action); if (!f) return false;
  const [a, row] = f, n = row.frames || 1;
  const fr = o.frame != null ? Math.min(n - 1, o.frame) : Math.floor((o.t || 0) * (row.fps || 8)) % n;
  const foot = o.foot != null ? o.foot : (a.fh === 128 ? 14 / 128 : 0);
  ctx.save(); ctx.translate(x, y + h * foot); if (o.flip) ctx.scale(-1, 1); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(a.img, fr * a.fw * a.sc, row.row * a.fh * a.sc, a.fw * a.sc, a.fh * a.sc, -w / 2, -h, w, h);
  ctx.restore(); return true;
}
function tile(id, x, y) { return art(id, x + TILE / 2, y + TILE, TILE, TILE, {foot: 0}); }
function hudIcons() {
  [['wheatPill', 'icon-wheat'], ['coinPill', 'icon-coin']].forEach(([p, id]) => { const a = ART[id], el = $(p); if (!a || el.querySelector('img')) return;
    el.firstChild.textContent = ''; const im = document.createElement('img'); im.src = a.img.src; im.className = 'icon'; el.insertBefore(im, el.firstChild); });
}

// ---------- Sound (soft synth, only after a tap) ----------
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

// ---------- World ----------
const fields = [
  {x: 128, y: 448, w: 320, h: 256, locked: false},
  {x: 576, y: 448, w: 320, h: 256, locked: false},
  {x: 128, y: 960, w: 320, h: 256, locked: true},
  {x: 576, y: 960, w: 320, h: 256, locked: true},
];
const walls = [ // hedges + buildings (rects)
  {x: 0, y: 768, w: 416, h: 64, hedge: true}, {x: 608, y: 768, w: 416, h: 64, hedge: true},
  {x: 64, y: 128, w: 192, h: 128, barn: true},
  {x: 448, y: 128, w: 128, h: 64, stall: true},
];
const stallSpot = {x: 512, y: 256};
let plants, trees, customers, floats, parts, fx, player, S;

function reset(mode) {
  plants = [];
  fields.forEach((f, fi) => { f.open = !f.locked;
    for (let y = f.y + 24; y < f.y + f.h; y += 32) for (let x = f.x + 16; x < f.x + f.w; x += 32)
      plants.push({x, y, f: fi, ripe: true, t: 0});
  });
  trees = [448, 512, 576].map(x => ({x, y: 816, hp: 1000, max: 1000, gate: true}))
    .concat([{x: 928, y: 256}, {x: 960, y: 640}, {x: 64, y: 640}, {x: 352, y: 1344}, {x: 736, y: 1344}].map(p => ({...p, hp: 1000, max: 1000})));
  trees.forEach((t, i) => Object.assign(t, {shake: 0, fall: 0, hitT: 0, kind: ['round', 'pine', 'fruit'][i % 3]}));
  customers = []; for (let i = 0; i < 3; i++) addCustomer(i);
  floats = []; parts = []; fx = [];
  player = {x: 512, y: 380, face: 'down', harvestT: 0, cheerT: 0, dir: 1, moving: false, t: 0, chop: 0};
  S = {mode, wheat: 0, coins: 0, time: 0, left: 180, sellT: 0, running: true, goal: 500};
}
function addCustomer(i = customers.length) {
  customers.push({x: 1080, slot: i, want: 4 + Math.floor(Math.random() * 7), got: 0, kind: Math.floor(Math.random() * 4), leaving: 0, y: 300});
}

// ---------- Input ----------
const joy = {active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0};
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('pointerdown', e => {
  if (!S || !S.running) return; e.preventDefault();
  joy.active = true; joy.id = e.pointerId; joy.bx = e.clientX; joy.by = e.clientY; joy.dx = joy.dy = 0;
  cv.setPointerCapture?.(e.pointerId); hideHint();
  // tap a tree to chop it from a little further away
  const w = toWorld(e.clientX, e.clientY);
  for (const t of trees) if (t.hp > 0 && Math.hypot(w.x - t.x, w.y - (t.y - 40)) < 60 && Math.hypot(player.x - t.x, player.y - t.y) < 160) { player.target = t; }
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
function toWorld(cx, cy) { return {x: (cx - vw / 2) / scale + cam.x, y: (cy - vh / 2) / scale + cam.y}; }

let hintShown = false;
function showHint() { if (!localStorage.getItem('hhf-hint')) { $('hint').classList.remove('hidden'); hintShown = true; } }
function hideHint() { if (hintShown) { $('hint').classList.add('hidden'); localStorage.setItem('hhf-hint', '1'); hintShown = false; } }

// ---------- Resize ----------
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2.5); vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  scale = Math.max(.55, Math.min(1.5, Math.min(vw, vh) / 520));
}
addEventListener('resize', resize); resize();

// ---------- Helpers ----------
function float(x, y, text, color = '#fff', size = 26) { floats.push({x, y, text, color, size, life: 1}); }
function spawnFx(id, x, y) { if (has(id)) fx.push({id, x, y, t: 0}); }
function burst(x, y, color, n = 8) { const bf = burstFx; burstFx = null; if (fx && bf && has(bf)) { spawnFx(bf, x, y + 24); return; } for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 140; parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: .7, color}); } }
function bump(id) { const el = $(id); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
let camShake = 0, burstFx = null;
function collide(nx, ny) {
  const r = 16;
  nx = Math.max(r, Math.min(WW - r, nx)); ny = Math.max(r + 40, Math.min(WH - r, ny));
  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(w.x + w.w, nx)), cy = Math.max(w.y, Math.min(w.y + w.h, ny));
    const dx = nx - cx, dy = ny - cy, d = Math.hypot(dx, dy);
    if (d < r) { if (d === 0) { ny = w.y + w.h + r; } else { nx = cx + dx / d * r; ny = cy + dy / d * r; } }
  }
  for (const t of trees) if (t.hp > 0) { const dx = nx - t.x, dy = ny - t.y, d = Math.hypot(dx, dy), m = r + 26; if (d < m && d > 0) { nx = t.x + dx / d * m; ny = t.y + dy / d * m; } }
  return [nx, ny];
}

// ---------- Update ----------
const cam = {x: 512, y: 400};
function update(dt) {
  S.time += dt; if (S.mode === 'endless') S.left -= dt;
  let mx = joy.dx, my = joy.dy;
  if (keys['a'] || keys['arrowleft']) mx -= 1; if (keys['d'] || keys['arrowright']) mx += 1;
  if (keys['w'] || keys['arrowup']) my -= 1; if (keys['s'] || keys['arrowdown']) my += 1;
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  player.moving = m > .1;
  if (player.moving) { hideHint(); player.target = null; const sp = 270;
    [player.x, player.y] = collide(player.x + mx * sp * dt, player.y + my * sp * dt);
    if (Math.abs(mx) > .1) player.dir = mx > 0 ? 1 : -1; player.face = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up'); player.t += dt; }
  // tap-target walk
  if (player.target && !player.moving) { const t = player.target, dx = t.x - player.x, dy = t.y + 40 - player.y, d = Math.hypot(dx, dy);
    if (t.hp <= 0) player.target = null; else if (d > 50) { [player.x, player.y] = collide(player.x + dx / d * 270 * dt, player.y + dy / d * 270 * dt); player.t += dt; player.dir = dx > 0 ? 1 : -1; } }
  // harvest
  for (const p of plants) {
    if (!fields[p.f].open) continue;
    if (p.ripe) { if (Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 30) {
      p.ripe = false; p.t = p.max = 6 + Math.random() * 2; S.wheat++; player.harvestT = .35; float(p.x, p.y - 20, '+1', '#ffe066', 22); burstFx = 'fx-wheat-bits'; burst(p.x, p.y, '#f4c542', 4); bump('wheatPill'); beep(660 + Math.random() * 200, .06, 'triangle', .05); }
    } else if ((p.t -= dt) <= 0) p.ripe = true;
  }
  // chop
  player.chop = Math.max(0, player.chop - dt);
  for (const t of trees) {
    t.shake = Math.max(0, t.shake - dt * 4);
    if (t.hp <= 0) { t.fall = Math.min(1, t.fall + dt * 1.4); continue; }
    if (Math.hypot(player.x - t.x, player.y - t.y) < 72) {
      if ((t.hitT -= dt) <= 0) { t.hitT = .13; const dmg = 55 + Math.floor(Math.random() * 40);
        t.hp = Math.max(0, t.hp - dmg); t.shake = 1; player.chop = .13; player.dir = t.x > player.x ? 1 : -1;
        float(t.x + (Math.random() * 40 - 20), t.y - 110, '-' + dmg, '#ff6b6b', 22); burstFx = 'fx-wood-chips'; burst(t.x, t.y - 30, '#8d5a2b', 3); beep(180, .05, 'square', .03);
        if (t.hp === 0) { spawnFx('fx-dust', t.x, t.y + 10); spawnFx('fx-leaf', t.x, t.y - 50); burst(t.x, t.y - 50, '#4caf50', 20); camShake = .3; S.coins += 20; float(t.x, t.y - 140, 'TIMBER! +20🪙', '#fff', 28); bump('coinPill'); beep(330, .3, 'triangle', .08);
          if (t.gate && trees.filter(g => g.gate).every(g => g.hp <= 0)) { fields[2].open = fields[3].open = true; float(512, 900, 'New fields opened! 🌾', '#ffe066', 32); [fields[2], fields[3]].forEach(f => spawnFx('fx-sparkle', f.x + f.w / 2, f.y + f.h / 2)); beep(880, .4, 'sine', .08); } }
      }
    }
  }
  // customers
  customers.forEach((c, i) => {
    if (c.leaving) { c.leaving += dt; if (c.leaving > .6) c.x -= 200 * dt; return; }
    c.slot = i; const tx = 512 + i * 60; c.x += (tx - c.x) * Math.min(1, dt * 4);
  });
  customers = customers.filter(c => c.x > -80);
  const queue = customers.filter(c => !c.leaving);
  while (queue.length < 3) { const c = {x: 1080, want: 4 + Math.floor(Math.random() * 7), got: 0, kind: Math.floor(Math.random() * 4), leaving: 0, y: 300}; customers.push(c); queue.push(c); }
  customers.sort((a, b) => (a.leaving ? -1 : 0) - (b.leaving ? -1 : 0));
  const front = queue[0];
  if (Math.hypot(player.x - stallSpot.x, player.y - stallSpot.y) < 70 && S.wheat > 0 && front && Math.abs(front.x - 512) < 20) {
    if ((S.sellT -= dt) <= 0) { S.sellT = .1; S.wheat--; front.got++; bump('wheatPill'); float(player.x, player.y - 60, '-1🌾', '#fff', 18); beep(520, .04, 'sine', .04);
      if (front.got >= front.want) { const pay = front.want * 5 + 5; S.coins += pay; front.leaving = .01;
        float(512, 200, '+' + pay + '🪙', '#ffd700', 34); spawnFx('fx-coin-sparkle', 512, 230); burst(512, 240, '#ffd700', 14); player.cheerT = .8; bump('coinPill'); camShake = .15; beep(990, .15, 'triangle', .08); setTimeout(() => beep(1320, .15, 'triangle', .07), 90); } }
  }
  floats.forEach(f => { f.y -= 50 * dt; f.life -= dt * .9; }); floats = floats.filter(f => f.life > 0);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  camShake = Math.max(0, camShake - dt); player.harvestT = Math.max(0, player.harvestT - dt); player.cheerT = Math.max(0, player.cheerT - dt);
  fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < .4);
  // end conditions
  if (S.mode === 'goal' && S.coins >= S.goal) endRound();
  if (S.mode === 'endless' && S.left <= 0) { S.left = 0; endRound(); }
}

// ---------- Draw ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function shadow(x, y, rx) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .4, 0, 0, 7); ctx.fill(); }
const isPath = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH && (((x === 448 || x === 512) && y >= 256) || (y === 320 && x >= 64 && x < 960));
function pathTile(x, y) {
  const n = !isPath(x, y - TILE), s = !isPath(x, y + TILE), w = !isPath(x - TILE, y), e = !isPath(x + TILE, y);
  if (n && w) return 'tile-path-corner-outer-nw'; if (n && e) return 'tile-path-corner-outer-ne';
  if (s && w) return 'tile-path-corner-outer-sw'; if (s && e) return 'tile-path-corner-outer-se';
  if (n) return 'tile-path-edge-n'; if (s) return 'tile-path-edge-s'; if (w) return 'tile-path-edge-w'; if (e) return 'tile-path-edge-e';
  return 'tile-dirt-path';
}
const decor = [['well', 990, 1250, 96], ['flower-red', 300, 260, 28], ['flower-yellow', 700, 410, 28], ['flower-purple', 960, 420, 28], ['flower-white', 40, 900, 28],
  ['rock-1', 680, 900, 40], ['rock-2', 40, 400, 40], ['bush-1', 990, 900, 56], ['bush-2', 300, 1380, 56], ['flower-red', 880, 1250, 28]];
function drawGround() {
  for (let y = 0; y < WH; y += TILE) for (let x = 0; x < WW; x += TILE) {
    const p = isPath(x, y), h = ((x * 7 + y * 13) / TILE) % 5;
    if (tile(p ? pathTile(x, y) : h === 0 ? 'tile-grass-flowers' : 'tile-grass', x, y)) continue;
    ctx.fillStyle = p ? '#e8c88a' : ((x + y) / TILE) % 2 ? '#86d35a' : '#7bc950'; ctx.fillRect(x, y, TILE, TILE);
  }
  fields.forEach(f => {
    let tiled = has('wheat-plowed');
    if (tiled) for (let y = f.y; y < f.y + f.h; y += TILE) for (let x = f.x; x < f.x + f.w; x += TILE) tile('wheat-plowed', x, y);
    else { ctx.fillStyle = f.open ? '#a0683a' : '#8a6a4a'; rr(f.x, f.y, f.w, f.h, 14); ctx.fill(); ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; for (let y = f.y + 18; y < f.y + f.h; y += 30) { ctx.beginPath(); ctx.moveTo(f.x + 8, y + 6); ctx.lineTo(f.x + f.w - 8, y + 6); ctx.stroke(); } }
    if (!f.open) { ctx.fillStyle = 'rgba(60,40,20,.35)'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#6b4423'; ctx.strokeText('🔒 Chop the trees!', f.x + f.w / 2, f.y + f.h / 2); ctx.fillText('🔒 Chop the trees!', f.x + f.w / 2, f.y + f.h / 2); } });
  walls.filter(w => w.hedge).forEach(w => {
    if (has('fence-horizontal')) { for (let x = w.x; x < w.x + w.w; x += TILE) tile('fence-horizontal', x, w.y);
      for (let x = w.x + 16; x < w.x + w.w; x += 96) art(x % 192 < 96 ? 'bush-1' : 'bush-2', x, w.y + 60, 48, 48, {foot: 0}); return; }
    ctx.fillStyle = '#3e8e3a'; rr(w.x, w.y, w.w, w.h, 20); ctx.fill(); ctx.fillStyle = '#4caf50';
    for (let x = w.x + 15; x < w.x + w.w; x += 30) { ctx.beginPath(); ctx.arc(x, w.y + 12, 16, 0, 7); ctx.fill(); } });
  decor.forEach(([id, x, y, sz]) => art(id, x, y, sz, sz, {foot: 0}));
}
function drawWheat(p, T) {
  if (!fields[p.f].open) return;
  const S2 = 44;
  if (p.ripe) { if (art('wheat-ripe-sway', p.x, p.y + 14, S2, S2, {t: T + p.x * .013, foot: 0}) || art('wheat-ripe', p.x, p.y + 14, S2, S2, {foot: 0})) return;
    const sw = Math.sin(T * 2 + p.x * .05) * 2; ctx.strokeStyle = '#c99a1e'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 5, p.y + 8); ctx.lineTo(p.x + i * 6 + sw, p.y - 16); ctx.stroke(); }
    ctx.fillStyle = '#f4c542'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(p.x + i * 6 + sw, p.y - 18, 4, 8, i * .3, 0, 7); ctx.fill(); }
  } else {
    // regrow stages: stubble -> seed -> sprout -> growing -> ripe
    const g = 1 - p.t / (p.max || 7), st = g < .2 ? 'wheat-stubble' : g < .4 ? 'wheat-seed' : g < .7 ? 'wheat-sprout' : 'wheat-growing';
    if (art(st, p.x, p.y + 14, S2, S2, {foot: 0})) return;
    const gg = Math.max(0, g); ctx.fillStyle = '#6bbf3a'; ctx.fillRect(p.x - 6, p.y + 4 - 10 * gg, 3, 4 + 10 * gg); ctx.fillRect(p.x + 3, p.y + 4 - 8 * gg, 3, 4 + 8 * gg); }
}
function drawTree(t) {
  const id = 'tree-' + t.kind;
  if (t.hp <= 0) {
    const stump = () => art(id + '-stump', t.x, t.y, 128, 128) || (ctx.fillStyle = '#8d5a2b', ctx.beginPath(), ctx.ellipse(t.x, t.y, 18, 9, 0, 0, 7), ctx.fill(), ctx.fillStyle = '#d9a66b', ctx.beginPath(), ctx.ellipse(t.x, t.y - 3, 14, 6, 0, 0, 7), ctx.fill());
    stump();
    if (t.fall < 1) {
      // Artie: falling frames drawn at 80% scale pivoting at (40,112); last frame trims treetop, so fade during it
      const fr = Math.min(3, Math.floor(t.fall * 4)), alpha = t.fall > .7 ? 1 - (t.fall - .7) / .3 : 1;
      if (!art(id + '-falling', t.x, t.y, 128, 128, {frame: fr, alpha})) { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.fall * 1.5); ctx.globalAlpha = 1 - t.fall; treeShape(0, 0, t.kind); ctx.restore(); }
    }
    return; }
  shadow(t.x, t.y + 4, 34);
  if (!(t.shake > 0 && art(id + '-shake', t.x, t.y, 128, 128, {t: performance.now() / 1000}))) {
    const sx = has(id) ? 0 : Math.sin(performance.now() / 25) * 5 * t.shake; treeShape(t.x + sx, t.y, t.kind); }
  if (t.hp < t.max) { ctx.fillStyle = '#0008'; rr(t.x - 34, t.y - 150, 68, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.hp, t.x, t.y - 132); }
}
function treeShape(x, y, kind = 'round') {
  if (art('tree-' + kind, x, y, 128, 128)) return;
  ctx.fillStyle = '#8d5a2b'; ctx.fillRect(x - 10, y - 50, 20, 52);
  ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(x, y - 75, 42, 0, 7); ctx.fill();
  ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x - 18, y - 90, 28, 0, 7); ctx.arc(x + 20, y - 85, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(x - 8, y - 105, 18, 0, 7); ctx.fill();
  ctx.fillStyle = '#e53935'; [[-20, -70], [15, -95], [22, -62]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a, y + b, 5, 0, 7); ctx.fill(); });
}
function drawBarn() { const x = 60, y = 110;
  if (art('barn', x + 100, y + 150, 210, 210, {foot: 0})) return;
  shadow(x + 100, y + 152, 110); ctx.fillStyle = '#d32f2f'; ctx.fillRect(x, y + 40, 200, 110);
  ctx.fillStyle = '#8e1b1b'; ctx.beginPath(); ctx.moveTo(x - 15, y + 45); ctx.lineTo(x + 100, y - 30); ctx.lineTo(x + 215, y + 45); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 70, y + 80, 60, 70); ctx.fillStyle = '#b71c1c'; ctx.fillRect(x + 76, y + 86, 48, 64);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 76, y + 86); ctx.lineTo(x + 124, y + 150); ctx.moveTo(x + 124, y + 86); ctx.lineTo(x + 76, y + 150); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 100, y + 20, 14, 0, 7); ctx.fill(); }
function drawStall() { const x = 432, y = 110;
  if (!art('market-stall', 512, y + 100, 180, 180, {foot: 0})) {
    shadow(512, y + 92, 90); ctx.fillStyle = '#a1662f'; ctx.fillRect(x, y + 40, 160, 55); ctx.fillStyle = '#c98b4c'; ctx.fillRect(x - 6, y + 34, 172, 14);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x + 4, y - 20, 8, 60); ctx.fillRect(x + 148, y - 20, 8, 60);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ff7043'; ctx.beginPath(); ctx.moveTo(x - 10 + i * 22.5, y - 30); ctx.lineTo(x + 12.5 + i * 22.5, y - 30); ctx.lineTo(x + 12.5 + i * 22.5, y - 5); ctx.arc(x + 1.25 + i * 22.5, y - 5, 11.25, 0, 3.14); ctx.fill(); }
    ctx.fillStyle = '#f4c542'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + 30 + i * 25, y + 34, 9, 3.14, 0); ctx.fill(); } }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🏪 MARKET', 512, y - 40);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(stallSpot.x, stallSpot.y, 50, 22, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
}
const shirt = ['#42a5f5', '#ab47bc', '#ff7043'], hair = ['#5d4037', '#212121', '#ffb300'];
function drawCustomer(c, T) { const x = c.x, y = c.y, b = Math.abs(Math.sin(T * 8 + c.x)) * 3, id = 'customer-' + (c.kind + 1);
  shadow(x, y + 2, 16);
  const settled = !c.leaving && Math.abs(c.x - (512 + c.slot * 60)) < 4;
  const act = c.leaving ? (c.leaving < .6 ? 'happy' : 'walk-left') : settled ? 'waiting' : 'walk-left';
  if (!art(id, x, y, 84, 84, {t: T, action: act})) { const k = c.kind % 3;
    ctx.fillStyle = shirt[k]; rr(x - 13, y - 38 - b, 26, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x, y - 50 - b, 13, 0, 7); ctx.fill();
    ctx.fillStyle = hair[k]; ctx.beginPath(); ctx.arc(x, y - 54 - b, 13, 3.3, 6.1); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(x - 6, y - 52 - b, 3, 3); ctx.fillRect(x + 3, y - 52 - b, 3, 3);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 47 - b, 5, .2, 2.9); ctx.stroke();
    ctx.fillStyle = '#555'; ctx.fillRect(x - 10, y - 8, 8, 10); ctx.fillRect(x + 2, y - 8, 8, 10); }
  if (c.leaving) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💖', x, y - 80 - c.leaving * 20); }
  else if (settled) { ctx.fillStyle = '#fff'; rr(x - 30, y - 104, 60, 28, 12); ctx.fill(); ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 2; ctx.stroke();
    const ic = art('icon-wheat', x - 14, y - 78, 22, 22, {foot: 0}); ctx.fillStyle = '#4a2f14'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText((ic ? '' : '🌾') + (c.want - c.got), x + (ic ? 8 : 0), y - 84); }
}
function drawPlayer(T) { const {x, y, dir} = player, mv = player.moving || player.chop > 0, b = mv ? Math.abs(Math.sin(player.t * 12)) * 4 : 0, leg = mv ? Math.sin(player.t * 12) * 6 : 0;
  shadow(x, y + 2, 20);
  if (has('farmer')) {
    const act = player.chop > 0 || (player.target && !player.moving) ? 'chop' : player.harvestT > 0 && !player.moving ? 'harvest' : player.cheerT > 0 ? 'cheer'
      : player.moving ? (S.wheat > 0 ? 'carry-' : 'walk-') + player.face : 'idle';
    const flip = (act === 'chop' || act === 'harvest' || act === 'cheer') && dir < 0;
    art('farmer', x, y, 100, 100, {t: player.moving ? player.t : T, action: act, flip});
    if (S.wheat > 0) { ctx.fillStyle = '#fff'; rr(x - 26, y - 116, 52, 24, 10); ctx.fill(); const ic = art('icon-wheat', x - 13, y - 94, 20, 20, {foot: 0}); ctx.fillStyle = '#4a2f14'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(S.wheat, x + 8, y - 99); }
    return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = '#1e5aa8'; ctx.fillRect(-10 + leg, -14, 8, 14); ctx.fillRect(2 - leg, -14, 8, 14);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(-12 + leg, -2, 11, 5); ctx.fillRect(1 - leg, -2, 11, 5);
  ctx.translate(0, -b);
  ctx.fillStyle = '#e53935'; rr(-14, -44, 28, 24, 8); ctx.fill(); // shirt
  ctx.fillStyle = '#1e88e5'; rr(-13, -34, 26, 22, 6); ctx.fill(); ctx.fillRect(-10, -44, 5, 12); ctx.fillRect(5, -44, 5, 12); // overalls
  ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(-7, -32, 2.5, 0, 7); ctx.arc(7, -32, 2.5, 0, 7); ctx.fill();
  // arm + axe
  ctx.save(); ctx.translate(12, -38); ctx.rotate(player.chop > 0 ? -1.2 + (1 - player.chop / .13) * 2 : .3);
  ctx.fillStyle = '#ffd7b0'; ctx.fillRect(-3, 0, 6, 16);
  if (player.chop > 0 || player.target) { ctx.fillStyle = '#8d5a2b'; ctx.fillRect(-2, 10, 4, 22); ctx.fillStyle = '#b0bec5'; ctx.fillRect(-10, 26, 12, 8); }
  ctx.restore();
  ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(0, -56, 14, 0, 7); ctx.fill(); // head
  ctx.fillStyle = '#222'; ctx.fillRect(3, -59, 3, 4); ctx.fillRect(-4, -59, 3, 4);
  ctx.fillStyle = '#ff8a80'; ctx.beginPath(); ctx.arc(8, -52, 3, 0, 7); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(2, -52, 5, .3, 2.6); ctx.stroke();
  ctx.fillStyle = '#f9a825'; ctx.beginPath(); ctx.ellipse(0, -66, 24, 6, 0, 0, 7); ctx.fill(); // straw hat
  ctx.fillStyle = '#fbc02d'; rr(-13, -82, 26, 16, 6); ctx.fill(); ctx.fillStyle = '#e53935'; ctx.fillRect(-13, -70, 26, 4);
  ctx.restore();
  if (S.wheat > 0) { ctx.fillStyle = '#fff'; rr(x - 22, y - 116, 44, 22, 10); ctx.fill(); ctx.fillStyle = '#4a2f14'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🌾' + S.wheat, x, y - 100); }
}
function draw(T) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hw = vw / 2 / scale, hh = vh / 2 / scale;
  cam.x += (player.x - cam.x) * .15; cam.y += (player.y - cam.y) * .15;
  const cx = WW < hw * 2 ? WW / 2 : Math.max(hw, Math.min(WW - hw, cam.x)), cy = WH < hh * 2 ? WH / 2 : Math.max(hh, Math.min(WH - hh, cam.y));
  ctx.fillStyle = '#5aa83c'; ctx.fillRect(0, 0, vw, vh);
  const sk = camShake > 0 ? (Math.random() - .5) * 10 * camShake / .3 : 0;
  ctx.translate(vw / 2 + sk, vh / 2 + sk); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  drawGround();
  // depth-sorted sprites
  const list = [];
  plants.forEach(p => list.push([p.y, () => drawWheat(p, T)]));
  trees.forEach(t => list.push([t.y, () => drawTree(t)]));
  customers.forEach(c => list.push([c.y, () => drawCustomer(c, T)]));
  list.push([300, drawBarn], [235, drawStall], [player.y, () => drawPlayer(T)]);
  list.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  fx.forEach(f => art(f.id, f.x, f.y, 64, 64, {frame: Math.floor(f.t * 10), foot: 0}));
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / .7); ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }); ctx.globalAlpha = 1;
  floats.forEach(f => { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `900 ${f.size}px sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#4a2f14'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); });
  ctx.globalAlpha = 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (joy.active) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, 60, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 60, joy.by + joy.dy * 60, 26, 0, 7); ctx.fill(); }
}
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function hud() {
  $('wheat').textContent = S.wheat; $('coins').textContent = S.coins;
  $('time').textContent = fmt(S.mode === 'goal' ? S.time : Math.max(0, S.left));
  if (S.mode === 'goal') { $('goalFill').style.width = Math.min(100, S.coins / S.goal * 100) + '%'; $('goalText').textContent = `${S.coins} / ${S.goal} coins`; }
}

// ---------- Flow ----------
let last = 0;
function loop(ts) { const T = ts / 1000, dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (S && S.running) { update(dt); hud(); }
  if (S) draw(T); requestAnimationFrame(loop); }
function start(mode) {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } ac?.resume?.();
  reset(mode); cam.x = player.x; cam.y = player.y;
  ['startScreen', 'endScreen'].forEach(i => $(i).classList.add('hidden'));
  $('hud').classList.remove('hidden'); $('goalBar').classList.toggle('hidden', mode !== 'goal');
  showHint(); beep(523, .12, 'triangle', .07);
}
function endRound() {
  if (!S.running) return; S.running = false; joy.active = false;
  $('hud').classList.add('hidden'); $('goalBar').classList.add('hidden'); $('hint').classList.add('hidden');
  let stars = 1, title = 'Great job!', text;
  if (S.mode === 'goal') {
    if (S.coins >= S.goal) { stars = S.time < 120 ? 3 : S.time < 200 ? 2 : 1;
      const best = +localStorage.getItem('hhf-best-goal') || 0; const nb = !best || S.time < best; if (nb) localStorage.setItem('hhf-best-goal', S.time.toFixed(1));
      text = `You earned ${S.coins} coins in ${fmt(S.time)}!` + (nb ? ' 🏆 New best time!' : ''); title = 'Goal reached! 🎉';
    } else { stars = 0; title = 'Nice farming!'; text = `You earned ${S.coins} coins. Try again to reach ${S.goal}!`; }
  } else {
    const best = +localStorage.getItem('hhf-best-endless') || 0; const nb = S.coins > best; if (nb) localStorage.setItem('hhf-best-endless', S.coins);
    stars = S.coins >= 800 ? 3 : S.coins >= 400 ? 2 : 1; title = nb ? 'New high score! 🏆' : 'Time\'s up!';
    text = `You earned ${S.coins} coins!` + (nb ? '' : ` Best: ${best}`);
  }
  $('endTitle').textContent = title; $('endText').textContent = text; $('stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  $('endScreen').classList.remove('hidden'); beep(784, .3, 'triangle', .08); refreshBest();
}
function refreshBest() { $('bestEndless').textContent = localStorage.getItem('hhf-best-endless') || 0; const g = localStorage.getItem('hhf-best-goal'); $('bestGoal').textContent = g ? fmt(+g) : '—'; }
$('goalBtn').onclick = () => start('goal'); $('endlessBtn').onclick = () => start('endless');
$('replayBtn').onclick = () => start(S.mode);
$('menuBtn').onclick = () => { $('endScreen').classList.add('hidden'); $('startScreen').classList.remove('hidden'); };
$('quitBtn').onclick = () => endRound();
refreshBest(); reset('goal'); S.running = false; requestAnimationFrame(loop);
window.HHF = {ART, get fx() { return fx; }, get S() { return S; }, get player() { return player; }, get trees() { return trees; }, get fields() { return fields; }, stallSpot}; // for automated tests
})();
