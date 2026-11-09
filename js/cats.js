'use strict';
/*
 * Mačky a pochúťky – všetko sa kreslí kódom na canvas (žiadne obrázky).
 * Novú mačku pridáš jednoducho: skopíruj riadok v CATS a zmeň farby/doplnok.
 *
 * pattern: solid | tabby | tiger | tuxedo | calico | spots | siamese | socks | bicolor | rainbow | galaxy
 * acc:     bow | tophat | crown | glasses | sunglasses | scarf | bell | headphones | flower | beret
 *          chef | wizard | pirate | halo | cap | leaf | antenna | star | heart
 * voice:   wave = sawtooth (jasný) | square (nosový) | triangle (jemný), formant = "veľkosť" hlasu
 */
const CATS = [
  { id: 'mica', name: 'Mica', body: '#a9afbd', belly: '#e6e9ef', pattern: 'solid', eye: '#58b368', voice: { wave: 'sawtooth', formant: 1.0 } },
  { id: 'rysavec', name: 'Ryšavec', body: '#f5a14a', belly: '#ffe0b8', pattern: 'tabby', pc: '#d8742a', eye: '#6aa84f', voice: { wave: 'sawtooth', formant: 1.05 } },
  { id: 'murko', name: 'Murko', body: '#3a3640', belly: '#57525e', pattern: 'solid', eye: '#f5c84c', acc: 'bell', accColor: '#e0475b', voice: { wave: 'square', formant: 0.9 } },
  { id: 'snehulka', name: 'Snehulka', body: '#fbfbfd', belly: '#ffffff', pattern: 'solid', eye: '#5aa6e8', acc: 'bow', accColor: '#ff7eb6', voice: { wave: 'triangle', formant: 1.2 } },
  { id: 'fliacik', name: 'Fliačik', body: '#fdf6ee', belly: '#ffffff', pattern: 'calico', eye: '#8bc34a', acc: 'flower', accColor: '#ff9fc6', voice: { wave: 'sawtooth', formant: 1.1 } },
  { id: 'siam', name: 'Siam', body: '#f3e3c8', belly: '#fbf1e0', pattern: 'siamese', pc: '#5b3d2e', eye: '#4fa3e0', voice: { wave: 'triangle', formant: 1.0 } },
  { id: 'smoking', name: 'Pán Smoking', body: '#2f2b35', pattern: 'tuxedo', eye: '#9ad35b', acc: 'tophat', accColor: '#25222b', voice: { wave: 'square', formant: 0.85 } },
  { id: 'kapitan', name: 'Kapitán Packa', body: '#f08c3c', belly: '#ffd9b0', pattern: 'tabby', pc: '#c9692a', eye: '#f5c84c', acc: 'pirate', accColor: '#e0475b', voice: { wave: 'sawtooth', formant: 0.9 } },
  { id: 'kuchar', name: 'Kuchár Mňam', body: '#b9bcc6', belly: '#eceef2', pattern: 'tabby', pc: '#8a8e9b', eye: '#58b368', acc: 'chef', accColor: '#ffffff', voice: { wave: 'triangle', formant: 1.0 } },
  { id: 'mrrlin', name: 'Mrrlin', body: '#8b74d9', belly: '#c9bdf2', pattern: 'solid', eye: '#ffd34d', acc: 'wizard', accColor: '#3f4fc4', voice: { wave: 'square', formant: 1.1 } },
  { id: 'ruzka', name: 'Princezná Ružka', body: '#f8b3cb', belly: '#ffe3ee', pattern: 'solid', eye: '#7b5bd6', acc: 'crown', accColor: '#ffd34d', voice: { wave: 'triangle', formant: 1.25 } },
  { id: 'rocker', name: 'Rocker', body: '#2a2730', belly: '#4a4552', pattern: 'socks', eye: '#ff6b6b', acc: 'headphones', accColor: '#ff4f7b', voice: { wave: 'square', formant: 0.95 } },
  { id: 'profesor', name: 'Profesor Fúzik', body: '#9c6b48', belly: '#e9d3bd', pattern: 'tabby', pc: '#6e4a30', eye: '#6aa84f', acc: 'glasses', accColor: '#3b2b3a', voice: { wave: 'sawtooth', formant: 0.85 } },
  { id: 'basnik', name: 'Básnik', body: '#d9cfc1', belly: '#f4efe8', pattern: 'bicolor', pc: '#6f6a75', eye: '#5aa6e8', acc: 'beret', accColor: '#d6455d', voice: { wave: 'triangle', formant: 0.95 } },
  { id: 'anjelik', name: 'Anjelik', body: '#fffaf2', belly: '#ffffff', pattern: 'solid', eye: '#7fb4ff', acc: 'halo', accColor: '#ffd34d', voice: { wave: 'triangle', formant: 1.3 } },
  { id: 'duhovec', name: 'Dúhovec', body: '#fff7fb', pattern: 'rainbow', eye: '#7b5bd6', voice: { wave: 'sawtooth', formant: 1.15 } },
  { id: 'kozmo', name: 'Kozmo', body: '#2d2560', belly: '#3d3478', pattern: 'galaxy', eye: '#7ff0ff', acc: 'antenna', accColor: '#7ff0ff', voice: { wave: 'square', formant: 1.2 } },
  { id: 'matovka', name: 'Mätovka', body: '#9fe3c8', belly: '#e3fbf1', pattern: 'spots', pc: '#6cc7a4', eye: '#3e8f6b', acc: 'leaf', accColor: '#6fcf6f', voice: { wave: 'triangle', formant: 1.1 } },
  { id: 'cokoladka', name: 'Čokoládka', body: '#7b4a2e', belly: '#b98563', pattern: 'solid', eye: '#ffcf5a', acc: 'scarf', accColor: '#ff8a3d', voice: { wave: 'sawtooth', formant: 0.9 } },
  { id: 'medovka', name: 'Medovka', body: '#f2c14e', belly: '#fff1c7', pattern: 'tabby', pc: '#d39a24', eye: '#6aa84f', acc: 'bow', accColor: '#5aa6e8', voice: { wave: 'triangle', formant: 1.15 } },
  { id: 'levandula', name: 'Levanduľa', body: '#c7b4f0', belly: '#efe8ff', pattern: 'solid', eye: '#6a4fc4', acc: 'flower', accColor: '#ffffff', voice: { wave: 'triangle', formant: 1.2 } },
  { id: 'sportovec', name: 'Športovec', body: '#f4f4f6', belly: '#ffffff', pattern: 'bicolor', pc: '#444150', eye: '#58b368', acc: 'cap', accColor: '#2f86c9', voice: { wave: 'sawtooth', formant: 1.0 } },
  { id: 'hviezdicka', name: 'Hviezdička', body: '#2e3a6e', belly: '#4a5899', pattern: 'spots', pc: '#ffd84d', eye: '#ffd84d', acc: 'star', accColor: '#ffd84d', voice: { wave: 'square', formant: 1.05 } },
  { id: 'srdiecko', name: 'Srdiečko', body: '#ff9a8a', belly: '#ffe1db', pattern: 'solid', eye: '#c2185b', acc: 'heart', accColor: '#e0475b', voice: { wave: 'triangle', formant: 1.2 } },
  { id: 'tigrik', name: 'Tigrík', body: '#f59a3a', belly: '#fff3e3', pattern: 'tiger', pc: '#3a2a2a', eye: '#9ad35b', voice: { wave: 'sawtooth', formant: 0.95 } },
  { id: 'dalmatin', name: 'Dalmatín', body: '#ffffff', belly: '#ffffff', pattern: 'spots', pc: '#2b2730', eye: '#3b2b3a', acc: 'sunglasses', accColor: '#1d1d2b', voice: { wave: 'square', formant: 1.0 } },
  { id: 'mracik', name: 'Mráčik', body: '#bfe3ff', belly: '#eef8ff', pattern: 'solid', eye: '#3f7fd6', acc: 'bell', accColor: '#5aa6e8', voice: { wave: 'triangle', formant: 1.25 } },
  { id: 'uhlik', name: 'Uhlík', body: '#1f1c24', belly: '#2f2b35', pattern: 'solid', eye: '#b6f05a', acc: 'crown', accColor: '#c9ccd6', voice: { wave: 'square', formant: 0.85 } },
];
CATS.forEach((c, i) => { c.seed = i * 1.7; });

