// Supermarkt-Abteilung für Zutaten, die (noch) nicht im Katalog stehen – damit die Einkaufsliste nicht
// alles unter „Sonstiges“ sammelt. Reine Logik, getestet in tests/aisles.test.js.
// Was ihr selbst einmal zugeordnet habt, steht im Katalog und gilt immer zuerst.
// basic = „Grundvorrat“: steht meist zu Hause (Salz, Öl, Wasser …) und landet unter „Wahrscheinlich schon da“.

const SMALL = new Set(['TL', 'EL', 'Prise', 'Msp']);

// Trinkmilch (nicht Buttermilch, Kondensmilch, Kokosmilch …) – ob sie im Kühlregal oder als H-Milch im Regal steht,
// ist Geschmackssache und lässt sich in den Einstellungen wählen.
export const UHT_AISLE = 'Trockenwaren';
export function isDrinkingMilk(name) {
  const n = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  return /(?:^|[\s-])(?:voll|fettarme?|laktosefreie?|h-|frische)?milch(?:$|[\s,])|vollmilch/.test(n) && !/butter|kondens|kokos|malz|pulver|reis|schokolade|sauer/.test(n);
}
const PLANT_DRINK = /pflanzendrink|pflanzenmilch|hafermilch|sojamilch|mandelmilch|haferdrink|sojadrink|mandeldrink|reisdrink|reismilch/;
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const has = (n, re) => re.test(n);

const HERB = /(basilikum|petersilie|dill|schnittlauch|koriander|minz|rosmarin|thymian|salbei|oregano|majoran|estragon|zitronenmelisse|bohnenkraut|liebstöckel|kerbel|\bkräuter\b)/;
const DRIED = /getrocknet|gerebelt|gemahlen|pulver|\bsamen\b|saat\b|körner|flocken/;

