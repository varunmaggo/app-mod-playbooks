import {
  caffeineAt,
  totalForDay,
  sleepReadyAt,
  decaySeries,
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_DAILY_LIMIT_MG,
  SLEEP_THRESHOLD_MG,
} from './caffeine.js';

const STORE_KEY = 'decaf.v1';

const PRESETS = [
  { emoji: '☕', name: 'Drip coffee', mg: 95 },
  { emoji: '⚡', name: 'Espresso', mg: 63 },
  { emoji: '⚡⚡', name: 'Double espresso', mg: 126 },
  { emoji: '🥤', name: 'Cold brew', mg: 155 },
  { emoji: '🍵', name: 'Black tea', mg: 47 },
  { emoji: '🌿', name: 'Green tea', mg: 28 },
  { emoji: '🪫', name: 'Energy drink', mg: 80 },
  { emoji: '🥤', name: 'Cola', mg: 34 },
  { emoji: '🟫', name: 'Decaf', mg: 2 },
];

// ---- state ----
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return {
      entries: Array.isArray(raw.entries) ? raw.entries : [],
      limit: raw.limit ?? DEFAULT_DAILY_LIMIT_MG,
      halfLife: raw.halfLife ?? DEFAULT_HALF_LIFE_HOURS,
      threshold: raw.threshold ?? SLEEP_THRESHOLD_MG,
    };
  } catch {
    return { entries: [], limit: DEFAULT_DAILY_LIMIT_MG, halfLife: DEFAULT_HALF_LIFE_HOURS, threshold: SLEEP_THRESHOLD_MG };
  }
}

let state = load();

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function addDrink(name, mg) {
  state.entries.push({ id: crypto.randomUUID(), name, mg: Math.round(mg), time: new Date().toISOString() });
  save();
  render();
}

function removeDrink(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  save();
  render();
}

// Keep only entries from the last 48h so storage and math stay bounded.
function prune() {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  state.entries = state.entries.filter((e) => Date.parse(e.time) >= cutoff);
}

// ---- helpers ----
const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const el = (id) => document.getElementById(id);

// ---- rendering ----
function renderPresets() {
  const wrap = el('presets');
  wrap.innerHTML = '';
  for (const p of PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'preset';
    btn.type = 'button';
    btn.innerHTML = `<span class="p-name">${p.emoji} ${p.name}</span><span class="p-mg">${p.mg} mg</span>`;
    btn.addEventListener('click', () => addDrink(p.name, p.mg));
    wrap.appendChild(btn);
  }
}

function renderHistory() {
  const list = el('history');
  list.innerHTML = '';
  const today = state.entries
    .filter((e) => totalForDay([e], Date.now()) > 0)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

  if (today.length === 0) {
    list.innerHTML = '<li class="empty">No drinks logged today. Add one above ☝️</li>';
    return;
  }
  for (const e of today) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.className = 'h-left';
    left.innerHTML = `<span class="h-name">${e.name}</span><span class="h-meta">${e.mg} mg · ${fmtTime(Date.parse(e.time))}</span>`;
    const del = document.createElement('button');
    del.className = 'h-del';
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', () => removeDrink(e.id));
    li.append(left, del);
    list.appendChild(li);
  }
}

function renderStats() {
  const now = Date.now();
  const current = caffeineAt(state.entries, now, state.halfLife);
  const daily = totalForDay(state.entries, now);
  const ready = sleepReadyAt(state.entries, now, state.threshold, state.halfLife);

  el('current-level').innerHTML = `${Math.round(current)}<span class="unit">mg</span>`;
  el('current-sub').textContent =
    current < 1 ? 'all clear' : current < state.threshold ? 'sleep-safe' : 'still buzzing';

  el('daily-total').innerHTML = `${Math.round(daily)}<span class="unit">mg</span>`;
  const pct = Math.min(100, (daily / state.limit) * 100);
  const meter = el('daily-meter');
  meter.style.width = pct + '%';
  meter.style.background = daily > state.limit ? 'var(--danger)' : 'var(--accent)';
  el('daily-sub').textContent =
    daily > state.limit ? `${Math.round(daily - state.limit)}mg over limit` : `of ${state.limit}mg limit`;

  if (current <= state.threshold) {
    el('sleep-time').textContent = '✓ now';
    el('sleep-sub').textContent = 'good to sleep';
  } else if (ready) {
    el('sleep-time').textContent = fmtTime(ready);
    el('sleep-sub').textContent = `under ${state.threshold}mg circulating`;
  } else {
    el('sleep-time').textContent = '24h+';
    el('sleep-sub').textContent = 'a lot in your system';
  }
}