const OUT = '#3b2b3a';
const ORANGE = '#f39a3d';
const DARK = '#3a3236';
const RAINBOW = ['#ff8a8a', '#ffc36b', '#fff176', '#8be08b', '#7cc6ff', '#b49bff'];
const GALAXY_STARS = [[-22, -40], [14, -48], [26, -22], [-6, -14], [-28, -20], [4, -34], [-16, -78], [12, -84], [22, -62], [-24, -60], [0, -72]];

// ---------- Pomocné kreslenie ----------
function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function circ(g, x, y, r) { ell(g, x, y, r, r); }
function fillStroke(g, fill) { g.fillStyle = fill; g.fill(); g.stroke(); }

function starPath(g, x, y, r, ri, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? ri : r;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x + s * 1.1, y - s * 0.35, x + s * 0.55, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x - s * 0.55, y - s * 1.05, x - s * 1.1, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

function rrPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------- Mačka ----------
function earColor(cat, s) {
  switch (cat.pattern) {
    case 'siamese': case 'bicolor': return cat.pc;
    case 'calico': return s < 0 ? ORANGE : DARK;
    case 'rainbow': return s < 0 ? RAINBOW[0] : RAINBOW[4];
    default: return cat.body;
  }
}

function bodyPattern(g, cat) {
  switch (cat.pattern) {
    case 'tabby':
    case 'tiger': {
      g.strokeStyle = cat.pc;
      g.lineWidth = cat.pattern === 'tiger' ? 6 : 4.5;
      for (let i = 0; i < 3; i++) {
        const yy = -48 + i * 12;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * 40, yy);
          g.quadraticCurveTo(s * 30, yy + 2, s * 23, yy - 3);
          g.stroke();
        }
      }
      break;
    }
    case 'tuxedo':
      ell(g, 0, -26, 17, 30);
      g.fillStyle = '#fbfbfd';
      g.fill();
      return;
    case 'calico':
      g.fillStyle = ORANGE; circ(g, -24, -42, 15); g.fill(); circ(g, 8, -56, 9); g.fill();
      g.fillStyle = DARK; circ(g, 24, -20, 13); g.fill();
      break;
    case 'spots':
      g.fillStyle = cat.pc;
      for (const [x, y, r] of [[-20, -38, 6], [16, -46, 5], [25, -24, 7], [-27, -18, 4.5], [6, -52, 3.5]]) {
        circ(g, x, y, r); g.fill();
      }
      break;
    case 'bicolor':
      g.fillStyle = cat.pc;
      ell(g, -30, -46, 22, 20); g.fill();
      ell(g, 30, -14, 14, 12); g.fill();
      break;
    case 'rainbow':
      RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(-40, -62 + i * 10.5, 80, 11); });
      return;
    case 'galaxy': {
      const grd = g.createRadialGradient(-12, -36, 2, -12, -36, 30);
      grd.addColorStop(0, 'rgba(255,110,200,0.55)');
      grd.addColorStop(1, 'rgba(255,110,200,0)');
      g.fillStyle = grd;
      g.fillRect(-40, -62, 80, 64);
      g.fillStyle = '#ffffff';
      for (const [x, y] of GALAXY_STARS) if (y > -60) { circ(g, x, y, 1.3); g.fill(); }
      break;
    }
  }
  if (cat.belly) {
    ell(g, 0, -22, 20, 16);
    g.fillStyle = cat.belly;
    g.fill();
  }
}

