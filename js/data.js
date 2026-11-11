// Naam — reference data used by the scoring engine.
// Everything here is plain data so it can be reviewed and extended easily.
// Rules are simplified summaries of common US practice, not legal advice.

/* ------------------------------------------------------------------ */
/* Entity types                                                        */
/* ------------------------------------------------------------------ */
export const ENTITY_TYPES = {
  llc: {
    label: 'LLC (Limited Liability Company)',
    short: 'LLC',
    suffixes: ['LLC', 'L.L.C.', 'Limited Liability Company', 'Limited Liability Co.', 'Ltd. Liability Co.', 'Ltd. Liability Company', 'LC', 'L.C.'],
    preferred: 'LLC',
    forbidden: ['Inc', 'Inc.', 'Incorporated', 'Corp', 'Corp.', 'Corporation', 'LLP', 'LP', 'PC', 'P.C.'],
    required: true,
    note: 'Every state requires an LLC name to include "LLC", "L.L.C." or "Limited Liability Company" (a few also accept "LC").',
  },
  ccorp: {
    label: 'C-Corporation',
    short: 'C-Corp',
    suffixes: ['Inc.', 'Inc', 'Incorporated', 'Corp.', 'Corp', 'Corporation', 'Company', 'Co.', 'Limited', 'Ltd.', 'Ltd'],
    preferred: 'Inc.',
    forbidden: ['LLC', 'L.L.C.', 'Limited Liability Company', 'LLP', 'L.L.P.', 'LP', 'L.P.', 'PLLC'],
    required: true,
    note: 'Corporations must include a word like "Incorporated", "Corporation", "Company", "Limited" or an abbreviation (Inc., Corp., Co., Ltd.).',
  },
  scorp: {
    label: 'S-Corporation',
    short: 'S-Corp',
    suffixes: ['Inc.', 'Inc', 'Incorporated', 'Corp.', 'Corp', 'Corporation', 'Company', 'Co.', 'Limited', 'Ltd.', 'Ltd', 'LLC', 'L.L.C.'],
    preferred: 'Inc.',
    forbidden: ['LLP', 'L.L.P.', 'LP', 'L.P.'],
    required: true,
    note: 'An S-Corp is a federal tax election, not a separate entity. The legal name follows the rules of the underlying entity: a corporation (Inc., Corp.) or an LLC that elected S-Corp tax status (LLC).',
  },
  pbc: {
    label: 'Public Benefit Corporation (PBC)',
    short: 'PBC',
    suffixes: ['PBC', 'P.B.C.', 'Public Benefit Corporation', 'Inc.', 'Inc', 'Corp.', 'Corporation', 'Incorporated'],
    preferred: 'PBC',
    forbidden: ['LLC', 'L.L.C.', 'LLP', 'LP'],
    required: true,
    note: 'Delaware lets a PBC use "PBC", "P.B.C." or "Public Benefit Corporation"; otherwise it must disclose its PBC status to investors. Other states have similar "benefit corporation" rules.',
  },
  lp: {
    label: 'Limited Partnership (LP)',
    short: 'LP',
    suffixes: ['LP', 'L.P.', 'Limited Partnership'],
    preferred: 'LP',
    forbidden: ['Inc', 'Inc.', 'Corp', 'Corporation', 'LLC', 'L.L.C.'],
    required: true,
    note: 'A limited partnership name must include "Limited Partnership", "LP" or "L.P.".',
  },
  llp: {
    label: 'Limited Liability Partnership (LLP)',
    short: 'LLP',
    suffixes: ['LLP', 'L.L.P.', 'Limited Liability Partnership', 'RLLP', 'R.L.L.P.'],
    preferred: 'LLP',
    forbidden: ['Inc', 'Inc.', 'Corp', 'Corporation', 'LLC', 'L.L.C.'],
    required: true,
    note: 'LLPs must include "LLP", "L.L.P." or "Limited Liability Partnership". Many states (e.g. California, New York) only allow LLPs for licensed professions such as law and accounting.',
  },
  pllc: {
    label: 'Professional LLC (PLLC)',
    short: 'PLLC',
    suffixes: ['PLLC', 'P.L.L.C.', 'Professional Limited Liability Company', 'Professional LLC'],
    preferred: 'PLLC',
    forbidden: ['Inc', 'Inc.', 'Corp', 'Corporation'],
    required: true,
    note: 'PLLCs are for licensed professionals (doctors, lawyers, accountants, engineers, architects). Licensing boards often have extra naming rules, e.g. the name must include a member\'s surname or the profession.',
  },
  pc: {
    label: 'Professional Corporation (PC)',
    short: 'PC',
    suffixes: ['P.C.', 'PC', 'Professional Corporation', 'Prof. Corp.', 'P.A.', 'Professional Association'],
    preferred: 'P.C.',
    forbidden: ['LLC', 'L.L.C.'],
    required: true,
    note: 'Professional corporations are for licensed professions. Your licensing board may restrict the name further.',
  },
  nonprofit: {
    label: 'Nonprofit Corporation',
    short: 'Nonprofit',
    suffixes: ['Inc.', 'Inc', 'Incorporated', 'Corporation', 'Corp.', 'Foundation', 'Association', 'Society', 'Institute', 'Fund', 'NFP'],
    preferred: 'Inc.',
    forbidden: ['LLC', 'L.L.C.', 'LLP', 'LP'],
    required: false,
    note: 'Most states do not require a suffix for nonprofits, though many use "Inc." or words like "Foundation". Avoid words implying profit-seeking ownership.',
  },
  partnership: {
    label: 'General Partnership',
    short: 'Partnership',
    suffixes: [],
    preferred: '',
    forbidden: ['LLC', 'L.L.C.', 'Inc', 'Inc.', 'Corp', 'Corp.', 'Corporation', 'Incorporated', 'LLP', 'LP', 'Ltd', 'Ltd.', 'Limited'],
    required: false,
    note: 'A general partnership offers no liability shield, so it may not use LLC, Inc., Corp. or similar words. If the name differs from the partners\' surnames you usually need to file a DBA (assumed name).',
  },
  sole: {
    label: 'Sole Proprietorship / DBA',
    short: 'Sole prop.',
    suffixes: [],
    preferred: '',
    forbidden: ['LLC', 'L.L.C.', 'Inc', 'Inc.', 'Corp', 'Corp.', 'Corporation', 'Incorporated', 'LLP', 'LP', 'Ltd', 'Ltd.', 'Limited', 'Company', 'Co.'],
    required: false,
    note: 'A sole proprietor cannot use a suffix that implies a separate legal entity (LLC, Inc., Corp., and in many states "Company"). Any name other than your own legal name needs a DBA / assumed-name filing, usually at the county or state level.',
  },
};

// All entity words we recognise, longest first so "Limited Liability Company" wins over "Limited".
export const ALL_SUFFIXES = [...new Set(Object.values(ENTITY_TYPES).flatMap(e => [...e.suffixes, ...e.forbidden]))]
  .sort((a, b) => b.length - a.length);

