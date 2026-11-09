'use strict';
/* Menu, obrazovky a ukladanie postupu. */
(() => {
  const $ = s => document.querySelector(s);
  const STORE_KEY = 'macaci-zbor-v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  const store = Object.assign({ catL: 'mica', catR: 'rysavec', relax: false, best: {} }, load());
  if (!store.best || typeof store.best !== 'object') store.best = {};

  const catById = id => CATS.find(c => c.id === id) || CATS[0];
  const chosenCats = () => [catById(store.catL), catById(store.catR)];

  const audio = new AudioEngine();
  const game = new Game($('#game'), audio);
  game.setCats(chosenCats());

  // ---------- Obrazovky ----------
  const SCREENS = ['menu', 'songs', 'cats', 'help', 'pause', 'result'];
  function show(name) {
    for (const s of SCREENS) $('#screen-' + s).classList.toggle('hidden', s !== name);
    $('#btn-pause').classList.toggle('hidden', name !== null);
  }

  function go(name) {
    if (name === 'songs') renderSongs();
    if (name === 'cats') renderCats();
    show(name);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    audio.init();
    audio.blip();
    go(b.dataset.go);
  });

  // ---------- Pesničky ----------
  const starStr = n => '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`;

  function renderSongs() {
    const list = $('#song-list');
    list.innerHTML = '';
    for (const s of SONGS) {
      const best = store.best[s.id];
      const el = document.createElement('button');
      el.className = 'song';
      el.style.setProperty('--c1', s.bg[0]);
      el.style.setProperty('--c2', s.bg[1]);
      el.innerHTML = `
        <div class="song-main">
          <div class="song-title"></div>
          <div class="song-credit"></div>
        </div>
        <div class="song-meta">
          <div class="diff" title="Obtiažnosť">${'●'.repeat(s.difficulty)}${'○'.repeat(3 - s.difficulty)}</div>
          <div class="stars">${starStr(best ? best.stars : 0)}</div>
          <div class="best">${best ? best.score : '—'}</div>
        </div>`;
      el.querySelector('.song-title').textContent = s.title;
      el.querySelector('.song-credit').textContent = s.credit;
      el.addEventListener('click', () => startSong(s));
      list.append(el);
    }
  }

  let current = null;
  function startSong(song) {
    audio.init();
    current = song;
    show(null);
    game.start(song, chosenCats(), store.relax);
  }

  // ---------- Mačky ----------
  let activeSlot = 0;

  function paintCat(cv, cat, px) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = px * d;
    cv.height = px * d;
    cv.style.width = cv.style.height = px + 'px';
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, px, px);
    drawCat(g, cat, px * 0.45, px * 0.95, px * 0.68, { t: 0.6 });
  }

  function renderCats() {
    $('#cat-count').textContent = `${CATS.length} mačiek · všetky zadarmo`;
    const grid = $('#cat-grid');
    if (!grid.childElementCount) {
      for (const cat of CATS) {
        const b = document.createElement('button');
        b.className = 'cat-card';
        b.dataset.id = cat.id;
        const cv = document.createElement('canvas');
        const nm = document.createElement('span');
        nm.className = 'cat-name';
        nm.textContent = cat.name;
        const badge = document.createElement('span');
        badge.className = 'badge';
        b.append(cv, nm, badge);
        b.addEventListener('click', () => pickCat(cat));
        grid.append(b);
        paintCat(cv, cat, 84);
      }
    }
    updateCatUI();
  }

  function pickCat(cat) {
    audio.init();
    if (activeSlot === 0) store.catL = cat.id; else store.catR = cat.id;
    save();
    audio.preview(cat.voice, activeSlot === 0 ? 72 : 76);
    game.setCats(chosenCats());
    updateCatUI();
  }

  function updateCatUI() {
    const [l, r] = chosenCats();
    document.querySelectorAll('.slot').forEach(el => {
      const i = Number(el.dataset.slot);
      const cat = i === 0 ? l : r;
      el.classList.toggle('active', i === activeSlot);
      el.querySelector('.slot-name').textContent = cat.name;
      paintCat(el.querySelector('canvas'), cat, 84);
    });
    document.querySelectorAll('.cat-card').forEach(el => {
      const id = el.dataset.id;
      const tags = [];
      if (id === l.id) tags.push('Ľ');
      if (id === r.id) tags.push('P');
      el.querySelector('.badge').textContent = tags.join(' ');
      el.classList.toggle('sel', tags.length > 0);
    });
  }

  document.querySelectorAll('.slot').forEach(el => {
    el.addEventListener('click', () => {
      audio.init();
      audio.blip();
      activeSlot = Number(el.dataset.slot);
      updateCatUI();
    });
  });

  // ---------- Pauza ----------
  function doPause() { if (game.pause()) show('pause'); }
  function doResume() { show(null); game.resume(); }

  $('#btn-pause').addEventListener('click', doPause);
  game.onPauseKey = () => {
    if (game.mode === 'play') doPause();
    else if (game.mode === 'paused') doResume();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) doPause(); });

  $('#btn-resume').addEventListener('click', doResume);
  $('#btn-restart').addEventListener('click', () => { game.quit(); startSong(current); });
  $('#btn-quit').addEventListener('click', () => { game.quit(); go('menu'); });

  // ---------- Výsledok ----------
  game.onEnd = r => {
    const prev = store.best[current.id] || { score: 0, stars: 0 };
    const isNew = r.score > prev.score;
    store.best[current.id] = { score: Math.max(prev.score, r.score), stars: Math.max(prev.stars, r.stars) };
    save();
    setTimeout(() => showResult(r, isNew), r.cleared ? 900 : 600);
  };

  function showResult(r, isNew) {
    if (game.mode !== 'over') return;
    $('#res-title').textContent = r.cleared ? 'Hotovo!' : 'Mačky sú ešte hladné!';
    const stars = $('#res-stars');
    stars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i < r.stars) { s.className = 'on'; s.style.animationDelay = `${0.15 + i * 0.18}s`; }
      stars.append(s);
    }
    $('#res-score').textContent = r.score;
    $('#res-new').classList.toggle('hidden', !isNew || r.score === 0);
    $('#res-acc').textContent = `${Math.round(r.acc * 100)} %`;
    $('#res-combo').textContent = r.maxCombo;
    show('result');
  }

  $('#btn-again').addEventListener('click', () => { game.quit(); startSong(current); });
  $('#btn-songs').addEventListener('click', () => { audio.blip(); game.quit(); go('songs'); });

  // ---------- Nastavenia ----------
  const relax = $('#opt-relax');
  relax.checked = !!store.relax;
  relax.addEventListener('change', () => { store.relax = relax.checked; save(); });

  // Po načítaní fontu prekresliť náhľady mačiek (kvôli rozmerom)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => game.resize());

  show('menu');

  // Prístup pre ladenie z konzoly prehliadača (napr. macaciZbor.game.score)
  window.macaciZbor = { game, audio, store };
})();
