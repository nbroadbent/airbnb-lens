# Fixtures

Saved HTML snapshots of real Airbnb pages. Parsers are unit-tested against these
with jsdom so tests never touch live Airbnb.

Files (see `CAPTURES.md` for dates and URLs):

- `search-ssr.html` — raw server response for a search with dates; contains the
  embedded JSON but no rendered cards.
- `search.html` — the same search after client-side rendering; 24 cards.
- `listing.html` — _still needed_: a listing detail page with dates selected, e.g.
  `https://www.airbnb.com/rooms/<id>?check_in=…&check_out=…`

## How to save a snapshot

1. Open the page in Chrome, let it fully load, scroll once so lazy content renders.
2. DevTools → Elements → right-click `<html>` → **Copy → Copy outerHTML**, paste into
   the file. (Prefer this over "Save page as…", which rewrites script tags and can
   drop the `data-deferred-state` blob.)
3. Note the capture date in `fixtures/CAPTURES.md`.

Fixtures are gitignored by Prettier and ESLint; they are allowed in git but can be
large. Strip nothing — the embedded `<script>` JSON is the primary data source.
