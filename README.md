# ☕ Decaf — Caffeine Tracker

A small, **local-first** web app that tracks your caffeine intake and estimates
when you'll be clear to sleep. No accounts, no servers, no API keys — your data
never leaves your browser.

> Built in response to the "read my mind" AI meme. It can't read minds, but it
> *can* model the caffeine in your bloodstream and tell you when you'll sleep.

## Features

- **Quick-log presets** for common drinks (coffee, espresso, cold brew, tea,
  energy drinks…) plus a custom-amount entry.
- **Circulating caffeine** — models first-order elimination (configurable
  ~5h half-life) to show how much caffeine is in your system *right now*.
- **Daily total vs. limit** — tracks against the FDA's 400 mg/day guideline
  (configurable), with an over-limit warning.
- **Sleep-ready estimate** — the time your circulating caffeine drops below a
  sleep-safe threshold (default 50 mg).
- **24-hour decay chart** rendered on a `<canvas>` with a "now" marker and the
  sleep threshold line.
- **Persistent** via `localStorage`; entries older than 48h are auto-pruned.

## Run it

It's plain HTML/CSS/JS with no build step. Because it uses ES modules, open it
through a local server rather than `file://`:

```bash
npm start          # serves on http://localhost:8137
# then open http://localhost:8137 in your browser
```

(Any static server works — e.g. `python3 -m http.server`.)

## Test

The caffeine pharmacokinetics are isolated in `caffeine.js` (pure functions, no
DOM) so they're unit-testable in Node:

```bash
npm test
```

## How the math works

Caffeine is eliminated with first-order kinetics, so a dose `D` taken `h` hours
ago contributes `D · 0.5^(h / halfLife)` to your current level. The app sums this
across all recent doses to get circulating caffeine, and steps forward in time to
find when that total falls below the sleep threshold.

These are population-average estimates — real caffeine metabolism varies widely
by person (genetics, liver function, pregnancy, medications, smoking). Treat the
numbers as a guide, not medical advice.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App markup |
| `styles.css` | Dark, coffee-toned UI |
| `caffeine.js` | Pure pharmacokinetics helpers (tested) |
| `app.js` | UI wiring, state, `localStorage`, canvas chart |
| `test.mjs` | Unit tests for `caffeine.js` |

## License

MIT