function headPattern(g, cat) {
  switch (cat.pattern) {
    case 'tabby':
    case 'tiger':
      g.strokeStyle = cat.pc;
      g.lineWidth = cat.pattern === 'tiger' ? 4.5 : 3.5;
      g.beginPath();
      g.moveTo(-7, -89); g.lineTo(-5, -79);
      g.moveTo(0, -91); g.lineTo(0, -80);
      g.moveTo(7, -89); g.lineTo(5, -79);
      for (const s of [-1, 1]) {
        g.moveTo(s * 32, -67); g.lineTo(s * 24, -65);
        g.moveTo(s * 32, -59); g.lineTo(s * 25, -58);
      }
      g.stroke();
      break;
    case 'tuxedo':
      g.fillStyle = '#fbfbfd';
      ell(g, 0, -51, 15, 11); g.fill();
      g.beginPath(); g.moveTo(-5, -58); g.lineTo(5, -58); g.lineTo(0, -80); g.closePath(); g.fill();
      return;
    case 'calico':
      g.fillStyle = ORANGE; circ(g, -22, -80, 16); g.fill();
      g.fillStyle = DARK; circ(g, 22, -70, 11); g.fill();
      break;
    case 'spots':
      g.fillStyle = cat.pc;
      for (const [x, y, r] of [[-17, -78, 5], [14, -83, 4], [23, -62, 3.5]]) { circ(g, x, y, r); g.fill(); }
      break;
    case 'siamese':
      g.globalAlpha = 0.88;
      g.fillStyle = cat.pc;
      ell(g, 0, -54, 18, 15); g.fill();
      g.globalAlpha = 1;
      return;
    case 'bicolor':
      g.fillStyle = cat.pc;
      ell(g, 0, -92, 34, 20); g.fill();
      break;
    case 'galaxy':
      g.fillStyle = '#ffffff';
      for (const [x, y] of GALAXY_STARS) if (y < -60) { circ(g, x, y, 1.3); g.fill(); }
      break;
  }
  if (cat.belly) { // svetlejší ňufáčik
    g.fillStyle = cat.belly;
    ell(g, 0, -51, 13, 9); g.fill();
  }
}

