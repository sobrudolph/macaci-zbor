'use strict';
/*
 * Obchod: jedlo a oblečenie pre mačky. Všetko sa kreslí kódom.
 *
 * Oblečenie sa kreslí v súradniciach mačky (pozri drawCat v cats.js):
 *   spodok mačky y = 0, telo = elipsa (0,-30) 37×30, hlava = elipsa (0,-62) 31×28, oči y = -64.
 * Každá vec má kresliace funkcie pre "vrstvy":
 *   bedBack  – pelech za mačkou        bedFront – predná časť pelechu
 *   back     – za telom (plášť, krídla) clip     – na tele (orezané podľa tela)
 *   over     – cez okraj tela (sukňa)   front    – krk, vodítko (po hlave)
 *   eyes     – okuliare                 head     – pokrývky hlavy
 *
 * Novú vec pridáš do ITEMS: { id, slot, name, price, colors, draw: { vrstva(g, c, t) } }.
 */

// ---------- Farby ----------
const COLORS = {
  red: ['Červená', '#e8434f'],
  pink: ['Ružová', '#ff7eb6'],
  orange: ['Oranžová', '#ff9a3c'],
  yellow: ['Žltá', '#ffd34d'],
  green: ['Zelená', '#5cc16a'],
  mint: ['Mätová', '#7fe0c4'],
  sky: ['Nebeská', '#8fd0ff'],
  blue: ['Modrá', '#4f7fe0'],
  purple: ['Fialová', '#9b6be0'],
  brown: ['Hnedá', '#9c6b48'],
  black: ['Čierna', '#2f2b35'],
  white: ['Biela', '#fbfbfd'],
  gold: ['Zlatá', '#f2c230'],
  silver: ['Strieborná', '#c9ccd6'],
  rainbow: ['Dúhová', '#ff8a8a'],
};
const BASIC = ['red', 'pink', 'orange', 'yellow', 'green', 'mint', 'sky', 'blue', 'purple', 'brown', 'black', 'white'];
const COLOR_MULT = { gold: 1.6, silver: 1.4, rainbow: 2 };

const hexOf = c => (COLORS[c] || COLORS.red)[1];