/* ------------------------------------------------------------------ */
/* Industries                                                          */
/* ------------------------------------------------------------------ */
// ideal: [min, max] letters for the core name.
// tone: word fragments that fit the industry's expectations.
// cliches: overused fragments that make a name blend in.
// generic: descriptive words that weaken trademark protection on their own.
// regulated: words that trigger licensing/approval in this industry.
// tlds: extra domain endings worth checking.
export const INDUSTRIES = {
  tech: {
    label: 'Technology / Software',
    ideal: [4, 9],
    tone: ['lab', 'labs', 'stack', 'byte', 'bit', 'cloud', 'flow', 'sync', 'hub', 'kit', 'base', 'forge', 'logic', 'scale', 'loop', 'grid', 'node'],
    cliches: ['ify', 'ly', 'io', 'tech', 'soft', 'systems', 'solutions', 'digital', 'cyber', 'smart', 'app', 'hq', 'labs', 'ai'],
    generic: ['software', 'technology', 'technologies', 'tech', 'systems', 'solutions', 'digital', 'apps', 'computing', 'data', 'it', 'web', 'online', 'cloud', 'network', 'networks'],
    tlds: ['io', 'dev', 'app', 'tech'],
    advice: 'Short, coined or abstract names (4–9 letters) age best in tech and are easier to trademark. Avoid tying the name to one technology that may go out of date.',
  },
  ai: {
    label: 'AI / Data / Analytics',
    ideal: [4, 9],
    tone: ['mind', 'neural', 'sense', 'cortex', 'signal', 'insight', 'vector', 'tensor', 'mesh', 'lens', 'sight'],
    cliches: ['ai', 'gpt', 'mind', 'brain', 'neural', 'intelligence', 'smart', 'bot', 'deep', 'cognitive', 'genius', 'ly', 'ify'],
    generic: ['ai', 'artificial', 'intelligence', 'data', 'analytics', 'machine', 'learning', 'ml', 'insights', 'automation', 'bot', 'bots'],
    tlds: ['ai', 'io', 'dev'],
    advice: 'Thousands of new companies use "AI", "GPT", "Mind" or "Neural" in their name. A distinctive coined word stands out, and won\'t date the brand when the hype moves on.',
  },
  finance: {
    label: 'Finance / Fintech',
    ideal: [4, 11],
    tone: ['capital', 'ledger', 'vault', 'mint', 'coin', 'fund', 'equity', 'wealth', 'harbor', 'summit', 'anchor', 'north', 'sterling', 'crest'],
    cliches: ['pay', 'fin', 'cash', 'money', 'coin', 'wallet', 'capital', 'wealth', 'ly', 'ify'],
    generic: ['finance', 'financial', 'capital', 'investments', 'investment', 'money', 'pay', 'payments', 'lending', 'loans', 'wealth', 'advisors', 'advisory', 'fund', 'funding'],
    regulated: ['bank', 'banking', 'banker', 'bancorp', 'trust', 'trustee', 'savings', 'credit union', 'mortgage', 'federal', 'reserve', 'fdic', 'securities', 'exchange'],
    tlds: ['finance', 'money', 'capital'],
    advice: 'Finance names need to signal trust and stability. Regulators watch words like "Bank", "Trust" and "Savings" closely, and fintechs that aren\'t chartered banks generally cannot use them.',
  },
  insurance: {
    label: 'Banking / Insurance',
    ideal: [4, 14],
    tone: ['mutual', 'shield', 'guard', 'harbor', 'anchor', 'keystone', 'cornerstone', 'secure', 'heritage', 'liberty'],
    cliches: ['secure', 'shield', 'guard', 'protect', 'safe', 'first', 'national', 'american'],
    generic: ['insurance', 'insurers', 'agency', 'brokers', 'brokerage', 'coverage', 'bank', 'banking', 'financial'],
    regulated: ['bank', 'banking', 'bancorp', 'trust', 'insurance', 'insurer', 'assurance', 'reinsurance', 'underwriters', 'indemnity', 'surety', 'casualty', 'mutual', 'savings', 'credit union', 'federal', 'national'],
    tlds: ['insurance', 'bank'],
    advice: 'Banking and insurance names usually need approval from a state banking or insurance regulator before the Secretary of State will accept them. Start that process early.',
  },
  marketing: {
    label: 'Marketing / Advertising / PR',
    ideal: [4, 12],
    tone: ['studio', 'collective', 'co', 'house', 'social', 'spark', 'buzz', 'bold', 'loud', 'story', 'signal', 'echo', 'pulse'],
    cliches: ['media', 'digital', 'creative', 'marketing', 'agency', 'social', 'brand', 'growth', 'spark', 'buzz', 'ninja', 'guru', 'rocket'],
    generic: ['marketing', 'media', 'advertising', 'agency', 'digital', 'creative', 'creatives', 'branding', 'social', 'seo', 'pr', 'communications', 'consulting', 'growth'],
    tlds: ['agency', 'studio', 'media', 'co'],
    advice: 'Marketing agencies are judged on their own branding. A memorable, slightly bold name signals creative confidence; "Digital Marketing Solutions"-style names do the opposite.',
  },
  ecommerce: {
    label: 'E-commerce / Retail',
    ideal: [4, 10],
    tone: ['shop', 'store', 'goods', 'supply', 'market', 'cart', 'co', 'mart', 'trade', 'house', 'outfitters'],
    cliches: ['shop', 'store', 'mart', 'deals', 'buy', 'cart', 'express', 'online', 'ly', 'ify'],
    generic: ['shop', 'store', 'online', 'ecommerce', 'retail', 'goods', 'products', 'deals', 'outlet', 'market', 'marketplace'],
    tlds: ['shop', 'store', 'co'],
    advice: 'Retail names should be easy to say, spell and search for. Check marketplaces like Amazon and Etsy for sellers with the same name, as well as trademarks.',
  },
  healthcare: {
    label: 'Healthcare / Medical',
    ideal: [4, 14],
    tone: ['care', 'health', 'well', 'vita', 'cura', 'thrive', 'bloom', 'haven', 'bridge', 'path', 'pulse'],
    cliches: ['care', 'health', 'med', 'medi', 'wellness', 'vita', 'life', 'plus'],
    generic: ['health', 'healthcare', 'medical', 'care', 'clinic', 'wellness', 'therapy', 'services'],
    regulated: ['medical', 'medicine', 'physician', 'physicians', 'doctor', 'doctors', 'md', 'clinic', 'hospital', 'surgery', 'surgical', 'dental', 'dentist', 'dentistry', 'pharmacy', 'pharmacist', 'nurse', 'nursing', 'psychologist', 'psychology', 'chiropractic', 'optometry', 'therapist', 'pediatrics', 'urgent care', 'emergency'],
    tlds: ['health', 'care', 'clinic'],
    advice: 'Words like "Medical", "Clinic", "Dental" or "Pharmacy" usually require a licensed professional or facility licence, and sometimes a professional entity type (PC/PLLC).',
  },
  biotech: {
    label: 'Biotech / Pharma / Life Sciences',
    ideal: [5, 12],
    tone: ['gen', 'bio', 'thera', 'cyte', 'gene', 'cell', 'nova', 'vita', 'zyme', 'logix', 'path', 'immune'],
    cliches: ['bio', 'gen', 'thera', 'pharma', 'genix', 'gene', 'cyte', 'nova'],
    generic: ['bio', 'biotech', 'pharma', 'pharmaceuticals', 'therapeutics', 'biosciences', 'sciences', 'labs', 'genomics'],
    regulated: ['pharmacy', 'pharmacist', 'drug', 'drugs', 'medical'],
    tlds: ['bio', 'health'],
    advice: 'Biotech names commonly mix Latin or Greek roots. That crowded style makes trademark clashes likely, so search carefully. Drug names themselves go through a separate FDA review.',
  },
  legal: {
    label: 'Legal Services',
    ideal: [4, 20],
    tone: ['law', 'legal', 'counsel', 'advocates', 'partners', 'group', 'chambers', 'associates'],
    cliches: ['legal', 'law', 'justice', 'advocate', 'shield'],
    generic: ['law', 'legal', 'attorneys', 'lawyers', 'firm', 'counsel', 'associates', 'group'],
    regulated: ['attorney', 'attorneys', 'lawyer', 'lawyers', 'law', 'legal', 'esq', 'esquire', 'counsel', 'counselor'],
    tlds: ['law', 'legal', 'attorney'],
    advice: 'State bar rules govern law firm names: many require the names of one or more lawyers, and forbid misleading trade names or implying a government connection. Non-lawyers generally may not use "Law" or "Attorney".',
  },
  realestate: {
    label: 'Real Estate / Property',
    ideal: [4, 14],
    tone: ['home', 'homes', 'estate', 'property', 'realty', 'key', 'nest', 'haven', 'harbor', 'crest', 'ridge', 'oak', 'stone', 'gate'],
    cliches: ['realty', 'homes', 'properties', 'key', 'premier', 'elite', 'prime', 'dream', 'luxury'],
    generic: ['realty', 'real estate', 'properties', 'property', 'homes', 'housing', 'rentals', 'management', 'investments', 'development', 'land'],
    regulated: ['realtor', 'realtors', 'mortgage', 'escrow', 'title', 'appraisal', 'appraisers', 'broker', 'brokerage'],
    tlds: ['homes', 'realty', 'properties'],
    advice: '"REALTOR®" is a registered trademark of the National Association of Realtors and can\'t be used in a company name. Brokerage names often have to be registered with the state real estate commission.',
  },
  construction: {
    label: 'Construction / Trades / Home Services',
    ideal: [4, 16],
    tone: ['build', 'builders', 'craft', 'works', 'stone', 'iron', 'oak', 'summit', 'ridge', 'bridge', 'forge', 'true', 'solid'],
    cliches: ['pro', 'pros', 'quality', 'premier', 'elite', 'precision', 'reliable', 'a1', 'aaa', 'express'],
    generic: ['construction', 'contractors', 'contracting', 'builders', 'building', 'remodeling', 'roofing', 'plumbing', 'electric', 'electrical', 'hvac', 'services', 'home', 'repair'],
    regulated: ['engineer', 'engineers', 'engineering', 'architect', 'architects', 'architecture', 'surveyor', 'surveying', 'electrician', 'plumber'],
    tlds: ['build', 'construction', 'services'],
    advice: 'Local trades benefit from names that are easy to say on the phone and find on maps. "Engineering" and "Architecture" are reserved for licensed firms in most states.',
  },
  food: {
    label: 'Food & Beverage / Restaurant',
    ideal: [3, 14],
    tone: ['kitchen', 'table', 'eats', 'bites', 'house', 'co', 'grill', 'bakery', 'brew', 'roast', 'harvest', 'fork', 'spoon', 'pantry', 'larder'],
    cliches: ['eats', 'bites', 'yum', 'tasty', 'delish', 'grill', 'kitchen', 'bistro', 'gourmet', 'fresh'],
    generic: ['food', 'foods', 'restaurant', 'cafe', 'kitchen', 'catering', 'bakery', 'grill', 'bar', 'pizza', 'coffee', 'beverage', 'beverages', 'drinks'],
    regulated: ['winery', 'brewery', 'distillery', 'organic'],
    tlds: ['menu', 'kitchen', 'cafe', 'restaurant'],
    advice: 'Restaurant names live on signs, menus and delivery apps, so make them short, sayable and visually distinct. "Organic" claims are regulated by the USDA, and alcohol producers need TTB approval for brand names.',
  },
  hospitality: {
    label: 'Hospitality / Travel / Events',
    ideal: [4, 14],
    tone: ['stay', 'inn', 'lodge', 'voyage', 'journey', 'trail', 'harbor', 'haven', 'retreat', 'escape', 'wander', 'nomad'],
    cliches: ['travel', 'trips', 'getaway', 'escape', 'wander', 'nomad', 'adventures', 'holidays', 'luxury'],
    generic: ['travel', 'tours', 'hotel', 'hotels', 'events', 'hospitality', 'vacations', 'vacation', 'rentals', 'trips', 'resort'],
    tlds: ['travel', 'events', 'holiday'],
    advice: 'Travel names should work across languages and cultures. Check meanings in your key markets\' languages.',
  },
  education: {
    label: 'Education / Training',
    ideal: [4, 14],
    tone: ['learn', 'academy', 'scholar', 'mentor', 'bright', 'spark', 'path', 'quest', 'grow', 'root', 'bloom', 'leap'],
    cliches: ['learn', 'edu', 'smart', 'bright', 'genius', 'kids', 'tutor', 'academy'],
    generic: ['education', 'learning', 'tutoring', 'training', 'courses', 'school', 'academy', 'classes', 'teaching'],
    regulated: ['university', 'college', 'school', 'institute', 'academy', 'seminary', 'polytechnic', 'accredited'],
    tlds: ['academy', 'school', 'education'],
    advice: '"University", "College" and often "School" or "Institute" are restricted to state-approved or accredited institutions. Using them without approval can be refused or even a criminal offence in some states.',
  },
  media: {
    label: 'Media / Entertainment / Creator',
    ideal: [3, 12],
    tone: ['studio', 'studios', 'pictures', 'films', 'sound', 'records', 'press', 'house', 'collective', 'stage', 'reel', 'frame', 'story'],
    cliches: ['media', 'productions', 'studios', 'entertainment', 'creative', 'films', 'pictures', 'tv'],
    generic: ['media', 'productions', 'entertainment', 'films', 'film', 'music', 'records', 'studios', 'studio', 'podcast', 'news'],
    tlds: ['studio', 'media', 'tv', 'film'],
    advice: 'Entertainment brands are trademark-heavy. Check film titles, record labels and existing channel names, not just company registries.',
  },
  fashion: {
    label: 'Fashion / Beauty / Lifestyle',
    ideal: [3, 10],
    tone: ['atelier', 'maison', 'house', 'studio', 'collective', 'label', 'co', 'bloom', 'luxe', 'muse'],
    cliches: ['luxe', 'chic', 'glam', 'beauty', 'style', 'boutique', 'couture', 'glow', 'bella'],
    generic: ['fashion', 'beauty', 'apparel', 'clothing', 'boutique', 'cosmetics', 'skincare', 'style', 'jewelry', 'designs'],
    tlds: ['shop', 'style', 'beauty', 'fashion'],
    advice: 'Fashion names are often a founder\'s name or an evocative word. Using a personal name can make the brand hard to sell or separate from you later.',
  },
  consulting: {
    label: 'Consulting / Professional Services',
    ideal: [4, 16],
    tone: ['partners', 'advisory', 'group', 'collective', 'works', 'north', 'bridge', 'summit', 'compass', 'keystone', 'clarity', 'meridian'],
    cliches: ['solutions', 'consulting', 'group', 'global', 'strategic', 'strategies', 'partners', 'synergy', 'pinnacle', 'apex', 'summit', 'elite'],
    generic: ['consulting', 'consultants', 'advisory', 'advisors', 'services', 'solutions', 'management', 'strategy', 'strategies', 'group', 'partners', 'associates'],
    regulated: ['cpa', 'cpas', 'accountancy', 'certified public accountant', 'certified public accountants', 'engineering', 'architect'],
    tlds: ['consulting', 'partners', 'co'],
    advice: '"Apex Strategic Solutions Group"-style names are everywhere. A specific, ownable word helps clients remember and refer you. "CPA" is restricted to licensed accounting firms.',
  },
  manufacturing: {
    label: 'Manufacturing / Industrial',
    ideal: [4, 14],
    tone: ['works', 'industries', 'forge', 'foundry', 'iron', 'steel', 'precision', 'dynamics', 'fab', 'mill', 'machine'],
    cliches: ['industries', 'manufacturing', 'precision', 'global', 'international', 'dynamics', 'tech'],
    generic: ['manufacturing', 'industries', 'industrial', 'products', 'fabrication', 'machining', 'components', 'materials', 'supply'],
    tlds: ['industries', 'supply', 'parts'],
    advice: 'Industrial buyers value clarity and longevity, so slightly descriptive names are fine here. Still add a distinctive word so the name can be protected.',
  },
  logistics: {
    label: 'Logistics / Transportation',
    ideal: [4, 14],
    tone: ['freight', 'cargo', 'route', 'line', 'lane', 'fleet', 'haul', 'link', 'way', 'port', 'bridge', 'transit', 'express'],
    cliches: ['express', 'logistics', 'global', 'transport', 'freight', 'swift', 'rapid', 'speedy', 'fast'],
    generic: ['logistics', 'transport', 'transportation', 'freight', 'shipping', 'trucking', 'delivery', 'courier', 'moving', 'cargo'],
    regulated: ['customs broker', 'freight forwarder'],
    tlds: ['delivery', 'express', 'cargo'],
    advice: 'Carriers register their legal name with the FMCSA (USDOT number), so the name you form will be the one painted on trucks and shown in public safety records.',
  },
  energy: {
    label: 'Energy / Climate / Cleantech',
    ideal: [4, 12],
    tone: ['sol', 'volt', 'watt', 'grid', 'terra', 'verde', 'leaf', 'current', 'flux', 'ion', 'carbon', 'tide', 'wind'],
    cliches: ['eco', 'green', 'solar', 'sun', 'enviro', 'clean', 'earth', 'planet', 'sustain'],
    generic: ['energy', 'solar', 'power', 'renewables', 'renewable', 'green', 'clean', 'electric', 'environmental'],
    tlds: ['energy', 'solar', 'eco'],
    advice: 'Avoid unqualified "green" or "eco" claims you can\'t back up. The FTC\'s Green Guides cover environmental marketing claims, and they increasingly attract scrutiny.',
  },
  nonprofit: {
    label: 'Nonprofit / Social Impact',
    ideal: [4, 20],
    tone: ['foundation', 'alliance', 'fund', 'project', 'initiative', 'coalition', 'collective', 'hope', 'together', 'bridge', 'common', 'kind'],
    cliches: ['hope', 'heart', 'helping', 'hands', 'kids', 'cares', 'together', 'united', 'global'],
    generic: ['foundation', 'charity', 'fund', 'association', 'society', 'alliance', 'organization', 'council', 'network'],
    regulated: ['red cross', 'cooperative', 'co-op', 'veterans', 'olympic'],
    tlds: ['org', 'foundation', 'charity', 'ngo'],
    advice: 'Donors search for you by name, so clarity beats cleverness. Names implying a veterans\' or government affiliation are often restricted.',
  },
  fitness: {
    label: 'Fitness / Wellness',
    ideal: [3, 12],
    tone: ['fit', 'strong', 'move', 'flow', 'zen', 'balance', 'core', 'pulse', 'thrive', 'stride', 'peak'],
    cliches: ['fit', 'fitness', 'strong', 'zen', 'wellness', 'body', 'core', 'yoga', 'iron', 'beast'],
    generic: ['fitness', 'gym', 'yoga', 'wellness', 'training', 'pilates', 'crossfit', 'nutrition', 'health'],
    regulated: ['crossfit', 'therapy', 'therapist', 'physical therapy', 'dietitian', 'nutritionist', 'massage'],
    tlds: ['fitness', 'fit', 'yoga'],
    advice: '"CrossFit" is a trademark you can only use with an affiliation licence. "Physical therapy", "dietitian" and "massage therapy" are licensed titles in most states.',
  },
  gaming: {
    label: 'Gaming / Esports',
    ideal: [3, 10],
    tone: ['quest', 'pixel', 'arcade', 'forge', 'level', 'loot', 'byte', 'realm', 'craft', 'spawn', 'nova'],
    cliches: ['gaming', 'games', 'pixel', 'play', 'gamer', 'esports', 'arcade', 'level', 'pro', 'x'],
    generic: ['games', 'gaming', 'esports', 'studio', 'studios', 'interactive', 'entertainment', 'play'],
    tlds: ['gg', 'games'],
    advice: 'Gaming names are judged by a very online audience. Check Steam, the app stores and Twitch for clashes, and make sure the handle is available everywhere.',
  },
  crypto: {
    label: 'Crypto / Web3 / Blockchain',
    ideal: [3, 10],
    tone: ['chain', 'block', 'ledger', 'node', 'hash', 'mint', 'vault', 'protocol', 'labs', 'dao'],
    cliches: ['coin', 'chain', 'crypto', 'block', 'token', 'swap', 'fi', 'dao', 'meta', 'moon', 'x'],
    generic: ['crypto', 'blockchain', 'coin', 'token', 'tokens', 'web3', 'defi', 'nft', 'chain', 'exchange'],
    regulated: ['bank', 'trust', 'exchange', 'securities', 'federal', 'reserve'],
    tlds: ['xyz', 'io', 'finance'],
    advice: 'Crypto names that suggest a bank, an exchange or securities attract regulator attention. Names built on hype words ("moon", "meta", "NFT") date quickly.',
  },
  other: {
    label: 'Other / General',
    ideal: [4, 12],
    tone: [],
    cliches: ['solutions', 'global', 'group', 'enterprises', 'services', 'ly', 'ify'],
    generic: ['company', 'services', 'solutions', 'enterprises', 'group', 'holdings', 'ventures', 'products', 'international', 'global'],
    tlds: ['co', 'biz'],
    advice: 'A short, distinctive, easy-to-spell name works in almost every industry.',
  },
};