function drawFace(g, cat, st) {
  const m = st.mouth || 0;
  const singing = m > 0.3;

  g.fillStyle = 'rgba(255,120,150,0.35)';
  ell(g, -20, -54, 5.5, 3.5); g.fill();
  ell(g, 20, -54, 5.5, 3.5); g.fill();

  g.strokeStyle = OUT;
  g.lineWidth = 2.6;
  const lk = (st.look || 0) * 2.2;
  for (const s of [-1, 1]) {
    const ex = s * 11.5, ey = -64;
    if (st.sad) {
      g.beginPath();
      g.moveTo(ex + s * 4, ey - 4);
      g.lineTo(ex - s * 3, ey);
      g.lineTo(ex + s * 4, ey + 4);
      g.stroke();
    } else if (singing || st.blink) {
      g.beginPath();
      g.arc(ex, ey + 2, 5, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    } else {
      ell(g, ex, ey, 6, 7.5);
      fillStroke(g, cat.eye);
      g.fillStyle = '#1d1420';
      ell(g, ex + lk, ey + 0.5, 3.4, 5.6); g.fill();
      g.fillStyle = '#ffffff';
      circ(g, ex + lk - 1.8, ey - 3, 2); g.fill();
      circ(g, ex + lk + 1.6, ey + 2.2, 0.9); g.fill();
    }
  }

  // nos
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-3.2, -56.5); g.lineTo(3.2, -56.5); g.lineTo(0, -52.8);
  g.closePath();
  fillStroke(g, '#f28aa0');

  // pusa
  g.lineWidth = 2;
  if (m > 0.05) {
    const rx = 3.5 + m * 2.5, ry = 2 + m * 5.5, cy = -51.5 + ry;
    ell(g, 0, cy, rx, ry);
    fillStroke(g, '#7a2438');
    g.save();
    ell(g, 0, cy, rx, ry); g.clip();
    g.fillStyle = '#ff7d9a';
    ell(g, 0, cy + ry * 0.75, rx * 0.8, ry * 0.5); g.fill();
    g.restore();
  } else {
    g.beginPath();
    g.moveTo(0, -52.8); g.quadraticCurveTo(-0.8, -48.5, -5.5, -49.5);
    g.moveTo(0, -52.8); g.quadraticCurveTo(0.8, -48.5, 5.5, -49.5);
    g.stroke();
  }

  // fúzy
  g.strokeStyle = 'rgba(59,43,58,0.55)';
  g.lineWidth = 1.3;
  g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(s * 15, -54); g.lineTo(s * 34, -57);
    g.moveTo(s * 15, -51.5); g.lineTo(s * 34, -49.5);
  }
  g.stroke();
  g.strokeStyle = OUT;
}

