# 🐱 Mačací zbor

Rytmická hra pre dva palce. Dve mačky sedia vedľa seba a do rytmu hudby na ne padajú pochúťky.
Každú mačku ovládaš jedným palcom. Keď pochúťku chytíš, mačka zamňauká tón melódie, takže pesničku vlastne „spievajú“ mačky.

- **29 mačiek.** Na začiatku si vyberieš 2 zadarmo, ostatné sú zamknuté a kúpiš ich za body z hier a učenia
  (obyčajná 8 000, s doplnkom alebo vzorom 12 000, výnimočná 18 000). Nie sú tu reklamy ani nákupy za skutočné peniaze.
  Každú mačku si môžeš premenovať.
- **Odmeny za učenie:** každé dokončené učenie, za ktoré mačička dostane aspoň 1 IQ, sa počíta –
  každých 30 = náhodná vec z obchodu, každých 100 = mačička zadarmo podľa výberu (najviac 1× za mesiac).
  7 dní učenia za sebou = 2 500 bodov, prvé otvorenie dňa = denný bonus 500 bodov.
  IQ: Mačacia škola +1 až +3 za lekciu, Diktát +2 za vetu (−1 za chybu), Prvouka +1 až +2 za úlohu.
- **Choroba (pre rodiča – v hre nie sú žiadne nápovedy):** mačička môže ochorieť najviac 1× za mesiac (nemusí vôbec),
  vždy ostane aspoň jedna zdravá. Chorá leží 3 dni v posteli, nemôže spievať ani sa učiť. Liek z Lekárne (1 500)
  skráti chorobu na polovicu. Opatrovateľka (iná vlastná mačička) jej musí 2× denne (do 14:00 a po 14:00) dať jesť
  a piť zo špajze – za každý deň bez toho sa choroba predĺži o 1 deň. Keď nie sú 2 zdravé mačičky, Mačací zbor sa nedá hrať.
- **Balíčky úloh v učení:** Mačacia škola 2 lekcie, Diktát 4 vety, Prvouka 3 úlohy. Úspešné učenie ubere úlohu
  z balíčka; prázdny predmet sa zamkne („Úlohy sa minuli“) a všetky sa naplnia až keď sa minú všetky –
  dieťa sa tak musí učiť aj predmety, ktoré nemá rado (čakanie ani nový deň ich neodomkne).
- **Večierka:** od 21:00 do 6:00 je cez celú aplikáciu okno „Už je neskoro“ – nedá sa hrať ani učiť a limit sa neodpočítava.
- **Chyby:** v menu sa zapisujú všetky nesprávne odpovede z limitu aj z učenia (posledných 300) so správnou odpoveďou.
- **Ekonomika:** na začiatku 35 000 bodov. Pesnička dá 300 – 750 (podľa obtiažnosti a presnosti),
  Mačacia škola 120 za odpoveď (+300 za 10/10), Diktát 500 za vetu bez chyby, Prvouka 120 za slovo (+200 za všetko správne).
  Jedlo stojí 200 – 1 100, oblečenie 1 500 – 12 000 (zlaté, strieborné a dúhové farby drahšie).
- **22 pesničiek v 4 obtiažnostiach:** pôvodné skladby (aj rap, rock a metal) a melódie, ktoré sú voľné dielo (Hviezdička, Óda na radosť, Pre Elišku, Kánon, Brat Jakub, Zvončeky, Malá nočná hudba, Jar, V jaskyni horského kráľa, Turecký pochod, Kankán, Na krásnom modrom Dunaji).
- **Obchod:** za body z pesničiek kupuješ jedlo (granule, konzervy, mlieko, mlsky) a viac ako 50 druhov oblečenia, okuliarov, obojkov, vodítok a pelechov, každý vo veľa farbách.
- **Starostlivosť:** mačky časom a po pesničkách vyhladnú. Najedené mačky dajú bonus k bodom, hladné menej. Prekŕmené mačky rýchlo priberú a ťažko sa hýbu. Schudnú len pohybom v pesničkách, postupne za viac hier.
- **Diktát:** mačička pomaly 2× nadiktuje po slovensky jednu vetu z 5 slov (2. ročník ZŠ – veľké písmená, dĺžne, mäkčene, otázky),
  dieťa ju napíše a na konci sa opraví s vysvetlením chyby. Za vetu bez chyby +3 IQ, za každú chybu −1 IQ (najnižšie 0). Číta sa cez hlas zariadenia
  (iPhone/iPad aj Android – ak chýba slovenský hlas, hra ukáže, kde ho doinštalovať). Vety sú v `js/dictation-sentences.js`.
- **Prvouka:** doplňovačky pre 2. ročník (Slovensko, kalendár, čas, kostra, svaly, bezpečnosť na ceste, doprava) –
  slová sa prstom presúvajú do rovnako veľkých medzier vo vetách alebo k obrázkom kostry a dopravných prostriedkov.
  Za každé správne slovo +1 IQ. Úlohy sú v `js/prvouka.js`.
- **Hry:** Mačací zbor (rytmická hra), Diktát, Prvouka a **Mačacia škola** – 10 otázok (striedajú sa príklady do 20 a čítanie času z hodín), vždy 3 možnosti a len jedna správna. Za správne odpovede stúpa vybranej mačičke IQ od 0 do 150.
- **Limit 10 minút:** po 10 minútach zapnutej aplikácie príde úloha: 4 príklady na sčítanie a odčítanie do 20
  a 1× ručičkové hodiny – všetkých 5 musí byť správne. (Pôvodne to bola jedna z dvoch úloh:)
  - 5 príkladov na sčítanie a odčítanie do 20,
  - 3× nastaviť ručičkové hodiny na zadaný čas (po 5 minútach, aj popoludňajšie časy ako 20:30).

  Keď je všetko správne, pribudne ďalších 10 minút, inak príde nové kolo rovnakej úlohy.
  Pri učení (Diktát, Mačacia škola, Prvouka) sa čas neodpočítava a limit sa nezapne; po vypršaní limitu sa dá tlačidlom
  „Ísť sa učiť“ učiť ďalej, ostatné časti ostanú zamknuté, kým dieťa nesplní úlohu. Dĺžka limitu je `LIMIT_MIN` v `js/main.js`.

  **Pravidlo výberu úloh:** úlohy sa striedajú. Ak v niektorej robí chyby a v inej nie, dáva sa len tá s chybami
  (počíta sa posledných 10 odpovedí z limitu aj z Mačacej školy). Nová úloha sa pridá do `TASK_TYPES` v `js/main.js`
  a pri odpovediach sa volá `recordSkill(typ, správne)` – pravidlo potom platí aj pre ňu.
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
- Po 3 chybách hra končí.

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
js/shop.js      – obchod: jedlo, oblečenie, farby a ich kreslenie
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

Sprievod sa vyberá cez `style`: `pop`, `soft`, `waltz`, `disco`, `rap`, `rock` alebo `metal`.
Obtiažnosť (`difficulty`) je 1 až 4.

Mačky sa pri spievaní striedajú po taktoch. Vyšší tón padá viac vpravo, nižší viac vľavo.
Hra sa stavia z melódie automaticky, nič sa nemusí kresliť ručne.
Pri používaní cudzích pesničiek si dávaj pozor na autorské práva. Bezpečné sú vlastné skladby a voľné diela.