/* ------------------------------------------------------------------ */
/* Words that are restricted almost everywhere                         */
/* ------------------------------------------------------------------ */
// Need approval from a regulator before most states will accept the name.
export const RESTRICTED_WORDS = {
  bank: 'Banking regulators (state banking department / OCC). Only chartered banks may use it.',
  banking: 'Banking regulators. Only chartered banks may use it.',
  banker: 'Banking regulators.',
  bancorp: 'Banking regulators.',
  trust: 'Banking regulators in many states (implies a trust company). Usually fine outside finance, but expect questions.',
  trustee: 'Banking regulators (implies fiduciary trust services).',
  'trust company': 'Banking regulators.',
  savings: 'Banking regulators ("savings" implies a savings institution).',
  'credit union': 'NCUA / state credit-union regulator.',
  insurance: 'State insurance department.',
  insurer: 'State insurance department.',
  assurance: 'State insurance department.',
  reinsurance: 'State insurance department.',
  underwriter: 'State insurance department.',
  underwriters: 'State insurance department.',
  indemnity: 'State insurance department.',
  surety: 'State insurance department.',
  mortgage: 'State mortgage-lending licence typically required.',
  university: 'State higher-education authority.',
  college: 'State higher-education authority.',
  seminary: 'State higher-education authority.',
  accredited: 'Must be backed by real accreditation.',
  engineer: 'State engineering licensing board.',
  engineers: 'State engineering licensing board.',
  engineering: 'State engineering licensing board.',
  architect: 'State architecture licensing board.',
  architects: 'State architecture licensing board.',
  architecture: 'State architecture licensing board.',
  surveyor: 'State land-surveying board.',
  surveying: 'State land-surveying board.',
  attorney: 'State bar. Only licensed lawyers.',
  attorneys: 'State bar. Only licensed lawyers.',
  lawyer: 'State bar. Only licensed lawyers.',
  lawyers: 'State bar. Only licensed lawyers.',
  esquire: 'State bar. Only licensed lawyers.',
  cpa: 'State board of accountancy. Only licensed CPA firms.',
  cpas: 'State board of accountancy. Only licensed CPA firms.',
  accountancy: 'State board of accountancy.',
  'certified public accountant': 'State board of accountancy.',
  'certified public accountants': 'State board of accountancy.',
  physician: 'State medical board.',
  physicians: 'State medical board.',
  medical: 'State medical board (often requires a PC/PLLC owned by licensed physicians).',
  medicine: 'State medical board.',
  doctor: 'State medical board.',
  hospital: 'State health department (facility licence).',
  dental: 'State dental board.',
  dentistry: 'State dental board.',
  pharmacy: 'State board of pharmacy.',
  nursing: 'State board of nursing / health department.',
  cooperative: 'Many states reserve "Cooperative" or "Co-op" for entities formed under cooperative statutes.',
  'co-op': 'Many states reserve "Co-op" for entities formed under cooperative statutes.',
  realtor: 'Registered trademark of the National Association of REALTORS®. Can\'t be used in a company name.',
  realtors: 'Registered trademark of the National Association of REALTORS®.',
  lottery: 'Restricted to state lotteries in most states.',
  lotto: 'Restricted to state lotteries in most states.',
  casino: 'State gaming commission licence typically required.',
  crossfit: 'Trademark of CrossFit, LLC. Requires an affiliate licence.',
};

