'use strict';
/*
 * Prvouka pre 2. ročník – doplňovačky. Texty sú preformulované vlastnými slovami podľa učiva
 * (Slovensko, kalendár, čas, kostra, svaly, bezpečnosť na ceste, dopravné prostriedky).
 *
 * type 'text':     vety, chýbajúce slovo je v {zložených zátvorkách}; extra = slovo navyše, ktoré nikam nepatrí
 * type 'skeleton': obrázok kostry, k označeným miestam sa priraďujú názvy kostí
 * type 'vehicles': obrázky dopravných prostriedkov, k nim sa priraďujú názvy
 * V jednej úlohe sa slovo nesmie opakovať (každá medzera má iné správne slovo).
 */
const PRVOUKA = [
  {
    id: 'slovensko', title: 'Naša krajina', icon: '🇸🇰', type: 'text',
    items: [
      'Krajina, v ktorej žijeme, sa volá Slovenská {republika}.',
      'Každá {obec} na Slovensku patrí do nášho štátu.',
      'Ako samostatný štát vzniklo Slovensko 1. januára {1993}.',
      'Štátna {vlajka} a štátny znak sú symboly štátu.',
    ],
    extra: ['kráľovstvo'],
  },
  {
    id: 'kalendar', title: 'Rok v kalendári', icon: '📅', type: 'text',
    items: [
      'V kalendári sú zapísané dni, týždne a {mesiace} v roku.',
      'Rok má väčšinou {365} dní.',
      'Rok sa delí na {12} mesiacov.',
      'Rok má štyri ročné {obdobia}.',
    ],
    extra: ['24'],
  },
  {
    id: 'obdobia', title: 'Mesiace a ročné obdobia', icon: '🍂', type: 'text',
    items: [
      'Jar: marec, apríl a {máj}.',
      'Leto: jún, {júl} a august.',
      'Jeseň: september, {október} a november.',
      'Zima: december, január a {február}.',
    ],
    extra: ['jún'],
  },
  {
    id: 'cas', title: 'Meriame čas', icon: '⏳', type: 'text',
    items: [
      'Čas stále {plynie} a dá sa merať.',
      'Najčastejšie meriame čas pomocou {hodín}.',
      'Kedysi sa čas meral aj presýpacími hodinami alebo {kyvadlom}.',
      'Základnou jednotkou času je {hodina}.',
      'Kratšie jednotky času sú minúta a {sekunda}.',
    ],
    extra: ['kilogram'],
  },
  {
    id: 'kostra-text', title: 'Kostra', icon: '🦴', type: 'text',
    items: [
      'Kostra je {oporou} nášho tela.',
      'Kostra človeka sa skladá z {kostí}.',
      'Kosti sú navzájom pospájané {kĺbmi}.',
      'Kosti rastú spolu s človekom až do {dospelosti}.',
      'Zlomená kosť sa volá {zlomenina} a môže sa zrásť.',
    ],
    extra: ['svalmi'],
  },
  {
    id: 'kostra-obrazok', title: 'Pomenuj časti kostry', icon: '💀', type: 'skeleton',
    // poradie zodpovedá miestam na obrázku
    answers: ['lebka', 'rebrá', 'chrbtica', 'ramenná kosť', 'stehenná kosť'],
  },
  {
    id: 'svaly', title: 'Svaly', icon: '💪', type: 'text',
    items: [
      'Svaly sú upnuté na {kosti}.',
      'Od svalov závisí každý {pohyb} nášho tela.',
      'Chôdzu alebo úsmev vieme ovládať {vôľou}.',
      'Pohyb {srdca} vôľou ovládať nevieme.',
      'Aby boli svaly silné, treba pravidelne {cvičiť} a zdravo jesť.',
    ],
  },
  {
    id: 'cesta', title: 'Bezpečne na ceste', icon: '🚦', type: 'text',
    items: [
      'Kto ide po ceste pešo, je {chodec}.',
      'Kto vedie dopravný prostriedok, je {vodič}.',
      'Chodci aj vodiči musia dodržiavať {pravidlá} na ceste.',
      'Dopravné {značky} ukazujú príkazy, zákazy a informácie.',
    ],
    extra: ['cestujúci'],
  },
  {
    id: 'doprava-text', title: 'Dopravné prostriedky', icon: '🚗', type: 'text',
    items: [
      'Dopravné prostriedky prevážajú ľudí a {tovar}.',
      'Po súši jazdí auto, autobus a {vlak}.',
      'Po vode sa plaví {loď}.',
      'Vzduchom letí {lietadlo}.',
    ],
    extra: ['koleso'],
  },
  {
    id: 'doprava-obrazky', title: 'Čím cestujeme?', icon: '✈️', type: 'vehicles',
    answers: ['vlak', 'autobus', 'bicykel', 'auto', 'loď', 'lietadlo'],
  },
];

// kontrola: v úlohe sa žiadne slovo nesmie opakovať
for (const ex of PRVOUKA) {
  const words = ex.type === 'text'
    ? [...ex.items.flatMap(s => [...s.matchAll(/\{([^}]+)\}/g)].map(m => m[1])), ...(ex.extra || [])]
    : ex.answers;
  if (new Set(words).size !== words.length) console.warn('Prvouka: opakujúce sa slovo v úlohe', ex.id);
}