function renderChart() {
  const canvas = el('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const now = Date.now();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 24 * 3600 * 1000;

  const series = decaySeries(state.entries, startMs, endMs, 144, state.halfLife);
  const peak = Math.max(state.threshold * 1.5, state.limit * 0.5, ...series.map((s) => s.mg), 50);

  const padL = 38, padR = 12, padT = 14, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (ms) => padL + ((ms - startMs) / (endMs - startMs)) * plotW;
  const y = (mg) => padT + plotH - (mg / peak) * plotH;

  // grid + y labels
  ctx.strokeStyle = '#2c2420';
  ctx.fillStyle = '#9a8d82';
  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const val = (peak / 4) * i;
    const yy = y(val);
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(W - padR, yy);
    ctx.stroke();
    ctx.fillText(Math.round(val), 6, yy + 3);
  }
  // x labels (every 6h)
  ctx.textAlign = 'center';
  for (let h = 0; h <= 24; h += 6) {
    const ms = startMs + h * 3600 * 1000;
    ctx.fillText(h === 24 ? '24h' : `${h}:00`, x(ms), H - 6);
  }
  ctx.textAlign = 'left';

  // sleep threshold line
  ctx.strokeStyle = '#4caf7d';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, y(state.threshold));
  ctx.lineTo(W - padR, y(state.threshold));
  ctx.stroke();
  ctx.setLineDash([]);

  // decay area + curve
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, 'rgba(217,138,61,0.35)');
  grad.addColorStop(1, 'rgba(217,138,61,0.02)');
  ctx.beginPath();
  series.forEach((p, i) => (i ? ctx.lineTo(x(p.ms), y(p.mg)) : ctx.moveTo(x(p.ms), y(p.mg))));
  ctx.lineTo(x(endMs), y(0));
  ctx.lineTo(x(startMs), y(0));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  series.forEach((p, i) => (i ? ctx.lineTo(x(p.ms), y(p.mg)) : ctx.moveTo(x(p.ms), y(p.mg))));
  ctx.strokeStyle = '#d98a3d';
  ctx.lineWidth = 2;
  ctx.stroke();

  // "now" marker
  ctx.strokeStyle = '#d98a3d';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x(now), padT);
  ctx.lineTo(x(now), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#d98a3d';
  ctx.beginPath();
  ctx.arc(x(now), y(caffeineAt(state.entries, now, state.halfLife)), 4, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  prune();
  renderHistory();
  renderStats();
  renderChart();
}

// ---- events ----
el('custom-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = el('custom-name').value.trim();
  const mg = Number(el('custom-mg').value);
  if (!name || !(mg > 0)) return;
  addDrink(name, mg);
  ev.target.reset();
  ev.target.closest('details').open = false;
});

const dialog = el('settings-dialog');
el('manage-btn').addEventListener('click', () => {
  el('set-limit').value = state.limit;
  el('set-halflife').value = state.halfLife;
  el('set-threshold').value = state.threshold;
  dialog.showModal();
});
el('settings-form').addEventListener('submit', (ev) => {
  // Only persist when the Save button was used.
  if (ev.submitter && ev.submitter.value === 'save') {
    state.limit = Number(el('set-limit').value) || DEFAULT_DAILY_LIMIT_MG;
    state.halfLife = Number(el('set-halflife').value) || DEFAULT_HALF_LIFE_HOURS;
    state.threshold = Number(el('set-threshold').value) || SLEEP_THRESHOLD_MG;
    save();
    render();
  }
});
el('clear-today').addEventListener('click', () => {
  const now = Date.now();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  state.entries = state.entries.filter((e) => Date.parse(e.time) < start.getTime());
  save();
  render();
  dialog.close();
});

// Refresh decay/stats every minute so the live numbers stay current.
renderPresets();
render();
setInterval(render, 60 * 1000);
