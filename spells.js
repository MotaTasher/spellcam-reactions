export const SPELLS = ['Thumb_Up', 'Thumb_Down', 'Closed_Fist', 'Open_Palm', 'Victory', 'Pointing_Up', 'ILoveYou', 'Knock', 'Heart'];

export const TUNE = {
  enter: 0.65, keep: 0.5, strong: 0.8, lose: 250, hold: 260, cooldown: 2000, still: 200, calm: { z: 0.045, xy: 0.12 },
  guard: { Open_Palm: { enter: 0.8, hold: 450 }, ILoveYou: { enter: 0.8, hold: 450 } },
  knock: { rise: 0.12, riseMs: 320, peakMs: 450, fall: 0.3, fallMin: 0.04, fallMs: 260, gap: 1200, drift: 1.5, block: 400, lift: 0.05, settle: 150 },
  heart: { index: 0.7, thumb: 1.1, axis: 0.45, tilt: 0.6, side: 0.3, curl: -0.15, near: 1.3, hold: 60, lose: 200 },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const palm = (h) => dist(h.wrist, h.mcp);
const hasPts = (h) => h && h.wrist && h.mcp && h.thumb && h.index && h.pip;

function axis(a, b) {
  const S = (palm(a) + palm(b)) / 2;
  const top = mid(a.index, b.index), bot = mid(a.thumb, b.thumb);
  const ux = bot.x - top.x, uy = bot.y - top.y;
  return { S, top, ux, uy, len: Math.hypot(ux, uy) };
}

export function nearHeart(a, b, T = TUNE.heart) {
  if (!hasPts(a) || !hasPts(b)) return false;
  const { S, uy } = axis(a, b);
  return S > 0 && dist(a.index, b.index) <= T.near * S && uy >= 0.15 * S;
}

export function heartOf(a, b, T = TUNE.heart) {
  if (!hasPts(a) || !hasPts(b)) return null;
  const pa = palm(a), pb = palm(b);
  if (!(pa > 0 && pb > 0) || pa / pb < 0.5 || pa / pb > 2) return null;
  const { S, top, ux, uy, len } = axis(a, b);
  if (dist(a.index, b.index) > T.index * S || dist(a.thumb, b.thumb) > T.thumb * S) return null;
  if (len < T.axis * S || uy < T.tilt * len) return null;
  const side = (p) => (ux * (p.y - top.y) - uy * (p.x - top.x)) / len;
  const sa = side(a), sb = side(b);
  if (sa * sb >= 0 || Math.min(Math.abs(sa), Math.abs(sb)) < T.side * S) return null;
  const curl = (h) => ((h.index.x - h.pip.x) * ux + (h.index.y - h.pip.y) * uy) / len;
  if (curl(a) < T.curl * S || curl(b) < T.curl * S) return null;
  return { x: top.x + ux * 0.45, y: top.y + uy * 0.45, size: dist(a, b) * 0.5, gesture: 'Heart', wrist: mid(a.wrist, b.wrist) };
}

export function createKnock(T = TUNE.knock) {
  const k = { buf: [], lastPeak: -1e9, lastAt: -1e9, streak: 0 };
  k.push = (s) => {
    k.buf.push(s);
    while (k.buf.length && s.t - k.buf[0].t > 800) k.buf.shift();
  };
  k.detect = (now) => {
    const b = k.buf, n = b.length;
    if (n < 3) return null;
    let p = -1;
    for (let i = 0; i < n - 1; i++) if (b[i].t > k.lastPeak && now - b[i].t <= T.peakMs && (p < 0 || b[i].z > b[p].z)) p = i;
    if (p < 1) return null;
    const P = b[p], cur = b[n - 1];
    let s = -1;
    for (let i = 0; i < p; i++) if (b[i].t > k.lastPeak && P.t - b[i].t <= T.riseMs && (s < 0 || b[i].z < b[s].z)) s = i;
    if (s < 0) return null;
    const rise = P.z - b[s].z, fall = P.z - cur.z;
    if (rise < T.rise || fall < Math.max(T.fallMin, T.fall * rise) || now - P.t > T.fallMs) return null;
    if (dist(P, b[s]) > T.drift * P.size) return null;
    let fist = false;
    for (let i = s; i < n; i++) if (b[i].fist) fist = true;
    if (!fist) return null;
    k.lastPeak = P.t;
    k.streak = now - k.lastAt <= T.gap ? k.streak + 1 : 1;
    k.lastAt = now;
    return { ...P, n: k.streak };
  };
  k.busy = (now) => {
    if (now - k.lastAt < T.block) return true;
    const b = k.buf, cur = b[b.length - 1];
    if (!cur) return false;
    let lo = cur.z;
    for (const s of b) if (s.t > k.lastPeak && now - s.t <= T.riseMs && s.z < lo) lo = s.z;
    return cur.z - lo >= T.lift;
  };
  return k;
}

export function createSpells(T = TUNE) {
  let tracks = [];
  let nextId = 1;
  let heart = { on: false, since: 0, seen: -1e9, hits: 0, cast: false };
  const castAt = {};
  const log = [];

  const fresh = (now) => ({ g: 'None', since: now, seen: now, strong: 0, cast: false });
  const view = (t) => ({ id: t.id, x: t.o.x, y: t.o.y, size: t.o.size, gesture: t.o.g, wrist: { ...t.o.wrist } });
  const cool = (spell, now) => now - (castAt[spell] ?? -1e9) >= T.cooldown;

  function dedupe(seen) {
    const out = [];
    for (const o of [...seen].sort((a, b) => b.s - a.s)) {
      if (!out.some((q) => dist(q, o) < 0.35 * Math.max(q.size, o.size))) out.push(o);
    }
    return out;
  }

  function assign(obs, now) {
    const pairs = [];
    for (const t of tracks) obs.forEach((o, j) => pairs.push([dist(t.o, o) / Math.max(t.o.size, o.size, 1), t, j]));
    pairs.sort((a, b) => a[0] - b[0]);
    const took = new Set(), got = new Set();
    for (const [d, t, j] of pairs) {
      if (d > 1.5 || took.has(t) || got.has(j)) continue;
      took.add(t);
      got.add(j);
      t.o = obs[j];
      t.seen = now;
    }
    obs.forEach((o, j) => {
      if (!got.has(j)) tracks.push({ id: nextId++, o, seen: now, born: now, st: fresh(now), knock: createKnock(T.knock) });
    });
  }

  function trigger(t, g, s, now) {
    const st = t.st, guard = T.guard[g];
    if (g !== 'None' && g === st.g && s >= T.keep) { st.seen = now; st.strong = s >= T.strong ? st.strong + 1 : 0; }
    else if (g !== 'None' && s >= (guard ? guard.enter : T.enter)) Object.assign(st, { g, since: now, seen: now, strong: s >= T.strong ? 1 : 0, cast: false });
    else { st.strong = 0; if (now - st.seen > T.lose) t.st = fresh(now); }
  }

  function still(t, now) {
    const b = t.knock.buf, cur = b[b.length - 1];
    const ref = b.find((s) => now - s.t <= T.still);
    if (!ref || ref === cur) return false;
    return Math.abs(cur.z - ref.z) <= T.calm.z && dist(cur, ref) <= cur.size * T.calm.xy;
  }

  function ready(t, now) {
    const st = t.st, guard = T.guard[st.g];
    if (st.g === 'None' || st.cast || st.seen !== now || !cool(st.g, now)) return false;
    if (st.g === 'Closed_Fist' && t.knock.busy(now)) return false;
    return now - st.since >= (guard ? guard.hold : T.hold) || (!guard && st.strong >= 2 && still(t, now));
  }

  function cast(out, spell, now, id, hand) {
    castAt[spell] = now;
    log.push({ spell, t: now, id });
    if (log.length > 30) log.shift();
    out.push({ spell, id, hand });
  }

  function step(now, seen) {
    assign(dedupe(seen || []), now);
    tracks = tracks.filter((t) => now - t.seen <= T.lose);
    const live = tracks.filter((t) => t.seen === now);
    const out = [];
    for (const t of tracks) {
      if (t.seen !== now) { trigger(t, 'None', 0, now); continue; }
      trigger(t, t.o.g, t.o.s, now);
      const fist = (t.o.g === 'Closed_Fist' && t.o.s >= T.keep) || t.st.g === 'Closed_Fist';
      t.knock.push({ t: now, z: Math.log(t.o.z || t.o.size || 1), x: t.o.x, y: t.o.y, size: t.o.size, fist });
    }
    const pair = live.length >= 2 ? [live[0].o, live[1].o] : null;
    const near = pair && nearHeart(pair[0], pair[1], T.heart);
    const h = pair && heartOf(pair[0], pair[1], T.heart);
    if (h) {
      if (!heart.on) heart = { on: true, since: now, seen: now, hits: 0, cast: false };
      heart.hits++;
      heart.seen = now;
      if (!heart.cast && heart.hits >= 2 && now - heart.since >= T.heart.hold && cool('Heart', now)) {
        heart.cast = true;
        for (const t of live) t.st.cast = true;
        cast(out, 'Heart', now, null, h);
      }
    } else {
      heart.hits = 0;
      if (now - heart.seen > T.heart.lose) heart.on = false;
    }
    for (const t of live) {
      if (now - t.born < T.knock.settle) t.knock.lastPeak = now;
      const k = t.knock.detect(now);
      if (k && k.n >= 2) {
        if (t.st.g === 'Closed_Fist') t.st.cast = true;
        cast(out, 'Knock', now, t.id, { id: t.id, x: k.x, y: k.y, size: k.size, gesture: 'Knock', wrist: { ...t.o.wrist }, knock: k.n });
      }
      if (near || heart.on || !ready(t, now)) continue;
      const g = t.st.g;
      for (const q of tracks) if (q.st.g === g) q.st.cast = true;
      cast(out, g, now, t.id, view(t));
    }
    return { hands: tracks.map(view), casts: out };
  }

  function reset() {
    tracks = [];
    heart = { on: false, since: 0, seen: -1e9, hits: 0, cast: false };
  }

  return {
    step, reset, castAt, log,
    get count() { return tracks.length; },
    get tracks() { return tracks; },
    gestureOf(id) { const t = tracks.find((q) => q.id === id); return t ? t.st.g : 'None'; },
  };
}
