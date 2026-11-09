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
  const store = Object.assign({ catL: 'mica', catR: 'rysavec', relax: false, best: {} }, load());
  for (const k of ['best', 'owned', 'outfits', 'hunger', 'names', 'fat']) {
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
  const SCREENS = ['menu', 'songs', 'cats', 'cat', 'shop', 'help', 'pause', 'result'];
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
    game.start(song, chosenCats(), store.relax);
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
    $$('.cat-card').forEach(el => {
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
        fat >= 25 ? 'Je ťažšia a pomalšia. Čím viac sa v pesničkách hýbe, tým rýchlejšie schudne.' : 'Keď ju prekŕmiš (nad 100 % sýtosti), rýchlo priberie.'}</div>`;
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

  // ---------- Limit: 10 minút zapnutej aplikácie, potom 5 príkladov ----------
  const LIMIT_MIN = 10;
  const QUIZ_LEN = 5;
  if (typeof store.timeLeft !== 'number' || !isFinite(store.timeLeft)) store.timeLeft = LIMIT_MIN * 60;
  let limitOpen = false;
  let quiz = null;
  const rand = n => Math.floor(Math.random() * n);
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
    for (const n of ['wall', 'quiz', 'done']) $('#limit-' + n).classList.toggle('hidden', n !== name);
  }

  function openLimit() {
    if (limitOpen) return;
    limitOpen = true;
    if (game.mode === 'play') doPause(); // pesnička počká, po vyriešení príkladov pokračuje
    save();
    $('#limit-min').textContent = LIMIT_MIN;
    limitCard('wall');
    $('#limit').classList.remove('hidden');
  }

  /** 5 príkladov: sčítanie a odčítanie do 20 (výsledok 0–20), aspoň 2 z každého druhu. */
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
      return { a, b, op, res: op === '+' ? a + b : a - b, ans: null };
    });
  }

  function startQuiz() {
    quiz = { probs: makeProblems(), i: 0, input: '', busy: false };
    limitCard('quiz');
    renderQuiz();
  }

  function renderQuiz(state) {
    const p = quiz.probs[quiz.i];
    $('#quiz-dots').innerHTML = quiz.probs.map((q, i) =>
      `<i class="${q.ans == null ? (i === quiz.i ? 'cur' : '') : q.ans === q.res ? 'ok' : 'bad'}"></i>`).join('');
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
    b.addEventListener('click', () => { audio.init(); quizKey(k); });
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
    const ok = p.ans === p.res;
    if (ok) audio.preview(chosenCats()[0].voice, 79); else audio.miss(audio.ui);
    quiz.busy = true;
    renderQuiz(ok ? 'ok' : 'bad');
    setTimeout(() => {
      quiz.busy = false;
      quiz.i++;
      quiz.input = '';
      if (quiz.i < QUIZ_LEN) renderQuiz(); else finishQuiz();
    }, 700);
  }

  function finishQuiz() {
    const good = quiz.probs.filter(p => p.ans === p.res).length;
    const all = good === QUIZ_LEN;
    $('#done-icon').textContent = all ? '🎉' : '🙀';
    $('#done-title').textContent = all ? `Výborne! ${good} z ${QUIZ_LEN}` : `${good} z ${QUIZ_LEN} správne`;
    $('#done-text').textContent = all
      ? `Máš ďalších ${LIMIT_MIN} minút.`
      : `Treba mať všetkých ${QUIZ_LEN} správne. Skús ďalších ${QUIZ_LEN} príkladov.`;
    const rev = $('#done-review');
    rev.innerHTML = '';
    if (!all) {
      for (const p of quiz.probs) {
        const li = document.createElement('li');
        const ok = p.ans === p.res;
        li.className = ok ? 'ok' : 'bad';
        li.textContent = ok ? `${p.a} ${p.op} ${p.b} = ${p.res} ✓` : `${p.a} ${p.op} ${p.b} = ${p.ans} ✗  (správne je ${p.res})`;
        rev.append(li);
      }
    }
    $('#btn-done').textContent = all ? '▶ Hrať ďalej' : `Ďalších ${QUIZ_LEN} príkladov`;
    $('#btn-done').dataset.ok = all ? '1' : '';
    limitCard('done');
    if (all) {
      store.timeLeft = LIMIT_MIN * 60;
      save();
      updateTimePill();
    }
  }

  $('#btn-add-limit').addEventListener('click', () => { audio.init(); audio.blip(); startQuiz(); });
  $('#btn-done').addEventListener('click', () => {
    audio.blip();
    if (!$('#btn-done').dataset.ok) { startQuiz(); return; }
    quiz = null;
    limitOpen = false;
    $('#limit').classList.add('hidden');
  });

  updateTimePill();
  if (store.timeLeft <= 0) openLimit(); // zatvorenie a otvorenie aplikácie limit neobíde

  // ---------- Výsledok ----------
  game.onEnd = r => {
    const prev = store.best[current.id] || { score: 0, stars: 0 };
    const isNew = r.score > prev.score;
    store.best[current.id] = { score: Math.max(prev.score, r.score), stars: Math.max(prev.stars, r.stars) };

    // body na nákupy: bonus za najedené mačky, menej za hladné, polovica v relax režime
    const cats = chosenCats();
    const bonus = cats.reduce((s, c) => s + moodOf(hungerOf(c.id)).bonus, 0);
    const fatPen = cats.reduce((s, c) => s + weightOf(fatOf(c.id)).bonus, 0);
    const earned = Math.max(0, Math.round(r.score * (1 + bonus + fatPen) * (store.relax ? 0.5 : 1)));
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
    if (store.relax) notes.push('relax režim ½');
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

  // ---------- Nastavenia ----------
  const relax = $('#opt-relax');
  relax.checked = !!store.relax;
  relax.addEventListener('change', () => { store.relax = relax.checked; save(); });

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
  const APP_FILES = ['./', 'css/style.css', 'js/songs.js', 'js/audio.js', 'js/cats.js', 'js/shop.js', 'js/game.js', 'js/main.js'];
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
  window.macaciZbor = { game, audio, store, save, syncGame };
})();
