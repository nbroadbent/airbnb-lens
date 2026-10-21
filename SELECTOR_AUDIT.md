# Selector audit

Every selector Airbnb Lens uses, where it lives, and how to re-verify it. The code
of record is `src/selectors.ts`; this file must be kept in sync with it.

Rules:

- **No class names.** Airbnb's are obfuscated and rotate every deploy.
- Preference order: embedded JSON → `data-testid` → ARIA role/label → text pattern.
- Each entry has a status (`VERIFIED` / `UNVERIFIED`) and the ISO date it was last
  checked. "UNVERIFIED" means it came from the spec or memory and has not yet been
  confirmed against a fixture or live page; **no feature may depend on it** until it is.

## How to run a full audit

1. Open a search-results page with dates selected and a listing page in Chrome.
2. Open DevTools → Console. For each entry below, paste the **Verify** snippet.
3. Record the result and today's date in both this file and `src/selectors.ts`.
4. If a selector fails, fix it in `src/selectors.ts` only, re-run `npm run check`,
   and note the change in `CHANGELOG.md`.

## Selectors

| Name                  | Selector                                 | Targets                                                           | Status     | Verified   |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------- | ---------- | ---------- |
| `mountRoot`           | `body`                                   | Host for Lens' own floating UI                                    | VERIFIED   | 2026-10-21 |
| `deferredStateScript` | `script[id^="data-deferred-state"]`      | Embedded JSON ("niobeClientData") — primary data source           | VERIFIED   | 2026-10-21 |
| `ldJsonScript`        | `script[type="application/ld+json"]`     | Schema.org JSON-LD (not used yet)                                 | UNVERIFIED | 2026-10-21 |
| `card`                | `[data-testid="card-container"]`         | One search-result card                                            | VERIFIED   | 2026-10-21 |
| `cardWrapper`         | `[itemprop="itemListElement"]`           | ListItem wrapper (fallback only; grid cell is found structurally) | VERIFIED   | 2026-10-21 |
| `cardLink`            | `a[href*="/rooms/"]`                     | Listing links in a card; href carries the numeric id              | VERIFIED   | 2026-10-21 |
| `cardTitle`           | `[data-testid="listing-card-title"]`     | Card title line                                                   | VERIFIED   | 2026-10-21 |
| `ratingDisplay`       | `span[aria-hidden="true"]` + text regex  | Visible "4.96 (49)" span                                          | VERIFIED   | 2026-10-21 |
| `priceRow`            | `[data-testid="price-availability-row"]` | Price block containing the "RM 2,340 for 4 nights" leaf span      | VERIFIED   | 2026-10-21 |

Text patterns (`patterns` in `src/selectors.ts`), all VERIFIED 2026-10-21 except `newListing`:

| Name             | Regex (abridged)                                         | Example                                      |
| ---------------- | -------------------------------------------------------- | -------------------------------------------- |
| `ratingDisplay`  | `^(\d[.,]\d{1,2})\s*\((\d[\d.,]*)\)$`                    | `4.96 (49)`                                  |
| `ratingA11y`     | `(\d[.,]\d{1,2}) out of 5 average rating, (\d+) reviews` | `4.96 out of 5 average rating,  49 reviews`  |
| `priceForNights` | `^(.+?)\s+for\s+(\d+)\s+nights?(?:,.*)?$`                | `RM 1,919 for 4 nights, originally RM 2,264` |
| `superhost`      | `^superhost$` (i)                                        | `Superhost`                                  |
| `newListing`     | `^new$` (i) — UNVERIFIED                                 | `New`                                        |
| `roomId`         | `/rooms/(?:plus/)?(\d+)`                                 | `/rooms/1399543851857782624?…`               |

### Quick console checks (search page with dates set)

```js
document.querySelectorAll('[data-testid="card-container"]').length // ≥ 18
JSON.parse(document.querySelector('script[id^="data-deferred-state"]').textContent).niobeClientData // defined
;[...document.querySelectorAll('[data-testid="card-container"] span[aria-hidden="true"]')].filter(
  (s) => /^\d\.\d{1,2} \(\d+\)$/.test(s.textContent.trim()),
).length // ≈ card count
;[...document.querySelectorAll('[data-testid="price-availability-row"] span')].filter((s) =>
  /for \d+ nights?/.test(s.textContent),
).length // ≈ card count
```

### Embedded JSON shape (verified 2026-10-21, fixtures/search-ssr.html)

Objects with `__typename: "StaySearchResult"` anywhere under `niobeClientData`:

- `avgRatingLocalized`: `"4.96 (49)"`; `avgRatingA11yLabel`: `"4.96 out of 5 average rating,  49 reviews"`
- `badges[].text`: `"Guest favorite"` / `"Superhost"`
- `demandStayListing.id`: base64 of `DemandStayListing:<numeric id>`
- `structuredDisplayPrice.primaryLine` comes in three shapes (all have `accessibilityLabel`, e.g. `"$909 for 5 nights"`):
  - `QualifiedDisplayPriceLine`: `price: "RM 2,340"`, `qualifier: "for 4 nights"`
  - `DiscountedDisplayPriceLine`: `discountedPrice`, `originalPrice`, `qualifier`
  - `OrderedDisplayPriceLine`: `orderedComponents: [{ discountedPrice | price }, { qualifier }]` (fixture: `search-ssr-nodates-usd.html`)
- `structuredDisplayPrice.displayPriceStyle`: `"TOTAL_ONLY"` (page banner: "Prices include all fees")

## Page-type detection (URL patterns, not selectors)

`src/lib/page.ts` classifies pages by path. Verified 2026-10-21:

| Kind    | Path pattern                                              | Example                               |
| ------- | --------------------------------------------------------- | ------------------------------------- |
| search  | `/s/…` (optionally prefixed by a locale like `/fr/`)      | `/s/Honolulu--HI/homes?adults=2`      |
| listing | `/rooms/<id>`, `/rooms/plus/<id>`, `/luxury/listing/<id>` | `/rooms/12345678?check_in=2026-11-01` |

Re-verify by visiting each page type and checking the `[Lens] augment … → <kind>`
console line.
