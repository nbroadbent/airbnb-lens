# Fixture captures

| File                          | What                                                                                  | URL                                                                                                          | Captured   |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `search-ssr.html`             | Server HTML as fetched (no rendered cards; holds the embedded JSON)                   | `https://www.airbnb.com/s/Honolulu--HI--United-States/homes?checkin=2026-12-01&checkout=2026-12-05&adults=2` | 2026-10-21 |
| `search.html`                 | Same page after client render in headless Chromium: 24 cards + JSON                   | same                                                                                                         | 2026-10-21 |
| `search-ssr-nodates-usd.html` | Server HTML, no dates, `currency=USD`; 16 of 48 results use `OrderedDisplayPriceLine` | `https://www.airbnb.com/s/Honolulu--HI--United-States/homes?adults=2&currency=USD&display_currency=USD`      | 2026-10-21 |
| `listing.html`                | _pending_ (needed for Phase 2)                                                        |                                                                                                              |            |

Currency in these captures is MYR ("RM") because of where the fetch was geolocated;
the parsers are currency-agnostic.
