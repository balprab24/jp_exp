// Main-brand curation for every site category. Shared by sync-inventory.js
// (full Clover re-import) and reprocess-inventory.js (one-time pass over the
// committed JSON, no xlsx needed).
//
// Three jobs:
//   1. Rewrite brand misspellings in item names (BRAND_ALIASES) so substring
//      brand filters in the HTML UI match consistently.
//   2. Re-categorize mis-tagged items based on the brand in the name (e.g.
//      "Hennesy VS 100 ml" tagged Liquor in Clover → Cognac).
//   3. Drop items whose name doesn't match a curated main brand for their
//      category — the user only wants real-brand products surfaced.
//
// Non-curated categories (anything not in CURATED_BRANDS) pass through
// untouched. All keywords are lowercased; match is substring.

const SPIRIT_CATEGORIES = new Set(['Cognac', 'Tequila', 'Whiskey', 'Vodka', 'Rum']);

// Keep this in sync with CATEGORY_BRANDS in index.html — the checkbox UI uses
// a subset of these as featured brands, and curation uses the full list as
// the main-brand whitelist.
const CURATED_BRANDS = {
  Cognac: [
    'hennessy', 'remy martin', 'courvoisier', "d'usse", 'dusse', 'martell',
    'camus', 'salignac', 'st remy', 'st-remy', 'conjure',
  ],
  Tequila: [
    'casamigos', 'don julio', 'patron', 'patrón', 'clase azul', '1800',
    'cazadores', 'hornitos', 'jose cuervo', 'cuervo', 'espolon', 'espolòn',
    'avion', 'herradura', 'milagro', 'teremana', 'cabo wabo', 'camarena',
    'deleon', 'el jimador', 'sauza', 'olmeca',
  ],
  Whiskey: [
    "jack daniel", 'crown royal', 'crown black', 'crown xo', 'crown honey',
    'crown gift', 'crown regal', 'buchanan', 'johnnie walker', 'jameson',
    'jim beam', 'bulleit', "maker's mark", 'makers mark', 'wild turkey',
    'knob creek', 'woodford', 'glenfiddich', 'glenlivet', 'macallan',
    "chiva's regal", 'chivas', 'dewar', 'fireball', 'skrewball', 'pendleton',
    'evan williams', 'black velvet', 'canadian club', 'canadian hunter',
    "seagram's 7", "seagrams 7", 'seagram 7', "seagram's seven",
    'seagrams seven', "seagram's vo", 'seagrams vo', 'jp wiser', 'high west',
    'old forester', 'southern comfort', 'thompson', 'kessler', 'irish manor',
    'mist canadian', 'rich&rare',
  ],
  Vodka: [
    'tito', 'grey goose', 'smirnoff', 'absolut', 'stoli', 'stolichnaya',
    'ciroc', 'belvedere', 'new amsterdam', 'amsterdam', 'svedka', 'pinnacle',
    'three olives', 'three olive', 'ketel one', 'pink whitney', 'pinkwhitney',
    'burnett', 'skyy', 'skol', 'taaka', 'pucker', 'twenty grand', 'uv vodka',
    'u v vodka', 'aristocrat', 'aristocart', 'fleischmann', 'smithworks',
    'platinum 7x',
  ],
  Rum: [
    'bacardi', 'captain morgan', 'captain original', 'malibu', 'kraken',
    'mount gay', 'gosling', 'don q', 'sailor jerry', 'myers', 'appleton',
    'admiral nelson', 'cruzan', 'parrot bay', 'bumbu', 'rum chata',
    'rumchata', 'rumple minze', 'wray',
  ],
  Beer: [
    'bud', 'budweiser', 'bud light', 'bud ice', 'budlight', 'miller',
    'coors', 'modelo', 'corona', 'heineken', 'michelob', 'stella',
    'blue moon', 'bluemoon', 'angry orchard', 'twisted tea', "mike's",
    'mikes', 'white claw', 'truly', 'smirnoff ice', 'pabst', 'pbr',
    'yuengling', 'new belgium', 'fat tire', 'sierra nevada', 'dos equis',
    'pacifico', 'sam adams', 'rolling rock', 'busch', 'bush', 'keystone',
    'tecate', 'simply spiked', "beck's", 'becks', 'high life', "hamm's",
    'hamms', 'olde english', 'old english', 'old style', 'colt 45',
    'natural ice', 'natural light', 'steel reserve', 'four loko',
    'cayman jack', 'cutwater', 'cut water', 'red stripe', 'leinenkugel',
    'seagrams escapes', "seagram's escapes", 'mxd', 'pirate water',
    'classic ice', 'guinness', 'dos xx', 'landshark', 'labatt',
    'mgd', 'lime-a-rita', 'straw-ber-rita', 'ritas', 'arizona', 'cacti',
    'bahama mama', 'cerveza', 'estrella', 'champale', 'club tails',
    'clubtails', 'colt45', 'coronita', 'coco rita', 'lime rita',
    'mountain dew hard', 'hard mtn', 'mountain dew', 'pirate punch',
    'mist twst', 'smurfs', 'spykes', 'bud ice', 'high noon', 'monster',
    'red bull',
  ],
  Wine: [
    'sutter home', 'shutter home', 'arbor mist', 'arbormist', 'gallo',
    'carlo rossi', 'carlo rassi', 'stella rosa', 'md 20', "boone's",
    'boones', 'yellow tail', "daily's", 'dailys', 'j roget', 'riunite',
    'barefoot', 'apothic', 'josh cellars', 'kendall-jackson',
    'kendall jackson', 'andre', 'menage', 'peter vella', 'capriccio',
    'il conte', 'mogen david', 'myx fusion', 'san antonio', 'xxl moscato',
    "cook's", 'cooks', 'gloria', 'wild irish', 'wild irish rose',
    "richards wild", 'korbel', 'moet', 'dom perignon', 'veuve', 'belaire',
    'belair', 'moscato', 'merlot', 'cabernet', 'chardonnay', 'pinot',
    'sauvignon', 'riesling', 'zinfandel', 'dark horse', 'franzia',
    'meiomi', '19 crimes', 'beringer', 'mondavi', 'martini & rossi',
    'martini rossi', 'martini and rossi', 'next round', 'moskato',
    'champagne', 'prosecco', 'asti',
  ],
  Smokes: [
    'newport', 'marlboro', 'malboro', 'camel', 'black & mild',
    'black and mild', 'black mild', 'black n mild', 'swisher', 'backwood',
    'backwoods', 'dutch', 'white owl', 'whiteowl', 'w owl', 'game',
    'phillies', 'djarum', 'captain black', 'honey berry', 'garcia',
    'kool', 'lucky strike', 'parliament', 'virginia slim',
    'american spirit', 'pall mall', 'l&m', 'doral', 'maverick',
    'meverick', 'hawana', 'havana', 'salem', 'good times', 'boss leaf',
    'flat wrap', 'loose leaf', 'show cigarillos', 'cheyenne',
    'optimo', 'geek bar', 'greek bar', 'jackpot', 'old port',
    '4ks', 'zyn', 'on!', 'juul', 'vuse',
  ],
  Liquor: [
    'bailey', "bailey's", 'jagermeister', 'jager', 'bombay', 'tanqueray',
    'beefeater', "hendrick", 'hpnotiq', 'hypnotic', 'alize', '99 apples',
    '99 peaches', '99 watermelons', '99 bananas', '99', 'belaire', 'belair',
    'e&j', 'e & j', 'e j', 'paul masson', 'martini', 'sambuca', 'kahlua',
    'disaronno', 'amaretto', 'frangelico', 'goldschlager', 'goldschläger',
    'southern comfort', 'tuaca', 'everclear', 'christian brothers',
    'korbel', 'st germain', 'st-germain', 'schnapps', 'canadian mist',
    'ole smoky', 'old smoky', 'wild irish', 'grand marnier', 'cointreau',
    'triple sec', 'boulaine', 'lobos', 'lunazul', 'casa amigos',
    'castillo', 'coronet', 'hartley', 'odessa', 'stock 84', 'uv blue',
    'kinky', 'on the rocks', 'harley brandy', 'don ramon', "seagram's",
    'seagrams', 'gordon', 'svedka', 'don julio', 'dailys poptails',
    'buzz ball', 'buzzball', 'buzzballz', 'chi chi', "chi-chi",
    'cosmopolitan cocktail', 'vsop', 'gin', 'brandy', 'tequila rose',
    'cognac',
  ],
};