function drawHeadAcc(g, cat, t) {
  const col = cat.accColor || '#e0475b';
  g.lineWidth = 2.5;
  g.strokeStyle = OUT;
  switch (cat.acc) {
    case 'bow':
      g.beginPath(); g.moveTo(19, -89); g.lineTo(7, -98); g.lineTo(7, -81); g.closePath(); fillStroke(g, col);
      g.beginPath(); g.moveTo(19, -89); g.lineTo(31, -98); g.lineTo(31, -81); g.closePath(); fillStroke(g, col);
      circ(g, 19, -89, 4); fillStroke(g, col);
      break;
    case 'tophat':
      g.beginPath(); g.rect(-14, -122, 28, 32); fillStroke(g, col);
      g.beginPath(); g.rect(-14, -99, 28, 6); fillStroke(g, '#e0475b');
      ell(g, 0, -90, 23, 4.5); fillStroke(g, col);
      break;
    case 'crown':
      g.beginPath();
      g.moveTo(-15, -87); g.lineTo(-16, -104); g.lineTo(-8, -96); g.lineTo(0, -111);
      g.lineTo(8, -96); g.lineTo(16, -104); g.lineTo(15, -87);
      g.closePath(); fillStroke(g, col);
      g.fillStyle = '#e0475b'; circ(g, 0, -95, 2.6); g.fill();
      g.fillStyle = '#5aa6e8'; circ(g, -9, -92, 2); g.fill(); circ(g, 9, -92, 2); g.fill();
      break;
    case 'glasses':
      g.strokeStyle = col;
      g.fillStyle = 'rgba(255,255,255,0.25)';
      circ(g, -11.5, -64, 9); g.fill(); g.stroke();
      circ(g, 11.5, -64, 9); g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(-2.5, -65); g.lineTo(2.5, -65);
      g.moveTo(-20.5, -65); g.lineTo(-29, -68);
      g.moveTo(20.5, -65); g.lineTo(29, -68);
      g.stroke();
      break;
    case 'sunglasses':
      ell(g, -11.5, -64, 10, 7.5); fillStroke(g, col);
      ell(g, 11.5, -64, 10, 7.5); fillStroke(g, col);
      g.beginPath(); g.moveTo(-2, -66); g.lineTo(2, -66); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-16, -67); g.lineTo(-12, -69); g.moveTo(7, -67); g.lineTo(11, -69); g.stroke();
      break;
    case 'headphones':
      g.strokeStyle = OUT; g.lineWidth = 8;
      g.beginPath(); g.arc(0, -64, 33, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.strokeStyle = col; g.lineWidth = 4.5; g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 2.5;
      rrPath(g, -38, -75, 10, 20, 4); fillStroke(g, col);
      rrPath(g, 28, -75, 10, 20, 4); fillStroke(g, col);
      break;
    case 'flower':
      g.fillStyle = col; g.lineWidth = 1.8;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.5;
        circ(g, -19 + Math.cos(a) * 5, -90 + Math.sin(a) * 5, 4.3); g.fill(); g.stroke();
      }
      circ(g, -19, -90, 3.4); fillStroke(g, '#ffd84d');
      break;
    case 'beret':
      ell(g, -3, -89, 24, 8, -0.15); fillStroke(g, col);
      circ(g, -4, -98, 2.6); fillStroke(g, col);
      break;
    case 'chef':
      circ(g, -10, -106, 9); fillStroke(g, col);
      circ(g, 10, -106, 9); fillStroke(g, col);
      circ(g, 0, -113, 10); fillStroke(g, col);
      g.beginPath(); g.rect(-15, -100, 30, 11); fillStroke(g, col);
      break;
    case 'wizard':
      g.beginPath(); g.moveTo(-19, -88); g.lineTo(19, -88); g.lineTo(6, -133); g.closePath(); fillStroke(g, col);
      ell(g, 0, -88, 25, 5); fillStroke(g, col);
      g.fillStyle = '#ffd84d';
      starPath(g, -1, -104, 4.5, 2); g.fill();
      starPath(g, 7, -118, 3, 1.4); g.fill();
      break;
    case 'pirate':
      g.beginPath();
      g.moveTo(-29, -74); g.quadraticCurveTo(0, -106, 29, -74); g.quadraticCurveTo(0, -86, -29, -74);
      g.closePath(); fillStroke(g, col);
      g.fillStyle = '#ffffff';
      circ(g, -8, -88, 1.8); g.fill(); circ(g, 6, -91, 1.8); g.fill(); circ(g, 17, -84, 1.6); g.fill();
      g.beginPath(); g.moveTo(28, -75); g.lineTo(38, -82); g.lineTo(36, -70); g.closePath(); fillStroke(g, col);
      g.beginPath(); g.moveTo(3, -70); g.lineTo(-28, -60); g.stroke();
      ell(g, 11.5, -64, 7.5, 7); fillStroke(g, '#1d1d2b');
      break;
    case 'halo':
      g.save();
      g.shadowColor = col; g.shadowBlur = 10;
      g.strokeStyle = col; g.lineWidth = 3.5;
      ell(g, 0, -110 + Math.sin(t * 2) * 1.5, 17, 4.5); g.stroke();
      g.restore();
      break;
    case 'cap':
      g.beginPath(); g.ellipse(0, -84, 25, 13, 0, Math.PI, 0); g.closePath(); fillStroke(g, col);
      ell(g, 16, -84, 17, 4, 0.08); fillStroke(g, col);
      circ(g, 0, -97, 2.2); fillStroke(g, col);
      break;
    case 'leaf':
      g.beginPath(); g.moveTo(0, -89); g.quadraticCurveTo(-1, -96, 2, -101); g.stroke();
      ell(g, 9, -103, 8, 4, -0.5); fillStroke(g, col);
      break;
    case 'antenna':
      g.beginPath(); g.moveTo(-8, -89); g.lineTo(-12, -109); g.moveTo(8, -89); g.lineTo(12, -109); g.stroke();
      g.save();
      g.shadowColor = col; g.shadowBlur = 8 + Math.sin(t * 4) * 4;
      circ(g, -12, -111, 4.2); fillStroke(g, col);
      circ(g, 12, -111, 4.2); fillStroke(g, col);
      g.restore();
      break;
    case 'star':
      starPath(g, 20, -91, 8, 3.6, 5, -Math.PI / 2 + Math.sin(t * 2) * 0.2); fillStroke(g, col);
      break;
    case 'heart':
      heartPath(g, 20, -88, 8); fillStroke(g, col);
      break;
  }
}

