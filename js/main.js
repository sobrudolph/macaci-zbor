'use strict';
/* Menu, obrazovky, obchod, kŕmenie, šatník a ukladanie postupu. */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  // v2 = reset hry (nové mačky, ceny, odmeny a IQ od nuly); starý postup v1 sa zmaže
  const STORE_KEY = 'macaci-zbor-v2';
  try { localStorage.removeItem('macaci-zbor-v1'); } catch (e) { /* ignore */ }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Ukladanie ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  const store = Object.assign({ catL: 'mica', catR: 'rysavec', best: {} }, load());
  delete store.relax; // Relax režim bol zrušený
  for (const k of ['best', 'owned', 'outfits', 'hunger', 'names', 'fat', 'iq', 'skills']) {
    if (!store[k] || typeof store[k] !== 'object') store[k] = {};
  }
  // vlastné mená mačiek (pôvodné meno ostáva v baseName)
  for (const c of CATS) {
    c.baseName = c.name;
    if (typeof store.names[c.id] === 'string' && store.names[c.id]) c.name = store.names[c.id];
  }
  const START_COINS = 35000;
  if (typeof store.coins !== 'number') {
    // uvítací darček
    store.coins = START_COINS;
    store.pantry = { 'g-fish': 2, 'm-milk': 1, 't-sticks': 2 };
  }
  if (!store.pantry || typeof store.pantry !== 'object') store.pantry = {};
  // vlastnené mačky: na začiatku si hráč vyberie 2 zadarmo, ostatné sú zamknuté a dajú sa kúpiť
  if (!Array.isArray(store.cats)) store.cats = [];

  const catById = id => CATS.find(c => c.id === id) || CATS[0];
  const chosenCats = () => [catById(store.catL), catById(store.catR)];
  const ownsCat = id => store.cats.includes(id);
  function isSick(id) { return !!(store.sick && store.sick[id]); }
  /** Tvar podľa rodu mačky: on (m), ona (f), ono (n) – napr. gx(cat, 'ochorel', 'ochorela', 'ochorelo'). */
  const gx = (cat, m, f, n) => (cat && cat.g === 'm' ? m : cat && cat.g === 'n' ? (n == null ? m : n) : f);
  const ownedCats = () => CATS.filter(c => ownsCat(c.id));
  /** Cena mačky: obyčajná 8 000, s doplnkom alebo vzorom 12 000, výnimočná 18 000. */
  const SPECIAL_ACC = ['crown', 'halo', 'wizard', 'tophat', 'braid', 'antenna'];
  const PATTERNED = ['calico', 'siamese', 'tuxedo', 'spots', 'socks', 'tiger', 'bicolor'];
  function catPrice(cat) {
    if (cat.pattern === 'rainbow' || cat.pattern === 'galaxy' || SPECIAL_ACC.includes(cat.acc)) return 18000;
    if (cat.acc || PATTERNED.includes(cat.pattern)) return 12000;
    return 8000;
  }
  const catTier = p => (p >= 18000 ? 'výnimočná mačička' : p >= 12000 ? 'mačička s doplnkom' : 'obyčajná mačička');

  // ---------- Body (peňaženka) ----------
  // Odmeny za pesničku: (150 + 150 × obtiažnosť) × koľko chytil → 300 až 750 bodov
  const SONG_BASE = 150, SONG_PER_DIFF = 150;
  const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#ffd34d" stroke="#c8961a" stroke-width="1.6"/><g fill="#c8961a"><ellipse cx="10" cy="12.4" rx="3.4" ry="2.8"/><circle cx="5.9" cy="8.6" r="1.5"/><circle cx="8.3" cy="6.3" r="1.5"/><circle cx="11.7" cy="6.3" r="1.5"/><circle cx="14.1" cy="8.6" r="1.5"/></g></svg>';
  const fmt = n => Math.round(n).toLocaleString('sk-SK');
  const price = n => COIN + fmt(n);

  function updateWallets() {
    $$('.wallet').forEach(el => { el.innerHTML = price(store.coins); });
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- Sýtosť mačiek ----------
  const HUNGER_START = 70;   // nová mačka
  const DECAY_PER_HOUR = 2;  // za deň klesne o 48 %
  const SONG_COST = 10;      // každá pesnička mačky unaví a vyhladnú

  const now0 = Date.now();
  for (const c of CATS) if (!store.hunger[c.id]) store.hunger[c.id] = { v: HUNGER_START, t: now0 };

  function hungerOf(id) {
    const h = store.hunger[id];
    if (!h) return HUNGER_START;
    return clampN(h.v - ((Date.now() - h.t) / 3600000) * DECAY_PER_HOUR, 0, 100);
  }
  function setHunger(id, v) { store.hunger[id] = { v: clampN(v, 0, 100), t: Date.now() }; }

  function moodOf(v) {
    if (v >= 60) return { cls: 'ok', label: 'Najedená', bonus: 0.1 };
    if (v >= 25) return { cls: 'mid', label: 'V pohode', bonus: 0 };
    return { cls: 'low', label: 'Hladná!', bonus: -0.15 };
  }
  function hungerBar(v) {
    const m = moodOf(v);
    return `<div class="hbar ${m.cls}"><i style="width:${Math.round(v)}%"></i></div>`;
  }

  // ---------- Váha: prekŕmená mačka priberie ----------
  // Priberá rýchlo, chudne pomaly a len pohybom v hre (treba viac pesničiek).
  const FAT_GAIN = 1.5;          // jedlo navyše (nad 100 % sýtosti) × 1.5 ide do váhy
  const FAT_PER_MOVE = 1;        // za každú prejdenú šírku polovice obrazovky −1 váhy
  const FAT_SONG_MAX = 8;        // najviac −8 za jednu pesničku

  function fatOf(id) {
    const f = store.fat[id];
    return f ? clampN(f.v, 0, 100) : 0;
  }
  function setFat(id, v) {
    v = clampN(v, 0, 100);
    if (v < 0.5) delete store.fat[id]; else store.fat[id] = { v, t: Date.now() };
  }
  function weightOf(v) {
    if (v >= 60) return { cls: 'fat2', label: 'Tučná!', bonus: -0.1 };
    if (v >= 25) return { cls: 'fat1', label: 'Bucľatá', bonus: 0 };
    return { cls: 'fat0', label: 'Štíhla', bonus: 0 };
  }

  // ---------- Oblečenie ----------
  const outfitOf = id => resolveOutfit(store.outfits[id]);
  function equip(catId, slot, key) {
    const o = store.outfits[catId] || (store.outfits[catId] = {});
    if (key) o[slot] = key; else delete o[slot];
    save();
    syncGame();
  }

  const audio = new AudioEngine();
  const game = new Game($('#game'), audio);
  function syncGame() {
    const cats = chosenCats();
    game.setCats(cats);
    game.looks = cats.map(c => ({ outfit: outfitOf(c.id), hunger: hungerOf(c.id), fat: fatOf(c.id), sick: isSick(c.id) }));
  }
  syncGame();
  setInterval(syncGame, 60000);

  // ---------- Kreslenie mačky do malého plátna ----------
  // focus = ktorá časť mačky má byť vidieť (v súradniciach mačky): stred y a výška výrezu
  const FOCUS = {
    full: { cx: 0, cy: -52, h: 150 },
    head: { cx: 0, cy: -92, h: 80 },
    eyes: { cx: 0, cy: -66, h: 56 },
    neck: { cx: 0, cy: -36, h: 62 },
    body: { cx: 0, cy: -34, h: 80 },
    back: { cx: 0, cy: -52, h: 135 },
    leash: { cx: -12, cy: -40, h: 130 },
    bed: { cx: 0, cy: -46, h: 150 },
  };
  function prepCanvas(cv, w, h) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w, h);
    return g;
  }
  function paintCat(cv, cat, px, outfit, focus = 'full', st = {}) {
    const g = prepCanvas(cv, px, px);
    const f = FOCUS[focus] || FOCUS.full;
    const s = px / f.h;
    drawCat(g, cat, px / 2 - f.cx * s, px / 2 - f.cy * s, 105 * s, Object.assign({ t: 0.6, outfit, fat: fatOf(cat.id), sick: isSick(cat.id) }, st));
  }
  function paintFood(cv, food, px) {
    const g = prepCanvas(cv, px, px);
    drawFood(g, food, px / 2, px / 2, px * 0.4);
  }

  // ---------- Obrazovky ----------
  const SCREENS = ['menu', 'welcome', 'games', 'songs', 'school', 'lesson', 'dictation', 'prvouka', 'cats', 'cat', 'shop', 'help', 'pause', 'result'];
  let screen = 'menu';
  function show(name) {
    screen = name;
    for (const s of SCREENS) $('#screen-' + s).classList.toggle('hidden', s !== name);
    $('#btn-pause').classList.toggle('hidden', name !== null);
    updateWallets();
    if (name === 'cat') startStage();
  }

  function go(name) {
    if (name === 'songs' && !singersReady()) {
      queueReward({ kind: 'block' });
      showNextReward();
      return;
    }
    if (name === 'school' && !canLearn(MODE_SUBJECT[schoolMode])) return;
    if (name === 'songs') renderSongs();
    if (name === 'school') renderSchool();
    if (name === 'games') renderGamePacks();
    if (name !== 'lesson') lessonStop();
    if (name !== 'dictation') dictStop();
    if (name !== 'prvouka') pvStop();
    if (name === 'cats') renderCats();
    if (name === 'shop') renderShop();
    if (name === 'cat') { $('#rename').classList.add('hidden'); renderCatDetail(); }
    if (name === 'menu') syncGame();
    show(name);
    // čas minutý: mimo učenia hneď naskočí limit
    if (store.timeLeft <= 0 && !OPEN_WHEN_OUT.includes(name)) openLimit();
    if (name === 'menu') renderStats();
    showNextReward();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    audio.init();
    audio.blip();
    if (b.dataset.go === 'shop' && b.dataset.model) shopModel = b.dataset.model;
    if (b.dataset.mode) schoolMode = b.dataset.mode; // Mačacia škola alebo Diktát
    go(b.dataset.go);
  });

  // ---------- Pesničky ----------
  const starStr = n => '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`;

  function renderSongs() {
    const list = $('#song-list');
    list.innerHTML = '';
    const songs = SONGS.slice().sort((a, b) => a.difficulty - b.difficulty);
    for (const s of songs) {
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
          <div class="diff" title="Obtiažnosť">${'●'.repeat(s.difficulty)}${'○'.repeat(4 - s.difficulty)}</div>
          <div class="stars">${starStr(best ? best.stars : 0)}</div>
          <div class="best">${best ? fmt(best.score) : '—'}</div>
        </div>`;
      el.querySelector('.song-title').textContent = s.title;
      el.querySelector('.song-credit').textContent = s.credit;
      el.addEventListener('click', () => startSong(s));
      list.append(el);
    }
    // upozornenie na hladné mačky
    const hungryCats = chosenCats().filter(c => hungerOf(c.id) < 25);
    const hungry = hungryCats.map(c => c.name);
    const hint = $('#songs-hint');
    hint.classList.toggle('hidden', !hungry.length);
    if (hungry.length) {
      const one = hungryCats[0];
      hint.textContent = hungry.length > 1
        ? `${hungry.join(' a ')} sú ${hungryCats.some(c => c.g === 'm') ? 'hladní' : 'hladné'} – za pesničku dostaneš menej bodov. Nakŕm ich v Mačkách.`
        : `${one.name} je ${gx(one, 'hladný', 'hladná', 'hladné')} – za pesničku dostaneš menej bodov. Nakŕm ${gx(one, 'ho', 'ju', 'ho')} v Mačkách.`;
    }
  }

  let current = null;
  function startSong(song) {
    if (!singersReady()) { queueReward({ kind: 'block' }); showNextReward(); return; }
    audio.init();
    current = song;
    syncGame();
    show(null);
    game.start(song, chosenCats(), false);
  }

  // ---------- Zoznam mačiek ----------
  let detailId = store.catL;

  function renderCats() {
    $('#cat-count').textContent = `${store.cats.length} / ${CATS.length}`;
    const grid = $('#cat-grid');
    if (!grid.childElementCount) {
      for (const cat of CATS) {
        const b = document.createElement('button');
        b.className = 'cat-card';
        b.dataset.id = cat.id;
        b.innerHTML = '<canvas></canvas><span class="cat-name"></span><span class="hslot"></span><span class="badge"></span>';
        b.querySelector('.cat-name').textContent = cat.name;
        b.addEventListener('click', () => { audio.init(); audio.blip(); detailId = cat.id; go('cat'); });
        grid.append(b);
      }
    }
    updateCatUI();
  }

  function updateCatUI() {
    const [l, r] = chosenCats();
    $$('.slot').forEach(el => {
      const cat = Number(el.dataset.slot) === 0 ? l : r;
      el.querySelector('.slot-name').textContent = cat.name;
      el.querySelector('.hslot').innerHTML = hungerBar(hungerOf(cat.id));
      paintCat(el.querySelector('canvas'), cat, 76, outfitOf(cat.id), 'full', { noBed: true });
    });
    $$('#cat-grid .cat-card').forEach(el => {
      const id = el.dataset.id;
      const cat = catById(id);
      el.querySelector('.cat-name').textContent = cat.name;
      const locked = !ownsCat(id);
      el.classList.toggle('locked', locked);
      const tags = [];
      if (!locked && id === l.id) tags.push('Ľ');
      if (!locked && id === r.id) tags.push('P');
      el.querySelector('.badge').textContent = locked ? '🔒' : isSick(id) ? '🤒' : tags.join(' ');
      el.classList.toggle('sel', tags.length > 0);
      el.querySelector('.hslot').innerHTML = locked ? `<span class="lock-price">${price(catPrice(cat))}</span>` : hungerBar(hungerOf(id));
      paintCat(el.querySelector('canvas'), cat, 84, outfitOf(id), 'full', { sad: !locked && hungerOf(id) < 25 });
    });
  }

  $$('.slot').forEach(el => {
    el.addEventListener('click', () => {
      audio.init();
      audio.blip();
      detailId = Number(el.dataset.slot) === 0 ? store.catL : store.catR;
      go('cat');
    });
  });

  // ---------- Detail mačky: kŕmenie a šatník ----------
  let catTab = 'feed';
  const stage = { chew: 0, food: null, foodT: 0, hearts: [], t: 0, last: 0, raf: 0 };

  function renderCatDetail() {
    const cat = catById(detailId);
    $('#cat-title').textContent = cat.name;
    const locked = !ownsCat(cat.id);
    const sickNow = !locked && isSick(cat.id);
    for (const sel of ['#cat-hunger', '.assign', '#cat-tabs', '#cat-panel']) $(sel).classList.toggle('hidden', locked || sickNow);
    $('#btn-rename').classList.toggle('hidden', locked);
    $('#cat-buy').classList.toggle('hidden', !locked);
    $('#cat-sick').classList.toggle('hidden', !sickNow);
    if (sickNow) { renderSickDetail(cat); return; }
    if (locked) {
      const p = catPrice(cat);
      $('#cat-buy-text').innerHTML = `🔒 <b></b> je ${gx(cat, 'zamknutý', 'zamknutá', 'zamknuté')} – ${catTier(p)}. Kúp si ${gx(cat, 'ho', 'ju', 'ho')} a môže s tebou spievať, učiť sa aj nosiť oblečenie.`;
      $('#cat-buy-text b').textContent = cat.name;
      const b = $('#btn-buy-cat');
      b.innerHTML = `Kúpiť za ${price(p)}`;
      b.classList.toggle('poor', store.coins < p);
      return;
    }
    updateDetailStatus();
    $$('#cat-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === catTab));
    const panel = $('#cat-panel');
    panel.innerHTML = '';
    if (catTab === 'feed') renderFeed(cat, panel); else renderWardrobe(cat, panel);
  }

  function updateDetailStatus() {
    const cat = catById(detailId);
    const v = hungerOf(cat.id);
    const m = moodOf(v);
    const fat = fatOf(cat.id);
    const wt = weightOf(fat);
    $('#cat-hunger').innerHTML = `
      <div class="hrow"><span>Sýtosť</span><b class="${m.cls}">${Math.round(v)} % · ${m.label}</b></div>
      ${hungerBar(v)}
      <div class="hnote">${m.bonus > 0 ? `Najedená mačka spieva lepšie: +${Math.round(m.bonus * 100)} % bodov` :
        m.bonus < 0 ? `Hladná mačka spieva slabšie: −${Math.round(-m.bonus * 100)} % bodov` : 'Nakŕm ju nad 60 % a získaš bonus k bodom'}</div>
      <div class="hrow w"><span>Váha</span><b class="${wt.cls}">${wt.label}</b></div>
      <div class="hbar fat"><i style="width:${Math.max(3, Math.round(fat))}%"></i></div>
      <div class="hnote">${fat >= 60 ? `Prejedená mačka sa ťažko hýbe a dá −${Math.round(-wt.bonus * 100)} % bodov. Schudne len pohybom v hre – bude to trvať viac pesničiek.` :
        fat >= 25 ? 'Je ťažšia a pomalšia. Čím viac sa v pesničkách hýbe, tým rýchlejšie schudne.' : 'Keď ju prekŕmiš (nad 100 % sýtosti), rýchlo priberie.'}</div>
      <div class="hrow w"><span>IQ</span><b class="iq">${iqOf(cat.id)} / ${IQ_MAX} · ${iqLabel(iqOf(cat.id))}</b></div>
      <div class="iqbar"><i style="width:${Math.max(2, iqOf(cat.id) / IQ_MAX * 100)}%"></i></div>
      <div class="hnote">IQ stúpa za správne odpovede v Mačacej škole.</div>`;
    const bl = $('#btn-set-l'), br = $('#btn-set-r');
    bl.classList.toggle('on', store.catL === cat.id);
    br.classList.toggle('on', store.catR === cat.id);
    bl.textContent = store.catL === cat.id ? '✓ Spieva vľavo' : 'Spievaj vľavo';
    br.textContent = store.catR === cat.id ? '✓ Spieva vpravo' : 'Spievaj vpravo';
  }

  function unlockCat(id) {
    if (ownsCat(id)) return;
    store.cats.push(id);
    store.hunger[id] = { v: HUNGER_START, t: Date.now() };
    delete store.fat[id];
    save();
  }
  $('#btn-buy-cat').addEventListener('click', () => {
    audio.init();
    const cat = catById(detailId);
    const p = catPrice(cat);
    if (ownsCat(cat.id)) return;
    if (store.coins < p) {
      toast(`Chýba ti ${fmt(p - store.coins)} bodov – zahraj sa alebo sa uč!`);
      audio.miss(audio.ui);
      return;
    }
    store.coins -= p;
    unlockCat(cat.id);
    updateWallets();
    toast(`${cat.name} je teraz ${gx(cat, 'tvoj', 'tvoja', 'tvoje')}! 🎉`);
    audio.preview(cat.voice, 79);
    stage.chew = 0.6;
    renderCatDetail();
  });

  function assign(side) {
    const id = detailId;
    if (!ownsCat(id) || isSick(id)) return;
    const key = side === 0 ? 'catL' : 'catR';
    const other = side === 0 ? 'catR' : 'catL';
    if (store[other] === id) store[other] = store[key]; // vymeniť mačky
    store[key] = id;
    save();
    syncGame();
    audio.preview(catById(id).voice, side === 0 ? 72 : 76);
    stage.chew = 0.35;
    updateDetailStatus();
  }
  $('#btn-set-l').addEventListener('click', () => { audio.init(); assign(0); });
  $('#btn-set-r').addEventListener('click', () => { audio.init(); assign(1); });
  $$('#cat-tabs button').forEach(b => b.addEventListener('click', () => {
    audio.init(); audio.blip(); catTab = b.dataset.tab; renderCatDetail();
  }));

  // premenovanie mačky
  function setName(id, raw) {
    const cat = catById(id);
    const name = String(raw).replace(/\s+/g, ' ').trim().slice(0, 16) || cat.baseName;
    cat.name = name;
    if (name === cat.baseName) delete store.names[id]; else store.names[id] = name;
    save();
    return name;
  }
  $('#btn-rename').addEventListener('click', () => {
    audio.init(); audio.blip();
    const f = $('#rename');
    f.classList.toggle('hidden');
    if (!f.classList.contains('hidden')) {
      const i = $('#rename-input');
      i.value = catById(detailId).name;
      i.focus();
      i.select();
    }
  });
  $('#rename').addEventListener('submit', e => {
    e.preventDefault();
    const cat = catById(detailId);
    const old = cat.name;
    const name = setName(cat.id, $('#rename-input').value);
    $('#rename-input').blur();
    $('#rename').classList.add('hidden');
    renderCatDetail();
    if (name !== old) {
      toast(`${old} sa teraz volá ${name}`);
      audio.preview(cat.voice, 76);
      stage.chew = 0.4;
    }
  });
  $('#rename-reset').addEventListener('click', () => {
    audio.blip();
    const i = $('#rename-input');
    i.value = catById(detailId).baseName;
    i.focus();
  });

  function emptyBox(text, btnText, model) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.innerHTML = `<p></p><button class="btn small primary" data-go="shop">${btnText}</button>`;
    d.querySelector('p').textContent = text;
    if (model) d.querySelector('button').dataset.model = model;
    return d;
  }

  function renderFeed(cat, panel) {
    const foods = FOODS.filter(f => f.kind !== 'med' && (store.pantry[f.id] || 0) > 0);
    if (!foods.length) {
      panel.append(emptyBox('Špajza je prázdna. Jedlo kúpiš v obchode za body z pesničiek.', '🛒 Kúpiť jedlo'));
      shopTab = 'food';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'food-grid';
    for (const f of foods) {
      const b = document.createElement('button');
      b.className = 'food-card';
      b.innerHTML = `<canvas></canvas><span class="fc-name"></span><span class="fc-sub">+${f.fill} % · máš ${store.pantry[f.id]}</span>`;
      b.querySelector('.fc-name').textContent = f.name;
      paintFood(b.querySelector('canvas'), f, 54);
      b.addEventListener('click', () => feed(cat, f));
      grid.append(b);
    }
    panel.append(grid);
    const more = document.createElement('button');
    more.className = 'btn small soft more';
    more.dataset.go = 'shop';
    more.textContent = '🛒 Kúpiť ďalšie jedlo';
    panel.append(more);
    shopTab = 'food';
  }

  let overfeedAsk = { id: null, t: 0 };
  function feed(cat, food) {
    audio.init();
    const v = hungerOf(cat.id);
    // plná mačka: prvé ťuknutie len upozorní, druhé ju prekŕmi
    if (v >= 95 && (overfeedAsk.id !== cat.id || Date.now() - overfeedAsk.t > 4000)) {
      overfeedAsk = { id: cat.id, t: Date.now() };
      toast(`${cat.name} je ${gx(cat, 'plný', 'plná', 'plné')}. Ťukni znova a priberie 🐷`);
      return;
    }
    store.pantry[food.id]--;
    if (!store.pantry[food.id]) delete store.pantry[food.id];
    const extra = Math.max(0, v + food.fill - 100);
    setHunger(cat.id, v + food.fill);
    if (extra > 0) {
      const before = weightOf(fatOf(cat.id)).cls;
      setFat(cat.id, fatOf(cat.id) + extra * FAT_GAIN);
      const after = weightOf(fatOf(cat.id));
      if (after.cls !== before) toast(`${cat.name} ${gx(cat, 'pribral', 'pribrala', 'pribralo')}! 🐷`);
      else toast(`${cat.name} je ${gx(cat, 'prejedený', 'prejedená', 'prejedené')} a priberá…`);
    }
    save();
    syncGame();
    stage.food = food; stage.foodT = 0; stage.chew = 0;
    setTimeout(() => audio.preview(cat.voice, 79), 450);
    renderCatDetail();
  }

  function renderWardrobe(cat, panel) {
    const own = store.outfits[cat.id] || {};
    let any = false;
    for (const slot of SLOTS) {
      const keys = Object.keys(store.owned).filter(k => { const v = parseVariant(k); return v && v.item.slot === slot.id; });
      if (!keys.length) continue;
      any = true;
      const sec = document.createElement('div');
      sec.className = 'ward-sec';
      sec.innerHTML = `<h3>${slot.icon} ${slot.name}</h3><div class="chips"></div>`;
      const chips = sec.querySelector('.chips');
      const none = document.createElement('button');
      none.className = 'chip none' + (own[slot.id] ? '' : ' on');
      none.innerHTML = '<span>✕</span><small>nič</small>';
      none.addEventListener('click', () => { audio.blip(); equip(cat.id, slot.id, null); renderCatDetail(); });
      chips.append(none);
      for (const k of keys) {
        const v = parseVariant(k);
        const b = document.createElement('button');
        b.className = 'chip' + (own[slot.id] === k ? ' on' : '');
        b.title = `${v.item.name} – ${COLORS[v.c][0]}`;
        b.innerHTML = '<canvas></canvas>';
        paintCat(b.querySelector('canvas'), cat, 52, { [slot.id]: v }, slot.id);
        b.addEventListener('click', () => {
          audio.blip();
          equip(cat.id, slot.id, own[slot.id] === k ? null : k);
          stage.chew = 0.3;
          renderCatDetail();
        });
        chips.append(b);
      }
      panel.append(sec);
    }
    if (!any) {
      panel.append(emptyBox('Zatiaľ nemáš žiadne oblečenie. Kúp ho v obchode a potom tu mačku obleč.', '🛒 Do obchodu', cat.id));
      return;
    }
    const more = document.createElement('button');
    more.className = 'btn small soft more';
    more.dataset.go = 'shop';
    more.dataset.model = cat.id;
    more.textContent = '🛒 Kúpiť ďalšie oblečenie';
    panel.append(more);
  }

  // animovaná mačka hore v detaile
  function startStage() {
    if (stage.raf) return;
    stage.last = performance.now();
    const loop = ts => {
      if (screen !== 'cat') { stage.raf = 0; return; }
      const dt = Math.min(0.05, (ts - stage.last) / 1000);
      stage.last = ts;
      drawStage(dt);
      stage.raf = requestAnimationFrame(loop);
    };
    stage.raf = requestAnimationFrame(loop);
  }

  function drawStage(dt) {
    const cv = $('#cat-stage');
    const r = cv.getBoundingClientRect();
    if (r.width < 2) return;
    const w = r.width, h = r.height, d = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w, h);
    stage.t += dt;
    const cat = catById(detailId);
    const size = Math.min(h * 0.6, w * 0.42);
    const cx = w / 2, by = h * 0.86;
    const mouthY = by - size * 0.47;

    // jedlo letí do pusy
    if (stage.food) {
      stage.foodT += dt;
      const p = Math.min(1, stage.foodT / 0.45);
      const fx = cx + (w * 0.3) * (1 - p), fy = mouthY - size * 0.6 * Math.sin(p * Math.PI) + (1 - p) * -size * 0.2;
      g.globalAlpha = 1 - Math.max(0, p - 0.85) / 0.15;
      drawFood(g, stage.food, fx, fy, size * 0.2 * (1 - p * 0.5));
      g.globalAlpha = 1;
      if (p >= 1) {
        stage.food = null; stage.chew = 1.3;
        for (let i = 0; i < 6; i++) stage.hearts.push({ x: cx + (Math.random() - 0.5) * size * 0.6, y: mouthY - size * 0.3, vy: -40 - Math.random() * 40, life: 1.4 });
      }
    }
    stage.chew = Math.max(0, stage.chew - dt);
    const chewing = stage.chew > 0;
    const hungry = hungerOf(cat.id) < 25;
    drawCat(g, cat, cx, by, size, {
      t: stage.t,
      outfit: outfitOf(cat.id),
      fat: fatOf(cat.id),
      mouth: chewing ? 0.35 + 0.35 * Math.sin(stage.t * 20) : 0,
      blink: !chewing && (stage.t % 3.2) < 0.12,
      sad: hungry && !chewing,
      sick: isSick(cat.id),
      look: Math.sin(stage.t * 0.8) * 0.5,
    });
    for (const p of stage.hearts) {
      p.life -= dt; p.y += p.vy * dt;
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      heartPath(g, p.x, p.y, size * 0.06);
      g.fillStyle = '#ff5f9e'; g.fill();
    }
    g.globalAlpha = 1;
    stage.hearts = stage.hearts.filter(p => p.life > 0);
  }

  // ---------- Obchod ----------
  let shopTab = 'food';
  let shopModel = store.catL;
  const shopSel = {}; // vybraná farba pri každej veci

  function renderShop() {
    updateWallets();
    const tabs = $('#shop-tabs');
    tabs.innerHTML = '';
    for (const t of [{ id: 'food', name: 'Jedlo', icon: '🍗' }, { id: 'cats', name: 'Mačičky', icon: '🐱' }, ...SLOTS]) {
      const b = document.createElement('button');
      b.className = 'tab' + (shopTab === t.id ? ' active' : '');
      b.innerHTML = `<span>${t.icon}</span>${t.name}`;
      b.addEventListener('click', () => { audio.blip(); shopTab = t.id; renderShop(); $('#shop-list').scrollTop = 0; });
      tabs.append(b);
    }
    const active = tabs.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const isFood = shopTab === 'food' || shopTab === 'cats';
    if (!ownsCat(shopModel)) shopModel = store.catL;
    $('#shop-model').classList.toggle('hidden', isFood);
    if (!isFood) {
      const m = catById(shopModel);
      $('#model-name').textContent = m.name;
      paintCat($('#model-cv'), m, 40, outfitOf(m.id), 'head', { noBed: true });
    }
    const list = $('#shop-list');
    list.innerHTML = '';
    if (shopTab === 'cats') renderCatShop(list);
    else if (isFood) renderFoodShop(list);
    else renderItemShop(list, shopTab);
  }

  function renderCatShop(list) {
    const locked = CATS.filter(c => !ownsCat(c.id));
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = locked.length
      ? 'Kúp si ďalšie mačičky. Potom s tebou môžu spievať, učiť sa a nosiť oblečenie.'
      : 'Máš všetky mačičky! 🎉';
    list.append(p);
    for (const cat of locked) {
      const cost = catPrice(cat);
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML = '<canvas></canvas><div class="sc-main"><div class="sc-name"></div><div class="sc-sub"></div></div>';
      card.querySelector('.sc-name').textContent = cat.name;
      card.querySelector('.sc-sub').textContent = catTier(cost);
      paintCat(card.querySelector('canvas'), cat, 64, outfitOf(cat.id), 'full', { noBed: true });
      card.append(buyButton(cost, () => {
        unlockCat(cat.id);
        toast(`${cat.name} je teraz ${gx(cat, 'tvoj', 'tvoja', 'tvoje')}! 🎉`);
        audio.preview(cat.voice, 79);
        renderShop();
      }));
      list.append(card);
    }
  }

  function cycleModel(dir) {
    const own = ownedCats();
    const i = Math.max(0, own.findIndex(c => c.id === shopModel));
    shopModel = own[(i + dir + own.length) % own.length].id;
    audio.blip();
    renderShop();
  }
  $('#model-prev').addEventListener('click', () => cycleModel(-1));
  $('#model-next').addEventListener('click', () => cycleModel(1));

  function buyButton(cost, onBuy) {
    const b = document.createElement('button');
    b.className = 'buy' + (store.coins < cost ? ' poor' : '');
    b.innerHTML = price(cost);
    b.addEventListener('click', () => {
      audio.init();
      if (store.coins < cost) {
        toast(`Chýba ti ${fmt(cost - store.coins)} bodov – zahraj si pesničku!`);
        audio.miss(audio.ui);
        return;
      }
      store.coins -= cost;
      onBuy();
      save();
      audio.preview(catById(shopModel).voice, 81);
      updateWallets();
    });
    return b;
  }

  function renderFoodShop(list) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Kúpené jedlo sa uloží do špajze. Mačky nakŕmiš v Mačkách.';
    list.append(p);
    for (const grp of FOOD_GROUPS) {
      const h = document.createElement('h3');
      h.className = 'shop-h';
      h.textContent = grp.name;
      if (grp.id) h.id = 'shop-' + grp.id;
      list.append(h);
      for (const f of FOODS.filter(x => grp.kinds.includes(x.kind))) {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = `<canvas></canvas><div class="sc-main"><div class="sc-name"></div><div class="sc-sub">${f.kind === 'med' ? '' : `+${f.fill} % sýtosti · `}v špajzi: <b>${store.pantry[f.id] || 0}</b></div></div>`;
        card.querySelector('.sc-name').textContent = f.name;
        paintFood(card.querySelector('canvas'), f, 64);
        card.append(buyButton(f.price, () => {
          store.pantry[f.id] = (store.pantry[f.id] || 0) + 1;
          toast(`${f.name} je v špajzi`);
          card.querySelector('.sc-sub b').textContent = store.pantry[f.id];
          refreshPoor();
        }));
        list.append(card);
      }
    }
  }

  function refreshPoor() {
    $$('#shop-list .buy').forEach(b => {
      const n = Number(b.textContent.replace(/\D/g, ''));
      b.classList.toggle('poor', store.coins < n);
    });
  }

  function renderItemShop(list, slot) {
    const model = catById(shopModel);
    for (const item of ITEMS.filter(it => it.slot === slot)) {
      const card = document.createElement('div');
      card.className = 'shop-card item';
      list.append(card);
      const draw = () => {
        const worn = (store.outfits[model.id] || {})[slot];
        if (!shopSel[item.id]) {
          const wv = parseVariant(worn);
          shopSel[item.id] = wv && wv.item.id === item.id ? wv.c : item.colors[0];
        }
        const c = shopSel[item.id];
        const key = variantKey(item.id, c);
        const owned = !!store.owned[key];
        const ownedCount = item.colors.filter(cc => store.owned[variantKey(item.id, cc)]).length;
        card.innerHTML = `<canvas></canvas><div class="sc-main">
          <div class="sc-name"></div>
          <div class="sc-sub"><span class="sc-color"></span> · máš ${ownedCount}/${item.colors.length} farieb</div>
          <div class="swatches"></div><div class="sc-act"></div></div>`;
        card.querySelector('.sc-name').textContent = item.name;
        card.querySelector('.sc-color').textContent = COLORS[c][0];
        paintCat(card.querySelector('canvas'), model, 76, Object.assign({}, outfitOf(model.id), { [slot]: { item, c } }), slot);
        const sw = card.querySelector('.swatches');
        for (const cc of item.colors) {
          const s = document.createElement('button');
          s.className = 'sw' + (cc === c ? ' on' : '') + (store.owned[variantKey(item.id, cc)] ? ' owned' : '');
          s.style.background = cc === 'rainbow' ? 'linear-gradient(90deg,#ff8a8a,#ffc36b,#fff176,#8be08b,#7cc6ff,#b49bff)' :
            cc === 'gold' ? 'linear-gradient(135deg,#fff3b0,#f2c230 50%,#c8961a)' :
            cc === 'silver' ? 'linear-gradient(135deg,#ffffff,#c9ccd6 50%,#8e93a3)' : hexOf(cc);
          s.title = COLORS[cc][0];
          s.setAttribute('aria-label', COLORS[cc][0]);
          s.addEventListener('click', () => { audio.blip(); shopSel[item.id] = cc; draw(); });
          sw.append(s);
        }
        const act = card.querySelector('.sc-act');
        if (owned) {
          const on = worn === key;
          const b = document.createElement('button');
          b.className = 'buy ' + (on ? 'worn' : 'wear');
          b.textContent = on ? `✓ Má to ${model.name} – vyzliecť` : `Obliecť na ${model.name}`;
          b.addEventListener('click', () => { audio.blip(); equip(model.id, slot, on ? null : key); renderShop(); });
          act.append(b);
        } else {
          act.append(buyButton(itemPrice(item, c), () => {
            store.owned[key] = 1;
            equip(model.id, slot, key);
            toast(`${item.name} (${COLORS[c][0].toLowerCase()}) – oblečené na ${model.name}`);
            renderShop();
          }));
        }
      };
      draw();
    }
  }

  // ---------- Pauza ----------
  function doPause() { if (game.pause()) show('pause'); }
  function doResume() { show(null); game.resume(); }

  $('#btn-pause').addEventListener('click', doPause);
  game.onPauseKey = () => {
    if (limitOpen) return;
    if (game.mode === 'play') doPause();
    else if (game.mode === 'paused') doResume();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) doPause();
    else { checkForUpdate(); syncGame(); }
  });

  $('#btn-resume').addEventListener('click', doResume);
  $('#btn-restart').addEventListener('click', () => { game.quit(); startSong(current); });
  $('#btn-quit').addEventListener('click', () => { game.quit(); go('menu'); });

  // ---------- Limit: 10 minút zapnutej aplikácie, potom úloha ----------
  // Úloha = 4 príklady (sčítanie/odčítanie do 20) a potom 1× nastaviť ručičkové hodiny.
  // Všetkých 5 musí byť správne, inak prídu nové úlohy.
  const LIMIT_MIN = 10;
  const QUIZ_LEN = 4;
  const CLOCK_LEN = 1;
  const TASK_TOTAL = QUIZ_LEN + CLOCK_LEN;
  if (typeof store.timeLeft !== 'number' || !isFinite(store.timeLeft)) store.timeLeft = LIMIT_MIN * 60;
  store.timeLeft = Math.min(store.timeLeft, LIMIT_MIN * 60);
  let limitOpen = false;
  let task = null;      // 'combo' = príklady + hodiny
  let quiz = null;      // stav príkladov
  let clk = null;       // stav hodín
  const rand = n => Math.floor(Math.random() * n);
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /*
   * PRAVIDLO VÝBERU ÚLOH (platí aj pre úlohy, ktoré pribudnú v budúcnosti):
   *  - úlohy sa striedajú (vyberie sa tá, ktorá bola najdlhšie nepoužitá),
   *  - ak v niektorých robí chyby a v iných nie, dávajú sa len tie, v ktorých robí chyby,
   *  - úloha, ktorú ešte poriadne neskúšal (menej ako 5 odpovedí), sa berie ako úloha s chybami.
   * Do štatistiky sa počíta posledných SKILL_WINDOW odpovedí z limitu aj z Mačacej školy.
   * Novú úlohu stačí pridať do TASK_TYPES a pri odpovediach volať recordSkill(typ, správne).
   */
  const TASK_TYPES = ['math', 'clock'];
  const SKILL_WINDOW = 10;
  function skillOf(t) {
    const s = store.skills[t];
    if (s && Array.isArray(s.log)) return s;
    return (store.skills[t] = { log: [], last: 0 });
  }
  function recordSkill(t, ok) {
    const s = skillOf(t);
    s.log.push(ok ? 1 : 0);
    if (s.log.length > SKILL_WINDOW) s.log.splice(0, s.log.length - SKILL_WINDOW);
  }
  const hasMistakes = t => { const l = skillOf(t).log; return l.length < 5 || l.includes(0); };
  function pickTask() {
    const weak = TASK_TYPES.filter(hasMistakes);
    const pool = weak.length ? weak : TASK_TYPES;
    return pool.slice().sort((a, b) => skillOf(a).last - skillOf(b).last)[0];
  }

  function updateTimePill() {
    const el = $('#time-left');
    el.textContent = '⏱ ' + fmtTime(Math.max(0, store.timeLeft));
    el.classList.toggle('low', store.timeLeft <= 60);
  }

  // Čas beží, keď je aplikácia zapnutá a na obrazovke (menu, Mačací zbor, obchod, mačky…).
  // Pri učení (Mačacia škola, Diktát – aj výber mačičky) sa čas neodpočítava a limit sa nezapne.
  const LEARN_SCREENS = ['welcome', 'school', 'lesson', 'dictation', 'prvouka'];
  // keď je čas minutý, dá sa ísť len na výber hry a do učenia
  const OPEN_WHEN_OUT = ['games', ...LEARN_SCREENS];
  let tickN = 0;
  setInterval(() => {
    if (document.hidden || limitOpen) return;
    if (store.timeLeft > 0 && !LEARN_SCREENS.includes(screen)) {
      store.timeLeft = Math.max(0, store.timeLeft - 1);
      updateTimePill();
      if (++tickN % 5 === 0) save();
    }
    if (store.timeLeft <= 0 && !OPEN_WHEN_OUT.includes(screen)) openLimit();
  }, 1000);

  function limitCard(name) {
    for (const n of ['wall', 'quiz', 'clock', 'done']) $('#limit-' + n).classList.toggle('hidden', n !== name);
  }

  function openLimit() {
    if (limitOpen) return;
    limitOpen = true;
    if (game.mode === 'play') doPause(); // pesnička počká, po splnení úloh pokračuje
    if (window.speechSynthesis) window.speechSynthesis.cancel(); // diktát stíchne
    task = 'combo';
    delete store.limitTask;
    save();
    $('#limit-min').textContent = LIMIT_MIN;
    $('#limit-text').textContent = `Aplikácia bola zapnutá ${LIMIT_MIN} minút. Splň úlohu a dostaneš ďalších ${LIMIT_MIN} minút.`;
    $('#limit-task').textContent = `Úloha: ➕ ${QUIZ_LEN} príklady na sčítanie a odčítanie a 🕐 ${CLOCK_LEN}× hodiny`;
    limitCard('wall');
    $('#limit').classList.remove('hidden');
  }

  function startTask() {
    startQuiz(); // najprv príklady, po nich hodiny
  }
  // spoločné bodky pre všetkých 5 úloh (4 príklady + hodiny)
  const comboOk = q => (q.ans != null ? q.ans === q.res : !!q.ok);
  function comboDots(cur) {
    const items = [...(quiz ? quiz.probs : []), ...(clk ? clk.probs : Array.from({ length: CLOCK_LEN }, () => ({ done: false })))];
    return dots(items, cur, comboOk);
  }

  const dots = (items, cur, isOk) => items.map((q, i) =>
    `<i class="${q.done ? (isOk(q) ? 'ok' : 'bad') : i === cur ? 'cur' : ''}"></i>`).join('');

  // ===== Príklady =====
  /** 4 príklady: 2× sčítanie a 2× odčítanie do 20 (výsledok 1–20). */
  function makeProblems() {
    const ops = ['+', '+', '−', '−'].sort(() => Math.random() - 0.5);
    const seen = new Set();
    return ops.map(op => {
      let a, b, key;
      do {
        if (op === '+') { a = 1 + rand(19); b = 1 + rand(20 - a); } // a + b ≤ 20
        else { a = 2 + rand(19); b = 1 + rand(a - 1); }             // a − b ≥ 1
        key = a + op + b;
      } while (seen.has(key));
      seen.add(key);
      return { a, b, op, res: op === '+' ? a + b : a - b, ans: null, done: false };
    });
  }

  function startQuiz() {
    quiz = { probs: makeProblems(), i: 0, input: '', busy: false, results: null };
    clk = null;
    limitCard('quiz');
    renderQuiz();
  }

  function renderQuiz(state) {
    const p = quiz.probs[quiz.i];
    $('#quiz-dots').innerHTML = comboDots(quiz.i);
    $('#quiz-label').textContent = `Úloha ${quiz.i + 1} z ${TASK_TOTAL} · príklad`;
    const q = $('#quiz-q');
    q.className = 'quiz-q' + (state ? ' ' + state : '');
    q.innerHTML = `${p.a} ${p.op} ${p.b} = <span class="ans">${quiz.input || '?'}</span>`;
  }

  // klávesnica s veľkými tlačidlami (lepšie pre deti a iPhone ako systémová)
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
  for (const k of KEYS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k === 'OK' ? '✓' : k;
    if (k === 'OK') b.className = 'ok-key';
    b.setAttribute('aria-label', k === '⌫' ? 'Zmazať' : k === 'OK' ? 'Potvrdiť' : k);
    b.addEventListener('click', () => quizKey(k));
    $('#keypad').append(b);
  }
  window.addEventListener('keydown', e => {
    if (!limitOpen || !quiz || $('#limit-quiz').classList.contains('hidden')) return;
    if (/^[0-9]$/.test(e.key)) quizKey(e.key);
    else if (e.key === 'Backspace') quizKey('⌫');
    else if (e.key === 'Enter') quizKey('OK');
    else return;
    e.preventDefault();
  });

  function quizKey(k) {
    if (!quiz || quiz.busy) return;
    audio.init();
    if (k === '⌫') { quiz.input = quiz.input.slice(0, -1); audio.blip(); renderQuiz(); return; }
    if (k !== 'OK') {
      if (quiz.input.length >= 2) return;
      quiz.input = quiz.input === '0' ? k : quiz.input + k;
      audio.blip();
      renderQuiz();
      return;
    }
    if (!quiz.input) return;
    const p = quiz.probs[quiz.i];
    p.ans = Number(quiz.input);
    p.done = true;
    const ok = p.ans === p.res;
    recordSkill('math', ok);
    feedbackSound(ok);
    quiz.busy = true;
    renderQuiz(ok ? 'ok' : 'bad');
    setTimeout(() => {
      quiz.busy = false;
      quiz.i++;
      quiz.input = '';
      if (quiz.i < QUIZ_LEN) renderQuiz();
      else {
        quiz.results = quiz.probs.map(p => ({
          ok: p.ans === p.res,
          text: p.ans === p.res ? `${p.a} ${p.op} ${p.b} = ${p.res} ✓` : `${p.a} ${p.op} ${p.b} = ${p.ans} ✗  (správne je ${p.res})`,
        }));
        startClock(); // po príkladoch prídu hodiny
      }
    }, 700);
  }

  function feedbackSound(ok) {
    if (ok) audio.preview(chosenCats()[0].voice, 79); else audio.miss(audio.ui);
  }

  // ===== Ručičkové hodiny =====
  // Ručičky sa nastavujú každá zvlášť – veľká (minúty) neťahá malú (hodiny).
  //  - veľká ručička: po 5 minútach (mn = 0..55),
  //  - malá ručička: hp = 0..143, jeden krok = 1/12 hodiny (2,5°).
  // Správne je: veľká na minútach a malá PRESNE NA ČÍSLE pri celej hodine,
  // inak MEDZI hodinou a ďalšou hodinou (napr. 11:55 = medzi 11 a 12, nie na 12).
  const clockCv = $('#clock-cv');
  const TAU = Math.PI * 2;
  const HP_STEPS = 144;
  const fmtHM = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
  const onDial = (h, m) => (h % 12) * 60 + m;
  /** Ručičky na kreslenie: malá ručička je zreteľne medzi číslami (posun 0,8 namiesto celej hodiny). */
  const handsFor = (h, m) => ({ hp: ((h % 12) + (m / 60) * 0.8) * 12, mn: m });

  function clockOk(hp, mn, h, m) {
    if (mn !== m) return false;
    const rel = (((hp - (h % 12) * 12) % HP_STEPS) + HP_STEPS) % HP_STEPS;
    if (m === 0) return rel <= 2 || rel >= HP_STEPS - 2; // na čísle (malá tolerancia pre prst)
    return rel >= 1 && rel <= 11;                        // medzi hodinou a ďalšou hodinou
  }
  /** Slovný popis, kde je malá ručička: „na 7“ alebo „medzi 7 a 8“. */
  function hourHandText(hp) {
    const k = hp / 12, n = Math.round(k);
    const num = x => ((x % 12) + 12) % 12 || 12;
    if (Math.abs(k - n) * 12 <= 2) return `na ${num(n)}`;
    return `medzi ${num(Math.floor(k))} a ${num(Math.floor(k) + 1)}`;
  }

  /** Časy na hodiny: hodiny 1–23 (aj popoludní, napr. 20:30), minúty po 5. */
  function makeClockProbs() {
    const seen = new Set(), out = [];
    while (out.length < CLOCK_LEN) {
      const h = 1 + rand(23), m = rand(12) * 5;
      if (seen.has(onDial(h, m))) continue;
      seen.add(onDial(h, m));
      out.push({ h, m, set: null, done: false });
    }
    return out;
  }

  function startClock() {
    clk = { probs: makeClockProbs(), i: 0, hp: 0, mn: 0, drag: null, busy: false, ghost: null };
    limitCard('clock');
    nextClock();
  }

  function nextClock() {
    const p = clk.probs[clk.i];
    // ručičky začínajú na náhodnom čase, nie na správnom
    do { clk.hp = rand(HP_STEPS); clk.mn = rand(12) * 5; } while (clockOk(clk.hp, clk.mn, p.h, p.m));
    clk.ghost = null;
    renderClock();
  }

  function renderClock(state) {
    const p = clk.probs[clk.i];
    $('#clock-dots').innerHTML = comboDots(QUIZ_LEN + clk.i);
    $('#clock-label').textContent = `Úloha ${QUIZ_LEN + clk.i + 1} z ${TASK_TOTAL} · hodiny`;
    const t = $('#clock-target');
    t.textContent = fmtHM(p.h, p.m);
    t.className = 'clock-target' + (state ? ' ' + state : '');
    drawClock();
  }

  // Mačičkovské hodiny: ciferník je mačacia hlava s ušami, fúzmi, labkami, chvostom a nosíkom v strede.
  const CAT_FUR = '#f4a24c', CAT_DARK = '#c9772a', CAT_LINE = '#6b3d1a', CAT_EAR = '#ffb3c7';
  let clockGeo = { cx: 0, cy: 0, R: 1 };

  function drawClock() {
    const size = Math.round(Math.max(200, Math.min(290, window.innerWidth - 90, window.innerHeight * 0.42)));
    clockGeo = paintCatClock(clockCv, size, { hp: clk.hp, mn: clk.mn }, clk.ghost);
  }

  /** Nakreslí mačičkovské hodiny s ručičkami hands = { hp, mn }, ghost = správne ručičky ako zelený tieň. */
  function paintCatClock(cv, size, hands, ghost) {
    const g = prepCanvas(cv, size, size);
    const R = size * 0.37, cx = size / 2, cy = size * 0.53;
    g.lineJoin = 'round'; g.lineCap = 'round';

    // chvost (vpravo dole, za hlavou)
    g.beginPath();
    g.moveTo(cx + R * 0.55, cy + R * 0.8);
    g.bezierCurveTo(cx + R * 1.45, cy + R * 1.05, cx + R * 1.5, cy + R * 0.1, cx + R * 1.22, cy - R * 0.15);
    g.lineWidth = R * 0.2; g.strokeStyle = CAT_LINE; g.stroke();
    g.lineWidth = R * 0.13; g.strokeStyle = CAT_FUR; g.stroke();

    // uši
    for (const s of [-1, 1]) {
      const ear = (k, col) => {
        g.beginPath();
        g.moveTo(cx + s * R * 0.35 * k + s * R * (1 - k) * 0.55, cy - R * (0.78 + (1 - k) * 0.12));
        g.lineTo(cx + s * R * 0.78, cy - R * (0.6 + 0.62 * k));
        g.lineTo(cx + s * R * (0.98 - (1 - k) * 0.1), cy - R * (0.3 + (1 - k) * 0.2));
        g.closePath();
        g.fillStyle = col; g.fill();
        if (k === 1) { g.lineWidth = 4; g.strokeStyle = CAT_LINE; g.stroke(); }
      };
      ear(1, CAT_FUR);
      ear(0.55, CAT_EAR);
    }

    // labky dole
    for (const s of [-1, 1]) {
      const px = cx + s * R * 0.45, py = cy + R * 0.98;
      g.beginPath(); g.ellipse(px, py, R * 0.24, R * 0.15, 0, 0, TAU);
      g.fillStyle = CAT_FUR; g.fill(); g.lineWidth = 3; g.strokeStyle = CAT_LINE; g.stroke();
      g.fillStyle = CAT_EAR;
      for (const t of [-1, 0, 1]) { g.beginPath(); g.arc(px + t * R * 0.09, py + R * 0.03, R * 0.035, 0, TAU); g.fill(); }
    }

    // hlava = ciferník
    g.beginPath(); g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = '#fffaf2'; g.fill();
    g.lineWidth = R * 0.07; g.strokeStyle = CAT_FUR; g.stroke();
    g.beginPath(); g.arc(cx, cy, R + R * 0.035, 0, TAU);
    g.lineWidth = 3; g.strokeStyle = CAT_LINE; g.stroke();
    // pásiky na čele (ako tigrovaná mačka)
    g.strokeStyle = CAT_DARK; g.lineWidth = R * 0.045;
    for (const s of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(cx + s * R * 0.16, cy - R * 1.03);
      g.lineTo(cx + s * R * 0.13, cy - R * 0.93);
      g.stroke();
    }

    // fúzy (mimo ciferníka, aby nezakrývali čísla)
    g.strokeStyle = CAT_LINE; g.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      for (const k of [-1, 0, 1]) {
        g.beginPath();
        g.moveTo(cx + s * R * 1.06, cy + R * 0.12 + k * R * 0.11);
        g.lineTo(cx + s * R * 1.32, cy + R * 0.06 + k * R * 0.2);
        g.stroke();
      }
    }

    // čiarky (minúty) a čísla
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU, big = i % 5 === 0;
      const r1 = R * 0.93, r2 = R * (big ? 0.82 : 0.87);
      g.beginPath();
      g.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
      g.lineTo(cx + Math.sin(a) * r2, cy - Math.cos(a) * r2);
      g.lineWidth = big ? 3 : 1.4;
      g.strokeStyle = big ? '#2b1d3a' : '#d8c9b8';
      g.stroke();
    }
    g.fillStyle = '#2b1d3a';
    g.font = `700 ${Math.round(R * 0.25)}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * TAU, r = R * 0.66;
      g.fillText(String(n), cx + Math.sin(a) * r, cy - Math.cos(a) * r + 1);
    }

    // správne ručičky (po chybe) ako priesvitný zelený tieň
    if (ghost != null) drawHands(g, cx, cy, R, ghost, 'rgba(46,158,69,0.55)', 'rgba(46,158,69,0.55)');
    drawHands(g, cx, cy, R, hands, '#ff5f9e', '#7d6bd6');

    // os ručičiek = ružový mačací nosík
    const nr = R * 0.1;
    g.beginPath();
    g.moveTo(cx - nr, cy - nr * 0.55);
    g.quadraticCurveTo(cx, cy - nr * 0.95, cx + nr, cy - nr * 0.55);
    g.quadraticCurveTo(cx + nr * 0.2, cy + nr * 0.9, cx, cy + nr * 0.8);
    g.quadraticCurveTo(cx - nr * 0.2, cy + nr * 0.9, cx - nr, cy - nr * 0.55);
    g.closePath();
    g.fillStyle = '#ff7aa8'; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = CAT_LINE; g.stroke();
    return { cx, cy, R };
  }

  function drawHands(g, cx, cy, R, hands, hourCol, minCol) {
    const ha = (hands.hp / HP_STEPS) * TAU, ma = (hands.mn / 60) * TAU;
    // ručička so šípkou na konci
    const hand = (a, len, w, col) => {
      const sx = Math.sin(a), sy = -Math.cos(a);   // smer ručičky
      const px = -sy, py = sx;                     // kolmica
      const head = w * 2.6, half = w * 1.5;        // dĺžka a polovičná šírka šípky
      const bx = cx + sx * (len - head), by = cy + sy * (len - head);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(bx, by);
      g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = col; g.stroke();
      g.beginPath();
      g.moveTo(cx + sx * len, cy + sy * len);
      g.lineTo(bx + px * half, by + py * half);
      g.lineTo(bx - px * half, by - py * half);
      g.closePath();
      g.lineJoin = 'round'; g.lineWidth = w * 0.4; g.fillStyle = col; g.fill(); g.stroke();
    };
    hand(ma, R * 0.8, R * 0.055, minCol);  // minútová: dlhá, fialová
    hand(ha, R * 0.5, R * 0.085, hourCol); // hodinová: krátka, ružová
  }

  function setHands(hp, mn) {
    hp = ((hp % HP_STEPS) + HP_STEPS) % HP_STEPS;
    if (hp === clk.hp && mn === clk.mn) return;
    if (mn !== clk.mn || Math.abs(hp - clk.hp) >= 2) audio.blip();
    clk.hp = hp;
    clk.mn = mn;
    drawClock();
  }

  // ťahanie ručičiek: chytí sa tá, ktorá je bližšie k prstu
  function clockPtr(e) {
    const r = clockCv.getBoundingClientRect();
    const x = e.clientX - r.left - clockGeo.cx, y = e.clientY - r.top - clockGeo.cy;
    let a = Math.atan2(x, -y);
    if (a < 0) a += TAU;
    return { a, d: Math.hypot(x, y) / clockGeo.R };
  }
  const angDist = (a, b) => { const d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); };

  function dragClock(p) {
    if (clk.drag === 'm') setHands(clk.hp, (Math.round((p.a / TAU) * 12) % 12) * 5); // len veľká ručička
    else setHands(Math.round((p.a / TAU) * HP_STEPS), clk.mn);                        // len malá ručička
  }

  clockCv.addEventListener('pointerdown', e => {
    if (!clk || clk.busy) return;
    audio.init();
    const p = clockPtr(e);
    const dh = angDist(p.a, (clk.hp / HP_STEPS) * TAU), dm = angDist(p.a, (clk.mn / 60) * TAU);
    clk.drag = Math.abs(dh - dm) < 0.35 ? (p.d < 0.62 ? 'h' : 'm') : dh < dm ? 'h' : 'm';
    try { clockCv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    dragClock(p);
    e.preventDefault();
  });
  clockCv.addEventListener('pointermove', e => { if (clk && clk.drag && !clk.busy) dragClock(clockPtr(e)); });
  const endDrag = () => { if (clk) clk.drag = null; };
  clockCv.addEventListener('pointerup', endDrag);
  clockCv.addEventListener('pointercancel', endDrag);

  $('#btn-clock-ok').addEventListener('click', () => {
    if (!clk || clk.busy) return;
    audio.init();
    const p = clk.probs[clk.i];
    p.set = { hp: clk.hp, mn: clk.mn };
    p.done = true;
    const ok = clockOk(clk.hp, clk.mn, p.h, p.m);
    p.ok = ok;
    recordSkill('clock', ok);
    feedbackSound(ok);
    clk.busy = true;
    if (!ok) clk.ghost = handsFor(p.h, p.m); // ukáž, kde mali byť ručičky
    renderClock(ok ? 'ok' : 'bad');
    setTimeout(() => {
      clk.busy = false;
      clk.i++;
      if (clk.i < CLOCK_LEN) nextClock();
      else finishTask([...((quiz && quiz.results) || []), ...clk.probs.map(q => {
        if (q.ok) return { ok: true, text: `🕐 ${fmtHM(q.h, q.m)} ✓` };
        const why = [];
        if (q.set.mn !== q.m) why.push(`veľká ručička bola na ${q.set.mn / 5 || 12}, má byť na ${q.m / 5 || 12}`);
        const want = q.m === 0 ? `na ${q.h % 12 || 12}` : `medzi ${q.h % 12 || 12} a ${(q.h % 12) + 1}`;
        if (!clockOk(q.set.hp, q.m, q.h, q.m)) why.push(`malá ručička bola ${hourHandText(q.set.hp)}, má byť ${want}`);
        return { ok: false, text: `🕐 ${fmtHM(q.h, q.m)} ✗  (${why.join('; ')})` };
      })]);
    }, ok ? 700 : 1600);
  });

  // ===== Vyhodnotenie =====
  function finishTask(results) {
    const total = results.length;
    const good = results.filter(r => r.ok).length;
    const all = good === total;
    $('#done-icon').textContent = all ? '🎉' : '🙀';
    $('#done-title').textContent = all ? `Výborne! ${good} z ${total}` : `${good} z ${total} správne`;
    $('#done-text').textContent = all
      ? `Máš ďalších ${LIMIT_MIN} minút.`
      : `Treba mať všetkých ${TASK_TOTAL} úloh správne. Skús nové úlohy.`;
    const rev = $('#done-review');
    rev.innerHTML = '';
    if (!all) {
      for (const r of results) {
        const li = document.createElement('li');
        li.className = r.ok ? 'ok' : 'bad';
        li.textContent = r.text;
        rev.append(li);
      }
    }
    $('#btn-done').textContent = all ? '▶ Hrať ďalej' : 'Nové úlohy';
    $('#btn-done').dataset.ok = all ? '1' : '';
    limitCard('done');
    if (all) {
      store.timeLeft = LIMIT_MIN * 60;
      save();
      updateTimePill();
    }
  }

  $('#btn-add-limit').addEventListener('click', () => { audio.init(); audio.blip(); startTask(); });
  // učiť sa dá aj bez limitu – ostatné hry ostanú zamknuté, kým nesplní úlohu
  $('#btn-limit-learn').addEventListener('click', () => {
    audio.init();
    audio.blip();
    if (game.mode !== 'idle') game.quit();
    quiz = null;
    clk = null;
    limitOpen = false;
    $('#limit').classList.add('hidden');
    go('games');
  });
  $('#btn-done').addEventListener('click', () => {
    audio.blip();
    if (!$('#btn-done').dataset.ok) { startTask(); return; } // rovnaký typ úlohy znova
    quiz = null;
    clk = null;
    limitOpen = false;
    $('#limit').classList.add('hidden');
    showNextReward();
  });
  window.addEventListener('resize', () => { if (clk && !$('#limit-clock').classList.contains('hidden')) drawClock(); });

  updateTimePill();
  if (store.timeLeft <= 0) openLimit(); // zatvorenie a otvorenie aplikácie limit neobíde

  // ---------- Mačacia škola: 10 otázok, vždy 3 možnosti a len jedna správna ----------
  // Striedajú sa príklady (sčítanie/odčítanie do 20) a čítanie času z ručičkových hodín.
  // Za každú správnu odpoveď stúpne vybranej mačičke IQ (začína na 0, najviac 150).
  const IQ_MAX = 150;
  const LESSON_LEN = 10;
  const LESSON_COINS = 120;   // body na nákupy za každú správnu odpoveď
  const LESSON_PERFECT_COINS = 300; // navyše za 10 z 10
  // IQ za lekciu (dávame ho až na konci): 10/10 → +3, 8–9 → +2, 5–7 → +1, menej → 0
  const lessonIq = good => (good >= 10 ? 3 : good >= 8 ? 2 : good >= 5 ? 1 : 0);

  const iqOf = id => clampN(Math.round(store.iq[id] || 0), 0, IQ_MAX);
  function addIq(id, n) { store.iq[id] = clampN((store.iq[id] || 0) + n, 0, IQ_MAX); }
  function iqLabel(v) {
    if (v >= 150) return 'Génius';
    if (v >= 120) return 'Profesorka';
    if (v >= 90) return 'Múdra';
    if (v >= 60) return 'Šikovná';
    if (v >= 30) return 'Žiačka';
    return 'Mačiatko';
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let schoolMode = 'school'; // 'school' = Mačacia škola, 'dictation' = Diktát
  function renderSchool() {
    const dictMode = schoolMode === 'dictation';
    const pvMode = schoolMode === 'prvouka';
    $('#school-title').textContent = dictMode ? 'Diktát' : pvMode ? 'Prvouka' : 'Mačacia škola';
    $('#school-hint').textContent = dictMode
      ? 'S ktorou mačičkou chceš písať diktát? Za každú vetu bez chyby jej stúpne IQ (od 0 až do 150).'
      : pvMode
        ? 'S ktorou mačičkou sa chceš učiť prvouku? Za dobre doplnenú úlohu jej stúpne IQ (od 0 až do 150).'
        : 'S ktorou mačičkou sa chceš učiť? Za dobre zvládnutú lekciu jej stúpne IQ (od 0 až do 150).';
    const grid = $('#school-grid');
    grid.innerHTML = '';
    for (const cat of ownedCats()) {
      const b = document.createElement('button');
      b.className = 'cat-card iq-card';
      b.innerHTML = '<canvas></canvas><span class="cat-name"></span><span class="iq-txt"></span><span class="iqbar"><i></i></span>';
      b.querySelector('.cat-name').textContent = cat.name;
      const v = iqOf(cat.id);
      b.querySelector('.iq-txt').textContent = `IQ ${v}`;
      b.querySelector('.iqbar i').style.width = Math.max(2, (v / IQ_MAX) * 100) + '%';
      paintCat(b.querySelector('canvas'), cat, 84, outfitOf(cat.id), 'full');
      if (isSick(cat.id)) b.classList.add('sickcard');
      b.addEventListener('click', () => {
        audio.init();
        if (isSick(cat.id)) { audio.miss(audio.ui); toast('🤒'); return; }
        audio.blip();
        if (dictMode) startDictation(cat.id); else if (pvMode) startPrvouka(cat.id); else startLesson(cat.id);
      });
      grid.append(b);
    }
  }

  /** 3 možnosti: jedna správna + 2 rôzne nesprávne (najprv tie, ktoré sa ľahko pomýlia). */
  function pickWrong(primary, secondary, ok, keyOf) {
    const seen = new Set([keyOf(ok)]), out = [];
    for (const c of [...shuffle(primary), ...shuffle(secondary)]) {
      if (c == null || seen.has(keyOf(c))) continue;
      seen.add(keyOf(c));
      out.push(c);
      if (out.length === 2) break;
    }
    return out;
  }

  function mathQuestion(seen) {
    let q;
    do {
      const op = Math.random() < 0.5 ? '+' : '−';
      let a, b;
      if (op === '+') { a = 1 + rand(19); b = 1 + rand(20 - a); } else { a = 2 + rand(19); b = 1 + rand(a - 1); }
      q = { type: 'math', a, b, op, res: op === '+' ? a + b : a - b };
    } while (seen.has(q.a + q.op + q.b));
    seen.add(q.a + q.op + q.b);
    const inRange = v => (v >= 0 && v <= 20 ? v : null);
    const r = q.res;
    const wrong = pickWrong([r - 1, r + 1, r - 2, r + 2].map(inRange), [r - 3, r + 3, r - 10, r + 10, r - 4, r + 4].map(inRange), r, v => v);
    q.opts = shuffle([{ label: String(r), ok: true }, ...wrong.map(v => ({ label: String(v), ok: false }))]);
    return q;
  }

  function clockQuestion(seen) {
    let h, m;
    do { h = 1 + rand(12); m = rand(12) * 5; } while (seen.has(h * 60 + m));
    seen.add(h * 60 + m);
    const wrapH = x => ((((x - 1) % 12) + 12) % 12) + 1;
    const T = (hh, mm) => ({ h: hh, m: mm });
    const primary = [
      m !== 0 && m / 5 !== h ? T(m / 5, (h % 12) * 5) : null, // zamenené ručičky
      T(wrapH(h + 1), m),                                    // o hodinu viac
      T(wrapH(h - 1), m),                                    // o hodinu menej
    ];
    const secondary = [T(h, (m + 5) % 60), T(h, (m + 55) % 60), T(h, (m + 10) % 60), T(h, (m + 50) % 60), T(wrapH(h + 2), m)];
    const wrong = pickWrong(primary, secondary, T(h, m), t => t.h * 60 + t.m);
    return {
      type: 'clock', h, m,
      opts: shuffle([{ label: fmtHM(h, m), ok: true }, ...wrong.map(t => ({ label: fmtHM(t.h, t.m), ok: false }))]),
    };
  }

  let lesson = null;
  let lessonCatId = null;

  function startLesson(catId) {
    if (!canLearn('school')) { if (screen === 'lesson') go('games'); return; }
    lessonStop();
    lessonCatId = catId;
    const seenM = new Set(), seenC = new Set();
    const qs = [];
    for (let i = 0; i < LESSON_LEN; i++) qs.push(i % 2 === 0 ? mathQuestion(seenM) : clockQuestion(seenC));
    lesson = { catId, qs, i: 0, good: 0, busy: false, mood: null, moodT: 0, t: 0, startIq: iqOf(catId), done: false, raf: 0 };
    $('#lesson-card').classList.remove('hidden');
    $('#lesson-end').classList.add('hidden');
    show('lesson');
    updateLessonCat();
    renderLessonQ();
    lessonLoop();
  }

  function lessonStop() {
    if (lesson && lesson.raf) cancelAnimationFrame(lesson.raf);
    lesson = null;
  }

  function updateLessonCat() {
    const cat = catById(lessonCatId);
    const v = iqOf(cat.id);
    $('#lesson-name').textContent = cat.name;
    $('#lesson-iq').textContent = `IQ ${v} / ${IQ_MAX} · ${iqLabel(v)}`;
    $('#lesson-iqbar').style.width = Math.max(2, (v / IQ_MAX) * 100) + '%';
  }

  function renderLessonQ() {
    const q = lesson.qs[lesson.i];
    $('#lesson-progress').textContent = `${lesson.i + 1} / ${LESSON_LEN}`;
    const cv = $('#lesson-clock');
    if (q.type === 'math') {
      $('#lesson-ask').textContent = 'Koľko je?';
      $('#lesson-q').textContent = `${q.a} ${q.op} ${q.b} = ?`;
      cv.classList.add('hidden');
    } else {
      $('#lesson-ask').textContent = 'Koľko je hodín?';
      $('#lesson-q').textContent = '';
      cv.classList.remove('hidden');
      const size = Math.round(Math.max(180, Math.min(250, window.innerWidth - 110, window.innerHeight * 0.32)));
      paintCatClock(cv, size, handsFor(q.h, q.m), null);
    }
    const opts = $('#lesson-options');
    opts.innerHTML = '';
    opts.classList.toggle('time', q.type === 'clock');
    q.opts.forEach((o, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.addEventListener('click', () => answerLesson(idx));
      opts.append(b);
    });
    const card = $('#lesson-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }

  function popIq(text) {
    const el = $('#iq-plus');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function answerLesson(idx) {
    if (!lesson || lesson.busy || lesson.done) return;
    audio.init();
    const q = lesson.qs[lesson.i];
    const ok = q.opts[idx].ok;
    lesson.busy = true;
    recordSkill(q.type, ok); // aj škola sa počíta do pravidla výberu úloh v limite
    [...$('#lesson-options').children].forEach((b, i) => {
      b.disabled = true;
      if (q.opts[i].ok) b.classList.add('ok');
      else if (i === idx) b.classList.add('bad');
    });
    const cat = catById(lesson.catId);
    if (ok) {
      lesson.good++;
      audio.preview(cat.voice, 79);
      lesson.mood = 'happy';
    } else {
      audio.miss(audio.ui);
      lesson.mood = 'sad';
    }
    lesson.moodT = 0;
    save();
    updateLessonCat();
    const cur = lesson;
    setTimeout(() => {
      if (lesson !== cur) return;
      lesson.busy = false;
      lesson.i++;
      if (lesson.i < LESSON_LEN) renderLessonQ(); else endLesson();
    }, ok ? 900 : 1700);
  }

  function endLesson() {
    const cat = catById(lesson.catId);
    const good = lesson.good;
    lesson.done = true;
    const perfect = good === LESSON_LEN;
    const reward = lessonIq(good);
    const before = iqOf(cat.id);
    addIq(cat.id, reward);
    if (iqOf(cat.id) > before) popIq(`+${iqOf(cat.id) - before} IQ`);
    const coins = good * LESSON_COINS + (perfect ? LESSON_PERFECT_COINS : 0);
    store.coins += coins;
    save();
    $('#end-icon').textContent = perfect ? '🏆' : good >= 7 ? '🎉' : good >= 5 ? '🙂' : '🙀';
    $('#end-title').textContent = `${good} z ${LESSON_LEN} správne`;
    const stars = $('#end-stars');
    stars.innerHTML = '';
    const n = good >= 9 ? 3 : good >= 7 ? 2 : good >= 5 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i < n) { s.className = 'on'; s.style.animationDelay = `${0.15 + i * 0.18}s`; }
      stars.append(s);
    }
    const now = iqOf(cat.id);
    $('#end-iq').textContent = reward
      ? `${cat.name}: IQ ${lesson.startIq} → ${now}` + (now >= IQ_MAX ? ' · Génius! 🎓' : '')
      : `${cat.name} tentoraz IQ nedostane – treba aspoň 5 správnych.`;
    if (reward >= 1) learnDone('school'); // úspešné učenie sa počíta do odmien
    $('#end-earn').innerHTML = `<div class="earn">+${price(coins)}</div><small>na nákupy</small>`;
    $('#lesson-progress').textContent = 'Hotovo';
    $('#lesson-card').classList.add('hidden');
    $('#lesson-end').classList.remove('hidden');
    lesson.mood = good >= 5 ? 'happy' : 'sad';
    lesson.moodT = -1.5;
    updateLessonCat();
    updateWallets();
    if (good >= 5) audio.preview(cat.voice, 84);
  }

  // malá animovaná mačička, ktorá sa raduje alebo smúti
  function lessonLoop() {
    let last = performance.now();
    const step = ts => {
      if (!lesson || screen !== 'lesson') return;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      lesson.t += dt;
      lesson.moodT += dt;
      const cat = catById(lesson.catId);
      const active = lesson.mood && lesson.moodT < 0.8;
      paintCat($('#lesson-cat'), cat, 96, outfitOf(cat.id), 'full', {
        t: lesson.t,
        mouth: active && lesson.mood === 'happy' ? 0.45 + 0.3 * Math.sin(lesson.t * 18) : 0,
        sad: active && lesson.mood === 'sad',
        blink: (lesson.t % 3.4) < 0.12,
        look: Math.sin(lesson.t * 0.9) * 0.5,
        noBed: true,
      });
      lesson.raf = requestAnimationFrame(step);
    };
    lesson.raf = requestAnimationFrame(step);
  }

  $('#btn-lesson-again').addEventListener('click', () => { audio.init(); audio.blip(); startLesson(lessonCatId); });

  // ---------- Diktát: jedna hra = jedna veta z 5 slov, na konci sa opraví ----------
  const DICT_IQ = 2;           // IQ za vetu bez chyby
  const DICT_MISTAKE_IQ = 1;   // za každú chybu sa odráta 1 IQ (najmenej na 0)
  const DICT_COINS = 500;      // body na nákupy za vetu bez chyby
  const DICT_RATE = 0.62;      // pomalé diktovanie
  const DICT_REPEATS = 2;      // koľkokrát za sebou sa veta prečíta, potom sa dá pustiť znova

  const speech = window.speechSynthesis || null;
  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  let skVoice = null, voicesLoaded = false;
  function pickVoice() {
    if (!speech) return;
    let vs = [];
    try { vs = speech.getVoices() || []; } catch (e) { /* ignore */ }
    if (vs.length) voicesLoaded = true;
    // Android ho môže mať ako „sk_SK“, „sk-SK“ alebo len „sk“; prednosť má hlas priamo v zariadení
    const sk = vs.filter(v => /^sk([-_]|$)/i.test(v.lang || '') || /sloven(č|c)ina|slovak/i.test(v.name || ''));
    skVoice = sk.find(v => v.localService) || sk[0] || null;
    if (dict) renderDictWarn();
  }

  let dict = null;
  let dictCatId = null;
  if (speech) {
    pickVoice();
    if (speech.addEventListener) speech.addEventListener('voiceschanged', pickVoice);
    else speech.onvoiceschanged = pickVoice;
    // niektoré Androidy pošlú zoznam hlasov až neskôr a bez udalosti
    [300, 1000, 2500].forEach(ms => setTimeout(pickVoice, ms));
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** Vyberie jednu vetu, ktorá nebola nedávno (otázky aj oznamovacie vety sa striedajú náhodne). */
  function pickSentence() {
    const recent = Array.isArray(store.dictRecent) ? store.dictRecent : [];
    const all = DICTATION_SENTENCES.map((t, i) => i);
    const fresh = all.filter(i => !recent.includes(i));
    const i = (fresh.length ? fresh : all)[rand((fresh.length ? fresh : all).length)];
    store.dictRecent = [...recent, i].slice(-40);
    return { text: DICTATION_SENTENCES[i], typed: null, ok: null };
  }

  function startDictation(catId) {
    if (!canLearn('dict')) { if (screen === 'dictation') go('games'); return; }
    dictStop();
    dictCatId = catId;
    dict = { catId, items: [pickSentence()], i: 0, startIq: iqOf(catId), speaking: false, pass: 0, token: 0,
      checked: false, mood: null, moodT: 0, t: 0, raf: 0, shift: false };
    save();
    show('dictation');
    updateDictCat();
    renderDictItem();
    dictLoop();
    dictate(); // spustené ťuknutím → prehliadač dovolí hovoriť
  }

  function dictStop() {
    if (dict && dict.raf) cancelAnimationFrame(dict.raf);
    if (speech) speech.cancel();
    dict = null;
  }

  function updateDictCat() {
    const cat = catById(dictCatId);
    const v = iqOf(cat.id);
    $('#dict-name').textContent = cat.name;
    $('#dict-iq').textContent = `IQ ${v} / ${IQ_MAX} · ${iqLabel(v)}`;
    $('#dict-iqbar').style.width = Math.max(2, (v / IQ_MAX) * 100) + '%';
  }

  function renderDictItem() {
    $('#dict-progress').textContent = '5 slov';
    const inp = $('#dict-input');
    inp.value = '';
    inp.disabled = false;
    $('#btn-dict-check').classList.remove('hidden');
    $('#dict-keys').classList.remove('hidden');
    $('#btn-dict-play').classList.remove('hidden');
    $('#dict-result').classList.add('hidden');
    dict.checked = false;
    updatePlay();
    renderDictWarn();
  }

  function renderDictWarn() {
    const warn = $('#dict-warn');
    let msg = '';
    if (!speech) msg = 'Tento prehliadač nevie čítať nahlas. Skús Chrome (Android) alebo Safari (iPhone).';
    else if (voicesLoaded && !skVoice) {
      msg = IS_ANDROID
        ? 'Chýba slovenský hlas. V Androide: Nastavenia → Systém → Jazyky → Prevod textu na reč → Google → Nainštalovať hlasové údaje → Slovenčina.'
        : /iPhone|iPad|Mac/i.test(navigator.userAgent)
          ? 'Chýba slovenský hlas. Nastavenia → Prístupnosť → Hovorený obsah → Hlasy → Slovenčina.'
          : 'Na tomto zariadení chýba slovenský hlas, diktát môže znieť zvláštne.';
    }
    warn.textContent = msg;
    warn.classList.toggle('hidden', !msg);
  }

  function updatePlay() {
    const b = $('#btn-dict-play');
    if (!dict) return;
    b.disabled = dict.speaking;
    b.textContent = dict.speaking ? `🔊 Diktujem… (${dict.pass}/${DICT_REPEATS})` : '▶ Prehrať vetu znova';
  }

  // odkaz na práve čítanú vetu – Chrome na Androide ju inak môže zahodiť a nikdy nezavolá onend
  let curUtter = null;

  /** Prečíta jednu vetu nahlas; vráti sa, keď dočíta (alebo po bezpečnom čase, ak telefón nezavolá onend). */
  function sayOnce(text) {
    return new Promise(res => {
      if (!speech) { setTimeout(res, 400); return; }
      if (!skVoice) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = skVoice && skVoice.lang ? skVoice.lang.replace('_', '-') : 'sk-SK';
      if (skVoice) u.voice = skVoice;
      u.rate = DICT_RATE;
      u.pitch = 1.05;
      u.volume = 1;
      let done = false;
      const fin = () => { if (!done) { done = true; clearTimeout(tm); curUtter = null; res(); } };
      const tm = setTimeout(fin, 3000 + text.length * 170);
      u.onend = fin;
      u.onerror = fin;
      curUtter = u;
      try { if (speech.paused) speech.resume(); } catch (e) { /* ignore */ }
      speech.speak(u);
    });
  }

  /** Nadiktuje vetu pomaly 2× za sebou, potom sa dá znova pustiť tlačidlom. */
  async function dictate() {
    if (!dict || dict.speaking || dict.checked) return;
    const token = ++dict.token;
    const d = dict;
    d.speaking = true;
    if (speech && (speech.speaking || speech.pending)) {
      speech.cancel();
      await sleep(250); // Android: hneď po cancel() by novú vetu zahodil
      if (dict !== d || d.token !== token) return;
    }
    for (let k = 1; k <= DICT_REPEATS; k++) {
      if (limitOpen) break; // vypršal čas – diktovanie skončí, po úlohách sa dá pustiť znova
      d.pass = k;
      updatePlay();
      d.mood = 'talk'; d.moodT = 0;
      await sayOnce(d.items[d.i].text);
      if (dict !== d || d.token !== token) return;
      d.mood = null;
      if (k < DICT_REPEATS) await sleep(1500);
      if (dict !== d || d.token !== token) return;
    }
    d.speaking = false;
    updatePlay();
  }

  $('#btn-dict-play').addEventListener('click', () => { audio.init(); dictate(); });

  // ----- tlačidlá s dĺžňami a mäkčeňmi (nie každá klávesnica ich má poruke) -----
  const DICT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ý', 'ä', 'ô', 'č', 'š', 'ž', 'ť', 'ď', 'ň', 'ľ', 'ĺ', 'ŕ', '?', '.'];
  function renderDictKeys() {
    const box = $('#dict-keys');
    box.innerHTML = '';
    const sh = document.createElement('button');
    sh.type = 'button';
    sh.className = 'dk shift' + (dict && dict.shift ? ' on' : '');
    sh.textContent = '⇧';
    sh.setAttribute('aria-label', 'Veľké písmeno');
    box.append(sh);
    for (const ch of DICT_CHARS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk';
      b.dataset.ch = ch;
      b.textContent = dict && dict.shift ? ch.toUpperCase() : ch;
      box.append(b);
    }
  }
  renderDictKeys();
  function insertAtCaret(inp, text) {
    const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, a) + text + inp.value.slice(b);
    inp.selectionStart = inp.selectionEnd = a + text.length;
  }
  function dictKey(btn) {
    if (!dict || dict.checked) return;
    const inp = $('#dict-input');
    if (btn.classList.contains('shift')) { dict.shift = !dict.shift; renderDictKeys(); inp.focus(); return; }
    insertAtCaret(inp, dict.shift ? btn.dataset.ch.toUpperCase() : btn.dataset.ch);
    if (dict.shift) { dict.shift = false; renderDictKeys(); }
    inp.focus();
  }
  // preventDefault, aby sa na iPhone nezatvorila klávesnica
  const keysBox = $('#dict-keys');
  keysBox.addEventListener('touchstart', e => { const b = e.target.closest('.dk'); if (!b) return; e.preventDefault(); dictKey(b); }, { passive: false });
  keysBox.addEventListener('mousedown', e => { const b = e.target.closest('.dk'); if (!b) return; e.preventDefault(); dictKey(b); });

  // ----- kontrola a oprava chýb -----
  const normSpaces = t => t.normalize('NFC').replace(/\s+/g, ' ').trim();
  const stripMarks = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** Čo je zle v jednom slove (pre deti zrozumiteľne). */
  function wordHint(typed, right) {
    const end = w => (/[.?!,]$/.test(w) ? w.slice(-1) : '');
    const core = w => w.replace(/[.?!,]+$/, '');
    const tips = [];
    const tc = core(typed), rc = core(right);
    if (end(typed) !== end(right)) tips.push(end(right) === '?' ? 'na konci otáznik' : end(right) === '.' ? 'na konci bodka' : 'bez znamienka');
    if (tc !== rc) {
      if (tc.toLowerCase() === rc.toLowerCase()) tips.push(rc[0] !== rc[0].toLowerCase() ? 'veľké písmeno' : 'malé písmeno');
      else if (stripMarks(tc).toLowerCase() === stripMarks(rc).toLowerCase()) {
        const marks = new Set(), have = rc.normalize('NFD'), got = tc.normalize('NFD');
        const count = (s, m) => (s.match(new RegExp(m, 'g')) || []).length;
        if (count(have, '́') !== count(got, '́')) marks.add('dĺžeň');
        if (count(have, '̌') !== count(got, '̌')) marks.add('mäkčeň');
        if (count(have, '̂') !== count(got, '̂')) marks.add('vokáň (ô)');
        if (count(have, '̈') !== count(got, '̈')) marks.add('dve bodky (ä)');
        if (tc.toLowerCase() !== tc && rc.toLowerCase() === rc) marks.add('malé písmeno');
        if (tc[0] && rc[0] && (tc[0] === tc[0].toLowerCase()) !== (rc[0] === rc[0].toLowerCase())) marks.add(rc[0] === rc[0].toLowerCase() ? 'malé písmeno' : 'veľké písmeno');
        tips.push(...(marks.size ? marks : ['diakritika']));
      } else tips.push('pravopis');
    }
    return tips.join(', ');
  }

  /** Porovná slová (najdlhšia spoločná postupnosť) a vráti zoznam krokov: ok / zlé / navyše / chýba. */
  function diffWords(typed, right) {
    const a = typed, b = right, n = a.length, m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ops = [];
    let i = 0, j = 0, extra = [], miss = [];
    const flush = () => {
      while (extra.length && miss.length) ops.push({ k: 'bad', t: extra.shift(), r: miss.shift() });
      for (const t of extra) ops.push({ k: 'extra', t });
      for (const r of miss) ops.push({ k: 'miss', r });
      extra = []; miss = [];
    };
    while (i < n && j < m) {
      if (a[i] === b[j]) { flush(); ops.push({ k: 'ok', t: a[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) extra.push(a[i++]);
      else miss.push(b[j++]);
    }
    while (i < n) extra.push(a[i++]);
    while (j < m) miss.push(b[j++]);
    flush();
    return ops;
  }

  function popDict(text) {
    const el = $('#dict-plus');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function checkDict() {
    if (!dict || dict.checked) return;
    const inp = $('#dict-input');
    const typed = normSpaces(inp.value);
    if (!typed) { inp.focus(); toast('Najprv napíš vetu 🙂'); return; }
    audio.init();
    const item = dict.items[dict.i];
    const right = normSpaces(item.text);
    item.typed = typed;
    item.ok = typed === right;
    dict.checked = true;
    dict.token++;
    dict.speaking = false;
    if (speech) speech.cancel();
    inp.disabled = true;
    inp.blur();
    $('#btn-dict-check').classList.add('hidden');
    $('#dict-keys').classList.add('hidden');
    $('#btn-dict-play').classList.add('hidden');
    const cat = catById(dict.catId);
    const verdict = $('#dict-verdict');
    const diff = $('#dict-diff');
    diff.innerHTML = '';
    if (item.ok) {
      const before = iqOf(cat.id);
      addIq(cat.id, DICT_IQ);
      const gained = iqOf(cat.id) - before;
      if (gained > 0) popDict(`+${gained} IQ`);
      learnDone('dict'); // úspešné učenie sa počíta do odmien
      verdict.className = 'dict-verdict ok';
      verdict.textContent = `Bez chyby! 🎉${gained > 0 ? ` ${cat.name} má +${gained} IQ.` : ''}`;
      audio.preview(cat.voice, 79);
      dict.mood = 'happy';
      const s = document.createElement('span');
      s.className = 'dw ok';
      s.textContent = right;
      diff.append(s);
      $('#dict-right').classList.add('hidden');
    } else {
      const ops = diffWords(typed.split(' '), right.split(' '));
      const nBad = ops.filter(o => o.k !== 'ok').length;
      // za každú chybu −1 IQ, najmenej 0 (do mínusu nejde)
      const before = iqOf(cat.id);
      addIq(cat.id, -nBad * DICT_MISTAKE_IQ);
      dict.lost = before - iqOf(cat.id);
      if (dict.lost > 0) popDict(`−${dict.lost} IQ`);
      verdict.className = 'dict-verdict bad';
      verdict.textContent = `Sú tam chyby (${nBad}). Pozri sa, čo treba opraviť:`;
      for (const o of ops) {
        const w = document.createElement('span');
        if (o.k === 'ok') { w.className = 'dw ok'; w.textContent = o.t; }
        else if (o.k === 'bad') {
          w.className = 'dw bad';
          w.innerHTML = '<s></s> <b></b><small></small>';
          w.querySelector('s').textContent = o.t;
          w.querySelector('b').textContent = o.r;
          w.querySelector('small').textContent = wordHint(o.t, o.r);
        } else if (o.k === 'extra') {
          w.className = 'dw bad';
          w.innerHTML = '<s></s><small>navyše</small>';
          w.querySelector('s').textContent = o.t;
        } else {
          w.className = 'dw miss';
          w.innerHTML = '<b></b><small>chýba</small>';
          w.querySelector('b').textContent = o.r;
        }
        diff.append(w);
      }
      const r = $('#dict-right');
      r.innerHTML = '<span>Správne:</span> <b></b>';
      r.querySelector('b').textContent = right;
      r.classList.remove('hidden');
      audio.miss(audio.ui);
      dict.mood = 'sad';
    }
    dict.moodT = 0;
    // vyhodnotenie: IQ a body len za vetu bez chyby
    const coins = item.ok ? DICT_COINS : 0;
    store.coins += coins;
    save();
    updateDictCat();
    updateWallets();
    const now = iqOf(cat.id);
    $('#dict-iqline').textContent = item.ok
      ? `${cat.name}: IQ ${dict.startIq} → ${now}${now >= IQ_MAX ? ' · Génius! 🎓' : ''}`
      : dict.lost > 0
        ? `${cat.name}: IQ ${dict.startIq} → ${now} (za každú chybu −1)`
        : `${cat.name} má IQ 0, nižšie už neklesne. Skús ďalšiu vetu!`;
    $('#dict-earn').innerHTML = coins ? `<div class="earn">+${price(coins)}</div><small>na nákupy</small>` : '';
    $('#dict-progress').textContent = item.ok ? 'Bez chyby' : 'Oprava';
    $('#dict-result').classList.remove('hidden');
  }

  $('#btn-dict-check').addEventListener('click', checkDict);
  $('#dict-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkDict(); } });
  $('#btn-dict-again').addEventListener('click', () => { audio.init(); audio.blip(); startDictation(dictCatId); });

  // mačička pri diktovaní „hovorí“, pri správnej vete sa raduje, pri chybe smúti
  function dictLoop() {
    let last = performance.now();
    const step = ts => {
      if (!dict || screen !== 'dictation') return;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      dict.t += dt;
      dict.moodT += dt;
      const cat = catById(dict.catId);
      const talk = dict.mood === 'talk';
      const active = talk || (dict.mood && dict.moodT < 0.9);
      paintCat($('#dict-cat'), cat, 96, outfitOf(cat.id), 'full', {
        t: dict.t,
        mouth: talk ? 0.25 + 0.25 * Math.abs(Math.sin(dict.t * 9)) : active && dict.mood === 'happy' ? 0.45 + 0.3 * Math.sin(dict.t * 18) : 0,
        sad: active && dict.mood === 'sad',
        blink: (dict.t % 3.4) < 0.12,
        look: Math.sin(dict.t * 0.9) * 0.5,
        noBed: true,
      });
      dict.raf = requestAnimationFrame(step);
    };
    dict.raf = requestAnimationFrame(step);
  }

  // ---------- Prvouka: doplňovačky (presúvanie slov do medzier) ----------
  // IQ za úlohu: všetko správne → +2, aspoň polovica → +1, menej → 0
  const pvIq = (good, total) => (good === total ? 2 : good * 2 >= total ? 1 : 0);
  const PV_COINS = 120;   // body na nákupy za každé správne slovo
  const PV_ALL_COINS = 200; // navyše, keď je všetko správne
  const VEHICLE_ICONS = { vlak: '🚆', autobus: '🚌', bicykel: '🚲', auto: '🚗', 'loď': '🛳️', lietadlo: '✈️' };

  let pv = null;
  let pvCatId = null;

  function pickExercise() {
    const recent = Array.isArray(store.pvRecent) ? store.pvRecent : [];
    const all = PRVOUKA.map((e, i) => i);
    const fresh = all.filter(i => !recent.includes(i));
    const pool = fresh.length ? fresh : all.filter(i => i !== recent[recent.length - 1]);
    const i = pool[rand(pool.length)];
    store.pvRecent = [...recent, i].slice(-6);
    return PRVOUKA[i];
  }

  function startPrvouka(catId) {
    if (!canLearn('pv')) { if (screen === 'prvouka') go('games'); return; }
    pvStop();
    pvCatId = catId;
    const ex = pickExercise();
    // presne toľko slov, koľko je medzier – žiadne slová navyše
    const slots = ex.type === 'text'
      ? ex.items.flatMap(s => [...s.matchAll(/\{([^}]+)\}/g)].map(m => m[1]))
      : ex.answers.slice();
    const words = shuffle(slots.slice()).map((text, id) => ({ id, text }));
    pv = {
      catId, ex, slots, words, place: slots.map(() => null), sel: null, checked: false,
      order: ex.type === 'vehicles' ? shuffle(slots.map((s, k) => k)) : null,
      startIq: iqOf(catId), mood: null, moodT: 0, t: 0, raf: 0,
    };
    save();
    show('prvouka');
    $('#pv-scroll').scrollTop = 0;
    $('#pv-title').textContent = `${ex.icon} ${ex.title}`;
    $('#pv-ask').textContent = ex.type === 'text'
      ? 'Chyť slovo a presuň ho do správnej medzery.'
      : 'Chyť slovo a presuň ho k správnemu obrázku.';
    $('#pv-progress').textContent = `${slots.length} slov`;
    $('#pv-result').classList.add('hidden');
    $('#btn-pv-check').classList.remove('hidden');
    $('#pv-bank').classList.remove('hidden');
    buildPvBody();
    pvRender();
    updatePvCat();
    pvLoop();
  }

  function pvStop() {
    if (pv && pv.raf) cancelAnimationFrame(pv.raf);
    pvDragEnd();
    pv = null;
  }

  function updatePvCat() {
    const cat = catById(pvCatId);
    const v = iqOf(cat.id);
    $('#pv-name').textContent = cat.name;
    $('#pv-iq').textContent = `IQ ${v} / ${IQ_MAX} · ${iqLabel(v)}`;
    $('#pv-iqbar').style.width = Math.max(2, (v / IQ_MAX) * 100) + '%';
  }

  const gapEl = k => { const g = document.createElement('span'); g.className = 'gap'; g.dataset.slot = k; return g; };

  /** Vlastná jednoduchá kresba kostry (SVG) – miesta na popisky sú vľavo a vpravo. */
  function skeletonSVG() {
    const B = '#f4e9cf', O = '#9c8156';
    const bone = (x1, y1, x2, y2, w = 7) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${O}" stroke-width="${w + 3}" stroke-linecap="round"/>` +
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${B}" stroke-width="${w}" stroke-linecap="round"/>` +
      `<circle cx="${x1}" cy="${y1}" r="${w * 0.75}" fill="${B}" stroke="${O}" stroke-width="1.5"/>` +
      `<circle cx="${x2}" cy="${y2}" r="${w * 0.75}" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
    let s = `<svg viewBox="0 0 320 440" class="skel-svg" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round">`;
    // chrbtica (stavce)
    for (let y = 80; y <= 236; y += 9) s += `<rect x="154" y="${y}" width="12" height="7" rx="2.5" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
    // rebrá
    for (let i = 0; i < 7; i++) {
      const y = 94 + i * 11, w = 40 - Math.max(0, i - 4) * 5;
      for (const d of [-1, 1]) {
        const p = `M${160 + d * 3} ${y} C ${160 + d * w * 0.6} ${y - 8}, ${160 + d * w} ${y + 2}, ${160 + d * (w - 4)} ${y + 15}`;
        s += `<path d="${p}" fill="none" stroke="${O}" stroke-width="6"/><path d="${p}" fill="none" stroke="${B}" stroke-width="3.5"/>`;
      }
    }
    s += `<rect x="156" y="90" width="8" height="56" rx="3" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
    // kľúčne kosti a panva
    s += `<path d="M160 86 Q138 80 116 88" fill="none" stroke="${O}" stroke-width="7"/><path d="M160 86 Q138 80 116 88" fill="none" stroke="${B}" stroke-width="4"/>`;
    s += `<path d="M160 86 Q182 80 204 88" fill="none" stroke="${O}" stroke-width="7"/><path d="M160 86 Q182 80 204 88" fill="none" stroke="${B}" stroke-width="4"/>`;
    s += `<path d="M128 240 Q118 262 140 278 Q150 271 160 277 Q170 271 180 278 Q202 262 192 240 Q176 251 160 247 Q144 251 128 240 Z" fill="${B}" stroke="${O}" stroke-width="2"/>`;
    s += `<ellipse cx="146" cy="262" rx="5" ry="6" fill="${O}" opacity=".5"/><ellipse cx="174" cy="262" rx="5" ry="6" fill="${O}" opacity=".5"/>`;
    // ruky
    for (const d of [-1, 1]) {
      const sx = 160 + d * 44;
      s += bone(sx, 92, sx + d * 8, 168, 7);                       // ramenná kosť
      s += bone(sx + d * 8, 172, sx + d * 11, 238, 4) + bone(sx + d * 3, 174, sx + d * 6, 238, 3.5);
      s += `<ellipse cx="${sx + d * 9}" cy="${250}" rx="7" ry="10" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
      for (let f = -2; f <= 2; f++) s += `<line x1="${sx + d * 9 + f * 2.5}" y1="258" x2="${sx + d * 9 + f * 3}" y2="270" stroke="${O}" stroke-width="2"/>`;
    }
    // nohy
    for (const d of [-1, 1]) {
      const hx = 160 + d * 15;
      s += bone(hx, 280, hx + d * 6, 356, 8);                      // stehenná kosť
      s += `<circle cx="${hx + d * 6}" cy="${362}" r="6" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
      s += bone(hx + d * 6, 370, hx + d * 5, 424, 5) + bone(hx + d * 10, 372, hx + d * 10, 422, 3);
      s += `<ellipse cx="${hx + d * 10}" cy="${432}" rx="12" ry="5" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
    }
    // lebka
    s += `<ellipse cx="160" cy="42" rx="24" ry="28" fill="${B}" stroke="${O}" stroke-width="2"/>`;
    s += `<path d="M146 60 Q160 80 174 60" fill="${B}" stroke="${O}" stroke-width="2"/>`;
    s += `<ellipse cx="151" cy="40" rx="6" ry="7" fill="#5b4630"/><ellipse cx="169" cy="40" rx="6" ry="7" fill="#5b4630"/>`;
    s += `<path d="M160 47 l-3.5 8 h7 z" fill="#5b4630"/><path d="M151 65 h18 M155 62 v6 M160 62 v7 M165 62 v6" stroke="#5b4630" stroke-width="1.3"/>`;
    s += `<rect x="155" y="70" width="10" height="9" rx="3" fill="${B}" stroke="${O}" stroke-width="1.5"/>`;
    // čiary od popisiek k častiam kostry
    for (const [x1, y1, x2, y2] of SKEL_LINES) {
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d6bd6" stroke-width="2.2"/><circle cx="${x2}" cy="${y2}" r="4" fill="#7d6bd6"/>`;
    }
    return s + '</g></svg>';
  }
  // miesta popisiek: [strana, y] v poradí ako answers; čiary [od x, od y, k x, k y]
  const SKEL_SPOTS = [['l', 42], ['l', 128], ['l', 214], ['r', 128], ['r', 316]];
  const SKEL_LINES = [[100, 42, 137, 42], [100, 128, 124, 122], [100, 214, 154, 214], [220, 128, 210, 130], [220, 316, 178, 318]];

  function buildPvBody() {
    const body = $('#pv-body');
    body.innerHTML = '';
    body.className = 'pv-body ' + pv.ex.type;
    let k = 0;
    if (pv.ex.type === 'text') {
      const ol = document.createElement('ol');
      ol.className = 'pv-sents';
      for (const sent of pv.ex.items) {
        const li = document.createElement('li');
        sent.split(/\{[^}]+\}/).forEach((part, i, arr) => {
          if (part) li.append(document.createTextNode(part));
          if (i < arr.length - 1) li.append(gapEl(k++));
        });
        ol.append(li);
      }
      body.append(ol);
    } else if (pv.ex.type === 'skeleton') {
      const fig = document.createElement('div');
      fig.className = 'pv-figure';
      fig.innerHTML = skeletonSVG();
      SKEL_SPOTS.forEach(([side, y], i) => {
        const g = gapEl(i);
        g.classList.add('pos', side);
        g.style.top = (y / 440) * 100 + '%';
        fig.append(g);
      });
      body.append(fig);
    } else {
      const grid = document.createElement('div');
      grid.className = 'pv-vehicles';
      for (const slot of pv.order) {
        const tile = document.createElement('div');
        tile.className = 'pv-tile';
        const pic = document.createElement('div');
        pic.className = 'pv-pic';
        pic.textContent = VEHICLE_ICONS[pv.slots[slot]] || '❓';
        tile.append(pic, gapEl(slot));
        grid.append(tile);
      }
      body.append(grid);
    }
  }

  function chipEl(wid) {
    const w = pv.words[wid];
    const c = document.createElement('span');
    c.className = 'wchip' + (pv.sel === wid ? ' sel' : '') + (w.text.length > 10 ? ' long' : '');
    c.dataset.wid = wid;
    c.textContent = w.text;
    return c;
  }

  function pvRender() {
    $$('#pv-body .gap').forEach(g => {
      const k = +g.dataset.slot, wid = pv.place[k];
      g.innerHTML = '';
      g.classList.toggle('filled', wid != null);
      if (pv.checked) {
        const ok = wid != null && pv.words[wid].text === pv.slots[k];
        g.classList.add(ok ? 'ok' : 'bad');
        if (ok) { const b = document.createElement('b'); b.textContent = pv.slots[k]; g.append(b); }
        else {
          const s = document.createElement('s'); s.textContent = wid != null ? pv.words[wid].text : '—';
          const b = document.createElement('b'); b.textContent = pv.slots[k];
          g.append(s, b);
        }
      } else if (wid != null) g.append(chipEl(wid));
    });
    const bank = $('#pv-bank');
    bank.innerHTML = '';
    for (const w of pv.words) if (!pv.place.includes(w.id)) bank.append(chipEl(w.id));
    if (!bank.childElementCount && !pv.checked) {
      const e = document.createElement('span');
      e.className = 'pv-empty';
      e.textContent = 'Všetky slová sú na mieste 👍';
      bank.append(e);
    }
    $('#btn-pv-check').disabled = pv.place.some(p => p == null);
  }

  function pvPlace(wid, slot) {
    const prev = pv.place.indexOf(wid);
    const other = pv.place[slot];
    if (prev === slot) { pv.sel = null; pvRender(); return; }
    if (prev >= 0) pv.place[prev] = null;
    pv.place[slot] = wid;
    if (other != null && prev >= 0) pv.place[prev] = other; // vymeniť dve slová medzi medzerami
    pv.sel = null;
    audio.blip();
    pvRender();
  }
  function pvUnplace(wid) {
    const k = pv.place.indexOf(wid);
    if (k >= 0) pv.place[k] = null;
    pv.sel = null;
    pvRender();
  }

  // ----- chytanie a prenášanie slov (prst aj myš); ťuknutie na slovo a potom na medzeru funguje tiež -----
  const pvRoot = $('#screen-prvouka');
  let pvDrag = null;
  function pvDragEnd() {
    if (pvDrag && pvDrag.ghost) pvDrag.ghost.remove();
    $$('#pv-body .gap.over').forEach(g => g.classList.remove('over'));
    pvDrag = null;
  }
  const gapAt = (x, y) => { const el = document.elementFromPoint(x, y); return el ? el.closest('#pv-body .gap') : null; };

  pvRoot.addEventListener('pointerdown', e => {
    if (!pv || pv.checked || pvDrag) return;
    const chip = e.target.closest('.wchip');
    if (!chip) return;
    audio.init();
    const r = chip.getBoundingClientRect();
    pvDrag = { wid: +chip.dataset.wid, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
      w: r.width, moved: false, ghost: null, from: chip.closest('.gap') ? +chip.closest('.gap').dataset.slot : null, chip };
    e.preventDefault();
  });
  window.addEventListener('pointermove', e => {
    if (!pvDrag || e.pointerId !== pvDrag.pid) return;
    const d = pvDrag;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return;
    if (!d.moved) {
      d.moved = true;
      d.ghost = d.chip.cloneNode(true);
      d.ghost.classList.add('ghost');
      d.ghost.style.width = d.w + 'px';
      document.body.append(d.ghost);
      d.chip.classList.add('dragging');
    }
    d.ghost.style.left = e.clientX - d.dx + 'px';
    d.ghost.style.top = e.clientY - d.dy + 'px';
    const over = gapAt(e.clientX, e.clientY);
    $$('#pv-body .gap').forEach(g => g.classList.toggle('over', g === over));
    // pri okraji obrazovky posúvať obsah, aby sa dalo dostať k vzdialenej medzere
    const sc = $('#pv-scroll'), sr = sc.getBoundingClientRect();
    if (e.clientY < sr.top + 50) sc.scrollTop -= 12;
    else if (e.clientY > sr.bottom - 50) sc.scrollTop += 12;
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointerup', e => {
    if (!pvDrag || e.pointerId !== pvDrag.pid) return;
    const d = pvDrag;
    if (d.ghost) d.ghost.style.display = 'none';
    const gap = gapAt(e.clientX, e.clientY);
    pvDragEnd();
    if (!pv) return;
    if (d.moved) {
      if (gap) pvPlace(d.wid, +gap.dataset.slot);
      else if (d.from != null) pvUnplace(d.wid); // pustené mimo medzery → späť medzi slová
      else pvRender();
      return;
    }
    // ťuknutie
    if (d.from != null) {
      if (pv.sel != null && pv.sel !== d.wid) pvPlace(pv.sel, d.from);
      else { audio.blip(); pvUnplace(d.wid); }
    } else { pv.sel = pv.sel === d.wid ? null : d.wid; audio.blip(); pvRender(); }
  });
  window.addEventListener('pointercancel', () => { if (pvDrag) { pvDragEnd(); if (pv) pvRender(); } });
  // ťuknutie na prázdnu medzeru, keď je vybraté slovo
  pvRoot.addEventListener('click', e => {
    if (!pv || pv.checked || pv.sel == null || e.target.closest('.wchip')) return;
    const gap = e.target.closest('#pv-body .gap');
    if (gap) pvPlace(pv.sel, +gap.dataset.slot);
  });

  function pvPop(text) {
    const el = $('#pv-plus');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function checkPrvouka() {
    if (!pv || pv.checked || pv.place.some(p => p == null)) return;
    audio.init();
    pv.checked = true;
    const good = pv.slots.filter((s, k) => pv.words[pv.place[k]].text === s).length;
    const total = pv.slots.length;
    const cat = catById(pv.catId);
    const before = iqOf(cat.id);
    const reward = pvIq(good, total);
    addIq(cat.id, reward);
    const gained = iqOf(cat.id) - before;
    if (reward >= 1) learnDone('pv'); // úspešné učenie sa počíta do odmien
    const coins = good * PV_COINS + (good === total ? PV_ALL_COINS : 0);
    store.coins += coins;
    save();
    pvRender();
    $('#btn-pv-check').classList.add('hidden');
    $('#pv-bank').classList.add('hidden');
    const v = $('#pv-verdict');
    if (good === total) {
      v.className = 'dict-verdict ok';
      v.textContent = `Všetko správne! 🎉 (${good} z ${total})`;
      audio.preview(cat.voice, 79);
      pv.mood = 'happy';
    } else {
      v.className = 'dict-verdict bad';
      v.textContent = `Správne ${good} z ${total}. Červené miesta sú opravené – zelené slovo tam patrí.`;
      if (good) audio.preview(cat.voice, 72); else audio.miss(audio.ui);
      pv.mood = good ? null : 'sad';
    }
    pv.moodT = 0;
    if (gained > 0) pvPop(`+${gained} IQ`);
    $('#pv-iqline').textContent = gained > 0
      ? `${cat.name}: IQ ${pv.startIq} → ${iqOf(cat.id)}${iqOf(cat.id) >= IQ_MAX ? ' · Génius! 🎓' : ''}`
      : reward ? `${cat.name} už má plné IQ 🎓` : `${cat.name} tentoraz IQ nedostane – treba aspoň polovicu správne.`;
    $('#pv-earn').innerHTML = coins ? `<div class="earn">+${price(coins)}</div><small>na nákupy</small>` : '';
    $('#pv-progress').textContent = `${good} / ${total}`;
    $('#pv-result').classList.remove('hidden');
    updatePvCat();
    updateWallets();
  }

  $('#btn-pv-check').addEventListener('click', checkPrvouka);
  $('#btn-pv-again').addEventListener('click', () => { audio.init(); audio.blip(); startPrvouka(pvCatId); });

  function pvLoop() {
    let last = performance.now();
    const step = ts => {
      if (!pv || screen !== 'prvouka') return;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      pv.t += dt;
      pv.moodT += dt;
      const cat = catById(pv.catId);
      const active = pv.mood && pv.moodT < 0.9;
      paintCat($('#pv-cat'), cat, 96, outfitOf(cat.id), 'full', {
        t: pv.t,
        mouth: active && pv.mood === 'happy' ? 0.45 + 0.3 * Math.sin(pv.t * 18) : 0,
        sad: active && pv.mood === 'sad',
        blink: (pv.t % 3.4) < 0.12,
        look: Math.sin(pv.t * 0.9) * 0.5,
        noBed: true,
      });
      pv.raf = requestAnimationFrame(step);
    };
    pv.raf = requestAnimationFrame(step);
  }


  // ---------- Balíčky úloh: aby sa dieťa učilo aj to, čo nemá rado ----------
  // Každý predmet má balíček úloh. Úspešné učenie (aspoň 1 IQ) z neho jednu úlohu ubere.
  // Prázdny predmet sa zamkne („Úlohy sa minuli“). Všetky balíčky sa naplnia až vtedy,
  // keď sa minú všetky – čakanie ani nový deň predmet neodomkne.
  const SUBJECTS = {
    school: { name: 'Mačacia škola', size: 2 },
    dict: { name: 'Diktát', size: 4 },
    pv: { name: 'Prvouka', size: 3 },
  };
  const MODE_SUBJECT = { school: 'school', dictation: 'dict', prvouka: 'pv' };
  if (!store.packs || typeof store.packs !== 'object') store.packs = {};
  for (const k of Object.keys(SUBJECTS)) if (typeof store.packs[k] !== 'number') store.packs[k] = SUBJECTS[k].size;
  const packLeft = subj => store.packs[subj] || 0;

  function useTask(subj) {
    if (!SUBJECTS[subj]) return;
    store.packs[subj] = Math.max(0, packLeft(subj) - 1);
    if (Object.keys(SUBJECTS).every(k => packLeft(k) === 0)) {
      for (const k of Object.keys(SUBJECTS)) store.packs[k] = SUBJECTS[k].size;
      queueReward({ kind: 'refill' });
    } else if (packLeft(subj) === 0) queueReward({ kind: 'empty', subj });
    save();
  }
  /** Ak sa predmet minul, ukáže správu a vráti false. */
  function canLearn(subj) {
    if (packLeft(subj) > 0) return true;
    queueReward({ kind: 'empty', subj });
    showNextReward();
    return false;
  }
  function renderGamePacks() {
    $$('.game-card[data-mode]').forEach(card => {
      const subj = MODE_SUBJECT[card.dataset.mode];
      let tag = card.querySelector('.gc-pack');
      if (!tag) { tag = document.createElement('span'); tag.className = 'gc-pack'; card.append(tag); }
      const left = packLeft(subj);
      tag.textContent = left ? `📚 ${left}/${SUBJECTS[subj].size}` : '📭';
      card.classList.toggle('empty', !left);
    });
  }

  // ---------- Odmeny za učenie, denný bonus a denné učenie ----------
  // Úspešné učenie = dokončená lekcia/veta/úloha, za ktorú si mačička zaslúžila aspoň 1 IQ.
  //  - každých 30 → náhodná vec z obchodu (nie jedlo ani mačička), najviac 1× za deň
  //  - každých 100 → mačička zadarmo podľa výberu, najviac 1× za mesiac
  //  - každý deň aspoň 1 úspešné učenie → Denné učenie; 7 dní za sebou → +2 500
  //  - prvé otvorenie dňa → denný bonus 500
  const LEARN_ITEM_EVERY = 30;
  const LEARN_CAT_EVERY = 100;
  const DAILY_BONUS = 500;
  const STREAK_DAYS = 7, STREAK_BONUS = 2500;
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  if (!store.learn || typeof store.learn !== 'object') store.learn = { item: 0, cat: 0, itemDay: '', catDay: '', total: 0 };
  if (!store.streak || typeof store.streak !== 'object') store.streak = { n: 0, day: '' };
  const streakNow = () => (store.streak.day === dayKey() || store.streak.day === yesterdayKey() ? store.streak.n : 0);

  function renderStats() {
    const L = store.learn;
    const set = (id, v, max) => {
      $('#st-' + id).textContent = `${v}/${max}`;
      $('#st-' + id + '-bar').style.width = Math.min(100, (v / max) * 100) + '%';
    };
    set('item', L.item, LEARN_ITEM_EVERY);
    set('cat', L.cat, LEARN_CAT_EVERY);
    set('streak', streakNow(), STREAK_DAYS);
  }

  function learnDone(subj) {
    useTask(subj); // z balíčka predmetu ubudne úloha
    const L = store.learn;
    L.total = (L.total || 0) + 1;
    L.item = Math.min(LEARN_ITEM_EVERY, L.item + 1);
    L.cat = Math.min(LEARN_CAT_EVERY, L.cat + 1);
    const today = dayKey(), st = store.streak;
    if (st.day !== today) {
      st.n = st.day === yesterdayKey() ? st.n + 1 : 1;
      st.day = today;
      if (st.n >= STREAK_DAYS) {
        st.n = 0;
        store.coins += STREAK_BONUS;
        queueReward({ kind: 'coins', icon: '📅', title: 'Denné učenie', text: 'Celý týždeň učenia! 🎉', amount: STREAK_BONUS });
      }
    }
    save();
    renderStats();
    checkRewards();
  }

  function checkRewards() {
    const L = store.learn, today = dayKey();
    if (L.item >= LEARN_ITEM_EVERY && L.itemDay !== today) {
      L.item -= LEARN_ITEM_EVERY;
      L.itemDay = today;
      grantItem();
    }
    // mačička zadarmo najviac 1× za kalendárny mesiac
    if (L.cat >= LEARN_CAT_EVERY && L.catMonth !== monthKey() && !rewardQueue.some(r => r.kind === 'cat')) {
      if (CATS.some(c => !ownsCat(c.id))) queueReward({ kind: 'cat' });
      else {
        L.cat -= LEARN_CAT_EVERY;
        L.catMonth = monthKey();
        store.coins += 5000;
        queueReward({ kind: 'coins', icon: '🐱', title: 'Mačička zadarmo', text: 'Máš už všetky mačičky, dostávaš body.', amount: 5000 });
      }
    }
    save();
    renderStats();
    showNextReward();
  }

  /** Náhodná vec z obchodu (oblečenie, okuliare, obojky…), ktorú ešte nemá. */
  function grantItem() {
    const free = [];
    for (const it of ITEMS) for (const c of it.colors) { const k = variantKey(it.id, c); if (!store.owned[k]) free.push({ it, c, k }); }
    if (!free.length) {
      store.coins += 3000;
      queueReward({ kind: 'coins', icon: '🎁', title: 'Odmena z obchodu', text: 'Máš už všetky veci z obchodu, dostávaš body.', amount: 3000 });
      return;
    }
    const pick = free[rand(free.length)];
    store.owned[pick.k] = 1;
    queueReward({ kind: 'item', ...pick });
  }

  function checkDaily() {
    if (store.bonusDay !== dayKey() && !rewardQueue.some(r => r.kind === 'daily')) queueReward({ kind: 'daily' });
  }

  // ----- okná s odmenami (postupne jedno za druhým) -----
  const rewardQueue = [];
  let rewardCur = null, rewardPick = null;
  function queueReward(r) { rewardQueue.push(r); }
  function showNextReward() {
    if (rewardCur || !rewardQueue.length) return;
    if (limitOpen || screen === null || screen === 'pause' || screen === 'welcome' || game.mode === 'play') return; // počká
    rewardCur = rewardQueue.shift();
    rewardPick = null;
    const r = rewardCur;
    const cv = $('#rw-cv'), grid = $('#rw-grid'), amt = $('#rw-amount'), ok = $('#btn-rw-ok');
    cv.classList.add('hidden');
    grid.classList.add('hidden');
    grid.innerHTML = '';
    amt.innerHTML = '';
    ok.disabled = false;
    ok.textContent = 'OK';
    const actions = $('#rw-actions');
    actions.innerHTML = '';
    actions.classList.add('hidden');
    if ((r.kind === 'sick' || r.kind === 'care') && !isSick(r.id)) { rewardCur = null; showNextReward(); return; }
    if (r.kind === 'care' && !careDue(r.id)) { rewardCur = null; showNextReward(); return; }
    if (r.kind === 'daily') {
      $('#rw-icon').textContent = '🌞';
      $('#rw-title').textContent = 'Denný bonus';
      $('#rw-text').textContent = 'Vyber si denný bonus';
      amt.innerHTML = '+' + price(DAILY_BONUS);
    } else if (r.kind === 'coins') {
      $('#rw-icon').textContent = r.icon;
      $('#rw-title').textContent = r.title;
      $('#rw-text').textContent = r.text;
      amt.innerHTML = '+' + price(r.amount);
    } else if (r.kind === 'item') {
      $('#rw-icon').textContent = '🎁';
      $('#rw-title').textContent = 'Odmena z obchodu';
      $('#rw-text').textContent = `${r.it.name} (${COLORS[r.c][0].toLowerCase()}). Nájdeš to v Šatníku.`;
      cv.classList.remove('hidden');
      const model = catById(store.catL);
      paintCat(cv, model, 150, Object.assign({}, outfitOf(model.id), { [r.it.slot]: parseVariant(r.k) }), r.it.slot === 'bed' ? 'full' : 'full', { noBed: r.it.slot !== 'bed' });
    } else if (r.kind === 'sick') {
      const cat = catById(r.id);
      $('#rw-icon').textContent = '🤒';
      $('#rw-title').textContent = `${cat.name} ${gx(cat, 'ochorel', 'ochorela', 'ochorelo')}!`;
      cv.classList.remove('hidden');
      paintCat(cv, cat, 150, outfitOf(cat.id), 'full', { sick: true, t: 1 });
      const healthy = healthyCats();
      if (healthy.length === 1) {
        rewardPick = healthy[0].id;
        $('#rw-text').textContent = `${healthy[0].name} sa o ${gx(cat, 'neho', 'ňu', 'neho')} postará.`;
      } else {
        $('#rw-text').textContent = `Kto sa o ${gx(cat, 'neho', 'ňu', 'neho')} postará?`;
        grid.classList.remove('hidden');
        ok.disabled = true;
        for (const hc of healthy) {
          const b = document.createElement('button');
          b.className = 'cat-card';
          b.innerHTML = '<canvas></canvas><span class="cat-name"></span>';
          b.querySelector('.cat-name').textContent = hc.name;
          paintCat(b.querySelector('canvas'), hc, 70, outfitOf(hc.id), 'full', { noBed: true });
          b.addEventListener('click', () => {
            audio.init();
            rewardPick = hc.id;
            $$('#rw-grid .cat-card').forEach(x => x.classList.toggle('sel', x === b));
            ok.disabled = false;
            audio.preview(hc.voice, 76);
          });
          grid.append(b);
        }
      }
      const med = document.createElement('button');
      med.className = 'btn soft';
      med.textContent = '💊 Kúpiť liek';
      med.addEventListener('click', () => {
        audio.init();
        const sk = store.sick[r.id];
        if (sk) sk.carer = rewardPick || healthy[0].id;
        save();
        closeReward();
        goBuyMed();
      });
      actions.append(med);
      actions.classList.remove('hidden');
    } else if (r.kind === 'care') {
      const cat = catById(r.id), sk = store.sick[r.id];
      $('#rw-icon').textContent = '🍲';
      $('#rw-title').textContent = `${cat.name} je ${gx(cat, 'hladný a smädný', 'hladná a smädná', 'hladné a smädné')}`;
      $('#rw-text').innerHTML = '';
      const who = document.createElement('p');
      who.className = 'rw-who';
      who.textContent = `${catById(sk.carer).name} ➜ ${cat.name}`;
      cv.classList.remove('hidden');
      paintCat(cv, cat, 140, outfitOf(cat.id), 'full', { sick: true, t: 1 });
      const fill = () => {
        actions.innerHTML = '';
        actions.append(who, careButtons(r.id, () => {
          if (!careDue(r.id)) { save(); closeReward(); if (screen === 'cat') renderCatDetail(); showNextReward(); return; }
          fill();
        }));
      };
      fill();
      actions.classList.remove('hidden');
    } else if (r.kind === 'healed') {
      const cat = catById(r.id);
      $('#rw-icon').textContent = '🎉';
      $('#rw-title').textContent = `${cat.name} ${gx(cat, 'vyzdravel', 'vyzdravela', 'vyzdravelo')}!`;
      $('#rw-text').textContent = '';
      cv.classList.remove('hidden');
      paintCat(cv, cat, 150, outfitOf(cat.id), 'full', { sick: false, t: 1, noBed: true });
    } else if (r.kind === 'empty') {
      const others = Object.keys(SUBJECTS).filter(k => k !== r.subj && packLeft(k) > 0).map(k => SUBJECTS[k].name);
      $('#rw-icon').textContent = '📭';
      $('#rw-title').textContent = `${SUBJECTS[r.subj].name}: úlohy sa minuli`;
      $('#rw-text').textContent = others.length ? `Nové úlohy pribudnú, keď sa naučíš: ${others.join(', ')}.` : '';
    } else if (r.kind === 'refill') {
      $('#rw-icon').textContent = '📬';
      $('#rw-title').textContent = 'Nové úlohy!';
      $('#rw-text').textContent = Object.values(SUBJECTS).map(x => x.name).join(' · ');
    } else if (r.kind === 'block') {
      $('#rw-icon').textContent = '🤒';
      $('#rw-title').textContent = 'Hrať sa môžeš, až keď mačička vyzdravie.';
      $('#rw-text').textContent = '';
    } else if (r.kind === 'cat') {
      $('#rw-icon').textContent = '🐱';
      $('#rw-title').textContent = 'Mačička zadarmo';
      $('#rw-text').textContent = 'Vyber si jednu mačičku, ktorú ešte nemáš.';
      grid.classList.remove('hidden');
      ok.disabled = true;
      ok.textContent = 'Vyber mačičku';
      for (const cat of CATS.filter(c => !ownsCat(c.id))) {
        const b = document.createElement('button');
        b.className = 'cat-card';
        b.innerHTML = '<canvas></canvas><span class="cat-name"></span>';
        b.querySelector('.cat-name').textContent = cat.name;
        paintCat(b.querySelector('canvas'), cat, 70, null, 'full');
        b.addEventListener('click', () => {
          audio.init();
          rewardPick = cat.id;
          $$('#rw-grid .cat-card').forEach(x => x.classList.toggle('sel', x === b));
          ok.disabled = false;
          ok.textContent = `Vybrať: ${cat.name}`;
          audio.preview(cat.voice, 76);
        });
        grid.append(b);
      }
    }
    $('#reward').classList.remove('hidden');
  }
  $('#btn-rw-ok').addEventListener('click', () => {
    const r = rewardCur;
    if (!r) return;
    audio.init();
    if (r.kind === 'daily') {
      store.coins += DAILY_BONUS;
      store.bonusDay = dayKey();
    } else if (r.kind === 'sick') {
      if (!rewardPick) return;
      const sk = store.sick[r.id];
      if (sk) sk.carer = rewardPick;
      save();
      closeReward();
      if (screen === 'cat') renderCatDetail();
      if (sk && careDue(r.id)) maybePromptCare(r.id);
      showNextReward();
      return;
    } else if (r.kind === 'care' || r.kind === 'block' || r.kind === 'healed' || r.kind === 'empty' || r.kind === 'refill') {
      if (screen === 'games') renderGamePacks();
      closeReward();
      if (screen === 'cat') renderCatDetail();
      if (screen === 'cats') updateCatUI();
      syncGame();
      showNextReward();
      return;
    } else if (r.kind === 'cat') {
      if (!rewardPick) return;
      unlockCat(rewardPick);
      store.learn.cat -= LEARN_CAT_EVERY;
      store.learn.catMonth = monthKey();
      toast(`${catById(rewardPick).name} je teraz ${gx(catById(rewardPick), 'tvoj', 'tvoja', 'tvoje')}! 🎉`);
    }
    audio.preview(chosenCats()[0].voice, 81);
    save();
    updateWallets();
    renderStats();
    rewardCur = null;
    $('#reward').classList.add('hidden');
    if (screen === 'cats') updateCatUI();
    showNextReward();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDaily(); checkRewards(); rollSickness(); sickTick(); } });

  // ---------- Choroba mačičiek ----------
  // Každá mačička môže ochorieť najviac 1× za mesiac (nemusí vôbec), vždy ostane aspoň jedna zdravá.
  // Choroba trvá 3 dni, liek ju skráti na polovicu. Deň má 2 časti (do 14:00 a po 14:00) –
  // v každej musí opatrovateľka dať chorej mačičke jesť aj piť (zo špajze). Keď sa to niektorý deň
  // nestihne, choroba sa predĺži o 1 deň. Chorá mačička nemôže spievať ani sa učiť.
  const SICK_DAYS = 3;
  const SICK_P = 0.02;          // šanca za deň pre každú mačičku (asi polovica mačičiek za mesiac)
  const CARE_SPLIT_H = 14;
  const HOUR = 3600000, DAY_MS = 24 * HOUR;
  if (!store.sick || typeof store.sick !== 'object') store.sick = {};
  if (!store.sickMonth || typeof store.sickMonth !== 'object') store.sickMonth = {};
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const nextDay = k => { const [y, m, d] = k.split('-').map(Number); return dayKey(new Date(y, m - 1, d + 1)); };
  const sickEnd = s => s.start + (s.base * (s.med ? 0.5 : 1) + s.ext * 24) * HOUR;
  function slotOf(ts) { const d = new Date(ts); return { day: dayKey(d), part: d.getHours() < CARE_SPLIT_H ? 'm' : 'e' }; }
  function slotRange(day, part) {
    const [y, m, d] = day.split('-').map(Number);
    const s0 = new Date(y, m - 1, d).getTime();
    return part === 'm' ? [s0, s0 + CARE_SPLIT_H * HOUR] : [s0 + CARE_SPLIT_H * HOUR, s0 + DAY_MS];
  }
  const slotCare = (s, day, part) => ((s.care[day] || {})[part]) || { f: false, d: false };
  const slotDone = (s, day, part) => { const c = slotCare(s, day, part); return c.f && c.d; };
  function slotRequired(s, day, part) { const [a, b] = slotRange(day, part); return b > s.start && a < sickEnd(s); }
  function careDue(id) {
    const s = store.sick[id];
    if (!s) return false;
    const { day, part } = slotOf(Date.now());
    return slotRequired(s, day, part) && !slotDone(s, day, part);
  }
  const healthyCats = () => ownedCats().filter(c => !isSick(c.id));

  /** Za každý uplynulý deň, keď nedostala 2× jesť a piť, sa choroba predĺži o 1 deň. */
  function sickEvaluate(id) {
    const s = store.sick[id];
    const today = dayKey();
    let d = s.evalDay ? nextDay(s.evalDay) : dayKey(new Date(s.start));
    while (d < today) {
      if (['m', 'e'].some(p => slotRequired(s, d, p) && !slotDone(s, d, p))) s.ext += 1;
      s.evalDay = d;
      d = nextDay(d);
    }
  }

  /** Keď spieva chorá mačička, nahradí ju zdravá (ak sú aspoň 2 zdravé). */
  function fixSingers() {
    const healthy = healthyCats();
    if (healthy.length < 2) return false;
    for (const key of ['catL', 'catR']) {
      if (!isSick(store[key])) continue;
      const other = key === 'catL' ? store.catR : store.catL;
      const pick = healthy.find(c => c.id !== other && !isSick(c.id));
      if (pick) store[key] = pick.id;
    }
    save();
    syncGame();
    return !isSick(store.catL) && !isSick(store.catR);
  }
  const singersReady = () => (!isSick(store.catL) && !isSick(store.catR)) || fixSingers();

  function makeSick(id) {
    store.sick[id] = { start: Date.now(), base: SICK_DAYS * 24, med: false, ext: 0, carer: null, care: {}, evalDay: '', prompted: '', promptAt: 0 };
    store.sickMonth[id] = monthKey();
    fixSingers();
    save();
    queueReward({ kind: 'sick', id });
  }

  /** Raz denne sa môže stať, že niektorá mačička ochorie. */
  function rollSickness() {
    const today = dayKey();
    if (store.sickRollDay === today) return;
    store.sickRollDay = today;
    save();
    if (store.cats.length < 2 || store.startDay === today) return;
    const healthy = healthyCats();
    if (healthy.length < 2) return; // vždy musí ostať aspoň jedna zdravá
    const carers = new Set(Object.values(store.sick).map(s => s.carer));
    const cand = shuffle(healthy.filter(c => store.sickMonth[c.id] !== monthKey() && !carers.has(c.id)));
    for (const c of cand) if (Math.random() < SICK_P) { makeSick(c.id); break; }
  }

  function maybePromptCare(id) {
    const s = store.sick[id];
    const { day, part } = slotOf(Date.now());
    const key = day + part;
    if (s.prompted === key && Date.now() - (s.promptAt || 0) < 30 * 60000) return;
    if (rewardQueue.some(r => r.kind === 'care' && r.id === id) || (rewardCur && rewardCur.kind === 'care' && rewardCur.id === id)) return;
    s.prompted = key;
    s.promptAt = Date.now();
    queueReward({ kind: 'care', id });
  }

  function sickTick() {
    for (const id of Object.keys(store.sick)) {
      if (!ownsCat(id)) { delete store.sick[id]; continue; }
      sickEvaluate(id);
      const s = store.sick[id];
      if (Date.now() >= sickEnd(s)) {
        delete store.sick[id];
        queueReward({ kind: 'healed', id });
        continue;
      }
      if (!s.carer || !ownsCat(s.carer) || isSick(s.carer)) {
        s.carer = null;
        const waiting = rewardQueue.some(r => r.kind === 'sick' && r.id === id) || (rewardCur && rewardCur.kind === 'sick' && rewardCur.id === id);
        if (!waiting) queueReward({ kind: 'sick', id });
      } else if (careDue(id)) maybePromptCare(id);
    }
    save();
    showNextReward();
    if (screen === 'cat') renderCatDetail();
    if (screen === 'cats') updateCatUI();
  }

  const careFood = () => FOODS.find(f => f.kind !== 'milk' && f.kind !== 'med' && (store.pantry[f.id] || 0) > 0);
  const careDrink = () => FOODS.find(f => f.kind === 'milk' && (store.pantry[f.id] || 0) > 0);
  function giveCare(id, what) {
    const s = store.sick[id];
    if (!s) return null;
    const item = what === 'f' ? careFood() : careDrink();
    if (!item) return null;
    store.pantry[item.id]--;
    if (!store.pantry[item.id]) delete store.pantry[item.id];
    const { day, part } = slotOf(Date.now());
    s.care[day] = s.care[day] || {};
    s.care[day][part] = Object.assign(slotCare(s, day, part), { [what]: true });
    setHunger(id, Math.min(100, hungerOf(id) + item.fill));
    save();
    syncGame();
    return item;
  }
  function giveMed(id) {
    const s = store.sick[id];
    if (!s || s.med || !(store.pantry.med > 0)) return false;
    store.pantry.med--;
    if (!store.pantry.med) delete store.pantry.med;
    s.med = true;
    save();
    return true;
  }
  function sickLeftText(id) {
    const hours = Math.ceil(Math.max(0, sickEnd(store.sick[id]) - Date.now()) / HOUR);
    const d = Math.floor(hours / 24), h = hours % 24;
    return `🤒 ${d ? d + ' d' : ''}${d && h ? ' ' : ''}${h || !d ? h + ' h' : ''}`;
  }
  function goBuyMed() {
    shopTab = 'food';
    go('shop');
    const h = $('#shop-med');
    if (h) h.scrollIntoView({ block: 'start' });
  }

  /** Tlačidlá Jesť / Piť / Liek / Obchod pre chorú mačičku (v okne aj v detaile mačky). */
  function careButtons(id, onChange) {
    const box = document.createElement('div');
    box.className = 'care-btns';
    const s = store.sick[id];
    const { day, part } = slotOf(Date.now());
    const c = slotCare(s, day, part);
    const mk = (label, cls, fn, disabled) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = label;
      b.disabled = !!disabled;
      b.addEventListener('click', () => { audio.init(); fn(); });
      box.append(b);
      return b;
    };
    const cat = catById(id);
    const act = what => {
      const item = giveCare(id, what);
      if (!item) return;
      audio.preview(cat.voice, 70);
      if (slotDone(s, day, part)) toast('❤️');
      onChange();
    };
    mk(c.f ? '✓ 🍗' : '🍗 Jesť', c.f ? 'done' : 'soft', () => act('f'), c.f || !careFood());
    mk(c.d ? '✓ 🥛' : '🥛 Piť', c.d ? 'done' : 'soft', () => act('d'), c.d || !careDrink());
    if (!s.med && store.pantry.med > 0) mk('💊 Liek', 'primary', () => { if (giveMed(id)) { audio.preview(cat.voice, 76); toast('💊'); onChange(); } });
    if (!careFood() || !careDrink() || !s.med) mk('🛒', 'soft', () => { closeReward(); goBuyMed(); });
    return box;
  }

  function closeReward() {
    rewardCur = null;
    $('#reward').classList.add('hidden');
  }

  /** Detail chorej mačičky: zostávajúci čas, opatrovateľka a starostlivosť. */
  function renderSickDetail(cat) {
    const box = $('#cat-sick');
    const s = store.sick[cat.id];
    box.innerHTML = '';
    const tm = document.createElement('div');
    tm.className = 'sick-time';
    tm.textContent = sickLeftText(cat.id);
    box.append(tm);
    const healthy = healthyCats();
    if (s.carer) {
      const row = document.createElement('div');
      row.className = 'sick-carer';
      const cv = document.createElement('canvas');
      const nm = document.createElement('span');
      nm.textContent = catById(s.carer).name;
      paintCat(cv, catById(s.carer), 54, outfitOf(s.carer), 'head', { noBed: true });
      row.append(cv, nm);
      if (healthy.length > 1) {
        const b = document.createElement('button');
        b.className = 'btn small soft';
        b.textContent = '🔄';
        b.addEventListener('click', () => {
          const i = healthy.findIndex(c => c.id === s.carer);
          s.carer = healthy[(i + 1) % healthy.length].id;
          audio.blip();
          save();
          renderCatDetail();
        });
        row.append(b);
      }
      box.append(row);
      box.append(careButtons(cat.id, () => renderCatDetail()));
    }
  }

  // ---------- Výsledok ----------
  game.onEnd = r => {
    const prev = store.best[current.id] || { score: 0, stars: 0 };
    const isNew = r.score > prev.score;
    store.best[current.id] = { score: Math.max(prev.score, r.score), stars: Math.max(prev.stars, r.stars) };

    // body na nákupy: bonus za najedené mačky, menej za hladné a tučné
    const cats = chosenCats();
    const bonus = cats.reduce((s, c) => s + moodOf(hungerOf(c.id)).bonus, 0);
    const fatPen = cats.reduce((s, c) => s + weightOf(fatOf(c.id)).bonus, 0);
    const earned = Math.max(0, Math.round((SONG_BASE + SONG_PER_DIFF * current.difficulty) * r.acc * (1 + bonus + fatPen)));
    store.coins += earned;
    // chudnutie: podľa toho, koľko sa mačka v pesničke nachodila
    const slim = [];
    cats.forEach((c, i) => {
      setHunger(c.id, hungerOf(c.id) - SONG_COST);
      const before = fatOf(c.id);
      if (before <= 0) return;
      const loss = Math.min(FAT_SONG_MAX, ((r.moved && r.moved[i]) || 0) * FAT_PER_MOVE);
      setFat(c.id, before - loss);
      slim.push({ name: c.name, cat: c, before, after: fatOf(c.id) });
    });
    save();
    syncGame();
    setTimeout(() => showResult(r, isNew, earned, bonus, fatPen, slim), r.cleared ? 900 : 600);
  };

  function showResult(r, isNew, earned, bonus, fatPen, slim = []) {
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
    $('#res-score').textContent = fmt(r.score);
    $('#res-new').classList.toggle('hidden', !isNew || r.score === 0);
    $('#res-acc').textContent = `${Math.round(r.acc * 100)} %`;
    $('#res-combo').textContent = r.maxCombo;
    const notes = [];
    if (bonus > 0.001) notes.push(`najedené mačky +${Math.round(bonus * 100)} %`);
    if (bonus < -0.001) notes.push(`hladné mačky −${Math.round(-bonus * 100)} %`);
    if (fatPen < -0.001) notes.push(`tučné mačky −${Math.round(-fatPen * 100)} %`);
    $('#res-earn').innerHTML = `<div class="earn">+${price(earned)}</div><small>na nákupy${notes.length ? ' · ' + notes.join(' · ') : ''}</small>`;
    for (const s of slim) {
      const d = document.createElement('small');
      d.className = 'res-slim';
      const lost = Math.round(s.before) - Math.round(s.after);
      const sch = gx(s.cat, 'schudol', 'schudla', 'schudlo');
      d.textContent = s.after < 0.5 ? `🏃 ${s.name} úplne ${sch}!` :
        lost > 0 ? `🏃 ${s.name} ${sch}: váha ${Math.round(s.before)} → ${Math.round(s.after)}` :
          `🐷 ${s.name} sa málo ${gx(s.cat, 'hýbal', 'hýbala', 'hýbalo')}, váha ${Math.round(s.after)}`;
      $('#res-earn').append(d);
    }
    show('result');
  }

  $('#btn-again').addEventListener('click', () => { game.quit(); startSong(current); });
  $('#btn-songs').addEventListener('click', () => { audio.blip(); game.quit(); go('songs'); });
  $('#btn-menu').addEventListener('click', () => { audio.blip(); game.quit(); go('menu'); });

  // Po načítaní fontu prekresliť (kvôli rozmerom)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => game.resize());

  // ---------- Prvé spustenie: výber 2 mačičiek zadarmo ----------
  let welcomePick = [];
  function renderWelcome() {
    const grid = $('#welcome-grid');
    grid.innerHTML = '';
    for (const cat of CATS) {
      const b = document.createElement('button');
      b.className = 'cat-card' + (welcomePick.includes(cat.id) ? ' sel' : '');
      b.innerHTML = '<canvas></canvas><span class="cat-name"></span><span class="badge"></span>';
      b.querySelector('.cat-name').textContent = cat.name;
      const k = welcomePick.indexOf(cat.id);
      b.querySelector('.badge').textContent = k >= 0 ? '✓' : '';
      paintCat(b.querySelector('canvas'), cat, 84, null, 'full');
      b.addEventListener('click', () => {
        audio.init();
        if (welcomePick.includes(cat.id)) welcomePick = welcomePick.filter(x => x !== cat.id);
        else {
          welcomePick.push(cat.id);
          if (welcomePick.length > 2) welcomePick.shift(); // tretia vymení najstaršiu
          audio.preview(cat.voice, 76);
        }
        renderWelcome();
      });
      grid.append(b);
    }
    const btn = $('#btn-welcome');
    btn.disabled = welcomePick.length !== 2;
    btn.textContent = welcomePick.length === 2
      ? `Hotovo: ${welcomePick.map(id => catById(id).name).join(' a ')} ▶`
      : `Vyber ešte ${2 - welcomePick.length} ${welcomePick.length === 1 ? 'mačičku' : 'mačičky'}`;
  }
  $('#btn-welcome').addEventListener('click', () => {
    if (welcomePick.length !== 2) return;
    audio.init();
    audio.blip();
    for (const id of welcomePick) unlockCat(id);
    store.catL = welcomePick[0];
    store.catR = welcomePick[1];
    store.startDay = dayKey();
    shopModel = store.catL;
    detailId = store.catL;
    save();
    syncGame();
    go('menu');
    checkRewards();
    toast('Vitaj v Mačacom zbore! 🎶');
  });

  save();
  renderStats();
  checkDaily();
  if (store.cats.length < 2) { renderWelcome(); show('welcome'); }
  else { show('menu'); checkRewards(); rollSickness(); sickTick(); }
  setInterval(() => { rollSickness(); sickTick(); }, 60000);

  // ---------- Aktualizácie a inštalácia na plochu ----------
  // Service worker: hra ide aj offline, online sa vždy načíta najnovšia verzia.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Ikona na ploche iPhonu nechá hru „uspatú“ v pozadí. Keď sa k nej vrátiš,
  // over, či sa na GitHube niečo nezmenilo, a ak áno, načítaj novú verziu
  // (nie počas rozohranej pesničky).
  const APP_FILES = ['./', 'css/style.css', 'js/songs.js', 'js/audio.js', 'js/cats.js', 'js/shop.js', 'js/game.js', 'js/dictation-sentences.js', 'js/prvouka.js', 'js/main.js'];
  let fingerprint = null;
  let checking = false;

  async function readFingerprint() {
    const parts = await Promise.all(APP_FILES.map(async f => {
      const res = await fetch(f, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) throw new Error(f);
      return res.headers.get('etag') || res.headers.get('last-modified') || '';
    }));
    return parts.join('|');
  }

  async function checkForUpdate() {
    if (checking || fingerprint === null || !navigator.onLine) return;
    if (game.mode === 'play' || game.mode === 'paused') return;
    checking = true;
    try {
      const now = await readFingerprint();
      if (now !== fingerprint && game.mode !== 'play' && game.mode !== 'paused') location.reload();
    } catch (e) { /* bez internetu – hrá sa uložená verzia */ }
    checking = false;
  }

  readFingerprint().then(f => { fingerprint = f; }).catch(() => {});
  window.addEventListener('pageshow', e => { if (e.persisted) checkForUpdate(); });

  // Prístup pre ladenie z konzoly prehliadača (napr. macaciZbor.store.coins)
  window.macaciZbor = { game, audio, store, save, syncGame, limitState: () => ({ task, quiz, clk, lesson, dict, pv }), sickTest: { makeSick, sickTick, giveCare, giveMed, sickEnd, careDue } };
})();