function mixHex(hex, to, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = s => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const lighter = (c, f = 0.35) => mixHex(hexOf(c), '#ffffff', f);
const darker = (c, f = 0.25) => mixHex(hexOf(c), '#000000', f);

function isDark(c) {
  const v = parseInt(hexOf(c).slice(1), 16);
  return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 < 110;
}
/** Kontrastná farba na detaily (pásiky, nápisy). */
const contrast = c => (isDark(c) ? '#ffffff' : c === 'white' || c === 'yellow' || c === 'silver' ? '#e0475b' : '#ffffff');

/** Výplň: obyčajná farba, alebo lesklé zlato/striebro, alebo dúha. */
function paint(g, c) {
  if (c === 'rainbow') {
    const grd = g.createLinearGradient(-45, 0, 45, 0);
    RAINBOW.forEach((col, i) => grd.addColorStop(i / (RAINBOW.length - 1), col));
    return grd;
  }
  if (c === 'gold' || c === 'silver') {
    const [a, b, d] = c === 'gold' ? ['#fff3b0', '#f2c230', '#c8961a'] : ['#ffffff', '#c9ccd6', '#8e93a3'];
    const grd = g.createLinearGradient(-30, -130, 30, 10);
    grd.addColorStop(0, a); grd.addColorStop(0.45, b); grd.addColorStop(0.55, a); grd.addColorStop(1, d);
    return grd;
  }
  return hexOf(c);
}
function fs(g, c) { g.fillStyle = paint(g, c); g.fill(); g.stroke(); }
function sparkle(g, x, y, r) {
  g.save(); g.fillStyle = '#ffffff'; starPath(g, x, y, r, r * 0.35, 4, 0); g.fill(); g.restore();
}

// Spoločné tvary
function collarBand(g, c) {
  g.beginPath();
  g.moveTo(-22, -37); g.quadraticCurveTo(0, -29, 22, -37);
  g.lineTo(22, -32); g.quadraticCurveTo(0, -24, -22, -32);
  g.closePath(); fs(g, c);
}
function shirtBase(g, c) {
  g.fillStyle = paint(g, c);
  g.fillRect(-40, -64, 80, 50);
  g.beginPath(); g.moveTo(-40, -14); g.lineTo(40, -14); g.stroke();
}
function leashLine(g, c, glitter) {
  g.beginPath();
  g.moveTo(0, -27);
  g.bezierCurveTo(-8, -4, -38, -16, -54, -3);
  g.strokeStyle = OUT; g.lineWidth = 6; g.stroke();
  g.strokeStyle = paint(g, c); g.lineWidth = 3.4; g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 2.2;
  ell(g, -59, -2, 7, 4.2); g.stroke();
  g.strokeStyle = hexOf(c); g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 2;
  circ(g, 0, -27, 2.6); fs(g, 'gold');
  if (glitter) for (const [x, y] of [[-6, -15], [-20, -11], [-34, -10], [-46, -6]]) sparkle(g, x, y, 3.2);
}

// ---------- Oblečenie a doplnky ----------
const SLOTS = [
  { id: 'head', name: 'Hlava', icon: '🎩' },
  { id: 'eyes', name: 'Okuliare', icon: '👓' },
  { id: 'neck', name: 'Krk', icon: '🎀' },
  { id: 'body', name: 'Oblečenie', icon: '👕' },
  { id: 'back', name: 'Chrbát', icon: '🎒' },
  { id: 'leash', name: 'Vodítka', icon: '🦮' },
  { id: 'bed', name: 'Pelechy', icon: '🛏️' },
];

const ITEMS = [
  // ----- Hlava -----
  { id: 'cap', slot: 'head', name: 'Šiltovka', price: 2400, colors: BASIC, draw: { head(g, c) {
    g.beginPath(); g.ellipse(0, -84, 25, 13, 0, Math.PI, 0); g.closePath(); fs(g, c);
    ell(g, 16, -84, 17, 4, 0.08); fs(g, c);
    circ(g, 0, -97, 2.2); fs(g, c);
  } } },
  { id: 'bow', slot: 'head', name: 'Mašľa', price: 1800, colors: [...BASIC, 'gold', 'rainbow'], draw: { head(g, c) {
    g.beginPath(); g.moveTo(19, -89); g.lineTo(7, -98); g.lineTo(7, -81); g.closePath(); fs(g, c);
    g.beginPath(); g.moveTo(19, -89); g.lineTo(31, -98); g.lineTo(31, -81); g.closePath(); fs(g, c);
    circ(g, 19, -89, 4); fs(g, c);
  } } },
  { id: 'beanie', slot: 'head', name: 'Čiapka s brmbolcom', price: 3000, colors: BASIC, draw: { head(g, c) {
    g.beginPath(); g.moveTo(-30, -82); g.bezierCurveTo(-30, -114, 30, -114, 30, -82); g.closePath(); fs(g, c);
    g.save(); g.strokeStyle = lighter(c, 0.3); g.lineWidth = 2;
    for (const x of [-16, -6, 4, 14]) { g.beginPath(); g.moveTo(x, -88); g.quadraticCurveTo(x + 1, -98, x - 1, -104); g.stroke(); }
    g.restore();
    rrPath(g, -32, -88, 64, 10, 5); fs(g, c);
    g.save(); g.strokeStyle = darker(c, 0.2); g.lineWidth = 1.6;
    for (let x = -26; x <= 26; x += 6) { g.beginPath(); g.moveTo(x, -86); g.lineTo(x, -80); g.stroke(); }
    g.restore();
    circ(g, 0, -110, 7.5); fs(g, c === 'white' ? 'red' : 'white');
  } } },
  { id: 'party', slot: 'head', name: 'Párty klobúčik', price: 2100, colors: BASIC, draw: { head(g, c) {
    g.beginPath(); g.moveTo(-12, -86); g.lineTo(12, -86); g.lineTo(4, -126); g.closePath();
    g.fillStyle = paint(g, c); g.fill();
    g.save(); g.clip(); g.strokeStyle = contrast(c); g.lineWidth = 3.5;
    for (let y = -122; y < -84; y += 9) { g.beginPath(); g.moveTo(-14, y + 6); g.lineTo(14, y - 3); g.stroke(); }
    g.restore(); g.stroke();
    circ(g, 4, -127, 4.5); fs(g, c === 'yellow' ? 'pink' : 'yellow');
  } } },
  { id: 'beret', slot: 'head', name: 'Baretka', price: 2700, colors: BASIC, draw: { head(g, c) {
    ell(g, -3, -89, 24, 8, -0.15); fs(g, c);
    circ(g, -4, -98, 2.6); fs(g, c);
  } } },
  { id: 'wreath', slot: 'head', name: 'Kvetinový venček', price: 3600, colors: ['pink', 'red', 'yellow', 'white', 'purple', 'sky', 'orange', 'rainbow'], draw: { head(g, c, t) {
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.1 + i * 0.133);
      pts.push([Math.cos(a) * 30, -64 + Math.sin(a) * 26]);
    }
    g.fillStyle = '#6fcf6f'; g.lineWidth = 1.5;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      ell(g, (x1 + x2) / 2, (y1 + y2) / 2 - 2, 5, 2.5, Math.atan2(y2 - y1, x2 - x1)); g.fill(); g.stroke();
    }
    pts.forEach(([x, y], i) => {
      const col = c === 'rainbow' ? RAINBOW[i % RAINBOW.length] : hexOf(c);
      g.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + t * 0.3 + i;
        circ(g, x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 3); g.fill(); g.stroke();
      }
      circ(g, x, y, 2.4); g.fillStyle = '#ffd84d'; g.fill(); g.stroke();
    });
  } } },
  { id: 'bunny', slot: 'head', name: 'Zajačie uši', price: 3300, colors: ['white', 'pink', 'sky', 'yellow', 'purple', 'black', 'mint', 'rainbow'], draw: { head(g, c) {
    g.save(); g.lineWidth = 7; g.strokeStyle = OUT;
    g.beginPath(); g.arc(0, -62, 31, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    g.lineWidth = 4; g.strokeStyle = paint(g, c); g.stroke(); g.restore();
    for (const s of [-1, 1]) {
      ell(g, s * 11, -112, 7.5, 21, s * 0.2); fs(g, c);
      ell(g, s * 11, -110, 3.6, 14, s * 0.2); g.fillStyle = 'rgba(255,140,170,0.8)'; g.fill();
    }
  } } },
  { id: 'tophat', slot: 'head', name: 'Cylinder', price: 4200, colors: BASIC, draw: { head(g, c) {
    g.beginPath(); g.rect(-14, -122, 28, 32); fs(g, c);
    g.beginPath(); g.rect(-14, -99, 28, 6); g.fillStyle = contrast(c); g.fill(); g.stroke();
    ell(g, 0, -90, 23, 4.5); fs(g, c);
  } } },
  { id: 'cowboy', slot: 'head', name: 'Kovbojský klobúk', price: 4500, colors: ['brown', 'black', 'white', 'pink', 'red', 'sky', 'yellow', 'gold'], draw: { head(g, c) {
    g.beginPath();
    g.moveTo(-17, -90); g.bezierCurveTo(-19, -116, -6, -110, 0, -106); g.bezierCurveTo(6, -110, 19, -116, 17, -90);
    g.closePath(); fs(g, c);
    g.beginPath(); g.rect(-17, -97, 34, 6); g.fillStyle = darker(c, 0.35); g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(-42, -99); g.quadraticCurveTo(-32, -86, 0, -89); g.quadraticCurveTo(32, -86, 42, -99);
    g.quadraticCurveTo(36, -80, 0, -82); g.quadraticCurveTo(-36, -80, -42, -99);
    g.closePath(); fs(g, c);
  } } },
  { id: 'headphones', slot: 'head', name: 'Slúchadlá', price: 4800, colors: BASIC, draw: { head(g, c) {
    g.strokeStyle = OUT; g.lineWidth = 8;
    g.beginPath(); g.arc(0, -64, 33, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.strokeStyle = paint(g, c); g.lineWidth = 4.5; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2.5;
    rrPath(g, -38, -75, 10, 20, 4); fs(g, c);
    rrPath(g, 28, -75, 10, 20, 4); fs(g, c);
  } } },
  { id: 'wizard', slot: 'head', name: 'Čarodejnícky klobúk', price: 5400, colors: ['blue', 'purple', 'black', 'green', 'red', 'pink', 'sky'], draw: { head(g, c) {
    g.beginPath(); g.moveTo(-19, -88); g.lineTo(19, -88); g.lineTo(6, -133); g.closePath(); fs(g, c);
    ell(g, 0, -88, 25, 5); fs(g, c);
    g.fillStyle = '#ffd84d';
    starPath(g, -1, -104, 4.5, 2); g.fill();
    starPath(g, 7, -118, 3, 1.4); g.fill();
  } } },
  { id: 'halo', slot: 'head', name: 'Svätožiara', price: 6000, colors: ['gold', 'silver', 'pink', 'sky', 'white', 'rainbow'], draw: { head(g, c, t) {
    g.save();
    g.shadowColor = hexOf(c); g.shadowBlur = 10;
    g.strokeStyle = paint(g, c); g.lineWidth = 3.5;
    ell(g, 0, -110 + Math.sin(t * 2) * 1.5, 17, 4.5); g.stroke();
    g.restore();
  } } },
  { id: 'unicorn', slot: 'head', name: 'Roh jednorožca', price: 7200, colors: ['gold', 'silver', 'pink', 'white', 'sky', 'purple', 'rainbow'], draw: { head(g, c) {
    g.beginPath(); g.moveTo(-6.5, -88); g.lineTo(6.5, -88); g.lineTo(0, -124); g.closePath(); fs(g, c);
    g.save(); g.clip(); g.strokeStyle = 'rgba(59,43,58,0.45)'; g.lineWidth = 1.6;
    for (let y = -118; y < -88; y += 7) { g.beginPath(); g.moveTo(-8, y + 4); g.lineTo(8, y - 2); g.stroke(); }
    g.restore();
  } } },
  { id: 'crown', slot: 'head', name: 'Korunka', price: 9000, colors: ['gold', 'silver', 'pink', 'sky', 'rainbow'], draw: { head(g, c) {
    g.beginPath();
    g.moveTo(-15, -87); g.lineTo(-16, -104); g.lineTo(-8, -96); g.lineTo(0, -111);
    g.lineTo(8, -96); g.lineTo(16, -104); g.lineTo(15, -87);
    g.closePath(); fs(g, c);
    g.fillStyle = '#e0475b'; circ(g, 0, -95, 2.6); g.fill();
    g.fillStyle = '#5aa6e8'; circ(g, -9, -92, 2); g.fill(); circ(g, 9, -92, 2); g.fill();
  } } },

  // ----- Okuliare -----
  { id: 'glasses', slot: 'eyes', name: 'Okrúhle okuliare', price: 2400, colors: [...BASIC, 'gold', 'silver'], draw: { eyes(g, c) {
    g.save(); g.strokeStyle = paint(g, c); g.lineWidth = 2.8;
    g.fillStyle = 'rgba(255,255,255,0.25)';
    circ(g, -11.5, -64, 9); g.fill(); g.stroke();
    circ(g, 11.5, -64, 9); g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(-2.5, -65); g.lineTo(2.5, -65);
    g.moveTo(-20.5, -65); g.lineTo(-29, -68);
    g.moveTo(20.5, -65); g.lineTo(29, -68);
    g.stroke(); g.restore();
  } } },
  { id: 'sunglasses', slot: 'eyes', name: 'Slnečné okuliare', price: 3000, colors: ['black', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'rainbow'], draw: { eyes(g, c) {
    ell(g, -11.5, -64, 10, 7.5); fs(g, c);
    ell(g, 11.5, -64, 10, 7.5); fs(g, c);
    g.beginPath(); g.moveTo(-2, -66); g.lineTo(2, -66); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-16, -67); g.lineTo(-12, -69); g.moveTo(7, -67); g.lineTo(11, -69); g.stroke();
  } } },
  { id: 'hearts', slot: 'eyes', name: 'Srdiečkové okuliare', price: 3600, colors: ['red', 'pink', 'purple', 'orange', 'sky', 'black', 'gold', 'rainbow'], draw: { eyes(g, c) {
    for (const s of [-1, 1]) {
      heartPath(g, s * 12, -61, 9.5);
      g.globalAlpha = 0.92; g.fillStyle = paint(g, c); g.fill(); g.globalAlpha = 1; g.stroke();
    }
    g.beginPath(); g.moveTo(-3, -66); g.lineTo(3, -66); g.stroke();
    sparkle(g, -15, -67, 2.6); sparkle(g, 9, -67, 2.6);
  } } },
  { id: 'stars', slot: 'eyes', name: 'Hviezdičkové okuliare', price: 3600, colors: ['yellow', 'pink', 'sky', 'purple', 'mint', 'orange', 'gold', 'rainbow'], draw: { eyes(g, c) {
    for (const s of [-1, 1]) { starPath(g, s * 12, -64, 11.5, 5.5); g.globalAlpha = 0.92; g.fillStyle = paint(g, c); g.fill(); g.globalAlpha = 1; g.stroke(); }
    g.beginPath(); g.moveTo(-3, -65); g.lineTo(3, -65); g.stroke();
  } } },
  { id: 'ski', slot: 'eyes', name: 'Lyžiarske okuliare', price: 4200, colors: BASIC, draw: { eyes(g, c) {
    g.save(); g.lineWidth = 5; g.strokeStyle = OUT;
    g.beginPath(); g.moveTo(-31, -66); g.lineTo(-27, -66); g.moveTo(27, -66); g.lineTo(31, -66); g.stroke(); g.restore();
    rrPath(g, -28, -75, 56, 19, 9); fs(g, c);
    rrPath(g, -24, -72, 48, 13, 6);
    const grd = g.createLinearGradient(0, -72, 0, -59);
    grd.addColorStop(0, '#ffd27a'); grd.addColorStop(0.5, '#ff7eb6'); grd.addColorStop(1, '#7a6bff');
    g.fillStyle = grd; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-18, -69); g.lineTo(-10, -69); g.stroke();
  } } },
  { id: 'monocle', slot: 'eyes', name: 'Monokel', price: 4800, colors: ['gold', 'silver', 'black', 'brown'], draw: { eyes(g, c) {
    g.save(); g.fillStyle = 'rgba(255,255,255,0.3)'; circ(g, 11.5, -64, 9.5); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 5; g.stroke();
    g.strokeStyle = paint(g, c); g.lineWidth = 2.8; g.stroke();
    g.setLineDash([2.5, 2]); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(19, -59); g.bezierCurveTo(26, -50, 26, -40, 20, -34); g.stroke();
    g.restore();
  } } },

  // ----- Krk -----
  { id: 'collar', slot: 'neck', name: 'Obojok', price: 1500, colors: [...BASIC, 'gold', 'rainbow'], draw: { front(g, c) {
    collarBand(g, c);
    g.save(); g.strokeStyle = paint(g, 'gold'); g.lineWidth = 2; circ(g, 0, -26, 3); g.stroke(); g.restore();
  } } },
  { id: 'bellcollar', slot: 'neck', name: 'Obojok so zvončekom', price: 2100, colors: [...BASIC, 'rainbow'], draw: { front(g, c) {
    collarBand(g, c);
    circ(g, 0, -25, 5); fs(g, 'gold');
    g.beginPath(); g.moveTo(-3.5, -24); g.lineTo(3.5, -24); g.moveTo(0, -23); g.lineTo(0, -20.5); g.stroke();
  } } },
  { id: 'tagcollar', slot: 'neck', name: 'Obojok s menovkou', price: 2400, colors: [...BASIC, 'rainbow'], draw: { front(g, c) {
    collarBand(g, c);
    heartPath(g, 0, -23, 5.5); fs(g, 'gold');
  } } },
  { id: 'bowtie', slot: 'neck', name: 'Motýlik', price: 2100, colors: [...BASIC, 'gold', 'rainbow'], draw: { front(g, c) {
    g.beginPath(); g.moveTo(0, -31); g.lineTo(-14, -38); g.lineTo(-14, -24); g.closePath(); fs(g, c);
    g.beginPath(); g.moveTo(0, -31); g.lineTo(14, -38); g.lineTo(14, -24); g.closePath(); fs(g, c);
    circ(g, 0, -31, 3.8); fs(g, c);
  } } },
  { id: 'bandana', slot: 'neck', name: 'Šatka', price: 1800, colors: BASIC, draw: { front(g, c) {
    g.beginPath(); g.moveTo(-24, -38); g.quadraticCurveTo(0, -30, 24, -38); g.lineTo(0, -12); g.closePath();
    g.fillStyle = paint(g, c); g.fill();
    g.save(); g.clip(); g.fillStyle = contrast(c);
    for (const [x, y] of [[-12, -33], [0, -30], [12, -33], [-6, -24], [6, -24], [0, -17]]) { circ(g, x, y, 1.8); g.fill(); }
    g.restore(); g.stroke();
  } } },
  { id: 'scarf', slot: 'neck', name: 'Šál', price: 2700, colors: BASIC, draw: { front(g, c) {
    g.beginPath();
    g.moveTo(-24, -38); g.quadraticCurveTo(0, -28, 24, -38);
    g.lineTo(24, -31); g.quadraticCurveTo(0, -21, -24, -31);
    g.closePath(); fs(g, c);
    g.beginPath(); g.moveTo(9, -30); g.lineTo(17, -31); g.lineTo(20, -13); g.lineTo(12, -13); g.closePath();
    g.fillStyle = paint(g, c); g.fill();
    g.save(); g.clip(); g.fillStyle = contrast(c); g.fillRect(8, -25, 14, 3); g.fillRect(8, -19, 14, 3); g.restore();
    g.stroke();
  } } },
  { id: 'tie', slot: 'neck', name: 'Kravata', price: 2400, colors: BASIC, draw: { front(g, c) {
    g.beginPath(); g.moveTo(-4, -30); g.lineTo(4, -30); g.lineTo(7, -12); g.lineTo(0, -6); g.lineTo(-7, -12); g.closePath();
    g.fillStyle = paint(g, c); g.fill();
    g.save(); g.clip(); g.strokeStyle = contrast(c); g.lineWidth = 2;
    for (let y = -28; y < -4; y += 6) { g.beginPath(); g.moveTo(-8, y + 4); g.lineTo(8, y - 2); g.stroke(); }
    g.restore(); g.stroke();
    g.beginPath(); g.moveTo(-5, -35); g.lineTo(5, -35); g.lineTo(3.5, -29); g.lineTo(-3.5, -29); g.closePath(); fs(g, c);
  } } },
  { id: 'pearls', slot: 'neck', name: 'Perlový náhrdelník', price: 5400, colors: ['white', 'pink', 'gold', 'black', 'sky', 'purple'], draw: { front(g, c) {
    g.lineWidth = 1.4;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, x = -22 + 44 * u, y = -36 + Math.sin(u * Math.PI) * 10;
      circ(g, x, y, 2.9); g.fillStyle = paint(g, c); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)'; circ(g, x - 0.9, y - 0.9, 0.9); g.fill();
    }
  } } },

  // ----- Oblečenie (na tele) -----
  { id: 'tshirt', slot: 'body', name: 'Tričko', price: 3000, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    rrPath(g, 9, -31, 11, 10, 2); g.fillStyle = darker(c, 0.12); g.fill(); g.stroke();
  } } },
  { id: 'stripes', slot: 'body', name: 'Pruhované tričko', price: 3600, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    g.fillStyle = contrast(c);
    for (let y = -60; y < -16; y += 9) g.fillRect(-40, y, 80, 4);
  } } },
  { id: 'sweater', slot: 'body', name: 'Svetrík', price: 4200, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    g.strokeStyle = lighter(c, 0.45); g.lineWidth = 2;
    for (const y of [-44, -34, -26]) {
      g.beginPath();
      for (let x = -40; x <= 40; x += 6) g.lineTo(x, y + ((x / 6) % 2 ? 3 : -1));
      g.stroke();
    }
    g.fillStyle = darker(c, 0.15); g.fillRect(-40, -20, 80, 6);
    g.strokeStyle = OUT; g.lineWidth = 2.5;
  } } },
  { id: 'hoodie', slot: 'body', name: 'Mikina', price: 4800, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    g.beginPath(); g.moveTo(-15, -29); g.lineTo(15, -29); g.lineTo(19, -16); g.lineTo(-19, -16); g.closePath();
    g.fillStyle = darker(c, 0.12); g.fill(); g.stroke();
    g.strokeStyle = contrast(c); g.lineWidth = 2;
    g.beginPath(); g.moveTo(-6, -36); g.lineTo(-7, -30); g.moveTo(6, -36); g.lineTo(7, -30); g.stroke();
  } } },
  { id: 'vest', slot: 'body', name: 'Vesta', price: 3900, colors: BASIC, draw: { clip(g, c) {
    g.fillStyle = paint(g, c);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 40, -64); g.lineTo(s * 5, -64); g.lineTo(s * 5, -42); g.lineTo(s * 2, -14); g.lineTo(s * 40, -14); g.closePath();
      g.fill(); g.stroke();
    }
    for (const y of [-34, -25]) { circ(g, 6, y, 1.8); fs(g, 'gold'); }
  } } },
  { id: 'pajamas', slot: 'body', name: 'Pyžamko', price: 3600, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, isDark(c) ? c : c);
    g.fillStyle = contrast(c);
    for (const [x, y] of [[-28, -40], [-14, -24], [2, -34], [18, -22], [28, -44], [-30, -20], [12, -46]]) {
      starPath(g, x, y, 3, 1.3); g.fill();
    }
    g.fillStyle = '#ffd84d';
    g.beginPath(); g.arc(-4, -21, 4.5, 0.6, Math.PI * 1.6 + 0.6); g.arc(-2.5, -22.5, 3.6, Math.PI * 1.6 + 0.6, 0.6, true); g.fill();
  } } },
  { id: 'jersey', slot: 'body', name: 'Dres', price: 4200, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    g.fillStyle = contrast(c); g.fillRect(-40, -64, 9, 50); g.fillRect(31, -64, 9, 50);
    g.font = '700 17px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 2.5; g.strokeText('7', 0, -23); g.fillText('7', 0, -23);
  } } },
  { id: 'hero', slot: 'body', name: 'Superhrdina', price: 5100, colors: BASIC, draw: { clip(g, c) {
    shirtBase(g, c);
    circ(g, 0, -23, 8.5); g.fillStyle = c === 'yellow' ? '#e0475b' : '#ffd84d'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(1.5, -30); g.lineTo(-4, -22); g.lineTo(0.5, -22); g.lineTo(-1.5, -16); g.lineTo(4.5, -25); g.lineTo(0, -25); g.closePath();
    g.fillStyle = paint(g, c); g.fill(); g.lineWidth = 1.2; g.stroke(); g.lineWidth = 2.5;
  } } },
  { id: 'dress', slot: 'body', name: 'Šaty s volánom', price: 5400, colors: BASIC, draw: {
    clip(g, c) {
      g.fillStyle = paint(g, c); g.fillRect(-40, -64, 80, 64);
      g.fillStyle = contrast(c);
      for (const [x, y] of [[-26, -42], [-12, -26], [4, -38], [20, -28], [28, -46], [-30, -24], [10, -20]]) { circ(g, x, y, 2.2); g.fill(); }
    },
    over(g, c) {
      g.beginPath(); g.moveTo(-40, -20);
      for (let i = 0; i <= 8; i++) {
        const x = -46 + i * 11.5;
        g.quadraticCurveTo(x - 5.75, i ? -2 : -20, x, -6);
      }
      g.lineTo(40, -20); g.quadraticCurveTo(0, -12, -40, -20); g.closePath();
      g.fillStyle = lighter(c, 0.3); g.fill(); g.stroke();
    },
  } },

  // ----- Chrbát -----
  { id: 'backpack', slot: 'back', name: 'Ruksak', price: 4200, colors: BASIC, draw: {
    back(g, c) { rrPath(g, -43, -62, 86, 46, 12); fs(g, c); },
    clip(g, c) {
      g.fillStyle = darker(c, 0.15);
      for (const s of [-1, 1]) { g.beginPath(); g.rect(s * 21 - 4, -64, 8, 50); g.fill(); g.stroke(); }
    },
  } },
  { id: 'cape', slot: 'back', name: 'Plášť', price: 5400, colors: [...BASIC, 'gold', 'rainbow'], draw: {
    back(g, c) {
      g.beginPath(); g.moveTo(-24, -46); g.lineTo(24, -46); g.quadraticCurveTo(46, -22, 50, 0); g.lineTo(-50, 0); g.quadraticCurveTo(-46, -22, -24, -46);
      g.closePath(); fs(g, c);
    },
    front(g) { circ(g, -9, -34, 3); fs(g, 'gold'); circ(g, 9, -34, 3); fs(g, 'gold'); },
  } },
  { id: 'butterfly', slot: 'back', name: 'Motýlie krídla', price: 7200, colors: ['pink', 'sky', 'purple', 'yellow', 'mint', 'orange', 'blue', 'rainbow'], draw: { back(g, c, t) {
    const f = 1 + Math.sin(t * 3) * 0.04;
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 22, -48); g.scale(f, 1);
      ell(g, s * 24, -14, 22, 16, s * 0.5); fs(g, c);
      ell(g, s * 20, 14, 14, 11, -s * 0.4); fs(g, c);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      circ(g, s * 30, -16, 4.5); g.fill(); circ(g, s * 22, 15, 3); g.fill();
      g.restore();
    }
  } } },
  { id: 'wings', slot: 'back', name: 'Anjelské krídla', price: 8400, colors: ['white', 'pink', 'sky', 'gold', 'black', 'purple', 'rainbow'], draw: { back(g, c, t) {
    const lift = Math.sin(t * 2.5) * 0.05;
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 20, -50); g.rotate(-s * lift);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(s * 22, -26, s * 46, -34, s * 58, -26);
      g.quadraticCurveTo(s * 52, -18, s * 54, -12);
      g.quadraticCurveTo(s * 44, -8, s * 46, -1);
      g.quadraticCurveTo(s * 34, 2, s * 34, 9);
      g.quadraticCurveTo(s * 20, 10, s * 4, 22);
      g.closePath(); fs(g, c);
      g.strokeStyle = 'rgba(59,43,58,0.35)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(s * 12, -2); g.lineTo(s * 46, -18); g.moveTo(s * 10, 6); g.lineTo(s * 36, -2); g.stroke();
      g.restore();
    }
    g.strokeStyle = OUT; g.lineWidth = 2.5;
  } } },

  // ----- Vodítka -----
  { id: 'leash', slot: 'leash', name: 'Vodítko', price: 2400, colors: BASIC, draw: { front(g, c) { leashLine(g, c, false); } } },
  { id: 'harness', slot: 'leash', name: 'Postroj s vodítkom', price: 3600, colors: BASIC, draw: {
    clip(g, c) {
      g.fillStyle = paint(g, c);
      g.beginPath(); g.rect(-40, -31, 80, 7); g.fill(); g.stroke();
      g.beginPath(); g.rect(-3.5, -31, 7, 20); g.fill(); g.stroke();
    },
    front(g, c) { leashLine(g, c, false); },
  } },
  { id: 'glitter', slot: 'leash', name: 'Trblietavé vodítko', price: 5400, colors: ['gold', 'silver', 'pink', 'purple', 'sky', 'rainbow'], draw: { front(g, c) { leashLine(g, c, true); } } },

  // ----- Pelechy -----
  { id: 'box', slot: 'bed', name: 'Kartónová krabica', price: 3000, colors: ['red', 'pink', 'yellow', 'green', 'sky', 'purple'], draw: {
    bedBack(g) {
      g.beginPath(); g.moveTo(-48, -30); g.lineTo(-58, -46); g.lineTo(-22, -46); g.lineTo(-14, -30); g.closePath(); fs(g, 'brown');
      g.beginPath(); g.rect(-48, -30, 96, 34); g.fillStyle = '#d8a866'; g.fill(); g.stroke();
    },
    bedFront(g, c) {
      g.beginPath(); g.rect(-50, -18, 100, 24); g.fillStyle = '#e2b574'; g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-49, -11, 98, 5);
      heartPath(g, 30, -6, 6); fs(g, c);
    },
  } },
  { id: 'pillow', slot: 'bed', name: 'Vankúš', price: 4800, colors: BASIC, draw: { bedBack(g, c) {
    rrPath(g, -60, -12, 120, 18, 9); fs(g, c);
    g.save(); g.setLineDash([3, 3]); g.strokeStyle = lighter(c, 0.4); g.lineWidth = 1.5;
    rrPath(g, -54, -8, 108, 10, 5); g.stroke(); g.restore();
  } } },
  { id: 'pelech', slot: 'bed', name: 'Okrúhly pelech', price: 6000, colors: BASIC, draw: {
    bedBack(g, c) {
      ell(g, 0, -8, 62, 22); fs(g, c);
      ell(g, 0, -6, 48, 12); g.fillStyle = lighter(c, 0.45); g.fill(); g.stroke();
    },
    bedFront(g, c) {
      g.beginPath(); g.ellipse(0, -8, 62, 22, 0, 0, Math.PI); g.ellipse(0, -6, 48, 12, 0, Math.PI, 0, true); g.closePath(); fs(g, c);
    },
  } },
  { id: 'basket', slot: 'bed', name: 'Prútený košík', price: 7200, colors: BASIC, draw: {
    bedBack(g, c) {
      ell(g, 0, -14, 60, 18); fs(g, 'brown');
      ell(g, 0, -8, 50, 10); g.fillStyle = hexOf(c); g.fill(); g.stroke();
    },
    bedFront(g) {
      g.beginPath(); g.moveTo(-60, -14); g.quadraticCurveTo(0, 8, 60, -14); g.lineTo(53, 6); g.quadraticCurveTo(0, 22, -53, 6); g.closePath();
      g.fillStyle = '#c08a4a'; g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 1.6;
      for (let x = -60; x <= 60; x += 8) { g.beginPath(); g.moveTo(x, -16); g.lineTo(x + 4, 20); g.stroke(); }
      g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(0, 18, 60, 0); g.stroke();
      g.restore(); g.stroke();
    },
  } },
  { id: 'cloud', slot: 'bed', name: 'Obláčik', price: 9600, colors: ['white', 'pink', 'sky', 'yellow', 'mint', 'purple', 'rainbow'], draw: { bedBack(g, c) {
    for (const [x, y, r] of [[-46, -6, 15], [46, -6, 15], [-26, -12, 18], [26, -12, 18], [0, -14, 20], [-24, 2, 14], [24, 2, 14], [0, 2, 16]]) {
      circ(g, x, y, r); fs(g, c);
    }
    g.fillStyle = paint(g, c);
    for (const [x, y, r] of [[-26, -9, 15], [26, -9, 15], [0, -9, 17], [-44, -4, 12], [44, -4, 12]]) { circ(g, x, y, r); g.fill(); }
  } } },
  { id: 'royal', slot: 'bed', name: 'Kráľovský vankúš', price: 12000, colors: ['red', 'purple', 'blue', 'green', 'pink', 'black', 'gold'], draw: { bedBack(g, c) {
    rrPath(g, -64, -14, 128, 22, 10); fs(g, c);
    g.save(); g.strokeStyle = paint(g, 'gold'); g.lineWidth = 2.5;
    rrPath(g, -58, -10, 116, 14, 7); g.stroke(); g.restore();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 62, -12); g.lineTo(s * 70, -2); g.lineTo(s * 66, 4); g.closePath(); fs(g, 'gold');
    }
  } } },
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(it => [it.id, it]));