// Words that imply a government connection or are protected by federal statute.
export const RESERVED_WORDS = {
  fbi: 'Implies the Federal Bureau of Investigation. Prohibited by federal law (18 U.S.C. § 709).',
  'federal bureau of investigation': 'Prohibited by federal law (18 U.S.C. § 709).',
  cia: 'Implies the Central Intelligence Agency. Restricted by federal law (50 U.S.C. § 3513).',
  'central intelligence agency': 'Restricted by federal law.',
  'secret service': 'Restricted by federal law (18 U.S.C. § 709).',
  nasa: 'NASA\'s name and insignia are protected by federal law (51 U.S.C. § 20141).',
  irs: 'Implies the Internal Revenue Service.',
  fda: 'Implies the Food and Drug Administration.',
  fdic: 'Restricted by federal law (12 U.S.C. § 1828(a)(4)).',
  'federal reserve': 'Restricted by federal law (18 U.S.C. § 709).',
  federal: 'Most states reject "Federal" (and "National" for banks) because it implies a federal government affiliation.',
  'united states': 'Implies a federal government affiliation. Usually rejected.',
  treasury: 'Implies a connection to the U.S. Treasury.',
  olympic: 'Protected by the Ted Stevens Olympic and Amateur Sports Act (36 U.S.C. § 220506).',
  olympics: 'Protected by the Ted Stevens Olympic and Amateur Sports Act.',
  olympiad: 'Protected by the Ted Stevens Olympic and Amateur Sports Act.',
  paralympic: 'Protected by the Ted Stevens Olympic and Amateur Sports Act.',
  'red cross': 'Protected by federal law (18 U.S.C. § 706).',
  '4-h': 'Protected by federal law (18 U.S.C. § 707).',
  'smokey bear': 'Protected by federal law (18 U.S.C. § 711).',
  'boy scouts': 'Federally chartered name.',
  'girl scouts': 'Federally chartered name.',
  'little league': 'Federally chartered name.',
  'national guard': 'Implies a military affiliation.',
  'social security': 'Restricted by federal law (42 U.S.C. § 1320b-10).',
  medicare: 'Restricted by federal law (42 U.S.C. § 1320b-10).',
  medicaid: 'Restricted by federal law (42 U.S.C. § 1320b-10).',
  police: 'Implies law-enforcement authority. Rejected by most states unless the entity is a police organisation.',
  sheriff: 'Implies law-enforcement authority.',
  'state of': 'Implies a state-government affiliation.',
  'city of': 'Implies a city-government affiliation.',
  'county of': 'Implies a county-government affiliation.',
  government: 'Implies a government affiliation.',
  'department of': 'Implies a government agency.',
  veterans: 'Many states require proof of veteran organisation status.',
};