// Typo → canonical rewrites. Word-bounded so "martell" is not double-rewritten
// and "cannadian" inside "Cannadian Club" becomes "Canadian".
const BRAND_ALIASES = [
  { from: /\bhennesy\b/gi, to: 'Hennessy' },
  { from: /\bhenessy\b/gi, to: 'Hennessy' },
  { from: /\bhennessey\b/gi, to: 'Hennessy' },
  { from: /\bhennssy\b/gi, to: 'Hennessy' },
  { from: /\bciroq\b/gi, to: 'Ciroc' },
  { from: /\bpatrone\b/gi, to: 'Patron' },
  { from: /\bcannadian\b/gi, to: 'Canadian' },
  { from: /\bjosecuervo\b/gi, to: 'Jose Cuervo' },
  { from: /\bcrownroyal\b/gi, to: 'Crown Royal' },
  { from: /\bcrown royale\b/gi, to: 'Crown Royal' },
  { from: /\bremymartin\b/gi, to: 'Remy Martin' },
  { from: /\bmartel\b/gi, to: 'Martell' },
  { from: /\bd\s*'?\s*usse\b/gi, to: "D'Usse" },
  { from: /\bgray goose\b/gi, to: 'Grey Goose' },
  { from: /\bgrey groose\b/gi, to: 'Grey Goose' },
  { from: /\bnew amsterdan\b/gi, to: 'New Amsterdam' },
  { from: /\brumchata\b/gi, to: 'Rum Chata' },
  { from: /\baristocart\b/gi, to: 'Aristocrat' },
  { from: /\bshutter home\b/gi, to: 'Sutter Home' },
  { from: /\bcarlo rassi\b/gi, to: 'Carlo Rossi' },
  { from: /\bmalboro\b/gi, to: 'Marlboro' },
  { from: /\bmeverick\b/gi, to: 'Maverick' },
  { from: /\bbackwood russion\b/gi, to: 'Backwood Russian' },
  { from: /\bberry duch\b/gi, to: 'Berry Dutch' },
  { from: /\bwhiteowl\b/gi, to: 'White Owl' },
  { from: /\bbluemoon\b/gi, to: 'Blue Moon' },
  { from: /\bbudlight\b/gi, to: 'Bud Light' },
  { from: /\bgoldschläger\b/gi, to: 'Goldschlager' },
  { from: /\bjagermelter\b/gi, to: 'Jagermeister' },
  { from: /\bhypnotic\b/gi, to: 'Hpnotiq' },
  { from: /\b99watermrlons\b/gi, to: '99 Watermelons' },
  { from: /\b99shot\b/gi, to: '99' },
  { from: /99'\s?/g, to: '99 ' },                         // "99' Apples" → "99 Apples"
  { from: /\bmoskato\b/gi, to: 'Moscato' },
  { from: /\bchurvoisier\b/gi, to: 'Courvoisier' },
  { from: /\bcrow royal\b/gi, to: 'Crown Royal' },
  { from: /\bbug light\b/gi, to: 'Bud Light' },
  { from: /\bcaymanjack\b/gi, to: 'Cayman Jack' },
  { from: /\bclassicice\b/gi, to: 'Classic Ice' },
  { from: /\bcap morgan\b/gi, to: 'Captain Morgan' },
  { from: /\bblackn? ?mild\b/gi, to: 'Black & Mild' },    // "Blackn mild" / "Black mild" / "Blackmild"
  { from: /\bblack ?& ?mild sweets\b/gi, to: 'Black & Mild Sweets' },
  { from: /\bblackmildsweets\b/gi, to: 'Black & Mild Sweets' },
  { from: /\bdutuch\b/gi, to: 'Dutch' },
  { from: /\bbillonaire\b/gi, to: 'Billionaire' },
  { from: /\b99 ?'?\s*apples\b/gi, to: '99 Apples' },
  { from: /\b99 ?'?\s*peaches\b/gi, to: '99 Peaches' },
  { from: /\barbormist\b/gi, to: 'Arbor Mist' },
  { from: /\barbot mist\b/gi, to: 'Arbor Mist' },
  { from: /\bcorana\b/gi, to: 'Corona' },
  { from: /\bcheery\b/gi, to: 'Cherry' },
  { from: /\bselitzer\b/gi, to: 'Seltzer' },
  { from: /\bstrawbeery\b/gi, to: 'Strawberry' },
  { from: /\brasberry\b/gi, to: 'Raspberry' },
  { from: /\braxberry\b/gi, to: 'Raspberry' },
  { from: /\bcolt45\b/gi, to: 'Colt 45' },
  { from: /\bbumbua\b/gi, to: 'Bumbu' },
];

// Normalize a name: apply aliases, collapse whitespace, strip trailing
// separators and leading/trailing punctuation from employee shorthand.
function normalizeName(name) {
  let out = String(name || '');
  for (const { from, to } of BRAND_ALIASES) out = out.replace(from, to);
  // Collapse multi-spaces
  out = out.replace(/\s+/g, ' ').trim();
  // Strip trailing commas / hyphens that Clover exports sometimes leave
  out = out.replace(/[,\-\s]+$/, '').trim();
  return out;
}

// Normalize a size string: "750.00ml" → "750ml", "750 ml" → "750ml",
// "375ML" → "375ml", "1 LT" → "1L". Returns normalized string or original
// if no pattern matches. Empty input returns empty.
function normalizeSize(size) {
  if (!size) return '';
  const s = String(size).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(ml|m\.?l|l|lt|ltr|lts|liter|oz|pk|pack|g)\b/i);
  if (!m) return s;
  let n = m[1];
  if (n.endsWith('.00')) n = n.slice(0, -3);  // "750.00" → "750"
  const raw = m[2].toLowerCase().replace('.', '');
  let unit;
  if (raw === 'l' || raw === 'lt' || raw === 'ltr' || raw === 'lts' || raw === 'liter') unit = 'L';
  else if (raw === 'pack' || raw === 'pk') unit = 'pk';
  else unit = raw;
  return `${n}${unit}`;
}

// Does this item's name match any curated brand? Checks all categories and
// returns the matching category (used to re-tag mis-categorized items).
function brandCategoryForName(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CURATED_BRANDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return null;
}

// Does the name match a brand in the GIVEN category specifically?
function matchesCuratedBrand(name, category) {
  const keywords = CURATED_BRANDS[category];
  if (!keywords) return false;
  const lower = name.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// Detect size fields that are implausible for the price (Clover's "1.75 ml"
// for 1.75L on a $72 bottle).
function isInvalidSize(size, price) {
  if (size === '' || size == null) return true;
  const m = String(size).match(/^(\d+(?:\.\d+)?)(ml|l|oz)$/i);
  if (!m) return false;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'ml' && n < 10 && price > 20) return true;
  return false;
}

// Extract size from the item name (salvage when the size column is blank).
const NAME_SIZE_RE = /(\d+(?:\.\d+)?)\s?(ml|m\.l|l|lt|ltr|lts|liter|oz|pk|pack|g)\b/i;
function extractSizeFromName(name) {
  const m = String(name || '').match(NAME_SIZE_RE);
  if (!m) return '';
  return normalizeSize(m[0]);
}

// Categories where we drop items lacking size info. Only the spirit categories
// are strict — they always come in a bottle with a volume, and a blank size
// strongly suggests a Clover data-entry error. Liquor / Wine / Beer / Smokes
// routinely have empty sizes for real products (gift sets, 6-packs, singles,
// bagged wine blends), so we keep those even without explicit size.
const REQUIRE_SIZE = SPIRIT_CATEGORIES;

// Single-pass curation. Returns curated item, or null to drop.
//
// Re-categorization is gated to Liquor + spirit categories so "Smirnoff Ice"
// doesn't get yanked out of Beer into Vodka. Items currently in Beer / Wine /
// Smokes stay in their category.
function curateItem(item) {
  const name = normalizeName(item.name);
  const currentCat = item.category;

  // Pick target category. Spirits + Liquor may be reassigned by brand match;
  // Beer / Wine / Smokes / Other are fixed by Clover's tag.
  let category = currentCat;
  if (SPIRIT_CATEGORIES.has(currentCat) || currentCat === 'Liquor') {
    const brandCat = brandCategoryForName(name);
    // Only switch to a spirit category (or stay in Liquor). Don't let a
    // Liquor item get pulled into Beer/Wine/Smokes.
    if (brandCat && (SPIRIT_CATEGORIES.has(brandCat) || brandCat === 'Liquor')) {
      category = brandCat;
    }
  }

  // If no curated brand list exists for this category, pass through (just
  // name-normalized). Otherwise the name must match a brand in the list.
  if (!CURATED_BRANDS[category]) {
    return { ...item, name, size: normalizeSize(item.size) };
  }

  if (!matchesCuratedBrand(name, category)) return null;

  // Salvage size from name if missing OR invalid (e.g. "1.75 ml" on $72).
  let size = normalizeSize(item.size);
  if (!size || isInvalidSize(size, item.price)) {
    const fromName = extractSizeFromName(name);
    if (fromName && !isInvalidSize(fromName, item.price)) size = fromName;
  }

  if (REQUIRE_SIZE.has(category) && isInvalidSize(size, item.price)) return null;

  return { ...item, name, category, size };
}

module.exports = {
  SPIRIT_CATEGORIES,
  CURATED_BRANDS,
  BRAND_ALIASES,
  normalizeName,
  normalizeSize,
  brandCategoryForName,
  matchesCuratedBrand,
  isInvalidSize,
  extractSizeFromName,
  curateItem,
};
