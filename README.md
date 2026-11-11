# Naam

**Is your company name ready to register?** Naam (नाम, "name") scores a company name from 0 to 100 and tells you exactly what to fix before you file.

**▶ Use it: https://p-aakash.github.io/naam/**

It's free with no sign-up and no tracking, and everything runs in your browser.

## What it checks

| Category | Weight | What's checked | How |
|---|---:|---|---|
| Legal & entity rules | 20 | Required suffix for the entity type (LLC, Inc., PLLC, LP…), wrong suffixes, restricted words needing regulator approval (Bank, Insurance, University, Engineering, CPA…), federally reserved words (FBI, Olympic, Red Cross…), state-specific rules (CA, NY, TX, FL, NV), foreign-qualification when you operate in another state, unusual characters | Rules |
| Distinctiveness & trademark | 20 | Collisions with ~190 famous brands (exact, embedded, one-letter typos), generic/descriptive names, geographic terms, personal names, initials, trend words, years | Rules |
| Domain availability | 20 | `.com` plus `.net .org .io .co .ai .app .dev`, industry extensions, and `.com` variations (`getname.com`, `namehq.com`…) | **Live** (RDAP, DNS fallback) |
| Pronunciation & memorability | 15 | Length, syllables, consonant clusters, digits/hyphens (the "radio test"), creative misspellings, doubled letters when joined, spelling ambiguity | Rules |
| Industry fit | 10 | Typical name length and tone for 24 industries, overused clichés (`-ify`, `-ly`, "Solutions"…), licensed terms, names that suggest a different regulated industry | Rules |
| Hidden meanings & safety | 10 | Embarrassing words hidden when written as one word (`expertsexchange`, `penisland`), profanity, unfortunate meanings in other languages | Rules |
| Social handles | 5 | Handle validity and length limits on X, Instagram, TikTok, LinkedIn, YouTube, GitHub, plus one-click profile links | Rules + links |

Problems compound. Each failed check costs extra points, any failure caps the score at 64 ("Fair"), and *blocking* issues cap it at 35. Blocking issues are things that would stop registration or invite legal action, such as a wrong entity suffix, a federally protected word, a famous brand, or explicit profanity.

### What's live and what's guided

Naam is a static site with no server. That keeps it free, fast and private, but it limits what the browser is allowed to look up:

- **Live:** domain availability. Naam reads IANA's [RDAP bootstrap](https://data.iana.org/rdap/dns.json) and queries each registry's RDAP server directly (404 = unregistered). For extensions without RDAP (e.g. `.io`, `.co`), it uses DNS-over-HTTPS (Google, then Cloudflare). No DNS delegation shows as "Likely free".
- **Guided:** state business registries, the USPTO and social networks don't allow lookups from other websites. Naam applies their naming rules and links straight to the official searches for all 50 states and DC, the USPTO, WIPO, EUIPO TMview and OpenCorporates.

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
node --test tests/
```

Requires Node 20+. Tests cover the scoring rules and the domain checker (with mocked network).

## Project layout

```
index.html          page markup
css/styles.css      responsive styles, light/dark themes
js/data.js          all rules & word lists (entity types, industries, states, brands…)
js/scoring.js       pure scoring engine (no DOM, no network)
js/domains.js       live RDAP / DNS-over-HTTPS domain checks
js/app.js           UI
tests/              node:test suites
```

To add a rule, word list or state, edit `js/data.js`. It's plain data.

## Deploying

Every push to `main` runs the tests and deploys to GitHub Pages via `.github/workflows/pages.yml`.

## Disclaimer

Naam is an informational tool, **not legal advice**. Naming rules vary by state and change over time, and no automated check replaces a full trademark clearance search. Always confirm availability with the official registry before filing.

## License

[MIT](LICENSE)