/* ------------------------------------------------------------------ */
/* Famous / strong brands                                              */
/* ------------------------------------------------------------------ */
// Not a trademark database, just a guard against the obvious collisions
// and "dilution" risk around famous marks.
export const FAMOUS_BRANDS = [
  'google', 'alphabet', 'youtube', 'android', 'apple', 'iphone', 'ipad', 'macbook', 'amazon', 'alexa', 'kindle', 'microsoft', 'windows', 'xbox', 'linkedin', 'github',
  'meta', 'facebook', 'instagram', 'whatsapp', 'oculus', 'tesla', 'spacex', 'netflix', 'uber', 'lyft', 'airbnb', 'spotify', 'nike', 'adidas', 'puma', 'reebok',
  'cocacola', 'coke', 'pepsi', 'starbucks', 'mcdonalds', 'burgerking', 'subway', 'kfc', 'dominos', 'disney', 'pixar', 'marvel', 'samsung', 'sony', 'playstation',
  'nintendo', 'intel', 'nvidia', 'amd', 'qualcomm', 'oracle', 'ibm', 'cisco', 'adobe', 'salesforce', 'slack', 'zoom', 'dropbox', 'paypal', 'venmo', 'visa',
  'mastercard', 'amex', 'americanexpress', 'stripe', 'shopify', 'square', 'twitter', 'tiktok', 'snapchat', 'pinterest', 'reddit', 'yahoo', 'bing', 'openai',
  'chatgpt', 'anthropic', 'walmart', 'target', 'costco', 'ikea', 'toyota', 'honda', 'ford', 'chevrolet', 'bmw', 'mercedes', 'ferrari', 'porsche', 'lamborghini',
  'rolex', 'gucci', 'prada', 'chanel', 'louisvuitton', 'hermes', 'dior', 'versace', 'boeing', 'airbus', 'fedex', 'dhl', 'verizon', 'tmobile', 'jpmorgan',
  'goldmansachs', 'wellsfargo', 'citibank', 'blackrock', 'vanguard', 'fidelity', 'deloitte', 'accenture', 'mckinsey', 'kpmg', 'pwc', 'hubspot', 'mailchimp',
  'canva', 'figma', 'notion', 'atlassian', 'jira', 'kodak', 'lego', 'redbull', 'heinz', 'kleenex', 'xerox', 'velcro', 'jacuzzi', 'tupperware',
  'harleydavidson', 'budweiser', 'heineken', 'nestle', 'unilever', 'loreal', 'sephora', 'zara', 'hm', 'uniqlo', 'gap', 'patagonia', 'northface', 'yeti',
  'peloton', 'fitbit', 'garmin', 'gopro', 'canon', 'nikon', 'panasonic', 'philips', 'siemens', 'bosch', 'dyson', 'hilton', 'marriott', 'hyatt', 'expedia',
  'booking', 'tripadvisor', 'doordash', 'grubhub', 'instacart', 'zillow', 'redfin', 'coinbase', 'binance', 'robinhood', 'etsy', 'ebay', 'alibaba', 'tencent',
  'wechat', 'baidu', 'huawei', 'xiaomi', 'lenovo', 'dell', 'hp', 'twitch', 'discord', 'telegram', 'signal', 'duolingo', 'airtable', 'zapier', 'asana',
];

