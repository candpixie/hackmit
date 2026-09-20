# Insights card dashboard

Open `/insights`. The existing archive application remains at `/`, with a link to
the new dashboard. No backend routes or insight-generation code were changed.

`CARDS_CONTRACT.md` and `cards.example.json` are unchanged copies of the supplied
files. The only development-data import is in `src/app/insights/page.tsx`.
Later, pass the API's `CardsEnvelope` to `InsightsDashboard` instead; the card
renderer does not need to know how the cards were generated.

## Run locally

After installing the repository's locked dependencies:

```sh
npm run dev -- --webpack --hostname 127.0.0.1
```

Visit http://127.0.0.1:3000/insights. `--webpack` is useful in environments where
Turbopack's internal worker sockets are restricted; the existing scripts and
Next configuration remain unchanged.

## Verify

```sh
node --experimental-strip-types --test tests/cards.test.mjs
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build -- --webpack
```

There is no configured lint command in this repository. The existing layout
downloads Google Fonts during a fresh build, so that build needs network access.

## UI behavior

- `src/lib/cards.ts` matches the contract, including an open-ended string `kind`.
- `InsightCard` is the single renderer for ranked people and every feed kind.
- People sort by ascending rank; the feed sorts by descending score. Neither
  operation mutates the input array.
- Empty stats/evidence omit their containers. Null actions omit the CTA entirely.
- Evidence retains source order. A changed chat, UTC date, or gap of at least
  four hours starts a separate exchange. Cross-thread evidence labels every chat.
- Times explicitly display in UTC so server rendering and browser hydration agree.
- Draft dialogs support editing, copying, Cancel, Escape, and backdrop dismissal.
  The browser's native dialog manages focus and keyboard containment.
- Null-draft actions show a read-only share preview and Copy, not a draft editor.
- Open Instagram opens the inbox, not a fabricated URL based on export thread IDs.
  Nothing sends automatically, and no regenerate endpoint is called.

The supplied titles, bodies, stats, evidence, and drafts are displayed verbatim.
This frontend does not validate the truth of the backend's claims.