const variantKey = (itemId, color) => itemId + ':' + color;
function parseVariant(key) {
  if (!key) return null;
  const [id, c] = key.split(':');
  const item = ITEM_BY_ID[id];
  return item && COLORS[c] ? { item, c } : null;
}
const itemPrice = (item, c) => Math.round((item.price * (COLOR_MULT[c] || 1)) / 100) * 100;

// Doplnok, s ktorým mačka „prišla“, patrí do jedného slotu – ak tam dáš novú vec, pôvodná sa schová.
const BASE_ACC_SLOT = {
  glasses: 'eyes', sunglasses: 'eyes', pirate: 'eyes', scarf: 'neck', bell: 'neck', braid: 'hair',
};
const baseAccSlot = acc => BASE_ACC_SLOT[acc] || 'head';

/** Nakreslí jednu vrstvu oblečenia (volá sa z drawCat). */
function drawOutfitLayer(g, outfit, layer, t) {
  if (!outfit) return;
  for (const slot of ['bed', 'back', 'body', 'leash', 'neck', 'eyes', 'head']) {
    const v = outfit[slot];
    if (!v) continue;
    const fn = v.item.draw[layer];
    if (!fn) continue;
    g.save();
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g, v.c, t);
    g.restore();
  }
}

/** { slot: "id:farba" } -> { slot: { item, c } } */
function resolveOutfit(raw) {
  const o = {};
  if (raw) for (const s of Object.keys(raw)) { const v = parseVariant(raw[s]); if (v && v.item.slot === s) o[s] = v; }
  return o;
}

