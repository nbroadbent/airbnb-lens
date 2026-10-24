# Airbnb Lens

A Chrome extension (Manifest V3) that augments Airbnb's search results and listing
pages with information Airbnb withholds: calibrated ratings, true all-in nightly
prices, client-side filters, host scale, review trends, and fee breakdowns.

It runs entirely in your browser. It makes **no network requests**, has **no
backend**, collects **no analytics**, and only reads what is already in the page you
are looking at.

> **Disclaimer:** Airbnb Lens is an independent project. It is not affiliated with,
> endorsed by, or sponsored by Airbnb, Inc. "Airbnb" is a trademark of Airbnb, Inc.

## Status

**MVP (step 3) — search results page, verified live on 2026-10-21.**

1. **Calibrated rating badge** on every card. Airbnb's median listing rating is
   about 4.8, so a bare "4.7" reads as great when it's below average. Green
   4.9–5.0 "above avg", grey 4.8 "average", amber 4.6–4.7 "below avg", red ≤4.5
   "well below avg", blue "new" when unrated. Dimmed when there are fewer than 10
   reviews.
2. **True nightly price**: when Airbnb shows a stay total ("RM 2,340 for 4 nights",
   "$926 CAD total") Lens shows "RM 585/night all-in" under it. Monthly stays
   ("$5,668 CAD monthly") are divided by 30.4 nights. If only a base nightly rate is
   shown, Lens shows nothing rather than guess.
3. **Client-side filters** in a floating panel (bottom-right, collapsible,
   draggable) and in the toolbar popup: minimum rating, minimum review count, max
   price (per night all-in, or the stay total, via a selector), hide unrated,
   Superhost only. Hidden cards are removed from
   the grid reversibly and the panel reads "Showing 9 of 24".

Phase 2 (listing page: host scale, review trend, fee breakdown, requirements
checklist) is not started.

Works in **Chrome** (and Chromium browsers: Edge, Brave, Arc) and **Firefox 142+**.

## Build

Requires Node ≥ 20.19.

```sh
npm install
npm run build          # typecheck + Chrome build → dist/
npm run build:firefox  # typecheck + Firefox build → dist-firefox/
npm run build:all      # both
npm run dev            # Vite dev server with HMR for Chrome (writes dist/)
npm run test           # Vitest unit tests (jsdom, no live Airbnb)
npm run check          # typecheck + lint + format check + tests + both builds
```

The two builds are identical except the Firefox manifest adds the
`browser_specific_settings.gecko` block Firefox requires (add-on id, minimum
version, data-collection declaration). Chrome would warn about that key, hence two
output folders.

## Load unpacked in Chrome

1. Run `npm run build` (or `npm run dev` for live reload).
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` folder in this repo.
5. Visit any Airbnb search page, e.g.
   `https://www.airbnb.com/s/Honolulu--HI/homes`. A dark pill reading
   **"Airbnb Lens active · search results"** appears bottom-right.
6. Open DevTools → Console and filter on `[Lens]` to see the load message and a
   `diagnostics` object (counts of embedded JSON blocks and `data-testid`s).

After changing code: with `npm run dev`, content scripts hot-reload. With
`npm run build`, click the ↻ reload icon on the extension card in
`chrome://extensions`, then refresh the Airbnb tab.