function drawNeckAcc(g, cat) {
  const col = cat.accColor || '#e0475b';
  g.strokeStyle = OUT;
  g.lineWidth = 2.5;
  if (cat.acc === 'scarf') {
    g.beginPath();
    g.moveTo(-24, -38); g.quadraticCurveTo(0, -28, 24, -38);
    g.lineTo(24, -31); g.quadraticCurveTo(0, -21, -24, -31);
    g.closePath(); fillStroke(g, col);
    g.beginPath(); g.moveTo(9, -30); g.lineTo(17, -31); g.lineTo(20, -13); g.lineTo(12, -13); g.closePath(); fillStroke(g, col);
  } else if (cat.acc === 'bell') {
    g.beginPath();
    g.moveTo(-22, -37); g.quadraticCurveTo(0, -29, 22, -37);
    g.lineTo(22, -33); g.quadraticCurveTo(0, -25, -22, -33);
    g.closePath(); fillStroke(g, col);
    circ(g, 0, -26, 5); fillStroke(g, '#ffd34d');
    g.beginPath(); g.moveTo(0, -25); g.lineTo(0, -22); g.stroke();
  }
}

/**
 * Nakreslí mačku. (x, y) = stred spodku mačky, size = výška mačky v px.
 * st: { t, mouth 0..1, blink, sad, squash 0..1, look -1..1, tilt }
 */
