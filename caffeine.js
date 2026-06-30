// Pure caffeine pharmacokinetics helpers.
// No DOM, no storage — safe to unit-test in Node and reuse in the browser.

// Caffeine elimination follows first-order kinetics. A ~5h half-life is the
// commonly cited average for a healthy adult.
export const DEFAULT_HALF_LIFE_HOURS = 5;

// FDA's "generally safe" daily ceiling for healthy adults.
export const DEFAULT_DAILY_LIMIT_MG = 400;

// Below this much circulating caffeine, sleep is generally unaffected.
export const SLEEP_THRESHOLD_MG = 50;

const MS_PER_HOUR = 1000 * 60 * 60;

// Amount of a single dose still in the body `hours` after it was consumed.
export function remainingFromDose(doseMg, hoursElapsed, halfLife = DEFAULT_HALF_LIFE_HOURS) {
  if (hoursElapsed < 0) return 0; // dose hasn't happened yet
  return doseMg * Math.pow(0.5, hoursElapsed / halfLife);
}

// Total circulating caffeine (mg) at time `atMs`, summed over all entries.
// `entries` is an array of { mg, time } where time is an ISO string or ms.
export function caffeineAt(entries, atMs, halfLife = DEFAULT_HALF_LIFE_HOURS) {
  return entries.reduce((total, e) => {
    const t = typeof e.time === 'number' ? e.time : Date.parse(e.time);
    const hoursElapsed = (atMs - t) / MS_PER_HOUR;
    return total + remainingFromDose(e.mg, hoursElapsed, halfLife);
  }, 0);
}

// Sum of mg consumed within the same calendar day as `referenceMs`.
export function totalForDay(entries, referenceMs) {
  const ref = new Date(referenceMs);
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  const end = start + 24 * MS_PER_HOUR;
  return entries.reduce((sum, e) => {
    const t = typeof e.time === 'number' ? e.time : Date.parse(e.time);
    return t >= start && t < end ? sum + e.mg : sum;
  }, 0);
}

// Earliest time from `fromMs` at which circulating caffeine drops to/below
// `threshold`. Returns ms, or null if already below or never reached in 24h.
export function sleepReadyAt(
  entries,
  fromMs,
  threshold = SLEEP_THRESHOLD_MG,
  halfLife = DEFAULT_HALF_LIFE_HOURS
) {
  if (caffeineAt(entries, fromMs, halfLife) <= threshold) return null;
  const stepMs = 5 * 60 * 1000; // 5-minute resolution
  for (let t = fromMs; t <= fromMs + 24 * MS_PER_HOUR; t += stepMs) {
    if (caffeineAt(entries, t, halfLife) <= threshold) return t;
  }
  return null; // still elevated 24h out
}

// Build a series of { ms, mg } points across [startMs, endMs] for charting.
export function decaySeries(entries, startMs, endMs, points = 96, halfLife = DEFAULT_HALF_LIFE_HOURS) {
  const series = [];
  const span = endMs - startMs;
  for (let i = 0; i <= points; i++) {
    const ms = startMs + (span * i) / points;
    series.push({ ms, mg: caffeineAt(entries, ms, halfLife) });
  }
  return series;
}
