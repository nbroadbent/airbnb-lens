# Changelog

All notable changes to Airbnb Lens. Dates are ISO (YYYY-MM-DD).

## [0.3.0] — 2026-10-21

### Added

- **Price basis selector** next to "Max price / night" in the panel and popup:
  **all-in** (stay total ÷ nights, the default) or **nightly rate** (the rate before
  fees, read from Airbnb's price breakdown "4 nights x $201.51"). The card tooltip
  shows both figures. In nightly mode, cards whose pre-fee rate is unknown are shown
  and counted in the panel note.

## [0.2.4] — 2026-10-21

### Fixed

- **Price filter did nothing on Canadian (regulated-total) pages.** There the price
  line is "$926 CAD total" with no night count, so no per-night price was computed and
  nothing could be filtered. Nights now come from the price breakdown
  ("4 nights x $201.51 CAD") or, failing that, the URL's check-in/check-out dates.
  Fixture `fixtures/search-cad-regulated.html` added with JSON and DOM tests.
- Currency codes after the amount ("$926 CAD") are kept and shown ("$232 CAD/night all-in").
- When Airbnb shows only a nightly rate ("$150 night"), Lens now hides cards whose
  listed rate already exceeds the cap (fees can only add to it) and says how many
  cards were judged on the listed rate.

## [0.2.3] — 2026-10-21

### Fixed

- Max price filter ignored some cards: Airbnb has a third price-line shape,
  `OrderedDisplayPriceLine`, with the total and "for N nights" inside
  `orderedComponents`. Seen on a no-dates USD search where 16 of 48 results used
  it. The summarizer now reads that shape and falls back to the line's
  `accessibilityLabel`. New fixture `fixtures/search-ssr-nodates-usd.html` with a test
  asserting every result gets a per-night price.
- Min reviews / max price fields accept "1,000" or "$500" instead of silently
  treating them as empty (plain text inputs with lenient parsing).
- When a price cap is active and some cards have no all-in price, the panel now says
  so instead of silently showing them.

## [0.2.2] — 2026-10-21

### Changed

- Minimum-rating threshold now has 0.01 precision: the slider steps by 0.01 and a
  number box next to it accepts typed values such as 4.85 (panel and popup).
  Stored values are rounded to two decimals.

## [0.2.1] — 2026-10-21

### Fixed

- Min reviews and max price fields could not be typed into: every augmentation pass
  re-pushed stored filter values into the panel, wiping the field before blur saved
  it. The panel and popup now never overwrite a focused field, and number fields apply
  as you type (debounced) and on Enter.
- The content script re-augmented the page every 250 ms forever: its own badge/price
  rewrites were seen by the MutationObserver as page changes. Lens-owned mutations
  are now ignored and unchanged text is no longer rewritten. Idle passes went from
  ~4/second to 0.
- Keystrokes inside the panel no longer bubble to Airbnb's document-level handlers.

## [0.2.0] — 2026-10-21

### Added

- **MVP search-page features, verified live in Chrome:** calibrated rating badge,
  true all-in nightly price, and client-side filters with a floating panel
  (collapsible, draggable, position persisted) showing "Showing X of Y".
- Embedded-JSON reader (`src/lib/embedded.ts`) and `StaySearchResult` summarizer
  (`src/lib/listing.ts`), derived from real captures. Listing ids are decoded from
  the base64 `DemandStayListing:<id>` form so cards match by their `/rooms/<id>` link.
- DOM fallback (`src/content/cards.ts`) for cards missing from the JSON, reading the
  rating span, the accessible "… for N nights" price line, and the Superhost badge.
- Fixtures: `fixtures/search-ssr.html` (server HTML, holds the JSON) and
  `fixtures/search.html` (rendered DOM with 24 cards). 42 unit tests run against them.
- Selector audit updated: card, grid cell, link, title, rating pattern, price row all
  VERIFIED 2026-10-21.

### Changed

- Rating tiers use plain thresholds on the displayed value (4.85 is "average",
  4.56 is "well below avg").
- Toolbar popup filters are now applied live; status pill shows on listing pages only.

### Known limitations

- Filters only use data visible on the page. New cards loaded by scrolling or map
  moves are read from the DOM, which lacks "Guest favorite".
- Unrated ("New") cards have not been seen in a capture yet; handling is
  best-effort until one is.

## [0.1.0] — 2026-10-21

### Added

- Project scaffold: TypeScript (strict), Vite 8 + `@crxjs/vite-plugin` 3, Vitest 4
  with jsdom, ESLint 9 (typescript-eslint strict + stylistic), Prettier.
- MV3 manifest generated from `manifest.config.ts`; content-script matches derived
  from the enumerated Airbnb country domains in `src/domains.ts` (Chrome rejects a
  TLD wildcard, so `*://*.airbnb.*/*` is expanded).
- Content script that classifies the page (search / listing / other), renders an
  idempotent "Airbnb Lens active" status pill, and logs `[Lens]` diagnostics about
  the embedded data sources found on the page.
- SPA watcher (`src/lib/spa.ts`): debounced `MutationObserver` on `document.body`
  plus URL-change detection and `popstate`.
- `src/selectors.ts` as the single home for every selector, with status and
  verification date; `SELECTOR_AUDIT.md` mirrors it.
- Unit tests for page classification, domain matching, and status-pill idempotency.

- Firefox support: `npm run build:firefox` emits `dist-firefox/` with the
  `browser_specific_settings.gecko` block (id, `strict_min_version` 142,
  `data_collection_permissions: none`). Content script is built as a standalone IIFE
  so it has no dynamic `import()` to differ between browsers.
- Toolbar popup (plain TS): reports whether the content script is running on the
  current tab (pings it), master on/off switch, filter settings (min rating, min
  reviews, max all-in nightly, hide unrated, Superhost only), status-pill toggle, and
  an "Allow access to Airbnb" button for Firefox's optional host permissions.
- `src/lib/settings.ts`: typed settings with `normalizeSettings()` so corrupt or
  partial stored values can never crash; `chrome.storage.sync` with `storage.local`
  fallback; change subscription so content scripts react instantly.
- Content script tears down everything it injected (and un-hides cards) when
  switched off.

### Notes

- Vitest is pinned to 4.x: `npm install` (npm 10.8) crashes resolving Vitest 5's
  circular optional peer dependencies. Vitest 4 supports Vite 8.
