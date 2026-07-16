// Classification lexicons for the Bulgaria fixture importer (T-002).
// Deliberately explicit and small — this is a fixed, known, real dataset,
// not a general-purpose NLP classifier. Every entry earns its place by
// appearing in BULGARIA MFC BAG.md. Extend only when a new real document
// needs it — never speculatively.

// A heading matching one of these (word-boundary-safe substring) is a
// physical storage receptacle that moves and nests: Container.
export const CONTAINER_LEXICON = [
  { key: 'bag', re: /\bbag\b/i },
  { key: 'suitcase', re: /\bsuitcase\b/i },
  { key: 'kufar', re: /куфар/i },
  { key: 'duffel', re: /\bduffel\b/i },
  { key: 'backpack', re: /\bbackpack\b/i },
  { key: 'roller', re: /\broller\b/i },
  { key: 'pouch', re: /\bpouch\b/i },
  { key: 'case', re: /\bcase\b/i },
  { key: 'box', re: /\bbox\b/i },
  { key: 'sandbag', re: /\bsandbag\b/i },
];

// A heading matching one of these is a fixed storage location within a
// property (furniture, a room, an area) — items move through it but it
// doesn't itself travel: Space.
export const SPACE_LEXICON = [
  { key: 'wardrobe', re: /\bwardrobe\b/i },
  { key: 'garderob', re: /гардероб/i },
  { key: 'drawer', re: /\bdrawer\b/i },
  { key: 'chest', re: /\bchest\b/i },
  { key: 'upstairs', re: /\bupstairs\b/i },
  { key: 'closet', re: /\bcloset\b/i },
  { key: 'shelf', re: /\bshelf\b/i },
];

// A heading whose text names one of these real, known properties. Order
// matters only for `firstMatch` below — first match wins when a heading
// text could plausibly match more than one (none do in this fixture).
export const PROPERTY_LEXICON = [
  { key: 'gradina', label: 'Градина', re: /градина/i },
  { key: 'sofia', label: 'София', re: /софия|\bsofia\b/i },
  { key: 'bansko', label: 'Bansko', re: /\bbansko\b/i },
  { key: 'lozenec', label: 'Lozenec storage', re: /lozenec|лозенец/i },
  // Santa Marina never appears as its own heading in this fixture (only as
  // a qualifier inside a container name, e.g. "Бял куфар Санта Марина") —
  // kept here so that qualifier can be *recorded as a hint*, but importer
  // must never synthesize a Property node for it that the source doesn't
  // declare. See importer/README.md "Known limitations".
  { key: 'santa-marina', label: 'Santa Marina', re: /santa marina|санта марина/i },
];

// Known brand tokens for item-field extraction. Matched case-insensitively
// as whole words/phrases; longest-match-first via sorting by length so
// e.g. "north face" doesn't get pre-empted by a shorter false match.
export const BRAND_LEXICON = [
  'The North Face', 'North Face', 'TNF', 'Arcteryx', 'Arc\'teryx', 'Patagonia',
  'Mountain Hardware', 'MH', 'Ozone', 'Naish', 'Cabrinha', 'Flysurfer', 'FLYSURFER',
  'FS', 'Slingshot', 'Core', 'Duotone', 'Elf', 'Mystic', 'DaKine', 'Da Kine',
  'Da kine', 'Crazy Fly', 'Crazy fly', 'RRD', 'Ragnarok', 'WISSAA', 'Wissa',
  'Red Bull', 'Helly Hansen', 'HH', '32Cool', '32 Cool', 'Under Armour', 'Under Armor',
  'Adidas', 'Nike', 'Salomon', 'Scarpa', 'K2', 'Rossignol', 'Volkl', 'Dynastar',
  'Scott', 'Atomic', 'Kessler', 'Swix', 'Columbia', 'Leki', 'Black Diamond',
  'Garmin', 'Baofeng', 'GoPro', 'Polaroid', 'Camelbak', 'JetBOIL', 'Klymt',
  'FJELLPULKEN', 'Ice Breaker', 'Icebreaker', 'Smart Wool', 'Smartwool', 'Hurley',
  'O\'Neal', 'O\'Neil', 'Quicksilver', 'Reef', 'Billabong', 'Old Navy', 'Banana Republic',
  'Calvin Klein', 'Kenneth Cole', 'Van Heusen', 'Fila', 'Puma', 'DKNY', 'Dkny',
  'Lagerfeld', 'Burton', 'Ion', 'Manera', 'Layer 8', 'Layer8', 'GU', 'C4', 'Hammer',
  'Airborne', 'Emergen-C', 'Emergen C', 'Sonicare', 'Omron', 'Amazon', 'Parrot',
  'Ultimate Ears', 'Rowenta', 'LG', 'Samsung', 'Epson', 'Apple', 'WD', 'Costco',
  'Vake', 'VAKE', 'Actai', 'Bolle', 'Spy', 'Smith', 'Komperdell', 'Nike Pro',
  'Tommy Hilfiger', 'IKEA', 'Eddie Bauer', 'Lost', 'Gray Fox', 'Molokai', 'Alive',
  'Unipro', 'Michael Brandon', 'Bruno', 'XTC', 'Bridge to Bridge', 'Hydrofoil',
  'Ronstan', 'Axis', 'Ogio', 'Neil Pryde', 'Pro Limit', 'Wellio', 'Nespresso',
  'Midea',
  // NOT included: "Kanaha" (line 2, "KANAHA SHAPES BOARD") — Kanaha Beach,
  // Maui is a place/style descriptor, not a confirmed brand. Left in `name`
  // verbatim rather than guessed into `brand`.
].sort((a, b) => b.length - a.length);

export function firstMatch(text, lexicon) {
  for (const entry of lexicon) {
    if (entry.re.test(text)) return entry;
  }
  return null;
}
