'use strict';
/*
 * Pesničky a generovanie nôt (chart) z melódie.
 *
 * Zápis melódie: tokeny oddelené medzerou, "|" je len oddeľovač taktov.
 *   C5        – nota C5 s dĺžkou 1 dobu
 *   E5:0.5    – nota s dĺžkou pol doby
 *   r:2       – pauza 2 doby
 *   G5:2~     – držaná nota (hráč drží mačku pod stopou)
 *   E5:3>G5   – "slide": držaná nota, ktorá sa presúva na výšku G5
 *
 * Akordy: jeden token na každých `chordBeats` dôb, "-" = bez akordu.
 * Melódie sú buď voľné dielo (ľudové, Beethoven), alebo pôvodné skladby.
 */

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('Neznáma nota: ' + name);
  let pc = NOTE_PC[m[1]];
  if (m[2] === '#') pc += 1;
  else if (m[2] === 'b') pc -= 1;
  return pc + (parseInt(m[3], 10) + 1) * 12;
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function parseMelody(src) {
  const notes = [];
  let beat = 0;
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const m = /^(r|[A-G][#b]?-?\d)(?::(\d*\.?\d+))?(~|>([A-G][#b]?-?\d))?$/.exec(tok);
    if (!m) throw new Error('Neznámy zápis v melódii: ' + tok);
    const dur = m[2] ? parseFloat(m[2]) : 1;
    if (m[1] !== 'r') {
      notes.push({
        beat,
        dur,
        midi: noteToMidi(m[1]),
        hold: !!m[3],
        to: m[4] ? noteToMidi(m[4]) : null,
      });
    }
    beat += dur;
  }
  return { notes, totalBeats: beat };
}

function parseChords(src) {
  return src.trim().split(/\s+/).filter(t => t !== '|').map(s => {
    if (s === '-') return null;
    const m = /^([A-G])([#b]?)(m?)(7?)$/.exec(s);
    if (!m) throw new Error('Neznámy akord: ' + s);
    let root = NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    root = (root + 12) % 12;
    const intervals = m[3] ? [0, 3, 7] : [0, 4, 7];
    if (m[4]) intervals.push(10);
    return { root, intervals };
  });
}

const bassMidi = root => (36 + root < 40 ? 48 + root : 36 + root);
const chordMidis = ch => ch.intervals.map(iv => 55 + ((((ch.root + iv - 55) % 12) + 12) % 12));

const gtrMidi = root => 40 + ((root - 4 + 12) % 12); // power chord E2..D#3

/**
 * Sprievod pre rap (boom bap), rock a metal. Volá sa pre každú dobu (pib = doba v takte).
 */
function heavyBeat(out, style, ch, t, pd, pib, bar) {
  const h = pd / 2, q = pd / 4;
  const root = ch ? ch.root : null;
  if (style === 'rap') {
    out.push({ t, k: 'hat', v: 0.55 }, { t: t + h, k: 'hat', v: 0.32 });
    if (pib === 3 && bar % 4 === 3) out.push({ t: t + q, k: 'hat', v: 0.3 }, { t: t + 3 * q, k: 'hat', v: 0.3 });
    if (pib === 0) out.push({ t, k: 'kick' });
    if (pib === 2) out.push({ t: t + h, k: 'kick', v: 0.85 });
    if (pib === 1 || pib === 3) out.push({ t, k: 'clap' }, { t, k: 'snare', v: 0.45 });
    if (root == null) return;
    if (pib === 0) out.push({ t, k: 'sub', m: 36 + root, d: pd * 1.4 });
    if (pib === 2) out.push({ t: t + h, k: 'sub', m: 36 + root, d: pd * 0.9 });
    if (pib === 0 || pib === 2) out.push({ t, k: 'keys', ms: chordMidis(ch), d: pd * 1.6 });
    return;
  }
  if (style === 'rock') {
    if (pib === 0 && bar % 4 === 0) out.push({ t, k: 'crash', v: 0.8 });
    out.push({ t, k: 'hat', v: 0.5 }, { t: t + h, k: 'hat', v: 0.3 });
    if (pib === 0 || pib === 2) out.push({ t, k: 'kick' });
    if (pib === 2) out.push({ t: t + h, k: 'kick', v: 0.7 });
    if (pib === 1 || pib === 3) out.push({ t, k: 'snare' });
    if (root == null) return;
    out.push({ t, k: 'gtr', m: gtrMidi(root), d: h * 0.9 }, { t: t + h, k: 'gtr', m: gtrMidi(root), d: h * 0.9, mute: true });
    out.push({ t, k: 'bass', m: bassMidi(root), d: pd * 0.8 });
    return;
  }
  // metal: dvojitý kopák na osminy, crash každé 2 takty, dusené "čug-čug" a údery na 1 a 3
  if (pib === 0 && bar % 2 === 0) out.push({ t, k: 'crash', v: 0.9 });
  out.push({ t, k: 'kick', v: 0.9 }, { t: t + h, k: 'kick', v: 0.75 });
  if (pib === 1 || pib === 3) out.push({ t, k: 'snare' });
  else out.push({ t, k: 'hat', v: 0.4 });
  if (root == null) return;
  const m = gtrMidi(root);
  if (pib === 0 || pib === 2) out.push({ t, k: 'gtr', m, d: pd * 0.95 });
  else out.push({ t, k: 'gtr', m, d: q, mute: true }, { t: t + h, k: 'gtr', m, d: q, mute: true }, { t: t + 3 * q, k: 'gtr', m, d: q, mute: true });
  out.push({ t, k: 'bass', m: bassMidi(root), d: pd * 0.5 }, { t: t + h, k: 'bass', m: bassMidi(root), d: pd * 0.4 });
}

/** Z definície pesničky vyrobí noty pre hru a sprievod (bicie, basa, akordy). */
function buildSong(song) {
  const spb = 60 / song.bpm;
  const bpb = song.beatsPerBar || 4;
  const sw = song.switchEvery || 1;
  const pulse = song.pulse || 1;
  const parsed = parseMelody(song.melody);
  let mel = parsed.notes, totalBeats = parsed.totalBeats;
  // Kánon: druhá mačka spieva tú istú melódiu s oneskorením `canon` taktov
  if (song.canon) {
    const shift = song.canon * bpb;
    mel = [...mel.map(n => Object.assign({}, n, { voice: 0 })), ...mel.map(n => Object.assign({}, n, { beat: n.beat + shift, voice: 1 }))];
    totalBeats += shift;
  }
  const chords = parseChords(song.chords);
  const cb = song.chordBeats || bpb;
  const chordAt = beat => (chords.length ? chords[Math.floor(beat / cb + 1e-6) % chords.length] : null);
  const bars = Math.ceil(totalBeats / bpb - 1e-6);

  // Výška tónu -> vodorovná pozícia v polovici obrazovky (vyšší tón = viac vpravo)
  const pitches = [];
  mel.forEach(n => { pitches.push(n.midi); if (n.to != null) pitches.push(n.to); });
  let lo = Math.min(...pitches), hi = Math.max(...pitches);
  if (hi - lo < 8) { const mid = (hi + lo) / 2; lo = mid - 4; hi = mid + 4; }
  const lane = m => 0.08 + 0.84 * Math.min(1, Math.max(0, (m - lo) / (hi - lo)));

  const notes = [];
  for (const n of mel) {
    const bar = Math.floor(n.beat / bpb + 1e-6);
    const side = song.canon ? n.voice : Math.floor(bar / sw) % 2; // mačky sa striedajú po taktoch
    const len = n.dur * spb;
    const isHold = n.hold || n.to != null;
    notes.push({
      time: n.beat * spb,
      len,
      side,
      midi: n.midi,
      toMidi: n.to,
      u: lane(n.midi),
      u2: n.to != null ? lane(n.to) : lane(n.midi),
      hold: isHold ? { dur: Math.max(0.25, len - Math.min(0.18, spb * 0.3)) } : null,
      harmony: false,
    });
  }

  // Druhý hlas: na začiatku taktu zaspieva druhá mačka základný tón akordu
  if (song.harmony) {
    for (let b = 0; b < bars; b++) {
      const beat = b * bpb;
      const ch = chordAt(beat);
      if (!ch) continue;
      const side = 1 - (Math.floor(b / sw) % 2);
      const time = beat * spb;
      const busy = notes.some(n => n.side === side &&
        n.time < time + 0.3 && n.time + (n.hold ? n.hold.dur : 0) > time - 0.3);
      if (busy) continue;
      let m = 48 + ch.root;
      while (m < lo) m += 12;
      if (m > hi) m -= 12;
      notes.push({ time, len: spb, side, midi: m, toMidi: null, u: lane(m), u2: lane(m), hold: null, harmony: true });
    }
  }

  notes.sort((a, b) => a.time - b.time || a.side - b.side);
  notes.forEach((n, i) => { n.id = i; });

  // Sprievod
  const backing = [];
  const ppb = bpb / pulse;
  const pd = pulse * spb;
  const style = song.style || 'pop';
  for (let i = ppb; i >= 1; i--) backing.push({ t: -i * pd, k: 'tick', acc: i === ppb });

  for (let p = 0; p < bars * ppb; p++) {
    const beat = p * pulse;
    const t = beat * spb;
    const pib = p % ppb;
    const ch = chordAt(beat);

    const bar = Math.floor(p / ppb);
    if (style === 'rap' || style === 'rock' || style === 'metal') {
      heavyBeat(backing, style, ch, t, pd, pib, bar);
      continue;
    }
    if (style === 'pop') {
      backing.push({ t, k: pib % 2 === 0 ? 'kick' : 'snare' });
      backing.push({ t, k: 'hat', v: 0.6 });
      backing.push({ t: t + pd / 2, k: 'hat', v: 0.35 });
    } else if (style === 'disco') {
      backing.push({ t, k: 'kick' });
      if (pib % 2 === 1) backing.push({ t, k: 'snare' });
      backing.push({ t: t + pd / 2, k: 'ohat', v: 0.8 });
    } else if (style === 'waltz') {
      backing.push(pib === 0 ? { t, k: 'kick', v: 0.7 } : { t, k: 'hat', v: 0.5 });
    } else {
      if (pib === 0) backing.push({ t, k: 'kick', v: 0.5 });
      backing.push({ t, k: 'hat', v: 0.3 });
    }

    if (!ch) continue;
    if (style === 'disco') {
      backing.push({ t, k: 'bass', m: bassMidi(ch.root), d: pd * 0.45 });
      backing.push({ t: t + pd / 2, k: 'bass', m: bassMidi(ch.root) + 12, d: pd * 0.4 });
      if (pib % 2 === 1) backing.push({ t, k: 'chord', ms: chordMidis(ch), d: pd * 0.5 });
    } else {
      const isBass = pib === 0 || Math.abs(beat % cb) < 1e-6 || (ppb === 4 && pib === 2);
      if (isBass) backing.push({ t, k: 'bass', m: bassMidi(ch.root), d: pd * 0.9 });
      else backing.push({ t, k: 'chord', ms: chordMidis(ch), d: pd * 0.8 });
    }
  }

  const endT = bars * bpb * spb;
  const tonic = chords.find(c => c);
  if (tonic) {
    backing.push({ t: endT, k: 'kick' });
    backing.push({ t: endT, k: 'bass', m: bassMidi(tonic.root), d: 1.6 });
    backing.push({ t: endT, k: 'chord', ms: chordMidis(tonic), d: 1.8 });
  }
  backing.sort((a, b) => a.t - b.t);

  const lastNoteTime = Math.max(...notes.map(n => n.time + (n.hold ? n.hold.dur : 0)));
  return {
    notes,
    backing,
    spb,
    bpb,
    pulse,
    lastNoteTime,
    endTime: Math.max(lastNoteTime, endT) + 1.6,
  };
}

// Kankán (Offenbach) – jedna prechádzka témou, takty po 2 doby
const KANKAN = `C5:2 | D5:0.5 F5:0.5 E5:0.5 D5:0.5 | G5 G5 | G5:0.5 A5:0.5 E5:0.5 F5:0.5 |
  D5 D5 | D5:0.5 F5:0.5 E5:0.5 D5:0.5 | C5:0.5 C6:0.5 B5:0.5 A5:0.5 | G5:0.5 F5:0.5 E5:0.5 D5:0.5 |
  C5:2 | D5:0.5 F5:0.5 E5:0.5 D5:0.5 | G5 G5 | G5:0.5 A5:0.5 E5:0.5 F5:0.5 |
  D5 D5 | D5:0.5 F5:0.5 E5:0.5 D5:0.5 | C5:0.5 C6:0.5 B5:0.5 A5:0.5 | G5:0.5 D5:0.5 E5:0.5 D5:0.5`;
const KANKAN_CH = `C | G7 | C | C | G7 | G7 | C | G7 | C | G7 | C | C | G7 | G7 | C | G7`;

const SONGS = [
  {
    id: 'hviezdicka',
    title: 'Hviezdička',
    credit: 'Ľudová melódia · voľné dielo',
    difficulty: 1,
    bpm: 100,
    chordBeats: 2,
    style: 'soft',
    speed: 1.7,
    snacks: ['cookie', 'candy', 'cookie'],
    bg: ['#1d2463', '#6c5bd4'],
    melody: `C5 C5 G5 G5 | A5 A5 G5:2~ | F5 F5 E5 E5 | D5 D5 C5:2 |
             G5 G5 F5 F5 | E5 E5 D5:2 | G5 G5 F5 F5 | E5 E5 D5:2 |
             C5 C5 G5 G5 | A5 A5 G5:2~ | F5 F5 E5 E5 | D5 D5 C5:2~`,
    chords: `C C | F C | F C | G C | C F | C G | C F | C G | C C | F C | F C | G C`,
  },
  {
    id: 'oda',
    title: 'Óda na radosť',
    credit: 'L. van Beethoven · voľné dielo',
    difficulty: 1,
    bpm: 116,
    chordBeats: 2,
    style: 'pop',
    speed: 1.6,
    snacks: ['donut', 'cupcake'],
    bg: ['#ff8a7a', '#ffc35e'],
    melody: `E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5:1.5 D5:0.5 D5:2~ |
             E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5:1.5 C5:0.5 C5:2~ |
             D5 D5 E5 C5 | D5 E5:0.5 F5:0.5 E5 C5 | D5 E5:0.5 F5:0.5 E5 D5 | C5 D5 G4:2~ |
             E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5:1.5 C5:0.5 C5:2~`,
    chords: `C C | G G | C C | C G | C C | G G | C C | G C | G C | G C | G G | C G | C C | G G | C C | G C`,
  },
  {
    id: 'pradenie',
    title: 'Nočné pradenie',
    credit: 'Pôvodná skladba',
    difficulty: 1,
    bpm: 92,
    beatsPerBar: 3,
    chordBeats: 3,
    switchEvery: 2,
    style: 'waltz',
    speed: 1.7,
    snacks: ['yarn', 'fish'],
    bg: ['#16204d', '#4b3f8f'],
    melody: `E5:2 G5 | C5:3~ | D5 E5 F5 | E5:3~ | F5:2 A5 | G5:2 E5 | D5 C5 D5 | E5:3>G5 |
             E5:2 G5 | C6:3~ | B5 A5 G5 | A5:3~ | F5:2 D5 | E5:2 C5 | D5 B4 D5 | C5:3~`,
    chords: `C | C | G7 | C | F | C | G | C | C | Am | G | F | Dm | C | G | C`,
  },
  {
    id: 'polka',
    title: 'Mačacia polka',
    credit: 'Pôvodná skladba',
    difficulty: 2,
    bpm: 124,
    style: 'pop',
    harmony: true,
    speed: 1.4,
    snacks: ['fish', 'sushi'],
    bg: ['#4fc79a', '#2f7fc9'],
    melody: `G4 B4 D5 B4 | C5 E5:2 C5 | B4 D5 G5 D5 | A4:3~ r |
             G4 B4 D5 B4 | C5 E5 G5 E5 | D5 C5 B4 A4 | G4:3~ r |
             E5 E5:0.5 F#5:0.5 G5 E5 | D5 D5:0.5 C5:0.5 B4 G4 | C5 C5:0.5 D5:0.5 E5 C5 | D5:2>A5 r:2 |
             E5 E5:0.5 F#5:0.5 G5 E5 | D5 B4 G5 D5 | C5 A4 F#4 A4 | G4:4~`,
    chords: `G | C | G | D | G | C | D7 | G | Em | G | C | D | Em | G | D7 | G`,
  },
  {
    id: 'eliska',
    title: 'Pre Elišku',
    credit: 'L. van Beethoven · voľné dielo',
    difficulty: 3,
    bpm: 250,
    beatsPerBar: 6,
    pulse: 2,
    chordBeats: 6,
    style: 'waltz',
    speed: 1.35,
    snacks: ['strawberry', 'candy'],
    bg: ['#b77fd6', '#5a4bb8'],
    melody: `r:4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 G#4 B4 | C5:2 r E4 E5 D#5 |
             E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 C5 B4 | A4:2 r B4 C5 D5 |
             E5:3 G4 F5 E5 | D5:3 F4 E5 D5 | C5:3 E4 D5 C5 | B4:4~ E5 D#5 |
             E5 D#5 E5 B4 D5 C5 | A4:2 r C4 E4 A4 | B4:2 r E4 C5 B4 | A4:6~`,
    chords: `- | - | Am | E | Am | - | Am | E | Am | C | G | Am | E | - | Am | E | Am`,
  },
  {
    id: 'disko',
    title: 'Rybacie disko',
    credit: 'Pôvodná skladba',
    difficulty: 3,
    bpm: 116,
    style: 'disco',
    harmony: true,
    speed: 1.25,
    snacks: ['fish', 'sushi', 'donut'],
    bg: ['#ff4f9a', '#4b2fbf'],
    melody: `A4 A4:0.5 C5:0.5 E5 A4 | G4 G4:0.5 B4:0.5 D5 G4 | F4 F4:0.5 A4:0.5 C5 F4 | E4 G#4 B4 E5 |
             A5:0.5 G5:0.5 E5 A5:0.5 G5:0.5 E5 | G5:0.5 F5:0.5 D5 G5:0.5 F5:0.5 D5 | F5:0.5 E5:0.5 C5 F5:0.5 E5:0.5 C5 | E5:0.5 D5:0.5 B4:0.5 G#4:0.5 E4:2~ |
             A4 C5 E5 A5 | G5:2>D5 B4 G4 | F4 A4 C5 F5 | E5 G#5 B5:2~ |
             A5:0.5 G5:0.5 E5 A5:0.5 G5:0.5 E5 | G5:0.5 F5:0.5 D5 G5:0.5 F5:0.5 D5 | F5:0.5 E5:0.5 C5 E5:0.5 D5:0.5 B4 | A4:4~`,
    chords: `Am | G | F | E | Am | G | F | E | Am | G | F | E | Am | G | Dm | Am`,
  },
  {
    id: 'kanon',
    title: 'Kánon',
    credit: 'J. Pachelbel · voľné dielo (úprava)',
    difficulty: 1,
    bpm: 76,
    chordBeats: 2,
    style: 'soft',
    speed: 1.75,
    snacks: ['star', 'yarn'],
    bg: ['#3b4a7a', '#c98fb8'],
    melody: `F#5:2~ E5:2 | D5:2~ C#5:2 | B4:2~ A4:2 | B4:2 C#5:2 |
             D5:2 C#5:2 | B4:2 A4:2 | G4:2 F#4:2 | G4:2 E4:2 |
             D5 F#5 A5:2~ | B4 D5 F#5:2 | G4 B4 D5:2 | G4 B4 C#5:2~ |
             F#5 E5 D5 C#5 | B4 A4 B4 C#5 | D5 C#5 B4 A4 | G4 F#4 E4 A4 | D5:4~`,
    chords: `D A | Bm F#m | G D | G A`,
  },
  {
    id: 'jakub',
    title: 'Brat Jakub (kánon)',
    credit: 'Ľudová pieseň · obe mačky spievajú naraz!',
    difficulty: 2,
    bpm: 100,
    canon: 2,
    style: 'soft',
    speed: 1.6,
    snacks: ['cookie', 'yarn'],
    bg: ['#ffb36b', '#e0607e'],
    melody: `C5 D5 E5 C5 | C5 D5 E5 C5 | E5 F5 G5:2 | E5 F5 G5:2 |
             G5:0.5 A5:0.5 G5:0.5 F5:0.5 E5 C5 | G5:0.5 A5:0.5 G5:0.5 F5:0.5 E5 C5 | C5 G4 C5:2 | C5 G4 C5:2 |
             C5 D5 E5 C5 | C5 D5 E5 C5 | E5 F5 G5:2 | E5 F5 G5:2 |
             G5:0.5 A5:0.5 G5:0.5 F5:0.5 E5 C5 | G5:0.5 A5:0.5 G5:0.5 F5:0.5 E5 C5 | C5 G4 C5:2 | C5 G4 C5:2~`,
    chords: `C`,
  },
  {
    id: 'zvoncky',
    title: 'Zvončeky',
    credit: 'J. L. Pierpont (Jingle Bells) · voľné dielo',
    difficulty: 2,
    bpm: 132,
    style: 'pop',
    harmony: true,
    speed: 1.45,
    snacks: ['candy', 'cookie', 'star'],
    bg: ['#d6455d', '#2e8b57'],
    melody: `E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:0.5 | E5:4~ |
             F5 F5 F5:1.5 F5:0.5 | F5 E5 E5 E5:0.5 E5:0.5 | E5 D5 D5 E5 | D5:2 G5:2 |
             E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:0.5 | E5:4~ |
             F5 F5 F5:1.5 F5:0.5 | F5 E5 E5 E5:0.5 E5:0.5 | G5 G5 F5 D5 | C5:4~`,
    chords: `C | C | C | C | F | C | D7 | G7 | C | C | C | C | F | C | G7 | C`,
  },
  {
    id: 'nocna',
    title: 'Malá nočná hudba',
    credit: 'W. A. Mozart · voľné dielo (úprava)',
    difficulty: 2,
    bpm: 120,
    style: 'pop',
    speed: 1.45,
    snacks: ['star', 'cupcake'],
    bg: ['#2a3d66', '#9b6be0'],
    melody: `G4 r:0.5 D4:0.5 G4 r:0.5 D4:0.5 | G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:2~ | C5 r:0.5 A4:0.5 C5 r:0.5 A4:0.5 | C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:2~ |
             G4:0.5 G4:0.5 B4:0.5 A4:0.5 G4:0.5 G4:0.5 F#4:0.5 F#4:0.5 | A4:0.5 C5:0.5 F#4:0.5 A4:0.5 G4:0.5 G4:0.5 B4:0.5 A4:0.5 | G4:0.5 G4:0.5 F#4:0.5 F#4:0.5 A4:0.5 C5:0.5 F#4:0.5 A4:0.5 | G4:2 r:2 |
             G4 r:0.5 D4:0.5 G4 r:0.5 D4:0.5 | G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:2~ | C5 r:0.5 A4:0.5 C5 r:0.5 A4:0.5 | C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:2~ |
             G4:0.5 G4:0.5 B4:0.5 A4:0.5 G4:0.5 G4:0.5 F#4:0.5 F#4:0.5 | A4:0.5 C5:0.5 F#4:0.5 A4:0.5 G4:0.5 G4:0.5 B4:0.5 A4:0.5 | G4:0.5 G4:0.5 F#4:0.5 F#4:0.5 A4:0.5 C5:0.5 F#4:0.5 A4:0.5 | G4:4~`,
    chords: `G | G | D | D | G | D | D | G | G | G | D | D | G | D | D | G`,
  },
  {
    id: 'jar',
    title: 'Jar',
    credit: 'Podľa A. Vivaldiho · voľné dielo',
    difficulty: 2,
    bpm: 104,
    style: 'pop',
    harmony: true,
    speed: 1.45,
    snacks: ['strawberry', 'fish'],
    bg: ['#5cc16a', '#f5a623'],
    melody: `r:3 E5 | G#5 G#5 G#5 F#5:0.5 E5:0.5 | B5:3~ B5:0.5 A5:0.5 | G#5 G#5 G#5 F#5:0.5 E5:0.5 | B5:3~ B5:0.5 A5:0.5 |
             G#5 A5:0.5 B5:0.5 A5 G#5 | F#5:3~ E5 | G#5 G#5 G#5 F#5:0.5 E5:0.5 | B5:3~ B5:0.5 A5:0.5 |
             G#5 G#5 G#5 F#5:0.5 E5:0.5 | B5:3~ B5:0.5 A5:0.5 | G#5 A5:0.5 B5:0.5 A5 G#5 | F#5:2 D#5 B4 | E5:4~`,
    chords: `- | E | E | E | E | E | B | E | E | E | E | E | B | E`,
  },
  {
    id: 'kral',
    title: 'V jaskyni horského kráľa',
    credit: 'E. Grieg · voľné dielo (úprava)',
    difficulty: 3,
    bpm: 120,
    style: 'disco',
    speed: 1.3,
    snacks: ['fish', 'star'],
    bg: ['#3a2a5a', '#8a2be2'],
    melody: `A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5 | D#5:0.5 B4:0.5 D#5 D5:0.5 A#4:0.5 D5 | A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5:0.5 A5:0.5 | G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:2~ |
             A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5 | D#5:0.5 B4:0.5 D#5 D5:0.5 A#4:0.5 D5 | A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5:0.5 A5:0.5 | G5:0.5 E5:0.5 C5:0.5 E5:0.5 A4:2~ |
             E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 G4:0.5 B4 | A#4:0.5 F#4:0.5 A#4 A4:0.5 F4:0.5 A4 | E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 G4:0.5 B4:0.5 E5:0.5 | D5:0.5 B4:0.5 G4:0.5 B4:0.5 D5:2~ |
             A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5 | D#5:0.5 B4:0.5 D#5 D5:0.5 A#4:0.5 D5 | A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 C5:0.5 E5:0.5 A5:0.5 | G5:0.5 E5:0.5 C5:0.5 E5:0.5 A4:2~`,
    chords: `Am | E | Am | C | Am | E | Am | Am | Em | B | Em | G | Am | E | Am | Am`,
  },
  {
    id: 'turecky',
    title: 'Turecký pochod',
    credit: 'W. A. Mozart · voľné dielo (úprava)',
    difficulty: 3,
    bpm: 100,
    beatsPerBar: 2,
    chordBeats: 2,
    switchEvery: 2,
    style: 'pop',
    speed: 1.3,
    snacks: ['candy', 'donut'],
    bg: ['#e0475b', '#7b2d8e'],
    melody: `B4:0.25 A4:0.25 G#4:0.25 A4:0.25 C5:1 | D5:0.25 C5:0.25 B4:0.25 C5:0.25 E5:1 |
             F5:0.25 E5:0.25 D#5:0.25 E5:0.25 B5:0.25 A5:0.25 G#5:0.25 A5:0.25 | B5:0.25 A5:0.25 G#5:0.25 A5:0.25 C6:1 |
             A5:0.5 C6:0.5 B5:0.5 A5:0.5 | G5:0.5 A5:0.5 B5:0.5 A5:0.5 | G5:0.5 A5:0.5 B5:0.5 A5:0.5 | G5:0.5 F#5:0.5 E5:1~ |
             B4:0.25 A4:0.25 G#4:0.25 A4:0.25 C5:1 | D5:0.25 C5:0.25 B4:0.25 C5:0.25 E5:1 |
             F5:0.25 E5:0.25 D#5:0.25 E5:0.25 B5:0.25 A5:0.25 G#5:0.25 A5:0.25 | B5:0.25 A5:0.25 G#5:0.25 A5:0.25 C6:1 |
             A5:0.5 C6:0.5 B5:0.5 A5:0.5 | G#5:0.5 B5:0.5 E5:0.5 G#5:0.5 | A5:0.5 E5:0.5 C5:0.5 B4:0.5 | A4:2~`,
    chords: `Am | Am | E | Am | Am | G | C | Em | Am | Am | E | Am | Am | E | Am | Am`,
  },
  {
    id: 'rokenrol',
    title: 'Mňaukový rokenrol',
    credit: 'Pôvodná skladba',
    difficulty: 3,
    bpm: 152,
    style: 'pop',
    harmony: true,
    speed: 1.3,
    snacks: ['donut', 'fish', 'sushi'],
    bg: ['#ff6b3d', '#c2185b'],
    melody: `C5:0.5 E5:0.5 G5:0.5 A5:0.5 Bb5:0.5 A5:0.5 G5:0.5 E5:0.5 | C5:0.5 E5:0.5 G5:0.5 A5:0.5 G5:2~ |
             F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:0.5 A5:0.5 C6 | G5:0.5 E5:0.5 C5 E5:2>G5 |
             G4:0.5 B4:0.5 D5:0.5 E5:0.5 F5:0.5 E5:0.5 D5:0.5 B4:0.5 | F4:0.5 A4:0.5 C5:0.5 D5:0.5 Eb5:0.5 D5:0.5 C5:0.5 A4:0.5 |
             C5 E5:0.5 G5:0.5 C6 G5 | D5:0.5 C5:0.5 B4:0.5 G4:0.5 C5:2~ |
             C5:0.5 E5:0.5 G5:0.5 A5:0.5 Bb5:0.5 A5:0.5 G5:0.5 E5:0.5 | C5:0.5 E5:0.5 G5:0.5 A5:0.5 G5:2~ |
             F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:0.5 A5:0.5 C6 | G5:0.5 E5:0.5 C5 E5:2>G5 |
             G4:0.5 B4:0.5 D5:0.5 E5:0.5 F5:0.5 E5:0.5 D5:0.5 B4:0.5 | F4:0.5 A4:0.5 C5:0.5 D5:0.5 Eb5:0.5 D5:0.5 C5:0.5 A4:0.5 |
             C5 E5:0.5 G5:0.5 C6 G5 | D5:0.5 C5:0.5 B4:0.5 G4:0.5 C5:2~`,
    chords: `C | C | F | C | G | F | C | G | C | C | F | C | G | F | C | C`,
  },

  // ---------- Rap ----------
  {
    id: 'mnaurap',
    title: 'Mňau-rap',
    credit: 'Pôvodná skladba · rap',
    difficulty: 2,
    bpm: 92,
    style: 'rap',
    speed: 1.45,
    snacks: ['donut', 'candy'],
    bg: ['#2b2b3a', '#e0a43a'],
    melody: `A4:0.5 A4:0.5 C5:0.5 A4:0.5 r:0.5 A4:0.5 C5 | C5:0.5 C5:0.5 D5:0.5 C5:0.5 A4:2~ |
             E5:0.5 E5:0.5 D5:0.5 C5:0.5 r:0.5 C5:0.5 D5 | E5:0.5 D5:0.5 C5:0.5 A4:0.5 G4:2 |
             A4:0.5 A4:0.5 C5:0.5 A4:0.5 r:0.5 A4:0.5 C5 | C5:0.5 C5:0.5 D5:0.5 C5:0.5 F5:2~ |
             E5:0.5 E5:0.5 D5:0.5 C5:0.5 r:0.5 C5:0.5 D5:0.5 E5:0.5 | G5:1.5 E5:0.5 D5 G4 |
             r:0.5 A4:0.5 A4:0.5 A4:0.5 C5 A4 | r:0.5 C5:0.5 C5:0.5 C5:0.5 D5 C5 |
             r:0.5 E5:0.5 E5:0.5 E5:0.5 G5 E5 | D5:0.5 D5:0.5 C5:0.5 D5:0.5 B4:2~ |
             A4:0.5 A4:0.5 C5:0.5 A4:0.5 r:0.5 A4:0.5 C5 | C5:0.5 C5:0.5 D5:0.5 C5:0.5 F5:2~ |
             E5:0.5 E5:0.5 D5:0.5 C5:0.5 D5:0.5 E5:0.5 G5 | E5:2>A5 r:2`,
    chords: `Am | F | C | G | Am | F | C | G | Am | F | C | G | Am | F | C | Am`,
  },
  {
    id: 'flow',
    title: 'Tlapkový flow',
    credit: 'Pôvodná skladba · rap',
    difficulty: 3,
    bpm: 96,
    style: 'rap',
    harmony: true,
    speed: 1.3,
    snacks: ['sushi', 'fish', 'candy'],
    bg: ['#1b1b2f', '#7b2ff7'],
    melody: `D5:0.25 D5:0.25 D5:0.5 F5:0.5 D5:0.5 r:0.5 D5:0.25 D5:0.25 F5:0.5 A5:0.5 | G5:0.5 F5:0.5 D5:0.5 F5:0.5 r:0.5 D5:0.5 C5 |
             C5:0.25 C5:0.25 C5:0.5 F5:0.5 C5:0.5 r:0.5 C5:0.25 C5:0.25 F5:0.5 A5:0.5 | G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:2~ |
             A5:0.5 A5:0.5 G5:0.5 F5:0.5 r:0.5 F5:0.25 F5:0.25 G5:0.5 A5:0.5 | Bb5:0.5 A5:0.5 G5:0.5 F5:0.5 D5:2~ |
             F5:0.25 F5:0.25 F5:0.5 A5:0.5 F5:0.5 C5:0.5 F5:0.5 A5:0.5 C6:0.5 | Bb5:0.5 A5:0.5 G5:0.5 E5:0.5 C5:2 |
             D5:0.25 D5:0.25 D5:0.5 F5:0.5 D5:0.5 r:0.5 D5:0.25 D5:0.25 F5:0.5 A5:0.5 | G5:0.5 F5:0.5 D5:0.5 F5:0.5 r:0.5 D5:0.5 C5 |
             C5:0.25 C5:0.25 C5:0.5 F5:0.5 C5:0.5 r:0.5 C5:0.25 C5:0.25 F5:0.5 A5:0.5 | G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:2~ |
             A5:0.5 A5:0.5 G5:0.5 F5:0.5 r:0.5 F5:0.25 F5:0.25 G5:0.5 A5:0.5 | Bb5:0.5 A5:0.5 G5:0.5 F5:0.5 D5:2~ |
             F5:0.25 F5:0.25 F5:0.5 A5:0.5 F5:0.5 C5:0.5 F5:0.5 A5:0.5 C6:0.5 | Bb5:0.5 A5:0.5 G5:0.5 E5:0.5 D5:2~`,
    chords: `Dm | Bb | F | C | Dm | Bb | F | C7 | Dm | Bb | F | C | Dm | Bb | F | Dm`,
  },

  // ---------- Rock ----------
  {
    id: 'kocurrock',
    title: 'Kocúrí rock',
    credit: 'Pôvodná skladba · rock',
    difficulty: 2,
    bpm: 128,
    style: 'rock',
    speed: 1.45,
    snacks: ['fish', 'donut'],
    bg: ['#c0392b', '#2c3e50'],
    melody: `E5 G5:0.5 E5:0.5 A5 G5:0.5 E5:0.5 | A5 C#6:0.5 A5:0.5 B5:2~ | B5 A5:0.5 G#5:0.5 F#5 E5 | E5:3~ r |
             E5 G5:0.5 E5:0.5 A5 G5:0.5 E5:0.5 | A5 B5:0.5 A5:0.5 F#5:2~ | B5:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:0.5 G#5:0.5 A5:0.5 B5:0.5 | E5:2~ r:2 |
             G5:0.5 G5:0.5 E5 G5:0.5 G5:0.5 E5 | A5:0.5 A5:0.5 F#5 A5:0.5 A5:0.5 F#5 | B5 B5:0.5 A5:0.5 G#5 F#5 | E5:2 B4:2~ |
             E5 G5:0.5 E5:0.5 A5 G5:0.5 E5:0.5 | A5 B5:0.5 A5:0.5 F#5:2~ | B5:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:0.5 G#5:0.5 A5:0.5 B5:0.5 | E5:4~`,
    chords: `E | A | B | E | E | A | B | E | E | A | B | E | E | A | B | E`,
  },
  {
    id: 'strecha',
    title: 'Strecha v plameňoch',
    credit: 'Pôvodná skladba · rock',
    difficulty: 3,
    bpm: 144,
    style: 'rock',
    harmony: true,
    speed: 1.3,
    snacks: ['star', 'fish', 'donut'],
    bg: ['#ff5e3a', '#5b1a6b'],
    melody: `A4:0.5 A4:0.5 C5:0.5 A4:0.5 D5:0.5 A4:0.5 E5 | F5:0.5 E5:0.5 D5:0.5 C5:0.5 D5:2~ |
             G4:0.5 G4:0.5 B4:0.5 G4:0.5 C5:0.5 G4:0.5 D5 | E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:2~ |
             A4:0.5 A4:0.5 C5:0.5 A4:0.5 D5:0.5 A4:0.5 E5 | F5:0.5 E5:0.5 D5:0.5 C5:0.5 D5:2~ |
             G4:0.5 G4:0.5 B4:0.5 G4:0.5 C5:0.5 G4:0.5 D5 | E5:0.5 F5:0.5 G5:0.5 G#5:0.5 A5:2~ |
             A5 G5:0.5 E5:0.5 C5 E5 | G5:1.5 E5:0.5 D5:2 | E5:0.5 E5:0.5 G5:0.5 A5:0.5 C6:0.5 A5:0.5 G5 | A5:3~ r |
             A5 G5:0.5 E5:0.5 C5 E5 | G5:1.5 E5:0.5 D5:2 | C5:0.5 D5:0.5 E5:0.5 G5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 | A4:4~`,
    chords: `Am | Dm | G | Am | Am | Dm | G | E | F | G | Am | Am | F | G | G | Am`,
  },
  {
    id: 'kankan',
    title: 'Kankán (rock)',
    credit: 'J. Offenbach · voľné dielo (rocková úprava)',
    difficulty: 4,
    bpm: 144,
    beatsPerBar: 2,
    chordBeats: 2,
    switchEvery: 2,
    style: 'rock',
    speed: 1.2,
    snacks: ['candy', 'strawberry', 'cupcake'],
    bg: ['#ff2e7e', '#ffb02e'],
    melody: KANKAN + ' | ' + KANKAN + ' | C5:2~',
    chords: KANKAN_CH + ' | ' + KANKAN_CH + ' | C',
  },

  // ---------- Metal ----------
  {
    id: 'pazurmetal',
    title: 'Pazúrový metal',
    credit: 'Pôvodná skladba · metal',
    difficulty: 4,
    bpm: 168,
    style: 'metal',
    harmony: true,
    speed: 1.2,
    snacks: ['fish', 'star'],
    bg: ['#0d0d0d', '#8b0000'],
    melody: `E5:0.5 E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 G5:0.5 E5:0.5 A5:0.5 G5:0.5 | F#5:0.5 E5:0.5 D5:0.5 E5:0.5 B4:2~ |
             E5:0.5 E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 G5:0.5 E5:0.5 A5:0.5 G5:0.5 | Bb5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:2~ |
             C5:0.5 C5:0.25 C5:0.25 C5:0.5 C5:0.25 C5:0.25 E5:0.5 C5:0.5 G5:0.5 E5:0.5 | D5:0.5 D5:0.25 D5:0.25 D5:0.5 D5:0.25 D5:0.25 F#5:0.5 D5:0.5 A5:0.5 F#5:0.5 |
             E5:0.5 G5:0.5 B5:0.5 G5:0.5 A5:0.5 B5:0.5 G5:0.5 F#5:0.5 | E5:3~ r |
             B5 A5:0.5 G5:0.5 F#5 G5:0.5 A5:0.5 | B5:2~ E5:2 | C6 B5:0.5 A5:0.5 G5 A5:0.5 B5:0.5 | A5:2~ D5:2 |
             E5:0.5 E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 G5:0.5 E5:0.5 A5:0.5 G5:0.5 | F#5:0.5 E5:0.5 D5:0.5 E5:0.5 B4:2~ |
             G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 D#5:0.5 F#5:0.5 | E5:4~`,
    chords: `Em | Bm | Em | Em | C | D | Em | Em | G | Em | Am | D | Em | Bm | B7 | Em`,
  },
  {
    id: 'burka',
    title: 'Nočná búrka',
    credit: 'Pôvodná skladba · metal',
    difficulty: 4,
    bpm: 152,
    style: 'metal',
    speed: 1.2,
    snacks: ['star', 'sushi'],
    bg: ['#141e30', '#4a00e0'],
    melody: `D5:0.25 D5:0.25 D5:0.25 D5:0.25 F5:0.5 D5:0.5 G5:0.5 D5:0.5 A5:0.5 G5:0.5 | F5:0.5 E5:0.5 D5:0.5 C#5:0.5 D5:2~ |
             D5:0.25 D5:0.25 D5:0.25 D5:0.25 F5:0.5 D5:0.5 G5:0.5 D5:0.5 A5:0.5 G5:0.5 | Bb5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 F5:0.5 G5:0.5 A5:0.5 |
             Bb4:0.25 Bb4:0.25 Bb4:0.25 Bb4:0.25 D5:0.5 Bb4:0.5 F5:0.5 Bb4:0.5 G5:0.5 F5:0.5 | C5:0.25 C5:0.25 C5:0.25 C5:0.25 E5:0.5 C5:0.5 G5:0.5 C5:0.5 A5:0.5 G5:0.5 |
             D6 C6:0.5 A5:0.5 Bb5 G5 | A5:3~ r |
             D6:0.5 A5:0.5 F5:0.5 D5:0.5 D6:0.5 A5:0.5 F5:0.5 D5:0.5 | C6:0.5 G5:0.5 E5:0.5 C5:0.5 C6:0.5 G5:0.5 E5:0.5 C5:0.5 |
             Bb5:0.5 F5:0.5 D5:0.5 Bb4:0.5 Bb5:0.5 F5:0.5 D5:0.5 Bb4:0.5 | A5:0.5 E5:0.5 C#5:0.5 A4:0.5 A5:2~ |
             D5:0.25 D5:0.25 D5:0.25 D5:0.25 F5:0.5 D5:0.5 G5:0.5 D5:0.5 A5:0.5 G5:0.5 | F5:0.5 E5:0.5 D5:0.5 C#5:0.5 D5:2~ |
             Bb5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:0.5 C#5:0.5 E5:0.5 | D5:4~`,
    chords: `Dm | Dm | Dm | Gm | Bb | C | Gm | A | Dm | C | Bb | A | Dm | Dm | A7 | Dm`,
  },

  // ---------- Klasika ----------
  {
    id: 'dunaj',
    title: 'Na krásnom modrom Dunaji',
    credit: 'J. Strauss ml. · voľné dielo (úprava)',
    difficulty: 2,
    bpm: 168,
    beatsPerBar: 3,
    chordBeats: 3,
    switchEvery: 2,
    style: 'waltz',
    speed: 1.45,
    snacks: ['star', 'cupcake', 'strawberry'],
    bg: ['#2f80ed', '#56ccf2'],
    melody: `r:2 D4 | D4 F#4 A4 | A5:3~ | r A5 A5 | r F#5 F#5 |
             r:2 D4 | D4 F#4 A4 | A5:3~ | r A5 A5 | r G5 G5 |
             r:2 C#4 | C#4 E4 B4 | B5:3~ | r B5 B5 | r G5 G5 |
             r:2 C#4 | C#4 E4 B4 | B5:3~ | r B5 B5 | r F#5 F#5 |
             r:2 D4 | D4 F#4 A4 | D6:3~ | r D6 D6 | r A5 A5 |
             r:2 D4 | D4 F#4 A4 | D6:3~ | r D6 D6 | r B5 B5 |
             r:2 E4 | E4 G4 B4 | B5:3~ | A5:2 C#5 | D5:3~`,
    chords: `- | D | D | D | D | D | D | D | D | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | A7 | D |
             D | D | D | D | D | D | D | D | D | G | G | Em | Em | A7 | D`,
  },

  // ---------- Extrém (obtiažnosť 5): rýchle, husté noty a veľké skoky ----------
  {
    id: 'cmeliak',
    title: 'Let čmeliaka',
    credit: 'N. Rimskij-Korsakov · voľné dielo (úprava)',
    difficulty: 5,
    bpm: 168,
    style: 'disco',
    speed: 1.1,
    snacks: ['candy', 'star', 'strawberry'],
    bg: ['#f5b700', '#3d2c00'],
    melody: `E6:0.5 D#6:0.5 D6:0.5 C#6:0.5 D6:0.5 C#6:0.5 C6:0.5 B5:0.5 | C6:0.5 B5:0.5 Bb5:0.5 A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 |
             E5:0.5 D#5:0.5 D5:0.5 C#5:0.5 C5:0.5 F5:0.5 E5:0.5 D#5:0.5 | E5:0.5 D#5:0.5 D5:0.5 C#5:0.5 C5:0.5 C#5:0.5 D5:0.5 D#5:0.5 |
             E5:0.5 D#5:0.5 D5:0.5 C#5:0.5 C5:0.5 F5:0.5 E5:0.5 D#5:0.5 | E5:0.5 D#5:0.5 D5:0.5 C#5:0.5 C5:0.5 C#5:0.5 D5:0.5 D#5:0.5 |
             E5:0.5 D#5:0.5 D5:0.5 C#5:0.5 D5:0.5 C#5:0.5 C5:0.5 B4:0.5 | C5:0.5 C#5:0.5 D5:0.5 D#5:0.5 E5:2~ |
             A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 Bb5:0.5 A5:0.5 G#5:0.5 | A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 F#5:0.5 G5:0.5 G#5:0.5 |
             A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 Bb5:0.5 A5:0.5 G#5:0.5 | A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 F#5:0.5 G5:0.5 G#5:0.5 |
             A5:0.5 B5:0.5 C6:0.5 D6:0.5 E6:0.5 D6:0.5 C6:0.5 B5:0.5 | A5:0.5 E5:0.5 A5:0.5 E5:0.5 C6:0.5 A5:0.5 E6:0.5 C6:0.5 |
             B5:0.5 G#5:0.5 E5:0.5 G#5:0.5 B5:0.5 E6:0.5 D6:0.5 B5:0.5 | A5:4~`,
    chords: `Am | Am | Am | Am | Am | Am | E | E | Dm | Dm | Dm | Dm | Am | Am | E | Am`,
  },
  {
    id: 'galop',
    title: 'Galop Viliama Tella',
    credit: 'G. Rossini · voľné dielo (rocková úprava)',
    difficulty: 5,
    bpm: 152,
    beatsPerBar: 2,
    chordBeats: 2,
    switchEvery: 2,
    style: 'rock',
    speed: 1.1,
    snacks: ['fish', 'cookie', 'donut'],
    bg: ['#2e7d32', '#c8a400'],
    melody: `E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 E5:0.5 | E5:0.25 E5:0.25 A5:0.5 B5:0.5 C#6:0.5 |
             E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 A5:0.5 | C#6:0.25 C#6:0.25 B5:0.5 G#5:0.5 E5:0.5 |
             E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 E5:0.5 | E5:0.25 E5:0.25 A5:0.5 B5:0.5 C#6:0.5 |
             B5:0.25 B5:0.25 B5:0.5 C#6:0.5 B5:0.5 | A5 r |
             A4:0.5 E5:0.5 A5:0.5 E5:0.5 | B4:0.5 E5:0.5 G#5:0.5 E5:0.5 | C#5:0.5 E5:0.5 A5:0.5 C#6:0.5 | B5:0.5 G#5:0.5 E5 |
             A4:0.5 E5:0.5 A5:0.5 E5:0.5 | D5:0.5 F#5:0.5 B5:0.5 F#5:0.5 | E5:0.25 E5:0.25 G#5:0.5 B5:0.5 E6:0.5 | A5:2~ |
             E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 E5:0.5 | E5:0.25 E5:0.25 A5:0.5 B5:0.5 C#6:0.5 |
             E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 A5:0.5 | C#6:0.25 C#6:0.25 B5:0.5 G#5:0.5 E5:0.5 |
             E5:0.25 E5:0.25 E5:0.5 E5:0.25 E5:0.25 E5:0.5 | E5:0.25 E5:0.25 A5:0.5 B5:0.5 C#6:0.5 |
             B5:0.25 B5:0.25 B5:0.5 C#6:0.5 B5:0.5 | A5:2~`,
    chords: `A | A | A | E | A | A | E | A | A | E | A | E | A | D | E | A | A | A | A | E | A | A | E | A`,
  },
  {
    id: 'turborap',
    title: 'Turbo rap',
    credit: 'Pôvodná skladba · rap',
    difficulty: 5,
    bpm: 104,
    style: 'rap',
    harmony: true,
    speed: 1.1,
    snacks: ['sushi', 'donut', 'candy'],
    bg: ['#111827', '#00b4d8'],
    melody: `C5:0.25 C5:0.25 Eb5:0.25 C5:0.25 G5:0.5 C5:0.5 r:0.5 C5:0.25 C5:0.25 Eb5:0.5 G5:0.5 |
             Ab5:0.25 G5:0.25 Eb5:0.25 C5:0.25 Ab4:0.5 C5:0.5 Eb5:0.5 Ab5:0.5 C6 |
             Bb5:0.25 G5:0.25 Eb5:0.25 Bb4:0.25 Eb5:0.5 G5:0.5 r:0.5 Bb5:0.25 Bb5:0.25 G5:0.5 Eb5:0.5 |
             F5:0.25 F5:0.25 G5:0.25 Ab5:0.25 Bb5:0.5 F5:0.5 D5:2~ |
             C5:0.25 C5:0.25 Eb5:0.25 C5:0.25 G5:0.5 C5:0.5 r:0.5 C5:0.25 C5:0.25 Eb5:0.5 G5:0.5 |
             Ab5:0.25 G5:0.25 Eb5:0.25 C5:0.25 Ab5:0.5 C6:0.5 Ab5:0.5 Eb5:0.5 C5 |
             Eb5:0.25 Eb5:0.25 G5:0.25 Bb5:0.25 Eb6:0.5 Bb5:0.5 G5:0.25 G5:0.25 Eb5:0.25 G5:0.25 Bb5 |
             Bb5:0.5 Ab5:0.5 G5:0.5 F5:0.5 G5:2~ |
             r:0.5 C6:0.5 G5:0.5 C6:0.5 r:0.5 Ab5:0.5 Eb5:0.5 Ab5:0.5 | r:0.5 Bb5:0.5 F5:0.5 Bb5:0.5 G5:0.25 G5:0.25 G5:0.25 G5:0.25 G5 |
             r:0.5 C6:0.5 G5:0.5 C6:0.5 r:0.5 Ab5:0.5 Eb5:0.5 Ab5:0.5 | r:0.5 Bb5:0.5 D6:0.5 Bb5:0.5 G5:0.5 F5:0.5 D5:0.5 B4:0.5 |
             C5:0.25 C5:0.25 Eb5:0.25 C5:0.25 G5:0.5 C5:0.5 r:0.5 C5:0.25 C5:0.25 Eb5:0.5 G5:0.5 |
             Ab5:0.25 G5:0.25 Eb5:0.25 C5:0.25 Ab4:0.5 C5:0.5 Eb5:0.5 Ab5:0.5 C6 |
             Eb5:0.25 Eb5:0.25 G5:0.25 Bb5:0.25 Eb6:0.5 Bb5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5 | C5:2~ r:2`,
    chords: `Cm | Ab | Eb | Bb | Cm | Ab | Eb | Bb | Cm | Bb | Ab | G | Cm | Ab | G | Cm`,
  },
  {
    id: 'hurikan',
    title: 'Mačací hurikán',
    credit: 'Pôvodná skladba · rock',
    difficulty: 5,
    bpm: 184,
    style: 'rock',
    harmony: true,
    speed: 1.05,
    snacks: ['fish', 'star', 'cupcake'],
    bg: ['#00a6a6', '#3a0ca3'],
    melody: `D5:0.5 F#5:0.5 A5:0.5 D6:0.5 A5:0.5 F#5:0.5 D5 | G5:0.5 B5:0.5 D6:0.5 B5:0.5 G5:0.5 B5:0.5 A5 |
             A4:0.5 C#5:0.5 E5:0.5 A5:0.5 C#6:0.5 A5:0.5 E5 | F#5:0.5 E5:0.5 D5:0.5 E5:0.5 F#5:2~ |
             D5:0.5 F#5:0.5 A5:0.5 D6:0.5 A5:0.5 F#5:0.5 D5 | G5:0.5 B5:0.5 D6:0.5 E6:0.5 D6:0.5 B5:0.5 G5 |
             A5:0.5 G5:0.5 F#5:0.5 E5:0.5 C#5:0.5 E5:0.5 A4 | D5:3~ r |
             B5:0.25 B5:0.25 A5:0.5 F#5:0.5 D5:0.5 B4:0.5 D5:0.5 F#5:0.5 B5:0.5 |
             A5:0.25 A5:0.25 G5:0.5 E5:0.5 C#5:0.5 A4:0.5 C#5:0.5 E5:0.5 A5:0.5 |
             G5:0.25 G5:0.25 F#5:0.5 D5:0.5 B4:0.5 G5:0.5 B5:0.5 D6:0.5 B5:0.5 | A5:0.5 E6:0.5 C#6:0.5 A5:0.5 E5:2>A5 |
             B5:0.25 B5:0.25 A5:0.5 F#5:0.5 D5:0.5 B4:0.5 D5:0.5 F#5:0.5 B5:0.5 |
             A5:0.25 A5:0.25 G5:0.5 E5:0.5 C#5:0.5 A4:0.5 C#5:0.5 E5:0.5 A5:0.5 |
             D6:0.5 A5:0.5 F#5:0.5 A5:0.5 G5:0.5 B5:0.5 A5:0.5 C#6:0.5 | D6:4~`,
    chords: `D | G | A | D | D | G | A | D | Bm | A | G | A | Bm | A | A | D`,
  },
  {
    id: 'laser',
    title: 'Laserová myš',
    credit: 'Pôvodná skladba · metal',
    difficulty: 5,
    bpm: 176,
    style: 'metal',
    harmony: true,
    speed: 1.05,
    snacks: ['fish', 'sushi', 'star'],
    bg: ['#1a0000', '#ff0054'],
    melody: `E5:0.5 B5:0.5 E5:0.5 G5:0.5 E5:0.5 B5:0.5 A5:0.5 G5:0.5 | F#5:0.5 B4:0.5 F#5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5 |
             C5:0.5 G5:0.5 C5:0.5 E5:0.5 C5:0.5 G5:0.5 F#5:0.5 E5:0.5 | D5:0.5 A5:0.5 D5:0.5 F#5:0.5 A5:0.5 D6:0.5 B5 |
             E5:0.5 B5:0.5 E5:0.5 G5:0.5 E5:0.5 B5:0.5 A5:0.5 G5:0.5 | F#5:0.5 B4:0.5 F#5:0.5 A5:0.5 B5:0.5 C6:0.5 B5 |
             E6:0.5 B5:0.5 G5:0.5 E5:0.5 D6:0.5 A5:0.5 F#5:0.5 D5:0.5 | E5:3~ r |
             E5:0.25 E5:0.25 E5:0.25 E5:0.25 G5:0.5 E5:0.5 B5:0.25 B5:0.25 B5:0.25 B5:0.25 A5:0.5 G5:0.5 |
             F#5:0.25 F#5:0.25 F#5:0.25 F#5:0.25 A5:0.5 F#5:0.5 D6:0.5 C6:0.5 B5 |
             C6:0.5 G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:0.5 C6:0.5 E6:0.5 | D6:0.5 A5:0.5 F#5:0.5 D5:0.5 B4:2~ |
             E5:0.25 E5:0.25 E5:0.25 E5:0.25 G5:0.5 E5:0.5 B5:0.25 B5:0.25 B5:0.25 B5:0.25 A5:0.5 G5:0.5 |
             F#5:0.25 F#5:0.25 F#5:0.25 F#5:0.25 A5:0.5 F#5:0.5 B5:0.5 D6:0.5 E6 |
             D6:0.5 B5:0.5 A5:0.5 F#5:0.5 G5:0.5 F#5:0.5 D#5:0.5 B4:0.5 | E5:4~`,
    chords: `Em | Bm | C | D | Em | B | Em | Em | Em | D | C | B | Em | D | B7 | Em`,
  },
];
