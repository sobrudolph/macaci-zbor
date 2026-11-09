'use strict';
/*
 * Herná logika: pohyb mačiek, padajúce pochúťky, vyhodnocovanie, vykresľovanie.
 * Hodiny hry = AudioContext.currentTime, takže obraz je vždy zladený s hudbou.
 */
const HIT_EARLY = 0.04;   // o koľko skôr (s) sa dá pochúťka chytiť
const HIT_LATE = 0.09;    // o koľko neskôr (s) sa ešte počíta
const MAX_LIVES = 3;
const FONT = 'Fredoka, system-ui, -apple-system, "Segoe UI", sans-serif';
const FX_COLORS = ['#ffe36e', '#ff8fb8', '#7cc6ff', '#8be08b', '#ffffff', '#b49bff'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Game {
  constructor(canvas, audio) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.audio = audio;
    this.mode = 'idle'; // idle | play | paused | over
    this.song = null;
    this.catDefs = [CATS[0], CATS[1]];
    this.cats = [0, 1].map(side => ({
      side, x: 0, target: 0, vel: 0, mouth: 0, squash: 0, sad: 0,
      blink: 0, blinkIn: 1 + Math.random() * 3, look: 0, hold: null,
    }));
    this.particles = [];
    this.texts = [];
    this.bokeh = Array.from({ length: 16 }, () => ({
      x: Math.random(), y: Math.random(), r: 0.03 + Math.random() * 0.1,
      s: 0.01 + Math.random() * 0.03, a: 0.05 + Math.random() * 0.07,
    }));
    this.pointers = new Map();
    this.keys = {};
    this.idleT = 0;
    this.shake = 0;
    this.shownScore = 0;
    this.onEnd = null;
    this.onPauseKey = null;
    this.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

    this._bind();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame(ts => this._frame(ts));
  }

  // ---------- Rozmery ----------
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;

    this.half = this.W / 2;
    this.pad = this.half * 0.12;
    this.catchY = this.H * 0.78;
    this.catSize = Math.min(this.half * 0.62, this.H * 0.14);
    this.catBottom = this.catchY + this.catSize * 0.47; // pusa mačky je presne na čiare chytania
    this.snackR = this.catSize * 0.2;
    this.tol = this.catSize * 0.36 + this.snackR * 0.5;
    this.spawnY = -this.snackR * 2;
    for (const c of this.cats) {
      c.x = c.target = this.mode === 'idle' || !c.x ? this.laneX(c.side, 0.5) : this.clampX(c.side, c.x);
    }
  }

  laneX(side, u) { return side * this.half + this.pad + u * (this.half - 2 * this.pad); }
  clampX(side, x) { return clamp(x, side * this.half + this.pad, side * this.half + this.half - this.pad); }

  setCats(defs) { this.catDefs = defs; }

  time() { return this.audio.now - this.audio.latency - this.songStart; }

  // ---------- Ovládanie ----------
  _bind() {
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return e.clientX - r.left; };
    cv.addEventListener('pointerdown', e => {
      const x = pos(e);
      const side = x < this.W / 2 ? 0 : 1;
      this.pointers.set(e.pointerId, side);
      this._aim(side, x);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const x = pos(e);
      let side = this.pointers.get(e.pointerId);
      if (side === undefined) {
        if (e.pointerType !== 'mouse') return;
        side = x < this.W / 2 ? 0 : 1; // myš bez kliknutia ovláda mačku pod kurzorom
      }
      this._aim(side, x);
    });
    const up = e => this.pointers.delete(e.pointerId);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.onPauseKey) this.onPauseKey();
        return;
      }
      if (this.mode === 'play' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.pointers.clear(); });
  }

  _aim(side, x) {
    if (this.mode !== 'play') return;
    this.cats[side].target = this.clampX(side, x);
  }

  // ---------- Priebeh hry ----------
  start(song, defs, relax) {
    this.song = song;
    this.chart = buildSong(song);
    this.catDefs = defs;
    this.relax = !!relax;
    this.notes = this.chart.notes.map(n => Object.assign({}, n, {
      state: 0, holdDone: false, broken: false, meow: null, holdLastOk: 0,
    }));
    this.score = 0;
    this.shownScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.caught = 0;
    this.lives = MAX_LIVES;
    this.first = 0;
    this.bIdx = 0;
    this.lastJudgeT = null;
    this.particles.length = 0;
    this.texts.length = 0;
    this.shake = 0;
    for (const c of this.cats) {
      c.x = c.target = this.laneX(c.side, 0.5);
      c.hold = null; c.mouth = 0; c.sad = 0; c.squash = 0;
    }
    if (this.bus) this.audio.killBus(this.bus);
    this.bus = this.audio.newBus();
    const bar = this.chart.bpb * this.chart.spb;
    this.songStart = this.audio.now + Math.max(song.speed + 0.4, bar + 0.3);
    this.mode = 'play';
  }

  pause() {
    if (this.mode !== 'play') return false;
    this.mode = 'paused';
    this.pointers.clear();
    this.keys = {};
    if (this.audio.ctx) this.audio.ctx.suspend();
    return true;
  }

  resume() {
    if (this.mode !== 'paused') return;
    if (this.audio.ctx) this.audio.ctx.resume();
    this.mode = 'play';
    this.last = performance.now();
    this.lastJudgeT = null;
  }

  quit() {
    if (this.bus) { this.audio.killBus(this.bus); this.bus = null; }
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
    this.mode = 'idle';
    this.song = null;
    this.particles.length = 0;
    this.texts.length = 0;
    for (const c of this.cats) { c.hold = null; c.sad = 0; c.target = this.laneX(c.side, 0.5); }
  }

  _finish(cleared) {
    if (this.mode !== 'play') return;
    this.mode = 'over';
    for (const c of this.cats) c.hold = null;
    if (!cleared) { this.audio.fadeBus(this.bus, 0.25); this.bus = null; }
    else {
      for (const c of this.cats) {
        c.mouth = 0.6;
        for (let i = 0; i < 4; i++) this._burst(c.x, this.catchY);
      }
    }
    const total = this.notes.length;
    const acc = total ? this.caught / total : 0;
    const stars = cleared ? (acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : acc >= 0.5 ? 1 : 0) : 0;
    if (this.onEnd) {
      this.onEnd({ cleared, score: Math.round(this.score), stars, acc, maxCombo: this.maxCombo, caught: this.caught, total });
    }
  }

  mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }

  // ---------- Snímka ----------
  _frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    if (this.mode === 'play') this._update(dt);
    if (this.mode !== 'paused') {
      this.idleT += dt;
      this._animCats(dt);
      this._updateFx(dt);
      if (this.mode === 'idle') this._idle(dt);
    }
    this._render();
    requestAnimationFrame(t => this._frame(t));
  }

  _update(dt) {
    const t = this.time();
    this._schedule();
    this._moveCats(dt);
    this._judge(t, dt);
    this._look(t);
    if (!this.relax && this.lives <= 0) { this._finish(false); return; }
    if (t > this.chart.endTime && this.first >= this.notes.length) this._finish(true);
  }

  /** Naplánuje sprievod ~250 ms dopredu. */
  _schedule() {
    const a = this.audio, ev = this.chart.backing, horizon = a.now + 0.25;
    while (this.bIdx < ev.length) {
      const e = ev[this.bIdx];
      const at = this.songStart + e.t;
      if (at > horizon) break;
      this.bIdx++;
      if (at < a.now - 0.03) continue;
      a.play(e, Math.max(at, a.now), this.bus);
    }
  }

  _moveCats(dt) {
    for (const c of this.cats) {
      const left = c.side === 0 ? this.keys.KeyA : this.keys.ArrowLeft || this.keys.KeyJ;
      const right = c.side === 0 ? this.keys.KeyD : this.keys.ArrowRight || this.keys.KeyL;
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (dir) c.target = this.clampX(c.side, c.target + dir * this.half * 4.2 * dt);
      const old = c.x;
      c.x += (c.target - c.x) * Math.min(1, dt * 28);
      c.vel = dt > 0 ? (c.x - old) / dt : 0;
    }
  }

  _animCats(dt) {
    for (const c of this.cats) {
      c.mouth = Math.max(0, c.mouth - dt);
      c.squash = Math.max(0, c.squash - dt * 4);
      c.sad = Math.max(0, c.sad - dt);
      c.blinkIn -= dt;
      if (c.blinkIn <= 0) { c.blink = 0.12; c.blinkIn = 2 + Math.random() * 3; }
      c.blink = Math.max(0, c.blink - dt);
      if (this.mode !== 'play') c.vel *= 0.8;
    }
  }

  _idle(dt) {
    for (const c of this.cats) {
      c.target = this.laneX(c.side, 0.5);
      c.x += (c.target - c.x) * Math.min(1, dt * 6);
      c.look = Math.sin(this.idleT * 0.7 + c.side) * 0.6;
      if (Math.random() < dt * 0.3) {
        c.mouth = 0.35;
        this.particles.push({
          x: c.x + (Math.random() - 0.5) * 20, y: this.catchY - this.catSize * 0.4,
          vx: (Math.random() - 0.5) * 30, vy: -60, life: 1.4, max: 1.4,
          kind: 'note', ch: Math.random() < 0.5 ? '♪' : '♫', color: '#ffffff', size: this.catSize * 0.24,
        });
      }
    }
  }

  _judge(t, dt) {
    const notes = this.notes;
    // Ak sa snímka zasekla, okno chytania sa mohlo "preskočiť" – berieme do úvahy aj čas predošlej snímky.
    const prevT = this.lastJudgeT == null ? t : Math.min(this.lastJudgeT, t);
    this.lastJudgeT = t;
    for (let i = this.first; i < notes.length; i++) {
      const n = notes[i];
      if (n.time - t > HIT_EARLY + 0.01) break;
      if (n.state === 0) {
        const dx = Math.abs(this.cats[n.side].x - this.laneX(n.side, n.u));
        const inWindow = t >= n.time - HIT_EARLY && prevT <= n.time + HIT_LATE;
        if (inWindow && dx <= this.tol) this._hit(n, t);
        else if (t > n.time + HIT_LATE) this._miss(n);
      } else if (n.state === 1 && n.hold && !n.holdDone) {
        this._updateHold(n, t, dt);
      }
    }
    while (this.first < notes.length) {
      const n = notes[this.first];
      if (n.state !== 0 && (!n.hold || n.holdDone)) this.first++;
      else break;
    }
  }

  _hit(n, t) {
    n.state = 1;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.caught++;
    this.score += 100 * this.mult();
    const c = this.cats[n.side];
    const def = this.catDefs[n.side];
    const at = Math.max(this.audio.now, this.songStart + n.time);
    const vol = n.harmony ? 0.6 : 1;
    if (n.hold) {
      n.holdLastOk = t;
      n.meow = this.audio.meow(at, n.midi, { dur: n.hold.dur, to: n.toMidi, voice: def.voice, dest: this.bus.out, vol });
      c.hold = n;
    } else {
      this.audio.meow(at, n.midi, { dur: clamp(n.len * 0.9, 0.16, 0.5), voice: def.voice, dest: this.bus.out, vol });
      c.mouth = 0.22;
    }
    c.squash = 1;
    this._burst(this.laneX(n.side, n.u), this.catchY);
    if (this.combo % 10 === 0) {
      this._text(this.W / 2, this.H * 0.32, `${this.combo} combo!`, '#ffe36e', 30);
    }
  }

  _miss(n) {
    n.state = 2;
    if (n.hold) n.holdDone = true;
    this.combo = 0;
    if (!this.relax) this.lives--;
    this.audio.miss(this.bus.out);
    const c = this.cats[n.side];
    c.sad = 0.5;
    this.shake = 0.25;
    this._text(this.laneX(n.side, n.u), this.catchY - this.catSize * 0.9, '✗', '#ff5f7a', 34);
  }

  _updateHold(n, t, dt) {
    const p = clamp((t - n.time) / n.hold.dur, 0, 1);
    const x = this.laneX(n.side, n.u + (n.u2 - n.u) * p);
    const c = this.cats[n.side];
    if (Math.abs(c.x - x) <= this.tol * 1.2) {
      n.holdLastOk = t;
      this.score += dt * 240 * this.mult();
      if (Math.random() < dt * 14) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 16, y: this.catchY - this.catSize * 0.2,
          vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 60, life: 0.5, max: 0.5,
          kind: 'dot', color: FX_COLORS[(Math.random() * FX_COLORS.length) | 0], size: 2 + Math.random() * 2.5,
        });
      }
    } else if (t - n.holdLastOk > 0.16) {
      n.broken = true;
      n.holdDone = true;
      if (n.meow) n.meow.stop(this.audio.now);
      this.combo = 0;
      c.hold = null;
      this._text(x, this.catchY - this.catSize * 0.9, 'Ups!', '#ffffff', 24);
      return;
    }
    if (p >= 1) {
      n.holdDone = true;
      c.hold = null;
      this.score += 50 * this.mult();
      this._text(x, this.catchY - this.catSize * 1.1, 'Super!', '#ffe36e', 24);
    }
  }

  /** Oči mačky sledujú najbližšiu pochúťku na jej strane. */
  _look(t) {
    const seen = [false, false];
    for (let i = this.first; i < this.notes.length && !(seen[0] && seen[1]); i++) {
      const n = this.notes[i];
      if (n.time - t > this.song.speed) break;
      if (n.state !== 0 || seen[n.side]) continue;
      seen[n.side] = true;
      const c = this.cats[n.side];
      c.look = clamp((this.laneX(n.side, n.u) - c.x) / (this.half * 0.4), -1, 1);
    }
    for (const c of this.cats) if (!seen[c.side]) c.look *= 0.9;
  }

  // ---------- Efekty ----------
  _burst(x, y) {
    if (this.particles.length > 220) return;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 120 + Math.random() * 170;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5,
        kind: 'dot', color: FX_COLORS[(Math.random() * FX_COLORS.length) | 0], size: 2 + Math.random() * 3,
      });
    }
    this.particles.push({
      x: x + (Math.random() - 0.5) * 20, y: y - this.catSize * 0.5,
      vx: (Math.random() - 0.5) * 40, vy: -75, life: 1, max: 1,
      kind: 'note', ch: Math.random() < 0.5 ? '♪' : '♫', color: '#ffffff', size: this.catSize * 0.22,
    });
  }

  _text(x, y, txt, color, size) {
    this.texts.push({ x, y, txt, color, size, life: 0.8, max: 0.8 });
  }

  _updateFx(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot') p.vy += 420 * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const tx of this.texts) { tx.life -= dt; tx.y -= 40 * dt; }
    this.texts = this.texts.filter(tx => tx.life > 0);
    for (const b of this.bokeh) {
      b.y -= b.s * dt;
      if (b.y < -0.2) { b.y = 1.2; b.x = Math.random(); }
    }
    this.shake = Math.max(0, this.shake - dt);
    if (this.mode === 'play' || this.mode === 'over') {
      this.shownScore += (this.score - this.shownScore) * Math.min(1, dt * 10);
    }
  }

  // ---------- Vykresľovanie ----------
  _render() {
    const g = this.g, W = this.W, H = this.H;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const inGame = this.mode !== 'idle' && this.song;
    const bg = inGame ? this.song.bg : ['#ff9ec4', '#7d6bd6'];
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, bg[0]);
    grd.addColorStop(1, bg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    for (const b of this.bokeh) {
      g.fillStyle = `rgba(255,255,255,${b.a})`;
      circ(g, b.x * W, b.y * H, b.r * W);
      g.fill();
    }

    g.save();
    if (this.shake > 0) {
      const s = this.shake * 14;
      g.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // podlaha a deliaca čiara
    const gy = this.catBottom - this.catSize * 0.05;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, gy, W, H - gy);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 2;
    g.setLineDash([6, 10]);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.setLineDash([]);

    let t = 0;
    if (inGame) {
      t = this.time();
      this._renderNotes(t);
    }

    for (const c of this.cats) {
      const def = this.catDefs[c.side];
      g.fillStyle = 'rgba(30,20,50,0.18)';
      ell(g, c.x, this.catBottom, this.catSize * 0.42, this.catSize * 0.08);
      g.fill();
      const holding = c.hold && c.hold.state === 1 && !c.hold.holdDone;
      drawCat(g, def, c.x, this.catBottom, this.catSize, {
        t: this.idleT,
        mouth: holding ? 1 : Math.min(1, c.mouth / 0.12),
        blink: c.blink > 0,
        sad: c.sad > 0,
        squash: c.squash,
        look: c.look,
        tilt: clamp(c.vel * 0.00025, -0.12, 0.12),
      });
    }

    // častice a texty
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      g.globalAlpha = a;
      if (p.kind === 'note') {
        g.fillStyle = p.color;
        g.font = `700 ${Math.round(p.size)}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(p.ch, p.x, p.y);
      } else {
        g.fillStyle = p.color;
        circ(g, p.x, p.y, p.size);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    for (const tx of this.texts) {
      g.globalAlpha = clamp(tx.life / tx.max * 1.5, 0, 1);
      this._label(tx.txt, tx.x, tx.y, tx.size, tx.color);
    }
    g.globalAlpha = 1;
    g.restore();

    if (inGame && this.mode !== 'over') this._renderHud(t);
  }

  _renderNotes(t) {
    const g = this.g;
    const app = this.song.speed;
    const D = this.catchY - this.spawnY;
    const yOf = tau => this.catchY - ((tau - t) / app) * D;
    const kinds = this.song.snacks;
    const r0 = this.snackR;

    // čiara chytania
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const side of [0, 1]) {
      g.beginPath();
      g.moveTo(side * this.half + this.pad * 0.5, this.catchY);
      g.lineTo(side * this.half + this.half - this.pad * 0.5, this.catchY);
      g.stroke();
    }

    for (const n of this.notes) {
      if (n.time - t > app + 0.1) break;
      const x = this.laneX(n.side, n.u);

      // značka na čiare – kam príde pochúťka
      if (n.state === 0 && n.time - t < 0.7 && n.time >= t - 0.1) {
        const a = clamp(1 - (n.time - t) / 0.7, 0, 1);
        g.fillStyle = `rgba(255,255,255,${a * 0.35})`;
        ell(g, x, this.catchY, r0 * 0.95, r0 * 0.32);
        g.fill();
      }

      // stopa pri držaných notách
      if (n.hold && !(n.state === 1 && n.holdDone && !n.broken)) {
        const live = n.state === 1 && !n.broken;
        const a0 = live ? Math.max(n.time, t) : n.time;
        const b0 = n.time + n.hold.dur;
        if (b0 > a0 && yOf(b0) < this.H + 40) {
          const dim = n.state === 2 || n.broken;
          g.beginPath();
          const steps = 16;
          for (let s = 0; s <= steps; s++) {
            const tau = a0 + ((b0 - a0) * s) / steps;
            const p = (tau - n.time) / n.hold.dur;
            const px = this.laneX(n.side, n.u + (n.u2 - n.u) * p);
            const py = yOf(tau);
            if (s) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.strokeStyle = dim ? 'rgba(40,30,60,0.2)' : 'rgba(255,255,255,0.35)';
          g.lineWidth = r0 * 1.3;
          g.stroke();
          g.strokeStyle = dim ? 'rgba(255,255,255,0.15)' : '#fff3a0';
          g.lineWidth = r0 * 0.55;
          g.stroke();
          if (!dim) drawSnack(g, 'star', this.laneX(n.side, n.u2), yOf(b0), r0 * 0.6, t * 2);
        }
      }

      // samotná pochúťka
      if (n.state === 0 || n.state === 2) {
        const y = yOf(n.time);
        let alpha = 1;
        if (n.state === 2) alpha = clamp(1 - (t - n.time) / 0.45, 0, 1);
        if (alpha <= 0 || y < -r0 * 3) continue;
        const r = r0 * (n.harmony ? 0.85 : 1);
        g.globalAlpha = alpha;
        const glow = g.createRadialGradient(x, y, r * 0.3, x, y, r * 1.7);
        glow.addColorStop(0, 'rgba(255,255,255,0.45)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = glow;
        circ(g, x, y, r * 1.7);
        g.fill();
        const kind = kinds[(n.id + (n.harmony ? 1 : 0)) % kinds.length];
        drawSnack(g, kind, x, y, r, Math.sin(t * 3 + n.id) * 0.25);
        g.globalAlpha = 1;
      }
    }
  }

  _label(txt, x, y, size, color, align = 'center') {
    const g = this.g;
    g.font = `700 ${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(3, size * 0.16);
    g.strokeStyle = 'rgba(40,20,70,0.45)';
    g.strokeText(txt, x, y);
    g.fillStyle = color;
    g.fillText(txt, x, y);
  }

  _renderHud(t) {
    const g = this.g, W = this.W, H = this.H;
    const top = this.safeTop + 10;

    // priebeh pesničky
    const p = clamp(t / this.chart.lastNoteTime, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    rrPath(g, 14, top, W - 28, 5, 3); g.fill();
    g.fillStyle = '#ffffff';
    rrPath(g, 14, top, Math.max(5, (W - 28) * p), 5, 3); g.fill();

    // skóre a combo
    this._label(String(Math.round(this.shownScore)), 16, top + 32, 28, '#ffffff', 'left');
    if (this.combo >= 2) {
      const m = this.mult();
      this._label(`${this.combo} combo${m > 1 ? '  ×' + m : ''}`, 16, top + 58, 16, '#ffe36e', 'left');
    }

    // životy
    if (this.relax) {
      this._label('relax', W / 2, top + 30, 16, 'rgba(255,255,255,0.85)');
    } else {
      for (let i = 0; i < MAX_LIVES; i++) {
        const hx = W / 2 + (i - (MAX_LIVES - 1) / 2) * 28;
        heartPath(g, hx, top + 34, 11);
        g.fillStyle = i < this.lives ? '#ff5f7a' : 'rgba(255,255,255,0.3)';
        g.fill();
        g.strokeStyle = 'rgba(40,20,70,0.45)';
        g.lineWidth = 2;
        g.stroke();
      }
    }

    // odpočet a nápoveda
    if (t < 0) {
      const pd = this.chart.pulse * this.chart.spb;
      const ppb = this.chart.bpb / this.chart.pulse;
      const rem = Math.ceil(-t / pd);
      if (rem > ppb) this._label('Pripravení?', W / 2, H * 0.36, 34, '#ffffff');
      else this._label(String(rem), W / 2, H * 0.36, 64, '#ffffff');
      this._label(this.song.title, W / 2, H * 0.36 + 50, 18, 'rgba(255,255,255,0.85)');

      for (const side of [0, 1]) {
        const cx = this.laneX(side, 0.5);
        const y = this.catchY - this.catSize * 1.35;
        this._label('⟵  ⟶', cx, y, 22, 'rgba(255,255,255,0.9)');
        const hint = this.coarse ? (side ? 'pravý palec' : 'ľavý palec') : (side ? '←  →' : 'A  D');
        this._label(hint, cx, y + 26, 15, 'rgba(255,255,255,0.9)');
      }
    }
  }
}