## Load temporarily in Firefox

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist-firefox/manifest.json`.
4. Visit an Airbnb search page. If the pill does not appear, click the Lens toolbar
   icon: Firefox treats site access as optional for MV3 extensions, and the popup
   will show an **Allow access to Airbnb** button if access hasn't been granted. You
   can also grant it under `about:addons` → Airbnb Lens → **Permissions**.
5. Console output appears in the page's Web Console (`Ctrl/Cmd+Shift+K`), filter on
   `[Lens]`.

Temporary add-ons are removed when Firefox quits; reload from `about:debugging`
after each restart. Firefox's `storage.sync` requires the add-on id, which the
Firefox build sets; if sync is ever unavailable Lens falls back to `storage.local`.

## Is it working? The popup

Click the Lens icon in the toolbar (pin it from the extensions menu if hidden). The
popup shows one of:

- **Green** — "Lens is running on this search/listing page". Everything is fine.
- **Amber** — Lens is loaded on the tab but switched off. Flip the switch.
- **Red** — You are on Airbnb but the content script did not answer. Either the
  browser hasn't granted site access (Firefox; a grant button appears) or the page
  was loaded before the extension was installed/updated (reload the page).
- **Grey** — Not an Airbnb page.

The popup also has:

- **On/Off switch** (top-right). Off removes every element Lens injected and
  un-hides any filtered cards, on every open Airbnb tab, immediately.
- **Search filters** — minimum rating, minimum review count, maximum price (per
  night all-in or stay total, selectable), hide unrated, Superhost only. Saved to `chrome.storage.sync` as you change
  them and applied to open search tabs immediately. The on-page panel edits the same
  settings.
- **Show status pill** — the small pill shown on listing pages (where there is no
  panel yet).
- **Copy diagnostics** — when something looks wrong, click this on the Airbnb tab and
  paste the result into a bug report. It contains what Lens read from the page, with
  any cards it could not price listed first. No account data is included.

All settings sync across your browsers through `chrome.storage.sync` when you are
signed in; otherwise they're local to the profile.

## Project layout

```
manifest.config.ts     MV3 manifest (matches derived from src/domains.ts)
src/domains.ts         Every Airbnb country domain — single source of truth
src/selectors.ts       EVERY DOM selector, documented and dated
src/content/index.ts   Content-script entry: page detection + augmentation loop
src/content/hello.ts   Status pill (listing pages) + page diagnostics
src/content/search.ts  Search page: badge, per-night price, filtering orchestration
src/content/cards.ts   Card DOM access: find cards, read id/rating/price/Superhost (fallback)
src/content/panel.ts   Floating filter panel (collapsible, draggable)
src/lib/embedded.ts    Read + walk Airbnb's embedded JSON (primary data source)
src/lib/listing.ts     Embedded search-result object → ListingSummary
src/lib/price.ts       Money parsing, nights, per-night math
src/lib/rating.ts      Rating text parsing + calibration tiers
src/lib/filter.ts      Pure filter decisions
src/popup/             Toolbar popup: running-status check, on/off switch, filter settings
src/lib/settings.ts    Typed settings + chrome.storage.sync persistence (local fallback)
src/lib/messages.ts    Popup ↔ content-script message shapes
src/lib/log.ts         `[Lens]`-prefixed logging and the `guarded()` try/catch wrapper
src/lib/page.ts        URL → 'search' | 'listing' | 'other'
src/lib/spa.ts         MutationObserver + URL-change watcher for Airbnb's SPA
src/lib/dom.ts         `data-lens="1"` tagging and idempotency helpers
fixtures/              Saved Airbnb HTML the parser tests run against (see fixtures/CAPTURES.md)
SELECTOR_AUDIT.md      How to re-verify each selector after an Airbnb redesign
```

## When Airbnb changes its DOM

Airbnb obfuscates class names and changes them on every deploy, so Lens never uses
class names. It anchors on embedded JSON first, then `data-testid`, ARIA, and text
patterns. When something breaks:

1. Open the Airbnb page, open DevTools Console, filter on `[Lens]`. Failed
   augmentations are logged with the feature name and the error.
2. Open `SELECTOR_AUDIT.md`. Each selector has a one-line "how to verify" you can
   paste into the console.
3. Fix the selector in `src/selectors.ts` **only** — no selector strings live
   anywhere else. Update the `verified` date and status.
4. If the embedded JSON shape changed, save a fresh fixture (see
   `fixtures/README.md`) and update the parser tests to match.
5. Rebuild, reload the extension, and add a line to `CHANGELOG.md`.

## How the data flows

1. The search page embeds its first page of results as JSON in
   `<script id="data-deferred-state-0">`. Lens parses it and walks the tree for
   `StaySearchResult` objects (no hard-coded path), indexing them by listing id.
2. Each card on screen is matched to that index by the numeric id in its
   `/rooms/<id>` link.
3. Cards the JSON doesn't know about (after "Show more", map moves, or client-side
   pagination) fall back to reading the card's own text: the rating span
   ("4.96 (49)"), the accessible price line ("RM 2,340 for 4 nights"), and the
   "Superhost" overlay badge.
4. Filtering hides the card's grid cell, found structurally (walk up until the parent
   holds several cards) so the grid reflows with no gaps. Everything is reversible.

## Design rules

- Every injected element carries `data-lens="1"`; augmentations are idempotent.
- Every augmentation runs inside `guarded()`; one failing card never breaks the page.
- Structured data (embedded JSON) is the primary source; DOM scraping is fallback.
- No network calls, no remote code, no clicking on the user's behalf.
- Boring, resilient code over clever code.

## Icon

`assets/icon.svg` is the source. The PNGs in `public/icons/` (16, 32, 48, 128 px) are
rasterised from it and referenced from the manifest for the toolbar and extension
pages. To regenerate after editing the SVG, render it at each size with any
rasteriser (for example `rsvg-convert -w 128 assets/icon.svg > public/icons/icon-128.png`)
and rebuild.

## Permissions

| Permission                         | Why                                               |
| ---------------------------------- | ------------------------------------------------- |
| `storage`                          | Persist filter settings via `chrome.storage.sync` |
| content script on `*.airbnb.<tld>` | Read and augment the page you're viewing          |

## License

MIT
