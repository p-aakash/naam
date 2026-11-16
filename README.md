# Naam

**Is your company name ready to register?** Naam (नाम, "name") scores a company name from 0 to 100 and tells you exactly what to fix before you file.

**▶ Use it: https://p-aakash.github.io/naam/**

It's free with no sign-up and no tracking, and everything runs in your browser.

## What it checks

| Category | Weight | What's checked | How |
|---|---:|---|---|
| State availability | cap | **Live** search of the official business registries of New York, Connecticut, Texas, Colorado and Oregon; one-click official searches for every other state. An exact, active match in your formation state **blocks** the name; one in your operating state is a failure (you'd need a DBA there) | **Live** (state open data) |
| Legal & entity rules | 20 | Required suffix for the entity type (LLC, Inc., PLLC, LP…), wrong suffixes, restricted words needing regulator approval (Bank, Insurance, University, Engineering, CPA…), federally reserved words (FBI, Olympic, Red Cross…), state-specific rules (CA, NY, TX, FL, NV), foreign-qualification when you operate in another state, unusual characters | Rules |
| Distinctiveness & trademark | 20 | Collisions with ~190 famous brands (exact, embedded, one-letter typos), generic/descriptive names, geographic terms, personal names, initials, trend words, years | Rules |
| Domain availability | 20 | `.com` plus `.net .org .io .co .ai .app .dev`, industry extensions, and `.com` variations (`getname.com`, `namehq.com`…). A **Search domains** tab checks any domains you type (see below) | **Live** (RDAP, DNS fallback) |
| Pronunciation & memorability | 15 | Length, syllables, consonant clusters, digits/hyphens (the "radio test"), creative misspellings, doubled letters when joined, spelling ambiguity | Rules |
| Industry fit | 10 | Typical name length and tone for 24 industries, overused clichés (`-ify`, `-ly`, "Solutions"…), licensed terms, names that suggest a different regulated industry | Rules |
| Hidden meanings & safety | 10 | Embarrassing words hidden when written as one word (`expertsexchange`, `penisland`), profanity, unfortunate meanings in other languages | Rules |
| Social handles | 5 | Handle validity and length limits on X, Instagram, TikTok, LinkedIn, YouTube, GitHub, plus one-click profile links | Rules + links |

Problems compound. Each failed check costs extra points, any failure caps the score at 64 ("Fair"), and *blocking* issues cap it at 35. Blocking issues are things that would stop registration or invite legal action, such as a wrong entity suffix, a federally protected word, a famous brand, or explicit profanity.

### Live state registry search

Five states publish their business-entity registry as open data that a webpage can query directly. Naam searches all five in parallel from your browser, then compares names the way the states do: designators (LLC, Inc., Corp., Co., L.L.C.…), punctuation, "The" and "and/&" are ignored.

| State | Dataset | What it includes |
|---|---|---|
| New York | [Active Corporations](https://data.ny.gov/d/n9v6-gdp6) (Dept. of State) | All active entities, every type, plus out-of-state registrations |
| Connecticut | [Business Registry](https://data.ct.gov/d/n7gp-d28j) (Secretary of the State) | Active and inactive entities **and current name reservations** |
| Texas | [Active Franchise Taxpayers](https://data.texas.gov/d/9cir-efmm) (Comptroller) | Nearly every for-profit entity formed or registered in Texas |
| Colorado | [Business Entities](https://data.colorado.gov/d/4ykn-tg5h) (Secretary of State) | Every entity ever registered, with status |
| Oregon | [Active Businesses](https://data.oregon.gov/d/tckn-sxa6) (Secretary of State) | Active entities **and assumed business names (DBAs)** |

Each state gets a verdict:

- **Taken:** an identical name is active or reserved. The verdict applies to every entity type, because states compare names regardless of suffix.
- **Similar names:** a plural or one-letter variant is active, or the identical name is inactive, tax-only or an assumed name.
- **No conflict found** otherwise.

Every result shows the matching records (name, entity type, status, year), the dataset's last update date, and the official search link. Status rules follow each state's data: a delinquent Colorado entity still holds its name, and Texas "tax-only" registrations don't.

**Limits:** no conflict found is not approval, because the state decides when you file. The open data can lag the live registry by a few days, and name reservations (except Connecticut's), filings still in progress and county-level DBAs may not appear. Reserve the name if you aren't filing right away.

### What's live and what's guided

Naam is a static site with no server. That keeps it free, fast and private, but it limits what the browser is allowed to look up:

- **Live:** domain availability. Naam reads IANA's [RDAP bootstrap](https://data.iana.org/rdap/dns.json) and queries each registry's RDAP server directly (404 = unregistered). For extensions without RDAP (e.g. `.io`, `.co`), it uses DNS-over-HTTPS (Google, then Cloudflare). No DNS delegation shows as "Likely free".
- **Live:** state business registries for NY, CT, TX, CO and OR (above), queried directly from their open-data portals.
- **Guided:** the other state registries, the USPTO and social networks don't allow lookups from other websites. Naam applies their naming rules and links straight to the official searches for all 50 states and DC, the USPTO, WIPO, EUIPO TMview and OpenCorporates.

### Manual domain search

The **Domains** card has two tabs: *Suggestions* (generated from the name) and *Search domains*, where you can check up to 10 domains of your own at once.

It accepts messy input and explains what it did:

- **Pasted input:** full URLs (`https://www.naam.com/about`), emails (`hi@naam.com`), ports, trailing dots and full-width dots are all handled.
- **Missing extension:** a bare name (`naam`) is checked as `naam.com`.
- **Subdomains** reduce to the registrable domain, including multi-part extensions (`shop.naam.co.uk` → `naam.co.uk`).
- **Internationalised names** (`bücher.de`) are converted to Punycode. Mixed-script look-alikes, such as a Cyrillic "а" in `pаypal.com`, are flagged.
- **Rejected with a reason:** spaces and underscores (with a suggested fix), bad hyphens, labels over 63 characters, names over 253, IP addresses and emoji.
- **Unregistrable names are refused:** reserved ones (`.test`, `.local`, `.onion`, `example.com`…) and extensions that aren't in [IANA's official list](https://data.iana.org/TLD/tlds-alpha-by-domain.txt).
- **Results** flag eligibility rules (`.us` needs a US nexus, `.bank` needs a verified bank…), likely premium names, and domains that are expiring or suspended.
- **Housekeeping:** duplicates are removed, a new search cancels the previous one, and you get a clear message when offline.

#### Front-running protection

"Domain front-running" is when someone sees what you search for and registers it before you do. Naam is built to avoid it:

1. Lookups go **directly from your browser to the registry** that runs each extension, over RDAP. These are the same servers [ICANN Lookup](https://lookup.icann.org/en/lookup) queries. Naam has no server, so it never sees them.
2. Extensions without RDAP (e.g. `.io`, `.co`) fall back to **Cloudflare's** DNS-over-HTTPS resolver, whose policy is not to sell query data and to delete logs within 25 hours. Google Public DNS is used only if Cloudflare is unreachable.
3. Requests carry **no cookies and no referrer**, and **no registrar, reseller or "domain suggestion" site** is ever contacted. The end-to-end tests check every outgoing request to confirm this.
4. Results link to neutral sources only: **ICANN Lookup** (Naam copies the domain for you, because ICANN Lookup can't be pre-filled from a link) and **IANA's registry page** for each extension. When you're ready, register promptly with an [ICANN-accredited registrar](https://www.icann.org/en/contracted-parties/accredited-registrars/list-of-accredited-registrars).

## Run locally

No build step and no dependencies.

```bash
git clone https://github.com/p-aakash/naam.git
cd naam
python3 -m http.server 8000   # or: npx serve .
# open http://localhost:8000
```

ES modules need to be served over HTTP; opening `index.html` directly from disk won't work.

## Tests

```bash
npm test                 # unit tests: scoring, domain input parsing, domain checker (Node 20+)

npm install              # end-to-end tests in Chromium, with every network call mocked
npx playwright install chromium
npm run test:e2e
```

The unit tests need no dependencies. The end-to-end tests drive the real page, including the state-availability card with mocked registries: both tabs, keyboard navigation, messy input, limits, cancelled searches, copying to ICANN Lookup, offline mode, the phone layout, and an allow-list of every server the page contacts.

## Project layout

```
index.html          page markup
css/styles.css      responsive styles, light/dark themes
js/data.js          all rules & word lists (entity types, industries, states, brands…)
js/scoring.js       pure scoring engine (no DOM, no network)
js/domains.js       live RDAP / DNS-over-HTTPS domain checks
js/domain-input.js  parsing & validation for the manual domain search
js/registries.js    live state business-registry search (open data)
js/app.js           UI
tests/              unit tests (node:test)
tests/e2e/          browser tests (Playwright)
```

To add a rule, word list or state, edit `js/data.js`. It's plain data.

## Deploying

Every push to `main` runs the unit and end-to-end tests, then deploys to GitHub Pages via `.github/workflows/pages.yml`.

## Disclaimer

Naam is an informational tool, **not legal advice**. Naming rules vary by state and change over time, and no automated check replaces a full trademark clearance search. Always confirm availability with the official registry before filing.

## License

[MIT](LICENSE)
