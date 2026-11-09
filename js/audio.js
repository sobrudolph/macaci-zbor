'use strict';
/*
 * Všetky zvuky sa syntetizujú cez Web Audio API – žiadne zvukové súbory,
 * takže nie sú žiadne problémy s licenciami.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  /** Musí sa zavolať z kliknutia/ťuknutia (prehliadače inak zvuk nepustia). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp);
    comp.connect(c.destination);

    this.ui = c.createGain();
    this.ui.gain.value = 0.8;
    this.ui.connect(this.master);

    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Oneskorenie výstupu – aby obraz sedel s tým, čo počuť. */
  get latency() {
    const l = this.ctx && this.ctx.outputLatency;
    return l > 0 && l < 0.2 ? l : 0;
  }

  /** Samostatná "zbernica" pre jednu hru – pri ukončení ju celú stíšime. */
  newBus() {
    const c = this.ctx;
    const out = c.createGain();
    out.connect(this.master);
    const music = c.createGain();
    music.gain.value = 0.6;
    music.connect(out);
    return { out, music };
  }

  killBus(bus) {
    if (!bus) return;
    try {
      bus.out.gain.cancelScheduledValues(0);
      bus.out.gain.value = 0;
    } catch (e) { /* ignore */ }
    setTimeout(() => { try { bus.out.disconnect(); } catch (e) { /* ignore */ } }, 400);
  }

  fadeBus(bus, sec) {
    if (!bus) return;
    const g = bus.out.gain, t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + sec);
    setTimeout(() => { try { bus.out.disconnect(); } catch (e) { /* ignore */ } }, (sec + 0.5) * 1000);
  }

  // ---------- Bicie a sprievod ----------
  kick(t, v, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.32);
  }

  noise(t, v, dest, type, freq, q, decay) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.4);
    s.stop(t + decay + 0.03);
  }

  snare(t, v, dest) {
    this.noise(t, v * 0.55, dest, 'bandpass', 1800, 0.7, 0.17);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(v * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.12);
  }

  hat(t, v, dest, open) {
    this.noise(t, v * 0.28, dest, 'highpass', 7000, 0.6, open ? 0.2 : 0.05);
  }

  tick(t, accent, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.08);
  }

  tone(t, midi, dur, v, dest, type, cutoff) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type;
    o.frequency.value = midiToFreq(midi);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(v * 0.45, t + Math.max(0.05, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.08, dur));
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + Math.max(0.08, dur) + 0.02);
  }

  /** Prehrá jednu udalosť sprievodu (z buildSong().backing). */
  play(e, t, bus) {
    const d = bus.music;
    const v = e.v == null ? 1 : e.v;
    switch (e.k) {
      case 'kick': this.kick(t, 0.9 * v, d); break;
      case 'snare': this.snare(t, 0.8 * v, d); break;
      case 'hat': this.hat(t, v, d, false); break;
      case 'ohat': this.hat(t, v, d, true); break;
      case 'tick': this.tick(t, e.acc, d); break;
      case 'bass':
        this.tone(t, e.m, e.d, 0.5, d, 'triangle', 800);
        this.tone(t, e.m + 12, e.d, 0.12, d, 'sine', 2000);
        break;
      case 'chord':
        for (const m of e.ms) this.tone(t, m, e.d, 0.09, d, 'triangle', 2400);
        break;
    }
  }

  // ---------- Mňau ----------
  /**
   * Syntetizované "mňau": oscilátor s krivkou výšky + dva pásmové filtre (formanty),
   * ktoré sa otvoria a zatvoria ako "m-ňa-u".
   * Vracia objekt so stop(time) – pre prerušenie držanej noty.
   */
  meow(t, midi, o = {}) {
    const c = this.ctx;
    if (!c) return null;
    const voice = o.voice || {};
    const wave = voice.wave || 'sawtooth';
    const fs = voice.formant || 1;
    const dur = Math.max(0.16, o.dur || 0.26);
    const f = midiToFreq(midi);
    const f2 = o.to != null ? midiToFreq(o.to) : f;

    const osc = c.createOscillator();
    osc.type = wave;
    const fr = osc.frequency;
    fr.setValueAtTime(f * 0.8, t);
    fr.exponentialRampToValueAtTime(f * 1.03, t + 0.05);
    fr.exponentialRampToValueAtTime(f, t + 0.11);
    let last = t + 0.11;
    if (o.to != null) {
      const s0 = Math.max(last + 0.01, t + Math.min(0.2, dur * 0.3));
      const s1 = Math.max(s0 + 0.05, t + dur * 0.8);
      fr.setValueAtTime(f, s0);
      fr.exponentialRampToValueAtTime(f2, s1);
      last = s1;
    }
    const e0 = Math.max(last + 0.01, t + dur - 0.08);
    const tEnd = Math.max(e0 + 0.02, t + dur);
    fr.setValueAtTime(f2, e0);
    fr.exponentialRampToValueAtTime(f2 * 0.9, tEnd);

    if (dur > 0.35) { // vibrato pri dlhých tónoch
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.022, t + 0.35);
      lfo.connect(lg); lg.connect(fr);
      lfo.start(t); lfo.stop(tEnd + 0.05);
    }

    const env = c.createGain();
    const formant = (Q, a, b, cc, d, gain) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = Q;
      bp.frequency.setValueAtTime(a * fs, t);
      bp.frequency.linearRampToValueAtTime(b * fs, t + 0.08);
      bp.frequency.linearRampToValueAtTime(cc * fs, t + Math.max(0.1, dur * 0.6));
      bp.frequency.linearRampToValueAtTime(d * fs, tEnd);
      const gg = c.createGain();
      gg.gain.value = gain;
      osc.connect(bp); bp.connect(gg); gg.connect(env);
    };
    formant(3, 500, 1200, 1000, 600, 1.0);
    formant(5, 1500, 2600, 2200, 1100, 0.7);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600 * fs;
    const lg2 = c.createGain();
    lg2.gain.value = 0.22;
    osc.connect(lp); lp.connect(lg2); lg2.connect(env);

    const waveGain = { sawtooth: 1, square: 0.75, triangle: 1.9 }[wave] || 1;
    const vol = (o.vol == null ? 1 : o.vol) * 0.55 * waveGain;
    const eg = env.gain;
    eg.setValueAtTime(0, t);
    eg.linearRampToValueAtTime(vol, t + 0.025);
    eg.linearRampToValueAtTime(vol * 0.75, t + 0.12);
    const rel = Math.max(t + 0.13, tEnd - 0.07);
    eg.setValueAtTime(vol * 0.75, rel);
    eg.linearRampToValueAtTime(0, tEnd);
    env.connect(o.dest || this.ui);

    osc.start(t);
    osc.stop(tEnd + 0.05);
    return {
      stop: at => {
        try {
          eg.cancelScheduledValues(at);
          eg.setTargetAtTime(0, at, 0.03);
        } catch (e) { /* ignore */ }
      },
    };
  }

  // ---------- Efekty ----------
  miss(dest) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.2);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f); f.connect(g); g.connect(dest || this.ui);
    o.start(t); o.stop(t + 0.25);
  }

  blip() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(990, t + 0.06);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(this.ui);
    o.start(t); o.stop(t + 0.1);
  }

  /** Ukážka hlasu mačky vo výbere mačiek. */
  preview(voice, midi = 72) {
    if (!this.ctx) return;
    this.meow(this.now + 0.02, midi, { dur: 0.42, voice, dest: this.ui });
  }
}
