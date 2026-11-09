# 🐱 Mačací zbor

Rytmická hra pre dva palce. Dve mačky sedia vedľa seba a do rytmu hudby na ne padajú pochúťky.
Každú mačku ovládaš jedným palcom. Keď pochúťku chytíš, mačka zamňauká tón melódie, takže pesničku vlastne „spievajú“ mačky.

- **28 mačiek, všetky odomknuté a zadarmo.** Nie sú tu reklamy ani nákupy.
- **6 pesničiek:** 3 pôvodné skladby a 3 melódie, ktoré sú voľné dielo (ľudová Hviezdička, Beethovenova Óda na radosť a Pre Elišku).
- Funguje v prehliadači na mobile aj na počítači a nič sa neinštaluje.
- Grafika aj zvuk sa generujú kódom (Canvas a Web Audio API). Hra nepoužíva žiadne obrázky ani zvukové súbory, takže pri nich nehrozia problémy s licenciami.

## Ako hrať

| | Mobil | Počítač |
|---|---|---|
| Ľavá mačka | ľavý palec, ťahaj | `A` / `D` |
| Pravá mačka | pravý palec, ťahaj | `←` / `→` (alebo myš) |
| Pauza | tlačidlo vpravo hore | `Esc` |

- Chyť pochúťku do pusy presne vo chvíli, keď dopadne na čiaru.
- **Svietiaca stopa** znamená držanú notu: drž mačku pod stopou až do konca.
- Za 10 chytených pochúťok za sebou sa zvýši násobič bodov (najviac ×4).
- Po 3 chybách hra končí. **Relax režim** v menu vypne prehru.

## Hraj online

👉 **<https://sobrudolph.github.io/macaci-zbor/>**

### Ikona na ploche iPhonu

1. Otvor adresu hore v **Safari**.
2. Ťukni na **Zdieľať** (štvorček so šípkou) a vyber **Pridať na plochu**.
3. Hra sa z plochy otvára na celú obrazovku ako normálna aplikácia a ide aj bez internetu.

Pri každom otvorení s internetom sa načíta najnovšia verzia z GitHubu. Ak bola hra len v pozadí,
pri návrate na ňu sa overí, či nie je novšia verzia, a hra sa sama obnoví (nikdy nie počas pesničky).
Pri aktualizácii stačí zmeny nahrať na GitHub, nič ďalšie netreba meniť.

Zvuk hrá aj pri zapnutom tichom režime (iOS 17 a novší).

## Spustenie na počítači

Stačí ľubovoľný jednoduchý webový server v priečinku projektu, napríklad:

```bash
python -m http.server 8000
```

Potom otvor <http://localhost:8000>.

## Zverejnenie na GitHub Pages

1. Vytvor nový repozitár na GitHube a nahraj doň tieto súbory.
2. V repozitári choď do **Settings → Pages**.
3. V časti **Source** vyber **Deploy from a branch**, potom vetvu `main` a priečinok `/ (root)`.
4. Po minúte bude hra dostupná na `https://<tvoje-meno>.github.io/<nazov-repozitara>/`.

## Štruktúra

```
index.html      – obrazovky (menu, pesničky, mačky, pauza, výsledok)
css/style.css   – vzhľad
js/songs.js     – pesničky (zápis melódie + akordy) a generovanie nôt
js/audio.js     – syntéza zvuku: mňaukanie, bicie, basa, akordy
js/cats.js      – zoznam mačiek a ich kreslenie, pochúťky
js/game.js      – herná logika a vykresľovanie
js/main.js      – menu, výber mačiek, ukladanie rekordov, kontrola aktualizácií
sw.js           – service worker (offline režim, vždy najnovšia verzia)
manifest.webmanifest, icons/ – inštalácia na plochu
```

### Pridanie novej mačky

V `js/cats.js` skopíruj jeden riadok v poli `CATS` a zmeň `id`, `name`, farby, vzor (`pattern`) a doplnok (`acc`).
Zoznam možností je v komentári na začiatku súboru.

### Pridanie novej pesničky

V `js/songs.js` pridaj objekt do poľa `SONGS`. Melódia sa zapisuje textom:

```
C5        nota C5, 1 doba
E5:0.5    osminová nota (pol doby)
r:2       pauza 2 doby
G5:2~     držaná nota (svietiaca stopa)
E5:3>G5   držaná nota, ktorá sa presúva na G5
|         oddeľovač taktov (len pre prehľadnosť)
```

Mačky sa pri spievaní striedajú po taktoch. Vyšší tón padá viac vpravo, nižší viac vľavo.
Hra sa stavia z melódie automaticky, nič sa nemusí kresliť ručne.
Pri používaní cudzích pesničiek si dávaj pozor na autorské práva. Bezpečné sú vlastné skladby a voľné diela.