// ---------- Jedlo ----------
// fill = o koľko % sa mačka nasýti, price = cena v bodoch
const FOODS = [
  { id: 'g-fish', name: 'Rybacie granule', kind: 'bag', icon: 'fish', color: '#4f8fe8', fill: 25, price: 400 },
  { id: 'g-chicken', name: 'Kuracie granule', kind: 'bag', icon: 'drum', color: '#ff9a3c', fill: 25, price: 400 },
  { id: 'g-beef', name: 'Hovädzie granule', kind: 'bag', icon: 'meat', color: '#d6455d', fill: 28, price: 450 },
  { id: 'g-turkey', name: 'Morčacie granule', kind: 'bag', icon: 'drum', color: '#9c6b48', fill: 28, price: 450 },
  { id: 'g-salmon', name: 'Lososové granule', kind: 'bag', icon: 'salmon', color: '#ff7eb6', fill: 32, price: 550 },
  { id: 'g-rabbit', name: 'Králičie granule', kind: 'bag', icon: 'meat', color: '#5cc16a', fill: 30, price: 500 },
  { id: 'c-tuna', name: 'Tuniaková konzerva', kind: 'can', icon: 'fish', color: '#4fb0c6', fill: 40, price: 650 },
  { id: 'c-chicken', name: 'Kuracia kapsička', kind: 'pouch', icon: 'drum', color: '#ffb347', fill: 35, price: 550 },
  { id: 'c-beef', name: 'Hovädzia kapsička', kind: 'pouch', icon: 'meat', color: '#c0392b', fill: 35, price: 550 },
  { id: 'm-milk', name: 'Mačacie mlieko', kind: 'milk', color: '#7cc6ff', fill: 15, price: 250 },
  { id: 'm-goat', name: 'Kozie mlieko', kind: 'milk', color: '#8be08b', fill: 18, price: 300 },
  { id: 'm-cream', name: 'Smotanka', kind: 'milk', color: '#ffd84d', fill: 20, price: 350 },
  { id: 't-sticks', name: 'Rybacie tyčinky', kind: 'treat', icon: 'sticks', color: '#ff9a3c', fill: 10, price: 200 },
  { id: 't-shrimp', name: 'Krevetky', kind: 'treat', icon: 'shrimp', color: '#ff8a7a', fill: 12, price: 250 },
  { id: 't-cheese', name: 'Syrové kocky', kind: 'treat', icon: 'cheese', color: '#ffd84d', fill: 10, price: 200 },
  { id: 't-cream', name: 'Krémová pochúťka', kind: 'treat', icon: 'tube', color: '#b49bff', fill: 15, price: 300 },
  { id: 't-cake', name: 'Narodeninová tortička', kind: 'cake', color: '#ff7eb6', fill: 60, price: 1100 },
  // lekáreň – liek skráti chorobu mačičky na polovicu
  { id: 'med', name: 'Liek pre mačičky', kind: 'med', color: '#e0475b', fill: 0, price: 1500 },
];
const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));
const FOOD_GROUPS = [
  { id: 'med', name: 'Lekáreň', kinds: ['med'] },
  { name: 'Granule', kinds: ['bag'] },
  { name: 'Konzervy a kapsičky', kinds: ['can', 'pouch'] },
  { name: 'Mlieko', kinds: ['milk'] },
  { name: 'Mlsky', kinds: ['treat', 'cake'] },
];