function drawCat(g, cat, x, y, size, st = {}) {
  const t = st.t || 0;
  const sq = st.squash || 0;
  const k = size / 105;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (st.tilt) g.rotate(st.tilt);
  g.scale(1 + sq * 0.08, 1 - sq * 0.08);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const isSiam = cat.pattern === 'siamese';

  // chvost
  const wag = Math.sin(t * 3.1 + cat.seed) * 7;
  g.beginPath();
  g.moveTo(24, -14);
  g.bezierCurveTo(50, -12, 58, -34, 48 + wag, -58);
  g.strokeStyle = OUT; g.lineWidth = 14; g.stroke();
  g.strokeStyle = isSiam ? cat.pc : cat.pattern === 'rainbow' ? RAINBOW[5] : cat.body;
  g.lineWidth = 8.5; g.stroke();

  // telo
  g.lineWidth = 3;
  g.strokeStyle = OUT;
  ell(g, 0, -30, 37, 30);
  g.fillStyle = cat.body; g.fill();
  g.save(); ell(g, 0, -30, 37, 30); g.clip(); bodyPattern(g, cat); g.restore();
  ell(g, 0, -30, 37, 30); g.stroke();

  // labky
  const paw = cat.pattern === 'socks' || cat.pattern === 'tuxedo' ? '#fbfbfd' : isSiam ? cat.pc : cat.body;
  g.lineWidth = 2.5;
  ell(g, -14, -4, 10, 6.5); fillStroke(g, paw);
  ell(g, 14, -4, 10, 6.5); fillStroke(g, paw);

  // hlava
  g.save();
  g.translate(0, Math.sin(t * 2.4 + cat.seed) * 1.2 - sq * 2);
  g.lineWidth = 3;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 28, -72); g.lineTo(s * 24, -101); g.lineTo(s * 5, -88);
    g.closePath();
    fillStroke(g, earColor(cat, s));
    g.beginPath();
    g.moveTo(s * 23.5, -78); g.lineTo(s * 22.5, -95); g.lineTo(s * 11, -87);
    g.closePath();
    g.fillStyle = 'rgba(255,140,170,0.75)'; g.fill();
  }
  ell(g, 0, -62, 31, 28);
  g.fillStyle = cat.body; g.fill();
  g.save(); ell(g, 0, -62, 31, 28); g.clip(); headPattern(g, cat); g.restore();
  g.strokeStyle = OUT; g.lineWidth = 3;
  ell(g, 0, -62, 31, 28); g.stroke();
  drawFace(g, cat, st);
  drawHeadAcc(g, cat, t);
  g.restore();

  drawNeckAcc(g, cat);
  g.restore();
}