/* ------------------------------------------------------------------ */
/* Edge-case word lists                                                */
/* ------------------------------------------------------------------ */
// Words that cause embarrassment when they appear hidden inside a joined name
// (e.g. "therapist" → "the rapist"). Kept deliberately short and mild.
export const HIDDEN_WORDS = ['sex', 'ass', 'butt', 'poo', 'pee', 'cum', 'tit', 'fart', 'piss', 'shit', 'fuck', 'dick', 'cock', 'rape', 'rapist', 'nazi', 'porn', 'slut', 'anal', 'damn', 'hell', 'kill', 'dead', 'die', 'scam', 'fraud', 'loser', 'crap', 'turd', 'puke', 'vomit', 'weed', 'drug', 'jerk', 'nut', 'nuts', 'hoe', 'pimp', 'kkk', 'isis'];

// Common legitimate words that contain a "hidden word", so we don't flag them.
export const HIDDEN_WORD_ALLOWLIST = [
  'class', 'classic', 'glass', 'grass', 'brass', 'mass', 'massive', 'pass', 'passion', 'passport', 'compass', 'bass', 'assist', 'assistant', 'asset', 'assets', 'assess',
  'assessment', 'associate', 'associates', 'association', 'assure', 'assurance', 'embassy', 'ambassador', 'sassy', 'cassette', 'lass', 'harass', 'carcass',
  'essex', 'sussex', 'middlesex', 'sextant', 'sextet', 'unisex', 'button', 'butter', 'butte', 'butterfly', 'buttress', 'buttermilk', 'butterscotch', 'rebuttal', 'scuttle', 'shuttle', 'title', 'titan', 'titanium',
  'constitution', 'institute', 'institution', 'petite', 'appetite', 'competitor', 'competition', 'repetition', 'tithe', 'cocktail', 'peacock', 'hancock',
  'hitchcock', 'cockpit', 'shiitake', 'analyst', 'analysis', 'analytics', 'analytical', 'analog', 'analogue', 'canal', 'banal', 'cumulus', 'cumulative',
  'cucumber', 'circumference', 'document', 'documents', 'scum', 'hello', 'shell', 'shells', 'hellen', 'michelle', 'rochelle', 'seashell', 'hellas',
  'skill', 'skills', 'skillful', 'killer', 'kilo', 'deadline', 'died', 'diet', 'dietary', 'diesel', 'audience', 'indie', 'studies', 'soldier', 'diego',
  'weedon', 'tweed', 'nutrition', 'nutrient', 'nutmeg', 'peanut', 'donut', 'doughnut', 'walnut', 'coconut', 'chestnut', 'hazelnut', 'shoe', 'shoes', 'hoedown',
  'spoon', 'poodle', 'pooh', 'poor', 'speed', 'peek', 'peer', 'peep', 'steep', 'sleep', 'creep', 'jeep', 'keep', 'deep', 'sheep', 'rapid', 'grape', 'drape',
  'scrape', 'drapes', 'trapeze', 'parapet', 'scrap', 'scraps', 'crapo', 'skidmore', 'thesaurus', 'pimple', 'jerky', 'drugstore', 'damnation', 'buttercup',
  'scamper', 'hellenic', 'deadwood', 'sexton', 'fartlek', 'pupil', 'tittle', 'altitude', 'attitude', 'latitude', 'gratitude', 'aptitude', 'multitude',
  'pornography', 'unicum', 'tecum', 'pees', 'deeds', 'dieter', 'prisoner', 'disarray', 'flashback',
];