function drawFoodIcon(g, icon, x, y, r) {
  g.save(); g.translate(x, y);
  g.lineWidth = Math.max(1.2, r * 0.12); g.strokeStyle = OUT;
  switch (icon) {
    case 'fish': drawSnack(g, 'fish', 0, 0, r); break;
    case 'salmon':
      g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 0.9, r, 0); g.quadraticCurveTo(0, r * 0.9, -r, 0); g.closePath();
      g.fillStyle = '#ff9466'; g.fill(); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.12;
      for (const xx of [-0.4, 0, 0.4]) { g.beginPath(); g.moveTo(xx * r, -r * 0.35); g.lineTo(xx * r + r * 0.15, r * 0.35); g.stroke(); }
      break;
    case 'drum':
      g.rotate(-0.6);
      g.beginPath(); g.rect(r * 0.2, -r * 0.14, r * 0.7, r * 0.28); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
      circ(g, r * 0.95, -r * 0.18, r * 0.17); g.fill(); g.stroke(); circ(g, r * 0.95, r * 0.18, r * 0.17); g.fill(); g.stroke();
      ell(g, -r * 0.2, 0, r * 0.62, r * 0.48); g.fillStyle = '#d9822b'; g.fill(); g.stroke();
      break;
    case 'meat':
      ell(g, 0, 0, r * 0.9, r * 0.65); g.fillStyle = '#d6455d'; g.fill(); g.stroke();
      ell(g, r * 0.25, -r * 0.1, r * 0.22, r * 0.18); g.fillStyle = '#fff0f0'; g.fill();
      g.strokeStyle = '#fff0f0'; g.lineWidth = r * 0.12;
      g.beginPath(); g.arc(0, 0, r * 0.62, 2.2, 3.6); g.stroke();
      break;
    case 'sticks':
      for (const [dx, rot, col] of [[-0.3, -0.3, '#ff9a3c'], [0, 0, '#ffb347'], [0.3, 0.3, '#ff9a3c']]) {
        g.save(); g.rotate(rot); rrPath(g, dx * r - r * 0.12, -r * 0.9, r * 0.24, r * 1.8, r * 0.1); g.fillStyle = col; g.fill(); g.stroke(); g.restore();
      }
      break;
    case 'shrimp':
      g.beginPath(); g.arc(0, 0, r * 0.65, Math.PI * 0.9, Math.PI * 2.4); g.lineWidth = r * 0.5; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = r * 0.36; g.strokeStyle = '#ff8a7a'; g.stroke();
      g.fillStyle = OUT; circ(g, -r * 0.62, r * 0.12, r * 0.08); g.fill();
      break;
    case 'cheese':
      g.beginPath(); g.moveTo(-r * 0.9, r * 0.5); g.lineTo(r * 0.9, r * 0.5); g.lineTo(r * 0.9, -r * 0.1); g.lineTo(-r * 0.9, -r * 0.6); g.closePath();
      g.fillStyle = '#ffd84d'; g.fill(); g.stroke();
      g.fillStyle = '#e8b830'; circ(g, -r * 0.2, r * 0.15, r * 0.14); g.fill(); circ(g, r * 0.45, r * 0.25, r * 0.1); g.fill();
      break;
    case 'tube':
      g.rotate(0.5);
      rrPath(g, -r * 0.3, -r, r * 0.6, r * 2, r * 0.2); g.fillStyle = '#b49bff'; g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(-r * 0.28, -r * 0.3, r * 0.56, r * 0.5);
      break;
  }
  g.restore();
}

