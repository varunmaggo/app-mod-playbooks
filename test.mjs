// Unit tests for the caffeine math. Run with: npm test  (or: node test.mjs)
import assert from 'node:assert/strict';
import {
  remainingFromDose,
  caffeineAt,
  totalForDay,
  sleepReadyAt,
  decaySeries,
} from './caffeine.js';

let passed = 0;
const t = (name, fn) => {
  fn();
  passed++;
  console.log('  ✓ ' + name);
};

t('one half-life halves the dose', () => assert.equal(remainingFromDose(100, 5, 5), 50));
t('two half-lives quarter the dose', () => assert.equal(remainingFromDose(100, 10, 5), 25));
t('a future dose contributes nothing', () => assert.equal(remainingFromDose(100, -1, 5), 0));

const now = Date.parse('2026-06-29T12:00:00');
const entries = [
  { mg: 95, time: '2026-06-29T08:00:00' },
  { mg: 63, time: '2026-06-29T11:00:00' },
];

t('caffeineAt sums decayed doses in range', () => {
  const lvl = caffeineAt(entries, now, 5);
  assert.ok(lvl > 100 && lvl < 158, 'got ' + lvl);
});
t('totalForDay sums raw mg consumed today', () => assert.equal(totalForDay(entries, now), 158));
t('sleepReadyAt returns a future time below threshold', () => {
  const ready = sleepReadyAt(entries, now, 50, 5);
  assert.ok(ready > now);
  assert.ok(caffeineAt(entries, ready, 5) <= 50);
});
t('sleepReadyAt returns null when already below threshold', () => {
  assert.equal(sleepReadyAt([{ mg: 10, time: '2026-06-29T11:00:00' }], now, 50, 5), null);
});
t('decaySeries yields points+1 monotonically decaying samples', () => {
  const s = decaySeries(entries, now, now + 6 * 3600 * 1000, 12, 5);
  assert.equal(s.length, 13);
  for (let i = 1; i < s.length; i++) assert.ok(s[i].mg <= s[i - 1].mg + 1e-9);
});

console.log(`\n${passed} tests passed.`);