// Words with an unfortunate meaning in another major language.
// exact: only flag when the whole name (or a whole word in it) matches.
export const FOREIGN_MEANINGS = [
  { word: 'mist', lang: 'German', meaning: 'dung / rubbish', exact: true },
  { word: 'gift', lang: 'German', meaning: 'poison', exact: true },
  { word: 'kaka', lang: 'many languages', meaning: 'excrement (child slang)', exact: false },
  { word: 'caca', lang: 'Spanish / French / Italian', meaning: 'excrement', exact: false },
  { word: 'puta', lang: 'Spanish / Portuguese', meaning: 'a vulgar insult', exact: false },
  { word: 'pute', lang: 'French', meaning: 'a vulgar insult', exact: true },
  { word: 'merde', lang: 'French', meaning: 'excrement (vulgar)', exact: false },
  { word: 'mierda', lang: 'Spanish', meaning: 'excrement (vulgar)', exact: false },
  { word: 'cazzo', lang: 'Italian', meaning: 'a vulgar word', exact: false },
  { word: 'figa', lang: 'Italian', meaning: 'a vulgar word', exact: true },
  { word: 'culo', lang: 'Spanish / Italian', meaning: 'backside (vulgar)', exact: true },
  { word: 'cul', lang: 'French', meaning: 'backside (vulgar)', exact: true },
  { word: 'con', lang: 'French', meaning: 'idiot (vulgar)', exact: true },
  { word: 'baka', lang: 'Japanese', meaning: 'fool / idiot', exact: true },
  { word: 'pis', lang: 'Dutch / Danish / Turkish', meaning: 'urine / dirty', exact: true },
  { word: 'kut', lang: 'Dutch', meaning: 'a vulgar word', exact: true },
  { word: 'lul', lang: 'Dutch', meaning: 'a vulgar word', exact: true },
  { word: 'bog', lang: 'British English', meaning: 'toilet (slang)', exact: true },
  { word: 'pants', lang: 'British English', meaning: 'underwear / rubbish (slang)', exact: true },
  { word: 'fanny', lang: 'British English', meaning: 'a vulgar word', exact: true },
  { word: 'shi', lang: 'Mandarin / Japanese', meaning: 'can sound like "death" (死)', exact: true },
  { word: 'nova', lang: 'Spanish', meaning: '"no va" ("doesn\'t go"), a famously debated car-name example', exact: true },
  { word: 'chink', lang: 'English', meaning: 'an ethnic slur', exact: false },
  { word: 'retard', lang: 'English', meaning: 'an offensive slur', exact: false },
  { word: 'mong', lang: 'British English', meaning: 'an offensive slur', exact: true },
  { word: 'jap', lang: 'English', meaning: 'an ethnic slur', exact: true },
  { word: 'gyp', lang: 'English', meaning: 'derived from an ethnic slur', exact: true },
];

// Buzzwords that date a name.
export const TRENDY_WORDS = ['ai', 'gpt', 'llm', 'crypto', 'blockchain', 'metaverse', 'meta', 'nft', 'web3', 'cyber', 'smart', 'eco', 'digital', 'cloud', 'quantum', 'neo', 'nano', 'vr', 'ar', 'iot', '2.0', '3.0', 'x'];

// Geographic words that limit expansion and weaken trademark protection.
export const GEO_WORDS = [
  'american', 'america', 'usa', 'us', 'national', 'international', 'global', 'world', 'worldwide', 'continental', 'pacific', 'atlantic', 'midwest', 'southern',
  'northern', 'eastern', 'western', 'northeast', 'northwest', 'southeast', 'southwest', 'bay area', 'nyc', 'la', 'sf', 'texas', 'california', 'florida', 'new york',
  'chicago', 'boston', 'seattle', 'austin', 'denver', 'atlanta', 'miami', 'dallas', 'houston', 'phoenix', 'portland', 'brooklyn', 'manhattan', 'silicon valley',
  'carolina', 'jersey', 'ohio', 'georgia', 'virginia', 'colorado', 'arizona', 'nevada', 'oregon', 'washington', 'delaware', 'wyoming', 'metro', 'city', 'county',
];

// Common first names, used to spot "personal name" business names.
export const FIRST_NAMES = [
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'chris', 'christopher', 'daniel', 'matthew', 'anthony',
  'mark', 'paul', 'steven', 'andrew', 'josh', 'joshua', 'kevin', 'brian', 'george', 'edward', 'ryan', 'jacob', 'nick', 'eric', 'jonathan', 'justin', 'scott',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen', 'lisa', 'nancy', 'betty', 'sandra', 'ashley', 'emily',
  'kimberly', 'michelle', 'amanda', 'melissa', 'laura', 'rebecca', 'rachel', 'emma', 'olivia', 'sophia', 'ava', 'mia', 'priya', 'raj', 'rahul', 'amit', 'anita',
  'mohammed', 'muhammad', 'ahmed', 'ali', 'wei', 'li', 'jose', 'maria', 'juan', 'carlos', 'luis', 'ana', 'aakash', 'arjun', 'neha', 'pooja', 'vikram',
];
export const SURNAME_HINTS = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'wilson', 'anderson', 'taylor', 'thomas', 'moore', 'jackson', 'martin', 'lee', 'patel', 'shah', 'khan', 'singh', 'kumar', 'nguyen', 'kim', 'chen', 'wang'];