// Reihenfolge zählt: Besonderes vor Allgemeinem („Paprikapulver“ vor „Paprika“, „Kokosmilch“ vor „Milch“).
const RULES = [
  // ---- Dinge, die man nicht (im Supermarkt) einkauft ----
  (n) => has(n, /backpapier|zahnstocher|spieß|spiess|\bfaden\b|raclettegrill|förmchen|dampfgarer|eisstiele|alufolie|frischhaltefolie/) && ['Sonstiges', true],
  (n) => has(n, /^(?:lauwarmes |heißes |kaltes |warmes |kochendes )?wasser(?: oder .+)?$|nudelwasser|kochwasser|stärkewasser/) && ['Sonstiges', true],
  (n) => has(n, /^(?:toppings?|belag)\b|nach wahl$/) && ['Sonstiges', false],
  (n) => has(n, /spülmittel|spülmaschine|geschirrspül|waschmittel|toilettenpapier|küchenrolle|küchenpapier|müllbeutel|müllsäcke|taschentücher|zahnpasta|seife|shampoo|duschgel|schwamm|windeln/) && ['Drogerie', false],
  (n) => has(n, /dekor|lebensmittelfarbe|zuckerperlen|streusel|gefriergetrocknet/) && ['Trockenwaren', false],

  // ---- Tiefkühl ----
  (n) => has(n, /(?:^|[\s(-])tk(?:[\s)-]|$)|tiefkühl|eiscreme|pommes|kroketten|kartoffeltasche|klöße|kloß|knödel(?!teig)|edamame|rösti|fischstäbchen|gefroren/) && ['Tiefkühl', false],
  (n) => n === 'erbsen' && ['Tiefkühl', false],

  // ---- Dosen und Aufstriche vor allem anderen ----
  (n, u) => u === 'Dose' && !has(n, /sahne|milch|hack/) && ['Konserven', false],
  (n) => has(n, /marmelade|konfitüre|honig|sirup|dicksaft|nutella|erdnussbutter|erdnusscreme|cashewmus|nussmus|tahin/) && [has(n, /granatapfelsirup/) ? 'Konserven' : 'Trockenwaren', false],
  (n) => has(n, /gewürzgurke/) && ['Konserven', false],
  (n) => has(n, /8-kräuter|tk-kräuter/) && ['Tiefkühl', false],

  // ---- Gewürze, Öle, Soßen ----
  (n) => has(n, /essig/) && ['Gewürze & Öle', false],
  (n) => has(n, /mineralwasser|sprudel|limonade|\bcola\b|brause|bier\b|wein\b|rotwein|weißwein|kochwein|likör|\bsekt\b|espresso|kaffee|\btee\b|orangensaft|apfelsaft|beeren-?\s?(?:oder \w+)?saft|saft$/) && !has(n, /^saft von|zitronensaft|limettensaft/) && ['Getränke', false],
  (n) => has(n, /sesamöl|kokosöl|kürbiskernöl|walnussöl|geröstetes sesamöl/) && ['Gewürze & Öle', false],
  (n) => has(n, /öl\b/) && ['Gewürze & Öle', !has(n, /sesam|kokos|kürbiskern|walnuss/)],
  (n) => (n === 'fett' || n === 'etwas fett' || has(n, /bratfett/)) && ['Gewürze & Öle', true],
  (n) => has(n, /\bghee\b/) && ['Gewürze & Öle', false],
  (n) => has(n, /butterschmalz/) && ['Kühlregal', false],
  (n, u) => has(n, /(?:^|[\s,-])(?:meer|jod)?salz(?:$|[\s,])|meersalz|pfeffer/) && !has(n, /(?:^|\s)(?:un)?gesalzen/) && ['Gewürze & Öle', true],
  (n) => has(n, /currypaste|curry paste|curry-paste/) && ['Trockenwaren', false],
  (n) => has(n, /paprikamark|ajvar|harissa(?:paste)?$/) && ['Konserven', false],
  (n) => has(n, /paprikapulver|paprika,? ?edelsüß|edelsüß|\bcurry\b|curry(?:pulver)?$|chili(?:pulver|flocken)|cayenne|kreuzkümmel|zimt|muskat|kurkuma|knoblauchpulver|zwiebelpulver|garam masala|nelke|kümmel|kümmelsaat/) && ['Gewürze & Öle', has(n, /paprikapulver|edelsüß|curry|chili|cayenne|kreuzkümmel|zimt|muskat|kurkuma|kümmel/)],
  (n) => has(n, /safran|sumach|\bisot biber|senfkörner|senfsaat|senfsamen|bockshornklee|lorbeer|curryblätter|vanilleschote|vanilleextrakt|^vanille$|mark von \d* ?vanille|gewürznelke|gewürzmischung|gewürzsalz/) && ['Gewürze & Öle', false],
  (n, u) => has(n, HERB) && !has(n, /crème|creme|frischkäse|quark|butter|\bmix\b/) && (has(n, DRIED) || (SMALL.has(u) && !has(n, /frisch/) && has(n, /oregano|thymian|majoran|koriander|rosmarin|salbei|bohnenkraut|italienische kräuter|kräuter der provence/))) && ['Gewürze & Öle', true],
  (n, u) => has(n, /italienische kräuter|kräuter der provence/) && ['Gewürze & Öle', true],
  (n, u) => has(n, /^chili$|^chilis?$/) && SMALL.has(u) && ['Gewürze & Öle', true],
  (n) => has(n, /soja(?:soße|sauce|sosse)|teriyaki|worcester|fischsauce|fischsoße|austernsauce|austernsoße|sriracha|tabasco|sambal|\bsenf\b|ketchup|mayonnaise|\bsalsa\b|gewürzgurke|bambus|sauerkraut|kapern|oliven|preiselbeeren|apfelmus|granatapfelsirup/) && ['Konserven', false],

  // ---- Konserven ----
  (n) => has(n, /tomatenmark|passierte|gehackte tomaten|pizzatomaten|dosentomaten|aus der dose|getrocknete tomaten|getrocknete(?:r)? tomate|\bdose\b|konserve|kokosmilch|kondensmilch|kichererbsen|kidney|pintobohnen|schwarze bohnen|kidneybohnen|\bmais\b|mais in/) && !has(n, /^(?:\d+ )?milch$/) && ['Konserven', false],
  (n) => has(n, /guacamole/) && ['Kühlregal', false],

  // ---- Süßes, Aufstriche, Backzutaten (Trockenwaren) ----
  (n) => (n === 'zucker' || n === 'etwas zucker' || has(n, /vanillezucker|vanillepuddingpulver|puddingpulver|puderzucker|gelierzucker|rohrzucker|(?:^|[\s-])zucker$/)) && ['Trockenwaren', n === 'zucker' || n === 'etwas zucker'],
  (n) => has(n, /malzmilchpulver|milchpulver/) && ['Trockenwaren', false],
  (n) => has(n, /hefeflocken|trockenhefe|backpulver|natron|speisestärke|maisstärke|kartoffelstärke|stärke$|gelatine|agar|kakao|kuvertüre|schokolade|kakaonibs|kakaopulver|schoko|paniermehl|semmelbrösel|löffelbiskuit|vanillesoße/) && [has(n, /löffelbiskuit/) ? 'Backwaren' : has(n, /vanillesoße/) ? 'Kühlregal' : 'Trockenwaren', false],
  (n, u) => has(n, /^hefe$|frischhefe|hefewürfel/) && ['Kühlregal', false],
  (n) => has(n, /brühe|bouillon|\bfond\b|brühepulver/) && ['Trockenwaren', has(n, /gemüsebrühe|^brühe/)],

  // ---- Backwaren ----
  (n) => has(n, /blätterteig|filo|yufka|mürbeteig|pizzateig|flammkuchenteig|hefeteig|knödelteig|strudelteig|nudelteig/) && ['Kühlregal', false],
  (n) => has(n, /brot\b|brote\b|brötchen|toast|naan|pita|tortilla|baguette|ciabatta|crouton|kekse|zwieback|cracker|fladenbrot/) && ['Backwaren', false],

  // ---- Kühlregal ----
  (n) => has(n, /butternut/) && ['Obst & Gemüse', false],
  (n) => has(n, /like schnitzel|pflanzendrink|pflanzenmilch|hafermilch|sojamilch|mandelmilch|veganer|tofu|margarine|miree/) && ['Kühlregal', false],
  (n) => has(n, /milch|sahne|rahm|schmand|crème[ -]fraîche|creme[ -]fraiche|joghurt|jogurt|quark|frischkäse|käse|mozzarella|mascarpone|ricotta|parmesan|\bfeta\b|gouda|emmentaler|brie\b|cheddar|scamorza|hirtenkäse|bergkäse|halloumi|butter\b|buttermilch|\beier?\b|\beigelb|\beiweiß|bio-eier|kefir/) && !has(n, /malzmilch|erdnussbutter|butternut/) && ['Kühlregal', false],

  // ---- Fleisch & Fisch ----
  (n) => has(n, /hackfleisch|rinderhack|\bhack\b|rind|schwein|hähnchen|hühnchen|geflügel|\bpute\b|puten|lamm|speck|bacon|pancetta|schinken|wurst|würstchen|würste|salsiccia|salami|bresaola|schnitzel|filet\b|keule|lachs|fisch|garnele|thunfisch|kotelett|steak/) && ['Fleisch & Fisch', false],

  // ---- Trockenwaren ----
  (n) => has(n, /mehl\b|mehl$|\breis\b|reis$|reisnudel|nudel|pasta|spaghetti|penne|farfalle|makkaroni|orzo|bulgur|couscous|cannelloni|lasagne|haferflocken|instantflocken|haferkekse|linsen|urad dal|nüsse|nuss\b|mandeln|walnüsse|haselnüsse|cashew|erdnüsse|pistazien|pinienkerne|kürbiskerne|sonnenblumenkerne|sesam|kokosraspel|rosinen|trockenpflaumen|getrocknete|datteln|medjool|datteln|trocken/) && ['Trockenwaren', false],
  (n) => has(n, /haferkekse/) && ['Backwaren', false],

  // ---- Obst & Gemüse (zuletzt, weil so viele Wörter darin vorkommen) ----
  (n) => has(n, /zitron|limette|orange\b|oranges?$/) && ['Obst & Gemüse', false],
  (n) => has(n, /zwiebel|schalotte|lauch|porree|knoblauch|möhre|karotte|bundmöhre|kartoffel|süßkartoffel|kürbis|zucchin|aubergine|paprika|tomate|gurke|salat|rucola|römer|romana|kohl|kohlrabi|brokkoli|blumenkohl|spinat|pilz|champignon|pfifferling|shiitake|bohne|erbse|zuckerschote|okra|rettich|radieschen|pastinake|sellerie|pak choi|mangold|fenchel|spargel|mais\b|ingwer|chili|peperoni|avocado|gemüse|rote bete|kräuter/) && ['Obst & Gemüse', false],
  (n) => has(n, HERB) && ['Obst & Gemüse', false],
  (n) => has(n, /apfel|äpfel|birne|banane|mango|himbeere|erdbeere|heidelbeere|brombeere|kirsche|aprikose|pflaume|feige|traube|beere|obst|früchte|frucht|ananas|kiwi|melone|pfirsich|granatapfel|zitrus/) && ['Obst & Gemüse', false],
];

