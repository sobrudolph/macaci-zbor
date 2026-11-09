'use strict';
/* Menu, obrazovky, obchod, kŕmenie, šatník a ukladanie postupu. */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const STORE_KEY = 'macaci-zbor-v1';
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
  if (typeof store.coins !== 'number') {
    // uvítací darček
    store.coins = 5000;
    store.pantry = { 'g-fish': 2, 'm-milk': 1, 't-sticks': 2 };
  }
  if (!store.pantry || typeof store.pantry !== 'object') store.pantry = {};

  const catById = id => CATS.find(c => c.id === id) || CATS[0];
  const chosenCats = () => [catById(store.catL), catById(store.catR)];

  // ---------- Body (peňaženka) ----------
  const COIN_RATE = 0.1; // z bodov v pesničke ide na nákupy len 10 % – treba hrať častejšie
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
    game.looks = cats.map(c => ({ outfit: outfitOf(c.id), hunger: hungerOf(c.id), fat: fatOf(c.id) }));
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
    drawCat(g, cat, px / 2 - f.cx * s, px / 2 - f.cy * s, 105 * s, Object.assign({ t: 0.6, outfit, fat: fatOf(cat.id) }, st));
  }
  function paintFood(cv, food, px) {
    const g = prepCanvas(cv, px, px);
    drawFood(g, food, px / 2, px / 2, px * 0.4);
  }

  // ---------- Obrazovky ----------
  const SCREENS = ['menu', 'games', 'songs', 'school', 'lesson', 'dictation', 'cats', 'cat', 'shop', 'help', 'pause', 'result'];
  let screen = 'menu';
  function show(name) {
    screen = name;
    for (const s of SCREENS) $('#screen-' + s).classList.toggle('hidden', s !== name);
    $('#btn-pause').classList.toggle('hidden', name !== null);
    updateWallets();
    if (name === 'cat') startStage();
  }

  function go(name) {
    if (name === 'songs') renderSongs();
    if (name === 'school') renderSchool();
    if (name !== 'lesson') lessonStop();
    if (name !== 'dictation') dictStop();
    if (name === 'cats') renderCats();
    if (name === 'shop') renderShop();
    if (name === 'cat') { $('#rename').classList.add('hidden'); renderCatDetail(); }
    if (name === 'menu') syncGame();
    show(name);
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
    const hungry = chosenCats().filter(c => hungerOf(c.id) < 25).map(c => c.name);
    const hint = $('#songs-hint');
    hint.classList.toggle('hidden', !hungry.length);
    if (hungry.length) {
      hint.textContent = `${hungry.join(' a ')} ${hungry.length > 1 ? 'sú hladné' : 'je hladná'} – za pesničku dostaneš menej bodov. Nakŕm ich v Mačkách.`;
    }
  }

  let current = null;
  function startSong(song) {
    audio.init();
    current = song;
    syncGame();
    show(null);
    game.start(song, chosenCats(), false);
  }

  // ---------- Zoznam mačiek ----------
  let detailId = store.catL;

  function renderCats() {
    $('#cat-count').textContent = `${CATS.length} mačiek`;
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
      const tags = [];
      if (id === l.id) tags.push('Ľ');
      if (id === r.id) tags.push('P');
      el.querySelector('.badge').textContent = tags.join(' ');
      el.classList.toggle('sel', tags.length > 0);
      el.querySelector('.hslot').innerHTML = hungerBar(hungerOf(id));
      paintCat(el.querySelector('canvas'), cat, 84, outfitOf(id), 'full', { sad: hungerOf(id) < 25 });
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

  function assign(side) {
    const id = detailId;
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
    const foods = FOODS.filter(f => (store.pantry[f.id] || 0) > 0);
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
      toast(`${cat.name} je plná. Ťukni znova a priberie 🐷`);
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
      if (after.cls !== before) toast(`${cat.name} pribrala – je ${after.label.toLowerCase().replace('!', '')}!`);
      else toast(`${cat.name} je prejedená a priberá…`);
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
    for (const t of [{ id: 'food', name: 'Jedlo', icon: '🍗' }, ...SLOTS]) {
      const b = document.createElement('button');
      b.className = 'tab' + (shopTab === t.id ? ' active' : '');
      b.innerHTML = `<span>${t.icon}</span>${t.name}`;
      b.addEventListener('click', () => { audio.blip(); shopTab = t.id; renderShop(); $('#shop-list').scrollTop = 0; });
      tabs.append(b);
    }
    const active = tabs.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const isFood = shopTab === 'food';
    $('#shop-model').classList.toggle('hidden', isFood);
    if (!isFood) {
      const m = catById(shopModel);
      $('#model-name').textContent = m.name;
      paintCat($('#model-cv'), m, 40, outfitOf(m.id), 'head', { noBed: true });
    }
    const list = $('#shop-list');
    list.innerHTML = '';
    if (isFood) renderFoodShop(list); else renderItemShop(list, shopTab);
  }

  function cycleModel(dir) {
    const i = CATS.findIndex(c => c.id === shopModel);
    shopModel = CATS[(i + dir + CATS.length) % CATS.length].id;
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
      list.append(h);
      for (const f of FOODS.filter(x => grp.kinds.includes(x.kind))) {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = `<canvas></canvas><div class="sc-main"><div class="sc-name"></div><div class="sc-sub">+${f.fill} % sýtosti · v špajzi: <b>${store.pantry[f.id] || 0}</b></div></div>`;
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

  // ---------- Limit: 6 minút zapnutej aplikácie, potom úlohy ----------
  // Úlohy sú buď 5 príkladov (sčítanie/odčítanie do 20), alebo 3× nastaviť ručičkové hodiny.
  // Typ sa vyberie náhodne pri každom limite a nemieša sa. Pri chybe príde nové kolo rovnakého typu.
  const LIMIT_MIN = 6;
  const QUIZ_LEN = 5;
  const CLOCK_LEN = 3;
  if (typeof store.timeLeft !== 'number' || !isFinite(store.timeLeft)) store.timeLeft = LIMIT_MIN * 60;
  store.timeLeft = Math.min(store.timeLeft, LIMIT_MIN * 60);
  let limitOpen = false;
  let task = null;      // 'math' | 'clock'
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

  // čas beží vždy, keď je aplikácia zapnutá a na obrazovke (aj v menu, obchode…)
  let tickN = 0;
  setInterval(() => {
    if (document.hidden || limitOpen) return;
    store.timeLeft = Math.max(0, store.timeLeft - 1);
    updateTimePill();
    if (store.timeLeft <= 0) openLimit();
    else if (++tickN % 5 === 0) save();
  }, 1000);

  function limitCard(name) {
    for (const n of ['wall', 'quiz', 'clock', 'done']) $('#limit-' + n).classList.toggle('hidden', n !== name);
  }

  function openLimit() {
    if (limitOpen) return;
    limitOpen = true;
    if (game.mode === 'play') doPause(); // pesnička počká, po splnení úloh pokračuje
    if (window.speechSynthesis) window.speechSynthesis.cancel(); // diktát stíchne
    // typ úlohy sa uloží, aby sa nedal "prehodiť" zatvorením aplikácie
    if (!TASK_TYPES.includes(store.limitTask)) {
      store.limitTask = pickTask();
      skillOf(store.limitTask).last = Date.now();
    }
    task = store.limitTask;
    save();
    $('#limit-min').textContent = LIMIT_MIN;
    $('#limit-text').textContent = `Aplikácia bola zapnutá ${LIMIT_MIN} minút. Splň úlohu a dostaneš ďalších ${LIMIT_MIN} minút.`;
    $('#limit-task').textContent = task === 'clock'
      ? `Úloha: 🕐 ${CLOCK_LEN}× správne nastav ručičkové hodiny`
      : `Úloha: ➕ ${QUIZ_LEN} príkladov na sčítanie a odčítanie`;
    limitCard('wall');
    $('#limit').classList.remove('hidden');
  }

  function startTask() {
    if (task === 'clock') startClock(); else startQuiz();
  }

  const dots = (items, cur, isOk) => items.map((q, i) =>
    `<i class="${q.done ? (isOk(q) ? 'ok' : 'bad') : i === cur ? 'cur' : ''}"></i>`).join('');

  // ===== Príklady =====
  /** 5 príkladov: sčítanie a odčítanie do 20 (výsledok 1–20), aspoň 2 z každého druhu. */
  function makeProblems() {
    const ops = ['+', '+', '−', '−', Math.random() < 0.5 ? '+' : '−'].sort(() => Math.random() - 0.5);
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
    quiz = { probs: makeProblems(), i: 0, input: '', busy: false };
    limitCard('quiz');
    renderQuiz();
  }

  function renderQuiz(state) {
    const p = quiz.probs[quiz.i];
    $('#quiz-dots').innerHTML = dots(quiz.probs, quiz.i, q => q.ans === q.res);
    $('#quiz-label').textContent = `Príklad ${quiz.i + 1} z ${QUIZ_LEN}`;
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
      else finishTask(quiz.probs.map(p => ({
        ok: p.ans === p.res,
        text: p.ans === p.res ? `${p.a} ${p.op} ${p.b} = ${p.res} ✓` : `${p.a} ${p.op} ${p.b} = ${p.ans} ✗  (správne je ${p.res})`,
      })));
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

  /** 3 rôzne časy, hodiny 1–23 (aj popoludní, napr. 20:30), minúty po 5. */
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
    $('#clock-dots').innerHTML = dots(clk.probs, clk.i, q => q.ok);
    $('#clock-label').textContent = `Hodiny ${clk.i + 1} z ${CLOCK_LEN}`;
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
      else finishTask(clk.probs.map(q => {
        if (q.ok) return { ok: true, text: `🕐 ${fmtHM(q.h, q.m)} ✓` };
        const why = [];
        if (q.set.mn !== q.m) why.push(`veľká ručička bola na ${q.set.mn / 5 || 12}, má byť na ${q.m / 5 || 12}`);
        const want = q.m === 0 ? `na ${q.h % 12 || 12}` : `medzi ${q.h % 12 || 12} a ${(q.h % 12) + 1}`;
        if (!clockOk(q.set.hp, q.m, q.h, q.m)) why.push(`malá ručička bola ${hourHandText(q.set.hp)}, má byť ${want}`);
        return { ok: false, text: `🕐 ${fmtHM(q.h, q.m)} ✗  (${why.join('; ')})` };
      }));
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
      : task === 'clock'
        ? `Treba mať všetky ${CLOCK_LEN} hodiny správne. Skús ďalšie ${CLOCK_LEN}.`
        : `Treba mať všetkých ${QUIZ_LEN} správne. Skús ďalších ${QUIZ_LEN} príkladov.`;
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
    $('#btn-done').textContent = all ? '▶ Hrať ďalej' : task === 'clock' ? `Ďalšie ${CLOCK_LEN} hodiny` : `Ďalších ${QUIZ_LEN} príkladov`;
    $('#btn-done').dataset.ok = all ? '1' : '';
    limitCard('done');
    if (all) {
      store.timeLeft = LIMIT_MIN * 60;
      delete store.limitTask; // nabudúce sa typ úlohy vyberie znova
      save();
      updateTimePill();
    }
  }

  $('#btn-add-limit').addEventListener('click', () => { audio.init(); audio.blip(); startTask(); });
  $('#btn-done').addEventListener('click', () => {
    audio.blip();
    if (!$('#btn-done').dataset.ok) { startTask(); return; } // rovnaký typ úlohy znova
    quiz = null;
    clk = null;
    limitOpen = false;
    $('#limit').classList.add('hidden');
  });
  window.addEventListener('resize', () => { if (clk && !$('#limit-clock').classList.contains('hidden')) drawClock(); });

  updateTimePill();
  if (store.timeLeft <= 0) openLimit(); // zatvorenie a otvorenie aplikácie limit neobíde

  // ---------- Mačacia škola: 10 otázok, vždy 3 možnosti a len jedna správna ----------
  // Striedajú sa príklady (sčítanie/odčítanie do 20) a čítanie času z ručičkových hodín.
  // Za každú správnu odpoveď stúpne vybranej mačičke IQ (začína na 0, najviac 150).
  const IQ_MAX = 150;
  const LESSON_LEN = 10;
  const LESSON_COINS = 150;   // body na nákupy za každú správnu odpoveď
  const IQ_PERFECT_BONUS = 2; // navyše za 10 z 10

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
    $('#school-title').textContent = dictMode ? 'Diktát' : 'Mačacia škola';
    $('#school-hint').textContent = dictMode
      ? 'S ktorou mačičkou chceš písať diktát? Za každú vetu bez chyby jej stúpne IQ (od 0 až do 150).'
      : 'S ktorou mačičkou sa chceš učiť? Za každú správnu odpoveď jej stúpne IQ (od 0 až do 150).';
    const grid = $('#school-grid');
    grid.innerHTML = '';
    for (const cat of CATS) {
      const b = document.createElement('button');
      b.className = 'cat-card iq-card';
      b.innerHTML = '<canvas></canvas><span class="cat-name"></span><span class="iq-txt"></span><span class="iqbar"><i></i></span>';
      b.querySelector('.cat-name').textContent = cat.name;
      const v = iqOf(cat.id);
      b.querySelector('.iq-txt').textContent = `IQ ${v}`;
      b.querySelector('.iqbar i').style.width = Math.max(2, (v / IQ_MAX) * 100) + '%';
      paintCat(b.querySelector('canvas'), cat, 84, outfitOf(cat.id), 'full');
      b.addEventListener('click', () => { audio.init(); audio.blip(); if (dictMode) startDictation(cat.id); else startLesson(cat.id); });
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
      const before = iqOf(cat.id);
      addIq(cat.id, 1);
      if (iqOf(cat.id) > before) popIq('+1 IQ');
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
    if (perfect) addIq(cat.id, IQ_PERFECT_BONUS);
    const coins = good * LESSON_COINS;
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
    $('#end-iq').textContent = `${cat.name}: IQ ${lesson.startIq} → ${now}` +
      (perfect ? ` (+${IQ_PERFECT_BONUS} bonus za všetko správne)` : '') + (now >= IQ_MAX ? ' · Génius! 🎓' : '');
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
  const DICT_IQ = 3;           // IQ za vetu bez chyby (s chybou IQ nepribudne)
  const DICT_COINS = 200;      // body na nákupy za vetu bez chyby
  const DICT_RATE = 0.62;      // pomalé diktovanie
  const DICT_REPEATS = 2;      // koľkokrát za sebou sa veta prečíta, potom sa dá pustiť znova

  const speech = window.speechSynthesis || null;
  let skVoice = null, voicesLoaded = false;
  function pickVoice() {
    if (!speech) return;
    const vs = speech.getVoices();
    if (vs.length) voicesLoaded = true;
    skVoice = vs.find(v => /^sk([-_]|$)/i.test(v.lang)) || null;
  }
  if (speech) {
    pickVoice();
    if (speech.addEventListener) speech.addEventListener('voiceschanged', pickVoice);
    else speech.onvoiceschanged = pickVoice;
  }

  let dict = null;
  let dictCatId = null;
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
    const warn = $('#dict-warn');
    if (!speech) { warn.textContent = 'Tento prehliadač nevie čítať nahlas, diktát tu nepôjde.'; warn.classList.remove('hidden'); }
    else if (voicesLoaded && !skVoice) { warn.textContent = 'Na tomto zariadení chýba slovenský hlas, diktát môže znieť zvláštne.'; warn.classList.remove('hidden'); }
    else warn.classList.add('hidden');
  }

  function updatePlay() {
    const b = $('#btn-dict-play');
    if (!dict) return;
    b.disabled = dict.speaking;
    b.textContent = dict.speaking ? `🔊 Diktujem… (${dict.pass}/${DICT_REPEATS})` : '▶ Prehrať vetu znova';
  }

  /** Prečíta jednu vetu nahlas; vráti sa, keď dočíta (alebo po bezpečnom čase, ak iPhone nezavolá onend). */
  function sayOnce(text) {
    return new Promise(res => {
      if (!speech) { setTimeout(res, 400); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'sk-SK';
      if (skVoice) u.voice = skVoice;
      u.rate = DICT_RATE;
      u.pitch = 1.05;
      let done = false;
      const fin = () => { if (!done) { done = true; clearTimeout(tm); res(); } };
      const tm = setTimeout(fin, 3000 + text.length * 170);
      u.onend = fin;
      u.onerror = fin;
      speech.speak(u);
    });
  }

  /** Nadiktuje vetu pomaly 2× za sebou, potom sa dá znova pustiť tlačidlom. */
  async function dictate() {
    if (!dict || dict.speaking || dict.checked) return;
    const token = ++dict.token;
    const d = dict;
    d.speaking = true;
    if (speech) speech.cancel();
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
      : `${cat.name} tentoraz IQ nedostane. Skús ďalšiu vetu!`;
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

  // ---------- Výsledok ----------
  game.onEnd = r => {
    const prev = store.best[current.id] || { score: 0, stars: 0 };
    const isNew = r.score > prev.score;
    store.best[current.id] = { score: Math.max(prev.score, r.score), stars: Math.max(prev.stars, r.stars) };

    // body na nákupy: bonus za najedené mačky, menej za hladné a tučné
    const cats = chosenCats();
    const bonus = cats.reduce((s, c) => s + moodOf(hungerOf(c.id)).bonus, 0);
    const fatPen = cats.reduce((s, c) => s + weightOf(fatOf(c.id)).bonus, 0);
    const earned = Math.max(0, Math.round(r.score * COIN_RATE * (1 + bonus + fatPen)));
    store.coins += earned;
    // chudnutie: podľa toho, koľko sa mačka v pesničke nachodila
    const slim = [];
    cats.forEach((c, i) => {
      setHunger(c.id, hungerOf(c.id) - SONG_COST);
      const before = fatOf(c.id);
      if (before <= 0) return;
      const loss = Math.min(FAT_SONG_MAX, ((r.moved && r.moved[i]) || 0) * FAT_PER_MOVE);
      setFat(c.id, before - loss);
      slim.push({ name: c.name, before, after: fatOf(c.id) });
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
      d.textContent = s.after < 0.5 ? `🏃 ${s.name} úplne schudla!` :
        lost > 0 ? `🏃 ${s.name} schudla: váha ${Math.round(s.before)} → ${Math.round(s.after)}` :
          `🐷 ${s.name} sa málo hýbala, váha ${Math.round(s.after)}`;
      $('#res-earn').append(d);
    }
    show('result');
  }

  $('#btn-again').addEventListener('click', () => { game.quit(); startSong(current); });
  $('#btn-songs').addEventListener('click', () => { audio.blip(); game.quit(); go('songs'); });
  $('#btn-menu').addEventListener('click', () => { audio.blip(); game.quit(); go('menu'); });

  // Po načítaní fontu prekresliť (kvôli rozmerom)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => game.resize());

  save();
  show('menu');

  // ---------- Aktualizácie a inštalácia na plochu ----------
  // Service worker: hra ide aj offline, online sa vždy načíta najnovšia verzia.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Ikona na ploche iPhonu nechá hru „uspatú“ v pozadí. Keď sa k nej vrátiš,
  // over, či sa na GitHube niečo nezmenilo, a ak áno, načítaj novú verziu
  // (nie počas rozohranej pesničky).
  const APP_FILES = ['./', 'css/style.css', 'js/songs.js', 'js/audio.js', 'js/cats.js', 'js/shop.js', 'js/game.js', 'js/dictation-sentences.js', 'js/main.js'];
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
  window.macaciZbor = { game, audio, store, save, syncGame, limitState: () => ({ task, quiz, clk, lesson, dict }) };
})();