// ---------- Pochúťky ----------
function drawSnack(g, kind, x, y, r, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.lineWidth = Math.max(1.5, r * 0.11);
  g.strokeStyle = OUT;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  switch (kind) {
    case 'fish':
      g.beginPath(); g.moveTo(r * 0.55, 0); g.lineTo(r * 1.1, -r * 0.5); g.lineTo(r * 1.1, r * 0.5); g.closePath(); fillStroke(g, '#5fb4f0');
      ell(g, -r * 0.12, 0, r * 0.8, r * 0.52); fillStroke(g, '#7cc8ff');
      g.fillStyle = OUT; circ(g, -r * 0.5, -r * 0.1, r * 0.1); g.fill();
      g.beginPath(); g.moveTo(-r * 0.1, -r * 0.3); g.quadraticCurveTo(r * 0.05, 0, -r * 0.1, r * 0.3); g.stroke();
      break;
    case 'cookie':
      circ(g, 0, 0, r * 0.9); fillStroke(g, '#e2a65b');
      g.fillStyle = '#5b3a29';
      for (const [cx, cy] of [[-0.35, -0.3], [0.3, -0.35], [0.05, 0.1], [-0.4, 0.35], [0.4, 0.3]]) { circ(g, cx * r, cy * r, r * 0.12); g.fill(); }
      break;
    case 'donut':
      circ(g, 0, 0, r * 0.92); fillStroke(g, '#d99a5b');
      g.fillStyle = '#ff8fb8'; circ(g, 0, 0, r * 0.74); g.fill();
      circ(g, 0, 0, r * 0.28); fillStroke(g, '#b8743c');
      g.lineWidth = Math.max(1.2, r * 0.09);
      ['#fff176', '#7cc6ff', '#8be08b', '#ffffff'].forEach((c, i) => {
        const a = i * 1.7 + 0.4;
        g.strokeStyle = c;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        g.lineTo(Math.cos(a) * r * 0.5 + r * 0.12, Math.sin(a) * r * 0.5 + r * 0.08);
        g.stroke();
      });
      break;
    case 'cupcake':
      g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(r * 0.6, 0); g.lineTo(r * 0.45, r * 0.85); g.lineTo(-r * 0.45, r * 0.85); g.closePath(); fillStroke(g, '#7cc6ff');
      circ(g, -r * 0.35, -r * 0.05, r * 0.4); fillStroke(g, '#fff0f6');
      circ(g, r * 0.35, -r * 0.05, r * 0.4); fillStroke(g, '#fff0f6');
      circ(g, 0, -r * 0.35, r * 0.45); fillStroke(g, '#fff0f6');
      circ(g, 0, -r * 0.85, r * 0.17); fillStroke(g, '#e0475b');
      break;
    case 'sushi':
      rrPath(g, -r * 0.85, -r * 0.15, r * 1.7, r * 0.7, r * 0.25); fillStroke(g, '#fffaf0');
      rrPath(g, -r * 0.92, -r * 0.55, r * 1.84, r * 0.5, r * 0.25); fillStroke(g, '#ff9466');
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.moveTo(-r * 0.4, -r * 0.5); g.lineTo(-r * 0.55, -r * 0.12); g.moveTo(r * 0.15, -r * 0.5); g.lineTo(0, -r * 0.12); g.moveTo(r * 0.6, -r * 0.5); g.lineTo(r * 0.45, -r * 0.12); g.stroke();
      break;
    case 'candy':
      g.beginPath(); g.moveTo(-r * 0.45, 0); g.lineTo(-r * 1.05, -r * 0.45); g.lineTo(-r * 1.05, r * 0.45); g.closePath(); fillStroke(g, '#ffd84d');
      g.beginPath(); g.moveTo(r * 0.45, 0); g.lineTo(r * 1.05, -r * 0.45); g.lineTo(r * 1.05, r * 0.45); g.closePath(); fillStroke(g, '#ffd84d');
      circ(g, 0, 0, r * 0.58); fillStroke(g, '#ff6b8a');
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.2, r * 0.1);
      g.beginPath(); g.arc(0, 0, r * 0.3, 0.3, 2.8); g.stroke();
      break;
    case 'yarn':
      circ(g, 0, 0, r * 0.85); fillStroke(g, '#b79cff');
      g.save(); circ(g, 0, 0, r * 0.85); g.clip();
      g.strokeStyle = 'rgba(90,60,170,0.6)'; g.lineWidth = Math.max(1, r * 0.08);
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * r * 0.3, 0, r * 0.25, r, 0.5, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      g.strokeStyle = OUT;
      g.beginPath(); g.moveTo(r * 0.6, r * 0.6); g.quadraticCurveTo(r * 1.1, r * 0.7, r * 1.0, r * 1.1); g.stroke();
      break;
    case 'strawberry':
      g.beginPath(); g.moveTo(0, r * 0.95); g.bezierCurveTo(-r * 1.1, r * 0.2, -r * 0.8, -r * 0.6, 0, -r * 0.5); g.bezierCurveTo(r * 0.8, -r * 0.6, r * 1.1, r * 0.2, 0, r * 0.95); g.closePath(); fillStroke(g, '#ff4f6a');
      g.fillStyle = '#fff3a8';
      for (const [sx, sy] of [[-0.35, -0.1], [0.3, -0.15], [0, 0.2], [-0.25, 0.45], [0.25, 0.45]]) { ell(g, sx * r, sy * r, r * 0.06, r * 0.1); g.fill(); }
      g.beginPath(); g.moveTo(-r * 0.5, -r * 0.55); g.lineTo(0, -r * 0.35); g.lineTo(r * 0.5, -r * 0.55); g.lineTo(r * 0.1, -r * 0.75); g.lineTo(0, -r * 0.95); g.lineTo(-r * 0.1, -r * 0.75); g.closePath(); fillStroke(g, '#6fcf6f');
      break;
    case 'star':
    default:
      starPath(g, 0, 0, r, r * 0.45); fillStroke(g, '#ffd84d');
      break;
  }
  g.restore();
}