// Sehr allgemeine Wörter, bei denen die Abteilung vom Produkt abhängt (frisch, Dose, TK …) – dort fragt die App nach.
const VAGUE = /^(?:gemüse|obst|früchte?|kräuter|belag|toppings?|beilage|dekoration|deko)(?:\s|$)|(?:^|\s)(?:bohnen?|erbsen?|beeren|pilze|nüsse|mais|oliven)$|\boder\b/;

// options.uhtMilk: Milch wird als H-Milch im Regal gekauft (statt aus dem Kühlregal).
// sure = false: die App ist sich nicht sicher (kein passendes Wort gefunden oder nur ein sehr allgemeines) → ❗ und Nachfrage.
export function guessAisle(name, unit = '', options = {}) {
  const n = norm(name);
  if (options.uhtMilk && (isDrinkingMilk(n) || PLANT_DRINK.test(n))) return { aisle: UHT_AISLE, basic: false, sure: true };
  for (const rule of RULES) {
    const r = rule(n, unit);
    if (r) return { aisle: r[0], basic: !!r[1], sure: !VAGUE.test(n) };
  }
  return { aisle: 'Sonstiges', basic: false, sure: false };
}

// Der Kern einer Zutat ohne Beiwort: „frische Petersilie“, „glatte Petersilie“, „rote Paprika“ sind
// einkaufstechnisch dasselbe. Nur eindeutige Beiwörter fallen weg („rote Bete“ und „rote Linsen“ bleiben).
const LEADING = /^(?:etwas|einige|ca\.?|frische[rsn]?|bio-?|große[rsn]?|kleine[rsn]?|mittelgroße[rsn]?|weiche[rsn]?|sehr weiche[rsn]?|ungesalzene|gesalzene|geschmolzene|lauwarme[sn]?|heiße[sn]?|gemahlene[rsn]?|glatte[rn]?)\s+/;
const COLORED = /^(?:rote[rsn]?|gelbe[rsn]?|orange[rn]?|grüne[rsn]?)\s+(?=paprika|zwiebel|chilischote|chili\b|tomate)/;

export function coreName(name) {
  let n = norm(name);
  for (let i = 0; i < 4; i++) {
    const next = n.replace(LEADING, '').replace(COLORED, '').replace(/^bio-/, '');
    if (next === n) break;
    n = next;
  }
  return n || norm(name);
}
