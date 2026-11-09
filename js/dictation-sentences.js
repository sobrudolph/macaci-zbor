'use strict';
/*
 * Vety na diktát pre 2. ročník ZŠ. Každá veta má presne 5 slov.
 * Precvičujú sa: veľké písmeno na začiatku vety a pri menách, dĺžne (á, é, í, ó, ú, ý),
 * mäkčene (č, š, ž, ť, ď, ň, ľ), vokáň (ô), dve bodky (ä) a otázky s otáznikom na konci.
 * Zámerne sa vyhýbame vybraným slovám (i/y po obojakých spoluhláskach) – tie sa učia až v 3. ročníku.
 * Novú vetu stačí pridať do zoznamu – pri načítaní sa skontroluje, či má 5 slov.
 */
const DICTATION_SENTENCES = [
  'Mačka pije mlieko z misky.',
  'Peter má malého hnedého psa.',
  'Mama varí dobrú kuraciu polievku.',
  'Kde je moja červená čiapka?',
  'Na stole leží žltá ceruzka.',
  'Zuzka ide ráno do školy.',
  'Čo máš dnes na desiatu?',
  'V lese je veľa zvieratiek.',
  'Ocko číta večer zaujímavú knihu.',
  'Kedy pôjdeme k babke Márii?',
  'Vtáčik spieva na zelenom strome.',
  'Janko sa hrá s loptou.',
  'Prečo je obloha taká modrá?',
  'Naša mačka Micka rada spí.',
  'V zime padá biely sneh.',
  'Bratislava je hlavné mesto Slovenska.',
  'Máš rád sladkú čokoládovú zmrzlinu?',
  'Žaba skáče do studenej vody.',
  'Kto ti dal túto hračku?',
  'Lucia kreslí pekný farebný obrázok.',
  'Ježko nesie na chrbte jablko.',
  'Pôjdeš so mnou na ihrisko?',
  'Dedko má v záhrade včely.',
  'Mišo ráno raňajkuje s ockom.',
  'Kam letia tie biele vtáky?',
  'Ďateľ klope na suchý strom.',
  'Teta Eva upiekla jablkový koláč.',
  'Koník beží cez zelenú lúku.',
  'Kedy sa začínajú letné prázdniny?',
  'Môj brat Tomáš hrá futbal.',
  'Žirafa má veľmi dlhý krk.',
  'Kto zjedol všetky sladké čerešne?',
  'Slnko svieti na modrom nebi.',
  'Ema si obliekla nové šaty.',
  'Na jar kvitnú voňavé kvety.',
  'Čo robí tvoj starší brat?',
  'Babka plietla teplý vlnený sveter.',
  'Ivan cestuje vlakom do Košíc.',
  'Prečo má zajac dlhé uši?',
  'Kačička pláva po tichom jazere.',
  'Učiteľka nám čítala peknú rozprávku.',
  'Videli ste dnes krásnu dúhu?',
  'Martin a Ján idú von.',
  'Na poli pracuje veľký traktor.',
  'Koľko rokov má tvoja sestra?',
  'Medveď hľadá v lese med.',
  'Ľudka nakreslila mamičke pekný kvietok.',
  'Kde si nechal svoju tašku?',
  'Dnes ideme do zoologickej záhrady.',
  'Psík Dunčo šteká na poštára.',
  'Čia je táto modrá taška?',
  'Veverička zbiera v lese oriešky.',
  'Púšťame šarkana na veľkej lúke.',
  'Kedy príde ujo Jožko domov?',
  'Slávka dostala na narodeniny korčule.',
  'Starká varí čaj s medom.',
  'Ide Danka zajtra k zubárovi?',
  'Naša trieda ide do divadla.',
  'Je dnes vonku veľmi teplo?',
  'Dievčatá skáču cez dlhé švihadlo.',
  'Ktorá pastelka je tvoja obľúbená?',
  'Čakáme na autobus pri škole.',
  'Prečo je v noci tma?',
];

// kontrola: každá veta musí mať presne 5 slov a končiť bodkou alebo otáznikom
for (const s of DICTATION_SENTENCES) {
  const n = s.trim().split(/\s+/).length;
  if (n !== 5 || !/[.?]$/.test(s)) console.warn('Diktát: veta nemá 5 slov alebo znamienko na konci:', s);
}