// Filler words that states ignore when deciding if two names are "the same".
export const ARTICLES = ['the', 'a', 'an', 'and', '&', 'of'];

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */
// search: the official business-entity / name-availability search.
// rules: notable state-specific naming rules (summary, not exhaustive).
// popular: commonly chosen formation states.
export const STATES = {
  AL: { name: 'Alabama', search: 'https://arc-sos.state.al.us/CGI/CORPNAME.MBR/INPUT', reservation: 'Alabama requires a name reservation certificate before you file formation documents.' },
  AK: { name: 'Alaska', search: 'https://www.commerce.alaska.gov/cbp/main/search/entities' },
  AZ: { name: 'Arizona', search: 'https://ecorp.azcc.gov/EntitySearch/Index' },
  AR: { name: 'Arkansas', search: 'https://www.sos.arkansas.gov/corps/search_all.php' },
  CA: {
    name: 'California', search: 'https://bizfileonline.sos.ca.gov/search/business', popular: true,
    rules: [
      { re: /\b(bank|trust|trustee|insurer|insurance company)\b/i, applies: ['llc'], level: 'fail', text: 'California LLC names may not contain "bank", "trust", "trustee", "insurer" or "insurance company" (Corp. Code § 17701.08).' },
    ],
    tip: 'California applies a "confusingly similar" test and checks names against existing CA entities and foreign entities registered in CA.',
  },
  CO: { name: 'Colorado', search: 'https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do' },
  CT: { name: 'Connecticut', search: 'https://service.ct.gov/business/s/onlinebusinesssearch' },
  DE: {
    name: 'Delaware', search: 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx', popular: true,
    tip: 'Delaware only requires the name to be "distinguishable on the record" from existing Delaware entities. Most VC-backed startups form here, then register as a foreign entity in the state where they operate.',
  },
  DC: { name: 'District of Columbia', search: 'https://corponline.dlcp.dc.gov/' },
  FL: {
    name: 'Florida', search: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName', popular: true,
    rules: [
      { re: /\b(bank|banking|trust|trust company|savings)\b/i, applies: '*', level: 'warn', text: 'Florida requires approval from the Office of Financial Regulation to use "bank", "trust" or "savings".' },
    ],
  },
  GA: { name: 'Georgia', search: 'https://ecorp.sos.ga.gov/BusinessSearch' },
  HI: { name: 'Hawaii', search: 'https://hbe.ehawaii.gov/documents/search.html' },
  ID: { name: 'Idaho', search: 'https://sosbiz.idaho.gov/search/business' },
  IL: { name: 'Illinois', search: 'https://apps.ilsos.gov/businessentitysearch/' },
  IN: { name: 'Indiana', search: 'https://bsd.sos.in.gov/publicbusinesssearch' },
  IA: { name: 'Iowa', search: 'https://sos.iowa.gov/search/business/search.aspx' },
  KS: { name: 'Kansas', search: 'https://www.sos.ks.gov/eforms/BusinessEntity/Search.aspx' },
  KY: { name: 'Kentucky', search: 'https://sosbes.sos.ky.gov/BusSearchNProfile/search.aspx' },
  LA: { name: 'Louisiana', search: 'https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx' },
  ME: { name: 'Maine', search: 'https://apps3.web.maine.gov/nei-sos-icrs/ICRS?MainPage=x' },
  MD: { name: 'Maryland', search: 'https://egov.maryland.gov/BusinessExpress/EntitySearch' },
  MA: { name: 'Massachusetts', search: 'https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx' },
  MI: { name: 'Michigan', search: 'https://mibusinessregistry.lara.state.mi.us/search/business' },
  MN: { name: 'Minnesota', search: 'https://mblsportal.sos.state.mn.us/Business/Search' },
  MS: { name: 'Mississippi', search: 'https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx' },
  MO: { name: 'Missouri', search: 'https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx' },
  MT: { name: 'Montana', search: 'https://biz.sosmt.gov/search/business' },
  NE: { name: 'Nebraska', search: 'https://www.nebraska.gov/sos/corp/corpsearch.cgi' },
  NV: {
    name: 'Nevada', search: 'https://esos.nv.gov/EntitySearch/OnlineEntitySearch', popular: true,
    rules: [
      { re: /\b(bank|banking|trust|insurance|engineer|engineering|university|college)\b/i, applies: '*', level: 'warn', text: 'Nevada requires approval from the relevant state agency for words like "bank", "trust", "insurance", "engineering" or "university".' },
    ],
  },
  NH: { name: 'New Hampshire', search: 'https://quickstart.sos.nh.gov/online/BusinessInquire' },
  NJ: { name: 'New Jersey', search: 'https://www.njportal.com/DOR/BusinessNameSearch' },
  NM: { name: 'New Mexico', search: 'https://enterprise.sos.nm.gov/search/business' },
  NY: {
    name: 'New York', search: 'https://dos.ny.gov/corporation-and-business-entity-database', popular: true,
    rules: [
      { re: /\b(acceptance|annuity|assurance|bank|benefit|bond|casualty|doctor|endowment|fidelity|finance|guaranty|indemnity|insurance|investment|lawyer|loan|mortgage|savings|surety|title|trust|underwriter)\b/i, applies: '*', level: 'warn', text: 'New York requires consent from the Department of Financial Services (or another agency) for words such as "acceptance", "annuity", "bond", "finance", "investment", "loan", "title" and "trust".' },
      { re: /\b(board of trade|chamber of commerce|community renewal|state police|state trooper|tenant relocation|urban development|urban relocation)\b/i, applies: '*', level: 'fail', text: 'New York restricts names implying a government or civic body (e.g. "chamber of commerce", "state police").' },
    ],
    tip: 'New York LLCs must also publish a notice of formation in two newspapers within 120 days, which can be expensive in NYC counties.',
  },
  NC: { name: 'North Carolina', search: 'https://www.sosnc.gov/online_services/search/by_title/_Business_Registration' },
  ND: { name: 'North Dakota', search: 'https://firststop.sos.nd.gov/search/business' },
  OH: { name: 'Ohio', search: 'https://businesssearch.ohiosos.gov/' },
  OK: { name: 'Oklahoma', search: 'https://www.sos.ok.gov/corp/corpInquiryFind.aspx' },
  OR: { name: 'Oregon', search: 'https://sos.oregon.gov/business/pages/find.aspx' },
  PA: { name: 'Pennsylvania', search: 'https://file.dos.pa.gov/search/business' },
  RI: { name: 'Rhode Island', search: 'https://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx' },
  SC: { name: 'South Carolina', search: 'https://businessfilings.sc.gov/BusinessFiling/Entity/Search' },
  SD: { name: 'South Dakota', search: 'https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx' },
  TN: { name: 'Tennessee', search: 'https://tncab.tnsos.gov/business-entity-search' },
  TX: {
    name: 'Texas', search: 'https://comptroller.texas.gov/taxes/franchise/account-status/search', popular: true,
    rules: [
      { re: /\b(lotto|lottery)\b/i, applies: '*', level: 'fail', text: 'Texas prohibits "lotto" and "lottery" in entity names.' },
      { re: /\b(veteran|veterans)\b/i, applies: '*', level: 'warn', text: 'Texas requires proof of veteran-organisation status to use "veteran".' },
    ],
    tip: 'The Texas Secretary of State\'s SOSDirect search charges a small fee per search. The Comptroller\'s free taxable-entity search (linked) covers most Texas-registered entities.',
  },
  UT: { name: 'Utah', search: 'https://businessregistration.utah.gov/NameAvailabilitySearch' },
  VT: { name: 'Vermont', search: 'https://bizfilings.vermont.gov/online/BusinessInquire/' },
  VA: { name: 'Virginia', search: 'https://cis.scc.virginia.gov/EntitySearch/Index' },
  WA: { name: 'Washington', search: 'https://ccfs.sos.wa.gov/#/BusinessSearch' },
  WV: { name: 'West Virginia', search: 'https://apps.wv.gov/SOS/BusinessEntitySearch/' },
  WI: { name: 'Wisconsin', search: 'https://apps.dfi.wi.gov/apps/corpsearch/search.aspx' },
  WY: {
    name: 'Wyoming', search: 'https://wyobiz.wyo.gov/Business/FilingSearch.aspx', popular: true,
    tip: 'Wyoming is popular for small LLCs: low fees, no state income tax, and owner privacy. If you operate elsewhere you\'ll still need to register as a foreign entity there.',
  },
};

/* ------------------------------------------------------------------ */
/* Domains & handles                                                   */
/* ------------------------------------------------------------------ */
export const CORE_TLDS = ['com', 'net', 'org', 'io', 'co', 'ai', 'app', 'dev'];
export const DOMAIN_PREFIXES = ['get', 'try', 'use', 'go', 'hey'];
export const DOMAIN_SUFFIXES = ['hq', 'app', 'co', 'labs', 'inc'];

export const SOCIAL_PLATFORMS = [
  { id: 'x', label: 'X (Twitter)', min: 4, max: 15, re: /^[a-z0-9_]+$/, url: h => `https://x.com/${h}` },
  { id: 'instagram', label: 'Instagram', min: 1, max: 30, re: /^[a-z0-9._]+$/, url: h => `https://www.instagram.com/${h}/` },
  { id: 'tiktok', label: 'TikTok', min: 2, max: 24, re: /^[a-z0-9._]+$/, url: h => `https://www.tiktok.com/@${h}` },
  { id: 'linkedin', label: 'LinkedIn', min: 2, max: 100, re: /^[a-z0-9-]+$/, url: h => `https://www.linkedin.com/company/${h}` },
  { id: 'youtube', label: 'YouTube', min: 3, max: 30, re: /^[a-z0-9._-]+$/, url: h => `https://www.youtube.com/@${h}` },
  { id: 'github', label: 'GitHub', min: 1, max: 39, re: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, url: h => `https://github.com/${h}` },
];
