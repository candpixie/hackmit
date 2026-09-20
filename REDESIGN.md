# Overdue — social replay redesign

Local copy of https://github.com/candpixie/hackmit with a colorful Wrapped-inspired dashboard and six interactive web slides.

## Preview

- `/wrapped?demo=1`: all six slides, using the repository's synthetic Instagram archive.
- `/insights`: redesigned dashboard; uses the loaded archive or the existing sample corpus.
- `/wrapped`: load your own archive or select the sample preview.

Extra-bold Plus Jakarta Sans replaces Instrument Serif. Slides use Instagram-inspired pink, purple, coral, and peach colors, with warm gradients on the cover and ending. Simple cards, oversized type, multicolor wavy rings, ribbons, edge bursts, and keyboard/button navigation keep the replay easy to read. Source-message emojis are hidden in slide quotes and dashboard evidence without changing archive data or analysis.

## Run

```sh
npm ci
npm run build -- --webpack
npm run start -- --hostname 127.0.0.1 --port 3000
```

For editing (including loading a local export directory):

```sh
WATCHPACK_POLLING=true npm run dev -- --webpack --hostname 127.0.0.1 --port 3000
```

The production server supports the sample and existing sessions; local-folder import follows the repository's existing development-only restriction. Fresh builds download Google Fonts.

## Validation

Production build and TypeScript passed. All eight existing card tests passed. Preview checked in the browser, including slide navigation and the interactive guess reveal.