/** Nakreslí balenie jedla (ikona v obchode a pri kŕmení). */
function drawFood(g, food, x, y, r) {
  g.save(); g.translate(x, y);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = OUT; g.lineWidth = Math.max(1.5, r * 0.07);
  const col = food.color;
  switch (food.kind) {
    case 'bag':
      g.beginPath(); g.moveTo(-r * 0.62, -r * 0.8); g.lineTo(r * 0.62, -r * 0.8); g.lineTo(r * 0.78, r * 0.9); g.lineTo(-r * 0.78, r * 0.9); g.closePath();
      g.fillStyle = col; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.62, -r * 0.8); g.lineTo(-r * 0.5, -r * 0.95); g.lineTo(-r * 0.3, -r * 0.8); g.lineTo(-r * 0.1, -r * 0.95); g.lineTo(r * 0.1, -r * 0.8); g.lineTo(r * 0.3, -r * 0.95); g.lineTo(r * 0.5, -r * 0.8);
      g.stroke();
      circ(g, 0, r * 0.12, r * 0.5); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
      drawFoodIcon(g, food.icon, 0, r * 0.12, r * 0.36);
      break;
    case 'can':
      ell(g, 0, r * 0.55, r * 0.8, r * 0.28); g.fillStyle = '#9aa0ad'; g.fill(); g.stroke();
      g.beginPath(); g.rect(-r * 0.8, -r * 0.45, r * 1.6, r); g.fillStyle = col; g.fill();
      g.beginPath(); g.moveTo(-r * 0.8, -r * 0.45); g.lineTo(-r * 0.8, r * 0.55); g.moveTo(r * 0.8, -r * 0.45); g.lineTo(r * 0.8, r * 0.55); g.stroke();
      ell(g, 0, -r * 0.45, r * 0.8, r * 0.28); g.fillStyle = '#d5d9e2'; g.fill(); g.stroke();
      ell(g, 0, -r * 0.45, r * 0.55, r * 0.17); g.stroke();
      drawFoodIcon(g, food.icon, 0, r * 0.12, r * 0.4);
      break;
    case 'pouch':
      g.beginPath(); g.moveTo(-r * 0.7, -r * 0.85); g.lineTo(r * 0.7, -r * 0.85); g.lineTo(r * 0.7, r * 0.6); g.quadraticCurveTo(0, r * 1.05, -r * 0.7, r * 0.6); g.closePath();
      g.fillStyle = col; g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 0.12);
      drawFoodIcon(g, food.icon, 0, r * 0.1, r * 0.42);
      break;
    case 'milk':
      ell(g, 0, r * 0.45, r * 0.95, r * 0.35); g.fillStyle = col; g.fill(); g.stroke();
      ell(g, 0, r * 0.2, r * 0.95, r * 0.32); g.fillStyle = col; g.fill(); g.stroke();
      ell(g, 0, r * 0.2, r * 0.75, r * 0.22); g.fillStyle = '#fffdf6'; g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; ell(g, -r * 0.25, r * 0.15, r * 0.2, r * 0.07); g.fill();
      // fľaša
      rrPath(g, r * 0.2, -r * 0.95, r * 0.5, r * 1.0, r * 0.12); g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      g.beginPath(); g.rect(r * 0.28, -r * 1.05, r * 0.34, r * 0.16); g.fillStyle = col; g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(r * 0.22, -r * 0.55, r * 0.46, r * 0.22);
      break;
    case 'treat':
      g.beginPath(); g.moveTo(-r * 0.75, -r * 0.75); g.lineTo(r * 0.75, -r * 0.75); g.lineTo(r * 0.85, r * 0.85); g.lineTo(-r * 0.85, r * 0.85); g.closePath();
      g.fillStyle = col; g.fill(); g.stroke();
      circ(g, -r * 0.45, -r * 0.55, r * 0.09); g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      rrPath(g, -r * 0.55, -r * 0.3, r * 1.1, r * 0.95, r * 0.2); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
      drawFoodIcon(g, food.icon, 0, r * 0.18, r * 0.38);
      break;
    case 'med':
      // fľaštička s liekom a červeným krížom
      rrPath(g, -r * 0.6, -r * 0.55, r * 1.2, r * 1.45, r * 0.22); g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      rrPath(g, -r * 0.42, -r * 0.95, r * 0.84, r * 0.42, r * 0.1); g.fillStyle = col; g.fill(); g.stroke();
      g.fillStyle = col;
      g.fillRect(-r * 0.13, -r * 0.2, r * 0.26, r * 0.78);
      g.fillRect(-r * 0.39, r * 0.06, r * 0.78, r * 0.26);
      break;
    case 'cake':
      ell(g, 0, r * 0.55, r * 0.95, r * 0.3); g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      g.beginPath(); g.rect(-r * 0.7, -r * 0.2, r * 1.4, r * 0.7); g.fillStyle = '#f4d2a0'; g.fill(); g.stroke();
      ell(g, 0, -r * 0.2, r * 0.7, r * 0.22); g.fillStyle = col; g.fill(); g.stroke();
      g.fillStyle = col;
      for (const xx of [-0.55, -0.2, 0.15, 0.5]) { ell(g, xx * r, -r * 0.05, r * 0.1, r * 0.16); g.fill(); }
      g.beginPath(); g.rect(-r * 0.06, -r * 0.75, r * 0.12, r * 0.5); g.fillStyle = '#7cc6ff'; g.fill(); g.stroke();
      g.fillStyle = '#ffd84d'; ell(g, 0, -r * 0.85, r * 0.08, r * 0.14); g.fill();
      break;
  }
  g.restore();
}
